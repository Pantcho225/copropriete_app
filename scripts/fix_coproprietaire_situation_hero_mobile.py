from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
path = ROOT / "frontend/src/pages/coproprietaire/CoproprietaireSituationFinanciere.tsx"

text = path.read_text(encoding="utf-8")
original = text

# Ajoute la classe page à tous les rendus qui ne l'ont pas encore.
text = text.replace(
    '<section style={styles.page}>',
    '<section className="coproOwnerPage coproOwnerSituationPage" style={styles.page}>',
)

# Rend le hero naturellement responsive au lieu de forcer 2 colonnes à 360px.
text = text.replace(
    'gridTemplateColumns: "minmax(0, 1fr) 280px",',
    'gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))",',
)

# Sécurise le contenu du hero.
text = re.sub(
    r"heroContent: \{\n(.*?)\n  \},",
    lambda m: "heroContent: {\n"
    + m.group(1)
    + '\n    width: "100%",\n    maxWidth: "100%",\n    minWidth: 0,\n  },',
    text,
    count=1,
    flags=re.S,
) if 'heroContent: {' in text and 'maxWidth: "100%"' not in text[text.find('heroContent: {'):text.find('heroEyebrow: {')] else text

# Sécurise le bloc score.
text = re.sub(
    r"heroScore: \{\n(.*?)\n  \},",
    lambda m: "heroScore: {\n"
    + m.group(1)
    + '\n    width: "100%",\n    maxWidth: "100%",\n    minWidth: 0,\n  },',
    text,
    count=1,
    flags=re.S,
) if 'heroScore: {' in text and 'maxWidth: "100%"' not in text[text.find('heroScore: {'):text.find('heroScoreLabel: {')] else text

if text != original:
    path.write_text(text, encoding="utf-8")
    print("Situation financière corrigée : classe page + hero responsive.")
else:
    print("Aucune modification appliquée.")
