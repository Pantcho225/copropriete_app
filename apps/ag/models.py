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


class AgConvocation(models.Model):
    STATUT_CHOICES = [
        ("BROUILLON", "Brouillon"),
        ("GENEREE", "Générée"),
        ("ENVOYEE", "Envoyée"),
        ("CONSULTEE", "Consultée"),
        ("ANNULEE", "Annulée"),
    ]

    CANAL_CHOICES = [
        ("PLATEFORME", "Plateforme"),
        ("EMAIL", "Email"),
        ("WHATSAPP", "WhatsApp"),
        ("PAPIER", "Papier"),
        ("AUTRE", "Autre"),
    ]

    ag = models.ForeignKey(
        "ag.AssembleeGenerale",
        on_delete=models.CASCADE,
        related_name="convocations",
    )
    copropriete = models.ForeignKey(
        "core.Copropriete",
        on_delete=models.CASCADE,
        related_name="ag_convocations",
    )
    coproprietaire = models.ForeignKey(
        "owners.Coproprietaire",
        on_delete=models.PROTECT,
        related_name="ag_convocations",
    )
    lot = models.ForeignKey(
        "lots.Lot",
        on_delete=models.PROTECT,
        related_name="ag_convocations",
    )
    document = models.ForeignKey(
        "documents.GeneratedDocument",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="ag_convocations",
    )

    parent_convocation = models.ForeignKey(
        "self",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="rectificatives",
    )
    version = models.PositiveIntegerField(default=1)
    is_rectificative = models.BooleanField(default=False)
    motif_rectification = models.TextField(blank=True, default="")

    reference = models.CharField(max_length=80, unique=True, blank=True, default="")
    statut = models.CharField(max_length=20, choices=STATUT_CHOICES, default="BROUILLON")
    canal = models.CharField(max_length=20, choices=CANAL_CHOICES, default="PLATEFORME")

    objet = models.CharField(max_length=180, blank=True, default="")
    message = models.TextField(blank=True, default="")

    generated_at = models.DateTimeField(null=True, blank=True)
    sent_at = models.DateTimeField(null=True, blank=True)
    consulted_at = models.DateTimeField(null=True, blank=True)
    cancelled_at = models.DateTimeField(null=True, blank=True)

    generated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="ag_convocations_generees",
    )
    sent_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="ag_convocations_envoyees",
    )
    cancelled_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="ag_convocations_annulees",
    )

    cancellation_reason = models.TextField(blank=True, default="")
    metadata = models.JSONField(default=dict, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at", "-id"]
        constraints = [
            models.UniqueConstraint(
                fields=["ag", "lot", "version"],
                name="unique_ag_convocation_by_lot_version",
            ),
        ]
        indexes = [
            models.Index(fields=["copropriete", "ag"]),
            models.Index(fields=["copropriete", "statut"]),
            models.Index(fields=["ag", "statut"]),
            models.Index(fields=["ag", "lot", "version"]),
            models.Index(fields=["parent_convocation"]),
            models.Index(fields=["coproprietaire", "statut"]),
            models.Index(fields=["lot", "statut"]),
            models.Index(fields=["reference"]),
        ]

    def __str__(self):
        return f"Convocation {self.reference or self.pk} - AG {self.ag_id}"

    def clean(self):
        super().clean()

        if self.ag_id and self.copropriete_id:
            if self.ag.copropriete_id != self.copropriete_id:
                raise ValidationError(
                    {"copropriete": "La convocation doit appartenir à la même copropriété que l'AG."}
                )

        if self.lot_id and self.copropriete_id:
            if self.lot.copropriete_id != self.copropriete_id:
                raise ValidationError(
                    {"lot": "Le lot convoqué doit appartenir à la même copropriété."}
                )

        if self.coproprietaire_id and self.copropriete_id:
            if self.coproprietaire.copropriete_id != self.copropriete_id:
                raise ValidationError(
                    {"coproprietaire": "Le copropriétaire convoqué doit appartenir à la même copropriété."}
                )

    def save(self, *args, **kwargs):
        if self.ag_id and not self.copropriete_id:
            self.copropriete_id = self.ag.copropriete_id

        if not self.objet and self.ag_id:
            self.objet = f"Convocation - {self.ag.titre}"

        if not self.reference:
            self.full_clean(exclude=["reference"])

            with transaction.atomic():
                super().save(*args, **kwargs)
                now = timezone.now()
                self.reference = f"CONV-AG-{now:%Y%m%d}-{self.ag_id}-{self.pk:05d}"
                super().save(update_fields=["reference", "updated_at"])
            return

        self.full_clean()
        super().save(*args, **kwargs)

    def mark_generated(self, *, user=None, document=None):
        self.statut = "GENEREE"
        self.generated_at = timezone.now()

        if user is not None and getattr(user, "is_authenticated", False):
            self.generated_by = user

        if document is not None:
            self.document = document

        self.save(
            update_fields=[
                "statut",
                "generated_at",
                "generated_by",
                "document",
                "updated_at",
            ]
        )

    def mark_sent(self, *, user=None, canal: str | None = None):
        self.statut = "ENVOYEE"
        self.sent_at = timezone.now()

        if canal:
            self.canal = canal

        if user is not None and getattr(user, "is_authenticated", False):
            self.sent_by = user

        self.save(
            update_fields=[
                "statut",
                "sent_at",
                "sent_by",
                "canal",
                "updated_at",
            ]
        )

    def mark_consulted(self):
        if self.statut != "ANNULEE":
            self.statut = "CONSULTEE"
            self.consulted_at = timezone.now()
            self.save(update_fields=["statut", "consulted_at", "updated_at"])

    def cancel(self, *, user=None, reason: str = ""):
        self.statut = "ANNULEE"
        self.cancelled_at = timezone.now()
        self.cancellation_reason = reason or ""

        if user is not None and getattr(user, "is_authenticated", False):
            self.cancelled_by = user

        self.save(
            update_fields=[
                "statut",
                "cancelled_at",
                "cancelled_by",
                "cancellation_reason",
                "updated_at",
            ]
        )


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


class AGProcuration(models.Model):
    class Statut(models.TextChoices):
        EN_ATTENTE = "EN_ATTENTE", "En attente"
        VALIDEE = "VALIDEE", "Validée"
        REJETEE = "REJETEE", "Rejetée"
        ANNULEE = "ANNULEE", "Annulée"

    ag = models.ForeignKey(
        AssembleeGenerale,
        on_delete=models.CASCADE,
        related_name="procurations",
    )
    coproprietaire = models.ForeignKey(
        "owners.Coproprietaire",
        on_delete=models.PROTECT,
        related_name="procurations_ag",
    )
    lot = models.ForeignKey(
        "lots.Lot",
        on_delete=models.PROTECT,
        related_name="procurations_ag",
    )

    mandataire_nom = models.CharField(max_length=160)
    mandataire_telephone = models.CharField(max_length=40, blank=True)
    mandataire_email = models.EmailField(blank=True)

    document = models.ForeignKey(
        "documents.GeneratedDocument",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="procurations_ag",
    )

    statut = models.CharField(
        max_length=20,
        choices=Statut.choices,
        default=Statut.EN_ATTENTE,
        db_index=True,
    )
    motif_rejet = models.TextField(blank=True)

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="ag_procurations_creees",
    )
    validated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="ag_procurations_validees",
    )
    validated_at = models.DateTimeField(null=True, blank=True)

    rejected_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="ag_procurations_rejetees",
    )
    rejected_at = models.DateTimeField(null=True, blank=True)

    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.CharField(max_length=255, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at", "-id"]
        constraints = [
            models.UniqueConstraint(
                fields=["ag", "lot"],
                condition=models.Q(statut__in=["EN_ATTENTE", "VALIDEE"]),
                name="uniq_ag_procuration_active_par_lot",
            ),
        ]
        indexes = [
            models.Index(fields=["ag", "statut"]),
            models.Index(fields=["coproprietaire", "statut"]),
            models.Index(fields=["lot", "statut"]),
            models.Index(fields=["created_at"]),
        ]

    def __str__(self):
        return f"Procuration AG={self.ag_id} lot={self.lot_id} statut={self.statut}"

    def clean(self):
        super().clean()

        if self.ag_id:
            if self.ag.statut not in {"CONVOQUEE", "OUVERTE"}:
                raise ValidationError(
                    {
                        "ag": (
                            "Une procuration ne peut être créée que pour une AG "
                            "convoquée ou ouverte."
                        )
                    }
                )

            if self.ag.is_closed() or self.ag.pv_locked:
                raise ValidationError(
                    {"ag": "AG clôturée ou PV verrouillé : procuration interdite."}
                )

        if self.ag_id and self.lot_id:
            if self.lot.copropriete_id != self.ag.copropriete_id:
                raise ValidationError(
                    {"lot": "Le lot doit appartenir à la même copropriété que l’AG."}
                )

        if self.coproprietaire_id and self.ag_id:
            if self.coproprietaire.copropriete_id != self.ag.copropriete_id:
                raise ValidationError(
                    {
                        "coproprietaire": (
                            "Le copropriétaire doit appartenir à la même copropriété "
                            "que l’AG."
                        )
                    }
                )

        if not self.mandataire_nom or not self.mandataire_nom.strip():
            raise ValidationError(
                {"mandataire_nom": "Le nom du mandataire est obligatoire."}
            )

        if self.mandataire_nom:
            self.mandataire_nom = self.mandataire_nom.strip()

        if self.mandataire_telephone:
            self.mandataire_telephone = self.mandataire_telephone.strip()

        if self.mandataire_email:
            self.mandataire_email = self.mandataire_email.strip().lower()

        if self.motif_rejet:
            self.motif_rejet = self.motif_rejet.strip()

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)

    def valider(self, *, user=None):
        if self.statut == self.Statut.VALIDEE:
            return self

        if self.statut == self.Statut.REJETEE:
            raise ValidationError(
                {"statut": "Une procuration rejetée ne peut pas être validée."}
            )

        if self.statut == self.Statut.ANNULEE:
            raise ValidationError(
                {"statut": "Une procuration annulée ne peut pas être validée."}
            )

        with transaction.atomic():
            procuration = (
                AGProcuration.objects.select_for_update()
                .select_related("ag", "lot")
                .get(pk=self.pk)
            )

            if procuration.statut == procuration.Statut.VALIDEE:
                return procuration

            if procuration.statut in {
                procuration.Statut.REJETEE,
                procuration.Statut.ANNULEE,
            }:
                raise ValidationError(
                    {"statut": "Cette procuration ne peut plus être validée."}
                )

            procuration.statut = procuration.Statut.VALIDEE
            procuration.validated_by = (
                user if user and getattr(user, "is_authenticated", False) else None
            )
            procuration.validated_at = timezone.now()
            procuration.rejected_by = None
            procuration.rejected_at = None
            procuration.motif_rejet = ""
            procuration.save(
                update_fields=[
                    "statut",
                    "validated_by",
                    "validated_at",
                    "rejected_by",
                    "rejected_at",
                    "motif_rejet",
                    "updated_at",
                ]
            )

            presence, _ = PresenceLot.objects.get_or_create(
                ag=procuration.ag,
                lot=procuration.lot,
                defaults={
                    "present_ou_represente": True,
                    "representant_nom": procuration.mandataire_nom,
                    "commentaire": "Présence par procuration validée par le syndic.",
                },
            )

            presence.present_ou_represente = True
            presence.representant_nom = procuration.mandataire_nom
            presence.commentaire = "Présence par procuration validée par le syndic."
            presence.refresh_tantiemes()
            presence.save()

            return procuration

    def rejeter(self, *, user=None, motif: str = ""):
        if self.statut == self.Statut.VALIDEE:
            raise ValidationError(
                {"statut": "Une procuration validée ne peut pas être rejetée."}
            )

        if self.statut == self.Statut.ANNULEE:
            raise ValidationError(
                {"statut": "Une procuration annulée ne peut pas être rejetée."}
            )

        motif = str(motif or "").strip()

        if not motif:
            raise ValidationError({"motif_rejet": "Le motif de rejet est obligatoire."})

        self.statut = self.Statut.REJETEE
        self.rejected_by = user if user and getattr(user, "is_authenticated", False) else None
        self.rejected_at = timezone.now()
        self.validated_by = None
        self.validated_at = None
        self.motif_rejet = motif
        self.save(
            update_fields=[
                "statut",
                "rejected_by",
                "rejected_at",
                "validated_by",
                "validated_at",
                "motif_rejet",
                "updated_at",
            ]
        )

        return self

    def annuler(self, *, user=None):
        if self.statut == self.Statut.VALIDEE:
            raise ValidationError(
                {"statut": "Une procuration validée ne peut pas être annulée."}
            )

        if self.statut == self.Statut.ANNULEE:
            return self

        self.statut = self.Statut.ANNULEE
        self.save(update_fields=["statut", "updated_at"])
        return self


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

    SOURCE_CHOICES = [
        ("BACKOFFICE", "Back-office syndic"),
        ("ESPACE_COPROPRIETAIRE", "Espace copropriétaire"),
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

    # Traçabilité métier / juridique
    coproprietaire = models.ForeignKey(
        "owners.Coproprietaire",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="votes_ag",
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="votes_ag_created",
    )
    source = models.CharField(
        max_length=32,
        choices=SOURCE_CHOICES,
        default="BACKOFFICE",
    )
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True, default="")

    # Verrouillage du vote
    locked = models.BooleanField(default=False)
    locked_at = models.DateTimeField(null=True, blank=True)
    locked_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="votes_ag_locked",
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        # Un lot = un seul vote par résolution
        unique_together = ("resolution", "lot")
        indexes = [
            models.Index(fields=["resolution", "choix"]),
            models.Index(fields=["lot"]),
            models.Index(fields=["source"]),
            models.Index(fields=["created_by"]),
            models.Index(fields=["coproprietaire"]),
            models.Index(fields=["locked"]),
        ]

    def __str__(self):
        return f"Vote res={self.resolution_id} lot={self.lot_id} choix={self.choix}"

    def _get_db_instance(self):
        if not self.pk:
            return None
        return Vote.objects.filter(pk=self.pk).first()

    def clean(self):
        super().clean()

        db = self._get_db_instance()

        if db and db.locked:
            changed_fields = []

            fields_to_check = [
                "resolution_id",
                "lot_id",
                "choix",
                "tantiemes",
                "coproprietaire_id",
                "created_by_id",
                "source",
                "ip_address",
                "user_agent",
            ]

            for field_name in fields_to_check:
                if getattr(self, field_name) != getattr(db, field_name):
                    changed_fields.append(field_name)

            if changed_fields:
                raise ValidationError(
                    {
                        "locked": (
                            "Vote verrouillé : modification interdite "
                            f"({', '.join(changed_fields)})."
                        )
                    }
                )

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
        update_fields = kwargs.get("update_fields")

        if self.resolution_id and self.lot_id:
            if self.tantiemes is None or Decimal(str(self.tantiemes)) <= 0:
                self.refresh_tantiemes()

                if update_fields is not None:
                    update_fields = set(update_fields)
                    update_fields.add("tantiemes")
                    kwargs["update_fields"] = update_fields

        if self.locked and not self.locked_at:
            self.locked_at = timezone.now()

            if update_fields is not None:
                update_fields = set(update_fields)
                update_fields.add("locked_at")
                kwargs["update_fields"] = update_fields

        with transaction.atomic():
            self.full_clean()
            super().save(*args, **kwargs)