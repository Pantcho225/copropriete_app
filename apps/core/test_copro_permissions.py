import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIRequestFactory

from apps.core.models import CoproMembre, Copropriete
from apps.core.permissions.copro import (
    BaseCoproPermission,
    CoproWriteReadOnly,
    IsCoproAdminOrSyndic,
    IsCoproComptableOrAbove,
    IsCoproMember,
)


pytestmark = pytest.mark.django_db


User = get_user_model()


@pytest.fixture
def factory():
    return APIRequestFactory()


@pytest.fixture
def coproprietes():
    return (
        Copropriete.objects.create(nom="Copropriété A"),
        Copropriete.objects.create(nom="Copropriété B"),
    )


@pytest.fixture
def user():
    return User.objects.create_user(
        username="user_test",
        password="password123",
    )


def make_request(factory, user, method="get", copro_id=None, header_copro_id=None):
    request = getattr(factory, method)("/test/")

    request.user = user

    if copro_id is not None:
        request.copropriete_id = copro_id

    if header_copro_id is not None:
        request.META["HTTP_X_COPROPRIETE_ID"] = str(header_copro_id)

    return request


def add_membership(user, copro, role, is_active=True):
    return CoproMembre.objects.create(
        user=user,
        copropriete=copro,
        role=role,
        is_active=is_active,
    )


class TestBaseCoproPermission:

    def test_non_authenticated_user_is_denied(self, factory, coproprietes):
        copro_a, _ = coproprietes

        request = make_request(
            factory,
            user=None,
            copro_id=copro_a.id,
        )

        request.user = type(
            "AnonymousUser",
            (),
            {"is_authenticated": False},
        )()

        permission = IsCoproMember()

        assert permission.has_permission(request, None) is False

    def test_missing_coproprieté_is_denied(self, factory, user):
        request = make_request(factory, user)

        permission = IsCoproMember()

        assert permission.has_permission(request, None) is False

    def test_active_member_is_allowed(self, factory, user, coproprietes):
        copro_a, _ = coproprietes

        add_membership(
            user,
            copro_a,
            CoproMembre.Role.COPROPRIETAIRE,
        )

        request = make_request(
            factory,
            user,
            copro_id=copro_a.id,
        )

        permission = IsCoproMember()

        assert permission.has_permission(request, None) is True

    def test_inactive_member_is_denied(self, factory, user, coproprietes):
        copro_a, _ = coproprietes

        add_membership(
            user,
            copro_a,
            CoproMembre.Role.COPROPRIETAIRE,
            is_active=False,
        )

        request = make_request(
            factory,
            user,
            copro_id=copro_a.id,
        )

        permission = IsCoproMember()

        assert permission.has_permission(request, None) is False

    def test_member_of_another_copro_is_denied(
        self,
        factory,
        user,
        coproprietes,
    ):
        copro_a, copro_b = coproprietes

        add_membership(
            user,
            copro_a,
            CoproMembre.Role.COPROPRIETAIRE,
        )

        request = make_request(
            factory,
            user,
            copro_id=copro_b.id,
        )

        permission = IsCoproMember()

        assert permission.has_permission(request, None) is False

    def test_header_can_define_coproprieté(
        self,
        factory,
        user,
        coproprietes,
    ):
        copro_a, _ = coproprietes

        add_membership(
            user,
            copro_a,
            CoproMembre.Role.COPROPRIETAIRE,
        )

        request = make_request(
            factory,
            user,
            header_copro_id=copro_a.id,
        )

        permission = IsCoproMember()

        assert permission.has_permission(request, None) is True

    def test_invalid_header_is_denied(self, factory, user):
        request = make_request(
            factory,
            user,
            header_copro_id="abc",
        )

        permission = IsCoproMember()

        assert permission.has_permission(request, None) is False


class TestCoproRoles:

    def test_admin_is_allowed_for_admin_permission(
        self,
        factory,
        user,
        coproprietes,
    ):
        copro_a, _ = coproprietes

        add_membership(
            user,
            copro_a,
            CoproMembre.Role.ADMIN,
        )

        request = make_request(
            factory,
            user,
            copro_id=copro_a.id,
        )

        assert IsCoproAdminOrSyndic().has_permission(
            request,
            None,
        ) is True

    def test_syndic_is_allowed_for_admin_permission(
        self,
        factory,
        user,
        coproprietes,
    ):
        copro_a, _ = coproprietes

        add_membership(
            user,
            copro_a,
            CoproMembre.Role.SYNDIC,
        )

        request = make_request(
            factory,
            user,
            copro_id=copro_a.id,
        )

        assert IsCoproAdminOrSyndic().has_permission(
            request,
            None,
        ) is True

    def test_coproprietaire_is_denied_for_admin_permission(
        self,
        factory,
        user,
        coproprietes,
    ):
        copro_a, _ = coproprietes

        add_membership(
            user,
            copro_a,
            CoproMembre.Role.COPROPRIETAIRE,
        )

        request = make_request(
            factory,
            user,
            copro_id=copro_a.id,
        )

        assert IsCoproAdminOrSyndic().has_permission(
            request,
            None,
        ) is False

    def test_comptable_is_allowed_for_compta_permission(
        self,
        factory,
        user,
        coproprietes,
    ):
        copro_a, _ = coproprietes

        add_membership(
            user,
            copro_a,
            CoproMembre.Role.COMPTABLE,
        )

        request = make_request(
            factory,
            user,
            copro_id=copro_a.id,
        )

        assert IsCoproComptableOrAbove().has_permission(
            request,
            None,
        ) is True


class TestCoproWriteReadOnly:

    def test_member_can_read(
        self,
        factory,
        user,
        coproprietes,
    ):
        copro_a, _ = coproprietes

        add_membership(
            user,
            copro_a,
            CoproMembre.Role.COPROPRIETAIRE,
        )

        request = make_request(
            factory,
            user,
            method="get",
            copro_id=copro_a.id,
        )

        permission = CoproWriteReadOnly()

        assert permission.has_permission(request, None) is True

    def test_coproprietaire_cannot_write(
        self,
        factory,
        user,
        coproprietes,
    ):
        copro_a, _ = coproprietes

        add_membership(
            user,
            copro_a,
            CoproMembre.Role.COPROPRIETAIRE,
        )

        request = make_request(
            factory,
            user,
            method="post",
            copro_id=copro_a.id,
        )

        permission = CoproWriteReadOnly()

        assert permission.has_permission(request, None) is False

    def test_admin_can_write(
        self,
        factory,
        user,
        coproprietes,
    ):
        copro_a, _ = coproprietes

        add_membership(
            user,
            copro_a,
            CoproMembre.Role.ADMIN,
        )

        request = make_request(
            factory,
            user,
            method="post",
            copro_id=copro_a.id,
        )

        permission = CoproWriteReadOnly()

        assert permission.has_permission(request, None) is True


class TestAdminOverride:

    def test_superuser_is_allowed(
        self,
        factory,
        user,
    ):
        user.is_superuser = True
        user.save(update_fields=["is_superuser"])

        request = make_request(
            factory,
            user,
        )

        permission = IsCoproMember()

        assert permission.has_permission(request, None) is True

    def test_staff_is_allowed(
        self,
        factory,
        user,
    ):
        user.is_staff = True
        user.save(update_fields=["is_staff"])

        request = make_request(
            factory,
            user,
        )

        permission = IsCoproMember()

        assert permission.has_permission(request, None) is True

class DummyObj:
    pass


class TestObjectPermissions:

    def test_same_copro_object_is_allowed(
        self,
        factory,
        user,
        coproprietes,
    ):
        copro_a, _ = coproprietes

        add_membership(
            user,
            copro_a,
            CoproMembre.Role.COPROPRIETAIRE,
        )

        request = make_request(
            factory,
            user,
            copro_id=copro_a.id,
        )

        obj = DummyObj()
        obj.copropriete_id = copro_a.id

        assert IsCoproMember().has_object_permission(
            request,
            None,
            obj,
        ) is True

    def test_other_copro_object_is_denied(
        self,
        factory,
        user,
        coproprietes,
    ):
        copro_a, copro_b = coproprietes

        add_membership(
            user,
            copro_a,
            CoproMembre.Role.COPROPRIETAIRE,
        )

        request = make_request(
            factory,
            user,
            copro_id=copro_a.id,
        )

        obj = DummyObj()
        obj.copropriete_id = copro_b.id

        assert IsCoproMember().has_object_permission(
            request,
            None,
            obj,
        ) is False

    def test_object_without_coproprietaire_is_allowed(
        self,
        factory,
        user,
        coproprietes,
    ):
        copro_a, _ = coproprietes

        add_membership(
            user,
            copro_a,
            CoproMembre.Role.COPROPRIETAIRE,
        )

        request = make_request(
            factory,
            user,
            copro_id=copro_a.id,
        )

        obj = DummyObj()

        assert IsCoproMember().has_object_permission(
            request,
            None,
            obj,
        ) is True

    def test_object_copro_is_detected_through_releve_import(
        self,
        factory,
        user,
        coproprietes,
    ):
        copro_a, copro_b = coproprietes

        add_membership(
            user,
            copro_a,
            CoproMembre.Role.COPROPRIETAIRE,
        )

        request = make_request(
            factory,
            user,
            copro_id=copro_a.id,
        )

        releve_import = DummyObj()
        releve_import.copropriete_id = copro_a.id

        obj = DummyObj()
        obj.releve_import = releve_import

        assert IsCoproMember().has_object_permission(
            request,
            None,
            obj,
        ) is True

        releve_import.copropriete_id = copro_b.id

        assert IsCoproMember().has_object_permission(
            request,
            None,
            obj,
        ) is False

    def test_object_copro_is_detected_through_ligne(
        self,
        factory,
        user,
        coproprietes,
    ):
        copro_a, copro_b = coproprietes

        add_membership(
            user,
            copro_a,
            CoproMembre.Role.COPROPRIETAIRE,
        )

        request = make_request(
            factory,
            user,
            copro_id=copro_a.id,
        )

        ligne = DummyObj()
        ligne.copropriete_id = copro_a.id

        obj = DummyObj()
        obj.ligne = ligne

        assert IsCoproMember().has_object_permission(
            request,
            None,
            obj,
        ) is True

        ligne.copropriete_id = copro_b.id

        assert IsCoproMember().has_object_permission(
            request,
            None,
            obj,
        ) is False

    def test_object_copro_is_detected_through_ligne_appel(
        self,
        factory,
        user,
        coproprietes,
    ):
        copro_a, copro_b = coproprietes

        add_membership(
            user,
            copro_a,
            CoproMembre.Role.COPROPRIETAIRE,
        )

        request = make_request(
            factory,
            user,
            copro_id=copro_a.id,
        )

        appel = DummyObj()
        appel.copropriete_id = copro_a.id

        ligne = DummyObj()
        ligne.copropriete_id = None
        ligne.appel = appel

        obj = DummyObj()
        obj.ligne = ligne

        assert IsCoproMember().has_object_permission(
            request,
            None,
            obj,
        ) is True

        appel.copropriete_id = copro_b.id

        assert IsCoproMember().has_object_permission(
            request,
            None,
            obj,
        ) is False

    def test_object_copro_is_detected_through_dossier(
        self,
        factory,
        user,
        coproprietes,
    ):
        copro_a, copro_b = coproprietes

        add_membership(
            user,
            copro_a,
            CoproMembre.Role.COPROPRIETAIRE,
        )

        request = make_request(
            factory,
            user,
            copro_id=copro_a.id,
        )

        dossier = DummyObj()
        dossier.copropriete_id = copro_a.id

        obj = DummyObj()
        obj.dossier = dossier

        assert IsCoproMember().has_object_permission(
            request,
            None,
            obj,
        ) is True

        dossier.copropriete_id = copro_b.id

        assert IsCoproMember().has_object_permission(
            request,
            None,
            obj,
        ) is False

    def test_invalid_object_copro_id_is_denied(
        self,
        factory,
        user,
        coproprietes,
    ):
        copro_a, _ = coproprietes

        add_membership(
            user,
            copro_a,
            CoproMembre.Role.COPROPRIETAIRE,
        )

        request = make_request(
            factory,
            user,
            copro_id=copro_a.id,
        )

        obj = DummyObj()
        obj.copropriete_id = "abc"

        assert IsCoproMember().has_object_permission(
            request,
            None,
            obj,
        ) is False

class TestPermissionV2:

    def test_superuser_override_without_copro(
        self,
        factory,
        user,
    ):
        user.is_superuser = True
        user.save(update_fields=["is_superuser"])

        request = make_request(
            factory,
            user,
        )

        assert IsCoproMember().has_permission(
            request,
            None,
        ) is True

    def test_staff_override_without_copro(
        self,
        factory,
        user,
    ):
        user.is_staff = True
        user.save(update_fields=["is_staff"])

        request = make_request(
            factory,
            user,
        )

        assert IsCoproMember().has_permission(
            request,
            None,
        ) is True

    def test_allowed_roles_empty_denies_everyone(
        self,
        factory,
        user,
        coproprietes,
    ):
        copro_a, _ = coproprietes

        add_membership(
            user,
            copro_a,
            CoproMembre.Role.ADMIN,
        )

        request = make_request(
            factory,
            user,
            copro_id=copro_a.id,
        )

        permission = type(
            "NoRolePermission",
            (BaseCoproPermission,),
            {
                "allowed_roles": [],
            },
        )()

        assert permission.has_permission(
            request,
            None,
        ) is False

    def test_read_roles_restrict_read_access(
        self,
        factory,
        user,
        coproprietes,
    ):
        copro_a, _ = coproprietes

        add_membership(
            user,
            copro_a,
            CoproMembre.Role.COPROPRIETAIRE,
        )

        request = make_request(
            factory,
            user,
            method="get",
            copro_id=copro_a.id,
        )

        permission = CoproWriteReadOnly()
        permission.read_roles = (
            CoproMembre.Role.ADMIN,
            CoproMembre.Role.SYNDIC,
        )

        assert permission.has_permission(
            request,
            None,
        ) is False

    def test_read_roles_allow_authorized_role(
        self,
        factory,
        user,
        coproprietes,
    ):
        copro_a, _ = coproprietes

        add_membership(
            user,
            copro_a,
            CoproMembre.Role.SYNDIC,
        )

        request = make_request(
            factory,
            user,
            method="get",
            copro_id=copro_a.id,
        )

        permission = CoproWriteReadOnly()
        permission.read_roles = (
            CoproMembre.Role.ADMIN,
            CoproMembre.Role.SYNDIC,
        )

        assert permission.has_permission(
            request,
            None,
        ) is True

    def test_empty_read_roles_deny_read(
        self,
        factory,
        user,
        coproprietes,
    ):
        copro_a, _ = coproprietes

        add_membership(
            user,
            copro_a,
            CoproMembre.Role.ADMIN,
        )

        request = make_request(
            factory,
            user,
            method="get",
            copro_id=copro_a.id,
        )

        permission = CoproWriteReadOnly()
        permission.read_roles = []

        assert permission.has_permission(
            request,
            None,
        ) is False

    def test_empty_write_roles_deny_write(
        self,
        factory,
        user,
        coproprietes,
    ):
        copro_a, _ = coproprietes

        add_membership(
            user,
            copro_a,
            CoproMembre.Role.ADMIN,
        )

        request = make_request(
            factory,
            user,
            method="post",
            copro_id=copro_a.id,
        )

        permission = CoproWriteReadOnly()
        permission.write_roles = ()

        assert permission.has_permission(
            request,
            None,
        ) is False

    def test_coproprietaire_cannot_write(
        self,
        factory,
        user,
        coproprietes,
    ):
        copro_a, _ = coproprietes

        add_membership(
            user,
            copro_a,
            CoproMembre.Role.COPROPRIETAIRE,
        )

        request = make_request(
            factory,
            user,
            method="post",
            copro_id=copro_a.id,
        )

        permission = CoproWriteReadOnly()

        assert permission.has_permission(
            request,
            None,
        ) is False

    def test_syndic_can_write(
        self,
        factory,
        user,
        coproprietes,
    ):
        copro_a, _ = coproprietes

        add_membership(
            user,
            copro_a,
            CoproMembre.Role.SYNDIC,
        )

        request = make_request(
            factory,
            user,
            method="post",
            copro_id=copro_a.id,
        )

        permission = CoproWriteReadOnly()

        assert permission.has_permission(
            request,
            None,
        ) is True

    def test_write_object_from_other_copro_is_denied(
        self,
        factory,
        user,
        coproprietes,
    ):
        copro_a, copro_b = coproprietes

        add_membership(
            user,
            copro_a,
            CoproMembre.Role.SYNDIC,
        )

        request = make_request(
            factory,
            user,
            method="post",
            copro_id=copro_a.id,
        )

        obj = DummyObj()
        obj.copropriete_id = copro_b.id

        permission = CoproWriteReadOnly()

        assert permission.has_object_permission(
            request,
            None,
            obj,
        ) is False

    def test_write_object_same_copro_is_allowed(
        self,
        factory,
        user,
        coproprietes,
    ):
        copro_a, _ = coproprietes

        add_membership(
            user,
            copro_a,
            CoproMembre.Role.SYNDIC,
        )

        request = make_request(
            factory,
            user,
            method="post",
            copro_id=copro_a.id,
        )

        obj = DummyObj()
        obj.copropriete_id = copro_a.id

        permission = CoproWriteReadOnly()

        assert permission.has_object_permission(
            request,
            None,
            obj,
        ) is True

    def test_write_object_without_copro_is_allowed(
        self,
        factory,
        user,
        coproprietes,
    ):
        copro_a, _ = coproprietes

        add_membership(
            user,
            copro_a,
            CoproMembre.Role.SYNDIC,
        )

        request = make_request(
            factory,
            user,
            method="post",
            copro_id=copro_a.id,
        )

        obj = DummyObj()

        permission = CoproWriteReadOnly()

        assert permission.has_object_permission(
            request,
            None,
            obj,
        ) is True

    def test_write_invalid_object_copro_id_is_denied(
        self,
        factory,
        user,
        coproprietes,
    ):
        copro_a, _ = coproprietes

        add_membership(
            user,
            copro_a,
            CoproMembre.Role.SYNDIC,
        )

        request = make_request(
            factory,
            user,
            method="post",
            copro_id=copro_a.id,
        )

        obj = DummyObj()
        obj.copropriete_id = "invalid"

        permission = CoproWriteReadOnly()

        assert permission.has_object_permission(
            request,
            None,
            obj,
        ) is False

    def test_superuser_can_access_write_permission_without_membership(
        self,
        factory,
        user,
    ):
        user.is_superuser = True
        user.save(update_fields=["is_superuser"])

        request = make_request(
            factory,
            user,
            method="post",
        )

        permission = CoproWriteReadOnly()

        assert permission.has_permission(
            request,
            None,
        ) is True

    def test_staff_can_access_write_permission_without_membership(
        self,
        factory,
        user,
    ):
        user.is_staff = True
        user.save(update_fields=["is_staff"])

        request = make_request(
            factory,
            user,
            method="post",
        )

        permission = CoproWriteReadOnly()

        assert permission.has_permission(
            request,
            None,
        ) is True

class DummyObj:
    pass


class TestPermissionV3:

    def test_base_permission_membership_qs_without_user(
        self,
        factory,
    ):
        request = make_request(
            factory,
            user=None,
        )

        permission = IsCoproMember()

        request.user = None

        qs = permission._get_membership_qs(request)

        assert not qs.exists()

    def test_base_admin_override_without_user(
        self,
        factory,
    ):
        request = make_request(
            factory,
            user=None,
        )

        permission = IsCoproMember()

        request.user = None

        assert permission._is_admin_override(request) is False

    def test_base_object_permission_denied_when_base_permission_denied(
        self,
        factory,
        user,
    ):
        request = make_request(
            factory,
            user,
            copro_id=None,
        )

        permission = IsCoproMember()

        obj = DummyObj()
        obj.copropriete_id = 1

        assert permission.has_object_permission(
            request,
            None,
            obj,
        ) is False

    def test_base_object_permission_denied_without_copro_context(
        self,
        factory,
        user,
    ):
        request = make_request(
            factory,
            user,
        )

        permission = IsCoproMember()

        assert permission.has_object_permission(
            request,
            None,
            DummyObj(),
        ) is False

    def test_write_permission_can_use_header_copro_id(
        self,
        factory,
        user,
        coproprietes,
    ):
        copro_a, _ = coproprietes

        add_membership(
            user,
            copro_a,
            CoproMembre.Role.SYNDIC,
        )

        request = make_request(
            factory,
            user,
            method="post",
            header_copro_id=copro_a.id,
        )

        permission = CoproWriteReadOnly()

        assert permission.has_permission(
            request,
            None,
        ) is True

    def test_write_permission_invalid_header_is_denied(
        self,
        factory,
        user,
    ):
        request = make_request(
            factory,
            user,
            method="post",
            header_copro_id="abc",
        )

        permission = CoproWriteReadOnly()

        assert permission.has_permission(
            request,
            None,
        ) is False

    def test_write_permission_without_user(
        self,
        factory,
    ):
        request = make_request(
            factory,
            user=None,
            method="post",
        )

        permission = CoproWriteReadOnly()

        request.user = None

        assert permission.has_permission(
            request,
            None,
        ) is False

    def test_write_object_permission_denied_when_base_permission_denied(
        self,
        factory,
        user,
    ):
        request = make_request(
            factory,
            user,
            method="post",
        )

        permission = CoproWriteReadOnly()

        assert permission.has_object_permission(
            request,
            None,
            DummyObj(),
        ) is False

    def test_write_object_permission_without_copro_context(
        self,
        factory,
        user,
        coproprietes,
    ):
        copro_a, _ = coproprietes

        add_membership(
            user,
            copro_a,
            CoproMembre.Role.SYNDIC,
        )

        request = make_request(
            factory,
            user,
            method="post",
        )

        permission = CoproWriteReadOnly()

        assert permission.has_object_permission(
            request,
            None,
            DummyObj(),
        ) is False

    def test_object_permission_via_releve_import(
        self,
        factory,
        user,
        coproprietes,
    ):
        copro_a, _ = coproprietes

        add_membership(
            user,
            copro_a,
            CoproMembre.Role.SYNDIC,
        )

        request = make_request(
            factory,
            user,
            method="get",
            copro_id=copro_a.id,
        )

        releve_import = DummyObj()
        releve_import.copropriete_id = copro_a.id

        obj = DummyObj()
        obj.releve_import = releve_import

        assert CoproWriteReadOnly().has_object_permission(
            request,
            None,
            obj,
        ) is True

    def test_object_permission_via_releve_import_other_copro(
        self,
        factory,
        user,
        coproprietes,
    ):
        copro_a, copro_b = coproprietes

        add_membership(
            user,
            copro_a,
            CoproMembre.Role.SYNDIC,
        )

        request = make_request(
            factory,
            user,
            method="get",
            copro_id=copro_a.id,
        )

        releve_import = DummyObj()
        releve_import.copropriete_id = copro_b.id

        obj = DummyObj()
        obj.releve_import = releve_import

        assert CoproWriteReadOnly().has_object_permission(
            request,
            None,
            obj,
        ) is False

    def test_object_permission_via_ligne(
        self,
        factory,
        user,
        coproprietes,
    ):
        copro_a, _ = coproprietes

        add_membership(
            user,
            copro_a,
            CoproMembre.Role.SYNDIC,
        )

        request = make_request(
            factory,
            user,
            method="get",
            copro_id=copro_a.id,
        )

        ligne = DummyObj()
        ligne.copropriete_id = copro_a.id

        obj = DummyObj()
        obj.ligne = ligne

        assert CoproWriteReadOnly().has_object_permission(
            request,
            None,
            obj,
        ) is True

    def test_object_permission_via_ligne_other_copro(
        self,
        factory,
        user,
        coproprietes,
    ):
        copro_a, copro_b = coproprietes

        add_membership(
            user,
            copro_a,
            CoproMembre.Role.SYNDIC,
        )

        request = make_request(
            factory,
            user,
            method="get",
            copro_id=copro_a.id,
        )

        ligne = DummyObj()
        ligne.copropriete_id = copro_b.id

        obj = DummyObj()
        obj.ligne = ligne

        assert CoproWriteReadOnly().has_object_permission(
            request,
            None,
            obj,
        ) is False

    def test_object_permission_via_ligne_and_appel(
        self,
        factory,
        user,
        coproprietes,
    ):
        copro_a, _ = coproprietes

        add_membership(
            user,
            copro_a,
            CoproMembre.Role.SYNDIC,
        )

        request = make_request(
            factory,
            user,
            method="get",
            copro_id=copro_a.id,
        )

        appel = DummyObj()
        appel.copropriete_id = copro_a.id

        ligne = DummyObj()
        ligne.copropriete_id = None
        ligne.appel = appel

        obj = DummyObj()
        obj.ligne = ligne

        assert CoproWriteReadOnly().has_object_permission(
            request,
            None,
            obj,
        ) is True

    def test_object_permission_via_ligne_and_appel_other_copro(
        self,
        factory,
        user,
        coproprietes,
    ):
        copro_a, copro_b = coproprietes

        add_membership(
            user,
            copro_a,
            CoproMembre.Role.SYNDIC,
        )

        request = make_request(
            factory,
            user,
            method="get",
            copro_id=copro_a.id,
        )

        appel = DummyObj()
        appel.copropriete_id = copro_b.id

        ligne = DummyObj()
        ligne.copropriete_id = None
        ligne.appel = appel

        obj = DummyObj()
        obj.ligne = ligne

        assert CoproWriteReadOnly().has_object_permission(
            request,
            None,
            obj,
        ) is False

    def test_object_permission_via_dossier(
        self,
        factory,
        user,
        coproprietes,
    ):
        copro_a, _ = coproprietes

        add_membership(
            user,
            copro_a,
            CoproMembre.Role.SYNDIC,
        )

        request = make_request(
            factory,
            user,
            method="get",
            copro_id=copro_a.id,
        )

        dossier = DummyObj()
        dossier.copropriete_id = copro_a.id

        obj = DummyObj()
        obj.dossier = dossier

        assert CoproWriteReadOnly().has_object_permission(
            request,
            None,
            obj,
        ) is True

    def test_object_permission_via_dossier_other_copro(
        self,
        factory,
        user,
        coproprietes,
    ):
        copro_a, copro_b = coproprietes

        add_membership(
            user,
            copro_a,
            CoproMembre.Role.SYNDIC,
        )

        request = make_request(
            factory,
            user,
            method="get",
            copro_id=copro_a.id,
        )

        dossier = DummyObj()
        dossier.copropriete_id = copro_b.id

        obj = DummyObj()
        obj.dossier = dossier

        assert CoproWriteReadOnly().has_object_permission(
            request,
            None,
            obj,
        ) is False

    def test_object_permission_invalid_copro_id(
        self,
        factory,
        user,
        coproprietes,
    ):
        copro_a, _ = coproprietes

        add_membership(
            user,
            copro_a,
            CoproMembre.Role.SYNDIC,
        )

        request = make_request(
            factory,
            user,
            method="get",
            copro_id=copro_a.id,
        )

        obj = DummyObj()
        obj.copropriete_id = "not-a-number"

        assert CoproWriteReadOnly().has_object_permission(
            request,
            None,
            obj,
        ) is False



# ============================================================
# Script V4 — couverture des 4 dernières branches
# ============================================================

class TestCoproPermissionsV4:

    def test_base_object_permission_without_copro_id_is_denied(
        self,
        factory,
        user,
        coproprietes,
    ):
        copro_a, _ = coproprietes

        add_membership(
            user,
            copro_a,
            CoproMembre.Role.COPROPRIETAIRE,
        )

        request = make_request(
            factory,
            user,
            copro_id=None,
        )

        permission = IsCoproMember()

        obj = type(
            "ObjectWithoutCopro",
            (),
            {},
        )()

        assert permission.has_object_permission(
            request,
            None,
            obj,
        ) is False

    def test_write_read_only_admin_override_helper_denies_anonymous_user(
        self,
        factory,
    ):
        request = make_request(
            factory,
            user=None,
        )

        request.user = type(
            "AnonymousUser",
            (),
            {
                "is_authenticated": False,
                "is_superuser": False,
                "is_staff": False,
            },
        )()

        permission = CoproWriteReadOnly()

        assert permission._is_admin_override(request) is False

    def test_write_read_only_membership_qs_without_authenticated_user_is_empty(
        self,
        factory,
    ):
        request = make_request(
            factory,
            user=None,
        )

        request.user = type(
            "AnonymousUser",
            (),
            {
                "is_authenticated": False,
            },
        )()

        permission = CoproWriteReadOnly()

        qs = permission._get_membership_qs(request)

        assert qs.exists() is False

    def test_write_read_only_object_permission_without_copro_id_is_denied(
        self,
        factory,
        user,
        coproprietes,
    ):
        copro_a, _ = coproprietes

        add_membership(
            user,
            copro_a,
            CoproMembre.Role.COPROPRIETAIRE,
        )

        request = make_request(
            factory,
            user,
            copro_id=None,
        )

        permission = CoproWriteReadOnly()

        obj = type(
            "ObjectWithoutCopro",
            (),
            {},
        )()

        assert permission.has_object_permission(
            request,
            None,
            obj,
        ) is False


# ============================================================
# V5 — Couverture finale des branches sans copropriété
# ============================================================

class TestPermissionCoverageV5:

    def test_base_object_permission_denied_without_copro_id(
        self,
        factory,
        user,
        coproprietes,
    ):
        """
        Couvre la branche de BaseCoproPermission.has_object_permission()
        lorsque l'utilisateur est authentifié mais qu'aucun copro_id
        n'est présent dans la requête.
        """
        copro_a, _ = coproprietes

        add_membership(
            user,
            copro_a,
            CoproMembre.Role.COPROPRIETAIRE,
        )

        request = make_request(
            factory,
            user,
            copro_id=None,
            header_copro_id=None,
        )

        permission = IsCoproMember()

        obj = type(
            "ObjectWithoutCopro",
            (),
            {"copropriete_id": copro_a.id},
        )()

        assert permission.has_object_permission(
            request,
            None,
            obj,
        ) is False

    def test_write_read_only_object_permission_denied_without_copro_id(
        self,
        factory,
        user,
        coproprietes,
    ):
        """
        Couvre la branche de CoproWriteReadOnly.has_object_permission()
        lorsque l'utilisateur est authentifié mais qu'aucun copro_id
        n'est présent dans la requête.
        """
        copro_a, _ = coproprietes

        add_membership(
            user,
            copro_a,
            CoproMembre.Role.COPROPRIETAIRE,
        )

        request = make_request(
            factory,
            user,
            method="get",
            copro_id=None,
            header_copro_id=None,
        )

        permission = CoproWriteReadOnly()

        obj = type(
            "ObjectWithoutCopro",
            (),
            {"copropriete_id": copro_a.id},
        )()

        assert permission.has_object_permission(
            request,
            None,
            obj,
        ) is False


class TestFinalObjectPermissionBranches:

    def test_base_object_permission_without_copro_id_is_denied(
        self,
        factory,
        user,
        coproprietes,
    ):
        copro_a, _ = coproprietes

        add_membership(
            user,
            copro_a,
            CoproMembre.Role.COPROPRIETAIRE,
        )

        request = make_request(
            factory,
            user,
            copro_id=copro_a.id,
        )

        permission = IsCoproMember()

        # On force le chemin de has_object_permission où
        # le copro_id devient indisponible après has_permission().
        original_get_copro_id = permission._get_copro_id

        calls = {"count": 0}

        def get_copro_id_after_permission(request):
            calls["count"] += 1
            if calls["count"] >= 2:
                return None
            return original_get_copro_id(request)

        permission._get_copro_id = get_copro_id_after_permission

        assert permission.has_object_permission(
            request,
            None,
            object(),
        ) is False

    def test_write_read_only_object_permission_without_copro_id_is_denied(
        self,
        factory,
        user,
        coproprietes,
    ):
        copro_a, _ = coproprietes

        add_membership(
            user,
            copro_a,
            CoproMembre.Role.COPROPRIETAIRE,
        )

        request = make_request(
            factory,
            user,
            method="get",
            copro_id=copro_a.id,
        )

        permission = CoproWriteReadOnly()

        original_get_copro_id = permission._get_copro_id

        calls = {"count": 0}

        def get_copro_id_after_permission(request):
            calls["count"] += 1
            if calls["count"] >= 2:
                return None
            return original_get_copro_id(request)

        permission._get_copro_id = get_copro_id_after_permission

        assert permission.has_object_permission(
            request,
            None,
            object(),
        ) is False

# ============================================================
# V6 — couverture finale des branches sans copro_id
# ============================================================

class TestFinalMissingCoproObjectPermission:

    def test_base_permission_object_without_copro_id(self, factory, user, coproprietes):
        copro_a, _ = coproprietes

        add_membership(
            user,
            copro_a,
            CoproMembre.Role.COPROPRIETAIRE,
        )

        request = make_request(
            factory,
            user,
            copro_id=copro_a.id,
        )

        permission = BaseCoproPermission()

        class TestObject:
            copropriete_id = None

        # On force l'absence de copropriété dans la requête
        # après validation de l'utilisateur.
        request.copropriete_id = None

        assert permission.has_object_permission(
            request,
            None,
            TestObject(),
        ) is False


    def test_write_read_only_object_without_copro_id(
        self,
        factory,
        user,
        coproprietes,
    ):
        copro_a, _ = coproprietes

        add_membership(
            user,
            copro_a,
            CoproMembre.Role.COPROPRIETAIRE,
        )

        request = make_request(
            factory,
            user,
            method="get",
            copro_id=copro_a.id,
        )

        permission = CoproWriteReadOnly()

        class TestObject:
            copropriete_id = None

        # On force l'absence de copropriété dans la requête.
        request.copropriete_id = None

        assert permission.has_object_permission(
            request,
            None,
            TestObject(),
        ) is False
