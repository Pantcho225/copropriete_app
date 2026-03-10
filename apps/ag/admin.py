from django.contrib import admin

from .models import AssembleeGenerale, PresenceLot, Resolution, Vote


@admin.register(AssembleeGenerale)
class AssembleeGeneraleAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "copropriete",
        "titre",
        "date_ag",
        "statut",
        "pv_locked",
        "closed_at",
        "created_at",
    )
    list_filter = (
        "statut",
        "pv_locked",
        "date_ag",
        "copropriete",
        "exercice",
    )
    search_fields = (
        "titre",
        "lieu",
        "president_nom",
        "secretaire_nom",
        "pv_signer_subject",
    )
    readonly_fields = (
        "created_at",
        "updated_at",
        "closed_at",
        "pv_generated_at",
        "pv_signed_at",
        "pv_pdf_hash",
        "pv_signed_hash",
    )
    fieldsets = (
        (
            "Informations générales",
            {
                "fields": (
                    "copropriete",
                    "exercice",
                    "titre",
                    "date_ag",
                    "lieu",
                    "statut",
                )
            },
        ),
        (
            "Clôture administrative",
            {
                "fields": (
                    "closed_at",
                    "closed_by",
                )
            },
        ),
        (
            "PV archivé",
            {
                "fields": (
                    "pv_pdf",
                    "pv_pdf_hash",
                    "pv_generated_at",
                    "pv_locked",
                )
            },
        ),
        (
            "PV signé",
            {
                "fields": (
                    "pv_signed_pdf",
                    "pv_signed_hash",
                    "pv_signed_at",
                    "pv_signer_subject",
                )
            },
        ),
        (
            "Signatures visuelles",
            {
                "fields": (
                    "president_nom",
                    "secretaire_nom",
                    "signature_president",
                    "signature_secretaire",
                    "cachet_image",
                )
            },
        ),
        (
            "Audit",
            {
                "fields": (
                    "created_at",
                    "updated_at",
                )
            },
        ),
    )


@admin.register(PresenceLot)
class PresenceLotAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "ag",
        "lot",
        "tantiemes",
        "present_ou_represente",
        "representant_nom",
    )
    list_filter = (
        "present_ou_represente",
        "ag",
    )
    search_fields = (
        "representant_nom",
        "commentaire",
    )


@admin.register(Resolution)
class ResolutionAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "ag",
        "ordre",
        "titre",
        "type_majorite",
        "travaux_dossier",
        "budget_vote",
        "cloturee",
    )
    list_filter = (
        "type_majorite",
        "cloturee",
        "ag",
    )
    search_fields = (
        "titre",
        "texte",
    )


@admin.register(Vote)
class VoteAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "resolution",
        "lot",
        "choix",
        "tantiemes",
        "created_at",
    )
    list_filter = (
        "choix",
        "resolution",
    )
    readonly_fields = ("created_at",)