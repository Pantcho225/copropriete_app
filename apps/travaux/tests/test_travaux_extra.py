# apps/travaux/tests/test_travaux_extra.py
from __future__ import annotations

from datetime import date, datetime, timezone as dtz
from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from apps.core.models import Copropriete
from apps.billing.models import Exercice
from apps.lots.models import Lot, LotTantieme, TantiemeCategorie
from apps.ag.models import AssembleeGenerale
from apps.travaux.models import DossierTravaux

pytestmark = pytest.mark.django_db


def _auth_client(user) -> APIClient:
    c = APIClient()
    c.force_authenticate(user=user)
    return c


def _hdr(copro_id: int) -> dict:
    return {"HTTP_X_COPROPRIETE_ID": str(copro_id)}


@pytest.fixture
def admin_user():
    User = get_user_model()
    return User.objects.create_user(
        username="admin",
        email="admin@test.local",
        password="pass12345",
        is_staff=True,
        is_superuser=True,
    )


@pytest.fixture
def base_copro():
    copro = Copropriete.objects.create(nom="C1")
    exo = Exercice.objects.create(
        copropriete=copro,
        annee=2026,
        date_debut=date(2026, 1, 1),
        date_fin=date(2026, 12, 31),
        actif=True,
    )
    cat = TantiemeCategorie.objects.create(copropriete=copro, code="GEN", libelle="GEN", actif=True)
    lot = Lot.objects.create(copropriete=copro, reference="A101", type_lot="APPARTEMENT", description="Lot")
    LotTantieme.objects.create(lot=lot, categorie=cat, valeur=Decimal("100"))
    ag = AssembleeGenerale.objects.create(
        copropriete=copro,
        exercice=exo,
        titre="AG",
        date_ag=datetime(2026, 3, 25, 10, 0, tzinfo=dtz.utc),
        lieu="Salle test",
        statut="OUVERTE",
    )
    return copro, exo, cat, lot, ag


def test_travaux_validate_ag_refuse_budget_over_estime(admin_user, base_copro):
    copro, exo, cat, lot, ag = base_copro
    client = _auth_client(admin_user)

    dossier = DossierTravaux.objects.create(
        copropriete=copro,
        titre="T",
        description="x",
        statut=DossierTravaux.Statut.SOUMIS_AG,
        budget_estime=Decimal("1000.00"),
    )

    # crée résolution
    r = client.post(
        "/api/ag/resolutions/",
        data={"ag": ag.id, "ordre": 1, "titre": "R", "texte": "x", "type_majorite": "SIMPLE"},
        format="json",
        **_hdr(copro.id),
    )
    assert r.status_code == 201, r.data
    res_id = r.data["id"]

    # validate-ag avec budget_vote > budget_estime => 400
    r2 = client.post(
        f"/api/travaux/dossiers/{dossier.id}/validate-ag/",
        data={"resolution_id": res_id, "budget_vote": "2000.00"},
        format="json",
        **_hdr(copro.id),
    )
    assert r2.status_code == 400, r2.data


def test_travaux_link_resolution_cross_copro_refused(admin_user, base_copro):
    copro1, exo1, cat1, lot1, ag1 = base_copro
    client = _auth_client(admin_user)

    # copro2 + ag2 + resolution dans autre copro
    copro2 = Copropriete.objects.create(nom="C2")
    exo2 = Exercice.objects.create(
        copropriete=copro2, annee=2026, date_debut=date(2026, 1, 1), date_fin=date(2026, 12, 31), actif=True
    )
    ag2 = AssembleeGenerale.objects.create(
        copropriete=copro2,
        exercice=exo2,
        titre="AG2",
        date_ag=datetime(2026, 3, 25, 10, 0, tzinfo=dtz.utc),
        lieu="Salle test",
        statut="OUVERTE",
    )

    r = client.post(
        "/api/ag/resolutions/",
        data={"ag": ag2.id, "ordre": 1, "titre": "R2", "texte": "x", "type_majorite": "SIMPLE"},
        format="json",
        **_hdr(copro2.id),
    )
    assert r.status_code == 201, r.data
    res_other = r.data["id"]

    dossier = DossierTravaux.objects.create(
        copropriete=copro1,
        titre="D1",
        description="x",
        statut=DossierTravaux.Statut.SOUMIS_AG,
        budget_estime=Decimal("1000.00"),
    )

    # tentative link avec header copro1 mais res appartient copro2 => 400
    r2 = client.post(
        f"/api/travaux/dossiers/{dossier.id}/link-resolution/",
        data={"resolution_id": res_other},
        format="json",
        **_hdr(copro1.id),
    )
    assert r2.status_code == 400, r2.data


def test_travaux_unlink_ok_when_not_locked(admin_user, base_copro):
    copro, exo, cat, lot, ag = base_copro
    client = _auth_client(admin_user)

    dossier = DossierTravaux.objects.create(
        copropriete=copro,
        titre="D",
        description="x",
        statut=DossierTravaux.Statut.SOUMIS_AG,
        budget_estime=Decimal("1000.00"),
    )

    r = client.post(
        "/api/ag/resolutions/",
        data={"ag": ag.id, "ordre": 1, "titre": "R", "texte": "x", "type_majorite": "SIMPLE"},
        format="json",
        **_hdr(copro.id),
    )
    assert r.status_code == 201, r.data
    res_id = r.data["id"]

    # link
    r2 = client.post(
        f"/api/travaux/dossiers/{dossier.id}/link-resolution/",
        data={"resolution_id": res_id},
        format="json",
        **_hdr(copro.id),
    )
    assert r2.status_code == 200, r2.data

    # unlink doit passer
    r3 = client.post(
        f"/api/travaux/dossiers/{dossier.id}/unlink-resolution/",
        data={},
        format="json",
        **_hdr(copro.id),
    )
    assert r3.status_code == 200, r3.data