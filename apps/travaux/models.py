# apps/travaux/models.py
from __future__ import annotations

from decimal import Decimal
from datetime import date

from django.apps import apps as django_apps
from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import MinValueValidator
from django.db import models, transaction
from django.db.models import Q, F, Sum
from django.utils import timezone

from apps.core.models import Copropriete

DEC_0 = Decimal("0.00")


class Fournisseur(models.Model):
    copropriete = models.ForeignKey(
        Copropriete,
        on_delete=models.CASCADE,
        related_name="fournisseurs",
    )

    nom = models.CharField(max_length=255)
    email = models.EmailField(blank=True, default="")
    telephone = models.CharField(max_length=50, blank=True, default="")
    adresse = models.TextField(blank=True, default="")
    identifiant = models.CharField(
        max_length=100,
        blank=True,
        default="",
        help_text="RCCM / IFU / SIRET / etc.",
    )

    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=["copropriete", "nom"]),
            models.Index(fields=["copropriete", "is_active"]),
            models.Index(fields=["copropriete", "created_at"]),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["copropriete", "nom"],
                name="travaux_fournisseur_unique_nom_par_copro",
            ),
        ]

    def clean(self):
        super().clean()
        if self.nom:
            self.nom = self.nom.strip()

    def save(self, *args, **kwargs):
        if self.nom:
            self.nom = self.nom.strip()
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return f"{self.nom} (copro={self.copropriete_id})"


class DossierTravaux(models.Model):
    class Statut(models.TextChoices):
        BROUILLON = "BROUILLON", "Brouillon"
        SOUMIS_AG = "SOUMIS_AG", "Soumis à l'AG"
        VALIDE = "VALIDE", "Validé (AG)"
        EN_COURS = "EN_COURS", "En cours"
        TERMINE = "TERMINE", "Terminé"
        ARCHIVE = "ARCHIVE", "Archivé"

    copropriete = models.ForeignKey(
        Copropriete,
        on_delete=models.CASCADE,
        related_name="dossiers_travaux",
    )

    titre = models.CharField(max_length=255)
    description = models.TextField(blank=True, default="")

    statut = models.CharField(
        max_length=20,
        choices=Statut.choices,
        default=Statut.BROUILLON,
    )

    budget_estime = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=DEC_0,
        validators=[MinValueValidator(DEC_0)],
    )
    budget_vote = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
        validators=[MinValueValidator(DEC_0)],
        help_text="Budget voté en AG (optionnel).",
    )

    # OneToOne = vérité métier (validation AG)
    resolution_validation = models.OneToOneField(
        "ag.Resolution",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="dossier_travaux_validation",  # resolution.dossier_travaux_validation
        db_column="resolution_validation_id",
        db_index=True,
        help_text="Résolution AG qui valide ce dossier.",
    )

    locked_at = models.DateTimeField(null=True, blank=True)
    locked_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="travaux_locked",
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # -------------------------
    # Workflow: transitions autorisées
    # -------------------------
    ALLOWED_TRANSITIONS = {
        Statut.BROUILLON: {Statut.SOUMIS_AG},
        Statut.SOUMIS_AG: {Statut.VALIDE},
        Statut.VALIDE: {Statut.EN_COURS, Statut.ARCHIVE},
        Statut.EN_COURS: {Statut.TERMINE, Statut.ARCHIVE},
        Statut.TERMINE: {Statut.ARCHIVE},
        Statut.ARCHIVE: set(),
    }

    class Meta:
        indexes = [
            models.Index(fields=["copropriete", "statut"]),
            models.Index(fields=["copropriete", "created_at"]),
            models.Index(fields=["copropriete", "titre"]),
            models.Index(fields=["copropriete", "resolution_validation"]),
            models.Index(fields=["copropriete", "locked_at"]),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["copropriete", "titre"],
                name="travaux_dossier_unique_titre_par_copro",
            ),
            models.CheckConstraint(
                condition=Q(budget_estime__gte=DEC_0),
                name="travaux_dossier_budget_estime_gte_0",
            ),
            models.CheckConstraint(
                condition=Q(budget_vote__isnull=True) | Q(budget_vote__gte=DEC_0),
                name="travaux_dossier_budget_vote_null_or_gte_0",
            ),
            models.CheckConstraint(
                condition=Q(budget_vote__isnull=True) | Q(budget_vote__lte=F("budget_estime")),
                name="travaux_dossier_budget_vote_lte_estime",
            ),
            # Si VALIDE => résolution obligatoire
            models.CheckConstraint(
                condition=~Q(statut="VALIDE") | Q(resolution_validation__isnull=False),
                name="travaux_dossier_valide_requires_resolution",
            ),
            # Si verrouillé => pas BROUILLON / SOUMIS_AG
            models.CheckConstraint(
                condition=Q(locked_at__isnull=True) | ~Q(statut__in=["BROUILLON", "SOUMIS_AG"]),
                name="travaux_dossier_locked_forbids_draft_or_submitted",
            ),
        ]

    def __str__(self) -> str:
        return f"DossierTravaux#{self.id} {self.titre} ({self.statut})"

    @property
    def is_locked(self) -> bool:
        return bool(self.locked_at)

    # -------------------------
    # Paiements: helpers
    # -------------------------
    def budget_reference(self) -> Decimal:
        """
        Budget 'plafond' pour paiements.
        - si budget_vote est défini => c'est la source de vérité
        - sinon on retombe sur budget_estime
        """
        if self.budget_vote is not None:
            return Decimal(str(self.budget_vote))
        return Decimal(str(self.budget_estime or DEC_0))

    def total_paye(self) -> Decimal:
        total = self.paiements_travaux.aggregate(total=Sum("montant")).get("total") or DEC_0
        return Decimal(str(total))

    def reste_a_payer(self) -> Decimal:
        reste = self.budget_reference() - self.total_paye()
        return reste if reste > DEC_0 else DEC_0

    # -------------------------
    # Validations
    # -------------------------
    def clean(self):
        super().clean()

        if self.titre:
            self.titre = self.titre.strip()

        if self.statut == self.Statut.VALIDE and not self.resolution_validation_id:
            raise ValidationError(
                {"resolution_validation": "Requis quand le dossier est au statut VALIDE."}
            )

        if self.is_locked and self.statut in {self.Statut.BROUILLON, self.Statut.SOUMIS_AG}:
            raise ValidationError(
                {"statut": "Un dossier verrouillé ne peut pas être BROUILLON / SOUMIS_AG."}
            )

        if (
            self.budget_vote is not None
            and self.budget_estime is not None
            and self.budget_vote > self.budget_estime
        ):
            raise ValidationError({"budget_vote": "Ne peut pas dépasser budget_estime."})

    # -------------------------
    # Save (PRODUCTION-GRADE): verrou incontournable + workflow autorisé
    # -------------------------
    def save(self, *args, **kwargs):
        """
        Politique production:
        - Si dossier verrouillé (locked_at non null), toute modification métier est refusée,
          SAUF transition de workflow sur "statut" (ex: VALIDE -> EN_COURS, EN_COURS -> TERMINE...)
          et seulement si la transition est autorisée.
        - Les changements de lock doivent passer par lock()/unlock() (UPDATE DB atomiques).
        """
        if self.titre:
            self.titre = self.titre.strip()

        update_fields = kwargs.get("update_fields")
        update_fields_set = set(update_fields) if update_fields else None

        # 🔒 verrou anti-contournement: si déjà en DB et verrouillé => pas de modifications métier
        if self.pk:
            old = (
                self.__class__.objects.filter(pk=self.pk)
                .only(
                    "titre",
                    "description",
                    "statut",
                    "budget_estime",
                    "budget_vote",
                    "resolution_validation_id",
                    "locked_at",
                    "locked_by_id",
                    "copropriete_id",
                )
                .first()
            )

            if old and old.locked_at is not None:
                # champs métier qui ne doivent plus bouger une fois verrouillé
                immutable_fields = (
                    "titre",
                    "description",
                    "statut",
                    "budget_estime",
                    "budget_vote",
                    "resolution_validation_id",
                    "copropriete_id",
                )

                changed = []
                for f in immutable_fields:
                    # si update_fields est fourni, on ne contrôle que ce qui est censé être modifié
                    if update_fields_set is not None and f not in update_fields_set:
                        continue

                    old_val = getattr(old, f)
                    new_val = getattr(self, f)
                    if old_val != new_val:
                        changed.append(f)

                if changed:
                    # ✅ Exception: autoriser UNIQUEMENT le changement de statut via workflow autorisé
                    if changed == ["statut"]:
                        old_statut = str(old.statut)
                        new_statut = str(self.statut)

                        # pas un vrai changement => OK
                        if old_statut == new_statut:
                            pass
                        else:
                            allowed = self.ALLOWED_TRANSITIONS.get(old_statut, set())
                            if new_statut not in allowed:
                                raise ValidationError(
                                    {"statut": f"Dossier verrouillé: transition interdite {old_statut} -> {new_statut}."}
                                )
                            # transition OK => on laisse passer
                    else:
                        raise ValidationError(
                            {"detail": f"Dossier verrouillé: modification interdite ({', '.join(changed)})."}
                        )

        self.full_clean()
        super().save(*args, **kwargs)

    # -------------------------
    # Locks (robuste, DB UPDATE atomique)
    # -------------------------
    def lock(self, user=None, save=True):
        """
        Verrouille le dossier.
        Interdit si statut BROUILLON / SOUMIS_AG (cohérent avec contraintes DB).
        Utilise UPDATE DB pour éviter save()/full_clean et garantir l'atomicité.
        """
        if self.statut in {self.Statut.BROUILLON, self.Statut.SOUMIS_AG}:
            raise ValidationError(
                {"detail": "Verrouillage interdit tant que le dossier est BROUILLON / SOUMIS_AG."}
            )

        now = timezone.now()
        if not self.locked_at:
            self.locked_at = now

        if user is not None and not self.locked_by_id:
            self.locked_by = user

        if save:
            updates = {"locked_at": self.locked_at}
            if user is not None and self.locked_by_id:
                updates["locked_by"] = self.locked_by

            with transaction.atomic():
                self.__class__.objects.filter(pk=self.pk).update(**updates)

    def unlock(self, user=None, raison: str | None = None, save=True):
        """
        Déverrouille le dossier.
        Optionnel: log d'audit si user + raison fournis.
        """
        old_locked = self.locked_at is not None
        old_statut = str(self.statut or "")

        if save:
            with transaction.atomic():
                self.__class__.objects.filter(pk=self.pk).update(locked_at=None, locked_by=None)

                # ✅ Audit unlock (optionnel)
                if user is not None and raison:
                    TravauxUnlockLog = django_apps.get_model("travaux", "TravauxUnlockLog")
                    TravauxUnlockLog.objects.create(
                        dossier_id=self.pk,
                        unlocked_by=user,
                        raison=str(raison),
                        old_locked=bool(old_locked),
                        new_locked=False,
                        old_statut=old_statut,
                        new_statut=str(self.statut or ""),
                    )

        self.locked_at = None
        self.locked_by = None

    # -------------------------
    # Workflow helpers
    # -------------------------
    def transition_to(self, new_statut: str):
        allowed = self.ALLOWED_TRANSITIONS.get(self.statut, set())
        if new_statut not in allowed:
            raise ValidationError({"statut": f"Transition interdite: {self.statut} -> {new_statut}."})
        self.statut = new_statut

    def submit_ag(self):
        self.transition_to(self.Statut.SOUMIS_AG)

    def validate_ag(self):
        self.transition_to(self.Statut.VALIDE)

    def start(self):
        self.transition_to(self.Statut.EN_COURS)

    def finish(self):
        self.transition_to(self.Statut.TERMINE)

    def archive(self):
        if self.statut not in {self.Statut.VALIDE, self.Statut.EN_COURS, self.Statut.TERMINE}:
            raise ValidationError({"statut": f"Archivage interdit depuis {self.statut}."})
        self.statut = self.Statut.ARCHIVE


class TravauxUnlockLog(models.Model):
    """
    ✅ Phase 3 production-grade — Audit des déverrouillages
    Trace qui a déverrouillé, quand, et pourquoi.
    """
    dossier = models.ForeignKey(
        DossierTravaux,
        on_delete=models.CASCADE,
        related_name="unlock_logs",
    )
    unlocked_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="travaux_unlock_actions",
    )
    raison = models.TextField()

    old_locked = models.BooleanField(default=True)
    new_locked = models.BooleanField(default=False)

    old_statut = models.CharField(max_length=30, blank=True, default="")
    new_statut = models.CharField(max_length=30, blank=True, default="")

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["created_at"]),
            models.Index(fields=["dossier", "created_at"]),
        ]

    def __str__(self) -> str:
        return f"UnlockLog#{self.id} dossier={self.dossier_id} by={self.unlocked_by_id}"


class PaiementTravaux(models.Model):
    """
    ✅ Phase 3 — Paiements fournisseurs
    Enregistre les paiements effectués pour un dossier travaux.
    """

    copropriete = models.ForeignKey(
        Copropriete,
        on_delete=models.CASCADE,
        related_name="paiements_travaux",
    )
    dossier = models.ForeignKey(
        DossierTravaux,
        on_delete=models.CASCADE,
        related_name="paiements_travaux",
    )
    fournisseur = models.ForeignKey(
        Fournisseur,
        on_delete=models.PROTECT,
        related_name="paiements_travaux",
    )

    montant = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.01"))],
    )
    date_paiement = models.DateField(default=date.today)

    reference = models.CharField(max_length=120, blank=True, default="")
    note = models.TextField(blank=True, default="")

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="paiements_travaux_created",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-date_paiement", "-id"]
        indexes = [
            models.Index(fields=["copropriete", "date_paiement"]),
            models.Index(fields=["copropriete", "dossier"]),
            models.Index(fields=["copropriete", "fournisseur"]),
        ]
        constraints = [
            models.CheckConstraint(
                condition=Q(montant__gt=Decimal("0.00")),
                name="travaux_paiement_montant_gt_0",
            ),
        ]

    def __str__(self) -> str:
        return f"PaiementTravaux#{self.id} dossier={self.dossier_id} montant={self.montant}"

    def clean(self):
        super().clean()

        # --- périmètre copro ---
        if self.dossier_id and self.copropriete_id:
            if int(self.dossier.copropriete_id) != int(self.copropriete_id):
                raise ValidationError({"dossier": "Dossier hors copropriété."})

        if self.fournisseur_id and self.copropriete_id:
            if int(self.fournisseur.copropriete_id) != int(self.copropriete_id):
                raise ValidationError({"fournisseur": "Fournisseur hors copropriété."})

        # --- date paiement ---
        if self.date_paiement and self.date_paiement > date.today():
            raise ValidationError({"date_paiement": "La date de paiement ne peut pas être dans le futur."})

        # --- dossier doit être 'après validation' ---
        if self.dossier_id:
            st = self.dossier.statut
            allowed = {
                DossierTravaux.Statut.VALIDE,
                DossierTravaux.Statut.EN_COURS,
                DossierTravaux.Statut.TERMINE,
                DossierTravaux.Statut.ARCHIVE,
            }
            if st not in allowed:
                raise ValidationError({"dossier": f"Paiement interdit tant que le dossier est {st}."})

            # ✅ politique stricte: paiement seulement si dossier verrouillé (recommandé)
            if not self.dossier.is_locked:
                raise ValidationError(
                    {"dossier": "Paiement interdit : le dossier doit être verrouillé (validé/lock) d'abord."}
                )

        # --- plafond budget (vote si dispo sinon estime) ---
        if self.dossier_id and self.montant is not None:
            budget = self.dossier.budget_reference()

            # total existant (sans ce paiement si update)
            qs = PaiementTravaux.objects.filter(dossier_id=self.dossier_id)
            if self.pk:
                qs = qs.exclude(pk=self.pk)

            total_existant = qs.aggregate(t=Sum("montant")).get("t") or DEC_0
            total_existant = Decimal(str(total_existant))

            futur_total = total_existant + Decimal(str(self.montant))
            if budget is not None and futur_total > Decimal(str(budget)):
                raise ValidationError(
                    {"montant": f"Plafond budget dépassé. Total futur={futur_total} > budget={budget}."}
                )

        # nettoyage
        if self.reference:
            self.reference = self.reference.strip()

    def save(self, *args, **kwargs):
        if self.reference:
            self.reference = self.reference.strip()
        self.full_clean()
        super().save(*args, **kwargs)