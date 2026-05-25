import { useNavigate } from "react-router-dom";
import type { CSSProperties } from "react";

export default function BillingAbonnement() {
  const navigate = useNavigate();

  return (
    <div style={pageStyle}>
      <section style={heroCard}>
        <div style={heroTextBlock}>
          <div style={eyebrow}>FACTURATION · ABONNEMENT</div>
          <h1 style={title}>Abonnement</h1>
          <p style={subtitle}>
            Cette page prépare le pilotage du plan actif, des échéances, de la
            facturation d’abonnement et des prochaines évolutions commerciales.
          </p>
        </div>

        <div style={heroActions}>
          <button type="button" style={primaryButton} onClick={() => navigate("/billing")}>
            Retour à la facturation
          </button>
          <button type="button" style={secondaryButton} onClick={() => navigate("/")}>
            Aller au tableau de bord
          </button>
        </div>
      </section>

      <section style={grid}>
        <article style={card}>
          <div style={cardLabel}>Plan actuel</div>
          <div style={cardValue}>À définir</div>
          <p style={cardHelp}>
            Le plan d’abonnement actif sera affiché ici une fois le module
            finalisé.
          </p>
        </article>

        <article style={card}>
          <div style={cardLabel}>Échéance</div>
          <div style={cardValue}>Non renseignée</div>
          <p style={cardHelp}>
            La prochaine date de renouvellement ou d’expiration sera suivie dans
            ce bloc.
          </p>
        </article>

        <article style={card}>
          <div style={cardLabel}>Statut</div>
          <div style={cardValue}>Préparation</div>
          <p style={cardHelp}>
            Cette vue est en place pour stabiliser la navigation produit avant le
            branchement métier complet.
          </p>
        </article>
      </section>

      <section style={panel}>
        <h2 style={panelTitle}>Ce qui sera branché ensuite</h2>
        <ul style={list}>
          <li>plan actif et niveau d’offre</li>
          <li>échéance de renouvellement</li>
          <li>historique d’abonnement</li>
          <li>état de paiement du plan</li>
          <li>actions d’évolution ou de renouvellement</li>
        </ul>
      </section>
    </div>
  );
}

const pageStyle: CSSProperties = {
  display: "grid",
  gap: 20,
};

const heroCard: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 20,
  flexWrap: "wrap",
  padding: 24,
  borderRadius: 24,
  border: "1px solid #e2e8f0",
  background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
  boxShadow: "0 12px 30px rgba(15, 23, 42, 0.06)",
};

const heroTextBlock: CSSProperties = {
  maxWidth: 720,
};

const eyebrow: CSSProperties = {
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: 1.1,
  textTransform: "uppercase",
  color: "#64748b",
  marginBottom: 10,
};

const title: CSSProperties = {
  margin: 0,
  fontSize: 30,
  lineHeight: 1.1,
  fontWeight: 900,
  color: "#0f172a",
};

const subtitle: CSSProperties = {
  margin: "12px 0 0",
  fontSize: 14,
  lineHeight: 1.7,
  color: "#64748b",
  maxWidth: 680,
};

const heroActions: CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
};

const primaryButton: CSSProperties = {
  border: "1px solid #c7d2fe",
  background: "#eef2ff",
  color: "#3730a3",
  borderRadius: 12,
  padding: "12px 14px",
  fontWeight: 800,
  cursor: "pointer",
};

const secondaryButton: CSSProperties = {
  border: "1px solid #e2e8f0",
  background: "#ffffff",
  color: "#0f172a",
  borderRadius: 12,
  padding: "12px 14px",
  fontWeight: 800,
  cursor: "pointer",
};

const grid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 16,
};

const card: CSSProperties = {
  padding: 20,
  borderRadius: 20,
  border: "1px solid #e2e8f0",
  background: "#ffffff",
  boxShadow: "0 8px 24px rgba(15, 23, 42, 0.05)",
};

const cardLabel: CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  color: "#64748b",
  textTransform: "uppercase",
  letterSpacing: 0.5,
};

const cardValue: CSSProperties = {
  marginTop: 10,
  fontSize: 22,
  fontWeight: 900,
  color: "#0f172a",
};

const cardHelp: CSSProperties = {
  marginTop: 10,
  fontSize: 13,
  lineHeight: 1.6,
  color: "#64748b",
};

const panel: CSSProperties = {
  padding: 22,
  borderRadius: 22,
  border: "1px solid #e2e8f0",
  background: "#ffffff",
};

const panelTitle: CSSProperties = {
  margin: 0,
  fontSize: 18,
  fontWeight: 900,
  color: "#0f172a",
};

const list: CSSProperties = {
  margin: "14px 0 0",
  paddingLeft: 18,
  color: "#475569",
  lineHeight: 1.8,
  fontSize: 14,
};