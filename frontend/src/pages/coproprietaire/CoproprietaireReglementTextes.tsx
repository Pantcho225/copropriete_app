import type { CSSProperties } from "react";

type RuleCard = {
  title: string;
  description: string;
  icon: string;
  points: string[];
};

type TextCard = {
  title: string;
  description: string;
  status: string;
};

const ruleCards: RuleCard[] = [
  {
    title: "Vie commune",
    description:
      "Règles pratiques pour préserver le calme, la sécurité et le respect entre résidents.",
    icon: "🏡",
    points: [
      "Respecter les parties communes et les équipements collectifs.",
      "Éviter les nuisances sonores, surtout aux heures de repos.",
      "Signaler rapidement tout incident ou dégradation au syndic.",
    ],
  },
  {
    title: "Charges & cotisations",
    description:
      "Repères pour comprendre les appels de charges, paiements et relances.",
    icon: "💳",
    points: [
      "Consulter régulièrement vos appels de charges.",
      "Régler les cotisations dans les délais communiqués.",
      "Contacter le syndic en cas de désaccord ou de difficulté de paiement.",
    ],
  },
  {
    title: "Assemblées générales",
    description:
      "Informations utiles sur la présence, les votes et les mandats de représentation.",
    icon: "🗳️",
    points: [
      "Consulter les convocations et documents liés aux assemblées générales.",
      "Confirmer votre présence ou signaler votre absence depuis votre espace.",
      "Donner un mandat de représentation si vous ne pouvez pas participer.",
    ],
  },
  {
    title: "Travaux & entretien",
    description:
      "Suivi des décisions collectives, travaux validés et interventions dans la copropriété.",
    icon: "🛠️",
    points: [
      "Les travaux importants sont soumis à validation selon les règles de la copropriété.",
      "Les interventions peuvent être liées à une résolution votée en AG.",
      "Les informations utiles sont consultables depuis les modules dédiés.",
    ],
  },
];

const textCards: TextCard[] = [
  {
    title: "Règlement de copropriété",
    description:
      "Document de référence définissant les droits, obligations, lots, parties communes et règles collectives.",
    status: "À publier par le syndic",
  },
  {
    title: "Règlement intérieur",
    description:
      "Règles de vie quotidienne : bruit, propreté, sécurité, stationnement, usage des équipements et parties communes.",
    status: "Lecture seule",
  },
  {
    title: "Textes applicables",
    description:
      "Repères informatifs sur les règles encadrant la copropriété, à valider par les responsables compétents avant usage officiel.",
    status: "Information utile",
  },
  {
    title: "Documents administratifs",
    description:
      "Courriers, procès-verbaux, mandats, relances, avis et documents mis à disposition par le syndic.",
    status: "Disponible selon publication",
  },
];

export default function CoproprietaireReglementTextes() {
  return (
    <div style={styles.stack}>
      <section style={styles.hero}>
        <div style={styles.heroContent}>
          <div style={styles.heroBadge}>Lecture seule</div>

          <h2 style={styles.heroTitle}>Règlement & textes utiles</h2>

          <p style={styles.heroText}>
            Retrouvez ici les règles de vie, documents de référence et textes
            utiles liés à votre copropriété. Ces contenus sont mis à disposition
            par le syndic ou l’administration de la copropriété.
          </p>

          <div style={styles.heroMeta}>
            <span style={styles.metaPill}>Espace copropriétaire</span>
            <span style={styles.metaPill}>Consultation uniquement</span>
            <span style={styles.metaPill}>Règles de la copropriété</span>
          </div>
        </div>

        <div style={styles.secureBox}>
          <div style={styles.secureIcon}>📚</div>
          <p style={styles.secureTitle}>Information utile</p>
          <p style={styles.secureText}>
            Cette page aide les copropriétaires à retrouver les principaux repères
            liés à la vie collective, aux charges, aux assemblées générales et aux
            documents administratifs.
          </p>
        </div>
      </section>

      <section style={styles.noticeCard}>
        <div style={styles.noticeIcon}>ℹ️</div>
        <div>
          <p style={styles.noticeTitle}>Document d’information</p>
          <p style={styles.noticeText}>
            Les informations affichées ici ne remplacent pas les documents
            officiels signés ou publiés par le syndic. Les textes juridiques
            doivent être validés par les personnes compétentes avant usage
            officiel.
          </p>
        </div>
      </section>

      <section style={styles.grid}>
        {ruleCards.map((card) => (
          <article key={card.title} style={styles.ruleCard}>
            <div style={styles.ruleIcon}>{card.icon}</div>

            <div>
              <h3 style={styles.ruleTitle}>{card.title}</h3>
              <p style={styles.ruleDescription}>{card.description}</p>
            </div>

            <ul style={styles.pointsList}>
              {card.points.map((point) => (
                <li key={point} style={styles.pointItem}>
                  {point}
                </li>
              ))}
            </ul>
          </article>
        ))}
      </section>

      <section style={styles.card}>
        <div style={styles.sectionHeader}>
          <div>
            <p style={styles.sectionEyebrow}>Références</p>
            <h3 style={styles.sectionTitle}>Documents et textes à consulter</h3>
            <p style={styles.sectionText}>
              Cette zone prépare l’affichage des documents institutionnels utiles
              aux copropriétaires : règlement de copropriété, règlement intérieur,
              textes applicables et documents administratifs publiés.
            </p>
          </div>
        </div>

        <div style={styles.textGrid}>
          {textCards.map((item) => (
            <article key={item.title} style={styles.textCard}>
              <div style={styles.textCardHeader}>
                <h4 style={styles.textCardTitle}>{item.title}</h4>
                <span style={styles.statusPill}>{item.status}</span>
              </div>

              <p style={styles.textCardDescription}>{item.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section style={styles.card}>
        <div style={styles.sectionHeader}>
          <div>
            <p style={styles.sectionEyebrow}>Bonnes pratiques</p>
            <h3 style={styles.sectionTitle}>Ce que vous pouvez faire depuis votre espace</h3>
          </div>
        </div>

        <div style={styles.actionGrid}>
          <InfoLine
            title="Suivre vos cotisations"
            text="Consultez vos appels de charges, paiements et éventuelles relances depuis les pages dédiées."
          />
          <InfoLine
            title="Participer aux assemblées générales"
            text="Consultez les AG, confirmez votre présence, votez lorsque cela est ouvert ou donnez un mandat de représentation."
          />
          <InfoLine
            title="Consulter vos documents"
            text="Retrouvez les PV, courriers, documents administratifs et fichiers publiés pour votre profil."
          />
          <InfoLine
            title="Respecter le cadre collectif"
            text="Les règles de vie commune permettent de protéger la résidence, les équipements et les intérêts des copropriétaires."
          />
        </div>
      </section>
    </div>
  );
}

function InfoLine({ title, text }: { title: string; text: string }) {
  return (
    <div style={styles.infoLine}>
      <div style={styles.infoDot}>✓</div>
      <div>
        <p style={styles.infoTitle}>{title}</p>
        <p style={styles.infoText}>{text}</p>
      </div>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  stack: {
    display: "flex",
    flexDirection: "column",
    gap: 22,
  },

  hero: {
    borderRadius: 34,
    padding: 30,
    background:
      "linear-gradient(135deg, rgba(15,23,42,0.97), rgba(51,65,85,0.94)), radial-gradient(circle at top right, rgba(148,163,184,0.45), transparent 36%)",
    color: "white",
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) 320px",
    gap: 24,
    boxShadow: "0 30px 85px rgba(15,23,42,0.22)",
    overflow: "hidden",
  },

  heroContent: {
    minWidth: 0,
  },

  heroBadge: {
    display: "inline-flex",
    alignItems: "center",
    borderRadius: 999,
    padding: "7px 11px",
    background: "rgba(255,255,255,0.13)",
    border: "1px solid rgba(255,255,255,0.18)",
    color: "#e2e8f0",
    fontSize: 11,
    fontWeight: 950,
    letterSpacing: "0.14em",
    textTransform: "uppercase",
  },

  heroTitle: {
    margin: "14px 0 0",
    fontSize: 36,
    lineHeight: 1.08,
    fontWeight: 950,
    letterSpacing: "-0.04em",
  },

  heroText: {
    margin: "14px 0 0",
    maxWidth: 820,
    color: "#e2e8f0",
    fontSize: 15,
    lineHeight: 1.75,
    fontWeight: 550,
  },

  heroMeta: {
    display: "flex",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 22,
  },

  metaPill: {
    borderRadius: 999,
    padding: "8px 12px",
    background: "rgba(255,255,255,0.14)",
    border: "1px solid rgba(255,255,255,0.20)",
    color: "#ffffff",
    fontSize: 12,
    fontWeight: 850,
  },

  secureBox: {
    alignSelf: "stretch",
    borderRadius: 28,
    padding: 22,
    background: "rgba(255,255,255,0.13)",
    border: "1px solid rgba(255,255,255,0.22)",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.10)",
  },

  secureIcon: {
    width: 48,
    height: 48,
    borderRadius: 18,
    background: "rgba(255,255,255,0.14)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 22,
    marginBottom: 14,
  },

  secureTitle: {
    margin: 0,
    fontSize: 18,
    fontWeight: 950,
  },

  secureText: {
    margin: "10px 0 0",
    color: "#e2e8f0",
    fontSize: 14,
    lineHeight: 1.6,
  },

  noticeCard: {
    border: "1px solid #bfdbfe",
    borderRadius: 24,
    background: "#eff6ff",
    color: "#1e3a8a",
    padding: 18,
    display: "flex",
    gap: 13,
    alignItems: "flex-start",
    boxShadow: "0 16px 44px rgba(37,99,235,0.08)",
  },

  noticeIcon: {
    width: 38,
    height: 38,
    borderRadius: 14,
    background: "#dbeafe",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    fontSize: 18,
  },

  noticeTitle: {
    margin: 0,
    fontSize: 15,
    fontWeight: 950,
  },

  noticeText: {
    margin: "6px 0 0",
    fontSize: 13,
    lineHeight: 1.6,
    color: "#1d4ed8",
    fontWeight: 650,
  },

  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 16,
  },

  ruleCard: {
    border: "1px solid #e2e8f0",
    borderRadius: 28,
    background: "#ffffff",
    boxShadow: "0 18px 55px rgba(15,23,42,0.07)",
    padding: 22,
    display: "grid",
    gap: 14,
  },

  ruleIcon: {
    width: 52,
    height: 52,
    borderRadius: 20,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 24,
  },

  ruleTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: 20,
    fontWeight: 950,
    letterSpacing: "-0.02em",
  },

  ruleDescription: {
    margin: "8px 0 0",
    color: "#64748b",
    fontSize: 14,
    lineHeight: 1.6,
    fontWeight: 600,
  },

  pointsList: {
    margin: 0,
    paddingLeft: 18,
    color: "#475569",
    display: "grid",
    gap: 8,
  },

  pointItem: {
    fontSize: 13,
    lineHeight: 1.55,
    fontWeight: 650,
  },

  card: {
    border: "1px solid #e2e8f0",
    borderRadius: 28,
    background: "#ffffff",
    boxShadow: "0 18px 55px rgba(15,23,42,0.07)",
    padding: 22,
  },

  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 16,
    alignItems: "flex-start",
    flexWrap: "wrap",
    marginBottom: 18,
  },

  sectionEyebrow: {
    margin: 0,
    color: "#475569",
    fontSize: 11,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.12em",
  },

  sectionTitle: {
    margin: "6px 0 0",
    color: "#0f172a",
    fontSize: 22,
    fontWeight: 950,
    letterSpacing: "-0.03em",
  },

  sectionText: {
    margin: "8px 0 0",
    color: "#64748b",
    fontSize: 14,
    lineHeight: 1.6,
    maxWidth: 820,
  },

  textGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 14,
  },

  textCard: {
    border: "1px solid #e2e8f0",
    borderRadius: 22,
    background: "#f8fafc",
    padding: 16,
  },

  textCardHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "flex-start",
    flexWrap: "wrap",
  },

  textCardTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: 15,
    fontWeight: 950,
  },

  statusPill: {
    borderRadius: 999,
    padding: "5px 9px",
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    color: "#475569",
    fontSize: 11,
    fontWeight: 900,
    whiteSpace: "nowrap",
  },

  textCardDescription: {
    margin: "10px 0 0",
    color: "#64748b",
    fontSize: 13,
    lineHeight: 1.6,
    fontWeight: 600,
  },

  actionGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 12,
  },

  infoLine: {
    border: "1px solid #e2e8f0",
    borderRadius: 20,
    background: "#f8fafc",
    padding: 15,
    display: "flex",
    gap: 12,
    alignItems: "flex-start",
  },

  infoDot: {
    width: 28,
    height: 28,
    borderRadius: 999,
    background: "#ecfdf5",
    color: "#047857",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 13,
    fontWeight: 950,
    flexShrink: 0,
  },

  infoTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: 14,
    fontWeight: 950,
  },

  infoText: {
    margin: "6px 0 0",
    color: "#64748b",
    fontSize: 13,
    lineHeight: 1.55,
    fontWeight: 600,
  },
};