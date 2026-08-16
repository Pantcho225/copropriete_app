from datetime import date
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.test import TestCase
from rest_framework.test import APITestCase
from apps.core.models import CoproMembre, Copropriete, UserSecurityProfile
from apps.lots.models import Lot
from .models import Coproprietaire, LotOccupant, ProprietaireLot




class OwnersBaseTestCase(TestCase):
    def setUp(self):
        self.copro = Copropriete.objects.create(
            nom="Résidence Test",
            ville="Abidjan",
        )

        self.copro_autre = Copropriete.objects.create(
            nom="Résidence Autre",
            ville="Abidjan",
        )

        self.lot = Lot.objects.create(
            copropriete=self.copro,
            reference="A-101",
        )

        self.lot_autre_copro = Lot.objects.create(
            copropriete=self.copro_autre,
            reference="B-201",
        )

        self.owner = Coproprietaire.objects.create(
            copropriete=self.copro,
            nom="KONE",
            prenom="Jean",
            email="jean.kone@example.com",
        )

        self.owner_autre_copro = Coproprietaire.objects.create(
            copropriete=self.copro_autre,
            nom="YAO",
            prenom="Paul",
            email="paul.yao@example.com",
        )

class LotOccupantModelTests(OwnersBaseTestCase):
    def test_creation_occupant_valide(self):
        occupant = LotOccupant.objects.create(
            copropriete=self.copro,
            lot=self.lot,
            coproprietaire=self.owner,
            nom="KONE",
            prenom="Jean",
            telephone="0700000000",
            email="JEAN.KONE@EXAMPLE.COM",
            date_entree=date(2026, 1, 1),
        )

        self.assertEqual(occupant.display_name, "Jean KONE")
        self.assertTrue(occupant.is_active)
        self.assertEqual(occupant.email, "jean.kone@example.com")

    def test_nom_et_prenom_sont_nettoyes(self):
        occupant = LotOccupant.objects.create(
            copropriete=self.copro,
            lot=self.lot,
            nom="  KOUASSI  ",
            prenom="  Eric  ",
        )

        self.assertEqual(occupant.nom, "KOUASSI")
        self.assertEqual(occupant.prenom, "Eric")

    def test_contact_label(self):
        occupant = LotOccupant.objects.create(
            copropriete=self.copro,
            lot=self.lot,
            nom="KOFFI",
            prenom="Paul",
            email="paul.koffi@example.com",
            telephone="0500000000",
        )

        self.assertEqual(
            occupant.contact_label,
            "paul.koffi@example.com / 0500000000",
        )

    def test_occupant_sans_nom_est_refuse(self):
        occupant = LotOccupant(
            copropriete=self.copro,
            lot=self.lot,
            nom="",
            prenom="Jean",
        )

        with self.assertRaises(ValidationError):
            occupant.full_clean()

    def test_lot_d_une_autre_copropriete_refuse(self):
        occupant = LotOccupant(
            copropriete=self.copro,
            lot=self.lot_autre_copro,
            nom="KONE",
            prenom="Jean",
        )

        with self.assertRaises(ValidationError):
            occupant.full_clean()

    def test_coproprietaire_d_une_autre_copropriete_refuse(self):
        occupant = LotOccupant(
            copropriete=self.copro,
            lot=self.lot,
            coproprietaire=self.owner_autre_copro,
            nom="KONE",
            prenom="Jean",
        )

        with self.assertRaises(ValidationError):
            occupant.full_clean()

    def test_date_sortie_avant_date_entree_refusee(self):
        occupant = LotOccupant(
            copropriete=self.copro,
            lot=self.lot,
            nom="KONE",
            prenom="Jean",
            date_entree=date(2026, 6, 1),
            date_sortie=date(2026, 5, 31),
        )

        with self.assertRaises(ValidationError):
            occupant.full_clean()

    def test_date_sortie_desactive_automatiquement_occupant(self):
        occupant = LotOccupant.objects.create(
            copropriete=self.copro,
            lot=self.lot,
            nom="KONE",
            prenom="Jean",
            date_entree=date(2026, 1, 1),
            date_sortie=date(2026, 6, 30),
        )

        self.assertFalse(occupant.actif)
        self.assertFalse(occupant.is_active)

    def test_deux_occupants_principaux_actifs_sont_refuses(self):
        LotOccupant.objects.create(
            copropriete=self.copro,
            lot=self.lot,
            nom="KONE",
            prenom="Jean",
            occupant_principal=True,
            actif=True,
        )

        second = LotOccupant(
            copropriete=self.copro,
            lot=self.lot,
            nom="YAO",
            prenom="Marie",
            occupant_principal=True,
            actif=True,
        )

        with self.assertRaises(ValidationError):
            second.full_clean()

    def test_occupant_non_principal_est_accepte(self):
        LotOccupant.objects.create(
            copropriete=self.copro,
            lot=self.lot,
            nom="KONE",
            prenom="Jean",
            occupant_principal=True,
            actif=True,
        )

        second = LotOccupant(
            copropriete=self.copro,
            lot=self.lot,
            nom="YAO",
            prenom="Marie",
            occupant_principal=False,
            actif=True,
        )

        second.full_clean()
        second.save()

        self.assertFalse(second.occupant_principal)
        self.assertTrue(second.is_active)

    def test_nombre_occupants_zero_est_refuse(self):
        occupant = LotOccupant(
            copropriete=self.copro,
            lot=self.lot,
            nom="KONE",
            prenom="Jean",
            nombre_occupants=0,
        )

        with self.assertRaises(ValidationError):
            occupant.full_clean()

    def test_nombre_occupants_valide(self):
        occupant = LotOccupant.objects.create(
            copropriete=self.copro,
            lot=self.lot,
            nom="KONE",
            prenom="Jean",
            nombre_occupants=4,
        )

        self.assertEqual(occupant.nombre_occupants, 4)

    def test_periode_label_depuis_date_entree(self):
        occupant = LotOccupant.objects.create(
            copropriete=self.copro,
            lot=self.lot,
            nom="KONE",
            prenom="Jean",
            date_entree=date(2026, 1, 15),
        )

        self.assertEqual(
            occupant.periode_label,
            "Depuis le 2026-01-15",
        )

    def test_periode_label_avec_entree_et_sortie(self):
        occupant = LotOccupant(
            copropriete=self.copro,
            lot=self.lot,
            nom="KONE",
            prenom="Jean",
            date_entree=date(2026, 1, 15),
            date_sortie=date(2026, 6, 30),
        )

        # Pas besoin de save : clean() suffit pour vérifier le format.
        occupant.full_clean()

        self.assertEqual(
            occupant.periode_label,
            "Du 2026-01-15 au 2026-06-30",
        )

    def test_periode_label_sans_dates(self):
        occupant = LotOccupant(
            copropriete=self.copro,
            lot=self.lot,
            nom="KONE",
            prenom="Jean",
        )

        occupant.full_clean()

        self.assertEqual(
            occupant.periode_label,
            "Période non renseignée",
        )



class OwnersAPIAccessTests(APITestCase):
    def setUp(self):
        User = get_user_model()

        self.copro = Copropriete.objects.create(
            nom="Résidence API Test",
            ville="Abidjan",
        )

        self.copro_autre = Copropriete.objects.create(
            nom="Résidence API Autre",
            ville="Abidjan",
        )

        self.owner = Coproprietaire.objects.create(
            copropriete=self.copro,
            nom="KONE",
            prenom="Jean",
            email="jean.api@example.com",
        )

        self.owner_autre = Coproprietaire.objects.create(
            copropriete=self.copro_autre,
            nom="YAO",
            prenom="Paul",
            email="paul.api@example.com",
        )

        self.users = {}

        for role in (
            CoproMembre.Role.ADMIN,
            CoproMembre.Role.SYNDIC,
            CoproMembre.Role.GESTIONNAIRE,
            CoproMembre.Role.COPROPRIETAIRE,
        ):
            username = f"user-{role.lower()}"

            user = User.objects.create_user(
                username=username,
                email=f"{username}@example.com",
                password="SecurePassword123!",
            )

            CoproMembre.objects.create(
                user=user,
                copropriete=self.copro,
                role=role,
                is_active=True,
            )

            self.users[role] = user

        self.user_autre_copro = User.objects.create_user(
            username="autre-copro",
            email="autre-copro@example.com",
            password="SecurePassword123!",
        )

        CoproMembre.objects.create(
            user=self.user_autre_copro,
            copropriete=self.copro_autre,
            role=CoproMembre.Role.SYNDIC,
            is_active=True,
        )

        self.list_url = "/api/owners/coproprietaires/"

    def authenticate(self, role):
        self.client.force_authenticate(user=self.users[role])

    def test_admin_peut_lire_les_coproprietaires(self):
        self.authenticate(CoproMembre.Role.ADMIN)

        response = self.client.get(
            self.list_url,
            {"copropriete": self.copro.id},
        )

        self.assertEqual(response.status_code, 200)

        payload = response.json()

        self.assertEqual(payload["count"], 1)
        self.assertEqual(payload["results"][0]["id"], self.owner.id)

    def test_syndic_peut_lire_les_coproprietaires(self):
        self.authenticate(CoproMembre.Role.SYNDIC)

        response = self.client.get(
            self.list_url,
            {"copropriete": self.copro.id},
        )

        self.assertEqual(response.status_code, 200)

        payload = response.json()

        self.assertEqual(payload["count"], 1)
        self.assertEqual(payload["results"][0]["id"], self.owner.id)

    def test_gestionnaire_peut_lire_les_coproprietaires(self):
        self.authenticate(CoproMembre.Role.GESTIONNAIRE)

        response = self.client.get(
            self.list_url,
            {"copropriete": self.copro.id},
        )

        self.assertEqual(response.status_code, 200)

        payload = response.json()

        self.assertEqual(payload["count"], 1)
        self.assertEqual(payload["results"][0]["id"], self.owner.id)

    def test_coproprietaire_ne_peut_pas_lire_le_referentiel_admin(self):
        self.authenticate(CoproMembre.Role.COPROPRIETAIRE)

        response = self.client.get(
            self.list_url,
            {"copropriete": self.copro.id},
        )

        self.assertEqual(response.status_code, 403)

    def test_utilisateur_d_une_autre_copropriete_ne_voit_pas_cette_copropriete(self):
        self.client.force_authenticate(user=self.user_autre_copro)

        response = self.client.get(
            self.list_url,
            {"copropriete": self.copro.id},
        )

        self.assertEqual(response.status_code, 200)

        payload = response.json()

        self.assertEqual(payload["count"], 0)

    def test_creation_coproprietaire_est_autorisee_pour_syndic(self):
        self.authenticate(CoproMembre.Role.SYNDIC)

        response = self.client.post(
            self.list_url,
            {
                "copropriete": self.copro.id,
                "nom": "KOUASSI",
                "prenom": "Eric",
                "email": "eric.kouassi@example.com",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201)

        self.assertTrue(
            Coproprietaire.objects.filter(
                copropriete=self.copro,
                nom="KOUASSI",
                prenom="Eric",
            ).exists()
        )

    def test_coproprietaire_ne_peut_pas_creer_un_coproprietaire(self):
        self.authenticate(CoproMembre.Role.COPROPRIETAIRE)

        response = self.client.post(
            self.list_url,
            {
                "copropriete": self.copro.id,
                "nom": "KOUASSI",
                "prenom": "Eric",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 403)

    def test_creation_dans_une_autre_copropriete_est_refusee(self):
        self.authenticate(CoproMembre.Role.SYNDIC)

        response = self.client.post(
            self.list_url,
            {
                "copropriete": self.copro_autre.id,
                "nom": "KOUASSI",
                "prenom": "Eric",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 403)

    def test_suppression_est_une_desactivation_logique(self):
        self.authenticate(CoproMembre.Role.ADMIN)

        response = self.client.delete(
            f"{self.list_url}{self.owner.id}/",
        )

        self.assertEqual(response.status_code, 200)

        self.owner.refresh_from_db()

        self.assertFalse(self.owner.actif)

    def test_coproprietaire_ne_peut_pas_desactiver_un_coproprietaire(self):
        self.authenticate(CoproMembre.Role.COPROPRIETAIRE)

        response = self.client.delete(
            f"{self.list_url}{self.owner.id}/",
        )

        self.assertEqual(response.status_code, 403)

        self.owner.refresh_from_db()

        self.assertTrue(self.owner.actif)

    def test_utilisateur_non_authentifie_est_refuse(self):
        self.client.force_authenticate(user=None)

        response = self.client.get(
            self.list_url,
            {"copropriete": self.copro.id},
        )

        self.assertEqual(response.status_code, 401)


class CoproprietaireCreateUserAccessAPITests(APITestCase):
    def setUp(self):
        User = get_user_model()

        self.copro = Copropriete.objects.create(
            nom="Résidence Access Test",
            ville="Abidjan",
        )

        self.admin = User.objects.create_user(
            username="access-admin",
            email="access-admin@example.com",
            password="SecurePassword123!",
        )

        CoproMembre.objects.create(
            user=self.admin,
            copropriete=self.copro,
            role=CoproMembre.Role.ADMIN,
            is_active=True,
        )

        self.owner = Coproprietaire.objects.create(
            copropriete=self.copro,
            nom="KONE",
            prenom="Jean",
            email="jean.access@example.com",
        )

        self.url = (
            f"/api/owners/coproprietaires/"
            f"{self.owner.id}/create-user-access/"
        )

        self.client.force_authenticate(user=self.admin)

    def test_create_user_access_cree_compte_et_membership(self):
        response = self.client.post(
            self.url,
            {},
            format="json",
        )

        self.assertEqual(response.status_code, 201)

        payload = response.json()

        self.assertTrue(payload["created_user"])
        self.assertTrue(payload["membership_created"])
        self.assertTrue(payload["must_change_password"])

        self.assertIn("temporary_password", payload)
        self.assertTrue(payload["temporary_password"])

        self.owner.refresh_from_db()

        self.assertIsNotNone(self.owner.user_account_id)

        user = self.owner.user_account

        self.assertEqual(
            user.email,
            "jean.access@example.com",
        )

        self.assertTrue(user.is_active)

        membership = CoproMembre.objects.get(
            copropriete=self.copro,
            user=user,
        )

        self.assertEqual(
            membership.role,
            CoproMembre.Role.COPROPRIETAIRE,
        )

        self.assertTrue(membership.is_active)

        security_profile = UserSecurityProfile.objects.get(
            user=user,
        )

        self.assertTrue(
            security_profile.must_change_password,
        )

    def test_create_user_access_refuse_sans_email(self):
        self.owner.email = ""
        self.owner.save()

        response = self.client.post(
            self.url,
            {},
            format="json",
        )

        self.assertEqual(response.status_code, 400)

        self.assertIn(
            "email",
            response.json(),
        )

    def test_create_user_access_refuse_coproprietaire_inactif(self):
        self.owner.actif = False
        self.owner.save()

        response = self.client.post(
            self.url,
            {},
            format="json",
        )

        self.assertEqual(response.status_code, 400)

    def test_coproprietaire_ne_peut_pas_creer_son_acces_depuis_admin_api(self):
        User = get_user_model()

        copro_user = User.objects.create_user(
            username="simple-copro",
            email="simple-copro@example.com",
            password="SecurePassword123!",
        )

        CoproMembre.objects.create(
            user=copro_user,
            copropriete=self.copro,
            role=CoproMembre.Role.COPROPRIETAIRE,
            is_active=True,
        )

        self.client.force_authenticate(user=copro_user)

        response = self.client.post(
            self.url,
            {},
            format="json",
        )

        self.assertEqual(response.status_code, 403)
