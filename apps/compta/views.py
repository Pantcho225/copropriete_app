# apps/compta/views.py
from __future__ import annotations

import csv
import hashlib
import io
import re
from datetime import datetime, timedelta
from decimal import Decimal, InvalidOperation

from django.core.exceptions import FieldError, ValidationError as DjangoValidationError
from django.db import IntegrityError, transaction
from django.db.models import Q, Sum, Count
from django.db.models.functions import TruncDate
from django.utils import timezone

from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response

from .permissions import IsAdminOrSyndicWriteReadOnly
from .models import (
    CompteBancaire,
    MouvementBancaire,
    ReleveImport,
    ReleveLigne,
    RapprochementBancaire,
)
from .serializers import (
    CompteBancaireSerializer,
    MouvementBancaireSerializer,
    ReleveImportDetailSerializer,
    ReleveImportListSerializer,
    ReleveLigneSerializer,
    RapprochementBancaireSerializer,
    RapprochementCreateSerializer,
)


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


def _guess_encoding(raw: bytes) -> str:
    try:
        raw.decode("utf-8-sig")
        return "utf-8-sig"
    except UnicodeDecodeError:
        return "latin-1"


def _parse_date_any(value: str):
    v = (value or "").strip()
    if not v:
        return None
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y"):
        try:
            return datetime.strptime(v, fmt).date()
        except ValueError:
            pass
    raise ValidationError({"detail": f"Date invalide: '{value}'"})


def _parse_decimal_fr(value: str) -> Decimal | None:
    """
    Support:
      - 1234.56
      - 1 234,56
      - 1.234,56
      - -2500,00
    """
    v = (value or "").strip()
    if not v:
        return None
    v = v.replace("\u00A0", " ").replace(" ", "")

    # cas "1.234,56" -> remove milliers "."
    if re.search(r"^\-?\d{1,3}(\.\d{3})+,\d{2}$", v):
        v = v.replace(".", "")

    v = v.replace(",", ".")
    try:
        return Decimal(v).quantize(Decimal("0.01"))
    except (InvalidOperation, ValueError):
        raise ValidationError({"detail": f"Montant invalide: '{value}'"})


def _detect_sens_and_montant(row: dict) -> tuple[str, Decimal]:
    """
    Stratégies:
    1) colonnes credit/debit : l'une des deux est remplie
    2) colonne montant signée : >0 CREDIT, <0 DEBIT
    """
    lower = {str(k).strip().lower(): v for k, v in row.items()}

    credit_keys = ["credit", "crédit", "montant_credit", "amount_credit"]
    debit_keys = ["debit", "débit", "montant_debit", "amount_debit"]
    montant_keys = ["montant", "amount", "valeur", "mouvement"]

    credit_val = None
    for k in credit_keys:
        if k in lower and str(lower[k] or "").strip():
            credit_val = _parse_decimal_fr(str(lower[k]))
            break

    debit_val = None
    for k in debit_keys:
        if k in lower and str(lower[k] or "").strip():
            debit_val = _parse_decimal_fr(str(lower[k]))
            break

    if credit_val is not None and credit_val != Decimal("0.00"):
        return "CREDIT", abs(credit_val)

    if debit_val is not None and debit_val != Decimal("0.00"):
        return "DEBIT", abs(debit_val)

    for k in montant_keys:
        if k in lower and str(lower[k] or "").strip():
            m = _parse_decimal_fr(str(lower[k]))
            if m is None:
                break
            if m >= 0:
                return "CREDIT", m
            return "DEBIT", abs(m)

    raise ValidationError(
        {
            "detail": "Impossible de détecter CREDIT/DEBIT. "
            "Attendu: colonnes credit/debit OU colonne montant signée."
        }
    )


def _paiement_travaux_copro_id(pt) -> int | None:
    """
    ✅ PATCH FINAL : copropriété PaiementTravaux robuste
    - pt.copropriete_id si existe
    - sinon pt.dossier.copropriete_id (le plus fréquent)
    - sinon pt.dossier.copropriete.id
    """
    if pt is None:
        return None

    cid = getattr(pt, "copropriete_id", None)
    if cid is not None:
        try:
            return int(cid)
        except Exception:
            pass

    try:
        dossier = getattr(pt, "dossier", None)
    except Exception:
        dossier = None
    if dossier is None:
        return None

    cid = getattr(dossier, "copropriete_id", None)
    if cid is not None:
        try:
            return int(cid)
        except Exception:
            pass

    copro = getattr(dossier, "copropriete", None)
    if copro is not None and getattr(copro, "id", None) is not None:
        try:
            return int(copro.id)
        except Exception:
            pass

    return None


def _parse_bool(v, default=False) -> bool:
    if v is None:
        return bool(default)
    s = str(v).strip().lower()
    if s in ("1", "true", "t", "yes", "y", "on"):
        return True
    if s in ("0", "false", "f", "no", "n", "off"):
        return False
    return bool(default)


def _as_drf_error_from_django_validation(e: DjangoValidationError) -> dict:
    """
    Convertit une ValidationError Django en payload DRF propre.
    """
    md = getattr(e, "message_dict", None)
    if md:
        return md
    msgs = getattr(e, "messages", None)
    if msgs:
        return {"detail": msgs}
    return {"detail": [str(e)]}


# =========================================================
# ViewSets — Phase 4
# =========================================================
class CompteBancaireViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAdminOrSyndicWriteReadOnly]
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
    permission_classes = [IsAdminOrSyndicWriteReadOnly]
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

    @action(detail=False, methods=["get"], url_path="dashboard")
    def dashboard(self, request):
        """
        ✅ Ajouts "cockpit financier":
        - totaux.revenus / totaux.depenses / totaux.solde
        - compat: totaux.total_credit / totaux.total_debit / totaux.solde_net_mouvements conservés
        - série journalière optionnelle pour graph (query ?series_days=30)
        """
        copro_id = _require_copro_id(request)

        comptes = CompteBancaire.objects.filter(copropriete_id=copro_id, is_active=True)
        mqs = MouvementBancaire.objects.filter(copropriete_id=copro_id)

        total_credit = Decimal(str(mqs.filter(sens="CREDIT").aggregate(t=Sum("montant")).get("t") or 0))
        total_debit = Decimal(str(mqs.filter(sens="DEBIT").aggregate(t=Sum("montant")).get("t") or 0))
        nb_non_rapproches = mqs.filter(paiement_travaux__isnull=True, paiement_appel__isnull=True).count()

        # ✅ Cockpit
        revenus = total_credit
        depenses = total_debit
        solde = revenus - depenses

        rows = mqs.values("compte_id", "sens").annotate(total=Sum("montant")).order_by()

        by_compte: dict[int, dict[str, Decimal]] = {}
        for r in rows:
            cid = int(r["compte_id"])
            by_compte.setdefault(cid, {"CREDIT": Decimal("0"), "DEBIT": Decimal("0")})
            by_compte[cid][r["sens"]] = Decimal(str(r["total"] or 0))

        comptes_out = []
        for c in comptes:
            agg = by_compte.get(c.id, {"CREDIT": Decimal("0"), "DEBIT": Decimal("0")})
            solde_compte = Decimal(str(c.solde_initial)) + agg["CREDIT"] - agg["DEBIT"]
            comptes_out.append(
                {
                    "compte_id": c.id,
                    "nom": c.nom,
                    "devise": c.devise,
                    "solde_initial": float(c.solde_initial),
                    "total_credit": float(agg["CREDIT"]),
                    "total_debit": float(agg["DEBIT"]),
                    "solde_theorique": float(solde_compte),
                }
            )

        # ✅ Série journalière (pour futur graphe)
        # ex: /api/compta/mouvements/dashboard/?series_days=30
        raw_days = request.query_params.get("series_days", "30")
        try:
            series_days = int(str(raw_days))
        except Exception:
            series_days = 30
        if series_days < 1:
            series_days = 1
        if series_days > 365:
            series_days = 365

        start = timezone.localdate() - timedelta(days=series_days - 1)

        daily = (
            mqs.filter(date_operation__gte=start)
            .annotate(d=TruncDate("date_operation"))
            .values("d", "sens")
            .annotate(total=Sum("montant"))
            .order_by("d")
        )

        by_day: dict[str, dict[str, Decimal]] = {}
        for r in daily:
            d = r["d"]
            key = str(d)
            by_day.setdefault(key, {"CREDIT": Decimal("0"), "DEBIT": Decimal("0")})
            by_day[key][r["sens"]] = Decimal(str(r["total"] or 0))

        series = []
        running = Decimal("0")
        for i in range(series_days):
            day = start + timedelta(days=i)
            key = str(day)
            cred = by_day.get(key, {}).get("CREDIT", Decimal("0"))
            deb = by_day.get(key, {}).get("DEBIT", Decimal("0"))
            net = cred - deb
            running += net
            series.append(
                {
                    "date": key,
                    "credit": float(cred),
                    "debit": float(deb),
                    "net": float(net),
                    "cumul_net": float(running),
                }
            )

        return Response(
            {
                "copropriete_id": int(copro_id),
                "totaux": {
                    # ✅ nouveaux champs (cockpit)
                    "revenus": float(revenus),
                    "depenses": float(depenses),
                    "solde": float(solde),
                    # ✅ compat ancienne structure (ne casse rien)
                    "total_credit": float(total_credit),
                    "total_debit": float(total_debit),
                    "solde_net_mouvements": float(total_credit - total_debit),
                    "nb_non_rapproches": int(nb_non_rapproches),
                    "series_days": int(series_days),
                },
                "comptes": comptes_out,
                "series": series,  # prêt pour un graphique (Recharts)
            },
            status=status.HTTP_200_OK,
        )

    @action(
        detail=False,
        methods=["post"],
        url_path="auto-from-paiement-travaux",
        permission_classes=[IsAdminOrSyndicWriteReadOnly],
    )
    def auto_from_paiement_travaux(self, request):
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

        from apps.travaux.models import PaiementTravaux

        try:
            p = PaiementTravaux.objects.select_related("dossier", "fournisseur").get(pk=paiement_id)
        except PaiementTravaux.DoesNotExist:
            raise ValidationError({"paiement_travaux": "PaiementTravaux introuvable."})

        pt_cid = _paiement_travaux_copro_id(p)
        if pt_cid is None:
            raise ValidationError({"paiement_travaux": "Impossible de déterminer la copropriété du PaiementTravaux."})
        if int(pt_cid) != int(copro_id):
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
            "montant": str(getattr(p, "montant")),
            "date_operation": str(getattr(p, "date_paiement")),
            "reference": (request.data.get("reference") or getattr(p, "reference", "") or "").strip(),
            "libelle": (request.data.get("libelle") or f"Paiement travaux dossier#{getattr(p, 'dossier_id', '')}").strip(),
            "note": (request.data.get("note") or getattr(p, "note", "") or "").strip(),
            "paiement_travaux": p.id,
        }

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


# =========================================================
# Phase 5 — Pagination lignes relevé / rapprochements
# =========================================================
class ReleveLignePagination(PageNumberPagination):
    page_size = 50
    page_size_query_param = "page_size"
    max_page_size = 500


class RapprochementPagination(PageNumberPagination):
    page_size = 50
    page_size_query_param = "page_size"
    max_page_size = 500


# =========================================================
# ViewSet — Phase 5 (Lignes de relevé + rapprochement assisté)
# =========================================================
class ReleveLigneViewSet(viewsets.ReadOnlyModelViewSet):
    """
    GET  /api/compta/releves/lignes/
    GET  /api/compta/releves/lignes/<id>/
    POST /api/compta/releves/lignes/<id>/rapprocher/
        - comportement normal: crée/active rapprochement
        - si déjà rapprochée: 400
        - ✅ si déjà rapprochée + force=true => retarget (audit)
    POST /api/compta/releves/lignes/<id>/annuler-rapprochement/
    GET  /api/compta/releves/lignes/<id>/suggestions/?days=5
    POST /api/compta/releves/lignes/<id>/creer-mouvement/
    """
    permission_classes = [IsAdminOrSyndicWriteReadOnly]
    serializer_class = ReleveLigneSerializer
    pagination_class = ReleveLignePagination
    queryset = ReleveLigne.objects.all().order_by("-date_operation", "-id")

    def get_queryset(self):
        copro_id = _require_copro_id(self.request)
        qs = (
            super()
            .get_queryset()
            .filter(Q(copropriete_id=copro_id) | Q(releve_import__copropriete_id=copro_id))
            .select_related("releve_import")
        )

        try:
            qs = qs.select_related("rapprochement")
        except Exception:
            pass

        statut = self.request.query_params.get("statut")
        sens = self.request.query_params.get("sens")
        imp_id = self.request.query_params.get("import")

        if statut:
            qs = qs.filter(statut=statut)
        if sens:
            qs = qs.filter(sens=sens)
        if imp_id:
            try:
                qs = qs.filter(releve_import_id=int(imp_id))
            except ValueError:
                raise ValidationError({"import": "Doit être un entier."})

        dfrom = _parse_date_param(self.request, "from")
        dto = _parse_date_param(self.request, "to")
        if dfrom:
            qs = qs.filter(date_operation__gte=dfrom)
        if dto:
            qs = qs.filter(date_operation__lte=dto)

        rapproche = self.request.query_params.get("rapproche")  # "1"/"0"
        if rapproche == "1":
            qs = qs.filter(rapprochement__isnull=False, rapprochement__is_cancelled=False)
        elif rapproche == "0":
            qs = qs.filter(Q(rapprochement__isnull=True) | Q(rapprochement__is_cancelled=True))

        return qs

    def _retarget_if_allowed(self, *, ligne: ReleveLigne, request) -> RapprochementBancaire | None:
        """
        ✅ PATCH: permet de corriger un rapprochement actif (retarget)
        si force=true (ou allow_retarget=true) et qu'un rapprochement actif existe.

        ✅ NO-OP GUARD: empêche un "retarget" vers la même cible
        (évite d'incrémenter retarget_count et de polluer l'audit).

        ✅ CONSOLIDATION: toute ValidationError Django levée par le modèle
        (ex: "cible déjà rapprochée", "paiement annulé", etc.) est convertie
        en ValidationError DRF => 400 JSON (pas de 500 HTML).
        """
        force = _parse_bool(request.data.get("force"), default=False)
        allow_retarget = _parse_bool(request.data.get("allow_retarget"), default=False)
        if not (force or allow_retarget):
            return None

        rap = getattr(ligne, "rapprochement", None)
        if not rap or getattr(rap, "is_cancelled", False):
            return None

        type_cible = request.data.get("type_cible")
        cible_id = request.data.get("cible_id")
        if not type_cible or cible_id in (None, ""):
            raise ValidationError(
                {"detail": "Pour corriger, fournir type_cible + cible_id (+ force=true / allow_retarget=true)."}
            )

        try:
            cible_id = int(str(cible_id))
        except ValueError:
            raise ValidationError({"cible_id": "Doit être un entier."})

        note = (request.data.get("note") or "").strip()
        retarget_reason = (request.data.get("retarget_reason") or "").strip()
        reason_legacy = (request.data.get("reason") or "").strip()

        reason = (retarget_reason or reason_legacy or note or "").strip()
        if not reason:
            raise ValidationError(
                {"retarget_reason": "Raison obligatoire pour corriger un rapprochement existant (allow_retarget=true)."}
            )

        copro_id = _require_copro_id(request)
        rl_copro = int(getattr(ligne, "copropriete_id", 0) or ligne.releve_import.copropriete_id or 0)
        if rl_copro != int(copro_id):
            raise ValidationError({"detail": "Ligne hors copropriété."})

        with transaction.atomic():
            rap_db = (
                RapprochementBancaire.objects.select_for_update()
                .filter(pk=rap.pk, copropriete_id=copro_id)
                .first()
            )
            if not rap_db:
                raise ValidationError({"detail": "Rapprochement introuvable."})
            if getattr(rap_db, "is_cancelled", False):
                return None

            if str(getattr(rap_db, "type_cible", "")) == str(type_cible) and int(
                getattr(rap_db, "cible_id", 0) or 0
            ) == int(cible_id):
                raise ValidationError(
                    {"detail": "Cette ligne est déjà rapprochée sur cette cible. Aucun retarget nécessaire."}
                )

            fn = getattr(rap_db, "retarget_to", None)
            if callable(fn):
                try:
                    fn(type_cible=type_cible, cible_id=cible_id, user=request.user, reason=reason)
                except DjangoValidationError as e:
                    raise ValidationError(_as_drf_error_from_django_validation(e))
                except IntegrityError:
                    raise ValidationError({"cible_id": ["Cette cible est déjà rapprochée par une autre ligne (active)."]})
                rap_db.refresh_from_db()
                return rap_db

            updates = {}
            if hasattr(rap_db, "previous_type_cible"):
                updates["previous_type_cible"] = rap_db.type_cible
            if hasattr(rap_db, "previous_cible_id"):
                updates["previous_cible_id"] = rap_db.cible_id
            if hasattr(rap_db, "retarget_count"):
                updates["retarget_count"] = int(getattr(rap_db, "retarget_count", 0) or 0) + 1
            if hasattr(rap_db, "retargeted_at"):
                updates["retargeted_at"] = timezone.now()
            if hasattr(rap_db, "retargeted_by_id"):
                updates["retargeted_by_id"] = request.user.id
            if hasattr(rap_db, "retarget_reason"):
                updates["retarget_reason"] = (reason or "")[:300]

            updates["type_cible"] = str(type_cible)
            updates["cible_id"] = int(cible_id)
            updates["note"] = (note or "")[:300]
            updates["rapproche_par_id"] = request.user.id
            updates["rapproche_at"] = timezone.now()

            for k, v in updates.items():
                setattr(rap_db, k, v)

            try:
                rap_db.save(update_fields=list(updates.keys()))
            except IntegrityError:
                raise ValidationError({"cible_id": ["Cette cible est déjà rapprochée par une autre ligne (active)."]})

            return rap_db

    @action(
        detail=True,
        methods=["post"],
        url_path="rapprocher",
        permission_classes=[IsAdminOrSyndicWriteReadOnly],
    )
    def rapprocher(self, request, pk=None):
        """
        ✅ CONSOLIDATION: toute ValidationError Django levée depuis les modèles
        est convertie en ValidationError DRF => 400 JSON (pas de 500 HTML).
        """
        ligne = self.get_object()

        try:
            rap = self._retarget_if_allowed(ligne=ligne, request=request)
            if rap is not None:
                return Response(RapprochementBancaireSerializer(rap).data, status=status.HTTP_200_OK)

            ser = RapprochementCreateSerializer(data=request.data, context={"request": request, "releve_ligne": ligne})
            ser.is_valid(raise_exception=True)
            rap = ser.save()
            return Response(RapprochementBancaireSerializer(rap).data, status=status.HTTP_200_OK)

        except DjangoValidationError as e:
            raise ValidationError(_as_drf_error_from_django_validation(e))
        except IntegrityError:
            return Response(
                {"detail": "Conflit de rapprochement (unicité). La ligne ou la cible est déjà rapprochée."},
                status=status.HTTP_409_CONFLICT,
            )

    @action(
        detail=True,
        methods=["post"],
        url_path="annuler-rapprochement",
        permission_classes=[IsAdminOrSyndicWriteReadOnly],
    )
    def annuler_rapprochement(self, request, pk=None):
        copro_id = _require_copro_id(request)
        ligne = self.get_object()

        rap = getattr(ligne, "rapprochement", None)

        if rap is None:
            rap = (
                RapprochementBancaire.objects.filter(copropriete_id=copro_id, releve_ligne_id=ligne.id)
                .order_by("-id")
                .first()
            )

        if not rap:
            raise ValidationError({"detail": "Cette ligne n'a aucun rapprochement à annuler."})

        reason = (request.data.get("reason") or request.data.get("note") or "").strip()

        with transaction.atomic():
            rap_db = (
                RapprochementBancaire.objects.select_for_update()
                .filter(pk=rap.pk, copropriete_id=copro_id)
                .first()
            )
            if not rap_db:
                raise ValidationError({"detail": "Rapprochement introuvable."})

            if rap_db.is_cancelled:
                return Response(
                    {
                        "detail": "Rapprochement déjà annulé.",
                        "rapprochement_id": rap_db.id,
                        "releve_ligne_id": ligne.id,
                    },
                    status=status.HTTP_200_OK,
                )

            rap_db.cancel(user=request.user, reason=reason)

        return Response(
            {
                "detail": "Rapprochement annulé (soft-cancel).",
                "rapprochement_id": rap_db.id,
                "releve_ligne_id": ligne.id,
            },
            status=status.HTTP_200_OK,
        )

    @action(
        detail=True,
        methods=["post"],
        url_path="creer-mouvement",
        permission_classes=[IsAdminOrSyndicWriteReadOnly],
    )
    def creer_mouvement(self, request, pk=None):
        copro_id = _require_copro_id(request)
        auto_rapproche = str(request.query_params.get("auto_rapproche", "1")) != "0"
        note_user = (request.data.get("note") or "").strip()

        with transaction.atomic():
            ligne = ReleveLigne.objects.select_for_update().select_related("releve_import").get(pk=self.get_object().pk)

            rl_copro = int(getattr(ligne, "copropriete_id", 0) or ligne.releve_import.copropriete_id or 0)
            if rl_copro != int(copro_id):
                raise ValidationError({"detail": "Ligne hors copropriété."})

            rap_exist = RapprochementBancaire.objects.filter(releve_ligne_id=ligne.id, is_cancelled=False).first()
            if rap_exist:
                return Response(RapprochementBancaireSerializer(rap_exist).data, status=status.HTTP_200_OK)

            compte_id = request.data.get("compte")
            if compte_id not in (None, ""):
                try:
                    compte_id = int(str(compte_id))
                except ValueError:
                    raise ValidationError({"compte": "Doit être un entier."})
                compte = CompteBancaire.objects.filter(copropriete_id=copro_id, pk=compte_id, is_active=True).first()
                if not compte:
                    raise ValidationError({"compte": "Compte introuvable/inactif pour cette copropriété."})
            else:
                compte = (
                    CompteBancaire.objects.filter(copropriete_id=copro_id, is_active=True, is_default=True).first()
                    or CompteBancaire.objects.filter(copropriete_id=copro_id, is_active=True).order_by("id").first()
                )
                if not compte:
                    raise ValidationError({"detail": "Aucun compte bancaire actif (et/ou default) pour cette copropriété."})

            fingerprint = f"releve_ligne:{ligne.id}"
            note_auto = f"Auto depuis ReleveLigne#{ligne.id} import#{ligne.releve_import_id} [{fingerprint}]"
            note_full = (note_user + "\n" + note_auto).strip() if note_user else note_auto

            existing_mvt = (
                MouvementBancaire.objects.select_for_update()
                .filter(
                    copropriete_id=copro_id,
                    compte_id=compte.id,
                    date_operation=ligne.date_operation,
                    montant=ligne.montant,
                    sens=ligne.sens,
                )
                .filter(Q(note__icontains=fingerprint) | Q(reference=ligne.reference))
                .order_by("-id")
                .first()
            )

            if existing_mvt:
                mvt = existing_mvt
            else:
                mvt = MouvementBancaire.objects.create(
                    copropriete_id=copro_id,
                    compte=compte,
                    sens=ligne.sens,
                    montant=ligne.montant,
                    date_operation=ligne.date_operation,
                    reference=(ligne.reference or "")[:120],
                    libelle=(ligne.libelle or "Depuis relevé")[:200],
                    note=note_full,
                    created_by=request.user,
                )

            if not auto_rapproche:
                return Response(
                    {
                        "detail": "Mouvement créé (ou réutilisé). Rapprochement non effectué (auto_rapproche=0).",
                        "mouvement": MouvementBancaireSerializer(mvt).data,
                    },
                    status=status.HTTP_201_CREATED,
                )

            try:
                rap = RapprochementBancaire.create_from_line(
                    releve_ligne=ligne,
                    type_cible=RapprochementBancaire.TypeCible.MOUVEMENT,
                    cible_id=mvt.id,
                    user=request.user,
                    note=note_user,
                    strict_amount=True,
                )
            except IntegrityError:
                rap = RapprochementBancaire.objects.filter(releve_ligne_id=ligne.id, is_cancelled=False).first()
                if rap:
                    return Response(RapprochementBancaireSerializer(rap).data, status=status.HTTP_200_OK)
                raise

            return Response(RapprochementBancaireSerializer(rap).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["get"], url_path="suggestions")
    def suggestions(self, request, pk=None):
        ligne = self.get_object()

        raw_days = request.query_params.get("days", "5")
        try:
            days = int(str(raw_days))
        except Exception:
            days = 5
        if days < 1:
            days = 1
        if days > 60:
            days = 60

        from apps.billing.models import PaiementAppel
        from apps.travaux.models import PaiementTravaux

        copro_id = _require_copro_id(request)
        montant = ligne.montant
        d = ligne.date_operation
        dmin = d - timedelta(days=days)
        dmax = d + timedelta(days=days)

        def _try_filters(model, copro_candidates, montant_fields, date_fields):
            base = model.objects.all()

            chosen_copro = None
            base_copro = base
            for filt in copro_candidates:
                try:
                    qs_c = base.filter(**filt)
                    chosen_copro = filt
                    if qs_c.exists():
                        base_copro = qs_c
                        break
                except FieldError:
                    continue

            chosen_amount_field = None
            qs_amount = None
            for field in montant_fields:
                try:
                    qs_amount = base_copro.filter(**{field: montant})
                    chosen_amount_field = field
                    break
                except FieldError:
                    continue

            if qs_amount is None:
                return model.objects.none(), "no_amount_field_match"

            chosen_date_field = None
            qs_date = qs_amount
            for field in date_fields:
                try:
                    qs_date = qs_amount.filter(**{field: [dmin, dmax]})
                    chosen_date_field = field
                    break
                except FieldError:
                    continue

            if qs_date.exists():
                reason = "match: montant"
                if chosen_copro:
                    reason += "+copro"
                if chosen_date_field:
                    reason += "+date_range"
                reason += f" (amount_field={chosen_amount_field})"
                return qs_date.order_by("-id")[:10], reason

            reason = "match: montant"
            if chosen_copro:
                reason += "+copro"
            reason += "+fallback_no_date"
            reason += f" (amount_field={chosen_amount_field})"
            return qs_amount.order_by("-id")[:10], reason

        pa_qs, pa_reason = _try_filters(
            PaiementAppel,
            copro_candidates=[
                {"ligne__lot__copropriete_id": copro_id},
                {"copropriete_id": copro_id},
                {"ligne__copropriete_id": copro_id},
                {"ligne__appel__copropriete_id": copro_id},
            ],
            montant_fields=["montant", "montant_paye", "montant_encaisse"],
            date_fields=["date_paiement__range", "date__range", "created_at__date__range"],
        )

        pt_qs, pt_reason = _try_filters(
            PaiementTravaux,
            copro_candidates=[{"copropriete_id": copro_id}, {"dossier__copropriete_id": copro_id}],
            montant_fields=["montant", "montant_paye"],
            date_fields=["date_paiement__range", "date__range", "created_at__date__range"],
        )

        mv = (
            MouvementBancaire.objects.filter(
                copropriete_id=copro_id,
                montant=montant,
                date_operation__range=[dmin, dmax],
            )
            .order_by("-id")[:10]
        )

        def _repr(obj, keys, reason=None):
            out = {"id": obj.id}
            for k in keys:
                out[k] = getattr(obj, k, None)
            if reason:
                out["_reason"] = reason
            return out

        return Response(
            {
                "releve_ligne": {
                    "id": ligne.id,
                    "date_operation": str(ligne.date_operation),
                    "sens": ligne.sens,
                    "montant": str(ligne.montant),
                    "libelle": ligne.libelle,
                    "reference": ligne.reference,
                },
                "suggestions": {
                    "paiement_appel": [
                        _repr(x, ["montant", "montant_paye", "date_paiement", "created_at"], reason=pa_reason)
                        for x in pa_qs
                    ],
                    "paiement_travaux": [
                        _repr(x, ["montant", "date_paiement", "created_at"], reason=pt_reason)
                        for x in pt_qs
                    ],
                    "mouvement": [
                        {
                            "id": x.id,
                            "sens": x.sens,
                            "montant": str(x.montant),
                            "date_operation": str(x.date_operation),
                            "libelle": x.libelle,
                            "reference": x.reference,
                            "_reason": "match: montant+date_range (mouvement)",
                        }
                        for x in mv
                    ],
                },
            },
            status=status.HTTP_200_OK,
        )


# =========================================================
# ViewSet — Phase 5 (Import Relevé bancaire CSV)
# =========================================================
class ReleveImportViewSet(viewsets.ReadOnlyModelViewSet):
    """
    GET  /api/compta/releves/imports/
    GET  /api/compta/releves/imports/<id>/
    GET  /api/compta/releves/imports/<id>/lignes/   (paginé)
    POST /api/compta/releves/imports/import-csv/
    """
    permission_classes = [IsAdminOrSyndicWriteReadOnly]
    queryset = ReleveImport.objects.all().order_by("-created_at")

    def get_queryset(self):
        copro_id = _require_copro_id(self.request)
        return super().get_queryset().filter(copropriete_id=copro_id)

    def get_serializer_class(self):
        if self.action == "retrieve":
            return ReleveImportDetailSerializer
        return ReleveImportListSerializer

    @action(methods=["GET"], detail=True, url_path="lignes")
    def lignes(self, request, pk=None):
        copro_id = _require_copro_id(request)

        imp = self.get_queryset().filter(pk=pk).first()
        if not imp:
            raise ValidationError({"detail": "Import introuvable."})

        qs = (
            ReleveLigne.objects.filter(releve_import_id=imp.id)
            .order_by("-date_operation", "-id")
            .select_related("releve_import")
        )
        try:
            qs = qs.select_related("rapprochement")
        except Exception:
            pass

        paginator = ReleveLignePagination()
        page = paginator.paginate_queryset(qs, request)
        ser = ReleveLigneSerializer(page, many=True)
        return paginator.get_paginated_response(ser.data)

    @action(
        methods=["POST"],
        detail=False,
        url_path="import-csv",
        permission_classes=[IsAdminOrSyndicWriteReadOnly],
    )
    def import_csv(self, request):
        copro_id = _require_copro_id(request)

        up = request.FILES.get("file") or request.FILES.get("fichier")
        if not up:
            raise ValidationError({"detail": "Fichier requis (champ 'file' ou 'fichier')."})

        delimiter = (request.data.get("delimiter") or ";").strip()
        if delimiter not in (";", ",", "\t"):
            raise ValidationError({"detail": "Delimiter invalide. Autorisés: ';' ',' '\\t'."})

        raw_bytes = up.read()
        file_hash = hashlib.sha256(raw_bytes).hexdigest()

        existing_imp = ReleveImport.objects.filter(copropriete_id=copro_id, hash_unique=file_hash).first()
        if existing_imp:
            return Response(
                {
                    "detail": "Ce fichier a déjà été importé (hash identique).",
                    "import_id": existing_imp.id,
                    "hash_unique": existing_imp.hash_unique,
                    "encoding": existing_imp.encoding,
                    "delimiter": existing_imp.delimiter,
                    "nb_lignes": existing_imp.nb_lignes,
                    "nb_crees": existing_imp.nb_crees,
                    "nb_ignores": existing_imp.nb_ignores,
                },
                status=status.HTTP_409_CONFLICT,
            )

        encoding = _guess_encoding(raw_bytes)
        text = raw_bytes.decode(encoding, errors="replace")

        f = io.StringIO(text)
        reader = csv.DictReader(f, delimiter=delimiter)
        if not reader.fieldnames:
            raise ValidationError({"detail": "CSV invalide: en-têtes introuvables."})

        created_by = request.user

        with transaction.atomic():
            try:
                up.seek(0)
            except Exception:
                pass

            try:
                imp = ReleveImport.objects.create(
                    copropriete_id=copro_id,
                    fichier=up,
                    fichier_nom=getattr(up, "name", "") or "",
                    hash_unique=file_hash,
                    encoding=encoding,
                    delimiter=delimiter,
                    created_by=created_by,
                )
            except IntegrityError:
                imp = ReleveImport.objects.filter(copropriete_id=copro_id, hash_unique=file_hash).first()
                if not imp:
                    raise

                return Response(
                    {
                        "detail": "Ce fichier a déjà été importé (hash identique).",
                        "import_id": imp.id,
                        "hash_unique": imp.hash_unique,
                        "encoding": imp.encoding,
                        "delimiter": imp.delimiter,
                        "nb_lignes": imp.nb_lignes,
                        "nb_crees": imp.nb_crees,
                        "nb_ignores": imp.nb_ignores,
                    },
                    status=status.HTTP_409_CONFLICT,
                )

            lignes_to_create: list[ReleveLigne] = []

            for row in reader:
                if not any(str(v or "").strip() for v in row.values()):
                    continue

                lower = {str(k).strip().lower(): v for k, v in row.items()}

                date_op = _parse_date_any(
                    str(lower.get("date") or lower.get("date_operation") or lower.get("operation_date") or "")
                )
                if not date_op:
                    raise ValidationError({"detail": "Colonne date manquante (date/date_operation/operation_date)."})

                date_val = None
                if lower.get("date_valeur") or lower.get("value_date"):
                    date_val = _parse_date_any(str(lower.get("date_valeur") or lower.get("value_date") or ""))

                libelle = str(lower.get("libelle") or lower.get("label") or lower.get("description") or "").strip()
                if not libelle:
                    libelle = "Sans libellé"

                reference = str(lower.get("reference") or lower.get("ref") or lower.get("id") or "").strip()

                sens, montant = _detect_sens_and_montant(row)

                solde = None
                if (lower.get("solde") is not None) or (lower.get("balance") is not None):
                    solde = _parse_decimal_fr(str(lower.get("solde") or lower.get("balance") or ""))

                h = ReleveLigne.compute_hash(
                    copro_id=copro_id,
                    date_operation=date_op,
                    libelle=libelle,
                    sens=sens,
                    montant=montant,
                    reference=reference,
                )

                lignes_to_create.append(
                    ReleveLigne(
                        releve_import=imp,
                        copropriete_id=copro_id,
                        date_operation=date_op,
                        date_valeur=date_val,
                        libelle=libelle[:500],
                        reference=reference[:120],
                        sens=sens,
                        montant=montant,
                        solde=solde,
                        hash_unique=h,
                        raw={k: (v if v is not None else "") for k, v in row.items()},
                    )
                )

            created = ReleveLigne.objects.bulk_create(lignes_to_create, ignore_conflicts=True)

            nb_total = len(lignes_to_create)
            nb_crees = len(created)
            nb_ignores = nb_total - nb_crees

            ReleveImport.objects.select_for_update().filter(pk=imp.pk).update(
                nb_lignes=nb_total,
                nb_crees=nb_crees,
                nb_ignores=nb_ignores,
            )

        return Response(
            {
                "import_id": imp.id,
                "hash_unique": imp.hash_unique,
                "encoding": imp.encoding,
                "delimiter": imp.delimiter,
                "nb_lignes": nb_total,
                "nb_crees": nb_crees,
                "nb_ignores": nb_ignores,
            },
            status=status.HTTP_201_CREATED,
        )


# =========================================================
# ✅ ViewSet Audit Rapprochements (Phase 5)
# =========================================================
class RapprochementBancaireViewSet(viewsets.ReadOnlyModelViewSet):
    """
    GET  /api/compta/rapprochements/
    GET  /api/compta/rapprochements/<id>/
    POST /api/compta/rapprochements/<id>/cancel/
    GET  /api/compta/rapprochements/stats/
    """
    permission_classes = [IsAdminOrSyndicWriteReadOnly]
    serializer_class = RapprochementBancaireSerializer
    pagination_class = RapprochementPagination
    queryset = RapprochementBancaire.objects.all().order_by("-rapproche_at", "-id")

    def get_queryset(self):
        copro_id = _require_copro_id(self.request)
        qs = super().get_queryset().filter(copropriete_id=copro_id).select_related("releve_ligne")

        is_cancelled = self.request.query_params.get("is_cancelled")
        type_cible = self.request.query_params.get("type_cible")
        cible_id = self.request.query_params.get("cible_id")
        releve_ligne_id = self.request.query_params.get("releve_ligne")

        dfrom = _parse_date_param(self.request, "from")
        dto = _parse_date_param(self.request, "to")

        if is_cancelled in ("0", "1"):
            qs = qs.filter(is_cancelled=(is_cancelled == "1"))

        if type_cible:
            qs = qs.filter(type_cible=type_cible)

        if cible_id:
            try:
                qs = qs.filter(cible_id=int(str(cible_id)))
            except ValueError:
                raise ValidationError({"cible_id": "Doit être un entier."})

        if releve_ligne_id:
            try:
                qs = qs.filter(releve_ligne_id=int(str(releve_ligne_id)))
            except ValueError:
                raise ValidationError({"releve_ligne": "Doit être un entier."})

        if dfrom:
            qs = qs.filter(date_operation__gte=dfrom)
        if dto:
            qs = qs.filter(date_operation__lte=dto)

        return qs

    @action(
        detail=True,
        methods=["post"],
        url_path="cancel",
        permission_classes=[IsAdminOrSyndicWriteReadOnly],
    )
    def cancel(self, request, pk=None):
        copro_id = _require_copro_id(request)
        reason = (request.data.get("reason") or request.data.get("note") or "").strip()

        with transaction.atomic():
            rap = RapprochementBancaire.objects.select_for_update().filter(pk=pk, copropriete_id=copro_id).first()
            if not rap:
                raise ValidationError({"detail": "Rapprochement introuvable."})

            if rap.is_cancelled:
                return Response({"detail": "Déjà annulé."}, status=status.HTTP_200_OK)

            rap.cancel(user=request.user, reason=reason)

        return Response({"detail": "Rapprochement annulé (soft-cancel)."}, status=status.HTTP_200_OK)

    @action(detail=False, methods=["get"], url_path="stats")
    def stats(self, request):
        copro_id = _require_copro_id(self.request)

        qs = RapprochementBancaire.objects.filter(copropriete_id=copro_id)
        total = qs.count()
        actifs = qs.filter(is_cancelled=False).count()
        annules = qs.filter(is_cancelled=True).count()

        by_type = qs.values("type_cible").annotate(total=Count("id")).order_by()
        by_type_actifs = qs.filter(is_cancelled=False).values("type_cible").annotate(total=Count("id")).order_by()

        return Response(
            {
                "copropriete_id": int(copro_id),
                "total": int(total),
                "actifs": int(actifs),
                "annules": int(annules),
                "by_type": list(by_type),
                "by_type_actifs": list(by_type_actifs),
            },
            status=status.HTTP_200_OK,
        )