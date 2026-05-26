import { useNavigate } from "react-router-dom";
import type { CSSProperties, ReactNode } from "react";

type StatTone = "blue" | "green" | "yellow" | "neutral";

function PageShell({ children }: { children: ReactNode }) {
  return <div style={pageStyle}>{children}</div>;
}

function SectionTitle(props: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
}) {
  return (
    <section style={heroCard}>
      <div style={heroTextBlock}>
        <div style={eyebrow}>Facturation · Factures</div>

        <h1 style={title}>{props.title}</h1>

        {props.subtitle ? <p style={subtitle}>{props.subtitle}</p> : null}
      </div>

      {props.right ? <div style={heroActions}>{props.right}</div> : null}
    </section>
  );
}

function ActionButton(props: {
  children: ReactNode;
  onClick?: () => void;
  primary?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      disabled={props.disabled}
      style={{
        border: props.primary ? "1px solid #c7d2fe" : "1px solid #e2e8f0",
        background: props.disabled
          ? "#f3f4f6"
          : props.primary
            ? "#eef2ff"
            : "#ffffff",
        color: props.disabled ? "#9ca3af" : props.primary ? "#3730a3" : "#0f172a",
        borderRadius: 12,
        padding: "12px 14px",
        fontWeight: 800,
        cursor: props.disabled ? "not-allowed" : "pointer",
        whiteSpace: "nowrap",
      }}
    >
      {props.children}
    </button>
  );
}

function StatCard(props: {
  title: string;
  value: string;
  sub: string;
  tone?: StatTone;
}) {
  const tone = props.tone ?? "neutral";

  const toneMap: Record<StatTone, { border: string; bg: string; accent: string }> = {
    blue: {
      border: "#bfdbfe",
      bg: "#eff6ff",
      accent: "#1d4ed8",
    },
    green: {
      border: "#a7f3d0",
      bg: "#ecfdf5",
      accent: "#166534",
    },
    yellow: {
      border: "#fde68a",
      bg: "#fffbeb",
      accent: "#92400e",
    },
    neutral: {
      border: "#e2e8f0",
      bg: "#ffffff",
      accent: "#0f172a",
    },
  };

  return (
    <article
      style={{
        ...card,
        border: `1px solid ${toneMap[tone].border}`,
        background: toneMap[tone].bg,
      }}
    >
      <div style={cardLabel}>{props.title}</div>
      <div style={{ ...cardValue, color: toneMap[tone].accent }}>
        {props.value}
      </div>
      <p style={cardHelp}>{props.sub}</p>
    </article>
  );
}

function Panel(props: { title: string; children: ReactNode }) {
  return (
    <section style={panel}>
      <h2 style={panelTitle}>{props.title}</h2>
      {props.children}
    </section>
  );
}

function InfoBox(props: { title: string; children: ReactNode }) {
  return (
    <div style={infoBox}>
      <div style={infoTitle}>{props.title}</div>
      <div style={infoText}>{props.children}</div>
    </div>
  );
}

export default function BillingFactures() {
  const navigate = useNavigate();

  return (
    <PageShell>
      <SectionTitle
        title="Factures"
        subtitle="Préparez le suivi des factures émises, de leurs statuts de traitement et des prochains indicateurs économiques du module Facturation."
        right={
          <>
            <ActionButton onClick={() => navigate("/billing")}>
              Vue d’ensemble
            </ActionButton>

            <ActionButton onClick={() => navigate("/billing/abonnement")} primary>
              Voir l’abonnement
            </ActionButton>
          </>
        }
      />

      <section style={grid}>
        <StatCard
          title="Factures émises"
          value="0"
          sub="Le volume réel des factures sera affiché ici lorsque le sous-module sera branché au backend."
          tone="blue"
        />

        <StatCard
          title="En attente"
          value="0"
          sub="Les factures en attente de règlement ou de validation apparaîtront dans ce bloc."
          tone="yellow"
        />

        <StatCard
          title="Réglées"
          value="0"
          sub="Les factures soldées permettront de suivre la performance de recouvrement."
          tone="green"
        />

        <StatCard
          title="Statut du module"
          value="Préparation"
          sub="La vue est prête pour accueillir la liste détaillée, les filtres et les exports."
          tone="neutral"
        />
      </section>

      <Panel title="Prévisions fonctionnelles">
        <div style={featureGrid}>
          <InfoBox title="Liste des factures">
            Affichage des factures émises avec numéro, période, montant, statut,
            date d’émission et date d’échéance.
          </InfoBox>

          <InfoBox title="Statuts de paiement">
            Suivi des factures en attente, réglées, partiellement réglées ou
            échues.
          </InfoBox>

          <InfoBox title="Exports et impression">
            Préparation des actions d’export PDF, impression et téléchargement
            des factures.
          </InfoBox>

          <InfoBox title="Indicateurs économiques">
            Synthèse des montants facturés, encaissés, en attente et en retard.
          </InfoBox>
        </div>
      </Panel>

      <Panel title="Lecture produit">
        <p style={paragraph}>
          Cette page sert de base premium au futur sous-module des factures. Elle
          ferme proprement la navigation actuelle tout en préparant l’intégration
          des vraies données de facturation lorsque le backend sera enrichi.
        </p>
      </Panel>

      <style>{`
        .billing-factures-placeholder {
          display: none;
        }

        @media (max-width: 1200px) {
          .billing-factures-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }
        }

        @media (max-width: 760px) {
          .billing-factures-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </PageShell>
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

const grid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
  gap: 16,
};

const card: CSSProperties = {
  padding: 20,
  borderRadius: 20,
  boxShadow: "0 8px 24px rgba(15, 23, 42, 0.05)",
  minWidth: 0,
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
  boxShadow: "0 8px 24px rgba(15, 23, 42, 0.04)",
};

const panelTitle: CSSProperties = {
  margin: 0,
  fontSize: 18,
  fontWeight: 900,
  color: "#0f172a",
};

const featureGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 12,
  marginTop: 16,
};

const infoBox: CSSProperties = {
  padding: 14,
  borderRadius: 16,
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
};

const infoTitle: CSSProperties = {
  fontSize: 13,
  fontWeight: 900,
  color: "#0f172a",
  marginBottom: 6,
};

const infoText: CSSProperties = {
  fontSize: 13,
  color: "#64748b",
  lineHeight: 1.55,
};

const paragraph: CSSProperties = {
  margin: "12px 0 0",
  fontSize: 14,
  lineHeight: 1.7,
  color: "#475569",
};