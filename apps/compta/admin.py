# apps/compta/admin.py
from __future__ import annotations

from django.contrib import admin
from django.urls import reverse
from django.utils.html import format_html
from django.utils.safestring import mark_safe

from .models import (
    CompteBancaire,
    MouvementBancaire,
    ReleveImport,
    ReleveLigne,
    RapprochementBancaire,
)


# =========================================================
# Helpers admin
# =========================================================
def _admin_change_link(obj, app_label: str, model_name: str, label: str | None = None) -> str:
    """Retourne un lien HTML vers la page 'change' admin."""
    if not obj or getattr(obj, "pk", None) is None:
        return "-"
    try:
        url = reverse(f"admin:{app_label}_{model_name}_change", args=[obj.pk])
    except Exception:
        return "-"
    text = label or f"#{obj.pk}"
    return format_html('<a href="{}">{}</a>', url, text)


def _short(s: str | None, n: int = 32) -> str:
    s = (s or "").strip()
    if not s:
        return "-"
    return s if len(s) <= n else (s[: n - 1] + "…")


def _badge(text: str, kind: str = "info") -> str:
    """
    Petit badge HTML. kind: info|ok|warn|bad|muted
    """
    palette = {
        "info": ("#0ea5e9", "#e0f2fe"),
        "ok": ("#16a34a", "#dcfce7"),
        "warn": ("#f59e0b", "#fffbeb"),
        "bad": ("#dc2626", "#fee2e2"),
        "muted": ("#6b7280", "#f3f4f6"),
    }
    fg, bg = palette.get(kind, palette["info"])
    return format_html(
        '<span style="display:inline-block;padding:2px 8px;border-radius:999px;'
        'font-size:12px;line-height:18px;color:{};background:{};border:1px solid {}22;">{}</span>',
        fg,
        bg,
        fg,
        text,
    )


# =========================================================
# Inlines
# =========================================================
class ReleveLigneInline(admin.TabularInline):
    model = ReleveLigne
    extra = 0
    can_delete = False
    show_change_link = True
    fields = ("id", "statut", "date_operation", "sens", "montant", "reference", "libelle")
    readonly_fields = fields
    ordering = ("-date_operation", "-id")

    def has_add_permission(self, request, obj=None):
        return False


# =========================================================
# Admins
# =========================================================
@admin.register(CompteBancaire)
class CompteBancaireAdmin(admin.ModelAdmin):
    list_display = ("id", "copropriete", "nom", "devise", "solde_initial", "is_default", "is_active")
    list_filter = ("devise", "is_default", "is_active", "copropriete")
    search_fields = ("nom", "banque", "iban", "rib")
    ordering = ("-id",)


@admin.register(MouvementBancaire)
class MouvementBancaireAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "copropriete",
        "compte",
        "date_operation",
        "sens_badge",
        "montant",
        "reference",
        "libelle_short",
        "paiement_appel_link",
        "paiement_travaux_link",
    )
    list_filter = ("sens", "copropriete", "compte")
    search_fields = ("reference", "libelle", "note")
    date_hierarchy = "date_operation"
    ordering = ("-date_operation", "-id")

    list_select_related = ("compte", "paiement_travaux", "paiement_appel")

    @admin.display(description="Sens", ordering="sens")
    def sens_badge(self, obj: MouvementBancaire):
        s = getattr(obj, "sens", "") or ""
        if s == "CREDIT":
            return _badge("CREDIT", "ok")
        if s == "DEBIT":
            return _badge("DEBIT", "bad")
        return _badge(s or "-", "muted")

    @admin.display(description="Libellé", ordering="libelle")
    def libelle_short(self, obj: MouvementBancaire):
        return _short(getattr(obj, "libelle", None), 42)

    @admin.display(description="Paiement appel")
    def paiement_appel_link(self, obj: MouvementBancaire):
        pa = getattr(obj, "paiement_appel", None)
        # app_label/model_name: à adapter si ton app s'appelle différemment
        return mark_safe(_admin_change_link(pa, "billing", "paiementappel", label=f"PA#{getattr(pa, 'pk', '')}"))  # noqa: S308

    @admin.display(description="Paiement travaux")
    def paiement_travaux_link(self, obj: MouvementBancaire):
        pt = getattr(obj, "paiement_travaux", None)
        return mark_safe(_admin_change_link(pt, "travaux", "paiementtravaux", label=f"PT#{getattr(pt, 'pk', '')}"))  # noqa: S308


@admin.register(ReleveImport)
class ReleveImportAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "copropriete",
        "created_at",
        "fichier_nom",
        "delimiter",
        "encoding",
        "nb_lignes",
        "nb_crees",
        "nb_ignores",
        "hash_unique_short",
    )
    list_filter = ("copropriete", "delimiter", "encoding")
    search_fields = ("fichier_nom", "hash_unique")
    ordering = ("-created_at",)

    inlines = [ReleveLigneInline]

    @admin.display(description="Hash", ordering="hash_unique")
    def hash_unique_short(self, obj: ReleveImport):
        h = (getattr(obj, "hash_unique", "") or "").strip()
        return (h[:10] + "…") if len(h) > 10 else (h or "-")


@admin.register(ReleveLigne)
class ReleveLigneAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "copropriete",
        "releve_import_link",
        "statut_badge",
        "date_operation",
        "sens_badge",
        "montant",
        "reference",
        "libelle_short",
        "is_rapprochee_bool",
        "rapprochement_link",
    )
    list_filter = ("statut", "sens", "copropriete", "releve_import")
    search_fields = ("reference", "libelle", "hash_unique")
    date_hierarchy = "date_operation"
    ordering = ("-date_operation", "-id")

    list_select_related = ("releve_import",)
    autocomplete_fields = ("releve_import",)

    @admin.display(description="Import")
    def releve_import_link(self, obj: ReleveLigne):
        imp = getattr(obj, "releve_import", None)
        return mark_safe(_admin_change_link(imp, "compta", "releveimport", label=f"IMP#{getattr(imp, 'pk', '')}"))  # noqa: S308

    @admin.display(description="Statut", ordering="statut")
    def statut_badge(self, obj: ReleveLigne):
        st = getattr(obj, "statut", "") or ""
        # adapte si tu as d'autres statuts
        if st == "RAPPROCHE":
            return _badge("RAPPROCHE", "ok")
        if st in ("A_TRAITER", "NOUVEAU"):
            return _badge(st, "warn")
        if st:
            return _badge(st, "info")
        return _badge("-", "muted")

    @admin.display(description="Sens", ordering="sens")
    def sens_badge(self, obj: ReleveLigne):
        s = getattr(obj, "sens", "") or ""
        if s == "CREDIT":
            return _badge("CREDIT", "ok")
        if s == "DEBIT":
            return _badge("DEBIT", "bad")
        return _badge(s or "-", "muted")

    @admin.display(description="Libellé", ordering="libelle")
    def libelle_short(self, obj: ReleveLigne):
        return _short(getattr(obj, "libelle", None), 48)

    @admin.display(description="Rapprochée", boolean=True)
    def is_rapprochee_bool(self, obj: ReleveLigne):
        # ✅ robuste: ne pas se fier à un attribut potentiellement "callable"
        rap = getattr(obj, "rapprochement", None)
        if not rap:
            return False
        return not bool(getattr(rap, "is_cancelled", False))

    @admin.display(description="Rapprochement")
    def rapprochement_link(self, obj: ReleveLigne):
        rap = getattr(obj, "rapprochement", None)
        if not rap or getattr(rap, "is_cancelled", False):
            return "-"
        label = f"RAP#{rap.id} {getattr(rap, 'type_cible', '')}:{getattr(rap, 'cible_id', '')}"
        return mark_safe(_admin_change_link(rap, "compta", "rapprochementbancaire", label=label))  # noqa: S308


@admin.register(RapprochementBancaire)
class RapprochementBancaireAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "copropriete",
        "releve_ligne_link",
        "type_cible",
        "cible_id",
        "montant",
        "date_operation",
        "rapproche_at",
        "rapproche_par",
        "cancel_badge",
        "retarget_count",
        "retargeted_at",
        "retargeted_by",
    )
    list_filter = ("type_cible", "copropriete", "is_cancelled")
    search_fields = ("note", "cancelled_reason", "retarget_reason")
    date_hierarchy = "date_operation"
    ordering = ("-id",)

    list_select_related = ("releve_ligne",)

    readonly_fields = (
        # bloc “métier” qu’on évite de bricoler à la main
        "copropriete",
        "releve_ligne",
        "montant",
        "date_operation",
        # audit rapprochement
        "rapproche_at",
        "rapproche_par",
        # annulation
        "is_cancelled",
        "cancelled_at",
        "cancelled_by",
        "cancelled_reason",
        # retarget audit
        "retarget_count",
        "previous_type_cible",
        "previous_cible_id",
        "retargeted_at",
        "retargeted_by",
        "retarget_reason",
    )

    fieldsets = (
        ("Rapprochement", {"fields": ("copropriete", "releve_ligne", "type_cible", "cible_id", "note")}),
        ("Montant & date (issus de la ligne)", {"fields": ("montant", "date_operation")}),
        ("Audit", {"fields": ("rapproche_par", "rapproche_at")}),
        ("Annulation (soft-cancel)", {"fields": ("is_cancelled", "cancelled_at", "cancelled_by", "cancelled_reason")}),
        (
            "Correction (retarget) — audit",
            {
                "fields": (
                    "retarget_count",
                    "previous_type_cible",
                    "previous_cible_id",
                    "retargeted_at",
                    "retargeted_by",
                    "retarget_reason",
                )
            },
        ),
    )

    @admin.display(description="Ligne relevé")
    def releve_ligne_link(self, obj: RapprochementBancaire):
        rl = getattr(obj, "releve_ligne", None)
        return mark_safe(_admin_change_link(rl, "compta", "releveligne", label=f"RL#{getattr(rl, 'pk', '')}"))  # noqa: S308

    @admin.display(description="Statut", ordering="is_cancelled")
    def cancel_badge(self, obj: RapprochementBancaire):
        if getattr(obj, "is_cancelled", False):
            return _badge("ANNULE", "bad")
        return _badge("ACTIF", "ok")