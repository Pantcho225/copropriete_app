from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
css_path = ROOT / "frontend/src/styles/module-visual-system.css"

marker = "/* SOCLE RESPONSIVE GLOBAL — ANTI-CHEVAUCHEMENT */"

block = r'''
/* SOCLE RESPONSIVE GLOBAL — ANTI-CHEVAUCHEMENT */
.adminContentSurface,
.modulePage,
.moduleHero,
.moduleSection,
.moduleCard,
.moduleStatsGrid,
.adminHarmonizedPage,
.coproOwnerPage {
  min-width: 0;
  max-width: 100%;
  overflow-wrap: anywhere;
}

.adminContentSurface *,
.modulePage *,
.moduleHero *,
.moduleSection *,
.moduleCard *,
.adminHarmonizedPage *,
.coproOwnerPage * {
  box-sizing: border-box;
}

.adminContentSurface section,
.adminContentSurface article,
.adminContentSurface div,
.adminContentSurface form,
.adminContentSurface header,
.adminContentSurface footer,
.modulePage section,
.modulePage article,
.modulePage div,
.modulePage form,
.adminHarmonizedPage section,
.adminHarmonizedPage article,
.adminHarmonizedPage div,
.adminHarmonizedPage form,
.coproOwnerPage section,
.coproOwnerPage article,
.coproOwnerPage div,
.coproOwnerPage form {
  min-width: 0;
  max-width: 100%;
}

.adminContentSurface h1,
.adminContentSurface h2,
.adminContentSurface h3,
.adminContentSurface h4,
.adminContentSurface p,
.adminContentSurface span,
.adminContentSurface strong,
.adminContentSurface small,
.adminContentSurface label,
.modulePage h1,
.modulePage h2,
.modulePage h3,
.modulePage h4,
.modulePage p,
.modulePage span,
.modulePage strong,
.modulePage small,
.modulePage label,
.adminHarmonizedPage h1,
.adminHarmonizedPage h2,
.adminHarmonizedPage h3,
.adminHarmonizedPage h4,
.adminHarmonizedPage p,
.adminHarmonizedPage span,
.adminHarmonizedPage strong,
.adminHarmonizedPage small,
.adminHarmonizedPage label,
.coproOwnerPage h1,
.coproOwnerPage h2,
.coproOwnerPage h3,
.coproOwnerPage h4,
.coproOwnerPage p,
.coproOwnerPage span,
.coproOwnerPage strong,
.coproOwnerPage small,
.coproOwnerPage label {
  max-width: 100%;
  overflow-wrap: anywhere;
}

.adminContentSurface img,
.adminContentSurface video,
.adminContentSurface canvas,
.modulePage img,
.modulePage video,
.modulePage canvas,
.adminHarmonizedPage img,
.adminHarmonizedPage video,
.adminHarmonizedPage canvas,
.coproOwnerPage img,
.coproOwnerPage video,
.coproOwnerPage canvas {
  max-width: 100%;
  height: auto;
}

.adminContentSurface input,
.adminContentSurface select,
.adminContentSurface textarea,
.modulePage input,
.modulePage select,
.modulePage textarea,
.adminHarmonizedPage input,
.adminHarmonizedPage select,
.adminHarmonizedPage textarea,
.coproOwnerPage input,
.coproOwnerPage select,
.coproOwnerPage textarea {
  max-width: 100%;
  min-width: 0;
}

.adminContentSurface table,
.modulePage table,
.adminHarmonizedPage table,
.coproOwnerPage table {
  max-width: 100%;
  border-collapse: collapse;
}

.adminContentSurface [style*="overflowX: auto"],
.adminContentSurface [style*="overflow-x: auto"],
.modulePage [style*="overflowX: auto"],
.modulePage [style*="overflow-x: auto"],
.adminHarmonizedPage [style*="overflowX: auto"],
.adminHarmonizedPage [style*="overflow-x: auto"],
.coproOwnerPage [style*="overflowX: auto"],
.coproOwnerPage [style*="overflow-x: auto"] {
  max-width: 100%;
  -webkit-overflow-scrolling: touch;
}

@media (max-width: 900px) {
  .adminContentSurface [style*="grid-template-columns"],
  .modulePage [style*="grid-template-columns"],
  .adminHarmonizedPage [style*="grid-template-columns"],
  .coproOwnerPage [style*="grid-template-columns"] {
    min-width: 0 !important;
  }

  .adminContentSurface [style*="display: flex"],
  .modulePage [style*="display: flex"],
  .adminHarmonizedPage [style*="display: flex"],
  .coproOwnerPage [style*="display: flex"] {
    min-width: 0 !important;
    flex-wrap: wrap !important;
  }
}

@media (max-width: 760px) {
  .adminContentSurface [style*="grid-template-columns"],
  .modulePage [style*="grid-template-columns"],
  .adminHarmonizedPage [style*="grid-template-columns"],
  .coproOwnerPage [style*="grid-template-columns"],
  .moduleStatsGrid,
  .adminHarmonizedStatsGrid,
  .adminHarmonizedCardGrid,
  .adminHarmonizedFeatureGrid,
  .coproOwnerStatsGrid,
  .coproOwnerDocumentsGrid,
  .coproOwnerActionGrid {
    grid-template-columns: 1fr !important;
  }

  .adminContentSurface [style*="white-space: nowrap"],
  .modulePage [style*="white-space: nowrap"],
  .adminHarmonizedPage [style*="white-space: nowrap"],
  .coproOwnerPage [style*="white-space: nowrap"] {
    white-space: normal !important;
  }

  .adminContentSurface button,
  .adminContentSurface a,
  .modulePage button,
  .modulePage a,
  .adminHarmonizedPage button,
  .adminHarmonizedPage a,
  .coproOwnerPage button,
  .coproOwnerPage a {
    max-width: 100%;
  }

  .adminContentSurface [style*="min-width"],
  .modulePage [style*="min-width"],
  .adminHarmonizedPage [style*="min-width"],
  .coproOwnerPage [style*="min-width"] {
    min-width: 0 !important;
  }
}

@media (max-width: 480px) {
  .adminContentSurface {
    padding: 14px !important;
  }

  .adminContentSurface [style*="padding"],
  .modulePage [style*="padding"],
  .adminHarmonizedPage [style*="padding"],
  .coproOwnerPage [style*="padding"] {
    max-width: 100% !important;
  }

  .adminContentSurface button,
  .modulePage button,
  .adminHarmonizedPage button,
  .coproOwnerPage button {
    white-space: normal !important;
  }
}
'''

css = css_path.read_text(encoding="utf-8")

if marker in css:
    print("Socle responsive global déjà présent.")
else:
    css_path.write_text(css.rstrip() + "\n\n" + block.strip() + "\n", encoding="utf-8")
    print("Socle responsive global ajouté.")
