export const APP_TEXT = {
  common: {
    loading: "Chargement...",
    refresh: "Actualiser",
    save: "Enregistrer",
    update: "Mettre à jour",
    cancel: "Annuler",
    close: "Fermer",
    back: "Retour",
    noData: "Aucune donnée disponible.",
    noResult: "Aucun résultat trouvé.",
    openDetail: "Ouvrir le détail",
  },

  errors: {
    generic: "Une erreur est survenue.",
    loadFailed: "Impossible de charger les données.",
    saveFailed: "Impossible d’enregistrer les modifications.",
    actionFailed: "Impossible de finaliser cette action pour le moment.",
    invalidData: "Les données reçues sont incomplètes ou invalides.",
    accessDenied: "Accès refusé pour cette action.",
  },

  success: {
    saved: "Enregistrement effectué avec succès.",
    updated: "Mise à jour effectuée avec succès.",
    importDone: "Import terminé avec succès.",
    relanceSent: "Relance envoyée avec succès.",
    avisGenerated: "Avis de régularisation généré avec succès.",
  },

  emptyStates: {
    noAg: "Aucune assemblée générale disponible.",
    noContract: "Aucun contrat disponible.",
    noMouvement: "Aucun mouvement enregistré.",
    noDossierImpaye: "Aucun dossier impayé trouvé.",
    noAvis: "Aucun avis de régularisation trouvé.",
    noRelance: "Aucune relance enregistrée.",
  },
} as const;