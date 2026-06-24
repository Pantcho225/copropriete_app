from django.apps import apps
from django.contrib.auth import get_user_model

DEMO_COPROPRIETE_ID = 24
KEYWORDS = (
    "lot",
    "tantieme",
    "occupant",
    "coproprietaire",
    "appel",
    "paiement",
    "relance",
    "assemblee",
    "ag",
    "convocation",
    "resolution",
    "vote",
    "presence",
    "procuration",
    "document",
    "mouvement",
    "facture",
)

Copropriete = apps.get_model("core", "Copropriete")
User = get_user_model()

demo = Copropriete.objects.get(id=DEMO_COPROPRIETE_ID)

print("=" * 80)
print("COPROPRIÉTÉ PILOTE")
print("=" * 80)
print(f"ID     : {demo.id}")
print(f"Nom    : {demo.nom}")
print(f"Statut : {getattr(demo, 'statut', '—')}")
print()

print("=" * 80)
print("COMPTES UTILISATEURS")
print("=" * 80)
for user in User.objects.all().order_by("id"):
    email = getattr(user, "email", "") or "—"
    username = getattr(user, "username", "") or "—"
    print(
        f"{user.id:<4} email={email:<32} username={username:<22} "
        f"staff={user.is_staff} superuser={user.is_superuser}"
    )

print()
print("=" * 80)
print("MODÈLES LIÉS DIRECTEMENT À LA COPROPRIÉTÉ #24")
print("=" * 80)

rows = []

for model in apps.get_models():
    model_name = model.__name__
    label = model._meta.label

    direct_copro_field = None

    for field in model._meta.fields:
        if field.name == "copropriete":
            direct_copro_field = field.name
            break

    if not direct_copro_field:
        continue

    try:
        qs = model.objects.filter(**{direct_copro_field: demo})
        count = qs.count()
    except Exception as exc:
        rows.append((label, "ERREUR", str(exc)))
        continue

    if count > 0:
        rows.append((label, count, ""))

for label, count, note in sorted(rows, key=lambda item: item[0].lower()):
    if note:
        print(f"{label:<45} {count} — {note}")
    else:
        print(f"{label:<45} {count}")

print()
print("=" * 80)
print("APERÇU DES OBJETS MÉTIER IMPORTANTS")
print("=" * 80)

for model in apps.get_models():
    label = model._meta.label
    model_name = model.__name__.lower()

    if not any(keyword in model_name or keyword in label.lower() for keyword in KEYWORDS):
        continue

    direct_copro_field = None
    for field in model._meta.fields:
        if field.name == "copropriete":
            direct_copro_field = field.name
            break

    if not direct_copro_field:
        continue

    try:
        qs = model.objects.filter(**{direct_copro_field: demo}).order_by("id")[:8]
    except Exception:
        continue

    items = list(qs)
    if not items:
        continue

    print()
    print(f"[{label}]")
    for obj in items:
        obj_id = getattr(obj, "id", "—")
        text = str(obj)
        if len(text) > 120:
            text = text[:117] + "..."
        print(f"  - #{obj_id}: {text}")

print()
print("=" * 80)
print("AUDIT TERMINÉ")
print("=" * 80)
