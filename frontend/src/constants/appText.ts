export const APP_TEXT = {
  app: {
    name: "copropriete_app",
    productName: "Logiciel de gestion de copropriété",
  },

  navigation: {
    dashboard: "Tableau de bord",
    compta: "Comptabilité",
    relances: "Relances",
    rh: "Ressources humaines",
    lots: "Lots",
    travaux: "Travaux",
    ag: "Assemblées générales",
    billing: "Facturation",
    platform: "Plateforme",
  },

  sections: {
    dashboard: "Tableau de bord",
    comptaOverview: "Vue d’ensemble de la comptabilité",
    comptaImports: "Imports bancaires",
    comptaImportedLines: "Lignes importées",
    comptaMovements: "Mouvements comptables",
    comptaStats: "Statistiques comptables",

    relancesOverview: "Vue d’ensemble des relances",
    relancesFolders: "Dossiers impayés",
    relancesHistory: "Historique des relances",
    regularisationNotices: "Avis de régularisation",

    rhEmployees: "Employés",
    rhContracts: "Contrats",

    lots: "Lots",

    travauxFiles: "Dossiers de travaux",
    travauxSuppliers: "Fournisseurs",

    ag: "Assemblées générales",
    agResolutions: "Résolutions",
    agPresences: "Présences",
    agVotes: "Votes",
    agPv: "Procès-verbal",

    billing: "Facturation",
    platformAdmin: "Administration plateforme",
  },

  pages: {
    dashboard: {
      title: "Tableau de bord",
      subtitle:
        "Consultez les indicateurs clés et l’activité récente de votre copropriété.",
      heroBadge: "Vue d’ensemble",
      cards: {
        comptaBalance: "Solde comptable",
        unreconciledEntries: "Écritures non rapprochées",
        travauxFiles: "Dossiers de travaux",
        assemblies: "Assemblées générales",
        invoices: "Factures",
        unpaidAmount: "Montant impayé",
      },
      cardsSubtitles: {
        comptaBalance: "Vision instantanée de la trésorerie suivie",
        unreconciledEntries: "Éléments à traiter côté rapprochement bancaire",
        travauxFiles: "Tous statuts confondus",
        assemblies: "Assemblées enregistrées dans le système",
        invoices: "Facturation globale suivie",
        unpaidAmount: "Solde restant à encaisser",
      },
      blocks: {
        comptaTrendTitle: "Tendance comptable",
        comptaTrendSubtitle: "Synthèse des mouvements sur la période récente.",
        comptaTrendEmptyDescription:
          "La synthèse comptable s’affichera ici dès que des mouvements exploitables seront disponibles.",
        cumulativeCredits: "Crédits cumulés",
        cumulativeDebits: "Débits cumulés",
        cumulativeNet: "Cumul net",

        travauxTitle: "Travaux",
        travauxSubtitle: "Suivi synthétique des dossiers en cours.",
        validatedFiles: "Dossiers validés",
        closedFiles: "Dossiers clôturés",
        paidTotal: "Total payé",
        remainingToPay: "Reste à payer",

        recentActivityTitle: "Activité récente",
        recentActivitySubtitle: "Derniers mouvements comptables enregistrés.",
        recentActivityEmptyTitle: "Aucune activité récente disponible.",
        recentActivityEmptyDescription:
          "Les derniers mouvements comptables apparaîtront ici dès qu’ils seront disponibles.",

        agTitle: "Assemblées générales",
        agSubtitle: "État récent des assemblées et des PV associés.",
        agEmptyDescription:
          "Les assemblées récentes s’afficheront ici dès qu’elles seront enregistrées.",

        billingTitle: "Facturation",
        billingSubtitle: "Vue rapide de l’état de la facturation.",
        totalAmount: "Montant total",
        paidAmount: "Montant payé",
        unpaidAmount: "Montant impayé",
        overdueInvoices: "Factures en retard",
      },
      pv: {
        generated: "PV généré",
        signed: "PV signé",
        locked: "PV verrouillé",
      },
    },

    compta: {
      homeTitle: "Vue d’ensemble de la comptabilité",
      homeSubtitle:
        "Pilotez les imports bancaires, les mouvements comptables et les statistiques financières.",
      importsTitle: "Imports bancaires",
      importsSubtitle:
        "Consultez l’historique des imports et suivez l’état des lignes traitées.",
      importedLinesTitle: "Lignes importées",
      importedLinesSubtitle:
        "Analysez les lignes importées, rapprochez-les et traitez les exceptions.",
      movementsTitle: "Mouvements comptables",
      movementsSubtitle:
        "Consultez et suivez les mouvements comptables de la copropriété.",
      statsTitle: "Statistiques comptables",
      statsSubtitle:
        "Visualisez les principaux indicateurs financiers et les tendances d’activité.",

      home: {
        quickAccessTitle: "Accès rapides",
        quickAccessSubtitle:
          "Ouvrez directement les écrans les plus utiles du module Comptabilité.",

        recommendedFlowTitle: "Parcours recommandé",
        recommendedFlowSubtitle:
          "Ordre conseillé pour traiter un relevé bancaire de bout en bout.",

        overview: {
          importsValue: "Disponibles",
          importsSubtitle:
            "Importez de nouveaux relevés et consultez l’historique des imports déjà traités.",
          importedLinesValue: "Traitable",
          importedLinesSubtitle:
            "Analysez les lignes bancaires, rapprochez-les et gérez les cas à ignorer ou à corriger.",
          movementsValue: "Suivis",
          movementsSubtitle:
            "Consultez les mouvements bancaires enregistrés pour la copropriété active.",
          statsValue: "Accessibles",
          statsSubtitle:
            "Visualisez les tendances, les volumes et les principaux repères comptables.",
        },

        quickActions: {
          importStatementTitle: "Importer un relevé bancaire",
          importStatementText:
            "Ajoutez un nouveau relevé bancaire pour alimenter le traitement comptable.",
          importStatementAction: "Importer un relevé",

          viewImportsTitle: "Consulter les imports",
          viewImportsText:
            "Retrouvez l’historique des imports bancaires et accédez à leurs lignes.",
          viewImportsAction: "Voir les imports",

          openMovementsTitle: "Ouvrir les mouvements",
          openMovementsText:
            "Parcourez les opérations comptables déjà enregistrées pour la copropriété active.",
          openMovementsAction: "Voir les mouvements",

          analyzeStatsTitle: "Analyser les statistiques",
          analyzeStatsText:
            "Consultez les indicateurs comptables et bancaires pour mieux suivre l’activité.",
          analyzeStatsAction: "Voir les statistiques",
        },

        steps: {
          step1Title: "Importer le relevé",
          step1Text:
            "Chargez le fichier bancaire correspondant à la période à traiter.",

          step2Title: "Contrôler les lignes",
          step2Text:
            "Vérifiez les lignes importées, les suggestions et les éventuels écarts.",

          step3Title: "Rapprocher ou corriger",
          step3Text:
            "Associez les lignes aux paiements ou créez les mouvements nécessaires.",

          step4Title: "Suivre les résultats",
          step4Text:
            "Consultez les mouvements et les statistiques pour valider le traitement.",
        },
      },
    },

    relances: {
      homeTitle: "Vue d’ensemble des relances",
      homeSubtitle:
        "Suivez les impayés, les relances envoyées et les avis de régularisation.",
      foldersTitle: "Dossiers impayés",
      foldersSubtitle:
        "Consultez les dossiers en attente de régularisation et leur niveau de relance.",
      historyTitle: "Historique des relances",
      historySubtitle:
        "Retrouvez les relances déjà envoyées et leur état de traitement.",
      noticesTitle: "Avis de régularisation",
      noticesSubtitle:
        "Consultez les avis générés après régularisation des situations impayées.",

      home: {
        cards: {
          folders: "Dossiers impayés",
          relances: "Relances envoyées",
          notices: "Avis de régularisation",
          unpaidAmount: "Montant impayé",
        },

        cardsSubtitles: {
          folders: "Suivi des dossiers nécessitant une action de relance.",
          relances: "Historique des relances déjà générées ou envoyées.",
          notices: "Avis produits après régularisation des situations impayées.",
          unpaidAmount: "Montant global restant à régulariser.",
        },

        quickActions: {
          openFoldersTitle: "Ouvrir les dossiers impayés",
          openFoldersText:
            "Consultez les dossiers en attente et déclenchez les prochaines actions de relance.",
          openFoldersAction: "Voir les dossiers",

          openHistoryTitle: "Consulter l’historique",
          openHistoryText:
            "Retrouvez l’ensemble des relances déjà envoyées et leur état de traitement.",
          openHistoryAction: "Voir l’historique",

          openNoticesTitle: "Consulter les avis",
          openNoticesText:
            "Accédez aux avis de régularisation générés après paiement ou mise à jour de dossier.",
          openNoticesAction: "Voir les avis",
        },

        empty: {
          folders: "Aucun dossier impayé disponible pour le moment.",
          history: "Aucune relance disponible pour le moment.",
          notices: "Aucun avis de régularisation disponible pour le moment.",
        },

        extra: {
          cards: {
            overdue: "En retard",
            partial: "Partiellement payés",
            paid: "Payés",
          },

          cardsSubtitles: {
            overdue: "Dossiers à relancer en priorité.",
            partial: "Paiements incomplets encore ouverts.",
            paid: "Dossiers soldés.",
          },

          priority: {
            title: "Dossiers prioritaires",
            subtitle:
              "Les dossiers les plus sensibles sont classés selon le montant restant à payer.",
            remainingLabel: "Reste",
            levelLabel: "Niveau",
            lotFallback: "Lot",
            ownerFallback: "Copropriétaire",
            callLabel: "Appel",
            dueDateLabel: "Échéance",
            openAction: "Ouvrir le dossier",
            payableFallback: "À payer",
            overdueStatus: "En retard",
          },

          productNote: {
            title: "Positionnement produit",
            description:
              "Cette vue d’ensemble renforce la lisibilité du module Relances, avec une lecture rapide des impayés, des retards, des régularisations et des dossiers à traiter.",
          },
        },
      },
    },

    rh: {
      employeesTitle: "Employés",
      employeesSubtitle:
        "Gérez les employés, leurs rôles et leur statut d’activité.",
      contractsTitle: "Contrats",
      contractsSubtitle:
        "Suivez les contrats, leur période d’exécution et leur état d’avancement.",
    },

    lots: {
      title: "Lots",
      subtitle:
        "Consultez et administrez les lots, leurs références et leurs données associées.",
    },

    travaux: {
      filesTitle: "Dossiers de travaux",
      filesSubtitle:
        "Pilotez les dossiers de travaux, leur budget, leur statut et leur avancement.",
      suppliersTitle: "Fournisseurs",
      suppliersSubtitle:
        "Gérez les fournisseurs intervenant sur les dossiers de travaux.",
    },

    ag: {
      homeTitle: "Assemblées générales",
      homeSubtitle:
        "Préparez, suivez et clôturez les assemblées générales de la copropriété.",
      resolutionsTitle: "Résolutions",
      resolutionsSubtitle:
        "Consultez les résolutions, leur état et les décisions associées.",
      presencesTitle: "Présences",
      presencesSubtitle:
        "Gérez les présences et les tantièmes pris en compte pour l’assemblée.",
      votesTitle: "Votes",
      votesSubtitle:
        "Suivez les votes exprimés pour chaque résolution.",
      pvTitle: "Procès-verbal",
      pvSubtitle:
        "Générez, archivez, signez et consultez le procès-verbal de l’assemblée.",
    },

    billing: {
      title: "Facturation",
      subtitle:
        "Suivez les éléments de facturation et les indicateurs financiers liés à la plateforme.",
    },

    platform: {
      title: "Administration plateforme",
      subtitle:
        "Supervisez les copropriétés, les accès et les données stratégiques de la plateforme.",
    },
  },

  actions: {
    create: "Créer",
    save: "Enregistrer",
    edit: "Modifier",
    delete: "Supprimer",
    deactivate: "Désactiver",
    reactivate: "Réactiver",
    cancel: "Annuler",
    close: "Clôturer",
    archive: "Archiver",
    sign: "Signer",
    generate: "Générer",
    export: "Exporter",
    open: "Ouvrir",
    viewDetails: "Voir le détail",
    backToList: "Retour à la liste",
    back: "Retour",
    search: "Rechercher",
    filter: "Filtrer",
    reset: "Réinitialiser",
    refresh: "Actualiser",
    confirm: "Confirmer",
    validate: "Valider",
    add: "Ajouter",
    remove: "Retirer",
    assign: "Affecter",
    activate: "Activer",
    submit: "Soumettre",
    continue: "Continuer",
    retry: "Réessayer",
    download: "Télécharger",
    upload: "Importer",
  },

  feedback: {
    loading: {
      default: "Chargement en cours...",
      data: "Chargement des données...",
      processing: "Traitement en cours...",
      saving: "Enregistrement en cours...",
      publishing: "Publication en cours...",
    },

    empty: {
      default: "Aucune donnée disponible pour le moment.",
      noResults: "Aucun résultat ne correspond à votre recherche.",
      noItems: "Aucun élément n’a encore été enregistré.",
      noActivity: "Aucune activité récente disponible.",
      noDocument: "Aucun document disponible pour le moment.",
      noImport: "Aucun import bancaire disponible pour le moment.",
      noMovement: "Aucun mouvement comptable disponible pour le moment.",
      noEmployee: "Aucun employé disponible pour le moment.",
      noContract: "Aucun contrat disponible pour le moment.",
      noLot: "Aucun lot disponible pour le moment.",
      noSupplier: "Aucun fournisseur disponible pour le moment.",
      noTravauxFile: "Aucun dossier de travaux disponible pour le moment.",
      noAssembly: "Aucune assemblée générale disponible pour le moment.",
      noResolution: "Aucune résolution disponible pour le moment.",
      noPresence: "Aucune présence disponible pour le moment.",
      noVote: "Aucun vote disponible pour le moment.",
      noNotice: "Aucun avis de régularisation disponible pour le moment.",
      noFolder: "Aucun dossier impayé disponible pour le moment.",
      noRelance: "Aucune relance disponible pour le moment.",
    },

    success: {
      created: "L’élément a été créé avec succès.",
      updated: "Les modifications ont été enregistrées avec succès.",
      deleted: "L’élément a été supprimé avec succès.",
      saved: "Les données ont été enregistrées avec succès.",
      executed: "L’action a été exécutée avec succès.",
      archived: "L’élément a été archivé avec succès.",
      signed: "Le document a été signé avec succès.",
      generated: "Le document a été généré avec succès.",
      imported: "L’import a été effectué avec succès.",
      statusUpdated: "Le statut a été mis à jour avec succès.",
      cancelled: "L’opération a été annulée avec succès.",
      sent: "L’envoi a été effectué avec succès.",
    },

    error: {
      default: "Une erreur inattendue est survenue.",
      load: "Impossible de charger les données.",
      save: "Impossible d’enregistrer les modifications.",
      create: "La création n’a pas pu être effectuée.",
      update: "La mise à jour n’a pas pu être effectuée.",
      delete: "La suppression n’a pas pu être effectuée.",
      execute: "L’action n’a pas pu être exécutée.",
      import: "L’import n’a pas pu être effectué.",
      generate: "Le document n’a pas pu être généré.",
      sign: "Le document n’a pas pu être signé.",
      archive: "L’archivage n’a pas pu être effectué.",
      validation: "Les informations fournies sont incomplètes ou invalides.",
      unauthorized: "Vous n’êtes pas autorisé à effectuer cette action.",
      notFound: "La ressource demandée est introuvable.",
    },

    confirmation: {
      default: "Cette action nécessite une confirmation.",
      irreversible: "Cette action est irréversible. Voulez-vous continuer ?",
      delete: "Voulez-vous vraiment supprimer cet élément ?",
      cancel: "Voulez-vous vraiment annuler cette opération ?",
      close: "Voulez-vous vraiment clôturer cet élément ?",
      archive: "Voulez-vous vraiment archiver cet élément ?",
      deactivate: "Voulez-vous vraiment désactiver cet élément ?",
      reactivate: "Voulez-vous vraiment réactiver cet élément ?",
      sign: "Voulez-vous vraiment signer ce document ?",
    },
  },

  labels: {
    general: {
      status: "Statut",
      actions: "Actions",
      details: "Détails",
      reference: "Référence",
      title: "Titre",
      description: "Description",
      date: "Date",
      startDate: "Date de début",
      endDate: "Date de fin",
      amount: "Montant",
      total: "Total",
      balance: "Solde",
      remaining: "Reste",
      notes: "Notes",
      comment: "Commentaire",
      search: "Recherche",
      filters: "Filtres",
      period: "Période",
      type: "Type",
      category: "Catégorie",
      role: "Rôle",
      location: "Lieu",
      document: "Document",
      activity: "Activité",
      overview: "Vue d’ensemble",
    },

    people: {
      firstName: "Prénom",
      lastName: "Nom",
      fullName: "Nom complet",
      email: "Adresse e-mail",
      phone: "Téléphone",
      address: "Adresse",
    },

    compta: {
      importDate: "Date d’import",
      importedLines: "Lignes importées",
      ignoredAtImport: "Ignorées à l’import",
      ignoredBusiness: "Ignorées métier",
      rapprochement: "Rapprochement",
      bankAccount: "Compte bancaire",
      operationDate: "Date d’opération",
      movementLabel: "Libellé du mouvement",
      debit: "Débit",
      credit: "Crédit",
      reconciled: "Rapproché",
      unreconciled: "Non rapproché",
    },

    relances: {
      folder: "Dossier impayé",
      dueDate: "Date d’échéance",
      amountDue: "Montant dû",
      amountPaid: "Montant payé",
      recoveryLevel: "Niveau de relance",
      notice: "Avis de régularisation",
    },

    rh: {
      employee: "Employé",
      contract: "Contrat",
      contractType: "Type de contrat",
      position: "Fonction",
      activeStatus: "Statut d’activité",
    },

    travaux: {
      file: "Dossier de travaux",
      supplier: "Fournisseur",
      estimatedBudget: "Budget estimé",
      approvedBudget: "Budget voté",
      referenceBudget: "Budget de référence",
      paidAmount: "Montant payé",
      remainingAmount: "Reste à payer",
    },

    ag: {
      assembly: "Assemblée générale",
      resolution: "Résolution",
      presence: "Présence",
      vote: "Vote",
      pv: "Procès-verbal",
      quorum: "Quorum",
      tantiemes: "Tantièmes",
      majorityType: "Type de majorité",
    },
  },

  statuses: {
    common: {
      draft: "Brouillon",
      open: "Ouvert",
      opened: "Ouverte",
      closed: "Clôturé",
      closedFeminine: "Clôturée",
      archived: "Archivé",
      archivedFeminine: "Archivée",
      active: "Actif",
      activeFeminine: "Active",
      inactive: "Inactif",
      inactiveFeminine: "Inactive",
      pending: "En attente",
      validated: "Validé",
      rejected: "Rejeté",
      cancelled: "Annulé",
      signed: "Signé",
      locked: "Verrouillé",
    },

    compta: {
      paid: "Réglé",
      unpaid: "Impayé",
      partial: "Paiement partiel",
      reconciled: "Rapproché",
      unreconciled: "Non rapproché",
      ignored: "Ignoré",
    },

    ag: {
      draft: "Brouillon",
      convened: "Convoquée",
      open: "Ouverte",
      closed: "Clôturée",
      archived: "Archivée",
      pending: "En attente",
      adopted: "Adoptée",
      rejected: "Rejetée",
      notGenerated: "Non généré",
      archivedPv: "Archivé",
      signedPv: "Signé",
      lockedPv: "Verrouillé",
    },

    rh: {
      upcoming: "À venir",
      ongoing: "En cours",
      finished: "Terminé",
      suspended: "Suspendu",
    },

    travaux: {
      draft: "Brouillon",
      submitted: "Soumis",
      validated: "Validé",
      rejected: "Rejeté",
      inProgress: "En cours",
      completed: "Terminé",
      locked: "Verrouillé",
    },

    relances: {
      generated: "Généré",
      sent: "Envoyé",
      failed: "Échec",
      regularised: "Régularisé",
    },
  },

  badges: {
    positive: "Succès",
    warning: "Attention",
    negative: "Erreur",
    neutral: "Information",
  },

  placeholders: {
    search: "Rechercher...",
    select: "Sélectionner...",
    comment: "Saisissez un commentaire...",
    notes: "Ajoutez une note si nécessaire...",
    filter: "Filtrer les résultats...",
  },

  helpers: {
    requiredField: "Ce champ est obligatoire.",
    optionalField: "Optionnel",
    lastUpdated: "Dernière mise à jour",
    createdOn: "Créé le",
    updatedOn: "Mis à jour le",
  },
} as const;

export type AppText = typeof APP_TEXT;