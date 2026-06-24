from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]

tsx_path = ROOT / "frontend/src/pages/coproprietaire/CoproprietaireSituationFinanciere.tsx"
css_path = ROOT / "frontend/src/styles/module-visual-system.css"


def add_classes_to_tag(tag: str, classes: str) -> str:
    wanted = classes.split()

    simple = re.search(r'className="([^"]*)"', tag)
    if simple:
        current = simple.group(1).split()
        merged = current[:]
        for item in wanted:
            if item not in merged:
                merged.append(item)
        return tag[: simple.start(1)] + " ".join(merged) + tag[simple.end(1):]

    if "className=" in tag:
        return tag

    return re.sub(
        r"^<([A-Za-z][A-Za-z0-9]*)",
        r'<\1 className="' + classes + '"',
        tag,
        count=1,
    )


text = tsx_path.read_text(encoding="utf-8")
original = text

# Garantit que la page a bien une classe racine exploitable par le CSS.
if "coproOwnerSituationPage" not in text:
    if "coproOwnerPage" in text:
        text = re.sub(
            r'className="([^"]*\bcoproOwnerPage\b[^"]*)"',
            lambda m: 'className="' + " ".join(
                dict.fromkeys((m.group(1) + " coproOwnerSituationPage").split())
            ) + '"',
            text,
            count=1,
        )
    else:
        pattern = re.compile(
            r"<(?:div|main|section)\b(?=[^>]*style=\{styles\.(stack|page|container|shell|wrapper)\})[^>]*>",
            re.S,
        )
        text, count = pattern.subn(
            lambda m: add_classes_to_tag(m.group(0), "coproOwnerPage coproOwnerSituationPage"),
            text,
            count=1,
        )

        if count == 0:
            fallback = re.compile(
                r"<(?:div|main|section)\b(?=[^>]*style=\{styles\.[A-Za-z0-9_]+\})[^>]*>",
                re.S,
            )
            text, _ = fallback.subn(
                lambda m: add_classes_to_tag(m.group(0), "coproOwnerPage coproOwnerSituationPage"),
                text,
                count=1,
            )

if text != original:
    tsx_path.write_text(text, encoding="utf-8")
    print("Classe coproOwnerSituationPage ajoutée/confirmée.")
else:
    print("Aucun changement JSX nécessaire.")


css = css_path.read_text(encoding="utf-8")
marker = "/* ESPACE COPROPRIÉTAIRE — SITUATION FINANCIÈRE MOBILE */"

if marker not in css:
    css += r'''

/* ESPACE COPROPRIÉTAIRE — SITUATION FINANCIÈRE MOBILE */
.coproOwnerSituationPage {
  width: 100%;
  max-width: 100%;
  min-width: 0;
  overflow-x: hidden;
}

.coproOwnerSituationPage section,
.coproOwnerSituationPage article,
.coproOwnerSituationPage div {
  min-width: 0;
  max-width: 100%;
}

.coproOwnerSituationPage h1,
.coproOwnerSituationPage h2,
.coproOwnerSituationPage h3,
.coproOwnerSituationPage p,
.coproOwnerSituationPage span,
.coproOwnerSituationPage strong {
  max-width: 100%;
  overflow-wrap: anywhere;
}

@media (max-width: 760px) {
  .coproOwnerSituationPage section[style*="display: flex"],
  .coproOwnerSituationPage article[style*="display: flex"],
  .coproOwnerSituationPage div[style*="display: flex"] {
    flex-direction: column !important;
    align-items: stretch !important;
    justify-content: flex-start !important;
    flex-wrap: nowrap !important;
  }

  .coproOwnerSituationPage section[style*="grid-template-columns"],
  .coproOwnerSituationPage article[style*="grid-template-columns"],
  .coproOwnerSituationPage div[style*="grid-template-columns"] {
    grid-template-columns: 1fr !important;
  }

  .coproOwnerSituationPage article[style*="background: linear-gradient"],
  .coproOwnerSituationPage section[style*="background: linear-gradient"] {
    padding: 20px !important;
    gap: 16px !important;
  }

  .coproOwnerSituationPage article[style*="background: linear-gradient"] > *,
  .coproOwnerSituationPage section[style*="background: linear-gradient"] > * {
    width: 100% !important;
    max-width: 100% !important;
  }

  .coproOwnerSituationPage h1,
  .coproOwnerSituationPage h2 {
    font-size: clamp(1.35rem, 7vw, 1.8rem) !important;
    line-height: 1.12 !important;
    letter-spacing: -0.04em !important;
  }

  .coproOwnerSituationPage [style*="font-size: 26px"] {
    font-size: 22px !important;
    line-height: 1.12 !important;
  }

  .coproOwnerSituationPage [style*="font-size: 44px"],
  .coproOwnerSituationPage [style*="font-size: 42px"],
  .coproOwnerSituationPage [style*="font-size: 40px"] {
    font-size: 32px !important;
    line-height: 1.05 !important;
  }
}

@media (max-width: 480px) {
  .coproOwnerSituationPage article[style*="background: linear-gradient"],
  .coproOwnerSituationPage section[style*="background: linear-gradient"] {
    padding: 18px !important;
    border-radius: 22px !important;
  }

  .coproOwnerSituationPage h1,
  .coproOwnerSituationPage h2 {
    font-size: 1.55rem !important;
  }

  .coproOwnerSituationPage p {
    line-height: 1.55 !important;
  }
}
'''
    css_path.write_text(css, encoding="utf-8")
    print("CSS mobile Situation financière ajouté.")
else:
    print("CSS mobile Situation financière déjà présent.")
