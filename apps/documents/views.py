# apps/documents/views.py
from __future__ import annotations

from django.db.models import Q
from django.http import FileResponse
from django.utils import timezone

from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.models import CoproMembre
from apps.owners.models import ProprietaireLot

from .models import GeneratedDocument
from .serializers import GeneratedDocumentSerializer
from .services.pdf import (
    generate_mandat_ag_pdf_bytes,
    generate_relance_impaye_pdf_bytes,
    make_reference,
    save_generated_document,
)


def _require_copro_id(request) -> str:
    copro_id = getattr(request, "copropriete_id", None)
    if not copro_id:
        copro_id = request.headers.get("X-Copropriete-Id")
    if not copro_id:
        raise ValidationError({"detail": "En-tête X-Copropriete-Id requis."})
    return str(copro_id)


def _assert_same_copro(obj, copro_id: str):
    if str(getattr(obj, "copropriete_id", "")) != str(copro_id):
        raise ValidationError(
            {"detail": "Ressource hors périmètre de la copropriété courante."}
        )


def _default_relance_message(dossier) -> str:
    return (
        "Sauf erreur ou omission de notre part, nous constatons que le règlement "
        "des charges de copropriété reste à régulariser. Nous vous invitons à procéder "
        "au paiement dans les meilleurs délais ou à contacter le syndic pour toute clarification."
    )


class GeneratedDocumentViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Registre documentaire admin/syndic.

    GET /api/documents/generated/
    GET /api/documents/generated/:id/
    GET /api/documents/generated/:id/download/
    """

    permission_classes = [IsAuthenticated]
    serializer_class = GeneratedDocumentSerializer

    def get_queryset(self):
        copro_id = _require_copro_id(self.request)

        qs = (
            GeneratedDocument.objects.select_related(
                "copropriete",
                "related_owner",
                "related_lot",
                "related_ag",
                "related_dossier_impaye",
                "related_relance",
                "created_by",
            )
            .filter(copropriete_id=copro_id)
            .order_by("-created_at", "-id")
        )

        params = self.request.query_params

        document_type = params.get("document_type")
        status_value = params.get("status")
        related_ag = params.get("related_ag")
        related_lot = params.get("related_lot")
        related_owner = params.get("related_owner")
        q = params.get("q")

        if document_type:
            qs = qs.filter(document_type=document_type)

        if status_value:
            qs = qs.filter(status=status_value)

        if related_ag:
            qs = qs.filter(related_ag_id=related_ag)

        if related_lot:
            qs = qs.filter(related_lot_id=related_lot)

        if related_owner:
            qs = qs.filter(related_owner_id=related_owner)

        if q:
            qs = qs.filter(
                Q(reference__icontains=q)
                | Q(title__icontains=q)
                | Q(related_owner__nom__icontains=q)
                | Q(related_owner__prenom__icontains=q)
                | Q(related_lot__reference__icontains=q)
                | Q(related_lot__numero__icontains=q)
            )

        return qs

    @action(detail=True, methods=["get"], url_path="download")
    def download(self, request, pk=None):
        document = self.get_object()

        if not document.file:
            raise NotFound("Fichier PDF introuvable.")

        response = FileResponse(
            document.file.open("rb"),
            content_type="application/pdf",
        )
        response["Content-Disposition"] = f'inline; filename="{document.filename}"'
        return response


class GenerateRelanceLetterAPIView(APIView):
    """
    POST /api/documents/generate/relance/:dossier_id/

    Génère :
    - une Relance canal PDF ;
    - son PDF ;
    - un GeneratedDocument visible côté copropriétaire.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request, dossier_id: int):
        from django.core.files.base import ContentFile

        from apps.relances.models import DossierImpaye, Relance
        from apps.relances.serializers import RelanceSerializer
        from apps.relances.services import create_relance

        copro_id = _require_copro_id(request)

        dossier = (
            DossierImpaye.objects.select_related(
                "copropriete",
                "lot",
                "coproprietaire",
                "appel",
            )
            .filter(pk=dossier_id, copropriete_id=copro_id)
            .first()
        )

        if not dossier:
            raise NotFound("Dossier d'impayé introuvable.")

        _assert_same_copro(dossier, copro_id)

        objet = (
            request.data.get("objet")
            or "Relance pour impayé de charges"
        ).strip()

        message = (
            request.data.get("message")
            or _default_relance_message(dossier)
        ).strip()

        relance = create_relance(
            dossier=dossier,
            canal=Relance.Canal.PDF,
            utilisateur=request.user,
            message=message,
            objet=objet,
        )

        reference = make_reference("REL", relance.id)

        pdf_bytes = generate_relance_impaye_pdf_bytes(
            dossier=dossier,
            relance=relance,
            reference=reference,
            request=request,
            message=message,
        )

        relance.document_pdf.save(
            f"courrier-relance-{relance.id:05d}.pdf",
            ContentFile(pdf_bytes),
            save=True,
        )

        generated_document = save_generated_document(
            copropriete=dossier.copropriete,
            document_type=GeneratedDocument.Type.RELANCE_IMPAYE,
            title=objet,
            reference=reference,
            pdf_bytes=pdf_bytes,
            created_by=request.user,
            related_owner=dossier.coproprietaire,
            related_lot=dossier.lot,
            related_dossier_impaye=dossier,
            related_relance=relance,
            is_visible_to_owner=True,
            metadata={
                "source": "relances",
                "dossier_id": dossier.id,
                "relance_id": relance.id,
                "montant_initial": str(dossier.montant_initial),
                "montant_paye": str(dossier.montant_paye),
                "reste_a_payer": str(dossier.reste_a_payer),
                "date_echeance": dossier.date_echeance.isoformat()
                if dossier.date_echeance
                else None,
                "generated_at": timezone.now().isoformat(),
            },
        )

        return Response(
            {
                "detail": "Courrier de relance généré avec succès.",
                "relance": RelanceSerializer(
                    relance,
                    context={"request": request},
                ).data,
                "document": GeneratedDocumentSerializer(
                    generated_document,
                    context={"request": request},
                ).data,
            },
            status=status.HTTP_201_CREATED,
        )


class GenerateAgMandatAPIView(APIView):
    """
    POST /api/documents/generate/ag/:ag_id/mandat/

    Génère un modèle PDF de mandat/procuration lié à une AG côté admin/syndic.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request, ag_id: int):
        from apps.ag.models import AssembleeGenerale

        copro_id = _require_copro_id(request)

        ag = (
            AssembleeGenerale.objects.select_related("copropriete")
            .filter(pk=ag_id, copropriete_id=copro_id)
            .first()
        )

        if not ag:
            raise NotFound("Assemblée Générale introuvable.")

        _assert_same_copro(ag, copro_id)

        if ag.statut == "CLOTUREE":
            raise ValidationError(
                {"detail": "AG clôturée : génération d'un mandat refusée."}
            )

        reference = make_reference("MANDAT-AG", ag.id)

        pdf_bytes = generate_mandat_ag_pdf_bytes(
            ag=ag,
            reference=reference,
            request=request,
        )

        title = f"Mandat de représentation - {ag.titre}"

        generated_document = save_generated_document(
            copropriete=ag.copropriete,
            document_type=GeneratedDocument.Type.MANDAT_AG,
            title=title,
            reference=reference,
            pdf_bytes=pdf_bytes,
            created_by=request.user,
            related_ag=ag,
            is_visible_to_owner=False,
            metadata={
                "source": "ag",
                "ag_id": ag.id,
                "ag_titre": ag.titre,
                "ag_date": ag.date_ag.isoformat() if ag.date_ag else None,
                "ag_lieu": ag.lieu,
                "generated_at": timezone.now().isoformat(),
            },
        )

        return Response(
            {
                "detail": "Mandat AG généré avec succès.",
                "document": GeneratedDocumentSerializer(
                    generated_document,
                    context={"request": request},
                ).data,
            },
            status=status.HTTP_201_CREATED,
        )


class CoproprietaireGenerateAgMandatAPIView(APIView):
    """
    POST /api/documents/coproprietaire/ag/:ag_id/mandat/

    Génère un mandat AG pré-rempli pour le copropriétaire connecté.
    Le document est visible dans son espace documentaire.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request, ag_id: int):
        from apps.ag.models import AssembleeGenerale

        ag = (
            AssembleeGenerale.objects.select_related("copropriete")
            .filter(pk=ag_id)
            .first()
        )

        if not ag:
            raise NotFound("Assemblée Générale introuvable.")

        if ag.statut in {"CLOTUREE", "ANNULEE", "ARCHIVEE"}:
            raise ValidationError(
                {
                    "detail": (
                        "Cette assemblée est clôturée, annulée ou archivée : "
                        "la génération d’un mandat copropriétaire n’est plus disponible."
                    )
                }
            )

        has_membership = CoproMembre.objects.filter(
            user=request.user,
            copropriete=ag.copropriete,
            is_active=True,
            role=CoproMembre.Role.COPROPRIETAIRE,
        ).exists()

        if not has_membership:
            raise PermissionDenied(
                "Vous n’avez pas accès aux documents de cette assemblée générale."
            )

        lot_id = request.data.get("lot_id") or request.data.get("lot")

        liens_qs = (
            ProprietaireLot.objects.filter(
                copropriete=ag.copropriete,
                coproprietaire__user_account=request.user,
                date_fin__isnull=True,
            )
            .select_related("coproprietaire", "lot", "copropriete")
            .order_by("-principal", "lot__reference", "lot_id", "-date_debut", "-id")
        )

        if lot_id:
            liens_qs = liens_qs.filter(lot_id=lot_id)

        lien = liens_qs.first()

        if not lien:
            if lot_id:
                raise ValidationError(
                    {
                        "detail": (
                            "Le lot sélectionné n’est pas rattaché à votre compte copropriétaire."
                        )
                    }
                )

            raise ValidationError(
                {
                    "detail": (
                        "Aucun lot actif rattaché à votre compte ne permet de générer ce mandat."
                    )
                }
            )

        mandataire_nom = str(request.data.get("mandataire_nom") or "").strip()
        mandataire_telephone = str(
            request.data.get("mandataire_telephone") or ""
        ).strip()

        owner = lien.coproprietaire
        lot = lien.lot

        reference = make_reference("MANDAT-COPRO-AG", ag.id)

        pdf_bytes = generate_mandat_ag_pdf_bytes(
            ag=ag,
            reference=reference,
            request=request,
            mandant=owner,
            lot=lot,
            mandataire_nom=mandataire_nom,
            mandataire_telephone=mandataire_telephone,
        )

        title = f"Mon mandat de représentation - {ag.titre}"

        generated_document = save_generated_document(
            copropriete=ag.copropriete,
            document_type=GeneratedDocument.Type.MANDAT_AG,
            title=title,
            reference=reference,
            pdf_bytes=pdf_bytes,
            created_by=request.user,
            related_owner=owner,
            related_lot=lot,
            related_ag=ag,
            is_visible_to_owner=True,
            metadata={
                "source": "ag_coproprietaire",
                "ag_id": ag.id,
                "ag_titre": ag.titre,
                "ag_date": ag.date_ag.isoformat() if ag.date_ag else None,
                "ag_lieu": ag.lieu,
                "owner_id": owner.id,
                "owner_label": owner.display_name,
                "lot_id": lot.id,
                "lot_label": getattr(lot, "reference", "") or getattr(lot, "numero", ""),
                "mandataire_nom": mandataire_nom,
                "mandataire_telephone": mandataire_telephone,
                "generated_at": timezone.now().isoformat(),
            },
        )

        return Response(
            {
                "detail": "Mandat AG copropriétaire généré avec succès.",
                "document": GeneratedDocumentSerializer(
                    generated_document,
                    context={"request": request},
                ).data,
            },
            status=status.HTTP_201_CREATED,
        )


class CoproprietaireGeneratedDocumentsAPIView(APIView):
    """
    GET /api/documents/coproprietaire/generated/

    Première vue dédiée aux documents PDF générés visibles côté copropriétaire.
    Elle ne remplace pas encore /coproprietaire/documents/.
    On l'utilisera ensuite pour enrichir la page React existante.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        copro_ids = list(
            CoproMembre.objects.filter(
                user=request.user,
                is_active=True,
                role=CoproMembre.Role.COPROPRIETAIRE,
            ).values_list("copropriete_id", flat=True)
        )

        if not copro_ids:
            return Response({"count": 0, "documents": []})

        liens_lots = (
            ProprietaireLot.objects.filter(
                coproprietaire__user_account=request.user,
                copropriete_id__in=copro_ids,
                date_fin__isnull=True,
            )
            .select_related("coproprietaire", "lot")
            .order_by("lot_id", "-date_debut", "-id")
        )

        lot_ids = list(liens_lots.values_list("lot_id", flat=True).distinct())
        owner_ids = list(liens_lots.values_list("coproprietaire_id", flat=True).distinct())

        qs = (
            GeneratedDocument.objects.select_related(
                "copropriete",
                "related_owner",
                "related_lot",
                "related_ag",
                "related_dossier_impaye",
                "related_relance",
            )
            .filter(
                copropriete_id__in=copro_ids,
                is_visible_to_owner=True,
            )
            .filter(
                Q(related_owner_id__in=owner_ids)
                | Q(related_lot_id__in=lot_ids)
            )
            .order_by("-created_at", "-id")
        )

        serializer = GeneratedDocumentSerializer(
            qs,
            many=True,
            context={"request": request},
        )

        return Response(
            {
                "count": qs.count(),
                "documents": serializer.data,
            }
        )