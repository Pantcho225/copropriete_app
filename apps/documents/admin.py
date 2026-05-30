# apps/documents/admin.py
from django.contrib import admin

from .models import DocumentMasqueCoproprietaire


@admin.register(DocumentMasqueCoproprietaire)
class DocumentMasqueCoproprietaireAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "user",
        "document_id",
        "categorie",
        "source",
        "hidden_at",
    )
    list_filter = ("categorie", "source", "hidden_at")
    search_fields = ("document_id", "titre", "user__username", "user__email")
    readonly_fields = ("hidden_at",)