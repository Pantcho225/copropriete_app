# apps/ag/tests/test_ag_workflow.py
from __future__ import annotations

from datetime import date, datetime, timezone as dtz
from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import patch

import pytest
from django.contrib.auth import get_user_model
from django.core.files.base import ContentFile

from rest_framework.test import APIClient

from apps.core.models import Copropriete
from apps.billing.models import Exercice
from apps.lots.models import Lot, LotTantieme, TantiemeCategorie
from apps.ag.models import AssembleeGenerale, PresenceLot, Resolution


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
def copro_exo_cat_lots():
    copro = Copropriete.objects.create(nom="Copro Test")
    exo = Exercice.objects.create(
        copropriete=copro,
        annee=2026,
        date_debut=date(2026, 1, 1),
        date_fin=date(2026, 12, 31),
        actif=True,
    )
    cat = TantiemeCategorie.objects.create(
        copropriete=copro,
        code="GEN",
        libelle="Tantièmes généraux",
        actif=True,
    )

    lot1 = Lot.objects.create(copropriete=copro, reference="A101", type_lot="APPARTEMENT", description="Lot 1")
    lot2 = Lot.objects.create(copropriete=copro, reference="A102", type_lot="APPARTEMENT", description="Lot 2")

    LotTantieme.objects.create(lot=lot1, categorie=cat, valeur=Decimal("120"))
    LotTantieme.objects.create(lot=lot2, categorie=cat, valeur=Decimal("80"))

    return copro, exo, cat, lot1, lot2


def _create_open_ag(copro, exo) -> AssembleeGenerale:
    return AssembleeGenerale.objects.create(
        copropriete=copro,
        exercice=exo,
        titre="AG TEST",
        date_ag=datetime(2026, 3, 25, 10, 0, tzinfo=dtz.utc),
        lieu="Salle test",
        statut="OUVERTE",
    )


def _init_presences(client: APIClient, copro_id: int, ag_id: int):
    url = f"/api/ag/ags/{ag_id}/init-presences/"
    r = client.post(url, data={}, format="json", **_hdr(copro_id))
    assert r.status_code == 200, r.data
    return list(PresenceLot.objects.filter(ag_id=ag_id).order_by("id"))


def _mark_presence(client: APIClient, copro_id: int, presence_id: int, present: bool):
    url = f"/api/ag/presences/{presence_id}/"
    r = client.patch(url, data={"present_ou_represente": present}, format="json", **_hdr(copro_id))
    assert r.status_code == 200, r.data


def _archive_fake_pv(ag: AssembleeGenerale, pdf_bytes: bytes = b"%PDF-FAKE"):
    # simule un PV archivé existant (pv_pdf + hash + pv_generated_at)
    ag.pv_pdf.save(f"PV-AG-{ag.id:05d}.pdf", ContentFile(pdf_bytes), save=False)
    ag.pv_pdf_hash = __import__("hashlib").sha256(pdf_bytes).hexdigest()
    ag.pv_generated_at = datetime.now(tz=dtz.utc)
    ag.save(update_fields=["pv_pdf", "pv_pdf_hash", "pv_generated_at"])


def _set_signed_pv_fields(ag: AssembleeGenerale, signed_bytes: bytes = b"%PDF-SIGNED"):
    ag.pv_signed_pdf.save(f"PV-AG-{ag.id:05d}-SIGNE.pdf", ContentFile(signed_bytes), save=False)
    ag.pv_signed_hash = __import__("hashlib").sha256(signed_bytes).hexdigest()
    ag.pv_signed_at = datetime.now(tz=dtz.utc)
    ag.pv_signer_subject = "CN=Test"
    ag.pv_locked = True
    ag.save(update_fields=["pv_signed_pdf", "pv_signed_hash", "pv_signed_at", "pv_signer_subject", "pv_locked"])


# -------------------------
# TEST 1 — quorum atteint / non atteint
# -------------------------
def test_ag_quorum_endpoint(admin_user, copro_exo_cat_lots):
    copro, exo, cat, lot1, lot2 = copro_exo_cat_lots
    client = _auth_client(admin_user)

    ag = _create_open_ag(copro, exo)
    pres = _init_presences(client, copro.id, ag.id)
    assert len(pres) == 2

    # Mark lot1 present => 120/200 = 60% => quorum ok si seuil 50%
    _mark_presence(client, copro.id, pres[0].id, True)

    r = client.get(f"/api/ag/ags/{ag.id}/quorum/", **_hdr(copro.id))
    assert r.status_code == 200, r.data
    assert r.data["quorum_atteint"] is True


def test_ag_close_refuse_if_quorum_not_reached(admin_user, copro_exo_cat_lots):
    copro, exo, cat, lot1, lot2 = copro_exo_cat_lots
    client = _auth_client(admin_user)

    ag = _create_open_ag(copro, exo)
    pres = _init_presences(client, copro.id, ag.id)
    # Mark lot2 present => 80/200 = 40% => quorum KO
    _mark_presence(client, copro.id, pres[1].id, True)

    # Simule PV signé + lock (sinon close refuserait avant quorum)
    _archive_fake_pv(ag)
    _set_signed_pv_fields(ag)

    r = client.post(f"/api/ag/ags/{ag.id}/close/", data={}, format="json", **_hdr(copro.id))
    assert r.status_code == 400, r.data
    assert "Quorum" in str(r.data)


# -------------------------
# TEST 2 — close refuse si PV non signé
# -------------------------
def test_ag_close_refuse_if_not_signed(admin_user, copro_exo_cat_lots):
    copro, exo, cat, lot1, lot2 = copro_exo_cat_lots
    client = _auth_client(admin_user)

    ag = _create_open_ag(copro, exo)
    pres = _init_presences(client, copro.id, ag.id)
    _mark_presence(client, copro.id, pres[0].id, True)  # quorum ok

    _archive_fake_pv(ag)  # PV archivé mais pas signé

    r = client.post(f"/api/ag/ags/{ag.id}/close/", data={}, format="json", **_hdr(copro.id))
    assert r.status_code == 400, r.data
    assert "PV signé" in str(r.data["detail"])


# -------------------------
# TEST 3 — close idempotent + statut cloturée
# -------------------------
def test_ag_close_idempotent(admin_user, copro_exo_cat_lots):
    copro, exo, cat, lot1, lot2 = copro_exo_cat_lots
    client = _auth_client(admin_user)

    ag = _create_open_ag(copro, exo)
    pres = _init_presences(client, copro.id, ag.id)
    _mark_presence(client, copro.id, pres[0].id, True)

    _archive_fake_pv(ag)
    _set_signed_pv_fields(ag)

    r1 = client.post(f"/api/ag/ags/{ag.id}/close/", data={}, format="json", **_hdr(copro.id))
    assert r1.status_code == 200, r1.data
    assert r1.data["statut"] == "CLOTUREE"

    r2 = client.post(f"/api/ag/ags/{ag.id}/close/", data={}, format="json", **_hdr(copro.id))
    assert r2.status_code == 200, r2.data
    assert "déjà clôturée" in str(r2.data).lower()


# -------------------------
# TEST 4 — majorités (SIMPLE / ABSOLUE / 2/3 / UNANIMITE) via endpoint resultat
# -------------------------
@pytest.mark.parametrize(
    "type_majorite, votes, expected",
    [
        ("SIMPLE",  {"POUR": 120, "CONTRE": 80}, "ADOPTEE"),
        ("ABSOLUE", {"POUR": 100, "CONTRE": 100}, "REJETEE"),
        ("QUALIFIEE_2_3", {"POUR": 134, "CONTRE": 66}, "ADOPTEE"),
        ("UNANIMITE", {"POUR": 200, "CONTRE": 0}, "ADOPTEE"),
    ],
)
def test_resolution_majorites_resultat(admin_user, copro_exo_cat_lots, type_majorite, votes, expected):
    copro, exo, cat, lot1, lot2 = copro_exo_cat_lots
    client = _auth_client(admin_user)

    ag = _create_open_ag(copro, exo)

    # on crée une résolution
    r = client.post(
        "/api/ag/resolutions/",
        data={
            "ag": ag.id,
            "ordre": 1,
            "titre": f"Test {type_majorite}",
            "texte": "x",
            "type_majorite": type_majorite,
        },
        format="json",
        **_hdr(copro.id),
    )
    assert r.status_code == 201, r.data
    res_id = r.data["id"]

    # On “injecte” des votes en DB avec tantièmes (on évite les règles de présence ici)
    # lot1=120, lot2=80 => total 200
    from apps.ag.models import Vote  # import local pour éviter cycles

    Vote.objects.all().delete()
    if votes.get("POUR", 0) == 200:
        Vote.objects.create(resolution_id=res_id, lot=lot1, choix="POUR", tantiemes=Decimal("120"))
        Vote.objects.create(resolution_id=res_id, lot=lot2, choix="POUR", tantiemes=Decimal("80"))
    else:
        # répartit arbitrairement sur lot1/lot2 pour atteindre les sommes voulues
        if votes.get("POUR", 0) > 0:
            Vote.objects.create(resolution_id=res_id, lot=lot1, choix="POUR", tantiemes=Decimal(str(min(votes["POUR"], 120))))
            remaining = votes["POUR"] - min(votes["POUR"], 120)
            if remaining > 0:
                Vote.objects.create(resolution_id=res_id, lot=lot2, choix="POUR", tantiemes=Decimal(str(remaining)))
        if votes.get("CONTRE", 0) > 0:
            Vote.objects.create(resolution_id=res_id, lot=lot2, choix="CONTRE", tantiemes=Decimal(str(min(votes["CONTRE"], 80))))
            remaining = votes["CONTRE"] - min(votes["CONTRE"], 80)
            if remaining > 0:
                Vote.objects.create(resolution_id=res_id, lot=lot1, choix="CONTRE", tantiemes=Decimal(str(remaining)))

    rres = client.get(f"/api/ag/resolutions/{res_id}/resultat/", **_hdr(copro.id))
    assert rres.status_code == 200, rres.data
    assert rres.data["decision"] == expected


# -------------------------
# TEST 5 — pv/archive mock bytes
# -------------------------
@patch("apps.ag.views.generate_ag_pv_pdf_bytes", return_value=b"%PDF-MOCK")
def test_ag_pv_archive_ok(mock_gen, admin_user, copro_exo_cat_lots):
    copro, exo, cat, lot1, lot2 = copro_exo_cat_lots
    client = _auth_client(admin_user)

    ag = _create_open_ag(copro, exo)

    r = client.post(f"/api/ag/ags/{ag.id}/pv/archive/", data={}, format="json", **_hdr(copro.id))
    assert r.status_code == 200, r.data
    ag.refresh_from_db()
    assert ag.pv_pdf
    assert ag.pv_pdf_hash
    assert ag.pv_generated_at is not None


# -------------------------
# TEST 6 — pv/sign mock pades
# -------------------------
@patch("apps.ag.views.sign_pdf_pades")
def test_ag_pv_sign_ok_mocked(mock_sign, admin_user, copro_exo_cat_lots):
    copro, exo, cat, lot1, lot2 = copro_exo_cat_lots
    client = _auth_client(admin_user)

    ag = _create_open_ag(copro, exo)
    _archive_fake_pv(ag, pdf_bytes=b"%PDF-ARCHIVE")

    # mock retour pyHanko wrapper
    mock_sign.return_value = SimpleNamespace(
        signed_pdf_bytes=b"%PDF-SIGNED-MOCK",
        signer_subject="CN=AG Test",
    )

    # simulate upload pfx + password
    from django.core.files.uploadedfile import SimpleUploadedFile
    pfx = SimpleUploadedFile("cert.p12", b"FAKEPFX", content_type="application/x-pkcs12")

    r = client.post(
        f"/api/ag/ags/{ag.id}/pv/sign/",
        data={"pfx": pfx, "password": "secret"},
        format="multipart",
        **_hdr(copro.id),
    )
    assert r.status_code == 200, r.data
    ag.refresh_from_db()
    assert ag.pv_signed_pdf
    assert ag.pv_signed_hash
    assert ag.pv_locked is True