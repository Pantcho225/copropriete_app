from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]

FILES = {
    "ag": ROOT / "frontend/src/pages/coproprietaire/CoproprietaireAssemblees.tsx",
    "documents": ROOT / "frontend/src/pages/coproprietaire/CoproprietaireDocuments.tsx",
    "textes": ROOT / "frontend/src/pages/coproprietaire/CoproprietaireReglementTextes.tsx",
}

CSS_FILE = ROOT / "frontend/src/styles/module-visual-system.css"

ROOT_CLASSES = {
    "ag": "coproOwnerPage coproOwnerAssemblyPage",
    "documents": "coproOwnerPage coproOwnerDocumentsPage",
    "textes": "coproOwnerPage coproOwnerTextsPage",
}

STYLE_CLASS_MAP = {
    "sectionHeader": "coproOwnerSectionHeader",
    "headerActions": "coproOwnerHeaderActions",
    "progressFooter": "coproOwnerProgressFooter",
    "filters": "coproOwnerFilters",
    "toolbar": "coproOwnerToolbar",
    "documentsGrid": "coproOwnerDocumentsGrid coproOwnerResponsiveGrid",
    "documentGrid": "coproOwnerDocumentsGrid coproOwnerResponsiveGrid",
    "cardsGrid": "coproOwnerDocumentsGrid coproOwnerResponsiveGrid",
    "textesGrid": "coproOwnerDocumentsGrid coproOwnerResponsiveGrid",
    "textsGrid": "coproOwnerDocumentsGrid coproOwnerResponsiveGrid",
    "actionsGrid": "coproOwnerActionGrid coproOwnerResponsiveGrid",
    "actionGrid": "coproOwnerActionGrid coproOwnerResponsiveGrid",
    "lotsGrid": "coproOwnerLotsGrid coproOwnerResponsiveGrid",
    "twoColumnGrid": "coproOwnerTwoColumnGrid coproOwnerResponsiveGrid",
    "tableWrapper": "coproOwnerTableScroll",
    "card": "coproOwnerMobileSafeCard",
    "documentCard": "coproOwnerMobileSafeCard",
    "texteCard": "coproOwnerMobileSafeCard",
    "textCard": "coproOwnerMobileSafeCard",
    "agCard": "coproOwnerMobileSafeCard",
    "assemblyCard": "coproOwnerMobileSafeCard",
    "convocationCard": "coproOwnerMobileSafeCard",
    "procurationCard": "coproOwnerMobileSafeCard",
}

BUTTON_CLASS_MAP = {
    "pvButton": "coproOwnerPremiumButton coproOwnerPremiumButton--soft",
    "mandatButton": "coproOwnerPremiumButton coproOwnerPremiumButton--primary",
    "procurationMainButton": "coproOwnerPremiumButton coproOwnerPremiumButton--primary",
    "convocationDocButton": "coproOwnerPremiumButton coproOwnerPremiumButton--soft",
    "convocationConsultButton": "coproOwnerPremiumButton coproOwnerPremiumButton--primary",
    "procurationDocButton": "coproOwnerPremiumButton coproOwnerPremiumButton--soft",
    "cancelProcurationButton": "coproOwnerPremiumButton coproOwnerPremiumButton--danger",
    "modalCloseButton": "coproOwnerPremiumButton coproOwnerPremiumButton--soft",
    "secondaryButton": "coproOwnerPremiumButton coproOwnerPremiumButton--soft",
    "primaryButton": "coproOwnerPremiumButton coproOwnerPremiumButton--primary",
    "presenceButton": "coproOwnerChoiceButton",
    "voteButton": "coproOwnerChoiceButton",
}


def add_classes_to_tag(tag: str, classes: str) -> str:
    wanted = [item for item in classes.split() if item]

    simple_match = re.search(r'className="([^"]*)"', tag)
    if simple_match:
        current = simple_match.group(1).split()
        merged = current[:]
        for item in wanted:
            if item not in merged:
                merged.append(item)
        return tag[: simple_match.start(1)] + " ".join(merged) + tag[simple_match.end(1) :]

    if "className=" in tag:
        return tag

    return re.sub(r"^<([A-Za-z][A-Za-z0-9]*)", r'<\1 className="' + classes + '"', tag, count=1)


def ensure_root_class(text: str, classes: str) -> tuple[str, bool]:
    if "coproOwnerPage" in text:
        updated = re.sub(
            r'className="([^"]*\bcoproOwnerPage\b[^"]*)"',
            lambda m: 'className="' + " ".join(dict.fromkeys((m.group(1) + " " + classes).split())) + '"',
            text,
            count=1,
        )
        return updated, updated != text

    root_style_refs = "page|stack|container|shell|wrapper"
    pattern = re.compile(
        rf"<(?:div|main|section)\b(?=[^>]*style=\{{styles\.({root_style_refs})\}})[^>]*>",
        re.S,
    )

    updated, count = pattern.subn(lambda m: add_classes_to_tag(m.group(0), classes), text, count=1)
    if count:
        return updated, True

    fallback = re.compile(r"<(?:div|main|section)\b(?=[^>]*style=\{styles\.[A-Za-z0-9_]+\})[^>]*>", re.S)
    updated, count = fallback.subn(lambda m: add_classes_to_tag(m.group(0), classes), text, count=1)
    return updated, bool(count)


def ensure_style_classes(text: str) -> str:
    for style_ref, classes in STYLE_CLASS_MAP.items():
        pattern = re.compile(
            rf"<[A-Za-z][A-Za-z0-9]*\b(?=[^>]*style=\{{styles\.{re.escape(style_ref)}\}})[^>]*>",
            re.S,
        )
        text = pattern.sub(lambda m: add_classes_to_tag(m.group(0), classes), text)
    return text


def ensure_button_classes(text: str) -> str:
    for style_ref, classes in BUTTON_CLASS_MAP.items():
        pattern = re.compile(
            rf"<button\b(?=[^>]*styles\.{re.escape(style_ref)})[^>]*>",
            re.S,
        )
        text = pattern.sub(lambda m: add_classes_to_tag(m.group(0), classes), text)
    return text


def append_css_block() -> bool:
    marker = "/* ESPACE COPROPRIÉTAIRE — FINITIONS AG / DOCUMENTS / TEXTES */"

    css_block = r'''
/* ESPACE COPROPRIÉTAIRE — FINITIONS AG / DOCUMENTS / TEXTES */
.coproOwnerAssemblyPage,
.coproOwnerDocumentsPage,
.coproOwnerTextsPage {
  width: 100%;
  max-width: 100%;
  min-width: 0;
  overflow-x: hidden;
}

.coproOwnerPage section,
.coproOwnerPage article,
.coproOwnerPage div,
.coproOwnerPage header,
.coproOwnerPage footer {
  min-width: 0;
}

.coproOwnerPage h1,
.coproOwnerPage h2,
.coproOwnerPage h3,
.coproOwnerPage h4,
.coproOwnerPage p,
.coproOwnerPage span,
.coproOwnerPage strong,
.coproOwnerPage small {
  max-width: 100%;
  overflow-wrap: anywhere;
}

.coproOwnerMobileSafeCard,
.coproOwnerResponsiveGrid {
  min-width: 0;
  max-width: 100%;
}

.coproOwnerMobileSafeCard {
  overflow: hidden;
}

.coproOwnerPremiumButton {
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  gap: 8px !important;
  max-width: 100% !important;
  min-height: 42px !important;
  border-radius: 999px !important;
  padding: 10px 16px !important;
  border: 1px solid rgba(37, 99, 235, 0.16) !important;
  font-size: 0.9rem !important;
  font-weight: 900 !important;
  line-height: 1.15 !important;
  text-align: center !important;
  white-space: normal !important;
  text-decoration: none !important;
  box-shadow: 0 14px 30px rgba(15, 23, 42, 0.12) !important;
  transition:
    transform 0.16s ease,
    box-shadow 0.16s ease,
    border-color 0.16s ease,
    background 0.16s ease !important;
}

.coproOwnerPremiumButton:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 18px 36px rgba(15, 23, 42, 0.16) !important;
}

.coproOwnerPremiumButton:disabled {
  cursor: not-allowed !important;
  opacity: 0.62 !important;
  transform: none !important;
  box-shadow: none !important;
}

.coproOwnerPremiumButton--primary {
  background: linear-gradient(135deg, #0f172a, #1d4ed8) !important;
  color: #ffffff !important;
}

.coproOwnerPremiumButton--soft {
  background: rgba(255, 255, 255, 0.94) !important;
  color: #0f172a !important;
}

.coproOwnerPremiumButton--danger {
  background: rgba(254, 242, 242, 0.96) !important;
  color: #991b1b !important;
  border-color: rgba(239, 68, 68, 0.26) !important;
}

.coproOwnerChoiceButton {
  max-width: 100% !important;
  min-width: 0 !important;
  white-space: normal !important;
  text-align: center !important;
  justify-content: center !important;
}

@media (max-width: 900px) {
  .coproOwnerAssemblyPage,
  .coproOwnerDocumentsPage,
  .coproOwnerTextsPage {
    display: flex !important;
    flex-direction: column !important;
    gap: 18px !important;
  }

  .coproOwnerPage [style*="grid-template-columns"] {
    min-width: 0 !important;
  }

  .coproOwnerPage [style*="display: flex"] {
    min-width: 0 !important;
    flex-wrap: wrap !important;
  }
}

@media (max-width: 760px) {
  .coproOwnerAssemblyPage,
  .coproOwnerDocumentsPage,
  .coproOwnerTextsPage {
    gap: 16px !important;
  }

  .coproOwnerPage [style*="display: grid"],
  .coproOwnerPage [style*="grid-template-columns"],
  .coproOwnerResponsiveGrid,
  .coproOwnerDocumentsGrid,
  .coproOwnerActionGrid {
    grid-template-columns: 1fr !important;
  }

  .coproOwnerPage [style*="display: flex"],
  .coproOwnerSectionHeader,
  .coproOwnerHeaderActions {
    align-items: stretch !important;
  }

  .coproOwnerHeaderActions,
  .coproOwnerActionGrid {
    width: 100% !important;
  }

  .coproOwnerPremiumButton,
  .coproOwnerChoiceButton {
    width: 100% !important;
  }
}

@media (max-width: 480px) {
  .coproOwnerAssemblyPage,
  .coproOwnerDocumentsPage,
  .coproOwnerTextsPage {
    gap: 14px !important;
  }

  .coproOwnerPage [style*="padding"] {
    max-width: 100% !important;
  }

  .coproOwnerPremiumButton {
    min-height: 44px !important;
    padding: 11px 14px !important;
    font-size: 0.86rem !important;
  }

  .coproOwnerChoiceButton {
    min-height: 40px !important;
  }
}
'''

    content = CSS_FILE.read_text(encoding="utf-8")
    if marker in content:
        print("CSS déjà présent : module-visual-system.css")
        return False

    CSS_FILE.write_text(content.rstrip() + "\n\n" + css_block.strip() + "\n", encoding="utf-8")
    print("CSS ajouté : module-visual-system.css")
    return True


def patch_file(key: str, path: Path) -> bool:
    original = path.read_text(encoding="utf-8")
    text = original

    text, root_ok = ensure_root_class(text, ROOT_CLASSES[key])
    text = ensure_style_classes(text)
    text = ensure_button_classes(text)

    if text != original:
        path.write_text(text, encoding="utf-8")
        print(f"Modifié : {path.relative_to(ROOT)}")
        if not root_ok:
            print(f"  Attention : classe racine non confirmée pour {path.name}")
        return True

    print(f"Aucun changement : {path.relative_to(ROOT)}")
    return False


def main() -> None:
    changed = False

    for key, path in FILES.items():
        if not path.exists():
            raise FileNotFoundError(path)
        changed = patch_file(key, path) or changed

    changed = append_css_block() or changed

    if changed:
        print("\nCorrectif appliqué. Lance maintenant lint/build puis recette responsive.")
    else:
        print("\nAucun changement appliqué.")


if __name__ == "__main__":
    main()
