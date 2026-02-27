from django.contrib import admin
from .models import Fournisseur, DossierTravaux


@admin.register(Fournisseur)
class FournisseurAdmin(admin.ModelAdmin):
    list_display = ("id", "copropriete", "nom", "is_active", "email", "telephone")
    list_filter = ("is_active", "copropriete")
    search_fields = ("nom", "email", "telephone", "identifiant")


@admin.register(DossierTravaux)
class DossierTravauxAdmin(admin.ModelAdmin):
    list_display = ("id", "copropriete", "titre", "statut", "budget_estime", "budget_vote", "locked_at")
    list_filter = ("statut", "copropriete")
    search_fields = ("titre",)