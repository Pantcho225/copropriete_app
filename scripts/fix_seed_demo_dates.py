from pathlib import Path
import re

path = Path("scripts/seed_parcours_demo_officiel.py")
text = path.read_text(encoding="utf-8")

# Import timedelta pour générer des dates passées.
text = text.replace(
    "from datetime import date, datetime",
    "from datetime import date, datetime, timedelta",
)

# Ajoute des helpers de dates passées après la fonction aware.
text = text.replace(
    '''def aware(year, month, day, hour=9, minute=0):
    return timezone.make_aware(datetime(year, month, day, hour, minute))
''',
    '''def aware(year, month, day, hour=9, minute=0):
    return timezone.make_aware(datetime(year, month, day, hour, minute))


TODAY = timezone.localdate()


def past_date(days: int):
    return TODAY - timedelta(days=days)


def aware_past(days: int, hour=9, minute=0):
    target = past_date(days)
    return timezone.make_aware(datetime(target.year, target.month, target.day, hour, minute))
''',
)

# Remplace les dates futures des appels par des dates déjà passées.
text = text.replace('date(2026, 7, 1)', 'past_date(90)')
text = text.replace('date(2026, 7, 31)', 'past_date(60)')
text = text.replace('date(2026, 8, 1)', 'past_date(55)')
text = text.replace('date(2026, 8, 31)', 'past_date(25)')

# Remplace les dates futures de paiement.
text = text.replace('aware(2026, 8, 5, 10, 30)', 'aware_past(20, 10, 30)')

# Remplace les dates futures de dépenses.
text = text.replace('date(2026, 8, 8)', 'past_date(18)')
text = text.replace('date(2026, 8, 12)', 'past_date(15)')
text = text.replace('date(2026, 8, 15)', 'past_date(12)')

# Remplace les dates futures de relances.
text = text.replace('aware(2026, 9, 3, 9, 0)', 'aware_past(7, 9, 0)')

path.write_text(text, encoding="utf-8")
print("Dates futures remplacées par des dates passées.")
