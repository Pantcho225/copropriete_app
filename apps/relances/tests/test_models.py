# apps/relances/tests/test_models.py
from __future__ import annotations

from datetime import date
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.db import IntegrityError
from django.test import TestCase
from django.utils import timezone

from apps.core.models import Copropriete
from apps.lots.models import Lot
from apps.owners.models import Coproprietaire
from apps.billing.models import Exercice, AppelDeFonds
from apps.relances.models import DossierImpaye, Relance, AvisRegularisation


User = get_user_model()


class RelancesModelsTestCase(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="kore",
            password="testpass123",
        )

        self.copro = Copropriete.objects.create(
            nom="Copro Test",
        )

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

    def make_dossier(self, **kwargs) -> DossierImpaye:
        data = {
            "copropriete": self.copro,
            "lot": self.lot,
            "coproprietaire": self.coproprietaire,
            "appel": self.appel,
            "reference_appel": self.appel.libelle,
            "date_echeance": date(2026, 3, 31),
            "montant_initial": Decimal("10000.00"),
            "montant_paye": Decimal("0.00"),
            "reste_a_payer": Decimal("10000.00"),
            "statut": DossierImpaye.Statut.A_PAYER,
        }
        data.update(kwargs)
        return DossierImpaye.objects.create(**data)

    def test_creation_dossier_impaye(self):
        dossier = self.make_dossier()

        self.assertEqual(dossier.copropriete, self.copro)
        self.assertEqual(dossier.lot, self.lot)
        self.assertEqual(dossier.coproprietaire, self.coproprietaire)
        self.assertEqual(dossier.appel, self.appel)
        self.assertEqual(dossier.reference_appel, self.appel.libelle)
        self.assertEqual(dossier.montant_initial, Decimal("10000.00"))
        self.assertEqual(dossier.montant_paye, Decimal("0.00"))
        self.assertEqual(dossier.reste_a_payer, Decimal("10000.00"))
        self.assertEqual(dossier.statut, DossierImpaye.Statut.A_PAYER)

    def test_valeurs_par_defaut_dossier_impaye(self):
        dossier = self.make_dossier()

        self.assertEqual(dossier.niveau_relance, 0)
        self.assertEqual(dossier.relances_count, 0)
        self.assertIsNone(dossier.derniere_relance_at)
        self.assertIsNone(dossier.date_dernier_paiement)
        self.assertFalse(dossier.est_regularise)
        self.assertIsNone(dossier.regularise_at)
        self.assertTrue(dossier.auto_relance_active)
        self.assertEqual(dossier.commentaire_interne, "")

    def test_str_dossier_impaye(self):
        dossier = self.make_dossier()
        self.assertEqual(
            str(dossier),
            f"Dossier impayé lot={dossier.lot_id} appel={dossier.appel_id}",
        )

    def test_unicite_dossier_impaye_par_appel_et_lot(self):
        self.make_dossier()

        with self.assertRaises(IntegrityError):
            self.make_dossier()

    def test_creation_relance(self):
        dossier = self.make_dossier(
            statut=DossierImpaye.Statut.EN_RETARD,
        )

        relance = Relance.objects.create(
            copropriete=self.copro,
            dossier=dossier,
            appel=self.appel,
            lot=self.lot,
            coproprietaire=self.coproprietaire,
            niveau=1,
            canal=Relance.Canal.EMAIL,
            statut=Relance.Statut.ENVOYEE,
            objet="Relance de paiement",
            message="Merci de régulariser votre situation.",
            montant_du_message=Decimal("10000.00"),
            reste_a_payer_au_moment_envoi=Decimal("10000.00"),
            envoye_par=self.user,
        )

        self.assertEqual(relance.copropriete, self.copro)
        self.assertEqual(relance.dossier, dossier)
        self.assertEqual(relance.appel, self.appel)
        self.assertEqual(relance.lot, self.lot)
        self.assertEqual(relance.coproprietaire, self.coproprietaire)
        self.assertEqual(relance.niveau, 1)
        self.assertEqual(relance.canal, Relance.Canal.EMAIL)
        self.assertEqual(relance.statut, Relance.Statut.ENVOYEE)
        self.assertEqual(relance.objet, "Relance de paiement")
        self.assertEqual(relance.message, "Merci de régulariser votre situation.")
        self.assertEqual(relance.montant_du_message, Decimal("10000.00"))
        self.assertEqual(relance.reste_a_payer_au_moment_envoi, Decimal("10000.00"))
        self.assertEqual(relance.envoye_par, self.user)
        self.assertIsNotNone(relance.date_envoi)

    def test_str_relance(self):
        dossier = self.make_dossier()

        relance = Relance.objects.create(
            copropriete=self.copro,
            dossier=dossier,
            appel=self.appel,
            lot=self.lot,
            coproprietaire=self.coproprietaire,
            niveau=1,
            canal=Relance.Canal.WHATSAPP,
            statut=Relance.Statut.ENVOYEE,
            message="Relance WhatsApp",
            montant_du_message=Decimal("10000.00"),
            reste_a_payer_au_moment_envoi=Decimal("10000.00"),
        )

        self.assertEqual(str(relance), f"Relance #{relance.pk} dossier={dossier.id}")

    def test_relance_annulee(self):
        dossier = self.make_dossier()

        relance = Relance.objects.create(
            copropriete=self.copro,
            dossier=dossier,
            appel=self.appel,
            lot=self.lot,
            coproprietaire=self.coproprietaire,
            niveau=2,
            canal=Relance.Canal.PDF,
            statut=Relance.Statut.ANNULEE,
            message="Relance annulée",
            montant_du_message=Decimal("5000.00"),
            reste_a_payer_au_moment_envoi=Decimal("5000.00"),
            annulee_at=timezone.now(),
            annulee_par=self.user,
            motif_annulation="Annulation de test",
        )

        self.assertEqual(relance.statut, Relance.Statut.ANNULEE)
        self.assertIsNotNone(relance.annulee_at)
        self.assertEqual(relance.annulee_par, self.user)
        self.assertEqual(relance.motif_annulation, "Annulation de test")

    def test_creation_avis_regularisation(self):
        dossier = self.make_dossier(
            montant_paye=Decimal("10000.00"),
            reste_a_payer=Decimal("0.00"),
            statut=DossierImpaye.Statut.REGULARISE,
            est_regularise=True,
            regularise_at=timezone.now(),
        )

        avis = AvisRegularisation.objects.create(
            copropriete=self.copro,
            dossier=dossier,
            appel=self.appel,
            lot=self.lot,
            coproprietaire=self.coproprietaire,
            montant_initial=Decimal("10000.00"),
            montant_total_regle=Decimal("10000.00"),
            date_regularisation=timezone.now(),
            canal=AvisRegularisation.Canal.INTERNE,
            statut=AvisRegularisation.Statut.GENERE,
            message="Votre situation est régularisée. Merci.",
            genere_par=self.user,
        )

        self.assertEqual(avis.copropriete, self.copro)
        self.assertEqual(avis.dossier, dossier)
        self.assertEqual(avis.appel, self.appel)
        self.assertEqual(avis.lot, self.lot)
        self.assertEqual(avis.coproprietaire, self.coproprietaire)
        self.assertEqual(avis.montant_initial, Decimal("10000.00"))
        self.assertEqual(avis.montant_total_regle, Decimal("10000.00"))
        self.assertEqual(avis.canal, AvisRegularisation.Canal.INTERNE)
        self.assertEqual(avis.statut, AvisRegularisation.Statut.GENERE)
        self.assertEqual(avis.message, "Votre situation est régularisée. Merci.")
        self.assertEqual(avis.genere_par, self.user)

    def test_one_to_one_avis_regularisation_par_dossier(self):
        dossier = self.make_dossier(
            montant_paye=Decimal("10000.00"),
            reste_a_payer=Decimal("0.00"),
            statut=DossierImpaye.Statut.REGULARISE,
            est_regularise=True,
            regularise_at=timezone.now(),
        )

        AvisRegularisation.objects.create(
            copropriete=self.copro,
            dossier=dossier,
            appel=self.appel,
            lot=self.lot,
            coproprietaire=self.coproprietaire,
            montant_initial=Decimal("10000.00"),
            montant_total_regle=Decimal("10000.00"),
            date_regularisation=timezone.now(),
            canal=AvisRegularisation.Canal.INTERNE,
            statut=AvisRegularisation.Statut.GENERE,
            message="Premier avis",
            genere_par=self.user,
        )

        with self.assertRaises(IntegrityError):
            AvisRegularisation.objects.create(
                copropriete=self.copro,
                dossier=dossier,
                appel=self.appel,
                lot=self.lot,
                coproprietaire=self.coproprietaire,
                montant_initial=Decimal("10000.00"),
                montant_total_regle=Decimal("10000.00"),
                date_regularisation=timezone.now(),
                canal=AvisRegularisation.Canal.EMAIL,
                statut=AvisRegularisation.Statut.GENERE,
                message="Deuxième avis",
                genere_par=self.user,
            )

    def test_str_avis_regularisation(self):
        dossier = self.make_dossier(
            montant_paye=Decimal("10000.00"),
            reste_a_payer=Decimal("0.00"),
            statut=DossierImpaye.Statut.REGULARISE,
            est_regularise=True,
            regularise_at=timezone.now(),
        )

        avis = AvisRegularisation.objects.create(
            copropriete=self.copro,
            dossier=dossier,
            appel=self.appel,
            lot=self.lot,
            coproprietaire=self.coproprietaire,
            montant_initial=Decimal("10000.00"),
            montant_total_regle=Decimal("10000.00"),
            date_regularisation=timezone.now(),
            canal=AvisRegularisation.Canal.INTERNE,
            statut=AvisRegularisation.Statut.GENERE,
            message="Avis test",
            genere_par=self.user,
        )

        self.assertEqual(
            str(avis),
            f"Avis régularisation #{avis.pk} dossier={dossier.id}",
        )