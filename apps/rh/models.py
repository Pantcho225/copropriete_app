from decimal import Decimal

from django.core.exceptions import ValidationError
from django.core.validators import MinValueValidator
from django.db import models
from django.utils import timezone


DEC0 = Decimal("0.00")


class Employe(models.Model):
    STATUT_CHOICES = [
        ("ACTIF", "Actif"),
        ("INACTIF", "Inactif"),
        ("SUSPENDU", "Suspendu"),
    ]

    ROLE_CHOICES = [
        ("GARDIEN", "Gardien"),
        ("GARDIEN_NUIT", "Gardien de nuit"),
        ("AGENT_ENTRETIEN", "Agent d'entretien"),
        ("SYNDIC_LOCAL", "Syndic local"),
        ("AUTRE", "Autre"),
    ]

    copropriete = models.ForeignKey(
        "core.Copropriete",
        on_delete=models.CASCADE,
        related_name="employes",
    )

    nom = models.CharField(max_length=120)
    prenoms = models.CharField(max_length=160)

    role = models.CharField(max_length=30, choices=ROLE_CHOICES, default="AUTRE")
    role_libre = models.CharField(max_length=120, blank=True, default="")

    telephone = models.CharField(max_length=40, blank=True, default="")
    email = models.EmailField(blank=True, default="")

    date_embauche = models.DateField(null=True, blank=True)
    salaire_base = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
        validators=[MinValueValidator(DEC0)],
    )

    statut = models.CharField(max_length=20, choices=STATUT_CHOICES, default="ACTIF")
    notes = models.TextField(blank=True, default="")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["nom", "prenoms", "id"]
        indexes = [
            models.Index(fields=["copropriete", "statut"]),
            models.Index(fields=["copropriete", "role"]),
            models.Index(fields=["nom", "prenoms"]),
        ]

    def __str__(self):
        return f"{self.nom} {self.prenoms} ({self.get_role_display()})"

    @property
    def nom_complet(self) -> str:
        return f"{self.nom} {self.prenoms}".strip()

    def clean(self):
        if self.role == "AUTRE" and not self.role_libre.strip():
            raise ValidationError(
                {"role_libre": "Précisez le rôle libre lorsque le rôle est 'Autre'."}
            )

        if self.role != "AUTRE":
            self.role_libre = ""

        if self.salaire_base is not None and Decimal(str(self.salaire_base)) < DEC0:
            raise ValidationError({"salaire_base": "Le salaire de base ne peut pas être négatif."})

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)

    def activer(self):
        if self.statut != "ACTIF":
            self.statut = "ACTIF"
            self.save(update_fields=["statut", "updated_at"])

    def desactiver(self):
        if self.statut != "INACTIF":
            self.statut = "INACTIF"
            self.save(update_fields=["statut", "updated_at"])

    def suspendre(self):
        if self.statut != "SUSPENDU":
            self.statut = "SUSPENDU"
            self.save(update_fields=["statut", "updated_at"])


class ContratEmploye(models.Model):
    STATUT_CHOICES = [
        ("BROUILLON", "Brouillon"),
        ("ACTIF", "Actif"),
        ("TERMINE", "Terminé"),
        ("ROMPU", "Rompu"),
    ]

    TYPE_CONTRAT_CHOICES = [
        ("CDI", "CDI"),
        ("CDD", "CDD"),
        ("PRESTATION", "Prestation"),
        ("INTERIM", "Intérim"),
        ("AUTRE", "Autre"),
    ]

    employe = models.ForeignKey(
        Employe,
        on_delete=models.CASCADE,
        related_name="contrats",
    )

    type_contrat = models.CharField(max_length=20, choices=TYPE_CONTRAT_CHOICES, default="CDD")
    type_contrat_libre = models.CharField(max_length=120, blank=True, default="")

    date_debut = models.DateField()
    date_fin = models.DateField(null=True, blank=True)

    salaire_mensuel = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
        validators=[MinValueValidator(DEC0)],
    )

    statut = models.CharField(max_length=20, choices=STATUT_CHOICES, default="BROUILLON")
    notes = models.TextField(blank=True, default="")

    fichier_contrat = models.FileField(upload_to="rh/contrats/", null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-date_debut", "-id"]
        indexes = [
            models.Index(fields=["employe", "statut"]),
            models.Index(fields=["date_debut", "date_fin"]),
        ]

    def __str__(self):
        return f"Contrat {self.employe.nom_complet} - {self.type_contrat}"

    def clean(self):
        if self.type_contrat == "AUTRE" and not self.type_contrat_libre.strip():
            raise ValidationError(
                {"type_contrat_libre": "Précisez le type lorsque le contrat est 'Autre'."}
            )

        if self.type_contrat != "AUTRE":
            self.type_contrat_libre = ""

        if self.date_fin and self.date_fin < self.date_debut:
            raise ValidationError({"date_fin": "La date de fin doit être postérieure à la date de début."})

        if self.salaire_mensuel is not None and Decimal(str(self.salaire_mensuel)) < DEC0:
            raise ValidationError({"salaire_mensuel": "Le salaire mensuel ne peut pas être négatif."})

        if self.employe_id:
            if self.statut == "ACTIF" and self.employe.statut == "INACTIF":
                raise ValidationError(
                    {"statut": "Impossible d'activer un contrat pour un employé inactif."}
                )

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)

    @property
    def est_actif(self) -> bool:
        return self.statut == "ACTIF"

    def activer(self):
        if self.statut != "ACTIF":
            self.statut = "ACTIF"
            self.save(update_fields=["statut", "updated_at"])

    def cloturer(self):
        if self.statut != "TERMINE":
            self.statut = "TERMINE"
            if not self.date_fin:
                self.date_fin = timezone.now().date()
            self.save(update_fields=["statut", "date_fin", "updated_at"])