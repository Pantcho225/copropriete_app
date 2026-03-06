// src/api/endpoints.ts
export const ENDPOINTS = {
  // =========================
  // AUTH
  // =========================
  login: "/api/auth/login/",
  refresh: "/api/auth/refresh/",

  // =========================
  // COMPTA — Relevés / Imports
  // =========================
  importCSV: "/api/compta/releves/imports/import-csv/",
  releves: "/api/compta/releves/imports/",
  releveImports: "/api/compta/releves/imports/",

  releveImportDetail: (importId: number | string) =>
    `/api/compta/releves/imports/${importId}/`,

  lignes: (importId: number | string) =>
    `/api/compta/releves/imports/${importId}/lignes/`,

  importLignes: (importId: number | string) =>
    `/api/compta/releves/imports/${importId}/lignes/`,

  // =========================
  // COMPTA — Lignes de relevé
  // =========================
  releveLignes: "/api/compta/releves/lignes/",

  releveLigneDetail: (ligneId: number | string) =>
    `/api/compta/releves/lignes/${ligneId}/`,

  ligneDetail: (ligneId: number | string) =>
    `/api/compta/releves/lignes/${ligneId}/`,

  rapprocher: (ligneId: number | string) =>
    `/api/compta/releves/lignes/${ligneId}/rapprocher/`,

  ligneRapprocher: (ligneId: number | string) =>
    `/api/compta/releves/lignes/${ligneId}/rapprocher/`,

  suggestions: (ligneId: number | string) =>
    `/api/compta/releves/lignes/${ligneId}/suggestions/`,

  ligneSuggestions: (ligneId: number | string) =>
    `/api/compta/releves/lignes/${ligneId}/suggestions/`,

  creerMouvement: (ligneId: number | string) =>
    `/api/compta/releves/lignes/${ligneId}/creer-mouvement/`,

  ligneCreerMouvement: (ligneId: number | string) =>
    `/api/compta/releves/lignes/${ligneId}/creer-mouvement/`,

  ignorer: (ligneId: number | string) =>
    `/api/compta/releves/lignes/${ligneId}/ignorer/`,

  ignorerLigne: (ligneId: number | string) =>
    `/api/compta/releves/lignes/${ligneId}/ignorer/`,

  annuler: (ligneId: number | string) =>
    `/api/compta/releves/lignes/${ligneId}/annuler-rapprochement/`,

  annulerRapprochement: (ligneId: number | string) =>
    `/api/compta/releves/lignes/${ligneId}/annuler-rapprochement/`,

  // =========================
  // COMPTA — Mouvements / Dashboard
  // =========================
  comptaDashboard: "/api/compta/mouvements/dashboard/",
  mouvements: "/api/compta/mouvements/",

  mouvementDetail: (mouvementId: number | string) =>
    `/api/compta/mouvements/${mouvementId}/`,

  // =========================
  // COMPTA — Rapprochements
  // =========================
  rapprochements: "/api/compta/rapprochements/",
  rapprochementsStats: "/api/compta/rapprochements/stats/",

  rapprochementDetail: (rapprochementId: number | string) =>
    `/api/compta/rapprochements/${rapprochementId}/`,

  rapprochementCancel: (rapprochementId: number | string) =>
    `/api/compta/rapprochements/${rapprochementId}/cancel/`,

  // =========================
  // BILLING / TRAVAUX
  // =========================
  billingDashboard: "/api/billing/dashboard/",
  travauxStats: "/api/travaux/dossiers/stats/",
} as const;