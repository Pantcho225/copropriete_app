// frontend/src/pages/administration/ReunionsRencontres.tsx
import type { CSSProperties } from "react";

const categories = [
  {
    label: "Conseil syndical",
    title: "Réunions internes de pilotage",
    text: "Suivi des points courants, priorités du syndic, impayés sensibles et préparation des sujets importants.",
    examples: ["Point mensuel", "Suivi des charges", "Préparation d’une future AG"],
  },
  {
    label: "Copropriétaires",
    title: "Réunions d’information et de concertation",
    text: "Information, écoute et concertation avec les copropriétaires sans ouvrir un processus formel d’AG.",
    examples: ["Nuisances", "Sécurité", "Concertation avant travaux"],
  },
  {
    label: "Prestataires",
    title: "Rencontres avec fournisseurs et intervenants",
    text: "Traçage des échanges avec entreprises, techniciens, promoteurs, gardiennage, nettoyage ou maintenance.",
    examples: ["Négociation devis", "Suivi intervention", "Réception de travaux"],
  },
  {
    label: "Médiations",
    title: "Gestion des conflits et situations sensibles",
    text: "Documentation des échanges visant à résoudre un litige, une nuisance ou un désaccord.",
    examples: ["Conflit voisinage", "Occupation abusive", "Désaccord sur charges"],
  },
  {
    label: "Visites techniques",
    title: "Constats, diagnostics et visites de terrain",
    text: "Suivi des inspections, visites de chantier, diagnostics, constats techniques et interventions sur site.",
    examples: ["Fuite d’eau", "Ascenseur", "Parking ou toiture"],
  },
  {
    label: "Institutionnelles",
    title: "Rencontres avec autorités et administrations",
    text: "Historique des échanges avec mairie, ministère, cadastre, notaire ou autorité publique.",
    examples: ["Mairie", "Cadastre", "Service administratif"],
  },
];

const workflow = [
  "Brouillon : préparer l’objet, le type, les participants et les documents utiles.",
  "Planifiée : confirmer la date, le lieu et les personnes concernées.",
  "Tenue : indiquer que la réunion a eu lieu.",
  "Compte rendu : ajouter une synthèse, une note, un courrier ou un document.",
  "Publiée : rendre l’information visible aux copropriétaires si nécessaire.",
];

const actions = [
  "Demander un nouveau devis à un prestataire.",
  "Relancer une administration ou une mairie.",
  "Programmer une visite technique.",
  "Préparer une note d’information aux copropriétaires.",
  "Identifier les sujets à inscrire dans une future AG.",
];

export default function ReunionsRencontres() {
  return (
    <div className="adminHarmonizedPage adminMeetingsPage" style={styles.page}>
      <section className="adminHarmonizedHero adminHarmonizedHero--cyan" style={styles.hero}>
        <div>
          <p style={styles.eyebrow}>Réunions & rencontres</p>
          <h1 style={styles.title}>Suivre les réunions courantes de la copropriété</h1>
          <p style={styles.subtitle}>
            Ce module couvre les réunions du conseil syndical, les échanges entre
            copropriétaires, les rencontres avec prestataires, les médiations, les
            visites techniques et les rencontres institutionnelles. Il sert à
            historiser les échanges, joindre des documents, produire des comptes
            rendus et suivre les actions décidées.
          </p>
        </div>

        <aside className="adminHarmonizedNotice" style={styles.notice}>
          <strong>Séparation métier</strong>
          <span>
            Les Assemblées Générales restent dans le module AG : convocations,
            quorum, votes, résolutions et PV officiel.
          </span>
        </aside>
      </section>

      <section className="adminHarmonizedStatsGrid" style={styles.kpiGrid}>
        <article className="adminHarmonizedStatCard" style={styles.kpiCard}>
          <strong style={styles.kpiValue}>6</strong>
          <span style={styles.kpiLabel}>familles de réunions</span>
        </article>
        <article className="adminHarmonizedStatCard" style={styles.kpiCard}>
          <strong style={styles.kpiValue}>0</strong>
          <span style={styles.kpiLabel}>vote ou quorum ici</span>
        </article>
        <article className="adminHarmonizedStatCard" style={styles.kpiCard}>
          <strong style={styles.kpiValue}>AG</strong>
          <span style={styles.kpiLabel}>lien facultatif uniquement</span>
        </article>
      </section>

      <section className="adminHarmonizedCardGrid" style={styles.grid}>
        {categories.map((item) => (
          <article className="adminHarmonizedCard" key={item.label} style={styles.card}>
            <span style={styles.badge}>{item.label}</span>
            <h2 style={styles.cardTitle}>{item.title}</h2>
            <p style={styles.cardText}>{item.text}</p>
            <ul style={styles.miniList}>
              {item.examples.map((example) => (
                <li key={example}>{example}</li>
              ))}
            </ul>
          </article>
        ))}
      </section>

      <section className="adminHarmonizedTwoColumns" style={styles.twoColumns}>
        <article className="adminHarmonizedPanel" style={styles.panel}>
          <h2 style={styles.panelTitle}>Cycle de suivi recommandé</h2>
          <ol style={styles.list}>
            {workflow.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </article>

        <article className="adminHarmonizedPanel" style={styles.panel}>
          <h2 style={styles.panelTitle}>Actions à suivre</h2>
          <p style={styles.panelText}>
            Une réunion courante peut produire des tâches opérationnelles sans
            créer obligatoirement une résolution d’AG.
          </p>
          <ul style={styles.list}>
            {actions.map((action) => (
              <li key={action}>{action}</li>
            ))}
          </ul>
        </article>
      </section>

      <section className="adminHarmonizedTwoColumns" style={styles.twoColumns}>
        <article className="adminHarmonizedPanel adminHarmonizedPanel--soft" style={styles.panelSoft}>
          <h2 style={styles.panelTitle}>Ce module gère</h2>
          <ul style={styles.list}>
            <li>les réunions courantes de copropriété ;</li>
            <li>les rencontres avec prestataires et institutions ;</li>
            <li>les médiations et visites techniques ;</li>
            <li>les comptes rendus, documents joints et actions à suivre.</li>
          </ul>
        </article>

        <article className="adminHarmonizedPanel adminHarmonizedPanel--soft" style={styles.panelSoft}>
          <h2 style={styles.panelTitle}>Le module AG garde</h2>
          <ul style={styles.list}>
            <li>les convocations officielles ;</li>
            <li>le quorum et les présences formelles ;</li>
            <li>les votes et résolutions ;</li>
            <li>le PV officiel d’Assemblée Générale.</li>
          </ul>
        </article>
      </section>

      <section className="adminHarmonizedPanel" style={styles.panel}>
        <h2 style={styles.panelTitle}>Fonctionnalités prévues</h2>
        <ul style={styles.list}>
          <li>Créer une réunion avec type, date, lieu, objet et participants.</li>
          <li>Ajouter un ordre du jour libre sans obligation de résolution AG.</li>
          <li>Joindre un compte rendu, un PV simple, une note ou un courrier.</li>
          <li>Publier ou non l’information dans l’espace copropriétaire.</li>
          <li>Tracer les actions à suivre, responsables, échéances et statuts.</li>
          <li>Lier facultativement une réunion à une AG, un dossier travaux ou un prestataire.</li>
        </ul>
      </section>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  page: { display: "grid", gap: 24 },
  hero: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) minmax(260px, 360px)",
    gap: 20,
    padding: 24,
    borderRadius: 24,
    border: "1px solid #e5e7eb",
    background: "linear-gradient(135deg, #ecfeff 0%, #f8fafc 55%, #ffffff 100%)",
  },
  eyebrow: {
    margin: 0,
    fontSize: 12,
    fontWeight: 900,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: "#0891b2",
  },
  title: { margin: "8px 0 0", fontSize: 28, letterSpacing: -0.7 },
  subtitle: {
    margin: "12px 0 0",
    maxWidth: 920,
    fontSize: 15,
    lineHeight: 1.7,
    color: "#475569",
  },
  notice: {
    display: "grid",
    gap: 8,
    alignSelf: "start",
    padding: 16,
    borderRadius: 18,
    border: "1px solid #bae6fd",
    background: "rgba(255, 255, 255, 0.82)",
    color: "#475569",
    fontSize: 13,
    lineHeight: 1.6,
  },
  kpiGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
    gap: 14,
  },
  kpiCard: {
    display: "grid",
    gap: 4,
    padding: 18,
    borderRadius: 20,
    border: "1px solid #e5e7eb",
    background: "#ffffff",
  },
  kpiValue: { fontSize: 24, fontWeight: 900, color: "#0f172a" },
  kpiLabel: { fontSize: 13, color: "#64748b" },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
    gap: 16,
  },
  card: {
    padding: 20,
    borderRadius: 22,
    border: "1px solid #e5e7eb",
    background: "#ffffff",
    boxShadow: "0 10px 24px rgba(15, 23, 42, 0.05)",
  },
  badge: {
    display: "inline-flex",
    padding: "5px 9px",
    borderRadius: 999,
    background: "#ecfeff",
    color: "#155e75",
    fontSize: 12,
    fontWeight: 900,
  },
  cardTitle: { margin: "12px 0 8px", fontSize: 16, fontWeight: 900 },
  cardText: { margin: 0, fontSize: 13, lineHeight: 1.6, color: "#64748b" },
  miniList: {
    margin: "12px 0 0",
    paddingLeft: 18,
    color: "#475569",
    lineHeight: 1.7,
    fontSize: 13,
  },
  twoColumns: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
    gap: 16,
  },
  panel: {
    padding: 20,
    borderRadius: 22,
    border: "1px solid #e5e7eb",
    background: "#ffffff",
  },
  panelSoft: {
    padding: 20,
    borderRadius: 22,
    border: "1px solid #e5e7eb",
    background: "#f8fafc",
  },
  panelTitle: { margin: "0 0 12px", fontSize: 17, fontWeight: 900 },
  panelText: {
    margin: "0 0 12px",
    color: "#64748b",
    lineHeight: 1.7,
    fontSize: 14,
  },
  list: {
    margin: 0,
    paddingLeft: 20,
    color: "#475569",
    lineHeight: 1.8,
    fontSize: 14,
  },
};

