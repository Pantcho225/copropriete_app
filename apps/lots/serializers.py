# apps/lots/serializers.py
from __future__ import annotations

from decimal import Decimal

from rest_framework import serializers

from apps.core.models import Copropriete
from .models import Lot, LotTantieme, TantiemeCategorie


class CoproprieteLiteSerializer(serializers.ModelSerializer):
    """
    Représentation minimale d'une copropriété pour les réponses du module Lots.
    """

    display_name = serializers.CharField(read_only=True)

    class Meta:
        model = Copropriete
        fields = (
            "id",
            "nom",
            "slug",
            "ville",
            "pays",
            "statut",
            "is_active",
            "display_name",
        )
        read_only_fields = fields


class LotListSerializer(serializers.ModelSerializer):
    """
    Version compacte pour les listes React.
    """

    copropriete_nom = serializers.CharField(source="copropriete.nom", read_only=True)
    label = serializers.CharField(read_only=True)

    total_tantiemes_value = serializers.DecimalField(
        max_digits=10,
        decimal_places=4,
        read_only=True,
    )

    proprietaire_principal_display = serializers.CharField(read_only=True)

    class Meta:
        model = Lot
        fields = (
            "id",
            "copropriete",
            "copropriete_nom",
            "reference",
            "numero",
            "label",
            "type_lot",
            "statut",
            "batiment",
            "escalier",
            "etage",
            "porte",
            "surface",
            "actif",
            "total_tantiemes_value",
            "proprietaire_principal_display",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "copropriete_nom",
            "label",
            "total_tantiemes_value",
            "proprietaire_principal_display",
            "created_at",
            "updated_at",
        )


class LotSerializer(serializers.ModelSerializer):
    """
    Serializer complet d'un lot.

    Utilisé par :
    - création lot ;
    - modification lot ;
    - fiche détail lot ;
    - référentiel copropriété côté Admin React.
    """

    copropriete_detail = CoproprieteLiteSerializer(
        source="copropriete",
        read_only=True,
    )

    label = serializers.CharField(read_only=True)

    total_tantiemes_value = serializers.DecimalField(
        max_digits=10,
        decimal_places=4,
        read_only=True,
    )

    tantiemes_par_categorie = serializers.SerializerMethodField()
    proprietaire_principal_display = serializers.CharField(read_only=True)
    proprietaire_principal = serializers.SerializerMethodField()

    class Meta:
        model = Lot
        fields = (
            "id",
            "copropriete",
            "copropriete_detail",
            "reference",
            "numero",
            "label",
            "type_lot",
            "statut",
            "batiment",
            "escalier",
            "etage",
            "porte",
            "description",
            "surface",
            "actif",
            "total_tantiemes_value",
            "tantiemes_par_categorie",
            "proprietaire_principal",
            "proprietaire_principal_display",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "copropriete_detail",
            "label",
            "total_tantiemes_value",
            "tantiemes_par_categorie",
            "proprietaire_principal",
            "proprietaire_principal_display",
            "created_at",
            "updated_at",
        )

    def get_tantiemes_par_categorie(self, obj):
        return {
            code: str(value)
            for code, value in obj.tantiemes_par_categorie().items()
        }

    def get_proprietaire_principal(self, obj):
        affectation = obj.proprietaire_principal

        if not affectation:
            return None

        coproprietaire = affectation.coproprietaire

        return {
            "affectation_id": affectation.id,
            "coproprietaire_id": coproprietaire.id,
            "display_name": coproprietaire.display_name,
            "email": coproprietaire.email,
            "telephone": coproprietaire.telephone,
            "date_debut": affectation.date_debut,
            "quote_part": affectation.quote_part,
        }

    def validate_reference(self, value):
        reference = (value or "").strip().upper()

        if not reference:
            raise serializers.ValidationError(
                "La référence du lot est obligatoire."
            )

        return reference

    def validate_numero(self, value):
        return (value or "").strip().upper()

    def validate_surface(self, value):
        if value is not None and value < 0:
            raise serializers.ValidationError(
                "La surface doit être supérieure ou égale à 0."
            )

        return value

    def validate(self, attrs):
        instance = self.instance

        copropriete = attrs.get(
            "copropriete",
            getattr(instance, "copropriete", None),
        )

        reference = attrs.get(
            "reference",
            getattr(instance, "reference", ""),
        )

        statut = attrs.get(
            "statut",
            getattr(instance, "statut", Lot.Statut.OCCUPE),
        )

        actif = attrs.get(
            "actif",
            getattr(instance, "actif", True),
        )

        if not copropriete:
            raise serializers.ValidationError(
                {"copropriete": "La copropriété est obligatoire."}
            )

        if not reference:
            raise serializers.ValidationError(
                {"reference": "La référence du lot est obligatoire."}
            )

        qs = Lot.objects.filter(
            copropriete=copropriete,
            reference__iexact=reference,
        )

        if instance:
            qs = qs.exclude(pk=instance.pk)

        if qs.exists():
            raise serializers.ValidationError(
                {
                    "reference": (
                        "Un lot avec cette référence existe déjà dans cette copropriété."
                    )
                }
            )

        if statut == Lot.Statut.INACTIF:
            attrs["actif"] = False

        if actif is False:
            attrs["statut"] = Lot.Statut.INACTIF

        return attrs


class TantiemeCategorieListSerializer(serializers.ModelSerializer):
    """
    Version compacte pour les listes de catégories de tantièmes.
    """

    copropriete_nom = serializers.CharField(source="copropriete.nom", read_only=True)
    total_lots_count = serializers.SerializerMethodField()
    total_valeur = serializers.SerializerMethodField()

    class Meta:
        model = TantiemeCategorie
        fields = (
            "id",
            "copropriete",
            "copropriete_nom",
            "code",
            "libelle",
            "description",
            "actif",
            "total_lots_count",
            "total_valeur",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "copropriete_nom",
            "total_lots_count",
            "total_valeur",
            "created_at",
            "updated_at",
        )

    def get_total_lots_count(self, obj):
        return obj.lots_tantiemes.count()

    def get_total_valeur(self, obj):
        total = sum(
            item.valeur or Decimal("0.0000")
            for item in obj.lots_tantiemes.all()
        )
        return str(total)


class TantiemeCategorieSerializer(serializers.ModelSerializer):
    """
    Serializer complet d'une catégorie de tantièmes.
    """

    copropriete_detail = CoproprieteLiteSerializer(
        source="copropriete",
        read_only=True,
    )

    total_lots_count = serializers.SerializerMethodField()
    total_valeur = serializers.SerializerMethodField()

    class Meta:
        model = TantiemeCategorie
        fields = (
            "id",
            "copropriete",
            "copropriete_detail",
            "code",
            "libelle",
            "description",
            "actif",
            "total_lots_count",
            "total_valeur",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "copropriete_detail",
            "total_lots_count",
            "total_valeur",
            "created_at",
            "updated_at",
        )

    def get_total_lots_count(self, obj):
        return obj.lots_tantiemes.count()

    def get_total_valeur(self, obj):
        total = sum(
            item.valeur or Decimal("0.0000")
            for item in obj.lots_tantiemes.all()
        )
        return str(total)

    def validate_code(self, value):
        code = (value or "").strip().upper()

        if not code:
            raise serializers.ValidationError(
                "Le code de la catégorie est obligatoire."
            )

        return code

    def validate_libelle(self, value):
        libelle = (value or "").strip()

        if not libelle:
            raise serializers.ValidationError(
                "Le libellé de la catégorie est obligatoire."
            )

        return libelle

    def validate(self, attrs):
        instance = self.instance

        copropriete = attrs.get(
            "copropriete",
            getattr(instance, "copropriete", None),
        )

        code = attrs.get(
            "code",
            getattr(instance, "code", ""),
        )

        if not copropriete:
            raise serializers.ValidationError(
                {"copropriete": "La copropriété est obligatoire."}
            )

        if not code:
            raise serializers.ValidationError(
                {"code": "Le code de la catégorie est obligatoire."}
            )

        qs = TantiemeCategorie.objects.filter(
            copropriete=copropriete,
            code__iexact=code,
        )

        if instance:
            qs = qs.exclude(pk=instance.pk)

        if qs.exists():
            raise serializers.ValidationError(
                {
                    "code": (
                        "Une catégorie de tantième avec ce code existe déjà "
                        "dans cette copropriété."
                    )
                }
            )

        return attrs


class LotTantiemeListSerializer(serializers.ModelSerializer):
    """
    Version compacte pour les listes React des tantièmes.
    """

    copropriete = serializers.SerializerMethodField()

    lot_reference = serializers.CharField(source="lot.reference", read_only=True)
    lot_label = serializers.CharField(source="lot.label", read_only=True)

    categorie_code = serializers.CharField(source="categorie.code", read_only=True)
    categorie_libelle = serializers.CharField(
        source="categorie.libelle",
        read_only=True,
    )

    class Meta:
        model = LotTantieme
        fields = (
            "id",
            "copropriete",
            "lot",
            "lot_reference",
            "lot_label",
            "categorie",
            "categorie_code",
            "categorie_libelle",
            "valeur",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "copropriete",
            "lot_reference",
            "lot_label",
            "categorie_code",
            "categorie_libelle",
            "created_at",
            "updated_at",
        )

    def get_copropriete(self, obj):
        if not obj.lot_id:
            return None

        return obj.lot.copropriete_id


class LotTantiemeSerializer(serializers.ModelSerializer):
    """
    Serializer complet d'une valeur de tantième.
    """

    copropriete = serializers.SerializerMethodField()

    lot_detail = LotListSerializer(source="lot", read_only=True)
    categorie_detail = TantiemeCategorieListSerializer(
        source="categorie",
        read_only=True,
    )

    lot_reference = serializers.CharField(source="lot.reference", read_only=True)
    lot_label = serializers.CharField(source="lot.label", read_only=True)

    categorie_code = serializers.CharField(source="categorie.code", read_only=True)
    categorie_libelle = serializers.CharField(
        source="categorie.libelle",
        read_only=True,
    )

    class Meta:
        model = LotTantieme
        fields = (
            "id",
            "copropriete",
            "lot",
            "lot_detail",
            "lot_reference",
            "lot_label",
            "categorie",
            "categorie_detail",
            "categorie_code",
            "categorie_libelle",
            "valeur",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "copropriete",
            "lot_detail",
            "lot_reference",
            "lot_label",
            "categorie_detail",
            "categorie_code",
            "categorie_libelle",
            "created_at",
            "updated_at",
        )

    def get_copropriete(self, obj):
        if not obj.lot_id:
            return None

        return obj.lot.copropriete_id

    def validate_valeur(self, value):
        if value is None:
            raise serializers.ValidationError(
                "La valeur du tantième est obligatoire."
            )

        value = Decimal(str(value))

        if value < 0:
            raise serializers.ValidationError(
                "La valeur du tantième doit être supérieure ou égale à 0."
            )

        return value

    def validate(self, attrs):
        instance = self.instance

        lot = attrs.get(
            "lot",
            getattr(instance, "lot", None),
        )

        categorie = attrs.get(
            "categorie",
            getattr(instance, "categorie", None),
        )

        if not lot:
            raise serializers.ValidationError(
                {"lot": "Le lot est obligatoire."}
            )

        if not categorie:
            raise serializers.ValidationError(
                {"categorie": "La catégorie est obligatoire."}
            )

        if lot.copropriete_id != categorie.copropriete_id:
            raise serializers.ValidationError(
                {
                    "categorie": (
                        "La catégorie de tantième doit appartenir à la même "
                        "copropriété que le lot."
                    )
                }
            )

        qs = LotTantieme.objects.filter(
            lot=lot,
            categorie=categorie,
        )

        if instance:
            qs = qs.exclude(pk=instance.pk)

        if qs.exists():
            raise serializers.ValidationError(
                {
                    "categorie": (
                        "Une valeur de tantième existe déjà pour ce lot "
                        "et cette catégorie."
                    )
                }
            )

        return attrs