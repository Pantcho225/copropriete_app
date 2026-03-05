# apps/compta/models.py
from __future__ import annotations

import hashlib
from decimal import Decimal, InvalidOperation

from django.apps import apps
from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import MinValueValidator
from django.db import models, transaction
from django.db.models import Q
from django.utils import timezone


DEC_0 = Decimal("0.00")
DEC_2 = Decimal("0.01")


# =========================
# Helpers
# =========================
def d2(value) -> Decimal:
    """Arrondi monétaire 2 décimales (robustesse)."""
    if value is None:
        return DEC_0
    if isinstance(value, Decimal):
        return value.quantize(DEC_2)
    try:
        return Decimal(str(value)).quantize(DEC_2)
    except (InvalidOperation, ValueError):
        raise ValidationError({"montant": "Montant invalide."})


# =========================
# Phase 4 — Comptes & Mouvements
# =========================
class CompteBancaire(models.Model):
    copropriete = models.ForeignKey(
        "core.Copropriete",
        on_delete=models.CASCADE,
        related_name="comptes_bancaires",
    )
    nom = models.CharField(max_length=120)
    banque = models.CharField(max_length=120, blank=True)
    iban = models.CharField(max_length=60, blank=True)
    rib = models.CharField(max_length=60, blank=True)
    devise = models.CharField(max_length=10, default="XOF")
    solde_initial = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        default=DEC_0,
        validators=[MinValueValidator(DEC_0)],
    )
    is_active = models.BooleanField(default=True)

    # ✅ compte bancaire par défaut par copropriété
    is_default = models.BooleanField(default=False)

    created_at = models.DateTimeField(default=timezone.now, editable=False)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=["copropriete", "is_active"]),
            models.Index(fields=["copropriete", "nom"]),
            models.Index(fields=["copropriete", "is_default"]),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["copropriete", "nom"],
                name="uniq_compte_nom_par_copro",
            ),
            models.UniqueConstraint(
                fields=["copropriete"],
                condition=Q(is_default=True),
                name="uniq_compte_default_par_copro",
            ),
        ]

    def save(self, *args, **kwargs):
        making_default = bool(self.is_default)
        super().save(*args, **kwargs)

        if making_default and self.copropriete_id:
            CompteBancaire.objects.filter(
                copropriete_id=self.copropriete_id,
                is_default=True,
            ).exclude(pk=self.pk).update(is_default=False)

    def __str__(self) -> str:
        return f"Compte#{self.id} {self.nom} (copro={self.copropriete_id})"


class MouvementBancaire(models.Model):
    class Sens(models.TextChoices):
        CREDIT = "CREDIT", "Crédit"
        DEBIT = "DEBIT", "Débit"

    copropriete = models.ForeignKey(
        "core.Copropriete",
        on_delete=models.CASCADE,
        related_name="mouvements_bancaires",
    )
    compte = models.ForeignKey(
        CompteBancaire,
        on_delete=models.PROTECT,
        related_name="mouvements",
    )

    sens = models.CharField(max_length=10, choices=Sens.choices)
    montant = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.01"))],
    )
    date_operation = models.DateField()
    reference = models.CharField(max_length=120, blank=True)
    libelle = models.CharField(max_length=200)
    note = models.TextField(blank=True)

    paiement_travaux = models.ForeignKey(
        "travaux.PaiementTravaux",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="mouvements_bancaires",
    )
    paiement_appel = models.ForeignKey(
        "billing_app.PaiementAppel",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="mouvements_bancaires",
    )

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="mouvements_bancaires_crees",
    )
    created_at = models.DateTimeField(default=timezone.now, editable=False)

    class Meta:
        indexes = [
            models.Index(fields=["copropriete", "compte", "date_operation"]),
            models.Index(fields=["copropriete", "sens", "date_operation"]),
            models.Index(fields=["copropriete", "paiement_travaux"]),
            models.Index(fields=["copropriete", "paiement_appel"]),
        ]
        constraints = [
            models.CheckConstraint(
                condition=~(Q(paiement_travaux__isnull=False) & Q(paiement_appel__isnull=False)),
                name="chk_mvt_rapprochement_exclusif",
            ),
        ]

    @property
    def is_rapproche(self) -> bool:
        return bool(self.paiement_travaux_id or self.paiement_appel_id)

    def __str__(self) -> str:
        return f"Mvt#{self.id} {self.sens} {self.montant} ({self.date_operation})"


# =========================
# Phase 5 — Import Relevé bancaire (CSV)
# =========================
class ReleveImport(models.Model):
    copropriete = models.ForeignKey(
        "core.Copropriete",
        on_delete=models.CASCADE,
        related_name="releves_imports",
    )

    fichier = models.FileField(upload_to="compta/releves/%Y/%m/")
    fichier_nom = models.CharField(max_length=255, blank=True)
    hash_unique = models.CharField(max_length=64)

    encoding = models.CharField(max_length=30, blank=True)
    delimiter = models.CharField(max_length=5, default=";")

    nb_lignes = models.PositiveIntegerField(default=0)
    nb_crees = models.PositiveIntegerField(default=0)
    nb_ignores = models.PositiveIntegerField(default=0)

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="releves_imports_crees",
    )
    created_at = models.DateTimeField(default=timezone.now, editable=False)

    class Meta:
        indexes = [
            models.Index(fields=["copropriete", "created_at"]),
            models.Index(fields=["copropriete", "hash_unique"]),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["copropriete", "hash_unique"],
                name="uniq_releveimport_hash_par_copro",
            ),
        ]
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"ReleveImport#{self.id} (copro={self.copropriete_id}) lignes={self.nb_lignes}"


class ReleveLigne(models.Model):
    class Sens(models.TextChoices):
        CREDIT = "CREDIT", "Crédit"
        DEBIT = "DEBIT", "Débit"

    class Statut(models.TextChoices):
        A_TRAITER = "A_TRAITER", "À traiter"
        RAPPROCHE = "RAPPROCHE", "Rapproché"
        IGNORE = "IGNORE", "Ignoré"

    releve_import = models.ForeignKey(
        ReleveImport,
        on_delete=models.CASCADE,
        related_name="lignes",
    )

    copropriete = models.ForeignKey(
        "core.Copropriete",
        on_delete=models.CASCADE,
        related_name="releves_lignes",
        null=True,
        blank=True,
    )

    date_operation = models.DateField()
    date_valeur = models.DateField(null=True, blank=True)

    libelle = models.CharField(max_length=500)
    reference = models.CharField(max_length=120, blank=True)

    sens = models.CharField(max_length=10, choices=Sens.choices)
    montant = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        validators=[MinValueValidator(DEC_2)],
    )

    solde = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        null=True,
        blank=True,
    )

    hash_unique = models.CharField(max_length=64)
    raw = models.JSONField(default=dict, blank=True)

    statut = models.CharField(
        max_length=20,
        choices=Statut.choices,
        default=Statut.A_TRAITER,
    )

    created_at = models.DateTimeField(default=timezone.now, editable=False)

    class Meta:
        indexes = [
            models.Index(fields=["releve_import", "date_operation"]),
            models.Index(fields=["releve_import", "sens"]),
            models.Index(fields=["date_operation"], name="idx_releveligne_dateop"),
            models.Index(fields=["copropriete", "statut"]),
            models.Index(fields=["copropriete", "date_operation"]),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["releve_import", "hash_unique"],
                name="uniq_releveligne_hash_par_import",
            ),
        ]
        ordering = ["-date_operation", "-id"]

    def clean(self):
        if self.sens not in (self.Sens.CREDIT, self.Sens.DEBIT):
            raise ValidationError({"sens": "Le sens doit être CREDIT ou DEBIT."})
        if self.montant is not None and self.montant < DEC_2:
            raise ValidationError({"montant": "Le montant doit être ≥ 0.01."})

    def save(self, *args, **kwargs):
        if self.copropriete_id is None and self.releve_import_id:
            self.copropriete_id = self.releve_import.copropriete_id
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return f"ReleveLigne#{self.id} {self.sens} {self.montant} ({self.date_operation})"

    @property
    def is_rapprochee(self) -> bool:
        rap = getattr(self, "rapprochement", None)
        return bool(rap and not getattr(rap, "is_cancelled", False))

    @staticmethod
    def compute_hash(
        copro_id: int,
        date_operation,
        libelle: str,
        sens: str,
        montant: Decimal,
        reference: str = "",
    ) -> str:
        key = (
            f"{copro_id}|{date_operation.isoformat()}|"
            f"{(libelle or '').strip().lower()}|"
            f"{sens}|{str(montant)}|"
            f"{(reference or '').strip().lower()}"
        )
        return hashlib.sha256(key.encode("utf-8")).hexdigest()


# =========================
# Phase 5 — Rapprochement manuel assisté (Option 2 + verrou DB)
# + ✅ CHOIX (1) retarget sans annulation
# =========================
class RapprochementBancaire(models.Model):
    class TypeCible(models.TextChoices):
        PAIEMENT_APPEL = "PAIEMENT_APPEL", "Paiement appel"
        PAIEMENT_TRAVAUX = "PAIEMENT_TRAVAUX", "Paiement travaux"
        MOUVEMENT = "MOUVEMENT", "Mouvement bancaire"

    copropriete = models.ForeignKey(
        "core.Copropriete",
        on_delete=models.CASCADE,
        related_name="rapprochements_bancaires",
    )

    releve_ligne = models.OneToOneField(
        ReleveLigne,
        on_delete=models.CASCADE,
        related_name="rapprochement",
    )

    type_cible = models.CharField(max_length=30, choices=TypeCible.choices)
    cible_id = models.PositiveIntegerField()

    montant = models.DecimalField(max_digits=14, decimal_places=2)
    date_operation = models.DateField()
    note = models.CharField(max_length=300, blank=True, default="")

    rapproche_par = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="rapprochements_bancaires_faits",
    )
    rapproche_at = models.DateTimeField(default=timezone.now, editable=False)

    # ✅ Option 2 : on n'efface pas => on annule (soft cancel)
    is_cancelled = models.BooleanField(default=False)
    cancelled_at = models.DateTimeField(null=True, blank=True)
    cancelled_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="rapprochements_bancaires_annules",
    )
    cancelled_reason = models.CharField(max_length=300, blank=True, default="")

    # ✅ CHOIX (1) : audit retarget (correction d’un rapprochement actif)
    retarget_count = models.PositiveIntegerField(default=0)
    previous_type_cible = models.CharField(max_length=30, blank=True, default="")
    previous_cible_id = models.PositiveIntegerField(null=True, blank=True)
    retargeted_at = models.DateTimeField(null=True, blank=True)
    retargeted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="rapprochements_bancaires_retargetes",
    )
    retarget_reason = models.CharField(max_length=300, blank=True, default="")

    class Meta:
        indexes = [
            models.Index(fields=["copropriete", "type_cible", "cible_id"]),
            models.Index(fields=["copropriete", "rapproche_at"]),
            models.Index(fields=["copropriete", "is_cancelled"]),
            models.Index(fields=["copropriete", "retargeted_at"]),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["releve_ligne"],
                name="uniq_rappro_par_releve_ligne",
            ),
            models.UniqueConstraint(
                fields=["copropriete", "type_cible", "cible_id"],
                condition=Q(is_cancelled=False),
                name="uniq_rappro_cible_active_par_copro",
            ),
        ]

    def __str__(self) -> str:
        return (
            f"Rapprochement#{self.id} {self.type_cible}:{self.cible_id} "
            f"(ligne={self.releve_ligne_id}) cancelled={self.is_cancelled}"
        )

    # -------------------------
    # Résolution cible (assisté)
    # -------------------------
    @staticmethod
    def _get_target_model(type_cible: str):
        if type_cible == RapprochementBancaire.TypeCible.PAIEMENT_APPEL:
            return apps.get_model("billing_app", "PaiementAppel")
        if type_cible == RapprochementBancaire.TypeCible.PAIEMENT_TRAVAUX:
            return apps.get_model("travaux", "PaiementTravaux")
        if type_cible == RapprochementBancaire.TypeCible.MOUVEMENT:
            return apps.get_model("compta", "MouvementBancaire")
        raise ValidationError({"type_cible": "Type cible invalide."})

    @classmethod
    def _fetch_target(cls, *, type_cible: str, cible_id: int):
        Model = cls._get_target_model(type_cible)
        obj = Model.objects.filter(pk=int(cible_id)).first()
        if not obj:
            raise ValidationError({"cible_id": "Cible introuvable."})
        return obj

    @staticmethod
    def _target_copro_id(target) -> int | None:
        """
        Convention: si l'objet a copropriete_id => direct.
        Sinon, fallback selon le modèle (PaiementAppel / PaiementTravaux).
        """
        direct = getattr(target, "copropriete_id", None)
        if direct is not None:
            return direct

        meta = getattr(target, "_meta", None)
        app_label = getattr(meta, "app_label", "") if meta else ""
        model_name = getattr(meta, "model_name", "") if meta else ""

        # ✅ PaiementAppel confirmé: paiement_appel.ligne.lot.copropriete_id
        if app_label == "billing_app" and model_name == "paiementappel":
            try:
                ligne = getattr(target, "ligne", None)
                lot = getattr(ligne, "lot", None) if ligne else None
                cid = getattr(lot, "copropriete_id", None) if lot else None
                if cid is not None:
                    return cid
            except Exception:
                pass

            # fallback historique
            try:
                ligne = getattr(target, "ligne", None)
                appel = getattr(ligne, "appel", None) if ligne else None
                cid = getattr(appel, "copropriete_id", None) if appel else None
                if cid is not None:
                    return cid
            except Exception:
                pass

        # PaiementTravaux : via dossier -> copropriete_id
        if app_label == "travaux" and model_name == "paiementtravaux":
            try:
                dossier = getattr(target, "dossier", None)
                cid = getattr(dossier, "copropriete_id", None) if dossier else None
                if cid is not None:
                    return cid
            except Exception:
                pass

        return None

    @staticmethod
    def _target_amount(target) -> Decimal | None:
        for attr in ("montant", "amount"):
            if hasattr(target, attr):
                return getattr(target, attr)
        return None

    def clean(self):
        # Cohérence copro avec la ligne
        if self.releve_ligne_id and self.copropriete_id:
            rl_copro = self.releve_ligne.copropriete_id or self.releve_ligne.releve_import.copropriete_id
            if rl_copro != self.copropriete_id:
                raise ValidationError({"copropriete": "La copropriété doit correspondre à la ligne de relevé."})

        if self.montant is not None and self.montant < DEC_2:
            raise ValidationError({"montant": "Le montant doit être ≥ 0.01."})

        # empêche incohérences RL
        if self.releve_ligne_id:
            rl = self.releve_ligne
            if self.date_operation and self.date_operation != rl.date_operation:
                raise ValidationError({"date_operation": "date_operation doit correspondre à la ReleveLigne."})
            if self.montant is not None and d2(self.montant) != d2(rl.montant):
                raise ValidationError({"montant": "montant doit correspondre à la ReleveLigne."})

        # ✅ cohérence soft-cancel (consolidation)
        if self.is_cancelled:
            if not self.cancelled_at:
                raise ValidationError({"cancelled_at": "Obligatoire si is_cancelled=True."})
            if not self.cancelled_by_id:
                raise ValidationError({"cancelled_by": "Obligatoire si is_cancelled=True."})
        else:
            # si actif, on veut éviter des résidus de cancel
            if self.cancelled_at or self.cancelled_by_id or (self.cancelled_reason or "").strip():
                raise ValidationError(
                    {"is_cancelled": "Incohérence: champs d'annulation présents alors que is_cancelled=False."}
                )

    # -------------------------
    # Side effects
    # -------------------------
    @transaction.atomic
    def apply_side_effects(self):
        ligne = self.releve_ligne
        if not self.is_cancelled:
            if ligne.statut != ReleveLigne.Statut.RAPPROCHE:
                ligne.statut = ReleveLigne.Statut.RAPPROCHE
                ligne.save(update_fields=["statut"])

    @transaction.atomic
    def cancel(self, *, user, reason: str = ""):
        """
        Annulation contrôlée (soft cancel) :
        - on annule le rapprochement
        - on remet la ligne à A_TRAITER
        """
        if self.is_cancelled:
            return

        self.is_cancelled = True
        self.cancelled_at = timezone.now()
        self.cancelled_by = user
        self.cancelled_reason = (reason or "").strip()[:300]
        self.save(update_fields=["is_cancelled", "cancelled_at", "cancelled_by", "cancelled_reason"])

        ligne = self.releve_ligne
        if ligne.statut != ReleveLigne.Statut.A_TRAITER:
            ligne.statut = ReleveLigne.Statut.A_TRAITER
            ligne.save(update_fields=["statut"])

    # -------------------------
    # ✅ CHOIX (1) : retarget centralisé (pour views.py)
    # -------------------------
    @transaction.atomic
    def retarget_to(self, *, type_cible: str, cible_id: int, user, reason: str = "", note: str = ""):
        """
        Corrige un rapprochement ACTIF sans annuler.
        - garde un audit (previous_*, retarget_*)
        - vérifie conflit unique active (cible déjà rapprochée par une autre ligne)
        - met à jour rapproche_par/rapproche_at
        """
        if self.is_cancelled:
            raise ValidationError("Impossible de corriger un rapprochement annulé (is_cancelled=True).")

        type_cible = str(type_cible)
        if type_cible not in self.TypeCible.values:
            raise ValidationError({"type_cible": "Type cible invalide."})

        try:
            cible_id = int(cible_id)
        except Exception:
            raise ValidationError({"cible_id": "Doit être un entier."})

        reason = (reason or note or "").strip()
        if not reason:
            raise ValidationError({"retarget_reason": "Raison obligatoire pour corriger un rapprochement existant."})

        # verrou sur self
        me = RapprochementBancaire.objects.select_for_update().get(pk=self.pk)

        # validation cible (existence + copro + montant strict)
        target = self._fetch_target(type_cible=type_cible, cible_id=cible_id)

        copro_id = me.copropriete_id
        target_copro = self._target_copro_id(target)
        if target_copro is not None and int(target_copro) != int(copro_id):
            raise ValidationError({"cible_id": "La cible n'appartient pas à la même copropriété."})

        t_amount = self._target_amount(target)
        if t_amount is not None and d2(t_amount) != d2(me.releve_ligne.montant):
            raise ValidationError({"montant": "Montant cible ≠ montant ligne relevé (retarget strict)."})

        # clash cible déjà utilisée ailleurs
        clash = (
            RapprochementBancaire.objects.select_for_update()
            .filter(copropriete_id=copro_id, type_cible=type_cible, cible_id=cible_id, is_cancelled=False)
            .exclude(pk=me.pk)
        )
        if clash.exists():
            raise ValidationError({"cible_id": "Cette cible est déjà rapprochée par une autre ligne (active)."})

        # audit
        me.retarget_count = int(me.retarget_count or 0) + 1
        me.previous_type_cible = (me.type_cible or "")[:30]
        me.previous_cible_id = int(me.cible_id) if me.cible_id is not None else None
        me.retargeted_at = timezone.now()
        me.retargeted_by = user
        me.retarget_reason = reason[:300]

        # update
        me.type_cible = type_cible
        me.cible_id = int(cible_id)
        me.montant = me.releve_ligne.montant
        me.date_operation = me.releve_ligne.date_operation
        me.note = (note or me.note or "")[:300]
        me.rapproche_par = user
        me.rapproche_at = timezone.now()

        me.save(
            update_fields=[
                "retarget_count",
                "previous_type_cible",
                "previous_cible_id",
                "retargeted_at",
                "retargeted_by",
                "retarget_reason",
                "type_cible",
                "cible_id",
                "montant",
                "date_operation",
                "note",
                "rapproche_par",
                "rapproche_at",
            ]
        )
        me.apply_side_effects()
        return me

    # -------------------------
    # Factory (DB-safe + assisté)
    # -------------------------
    @classmethod
    @transaction.atomic
    def create_from_line(
        cls,
        *,
        releve_ligne: ReleveLigne,
        type_cible: str,
        cible_id: int,
        user,
        note: str = "",
        strict_amount: bool = True,
        # ✅ CHOIX (1)
        allow_retarget: bool = False,
        retarget_reason: str = "",
    ) -> "RapprochementBancaire":
        """
        Option 2 (soft cancel):
        - si rapprochement existe et actif => refuse (SAUF allow_retarget=True)
        - si rapprochement existe mais annulé => on "réactive"
        - sinon crée un nouveau

        ✅ CHOIX (1) : allow_retarget=True
        - autorise la correction d’un rapprochement ACTIF (sans cancel)
        - on garde un audit (previous_*, retarget_* , retarget_count)
        """
        releve_ligne = ReleveLigne.objects.select_for_update().get(pk=releve_ligne.pk)

        existing = cls.objects.select_for_update().filter(releve_ligne_id=releve_ligne.id).first()

        if existing and not existing.is_cancelled and not allow_retarget:
            raise ValidationError("Cette ligne est déjà rapprochée.")

        if releve_ligne.statut == ReleveLigne.Statut.IGNORE:
            raise ValidationError("Cette ligne est ignorée. Impossible de rapprocher.")

        copro_id = releve_ligne.copropriete_id or releve_ligne.releve_import.copropriete_id

        type_cible = str(type_cible)
        if type_cible not in cls.TypeCible.values:
            raise ValidationError({"type_cible": "Type cible invalide."})

        target = cls._fetch_target(type_cible=type_cible, cible_id=int(cible_id))

        target_copro = cls._target_copro_id(target)
        if target_copro is not None and int(target_copro) != int(copro_id):
            raise ValidationError({"cible_id": "La cible n'appartient pas à la même copropriété."})

        if strict_amount:
            t_amount = cls._target_amount(target)
            if t_amount is not None and d2(t_amount) != d2(releve_ligne.montant):
                raise ValidationError({"montant": "Montant cible ≠ montant ligne relevé (strict_amount=True)."})

        clash = (
            cls.objects.select_for_update()
            .filter(copropriete_id=copro_id, type_cible=type_cible, cible_id=int(cible_id), is_cancelled=False)
        )
        if existing and existing.pk:
            clash = clash.exclude(pk=existing.pk)
        if clash.exists():
            raise ValidationError({"cible_id": "Cette cible est déjà rapprochée par une autre ligne (active)."})

        # 1) Réactivation si annulé
        if existing and existing.is_cancelled:
            existing.type_cible = type_cible
            existing.cible_id = int(cible_id)
            existing.montant = releve_ligne.montant
            existing.date_operation = releve_ligne.date_operation
            existing.note = (note or "")[:300]
            existing.rapproche_par = user
            existing.rapproche_at = timezone.now()
            existing.is_cancelled = False
            existing.cancelled_at = None
            existing.cancelled_by = None
            existing.cancelled_reason = ""

            existing.save(
                update_fields=[
                    "type_cible",
                    "cible_id",
                    "montant",
                    "date_operation",
                    "note",
                    "rapproche_par",
                    "rapproche_at",
                    "is_cancelled",
                    "cancelled_at",
                    "cancelled_by",
                    "cancelled_reason",
                ]
            )
            existing.apply_side_effects()
            return existing

        # 2) Retarget d’un rapprochement actif
        if existing and not existing.is_cancelled and allow_retarget:
            # on délègue à la méthode centralisée
            return existing.retarget_to(
                type_cible=type_cible,
                cible_id=int(cible_id),
                user=user,
                reason=(retarget_reason or ""),
                note=(note or ""),
            )

        # 3) Création
        rap = cls.objects.create(
            copropriete_id=copro_id,
            releve_ligne=releve_ligne,
            type_cible=type_cible,
            cible_id=int(cible_id),
            montant=releve_ligne.montant,
            date_operation=releve_ligne.date_operation,
            note=(note or "")[:300],
            rapproche_par=user,
        )
        rap.apply_side_effects()
        return rap