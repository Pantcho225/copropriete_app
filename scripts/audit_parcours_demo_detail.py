from django.apps import apps
from django.contrib.auth import get_user_model

COPRO_ID = 24

Copropriete = apps.get_model("core", "Copropriete")
copro = Copropriete.objects.get(id=COPRO_ID)
User = get_user_model()

print("=" * 90)
print("AUDIT PROFOND PARCOURS DÉMO OFFICIEL")
print("=" * 90)
print(f"Copropriété : #{copro.id} — {copro.nom}")
print()

def get_model(app_label, model_name):
    try:
        return apps.get_model(app_label, model_name)
    except LookupError:
        return None

def show_qs(title, qs, limit=10):
    print()
    print("-" * 90)
    print(title)
    print("-" * 90)
    try:
        count = qs.count()
    except Exception as exc:
        print(f"ERREUR COUNT : {exc}")
        return

    print(f"Total : {count}")

    for obj in list(qs[:limit]):
        text = str(obj)
        if len(text) > 140:
            text = text[:137] + "..."
        print(f"  - #{getattr(obj, 'id', '—')}: {text}")

def show_model_fields(app_label, model_name):
    model = get_model(app_label, model_name)
    if not model:
        return

    print()
    print(f"[CHAMPS] {app_label}.{model_name}")
    for f in model._meta.fields:
        rel = ""
        if getattr(f, "related_model", None):
            rel = f" -> {f.related_model._meta.label}"
        print(f"  - {f.name}: {f.__class__.__name__}{rel}")

# Modèles principaux connus / probables
Lot = get_model("lots", "Lot")
Coproprietaire = get_model("owners", "Coproprietaire")
ProprietaireLot = get_model("owners", "ProprietaireLot")
LotOccupant = get_model("owners", "LotOccupant")
AG = get_model("ag", "AssembleeGenerale")
Convocation = get_model("ag", "AgConvocation")
GeneratedDocument = get_model("documents", "GeneratedDocument")

lots = Lot.objects.filter(copropriete=copro).order_by("id") if Lot else []
coproprietaires = Coproprietaire.objects.filter(copropriete=copro).order_by("id") if Coproprietaire else []
ags = AG.objects.filter(copropriete=copro).order_by("id") if AG else []
convocations = Convocation.objects.filter(copropriete=copro).order_by("id") if Convocation else []

if Lot:
    show_qs("LOTS", lots)
if Coproprietaire:
    show_qs("COPROPRIÉTAIRES", coproprietaires)
if ProprietaireLot:
    show_qs("LIAISONS PROPRIÉTAIRE-LOT", ProprietaireLot.objects.filter(copropriete=copro).order_by("id"))
if LotOccupant:
    show_qs("OCCUPANTS", LotOccupant.objects.filter(copropriete=copro).order_by("id"))
if AG:
    show_qs("ASSEMBLÉES GÉNÉRALES", ags)
if Convocation:
    show_qs("CONVOCATIONS", convocations)
if GeneratedDocument:
    show_qs("DOCUMENTS GÉNÉRÉS", GeneratedDocument.objects.filter(copropriete=copro).order_by("id"))

print()
print("=" * 90)
print("RECHERCHE DES MODÈLES MÉTIER PAR NOM")
print("=" * 90)

keywords = [
    "appel", "paiement", "relance", "ligne", "facture",
    "resolution", "vote", "presence", "procuration", "mandat",
    "pv", "proces", "document", "mouvement", "releve",
]

for model in apps.get_models():
    label = model._meta.label
    low = label.lower()

    if not any(k in low for k in keywords):
        continue

    print()
    print(f"[MODÈLE] {label}")

    for f in model._meta.fields:
        rel = ""
        if getattr(f, "related_model", None):
            rel = f" -> {f.related_model._meta.label}"
        print(f"  - {f.name}: {f.__class__.__name__}{rel}")

    # Essaie plusieurs chemins de filtrage courants
    filters = []

    field_names = {f.name for f in model._meta.fields}

    if "copropriete" in field_names:
        filters.append(("copropriete", {"copropriete": copro}))

    if "assemblee" in field_names and AG:
        filters.append(("assemblee__in", {"assemblee__in": ags}))

    if "ag" in field_names and AG:
        filters.append(("ag__in", {"ag__in": ags}))

    if "lot" in field_names and Lot:
        filters.append(("lot__in", {"lot__in": lots}))

    if "coproprietaire" in field_names and Coproprietaire:
        filters.append(("coproprietaire__in", {"coproprietaire__in": coproprietaires}))

    if "convocation" in field_names and Convocation:
        filters.append(("convocation__in", {"convocation__in": convocations}))

    seen = set()

    for label_filter, kwargs in filters:
        try:
            qs = model.objects.filter(**kwargs).order_by("id")
            count = qs.count()
        except Exception as exc:
            print(f"  Filtre {label_filter}: ERREUR {exc}")
            continue

        print(f"  Filtre {label_filter}: {count}")

        for obj in list(qs[:5]):
            key = (model._meta.label, getattr(obj, "id", None))
            if key in seen:
                continue
            seen.add(key)

            text = str(obj)
            if len(text) > 130:
                text = text[:127] + "..."
            print(f"    - #{getattr(obj, 'id', '—')}: {text}")

print()
print("=" * 90)
print("ÉTATS AG DÉTAILLÉS")
print("=" * 90)

if AG:
    for ag in ags:
        print()
        print(f"AG #{ag.id}: {ag}")
        for f in ag._meta.fields:
            if f.name in {
                "titre", "libelle", "objet", "date", "date_ag", "date_reunion",
                "statut", "status", "type_ag", "quorum_atteint",
                "pv_genere", "pv_generated",
            }:
                print(f"  {f.name}: {getattr(ag, f.name, '—')}")

print()
print("=" * 90)
print("AUDIT PROFOND TERMINÉ")
print("=" * 90)
