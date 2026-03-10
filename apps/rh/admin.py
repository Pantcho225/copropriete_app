# apps/rh/admin.py
from django.contrib import admin

from .models import Employe, ContratEmploye


@admin.register(Employe)
class EmployeAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "copropriete",
        "nom",
        "prenoms",
        "role",
        "telephone",
        "statut",
        "date_embauche",
    )
    list_filter = ("copropriete", "role", "statut")
    search_fields = ("nom", "prenoms", "telephone", "email", "role_libre")
    ordering = ("nom", "prenoms", "id")
    autocomplete_fields = ("copropriete",)


@admin.register(ContratEmploye)
class ContratEmployeAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "employe",
        "type_contrat",
        "date_debut",
        "date_fin",
        "salaire_mensuel",
        "statut",
    )
    list_filter = ("type_contrat", "statut", "employe__copropriete")
    search_fields = (
        "employe__nom",
        "employe__prenoms",
        "type_contrat_libre",
        "notes",
    )
    ordering = ("-date_debut", "-id")
    autocomplete_fields = ("employe",)