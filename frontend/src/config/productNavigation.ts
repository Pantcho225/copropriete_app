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
      { label: "Nouveau dossier de travaux", to: "/travaux/dossiers/nouveau" },
      { label: "Fournisseurs", to: "/travaux/fournisseurs" },
      { label: "Nouveau fournisseur", to: "/travaux/fournisseurs/nouveau" },
    ],
  },
  {
    title: "Assemblées générales",
    items: [
      { label: "Vue d’ensemble", to: "/ag" },
      { label: "Assemblées", to: "/ag/assemblees" },
    ],
  },
  {
    title: "Facturation",
    items: [{ label: "Vue d’ensemble", to: "/billing" }],
  },
  {
    title: "Plateforme",
    items: [{ label: "Administration plateforme", to: "/platform-admin" }],
  },
];

export function getPageTitle(pathname: string): string {
  if (pathname === "/") return "Tableau de bord";

  // Comptabilité
  if (pathname === "/compta") return "Comptabilité";
  if (pathname === "/compta/import") return "Importer un relevé";
  if (pathname === "/compta/imports") return "Historique des imports";
  if (pathname.startsWith("/compta/imports/") && pathname.endsWith("/lignes")) {
    return "Lignes importées";
  }
  if (pathname === "/compta/mouvements") return "Mouvements bancaires";
  if (pathname === "/compta/stats") return "Statistiques comptables";

  // Relances
  if (pathname === "/relances") return "Relances";
  if (pathname === "/relances/dossiers") return "Dossiers impayés";
  if (pathname.startsWith("/relances/dossiers/")) return "Détail du dossier impayé";
  if (pathname === "/relances/historique") return "Historique des relances";
  if (pathname === "/relances/avis") return "Avis de régularisation";

  // RH
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
  if (pathname === "/travaux/dossiers") return "Dossiers de travaux";
  if (pathname === "/travaux/dossiers/nouveau") return "Nouveau dossier de travaux";
  if (pathname.startsWith("/travaux/dossiers/") && pathname.endsWith("/modifier")) {
    return "Modifier le dossier de travaux";
  }
  if (pathname.startsWith("/travaux/dossiers/") && !pathname.endsWith("/modifier")) {
    return "Détail du dossier de travaux";
  }
  if (pathname === "/travaux/fournisseurs") return "Fournisseurs";
  if (pathname === "/travaux/fournisseurs/nouveau") return "Nouveau fournisseur";
  if (pathname.startsWith("/travaux/fournisseurs/") && pathname.endsWith("/modifier")) {
    return "Modifier un fournisseur";
  }

  // AG
  if (pathname === "/ag") return "Assemblées générales";
  if (pathname === "/ag/assemblees") return "Assemblées";
  if (pathname === "/ag/assemblees/nouveau") return "Nouvelle assemblée générale";
  if (pathname.startsWith("/ag/assemblees/") && pathname.endsWith("/presences")) return "Présences";
  if (pathname.startsWith("/ag/assemblees/") && pathname.endsWith("/resolutions")) return "Résolutions";
  if (pathname.startsWith("/ag/assemblees/") && pathname.endsWith("/votes")) return "Votes";
  if (pathname.startsWith("/ag/assemblees/") && pathname.endsWith("/pv")) return "Procès-verbal";
  if (pathname.startsWith("/ag/assemblees/")) return "Détail de l’assemblée générale";

  // Facturation
  if (pathname === "/billing") return "Facturation";

  // Plateforme
  if (pathname === "/platform-admin") return "Administration plateforme";

  return "Espace de gestion";
}

export function getPageSubtitle(pathname: string): string {
  if (pathname === "/") {
    return "Pilotez l’activité de votre copropriété depuis une vue d’ensemble claire, centralisée et professionnelle.";
  }

  // Comptabilité
  if (pathname === "/compta") {
    return "Accédez rapidement aux principales fonctionnalités du module Comptabilité : imports bancaires, mouvements et statistiques.";
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
    return "Suivez les mouvements bancaires et les opérations enregistrées pour la copropriété active.";
  }
  if (pathname === "/compta/stats") {
    return "Analysez les principaux indicateurs comptables et la dynamique bancaire de la copropriété.";
  }

  // Relances
  if (pathname === "/relances") {
    return "Suivez les dossiers impayés, le niveau de relance et les régularisations depuis une vue d’ensemble dédiée.";
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

  // RH
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
  if (pathname === "/travaux/dossiers") {
    return "Pilotez les dossiers de travaux, leur budget, leur résolution liée et leur niveau de verrouillage.";
  }
  if (pathname === "/travaux/dossiers/nouveau") {
    return "Renseignez les informations nécessaires pour enregistrer un nouveau dossier de travaux.";
  }
  if (pathname.startsWith("/travaux/dossiers/") && pathname.endsWith("/modifier")) {
    return "Mettez à jour les informations générales du dossier sélectionné.";
  }
  if (pathname.startsWith("/travaux/dossiers/") && !pathname.endsWith("/modifier")) {
    return "Consultez la fiche détaillée du dossier, sa situation budgétaire, la résolution liée et le niveau de verrouillage.";
  }
  if (pathname === "/travaux/fournisseurs") {
    return "Consultez les fournisseurs enregistrés dans le module Travaux et maintenez leurs fiches.";
  }
  if (pathname === "/travaux/fournisseurs/nouveau") {
    return "Renseignez les informations utiles pour enregistrer un nouveau fournisseur.";
  }
  if (pathname.startsWith("/travaux/fournisseurs/") && pathname.endsWith("/modifier")) {
    return "Mettez à jour les informations de la fiche fournisseur sélectionnée.";
  }

  // AG
  if (pathname === "/ag") {
    return "Suivez l’activité du module Assemblées générales depuis une vue d’ensemble claire et opérationnelle.";
  }
  if (pathname === "/ag/assemblees") {
    return "Consultez les assemblées, leur statut et les principales actions disponibles.";
  }
  if (pathname === "/ag/assemblees/nouveau") {
    return "Renseignez les informations nécessaires pour préparer une nouvelle assemblée générale.";
  }
  if (pathname.startsWith("/ag/assemblees/") && pathname.endsWith("/presences")) {
    return "Gérez les présences, les tantièmes associés et la participation des lots à l’assemblée.";
  }
  if (pathname.startsWith("/ag/assemblees/") && pathname.endsWith("/resolutions")) {
    return "Consultez et pilotez les résolutions rattachées à cette assemblée générale.";
  }
  if (pathname.startsWith("/ag/assemblees/") && pathname.endsWith("/votes")) {
    return "Suivez les votes exprimés et l’état d’avancement des décisions de l’assemblée.";
  }
  if (pathname.startsWith("/ag/assemblees/") && pathname.endsWith("/pv")) {
    return "Consultez le procès-verbal, son état d’archivage, de signature et de verrouillage.";
  }
  if (pathname.startsWith("/ag/assemblees/")) {
    return "Consultez les informations générales de l’assemblée, son statut et les actions disponibles.";
  }

  // Facturation
  if (pathname === "/billing") {
    return "Accédez à la vue d’ensemble du module Facturation pour suivre les éléments clés déjà disponibles.";
  }

  // Plateforme
  if (pathname === "/platform-admin") {
    return "Supervisez la plateforme, les copropriétés et les rôles principaux depuis l’espace d’administration.";
  }

  return "Interface de gestion de la copropriété.";
}