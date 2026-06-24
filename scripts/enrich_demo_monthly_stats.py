from datetime import date
from decimal import Decimal

from django.apps import apps
from django.contrib.auth import get_user_model

COPRO_ID = 24

Copropriete = apps.get_model("core", "Copropriete")
CompteBancaire = apps.get_model("compta", "CompteBancaire")
MouvementBancaire = apps.get_model("compta", "MouvementBancaire")

User = get_user_model()


def d(value):
    return Decimal(str(value))


def upsert_mouvement(copro, compte, admin, item):
    obj = MouvementBancaire.objects.filter(
        copropriete=copro,
        reference=item["reference"],
    ).first()

    defaults = {
        "compte": compte,
        "sens": item["sens"],
        "montant": d(item["montant"]),
        "date_operation": item["date_operation"],
        "libelle": item["libelle"],
        "note": "Mouvement historique de démonstration pour enrichir la courbe mensuelle.",
        "paiement_appel": None,
        "paiement_travaux": None,
        "created_by": admin,
        "is_cancelled": False,
        "cancel_kind": "",
        "cancelled_at": None,
        "cancelled_by": None,
        "cancelled_reason": "",
    }

    if obj:
        for key, value in defaults.items():
            setattr(obj, key, value)
        obj.save()
        return obj, False

    return MouvementBancaire.objects.create(
        copropriete=copro,
        reference=item["reference"],
        **defaults,
    ), True


copro = Copropriete.objects.get(id=COPRO_ID)
admin = User.objects.filter(is_superuser=True).order_by("id").first()

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

items = [
    {
        "reference": "MB-DEMO-HIST-JAN-CREDIT",
        "sens": "CREDIT",
        "montant": 220000,
        "date_operation": date(2026, 1, 15),
        "libelle": "Cotisations mensuelles encaissées — janvier 2026",
    },
    {
        "reference": "MB-DEMO-HIST-JAN-DEBIT",
        "sens": "DEBIT",
        "montant": 65000,
        "date_operation": date(2026, 1, 22),
        "libelle": "Entretien courant immeuble — janvier 2026",
    },
    {
        "reference": "MB-DEMO-HIST-FEV-CREDIT",
        "sens": "CREDIT",
        "montant": 280000,
        "date_operation": date(2026, 2, 12),
        "libelle": "Cotisations mensuelles encaissées — février 2026",
    },
    {
        "reference": "MB-DEMO-HIST-FEV-DEBIT",
        "sens": "DEBIT",
        "montant": 90000,
        "date_operation": date(2026, 2, 20),
        "libelle": "Gardiennage et petites réparations — février 2026",
    },
    {
        "reference": "MB-DEMO-HIST-MAR-CREDIT",
        "sens": "CREDIT",
        "montant": 350000,
        "date_operation": date(2026, 3, 14),
        "libelle": "Règlements copropriétaires — mars 2026",
    },
    {
        "reference": "MB-DEMO-HIST-MAR-DEBIT",
        "sens": "DEBIT",
        "montant": 120000,
        "date_operation": date(2026, 3, 25),
        "libelle": "Maintenance ascenseur — mars 2026",
    },
    {
        "reference": "MB-DEMO-HIST-AVR-CREDIT",
        "sens": "CREDIT",
        "montant": 180000,
        "date_operation": date(2026, 4, 10),
        "libelle": "Encaissements partiels — avril 2026",
    },
    {
        "reference": "MB-DEMO-HIST-AVR-DEBIT",
        "sens": "DEBIT",
        "montant": 140000,
        "date_operation": date(2026, 4, 18),
        "libelle": "Travaux urgents plomberie — avril 2026",
    },
    {
        "reference": "MB-DEMO-HIST-MAI-CREDIT",
        "sens": "CREDIT",
        "montant": 240000,
        "date_operation": date(2026, 5, 9),
        "libelle": "Régularisations après relances — mai 2026",
    },
    {
        "reference": "MB-DEMO-HIST-MAI-DEBIT",
        "sens": "DEBIT",
        "montant": 110000,
        "date_operation": date(2026, 5, 21),
        "libelle": "Nettoyage et fournitures communes — mai 2026",
    },
    {
        "reference": "MB-DEMO-HIST-JUIN-CREDIT",
        "sens": "CREDIT",
        "montant": 160000,
        "date_operation": date(2026, 6, 10),
        "libelle": "Encaissements complémentaires — juin 2026",
    },
    {
        "reference": "MB-DEMO-HIST-JUIN-DEBIT",
        "sens": "DEBIT",
        "montant": 85000,
        "date_operation": date(2026, 6, 18),
        "libelle": "Prestations courantes — juin 2026",
    },
]

print("=" * 90)
print("ENRICHISSEMENT COURBE MENSUELLE DÉMO")
print("=" * 90)
print(f"Copropriété : #{copro.id} — {copro.nom}")
print(f"Compte      : {compte.nom}")
print()

created_count = 0
updated_count = 0

for item in items:
    obj, created = upsert_mouvement(copro, compte, admin, item)

    if created:
        created_count += 1
        action = "créé"
    else:
        updated_count += 1
        action = "mis à jour"

    print(
        f"{action:<10} {obj.reference:<30} "
        f"{obj.date_operation} {obj.sens:<6} {obj.montant} FCFA"
    )

print()
print("=" * 90)
print("RÉSUMÉ COURBE")
print("=" * 90)
print(f"Mouvements historiques créés     : {created_count}")
print(f"Mouvements historiques mis à jour: {updated_count}")
print(
    "Total mouvements actifs #24      :",
    MouvementBancaire.objects.filter(copropriete=copro, is_cancelled=False).count(),
)
print(
    "Crédits actifs #24               :",
    sum(
        m.montant
        for m in MouvementBancaire.objects.filter(
            copropriete=copro,
            is_cancelled=False,
            sens="CREDIT",
        )
    ),
)
print(
    "Débits actifs #24                :",
    sum(
        m.montant
        for m in MouvementBancaire.objects.filter(
            copropriete=copro,
            is_cancelled=False,
            sens="DEBIT",
        )
    ),
)
print("=" * 90)
print("ENRICHISSEMENT TERMINÉ")
print("=" * 90)
