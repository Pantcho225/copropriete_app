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
  releveImports: "/api/compta/releves/imports/",
  importCSV: "/api/compta/releves/imports/import-csv/",

  releveImportDetail: (importId: number | string) =>
    `/api/compta/releves/imports/${importId}/`,

  releveImportLignes: (importId: number | string) =>
    `/api/compta/releves/imports/${importId}/lignes/`,

  // =========================
  // COMPTA — Lignes de relevé
  // =========================
  releveLignes: "/api/compta/releves/lignes/",

  releveLigneDetail: (ligneId: number | string) =>
    `/api/compta/releves/lignes/${ligneId}/`,

  releveLigneRapprocher: (ligneId: number | string) =>
    `/api/compta/releves/lignes/${ligneId}/rapprocher/`,

  releveLigneSuggestions: (ligneId: number | string) =>
    `/api/compta/releves/lignes/${ligneId}/suggestions/`,

  releveLigneCreerMouvement: (ligneId: number | string) =>
    `/api/compta/releves/lignes/${ligneId}/creer-mouvement/`,

  releveLigneIgnorer: (ligneId: number | string) =>
    `/api/compta/releves/lignes/${ligneId}/ignorer/`,

  releveLigneAnnulerRapprochement: (ligneId: number | string) =>
    `/api/compta/releves/lignes/${ligneId}/annuler-rapprochement/`,

  // =========================
  // COMPTA — Mouvements / Dashboard
  // =========================
  comptaDashboard: "/api/compta/mouvements/dashboard/",
  mouvements: "/api/compta/mouvements/",

  mouvementDetail: (mouvementId: number | string) =>
    `/api/compta/mouvements/${mouvementId}/`,

  mouvementCancel: (mouvementId: number | string) =>
    `/api/compta/mouvements/${mouvementId}/cancel/`,

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
  // BILLING
  // =========================
  billingDashboard: "/api/billing/dashboard/",

  // =========================
  // TRAVAUX — Dossiers
  // =========================
  travauxDossiers: "/api/travaux/dossiers/",
  travauxDossiersStats: "/api/travaux/dossiers/stats/",

  travauxDossierDetail: (dossierId: number | string) =>
    `/api/travaux/dossiers/${dossierId}/`,

  travauxDossierSubmitAg: (dossierId: number | string) =>
    `/api/travaux/dossiers/${dossierId}/submit-ag/`,

  travauxDossierValidateAg: (dossierId: number | string) =>
    `/api/travaux/dossiers/${dossierId}/validate-ag/`,

  travauxDossierLinkResolution: (dossierId: number | string) =>
    `/api/travaux/dossiers/${dossierId}/link-resolution/`,

  // =========================
  // TRAVAUX — Fournisseurs
  // =========================
  travauxFournisseurs: "/api/travaux/fournisseurs/",

  travauxFournisseurDetail: (fournisseurId: number | string) =>
    `/api/travaux/fournisseurs/${fournisseurId}/`,

  // =========================
  // RH — Employés
  // =========================
  rhEmployes: "/api/rh/employes/",

  rhEmployeDetail: (employeId: number | string) =>
    `/api/rh/employes/${employeId}/`,

  rhEmployeActiver: (employeId: number | string) =>
    `/api/rh/employes/${employeId}/activer/`,

  rhEmployeDesactiver: (employeId: number | string) =>
    `/api/rh/employes/${employeId}/desactiver/`,

  // =========================
  // RH — Contrats
  // =========================
  rhContrats: "/api/rh/contrats/",

  rhContratDetail: (contratId: number | string) =>
    `/api/rh/contrats/${contratId}/`,

  rhContratActiver: (contratId: number | string) =>
    `/api/rh/contrats/${contratId}/activer/`,

  rhContratCloturer: (contratId: number | string) =>
    `/api/rh/contrats/${contratId}/cloturer/`,
} as const;