from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from apps.core.models import CoproMembre, Copropriete, UserSecurityProfile


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


class JWTAuthenticationFlowTests(APITestCase):
    def setUp(self):
        User = get_user_model()

        self.user = User.objects.create_user(
            username="jwt-test",
            email="jwt-test@example.com",
            password="TempPassword123!",
            first_name="JWT",
            last_name="Test",
        )

        self.copropriete = Copropriete.objects.create(
            nom="Résidence Test JWT",
            ville="Abidjan",
            is_active=True,
            statut=Copropriete.Statut.ACTIVE,
        )

        CoproMembre.objects.create(
            user=self.user,
            copropriete=self.copropriete,
            role=CoproMembre.Role.COPROPRIETAIRE,
            is_active=True,
        )

        self.security_profile = UserSecurityProfile.objects.create(
            user=self.user,
            must_change_password=True,
        )

        self.login_url = "/api/auth/login/"
        self.refresh_url = "/api/auth/refresh/"
        self.change_password_url = "/api/auth/change-password/"
        self.auth_me_url = "/api/auth/me/"

    def test_login_change_password_and_auth_me_flow(self):
        login_response = self.client.post(
            self.login_url,
            {
                "username": "jwt-test",
                "password": "TempPassword123!",
            },
            format="json",
            HTTP_X_COPROPRIETE_ID=str(self.copropriete.id),
        )

        self.assertEqual(login_response.status_code, 200)

        login_payload = login_response.json()

        self.assertIn("access", login_payload)
        self.assertIn("refresh", login_payload)
        self.assertTrue(login_payload["must_change_password"])

        access_token = login_payload["access"]
        refresh_token = login_payload["refresh"]

        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {access_token}",
            HTTP_X_COPROPRIETE_ID=str(self.copropriete.id),
        )

        blocked_response = self.client.get(self.auth_me_url)

        self.assertEqual(blocked_response.status_code, 403)

        change_response = self.client.post(
            self.change_password_url,
            {
                "current_password": "TempPassword123!",
                "new_password": "NewSecurePassword123!",
                "confirm_password": "NewSecurePassword123!",
            },
            format="json",
            HTTP_X_COPROPRIETE_ID=str(self.copropriete.id),
        )

        self.assertEqual(change_response.status_code, 200)

        change_payload = change_response.json()

        self.assertFalse(change_payload["must_change_password"])

        self.security_profile.refresh_from_db()

        self.assertFalse(self.security_profile.must_change_password)
        self.assertIsNotNone(self.security_profile.password_changed_at)

        self.client.credentials(
            HTTP_AUTHORIZATION=f"Bearer {access_token}",
            HTTP_X_COPROPRIETE_ID=str(self.copropriete.id),
        )

        auth_me_response = self.client.get(self.auth_me_url)

        self.assertEqual(auth_me_response.status_code, 200)

        auth_me_payload = auth_me_response.json()

        self.assertIn("roles", auth_me_payload)

        refresh_response = self.client.post(
            self.refresh_url,
            {
                "refresh": refresh_token,
            },
            format="json",
        )

        self.assertEqual(refresh_response.status_code, 200)
        self.assertIn("access", refresh_response.json())

    def test_login_rejects_access_to_unrelated_copropriete(self):
        other_copropriete = Copropriete.objects.create(
            nom="Résidence Autre JWT",
            ville="Abidjan",
            is_active=True,
            statut=Copropriete.Statut.ACTIVE,
        )

        response = self.client.post(
            self.login_url,
            {
                "username": "jwt-test",
                "password": "TempPassword123!",
            },
            format="json",
            HTTP_X_COPROPRIETE_ID=str(other_copropriete.id),
        )

        self.assertEqual(response.status_code, 400)

        payload = response.json()

        self.assertIn("detail", payload)
        self.assertTrue(payload["detail"])
