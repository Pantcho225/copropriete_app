from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]

FILES = {
    "relances": ROOT / "frontend/src/pages/coproprietaire/CoproprietaireRelances.tsx",
    "situation": ROOT / "frontend/src/pages/coproprietaire/CoproprietaireSituationFinanciere.tsx",
}

CSS_FILE = ROOT / "frontend/src/styles/module-visual-system.css"


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


def ensure_root_class(text: str, classes: str) -> str:
    if "coproOwnerPage" in text:
        return re.sub(
            r'className="([^"]*\bcoproOwnerPage\b[^"]*)"',
            lambda m: 'className="' + " ".join(dict.fromkeys((m.group(1) + " " + classes).split())) + '"',
            text,
            count=1,
        )

    pattern = re.compile(
        r"<(?:div|main|section)\b(?=[^>]*style=\{styles\.(stack|page|container|shell|wrapper)\})[^>]*>",
        re.S,
    )

    updated, count = pattern.subn(lambda m: add_classes_to_tag(m.group(0), classes), text, count=1)
    if count:
        return updated

    fallback = re.compile(r"<(?:div|main|section)\b(?=[^>]*style=\{styles\.[A-Za-z0-9_]+\})[^>]*>", re.S)
    updated, _ = fallback.subn(lambda m: add_classes_to_tag(m.group(0), classes), text, count=1)
    return updated


def patch_file(key: str, path: Path) -> bool:
    text = path.read_text(encoding="utf-8")
    original = text

    classes = {
        "relances": "coproOwnerPage coproOwnerRelancesPage",
        "situation": "coproOwnerPage coproOwnerSituationPage",
    }[key]

    text = ensure_root_class(text, classes)

    if text != original:
        path.write_text(text, encoding="utf-8")
        print(f"Page corrigée : {path.relative_to(ROOT)}")
        return True

    print(f"Aucun changement JSX : {path.relative_to(ROOT)}")
    return False


def append_css() -> bool:
    marker = "/* ESPACE COPROPRIÉTAIRE — RELANCES / SITUATION RESPONSIVE */"
    css = CSS_FILE.read_text(encoding="utf-8")

    if marker in css:
        print("CSS relances/situation déjà présent.")
        return False

    block = r'''
/* ESPACE COPROPRIÉTAIRE — RELANCES / SITUATION RESPONSIVE */
.coproOwnerRelancesPage,
.coproOwnerSituationPage {
  width: 100%;
  max-width: 100%;
  min-width: 0;
  overflow-x: hidden;
}

.coproOwnerRelancesPage section,
.coproOwnerRelancesPage article,
.coproOwnerRelancesPage div,
.coproOwnerSituationPage section,
.coproOwnerSituationPage article,
.coproOwnerSituationPage div {
  min-width: 0;
  max-width: 100%;
}

.coproOwnerRelancesPage h1,
.coproOwnerRelancesPage h2,
.coproOwnerRelancesPage h3,
.coproOwnerRelancesPage p,
.coproOwnerRelancesPage span,
.coproOwnerRelancesPage strong,
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
  .coproOwnerRelancesPage [style*="grid-template-columns"],
  .coproOwnerSituationPage [style*="grid-template-columns"] {
    grid-template-columns: 1fr !important;
  }

  .coproOwnerRelancesPage [style*="justify-content: space-between"],
  .coproOwnerSituationPage [style*="justify-content: space-between"],
  .coproOwnerRelancesPage [style*="display: flex"],
  .coproOwnerSituationPage [style*="display: flex"] {
    flex-direction: column !important;
    align-items: stretch !important;
    flex-wrap: nowrap !important;
  }

  .coproOwnerRelancesPage [style*="display: flex"] > *,
  .coproOwnerSituationPage [style*="display: flex"] > *,
  .coproOwnerRelancesPage [style*="display: grid"] > *,
  .coproOwnerSituationPage [style*="display: grid"] > * {
    max-width: 100% !important;
  }
}

@media (max-width: 480px) {
  .coproOwnerRelancesPage [style*="padding"],
  .coproOwnerSituationPage [style*="padding"] {
    max-width: 100% !important;
  }

  .coproOwnerRelancesPage button,
  .coproOwnerSituationPage button,
  .coproOwnerRelancesPage a,
  .coproOwnerSituationPage a {
    max-width: 100% !important;
    white-space: normal !important;
  }
}
'''

    CSS_FILE.write_text(css.rstrip() + "\n\n" + block.strip() + "\n", encoding="utf-8")
    print("CSS relances/situation ajouté.")
    return True


def main() -> None:
    changed = False

    for key, path in FILES.items():
        if not path.exists():
            raise FileNotFoundError(path)
        changed = patch_file(key, path) or changed

    changed = append_css() or changed

    if changed:
        print("\nCorrectif relances/situation appliqué.")
    else:
        print("\nAucun changement appliqué.")


if __name__ == "__main__":
    main()
