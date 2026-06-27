from __future__ import annotations

import shutil
import tempfile

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from apps.core.models import CoproMembre, Copropriete
from apps.reunions.models import (
    ReunionDocument,
    ReunionRencontre,
)


TEST_MEDIA_ROOT = tempfile.mkdtemp(prefix="copro_reunions_tests_")


def _api_items(data):
    if isinstance(data, dict) and "results" in data:
        return data["results"]
    return data


def _role_value(*names: str) -> str:
    for name in names:
        if hasattr(CoproMembre.Role, name):
            return getattr(CoproMembre.Role, name)

    choices = getattr(CoproMembre._meta.get_field("role"), "choices", None) or []
    if choices:
        return choices[0][0]

    return names[0]


@override_settings(
    MEDIA_ROOT=TEST_MEDIA_ROOT,
    ALLOWED_HOSTS=["testserver", "localhost", "127.0.0.1"],
)
class ReunionRencontreAPITestCase(APITestCase):
    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        shutil.rmtree(TEST_MEDIA_ROOT, ignore_errors=True)

    def setUp(self):
        User = get_user_model()

        self.admin_user = User.objects.create_superuser(
            username="admin_reunions",
            email="admin_reunions@example.com",
            password="testpass",
        )
        self.owner_user = User.objects.create_user(
            username="owner_reunions",
            email="owner_reunions@example.com",
            password="testpass",
        )
        self.other_owner_user = User.objects.create_user(
            username="other_owner_reunions",
            email="other_owner_reunions@example.com",
            password="testpass",
        )

        self.copro = Copropriete.objects.create(nom="Résidence Réunions A")
        self.other_copro = Copropriete.objects.create(nom="Résidence Réunions B")

        CoproMembre.objects.create(
            user=self.owner_user,
            copropriete=self.copro,
            role=_role_value("COPROPRIETAIRE", "PROPRIETAIRE", "MEMBRE"),
            is_active=True,
        )
        CoproMembre.objects.create(
            user=self.other_owner_user,
            copropriete=self.other_copro,
            role=_role_value("COPROPRIETAIRE", "PROPRIETAIRE", "MEMBRE"),
            is_active=True,
        )

    def _headers(self, copro=None):
        return {"HTTP_X_COPROPRIETE_ID": str((copro or self.copro).id)}

    def _pdf(self, filename="compte-rendu.pdf"):
        return SimpleUploadedFile(
            filename,
            b"%PDF-1.4\n% compte rendu reunion test\n%%EOF",
            content_type="application/pdf",
        )

    def _create_reunion(
        self,
        *,
        copro=None,
        titre="Réunion de test",
        statut=ReunionRencontre.Statut.BROUILLON,
        visible=False,
        compte_rendu="",
    ):
        return ReunionRencontre.objects.create(
            copropriete=copro or self.copro,
            type=ReunionRencontre.Type.REUNION_INTERNE,
            statut=statut,
            titre=titre,
            reference="REUNION-TEST",
            objet="Objet de test",
            description="Description de test",
            date_debut=timezone.now(),
            lieu="Salle de réunion",
            compte_rendu=compte_rendu,
            visible_coproprietaire=visible,
            created_by=self.admin_user,
            updated_by=self.admin_user,
        )

    def test_admin_can_create_reunion_participant_document_and_action(self):
        self.client.force_authenticate(user=self.admin_user)

        response = self.client.post(
            "/api/reunions/rencontres/",
            {
                "type": ReunionRencontre.Type.RENCONTRE_FOURNISSEUR,
                "statut": ReunionRencontre.Statut.PROGRAMMEE,
                "titre": "Rencontre fournisseur ascenseur",
                "reference": "REN-ASC-001",
                "objet": "Point maintenance ascenseur",
                "description": "Rencontre avec le prestataire ascenseur.",
                "date_debut": timezone.now().isoformat(),
                "lieu": "Bureau syndic",
            },
            format="json",
            **self._headers(),
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        reunion_id = response.data["id"]

        response = self.client.post(
            "/api/reunions/participants/",
            {
                "reunion": reunion_id,
                "type": "PRESTATAIRE",
                "nom_complet": "Technicien Ascenseur",
                "organisation": "Ascenseur CI",
                "fonction": "Responsable maintenance",
                "email": "tech@example.com",
                "present": True,
            },
            format="json",
            **self._headers(),
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        response = self.client.post(
            "/api/reunions/documents/",
            {
                "reunion": reunion_id,
                "type": "COMPTE_RENDU",
                "titre": "Compte rendu fournisseur",
                "description": "Compte rendu de la rencontre.",
                "visible_coproprietaire": True,
                "fichier": self._pdf("cr-fournisseur.pdf"),
            },
            format="multipart",
            **self._headers(),
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        response = self.client.post(
            "/api/reunions/actions/",
            {
                "reunion": reunion_id,
                "titre": "Demander le devis actualisé",
                "description": "Le prestataire doit transmettre un devis.",
                "statut": "A_FAIRE",
                "priorite": "HAUTE",
                "responsable_nom": "Syndic",
            },
            format="json",
            **self._headers(),
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_owner_only_sees_published_visible_reunions(self):
        hidden = self._create_reunion(
            titre="Réunion brouillon invisible",
            statut=ReunionRencontre.Statut.BROUILLON,
            visible=False,
        )
        published = self._create_reunion(
            titre="Réunion publiée visible",
            statut=ReunionRencontre.Statut.PUBLIEE,
            visible=True,
            compte_rendu="Compte rendu publié.",
        )

        self.client.force_authenticate(user=self.owner_user)

        response = self.client.get(
            "/api/reunions/coproprietaire/rencontres/",
            **self._headers(),
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        ids = {item["id"] for item in _api_items(response.data)}

        self.assertIn(published.id, ids)
        self.assertNotIn(hidden.id, ids)

    def test_publish_action_requires_summary_or_visible_document(self):
        reunion = self._create_reunion(
            titre="Réunion à publier",
            statut=ReunionRencontre.Statut.TENUE,
            visible=False,
            compte_rendu="",
        )

        self.client.force_authenticate(user=self.admin_user)

        response = self.client.post(
            f"/api/reunions/rencontres/{reunion.id}/publier/",
            {},
            format="json",
            **self._headers(),
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

        reunion.compte_rendu = "Compte rendu de validation."
        reunion.save(update_fields=["compte_rendu", "updated_at"])

        response = self.client.post(
            f"/api/reunions/rencontres/{reunion.id}/publier/",
            {},
            format="json",
            **self._headers(),
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["statut"], ReunionRencontre.Statut.PUBLIEE)
        self.assertTrue(response.data["visible_coproprietaire"])

    def test_owner_can_download_visible_reunion_document_only(self):
        reunion = self._create_reunion(
            titre="Réunion publiée avec documents",
            statut=ReunionRencontre.Statut.PUBLIEE,
            visible=True,
            compte_rendu="Compte rendu publié.",
        )
        hidden_doc = ReunionDocument.objects.create(
            reunion=reunion,
            type=ReunionDocument.Type.COMPTE_RENDU,
            titre="Document masqué",
            fichier=self._pdf("hidden-cr.pdf"),
            nom_fichier_original="hidden-cr.pdf",
            mime_type="application/pdf",
            taille_octets=30,
            visible_coproprietaire=False,
            created_by=self.admin_user,
        )
        visible_doc = ReunionDocument.objects.create(
            reunion=reunion,
            type=ReunionDocument.Type.COMPTE_RENDU,
            titre="Document visible",
            fichier=self._pdf("visible-cr.pdf"),
            nom_fichier_original="visible-cr.pdf",
            mime_type="application/pdf",
            taille_octets=30,
            visible_coproprietaire=True,
            created_by=self.admin_user,
        )

        self.client.force_authenticate(user=self.owner_user)

        response = self.client.get(
            f"/api/reunions/coproprietaire/documents/{hidden_doc.id}/download/",
            **self._headers(),
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

        response = self.client.get(
            f"/api/reunions/coproprietaire/documents/{visible_doc.id}/download/",
            **self._headers(),
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response["Content-Type"], "application/pdf")

    def test_simple_owner_cannot_create_participant_or_action(self):
        reunion = self._create_reunion(
            titre="Réunion protégée",
            statut=ReunionRencontre.Statut.PROGRAMMEE,
            visible=False,
        )

        self.client.force_authenticate(user=self.owner_user)

        response = self.client.post(
            "/api/reunions/participants/",
            {
                "reunion": reunion.id,
                "type": "COPROPRIETAIRE",
                "nom_complet": "Copropriétaire simple",
                "present": True,
            },
            format="json",
            **self._headers(),
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        response = self.client.post(
            "/api/reunions/actions/",
            {
                "reunion": reunion.id,
                "titre": "Action non autorisée",
                "description": "Création interdite pour un simple copropriétaire.",
                "statut": "A_FAIRE",
                "priorite": "NORMALE",
            },
            format="json",
            **self._headers(),
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


    def test_reunions_are_isolated_by_copropriete_header(self):
        current = self._create_reunion(
            copro=self.copro,
            titre="Réunion copro A",
            statut=ReunionRencontre.Statut.PUBLIEE,
            visible=True,
            compte_rendu="Compte rendu A.",
        )
        other = self._create_reunion(
            copro=self.other_copro,
            titre="Réunion copro B",
            statut=ReunionRencontre.Statut.PUBLIEE,
            visible=True,
            compte_rendu="Compte rendu B.",
        )

        self.client.force_authenticate(user=self.owner_user)

        response = self.client.get(
            "/api/reunions/coproprietaire/rencontres/",
            **self._headers(self.copro),
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        ids = {item["id"] for item in _api_items(response.data)}
        self.assertIn(current.id, ids)
        self.assertNotIn(other.id, ids)

        response = self.client.get(
            "/api/reunions/coproprietaire/rencontres/",
            **self._headers(self.other_copro),
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
