from datetime import date, datetime, timedelta
from decimal import Decimal

from django.apps import apps
from django.contrib.auth import get_user_model
from django.utils import timezone

COPRO_ID = 24

Copropriete = apps.get_model("core", "Copropriete")
Lot = apps.get_model("lots", "Lot")
TantiemeCategorie = apps.get_model("lots", "TantiemeCategorie")
Coproprietaire = apps.get_model("owners", "Coproprietaire")
ProprietaireLot = apps.get_model("owners", "ProprietaireLot")

Exercice = apps.get_model("billing_app", "Exercice")
AppelDeFonds = apps.get_model("billing_app", "AppelDeFonds")
LigneAppelDeFonds = apps.get_model("billing_app", "LigneAppelDeFonds")
PaiementAppel = apps.get_model("billing_app", "PaiementAppel")
RelanceLot = apps.get_model("billing_app", "RelanceLot")

ReglementTexteApplicable = apps.get_model("documents", "ReglementTexteApplicable")

CompteBancaire = apps.get_model("compta", "CompteBancaire")
MouvementBancaire = apps.get_model("compta", "MouvementBancaire")

DossierImpaye = apps.get_model("relances", "DossierImpaye")
Relance = apps.get_model("relances", "Relance")

User = get_user_model()


def d(value):
    return Decimal(str(value))


def aware(year, month, day, hour=9, minute=0):
    return timezone.make_aware(datetime(year, month, day, hour, minute))


TODAY = timezone.localdate()


def past_date(days: int):
    return TODAY - timedelta(days=days)


def aware_past(days: int, hour=9, minute=0):
    target = past_date(days)
    return timezone.make_aware(datetime(target.year, target.month, target.day, hour, minute))


def choice_value(model, field_name, candidates, fallback):
    field = model._meta.get_field(field_name)
    values = [item[0] for item in getattr(field, "choices", []) or []]

    if not values:
        return fallback

    for candidate in candidates:
        if candidate in values:
            return candidate

    return fallback


def update_or_create_by_filter(model, lookup, defaults):
    obj = model.objects.filter(**lookup).first()

    if obj:
        for key, value in defaults.items():
            setattr(obj, key, value)
        obj.save()
        return obj, False

    data = {**lookup, **defaults}
    return model.objects.create(**data), True


copro = Copropriete.objects.get(id=COPRO_ID)
admin = User.objects.filter(is_superuser=True).order_by("id").first()

print("=" * 90)
print("CONSOLIDATION PARCOURS DÉMO OFFICIEL")
print("=" * 90)
print(f"Copropriété : #{copro.id} — {copro.nom}")
print(f"Admin       : {getattr(admin, 'email', None) or getattr(admin, 'username', '—')}")
print()

lots = {str(lot): lot for lot in Lot.objects.filter(copropriete=copro).order_by("id")}

required_lots = ["A101", "A102", "B201", "RDC-01", "PARK-01"]
missing = [label for label in required_lots if label not in lots]

if missing:
    raise RuntimeError(f"Lots manquants pour la démo : {missing}")

categorie = (
    TantiemeCategorie.objects.filter(copropriete=copro, code="GENERAL").first()
    or TantiemeCategorie.objects.filter(copropriete=copro).order_by("id").first()
)

if not categorie:
    raise RuntimeError("Aucune catégorie de tantièmes trouvée pour la copropriété #24.")

exercice, created = Exercice.objects.update_or_create(
    copropriete=copro,
    annee=2026,
    defaults={
        "date_debut": date(2026, 1, 1),
        "date_fin": date(2026, 12, 31),
        "actif": True,
    },
)
print(f"Exercice 2026 : {'créé' if created else 'mis à jour'}")

appel_type = choice_value(
    AppelDeFonds,
    "type_appel",
    ["PERIODIQUE", "CHARGES", "TRAVAUX", "AUTRE"],
    "PERIODIQUE",
)

statut_paye = choice_value(
    LigneAppelDeFonds,
    "statut",
    ["PAYE", "PAYEE", "REGLE", "REGLEE"],
    "PAYE",
)
statut_partiel = choice_value(
    LigneAppelDeFonds,
    "statut",
    ["PARTIEL", "PARTIELLEMENT_PAYE", "PARTIELLEMENT_PAYEE"],
    "PARTIEL",
)
statut_impaye = choice_value(
    LigneAppelDeFonds,
    "statut",
    ["IMPAYE", "A_PAYER", "EN_ATTENTE"],
    "IMPAYE",
)

paiement_mode = choice_value(
    PaiementAppel,
    "mode",
    ["VIREMENT", "ESPECES", "MOBILE_MONEY", "CHEQUE"],
    "VIREMENT",
)

relance_lot_canal = choice_value(
    RelanceLot,
    "canal",
    ["WHATSAPP", "EMAIL", "SMS", "COURRIER"],
    "WHATSAPP",
)
relance_lot_statut = choice_value(
    RelanceLot,
    "statut",
    ["ENVOYEE", "ENVOYE", "BROUILLON"],
    "ENVOYEE",
)

dossier_statut = choice_value(
    DossierImpaye,
    "statut",
    ["A_PAYER", "EN_COURS", "IMPAYE"],
    "A_PAYER",
)

relance_canal = choice_value(
    Relance,
    "canal",
    ["WHATSAPP", "EMAIL", "SMS", "COURRIER"],
    "WHATSAPP",
)
relance_statut = choice_value(
    Relance,
    "statut",
    ["ENVOYEE", "ENVOYE", "BROUILLON"],
    "ENVOYEE",
)

text_statut = choice_value(
    ReglementTexteApplicable,
    "statut",
    ["PUBLIE", "PUBLIEE", "ACTIVE", "BROUILLON"],
    "PUBLIE",
)

appels_config = [
    {
        "libelle": "Appel de charges T3 2026 — entretien et sécurité",
        "date_emission": past_date(90),
        "date_echeance": past_date(60),
        "lignes": {
            "A101": {"tantiemes": 250, "du": 180000, "paye": 180000},
            "A102": {"tantiemes": 200, "du": 150000, "paye": 75000},
            "B201": {"tantiemes": 250, "du": 170000, "paye": 0},
            "RDC-01": {"tantiemes": 200, "du": 120000, "paye": 120000},
            "PARK-01": {"tantiemes": 100, "du": 30000, "paye": 30000},
        },
    },
    {
        "libelle": "Fonds travaux 2026 — peinture des parties communes",
        "date_emission": past_date(55),
        "date_echeance": past_date(25),
        "lignes": {
            "A101": {"tantiemes": 250, "du": 100000, "paye": 100000},
            "A102": {"tantiemes": 200, "du": 80000, "paye": 0},
            "B201": {"tantiemes": 250, "du": 100000, "paye": 0},
            "RDC-01": {"tantiemes": 200, "du": 100000, "paye": 50000},
            "PARK-01": {"tantiemes": 100, "du": 20000, "paye": 20000},
        },
    },
]

paiements_crees = []
lignes_impayees = []

for appel_config in appels_config:
    montant_total = sum(d(item["du"]) for item in appel_config["lignes"].values())

    appel, created = AppelDeFonds.objects.update_or_create(
        exercice=exercice,
        libelle=appel_config["libelle"],
        defaults={
            "type_appel": appel_type,
            "date_emission": appel_config["date_emission"],
            "date_echeance": appel_config["date_echeance"],
            "montant_total": montant_total,
            "tantieme_categorie": categorie,
            "genere": True,
        },
    )

    print(f"Appel : {appel.libelle} — {'créé' if created else 'mis à jour'}")

    for lot_label, line_config in appel_config["lignes"].items():
        lot = lots[lot_label]
        montant_du = d(line_config["du"])
        montant_paye = d(line_config["paye"])

        if montant_paye >= montant_du:
            statut = statut_paye
        elif montant_paye > 0:
            statut = statut_partiel
        else:
            statut = statut_impaye

        ligne, created = LigneAppelDeFonds.objects.update_or_create(
            appel=appel,
            lot=lot,
            defaults={
                "tantiemes": d(line_config["tantiemes"]),
                "montant_du": montant_du,
                "montant_paye": montant_paye,
                "statut": statut,
            },
        )

        print(f"  Ligne {lot_label}: {montant_du} dû / {montant_paye} payé — {statut}")

        if montant_paye > 0:
            ref = f"PAY-DEMO-{appel.id}-{lot.id}"

            paiement, paiement_created = update_or_create_by_filter(
                PaiementAppel,
                {"reference": ref},
                {
                    "ligne": ligne,
                    "date_paiement": aware_past(20, 10, 30),
                    "montant": montant_paye,
                    "mode": paiement_mode,
                    "commentaire": "Paiement de démonstration pour le parcours officiel.",
                    "is_cancelled": False,
                    "cancelled_at": None,
                    "cancelled_by": None,
                    "cancelled_reason": "",
                },
            )
            paiements_crees.append(paiement)
            print(f"    Paiement {ref}: {'créé' if paiement_created else 'mis à jour'}")

        reste = montant_du - montant_paye
        if reste > 0:
            lignes_impayees.append((appel, ligne, lot, montant_du, montant_paye, reste))

compte, created = CompteBancaire.objects.update_or_create(
    copropriete=copro,
    nom="Compte principal démo",
    defaults={
        "banque": "Banque Démo CI",
        "iban": "",
        "rib": "DEMO-CI-00024",
        "devise": "XOF",
        "solde_initial": d(250000),
        "is_active": True,
        "is_default": True,
    },
)
print(f"Compte bancaire : {'créé' if created else 'mis à jour'}")

for paiement in paiements_crees:
    ref = f"MB-{paiement.reference}"

    mouvement, created = update_or_create_by_filter(
        MouvementBancaire,
        {"copropriete": copro, "reference": ref},
        {
            "compte": compte,
            "sens": "CREDIT",
            "montant": paiement.montant,
            "date_operation": paiement.date_paiement.date(),
            "libelle": f"Encaissement {paiement.ligne.lot} — {paiement.ligne.appel.libelle}",
            "note": "Mouvement bancaire de démonstration lié à un paiement d’appel.",
            "paiement_appel": paiement,
            "paiement_travaux": None,
            "created_by": admin,
            "is_cancelled": False,
            "cancel_kind": "",
            "cancelled_at": None,
            "cancelled_by": None,
            "cancelled_reason": "",
        },
    )
    print(f"Mouvement crédit {ref}: {'créé' if created else 'mis à jour'}")

depenses = [
    ("MB-DEMO-DEP-ENTRETIEN", "DEBIT", 75000, past_date(18), "Paiement entretien ascenseur"),
    ("MB-DEMO-DEP-PEINTURE", "DEBIT", 125000, past_date(15), "Acompte peinture parties communes"),
    ("MB-DEMO-DEP-BANQUE", "DEBIT", 5000, past_date(12), "Frais bancaires mensuels"),
]

for ref, sens, montant, operation_date, libelle in depenses:
    mouvement, created = update_or_create_by_filter(
        MouvementBancaire,
        {"copropriete": copro, "reference": ref},
        {
            "compte": compte,
            "sens": sens,
            "montant": d(montant),
            "date_operation": operation_date,
            "libelle": libelle,
            "note": "Dépense de démonstration.",
            "paiement_appel": None,
            "paiement_travaux": None,
            "created_by": admin,
            "is_cancelled": False,
            "cancel_kind": "",
            "cancelled_at": None,
            "cancelled_by": None,
            "cancelled_reason": "",
        },
    )
    print(f"Mouvement débit {ref}: {'créé' if created else 'mis à jour'}")

for index, (appel, ligne, lot, montant_du, montant_paye, reste) in enumerate(lignes_impayees, start=1):
    proprietaire_lot = (
        ProprietaireLot.objects.filter(copropriete=copro, lot=lot).select_related("coproprietaire").first()
    )
    coproprietaire = proprietaire_lot.coproprietaire if proprietaire_lot else None

    dossier, created = DossierImpaye.objects.update_or_create(
        copropriete=copro,
        lot=lot,
        appel=appel,
        defaults={
            "coproprietaire": coproprietaire,
            "reference_appel": appel.libelle,
            "date_echeance": appel.date_echeance,
            "montant_initial": montant_du,
            "montant_paye": montant_paye,
            "reste_a_payer": reste,
            "statut": dossier_statut,
            "niveau_relance": 1,
            "relances_count": 1,
            "derniere_relance_at": aware_past(7, 9, 0),
            "date_dernier_paiement": None,
            "est_regularise": False,
            "regularise_at": None,
            "auto_relance_active": True,
            "commentaire_interne": "Dossier impayé créé pour le parcours de démonstration officiel.",
        },
    )

    print(f"Dossier impayé {lot}: {'créé' if created else 'mis à jour'} — reste {reste}")

    numero = f"REL-DEMO-{appel.id}-{lot.id}"

    relance_lot, created = update_or_create_by_filter(
        RelanceLot,
        {"numero": numero},
        {
            "lot": lot,
            "appel": appel,
            "canal": relance_lot_canal,
            "statut": relance_lot_statut,
            "message": (
                f"Bonjour, le lot {lot} présente un reste à payer de "
                f"{reste:,.0f} FCFA sur {appel.libelle}."
            ),
            "reference_externe": "DEMO-OFFICIELLE",
        },
    )
    print(f"RelanceLot {numero}: {'créée' if created else 'mise à jour'}")

    relance, created = update_or_create_by_filter(
        Relance,
        {"copropriete": copro, "dossier": dossier, "niveau": 1},
        {
            "appel": appel,
            "lot": lot,
            "coproprietaire": coproprietaire,
            "canal": relance_canal,
            "statut": relance_statut,
            "objet": f"Relance amiable — {appel.libelle}",
            "message": (
                f"Bonjour, sauf erreur de notre part, un solde de "
                f"{reste:,.0f} FCFA reste dû pour le lot {lot}. "
                "Merci de procéder à la régularisation."
            ),
            "montant_du_message": montant_du,
            "reste_a_payer_au_moment_envoi": reste,
            "date_envoi": aware_past(7, 9, 0),
            "date_echec": None,
            "motif_echec": "",
            "envoye_par": admin,
            "annulee_at": None,
            "annulee_par": None,
            "motif_annulation": "",
        },
    )
    print(f"Relance dossier {lot}: {'créée' if created else 'mise à jour'}")

reglement, created = ReglementTexteApplicable.objects.update_or_create(
    copropriete=copro,
    titre="Règlement intérieur simplifié — Résidence Pilote E2E",
    defaults={
        "categorie": "REGLEMENT_INTERIEUR",
        "resume": (
            "Règles essentielles de vie commune, entretien des parties communes, "
            "stationnement et respect du voisinage."
        ),
        "contenu": (
            "Ce règlement intérieur de démonstration rappelle les règles de vie "
            "commune applicables à la Résidence Pilote E2E : respect des parties "
            "communes, paiement régulier des charges, respect des horaires de repos, "
            "stationnement dans les emplacements autorisés et signalement des incidents "
            "au syndic."
        ),
        "statut": text_statut,
        "visible_coproprietaire": True,
        "ordre_affichage": 1,
        "publie_par": admin,
        "date_publication": timezone.now(),
        "created_by": admin,
        "updated_by": admin,
        "metadata": {"demo": True, "parcours": "officiel"},
    },
)
print(f"Texte utile copropriétaire : {'créé' if created else 'mis à jour'}")

print()
print("=" * 90)
print("RÉSUMÉ FINAL")
print("=" * 90)
print(f"Appels de fonds #24      : {AppelDeFonds.objects.filter(exercice__copropriete=copro).count()}")
print(f"Lignes d'appels #24      : {LigneAppelDeFonds.objects.filter(appel__exercice__copropriete=copro).count()}")
print(f"Paiements #24            : {PaiementAppel.objects.filter(ligne__appel__exercice__copropriete=copro, is_cancelled=False).count()}")
print(f"Dossiers impayés #24     : {DossierImpaye.objects.filter(copropriete=copro).count()}")
print(f"Relances #24             : {Relance.objects.filter(copropriete=copro).count()}")
print(f"Textes visibles #24      : {ReglementTexteApplicable.objects.filter(copropriete=copro, visible_coproprietaire=True).count()}")
print(f"Comptes bancaires #24    : {CompteBancaire.objects.filter(copropriete=copro).count()}")
print(f"Mouvements bancaires #24 : {MouvementBancaire.objects.filter(copropriete=copro, is_cancelled=False).count()}")
print("=" * 90)
print("CONSOLIDATION TERMINÉE")
print("=" * 90)
