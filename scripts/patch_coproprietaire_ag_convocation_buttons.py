from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
path = ROOT / "frontend/src/pages/coproprietaire/CoproprietaireAssemblees.tsx"

text = path.read_text(encoding="utf-8")
original = text

text = text.replace(
'''                    <button
                      type="button"
                      onClick={() => openDocument(convocation.document_url)}
                      style={styles.convocationDocButton}
                    >
                      Ouvrir le PDF
                    </button>''',
'''                    <button
                      type="button"
                      className="coproOwnerPremiumButton coproOwnerPremiumButton--soft coproOwnerConvocationButton"
                      onClick={() => openDocument(convocation.document_url)}
                      style={styles.convocationDocButton}
                    >
                      📄 Ouvrir le PDF
                    </button>'''
)

text = text.replace(
'''                  <button
                    type="button"
                    disabled={isConsulted || isCanceled || isReplacedVersion || consulting}
                    onClick={() => onConsult(convocation)}
                    style={{
                      ...styles.convocationConsultButton,
                      ...(isConsulted || isCanceled || isReplacedVersion || consulting
                        ? styles.convocationConsultButtonDisabled
                        : {}),
                    }}
                  >''',
'''                  <button
                    type="button"
                    className={`coproOwnerPremiumButton coproOwnerConvocationButton ${
                      isConsulted || isCanceled || isReplacedVersion || consulting
                        ? "coproOwnerPremiumButton--soft"
                        : "coproOwnerPremiumButton--primary"
                    }`}
                    disabled={isConsulted || isCanceled || isReplacedVersion || consulting}
                    onClick={() => onConsult(convocation)}
                    style={{
                      ...styles.convocationConsultButton,
                      ...(isConsulted || isCanceled || isReplacedVersion || consulting
                        ? styles.convocationConsultButtonDisabled
                        : {}),
                    }}
                  >'''
)

css_path = ROOT / "frontend/src/styles/module-visual-system.css"
css = css_path.read_text(encoding="utf-8")
marker = "/* ESPACE COPROPRIÉTAIRE — BOUTONS CONVOCATIONS AG */"

if marker not in css:
    css += '''

/* ESPACE COPROPRIÉTAIRE — BOUTONS CONVOCATIONS AG */
.coproOwnerConvocationButton {
  min-width: 132px !important;
  border-radius: 999px !important;
}

@media (max-width: 760px) {
  .coproOwnerConvocationButton {
    width: 100% !important;
  }
}
'''
    css_path.write_text(css, encoding="utf-8")
    print("CSS boutons convocations ajouté.")

if text != original:
    path.write_text(text, encoding="utf-8")
    print("Boutons de convocation AG améliorés.")
else:
    print("Aucune modification JSX appliquée. Vérifie si le bloc a déjà changé.")
