# apps/owners/coproprietaire_space_views.py

from decimal import Decimal, InvalidOperation

from django.apps import apps
from django.db.models import Q
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView


def model_has_field(model, field_name: str) -> bool:
    return any(field.name == field_name for field in model._meta.get_fields())


def safe_attr(obj, *names, default=None):
    for name in names:
        if hasattr(obj, name):
            value = getattr(obj, name)
            if value is not None:
                return value
    return default


def to_decimal_or_zero(value):
    if value in (None, ""):
        return Decimal("0")

    try:
        return Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        return Decimal("0")


def get_optional_model(app_label: str, model_name: str):
    try:
        return apps.get_model(app_label, model_name)
    except LookupError:
        return None


class CoproprietaireMesLotsAPIView(APIView):
    """
    Retourne uniquement les lots rattachés au copropriétaire connecté.

    Cet endpoint est dédié à l'espace /coproprietaire.
    Il ne renvoie jamais tous les lots de la copropriété.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user

        Coproprietaire = apps.get_model("owners", "Coproprietaire")
        ProprietaireLot = apps.get_model("owners", "ProprietaireLot")
        LotTantieme = get_optional_model("lots", "LotTantieme")

        copro_filter = Q()

        if model_has_field(Coproprietaire, "user_account"):
            copro_filter |= Q(user_account=user)

        if model_has_field(Coproprietaire, "user"):
            copro_filter |= Q(user=user)

        if not copro_filter:
            return Response(
                {
                    "count": 0,
                    "coproprietaire": None,
                    "lots": [],
                    "detail": "Aucun champ utilisateur compatible trouvé sur le modèle Coproprietaire.",
                }
            )

        coproprietaires = list(Coproprietaire.objects.filter(copro_filter))

        if not coproprietaires:
            return Response(
                {
                    "count": 0,
                    "coproprietaire": None,
                    "lots": [],
                }
            )

        owner_field = None

        for candidate in ["coproprietaire", "proprietaire", "owner"]:
            if model_has_field(ProprietaireLot, candidate):
                owner_field = candidate
                break

        if owner_field is None:
            return Response(
                {
                    "count": 0,
                    "coproprietaire": None,
                    "lots": [],
                    "detail": "Aucun champ propriétaire compatible trouvé sur ProprietaireLot.",
                }
            )

        if not model_has_field(ProprietaireLot, "lot"):
            return Response(
                {
                    "count": 0,
                    "coproprietaire": None,
                    "lots": [],
                    "detail": "Le modèle ProprietaireLot ne contient pas de champ lot.",
                }
            )

        link_filter = Q(**{f"{owner_field}__in": coproprietaires})

        if model_has_field(ProprietaireLot, "is_active"):
            link_filter &= Q(is_active=True)

        if model_has_field(ProprietaireLot, "actif"):
            link_filter &= Q(actif=True)

        liens = (
            ProprietaireLot.objects.filter(link_filter)
            .select_related("lot", owner_field)
            .order_by("lot_id")
        )

        lots_payload = []

        for lien in liens:
            lot = lien.lot
            coproprietaire = getattr(lien, owner_field)

            copropriete = safe_attr(lot, "copropriete", default=None)
            if copropriete is None:
                copropriete = safe_attr(coproprietaire, "copropriete", default=None)

            tantiemes_total = self.get_lot_tantiemes_total(lot, LotTantieme)

            lots_payload.append(
                {
                    "id": lot.id,
                    "numero": safe_attr(lot, "numero", "code", "nom", default=f"Lot #{lot.id}"),
                    "batiment": safe_attr(lot, "batiment", "immeuble", "bloc", default=""),
                    "etage": safe_attr(lot, "etage", "niveau", default=""),
                    "type_lot": safe_attr(lot, "type_lot", "type", "nature", default=""),
                    "surface": safe_attr(lot, "surface", "surface_m2", "superficie", default=None),
                    "description": safe_attr(lot, "description", default=""),
                    "tantiemes_total": float(tantiemes_total),
                    "copropriete": {
                        "id": getattr(copropriete, "id", None),
                        "nom": safe_attr(copropriete, "nom", "name", default=""),
                    },
                    "lien": {
                        "id": lien.id,
                        "type_droit": safe_attr(
                            lien,
                            "type_droit",
                            "type_propriete",
                            "qualite",
                            default="PROPRIETAIRE",
                        ),
                        "quote_part": safe_attr(
                            lien,
                            "quote_part",
                            "pourcentage",
                            "part",
                            default=None,
                        ),
                        "date_debut": safe_attr(lien, "date_debut", "date_acquisition", default=None),
                        "date_fin": safe_attr(lien, "date_fin", default=None),
                    },
                }
            )

        main_coproprietaire = coproprietaires[0]

        return Response(
            {
                "count": len(lots_payload),
                "coproprietaire": {
                    "id": main_coproprietaire.id,
                    "nom": safe_attr(main_coproprietaire, "nom", default=""),
                    "prenoms": safe_attr(main_coproprietaire, "prenoms", "prenom", default=""),
                    "email": safe_attr(main_coproprietaire, "email", default=user.email),
                },
                "lots": lots_payload,
            }
        )

    def get_lot_tantiemes_total(self, lot, LotTantieme):
        direct_value = safe_attr(
            lot,
            "tantiemes_total",
            "total_tantiemes",
            "tantieme_total",
            "tantiemes",
            default=None,
        )

        if direct_value is not None:
            return to_decimal_or_zero(direct_value)

        if LotTantieme is None:
            return Decimal("0")

        if not model_has_field(LotTantieme, "lot"):
            return Decimal("0")

        numeric_candidates = [
            "valeur",
            "tantieme",
            "tantiemes",
            "quote_part",
            "nombre",
            "value",
        ]

        total = Decimal("0")

        for item in LotTantieme.objects.filter(lot=lot):
            for field_name in numeric_candidates:
                if hasattr(item, field_name):
                    total += to_decimal_or_zero(getattr(item, field_name))
                    break

        return total