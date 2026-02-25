# apps/ag/models.py
from decimal import Decimal

from django.conf import settings
from django.core.exceptions import ValidationError
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

    statut = models.CharField(max_length=20, choices=STATUT_CHOICES, default="BROUILLON")

    # ✅ Phase 2.4 — clôture administrative (audit)
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

    # =========================
    # ✅ Phase 2.2 — PV PDF : archivage + immutabilité
    # =========================
    pv_pdf = models.FileField(upload_to="ag/pv/", null=True, blank=True)
    pv_pdf_hash = models.CharField(max_length=64, blank=True, default="")  # sha256
    pv_generated_at = models.DateTimeField(null=True, blank=True)
    pv_locked = models.BooleanField(default=False)

    # =========================
    # ✅ Phase 2.3 — Signature PAdES réelle (pyHanko)
    # =========================
    pv_signed_pdf = models.FileField(upload_to="ag/pv_signed/", null=True, blank=True)
    pv_signed_hash = models.CharField(max_length=64, blank=True, default="")  # sha256 du PDF signé
    pv_signed_at = models.DateTimeField(null=True, blank=True)
    pv_signer_subject = models.CharField(max_length=255, blank=True, default="")  # CN/Subject certificat

    # =========================
    # ✅ Phase 2.2 — Signatures visuelles (images)
    # =========================
    president_nom = models.CharField(max_length=120, blank=True, default="")
    secretaire_nom = models.CharField(max_length=120, blank=True, default="")

    signature_president = models.ImageField(upload_to="ag/signatures/", null=True, blank=True)
    signature_secretaire = models.ImageField(upload_to="ag/signatures/", null=True, blank=True)

    # Optionnel (cachet / tampon)
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
    # Helpers Phase 2.4
    # -------------------------
    def is_closed(self) -> bool:
        return self.statut == "CLOTUREE"

    def is_immutable(self) -> bool:
        # immutabilité "forte" : PV verrouillé OU AG clôturée
        return bool(self.pv_locked) or self.is_closed()

    def ensure_writable(self, *, reason: str = "AG") -> None:
        """
        Rempart métier central : empêche toute écriture si AG clôturée (Phase 2.4)
        ou si PV verrouillé (Phase 2.2/2.3).
        """
        if self.is_closed():
            raise ValidationError({"ag": f"{reason} clôturée : modification interdite."})
        if self.pv_locked:
            raise ValidationError({"ag": f"PV verrouillé : modification interdite ({reason})."})

    def clean(self):
        # cohérence exercice/copro
        if self.exercice_id:
            # self.exercice peut être None si pas chargé : Django garantit l'accès via self.exercice
            if self.exercice and self.exercice.copropriete_id != self.copropriete_id:
                raise ValidationError({"exercice": "L'exercice doit appartenir à la même copropriété."})

        # ✅ cohérence clôture (tu peux durcir si tu veux)
        if self.statut == "CLOTUREE":
            # conseillé : closed_at/closed_by, mais on ne force pas ici (ça dépend de ta politique)
            pass

    def _get_db_instance(self):
        if not self.pk:
            return None
        # On lit l'instance DB (comparaison de champs)
        return AssembleeGenerale.objects.filter(pk=self.pk).first()

    @staticmethod
    def _file_name(f) -> str:
        return getattr(f, "name", "") or ""

    @staticmethod
    def _normalize_field_name(field_name: str) -> str:
        """
        ✅ Fix robuste : Django expose souvent les FK sous forme `xxx_id`.
        On normalise `closed_by_id` -> `closed_by` pour matcher la whitelist.
        """
        if field_name.endswith("_id"):
            return field_name[:-3]
        return field_name

    def save(self, *args, **kwargs):
        """
        ✅ Immutabilité intelligente :
        - Si pv_locked=True en base OU statut=CLOTUREE, on interdit les modifications,
          sauf champs autorisés (signature + lock + clôture).
        """
        db = self._get_db_instance()

        # NOTE : on se base sur l'état DB (db.pv_locked / db.statut)
        if db and (db.pv_locked or db.statut == "CLOTUREE"):
            allowed_when_locked_or_closed = {
                # lock / signature (Phase 2.3)
                "pv_locked",
                "pv_signed_pdf",
                "pv_signed_hash",
                "pv_signed_at",
                "pv_signer_subject",
                # clôture (Phase 2.4)
                "statut",
                "closed_at",
                "closed_by",  # ✅ whitelist au format relation
                # (closed_by_id sera normalisé vers closed_by)
            }

            changed = set()

            # Champs "simples" (comparaison directe)
            simple_fields = [
                "copropriete_id",
                "exercice_id",
                "titre",
                "date_ag",
                "lieu",
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
                "closed_by_id",  # ✅ volontaire : on détecte le changement, puis on normalise
            ]
            for field in simple_fields:
                if getattr(self, field) != getattr(db, field):
                    changed.add(field)

            # Champs fichiers (comparaison sur name)
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

            # ✅ NORMALISATION : closed_by_id -> closed_by (et tous *_id)
            normalized_changed = {self._normalize_field_name(c) for c in changed}

            forbidden = {c for c in normalized_changed if c not in allowed_when_locked_or_closed}
            if forbidden:
                raise ValidationError(
                    {"pv_locked": f"AG immuable : modification interdite ({', '.join(sorted(forbidden))})."}
                )

        self.full_clean()
        super().save(*args, **kwargs)

    # -------------------------
    # Phase 2.2 / 2.3 existants
    # -------------------------
    def lock_pv(self):
        """Verrouille le PV (plus d’écrasement/régénération côté API)."""
        if not self.pv_pdf:
            raise ValidationError({"pv_pdf": "Impossible de verrouiller : PV non archivé."})
        if not self.pv_locked:
            self.pv_locked = True
            self.save(update_fields=["pv_locked"])

    def mark_signed(self, *, signed_pdf_file, signed_hash: str, signer_subject: str):
        """
        Helper pratique : après signature PAdES, enregistrer le PDF signé + hash + subject,
        et verrouiller.
        """
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
    # ✅ Phase 2.4 — clôture définitive
    # -------------------------
    def can_be_closed(self) -> None:
        """
        Conditions minimales Phase 2.4.
        Tu peux durcir (ex: exiger quorum, au moins 1 résolution, etc.).
        """
        if self.statut == "ANNULEE":
            raise ValidationError({"statut": "Impossible de clôturer une AG annulée."})

        # Doit être signée/verrouillée (juridique)
        if not self.pv_signed_pdf or not self.pv_signed_hash or not self.pv_signed_at:
            raise ValidationError({"pv_signed_pdf": "PV signé obligatoire avant clôture."})

        if not self.pv_locked:
            raise ValidationError({"pv_locked": "PV doit être verrouillé avant clôture."})

        # Option recommandé : quorum atteint
        if not self.quorum_atteint():
            raise ValidationError({"ag": "Quorum non atteint : clôture interdite."})

        # Option : au moins 1 résolution
        if not self.resolutions.exists():
            raise ValidationError({"resolutions": "Aucune résolution : clôture interdite."})

    def close(self, *, user=None) -> "AssembleeGenerale":
        """
        Clôture transactionnelle : à appeler depuis l'endpoint POST /close/
        """
        with transaction.atomic():
            ag = AssembleeGenerale.objects.select_for_update().get(pk=self.pk)

            if ag.statut == "CLOTUREE":
                return ag  # idempotent

            ag.can_be_closed()

            ag.statut = "CLOTUREE"
            ag.closed_at = timezone.now()
            ag.closed_by = user if user and getattr(user, "is_authenticated", False) else None

            # on sécurise : clôture => lock (si jamais)
            ag.pv_locked = True

            # ✅ update_fields pour éviter des writes inutiles
            ag.save(update_fields=["statut", "closed_at", "closed_by", "pv_locked"])
            return ag

    # -------------------------
    # Quorum / tantièmes
    # -------------------------
    def total_tantiemes_copro(self) -> Decimal:
        from apps.lots.models import LotTantieme

        total = (
            LotTantieme.objects
            .filter(lot__copropriete_id=self.copropriete_id)
            .aggregate(total=Sum("valeur"))
            .get("total")
        ) or DEC0
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
        if self.lot_id and self.ag_id:
            if self.lot.copropriete_id != self.ag.copropriete_id:
                raise ValidationError({"lot": "Le lot doit appartenir à la copropriété de l'AG."})

        # ✅ Phase 2.4 : si clôturée/verrouillée => interdit
        if self.ag_id:
            if self.ag.is_closed():
                raise ValidationError({"ag": "AG clôturée : modification des présences interdite."})
            if self.ag.pv_locked:
                raise ValidationError({"ag": "PV verrouillé : modification des présences interdite."})

    def save(self, *args, **kwargs):
        if (self.tantiemes is None) or (Decimal(str(self.tantiemes)) <= 0):
            from apps.lots.models import LotTantieme
            total = (
                LotTantieme.objects
                .filter(lot_id=self.lot_id)
                .aggregate(total=Sum("valeur"))
                .get("total")
            ) or DEC0
            self.tantiemes = total

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

    tantieme_categorie = models.ForeignKey(
        "lots.TantiemeCategorie",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="resolutions",
    )

    cloturee = models.BooleanField(default=False)

    class Meta:
        unique_together = ("ag", "ordre")
        ordering = ["ag_id", "ordre"]
        indexes = [
            models.Index(fields=["ag", "ordre"]),
        ]

    def __str__(self):
        return f"Résolution {self.ag_id}-{self.ordre} {self.titre}"

    def clean(self):
        if self.ag_id:
            if self.ag.is_closed():
                raise ValidationError({"ag": "AG clôturée : modification des résolutions interdite."})
            if self.ag.pv_locked:
                raise ValidationError({"ag": "PV verrouillé : modification des résolutions interdite."})


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
        unique_together = ("resolution", "lot")
        indexes = [
            models.Index(fields=["resolution", "choix"]),
        ]

    def clean(self):
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
            ok = PresenceLot.objects.filter(
                ag_id=self.resolution.ag_id,
                lot_id=self.lot_id,
                present_ou_represente=True,
            ).exists()
            if not ok:
                raise ValidationError({"lot": "Ce lot n'est pas présent/représenté pour cette AG."})

    def save(self, *args, **kwargs):
        if (self.tantiemes is None) or (Decimal(str(self.tantiemes)) <= 0):
            from apps.lots.models import LotTantieme

            cat = self.resolution.tantieme_categorie_id
            qs = LotTantieme.objects.filter(lot_id=self.lot_id)
            if cat:
                qs = qs.filter(categorie_id=cat)

            total = qs.aggregate(total=Sum("valeur")).get("total") or DEC0
            self.tantiemes = total

        with transaction.atomic():
            self.full_clean()
            super().save(*args, **kwargs)