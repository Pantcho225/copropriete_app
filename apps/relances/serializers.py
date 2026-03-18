from __future__ import annotations

from rest_framework import serializers

from .models import AvisRegularisation, DossierImpaye, Relance


def _get_person_display(cp) -> str | None:
    if not cp:
        return None

    for attr in ("nom_complet", "full_name", "nom"):
        value = getattr(cp, attr, None)
        if value:
            return value

    prenom = getattr(cp, "prenom", "") or ""
    nom = getattr(cp, "nom", "") or ""
    full = f"{prenom} {nom}".strip()
    return full or str(cp)


def _get_appel_display(appel) -> str | None:
    if not appel:
        return None

    for attr in ("reference", "numero", "libelle", "titre"):
        value = getattr(appel, attr, None)
        if value:
            return value

    return str(appel)


class DossierImpayeListSerializer(serializers.ModelSerializer):
    copropriete_nom = serializers.CharField(source="copropriete.nom", read_only=True)
    lot_numero = serializers.CharField(source="lot.reference", read_only=True)
    coproprietaire_nom = serializers.SerializerMethodField()
    appel_reference = serializers.SerializerMethodField()

    class Meta:
        model = DossierImpaye
        fields = [
            "id",
            "copropriete",
            "copropriete_nom",
            "lot",
            "lot_numero",
            "coproprietaire",
            "coproprietaire_nom",
            "appel",
            "appel_reference",
            "reference_appel",
            "date_echeance",
            "montant_initial",
            "montant_paye",
            "reste_a_payer",
            "statut",
            "niveau_relance",
            "relances_count",
            "derniere_relance_at",
            "date_dernier_paiement",
            "est_regularise",
            "regularise_at",
            "auto_relance_active",
            "commentaire_interne",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields

    def get_coproprietaire_nom(self, obj):
        return _get_person_display(obj.coproprietaire)

    def get_appel_reference(self, obj):
        return _get_appel_display(obj.appel)


class RelanceSerializer(serializers.ModelSerializer):
    copropriete_nom = serializers.CharField(source="copropriete.nom", read_only=True)
    lot_numero = serializers.CharField(source="lot.reference", read_only=True)
    coproprietaire_nom = serializers.SerializerMethodField()
    appel_reference = serializers.SerializerMethodField()
    envoye_par_username = serializers.CharField(source="envoye_par.username", read_only=True)
    annulee_par_username = serializers.CharField(source="annulee_par.username", read_only=True)

    class Meta:
        model = Relance
        fields = [
            "id",
            "copropriete",
            "copropriete_nom",
            "dossier",
            "appel",
            "appel_reference",
            "lot",
            "lot_numero",
            "coproprietaire",
            "coproprietaire_nom",
            "niveau",
            "canal",
            "statut",
            "objet",
            "message",
            "montant_du_message",
            "reste_a_payer_au_moment_envoi",
            "document_pdf",
            "date_envoi",
            "date_echec",
            "motif_echec",
            "envoye_par",
            "envoye_par_username",
            "annulee_at",
            "annulee_par",
            "annulee_par_username",
            "motif_annulation",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "copropriete_nom",
            "lot_numero",
            "coproprietaire_nom",
            "appel_reference",
            "envoye_par_username",
            "annulee_par_username",
            "date_envoi",
            "date_echec",
            "motif_echec",
            "annulee_at",
            "annulee_par",
            "annulee_par_username",
            "created_at",
            "updated_at",
        ]

    def get_coproprietaire_nom(self, obj):
        return _get_person_display(obj.coproprietaire)

    def get_appel_reference(self, obj):
        return _get_appel_display(obj.appel)


class RelanceCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Relance
        fields = [
            "id",
            "dossier",
            "canal",
            "objet",
            "message",
            "document_pdf",
            "niveau",
            "montant_du_message",
            "reste_a_payer_au_moment_envoi",
        ]
        read_only_fields = ["id"]

    def validate(self, attrs):
        dossier = attrs.get("dossier")
        if not dossier:
            raise serializers.ValidationError({"dossier": "Le dossier impayé est obligatoire."})

        request = self.context.get("request")
        request_copro_id = None
        if request is not None:
            request_copro_id = getattr(request, "copropriete_id", None) or request.headers.get("X-Copropriete-Id")

        if request_copro_id and str(dossier.copropriete_id) != str(request_copro_id):
            raise serializers.ValidationError(
                {"dossier": "Le dossier ne correspond pas à la copropriété courante."}
            )

        if dossier.reste_a_payer <= 0:
            raise serializers.ValidationError(
                {"dossier": "Impossible de créer une relance pour un dossier soldé."}
            )

        if getattr(dossier, "est_regularise", False):
            raise serializers.ValidationError(
                {"dossier": "Impossible de créer une relance pour un dossier déjà régularisé."}
            )

        canal = (attrs.get("canal") or "").strip()
        if not canal:
            raise serializers.ValidationError({"canal": "Le canal est obligatoire."})

        # Source de vérité = dossier
        attrs["copropriete"] = dossier.copropriete
        attrs["appel"] = dossier.appel
        attrs["lot"] = dossier.lot
        attrs["coproprietaire"] = dossier.coproprietaire

        if attrs.get("reste_a_payer_au_moment_envoi") is None:
            attrs["reste_a_payer_au_moment_envoi"] = dossier.reste_a_payer

        if attrs.get("montant_du_message") is None:
            attrs["montant_du_message"] = dossier.reste_a_payer

        if not attrs.get("niveau"):
            attrs["niveau"] = (dossier.niveau_relance or 0) + 1

        # On ne laisse pas le client imposer un statut incohérent à la création
        attrs["statut"] = getattr(Relance.Statut, "ENVOYEE", "ENVOYEE")

        return attrs

    def create(self, validated_data):
        request = self.context.get("request")
        if request and request.user and request.user.is_authenticated:
            validated_data["envoye_par"] = request.user
        return super().create(validated_data)


class AvisRegularisationSerializer(serializers.ModelSerializer):
    copropriete_nom = serializers.CharField(source="copropriete.nom", read_only=True)
    lot_numero = serializers.CharField(source="lot.reference", read_only=True)
    coproprietaire_nom = serializers.SerializerMethodField()
    appel_reference = serializers.SerializerMethodField()
    genere_par_username = serializers.CharField(source="genere_par.username", read_only=True)

    class Meta:
        model = AvisRegularisation
        fields = [
            "id",
            "copropriete",
            "copropriete_nom",
            "dossier",
            "appel",
            "appel_reference",
            "lot",
            "lot_numero",
            "coproprietaire",
            "coproprietaire_nom",
            "montant_initial",
            "montant_total_regle",
            "date_regularisation",
            "canal",
            "statut",
            "message",
            "document_pdf",
            "genere_par",
            "genere_par_username",
            "envoye_at",
            "motif_echec",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "copropriete_nom",
            "lot_numero",
            "coproprietaire_nom",
            "appel_reference",
            "genere_par_username",
            "envoye_at",
            "created_at",
            "updated_at",
        ]

    def get_coproprietaire_nom(self, obj):
        return _get_person_display(obj.coproprietaire)

    def get_appel_reference(self, obj):
        return _get_appel_display(obj.appel)


class DossierImpayeDetailSerializer(DossierImpayeListSerializer):
    relances = RelanceSerializer(many=True, read_only=True)
    avis_regularisation = AvisRegularisationSerializer(read_only=True)

    class Meta(DossierImpayeListSerializer.Meta):
        fields = DossierImpayeListSerializer.Meta.fields + [
            "relances",
            "avis_regularisation",
        ]
        read_only_fields = fields