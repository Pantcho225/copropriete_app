# TEMPORAIRE: admin désactivé le temps de corriger la structure des modèles

"""from django.contrib import admin
from .models import Lot, TantiemeCategorie, LotTantieme


@admin.register(Lot)
class LotAdmin(admin.ModelAdmin):
    list_display = ("id", "reference", "type_lot", "copropriete")
    list_filter = ("copropriete", "type_lot")
    search_fields = ("reference",)


@admin.register(TantiemeCategorie)
class TantiemeCategorieAdmin(admin.ModelAdmin):
    list_display = ("id", "code", "libelle", "copropriete", "actif")
    list_filter = ("copropriete", "actif")
    search_fields = ("code", "libelle")


@admin.register(LotTantieme)
class LotTantiemeAdmin(admin.ModelAdmin):
    list_display = ("id", "copropriete", "lot", "categorie", "valeur")
    list_filter = ("copropriete", "categorie")"""