from __future__ import annotations

import shutil
import tempfile
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from apps.compta.models import CompteBancaire, EntreeArgent, MouvementBancaire
from apps.core.models import Copropriete


TEST_MEDIA_ROOT = tempfile.mkdtemp(prefix="copro_compta_entrees_tests_")


@override_settings(
    MEDIA_ROOT=TEST_MEDIA_ROOT,
    ALLOWED_HOSTS=["testserver", "localhost", "127.0.0.1"],
)
class EntreeArgentAPITestCase(APITestCase):
    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        shutil.rmtree(TEST_MEDIA_ROOT, ignore_errors=True)

    def setUp(self):
        User = get_user_model()

        self.user = User.objects.create_superuser(
            username="admin_entrees_argent",
            email="admin_entrees_argent@example.com",
            password="testpass",
        )
        self.copro = Copropriete.objects.create(nom="Résidence Entrées Argent")
        self.other_copro = Copropriete.objects.create(nom="Autre Résidence Entrées")

        self.compte = CompteBancaire.objects.create(
            copropriete=self.copro,
            nom="Compte principal",
            banque="Banque Test",
            devise="XOF",
            solde_initial=Decimal("0.00"),
            is_active=True,
            is_default=True,
        )
        self.other_compte = CompteBancaire.objects.create(
            copropriete=self.other_copro,
            nom="Compte autre copro",
            banque="Banque Test",
            devise="XOF",
            solde_initial=Decimal("0.00"),
            is_active=True,
            is_default=True,
        )

        self.client.force_authenticate(user=self.user)

    def _headers(self, copro=None):
        return {"HTTP_X_COPROPRIETE_ID": str((copro or self.copro).id)}

    def _pdf(self, filename="justificatif.pdf"):
        return SimpleUploadedFile(
            filename,
            b"%PDF-1.4\n% justificatif entree argent\n%%EOF",
            content_type="application/pdf",
        )

    def test_create_draft_entree_argent_without_mouvement(self):
        response = self.client.post(
            "/api/compta/entrees-argent/",
            {
                "compte": self.compte.id,
                "type": EntreeArgent.Type.DON,
                "statut": EntreeArgent.Statut.BROUILLON,
                "montant": "25000.00",
                "date_operation": timezone.localdate().isoformat(),
                "reference": "DON-TEST-001",
                "libelle": "Don association",
                "source_nom": "Association test",
                "mode_paiement": EntreeArgent.ModePaiement.VIREMENT,
                "note": "Don enregistré en brouillon.",
                "justificatif": self._pdf(),
            },
            format="multipart",
            **self._headers(),
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["statut"], EntreeArgent.Statut.BROUILLON)
        self.assertIsNone(response.data["mouvement"])
        self.assertEqual(MouvementBancaire.objects.count(), 0)

    def test_validate_entree_argent_creates_credit_mouvement(self):
        entree = EntreeArgent.objects.create(
            copropriete=self.copro,
            compte=self.compte,
            type=EntreeArgent.Type.SUBVENTION,
            statut=EntreeArgent.Statut.BROUILLON,
            montant=Decimal("100000.00"),
            date_operation=timezone.localdate(),
            reference="SUBV-001",
            libelle="Subvention mairie",
            source_nom="Mairie",
            mode_paiement=EntreeArgent.ModePaiement.VIREMENT,
            created_by=self.user,
            updated_by=self.user,
        )

        response = self.client.post(
            f"/api/compta/entrees-argent/{entree.id}/valider/",
            {},
            format="json",
            **self._headers(),
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        entree.refresh_from_db()

        self.assertEqual(entree.statut, EntreeArgent.Statut.VALIDEE)
        self.assertIsNotNone(entree.mouvement_id)
        self.assertEqual(entree.mouvement.sens, MouvementBancaire.Sens.CREDIT)
        self.assertEqual(entree.mouvement.montant, Decimal("100000.00"))

    def test_create_validated_entree_argent_creates_credit_mouvement(self):
        response = self.client.post(
            "/api/compta/entrees-argent/",
            {
                "compte": self.compte.id,
                "type": EntreeArgent.Type.REMBOURSEMENT,
                "statut": EntreeArgent.Statut.VALIDEE,
                "montant": "15000.00",
                "date_operation": timezone.localdate().isoformat(),
                "reference": "REMB-001",
                "libelle": "Remboursement fournisseur",
                "source_nom": "Fournisseur test",
                "mode_paiement": EntreeArgent.ModePaiement.VIREMENT,
            },
            format="json",
            **self._headers(),
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        entree = EntreeArgent.objects.get(pk=response.data["id"])
        self.assertEqual(entree.statut, EntreeArgent.Statut.VALIDEE)
        self.assertIsNotNone(entree.mouvement_id)
        self.assertEqual(entree.mouvement.sens, MouvementBancaire.Sens.CREDIT)

    def test_cancel_entree_argent_cancels_credit_mouvement_as_error(self):
        entree = EntreeArgent.objects.create(
            copropriete=self.copro,
            compte=self.compte,
            type=EntreeArgent.Type.AUTRE_ENTREE,
            statut=EntreeArgent.Statut.BROUILLON,
            montant=Decimal("30000.00"),
            date_operation=timezone.localdate(),
            reference="AUTRE-001",
            libelle="Autre entrée",
            source_nom="Source test",
            created_by=self.user,
            updated_by=self.user,
        )
        entree.valider(user=self.user)

        response = self.client.post(
            f"/api/compta/entrees-argent/{entree.id}/annuler/",
            {
                "reason": "Erreur de saisie",
                "cancel_mouvement": True,
            },
            format="json",
            **self._headers(),
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        entree.refresh_from_db()

        self.assertEqual(entree.statut, EntreeArgent.Statut.ANNULEE)
        self.assertTrue(entree.mouvement.is_cancelled)
        self.assertEqual(entree.mouvement.cancel_kind, MouvementBancaire.CancelKind.ERROR)
        self.assertFalse(entree.mouvement.impacts_balance)

    def test_entree_argent_rejects_compte_from_other_copropriete(self):
        response = self.client.post(
            "/api/compta/entrees-argent/",
            {
                "compte": self.other_compte.id,
                "type": EntreeArgent.Type.DON,
                "statut": EntreeArgent.Statut.BROUILLON,
                "montant": "25000.00",
                "date_operation": timezone.localdate().isoformat(),
                "reference": "DON-WRONG-COPRO",
                "libelle": "Don mauvais compte",
                "source_nom": "Association test",
            },
            format="json",
            **self._headers(self.copro),
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("compte", response.data)

    def test_entree_argent_stats(self):
        EntreeArgent.objects.create(
            copropriete=self.copro,
            compte=self.compte,
            type=EntreeArgent.Type.DON,
            statut=EntreeArgent.Statut.BROUILLON,
            montant=Decimal("10000.00"),
            date_operation=timezone.localdate(),
            libelle="Don brouillon",
            created_by=self.user,
            updated_by=self.user,
        )

        entree = EntreeArgent.objects.create(
            copropriete=self.copro,
            compte=self.compte,
            type=EntreeArgent.Type.SUBVENTION,
            statut=EntreeArgent.Statut.BROUILLON,
            montant=Decimal("50000.00"),
            date_operation=timezone.localdate(),
            libelle="Subvention validée",
            created_by=self.user,
            updated_by=self.user,
        )
        entree.valider(user=self.user)

        response = self.client.get(
            "/api/compta/entrees-argent/stats/",
            **self._headers(),
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["total_valide"], 50000.0)
        self.assertEqual(response.data["total_brouillon"], 10000.0)
        self.assertEqual(response.data["count_total"], 2)
        self.assertEqual(response.data["count_valide"], 1)
