from django.contrib import admin
from .models import Lot, TantiemeCategorie, LotTantieme


@admin.register(Lot)
class LotAdmin(admin.ModelAdmin):
    list_display = ("id", "reference", "type_lot", "copropriete", "actif", "created_at")
    list_filter = ("copropriete", "type_lot", "actif")
    search_fields = ("reference", "description", "etage")


@admin.register(TantiemeCategorie)
class TantiemeCategorieAdmin(admin.ModelAdmin):
    list_display = ("id", "code", "libelle", "copropriete", "actif")
    list_filter = ("copropriete", "actif")
    search_fields = ("code", "libelle")


@admin.register(LotTantieme)
class LotTantiemeAdmin(admin.ModelAdmin):
    list_display = ("id", "lot", "categorie", "valeur")
    list_filter = ("categorie", "lot__copropriete")
    search_fields = ("lot__reference", "categorie__code", "categorie__libelle")