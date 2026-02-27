# apps/billing/tests/test_billing_constraints.py
from __future__ import annotations

from datetime import date, timedelta
from decimal import Decimal

import pytest
from django.core.exceptions import ValidationError
from django.db import IntegrityError
from django.utils import timezone

from apps.core.models import Copropriete
from apps.billing.models import Exercice
from apps.lots.models import Lot, TantiemeCategorie, LotTantieme
from apps.billing.models import AppelDeFonds, LigneAppelDeFonds, PaiementAppel, RelanceLot

pytestmark = pytest.mark.django_db


# -----------------------
# Helpers introspection
# -----------------------
def _field_names(model):
    return {f.name for f in model._meta.get_fields() if getattr(f, "concrete", False)}


def _pick(names, candidates):
    for c in candidates:
        if c in names:
            return c
    return None


def _required_fields_without_default(model):
    """
    Champs concrets, non-null, sans default, non auto.
    (en excluant id/PK)
    """
    req = []
    for f in model._meta.fields:
        if f.primary_key:
            continue
        if getattr(f, "auto_created", False):
            continue
        if getattr(f, "null", False):
            continue
        if getattr(f, "blank", False) and hasattr(f, "blank"):
            # blank ne veut pas dire "optional" en DB, mais c'est utile pour heuristique
            pass
        has_default = f.default is not None and f.default is not pytest
        # Django utilise NOT_PROVIDED, mais ici on teste via hasattr
        from django.db.models.fields import NOT_PROVIDED

        if f.default is NOT_PROVIDED and not getattr(f, "has_default", lambda: False)():
            # pas de default
            req.append(f.name)
    return req


def _make_copro_exo():
    copro = Copropriete.objects.create(nom="Copro Test")
    exo = Exercice.objects.create(
        copropriete=copro,
        annee=2026,
        date_debut=date(2026, 1, 1),
        date_fin=date(2026, 12, 31),
        actif=True,
    )
    return copro, exo


def _make_lot_with_tantieme(copro):
    cat = TantiemeCategorie.objects.create(copropriete=copro, code="GEN", libelle="Tantièmes généraux", actif=True)
    lot = Lot.objects.create(copropriete=copro, reference="A101", type_lot="APPARTEMENT", description="Lot test")
    LotTantieme.objects.create(lot=lot, categorie=cat, valeur=Decimal("100"))
    return lot


def _make_appel(copro, exo):
    names = _field_names(AppelDeFonds)
    data = {}

    # Champs fréquents
    exo_field = _pick(names, ["exercice"])
    if exo_field:
        data[exo_field] = exo

    copro_field = _pick(names, ["copropriete"])
    if copro_field:
        data[copro_field] = copro

    lib_field = _pick(names, ["libelle", "titre", "objet", "name"])
    if lib_field:
        data[lib_field] = "Appel Test"

    date_field = _pick(names, ["date_appel", "date_emission", "date", "date_creation"])
    if date_field:
        data[date_field] = date(2026, 2, 1)

    # compléter les champs requis non encore remplis avec des valeurs par défaut raisonnables
    req = _required_fields_without_default(AppelDeFonds)
    missing = [f for f in req if f not in data]
    # On essaie de remplir par heuristique selon type
    for fname in missing:
        f = AppelDeFonds._meta.get_field(fname)
        itype = f.get_internal_type()
        if itype in ("CharField", "TextField"):
            data[fname] = "X"
        elif itype in ("BooleanField",):
            data[fname] = False
        elif itype in ("DateField",):
            data[fname] = date(2026, 2, 1)
        elif itype in ("DateTimeField",):
            data[fname] = timezone.now()
        elif itype in ("IntegerField", "PositiveIntegerField", "BigIntegerField", "SmallIntegerField"):
            data[fname] = 1
        elif itype in ("DecimalField", "FloatField"):
            data[fname] = Decimal("0")
        else:
            # FK obligatoire ?
            if hasattr(f, "remote_field") and f.remote_field:
                rel = f.remote_field.model
                # Exercice/Copropriete on a déjà
                if rel is Exercice:
                    data[fname] = exo
                elif rel is Copropriete:
                    data[fname] = copro
                else:
                    raise RuntimeError(
                        f"AppelDeFonds: champ FK requis '{fname}' vers {rel.__name__} non géré automatiquement. "
                        f"Colle-moi le modèle AppelDeFonds et je l’adapte."
                    )
            else:
                raise RuntimeError(
                    f"AppelDeFonds: champ requis '{fname}' de type {itype} non géré automatiquement. "
                    f"Colle-moi le modèle AppelDeFonds et je l’adapte."
                )

    return AppelDeFonds.objects.create(**data)


def _make_ligne(appel, lot):
    names = _field_names(LigneAppelDeFonds)
    data = {}

    # FK appel
    appel_field = _pick(names, ["appel", "appel_de_fonds"])
    if appel_field:
        data[appel_field] = appel

    # FK lot
    lot_field = _pick(names, ["lot"])
    if lot_field:
        data[lot_field] = lot

    # Montants
    md_field = _pick(names, ["montant_du", "montant", "montant_total", "du"])
    if md_field:
        data[md_field] = Decimal("100.00")

    mp_field = _pick(names, ["montant_paye", "paye", "montant_regle"])
    if mp_field:
        data[mp_field] = Decimal("0.00")

    # compléter requis
    req = _required_fields_without_default(LigneAppelDeFonds)
    missing = [f for f in req if f not in data]
    for fname in missing:
        f = LigneAppelDeFonds._meta.get_field(fname)
        itype = f.get_internal_type()
        if itype in ("CharField", "TextField"):
            data[fname] = "X"
        elif itype in ("BooleanField",):
            data[fname] = False
        elif itype in ("DateField",):
            data[fname] = date(2026, 2, 1)
        elif itype in ("DateTimeField",):
            data[fname] = timezone.now()
        elif itype in ("IntegerField", "PositiveIntegerField"):
            data[fname] = 1
        elif itype in ("DecimalField", "FloatField"):
            data[fname] = Decimal("0")
        else:
            if hasattr(f, "remote_field") and f.remote_field:
                rel = f.remote_field.model
                if rel is Lot:
                    data[fname] = lot
                else:
                    raise RuntimeError(
                        f"LigneAppelDeFonds: champ FK requis '{fname}' vers {rel.__name__} non géré automatiquement."
                    )
            else:
                raise RuntimeError(
                    f"LigneAppelDeFonds: champ requis '{fname}' de type {itype} non géré automatiquement."
                )

    return LigneAppelDeFonds.objects.create(**data)


def _assert_raises_any(fn):
    """
    Pour contraintes DB (IntegrityError) ou validation (ValidationError).
    """
    with pytest.raises((ValidationError, IntegrityError, Exception)):
        fn()


# -----------------------
# Fixtures
# -----------------------
@pytest.fixture
def copro_exo_lot():
    copro, exo = _make_copro_exo()
    lot = _make_lot_with_tantieme(copro)
    return copro, exo, lot


# -----------------------
# Tests
# -----------------------
def test_ligne_appel_contrainte_montant_paye_leq_montant_du(copro_exo_lot):
    copro, exo, lot = copro_exo_lot
    appel = _make_appel(copro, exo)
    ligne = _make_ligne(appel, lot)

    names = _field_names(LigneAppelDeFonds)
    md_field = _pick(names, ["montant_du", "montant", "montant_total", "du"])
    mp_field = _pick(names, ["montant_paye", "paye", "montant_regle"])

    assert md_field and mp_field, "Impossible de trouver les champs montant_du/montant_paye sur LigneAppelDeFonds."

    setattr(ligne, md_field, Decimal("100.00"))
    setattr(ligne, mp_field, Decimal("150.00"))

    def _do():
        ligne.full_clean()
        ligne.save()

    _assert_raises_any(_do)


def test_paiement_refuse_date_futur(copro_exo_lot):
    copro, exo, lot = copro_exo_lot
    appel = _make_appel(copro, exo)
    ligne = _make_ligne(appel, lot)

    names = _field_names(PaiementAppel)
    ligne_field = _pick(names, ["ligne"])
    montant_field = _pick(names, ["montant", "amount"])
    date_field = _pick(names, ["date_paiement", "date", "created_at", "datetime_paiement"])

    assert ligne_field and montant_field and date_field, (
        "Impossible d’identifier champs de PaiementAppel (ligne/montant/date_paiement). "
        "Colle-moi le modèle PaiementAppel si besoin."
    )

    futur = timezone.now().date() + timedelta(days=2)

    data = {ligne_field: ligne, montant_field: Decimal("10.00")}
    # date field peut être DateField ou DateTimeField
    f = PaiementAppel._meta.get_field(date_field)
    if f.get_internal_type() == "DateTimeField":
        data[date_field] = timezone.now() + timedelta(days=2)
    else:
        data[date_field] = futur

    p = PaiementAppel(**data)

    def _do():
        p.full_clean()
        p.save()

    _assert_raises_any(_do)


def test_relance_lot_unique_lot_appel(copro_exo_lot):
    copro, exo, lot = copro_exo_lot
    appel = _make_appel(copro, exo)

    names = _field_names(RelanceLot)
    appel_field = _pick(names, ["appel"])
    lot_field = _pick(names, ["lot"])
    niveau_field = _pick(names, ["niveau", "level", "numero"])

    assert appel_field and lot_field, "Impossible d’identifier FK appel/lot sur RelanceLot."

    base = {appel_field: appel, lot_field: lot}
    if niveau_field:
        base[niveau_field] = 1

    RelanceLot.objects.create(**base)

    def _do():
        b2 = {appel_field: appel, lot_field: lot}
        if niveau_field:
            b2[niveau_field] = 2
        RelanceLot.objects.create(**b2)

    _assert_raises_any(_do)