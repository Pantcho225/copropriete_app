// frontend/src/pages/demo/DemoOfficiel.tsx
import type { CSSProperties } from "react";
import { Link } from "react-router-dom";

type DemoStep = {
  order: string;
  title: string;
  description: string;
  path: string;
  actionLabel: string;
  badge?: string;
};

const DEMO_STEPS: DemoStep[] = [
  {
    order: "01",
    title: "Dashboard global admin",
    description:
      "Ouvrir la vue d’ensemble pour présenter les indicateurs principaux, le contexte de copropriété actif et les raccourcis de pilotage.",
    path: "/",
    actionLabel: "Ouvrir le dashboard",
    badge: "Point de départ",
  },
  {
    order: "02",
    title: "Référentiel copropriété #11",
    description:
      "Présenter Résidence Les Jardins d’Azur : cockpit référentiel, copropriétaires, lots, tantièmes et occupants déclarés.",
    path: "/platform-admin/referentiel-copropriete",
    actionLabel: "Ouvrir le référentiel",
    badge: "Données socle",
  },
  {
    order: "03",
    title: "Espace copropriétaire",
    description:
      "Basculer sur le portail personnel pour montrer l’expérience côté copropriétaire : lots, appels, paiements, documents, textes utiles et AG.",
    path: "/coproprietaire",
    actionLabel: "Ouvrir le portail copropriétaire",
    badge: "Vision client",
  },
  {
    order: "04",
    title: "AG #38 — cycle clôturé",
    description:
      "Démontrer un cycle terminé : présences, résolutions, votes, quorum et procès-verbal signé/verrouillé.",
    path: "/ag/assemblees/38",
    actionLabel: "Ouvrir l’AG #38",
    badge: "PV signé",
  },
  {
    order: "05",
    title: "AG #39 — convocations officielles",
    description:
      "Montrer la convocation officielle v4, les rectificatives remplacées, l’historique et les preuves de notification/consultation.",
    path: "/ag/assemblees/39",
    actionLabel: "Ouvrir l’AG #39",
    badge: "Convocation v4",
  },
  {
    order: "06",
    title: "Convocations AG #39",
    description:
      "Accéder directement à la liste filtrée des convocations de l’AG #39 pour montrer PDF, statut, version officielle et traçabilité.",
    path: "/ag/convocations?ag=39",
    actionLabel: "Voir les convocations",
    badge: "Traçabilité",
  },
  {
    order: "07",
    title: "Travaux — dossier #10",
    description:
      "Présenter le dossier de réfection de la clôture, le budget validé, les paiements et les prestataires.",
    path: "/travaux/dossiers/10",
    actionLabel: "Ouvrir le dossier travaux",
    badge: "Budget voté",
  },
  {
    order: "08",
    title: "Comptabilité",
    description:
      "Présenter la vue comptable : entrées d’argent, mouvements, import bancaire, statistiques et cohérence avec la situation financière.",
    path: "/compta",
    actionLabel: "Ouvrir la comptabilité",
    badge: "Finances",
  },
  {
    order: "09",
    title: "Relances & impayés",
    description:
      "Montrer comment le syndic suit les dossiers impayés, les relances et les avis de régularisation.",
    path: "/relances",
    actionLabel: "Ouvrir les relances",
    badge: "Recouvrement",
  },
  {
    order: "10",
    title: "Facturation & cotisations",
    description:
      "Terminer sur la facturation et les cotisations mensuelles, en indiquant clairement les écrans prêts et ceux encore en préparation.",
    path: "/billing",
    actionLabel: "Ouvrir la facturation",
    badge: "Fin de parcours",
  },
];

export default function DemoOfficiel() {
  return (
    <div style={styles.page}>
      <section style={styles.hero}>
        <p style={styles.eyebrow}>Parcours officiel de démonstration</p>
        <h1 style={styles.title}>Démo Résidence Les Jardins d’Azur</h1>
        <p style={styles.subtitle}>
          Suivez cet ordre pendant la présentation : il raconte l’application
          comme un produit complet, depuis le référentiel jusqu’à l’espace
          copropriétaire, aux assemblées générales, aux travaux, à la
          comptabilité, aux relances et à la facturation.
        </p>

        <div style={styles.contextGrid}>
          <div style={styles.contextCard}>
            <span style={styles.contextLabel}>Démo principale</span>
            <strong style={styles.contextValue}>Copropriété #11</strong>
            <span style={styles.contextHint}>Scénario riche : AG, PV, convocations, travaux, documents.</span>
          </div>

          <div style={styles.contextCard}>
            <span style={styles.contextLabel}>Recette comptabilité</span>
            <strong style={styles.contextValue}>Copropriété #24</strong>
            <span style={styles.contextHint}>Utile pour vérifier l’import bancaire et les lignes importées.</span>
          </div>

          <div style={styles.contextCard}>
            <span style={styles.contextLabel}>Règle du sprint</span>
            <strong style={styles.contextValue}>Navigation uniquement</strong>
            <span style={styles.contextHint}>Aucun nouveau module lourd, aucune migration obligatoire.</span>
          </div>
        </div>
      </section>

      <section style={styles.demoGrid}>
        {DEMO_STEPS.map((step) => (
          <article key={step.order} style={styles.card}>
            <div style={styles.cardHeader}>
              <span style={styles.order}>{step.order}</span>
              {step.badge ? <span style={styles.badge}>{step.badge}</span> : null}
            </div>

            <h2 style={styles.cardTitle}>{step.title}</h2>
            <p style={styles.cardDescription}>{step.description}</p>

            <Link to={step.path} style={styles.cardLink}>
              {step.actionLabel}
            </Link>
          </article>
        ))}
      </section>

      <section style={styles.notesCard}>
        <h2 style={styles.notesTitle}>Phrase d’introduction recommandée</h2>
        <p style={styles.notesText}>
          “Je vais vous montrer le parcours complet d’une copropriété : d’abord
          le référentiel officiel, ensuite l’expérience du copropriétaire, puis
          le cycle AG avec présences, votes, convocations et preuves, avant de
          finir par les travaux, la comptabilité, les relances et la facturation.”
        </p>
      </section>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    display: "flex",
    flexDirection: "column",
    gap: 24,
  },
  hero: {
    borderRadius: 28,
    padding: "30px 32px",
    background:
      "linear-gradient(135deg, rgba(79,70,229,0.12), rgba(14,165,233,0.10)), #ffffff",
    border: "1px solid rgba(199,210,254,0.9)",
    boxShadow: "0 20px 60px rgba(15,23,42,0.08)",
  },
  eyebrow: {
    margin: 0,
    fontSize: 12,
    fontWeight: 900,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    color: "#4f46e5",
  },
  title: {
    margin: "10px 0 0",
    fontSize: 30,
    lineHeight: 1.15,
    color: "#0f172a",
  },
  subtitle: {
    maxWidth: 980,
    margin: "14px 0 0",
    fontSize: 15,
    lineHeight: 1.7,
    color: "#475569",
  },
  contextGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 12,
    marginTop: 22,
  },
  contextCard: {
    display: "flex",
    flexDirection: "column",
    gap: 5,
    padding: 16,
    borderRadius: 18,
    background: "rgba(255,255,255,0.78)",
    border: "1px solid rgba(226,232,240,0.95)",
  },
  contextLabel: {
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "#64748b",
  },
  contextValue: {
    fontSize: 16,
    color: "#0f172a",
  },
  contextHint: {
    fontSize: 13,
    lineHeight: 1.5,
    color: "#64748b",
  },
  demoGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
    gap: 16,
  },
  card: {
    minHeight: 230,
    display: "flex",
    flexDirection: "column",
    gap: 12,
    borderRadius: 24,
    padding: 22,
    background: "#ffffff",
    border: "1px solid #e5e7eb",
    boxShadow: "0 14px 36px rgba(15,23,42,0.06)",
  },
  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  order: {
    width: 44,
    height: 44,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    background: "#eef2ff",
    color: "#3730a3",
    fontWeight: 950,
  },
  badge: {
    padding: "7px 10px",
    borderRadius: 999,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    color: "#475569",
    fontSize: 12,
    fontWeight: 850,
  },
  cardTitle: {
    margin: 0,
    fontSize: 18,
    lineHeight: 1.25,
    color: "#0f172a",
  },
  cardDescription: {
    flex: 1,
    margin: 0,
    fontSize: 14,
    lineHeight: 1.65,
    color: "#64748b",
  },
  cardLink: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "flex-start",
    minHeight: 40,
    padding: "0 14px",
    borderRadius: 14,
    background: "#111827",
    color: "#ffffff",
    textDecoration: "none",
    fontSize: 13,
    fontWeight: 900,
  },
  notesCard: {
    borderRadius: 24,
    padding: 24,
    background: "#0f172a",
    color: "#ffffff",
    boxShadow: "0 18px 48px rgba(15,23,42,0.18)",
  },
  notesTitle: {
    margin: 0,
    fontSize: 18,
  },
  notesText: {
    margin: "10px 0 0",
    fontSize: 15,
    lineHeight: 1.8,
    color: "#e5e7eb",
  },
};
