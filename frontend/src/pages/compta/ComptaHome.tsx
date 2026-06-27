import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import type { CSSProperties, ReactNode } from "react";
import { APP_TEXT } from "../../constants/appText";
import BackButton from "../../components/ui/BackButton";

type ToneKind = "neutral" | "success" | "warning" | "info";

function getTone(kind: ToneKind) {
  if (kind === "success") {
    return {
      softBg: "#ecfdf5",
      border: "#86efac",
      text: "#166534",
      strongText: "#14532d",
      accentBg: "#dcfce7",
      accentText: "#166534",
    };
  }

  if (kind === "warning") {
    return {
      softBg: "#fffbeb",
      border: "#fcd34d",
      text: "#92400e",
      strongText: "#78350f",
      accentBg: "#fef3c7",
      accentText: "#92400e",
    };
  }

  if (kind === "info") {
    return {
      softBg: "#eff6ff",
      border: "#93c5fd",
      text: "#1d4ed8",
      strongText: "#1e3a8a",
      accentBg: "#dbeafe",
      accentText: "#1d4ed8",
    };
  }

  return {
    softBg: "#f8fafc",
    border: "#e2e8f0",
    text: "#475569",
    strongText: "#0f172a",
    accentBg: "#f1f5f9",
    accentText: "#475569",
  };
}

function PageShell({ children }: { children: ReactNode }) {
  return <div style={pageShell}>{children}</div>;
}

function HeroHeader(props: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  backTo?: string;
  backLabel?: string;
}) {
  return (
    <section style={heroCard}>
      <div style={heroGlow} />

      <div style={heroHeader}>
        <div style={heroTextBlock}>
          {props.backTo || props.backLabel ? (
            <div className="pageBackRow">
              <BackButton to={props.backTo} label={props.backLabel ?? "Retour"} />
            </div>
          ) : null}

          <div style={pageEyebrow}>Comptabilité · Pilotage</div>

          <div style={pageTitle}>{props.title}</div>

          {props.subtitle ? <div style={pageSubtitle}>{props.subtitle}</div> : null}
        </div>

        {props.right ? <div style={heroActions}>{props.right}</div> : null}
      </div>
    </section>
  );
}

function SmallButton(props: {
  children: ReactNode;
  onClick?: () => void;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      style={{
        border: props.primary ? "1px solid #93c5fd" : "1px solid #cbd5e1",
        background: props.primary ? "#dbeafe" : "#ffffff",
        color: props.primary ? "#1e3a8a" : "#0f172a",
        borderRadius: 12,
        padding: "10px 14px",
        fontSize: 13,
        fontWeight: 800,
        cursor: "pointer",
        whiteSpace: "nowrap",
        transition: "all 0.2s ease",
        boxShadow: props.primary ? "0 10px 24px rgba(37,99,235,0.10)" : "none",
      }}
    >
      {props.children}
    </button>
  );
}

function Card(props: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  right?: ReactNode;
}) {
  return (
    <section style={card}>
      <div style={cardHeader}>
        <div style={{ display: "grid", gap: 4 }}>
          <div style={cardTitle}>{props.title}</div>

          {props.subtitle ? <div style={cardSubtitle}>{props.subtitle}</div> : null}
        </div>

        {props.right ? <div>{props.right}</div> : null}
      </div>

      {props.children}
    </section>
  );
}

function OverviewCard(props: {
  title: string;
  value: string;
  sub: string;
  tone?: ToneKind;
}) {
  const tone = getTone(props.tone ?? "neutral");

  return (
    <div
      style={{
        ...overviewCard,
        background: tone.softBg,
        border: `1px solid ${tone.border}`,
      }}
    >
      <div
        style={{
          fontSize: 13,
          fontWeight: 800,
          color: tone.text,
          marginBottom: 10,
        }}
      >
        {props.title}
      </div>

      <div
        style={{
          fontSize: 28,
          fontWeight: 900,
          color: tone.strongText,
          lineHeight: 1.1,
          letterSpacing: -0.4,
        }}
      >
        {props.value}
      </div>

      <div
        style={{
          marginTop: 8,
          fontSize: 12,
          color: tone.text,
          lineHeight: 1.5,
        }}
      >
        {props.sub}
      </div>
    </div>
  );
}

function QuickActionCard(props: {
  title: string;
  text: string;
  actionLabel: string;
  onAction: () => void;
  tone?: ToneKind;
}) {
  const tone = getTone(props.tone ?? "info");

  return (
    <div
      style={{
        ...quickActionCard,
        background: tone.softBg,
        border: `1px solid ${tone.border}`,
      }}
    >
      <div
        style={{
          width: 38,
          height: 38,
          borderRadius: 12,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          background: tone.accentBg,
          color: tone.accentText,
          fontSize: 13,
          fontWeight: 900,
        }}
      >
        →
      </div>

      <div style={{ display: "grid", gap: 8 }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: 900,
            color: tone.strongText,
            lineHeight: 1.3,
          }}
        >
          {props.title}
        </div>

        <div
          style={{
            fontSize: 13,
            color: tone.text,
            lineHeight: 1.55,
          }}
        >
          {props.text}
        </div>
      </div>

      <div>
        <SmallButton onClick={props.onAction} primary>
          {props.actionLabel}
        </SmallButton>
      </div>
    </div>
  );
}

function StepCard(props: {
  number: string;
  title: string;
  text: string;
  tone?: ToneKind;
}) {
  const tone = getTone(props.tone ?? "neutral");

  return (
    <div
      style={{
        ...stepCard,
        background: tone.softBg,
        border: `1px solid ${tone.border}`,
      }}
    >
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 999,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          background: tone.accentBg,
          color: tone.accentText,
          fontSize: 13,
          fontWeight: 900,
        }}
      >
        {props.number}
      </div>

      <div
        style={{
          fontSize: 14,
          fontWeight: 900,
          color: tone.strongText,
        }}
      >
        {props.title}
      </div>

      <div
        style={{
          fontSize: 13,
          color: tone.text,
          lineHeight: 1.55,
        }}
      >
        {props.text}
      </div>
    </div>
  );
}

function InfoStrip() {
  return (
    <div style={infoStrip}>
      <div style={infoStripText}>
        Cette page centralise l’entrée du module Comptabilité : imports bancaires,
        lignes importées, mouvements comptables et statistiques.
      </div>
    </div>
  );
}

export default function ComptaHome() {
  const navigate = useNavigate();

  const goToImport = useCallback(() => {
    navigate("/compta/import");
  }, [navigate]);

  const goToImports = useCallback(() => {
    navigate("/compta/imports");
  }, [navigate]);

  const goToMovements = useCallback(() => {
    navigate("/compta/mouvements");
  }, [navigate]);

  const goToStats = useCallback(() => {
    navigate("/compta/stats");
  }, [navigate]);

  return (
    <PageShell>
      <HeroHeader
        title={APP_TEXT.pages.compta.homeTitle}
        subtitle={APP_TEXT.pages.compta.homeSubtitle}
        backTo="/dashboard"
        backLabel="Retour au tableau de bord"
        right={
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <SmallButton primary onClick={goToImport}>
              {APP_TEXT.pages.compta.home.quickActions.importStatementAction}
            </SmallButton>

            <SmallButton onClick={goToStats}>
              {APP_TEXT.actions.viewDetails}
            </SmallButton>
          </div>
        }
      />

      <InfoStrip />

      <div className="compta-home-overview-grid">
        <OverviewCard
          title={APP_TEXT.pages.compta.importsTitle}
          value={APP_TEXT.pages.compta.home.overview.importsValue}
          sub={APP_TEXT.pages.compta.home.overview.importsSubtitle}
          tone="neutral"
        />

        <OverviewCard
          title={APP_TEXT.pages.compta.importedLinesTitle}
          value={APP_TEXT.pages.compta.home.overview.importedLinesValue}
          sub={APP_TEXT.pages.compta.home.overview.importedLinesSubtitle}
          tone="warning"
        />

        <OverviewCard
          title={APP_TEXT.pages.compta.movementsTitle}
          value={APP_TEXT.pages.compta.home.overview.movementsValue}
          sub={APP_TEXT.pages.compta.home.overview.movementsSubtitle}
          tone="info"
        />

        <OverviewCard
          title={APP_TEXT.pages.compta.statsTitle}
          value={APP_TEXT.pages.compta.home.overview.statsValue}
          sub={APP_TEXT.pages.compta.home.overview.statsSubtitle}
          tone="success"
        />
      </div>

      <Card
        title={APP_TEXT.pages.compta.home.quickAccessTitle}
        subtitle={APP_TEXT.pages.compta.home.quickAccessSubtitle}
      >
        <div className="compta-home-quick-grid">
          <QuickActionCard
            title={APP_TEXT.pages.compta.home.quickActions.importStatementTitle}
            text={APP_TEXT.pages.compta.home.quickActions.importStatementText}
            actionLabel={APP_TEXT.pages.compta.home.quickActions.importStatementAction}
            onAction={goToImport}
            tone="info"
          />

          <QuickActionCard
            title={APP_TEXT.pages.compta.home.quickActions.viewImportsTitle}
            text={APP_TEXT.pages.compta.home.quickActions.viewImportsText}
            actionLabel={APP_TEXT.pages.compta.home.quickActions.viewImportsAction}
            onAction={goToImports}
            tone="neutral"
          />

          <QuickActionCard
            title={APP_TEXT.pages.compta.home.quickActions.openMovementsTitle}
            text={APP_TEXT.pages.compta.home.quickActions.openMovementsText}
            actionLabel={APP_TEXT.pages.compta.home.quickActions.openMovementsAction}
            onAction={goToMovements}
            tone="info"
          />

          <QuickActionCard
            title={APP_TEXT.pages.compta.home.quickActions.analyzeStatsTitle}
            text={APP_TEXT.pages.compta.home.quickActions.analyzeStatsText}
            actionLabel={APP_TEXT.pages.compta.home.quickActions.analyzeStatsAction}
            onAction={goToStats}
            tone="success"
          />
        </div>
      </Card>

      <Card
        title="Entrées d’argent"
        subtitle="Clarifier les sommes reçues par la copropriété sans les rattacher obligatoirement aux Assemblées Générales."
      >
        <div className="compta-home-quick-grid">
          <QuickActionCard
            title="Cotisations et appels"
            text="Suivre les cotisations mensuelles, cotisations exceptionnelles et appels de fonds déjà encaissés ou à rapprocher."
            actionLabel="Voir les mouvements"
            onAction={() => navigate("/compta/mouvements")}
            tone="success"
          />

          <QuickActionCard
            title="Dons, subventions et remboursements"
            text="Préparer le suivi des sommes reçues hors appels classiques : don volontaire, subvention, remboursement ou trop-perçu."
            actionLabel="Suivre en comptabilité"
            onAction={() => navigate("/compta/entrees-argent")}
            tone="info"
          />

          <QuickActionCard
            title="Autre entrée d’argent"
            text="Identifier les encaissements qui ne rentrent pas encore dans une catégorie précise, sans forcer un lien avec une AG."
            actionLabel="Préparer le suivi"
            onAction={() => navigate("/compta/entrees-argent")}
            tone="warning"
          />
        </div>

        <div style={{ marginTop: 16, fontSize: 13, lineHeight: 1.7, color: "#475569" }}>
          Une entrée d’argent appartient d’abord à la copropriété. Elle pourra plus tard
          être liée à un copropriétaire, un lot, un appel, un dossier travaux ou une AG,
          mais le lien avec une AG restera facultatif.
        </div>
      </Card>

      <Card
        title={APP_TEXT.pages.compta.home.recommendedFlowTitle}
        subtitle={APP_TEXT.pages.compta.home.recommendedFlowSubtitle}
      >
        <div className="compta-home-steps-grid">
          <StepCard
            number="1"
            title={APP_TEXT.pages.compta.home.steps.step1Title}
            text={APP_TEXT.pages.compta.home.steps.step1Text}
            tone="info"
          />

          <StepCard
            number="2"
            title={APP_TEXT.pages.compta.home.steps.step2Title}
            text={APP_TEXT.pages.compta.home.steps.step2Text}
            tone="warning"
          />

          <StepCard
            number="3"
            title={APP_TEXT.pages.compta.home.steps.step3Title}
            text={APP_TEXT.pages.compta.home.steps.step3Text}
            tone="success"
          />

          <StepCard
            number="4"
            title={APP_TEXT.pages.compta.home.steps.step4Title}
            text={APP_TEXT.pages.compta.home.steps.step4Text}
            tone="neutral"
          />
        </div>
      </Card>

      <style>{`
        .compta-home-overview-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 14px;
        }

        .compta-home-quick-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
        }

        .compta-home-steps-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
        }

        @media (max-width: 1200px) {
          .compta-home-overview-grid,
          .compta-home-quick-grid,
          .compta-home-steps-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 760px) {
          .compta-home-overview-grid,
          .compta-home-quick-grid,
          .compta-home-steps-grid {
            grid-template-columns: 1fr;
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
    "linear-gradient(135deg, rgba(15,23,42,0.98) 0%, rgba(30,41,59,0.96) 55%, rgba(37,99,235,0.88) 100%)",
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

const heroHeader: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 16,
  flexWrap: "wrap",
  alignItems: "flex-end",
  minWidth: 0,
};

const heroTextBlock: CSSProperties = {
  display: "grid",
  gap: 8,
  position: "relative",
  zIndex: 1,
  minWidth: 0,
};

const heroActions: CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
  alignItems: "center",
  position: "relative",
  zIndex: 1,
};

const pageEyebrow: CSSProperties = {
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: 0.9,
  textTransform: "uppercase",
  color: "rgba(255,255,255,0.72)",
};

const pageTitle: CSSProperties = {
  fontSize: 30,
  fontWeight: 900,
  color: "#ffffff",
  lineHeight: 1.08,
  letterSpacing: -0.5,
};

const pageSubtitle: CSSProperties = {
  color: "rgba(255,255,255,0.84)",
  fontSize: 14,
  lineHeight: 1.6,
  maxWidth: 960,
};

const infoStrip: CSSProperties = {
  border: "1px solid #dbeafe",
  background: "#eff6ff",
  borderRadius: 18,
  padding: "14px 16px",
};

const infoStripText: CSSProperties = {
  fontSize: 13,
  color: "#1d4ed8",
  lineHeight: 1.6,
  fontWeight: 600,
};

const card: CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 22,
  padding: 18,
  background: "#ffffff",
  boxShadow: "0 10px 30px rgba(15, 23, 42, 0.04)",
  minWidth: 0,
};

const cardHeader: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
  alignItems: "center",
  marginBottom: 14,
};

const cardTitle: CSSProperties = {
  fontSize: 16,
  fontWeight: 900,
  color: "#111827",
};

const cardSubtitle: CSSProperties = {
  fontSize: 13,
  color: "#6b7280",
  lineHeight: 1.5,
};

const overviewCard: CSSProperties = {
  borderRadius: 18,
  padding: 18,
  boxShadow: "0 10px 24px rgba(15, 23, 42, 0.04)",
  minWidth: 0,
};

const quickActionCard: CSSProperties = {
  borderRadius: 18,
  padding: 16,
  display: "grid",
  gap: 12,
  minHeight: 178,
  alignContent: "space-between",
  minWidth: 0,
};

const stepCard: CSSProperties = {
  borderRadius: 18,
  padding: 16,
  display: "grid",
  gap: 10,
  minWidth: 0,
};