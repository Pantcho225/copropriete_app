# apps/documents/admin.py
from django.contrib import admin

from .models import (
    AdministrativeDocument,
    AdministrativeDocumentCategory,
    DocumentMasqueCoproprietaire,
    GeneratedDocument,
    ReglementTexteApplicable,
)


@admin.register(GeneratedDocument)
class GeneratedDocumentAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "reference",
        "document_type",
        "title",
        "copropriete",
        "related_owner",
        "related_lot",
        "related_ag",
        "is_visible_to_owner",
        "status",
        "created_at",
    )
    list_filter = (
        "document_type",
        "status",
        "is_visible_to_owner",
        "created_at",
    )
    search_fields = (
        "reference",
        "title",
        "related_owner__nom",
        "related_owner__prenom",
        "related_lot__reference",
        "related_lot__numero",
    )
    readonly_fields = (
        "reference",
        "file_hash",
        "created_at",
        "updated_at",
    )


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

@admin.register(AdministrativeDocumentCategory)
class AdministrativeDocumentCategoryAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "name",
        "code",
        "copropriete",
        "is_active",
        "order",
        "created_at",
    )
    list_filter = ("is_active", "created_at")
    search_fields = ("name", "code", "description", "copropriete__nom")
    readonly_fields = ("created_at", "updated_at")


@admin.register(AdministrativeDocument)
class AdministrativeDocumentAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "title",
        "category",
        "copropriete",
        "visible_to_coproprietaires",
        "published_at",
        "created_at",
    )
    list_filter = (
        "visible_to_coproprietaires",
        "category",
        "created_at",
        "published_at",
    )
    search_fields = (
        "title",
        "reference",
        "description",
        "original_filename",
        "category__name",
        "copropriete__nom",
    )
    readonly_fields = (
        "original_filename",
        "mime_type",
        "size_bytes",
        "published_at",
        "created_at",
        "updated_at",
    )
