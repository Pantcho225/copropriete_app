from __future__ import annotations

import shutil
import tempfile

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from rest_framework import status
from rest_framework.test import APITestCase

from apps.core.models import CoproMembre, Copropriete
from apps.documents.models import (
    AdministrativeDocument,
    AdministrativeDocumentCategory,
)


TEST_MEDIA_ROOT = tempfile.mkdtemp(prefix="copro_docs_tests_")


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
class AdministrativeDocumentAPITestCase(APITestCase):
    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        shutil.rmtree(TEST_MEDIA_ROOT, ignore_errors=True)

    def setUp(self):
        User = get_user_model()

        self.admin_user = User.objects.create_superuser(
            username="admin_docs",
            email="admin_docs@example.com",
            password="testpass",
        )
        self.owner_user = User.objects.create_user(
            username="owner_docs",
            email="owner_docs@example.com",
            password="testpass",
        )
        self.other_owner_user = User.objects.create_user(
            username="other_owner_docs",
            email="other_owner_docs@example.com",
            password="testpass",
        )

        self.copro = Copropriete.objects.create(nom="Résidence Documents A")
        self.other_copro = Copropriete.objects.create(nom="Résidence Documents B")

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

        self.category = AdministrativeDocumentCategory.objects.create(
            copropriete=self.copro,
            name="Contrats",
            code="contrats",
            description="Contrats administratifs",
            is_active=True,
            order=10,
            created_by=self.admin_user,
            updated_by=self.admin_user,
        )
        self.other_category = AdministrativeDocumentCategory.objects.create(
            copropriete=self.other_copro,
            name="Assurances",
            code="assurances",
            description="Assurances administratives",
            is_active=True,
            order=10,
            created_by=self.admin_user,
            updated_by=self.admin_user,
        )

    def _headers(self, copro=None):
        return {"HTTP_X_COPROPRIETE_ID": str((copro or self.copro).id)}

    def _pdf(self, filename="document-test.pdf"):
        return SimpleUploadedFile(
            filename,
            b"%PDF-1.4\n% document administratif test\n%%EOF",
            content_type="application/pdf",
        )

    def _create_document(
        self,
        *,
        copro=None,
        category=None,
        title="Document administratif test",
        reference="DOC-ADMIN-TEST",
        visible=False,
        filename="document-test.pdf",
    ):
        pdf = self._pdf(filename)
        return AdministrativeDocument.objects.create(
            copropriete=copro or self.copro,
            category=category or self.category,
            title=title,
            reference=reference,
            description="Document de test",
            file=pdf,
            original_filename=filename,
            mime_type="application/pdf",
            size_bytes=pdf.size,
            visible_to_coproprietaires=visible,
            created_by=self.admin_user,
            updated_by=self.admin_user,
        )

    def test_admin_can_create_category_and_upload_document(self):
        self.client.force_authenticate(user=self.admin_user)

        response = self.client.post(
            "/api/documents/categories/",
            {
                "name": "Courriers administratifs",
                "code": "courriers-administratifs",
                "description": "Courriers et notes administratives.",
                "is_active": True,
                "order": 20,
            },
            format="json",
            **self._headers(),
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        category_id = response.data["id"]

        response = self.client.post(
            "/api/documents/administratifs/",
            {
                "category": category_id,
                "title": "Courrier syndic 2026",
                "reference": "DOC-ADMIN-API-001",
                "description": "Courrier administratif de test.",
                "visible_to_coproprietaires": False,
                "file": self._pdf("courrier-syndic.pdf"),
            },
            format="multipart",
            **self._headers(),
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["title"], "Courrier syndic 2026")
        self.assertEqual(response.data["original_filename"], "courrier-syndic.pdf")
        self.assertEqual(response.data["mime_type"], "application/pdf")
        self.assertFalse(response.data["visible_to_coproprietaires"])
        self.assertIsNone(response.data["published_at"])

    def test_owner_only_sees_visible_documents(self):
        hidden_doc = self._create_document(
            title="Document masqué",
            reference="DOC-HIDDEN",
            visible=False,
            filename="hidden.pdf",
        )
        visible_doc = self._create_document(
            title="Document visible",
            reference="DOC-VISIBLE",
            visible=True,
            filename="visible.pdf",
        )

        self.client.force_authenticate(user=self.owner_user)

        response = self.client.get(
            "/api/documents/coproprietaire/administratifs/",
            **self._headers(),
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        items = _api_items(response.data)
        ids = {item["id"] for item in items}

        self.assertIn(visible_doc.id, ids)
        self.assertNotIn(hidden_doc.id, ids)

    def test_owner_can_download_visible_document_but_not_hidden_document(self):
        hidden_doc = self._create_document(
            title="Document masqué téléchargement",
            reference="DOC-HIDDEN-DOWNLOAD",
            visible=False,
            filename="hidden-download.pdf",
        )
        visible_doc = self._create_document(
            title="Document visible téléchargement",
            reference="DOC-VISIBLE-DOWNLOAD",
            visible=True,
            filename="visible-download.pdf",
        )

        self.client.force_authenticate(user=self.owner_user)

        response = self.client.get(
            f"/api/documents/coproprietaire/administratifs/{hidden_doc.id}/download/",
            **self._headers(),
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

        response = self.client.get(
            f"/api/documents/coproprietaire/administratifs/{visible_doc.id}/download/",
            **self._headers(),
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response["Content-Type"], "application/pdf")
        self.assertIn("inline;", response["Content-Disposition"])

    def test_category_must_belong_to_current_copropriete(self):
        self.client.force_authenticate(user=self.admin_user)

        response = self.client.post(
            "/api/documents/administratifs/",
            {
                "category": self.other_category.id,
                "title": "Document catégorie étrangère",
                "reference": "DOC-WRONG-CATEGORY",
                "description": "Document invalide.",
                "visible_to_coproprietaires": True,
                "file": self._pdf("wrong-category.pdf"),
            },
            format="multipart",
            **self._headers(self.copro),
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("category", response.data)

    def test_documents_are_isolated_by_copropriete_header(self):
        current_doc = self._create_document(
            copro=self.copro,
            category=self.category,
            title="Document copro A",
            reference="DOC-COPRO-A",
            visible=True,
            filename="copro-a.pdf",
        )
        other_doc = self._create_document(
            copro=self.other_copro,
            category=self.other_category,
            title="Document copro B",
            reference="DOC-COPRO-B",
            visible=True,
            filename="copro-b.pdf",
        )

        self.client.force_authenticate(user=self.admin_user)

        response = self.client.get(
            "/api/documents/administratifs/",
            **self._headers(self.copro),
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        ids = {item["id"] for item in _api_items(response.data)}

        self.assertIn(current_doc.id, ids)
        self.assertNotIn(other_doc.id, ids)

        self.client.force_authenticate(user=self.owner_user)

        response = self.client.get(
            "/api/documents/coproprietaire/administratifs/",
            **self._headers(self.copro),
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        ids = {item["id"] for item in _api_items(response.data)}

        self.assertIn(current_doc.id, ids)
        self.assertNotIn(other_doc.id, ids)

        response = self.client.get(
            "/api/documents/coproprietaire/administratifs/",
            **self._headers(self.other_copro),
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
