from django.contrib import admin

from .models import (
    ReunionAction,
    ReunionDocument,
    ReunionParticipant,
    ReunionRencontre,
)


class ReunionParticipantInline(admin.TabularInline):
    model = ReunionParticipant
    extra = 0


class ReunionDocumentInline(admin.TabularInline):
    model = ReunionDocument
    extra = 0


class ReunionActionInline(admin.TabularInline):
    model = ReunionAction
    extra = 0


@admin.register(ReunionRencontre)
class ReunionRencontreAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "titre",
        "type",
        "statut",
        "copropriete",
        "date_debut",
        "visible_coproprietaire",
        "date_publication",
    )
    list_filter = (
        "type",
        "statut",
        "visible_coproprietaire",
        "date_debut",
        "created_at",
    )
    search_fields = (
        "titre",
        "reference",
        "objet",
        "description",
        "lieu",
        "copropriete__nom",
    )
    readonly_fields = (
        "date_publication",
        "created_at",
        "updated_at",
    )
    inlines = [
        ReunionParticipantInline,
        ReunionDocumentInline,
        ReunionActionInline,
    ]


@admin.register(ReunionParticipant)
class ReunionParticipantAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "nom_complet",
        "type",
        "reunion",
        "organisation",
        "fonction",
        "present",
    )
    list_filter = ("type", "present", "created_at")
    search_fields = (
        "nom_complet",
        "organisation",
        "fonction",
        "email",
        "telephone",
        "reunion__titre",
    )


@admin.register(ReunionDocument)
class ReunionDocumentAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "titre",
        "type",
        "reunion",
        "visible_coproprietaire",
        "created_at",
    )
    list_filter = ("type", "visible_coproprietaire", "created_at")
    search_fields = (
        "titre",
        "description",
        "nom_fichier_original",
        "reunion__titre",
    )
    readonly_fields = (
        "nom_fichier_original",
        "mime_type",
        "taille_octets",
        "created_at",
        "updated_at",
    )


@admin.register(ReunionAction)
class ReunionActionAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "titre",
        "reunion",
        "statut",
        "priorite",
        "responsable_nom",
        "echeance",
    )
    list_filter = ("statut", "priorite", "echeance", "created_at")
    search_fields = (
        "titre",
        "description",
        "responsable_nom",
        "reunion__titre",
    )
    readonly_fields = (
        "date_cloture",
        "created_at",
        "updated_at",
    )
