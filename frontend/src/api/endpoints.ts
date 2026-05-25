// src/api/endpoints.ts

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8002";

export const ENDPOINTS = {
  // =========================
  // AUTH
  // =========================
  login: "/api/auth/login/",
  token: "/api/auth/login/",
  refresh: "/api/auth/refresh/",

  // =========================
  // COMPTA — Imports / relevés
  // =========================
  importCSV: "/api/compta/releves/imports/import-csv/",
  releveImports: "/api/compta/releves/imports/",
  releveImportDetail: (importId: number | string) =>
    `/api/compta/releves/imports/${importId}/`,
  releveImportLignes: (importId: number | string) =>
    `/api/compta/releves/imports/${importId}/lignes/`,

  // Anciens alias utilisés par src/features/compta/ImportDetailPage.tsx
  importLignes: (importId: number | string) =>
    `/api/compta/releves/imports/${importId}/lignes/`,
  lignes: (importId: number | string) =>
    `/api/compta/releves/imports/${importId}/lignes/`,

  // =========================
  // COMPTA — Lignes
  // =========================
  releveLignes: "/api/compta/releves/lignes/",
  releveLigneDetail: (ligneId: number | string) =>
    `/api/compta/releves/lignes/${ligneId}/`,
  releveLigneRapprocher: (ligneId: number | string) =>
    `/api/compta/releves/lignes/${ligneId}/rapprocher/`,
  releveLigneAnnulerRapprochement: (ligneId: number | string) =>
    `/api/compta/releves/lignes/${ligneId}/annuler-rapprochement/`,
  releveLigneIgnorer: (ligneId: number | string) =>
    `/api/compta/releves/lignes/${ligneId}/ignorer/`,
  releveLigneCreateMouvement: (ligneId: number | string) =>
    `/api/compta/releves/lignes/${ligneId}/creer-mouvement/`,
  releveLigneCreerMouvement: (ligneId: number | string) =>
    `/api/compta/releves/lignes/${ligneId}/creer-mouvement/`,
  releveLigneSuggestions: (ligneId: number | string) =>
    `/api/compta/releves/lignes/${ligneId}/suggestions/`,

  // =========================
  // COMPTA — Mouvements
  // =========================
  comptaMouvements: "/api/compta/mouvements/",
  mouvements: "/api/compta/mouvements/",
  comptaMouvementsDashboard: (seriesDays = 30) =>
    `/api/compta/mouvements/dashboard/?series_days=${seriesDays}`,
  mouvementDetail: (mouvementId: number | string) =>
    `/api/compta/mouvements/${mouvementId}/`,
  mouvementCancel: (mouvementId: number | string) =>
    `/api/compta/mouvements/${mouvementId}/cancel/`,

  // Ancien objet utilisé par src/features/compta/RapproStatsPage.tsx
  compta: {
    rapprochements: "/api/compta/rapprochements/",
    rapproStats: "/api/compta/mouvements/dashboard/",
    mouvements: "/api/compta/mouvements/",
    releves: "/api/compta/releves/",
    imports: "/api/compta/releves/imports/",
    lignes: "/api/compta/releves/lignes/",
  },

  // =========================
  // RH — Employés
  // =========================
  rhEmployes: "/api/rh/employes/",
  rhEmployeDetail: (id: number | string) => `/api/rh/employes/${id}/`,
  rhEmployeActiver: (id: number | string) => `/api/rh/employes/${id}/activer/`,
  rhEmployeDesactiver: (id: number | string) =>
    `/api/rh/employes/${id}/desactiver/`,

  // =========================
  // RH — Contrats
  // =========================
  rhContrats: "/api/rh/contrats/",
  rhContratDetail: (id: number | string) => `/api/rh/contrats/${id}/`,
  rhContratActiver: (id: number | string) => `/api/rh/contrats/${id}/activer/`,
  rhContratCloturer: (id: number | string) => `/api/rh/contrats/${id}/cloturer/`,

  // =========================
  // LOTS
  // =========================
  lots: "/api/lots/",
  lotDetail: (id: number | string) => `/api/lots/${id}/`,
  tantiemeCategories: "/api/tantieme-categories/",
  lotTantiemes: "/api/lot-tantiemes/",

  // =========================
  // TRAVAUX
  // =========================
  travauxDossiers: "/api/travaux/dossiers/",
  travauxDossierDetail: (id: number | string) => `/api/travaux/dossiers/${id}/`,
  travauxDossiersStats: "/api/travaux/dossiers/stats/",
  travauxFournisseurs: "/api/travaux/fournisseurs/",
  travauxFournisseurDetail: (id: number | string) =>
    `/api/travaux/fournisseurs/${id}/`,

  // =========================
  // AG
  // =========================
  ags: "/api/ag/ags/",
  agDetail: (id: number | string) => `/api/ag/ags/${id}/`,
  agResolutions: "/api/ag/resolutions/",
  agResolutionDetail: (id: number | string) => `/api/ag/resolutions/${id}/`,
  agPresences: (agId: number | string) => `/api/ag/ags/${agId}/presences/`,
  agVotes: (agId: number | string) => `/api/ag/ags/${agId}/votes/`,
  agPv: (agId: number | string) => `/api/ag/ags/${agId}/pv/`,
  agPvArchive: (agId: number | string) => `/api/ag/ags/${agId}/pv/archive/`,
  agPvSign: (agId: number | string) => `/api/ag/ags/${agId}/pv/sign/`,
  agPvLock: (agId: number | string) => `/api/ag/ags/${agId}/pv/lock/`,
  agClose: (agId: number | string) => `/api/ag/ags/${agId}/close/`,
  agInitPresences: (agId: number | string) =>
    `/api/ag/ags/${agId}/init-presences/`,

  // =========================
  // RELANCES
  // =========================
  relancesDossiers: "/api/relances/dossiers/",
  relancesDossierDetail: (id: number | string) =>
    `/api/relances/dossiers/${id}/`,
  relancesDossiersStats: "/api/relances/dossiers/stats/",
  relancesHistorique: "/api/relances/relances/",
  relanceDetail: (id: number | string) => `/api/relances/relances/${id}/`,
  relancesAvis: "/api/relances/avis/",
  relanceEnvoyer: (dossierId: number | string) =>
    `/api/relances/dossiers/${dossierId}/envoyer-relance/`,
  relanceGenererAvis: (dossierId: number | string) =>
    `/api/relances/dossiers/${dossierId}/generer-avis-regularisation/`,

  // =========================
  // BILLING
  // =========================
  billingDashboard: "/api/billing/dashboard/",

  // =========================
  // PLATFORM
  // =========================
  platformAdminHome: "/api/platform-admin/",
} as const;