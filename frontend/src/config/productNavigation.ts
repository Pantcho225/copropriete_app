// frontend/src/config/productNavigation.ts

export type NavItem = {
  label: string;
  to: string;
};

export type NavSection = {
  title: string;
  items: NavItem[];
};

export const SIDEBAR_SECTIONS: NavSection[] = [
  {
    title: "Comptabilité",
    items: [
      { label: "Vue d’ensemble", to: "/compta" },
      { label: "Importer un relevé", to: "/compta/import" },
      { label: "Historique des imports", to: "/compta/imports" },
      { label: "Mouvements", to: "/compta/mouvements" },
      { label: "Statistiques", to: "/compta/stats" },
    ],
  },
  {
    title: "Relances",
    items: [
      { label: "Vue d’ensemble", to: "/relances" },
      { label: "Dossiers impayés", to: "/relances/dossiers" },
      { label: "Historique des relances", to: "/relances/historique" },
      { label: "Avis de régularisation", to: "/relances/avis" },
    ],
  },
  {
    title: "Ressources humaines",
    items: [
      { label: "Vue d’ensemble", to: "/rh" },
      { label: "Employés", to: "/rh/employes" },
      { label: "Contrats", to: "/rh/contrats" },
    ],
  },
  {
    title: "Lots",
    items: [
      { label: "Liste des lots", to: "/lots" },
      { label: "Nouveau lot", to: "/lots/nouveau" },
    ],
  },
  {
    title: "Travaux",
    items: [
      { label: "Dossiers de travaux", to: "/travaux/dossiers" },
      { label: "Prestataires", to: "/travaux/fournisseurs" },
    ],
  },
  {
    title: "Assemblées générales",
    items: [
      { label: "Vue d’ensemble", to: "/ag" },
      { label: "Liste des assemblées", to: "/ag/assemblees" },
      { label: "Nouvelle assemblée", to: "/ag/assemblees/nouveau" },
      { label: "Résolutions", to: "/ag/resolutions" },
    ],
  },
  {
    title: "Facturation",
    items: [
      { label: "Vue d’ensemble", to: "/billing" },
      { label: "Factures", to: "/billing/factures" },
      { label: "Abonnement", to: "/billing/abonnement" },
    ],
  },
  {
    title: "Plateforme",
    items: [
      { label: "Vue d’ensemble", to: "/platform-admin" },
      { label: "Copropriétés", to: "/platform-admin/coproprietes" },
      {
        label: "Nouvelle copropriété",
        to: "/platform-admin/coproprietes/nouveau",
      },
      {
        label: "Utilisateurs & rôles",
        to: "/platform-admin/utilisateurs-roles",
      },
      {
        label: "Référentiel copropriété",
        to: "/platform-admin/referentiel-copropriete",
      },
    ],
  },
];

export function getPageTitle(pathname: string): string {
  if (pathname === "/") return "Tableau de bord";

  // Comptabilité
  if (pathname === "/compta") return "Vue d’ensemble Comptabilité";
  if (pathname === "/compta/import") return "Importer un relevé";
  if (pathname === "/compta/imports") return "Historique des imports";
  if (pathname.startsWith("/compta/imports/") && pathname.endsWith("/lignes")) {
    return "Lignes importées";
  }
  if (pathname === "/compta/mouvements") return "Mouvements comptables";
  if (pathname === "/compta/stats") return "Statistiques comptables";

  // Relances
  if (pathname === "/relances") return "Vue d’ensemble Relances";
  if (pathname === "/relances/dossiers") return "Dossiers impayés";
  if (pathname.startsWith("/relances/dossiers/")) {
    return "Détail du dossier impayé";
  }
  if (pathname === "/relances/historique") return "Historique des relances";
  if (pathname === "/relances/avis") return "Avis de régularisation";

  // Ressources humaines
  if (pathname === "/rh") return "Vue d’ensemble Ressources humaines";
  if (pathname === "/rh/employes") return "Employés";
  if (pathname === "/rh/employes/nouveau") return "Nouvel employé";
  if (pathname.startsWith("/rh/employes/") && pathname.endsWith("/modifier")) {
    return "Modifier un employé";
  }
  if (pathname === "/rh/contrats") return "Contrats";
  if (pathname === "/rh/contrats/nouveau") return "Nouveau contrat";
  if (pathname.startsWith("/rh/contrats/") && pathname.endsWith("/modifier")) {
    return "Modifier un contrat";
  }

  // Lots
  if (pathname === "/lots") return "Liste des lots";
  if (pathname === "/lots/nouveau") return "Nouveau lot";
  if (pathname.startsWith("/lots/") && pathname.endsWith("/modifier")) {
    return "Modifier un lot";
  }

  // Travaux
  if (pathname === "/travaux") return "Dossiers de travaux";
  if (pathname === "/travaux/dossiers") return "Dossiers de travaux";
  if (pathname === "/travaux/dossiers/nouveau") {
    return "Nouveau dossier de travaux";
  }
  if (
    pathname.startsWith("/travaux/dossiers/") &&
    pathname.endsWith("/modifier")
  ) {
    return "Modifier le dossier de travaux";
  }
  if (
    pathname.startsWith("/travaux/dossiers/") &&
    !pathname.endsWith("/modifier")
  ) {
    return "Détail du dossier de travaux";
  }
  if (pathname === "/travaux/fournisseurs") return "Prestataires";
  if (pathname === "/travaux/fournisseurs/nouveau") {
    return "Nouveau prestataire";
  }
  if (
    pathname.startsWith("/travaux/fournisseurs/") &&
    pathname.endsWith("/modifier")
  ) {
    return "Modifier un prestataire";
  }

  // Assemblées générales
  if (pathname === "/ag") return "Vue d’ensemble Assemblées générales";
  if (pathname === "/ag/assemblees") return "Liste des assemblées";
  if (pathname === "/ag/assemblees/nouveau") return "Nouvelle assemblée";
  if (pathname === "/ag/resolutions") return "Résolutions";

  if (pathname.startsWith("/ag/assemblees/") && pathname.endsWith("/presences")) {
    return "Présences";
  }
  if (
    pathname.startsWith("/ag/assemblees/") &&
    pathname.endsWith("/resolutions")
  ) {
    return "Résolutions";
  }
  if (pathname.startsWith("/ag/assemblees/") && pathname.endsWith("/votes")) {
    return "Votes";
  }
  if (pathname.startsWith("/ag/assemblees/") && pathname.endsWith("/pv")) {
    return "Procès-verbal";
  }
  if (pathname.startsWith("/ag/assemblees/") && pathname.endsWith("/modifier")) {
    return "Modifier l’assemblée générale";
  }
  if (pathname.startsWith("/ag/assemblees/")) {
    return "Détail de l’assemblée générale";
  }

  // Facturation
  if (pathname === "/billing") return "Vue d’ensemble Facturation";
  if (pathname === "/billing/factures") return "Factures";
  if (pathname === "/billing/abonnement") return "Abonnement";

  // Plateforme / Super Admin
  if (pathname === "/platform-admin") {
    return "Vue d’ensemble Plateforme";
  }
  if (pathname === "/platform-admin/coproprietes") {
    return "Copropriétés";
  }
  if (pathname === "/platform-admin/coproprietes/nouveau") {
    return "Nouvelle copropriété";
  }
  if (
    pathname.startsWith("/platform-admin/coproprietes/") &&
    pathname.endsWith("/modifier")
  ) {
    return "Modifier la copropriété";
  }
  if (
    pathname.startsWith("/platform-admin/coproprietes/") &&
    !pathname.endsWith("/modifier") &&
    !pathname.endsWith("/nouveau")
  ) {
    return "Détail de la copropriété";
  }
  if (pathname === "/platform-admin/utilisateurs-roles") {
    return "Utilisateurs & rôles";
  }
  if (pathname === "/platform-admin/referentiel-copropriete") {
    return "Référentiel copropriété";
  }
  if (pathname === "/platform-admin/referentiel-copropriete/coproprietaires") {
    return "Copropriétaires";
  }
  if (pathname === "/platform-admin/referentiel-copropriete/lots") {
    return "Lots du référentiel";
  }
  if (pathname === "/platform-admin/referentiel-copropriete/tantiemes") {
    return "Tantièmes";
  }

  return "Espace de gestion";
}

export function getPageSubtitle(pathname: string): string {
  if (pathname === "/") {
    return "Pilotez l’activité de votre copropriété depuis une vue d’ensemble claire, centralisée et professionnelle.";
  }

  // Comptabilité
  if (pathname === "/compta") {
    return "Suivez les flux financiers, les imports bancaires, les rapprochements et les principaux indicateurs comptables.";
  }
  if (pathname === "/compta/import") {
    return "Importez un relevé bancaire pour faciliter le traitement et le rapprochement des opérations.";
  }
  if (pathname === "/compta/imports") {
    return "Consultez les relevés déjà importés, leur état de traitement et les accès rapides vers les lignes importées.";
  }
  if (pathname.startsWith("/compta/imports/") && pathname.endsWith("/lignes")) {
    return "Traitez les lignes importées, rapprochez-les ou marquez-les selon leur statut métier.";
  }
  if (pathname === "/compta/mouvements") {
    return "Consultez les mouvements comptables, leur statut de rapprochement et l’activité enregistrée pour la copropriété active.";
  }
  if (pathname === "/compta/stats") {
    return "Analysez les principaux indicateurs comptables et la dynamique bancaire de la copropriété.";
  }

  // Relances
  if (pathname === "/relances") {
    return "Supervisez les dossiers impayés, les relances engagées et les régularisations depuis une vue d’ensemble dédiée.";
  }
  if (pathname === "/relances/dossiers") {
    return "Consultez les dossiers impayés, leur niveau de relance et leur situation de règlement.";
  }
  if (pathname.startsWith("/relances/dossiers/")) {
    return "Consultez le détail du dossier, l’historique des relances et les actions disponibles.";
  }
  if (pathname === "/relances/historique") {
    return "Retrouvez l’historique complet des relances envoyées pour cette copropriété.";
  }
  if (pathname === "/relances/avis") {
    return "Consultez les avis de régularisation générés après paiement ou mise à jour de situation.";
  }

  // Ressources humaines
  if (pathname === "/rh") {
    return "Pilotez les équipes, les contrats et l’organisation opérationnelle depuis le module Ressources humaines.";
  }
  if (pathname === "/rh/employes") {
    return "Gérez les employés rattachés à cette copropriété.";
  }
  if (pathname === "/rh/employes/nouveau") {
    return "Renseignez les informations nécessaires pour enregistrer un nouvel employé.";
  }
  if (pathname.startsWith("/rh/employes/") && pathname.endsWith("/modifier")) {
    return "Mettez à jour les informations de l’employé sélectionné.";
  }
  if (pathname === "/rh/contrats") {
    return "Suivez les contrats, leurs périodes d’activité et leur statut.";
  }
  if (pathname === "/rh/contrats/nouveau") {
    return "Renseignez les informations nécessaires pour enregistrer un nouveau contrat.";
  }
  if (pathname.startsWith("/rh/contrats/") && pathname.endsWith("/modifier")) {
    return "Mettez à jour les informations du contrat sélectionné.";
  }

  // Lots
  if (pathname === "/lots") {
    return "Consultez les lots de la copropriété et leurs principales informations de référence.";
  }
  if (pathname === "/lots/nouveau") {
    return "Renseignez les informations nécessaires pour enregistrer un nouveau lot.";
  }
  if (pathname.startsWith("/lots/") && pathname.endsWith("/modifier")) {
    return "Mettez à jour les informations du lot sélectionné.";
  }

  // Travaux
  if (pathname === "/travaux") {
    return "Pilotez les dossiers de travaux, leur budget, leur résolution liée et leur niveau de verrouillage.";
  }
  if (pathname === "/travaux/dossiers") {
    return "Pilotez les dossiers de travaux, leur budget, leur résolution liée et leur niveau de verrouillage.";
  }
  if (pathname === "/travaux/dossiers/nouveau") {
    return "Renseignez les informations nécessaires pour enregistrer un nouveau dossier de travaux.";
  }
  if (
    pathname.startsWith("/travaux/dossiers/") &&
    pathname.endsWith("/modifier")
  ) {
    return "Mettez à jour les informations générales du dossier sélectionné.";
  }
  if (
    pathname.startsWith("/travaux/dossiers/") &&
    !pathname.endsWith("/modifier")
  ) {
    return "Consultez la fiche détaillée du dossier, sa situation budgétaire, la résolution liée et le niveau de verrouillage.";
  }
  if (pathname === "/travaux/fournisseurs") {
    return "Consultez les prestataires enregistrés dans le module Travaux et maintenez leurs fiches.";
  }
  if (pathname === "/travaux/fournisseurs/nouveau") {
    return "Renseignez les informations utiles pour enregistrer un nouveau prestataire.";
  }
  if (
    pathname.startsWith("/travaux/fournisseurs/") &&
    pathname.endsWith("/modifier")
  ) {
    return "Mettez à jour les informations de la fiche prestataire sélectionnée.";
  }

  // Assemblées générales
  if (pathname === "/ag") {
    return "Pilotez les assemblées générales, les présences, les résolutions, les votes et les procès-verbaux.";
  }
  if (pathname === "/ag/assemblees") {
    return "Consultez les assemblées, leur statut et les principales actions disponibles.";
  }
  if (pathname === "/ag/assemblees/nouveau") {
    return "Renseignez les informations nécessaires pour préparer une nouvelle assemblée générale.";
  }
  if (pathname === "/ag/resolutions") {
    return "Consultez et pilotez les résolutions rattachées aux assemblées générales.";
  }
  if (pathname.startsWith("/ag/assemblees/") && pathname.endsWith("/presences")) {
    return "Gérez les présences, les tantièmes associés et la participation des lots à l’assemblée.";
  }
  if (
    pathname.startsWith("/ag/assemblees/") &&
    pathname.endsWith("/resolutions")
  ) {
    return "Consultez et pilotez les résolutions rattachées à cette assemblée générale.";
  }
  if (pathname.startsWith("/ag/assemblees/") && pathname.endsWith("/votes")) {
    return "Suivez les votes exprimés et l’état d’avancement des décisions de l’assemblée.";
  }
  if (pathname.startsWith("/ag/assemblees/") && pathname.endsWith("/pv")) {
    return "Consultez le procès-verbal, son état d’archivage, de signature et de verrouillage.";
  }
  if (pathname.startsWith("/ag/assemblees/") && pathname.endsWith("/modifier")) {
    return "Mettez à jour les informations générales de l’assemblée sélectionnée.";
  }
  if (pathname.startsWith("/ag/assemblees/")) {
    return "Consultez les informations générales de l’assemblée, son statut et les actions disponibles.";
  }

  // Facturation
  if (pathname === "/billing") {
    return "Suivez les éléments de facturation, les statuts d’abonnement et les informations économiques déjà disponibles.";
  }
  if (pathname === "/billing/factures") {
    return "Consultez les factures émises et leur statut de traitement.";
  }
  if (pathname === "/billing/abonnement") {
    return "Suivez le plan actif, les échéances et les informations de souscription.";
  }

  // Plateforme / Super Admin
  if (pathname === "/platform-admin") {
    return "Supervisez la plateforme, les copropriétés, les accès et les principaux éléments de pilotage SaaS.";
  }
  if (pathname === "/platform-admin/coproprietes") {
    return "Créez, consultez et administrez les copropriétés gérées par la plateforme.";
  }
  if (pathname === "/platform-admin/coproprietes/nouveau") {
    return "Renseignez les informations nécessaires pour créer une nouvelle copropriété depuis l’Admin React.";
  }
  if (
    pathname.startsWith("/platform-admin/coproprietes/") &&
    pathname.endsWith("/modifier")
  ) {
    return "Mettez à jour les informations générales, le statut et les coordonnées de la copropriété sélectionnée.";
  }
  if (
    pathname.startsWith("/platform-admin/coproprietes/") &&
    !pathname.endsWith("/modifier") &&
    !pathname.endsWith("/nouveau")
  ) {
    return "Consultez la fiche de la copropriété, ses informations principales et les accès vers son référentiel.";
  }
  if (pathname === "/platform-admin/utilisateurs-roles") {
    return "Gérez les rattachements utilisateurs, les rôles locaux et les accès aux copropriétés.";
  }
  if (pathname === "/platform-admin/referentiel-copropriete") {
    return "Pilotez le référentiel métier : copropriétaires, lots, tantièmes et affectations nécessaires aux modules opérationnels.";
  }
  if (pathname === "/platform-admin/referentiel-copropriete/coproprietaires") {
    return "Créez et maintenez les copropriétaires rattachés à la copropriété active.";
  }
  if (pathname === "/platform-admin/referentiel-copropriete/lots") {
    return "Créez et maintenez les lots de référence, leurs caractéristiques et leur rattachement à la copropriété.";
  }
  if (pathname === "/platform-admin/referentiel-copropriete/tantiemes") {
    return "Paramétrez les catégories et valeurs de tantièmes utilisées pour les répartitions, les votes et les appels de fonds.";
  }

  return "Interface de gestion de la copropriété.";
}