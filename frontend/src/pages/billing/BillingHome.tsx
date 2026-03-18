import { useNavigate } from "react-router-dom";
import type { CSSProperties, ReactNode } from "react";

function PageShell({ children }: { children: ReactNode }) {
  return <div style={{ display: "grid", gap: 16 }}>{children}</div>;
}

function SectionTitle(props: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 12,
        flexWrap: "wrap",
        alignItems: "flex-end",
      }}
    >
      <div>
        <div
          style={{
            fontSize: 28,
            fontWeight: 900,
            color: "#111827",
            lineHeight: 1.1,
            letterSpacing: -0.4,
          }}
        >
          {props.title}
        </div>

        {props.subtitle ? (
          <div
            style={{
              marginTop: 6,
              color: "#6b7280",
              fontSize: 14,
              lineHeight: 1.5,
              maxWidth: 920,
            }}
          >
            {props.subtitle}
          </div>
        ) : null}
      </div>

      {props.right}
    </div>
  );
}

function StatCard(props: {
  title: string;
  value: string;
  sub?: string;
}) {
  return (
    <div style={card}>
      <div
        style={{
          fontSize: 13,
          color: "#6b7280",
          fontWeight: 700,
          marginBottom: 10,
        }}
      >
        {props.title}
      </div>

      <div
        style={{
          fontSize: 28,
          fontWeight: 900,
          color: "#111827",
          lineHeight: 1.1,
        }}
      >
        {props.value}
      </div>

      {props.sub ? (
        <div
          style={{
            marginTop: 8,
            fontSize: 12,
            color: "#6b7280",
            lineHeight: 1.45,
          }}
        >
          {props.sub}
        </div>
      ) : null}
    </div>
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
        border: props.primary ? "1px solid #c7d2fe" : "1px solid #e5e7eb",
        background: props.primary ? "#eef2ff" : "#fff",
        color: props.primary ? "#3730a3" : "#111827",
        borderRadius: 12,
        padding: "10px 14px",
        fontSize: 13,
        fontWeight: 800,
        cursor: "pointer",
        whiteSpace: "nowrap",
      }}
    >
      {props.children}
    </button>
  );
}

function Card(props: {
  title: string;
  children: ReactNode;
  right?: ReactNode;
}) {
  return (
    <div style={card}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 10,
          flexWrap: "wrap",
          marginBottom: 14,
          alignItems: "center",
        }}
      >
        <div style={{ fontSize: 16, fontWeight: 900, color: "#111827" }}>
          {props.title}
        </div>
        {props.right}
      </div>

      {props.children}
    </div>
  );
}

function QuickActionCard(props: {
  title: string;
  text: string;
  actionLabel: string;
  onAction?: () => void;
  disabled?: boolean;
}) {
  return (
    <div
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 18,
        padding: 16,
        background: "#ffffff",
        display: "grid",
        gap: 10,
      }}
    >
      <div style={{ fontSize: 14, fontWeight: 900, color: "#111827" }}>
        {props.title}
      </div>

      <div style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.5 }}>
        {props.text}
      </div>

      <div>
        <button
          type="button"
          onClick={props.onAction}
          disabled={props.disabled}
          style={{
            border: "1px solid #c7d2fe",
            background: props.disabled ? "#f3f4f6" : "#eef2ff",
            color: props.disabled ? "#9ca3af" : "#3730a3",
            borderRadius: 12,
            padding: "10px 14px",
            fontSize: 13,
            fontWeight: 800,
            cursor: props.disabled ? "not-allowed" : "pointer",
            whiteSpace: "nowrap",
          }}
        >
          {props.actionLabel}
        </button>
      </div>
    </div>
  );
}

function InfoBox(props: { children: ReactNode }) {
  return (
    <div
      style={{
        padding: 14,
        borderRadius: 16,
        background: "#eff6ff",
        border: "1px solid #bfdbfe",
        color: "#1d4ed8",
      }}
    >
      {props.children}
    </div>
  );
}

export default function BillingHome() {
  const navigate = useNavigate();

  return (
    <PageShell>
      <SectionTitle
        title="Vue d’ensemble de la facturation"
        subtitle="Accédez à l’entrée du module Facturation pour piloter les appels de fonds, les paiements et les indicateurs de suivi à mesure de l’enrichissement du produit."
        right={
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <SmallButton onClick={() => navigate("/")} primary>
              Retour au tableau de bord
            </SmallButton>
          </div>
        }
      />

      <div className="billing-home-stat-grid">
        <StatCard
          title="Module Facturation"
          value="Disponible"
          sub="Le module est accessible depuis cette vue d’ensemble."
        />
        <StatCard
          title="Appels de fonds"
          value="À structurer"
          sub="Le pilotage détaillé peut être enrichi progressivement."
        />
        <StatCard
          title="Paiements"
          value="À structurer"
          sub="Le suivi détaillé des paiements peut être exposé ici."
        />
        <StatCard
          title="Vision produit"
          value="Active"
          sub="La structure premium du module est désormais en place."
        />
      </div>

      <Card title="Accès rapides du module Facturation">
        <div className="billing-home-quick-grid">
          <QuickActionCard
            title="Retour au tableau de bord"
            text="Revenez à la vue d’ensemble transverse de la copropriété."
            actionLabel="Ouvrir le tableau de bord"
            onAction={() => navigate("/")}
          />

          <QuickActionCard
            title="Module Comptabilité"
            text="Accédez au module Comptabilité pour traiter les imports et les mouvements liés au suivi financier."
            actionLabel="Ouvrir Comptabilité"
            onAction={() => navigate("/compta")}
          />

          <QuickActionCard
            title="Module Relances"
            text="Accédez au module Relances pour suivre les dossiers impayés et les régularisations."
            actionLabel="Ouvrir Relances"
            onAction={() => navigate("/relances")}
          />

          <QuickActionCard
            title="Consolidation future"
            text="Les sous-pages détaillées du module Facturation pourront être branchées ici lorsqu’elles seront créées."
            actionLabel="Structure prête"
            disabled
          />
        </div>
      </Card>

      <InfoBox>
        <div style={{ fontWeight: 900, marginBottom: 4 }}>
          Structure produit du module Facturation
        </div>
        <div style={{ fontSize: 13, lineHeight: 1.5 }}>
          Cette page sert maintenant de vraie <strong>vue d’ensemble de la facturation</strong>.
          Elle aligne le routage, le Sidebar et le Topbar, tout en préparant l’ajout futur
          de sous-pages détaillées comme les appels de fonds, les paiements et les statistiques
          de facturation.
        </div>
      </InfoBox>

      <style>{`
        .billing-home-stat-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 14px;
        }

        .billing-home-quick-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
        }

        @media (max-width: 1200px) {
          .billing-home-stat-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .billing-home-quick-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 760px) {
          .billing-home-stat-grid,
          .billing-home-quick-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </PageShell>
  );
}

const card: CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 20,
  padding: 18,
  background: "#fff",
  boxShadow: "0 10px 30px rgba(15, 23, 42, 0.04)",
};