// frontend/src/pages/administration/ReunionsRencontres.tsx
import type { CSSProperties } from "react";

const examples = [
  {
    type: "Mairie",
    title: "Rencontre avec la mairie",
    detail:
      "Compte rendu d’échange avec une autorité municipale sur la vie de la copropriété.",
  },
  {
    type: "Ministère",
    title: "Rencontre institutionnelle",
    detail:
      "PV ou note de synthèse après échange avec une autorité ou un service de tutelle.",
  },
  {
    type: "Partenaire",
    title: "Réunion avec un prestataire ou promoteur",
    detail:
      "Historique des échanges, documents joints, décisions et points à suivre.",
  },
];

export default function ReunionsRencontres() {
  return (
    <div style={page}>
      <section style={hero}>
        <p style={eyebrow}>Réunions & rencontres</p>
        <h1 style={title}>Informer les copropriétaires après les rencontres importantes</h1>
        <p style={subtitle}>
          Ce module préparera l’historisation des rencontres avec une mairie, un
          ministère, une autorité, un promoteur ou un partenaire. Le syndic
          pourra téléverser un PV ou un compte rendu, puis publier l’information
          aux copropriétaires.
        </p>
      </section>

      <section style={grid}>
        {examples.map((item) => (
          <article key={item.title} style={card}>
            <span style={badge}>{item.type}</span>
            <h2 style={cardTitle}>{item.title}</h2>
            <p style={cardText}>{item.detail}</p>
          </article>
        ))}
      </section>

      <section style={panel}>
        <h2 style={panelTitle}>Fonctionnalités prévues</h2>
        <ul style={list}>
          <li>Créer une rencontre avec date, lieu, objet et interlocuteur.</li>
          <li>Joindre un PV, un compte rendu, un courrier ou un document officiel.</li>
          <li>Publier le document aux copropriétaires depuis le SaaS.</li>
          <li>Tracer la date de publication et les consultations futures.</li>
          <li>Séparer clairement ces rencontres des assemblées générales.</li>
        </ul>
      </section>
    </div>
  );
}

const page: CSSProperties = {
  display: "grid",
  gap: 24,
};

const hero: CSSProperties = {
  padding: 24,
  borderRadius: 24,
  border: "1px solid #e5e7eb",
  background:
    "linear-gradient(135deg, #ecfeff 0%, #f8fafc 55%, #ffffff 100%)",
};

const eyebrow: CSSProperties = {
  margin: 0,
  fontSize: 12,
  fontWeight: 900,
  letterSpacing: 0.8,
  textTransform: "uppercase",
  color: "#0891b2",
};

const title: CSSProperties = {
  margin: "8px 0 0",
  fontSize: 28,
  letterSpacing: -0.7,
};

const subtitle: CSSProperties = {
  margin: "12px 0 0",
  maxWidth: 880,
  fontSize: 15,
  lineHeight: 1.7,
  color: "#475569",
};

const grid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
  gap: 16,
};

const card: CSSProperties = {
  padding: 20,
  borderRadius: 22,
  border: "1px solid #e5e7eb",
  background: "#ffffff",
  boxShadow: "0 10px 24px rgba(15, 23, 42, 0.05)",
};

const badge: CSSProperties = {
  display: "inline-flex",
  padding: "5px 9px",
  borderRadius: 999,
  background: "#ecfeff",
  color: "#155e75",
  fontSize: 12,
  fontWeight: 900,
};

const cardTitle: CSSProperties = {
  margin: "12px 0 8px",
  fontSize: 16,
  fontWeight: 900,
};

const cardText: CSSProperties = {
  margin: 0,
  fontSize: 13,
  lineHeight: 1.6,
  color: "#64748b",
};

const panel: CSSProperties = {
  padding: 20,
  borderRadius: 22,
  border: "1px solid #e5e7eb",
  background: "#ffffff",
};

const panelTitle: CSSProperties = {
  margin: "0 0 12px",
  fontSize: 17,
  fontWeight: 900,
};

const list: CSSProperties = {
  margin: 0,
  paddingLeft: 20,
  color: "#475569",
  lineHeight: 1.8,
  fontSize: 14,
};