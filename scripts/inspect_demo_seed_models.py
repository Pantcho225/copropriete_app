from django.apps import apps

MODELS = [
    ("billing_app", "Exercice"),
    ("billing_app", "AppelDeFonds"),
    ("billing_app", "LigneAppelDeFonds"),
    ("billing_app", "PaiementAppel"),
    ("billing_app", "RelanceLot"),
    ("documents", "ReglementTexteApplicable"),
    ("compta", "CompteBancaire"),
    ("compta", "MouvementBancaire"),
    ("relances", "DossierImpaye"),
    ("relances", "Relance"),
]

for app_label, model_name in MODELS:
    print()
    print("=" * 90)
    print(f"{app_label}.{model_name}")
    print("=" * 90)

    try:
        model = apps.get_model(app_label, model_name)
    except LookupError as exc:
        print(f"INTROUVABLE : {exc}")
        continue

    print("Champs :")
    for field in model._meta.fields:
        required = not getattr(field, "blank", False) and not getattr(field, "null", False)
        default = getattr(field, "default", None)
        default_label = "" if str(default).endswith("NOT_PROVIDED") else f" default={default}"

        rel = ""
        if getattr(field, "related_model", None):
            rel = f" -> {field.related_model._meta.label}"

        print(
            f"  - {field.name:<28} {field.__class__.__name__:<22}"
            f" required={required}{default_label}{rel}"
        )

    print()
    print(f"Total actuel : {model.objects.count()}")
