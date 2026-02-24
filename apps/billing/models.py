# apps/billing/models.py

from decimal import Decimal, ROUND_HALF_UP
import uuid

from django.core.exceptions import ValidationError
from django.core.validators import MinValueValidator
from django.db import models, transaction
from django.db.models import Q, F
from django.utils import timezone


# --- Helpers Decimal (cohérence arrondis) ---
DEC_0 = Decimal("0.00")
DEC_MIN_PAYMENT = Decimal("0.01")
DEC_2PLACES = Decimal("0.01")


def d2(value) -> Decimal:
    """Arrondi monétaire 2 décimales."""
    if value is None:
        return DEC_0
    if not isinstance(value, Decimal):
        value = Decimal(str(value))
    return value.quantize(DEC_2PLACES, rounding=ROUND_HALF_UP)


class Exercice(models.Model):
    copropriete = models.ForeignKey(
        "core.Copropriete",
        on_delete=models.CASCADE,
        related_name="exercices",
    )
    annee = models.PositiveIntegerField()
    date_debut = models.DateField()
    date_fin = models.DateField()
    actif = models.BooleanField(default=True)

    class Meta:
        unique_together = ("copropriete", "annee")
        ordering = ["-annee"]
        constraints = [
            # ✅ Un seul exercice actif par copropriété
            models.UniqueConstraint(
                fields=["copropriete"],
                condition=Q(actif=True),
                name="uniq_exercice_actif_par_copropriete",
            ),
        ]

    def __str__(self):
        return f"{self.copropriete} - {self.annee}"

    def clean(self):
        if self.date_debut and self.date_fin and self.date_fin < self.date_debut:
            raise ValidationError({"date_fin": "La date de fin doit être ≥ à la date de début."})


class CategorieCharge(models.Model):
    copropriete = models.ForeignKey(
        "core.Copropriete",
        on_delete=models.CASCADE,
        related_name="categories_charges",
    )
    code = models.CharField(max_length=20)
    libelle = models.CharField(max_length=100)
    active = models.BooleanField(default=True)

    class Meta:
        unique_together = ("copropriete", "code")
        ordering = ["code"]

    def __str__(self):
        return f"{self.code} - {self.libelle}"


class Charge(models.Model):
    exercice = models.ForeignKey(
        Exercice,
        on_delete=models.CASCADE,
        related_name="charges",
    )
    categorie = models.ForeignKey(
        CategorieCharge,
        on_delete=models.PROTECT,
        related_name="charges",
    )

    montant = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(DEC_0)],
    )
    description = models.TextField(blank=True)
    date_charge = models.DateField()
    reference = models.CharField(max_length=100, blank=True)

    class Meta:
        ordering = ["-date_charge"]

    def __str__(self):
        code = getattr(self.categorie, "code", "?")
        return f"{code} - {self.montant}"

    def clean(self):
        if self.montant is not None and self.montant < DEC_0:
            raise ValidationError({"montant": "Le montant ne peut pas être négatif."})

        # Cohérence exercice / date_charge
        if self.date_charge and self.exercice_id:
            # NB: self.exercice est accessible ici si l'objet est chargé; sinon Django chargera au besoin.
            if self.exercice.date_debut and self.date_charge < self.exercice.date_debut:
                raise ValidationError({"date_charge": "La date de charge est avant le début de l'exercice."})
            if self.exercice.date_fin and self.date_charge > self.exercice.date_fin:
                raise ValidationError({"date_charge": "La date de charge est après la fin de l'exercice."})


class AppelDeFonds(models.Model):
    TYPE_CHOIX = [
        ("PERIODIQUE", "Périodique"),
        ("EXCEPTIONNEL", "Exceptionnel"),
    ]

    exercice = models.ForeignKey(
        Exercice,
        on_delete=models.CASCADE,
        related_name="appels",
    )
    libelle = models.CharField(max_length=120)
    type_appel = models.CharField(max_length=20, choices=TYPE_CHOIX, default="PERIODIQUE")

    date_emission = models.DateField(auto_now_add=True)
    date_echeance = models.DateField()

    montant_total = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(DEC_0)],
    )

    tantieme_categorie = models.ForeignKey(
        "lots.TantiemeCategorie",
        on_delete=models.PROTECT,
        related_name="appels_de_fonds",
        null=True,
        blank=True,
    )

    genere = models.BooleanField(default=False)

    class Meta:
        ordering = ["-date_emission"]
        indexes = [
            models.Index(fields=["exercice", "date_echeance"]),
        ]

    def __str__(self):
        annee = getattr(self.exercice, "annee", "?")
        return f"{self.libelle} ({annee})"

    def clean(self):
        if self.date_echeance and self.date_emission and self.date_echeance < self.date_emission:
            raise ValidationError({"date_echeance": "La date d'échéance doit être ≥ à la date d'émission."})
        if self.montant_total is not None and self.montant_total < DEC_0:
            raise ValidationError({"montant_total": "Le montant total ne peut pas être négatif."})


class LigneAppelDeFonds(models.Model):
    STATUT_CHOIX = [
        ("IMPAYE", "Impayé"),
        ("PARTIEL", "Partiel"),
        ("PAYE", "Payé"),
    ]

    appel = models.ForeignKey(
        AppelDeFonds,
        on_delete=models.CASCADE,
        related_name="lignes",
    )
    lot = models.ForeignKey(
        "lots.Lot",
        on_delete=models.PROTECT,
        related_name="lignes_appels",
    )

    tantiemes = models.DecimalField(
        max_digits=10,
        decimal_places=4,
        validators=[MinValueValidator(Decimal("0.0000"))],
    )
    montant_du = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(DEC_0)],
    )
    montant_paye = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=DEC_0,
        validators=[MinValueValidator(DEC_0)],
    )

    statut = models.CharField(max_length=10, choices=STATUT_CHOIX, default="IMPAYE")

    class Meta:
        unique_together = ("appel", "lot")
        ordering = ["lot_id"]
        indexes = [
            models.Index(fields=["appel", "statut"]),
            models.Index(fields=["lot", "statut"]),
        ]
        constraints = [
            # ✅ DB constraint : montant_paye <= montant_du
            # ⚠️ IMPORTANT: sur ta version Django, l'argument s'appelle "condition" (pas "check")
            models.CheckConstraint(
                condition=Q(montant_paye__gte=DEC_0) & Q(montant_paye__lte=F("montant_du")),
                name="chk_ligne_montant_paye_lte_montant_du",
            ),
        ]

    def __str__(self):
        return f"Ligne {self.lot} - {self.montant_du}"

    def clean(self):
        if self.montant_paye is not None and self.montant_paye < DEC_0:
            raise ValidationError({"montant_paye": "Le montant payé ne peut pas être négatif."})
        if self.montant_du is not None and self.montant_du < DEC_0:
            raise ValidationError({"montant_du": "Le montant dû ne peut pas être négatif."})

        if self.montant_paye is not None and self.montant_du is not None:
            if self.montant_paye > self.montant_du:
                raise ValidationError({"montant_paye": "Le montant payé ne peut pas dépasser le montant dû."})

    def recalcul_statut(self):
        du = d2(self.montant_du)
        paye = d2(self.montant_paye)

        if paye <= DEC_0:
            self.statut = "IMPAYE"
        elif paye < du:
            self.statut = "PARTIEL"
        else:
            self.statut = "PAYE"

    def reste_a_payer(self) -> Decimal:
        return d2(d2(self.montant_du) - d2(self.montant_paye))


class PaiementAppel(models.Model):
    MODE_CHOIX = [
        ("ESPECES", "Espèces"),
        ("VIREMENT", "Virement"),
        ("CHEQUE", "Chèque"),
        ("MOBILE_MONEY", "Mobile Money"),
        ("CARTE", "Carte"),
        ("AUTRE", "Autre"),
    ]

    ligne = models.ForeignKey(
        "LigneAppelDeFonds",
        on_delete=models.CASCADE,
        related_name="paiements",
    )
    date_paiement = models.DateTimeField(default=timezone.now)

    montant = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        validators=[MinValueValidator(DEC_MIN_PAYMENT)],
    )
    mode = models.CharField(max_length=20, choices=MODE_CHOIX, default="VIREMENT")

    reference = models.CharField(max_length=120, blank=True, db_index=True)
    commentaire = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-date_paiement", "-id"]
        constraints = [
            models.UniqueConstraint(
                fields=["ligne", "reference"],
                condition=~Q(reference=""),
                name="uniq_paiement_reference_par_ligne",
            ),
        ]
        indexes = [
            models.Index(fields=["ligne", "date_paiement"]),
        ]

    def __str__(self):
        return f"Paiement {self.montant} sur ligne {self.ligne_id}"

    def clean(self):
        # ✅ Normalisation reference (évite doublons visuels)
        if self.reference:
            self.reference = self.reference.strip().upper()

        # ✅ Interdit paiements datés dans le futur (comparaison timezone-aware)
        if self.date_paiement:
            now = timezone.now()
            if timezone.is_naive(self.date_paiement):
                # On rend "aware" dans le timezone courant pour comparer sans crash
                self.date_paiement = timezone.make_aware(self.date_paiement, timezone.get_current_timezone())
            if self.date_paiement > now:
                raise ValidationError({"date_paiement": "La date de paiement ne peut pas être dans le futur."})

        if self.montant is None:
            raise ValidationError({"montant": "Montant obligatoire."})
        if self.montant < DEC_MIN_PAYMENT:
            raise ValidationError({"montant": f"Le montant doit être ≥ {DEC_MIN_PAYMENT}."})

    def _recalcul_ligne_et_relances(self, ligne: "LigneAppelDeFonds"):
        """Recalcule montant_paye/statut + met relances à REGLE si soldé."""
        total_paye = (
            type(self).objects.filter(ligne_id=ligne.pk)
            .aggregate(total=models.Sum("montant"))
            .get("total")
        ) or DEC_0

        total_paye = d2(total_paye)
        montant_du = d2(ligne.montant_du)

        # ✅ Anti-incohérence : montant_paye ne dépasse jamais montant_du
        ligne.montant_paye = min(total_paye, montant_du)
        ligne.recalcul_statut()
        ligne.save(update_fields=["montant_paye", "statut"])

        if ligne.statut == "PAYE":
            RelanceLot.objects.filter(
                lot_id=ligne.lot_id,
                appel_id=ligne.appel_id,
            ).exclude(statut="REGLE").update(statut="REGLE")

    def save(self, *args, **kwargs):
        """
        1) Anti-dépassement
        2) Anti-paiement sur ligne soldée
        3) Concurrence-safe (select_for_update)
        4) Update-safe (exclude self)
        5) Recalcule ligne + statut
        6) Si PAYE -> relances => REGLE
        """
        with transaction.atomic():
            self.full_clean()

            ligne = (
                LigneAppelDeFonds.objects.select_for_update()
                .select_related("lot", "appel")
                .get(pk=self.ligne_id)
            )

            qs = type(self).objects.filter(ligne_id=self.ligne_id)
            if self.pk:
                qs = qs.exclude(pk=self.pk)

            total_paye_autres = qs.aggregate(total=models.Sum("montant")).get("total") or DEC_0
            total_paye_autres = d2(total_paye_autres)

            reste = d2(d2(ligne.montant_du) - total_paye_autres)

            if reste <= DEC_0:
                raise ValidationError({"montant": "Cette ligne est déjà soldée. Aucun nouveau paiement n'est accepté."})

            montant = d2(self.montant)

            if montant > reste:
                raise ValidationError(
                    {"montant": f"Montant trop élevé. Reste à payer: {reste} (montant_du={d2(ligne.montant_du)})."}
                )

            super().save(*args, **kwargs)
            self._recalcul_ligne_et_relances(ligne)

    def delete(self, *args, **kwargs):
        """Si tu supprimes un paiement, il faut recalculer la ligne."""
        with transaction.atomic():
            ligne = LigneAppelDeFonds.objects.select_for_update().get(pk=self.ligne_id)

            result = super().delete(*args, **kwargs)
            self._recalcul_ligne_et_relances(ligne)
            return result


class RelanceLot(models.Model):
    CANAL_CHOIX = [
        ("WHATSAPP", "WhatsApp"),
        ("EMAIL", "Email"),
        ("APPEL", "Appel"),
        ("AUTRE", "Autre"),
    ]

    STATUT_CHOIX = [
        ("ENVOYEE", "Envoyée"),
        ("ECHEC", "Échec"),
        ("REPONSE", "Réponse"),
        ("REGLE", "Réglé"),
    ]

    numero = models.CharField(
        max_length=20,
        unique=True,
        null=True,
        blank=True,
        db_index=True,
    )

    lot = models.ForeignKey(
        "lots.Lot",
        on_delete=models.CASCADE,
        related_name="relances_charges",
    )

    appel = models.ForeignKey(
        "AppelDeFonds",
        on_delete=models.PROTECT,
        related_name="relances",
    )

    canal = models.CharField(max_length=20, choices=CANAL_CHOIX, default="WHATSAPP")
    statut = models.CharField(max_length=20, choices=STATUT_CHOIX, default="ENVOYEE")

    message = models.TextField()
    reference_externe = models.CharField(max_length=120, blank=True)

    qr_token = models.UUIDField(default=uuid.uuid4, editable=False, unique=True)
    qr_token_created_at = models.DateTimeField(default=timezone.now, editable=False)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at", "-id"]
        indexes = [
            models.Index(fields=["lot", "appel", "created_at"]),
            models.Index(fields=["statut", "created_at"]),
            models.Index(fields=["qr_token"]),
        ]
        constraints = [
            # ✅ Empêche doublons RelanceLot sur (lot, appel)
            models.UniqueConstraint(
                fields=["lot", "appel"],
                name="uniq_relance_lot_appel",
            ),
        ]

    def __str__(self):
        return (
            f"Relance {self.numero or self.id} lot={self.lot_id} "
            f"appel={self.appel_id} canal={self.canal} statut={self.statut}"
        )

    def save(self, *args, **kwargs):
        """
        Génère automatiquement un numéro de relance:
        RL-YYYY-00001 (basé sur l'id pour garantir l'unicité)
        """
        if self.numero:
            return super().save(*args, **kwargs)

        result = super().save(*args, **kwargs)

        year = (self.created_at.year if self.created_at else timezone.now().year)
        numero = f"RL-{year}-{self.pk:05d}"

        type(self).objects.filter(pk=self.pk).update(numero=numero)
        self.numero = numero
        return result