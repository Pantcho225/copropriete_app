from __future__ import annotations

from django.db.models import Q
from django.utils import timezone
from rest_framework import filters, mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import AvisRegularisation, DossierImpaye, Relance
from .permissions import IsAdminOrSyndicWriteReadOnly
from .serializers import (
    AvisRegularisationSerializer,
    DossierImpayeDetailSerializer,
    DossierImpayeListSerializer,
    RelanceCreateSerializer,
    RelanceSerializer,
)
from .services import cancel_relance, create_relance, generate_avis_regularisation


TRUE_VALUES = {"1", "true", "oui", "yes"}
FALSE_VALUES = {"0", "false", "non", "no"}


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


class DossierImpayeViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.OrderingFilter]
    ordering_fields = [
        "date_echeance",
        "montant_initial",
        "montant_paye",
        "reste_a_payer",
        "niveau_relance",
        "relances_count",
        "derniere_relance_at",
        "created_at",
        "updated_at",
    ]
    ordering = ["date_echeance", "-updated_at"]

    def _base_queryset(self):
        copro_id = _require_copro_id(self.request)
        return (
            DossierImpaye.objects.select_related(
                "copropriete",
                "lot",
                "coproprietaire",
                "appel",
            )
            .prefetch_related("relances")
            .filter(copropriete_id=copro_id)
        )

    def _apply_filters(self, qs):
        params = self.request.query_params

        statut = params.get("statut")
        lot_id = params.get("lot")
        coproprietaire_id = params.get("coproprietaire")
        appel_id = params.get("appel")
        est_regularise = params.get("est_regularise")
        auto_relance_active = params.get("auto_relance_active")
        echeance_depassee = params.get("echeance_depassee")
        q = params.get("q")

        if statut:
            qs = qs.filter(statut=statut)

        if lot_id:
            qs = qs.filter(lot_id=lot_id)

        if coproprietaire_id:
            qs = qs.filter(coproprietaire_id=coproprietaire_id)

        if appel_id:
            qs = qs.filter(appel_id=appel_id)

        if est_regularise is not None:
            value = est_regularise.strip().lower()
            if value in TRUE_VALUES:
                qs = qs.filter(est_regularise=True)
            elif value in FALSE_VALUES:
                qs = qs.filter(est_regularise=False)

        if auto_relance_active is not None:
            value = auto_relance_active.strip().lower()
            if value in TRUE_VALUES:
                qs = qs.filter(auto_relance_active=True)
            elif value in FALSE_VALUES:
                qs = qs.filter(auto_relance_active=False)

        if echeance_depassee is not None:
            value = echeance_depassee.strip().lower()
            today = self._today()
            if value in TRUE_VALUES:
                qs = qs.filter(date_echeance__lt=today)
            elif value in FALSE_VALUES:
                qs = qs.filter(date_echeance__gte=today)

        if q:
            qs = qs.filter(
                Q(reference_appel__icontains=q)
                | Q(commentaire_interne__icontains=q)
            )

        return qs

    def get_queryset(self):
        qs = self._apply_filters(self._base_queryset())

        # Par défaut, la liste /api/relances/dossiers/ doit afficher
        # uniquement les vrais impayés actifs.
        if self.action == "list":
            params = self.request.query_params
            statut = params.get("statut")
            est_regularise = params.get("est_regularise")

            # Si aucun filtre explicite n'est demandé, on masque les
            # dossiers déjà régularisés / soldés.
            if not statut and est_regularise is None:
                qs = qs.filter(est_regularise=False, reste_a_payer__gt=0)

        return qs

    def get_serializer_class(self):
        if self.action == "retrieve":
            return DossierImpayeDetailSerializer
        return DossierImpayeListSerializer

    @action(detail=True, methods=["get"], url_path="historique-relances")
    def historique_relances(self, request, pk=None):
        copro_id = _require_copro_id(request)
        dossier = self.get_object()
        _assert_same_copro(dossier, copro_id)

        queryset = dossier.relances.select_related(
            "copropriete",
            "lot",
            "coproprietaire",
            "appel",
            "envoye_par",
            "annulee_par",
        ).all()
        serializer = RelanceSerializer(queryset, many=True, context={"request": request})
        return Response(serializer.data)

    @action(
        detail=True,
        methods=["post"],
        url_path="envoyer-relance",
        permission_classes=[IsAdminOrSyndicWriteReadOnly],
    )
    def envoyer_relance(self, request, pk=None):
        copro_id = _require_copro_id(request)
        dossier = self.get_object()
        _assert_same_copro(dossier, copro_id)

        canal = (request.data.get("canal") or "").strip()
        objet = (request.data.get("objet") or "").strip()
        message = (request.data.get("message") or "").strip()

        if not canal:
            return Response(
                {"detail": "Le canal est obligatoire."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        relance = create_relance(
            dossier=dossier,
            canal=canal,
            utilisateur=request.user,
            message=message,
            objet=objet,
        )
        serializer = RelanceSerializer(relance, context={"request": request})
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(
        detail=True,
        methods=["post"],
        url_path="generer-avis-regularisation",
        permission_classes=[IsAdminOrSyndicWriteReadOnly],
    )
    def generer_avis_regularisation(self, request, pk=None):
        copro_id = _require_copro_id(request)
        dossier = self.get_object()
        _assert_same_copro(dossier, copro_id)

        canal = request.data.get("canal", AvisRegularisation.Canal.INTERNE)
        message = (request.data.get("message") or "").strip()

        avis = generate_avis_regularisation(
            dossier=dossier,
            utilisateur=request.user,
            canal=canal,
            message=message,
        )
        serializer = AvisRegularisationSerializer(avis, context={"request": request})
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=False, methods=["get"], url_path="stats")
    def stats(self, request):
        qs = self._apply_filters(self._base_queryset())

        data = {
            "total": qs.filter(est_regularise=False, reste_a_payer__gt=0).count(),
            "regularises": qs.filter(est_regularise=True).count(),
            "non_regularises": qs.filter(est_regularise=False).count(),
            "en_retard": qs.filter(
                statut=DossierImpaye.Statut.EN_RETARD,
                est_regularise=False,
                reste_a_payer__gt=0,
            ).count(),
            "partiellement_payes": qs.filter(
                statut=DossierImpaye.Statut.PARTIELLEMENT_PAYE,
                est_regularise=False,
                reste_a_payer__gt=0,
            ).count(),
            "payes": qs.filter(statut=DossierImpaye.Statut.PAYE).count(),
        }
        return Response(data)

    @staticmethod
    def _today():
        return timezone.localdate()


class RelanceViewSet(
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    filter_backends = [filters.OrderingFilter]
    ordering_fields = [
        "date_envoi",
        "niveau",
        "canal",
        "statut",
        "created_at",
        "updated_at",
    ]
    ordering = ["-date_envoi", "-created_at"]

    def get_permissions(self):
        if self.action in {"create", "annuler"}:
            return [IsAdminOrSyndicWriteReadOnly()]
        return [IsAuthenticated()]

    def get_queryset(self):
        copro_id = _require_copro_id(self.request)

        qs = (
            Relance.objects.select_related(
                "copropriete",
                "dossier",
                "appel",
                "lot",
                "coproprietaire",
                "envoye_par",
                "annulee_par",
            )
            .filter(copropriete_id=copro_id)
            .all()
        )

        params = self.request.query_params

        dossier_id = params.get("dossier")
        appel_id = params.get("appel")
        lot_id = params.get("lot")
        coproprietaire_id = params.get("coproprietaire")
        statut = params.get("statut")
        canal = params.get("canal")
        niveau = params.get("niveau")

        if dossier_id:
            qs = qs.filter(dossier_id=dossier_id)
        if appel_id:
            qs = qs.filter(appel_id=appel_id)
        if lot_id:
            qs = qs.filter(lot_id=lot_id)
        if coproprietaire_id:
            qs = qs.filter(coproprietaire_id=coproprietaire_id)
        if statut:
            qs = qs.filter(statut=statut)
        if canal:
            qs = qs.filter(canal=canal)
        if niveau:
            qs = qs.filter(niveau=niveau)

        return qs

    def get_serializer_class(self):
        if self.action == "create":
            return RelanceCreateSerializer
        return RelanceSerializer

    def perform_create(self, serializer):
        copro_id = _require_copro_id(self.request)
        dossier = serializer.validated_data.get("dossier")
        if dossier:
            _assert_same_copro(dossier, copro_id)
        serializer.save()

    @action(detail=True, methods=["post"], url_path="annuler")
    def annuler(self, request, pk=None):
        copro_id = _require_copro_id(request)
        relance = self.get_object()
        _assert_same_copro(relance, copro_id)

        relance = cancel_relance(
            relance=relance,
            utilisateur=request.user,
            motif_annulation=(request.data.get("motif_annulation") or "").strip(),
        )
        serializer = RelanceSerializer(relance, context={"request": request})
        return Response(serializer.data, status=status.HTTP_200_OK)


class AvisRegularisationViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.OrderingFilter]
    ordering_fields = [
        "date_regularisation",
        "statut",
        "created_at",
        "updated_at",
    ]
    ordering = ["-date_regularisation", "-created_at"]

    def get_queryset(self):
        copro_id = _require_copro_id(self.request)

        qs = (
            AvisRegularisation.objects.select_related(
                "copropriete",
                "dossier",
                "appel",
                "lot",
                "coproprietaire",
                "genere_par",
            )
            .filter(copropriete_id=copro_id)
            .all()
        )

        params = self.request.query_params

        dossier_id = params.get("dossier")
        appel_id = params.get("appel")
        lot_id = params.get("lot")
        coproprietaire_id = params.get("coproprietaire")
        statut = params.get("statut")
        canal = params.get("canal")

        if dossier_id:
            qs = qs.filter(dossier_id=dossier_id)
        if appel_id:
            qs = qs.filter(appel_id=appel_id)
        if lot_id:
            qs = qs.filter(lot_id=lot_id)
        if coproprietaire_id:
            qs = qs.filter(coproprietaire_id=coproprietaire_id)
        if statut:
            qs = qs.filter(statut=statut)
        if canal:
            qs = qs.filter(canal=canal)

        return qs

    def get_serializer_class(self):
        return AvisRegularisationSerializer