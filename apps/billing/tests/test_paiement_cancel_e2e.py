from __future__ import annotations

import json
import pytest
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

pytestmark = pytest.mark.django_db


def _create_minimal_copro(nom="Copro Test"):
    from apps.core.models import Copropriete

    fields = {f.name for f in Copropriete._meta.fields}
    kwargs = {}
    if "nom" in fields:
        kwargs["nom"] = nom
    elif "name" in fields:
        kwargs["name"] = nom
    return Copropriete.objects.create(**kwargs)


def _create_minimal_lot(copro_id: int, reference="LOT-1"):
    from apps.lots.models import Lot

    fields = {f.name for f in Lot._meta.fields}
    kwargs = {}

    if "copropriete_id" in fields:
        kwargs["copropriete_id"] = copro_id
    elif "copropriete" in fields:
        kwargs["copropriete_id"] = copro_id

    if "reference" in fields:
        kwargs["reference"] = reference
    elif "numero" in fields:
        kwargs["numero"] = reference

    return Lot.objects.create(**kwargs)


def _create_exercice_for_appel(copro_id: int):
    # ✅ Source de vérité = FK AppelDeFonds.exercice (peu importe le label : billing_app.Exercice)
    from apps.billing.models import AppelDeFonds

    fk = AppelDeFonds._meta.get_field("exercice")
    Exercice = fk.related_model

    fields = {f.name for f in Exercice._meta.fields}
    kwargs = {}

    if "copropriete_id" in fields:
        kwargs["copropriete_id"] = copro_id
    elif "copropriete" in fields:
        kwargs["copropriete_id"] = copro_id

    if "annee" in fields:
        kwargs["annee"] = timezone.now().year
    if "libelle" in fields:
        kwargs["libelle"] = f"Exercice {timezone.now().year}"
    if "date_debut" in fields:
        kwargs["date_debut"] = timezone.now().date().replace(month=1, day=1)
    if "date_fin" in fields:
        kwargs["date_fin"] = timezone.now().date().replace(month=12, day=31)

    return Exercice.objects.create(**kwargs)


def _create_minimal_appel(exercice):
    from apps.billing.models import AppelDeFonds

    fields = {f.name for f in AppelDeFonds._meta.fields}
    kwargs = {"exercice": exercice}

    if "libelle" in fields:
        kwargs["libelle"] = "Appel test"
    if "montant_total" in fields:
        kwargs["montant_total"] = "10000.00"
    if "date_emission" in fields:
        kwargs["date_emission"] = timezone.now().date()
    if "date_echeance" in fields:
        kwargs["date_echeance"] = timezone.now().date()

    return AppelDeFonds.objects.create(**kwargs)


def _create_minimal_ligne(appel, lot):
    from apps.billing.models import LigneAppelDeFonds

    fields = {f.name for f in LigneAppelDeFonds._meta.fields}
    kwargs = {"appel": appel, "lot": lot}

    # =========================================================
    # ✅ PATCH 1 : champ tantiemes NOT NULL
    # =========================================================
    if "tantiemes" in fields:
        kwargs["tantiemes"] = "1.00"
    # =========================================================

    if "montant_du" in fields:
        kwargs["montant_du"] = "100.00"
    if "montant_paye" in fields:
        kwargs["montant_paye"] = "0.00"
    if "statut" in fields:
        kwargs["statut"] = "IMPAYE"

    return LigneAppelDeFonds.objects.create(**kwargs)


def _create_paiement(ligne):
    from apps.billing.models import PaiementAppel

    fields = {f.name for f in PaiementAppel._meta.fields}
    kwargs = {"ligne": ligne}

    if "date_paiement" in fields:
        kwargs["date_paiement"] = timezone.now()
    if "montant" in fields:
        kwargs["montant"] = "100.00"
    if "mode" in fields:
        kwargs["mode"] = "VIREMENT"
    if "reference" in fields:
        kwargs["reference"] = "TEST-CANCEL"
    if "commentaire" in fields:
        kwargs["commentaire"] = "Paiement test cancel"

    return PaiementAppel.objects.create(**kwargs)


def _create_releve_ligne(copro_id: int):
    from apps.compta.models import ReleveImport, ReleveLigne

    imp_fields = {f.name for f in ReleveImport._meta.fields}
    imp_kwargs = {}

    # =========================================================
    # ✅ PATCH 3 : ReleveImport.copropriete NOT NULL (FK vs int)
    # - si champ = "copropriete" (FK) -> on passe copropriete_id
    # - si champ = "copropriete_id" (int) -> on passe copropriete_id
    # =========================================================
    if "copropriete" in imp_fields:
        imp_kwargs["copropriete_id"] = copro_id
    elif "copropriete_id" in imp_fields:
        imp_kwargs["copropriete_id"] = copro_id
    # =========================================================

    if "hash_unique" in imp_fields:
        imp_kwargs["hash_unique"] = "x" * 64
    if "encoding" in imp_fields:
        imp_kwargs["encoding"] = "utf-8"
    if "delimiter" in imp_fields:
        imp_kwargs["delimiter"] = ";"

    imp = ReleveImport.objects.create(**imp_kwargs)

    rl_fields = {f.name for f in ReleveLigne._meta.fields}
    rl_kwargs = {}

    if "releve_import" in rl_fields:
        rl_kwargs["releve_import"] = imp

    # Même logique côté ReleveLigne (FK vs int)
    if "copropriete" in rl_fields:
        rl_kwargs["copropriete_id"] = copro_id
    elif "copropriete_id" in rl_fields:
        rl_kwargs["copropriete_id"] = copro_id

    if "date_operation" in rl_fields:
        rl_kwargs["date_operation"] = timezone.now().date()
    if "libelle" in rl_fields:
        rl_kwargs["libelle"] = "TEST RL"
    if "reference" in rl_fields:
        rl_kwargs["reference"] = "REF"
    if "sens" in rl_fields:
        rl_kwargs["sens"] = "CREDIT"
    if "montant" in rl_fields:
        rl_kwargs["montant"] = "100.00"
    if "hash_unique" in rl_fields:
        rl_kwargs["hash_unique"] = "y" * 64
    if "raw" in rl_fields:
        rl_kwargs["raw"] = {"credit": "100.00"}

    return ReleveLigne.objects.create(**rl_kwargs)


def _api_client_as(user, copro_id: int) -> APIClient:
    # =========================================================
    # ✅ PATCH 2 (IMPORTANT) : Auth DRF
    # - force_login() ne marche pas si SessionAuthentication est désactivée.
    # - APIClient.force_authenticate() marche même si JWT est l’auth normale.
    # =========================================================
    c = APIClient()
    c.force_authenticate(user=user)
    c.credentials(HTTP_X_COPROPRIETE_ID=str(copro_id))
    return c
    # =========================================================


def _post_json(client: APIClient, url: str, payload: dict):
    return client.post(url, data=payload, format="json")


def test_cancel_is_idempotent(admin_user):
    copro = _create_minimal_copro("Copro test")
    lot = _create_minimal_lot(copro.id, "LOT-TEST")
    exercice = _create_exercice_for_appel(copro.id)
    appel = _create_minimal_appel(exercice)
    ligne = _create_minimal_ligne(appel, lot)
    paiement = _create_paiement(ligne)

    client = _api_client_as(admin_user, copro.id)

    url = reverse("billing:paiement-cancel", args=[paiement.id])

    r1 = _post_json(client, url, {"reason": "Erreur saisie"})
    assert r1.status_code == 200, r1.content

    r2 = _post_json(client, url, {"reason": "Erreur saisie"})
    assert r2.status_code == 200, r2.content


def test_cancel_then_rapprochement_refused(admin_user):
    copro = _create_minimal_copro("Copro test")
    lot = _create_minimal_lot(copro.id, "LOT-TEST")
    exercice = _create_exercice_for_appel(copro.id)
    appel = _create_minimal_appel(exercice)
    ligne = _create_minimal_ligne(appel, lot)
    paiement = _create_paiement(ligne)

    client = _api_client_as(admin_user, copro.id)

    # cancel
    url_cancel = reverse("billing:paiement-cancel", args=[paiement.id])
    r_cancel = _post_json(client, url_cancel, {"reason": "Test cancel"})
    assert r_cancel.status_code == 200, r_cancel.content

    # create releve ligne
    rl = _create_releve_ligne(copro.id)

    # rapprocher -> doit échouer car paiement annulé
    url_rapprocher = reverse("compta:compta-releve-ligne-rapprocher", args=[rl.id])
    payload = {"type_cible": "PAIEMENT_APPEL", "cible_id": int(paiement.id), "note": "Test"}
    r = _post_json(client, url_rapprocher, payload)

    assert r.status_code in (400, 409), r.content