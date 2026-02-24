from django.contrib import admin

from django.contrib import admin
from .models import Copropriete, CoproMembre


@admin.register(Copropriete)
class CoproprieteAdmin(admin.ModelAdmin):
    list_display = ("id", "nom", "ville", "pays", "created_at")
    search_fields = ("nom", "ville")


@admin.register(CoproMembre)
class CoproMembreAdmin(admin.ModelAdmin):
    list_display = ("id", "copropriete", "user", "role", "is_active", "created_at")
    list_filter = ("role", "is_active", "copropriete")
    search_fields = ("user__username", "user__email", "copropriete__nom")