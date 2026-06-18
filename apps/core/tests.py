from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from apps.core.models import CoproMembre, Copropriete


class AuthMeTests(APITestCase):
    def test_auth_me_exposes_membership_role_label_and_permissions(self):
        User = get_user_model()

        user = User.objects.create_user(
            username="syndic-test",
            email="syndic@example.com",
            password="secret12345",
            first_name="Syndic",
            last_name="Test",
        )

        copropriete = Copropriete.objects.create(
            nom="Résidence Test Auth",
            ville="Abidjan",
            is_active=True,
            statut=Copropriete.Statut.ACTIVE,
        )

        membership = CoproMembre.objects.create(
            user=user,
            copropriete=copropriete,
            role=CoproMembre.Role.SYNDIC,
            is_active=True,
        )

        self.client.force_authenticate(user=user)

        response = self.client.get("/api/auth/me/")

        self.assertEqual(response.status_code, 200)

        payload = response.json()

        self.assertIn("roles", payload)
        self.assertIn(CoproMembre.Role.SYNDIC, payload["roles"])

        self.assertIn("memberships", payload)
        self.assertEqual(len(payload["memberships"]), 1)

        row = payload["memberships"][0]

        self.assertEqual(row["id"], membership.id)
        self.assertEqual(row["role"], CoproMembre.Role.SYNDIC)
        self.assertEqual(row["role_label"], "Syndic")
        self.assertTrue(row["is_active"])

        self.assertEqual(row["copropriete"]["id"], copropriete.id)
        self.assertEqual(row["copropriete"]["nom"], copropriete.nom)

        self.assertIn("permissions", row)

        permissions = row["permissions"]

        self.assertTrue(permissions["can_manage_copropriete"])
        self.assertTrue(permissions["can_manage_referentiel"])
        self.assertTrue(permissions["can_manage_users"])
        self.assertTrue(permissions["can_write_compta"])
        self.assertTrue(permissions["can_read_reports"])

    def test_auth_me_ignores_inactive_memberships(self):
        User = get_user_model()

        user = User.objects.create_user(
            username="inactive-member",
            email="inactive@example.com",
            password="secret12345",
        )

        copropriete = Copropriete.objects.create(
            nom="Résidence Inactive Membership",
            ville="Abidjan",
            is_active=True,
            statut=Copropriete.Statut.ACTIVE,
        )

        CoproMembre.objects.create(
            user=user,
            copropriete=copropriete,
            role=CoproMembre.Role.COPROPRIETAIRE,
            is_active=False,
        )

        self.client.force_authenticate(user=user)

        response = self.client.get("/api/auth/me/")

        self.assertEqual(response.status_code, 200)

        payload = response.json()

        self.assertEqual(payload["roles"], [])
        self.assertEqual(payload["memberships"], [])
        self.assertFalse(payload["is_coproprietaire"])
