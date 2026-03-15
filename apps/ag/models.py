from __future__ import annotations

from decimal import Decimal

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import MinValueValidator
from django.db import models, transaction
from django.db.models import Sum
from django.utils import timezone


DEC0 = Decimal("0.00")


class AssembleeGenerale(models.Model):
    STATUT_CHOICES = [
        ("BROUILLON", "Brouillon"),
        ("CONVOQUEE", "Convoquée"),
        ("OUVERTE", "Ouverte"),
        ("CLOTUREE", "Clôturée"),
        ("ANNULEE", "Annulée"),
    ]

    copropriete = models.ForeignKey(
        "core.Copropriete",
        on_delete=models.CASCADE,
        related_name="assemblees_generales",
    )
    exercice = models.ForeignKey(
        "billing_app.Exercice",
        on_delete=models.PROTECT,
        related_name="assemblees_generales",
        null=True,
        blank=True,
    )

    titre = models.CharField(max_length=160, default="Assemblée Générale")
    date_ag = models.DateTimeField()
    lieu = models.CharField(max_length=255, blank=True)

    # Catégorie officielle de référence pour quorum / présences / votes
    tantieme_categorie = models.ForeignKey(
        "lots.TantiemeCategorie",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="assemblees_generales",
    )

    statut = models.CharField(max_length=20, choices=STATUT_CHOICES, default="BROUILLON")

    # Clôture administrative
    closed_at = models.DateTimeField(null=True, blank=True)
    closed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="ags_cloturees",
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # PV archive + immutabilité
    pv_pdf = models.FileField(upload_to="ag/pv/", null=True, blank=True)
    pv_pdf_hash = models.CharField(max_length=64, blank=True, default="")
    pv_generated_at = models.DateTimeField(null=True, blank=True)
    pv_locked = models.BooleanField(default=False)

    # Signature PAdES
    pv_signed_pdf = models.FileField(upload_to="ag/pv_signed/", null=True, blank=True)
    pv_signed_hash = models.CharField(max_length=64, blank=True, default="")
    pv_signed_at = models.DateTimeField(null=True, blank=True)
    pv_signer_subject = models.CharField(max_length=255, blank=True, default="")

    # Signatures visuelles
    president_nom = models.CharField(max_length=120, blank=True, default="")
    secretaire_nom = models.CharField(max_length=120, blank=True, default="")

    signature_president = models.ImageField(upload_to="ag/signatures/", null=True, blank=True)
    signature_secretaire = models.ImageField(upload_to="ag/signatures/", null=True, blank=True)
    cachet_image = models.ImageField(upload_to="ag/cachets/", null=True, blank=True)

    class Meta:
        ordering = ["-date_ag", "-id"]
        indexes = [
            models.Index(fields=["copropriete", "date_ag"]),
            models.Index(fields=["statut", "date_ag"]),
            models.Index(fields=["pv_locked"]),
        ]

    def __str__(self):
        return f"AG {self.copropriete_id} - {self.date_ag.date()}"

    # -------------------------
    # Helpers généraux
    # -------------------------
    def is_closed(self) -> bool:
        return self.statut == "CLOTUREE"

    def is_immutable(self) -> bool:
        return bool(self.pv_locked) or self.is_closed()

    def ensure_writable(self, *, reason: str = "AG") -> None:
        if self.is_closed():
            raise ValidationError({"ag": f"{reason} clôturée : modification interdite."})
        if self.pv_locked:
            raise ValidationError({"ag": f"PV verrouillé : modification interdite ({reason})."})

    def clean(self):
        super().clean()

        if self.exercice_id and self.exercice:
            if self.exercice.copropriete_id != self.copropriete_id:
                raise ValidationError({"exercice": "L'exercice doit appartenir à la même copropriété."})

        if self.tantieme_categorie_id and self.tantieme_categorie:
            if self.tantieme_categorie.copropriete_id != self.copropriete_id:
                raise ValidationError(
                    {"tantieme_categorie": "La catégorie de tantièmes doit appartenir à la même copropriété."}
                )

    def _get_db_instance(self):
        if not self.pk:
            return None
        return AssembleeGenerale.objects.filter(pk=self.pk).first()

    @staticmethod
    def _file_name(f) -> str:
        return getattr(f, "name", "") or ""

    @staticmethod
    def _normalize_field_name(field_name: str) -> str:
        return field_name[:-3] if field_name.endswith("_id") else field_name

    def save(self, *args, **kwargs):
        db = self._get_db_instance()

        if db and (db.pv_locked or db.statut == "CLOTUREE"):
            allowed_when_locked_or_closed = {
                "pv_locked",
                "pv_signed_pdf",
                "pv_signed_hash",
                "pv_signed_at",
                "pv_signer_subject",
                "statut",
                "closed_at",
                "closed_by",
            }

            changed = set()

            simple_fields = [
                "copropriete_id",
                "exercice_id",
                "titre",
                "date_ag",
                "lieu",
                "tantieme_categorie_id",
                "statut",
                "pv_pdf_hash",
                "pv_generated_at",
                "president_nom",
                "secretaire_nom",
                "pv_signer_subject",
                "pv_signed_hash",
                "pv_signed_at",
                "pv_locked",
                "closed_at",
                "closed_by_id",
            ]
            for field in simple_fields:
                if getattr(self, field) != getattr(db, field):
                    changed.add(field)

            if self._file_name(self.pv_pdf) != self._file_name(db.pv_pdf):
                changed.add("pv_pdf")
            if self._file_name(self.pv_signed_pdf) != self._file_name(db.pv_signed_pdf):
                changed.add("pv_signed_pdf")
            if self._file_name(self.signature_president) != self._file_name(db.signature_president):
                changed.add("signature_president")
            if self._file_name(self.signature_secretaire) != self._file_name(db.signature_secretaire):
                changed.add("signature_secretaire")
            if self._file_name(self.cachet_image) != self._file_name(db.cachet_image):
                changed.add("cachet_image")

            normalized_changed = {self._normalize_field_name(c) for c in changed}
            forbidden = {c for c in normalized_changed if c not in allowed_when_locked_or_closed}
            if forbidden:
                raise ValidationError(
                    {"pv_locked": f"AG immuable : modification interdite ({', '.join(sorted(forbidden))})."}
                )

        self.full_clean()
        super().save(*args, **kwargs)

    # -------------------------
    # Helpers tantièmes
    # -------------------------
    def get_reference_tantieme_categorie_id(self):
        return self.tantieme_categorie_id

    def get_lot_tantiemes(self, lot_id: int, *, categorie_id: int | None = None) -> Decimal:
        """
        Retourne les tantièmes d’un lot pour la catégorie de référence.
        Si aucune catégorie AG n’est définie, somme toutes les catégories du lot.
        """
        from apps.lots.models import LotTantieme

        ref_cat_id = categorie_id if categorie_id is not None else self.get_reference_tantieme_categorie_id()

        qs = LotTantieme.objects.filter(
            lot_id=lot_id,
            lot__copropriete_id=self.copropriete_id,
        )

        if ref_cat_id:
            qs = qs.filter(categorie_id=ref_cat_id)

        total = qs.aggregate(total=Sum("valeur")).get("total") or DEC0
        return Decimal(str(total))

    def total_tantiemes_copro(self) -> Decimal:
        from apps.lots.models import LotTantieme

        qs = LotTantieme.objects.filter(lot__copropriete_id=self.copropriete_id)
        if self.tantieme_categorie_id:
            qs = qs.filter(categorie_id=self.tantieme_categorie_id)

        total = qs.aggregate(total=Sum("valeur")).get("total") or DEC0
        return Decimal(str(total))

    def total_tantiemes_presents(self) -> Decimal:
        total = (
            self.presences
            .filter(present_ou_represente=True)
            .aggregate(total=Sum("tantiemes"))
            .get("total")
        ) or DEC0
        return Decimal(str(total))

    def quorum_atteint(self, seuil_ratio: Decimal = Decimal("0.50")) -> bool:
        total = self.total_tantiemes_copro()
        if total <= 0:
            return False
        presents = self.total_tantiemes_presents()
        return presents >= (total * seuil_ratio)

    # -------------------------
    # Helpers PV
    # -------------------------
    def lock_pv(self):
        if not self.pv_pdf:
            raise ValidationError({"pv_pdf": "Impossible de verrouiller : PV non archivé."})
        if not self.pv_locked:
            self.pv_locked = True
            self.save(update_fields=["pv_locked"])

    def mark_signed(self, *, signed_pdf_file, signed_hash: str, signer_subject: str):
        self.pv_signed_pdf = signed_pdf_file
        self.pv_signed_hash = signed_hash
        self.pv_signer_subject = signer_subject or ""
        self.pv_signed_at = timezone.now()
        self.pv_locked = True
        self.save(
            update_fields=[
                "pv_signed_pdf",
                "pv_signed_hash",
                "pv_signer_subject",
                "pv_signed_at",
                "pv_locked",
            ]
        )

    # -------------------------
    # Clôture définitive
    # -------------------------
    def can_be_closed(self) -> None:
        if self.statut == "ANNULEE":
            raise ValidationError({"statut": "Impossible de clôturer une AG annulée."})

        if not self.pv_signed_pdf or not self.pv_signed_hash or not self.pv_signed_at:
            raise ValidationError({"pv_signed_pdf": "PV signé obligatoire avant clôture."})

        if not self.pv_locked:
            raise ValidationError({"pv_locked": "PV doit être verrouillé avant clôture."})

        if not self.quorum_atteint():
            raise ValidationError({"ag": "Quorum non atteint : clôture interdite."})

        if not self.resolutions.exists():
            raise ValidationError({"resolutions": "Aucune résolution : clôture interdite."})

    def close(self, *, user=None) -> "AssembleeGenerale":
        if not self.pk:
            raise ValidationError({"ag": "Impossible de clôturer : AG non sauvegardée (pk manquant)."})

        with transaction.atomic():
            ag = AssembleeGenerale.objects.select_for_update().get(pk=self.pk)

            if ag.statut == "CLOTUREE":
                return ag

            ag.can_be_closed()

            ag.statut = "CLOTUREE"
            ag.closed_at = timezone.now()
            ag.closed_by = user if user and getattr(user, "is_authenticated", False) else None
            ag.pv_locked = True
            ag.save(update_fields=["statut", "closed_at", "closed_by", "pv_locked"])
            return ag


class PresenceLot(models.Model):
    ag = models.ForeignKey(
        AssembleeGenerale,
        on_delete=models.CASCADE,
        related_name="presences",
    )
    lot = models.ForeignKey(
        "lots.Lot",
        on_delete=models.PROTECT,
        related_name="presences_ag",
    )

    tantiemes = models.DecimalField(max_digits=12, decimal_places=4, default=DEC0)
    present_ou_represente = models.BooleanField(default=True)
    representant_nom = models.CharField(max_length=120, blank=True)
    commentaire = models.TextField(blank=True)

    class Meta:
        unique_together = ("ag", "lot")
        indexes = [
            models.Index(fields=["ag", "present_ou_represente"]),
            models.Index(fields=["lot"]),
        ]

    def __str__(self):
        return f"Presence AG={self.ag_id} lot={self.lot_id}"

    def clean(self):
        super().clean()

        if self.lot_id and self.ag_id:
            if self.lot.copropriete_id != self.ag.copropriete_id:
                raise ValidationError({"lot": "Le lot doit appartenir à la copropriété de l'AG."})

        if self.ag_id:
            if self.ag.is_closed():
                raise ValidationError({"ag": "AG clôturée : modification des présences interdite."})
            if self.ag.pv_locked:
                raise ValidationError({"ag": "PV verrouillé : modification des présences interdite."})

    def refresh_tantiemes(self):
        """
        Recalcule les tantièmes depuis la catégorie de référence de l’AG.
        """
        if self.ag_id and self.lot_id:
            self.tantiemes = self.ag.get_lot_tantiemes(self.lot_id)

    def save(self, *args, **kwargs):
        if self.ag_id and self.lot_id:
            if self.tantiemes is None or Decimal(str(self.tantiemes)) <= 0:
                self.refresh_tantiemes()

        self.full_clean()
        super().save(*args, **kwargs)


class Resolution(models.Model):
    MAJORITE_CHOICES = [
        ("SIMPLE", "Majorité simple (POUR > CONTRE)"),
        ("ABSOLUE", "Majorité absolue (POUR > 50% des exprimés)"),
        ("QUALIFIEE_2_3", "Majorité qualifiée 2/3 (POUR >= 66.67% des exprimés)"),
        ("UNANIMITE", "Unanimité (100% POUR)"),
    ]

    ag = models.ForeignKey(
        AssembleeGenerale,
        on_delete=models.CASCADE,
        related_name="resolutions",
    )
    ordre = models.PositiveIntegerField(default=1)
    titre = models.CharField(max_length=200)
    texte = models.TextField(blank=True)

    type_majorite = models.CharField(max_length=20, choices=MAJORITE_CHOICES, default="SIMPLE")

    # Catégorie spécifique de vote pour cette résolution
    # Si vide -> fallback sur ag.tantieme_categorie
    tantieme_categorie = models.ForeignKey(
        "lots.TantiemeCategorie",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="resolutions",
    )

    travaux_dossier = models.ForeignKey(
        "travaux.DossierTravaux",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="resolutions_ag",
    )

    budget_vote = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
        validators=[MinValueValidator(Decimal("0.00"))],
    )

    cloturee = models.BooleanField(default=False)

    class Meta:
        unique_together = ("ag", "ordre")
        ordering = ["ag_id", "ordre"]
        indexes = [
            models.Index(fields=["ag", "ordre"]),
            models.Index(fields=["travaux_dossier"]),
        ]

    def __str__(self):
        return f"Résolution {self.ag_id}-{self.ordre} {self.titre}"

    def clean(self):
        super().clean()

        if self.ag_id:
            if self.ag.is_closed():
                raise ValidationError({"ag": "AG clôturée : modification des résolutions interdite."})
            if self.ag.pv_locked:
                raise ValidationError({"ag": "PV verrouillé : modification des résolutions interdite."})

        if self.tantieme_categorie_id and self.tantieme_categorie:
            if self.tantieme_categorie.copropriete_id != self.ag.copropriete_id:
                raise ValidationError(
                    {"tantieme_categorie": "La catégorie de tantièmes doit appartenir à la même copropriété que l'AG."}
                )

        if self.travaux_dossier_id:
            dossier = self.travaux_dossier

            if dossier and str(dossier.copropriete_id) != str(self.ag.copropriete_id):
                raise ValidationError(
                    {"travaux_dossier": "Le dossier travaux doit appartenir à la même copropriété que l'AG."}
                )

            dossier_statut = getattr(dossier, "statut", None) if dossier else None
            if not self.cloturee:
                if dossier and dossier_statut != "SOUMIS_AG":
                    raise ValidationError(
                        {"travaux_dossier": "Le dossier travaux doit être SOUMIS_AG avant d’être lié à une résolution."}
                    )

            if dossier and getattr(dossier, "resolution_validation_id", None) and self.pk:
                if int(dossier.resolution_validation_id) != int(self.pk):
                    raise ValidationError(
                        {"travaux_dossier": "Incohérence: ce dossier est déjà validé par une autre résolution."}
                    )

    def _get_db_instance(self):
        if not self.pk:
            return None
        return Resolution.objects.filter(pk=self.pk).first()

    def get_reference_tantieme_categorie_id(self):
        return self.tantieme_categorie_id or self.ag.tantieme_categorie_id

    def save(self, *args, **kwargs):
        db = self._get_db_instance()
        prev_travaux_dossier_id = getattr(db, "travaux_dossier_id", None) if db else None

        self.full_clean()

        with transaction.atomic():
            super().save(*args, **kwargs)

            if self.travaux_dossier_id:
                from apps.travaux.models import DossierTravaux

                dossier = DossierTravaux.objects.select_for_update().filter(pk=self.travaux_dossier_id).first()
                if not dossier:
                    raise ValidationError({"travaux_dossier": "Dossier travaux introuvable."})

                if str(dossier.copropriete_id) != str(self.ag.copropriete_id):
                    raise ValidationError(
                        {"travaux_dossier": "Le dossier travaux doit appartenir à la même copropriété que l'AG."}
                    )

                if dossier.resolution_validation_id and int(dossier.resolution_validation_id) != int(self.pk):
                    raise ValidationError(
                        {"travaux_dossier": "Ce dossier est déjà validé (resolution_validation) par une autre résolution."}
                    )

                if dossier.resolution_validation_id != self.pk:
                    DossierTravaux.objects.filter(pk=dossier.pk).update(resolution_validation_id=self.pk)

            if prev_travaux_dossier_id and not self.travaux_dossier_id:
                from apps.travaux.models import DossierTravaux

                dossier_prev = DossierTravaux.objects.select_for_update().filter(pk=prev_travaux_dossier_id).first()
                if dossier_prev and dossier_prev.resolution_validation_id == self.pk:
                    DossierTravaux.objects.filter(pk=dossier_prev.pk).update(resolution_validation=None)


class Vote(models.Model):
    CHOIX = [
        ("POUR", "Pour"),
        ("CONTRE", "Contre"),
        ("ABSTENTION", "Abstention"),
    ]

    resolution = models.ForeignKey(
        Resolution,
        on_delete=models.CASCADE,
        related_name="votes",
    )
    lot = models.ForeignKey(
        "lots.Lot",
        on_delete=models.PROTECT,
        related_name="votes_ag",
    )

    choix = models.CharField(max_length=12, choices=CHOIX)
    tantiemes = models.DecimalField(max_digits=12, decimal_places=4, default=DEC0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        # Un lot = un seul vote par résolution
        unique_together = ("resolution", "lot")
        indexes = [
            models.Index(fields=["resolution", "choix"]),
            models.Index(fields=["lot"]),
        ]

    def __str__(self):
        return f"Vote res={self.resolution_id} lot={self.lot_id} choix={self.choix}"

    def clean(self):
        super().clean()

        if self.resolution_id and self.resolution.cloturee:
            raise ValidationError({"resolution": "Cette résolution est clôturée. Aucun vote n'est accepté."})

        if self.resolution_id:
            ag = self.resolution.ag
            if ag.is_closed():
                raise ValidationError({"resolution": "AG clôturée : aucun vote n'est accepté."})
            if ag.pv_locked:
                raise ValidationError({"resolution": "PV verrouillé : aucun vote n'est accepté."})

        if self.lot_id and self.resolution_id:
            if self.lot.copropriete_id != self.resolution.ag.copropriete_id:
                raise ValidationError({"lot": "Le lot doit appartenir à la copropriété de l'AG."})

        if self.resolution_id and self.lot_id:
            has_presences = PresenceLot.objects.filter(ag_id=self.resolution.ag_id).exists()
            if has_presences:
                ok = PresenceLot.objects.filter(
                    ag_id=self.resolution.ag_id,
                    lot_id=self.lot_id,
                    present_ou_represente=True,
                ).exists()
                if not ok:
                    raise ValidationError({"lot": "Ce lot n'est pas présent/représenté pour cette AG."})

    def refresh_tantiemes(self):
        if self.resolution_id and self.lot_id:
            ref_cat_id = self.resolution.get_reference_tantieme_categorie_id()
            self.tantiemes = self.resolution.ag.get_lot_tantiemes(
                self.lot_id,
                categorie_id=ref_cat_id,
            )

    def save(self, *args, **kwargs):
        if self.resolution_id and self.lot_id:
            if self.tantiemes is None or Decimal(str(self.tantiemes)) <= 0:
                self.refresh_tantiemes()

        with transaction.atomic():
            self.full_clean()
            super().save(*args, **kwargs)