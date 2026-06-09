# apps/ag/admin.py
from django.contrib import admin

from .models import (
    AGProcuration,
    AgConvocation,
    AssembleeGenerale,
    PresenceLot,
    Resolution,
    Vote,
)


@admin.register(AssembleeGenerale)
class AssembleeGeneraleAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "copropriete",
        "titre",
        "date_ag",
        "tantieme_categorie",
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
        "tantieme_categorie",
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
                    "tantieme_categorie",
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


@admin.register(AgConvocation)
class AgConvocationAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "reference",
        "ag",
        "copropriete",
        "coproprietaire",
        "lot",
        "statut",
        "canal",
        "generated_at",
        "sent_at",
        "consulted_at",
        "cancelled_at",
        "created_at",
    )
    list_filter = (
        "statut",
        "canal",
        "copropriete",
        "ag",
        "generated_at",
        "sent_at",
        "consulted_at",
        "cancelled_at",
    )
    search_fields = (
        "reference",
        "objet",
        "message",
        "coproprietaire__nom",
        "coproprietaire__prenom",
        "coproprietaire__email",
        "lot__numero",
        "lot__batiment",
        "ag__titre",
    )
    readonly_fields = (
        "reference",
        "generated_at",
        "sent_at",
        "consulted_at",
        "cancelled_at",
        "created_at",
        "updated_at",
    )
    raw_id_fields = (
        "ag",
        "copropriete",
        "coproprietaire",
        "lot",
        "document",
        "generated_by",
        "sent_by",
        "cancelled_by",
    )
    fieldsets = (
        (
            "Convocation",
            {
                "fields": (
                    "reference",
                    "ag",
                    "copropriete",
                    "coproprietaire",
                    "lot",
                    "document",
                )
            },
        ),
        (
            "Statut et canal",
            {
                "fields": (
                    "statut",
                    "canal",
                    "objet",
                    "message",
                )
            },
        ),
        (
            "Traçabilité",
            {
                "fields": (
                    "generated_at",
                    "generated_by",
                    "sent_at",
                    "sent_by",
                    "consulted_at",
                    "cancelled_at",
                    "cancelled_by",
                    "cancellation_reason",
                )
            },
        ),
        (
            "Métadonnées",
            {
                "fields": (
                    "metadata",
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
        "lot__numero",
        "lot__batiment",
        "ag__titre",
    )
    raw_id_fields = (
        "ag",
        "lot",
    )


@admin.register(AGProcuration)
class AGProcurationAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "ag",
        "coproprietaire",
        "lot",
        "mandataire_nom",
        "statut",
        "validated_at",
        "rejected_at",
        "created_at",
    )
    list_filter = (
        "statut",
        "ag",
        "created_at",
        "validated_at",
        "rejected_at",
    )
    search_fields = (
        "mandataire_nom",
        "mandataire_telephone",
        "mandataire_email",
        "motif_rejet",
        "coproprietaire__nom",
        "coproprietaire__prenom",
        "coproprietaire__email",
        "lot__numero",
        "lot__batiment",
        "ag__titre",
    )
    readonly_fields = (
        "validated_at",
        "rejected_at",
        "created_at",
        "updated_at",
    )
    raw_id_fields = (
        "ag",
        "coproprietaire",
        "lot",
        "document",
        "created_by",
        "validated_by",
        "rejected_by",
    )
    fieldsets = (
        (
            "Procuration",
            {
                "fields": (
                    "ag",
                    "coproprietaire",
                    "lot",
                    "mandataire_nom",
                    "mandataire_telephone",
                    "mandataire_email",
                    "document",
                )
            },
        ),
        (
            "Statut",
            {
                "fields": (
                    "statut",
                    "motif_rejet",
                )
            },
        ),
        (
            "Validation / rejet",
            {
                "fields": (
                    "created_by",
                    "validated_by",
                    "validated_at",
                    "rejected_by",
                    "rejected_at",
                )
            },
        ),
        (
            "Traçabilité technique",
            {
                "fields": (
                    "ip_address",
                    "user_agent",
                    "created_at",
                    "updated_at",
                )
            },
        ),
    )


@admin.register(Resolution)
class ResolutionAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "ag",
        "ordre",
        "titre",
        "type_majorite",
        "tantieme_categorie",
        "travaux_dossier",
        "budget_vote",
        "cloturee",
    )
    list_filter = (
        "type_majorite",
        "cloturee",
        "ag",
        "tantieme_categorie",
    )
    search_fields = (
        "titre",
        "texte",
        "ag__titre",
    )
    raw_id_fields = (
        "ag",
        "tantieme_categorie",
        "travaux_dossier",
    )


@admin.register(Vote)
class VoteAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "resolution",
        "lot",
        "choix",
        "tantiemes",
        "coproprietaire",
        "source",
        "locked",
        "created_at",
    )
    list_filter = (
        "choix",
        "resolution",
        "source",
        "locked",
        "created_at",
    )
    search_fields = (
        "resolution__titre",
        "lot__numero",
        "lot__batiment",
        "coproprietaire__nom",
        "coproprietaire__prenom",
        "coproprietaire__email",
    )
    readonly_fields = (
        "created_at",
        "updated_at",
        "locked_at",
    )
    raw_id_fields = (
        "resolution",
        "lot",
        "coproprietaire",
        "created_by",
        "locked_by",
    )