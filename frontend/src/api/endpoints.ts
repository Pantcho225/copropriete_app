export const ENDPOINTS = {
  // =========================
  // AUTH
  // =========================
  login: "/api/auth/login/",
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
  releveLigneSuggestions: (ligneId: number | string) =>
    `/api/compta/releves/lignes/${ligneId}/suggestions/`,

  // Alias optionnel pour éviter les erreurs de nommage éventuelles
  releveLigneCreerMouvement: (ligneId: number | string) =>
    `/api/compta/releves/lignes/${ligneId}/creer-mouvement/`,

  // =========================
  // COMPTA — Mouvements
  // =========================
  comptaMouvements: "/api/compta/mouvements/",
  comptaMouvementsDashboard: (seriesDays = 30) =>
    `/api/compta/mouvements/dashboard/?series_days=${seriesDays}`,

  mouvementDetail: (mouvementId: number | string) =>
    `/api/compta/mouvements/${mouvementId}/`,
  mouvementCancel: (mouvementId: number | string) =>
    `/api/compta/mouvements/${mouvementId}/cancel/`,

  // Alias pour compatibilité avec ComptaMouvements.tsx
  mouvements: "/api/compta/mouvements/",

  // =========================
  // RH
  // =========================
  rhEmployes: "/api/rh/employes/",
  rhEmployeDetail: (id: number | string) => `/api/rh/employes/${id}/`,
  rhContrats: "/api/rh/contrats/",
  rhContratDetail: (id: number | string) => `/api/rh/contrats/${id}/`,

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

  // =========================
  // RELANCES
  // =========================
  relancesDossiers: "/api/relances/dossiers/",
  relancesDossierDetail: (id: number | string) => `/api/relances/dossiers/${id}/`,
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