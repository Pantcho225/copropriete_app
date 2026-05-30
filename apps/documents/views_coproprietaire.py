# apps/documents/views_coproprietaire.py
from __future__ import annotations

from typing import Any

from django.apps import apps
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.models import CoproMembre
from apps.owners.models import ProprietaireLot

from .models import DocumentMasqueCoproprietaire


def _serialize_date(value):
    if value is None:
        return None

    if hasattr(value, "date"):
        try:
            return value.date().isoformat()
        except Exception:
            return value.isoformat()

    if hasattr(value, "isoformat"):
        return value.isoformat()

    return str(value)


def _file_url(request, file_field) -> str:
    if not file_field:
        return ""

    try:
        if not file_field.name:
            return ""

        return request.build_absolute_uri(file_field.url)
    except Exception:
        return ""


def _file_name(file_field) -> str:
    if not file_field:
        return ""

    try:
        return file_field.name.split("/")[-1]
    except Exception:
        return ""


def _lot_label(lot) -> str:
    if not lot:
        return "Lot"

    numero = getattr(lot, "numero", None)
    reference = getattr(lot, "reference", None)

    if numero:
        return str(numero)

    if reference:
        return str(reference)

    return f"Lot #{getattr(lot, 'id', '')}"


def _has_model_field(model, field_name: str) -> bool:
    return any(field.name == field_name for field in model._meta.get_fields())


def _get_model(app_labels: tuple[str, ...], model_name: str):
    for app_label in app_labels:
        try:
            return apps.get_model(app_label, model_name)
        except LookupError:
            continue

    return None


def _get_coproprietaire_scope(user):
    copro_ids = list(
        CoproMembre.objects.filter(
            user=user,
            is_active=True,
            role=CoproMembre.Role.COPROPRIETAIRE,
        ).values_list("copropriete_id", flat=True)
    )

    if not copro_ids:
        return [], []

    liens_lots = (
        ProprietaireLot.objects.filter(
            coproprietaire__user_account=user,
            copropriete_id__in=copro_ids,
            date_fin__isnull=True,
        )
        .select_related("copropriete", "coproprietaire", "lot")
        .order_by("lot_id", "-date_debut", "-id")
    )

    lot_ids = list(liens_lots.values_list("lot_id", flat=True).distinct())

    return copro_ids, lot_ids


def _document_payload(
    *,
    doc_id: str,
    titre: str,
    categorie: str,
    source: str,
    url: str,
    filename: str = "",
    date_document=None,
    lot=None,
    meta: dict[str, Any] | None = None,
):
    return {
        "id": doc_id,
        "titre": titre,
        "categorie": categorie,
        "source": source,
        "url": url,
        "filename": filename,
        "date_document": _serialize_date(date_document),
        "lot": {
            "id": getattr(lot, "id", None) if lot else None,
            "label": _lot_label(lot) if lot else "",
            "reference": getattr(lot, "reference", "") if lot else "",
            "numero": getattr(lot, "numero", "") if lot else "",
            "type_lot": getattr(lot, "type_lot", "") if lot else "",
            "etage": getattr(lot, "etage", "") if lot else "",
        },
        "meta": meta or {},
    }


class CoproprietaireDocumentsAPIView(APIView):
    """
    GET /api/documents/coproprietaire/documents/

    Documents visibles dans l'espace copropriétaire.

    Règle importante :
    - les documents officiels ne sont pas supprimés physiquement ;
    - si un copropriétaire masque un document, il disparaît seulement
      de son espace personnel.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        copro_ids, lot_ids = _get_coproprietaire_scope(request.user)

        if not copro_ids or not lot_ids:
            return Response(
                {
                    "count": 0,
                    "stats": {
                        "total": 0,
                        "relances": 0,
                        "ag": 0,
                        "autres": 0,
                        "masques": 0,
                    },
                    "documents": [],
                }
            )

        include_hidden = str(
            request.query_params.get("include_hidden", "")
        ).lower() in {"1", "true", "yes"}

        documents = self._build_documents(
            request=request,
            copro_ids=copro_ids,
            lot_ids=lot_ids,
        )

        hidden_rows = DocumentMasqueCoproprietaire.objects.filter(
            user=request.user,
            document_id__in=[doc["id"] for doc in documents],
        )

        hidden_map = {row.document_id: row for row in hidden_rows}

        for doc in documents:
            hidden_row = hidden_map.get(doc["id"])
            doc["is_hidden"] = bool(hidden_row)
            doc["hidden_at"] = (
                _serialize_date(hidden_row.hidden_at) if hidden_row else None
            )

        if not include_hidden:
            documents = [doc for doc in documents if not doc["is_hidden"]]

        q = request.query_params.get("q")
        if q:
            q = q.strip().lower()
            documents = [
                doc
                for doc in documents
                if q
                in " ".join(
                    [
                        doc.get("titre", ""),
                        doc.get("categorie", ""),
                        doc.get("source", ""),
                        doc.get("filename", ""),
                        doc.get("lot", {}).get("label", ""),
                        doc.get("lot", {}).get("reference", ""),
                    ]
                ).lower()
            ]

        categorie = request.query_params.get("categorie")
        if categorie:
            categorie = categorie.strip().upper()
            documents = [
                doc
                for doc in documents
                if str(doc.get("categorie", "")).upper() == categorie
            ]

        documents.sort(
            key=lambda doc: doc.get("date_document") or "",
            reverse=True,
        )

        stats = {
            "total": len(documents),
            "relances": sum(1 for doc in documents if doc["categorie"] == "RELANCE"),
            "ag": sum(1 for doc in documents if doc["categorie"] == "AG"),
            "autres": sum(
                1 for doc in documents if doc["categorie"] not in {"RELANCE", "AG"}
            ),
            "masques": len(hidden_map),
        }

        return Response(
            {
                "count": len(documents),
                "stats": stats,
                "documents": documents,
            }
        )

    def _build_documents(self, *, request, copro_ids, lot_ids):
        documents = []

        documents.extend(
            self._collect_relance_documents(
                request=request,
                copro_ids=copro_ids,
                lot_ids=lot_ids,
            )
        )

        documents.extend(
            self._collect_ag_documents(
                request=request,
                copro_ids=copro_ids,
            )
        )

        return documents

    def _collect_relance_documents(self, *, request, copro_ids, lot_ids):
        Relance = _get_model(("relances",), "Relance")

        if Relance is None:
            return []

        if not _has_model_field(Relance, "document_pdf"):
            return []

        qs = Relance.objects.filter(
            copropriete_id__in=copro_ids,
            lot_id__in=lot_ids,
        )

        if _has_model_field(Relance, "statut"):
            qs = qs.filter(statut="ENVOYEE")

        qs = (
            qs.exclude(document_pdf="")
            .exclude(document_pdf__isnull=True)
            .select_related("lot", "appel", "dossier")
            .order_by("-created_at", "-id")
        )

        documents = []

        for relance in qs:
            file_field = getattr(relance, "document_pdf", None)
            url = _file_url(request, file_field)

            if not url:
                continue

            appel = getattr(relance, "appel", None)
            lot = getattr(relance, "lot", None)

            titre = (
                getattr(relance, "objet", "")
                or f"Relance niveau {getattr(relance, 'niveau', '')}"
                or "Relance"
            )

            documents.append(
                _document_payload(
                    doc_id=f"relance-{relance.id}",
                    titre=titre,
                    categorie="RELANCE",
                    source="Relances",
                    url=url,
                    filename=_file_name(file_field),
                    date_document=getattr(relance, "created_at", None),
                    lot=lot,
                    meta={
                        "relance_id": relance.id,
                        "niveau": getattr(relance, "niveau", None),
                        "canal": getattr(relance, "canal", ""),
                        "statut": getattr(relance, "statut", ""),
                        "appel_id": getattr(appel, "id", None),
                        "appel_libelle": getattr(appel, "libelle", ""),
                    },
                )
            )

        return documents

    def _collect_ag_documents(self, *, request, copro_ids):
        AssembleeGenerale = _get_model(("ag",), "AssembleeGenerale")

        if AssembleeGenerale is None:
            return []

        if not _has_model_field(AssembleeGenerale, "copropriete"):
            return []

        has_status = _has_model_field(AssembleeGenerale, "statut")
        has_pv_locked = _has_model_field(AssembleeGenerale, "pv_locked")

        qs = AssembleeGenerale.objects.filter(copropriete_id__in=copro_ids)

        if has_status:
            qs = qs.filter(statut__in=["CLOTUREE", "ARCHIVEE"])
        elif has_pv_locked:
            qs = qs.filter(pv_locked=True)

        qs = qs.order_by("-id")

        document_candidates = []

        if _has_model_field(AssembleeGenerale, "pv_signed_pdf"):
            document_candidates.append(
                ("pv_signed_pdf", "PV d’assemblée générale signé")
            )

        if _has_model_field(AssembleeGenerale, "pv_archive_pdf"):
            document_candidates.append(
                ("pv_archive_pdf", "PV d’assemblée générale archivé")
            )

        if _has_model_field(AssembleeGenerale, "pv_pdf"):
            document_candidates.append(("pv_pdf", "PV d’assemblée générale"))

        if not document_candidates:
            return []

        documents = []

        for ag in qs:
            selected_field = ""
            selected_label = ""
            selected_file = None
            selected_url = ""

            for field_name, label in document_candidates:
                file_field = getattr(ag, field_name, None)
                url = _file_url(request, file_field)

                if url:
                    selected_field = field_name
                    selected_label = label
                    selected_file = file_field
                    selected_url = url
                    break

            if not selected_field or not selected_url:
                continue

            date_document = (
                getattr(ag, "pv_signed_at", None)
                or getattr(ag, "pv_generated_at", None)
                or getattr(ag, "date_assemblee", None)
                or getattr(ag, "created_at", None)
            )

            titre_ag = (
                getattr(ag, "titre", "")
                or getattr(ag, "libelle", "")
                or getattr(ag, "objet", "")
                or f"Assemblée générale #{ag.id}"
            )

            documents.append(
                _document_payload(
                    doc_id=f"ag-{ag.id}-{selected_field}",
                    titre=f"{selected_label} — {titre_ag}",
                    categorie="AG",
                    source="Assemblées générales",
                    url=selected_url,
                    filename=_file_name(selected_file),
                    date_document=date_document,
                    lot=None,
                    meta={
                        "ag_id": ag.id,
                        "field": selected_field,
                        "statut": getattr(ag, "statut", ""),
                        "pv_locked": bool(getattr(ag, "pv_locked", False)),
                    },
                )
            )

        return documents


class CoproprietaireMasquerDocumentAPIView(APIView):
    """
    POST /api/documents/coproprietaire/documents/masquer/

    Payload :
    {
      "document_id": "ag-38-pv_signed_pdf"
    }
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        document_id = str(
            request.data.get("document_id") or request.data.get("id") or ""
        ).strip()

        if not document_id:
            return Response(
                {"detail": "document_id est requis."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        copro_ids, lot_ids = _get_coproprietaire_scope(request.user)

        if not copro_ids or not lot_ids:
            return Response(
                {"detail": "Aucun périmètre copropriétaire actif trouvé."},
                status=status.HTTP_403_FORBIDDEN,
            )

        service = CoproprietaireDocumentsAPIView()
        documents = service._build_documents(
            request=request,
            copro_ids=copro_ids,
            lot_ids=lot_ids,
        )

        doc = next((item for item in documents if item["id"] == document_id), None)

        if not doc:
            return Response(
                {
                    "detail": (
                        "Document introuvable ou non accessible "
                        "pour votre compte."
                    )
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        hidden, created = DocumentMasqueCoproprietaire.objects.get_or_create(
            user=request.user,
            document_id=document_id,
            defaults={
                "categorie": doc.get("categorie", ""),
                "source": doc.get("source", ""),
                "titre": doc.get("titre", ""),
            },
        )

        return Response(
            {
                "success": True,
                "created": created,
                "document_id": hidden.document_id,
                "hidden_at": _serialize_date(hidden.hidden_at),
            },
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )


class CoproprietaireRestaurerDocumentAPIView(APIView):
    """
    POST /api/documents/coproprietaire/documents/restaurer/

    Payload :
    {
      "document_id": "ag-38-pv_signed_pdf"
    }
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        document_id = str(
            request.data.get("document_id") or request.data.get("id") or ""
        ).strip()

        if not document_id:
            return Response(
                {"detail": "document_id est requis."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        deleted_count, _ = DocumentMasqueCoproprietaire.objects.filter(
            user=request.user,
            document_id=document_id,
        ).delete()

        return Response(
            {
                "success": True,
                "restored": deleted_count > 0,
                "document_id": document_id,
            }
        )