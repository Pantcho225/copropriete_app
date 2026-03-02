# apps/compta/tests/test_phase5_final.py
from __future__ import annotations

import csv
import io
from datetime import date, timedelta
from decimal import Decimal

import pytest
from django.apps import apps
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile  # ✅ AJOUT: upload multipart fiable
from django.utils import timezone
from rest_framework.test import APIClient

pytestmark = pytest.mark.django_db


# =========================
# URLs EXACTES (confirmées par show_urls)
# =========================
URL_IMPORT_CSV = "/api/compta/releves/imports/import-csv/"
URL_IMPORT_LIGNES = "/api/compta/releves/imports/{import_id}/lignes/"
URL_LIGNE_RAPPROCHER = "/api/compta/releves/lignes/{ligne_id}/rapprocher/"
URL_LIGNE_ANNULER_RAPPRO = "/api/compta/releves/lignes/{ligne_id}/annuler-rapprochement/"
URL_RAPPRO_STATS = "/api/compta/rapprochements/stats/"


# =========================
# Helpers "safe" création minimale
# =========================
def _get_model_any(app_labels: list[str], model_name: str):
    for al in app_labels:
        try:
            return apps.get_model(al, model_name)
        except Exception:
            continue
    raise LookupError(f"Impossible de résoudre le modèle {model_name} via {app_labels}")


def _field_names(Model) -> set[str]:
    return {f.name for f in Model._meta.fields}


def _create_min(Model, *, idx: int = 1, **overrides):
    """
    Création minimale robuste : remplit les champs NOT NULL sans default.
    ⚠️ Ne gère pas automatiquement les FK (à passer dans overrides).
    """
    from django.db import models

    data = {}

    for f in Model._meta.fields:
        if f.primary_key:
            continue
        name = f.name
        if name in overrides:
            continue

        # FK/OneToOne => à fournir via overrides
        if isinstance(f, (models.ForeignKey, models.OneToOneField)):
            continue

        if getattr(f, "null", True) is False and getattr(f, "has_default", lambda: False)() is False:
            # Types courants
            if isinstance(f, (models.CharField, models.TextField)):
                data[name] = f"{name.upper()}_{idx}"
            elif isinstance(f, (models.IntegerField, models.PositiveIntegerField)):
                data[name] = idx
            elif isinstance(f, models.BooleanField):
                data[name] = True
            elif isinstance(f, models.DecimalField):
                data[name] = Decimal("1.00")
            elif isinstance(f, models.DateTimeField):
                data[name] = timezone.now()
            elif isinstance(f, models.DateField):
                data[name] = date.today()
            else:
                # fallback: tente une valeur "simple"
                data[name] = f.get_default() if getattr(f, "has_default", lambda: False)() else None

    data.update(overrides)
    return Model.objects.create(**data)


def _make_csv_credit_debit(
    *,
    credit: str = "10000",
    debit: str = "",
    balance: str = "293000",
    delim: str = ";",
) -> bytes:
    rows = [
        {
            "date_operation": "08/03/2026",
            "description": "REMBOURSEMENT",
            "debit": debit,
            "credit": credit,
            "balance": balance,
        }
    ]
    buf = io.StringIO()
    w = csv.DictWriter(buf, fieldnames=list(rows[0].keys()), delimiter=delim)
    w.writeheader()
    w.writerows(rows)
    return buf.getvalue().encode("utf-8")


def _post_import_csv(client: APIClient, headers: dict, csv_bytes: bytes, filename: str = "releve.csv"):
    """
    ✅ IMPORTANT:
    Le view import-csv attend un vrai fichier dans request.FILES.
    Avec APIClient, il faut utiliser SimpleUploadedFile.
    Le endpoint accepte "file" OU "fichier" -> on envoie "file" (et aussi "fichier" pour robustesse).
    """
    up = SimpleUploadedFile(filename, csv_bytes, content_type="text/csv")
    return client.post(
        URL_IMPORT_CSV,
        {"file": up, "fichier": up, "delimiter": ";"},
        format="multipart",
        **headers,
    )


def _first_releve_ligne_id(client: APIClient, headers: dict, import_id: int) -> int:
    r = client.get(URL_IMPORT_LIGNES.format(import_id=import_id), **headers)
    assert r.status_code == 200, r.content
    data = r.json()
    items = data.get("results", data)
    assert items, data
    return int(items[0]["id"])


# =========================
# Fixtures locales (dans le même fichier)
# =========================
@pytest.fixture
def api_client() -> APIClient:
    return APIClient()


@pytest.fixture
def admin_user(db):
    User = get_user_model()
    u = User.objects.create_user(username="admin", email="admin@example.com", password="adminpass123")
    if hasattr(u, "is_staff"):
        u.is_staff = True
    if hasattr(u, "is_superuser"):
        u.is_superuser = True
    u.save()
    return u


@pytest.fixture
def auth_client(api_client: APIClient, admin_user):
    api_client.force_authenticate(user=admin_user)
    return api_client


@pytest.fixture
def copro(db):
    Copropriete = _get_model_any(["core"], "Copropriete")
    return _create_min(Copropriete, idx=1)


@pytest.fixture
def headers_copro(copro):
    return {"HTTP_X_COPROPRIETE_ID": str(copro.id)}


@pytest.fixture
def billing_objects(db, copro):
    """
    Crée la chaîne minimale :
    Exercice -> AppelDeFonds -> LigneAppelDeFonds (avec Lot) -> PaiementAppel.
    ⚠️ On évite TantiemeCategorie car AppelDeFonds.tantieme_categorie est nullable.
    """
    Exercice = _get_model_any(["billing", "billing_app"], "Exercice")
    Appel = _get_model_any(["billing", "billing_app"], "AppelDeFonds")
    Ligne = _get_model_any(["billing", "billing_app"], "LigneAppelDeFonds")
    PaiementAppel = _get_model_any(["billing", "billing_app"], "PaiementAppel")
    Lot = _get_model_any(["lots"], "Lot")

    # lot (si champ copropriete existe, on le renseigne)
    lot_kwargs = {}
    if "copropriete" in _field_names(Lot):
        lot_kwargs["copropriete"] = copro
    elif "copropriete_id" in _field_names(Lot):
        lot_kwargs["copropriete_id"] = copro.id
    lot = _create_min(Lot, idx=1, **lot_kwargs)

    # exercice
    today = date.today()
    ex = Exercice.objects.create(
        copropriete=copro,
        annee=today.year,
        date_debut=date(today.year, 1, 1),
        date_fin=date(today.year, 12, 31),
        actif=True,
    )

    # appel
    appel = Appel.objects.create(
        exercice=ex,
        libelle="Appel test",
        type_appel="PERIODIQUE",
        date_echeance=today + timedelta(days=30),
        montant_total=Decimal("40000.00"),
        genere=True,
    )

    # ligne
    ligne = Ligne.objects.create(
        appel=appel,
        lot=lot,
        tantiemes=Decimal("100.0000"),
        montant_du=Decimal("40000.00"),
        montant_paye=Decimal("0.00"),
        statut="IMPAYE",
    )

    # paiement 10 000 (même montant que la ligne de relevé CSV)
    paiement = PaiementAppel.objects.create(
        ligne=ligne,
        montant=Decimal("10000.00"),
        mode="VIREMENT",
        reference="VIR-001",
        commentaire="Paiement test",
    )

    return {
        "PaiementAppel": PaiementAppel,
        "ligne_appel": ligne,
        "paiement_10000": paiement,
    }


@pytest.fixture
def paiement_appel_cancelled(billing_objects, admin_user):
    p = billing_objects["paiement_10000"]
    # utilise la méthode cancel() du modèle (soft-cancel + recalcul)
    p.cancel(user=admin_user, reason="cancel test")
    p.refresh_from_db()
    return p


@pytest.fixture
def billing_objects_other_copro(db):
    """
    Même chaîne mais dans une autre copropriété.
    """
    Copropriete = _get_model_any(["core"], "Copropriete")
    copro2 = _create_min(Copropriete, idx=99)

    Exercice = _get_model_any(["billing", "billing_app"], "Exercice")
    Appel = _get_model_any(["billing", "billing_app"], "AppelDeFonds")
    Ligne = _get_model_any(["billing", "billing_app"], "LigneAppelDeFonds")
    PaiementAppel = _get_model_any(["billing", "billing_app"], "PaiementAppel")
    Lot = _get_model_any(["lots"], "Lot")

    lot_kwargs = {}
    if "copropriete" in _field_names(Lot):
        lot_kwargs["copropriete"] = copro2
    elif "copropriete_id" in _field_names(Lot):
        lot_kwargs["copropriete_id"] = copro2.id
    lot2 = _create_min(Lot, idx=99, **lot_kwargs)

    today = date.today()
    ex2 = Exercice.objects.create(
        copropriete=copro2,
        annee=today.year,
        date_debut=date(today.year, 1, 1),
        date_fin=date(today.year, 12, 31),
        actif=True,
    )
    appel2 = Appel.objects.create(
        exercice=ex2,
        libelle="Appel copro2",
        type_appel="PERIODIQUE",
        date_echeance=today + timedelta(days=30),
        montant_total=Decimal("40000.00"),
        genere=True,
    )
    ligne2 = Ligne.objects.create(
        appel=appel2,
        lot=lot2,
        tantiemes=Decimal("100.0000"),
        montant_du=Decimal("40000.00"),
        montant_paye=Decimal("0.00"),
        statut="IMPAYE",
    )
    paiement2 = PaiementAppel.objects.create(
        ligne=ligne2,
        montant=Decimal("10000.00"),
        mode="VIREMENT",
        reference="VIR-OTHER",
        commentaire="Paiement autre copro",
    )
    return {"copro2": copro2, "paiement2": paiement2}


# =========================
# TESTS "FIN PHASE 5"
# =========================
def test_phase5_1_import_csv_ok(auth_client, headers_copro):
    csv_bytes = _make_csv_credit_debit(credit="10000")
    r = _post_import_csv(auth_client, headers_copro, csv_bytes)
    assert r.status_code in (200, 201), r.content
    payload = r.json()
    assert "import_id" in payload
    assert payload.get("nb_lignes", 0) >= 1


def test_phase5_2_import_csv_refuse_hash_identique(auth_client, headers_copro):
    csv_bytes = _make_csv_credit_debit(credit="10000")

    r1 = _post_import_csv(auth_client, headers_copro, csv_bytes, filename="a.csv")
    assert r1.status_code in (200, 201), r1.content

    r2 = _post_import_csv(auth_client, headers_copro, csv_bytes, filename="b.csv")
    assert r2.status_code in (400, 409), r2.content


def test_phase5_3_rapprochement_ok_paiement_appel(auth_client, headers_copro, billing_objects):
    # Import -> récupère la ligne de relevé
    csv_bytes = _make_csv_credit_debit(credit="10000")
    r = _post_import_csv(auth_client, headers_copro, csv_bytes)
    assert r.status_code in (200, 201), r.content
    import_id = r.json()["import_id"]
    releve_ligne_id = _first_releve_ligne_id(auth_client, headers_copro, import_id)

    paiement = billing_objects["paiement_10000"]

    payload = {
        "type_cible": "PAIEMENT_APPEL",
        "cible_id": paiement.id,
        "strict_amount": True,
        "note": "Match test",
    }
    r2 = auth_client.post(
        URL_LIGNE_RAPPROCHER.format(ligne_id=releve_ligne_id),
        payload,
        format="json",
        **headers_copro,
    )
    assert r2.status_code in (200, 201), r2.content
    data = r2.json()
    assert data["type_cible"] == "PAIEMENT_APPEL"
    assert int(data["cible_id"]) == int(paiement.id)


def test_phase5_4_rapprochement_refuse_si_paiement_annule(auth_client, headers_copro, paiement_appel_cancelled):
    # Import -> ligne
    csv_bytes = _make_csv_credit_debit(credit="10000")
    r = _post_import_csv(auth_client, headers_copro, csv_bytes)
    assert r.status_code in (200, 201), r.content
    import_id = r.json()["import_id"]
    releve_ligne_id = _first_releve_ligne_id(auth_client, headers_copro, import_id)

    payload = {
        "type_cible": "PAIEMENT_APPEL",
        "cible_id": paiement_appel_cancelled.id,
        "strict_amount": True,
    }
    r2 = auth_client.post(
        URL_LIGNE_RAPPROCHER.format(ligne_id=releve_ligne_id),
        payload,
        format="json",
        **headers_copro,
    )
    assert r2.status_code in (400, 409), r2.content


def test_phase5_5_refuse_cross_copro(auth_client, headers_copro, billing_objects_other_copro):
    # ligne de relevé dans copro1, paiement dans copro2 -> doit refuser
    csv_bytes = _make_csv_credit_debit(credit="10000")
    r = _post_import_csv(auth_client, headers_copro, csv_bytes)
    assert r.status_code in (200, 201), r.content
    releve_ligne_id = _first_releve_ligne_id(auth_client, headers_copro, r.json()["import_id"])

    paiement2 = billing_objects_other_copro["paiement2"]

    payload = {"type_cible": "PAIEMENT_APPEL", "cible_id": paiement2.id, "strict_amount": True}
    r2 = auth_client.post(
        URL_LIGNE_RAPPROCHER.format(ligne_id=releve_ligne_id),
        payload,
        format="json",
        **headers_copro,
    )
    assert r2.status_code in (400, 403), r2.content


def test_phase5_6_refuse_deja_rapprochee_sans_allow_retarget(auth_client, headers_copro, billing_objects):
    # 1) rapprocher une première fois
    csv_bytes = _make_csv_credit_debit(credit="10000")
    r = _post_import_csv(auth_client, headers_copro, csv_bytes)
    assert r.status_code in (200, 201), r.content
    releve_ligne_id = _first_releve_ligne_id(auth_client, headers_copro, r.json()["import_id"])

    paiement = billing_objects["paiement_10000"]

    payload = {"type_cible": "PAIEMENT_APPEL", "cible_id": paiement.id, "strict_amount": True}
    r1 = auth_client.post(
        URL_LIGNE_RAPPROCHER.format(ligne_id=releve_ligne_id),
        payload,
        format="json",
        **headers_copro,
    )
    assert r1.status_code in (200, 201), r1.content

    # 2) retenter sans allow_retarget -> refus "déjà rapprochée"
    r2 = auth_client.post(
        URL_LIGNE_RAPPROCHER.format(ligne_id=releve_ligne_id),
        payload,
        format="json",
        **headers_copro,
    )
    assert r2.status_code in (400, 409), r2.content


def test_phase5_7_retarget_ok_si_allow_retarget_et_reason(auth_client, headers_copro, billing_objects):
    """
    - rapprocher -> rapprochement actif
    - créer un autre paiement -> retarget vers celui-là
    - allow_retarget=true + retarget_reason obligatoire
    """
    PaiementAppel = billing_objects["PaiementAppel"]
    ligne_appel = billing_objects["ligne_appel"]
    p1 = billing_objects["paiement_10000"]

    # deuxième paiement (même montant 10k) => autorisé car la ligne n'est pas soldée (40k)
    p2 = PaiementAppel.objects.create(
        ligne=ligne_appel,
        montant=Decimal("10000.00"),
        mode="VIREMENT",
        reference="VIR-002",
        commentaire="Paiement 2",
    )

    # Import -> ligne relevé
    csv_bytes = _make_csv_credit_debit(credit="10000")
    r = _post_import_csv(auth_client, headers_copro, csv_bytes)
    assert r.status_code in (200, 201), r.content
    releve_ligne_id = _first_releve_ligne_id(auth_client, headers_copro, r.json()["import_id"])

    # rapprocher sur p1
    r1 = auth_client.post(
        URL_LIGNE_RAPPROCHER.format(ligne_id=releve_ligne_id),
        {"type_cible": "PAIEMENT_APPEL", "cible_id": p1.id, "strict_amount": True},
        format="json",
        **headers_copro,
    )
    assert r1.status_code in (200, 201), r1.content

    # retarget vers p2
    r2 = auth_client.post(
        URL_LIGNE_RAPPROCHER.format(ligne_id=releve_ligne_id),
        {
            "type_cible": "PAIEMENT_APPEL",
            "cible_id": p2.id,
            "strict_amount": True,
            "allow_retarget": True,
            "retarget_reason": "Correction: mauvais paiement associé",
        },
        format="json",
        **headers_copro,
    )
    assert r2.status_code in (200, 201), r2.content
    data = r2.json()
    assert data["type_cible"] == "PAIEMENT_APPEL"
    assert int(data["cible_id"]) == int(p2.id)
    # audit retarget présent
    assert int(data.get("retarget_count") or 0) >= 1


def test_phase5_8_retarget_refuse_si_reason_vide(auth_client, headers_copro, billing_objects):
    """
    allow_retarget=true sans retarget_reason (et note vide) => refus.
    """
    PaiementAppel = billing_objects["PaiementAppel"]
    ligne_appel = billing_objects["ligne_appel"]
    p1 = billing_objects["paiement_10000"]

    p2 = PaiementAppel.objects.create(
        ligne=ligne_appel,
        montant=Decimal("10000.00"),
        mode="VIREMENT",
        reference="VIR-003",
        commentaire="Paiement 3",
    )

    csv_bytes = _make_csv_credit_debit(credit="10000")
    r = _post_import_csv(auth_client, headers_copro, csv_bytes)
    assert r.status_code in (200, 201), r.content
    releve_ligne_id = _first_releve_ligne_id(auth_client, headers_copro, r.json()["import_id"])

    # rapprocher sur p1
    r1 = auth_client.post(
        URL_LIGNE_RAPPROCHER.format(ligne_id=releve_ligne_id),
        {"type_cible": "PAIEMENT_APPEL", "cible_id": p1.id, "strict_amount": True},
        format="json",
        **headers_copro,
    )
    assert r1.status_code in (200, 201), r1.content

    # retarget sans raison
    r2 = auth_client.post(
        URL_LIGNE_RAPPROCHER.format(ligne_id=releve_ligne_id),
        {
            "type_cible": "PAIEMENT_APPEL",
            "cible_id": p2.id,
            "strict_amount": True,
            "allow_retarget": True,
            "retarget_reason": "",
            "note": "",
        },
        format="json",
        **headers_copro,
    )
    assert r2.status_code in (400, 409), r2.content


def test_phase5_9_strict_amount_refuse_si_montants_diff(auth_client, headers_copro, billing_objects):
    # Import 10k, paiement 9k => strict_amount=True => refus
    PaiementAppel = billing_objects["PaiementAppel"]
    ligne_appel = billing_objects["ligne_appel"]

    p_9000 = PaiementAppel.objects.create(
        ligne=ligne_appel,
        montant=Decimal("9000.00"),
        mode="VIREMENT",
        reference="VIR-9000",
        commentaire="Paiement 9000",
    )

    csv_bytes = _make_csv_credit_debit(credit="10000")
    r = _post_import_csv(auth_client, headers_copro, csv_bytes)
    assert r.status_code in (200, 201), r.content
    releve_ligne_id = _first_releve_ligne_id(auth_client, headers_copro, r.json()["import_id"])

    r2 = auth_client.post(
        URL_LIGNE_RAPPROCHER.format(ligne_id=releve_ligne_id),
        {"type_cible": "PAIEMENT_APPEL", "cible_id": p_9000.id, "strict_amount": True},
        format="json",
        **headers_copro,
    )
    assert r2.status_code in (400, 409), r2.content


def test_phase5_10_annuler_rapprochement_idempotent(auth_client, headers_copro, billing_objects):
    """
    - rapprocher
    - annuler-rapprochement
    - ré-appeler annuler-rapprochement => doit rester stable (idempotent)
    """
    csv_bytes = _make_csv_credit_debit(credit="10000")
    r = _post_import_csv(auth_client, headers_copro, csv_bytes)
    assert r.status_code in (200, 201), r.content
    releve_ligne_id = _first_releve_ligne_id(auth_client, headers_copro, r.json()["import_id"])

    paiement = billing_objects["paiement_10000"]

    r1 = auth_client.post(
        URL_LIGNE_RAPPROCHER.format(ligne_id=releve_ligne_id),
        {"type_cible": "PAIEMENT_APPEL", "cible_id": paiement.id, "strict_amount": True},
        format="json",
        **headers_copro,
    )
    assert r1.status_code in (200, 201), r1.content

    r2 = auth_client.post(
        URL_LIGNE_ANNULER_RAPPRO.format(ligne_id=releve_ligne_id),
        {},
        format="json",
        **headers_copro,
    )
    assert r2.status_code in (200, 204), r2.content

    r3 = auth_client.post(
        URL_LIGNE_ANNULER_RAPPRO.format(ligne_id=releve_ligne_id),
        {},
        format="json",
        **headers_copro,
    )
    assert r3.status_code in (200, 204, 400, 409), r3.content


def test_phase5_11_stats_endpoint_ok(auth_client, headers_copro):
    r = auth_client.get(URL_RAPPRO_STATS, **headers_copro)
    assert r.status_code == 200, r.content