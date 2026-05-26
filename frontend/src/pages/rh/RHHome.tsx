import type { CSSProperties, ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";

type StatTone = "blue" | "green" | "yellow" | "purple" | "neutral";

type StatCardProps = {
  label: string;
  value: string;
  description: string;
  tone: StatTone;
};

type QuickActionProps = {
  title: string;
  description: string;
  to: string;
  label: string;
  tone?: StatTone;
};

function getTone(tone: StatTone) {
  if (tone === "blue") {
    return {
      bg: "#eff6ff",
      border: "#bfdbfe",
      text: "#1d4ed8",
      strong: "#1e3a8a",
    };
  }

  if (tone === "green") {
    return {
      bg: "#ecfdf5",
      border: "#a7f3d0",
      text: "#166534",
      strong: "#14532d",
    };
  }

  if (tone === "yellow") {
    return {
      bg: "#fffbeb",
      border: "#fde68a",
      text: "#92400e",
      strong: "#78350f",
    };
  }

  if (tone === "purple") {
    return {
      bg: "#f5f3ff",
      border: "#ddd6fe",
      text: "#6d28d9",
      strong: "#4c1d95",
    };
  }

  return {
    bg: "#f8fafc",
    border: "#e2e8f0",
    text: "#475569",
    strong: "#0f172a",
  };
}

function PageShell({ children }: { children: ReactNode }) {
  return <div style={pageShell}>{children}</div>;
}

function AppButton(props: {
  children: ReactNode;
  to: string;
  primary?: boolean;
}) {
  return (
    <Link
      to={props.to}
      style={{
        border: props.primary ? "1px solid #c7d2fe" : "1px solid #e5e7eb",
        background: props.primary ? "#eef2ff" : "#ffffff",
        color: props.primary ? "#3730a3" : "#111827",
        borderRadius: 12,
        padding: "11px 15px",
        fontSize: 13,
        fontWeight: 800,
        textDecoration: "none",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        whiteSpace: "nowrap",
      }}
    >
      {props.children}
    </Link>
  );
}

function StatCard({ label, value, description, tone }: StatCardProps) {
  const colors = getTone(tone);

  return (
    <div
      style={{
        ...card,
        background: colors.bg,
        border: `1px solid ${colors.border}`,
      }}
    >
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          alignSelf: "flex-start",
          border: `1px solid ${colors.border}`,
          background: "#ffffff",
          color: colors.text,
          borderRadius: 999,
          padding: "5px 10px",
          fontSize: 11.5,
          fontWeight: 900,
          textTransform: "uppercase",
          letterSpacing: 0.4,
        }}
      >
        {label}
      </div>

      <div
        style={{
          marginTop: 12,
          fontSize: 30,
          fontWeight: 900,
          color: colors.strong,
          lineHeight: 1.1,
        }}
      >
        {value}
      </div>

      <p style={cardDescription}>{description}</p>
    </div>
  );
}

function QuickAction({ title, description, to, label, tone = "neutral" }: QuickActionProps) {
  const colors = getTone(tone);

  return (
    <div style={quickCard}>
      <div>
        <h3 style={quickTitle}>{title}</h3>
        <p style={quickDescription}>{description}</p>
      </div>

      <Link
        to={to}
        style={{
          border: `1px solid ${colors.border}`,
          background: colors.bg,
          color: colors.strong,
          borderRadius: 12,
          padding: "10px 14px",
          fontSize: 13,
          fontWeight: 800,
          textDecoration: "none",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: "fit-content",
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </Link>
    </div>
  );
}

function InfoBox(props: {
  title: string;
  children: ReactNode;
  tone?: StatTone;
}) {
  const colors = getTone(props.tone ?? "neutral");

  return (
    <div
      style={{
        border: `1px solid ${colors.border}`,
        background: colors.bg,
        borderRadius: 16,
        padding: 15,
        minWidth: 0,
      }}
    >
      <div
        style={{
          fontSize: 13,
          fontWeight: 900,
          color: colors.strong,
          marginBottom: 6,
        }}
      >
        {props.title}
      </div>

      <div
        style={{
          fontSize: 13,
          color: colors.text,
          lineHeight: 1.55,
        }}
      >
        {props.children}
      </div>
    </div>
  );
}

export default function RHHome() {
  const navigate = useNavigate();

  return (
    <PageShell>
      <section style={heroCard}>
        <div style={heroGlow} />

        <div style={heroGrid}>
          <div style={heroMain}>
            <div style={eyebrow}>Ressources humaines</div>

            <h1 style={heroTitle}>
              Pilotez vos employés, contrats et affectations avec une vision claire.
            </h1>

            <p style={heroSubtitle}>
              Le module RH centralise le suivi des employés, la gestion des contrats,
              les statuts d’activité et les informations utiles à la bonne administration
              de la copropriété.
            </p>

            <div style={heroActions}>
              <AppButton to="/rh/employes" primary>
                Voir les employés
              </AppButton>

              <AppButton to="/rh/contrats">Voir les contrats</AppButton>
            </div>
          </div>

          <div style={heroAside}>
            <div style={heroAsideTitle}>Lecture RH</div>

            <div style={heroAsideText}>
              Cette vue sert de cockpit pour suivre l’organisation humaine de la copropriété :
              employés actifs, contrats, échéances et priorités de consolidation.
            </div>

            <div style={heroAsideActions}>
              <button
                type="button"
                onClick={() => navigate("/rh/employes/nouveau")}
                style={asideButton}
              >
                Nouvel employé
              </button>

              <button
                type="button"
                onClick={() => navigate("/rh/contrats/nouveau")}
                style={asideButton}
              >
                Nouveau contrat
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="rh-stats-grid" style={statsGrid}>
        <StatCard
          label="Effectif"
          value="—"
          description="Nombre total d’employés enregistrés dans la copropriété active."
          tone="blue"
        />

        <StatCard
          label="Actifs"
          value="—"
          description="Employés actuellement actifs et disponibles pour les opérations courantes."
          tone="green"
        />

        <StatCard
          label="Contrats"
          value="—"
          description="Contrats enregistrés, en cours, terminés ou à venir."
          tone="purple"
        />

        <StatCard
          label="À surveiller"
          value="—"
          description="Contrats proches de leur échéance ou informations nécessitant une vérification."
          tone="yellow"
        />
      </section>

      <section style={panel}>
        <div style={panelHeader}>
          <div>
            <h2 style={panelTitle}>Accès rapides RH</h2>
            <p style={panelSubtitle}>
              Ouvrez directement les deux écrans métier principaux du module Ressources humaines.
            </p>
          </div>
        </div>

        <div className="rh-quick-grid" style={quickGrid}>
          <QuickAction
            title="Gestion des employés"
            description="Consultez la liste des employés, ajoutez un nouveau profil, modifiez les informations ou désactivez un employé."
            to="/rh/employes"
            label="Ouvrir les employés"
            tone="blue"
          />

          <QuickAction
            title="Gestion des contrats"
            description="Suivez les contrats de travail, les périodes, les montants, les statuts et les clôtures."
            to="/rh/contrats"
            label="Ouvrir les contrats"
            tone="purple"
          />
        </div>
      </section>

      <section style={panel}>
        <div style={panelHeader}>
          <div>
            <h2 style={panelTitle}>Priorités de consolidation RH</h2>
            <p style={panelSubtitle}>
              Points à maintenir pour garder le module RH cohérent avec le niveau premium de l’application.
            </p>
          </div>
        </div>

        <div className="rh-priority-grid" style={priorityGrid}>
          <InfoBox title="Wording produit" tone="blue">
            Harmoniser les libellés : employés, contrats, statuts, rôles et messages d’action.
          </InfoBox>

          <InfoBox title="Cohérence visuelle" tone="green">
            Aligner le module RH avec le niveau premium des modules AG, Relances, Comptabilité et Travaux.
          </InfoBox>

          <InfoBox title="Stabilité technique" tone="yellow">
            Vérifier routes, endpoints, hooks, lint, build et comportements d’activation ou de clôture.
          </InfoBox>
        </div>
      </section>

      <section style={infoStrip}>
        <div style={infoStripTitle}>Positionnement produit</div>
        <div style={infoStripText}>
          Le module RH complète la vision opérationnelle de la copropriété en ajoutant le suivi
          des ressources humaines, des contrats et des responsabilités terrain.
        </div>
      </section>

      <style>{`
        @media (max-width: 1180px) {
          .rh-stats-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }

          .rh-quick-grid {
            grid-template-columns: 1fr !important;
          }

          .rh-priority-grid {
            grid-template-columns: 1fr !important;
          }
        }

        @media (max-width: 900px) {
          .rh-hero-grid {
            grid-template-columns: 1fr !important;
          }
        }

        @media (max-width: 680px) {
          .rh-stats-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </PageShell>
  );
}

const pageShell: CSSProperties = {
  display: "grid",
  gap: 18,
  width: "100%",
  minWidth: 0,
};

const heroCard: CSSProperties = {
  background:
    "linear-gradient(135deg, rgba(15,23,42,0.98) 0%, rgba(30,41,59,0.96) 55%, rgba(37,99,235,0.9) 100%)",
  borderRadius: 28,
  padding: "28px 30px",
  color: "#ffffff",
  boxShadow: "0 30px 70px rgba(15,23,42,0.18)",
  position: "relative",
  overflow: "hidden",
  minWidth: 0,
};

const heroGlow: CSSProperties = {
  position: "absolute",
  inset: "auto -120px -140px auto",
  width: 280,
  height: 280,
  borderRadius: "50%",
  background:
    "radial-gradient(circle, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0) 72%)",
  pointerEvents: "none",
};

const heroGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1.2fr) minmax(260px, 0.8fr)",
  gap: 18,
  alignItems: "stretch",
  minWidth: 0,
};

const heroMain: CSSProperties = {
  minWidth: 0,
  position: "relative",
  zIndex: 1,
};

const eyebrow: CSSProperties = {
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: 0.9,
  textTransform: "uppercase",
  color: "rgba(255,255,255,0.72)",
  marginBottom: 8,
};

const heroTitle: CSSProperties = {
  margin: 0,
  fontSize: 32,
  lineHeight: 1.12,
  fontWeight: 900,
  letterSpacing: -0.6,
  color: "#ffffff",
  maxWidth: 860,
};

const heroSubtitle: CSSProperties = {
  margin: "12px 0 0",
  color: "rgba(255,255,255,0.84)",
  fontSize: 14,
  lineHeight: 1.65,
  maxWidth: 860,
};

const heroActions: CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
  marginTop: 20,
};

const heroAside: CSSProperties = {
  position: "relative",
  zIndex: 1,
  borderRadius: 20,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.08)",
  padding: 16,
  display: "grid",
  gap: 10,
  alignContent: "start",
  minWidth: 0,
};

const heroAsideTitle: CSSProperties = {
  fontSize: 13,
  fontWeight: 900,
  color: "#ffffff",
  textTransform: "uppercase",
  letterSpacing: 0.5,
};

const heroAsideText: CSSProperties = {
  fontSize: 12.5,
  lineHeight: 1.6,
  color: "rgba(255,255,255,0.84)",
};

const heroAsideActions: CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  marginTop: 4,
};

const asideButton: CSSProperties = {
  border: "1px solid rgba(255,255,255,0.28)",
  background: "rgba(255,255,255,0.1)",
  color: "#ffffff",
  borderRadius: 12,
  padding: "9px 12px",
  fontSize: 12.5,
  fontWeight: 800,
  cursor: "pointer",
};

const statsGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
  gap: 12,
  minWidth: 0,
};

const card: CSSProperties = {
  borderRadius: 20,
  padding: 17,
  minHeight: 126,
  display: "grid",
  alignContent: "start",
  boxShadow: "0 8px 24px rgba(15, 23, 42, 0.04)",
  minWidth: 0,
};

const cardDescription: CSSProperties = {
  margin: "8px 0 0",
  fontSize: 13,
  lineHeight: 1.55,
  color: "#64748b",
};

const panel: CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 22,
  background: "#ffffff",
  boxShadow: "0 16px 40px rgba(15, 23, 42, 0.05)",
  padding: 18,
  minWidth: 0,
};

const panelHeader: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
  alignItems: "flex-start",
  marginBottom: 14,
};

const panelTitle: CSSProperties = {
  margin: 0,
  fontSize: 18,
  fontWeight: 900,
  color: "#111827",
};

const panelSubtitle: CSSProperties = {
  margin: "6px 0 0",
  color: "#64748b",
  fontSize: 13,
  lineHeight: 1.5,
};

const quickGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 12,
};

const quickCard: CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 18,
  background: "#ffffff",
  padding: 16,
  minWidth: 0,
  display: "grid",
  gap: 12,
  boxShadow: "0 8px 24px rgba(15, 23, 42, 0.04)",
};

const quickTitle: CSSProperties = {
  margin: 0,
  fontSize: 15,
  fontWeight: 900,
  color: "#111827",
};

const quickDescription: CSSProperties = {
  margin: "7px 0 0",
  fontSize: 13,
  color: "#64748b",
  lineHeight: 1.55,
};

const priorityGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: 12,
};

const infoStrip: CSSProperties = {
  border: "1px solid #bfdbfe",
  background: "#eff6ff",
  borderRadius: 18,
  padding: "14px 16px",
  minWidth: 0,
};

const infoStripTitle: CSSProperties = {
  fontSize: 13,
  fontWeight: 900,
  color: "#1e3a8a",
  marginBottom: 4,
};

const infoStripText: CSSProperties = {
  fontSize: 13,
  color: "#1d4ed8",
  lineHeight: 1.6,
  fontWeight: 600,
};