import type { CSSProperties, ReactNode } from "react";
import { useNavigate } from "react-router-dom";

function PageShell({ children }: { children: ReactNode }) {
  return <div style={{ display: "grid", gap: 16 }}>{children}</div>;
}

function SectionTitle(props: { title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "space-between",
        gap: 12,
        flexWrap: "wrap",
      }}
    >
      <div>
        <div
          style={{
            fontSize: 30,
            fontWeight: 900,
            letterSpacing: -0.6,
            color: "#111827",
            lineHeight: 1.1,
          }}
        >
          {props.title}
        </div>

        {props.subtitle ? (
          <div
            style={{
              fontSize: 14,
              color: "#6b7280",
              marginTop: 6,
              lineHeight: 1.5,
              maxWidth: 920,
            }}
          >
            {props.subtitle}
          </div>
        ) : null}
      </div>

      {props.right ? <div>{props.right}</div> : null}
    </div>
  );
}

function Card(props: { title: string; children: ReactNode; right?: ReactNode; minHeight?: number }) {
  return (
    <div
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 20,
        padding: 18,
        background: "#ffffff",
        boxShadow: "0 10px 30px rgba(15, 23, 42, 0.04)",
        minHeight: props.minHeight,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          flexWrap: "wrap",
          marginBottom: 14,
        }}
      >
        <div style={{ fontSize: 15, fontWeight: 900, color: "#111827" }}>{props.title}</div>
        {props.right ? props.right : null}
      </div>
      {props.children}
    </div>
  );
}

function StatCard(props: { title: string; value: string; sub?: string }) {
  return (
    <div
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 20,
        padding: 18,
        background: "#ffffff",
        boxShadow: "0 10px 30px rgba(15, 23, 42, 0.04)",
        minHeight: 112,
      }}
    >
      <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 10, fontWeight: 700 }}>
        {props.title}
      </div>
      <div
        style={{
          fontSize: 28,
          fontWeight: 900,
          letterSpacing: -0.5,
          color: "#111827",
          lineHeight: 1.1,
        }}
      >
        {props.value}
      </div>
      {props.sub ? (
        <div style={{ marginTop: 8, fontSize: 12, color: "#6b7280", lineHeight: 1.45 }}>
          {props.sub}
        </div>
      ) : null}
    </div>
  );
}

function SmallButton(props: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      disabled={props.disabled}
      style={{
        border: props.primary ? "1px solid #c7d2fe" : "1px solid #e5e7eb",
        background: props.disabled ? "#f9fafb" : props.primary ? "#eef2ff" : "#fff",
        color: props.disabled ? "#9ca3af" : props.primary ? "#3730a3" : "#111827",
        borderRadius: 12,
        padding: "10px 14px",
        fontSize: 13,
        fontWeight: 800,
        cursor: props.disabled ? "not-allowed" : "pointer",
        whiteSpace: "nowrap",
      }}
    >
      {props.children}
    </button>
  );
}

function EmptyState(props: { title: string; text: string; actionLabel?: string; onAction?: () => void }) {
  return (
    <div
      style={{
        border: "1px dashed #d1d5db",
        borderRadius: 16,
        padding: 18,
        background: "#f9fafb",
      }}
    >
      <div style={{ fontSize: 14, fontWeight: 800, color: "#111827", marginBottom: 6 }}>
        {props.title}
      </div>
      <div style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.5 }}>{props.text}</div>
      {props.actionLabel && props.onAction ? (
        <div style={{ marginTop: 12 }}>
          <SmallButton onClick={props.onAction} primary>
            {props.actionLabel}
          </SmallButton>
        </div>
      ) : null}
    </div>
  );
}

function QuickActionCard(props: {
  title: string;
  text: string;
  actionLabel: string;
  onAction: () => void;
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
      <div style={{ fontSize: 14, fontWeight: 900, color: "#111827" }}>{props.title}</div>
      <div style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.5 }}>{props.text}</div>
      <div>
        <SmallButton onClick={props.onAction} primary>
          {props.actionLabel}
        </SmallButton>
      </div>
    </div>
  );
}

function Badge(props: { text: string }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "4px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 700,
        border: "1px solid #e5e7eb",
        background: "#f3f4f6",
        color: "#374151",
        whiteSpace: "nowrap",
      }}
    >
      {props.text}
    </span>
  );
}

export default function BillingHome() {
  const navigate = useNavigate();

  return (
    <PageShell>
      <SectionTitle
        title="Facturation"
        subtitle="Pilotez les appels de fonds, les lignes de facturation, les impayés et le reste à payer depuis un espace lisible, cohérent et orienté exploitation."
        right={
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <SmallButton onClick={() => navigate("/")}>Retour au tableau de bord</SmallButton>
            <SmallButton onClick={() => navigate("/compta/stats")} primary>
              Voir les indicateurs
            </SmallButton>
          </div>
        }
      />

      <div className="billing-stat-grid">
        <StatCard
          title="Appels de fonds"
          value="—"
          sub="Le nombre total d’appels de fonds apparaîtra ici après branchement complet."
        />
        <StatCard
          title="Lignes de facturation"
          value="—"
          sub="Le suivi des lignes et des montants sera consolidé dans cette carte."
        />
        <StatCard
          title="Impayés"
          value="—"
          sub="Les impayés en cours et leur évolution seront exposés ici."
        />
        <StatCard
          title="Reste à payer"
          value="—"
          sub="Le total restant dû par la copropriété sera affiché dans cette zone."
        />
      </div>

      <div className="billing-main-grid">
        <Card title="Vue produit du module" right={<Badge text="Module branché" />} minHeight={250}>
          <div style={{ display: "grid", gap: 14 }}>
            <div style={paragraph}>
              Le module Facturation est maintenant intégré à l’architecture visible du produit.
              Cette page sert de point d’entrée propre avant le branchement complet des écrans
              métier dédiés aux appels de fonds et aux impayés.
            </div>

            <div style={paragraph}>À terme, ce module doit permettre de :</div>

            <div style={bulletList}>
              <div style={bulletItem}>• suivre les appels de fonds actifs</div>
              <div style={bulletItem}>• analyser les lignes de facturation</div>
              <div style={bulletItem}>• piloter les impayés et le reste à payer</div>
              <div style={bulletItem}>• alimenter le tableau de bord avec des KPI fiables</div>
              <div style={bulletItem}>• renforcer la lecture produit de la gestion financière</div>
            </div>
          </div>
        </Card>

        <Card title="État actuel" minHeight={250} right={<Badge text="Pré-intégration UI OK" />}>
          <EmptyState
            title="Écrans métier à brancher"
            text="Le module est visible dans le dashboard, le routeur et la navigation latérale. La prochaine étape consiste à raccorder les écrans métier de facturation et leurs KPI dédiés."
            actionLabel="Retour au tableau de bord"
            onAction={() => navigate("/")}
          />
        </Card>
      </div>

      <Card title="Accès rapides Facturation" minHeight={120}>
        <div className="billing-quick-grid">
          <QuickActionCard
            title="Voir les indicateurs"
            text="Accédez à la vue de synthèse disponible pour le suivi financier de la copropriété."
            actionLabel="Voir les statistiques"
            onAction={() => navigate("/compta/stats")}
          />
          <QuickActionCard
            title="Voir les mouvements"
            text="Consultez les mouvements bancaires liés à la vie financière de la copropriété."
            actionLabel="Voir les mouvements"
            onAction={() => navigate("/compta/mouvements")}
          />
          <QuickActionCard
            title="Voir les imports"
            text="Accédez aux imports bancaires et au traitement opérationnel des lignes."
            actionLabel="Voir les imports"
            onAction={() => navigate("/compta/imports")}
          />
          <QuickActionCard
            title="Retour comptabilité"
            text="Revenez rapidement au module Comptabilité pour poursuivre le pilotage global."
            actionLabel="Ouvrir la comptabilité"
            onAction={() => navigate("/compta")}
          />
        </div>
      </Card>

      <style>{`
        .billing-stat-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 14px;
        }

        .billing-main-grid {
          display: grid;
          grid-template-columns: 1.1fr 0.9fr;
          gap: 14px;
        }

        .billing-quick-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
        }

        @media (max-width: 1280px) {
          .billing-quick-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 1200px) {
          .billing-stat-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .billing-main-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 760px) {
          .billing-stat-grid {
            grid-template-columns: 1fr;
          }

          .billing-quick-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </PageShell>
  );
}

const paragraph: CSSProperties = {
  fontSize: 14,
  color: "#4b5563",
  lineHeight: 1.65,
};

const bulletList: CSSProperties = {
  display: "grid",
  gap: 8,
};

const bulletItem: CSSProperties = {
  fontSize: 14,
  color: "#374151",
  lineHeight: 1.55,
};