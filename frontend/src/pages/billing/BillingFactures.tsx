import { useNavigate } from "react-router-dom";
import type { CSSProperties } from "react";

export default function BillingFactures() {
  const navigate = useNavigate();

  return (
    <div style={pageStyle}>
      <section style={heroCard}>
        <div style={heroTextBlock}>
          <div style={eyebrow}>FACTURATION · FACTURES</div>
          <h1 style={title}>Factures</h1>
          <p style={subtitle}>
            Cette page prépare la gestion des factures émises, leur statut de
            traitement et les futurs indicateurs de suivi du module Facturation.
          </p>
        </div>

        <div style={heroActions}>
          <button type="button" style={primaryButton} onClick={() => navigate("/billing")}>
            Retour à la facturation
          </button>
          <button
            type="button"
            style={secondaryButton}
            onClick={() => navigate("/billing/abonnement")}
          >
            Voir l’abonnement
          </button>
        </div>
      </section>

      <section style={grid}>
        <article style={card}>
          <div style={cardLabel}>Factures émises</div>
          <div style={cardValue}>0</div>
          <p style={cardHelp}>
            Le volume réel des factures sera affiché ici lorsque le sous-module
            sera branché.
          </p>
        </article>

        <article style={card}>
          <div style={cardLabel}>En attente</div>
          <div style={cardValue}>0</div>
          <p style={cardHelp}>
            Les factures en attente de règlement ou de validation apparaîtront
            dans ce bloc.
          </p>
        </article>

        <article style={card}>
          <div style={cardLabel}>Statut du module</div>
          <div style={cardValue}>Préparation</div>
          <p style={cardHelp}>
            La vue est posée pour fermer proprement la navigation et préparer la
            suite fonctionnelle.
          </p>
        </article>
      </section>

      <section style={panel}>
        <h2 style={panelTitle}>Prévisions pour la suite</h2>
        <ul style={list}>
          <li>liste des factures avec filtres</li>
          <li>statuts de paiement</li>
          <li>références et périodes de facturation</li>
          <li>export ou impression</li>
          <li>indicateurs commerciaux et financiers</li>
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