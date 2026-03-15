from __future__ import annotations

from django.contrib import admin

from .models import AvisRegularisation, DossierImpaye, Relance


@admin.register(DossierImpaye)
class DossierImpayeAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "copropriete",
        "lot",
        "coproprietaire",
        "appel",
        "statut",
        "montant_initial",
        "montant_paye",
        "reste_a_payer",
        "niveau_relance",
        "est_regularise",
        "date_echeance",
        "updated_at",
    )
    list_filter = (
        "copropriete",
        "statut",
        "est_regularise",
        "auto_relance_active",
        "date_echeance",
    )
    search_fields = (
        "reference_appel",
        "lot__numero",
        "lot__reference",
    )
    readonly_fields = ("created_at", "updated_at", "regularise_at")
    autocomplete_fields = ("copropriete", "lot")


@admin.register(Relance)
class RelanceAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "copropriete",
        "dossier",
        "appel",
        "lot",
        "canal",
        "statut",
        "niveau",
        "date_envoi",
        "envoye_par",
    )
    list_filter = (
        "copropriete",
        "canal",
        "statut",
        "niveau",
        "date_envoi",
    )
    search_fields = (
        "objet",
        "message",
        "lot__numero",
    )
    readonly_fields = ("created_at", "updated_at", "date_envoi", "annulee_at", "date_echec")
    autocomplete_fields = (
        "copropriete",
        "dossier",
        "lot",
        "envoye_par",
        "annulee_par",
    )


@admin.register(AvisRegularisation)
class AvisRegularisationAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "copropriete",
        "dossier",
        "appel",
        "lot",
        "statut",
        "canal",
        "montant_initial",
        "montant_total_regle",
        "date_regularisation",
        "envoye_at",
    )
    list_filter = (
        "copropriete",
        "statut",
        "canal",
        "date_regularisation",
    )
    search_fields = (
        "message",
        "lot__numero",
    )
    readonly_fields = ("created_at", "updated_at", "envoye_at")
    autocomplete_fields = (
        "copropriete",
        "dossier",
        "lot",
        "genere_par",
    )