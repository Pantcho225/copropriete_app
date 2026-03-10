# apps/rh/views.py
from __future__ import annotations

from django.db.models import Q
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from apps.compta.permissions import IsAdminOrSyndicWriteReadOnly
from .models import ContratEmploye, Employe
from .serializers import ContratEmployeSerializer, EmployeSerializer


def _require_copro_id(request) -> int:
    copro_id = request.headers.get("X-Copropriete-Id")
    if not copro_id:
        raise ValidationError({"detail": "En-tête X-Copropriete-Id requis."})
    try:
        return int(str(copro_id))
    except ValueError:
        raise ValidationError({"detail": "X-Copropriete-Id invalide."})


class EmployeViewSet(viewsets.ModelViewSet):
    serializer_class = EmployeSerializer
    permission_classes = [IsAdminOrSyndicWriteReadOnly]

    def get_queryset(self):
        copro_id = _require_copro_id(self.request)
        qs = Employe.objects.filter(copropriete_id=copro_id)

        search = (self.request.query_params.get("search") or "").strip()
        statut = (self.request.query_params.get("statut") or "").strip()
        ordering = (self.request.query_params.get("ordering") or "nom").strip()

        if statut:
            qs = qs.filter(statut=statut)

        if search:
            qs = qs.filter(
                Q(nom__icontains=search)
                | Q(prenoms__icontains=search)
                | Q(telephone__icontains=search)
                | Q(email__icontains=search)
                | Q(role__icontains=search)
                | Q(role_libre__icontains=search)
            )

        allowed_ordering = {
            "id",
            "-id",
            "nom",
            "-nom",
            "prenoms",
            "-prenoms",
            "date_embauche",
            "-date_embauche",
            "statut",
            "-statut",
            "salaire_base",
            "-salaire_base",
        }
        if ordering not in allowed_ordering:
            ordering = "nom"

        return qs.order_by(ordering, "id")

    @action(detail=True, methods=["post"], url_path="activer")
    def activer(self, request, pk=None):
        employe = self.get_object()
        employe.activer()
        employe.refresh_from_db()
        serializer = self.get_serializer(employe)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"], url_path="desactiver")
    def desactiver(self, request, pk=None):
        employe = self.get_object()
        employe.desactiver()
        employe.refresh_from_db()
        serializer = self.get_serializer(employe)
        return Response(serializer.data, status=status.HTTP_200_OK)


class ContratEmployeViewSet(viewsets.ModelViewSet):
    serializer_class = ContratEmployeSerializer
    permission_classes = [IsAdminOrSyndicWriteReadOnly]

    def get_queryset(self):
        copro_id = _require_copro_id(self.request)
        qs = (
            ContratEmploye.objects.select_related("employe")
            .filter(employe__copropriete_id=copro_id)
        )

        search = (self.request.query_params.get("search") or "").strip()
        statut = (self.request.query_params.get("statut") or "").strip()
        ordering = (self.request.query_params.get("ordering") or "-date_debut").strip()

        if statut:
            qs = qs.filter(statut=statut)

        if search:
            qs = qs.filter(
                Q(employe__nom__icontains=search)
                | Q(employe__prenoms__icontains=search)
                | Q(employe__role__icontains=search)
                | Q(employe__role_libre__icontains=search)
                | Q(type_contrat__icontains=search)
                | Q(type_contrat_libre__icontains=search)
                | Q(notes__icontains=search)
            )

        allowed_ordering = {
            "id",
            "-id",
            "date_debut",
            "-date_debut",
            "date_fin",
            "-date_fin",
            "statut",
            "-statut",
            "salaire_mensuel",
            "-salaire_mensuel",
        }
        if ordering not in allowed_ordering:
            ordering = "-date_debut"

        return qs.order_by(ordering, "-id")

    @action(detail=True, methods=["post"], url_path="activer")
    def activer(self, request, pk=None):
        contrat = self.get_object()
        contrat.activer()
        contrat.refresh_from_db()
        serializer = self.get_serializer(contrat)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"], url_path="cloturer")
    def cloturer(self, request, pk=None):
        contrat = self.get_object()
        contrat.cloturer()
        contrat.refresh_from_db()
        serializer = self.get_serializer(contrat)
        return Response(serializer.data, status=status.HTTP_200_OK)