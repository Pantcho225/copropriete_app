# apps/owners/serializers.py
from __future__ import annotations

from decimal import Decimal

from rest_framework import serializers

from apps.core.models import Copropriete
from .models import Coproprietaire, LotOccupant, ProprietaireLot


class CoproprieteLiteSerializer(serializers.ModelSerializer):
    """
    Représentation minimale d'une copropriété pour éviter de surcharger
    les réponses API owners.
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


class LotLiteSerializer(serializers.Serializer):
    """
    Serializer léger et défensif pour un lot.

    On évite volontairement d'importer directement LotSerializer ici afin de
    limiter les risques d'import circulaire entre owners et lots.
    """

    id = serializers.IntegerField(read_only=True)
    reference = serializers.CharField(read_only=True)
    numero = serializers.CharField(read_only=True)
    batiment = serializers.CharField(read_only=True)
    escalier = serializers.CharField(read_only=True)
    etage = serializers.CharField(read_only=True)
    porte = serializers.CharField(read_only=True)
    type_lot = serializers.CharField(read_only=True)
    statut = serializers.CharField(read_only=True)
    nombre_pieces = serializers.IntegerField(read_only=True)
    surface = serializers.DecimalField(
        max_digits=10,
        decimal_places=2,
        read_only=True,
        allow_null=True,
    )
    actif = serializers.BooleanField(read_only=True)


class CoproprietaireListSerializer(serializers.ModelSerializer):
    """
    Version compacte pour les listes React.
    """

    display_name = serializers.CharField(read_only=True)
    contact_label = serializers.CharField(read_only=True)
    copropriete_nom = serializers.CharField(source="copropriete.nom", read_only=True)

    lots_actifs_count = serializers.SerializerMethodField()
    occupants_declares_count = serializers.SerializerMethodField()

    user_account_id = serializers.SerializerMethodField()
    user_account_email = serializers.SerializerMethodField()
    user_account_username = serializers.SerializerMethodField()
    has_user_access = serializers.SerializerMethodField()

    class Meta:
        model = Coproprietaire
        fields = (
            "id",
            "copropriete",
            "copropriete_nom",
            "type_personne",
            "civilite",
            "nom",
            "prenom",
            "raison_sociale",
            "display_name",
            "email",
            "telephone",
            "contact_label",
            "ville",
            "pays",
            "actif",
            "lots_actifs_count",
            "occupants_declares_count",
            "user_account_id",
            "user_account_email",
            "user_account_username",
            "has_user_access",
            "created_at",
            "updated_at",
            "date_creation",
        )
        read_only_fields = (
            "id",
            "copropriete_nom",
            "display_name",
            "contact_label",
            "lots_actifs_count",
            "occupants_declares_count",
            "user_account_id",
            "user_account_email",
            "user_account_username",
            "has_user_access",
            "created_at",
            "updated_at",
            "date_creation",
        )

    def get_lots_actifs_count(self, obj):
        return obj.lots_possedes.filter(date_fin__isnull=True).count()

    def get_occupants_declares_count(self, obj):
        return obj.occupants_declares.filter(actif=True, date_sortie__isnull=True).count()

    def get_user_account_id(self, obj):
        return obj.user_account_id

    def get_user_account_email(self, obj):
        user = getattr(obj, "user_account", None)
        return getattr(user, "email", None) if user else None

    def get_user_account_username(self, obj):
        user = getattr(obj, "user_account", None)
        return getattr(user, "username", None) if user else None

    def get_has_user_access(self, obj):
        return bool(obj.user_account_id)


class CoproprietaireSerializer(serializers.ModelSerializer):
    """
    Serializer complet d'un copropriétaire.

    Utilisé par :
    - création copropriétaire ;
    - modification copropriétaire ;
    - fiche détail copropriétaire ;
    - référentiel copropriété côté Admin React ;
    - affichage de l'état d'accès utilisateur copropriétaire.
    """

    copropriete_detail = CoproprieteLiteSerializer(
        source="copropriete",
        read_only=True,
    )

    display_name = serializers.CharField(read_only=True)
    contact_label = serializers.CharField(read_only=True)

    lots_actifs_count = serializers.SerializerMethodField()
    lots_historiques_count = serializers.SerializerMethodField()
    occupants_declares_count = serializers.SerializerMethodField()

    user_account_id = serializers.SerializerMethodField()
    user_account_email = serializers.SerializerMethodField()
    user_account_username = serializers.SerializerMethodField()
    has_user_access = serializers.SerializerMethodField()

    class Meta:
        model = Coproprietaire
        fields = (
            "id",
            "copropriete",
            "copropriete_detail",
            "type_personne",
            "civilite",
            "nom",
            "prenom",
            "raison_sociale",
            "email",
            "telephone",
            "adresse",
            "ville",
            "pays",
            "notes",
            "actif",
            "display_name",
            "contact_label",
            "lots_actifs_count",
            "lots_historiques_count",
            "occupants_declares_count",
            "user_account_id",
            "user_account_email",
            "user_account_username",
            "has_user_access",
            "created_at",
            "updated_at",
            "date_creation",
        )
        read_only_fields = (
            "id",
            "copropriete_detail",
            "display_name",
            "contact_label",
            "lots_actifs_count",
            "lots_historiques_count",
            "occupants_declares_count",
            "user_account_id",
            "user_account_email",
            "user_account_username",
            "has_user_access",
            "created_at",
            "updated_at",
            "date_creation",
        )

    def get_lots_actifs_count(self, obj):
        return obj.lots_possedes.filter(date_fin__isnull=True).count()

    def get_lots_historiques_count(self, obj):
        return obj.lots_possedes.count()

    def get_occupants_declares_count(self, obj):
        return obj.occupants_declares.filter(actif=True, date_sortie__isnull=True).count()

    def get_user_account_id(self, obj):
        return obj.user_account_id

    def get_user_account_email(self, obj):
        user = getattr(obj, "user_account", None)
        return getattr(user, "email", None) if user else None

    def get_user_account_username(self, obj):
        user = getattr(obj, "user_account", None)
        return getattr(user, "username", None) if user else None

    def get_has_user_access(self, obj):
        return bool(obj.user_account_id)

    def validate_nom(self, value):
        value = (value or "").strip()

        if not value:
            raise serializers.ValidationError("Le nom est obligatoire.")

        return value

    def validate_prenom(self, value):
        return (value or "").strip()

    def validate_raison_sociale(self, value):
        return (value or "").strip()

    def validate_email(self, value):
        return (value or "").strip().lower()

    def validate_telephone(self, value):
        return (value or "").strip()

    def validate(self, attrs):
        instance = self.instance

        copropriete = attrs.get(
            "copropriete",
            getattr(instance, "copropriete", None),
        )

        type_personne = attrs.get(
            "type_personne",
            getattr(instance, "type_personne", Coproprietaire.TypePersonne.PHYSIQUE),
        )

        nom = attrs.get(
            "nom",
            getattr(instance, "nom", ""),
        )

        prenom = attrs.get(
            "prenom",
            getattr(instance, "prenom", ""),
        )

        raison_sociale = attrs.get(
            "raison_sociale",
            getattr(instance, "raison_sociale", ""),
        )

        if not copropriete:
            raise serializers.ValidationError(
                {"copropriete": "La copropriété est obligatoire."}
            )

        if type_personne == Coproprietaire.TypePersonne.MORALE:
            if not raison_sociale and not nom:
                raise serializers.ValidationError(
                    {
                        "raison_sociale": (
                            "La raison sociale ou le nom est obligatoire pour "
                            "une personne morale."
                        )
                    }
                )

        if not nom:
            raise serializers.ValidationError(
                {"nom": "Le nom est obligatoire."}
            )

        qs = Coproprietaire.objects.filter(
            copropriete=copropriete,
            nom__iexact=nom,
            prenom__iexact=prenom or "",
        )

        if instance:
            qs = qs.exclude(pk=instance.pk)

        if qs.exists():
            raise serializers.ValidationError(
                {
                    "nom": (
                        "Un copropriétaire avec ce nom et ce prénom existe déjà "
                        "dans cette copropriété."
                    )
                }
            )

        return attrs


class ProprietaireLotListSerializer(serializers.ModelSerializer):
    """
    Version compacte pour les listes d'affectation lots/propriétaires.
    """

    copropriete_nom = serializers.CharField(source="copropriete.nom", read_only=True)
    coproprietaire_display = serializers.CharField(
        source="coproprietaire.display_name",
        read_only=True,
    )

    lot_reference = serializers.SerializerMethodField()
    lot_label = serializers.SerializerMethodField()

    is_active = serializers.BooleanField(read_only=True)
    periode_label = serializers.CharField(read_only=True)

    class Meta:
        model = ProprietaireLot
        fields = (
            "id",
            "copropriete",
            "copropriete_nom",
            "lot",
            "lot_reference",
            "lot_label",
            "coproprietaire",
            "coproprietaire_display",
            "date_debut",
            "date_fin",
            "principal",
            "quote_part",
            "is_active",
            "periode_label",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "copropriete_nom",
            "lot_reference",
            "lot_label",
            "coproprietaire_display",
            "is_active",
            "periode_label",
            "created_at",
            "updated_at",
        )

    def get_lot_reference(self, obj):
        return (
            getattr(obj.lot, "reference", None)
            or getattr(obj.lot, "numero", None)
            or str(obj.lot_id)
        )

    def get_lot_label(self, obj):
        lot = obj.lot

        reference = (
            getattr(lot, "reference", None)
            or getattr(lot, "numero", None)
            or str(obj.lot_id)
        )

        parts = [reference]

        batiment = getattr(lot, "batiment", None)
        etage = getattr(lot, "etage", None)
        porte = getattr(lot, "porte", None)

        if batiment:
            parts.append(f"Bât. {batiment}")

        if etage:
            parts.append(f"Étage {etage}")

        if porte:
            parts.append(f"Porte {porte}")

        return " · ".join(parts)


class ProprietaireLotSerializer(serializers.ModelSerializer):
    """
    Serializer complet pour l'historique de propriété d'un lot.

    Utilisé pour :
    - affecter un copropriétaire à un lot ;
    - gérer l'historique ;
    - gérer indivision / quote-part ;
    - désigner le propriétaire principal.
    """

    copropriete_detail = CoproprieteLiteSerializer(
        source="copropriete",
        read_only=True,
    )

    coproprietaire_detail = CoproprietaireListSerializer(
        source="coproprietaire",
        read_only=True,
    )

    lot_detail = serializers.SerializerMethodField()

    coproprietaire_display = serializers.CharField(
        source="coproprietaire.display_name",
        read_only=True,
    )

    lot_reference = serializers.SerializerMethodField()
    lot_label = serializers.SerializerMethodField()

    is_active = serializers.BooleanField(read_only=True)
    periode_label = serializers.CharField(read_only=True)

    class Meta:
        model = ProprietaireLot
        fields = (
            "id",
            "copropriete",
            "copropriete_detail",
            "lot",
            "lot_detail",
            "lot_reference",
            "lot_label",
            "coproprietaire",
            "coproprietaire_detail",
            "coproprietaire_display",
            "date_debut",
            "date_fin",
            "principal",
            "quote_part",
            "notes",
            "is_active",
            "periode_label",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "copropriete_detail",
            "lot_detail",
            "lot_reference",
            "lot_label",
            "coproprietaire_detail",
            "coproprietaire_display",
            "is_active",
            "periode_label",
            "created_at",
            "updated_at",
        )

    def get_lot_detail(self, obj):
        lot = obj.lot

        return {
            "id": lot.id,
            "reference": getattr(lot, "reference", None),
            "numero": getattr(lot, "numero", None),
            "batiment": getattr(lot, "batiment", None),
            "escalier": getattr(lot, "escalier", None),
            "etage": getattr(lot, "etage", None),
            "porte": getattr(lot, "porte", None),
            "nombre_pieces": getattr(lot, "nombre_pieces", None),
            "surface": getattr(lot, "surface", None),
            "type_lot": getattr(lot, "type_lot", None),
            "statut": getattr(lot, "statut", None),
            "actif": getattr(lot, "actif", None),
        }

    def get_lot_reference(self, obj):
        return (
            getattr(obj.lot, "reference", None)
            or getattr(obj.lot, "numero", None)
            or str(obj.lot_id)
        )

    def get_lot_label(self, obj):
        lot = obj.lot

        reference = (
            getattr(lot, "reference", None)
            or getattr(lot, "numero", None)
            or str(obj.lot_id)
        )

        parts = [reference]

        batiment = getattr(lot, "batiment", None)
        etage = getattr(lot, "etage", None)
        porte = getattr(lot, "porte", None)

        if batiment:
            parts.append(f"Bât. {batiment}")

        if etage:
            parts.append(f"Étage {etage}")

        if porte:
            parts.append(f"Porte {porte}")

        return " · ".join(parts)

    def validate_quote_part(self, value):
        if value is None:
            raise serializers.ValidationError("La quote-part est obligatoire.")

        if value <= Decimal("0.00"):
            raise serializers.ValidationError(
                "La quote-part doit être supérieure à 0."
            )

        if value > Decimal("100.00"):
            raise serializers.ValidationError(
                "La quote-part ne peut pas dépasser 100%."
            )

        return value

    def validate(self, attrs):
        instance = self.instance

        lot = attrs.get("lot", getattr(instance, "lot", None))
        coproprietaire = attrs.get(
            "coproprietaire",
            getattr(instance, "coproprietaire", None),
        )
        copropriete = attrs.get(
            "copropriete",
            getattr(instance, "copropriete", None),
        )

        date_debut = attrs.get(
            "date_debut",
            getattr(instance, "date_debut", None),
        )
        date_fin = attrs.get(
            "date_fin",
            getattr(instance, "date_fin", None),
        )

        principal = attrs.get(
            "principal",
            getattr(instance, "principal", True),
        )

        quote_part = attrs.get(
            "quote_part",
            getattr(instance, "quote_part", Decimal("100.00")),
        )

        if not copropriete and lot:
            copropriete = lot.copropriete
            attrs["copropriete"] = copropriete

        if not copropriete:
            raise serializers.ValidationError(
                {"copropriete": "La copropriété est obligatoire."}
            )

        if not lot:
            raise serializers.ValidationError(
                {"lot": "Le lot est obligatoire."}
            )

        if not coproprietaire:
            raise serializers.ValidationError(
                {"coproprietaire": "Le copropriétaire est obligatoire."}
            )

        if getattr(lot, "copropriete_id", None) != copropriete.id:
            raise serializers.ValidationError(
                {"lot": "Le lot doit appartenir à la même copropriété."}
            )

        if coproprietaire.copropriete_id != copropriete.id:
            raise serializers.ValidationError(
                {
                    "coproprietaire": (
                        "Le copropriétaire doit appartenir à la même copropriété."
                    )
                }
            )

        if not date_debut:
            raise serializers.ValidationError(
                {"date_debut": "La date de début est obligatoire."}
            )

        if date_fin and date_fin < date_debut:
            raise serializers.ValidationError(
                {
                    "date_fin": (
                        "La date de fin ne peut pas être antérieure à la date de début."
                    )
                }
            )

        if principal and not date_fin:
            qs = ProprietaireLot.objects.filter(
                lot=lot,
                principal=True,
                date_fin__isnull=True,
            )

            if instance:
                qs = qs.exclude(pk=instance.pk)

            if qs.exists():
                raise serializers.ValidationError(
                    {
                        "principal": (
                            "Un propriétaire principal actif existe déjà pour ce lot."
                        )
                    }
                )

        if not date_fin:
            active_qs = ProprietaireLot.objects.filter(
                lot=lot,
                date_fin__isnull=True,
            )

            if instance:
                active_qs = active_qs.exclude(pk=instance.pk)

            total_existing = sum(
                item.quote_part or Decimal("0.00")
                for item in active_qs
            )

            if total_existing + quote_part > Decimal("100.00"):
                raise serializers.ValidationError(
                    {
                        "quote_part": (
                            "La somme des quotes-parts actives du lot ne peut pas "
                            "dépasser 100%."
                        )
                    }
                )

        return attrs


class LotOccupantListSerializer(serializers.ModelSerializer):
    """
    Version compacte pour les listes d'occupants / habitants de lots.
    """

    copropriete_nom = serializers.CharField(source="copropriete.nom", read_only=True)

    lot_reference = serializers.SerializerMethodField()
    lot_label = serializers.SerializerMethodField()

    coproprietaire_display = serializers.SerializerMethodField()

    display_name = serializers.CharField(read_only=True)
    contact_label = serializers.CharField(read_only=True)
    statut_occupation_label = serializers.SerializerMethodField()
    is_active = serializers.BooleanField(read_only=True)
    periode_label = serializers.CharField(read_only=True)

    class Meta:
        model = LotOccupant
        fields = (
            "id",
            "copropriete",
            "copropriete_nom",
            "lot",
            "lot_reference",
            "lot_label",
            "coproprietaire",
            "coproprietaire_display",
            "nom",
            "prenom",
            "display_name",
            "telephone",
            "email",
            "contact_label",
            "statut_occupation",
            "statut_occupation_label",
            "occupant_principal",
            "nombre_occupants",
            "date_entree",
            "date_sortie",
            "contact_urgence_nom",
            "contact_urgence_telephone",
            "actif",
            "is_active",
            "periode_label",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "copropriete_nom",
            "lot_reference",
            "lot_label",
            "coproprietaire_display",
            "display_name",
            "contact_label",
            "statut_occupation_label",
            "is_active",
            "periode_label",
            "created_at",
            "updated_at",
        )

    def get_lot_reference(self, obj):
        return (
            getattr(obj.lot, "reference", None)
            or getattr(obj.lot, "numero", None)
            or str(obj.lot_id)
        )

    def get_lot_label(self, obj):
        lot = obj.lot

        reference = (
            getattr(lot, "reference", None)
            or getattr(lot, "numero", None)
            or str(obj.lot_id)
        )

        parts = [reference]

        batiment = getattr(lot, "batiment", None)
        etage = getattr(lot, "etage", None)
        porte = getattr(lot, "porte", None)

        if batiment:
            parts.append(f"Bât. {batiment}")

        if etage:
            parts.append(f"Étage {etage}")

        if porte:
            parts.append(f"Porte {porte}")

        return " · ".join(parts)

    def get_coproprietaire_display(self, obj):
        coproprietaire = getattr(obj, "coproprietaire", None)
        return coproprietaire.display_name if coproprietaire else ""

    def get_statut_occupation_label(self, obj):
        return obj.get_statut_occupation_display()


class LotOccupantSerializer(serializers.ModelSerializer):
    """
    Serializer complet pour l'occupant / habitant réel d'un lot.
    """

    copropriete_detail = CoproprieteLiteSerializer(
        source="copropriete",
        read_only=True,
    )

    coproprietaire_detail = CoproprietaireListSerializer(
        source="coproprietaire",
        read_only=True,
    )

    lot_detail = serializers.SerializerMethodField()

    coproprietaire_display = serializers.SerializerMethodField()
    lot_reference = serializers.SerializerMethodField()
    lot_label = serializers.SerializerMethodField()

    display_name = serializers.CharField(read_only=True)
    contact_label = serializers.CharField(read_only=True)
    statut_occupation_label = serializers.SerializerMethodField()
    is_active = serializers.BooleanField(read_only=True)
    periode_label = serializers.CharField(read_only=True)

    class Meta:
        model = LotOccupant
        fields = (
            "id",
            "copropriete",
            "copropriete_detail",
            "lot",
            "lot_detail",
            "lot_reference",
            "lot_label",
            "coproprietaire",
            "coproprietaire_detail",
            "coproprietaire_display",
            "nom",
            "prenom",
            "display_name",
            "telephone",
            "email",
            "contact_label",
            "statut_occupation",
            "statut_occupation_label",
            "occupant_principal",
            "nombre_occupants",
            "date_entree",
            "date_sortie",
            "contact_urgence_nom",
            "contact_urgence_telephone",
            "notes",
            "actif",
            "is_active",
            "periode_label",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "copropriete_detail",
            "lot_detail",
            "lot_reference",
            "lot_label",
            "coproprietaire_detail",
            "coproprietaire_display",
            "display_name",
            "contact_label",
            "statut_occupation_label",
            "is_active",
            "periode_label",
            "created_at",
            "updated_at",
        )

    def get_lot_detail(self, obj):
        lot = obj.lot

        return {
            "id": lot.id,
            "reference": getattr(lot, "reference", None),
            "numero": getattr(lot, "numero", None),
            "batiment": getattr(lot, "batiment", None),
            "escalier": getattr(lot, "escalier", None),
            "etage": getattr(lot, "etage", None),
            "porte": getattr(lot, "porte", None),
            "nombre_pieces": getattr(lot, "nombre_pieces", None),
            "surface": getattr(lot, "surface", None),
            "type_lot": getattr(lot, "type_lot", None),
            "statut": getattr(lot, "statut", None),
            "actif": getattr(lot, "actif", None),
        }

    def get_lot_reference(self, obj):
        return (
            getattr(obj.lot, "reference", None)
            or getattr(obj.lot, "numero", None)
            or str(obj.lot_id)
        )

    def get_lot_label(self, obj):
        lot = obj.lot

        reference = (
            getattr(lot, "reference", None)
            or getattr(lot, "numero", None)
            or str(obj.lot_id)
        )

        parts = [reference]

        batiment = getattr(lot, "batiment", None)
        etage = getattr(lot, "etage", None)
        porte = getattr(lot, "porte", None)

        if batiment:
            parts.append(f"Bât. {batiment}")

        if etage:
            parts.append(f"Étage {etage}")

        if porte:
            parts.append(f"Porte {porte}")

        return " · ".join(parts)

    def get_coproprietaire_display(self, obj):
        coproprietaire = getattr(obj, "coproprietaire", None)
        return coproprietaire.display_name if coproprietaire else ""

    def get_statut_occupation_label(self, obj):
        return obj.get_statut_occupation_display()

    def validate_nom(self, value):
        value = (value or "").strip()

        if not value:
            raise serializers.ValidationError("Le nom de l’occupant est obligatoire.")

        return value

    def validate_prenom(self, value):
        return (value or "").strip()

    def validate_email(self, value):
        return (value or "").strip().lower()

    def validate_telephone(self, value):
        return (value or "").strip()

    def validate_contact_urgence_nom(self, value):
        return (value or "").strip()

    def validate_contact_urgence_telephone(self, value):
        return (value or "").strip()

    def validate_nombre_occupants(self, value):
        if value is not None and value < 1:
            raise serializers.ValidationError(
                "Le nombre total d’occupants doit être au moins égal à 1."
            )

        return value

    def validate(self, attrs):
        instance = self.instance

        lot = attrs.get("lot", getattr(instance, "lot", None))
        coproprietaire = attrs.get(
            "coproprietaire",
            getattr(instance, "coproprietaire", None),
        )
        copropriete = attrs.get(
            "copropriete",
            getattr(instance, "copropriete", None),
        )

        date_entree = attrs.get(
            "date_entree",
            getattr(instance, "date_entree", None),
        )
        date_sortie = attrs.get(
            "date_sortie",
            getattr(instance, "date_sortie", None),
        )

        occupant_principal = attrs.get(
            "occupant_principal",
            getattr(instance, "occupant_principal", True),
        )

        actif = attrs.get(
            "actif",
            getattr(instance, "actif", True),
        )

        if not copropriete and lot:
            copropriete = lot.copropriete
            attrs["copropriete"] = copropriete

        if not copropriete:
            raise serializers.ValidationError(
                {"copropriete": "La copropriété est obligatoire."}
            )

        if not lot:
            raise serializers.ValidationError(
                {"lot": "Le lot est obligatoire."}
            )

        if getattr(lot, "copropriete_id", None) != copropriete.id:
            raise serializers.ValidationError(
                {"lot": "Le lot doit appartenir à la même copropriété."}
            )

        if coproprietaire and coproprietaire.copropriete_id != copropriete.id:
            raise serializers.ValidationError(
                {
                    "coproprietaire": (
                        "Le copropriétaire rattaché doit appartenir à la même copropriété."
                    )
                }
            )

        if date_sortie and date_entree and date_sortie < date_entree:
            raise serializers.ValidationError(
                {
                    "date_sortie": (
                        "La date de sortie ne peut pas être antérieure à la date d’entrée."
                    )
                }
            )

        if date_sortie:
            attrs["actif"] = False
            actif = False

        if occupant_principal and actif and not date_sortie:
            qs = LotOccupant.objects.filter(
                lot=lot,
                occupant_principal=True,
                actif=True,
                date_sortie__isnull=True,
            )

            if instance:
                qs = qs.exclude(pk=instance.pk)

            if qs.exists():
                raise serializers.ValidationError(
                    {
                        "occupant_principal": (
                            "Un occupant principal actif existe déjà pour ce lot."
                        )
                    }
                )

        return attrs