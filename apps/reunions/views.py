from __future__ import annotations

from django.db.models import Q
from django.http import FileResponse
from django.utils import timezone

from rest_framework import parsers, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.core.models import CoproMembre

from .models import (
    ReunionAction,
    ReunionDocument,
    ReunionParticipant,
    ReunionRencontre,
)
from .serializers import (
    CoproprietaireReunionDocumentSerializer,
    CoproprietaireReunionRencontreSerializer,
    ReunionActionSerializer,
    ReunionDocumentSerializer,
    ReunionParticipantSerializer,
    ReunionRencontreSerializer,
)


def _require_copro_id(request) -> str:
    copro_id = getattr(request, "copropriete_id", None)
    if not copro_id:
        copro_id = request.headers.get("X-Copropriete-Id")

    if not copro_id:
        raise ValidationError({"detail": "En-tête X-Copropriete-Id requis."})

    return str(copro_id)


def _parse_bool(value, default: bool = False) -> bool:
    if value is None:
        return default

    if isinstance(value, bool):
        return value

    value_str = str(value).strip().lower()

    if value_str in {"1", "true", "yes", "oui", "on"}:
        return True

    if value_str in {"0", "false", "no", "non", "off"}:
        return False

    return default


def _role_values(*names: str) -> list[str]:
    values: list[str] = []
    for name in names:
        if hasattr(CoproMembre.Role, name):
            values.append(getattr(CoproMembre.Role, name))
    return values


REUNIONS_MANAGE_ROLES = tuple(
    _role_values(
        "ADMIN",
        "SYNDIC",
        "GESTIONNAIRE",
        "COMPTABLE",
        "CONSEIL_SYNDICAL",
    )
)


def _assert_can_manage_copro(request, copro_id: str) -> None:
    user = request.user

    if not user or not user.is_authenticated:
        raise PermissionDenied("Authentification requise.")

    if getattr(user, "is_superuser", False):
        return

    has_membership = CoproMembre.objects.filter(
        user=user,
        copropriete_id=copro_id,
        is_active=True,
        role__in=REUNIONS_MANAGE_ROLES,
    ).exists()

    if not has_membership:
        raise PermissionDenied(
            "Vous n’avez pas le droit de gérer les réunions de cette copropriété."
        )


def _assert_can_access_copro(request, copro_id: str) -> None:
    user = request.user

    if not user or not user.is_authenticated:
        raise PermissionDenied("Authentification requise.")

    if getattr(user, "is_superuser", False):
        return

    has_membership = CoproMembre.objects.filter(
        user=user,
        copropriete_id=copro_id,
        is_active=True,
    ).exists()

    if not has_membership:
        raise PermissionDenied(
            "Vous n’avez pas accès aux réunions de cette copropriété."
        )


class ReunionRencontreViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = ReunionRencontreSerializer

    def get_queryset(self):
        copro_id = _require_copro_id(self.request)
        _assert_can_manage_copro(self.request, copro_id)

        qs = (
            ReunionRencontre.objects.select_related(
                "copropriete",
                "created_by",
                "updated_by",
            )
            .prefetch_related("participants", "documents", "actions")
            .filter(copropriete_id=copro_id)
            .order_by("-date_debut", "-id")
        )

        params = self.request.query_params
        type_value = params.get("type")
        statut = params.get("statut")
        visible = params.get("visible_coproprietaire")
        q = params.get("q")

        if type_value:
            qs = qs.filter(type=type_value)

        if statut:
            qs = qs.filter(statut=statut)

        if visible is not None and visible != "":
            qs = qs.filter(visible_coproprietaire=_parse_bool(visible))

        if q:
            qs = qs.filter(
                Q(titre__icontains=q)
                | Q(reference__icontains=q)
                | Q(objet__icontains=q)
                | Q(description__icontains=q)
                | Q(lieu__icontains=q)
            )

        return qs

    def perform_create(self, serializer):
        copro_id = _require_copro_id(self.request)
        _assert_can_manage_copro(self.request, copro_id)

        serializer.save(
            copropriete_id=copro_id,
            created_by=self.request.user,
            updated_by=self.request.user,
        )

    def perform_update(self, serializer):
        copro_id = _require_copro_id(self.request)
        _assert_can_manage_copro(self.request, copro_id)

        instance = serializer.save(updated_by=self.request.user)

        if str(instance.copropriete_id) != str(copro_id):
            raise ValidationError(
                {"detail": "Ressource hors périmètre de la copropriété courante."}
            )

    @action(detail=True, methods=["post"], url_path="publier")
    def publier(self, request, pk=None):
        reunion = self.get_object()

        has_compte_rendu = bool((reunion.compte_rendu or "").strip())
        has_visible_document = reunion.documents.filter(
            visible_coproprietaire=True,
        ).exists()

        if not has_compte_rendu and not has_visible_document:
            raise ValidationError(
                {
                    "detail": (
                        "Ajoutez un compte rendu ou au moins un document visible "
                        "avant publication côté copropriétaire."
                    )
                }
            )

        reunion.statut = ReunionRencontre.Statut.PUBLIEE
        reunion.visible_coproprietaire = True
        reunion.date_publication = reunion.date_publication or timezone.now()
        reunion.updated_by = request.user
        reunion.save(
            update_fields=[
                "statut",
                "visible_coproprietaire",
                "date_publication",
                "updated_by",
                "updated_at",
            ]
        )

        serializer = self.get_serializer(reunion)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"], url_path="archiver")
    def archiver(self, request, pk=None):
        reunion = self.get_object()
        reunion.statut = ReunionRencontre.Statut.ARCHIVEE
        reunion.visible_coproprietaire = False
        reunion.date_publication = None
        reunion.updated_by = request.user
        reunion.save(
            update_fields=[
                "statut",
                "visible_coproprietaire",
                "date_publication",
                "updated_by",
                "updated_at",
            ]
        )

        serializer = self.get_serializer(reunion)
        return Response(serializer.data, status=status.HTTP_200_OK)


class ReunionParticipantViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = ReunionParticipantSerializer

    def perform_create(self, serializer):
        copro_id = _require_copro_id(self.request)
        _assert_can_manage_copro(self.request, copro_id)
        serializer.save()

    def perform_update(self, serializer):
        copro_id = _require_copro_id(self.request)
        _assert_can_manage_copro(self.request, copro_id)
        serializer.save()

    def get_queryset(self):
        copro_id = _require_copro_id(self.request)
        _assert_can_manage_copro(self.request, copro_id)

        qs = (
            ReunionParticipant.objects.select_related(
                "reunion",
                "user",
                "coproprietaire",
            )
            .filter(reunion__copropriete_id=copro_id)
            .order_by("ordre", "nom_complet", "id")
        )

        reunion_id = self.request.query_params.get("reunion")
        type_value = self.request.query_params.get("type")
        present = self.request.query_params.get("present")
        q = self.request.query_params.get("q")

        if reunion_id:
            qs = qs.filter(reunion_id=reunion_id)

        if type_value:
            qs = qs.filter(type=type_value)

        if present is not None and present != "":
            qs = qs.filter(present=_parse_bool(present))

        if q:
            qs = qs.filter(
                Q(nom_complet__icontains=q)
                | Q(organisation__icontains=q)
                | Q(fonction__icontains=q)
                | Q(email__icontains=q)
                | Q(telephone__icontains=q)
            )

        return qs


class ReunionDocumentViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = ReunionDocumentSerializer
    parser_classes = [parsers.MultiPartParser, parsers.FormParser, parsers.JSONParser]

    def get_queryset(self):
        copro_id = _require_copro_id(self.request)
        _assert_can_manage_copro(self.request, copro_id)

        qs = (
            ReunionDocument.objects.select_related(
                "reunion",
                "document_administratif",
                "created_by",
            )
            .filter(reunion__copropriete_id=copro_id)
            .order_by("ordre", "-created_at", "-id")
        )

        reunion_id = self.request.query_params.get("reunion")
        type_value = self.request.query_params.get("type")
        visible = self.request.query_params.get("visible_coproprietaire")
        q = self.request.query_params.get("q")

        if reunion_id:
            qs = qs.filter(reunion_id=reunion_id)

        if type_value:
            qs = qs.filter(type=type_value)

        if visible is not None and visible != "":
            qs = qs.filter(visible_coproprietaire=_parse_bool(visible))

        if q:
            qs = qs.filter(
                Q(titre__icontains=q)
                | Q(description__icontains=q)
                | Q(nom_fichier_original__icontains=q)
            )

        return qs

    def perform_create(self, serializer):
        copro_id = _require_copro_id(self.request)
        _assert_can_manage_copro(self.request, copro_id)

        uploaded_file = self.request.FILES.get("fichier")
        original_filename = getattr(uploaded_file, "name", "") if uploaded_file else ""
        mime_type = getattr(uploaded_file, "content_type", "") if uploaded_file else ""
        size_bytes = getattr(uploaded_file, "size", 0) if uploaded_file else 0

        serializer.save(
            nom_fichier_original=original_filename,
            mime_type=mime_type,
            taille_octets=size_bytes or 0,
            created_by=self.request.user,
        )

    def perform_update(self, serializer):
        copro_id = _require_copro_id(self.request)
        _assert_can_manage_copro(self.request, copro_id)

        uploaded_file = self.request.FILES.get("fichier")
        extra = {}

        if uploaded_file:
            extra.update(
                {
                    "nom_fichier_original": getattr(uploaded_file, "name", ""),
                    "mime_type": getattr(uploaded_file, "content_type", ""),
                    "taille_octets": getattr(uploaded_file, "size", 0) or 0,
                }
            )

        serializer.save(**extra)

    @action(detail=True, methods=["get"], url_path="download")
    def download(self, request, pk=None):
        document = self.get_object()
        file_obj = document.effective_file

        if not file_obj:
            raise NotFound("Fichier introuvable.")

        content_type = document.effective_mime_type or "application/octet-stream"
        disposition = "attachment" if _parse_bool(request.query_params.get("download")) else "inline"

        response = FileResponse(file_obj.open("rb"), content_type=content_type)
        response["Content-Disposition"] = (
            f'{disposition}; filename="{document.filename or "document"}"'
        )
        return response


class ReunionActionViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = ReunionActionSerializer

    def get_queryset(self):
        copro_id = _require_copro_id(self.request)
        _assert_can_manage_copro(self.request, copro_id)

        qs = (
            ReunionAction.objects.select_related(
                "reunion",
                "responsable_user",
                "created_by",
                "updated_by",
            )
            .filter(reunion__copropriete_id=copro_id)
            .order_by("ordre", "echeance", "id")
        )

        reunion_id = self.request.query_params.get("reunion")
        statut_value = self.request.query_params.get("statut")
        priorite = self.request.query_params.get("priorite")
        q = self.request.query_params.get("q")

        if reunion_id:
            qs = qs.filter(reunion_id=reunion_id)

        if statut_value:
            qs = qs.filter(statut=statut_value)

        if priorite:
            qs = qs.filter(priorite=priorite)

        if q:
            qs = qs.filter(
                Q(titre__icontains=q)
                | Q(description__icontains=q)
                | Q(responsable_nom__icontains=q)
            )

        return qs

    def perform_create(self, serializer):
        copro_id = _require_copro_id(self.request)
        _assert_can_manage_copro(self.request, copro_id)

        serializer.save(
            created_by=self.request.user,
            updated_by=self.request.user,
        )

    def perform_update(self, serializer):
        copro_id = _require_copro_id(self.request)
        _assert_can_manage_copro(self.request, copro_id)

        serializer.save(updated_by=self.request.user)


class CoproprietaireReunionRencontreViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = CoproprietaireReunionRencontreSerializer

    def get_queryset(self):
        copro_id = _require_copro_id(self.request)
        _assert_can_access_copro(self.request, copro_id)

        qs = (
            ReunionRencontre.objects.prefetch_related(
                "participants",
                "documents",
                "actions",
            )
            .filter(
                copropriete_id=copro_id,
                statut=ReunionRencontre.Statut.PUBLIEE,
                visible_coproprietaire=True,
            )
            .order_by("-date_publication", "-date_debut", "-id")
        )

        type_value = self.request.query_params.get("type")
        q = self.request.query_params.get("q")

        if type_value:
            qs = qs.filter(type=type_value)

        if q:
            qs = qs.filter(
                Q(titre__icontains=q)
                | Q(reference__icontains=q)
                | Q(objet__icontains=q)
                | Q(description__icontains=q)
                | Q(compte_rendu__icontains=q)
                | Q(lieu__icontains=q)
            )

        return qs


class CoproprietaireReunionDocumentViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = CoproprietaireReunionDocumentSerializer

    def get_queryset(self):
        copro_id = _require_copro_id(self.request)
        _assert_can_access_copro(self.request, copro_id)

        return (
            ReunionDocument.objects.select_related(
                "reunion",
                "document_administratif",
                "created_by",
            )
            .filter(
                reunion__copropriete_id=copro_id,
                reunion__statut=ReunionRencontre.Statut.PUBLIEE,
                reunion__visible_coproprietaire=True,
                visible_coproprietaire=True,
            )
            .order_by("ordre", "-created_at", "-id")
        )

    @action(detail=True, methods=["get"], url_path="download")
    def download(self, request, pk=None):
        document = self.get_object()
        file_obj = document.effective_file

        if not file_obj:
            raise NotFound("Fichier introuvable.")

        content_type = document.effective_mime_type or "application/octet-stream"
        disposition = "attachment" if _parse_bool(request.query_params.get("download")) else "inline"

        response = FileResponse(file_obj.open("rb"), content_type=content_type)
        response["Content-Disposition"] = (
            f'{disposition}; filename="{document.filename or "document"}"'
        )
        return response
