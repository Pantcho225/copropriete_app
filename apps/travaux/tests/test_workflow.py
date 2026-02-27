# apps/travaux/tests/test_workflow.py
from __future__ import annotations

from datetime import date, datetime, timezone as dtz
from decimal import Decimal

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from apps.core.models import Copropriete
from apps.billing.models import Exercice
from apps.lots.models import Lot, LotTantieme, TantiemeCategorie
from apps.ag.models import AssembleeGenerale, PresenceLot, Resolution  # ✅ besoin Resolution pour Test 4
from apps.travaux.models import DossierTravaux

pytestmark = pytest.mark.django_db


def _auth_client(user) -> APIClient:
    c = APIClient()
    c.force_authenticate(user=user)
    return c


def _hdr(copro_id: int) -> dict:
    # headers custom en tests DRF (X-Copropriete-Id)
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
def copro_exo_lots():
    copro = Copropriete.objects.create(nom="Copro Test")

    # ⚠️ ton Exercice impose date_debut/date_fin NOT NULL
    exo = Exercice.objects.create(
        copropriete=copro,
        annee=2026,
        date_debut=date(2026, 1, 1),
        date_fin=date(2026, 12, 31),
        actif=True,
    )

    # ✅ Catégorie obligatoire pour LotTantieme
    cat = TantiemeCategorie.objects.create(
        copropriete=copro,
        code="GEN",
        libelle="Tantièmes généraux",
        actif=True,
    )

    lot1 = Lot.objects.create(
        copropriete=copro,
        reference="A101",
        type_lot="APPARTEMENT",
        description="Lot 1",
    )
    lot2 = Lot.objects.create(
        copropriete=copro,
        reference="A102",
        type_lot="APPARTEMENT",
        description="Lot 2",
    )

    # ✅ tantièmes (120 / 80)
    LotTantieme.objects.create(lot=lot1, categorie=cat, valeur=Decimal("120"))
    LotTantieme.objects.create(lot=lot2, categorie=cat, valeur=Decimal("80"))

    return copro, exo, cat, lot1, lot2


def _create_open_ag(copro, exo):
    return AssembleeGenerale.objects.create(
        copropriete=copro,
        exercice=exo,
        titre="AG TEST TRAVAUX",
        date_ag=datetime(2026, 3, 25, 10, 0, tzinfo=dtz.utc),
        lieu="Salle test",
        statut="OUVERTE",
    )


def _init_presences_and_mark_present(client: APIClient, copro_id: int, ag_id: int):
    # init presences
    url_init = f"/api/ag/ags/{ag_id}/init-presences/"
    r = client.post(url_init, data={}, format="json", **_hdr(copro_id))
    assert r.status_code == 200, r.data

    pres = list(PresenceLot.objects.filter(ag_id=ag_id).order_by("id"))
    assert len(pres) >= 1

    # mark first as present
    p1 = pres[0]
    url_patch_presence = f"/api/ag/presences/{p1.id}/"
    r = client.patch(url_patch_presence, data={"present_ou_represente": True}, format="json", **_hdr(copro_id))
    assert r.status_code == 200, r.data
    p1.refresh_from_db()
    assert p1.present_ou_represente is True
    return pres


def _create_dossier_brouillon(copro, titre: str, budget_estime: Decimal) -> DossierTravaux:
    return DossierTravaux.objects.create(
        copropriete=copro,
        titre=titre,
        description="Test",
        statut=DossierTravaux.Statut.BROUILLON,
        budget_estime=budget_estime,
    )


def _submit_dossier(client: APIClient, copro_id: int, dossier_id: int):
    url_submit = f"/api/travaux/dossiers/{dossier_id}/submit-ag/"
    r = client.post(url_submit, data={}, format="json", **_hdr(copro_id))
    assert r.status_code == 200, r.data


def _create_resolution(client: APIClient, copro_id: int, ag_id: int, ordre: int, titre: str):
    url_res_create = "/api/ag/resolutions/"
    r = client.post(
        url_res_create,
        data={
            "ag": ag_id,
            "ordre": ordre,
            "titre": titre,
            "texte": "Texte test",
            "type_majorite": "SIMPLE",
        },
        format="json",
        **_hdr(copro_id),
    )
    assert r.status_code == 201, r.data
    return r.data["id"]


def _link_resolution(client: APIClient, copro_id: int, dossier_id: int, res_id: int):
    url_link = f"/api/travaux/dossiers/{dossier_id}/link-resolution/"
    return client.post(url_link, data={"resolution_id": res_id}, format="json", **_hdr(copro_id))


def _relink_resolution(client: APIClient, copro_id: int, dossier_id: int, res_id: int):
    url_relink = f"/api/travaux/dossiers/{dossier_id}/relink-resolution/"
    return client.post(url_relink, data={"resolution_id": res_id}, format="json", **_hdr(copro_id))


def _unlink_resolution(client: APIClient, copro_id: int, dossier_id: int):
    url_unlink = f"/api/travaux/dossiers/{dossier_id}/unlink-resolution/"
    return client.post(url_unlink, data={}, format="json", **_hdr(copro_id))


def _vote_pour(client: APIClient, copro_id: int, res_id: int, lot_id: int):
    url_vote = "/api/ag/votes/"
    return client.post(
        url_vote,
        data={"resolution": res_id, "lot": lot_id, "choix": "POUR"},
        format="json",
        **_hdr(copro_id),
    )


def _cloturer_resolution(client: APIClient, copro_id: int, res_id: int):
    url_cloture = f"/api/ag/resolutions/{res_id}/cloturer/"
    return client.post(url_cloture, data={}, format="json", **_hdr(copro_id))


def test_travaux_workflow_validate_and_lock(admin_user, copro_exo_lots):
    copro, exo, cat, lot1, lot2 = copro_exo_lots
    client = _auth_client(admin_user)

    # 1) Créer AG OUVERTE + init presences + lot1 présent
    ag = _create_open_ag(copro, exo)
    _init_presences_and_mark_present(client, copro.id, ag.id)

    # 2) Dossier BROUILLON -> submit => SOUMIS_AG
    dossier = _create_dossier_brouillon(copro, "Réfection toiture", Decimal("1500000.00"))
    _submit_dossier(client, copro.id, dossier.id)
    dossier.refresh_from_db()
    assert dossier.statut == DossierTravaux.Statut.SOUMIS_AG

    # 3) résolution + link
    res_id = _create_resolution(client, copro.id, ag.id, 1, "Vote Validation Dossier Travaux")
    r = _link_resolution(client, copro.id, dossier.id, res_id)
    assert r.status_code == 200, r.data
    dossier.refresh_from_db()
    assert dossier.resolution_validation_id == res_id

    # 4) vote POUR
    r = _vote_pour(client, copro.id, res_id, lot1.id)
    assert r.status_code == 201, r.data

    # 5) cloturer => dossier VALIDE + lock
    r = _cloturer_resolution(client, copro.id, res_id)
    assert r.status_code == 200, r.data
    assert r.data["decision"] == "ADOPTEE"
    assert r.data["dossier_travaux"]["statut"] == "VALIDE"

    dossier.refresh_from_db()
    assert dossier.statut == DossierTravaux.Statut.VALIDE
    assert dossier.is_locked is True
    assert dossier.locked_by_id == admin_user.id
    assert dossier.locked_at is not None

    # 6) idempotence cloture
    r2 = _cloturer_resolution(client, copro.id, res_id)
    assert r2.status_code == 200, r2.data
    assert r2.data.get("detail") in {"Déjà clôturée.", None}

    # 7) dossier locké: update interdit
    url_patch_dossier = f"/api/travaux/dossiers/{dossier.id}/"
    r = client.patch(url_patch_dossier, data={"titre": "Tentative modif"}, format="json", **_hdr(copro.id))
    assert r.status_code in (400, 403), r.data

    # 8) dossier locké: relink interdit
    r = _relink_resolution(client, copro.id, dossier.id, res_id)
    assert r.status_code in (400, 403), r.data


def test_travaux_majorite_and_vote_lock(admin_user, copro_exo_lots):
    """
    (Ton 2e test déjà validé chez toi)
    - Vérifie un scénario vote/clôture + verrouillage votes après clôture.
    """
    copro, exo, cat, lot1, lot2 = copro_exo_lots
    client = _auth_client(admin_user)

    ag = _create_open_ag(copro, exo)
    _init_presences_and_mark_present(client, copro.id, ag.id)

    dossier = _create_dossier_brouillon(copro, "Travaux peinture", Decimal("500000.00"))
    _submit_dossier(client, copro.id, dossier.id)
    dossier.refresh_from_db()
    assert dossier.statut == DossierTravaux.Statut.SOUMIS_AG

    res_id = _create_resolution(client, copro.id, ag.id, 1, "Vote Travaux peinture")
    r = _link_resolution(client, copro.id, dossier.id, res_id)
    assert r.status_code == 200, r.data

    # vote lot1 POUR -> adoptee
    r = _vote_pour(client, copro.id, res_id, lot1.id)
    assert r.status_code == 201, r.data

    r = _cloturer_resolution(client, copro.id, res_id)
    assert r.status_code == 200, r.data
    assert r.data["decision"] in {"ADOPTEE", "REJETEE"}

    # vote après clôture => refus
    r2 = _vote_pour(client, copro.id, res_id, lot2.id)
    assert r2.status_code in (400, 403), getattr(r2, "data", None)


def test_travaux_hardening_no_double_link_and_no_link_if_closed_or_locked(admin_user, copro_exo_lots):
    """
    ✅ Test 3 (hardening production-ready)

    Couvre:
    1) Une résolution ne peut pas être liée à deux dossiers
    2) Une résolution clôturée ne peut plus être liée
    3) Après verrouillage dossier => link/relink/unlink interdits
    4) Vote refusé sur résolution clôturée
    """
    copro, exo, cat, lot1, lot2 = copro_exo_lots
    client = _auth_client(admin_user)

    # AG + presences + lot1 présent
    ag = _create_open_ag(copro, exo)
    _init_presences_and_mark_present(client, copro.id, ag.id)

    # Dossier 1 + submit
    d1 = _create_dossier_brouillon(copro, "Dossier 1", Decimal("1000000.00"))
    _submit_dossier(client, copro.id, d1.id)
    d1.refresh_from_db()
    assert d1.statut == DossierTravaux.Statut.SOUMIS_AG

    # Dossier 2 + submit
    d2 = _create_dossier_brouillon(copro, "Dossier 2", Decimal("900000.00"))
    _submit_dossier(client, copro.id, d2.id)
    d2.refresh_from_db()
    assert d2.statut == DossierTravaux.Statut.SOUMIS_AG

    # Résolution R1
    r1_id = _create_resolution(client, copro.id, ag.id, 1, "Resolution unique")
    # Link R1 -> D1
    r = _link_resolution(client, copro.id, d1.id, r1_id)
    assert r.status_code == 200, r.data
    d1.refresh_from_db()
    assert d1.resolution_validation_id == r1_id

    # 🔥 Tentative de link R1 -> D2 (doit échouer)
    r_conflict = _link_resolution(client, copro.id, d2.id, r1_id)
    assert r_conflict.status_code in (400, 409), getattr(r_conflict, "data", None)
    d2.refresh_from_db()
    assert d2.resolution_validation_id is None

    # Vote POUR sur R1 puis clôture => D1 doit passer VALIDE + lock (via ton hook dans cloturer)
    r_vote = _vote_pour(client, copro.id, r1_id, lot1.id)
    assert r_vote.status_code == 201, r_vote.data

    r_close = _cloturer_resolution(client, copro.id, r1_id)
    assert r_close.status_code == 200, r_close.data
    assert r_close.data["decision"] == "ADOPTEE"
    assert r_close.data["dossier_travaux"]["dossier_id"] == d1.id

    d1.refresh_from_db()
    assert d1.is_locked is True
    assert d1.statut == DossierTravaux.Statut.VALIDE

    # ✅ Après lock: unlink interdit
    r_unlink = _unlink_resolution(client, copro.id, d1.id)
    assert r_unlink.status_code in (400, 403), getattr(r_unlink, "data", None)

    # ✅ Après lock: relink interdit
    r2_id = _create_resolution(client, copro.id, ag.id, 2, "Autre resolution")
    r_relink = _relink_resolution(client, copro.id, d1.id, r2_id)
    assert r_relink.status_code in (400, 403), getattr(r_relink, "data", None)

    # ✅ Résolution clôturée ne peut plus être liée
    # r1 est clôturée, d2 est libre -> link doit échouer
    r_link_closed = _link_resolution(client, copro.id, d2.id, r1_id)
    assert r_link_closed.status_code in (400, 409), getattr(r_link_closed, "data", None)

    # ✅ Vote après clôture => refus
    r_vote_after = _vote_pour(client, copro.id, r1_id, lot2.id)
    assert r_vote_after.status_code in (400, 403), getattr(r_vote_after, "data", None)


def test_travaux_resolution_mirror_consistency_on_link_relink_unlink(admin_user, copro_exo_lots):
    """
    ✅ Test 4 (best / prod-grade)

    Objectif: garantir la cohérence du miroir Resolution.travaux_dossier avec
    DossierTravaux.resolution_validation, sur link/relink/unlink.

    - link-resolution => dossier.resolution_validation = res1 ET res1.travaux_dossier = dossier
    - relink-resolution => res1.travaux_dossier nettoyé (NULL) ET res2.travaux_dossier = dossier
    - unlink-resolution => dossier.resolution_validation NULL ET res2.travaux_dossier NULL
    """
    copro, exo, cat, lot1, lot2 = copro_exo_lots
    client = _auth_client(admin_user)

    # AG + presences + rendre un lot présent
    ag = _create_open_ag(copro, exo)
    _init_presences_and_mark_present(client, copro.id, ag.id)

    # dossier soumis AG
    dossier = _create_dossier_brouillon(copro, "Dossier miroir", Decimal("800000.00"))
    _submit_dossier(client, copro.id, dossier.id)
    dossier.refresh_from_db()
    assert dossier.statut == DossierTravaux.Statut.SOUMIS_AG

    # 2 résolutions
    res1_id = _create_resolution(client, copro.id, ag.id, 1, "Resolution 1 (miroir)")
    res2_id = _create_resolution(client, copro.id, ag.id, 2, "Resolution 2 (miroir)")

    # LINK res1
    r = _link_resolution(client, copro.id, dossier.id, res1_id)
    assert r.status_code == 200, r.data

    dossier.refresh_from_db()
    assert dossier.resolution_validation_id == res1_id

    res1 = Resolution.objects.get(pk=res1_id)
    assert hasattr(res1, "travaux_dossier_id"), (
        "Le modèle Resolution doit avoir le champ miroir travaux_dossier (FK) "
        "pour que ce test soit applicable."
    )
    assert res1.travaux_dossier_id == dossier.id

    # RELINK vers res2
    r = _relink_resolution(client, copro.id, dossier.id, res2_id)
    assert r.status_code == 200, r.data

    dossier.refresh_from_db()
    assert dossier.resolution_validation_id == res2_id

    # ancien miroir nettoyé
    res1.refresh_from_db()
    assert res1.travaux_dossier_id is None, "Ancien miroir non nettoyé: res1.travaux_dossier doit être NULL"

    # nouveau miroir OK
    res2 = Resolution.objects.get(pk=res2_id)
    assert res2.travaux_dossier_id == dossier.id

    # UNLINK
    r = _unlink_resolution(client, copro.id, dossier.id)
    assert r.status_code == 200, r.data

    dossier.refresh_from_db()
    assert dossier.resolution_validation_id is None

    res2.refresh_from_db()
    assert res2.travaux_dossier_id is None, "Miroir non nettoyé après unlink: res2.travaux_dossier doit être NULL"