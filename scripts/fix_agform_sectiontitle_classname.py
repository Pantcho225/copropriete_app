from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
path = ROOT / "frontend/src/pages/ag/AGForm.tsx"

text = path.read_text(encoding="utf-8")
original = text

# Le script précédent a posé className sur SectionTitle, ce composant ne l'accepte pas.
text = text.replace(
    '<SectionTitle className="adminHarmonizedButton adminHarmonizedButton--soft"\n',
    '<SectionTitle\n',
)

# On met la classe au bon endroit : le lien "Retour à la liste".
text = text.replace(
    '<Link to="/ag/assemblees" style={ghostLink}>',
    '<Link className="adminHarmonizedButton adminHarmonizedButton--soft" to="/ag/assemblees" style={ghostLink}>',
)

if text != original:
    path.write_text(text, encoding="utf-8")
    print("AGForm corrigé : className retiré de SectionTitle et appliqué au lien retour.")
else:
    print("Aucune modification appliquée. Vérifie le contenu actuel de AGForm.tsx.")
