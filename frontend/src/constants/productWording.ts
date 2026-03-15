// src/constants/productWording.ts

export type AppModuleKey =
  | "dashboard"
  | "compta"
  | "rh"
  | "travaux"
  | "ag"
  | "billing"
  | "platformAdmin";

export type GenericActionKey =
  | "add"
  | "create"
  | "save"
  | "update"
  | "edit"
  | "delete"
  | "cancel"
  | "close"
  | "reactivate"
  | "viewDetails"
  | "search"
  | "filter"
  | "export";

export type GenericStatusKey =
  | "active"
  | "inactive"
  | "draft"
  | "pending"
  | "validated"
  | "rejected"
  | "upcoming"
  | "inProgress"
  | "completed"
  | "archived"
  | "locked"
  | "unpaid"
  | "partiallyPaid"
  | "paid";

export type FeedbackMessageKey =
  | "loading"
  | "loadError"
  | "saveSuccess"
  | "updateSuccess"
  | "cancelSuccess"
  | "empty"
  | "confirmSensitiveAction"
  | "unexpectedError";

export type RHRoleKey =
  | "GARDIEN"
  | "AGENT_ENTRETIEN"
  | "AGENT_NETTOYAGE"
  | "RESPONSABLE_SITE"
  | "ASSISTANT_GESTION"
  | "AUTRE";

export type EmployeeStatusKey = "active" | "inactive";

export type ContractStatusKey = "upcoming" | "inProgress" | "completed";

export const PRODUCT_WORDING = {
  appName: "Copropriété",

  modules: {
    dashboard: "Tableau de bord",
    compta: "Comptabilité",
    rh: "Ressources humaines",
    travaux: "Travaux",
    ag: "Assemblées générales",
    billing: "Facturation",
    platformAdmin: "Administration plateforme",
  } satisfies Record<AppModuleKey, string>,

  actions: {
    add: "Ajouter",
    create: "Créer",
    save: "Enregistrer",
    update: "Mettre à jour",
    edit: "Modifier",
    delete: "Supprimer",
    cancel: "Annuler",
    close: "Clôturer",
    reactivate: "Réactiver",
    viewDetails: "Voir le détail",
    search: "Rechercher",
    filter: "Filtrer",
    export: "Exporter",
  } satisfies Record<GenericActionKey, string>,

  statuses: {
    active: "Actif",
    inactive: "Inactif",
    draft: "Brouillon",
    pending: "En attente",
    validated: "Validé",
    rejected: "Rejeté",
    upcoming: "À venir",
    inProgress: "En cours",
    completed: "Terminé",
    archived: "Archivé",
    locked: "Verrouillé",
    unpaid: "Impayé",
    partiallyPaid: "Partiellement payé",
    paid: "Payé",
  } satisfies Record<GenericStatusKey, string>,

  feedback: {
    loading: "Chargement en cours...",
    loadError: "Impossible de charger les données.",
    saveSuccess: "Enregistrement effectué avec succès.",
    updateSuccess: "Mise à jour effectuée avec succès.",
    cancelSuccess: "Action annulée avec succès.",
    empty: "Aucun résultat disponible.",
    confirmSensitiveAction: "Voulez-vous vraiment poursuivre cette action ?",
    unexpectedError: "Une erreur inattendue est survenue.",
  } satisfies Record<FeedbackMessageKey, string>,

  rh: {
    moduleTitle: "Ressources humaines",

    employees: {
      listTitle: "Employés",
      createTitle: "Nouvel employé",
      editTitle: "Modifier l’employé",
      createAction: "Ajouter un employé",
      createSubmit: "Créer l’employé",
      updateSubmit: "Enregistrer les modifications",
      empty: "Aucun employé enregistré pour le moment.",
      loadError: "Impossible de charger les employés.",
      createSuccess: "Employé créé avec succès.",
      updateSuccess: "Employé mis à jour avec succès.",
      disableSuccess: "Employé désactivé avec succès.",
      reactivateSuccess: "Employé réactivé avec succès.",
      saveError: "Une erreur est survenue lors de l’enregistrement.",
      status: {
        active: "Actif",
        inactive: "Inactif",
      } satisfies Record<EmployeeStatusKey, string>,
      actions: {
        disable: "Désactiver",
        reactivate: "Réactiver",
        edit: "Modifier",
      },
    },

    contracts: {
      listTitle: "Contrats",
      createTitle: "Nouveau contrat",
      editTitle: "Modifier le contrat",
      createAction: "Ajouter un contrat",
      createSubmit: "Créer le contrat",
      updateSubmit: "Enregistrer les modifications",
      closeAction: "Clôturer le contrat",
      reactivateAction: "Réactiver le contrat",
      empty: "Aucun contrat enregistré pour le moment.",
      loadError: "Impossible de charger les contrats.",
      createSuccess: "Contrat créé avec succès.",
      updateSuccess: "Contrat mis à jour avec succès.",
      closeSuccess: "Contrat clôturé avec succès.",
      reactivateSuccess: "Contrat réactivé avec succès.",
      saveError: "Une erreur est survenue lors de l’enregistrement.",
      closeFutureError:
        "Vous ne pouvez pas clôturer un contrat qui n’a pas encore commencé.",
      status: {
        upcoming: "À venir",
        inProgress: "En cours",
        completed: "Terminé",
      } satisfies Record<ContractStatusKey, string>,
    },

    roles: {
      GARDIEN: "Gardien",
      AGENT_ENTRETIEN: "Agent d’entretien",
      AGENT_NETTOYAGE: "Agent de nettoyage",
      RESPONSABLE_SITE: "Responsable de site",
      ASSISTANT_GESTION: "Assistant de gestion",
      AUTRE: "Autre",
    } satisfies Record<RHRoleKey, string>,
  },

  compta: {
    moduleTitle: "Comptabilité",
    importsTitle: "Imports bancaires",
    linesTitle: "Lignes importées",
    movementsTitle: "Mouvements",
    statsTitle: "Statistiques comptables",
    ignoredImportLabel: "Ignorées à l’import",
    ignoredBusinessLabel: "Ignorées métier",
  },

  travaux: {
    moduleTitle: "Travaux",
    foldersTitle: "Dossiers travaux",
    suppliersTitle: "Fournisseurs",
    detailsTitle: "Détail du dossier",
  },

  ag: {
    moduleTitle: "Assemblées générales",
    resolutionsTitle: "Résolutions",
    minutesTitle: "Procès-verbal",
  },

  common: {
    currency: "FCFA",
    yes: "Oui",
    no: "Non",
    notProvided: "Non renseigné",
    noResultsForSearch: "Aucun résultat ne correspond à votre recherche.",
  },
} as const;

// Helpers

export function getModuleLabel(key: AppModuleKey): string {
  return PRODUCT_WORDING.modules[key];
}

export function getActionLabel(key: GenericActionKey): string {
  return PRODUCT_WORDING.actions[key];
}

export function getStatusLabel(key: GenericStatusKey): string {
  return PRODUCT_WORDING.statuses[key];
}

export function getFeedbackMessage(key: FeedbackMessageKey): string {
  return PRODUCT_WORDING.feedback[key];
}

export function getRHRoleLabel(role?: string | null): string {
  if (!role) return PRODUCT_WORDING.common.notProvided;

  const normalized = role.trim().toUpperCase() as RHRoleKey;
  return PRODUCT_WORDING.rh.roles[normalized] ?? role;
}

export function getEmployeeStatusLabel(isActive?: boolean | null): string {
  if (isActive) return PRODUCT_WORDING.rh.employees.status.active;
  return PRODUCT_WORDING.rh.employees.status.inactive;
}

export function getContractStatusLabel(status?: string | null): string {
  if (!status) return PRODUCT_WORDING.common.notProvided;

  const normalized = status.trim();

  const map: Record<string, string> = {
    UPCOMING: PRODUCT_WORDING.rh.contracts.status.upcoming,
    A_VENIR: PRODUCT_WORDING.rh.contracts.status.upcoming,
    FUTURE: PRODUCT_WORDING.rh.contracts.status.upcoming,

    IN_PROGRESS: PRODUCT_WORDING.rh.contracts.status.inProgress,
    EN_COURS: PRODUCT_WORDING.rh.contracts.status.inProgress,
    ACTIVE: PRODUCT_WORDING.rh.contracts.status.inProgress,
    ACTIF: PRODUCT_WORDING.rh.contracts.status.inProgress,

    COMPLETED: PRODUCT_WORDING.rh.contracts.status.completed,
    TERMINE: PRODUCT_WORDING.rh.contracts.status.completed,
    CLOSED: PRODUCT_WORDING.rh.contracts.status.completed,
    CLOTURE: PRODUCT_WORDING.rh.contracts.status.completed,
  };

  return map[normalized.toUpperCase()] ?? status;
}