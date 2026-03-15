# apps/relances/tests/test_api.py
from __future__ import annotations

from datetime import date, timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from apps.core.models import Copropriete
from apps.lots.models import Lot
from apps.owners.models import Coproprietaire
from apps.billing.models import Exercice, AppelDeFonds
from apps.relances.models import DossierImpaye, Relance, AvisRegularisation


User = get_user_model()


class RelancesAPITestCase(TestCase):
    def setUp(self):
        self.client = APIClient()

        self.user = User.objects.create_user(
            username="user_relances",
            password="testpass123",
        )

        self.admin = User.objects.create_user(
            username="admin_relances",
            password="testpass123",
            is_staff=True,
            is_superuser=True,
        )

        self.copro = Copropriete.objects.create(
            nom="Copro Test",
        )

        # Header transverse requis par le projet
        self.client.credentials(HTTP_X_COPROPRIETE_ID=str(self.copro.id))

        self.lot = Lot.objects.create(
            copropriete=self.copro,
            reference="A101",
            type_lot="APPARTEMENT",
        )

        self.coproprietaire = Coproprietaire.objects.create(
            copropriete=self.copro,
            nom="KONAN",
            prenom="Eric",
        )

        self.exercice = Exercice.objects.create(
            copropriete=self.copro,
            annee=2026,
            date_debut=date(2026, 1, 1),
            date_fin=date(2026, 12, 31),
            actif=True,
        )

        self.appel = AppelDeFonds.objects.create(
            exercice=self.exercice,
            libelle="Appel Mars 2026",
            type_appel="PERIODIQUE",
            date_echeance=date(2026, 3, 31),
            montant_total=Decimal("10000.00"),
        )

        self.dossier = DossierImpaye.objects.create(
            copropriete=self.copro,
            lot=self.lot,
            coproprietaire=self.coproprietaire,
            appel=self.appel,
            reference_appel=self.appel.libelle,
            date_echeance=date(2026, 3, 31),
            montant_initial=Decimal("10000.00"),
            montant_paye=Decimal("0.00"),
            reste_a_payer=Decimal("10000.00"),
            statut=DossierImpaye.Statut.EN_RETARD,
            auto_relance_active=True,
            est_regularise=False,
        )

    def auth_user(self):
        self.client.force_authenticate(user=self.user)

    def auth_admin(self):
        self.client.force_authenticate(user=self.admin)

    @staticmethod
    def list_data(response):
        return response.data.get("results", response.data) if hasattr(response.data, "get") else response.data

    # =========================
    # DOSSIERS IMPAYES
    # =========================

    def test_list_dossiers_requires_auth(self):
        self.client.force_authenticate(user=None)
        response = self.client.get("/api/relances/dossiers/")
        self.assertIn(
            response.status_code,
            [
                status.HTTP_400_BAD_REQUEST,
                status.HTTP_401_UNAUTHORIZED,
                status.HTTP_403_FORBIDDEN,
            ],
        )

    def test_list_dossiers_authenticated(self):
        self.auth_user()
        response = self.client.get("/api/relances/dossiers/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = self.list_data(response)
        self.assertEqual(len(data), 1)
        self.assertEqual(data[0]["id"], self.dossier.id)
        self.assertEqual(data[0]["lot_numero"], self.lot.reference)
        self.assertEqual(data[0]["copropriete_nom"], self.copro.nom)
        self.assertEqual(data[0]["appel_reference"], self.appel.libelle)

    def test_retrieve_dossier_detail(self):
        self.auth_user()
        response = self.client.get(f"/api/relances/dossiers/{self.dossier.id}/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["id"], self.dossier.id)
        self.assertEqual(response.data["lot_numero"], self.lot.reference)
        self.assertIn("relances", response.data)
        self.assertIn("avis_regularisation", response.data)

    def test_filter_dossiers_by_statut(self):
        self.auth_user()
        response = self.client.get("/api/relances/dossiers/?statut=EN_RETARD")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = self.list_data(response)
        self.assertEqual(len(data), 1)
        self.assertEqual(data[0]["statut"], DossierImpaye.Statut.EN_RETARD)

    def test_filter_dossiers_by_est_regularise_false(self):
        self.auth_user()
        response = self.client.get("/api/relances/dossiers/?est_regularise=false")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = self.list_data(response)
        self.assertEqual(len(data), 1)

    def test_filter_dossiers_by_auto_relance_active_true(self):
        self.auth_user()
        response = self.client.get("/api/relances/dossiers/?auto_relance_active=true")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = self.list_data(response)
        self.assertEqual(len(data), 1)

    def test_filter_dossiers_by_echeance_depassee_true(self):
        self.dossier.date_echeance = timezone.localdate() - timedelta(days=3)
        self.dossier.save(update_fields=["date_echeance"])

        self.auth_user()
        response = self.client.get("/api/relances/dossiers/?echeance_depassee=true")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = self.list_data(response)
        self.assertEqual(len(data), 1)

    def test_search_dossiers(self):
        self.dossier.commentaire_interne = "Dossier sensible à suivre"
        self.dossier.save(update_fields=["commentaire_interne"])

        self.auth_user()
        response = self.client.get("/api/relances/dossiers/?q=sensible")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = self.list_data(response)
        self.assertEqual(len(data), 1)

    def test_historique_relances(self):
        relance = Relance.objects.create(
            copropriete=self.copro,
            dossier=self.dossier,
            appel=self.appel,
            lot=self.lot,
            coproprietaire=self.coproprietaire,
            niveau=1,
            canal=Relance.Canal.EMAIL,
            statut=Relance.Statut.ENVOYEE,
            objet="Relance test",
            message="Merci de payer",
            montant_du_message=Decimal("10000.00"),
            reste_a_payer_au_moment_envoi=Decimal("10000.00"),
            envoye_par=self.admin,
        )

        self.auth_user()
        response = self.client.get(
            f"/api/relances/dossiers/{self.dossier.id}/historique-relances/"
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["id"], relance.id)

    def test_stats_dossiers(self):
        self.auth_user()
        response = self.client.get("/api/relances/dossiers/stats/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["total"], 1)
        self.assertEqual(response.data["regularises"], 0)
        self.assertEqual(response.data["non_regularises"], 1)
        self.assertEqual(response.data["en_retard"], 1)

    # =========================
    # RELANCES
    # =========================

    def test_list_relances_authenticated(self):
        relance = Relance.objects.create(
            copropriete=self.copro,
            dossier=self.dossier,
            appel=self.appel,
            lot=self.lot,
            coproprietaire=self.coproprietaire,
            niveau=1,
            canal=Relance.Canal.EMAIL,
            statut=Relance.Statut.ENVOYEE,
            objet="Relance e-mail",
            message="Merci de régulariser votre situation.",
            montant_du_message=Decimal("10000.00"),
            reste_a_payer_au_moment_envoi=Decimal("10000.00"),
            envoye_par=self.admin,
        )

        self.auth_user()
        response = self.client.get("/api/relances/relances/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = self.list_data(response)
        self.assertEqual(len(data), 1)
        self.assertEqual(data[0]["id"], relance.id)
        self.assertEqual(data[0]["lot_numero"], self.lot.reference)

    def test_filter_relances_by_canal(self):
        Relance.objects.create(
            copropriete=self.copro,
            dossier=self.dossier,
            appel=self.appel,
            lot=self.lot,
            coproprietaire=self.coproprietaire,
            niveau=1,
            canal=Relance.Canal.EMAIL,
            statut=Relance.Statut.ENVOYEE,
            objet="Relance e-mail",
            message="Merci",
            montant_du_message=Decimal("10000.00"),
            reste_a_payer_au_moment_envoi=Decimal("10000.00"),
            envoye_par=self.admin,
        )

        self.auth_user()
        response = self.client.get("/api/relances/relances/?canal=EMAIL")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = self.list_data(response)
        self.assertEqual(len(data), 1)
        self.assertEqual(data[0]["canal"], "EMAIL")

    def test_create_relance_admin(self):
        self.auth_admin()

        payload = {
            "copropriete": self.copro.id,
            "dossier": self.dossier.id,
            "appel": self.appel.id,
            "lot": self.lot.id,
            "coproprietaire": self.coproprietaire.id,
            "canal": "EMAIL",
            "statut": "ENVOYEE",
            "objet": "Première relance",
            "message": "Merci de régulariser votre situation.",
        }

        response = self.client.post("/api/relances/relances/", payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Relance.objects.count(), 1)

        relance = Relance.objects.first()
        self.assertEqual(relance.dossier_id, self.dossier.id)
        self.assertEqual(relance.appel_id, self.appel.id)
        self.assertEqual(relance.lot_id, self.lot.id)
        self.assertEqual(relance.coproprietaire_id, self.coproprietaire.id)
        self.assertEqual(relance.canal, "EMAIL")
        self.assertEqual(relance.envoye_par, self.admin)
        self.assertEqual(relance.niveau, 1)
        self.assertEqual(relance.montant_du_message, Decimal("10000.00"))
        self.assertEqual(relance.reste_a_payer_au_moment_envoi, Decimal("10000.00"))

    def test_create_relance_refusee_sur_dossier_solde(self):
        self.dossier.reste_a_payer = Decimal("0.00")
        self.dossier.montant_paye = Decimal("10000.00")
        self.dossier.statut = DossierImpaye.Statut.PAYE
        self.dossier.save(update_fields=["reste_a_payer", "montant_paye", "statut"])

        self.auth_admin()

        payload = {
            "copropriete": self.copro.id,
            "dossier": self.dossier.id,
            "appel": self.appel.id,
            "lot": self.lot.id,
            "coproprietaire": self.coproprietaire.id,
            "canal": "EMAIL",
            "statut": "ENVOYEE",
            "objet": "Relance impossible",
            "message": "Test",
        }

        response = self.client.post("/api/relances/relances/", payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Relance.objects.count(), 0)

    def test_create_relance_refusee_si_lot_incoherent(self):
        autre_lot = Lot.objects.create(
            copropriete=self.copro,
            reference="B201",
            type_lot="APPARTEMENT",
        )

        self.auth_admin()

        payload = {
            "copropriete": self.copro.id,
            "dossier": self.dossier.id,
            "appel": self.appel.id,
            "lot": autre_lot.id,
            "coproprietaire": self.coproprietaire.id,
            "canal": "EMAIL",
            "statut": "ENVOYEE",
            "objet": "Relance incohérente",
            "message": "Test incohérent",
        }

        response = self.client.post("/api/relances/relances/", payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Relance.objects.count(), 0)

    def test_annuler_relance_admin(self):
        relance = Relance.objects.create(
            copropriete=self.copro,
            dossier=self.dossier,
            appel=self.appel,
            lot=self.lot,
            coproprietaire=self.coproprietaire,
            niveau=1,
            canal=Relance.Canal.EMAIL,
            statut=Relance.Statut.ENVOYEE,
            objet="Relance à annuler",
            message="Merci de payer",
            montant_du_message=Decimal("10000.00"),
            reste_a_payer_au_moment_envoi=Decimal("10000.00"),
            envoye_par=self.admin,
        )

        self.auth_admin()
        response = self.client.post(
            f"/api/relances/relances/{relance.id}/annuler/",
            {"motif_annulation": "Annulation de test"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)

    # =========================
    # ACTIONS DOSSIER
    # =========================

    def test_envoyer_relance_depuis_dossier_sans_canal_refuse(self):
        self.auth_admin()
        response = self.client.post(
            f"/api/relances/dossiers/{self.dossier.id}/envoyer-relance/",
            {"message": "Message sans canal"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_envoyer_relance_depuis_dossier_admin(self):
        self.auth_admin()
        response = self.client.post(
            f"/api/relances/dossiers/{self.dossier.id}/envoyer-relance/",
            {
                "canal": "EMAIL",
                "objet": "Relance automatique",
                "message": "Merci de régulariser rapidement.",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_generer_avis_regularisation_admin(self):
        self.dossier.montant_paye = Decimal("10000.00")
        self.dossier.reste_a_payer = Decimal("0.00")
        self.dossier.statut = DossierImpaye.Statut.REGULARISE
        self.dossier.est_regularise = True
        self.dossier.regularise_at = timezone.now()
        self.dossier.save(
            update_fields=[
                "montant_paye",
                "reste_a_payer",
                "statut",
                "est_regularise",
                "regularise_at",
            ]
        )

        self.auth_admin()
        response = self.client.post(
            f"/api/relances/dossiers/{self.dossier.id}/generer-avis-regularisation/",
            {
                "canal": "INTERNE",
                "message": "Votre situation est régularisée. Merci.",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(AvisRegularisation.objects.count(), 1)

    # =========================
    # AVIS
    # =========================

    def test_list_avis_authenticated(self):
        avis = AvisRegularisation.objects.create(
            copropriete=self.copro,
            dossier=self.dossier,
            appel=self.appel,
            lot=self.lot,
            coproprietaire=self.coproprietaire,
            montant_initial=Decimal("10000.00"),
            montant_total_regle=Decimal("10000.00"),
            date_regularisation=timezone.now(),
            canal=AvisRegularisation.Canal.INTERNE,
            statut=AvisRegularisation.Statut.GENERE,
            message="Situation régularisée.",
            genere_par=self.admin,
        )

        self.auth_user()
        response = self.client.get("/api/relances/avis/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = self.list_data(response)
        self.assertEqual(len(data), 1)
        self.assertEqual(data[0]["id"], avis.id)
        self.assertEqual(data[0]["lot_numero"], self.lot.reference)

    def test_filter_avis_by_statut(self):
        AvisRegularisation.objects.create(
            copropriete=self.copro,
            dossier=self.dossier,
            appel=self.appel,
            lot=self.lot,
            coproprietaire=self.coproprietaire,
            montant_initial=Decimal("10000.00"),
            montant_total_regle=Decimal("10000.00"),
            date_regularisation=timezone.now(),
            canal=AvisRegularisation.Canal.INTERNE,
            statut=AvisRegularisation.Statut.GENERE,
            message="Situation régularisée.",
            genere_par=self.admin,
        )

        self.auth_user()
        response = self.client.get("/api/relances/avis/?statut=GENERE")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = self.list_data(response)
        self.assertEqual(len(data), 1)

    def test_retrieve_avis(self):
        avis = AvisRegularisation.objects.create(
            copropriete=self.copro,
            dossier=self.dossier,
            appel=self.appel,
            lot=self.lot,
            coproprietaire=self.coproprietaire,
            montant_initial=Decimal("10000.00"),
            montant_total_regle=Decimal("10000.00"),
            date_regularisation=timezone.now(),
            canal=AvisRegularisation.Canal.INTERNE,
            statut=AvisRegularisation.Statut.GENERE,
            message="Situation régularisée.",
            genere_par=self.admin,
        )

        self.auth_user()
        response = self.client.get(f"/api/relances/avis/{avis.id}/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["id"], avis.id)