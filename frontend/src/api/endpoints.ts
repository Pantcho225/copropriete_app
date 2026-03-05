// src/api/endpoints.ts
export const ENDPOINTS = {
  // =========================
  // AUTH
  // =========================
  login: "/api/auth/login/",
  refresh: "/api/auth/refresh/",

  // =========================
  // COMPTA — Imports / Lignes
  // =========================
  importCSV: "/api/compta/releves/imports/import-csv/",
  releves: "/api/compta/releves/imports/",
  lignes: (importId: number | string) =>
    `/api/compta/releves/imports/${importId}/lignes/`,

  // ✅ AJOUTS UTILES : liste/détail global des lignes
  releveLignes: "/api/compta/releves/lignes/",
  releveLigneDetail: (ligneId: number | string) =>
    `/api/compta/releves/lignes/${ligneId}/`,

  // Lignes de relevé : actions
  rapprocher: (ligneId: number | string) =>
    `/api/compta/releves/lignes/${ligneId}/rapprocher/`,

  // ✅ FIX 404 : l’endpoint backend existant est "annuler-rapprochement"
  annuler: (ligneId: number | string) =>
    `/api/compta/releves/lignes/${ligneId}/annuler-rapprochement/`,

  suggestions: (ligneId: number | string) =>
    `/api/compta/releves/lignes/${ligneId}/suggestions/`,
  creerMouvement: (ligneId: number | string) =>
    `/api/compta/releves/lignes/${ligneId}/creer-mouvement/`,

  // =========================
  // COMPTA — Mouvements / Dashboard
  // =========================
  comptaDashboard: "/api/compta/mouvements/dashboard/",
  mouvements: "/api/compta/mouvements/",
  mouvementDetail: (mouvementId: number | string) =>
    `/api/compta/mouvements/${mouvementId}/`,

  // =========================
  // COMPTA — Audit Rapprochements
  // =========================
  rapprochements: "/api/compta/rapprochements/",
  rapprochementsStats: "/api/compta/rapprochements/stats/",
  rapprochementCancel: (rapprochementId: number | string) =>
    `/api/compta/rapprochements/${rapprochementId}/cancel/`,

  // =========================
  // BILLING / TRAVAUX (pour Dashboard)
  // =========================
  billingDashboard: "/api/billing/dashboard/",
  travauxStats: "/api/travaux/dossiers/stats/",
} as const;