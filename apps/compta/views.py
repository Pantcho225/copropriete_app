# apps/compta/views.py
from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from django.db import transaction
from django.db.models import Sum, Q
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import CompteBancaire, MouvementBancaire
from .serializers import CompteBancaireSerializer, MouvementBancaireSerializer


# =========================================================
# Helpers
# =========================================================
def _require_copro_id(request) -> int:
    copro_id = request.headers.get("X-Copropriete-Id")
    if not copro_id:
        raise ValidationError({"detail": "En-tête X-Copropriete-Id requis."})
    try:
        return int(str(copro_id))
    except ValueError:
        raise ValidationError({"detail": "X-Copropriete-Id invalide (entier requis)."})


def _parse_date_param(request, key: str):
    val = request.query_params.get(key)
    if not val:
        return None
    try:
        return datetime.strptime(val, "%Y-%m-%d").date()
    except ValueError:
        raise ValidationError({key: "Format invalide. Attendu: YYYY-MM-DD"})


# =========================================================
# ViewSets
# =========================================================
class CompteBancaireViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = CompteBancaireSerializer
    queryset = CompteBancaire.objects.all().order_by("-id")

    def get_queryset(self):
        copro_id = _require_copro_id(self.request)
        return super().get_queryset().filter(copropriete_id=copro_id)

    def perform_create(self, serializer):
        copro_id = _require_copro_id(self.request)
        serializer.save(copropriete_id=copro_id)

    def perform_update(self, serializer):
        copro_id = _require_copro_id(self.request)
        inst = serializer.instance
        if int(inst.copropriete_id) != int(copro_id):
            raise ValidationError({"detail": "Ressource hors copropriété."})
        serializer.save()

    def perform_destroy(self, instance):
        copro_id = _require_copro_id(self.request)
        if int(instance.copropriete_id) != int(copro_id):
            raise ValidationError({"detail": "Ressource hors copropriété."})
        super().perform_destroy(instance)


class MouvementBancaireViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = MouvementBancaireSerializer
    queryset = MouvementBancaire.objects.all().order_by("-date_operation", "-id")

    def get_queryset(self):
        copro_id = _require_copro_id(self.request)
        qs = (
            super()
            .get_queryset()
            .filter(copropriete_id=copro_id)
            .select_related("compte", "paiement_travaux", "paiement_appel")
        )

        compte = self.request.query_params.get("compte")
        sens = self.request.query_params.get("sens")
        dfrom = _parse_date_param(self.request, "from")
        dto = _parse_date_param(self.request, "to")
        rapproche = self.request.query_params.get("rapproche")  # "1" / "0"

        if compte:
            try:
                qs = qs.filter(compte_id=int(compte))
            except ValueError:
                raise ValidationError({"compte": "Doit être un entier."})

        if sens:
            qs = qs.filter(sens=sens)

        if dfrom:
            qs = qs.filter(date_operation__gte=dfrom)
        if dto:
            qs = qs.filter(date_operation__lte=dto)

        if rapproche == "1":
            qs = qs.filter(Q(paiement_travaux__isnull=False) | Q(paiement_appel__isnull=False))
        elif rapproche == "0":
            qs = qs.filter(paiement_travaux__isnull=True, paiement_appel__isnull=True)

        return qs

    # -----------------------------------------------------
    # Dashboard trésorerie (MVP)
    # -----------------------------------------------------
    @action(detail=False, methods=["get"], url_path="dashboard")
    def dashboard(self, request):
        """
        GET /api/compta/mouvements/dashboard/
        Retour MVP trésorerie : totaux credits/debits + soldes théoriques par compte + non rapprochés.
        """
        copro_id = _require_copro_id(request)

        comptes = CompteBancaire.objects.filter(copropriete_id=copro_id, is_active=True)

        mqs = MouvementBancaire.objects.filter(copropriete_id=copro_id)
        total_credit = Decimal(str(mqs.filter(sens="CREDIT").aggregate(t=Sum("montant")).get("t") or 0))
        total_debit = Decimal(str(mqs.filter(sens="DEBIT").aggregate(t=Sum("montant")).get("t") or 0))
        nb_non_rapproches = mqs.filter(paiement_travaux__isnull=True, paiement_appel__isnull=True).count()

        rows = (
            mqs.values("compte_id", "sens")
            .annotate(total=Sum("montant"))
            .order_by()
        )

        by_compte: dict[int, dict[str, Decimal]] = {}
        for r in rows:
            cid = int(r["compte_id"])
            by_compte.setdefault(cid, {"CREDIT": Decimal("0"), "DEBIT": Decimal("0")})
            by_compte[cid][r["sens"]] = Decimal(str(r["total"] or 0))

        comptes_out = []
        for c in comptes:
            agg = by_compte.get(c.id, {"CREDIT": Decimal("0"), "DEBIT": Decimal("0")})
            solde = Decimal(str(c.solde_initial)) + agg["CREDIT"] - agg["DEBIT"]
            comptes_out.append(
                {
                    "compte_id": c.id,
                    "nom": c.nom,
                    "devise": c.devise,
                    "solde_initial": float(c.solde_initial),
                    "total_credit": float(agg["CREDIT"]),
                    "total_debit": float(agg["DEBIT"]),
                    "solde_theorique": float(solde),
                }
            )

        return Response(
            {
                "copropriete_id": int(copro_id),
                "totaux": {
                    "total_credit": float(total_credit),
                    "total_debit": float(total_debit),
                    "solde_net_mouvements": float(total_credit - total_debit),
                    "nb_non_rapproches": int(nb_non_rapproches),
                },
                "comptes": comptes_out,
            },
            status=status.HTTP_200_OK,
        )

    # -----------------------------------------------------
    # MVP+ : Auto-mouvement depuis PaiementTravaux
    # -----------------------------------------------------
    @action(detail=False, methods=["post"], url_path="auto-from-paiement-travaux")
    def auto_from_paiement_travaux(self, request):
        """
        POST /api/compta/mouvements/auto-from-paiement-travaux/
        Payload:
          - paiement_travaux: int (requis)
          - reference: str (optionnel)
          - libelle: str (optionnel)
          - note: str (optionnel)

        Comportement:
          - utilise le compte bancaire default (is_default=True) de la copro
          - crée un mouvement DEBIT rapproché au paiement travaux
          - idempotent: si un mouvement existe déjà pour ce paiement -> renvoie 200
        """
        copro_id = _require_copro_id(request)

        paiement_id = request.data.get("paiement_travaux")
        if paiement_id in (None, ""):
            raise ValidationError({"paiement_travaux": "Champ requis."})
        try:
            paiement_id = int(str(paiement_id))
        except ValueError:
            raise ValidationError({"paiement_travaux": "Doit être un entier."})

        compte = CompteBancaire.objects.filter(
            copropriete_id=copro_id,
            is_active=True,
            is_default=True,
        ).first()
        if not compte:
            raise ValidationError({"detail": "Aucun compte bancaire par défaut défini pour cette copropriété."})

        # Import local pour éviter dépendances circulaires
        from apps.travaux.models import PaiementTravaux

        try:
            p = PaiementTravaux.objects.select_related("dossier", "fournisseur").get(pk=paiement_id)
        except PaiementTravaux.DoesNotExist:
            raise ValidationError({"paiement_travaux": "PaiementTravaux introuvable."})

        if int(p.copropriete_id) != int(copro_id):
            raise ValidationError({"paiement_travaux": "PaiementTravaux hors copropriété."})

        existing = MouvementBancaire.objects.filter(
            copropriete_id=copro_id,
            paiement_travaux_id=p.id,
        ).first()
        if existing:
            return Response(self.get_serializer(existing).data, status=status.HTTP_200_OK)

        payload = {
            "compte": compte.id,
            "sens": "DEBIT",
            "montant": str(p.montant),
            "date_operation": str(p.date_paiement),
            "reference": (request.data.get("reference") or p.reference or "").strip(),
            "libelle": (request.data.get("libelle") or f"Paiement travaux dossier#{p.dossier_id}").strip(),
            "note": (request.data.get("note") or p.note or "").strip(),
            "paiement_travaux": p.id,
        }

        # On sécurise l'idempotence en concurrentiel (2 appels simultanés)
        with transaction.atomic():
            existing2 = (
                MouvementBancaire.objects.select_for_update()
                .filter(copropriete_id=copro_id, paiement_travaux_id=p.id)
                .first()
            )
            if existing2:
                return Response(self.get_serializer(existing2).data, status=status.HTTP_200_OK)

            ser = self.get_serializer(data=payload, context={"request": request})
            ser.is_valid(raise_exception=True)
            obj = ser.save()

        return Response(self.get_serializer(obj).data, status=status.HTTP_201_CREATED)