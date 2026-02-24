# apps/billing/migrations/0007_relancelot_qr_token_relancelot_qr_token_created_at_and_more.py
import uuid
from django.db import migrations, models
from django.utils import timezone


def set_unique_qr_tokens(apps, schema_editor):
    RelanceLot = apps.get_model("billing_app", "RelanceLot")

    # On met un uuid différent pour chaque relance existante
    for rel in RelanceLot.objects.all().only("id"):
        RelanceLot.objects.filter(id=rel.id, qr_token__isnull=True).update(qr_token=uuid.uuid4())


class Migration(migrations.Migration):

    dependencies = [
        ("billing_app", "0006_appeldefonds_billing_app_exercic_e08080_idx_and_more"),
    ]

    operations = [
        # 1) Ajout du champ qr_token en nullable (PAS unique pour l’instant)
        migrations.AddField(
            model_name="relancelot",
            name="qr_token",
            field=models.UUIDField(null=True, editable=False),
        ),

        # 2) Ajout de la date de création du token (facultatif mais OK)
        migrations.AddField(
            model_name="relancelot",
            name="qr_token_created_at",
            field=models.DateTimeField(default=timezone.now, editable=False),
        ),

        # 3) Remplir les anciens enregistrements
        migrations.RunPython(set_unique_qr_tokens, migrations.RunPython.noop),

        # 4) Rendre le champ unique + non-null + default pour les futurs enregistrements
        migrations.AlterField(
            model_name="relancelot",
            name="qr_token",
            field=models.UUIDField(default=uuid.uuid4, unique=True, editable=False),
        ),
    ]