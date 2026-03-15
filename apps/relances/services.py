from __future__ import annotations

from decimal import Decimal

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from .models import AvisRegularisation, DossierImpaye, Relance


DECIMAL_ZERO = Decimal("0.00")


def compute_dossier_statut(*, dossier: DossierImpaye) -> str:
    today = timezone.localdate()

    if dossier.reste_a_payer <= DECIMAL_ZERO:
        if dossier.est_regularise:
            return DossierImpaye.Statut.REGULARISE
        return DossierImpaye.Statut.PAYE

    if dossier.date_echeance < today:
        if dossier.montant_paye > DECIMAL_ZERO:
            return DossierImpaye.Statut.PARTIELLEMENT_PAYE
        return DossierImpaye.Statut.EN_RETARD

    return DossierImpaye.Statut.A_PAYER


@transaction.atomic
def refresh_dossier_status(dossier: DossierImpaye, *, save: bool = True) -> DossierImpaye:
    dossier.statut = compute_dossier_statut(dossier=dossier)

    if dossier.reste_a_payer <= DECIMAL_ZERO:
        if not dossier.est_regularise:
            dossier.est_regularise = True
            dossier.regularise_at = timezone.now()
    else:
        dossier.est_regularise = False
        dossier.regularise_at = None

    if save:
        dossier.save(
            update_fields=[
                "statut",
                "est_regularise",
                "regularise_at",
                "updated_at",
            ]
        )

    return dossier


@transaction.atomic
def create_relance(
    *,
    dossier: DossierImpaye,
    canal: str,
    utilisateur=None,
    message: str,
    objet: str = "",
    statut: str = Relance.Statut.ENVOYEE,
    document_pdf=None,
) -> Relance:
    if dossier.reste_a_payer <= DECIMAL_ZERO:
        raise ValidationError("Impossible de créer une relance pour un dossier soldé.")

    niveau = (dossier.niveau_relance or 0) + 1

    relance = Relance.objects.create(
        copropriete=dossier.copropriete,
        dossier=dossier,
        appel=dossier.appel,
        lot=dossier.lot,
        coproprietaire=dossier.coproprietaire,
        niveau=niveau,
        canal=canal,
        statut=statut,
        objet=objet,
        message=message,
        montant_du_message=dossier.reste_a_payer,
        reste_a_payer_au_moment_envoi=dossier.reste_a_payer,
        document_pdf=document_pdf,
        envoye_par=utilisateur if getattr(utilisateur, "is_authenticated", False) else None,
    )

    dossier.niveau_relance = niveau
    dossier.relances_count = (dossier.relances_count or 0) + 1
    dossier.derniere_relance_at = timezone.now()
    dossier.save(
        update_fields=[
            "niveau_relance",
            "relances_count",
            "derniere_relance_at",
            "updated_at",
        ]
    )

    return relance


@transaction.atomic
def cancel_relance(
    *,
    relance: Relance,
    utilisateur=None,
    motif_annulation: str = "",
) -> Relance:
    if relance.statut == Relance.Statut.ANNULEE:
        return relance

    relance.statut = Relance.Statut.ANNULEE
    relance.annulee_at = timezone.now()
    relance.annulee_par = utilisateur if getattr(utilisateur, "is_authenticated", False) else None
    relance.motif_annulation = motif_annulation or ""
    relance.save(
        update_fields=[
            "statut",
            "annulee_at",
            "annulee_par",
            "motif_annulation",
            "updated_at",
        ]
    )
    return relance


@transaction.atomic
def generate_avis_regularisation(
    *,
    dossier: DossierImpaye,
    utilisateur=None,
    canal: str = AvisRegularisation.Canal.INTERNE,
    message: str = "",
) -> AvisRegularisation:
    refresh_dossier_status(dossier)

    if dossier.reste_a_payer > DECIMAL_ZERO:
        raise ValidationError(
            "Impossible de générer un avis de régularisation tant qu’un solde reste dû."
        )

    avis, created = AvisRegularisation.objects.get_or_create(
        dossier=dossier,
        defaults={
            "copropriete": dossier.copropriete,
            "appel": dossier.appel,
            "lot": dossier.lot,
            "coproprietaire": dossier.coproprietaire,
            "montant_initial": dossier.montant_initial,
            "montant_total_regle": dossier.montant_paye,
            "date_regularisation": dossier.regularise_at or timezone.now(),
            "canal": canal,
            "statut": AvisRegularisation.Statut.GENERE,
            "message": message or "",
            "genere_par": utilisateur if getattr(utilisateur, "is_authenticated", False) else None,
        },
    )

    if not created:
        avis.montant_initial = dossier.montant_initial
        avis.montant_total_regle = dossier.montant_paye
        avis.date_regularisation = dossier.regularise_at or timezone.now()
        avis.canal = canal
        avis.message = message or avis.message
        if getattr(utilisateur, "is_authenticated", False):
            avis.genere_par = utilisateur
        avis.save(
            update_fields=[
                "montant_initial",
                "montant_total_regle",
                "date_regularisation",
                "canal",
                "message",
                "genere_par",
                "updated_at",
            ]
        )

    return avis