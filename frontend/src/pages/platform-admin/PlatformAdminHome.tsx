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

export default function PlatformAdminHome() {
  const navigate = useNavigate();

  return (
    <PageShell>
      <SectionTitle
        title="Administration plateforme"
        subtitle="Supervisez la plateforme, les copropriétés, les accès principaux et les futurs rôles Super Admin depuis une interface React dédiée à l’exploitation produit."
        right={
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <SmallButton onClick={() => navigate("/")}>Retour au tableau de bord</SmallButton>
            <SmallButton onClick={() => navigate("/platform-admin")} primary>
              Rafraîchir la vue
            </SmallButton>
          </div>
        }
      />

      <div className="platform-stat-grid">
        <StatCard
          title="Copropriétés"
          value="—"
          sub="Le nombre de copropriétés supervisées apparaîtra ici après branchement."
        />
        <StatCard
          title="Administrateurs affectés"
          value="—"
          sub="Les rôles principaux gérés au niveau plateforme seront consolidés ici."
        />
        <StatCard
          title="Modules supervisés"
          value="—"
          sub="Cette carte permettra de suivre l’exposition fonctionnelle globale."
        />
        <StatCard
          title="Actions plateforme"
          value="—"
          sub="Les opérations de supervision et d’affectation seront visibles dans cet espace."
        />
      </div>

      <div className="platform-main-grid">
        <Card title="Vue produit du module" right={<Badge text="Module branché" />} minHeight={250}>
          <div style={{ display: "grid", gap: 14 }}>
            <div style={paragraph}>
              L’administration plateforme doit vivre côté frontend React et non dépendre du Django
              Admin pour l’exploitation normale. Cette page constitue le point d’entrée officiel
              du futur back-office Super Admin.
            </div>

            <div style={paragraph}>À terme, ce module doit permettre de :</div>

            <div style={bulletList}>
              <div style={bulletItem}>• créer et superviser les copropriétés</div>
              <div style={bulletItem}>• affecter les rôles principaux</div>
              <div style={bulletItem}>• suivre l’activité globale de la plateforme</div>
              <div style={bulletItem}>• offrir une base premium d’exploitation SaaS</div>
              <div style={bulletItem}>• éviter la dépendance au Django Admin en usage courant</div>
            </div>
          </div>
        </Card>

        <Card title="État actuel" minHeight={250} right={<Badge text="Pré-intégration UI OK" />}>
          <EmptyState
            title="Back-office à construire"
            text="Le module est maintenant visible dans la navigation principale et le tableau de bord. La prochaine étape consiste à raccorder les écrans métier de supervision plateforme."
            actionLabel="Retour au tableau de bord"
            onAction={() => navigate("/")}
          />
        </Card>
      </div>

      <Card title="Accès rapides Administration plateforme" minHeight={120}>
        <div className="platform-quick-grid">
          <QuickActionCard
            title="Revenir au tableau de bord"
            text="Accédez rapidement à la vue de pilotage globale de la copropriété active."
            actionLabel="Ouvrir le tableau de bord"
            onAction={() => navigate("/")}
          />
          <QuickActionCard
            title="Voir les travaux"
            text="Consultez le module Travaux tel qu’il apparaît actuellement dans le produit."
            actionLabel="Ouvrir Travaux"
            onAction={() => navigate("/travaux/dossiers")}
          />
          <QuickActionCard
            title="Voir les RH"
            text="Consultez les écrans RH consolidés pendant la phase de cohérence produit."
            actionLabel="Ouvrir RH"
            onAction={() => navigate("/rh/employes")}
          />
          <QuickActionCard
            title="Voir la facturation"
            text="Passez rapidement au module Facturation pour garder une vue transverse."
            actionLabel="Ouvrir Facturation"
            onAction={() => navigate("/billing")}
          />
        </div>
      </Card>

      <style>{`
        .platform-stat-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 14px;
        }

        .platform-main-grid {
          display: grid;
          grid-template-columns: 1.1fr 0.9fr;
          gap: 14px;
        }

        .platform-quick-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
        }

        @media (max-width: 1280px) {
          .platform-quick-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 1200px) {
          .platform-stat-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .platform-main-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 760px) {
          .platform-stat-grid {
            grid-template-columns: 1fr;
          }

          .platform-quick-grid {
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