from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]

FILES = {
    "reunions": ROOT / "frontend/src/pages/administration/ReunionsRencontres.tsx",
    "reglement": ROOT / "frontend/src/pages/administration/ReglementTextesApplicables.tsx",
    "documents": ROOT / "frontend/src/pages/administration/DocumentsAdministratifs.tsx",
    "ag_form": ROOT / "frontend/src/pages/ag/AGForm.tsx",
    "billing_home": ROOT / "frontend/src/pages/billing/BillingHome.tsx",
    "billing_factures": ROOT / "frontend/src/pages/billing/BillingFactures.tsx",
}

CSS_FILE = ROOT / "frontend/src/styles/module-visual-system.css"


def add_class_to_tag(tag: str, classes: str) -> str:
    if "className=" in tag:
        match = re.search(r'className="([^"]*)"', tag)
        if not match:
            return tag

        current = match.group(1).split()
        merged = current[:]
        for item in classes.split():
            if item not in merged:
                merged.append(item)

        return tag[: match.start(1)] + " ".join(merged) + tag[match.end(1) :]

    return re.sub(
        r"^<([A-Za-z][A-Za-z0-9]*)",
        r'<\1 className="' + classes + '"',
        tag,
        count=1,
    )


def add_class_by_style(text: str, style_expr: str, classes: str) -> str:
    pattern = re.compile(
        rf"<[A-Za-z][A-Za-z0-9]*\b(?=[^>]*style=\{{{re.escape(style_expr)}\}})[^>]*>",
        re.S,
    )
    return pattern.sub(lambda m: add_class_to_tag(m.group(0), classes), text)


def add_class_by_inline_style_name(text: str, style_name: str, classes: str) -> str:
    pattern = re.compile(
        rf"<[A-Za-z][A-Za-z0-9]*\b(?=[^>]*style=\{{{re.escape(style_name)}\}})[^>]*>",
        re.S,
    )
    return pattern.sub(lambda m: add_class_to_tag(m.group(0), classes), text)


def add_class_by_tag_style_fragment(text: str, tag_name: str, style_fragment: str, classes: str) -> str:
    pattern = re.compile(
        rf"<{tag_name}\b(?=[^>]*{re.escape(style_fragment)})[^>]*>",
        re.S,
    )
    return pattern.sub(lambda m: add_class_to_tag(m.group(0), classes), text)


def patch_reunions(text: str) -> str:
    replacements = {
        "styles.page": "adminHarmonizedPage adminMeetingsPage",
        "styles.hero": "adminHarmonizedHero adminHarmonizedHero--cyan",
        "styles.notice": "adminHarmonizedNotice",
        "styles.kpiGrid": "adminHarmonizedStatsGrid",
        "styles.kpiCard": "adminHarmonizedStatCard",
        "styles.grid": "adminHarmonizedCardGrid",
        "styles.card": "adminHarmonizedCard",
        "styles.twoColumns": "adminHarmonizedTwoColumns",
        "styles.panel": "adminHarmonizedPanel",
        "styles.panelSoft": "adminHarmonizedPanel adminHarmonizedPanel--soft",
    }

    for style_expr, classes in replacements.items():
        text = add_class_by_style(text, style_expr, classes)

    return text


def patch_reglement(text: str) -> str:
    replacements = {
        "styles.page": "adminHarmonizedPage adminReglementPage",
        "styles.hero": "adminHarmonizedHero adminHarmonizedHero--amber",
        "styles.heroActions": "adminHarmonizedHeaderActions",
        "styles.heroCard": "adminHarmonizedHeroMetric",
        "styles.statsGrid": "adminHarmonizedStatsGrid",
        "styles.formPanel": "adminHarmonizedPanel adminHarmonizedFormPanel",
        "styles.sectionHeader": "adminHarmonizedSectionHeader",
        "styles.form": "adminHarmonizedForm",
        "styles.formGrid": "adminHarmonizedFormGrid",
        "styles.formActions": "adminHarmonizedFormActions",
        "styles.filtersPanel": "adminHarmonizedPanel adminHarmonizedFiltersPanel",
        "styles.filtersGrid": "adminHarmonizedFiltersGrid",
        "styles.listPanel": "adminHarmonizedPanel",
        "styles.itemsList": "adminHarmonizedItemsList",
        "styles.itemCard": "adminHarmonizedItemCard",
        "styles.itemHeader": "adminHarmonizedItemHeader",
        "styles.badges": "adminHarmonizedBadges",
        "styles.itemActions": "adminHarmonizedItemActions",
        "styles.warningPanel": "adminHarmonizedNotice adminHarmonizedNotice--warning",
    }

    for style_expr, classes in replacements.items():
        text = add_class_by_style(text, style_expr, classes)

    button_styles = {
        "styles.primaryButton": "adminHarmonizedButton adminHarmonizedButton--primary",
        "styles.secondaryButton": "adminHarmonizedButton adminHarmonizedButton--soft",
        "styles.lightButton": "adminHarmonizedButton adminHarmonizedButton--soft",
        "styles.successButton": "adminHarmonizedButton adminHarmonizedButton--success",
        "styles.dangerButton": "adminHarmonizedButton adminHarmonizedButton--danger",
    }

    for style_expr, classes in button_styles.items():
        text = add_class_by_tag_style_fragment(text, "button", f"style={{{style_expr}}}", classes)

    return text


def patch_documents(text: str) -> str:
    replacements = {
        "page": "adminHarmonizedPage adminDocumentsPage",
        "hero": "adminHarmonizedHero adminHarmonizedHero--violet",
        "panel": "adminHarmonizedPanel",
        "grid": "adminHarmonizedBadgeGrid",
        "documentBadge": "adminHarmonizedBadge",
        "emptyState": "adminHarmonizedEmptyState",
    }

    for style_name, classes in replacements.items():
        text = add_class_by_inline_style_name(text, style_name, classes)

    return text


def patch_ag_form(text: str) -> str:
    text = re.sub(
        r"return <div style=\{([^}]+)\}>\{children\}</div>;",
        r'return <div className="adminHarmonizedPage adminAgFormPage" style={\1}>{children}</div>;',
        text,
        count=1,
    )

    text = add_class_by_inline_style_name(text, "heroCard", "adminHarmonizedHero adminHarmonizedHero--slate")
    text = add_class_by_inline_style_name(text, "heroActions", "adminHarmonizedHeaderActions")
    text = add_class_by_inline_style_name(text, "card", "adminHarmonizedPanel adminHarmonizedFormPanel")
    text = add_class_by_inline_style_name(text, "grid2", "adminHarmonizedFormGrid")
    text = add_class_by_inline_style_name(text, "requiredInfo", "adminHarmonizedNotice adminHarmonizedNotice--warning")
    text = add_class_by_inline_style_name(text, "ghostLink", "adminHarmonizedButton adminHarmonizedButton--soft")

    button_styles = {
        "primaryButton": "adminHarmonizedButton adminHarmonizedButton--primary",
        "secondaryButton": "adminHarmonizedButton adminHarmonizedButton--soft",
    }

    for style_name, classes in button_styles.items():
        text = add_class_by_tag_style_fragment(text, "button", f"style={{{style_name}}}", classes)

    return text


def patch_billing_home(text: str) -> str:
    text = re.sub(
        r"return <div style=\{([^}]+)\}>\{children\}</div>;",
        r'return <div className="adminHarmonizedPage adminBillingPage" style={\1}>{children}</div>;',
        text,
        count=1,
    )

    text = add_class_by_inline_style_name(text, "heroCard", "adminHarmonizedHero adminHarmonizedHero--blue")
    text = add_class_by_inline_style_name(text, "heroActions", "adminHarmonizedHeaderActions")
    text = add_class_by_inline_style_name(text, "card", "adminHarmonizedCard")
    text = add_class_by_inline_style_name(text, "panel", "adminHarmonizedPanel")

    text = text.replace(
        '<div className="billing-home-stat-grid">',
        '<div className="billing-home-stat-grid adminHarmonizedStatsGrid">',
    )

    text = text.replace(
        '<div className="billing-home-quick-grid">',
        '<div className="billing-home-quick-grid adminHarmonizedCardGrid">',
    )

    text = add_class_by_tag_style_fragment(
        text,
        "button",
        "style={{",
        "adminHarmonizedButton adminHarmonizedButton--soft",
    )

    return text


def patch_billing_factures(text: str) -> str:
    text = re.sub(
        r"return <div style=\{pageStyle\}>\{children\}</div>;",
        r'return <div className="adminHarmonizedPage adminBillingFacturesPage" style={pageStyle}>{children}</div>;',
        text,
        count=1,
    )

    text = add_class_by_inline_style_name(text, "heroCard", "adminHarmonizedHero adminHarmonizedHero--blue")
    text = add_class_by_inline_style_name(text, "heroActions", "adminHarmonizedHeaderActions")
    text = add_class_by_inline_style_name(text, "grid", "adminHarmonizedStatsGrid billing-factures-grid")
    text = add_class_by_inline_style_name(text, "panel", "adminHarmonizedPanel")
    text = add_class_by_inline_style_name(text, "featureGrid", "adminHarmonizedFeatureGrid")

    text = add_class_by_tag_style_fragment(
        text,
        "button",
        "style={{",
        "adminHarmonizedButton adminHarmonizedButton--soft",
    )

    return text


PATCHERS = {
    "reunions": patch_reunions,
    "reglement": patch_reglement,
    "documents": patch_documents,
    "ag_form": patch_ag_form,
    "billing_home": patch_billing_home,
    "billing_factures": patch_billing_factures,
}


def append_css() -> bool:
    marker = "/* ADMIN — HARMONISATION DOCUMENTS TEXTES RÉUNIONS FACTURATION */"
    css = CSS_FILE.read_text(encoding="utf-8")

    if marker in css:
        print("CSS admin déjà présent.")
        return False

    block = r'''
/* ADMIN — HARMONISATION DOCUMENTS TEXTES RÉUNIONS FACTURATION */
.adminHarmonizedPage {
  width: 100%;
  min-width: 0;
  max-width: 100%;
  display: grid;
  gap: 24px;
  overflow-x: hidden;
}

.adminHarmonizedPage *,
.adminHarmonizedPage *::before,
.adminHarmonizedPage *::after {
  box-sizing: border-box;
}

.adminHarmonizedPage section,
.adminHarmonizedPage article,
.adminHarmonizedPage div,
.adminHarmonizedPage form,
.adminHarmonizedPage header,
.adminHarmonizedPage footer {
  min-width: 0;
}

.adminHarmonizedPage h1,
.adminHarmonizedPage h2,
.adminHarmonizedPage h3,
.adminHarmonizedPage p,
.adminHarmonizedPage span,
.adminHarmonizedPage strong,
.adminHarmonizedPage small,
.adminHarmonizedPage label {
  max-width: 100%;
  overflow-wrap: anywhere;
}

.adminHarmonizedHero {
  position: relative;
  overflow: hidden;
  min-width: 0;
  max-width: 100%;
  border-radius: 28px !important;
  border: 1px solid rgba(226, 232, 240, 0.95) !important;
  box-shadow: 0 20px 55px rgba(15, 23, 42, 0.08) !important;
}

.adminHarmonizedHero--cyan {
  background: linear-gradient(135deg, #ecfeff 0%, #f8fafc 58%, #ffffff 100%) !important;
}

.adminHarmonizedHero--amber {
  background: linear-gradient(135deg, #fff7ed 0%, #f8fafc 58%, #ffffff 100%) !important;
}

.adminHarmonizedHero--violet {
  background: linear-gradient(135deg, #f5f3ff 0%, #f8fafc 58%, #ffffff 100%) !important;
}

.adminHarmonizedHero--blue {
  background: linear-gradient(135deg, #eff6ff 0%, #f8fafc 58%, #ffffff 100%) !important;
}

.adminHarmonizedHero--slate {
  background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%) !important;
}

.adminHarmonizedHeaderActions,
.adminHarmonizedFormActions,
.adminHarmonizedItemActions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  align-items: center;
}

.adminHarmonizedStatsGrid,
.adminHarmonizedCardGrid,
.adminHarmonizedFeatureGrid {
  min-width: 0;
  max-width: 100%;
}

.adminHarmonizedCard,
.adminHarmonizedStatCard,
.adminHarmonizedPanel,
.adminHarmonizedItemCard,
.adminHarmonizedHeroMetric,
.adminHarmonizedEmptyState,
.adminHarmonizedNotice {
  min-width: 0;
  max-width: 100%;
  border-radius: 22px !important;
  box-shadow: 0 16px 36px rgba(15, 23, 42, 0.06) !important;
}

.adminHarmonizedPanel {
  border: 1px solid rgba(226, 232, 240, 0.95) !important;
  background: rgba(255, 255, 255, 0.96) !important;
}

.adminHarmonizedPanel--soft {
  background: linear-gradient(135deg, #f8fafc, #ffffff) !important;
}

.adminHarmonizedNotice {
  border: 1px solid rgba(14, 165, 233, 0.24) !important;
  background: rgba(240, 249, 255, 0.82) !important;
}

.adminHarmonizedNotice--warning {
  border-color: rgba(245, 158, 11, 0.34) !important;
  background: rgba(255, 251, 235, 0.82) !important;
}

.adminHarmonizedBadgeGrid {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.adminHarmonizedBadge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 38px;
  max-width: 100%;
  white-space: normal;
  text-align: center;
}

.adminHarmonizedButton {
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  gap: 8px !important;
  min-height: 40px !important;
  max-width: 100% !important;
  border-radius: 999px !important;
  padding: 10px 16px !important;
  font-size: 0.9rem !important;
  font-weight: 900 !important;
  line-height: 1.15 !important;
  white-space: normal !important;
  text-align: center !important;
  text-decoration: none !important;
  box-shadow: 0 12px 28px rgba(15, 23, 42, 0.10) !important;
}

.adminHarmonizedButton--primary {
  background: linear-gradient(135deg, #1d4ed8, #3730a3) !important;
  border: 1px solid rgba(99, 102, 241, 0.34) !important;
  color: #ffffff !important;
}

.adminHarmonizedButton--soft {
  background: rgba(255, 255, 255, 0.96) !important;
  border: 1px solid rgba(203, 213, 225, 0.95) !important;
  color: #0f172a !important;
}

.adminHarmonizedButton--success {
  background: linear-gradient(135deg, #047857, #059669) !important;
  border: 1px solid rgba(16, 185, 129, 0.34) !important;
  color: #ffffff !important;
}

.adminHarmonizedButton--danger {
  background: rgba(254, 242, 242, 0.98) !important;
  border: 1px solid rgba(248, 113, 113, 0.34) !important;
  color: #991b1b !important;
}

.adminHarmonizedButton:disabled {
  cursor: not-allowed !important;
  opacity: 0.6 !important;
  box-shadow: none !important;
}

.adminHarmonizedFormGrid,
.adminHarmonizedFiltersGrid,
.adminHarmonizedTwoColumns {
  min-width: 0;
  max-width: 100%;
}

.adminHarmonizedForm input,
.adminHarmonizedForm select,
.adminHarmonizedForm textarea,
.adminHarmonizedFiltersPanel input,
.adminHarmonizedFiltersPanel select,
.adminHarmonizedFiltersPanel textarea {
  min-width: 0;
  max-width: 100%;
}

.adminHarmonizedItemsList {
  display: grid;
  gap: 12px;
}

.adminHarmonizedItemHeader,
.adminHarmonizedBadges {
  min-width: 0;
  max-width: 100%;
  flex-wrap: wrap;
}

@media (max-width: 1200px) {
  .adminHarmonizedStatsGrid,
  .adminHarmonizedCardGrid,
  .adminHarmonizedFeatureGrid {
    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
  }

  .adminHarmonizedHero {
    grid-template-columns: 1fr !important;
  }
}

@media (max-width: 900px) {
  .adminHarmonizedPage {
    gap: 18px;
  }

  .adminHarmonizedHero,
  .adminHarmonizedPanel,
  .adminHarmonizedFormPanel,
  .adminHarmonizedFiltersPanel {
    padding: 20px !important;
  }

  .adminHarmonizedFormGrid,
  .adminHarmonizedFiltersGrid,
  .adminHarmonizedTwoColumns {
    grid-template-columns: 1fr !important;
  }

  .adminHarmonizedHeaderActions,
  .adminHarmonizedFormActions,
  .adminHarmonizedItemActions {
    width: 100%;
    align-items: stretch;
  }
}

@media (max-width: 760px) {
  .adminHarmonizedStatsGrid,
  .adminHarmonizedCardGrid,
  .adminHarmonizedFeatureGrid,
  .adminHarmonizedFormGrid,
  .adminHarmonizedFiltersGrid,
  .adminHarmonizedTwoColumns,
  .adminHarmonizedPage [style*="grid-template-columns"] {
    grid-template-columns: 1fr !important;
  }

  .adminHarmonizedPage [style*="display: flex"] {
    flex-wrap: wrap !important;
  }

  .adminHarmonizedHeaderActions > *,
  .adminHarmonizedFormActions > *,
  .adminHarmonizedItemActions > *,
  .adminHarmonizedButton {
    width: 100% !important;
  }
}

@media (max-width: 480px) {
  .adminHarmonizedPage {
    gap: 14px;
  }

  .adminHarmonizedHero,
  .adminHarmonizedPanel,
  .adminHarmonizedFormPanel,
  .adminHarmonizedFiltersPanel,
  .adminHarmonizedEmptyState {
    padding: 16px !important;
    border-radius: 20px !important;
  }

  .adminHarmonizedButton {
    min-height: 42px !important;
    padding: 10px 13px !important;
    font-size: 0.84rem !important;
  }
}
'''

    CSS_FILE.write_text(css.rstrip() + "\n\n" + block.strip() + "\n", encoding="utf-8")
    print("CSS admin ajouté.")
    return True


def main() -> None:
    changed = False

    for key, path in FILES.items():
        text = path.read_text(encoding="utf-8")
        patched = PATCHERS[key](text)

        if patched != text:
            path.write_text(patched, encoding="utf-8")
            print(f"Modifié : {path.relative_to(ROOT)}")
            changed = True
        else:
            print(f"Aucun changement JSX : {path.relative_to(ROOT)}")

    changed = append_css() or changed

    if changed:
        print("\nCorrectif admin appliqué. Lance lint/build/check puis recette visuelle.")
    else:
        print("\nAucun changement appliqué.")


if __name__ == "__main__":
    main()
