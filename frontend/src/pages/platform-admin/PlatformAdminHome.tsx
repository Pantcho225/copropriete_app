import type { CSSProperties, ReactNode } from "react";
import { useNavigate } from "react-router-dom";

type StatTone = "blue" | "green" | "yellow" | "neutral";

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
        alignItems: "flex-end",
        justifyContent: "space-between",
        gap: 12,
        flexWrap: "wrap",
      }}
    >
      <div style={{ minWidth: 0 }}>
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

function Card(props: {
  title: string;
  children: ReactNode;
  right?: ReactNode;
  minHeight?: number;
}) {
  return (
    <div
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 20,
        padding: 18,
        background: "#ffffff",
        boxShadow: "0 10px 30px rgba(15, 23, 42, 0.04)",
        minHeight: props.minHeight,
        minWidth: 0,
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
        <div style={{ fontSize: 15, fontWeight: 900, color: "#111827" }}>
          {props.title}
        </div>

        {props.right ? props.right : null}
      </div>

      {props.children}
    </div>
  );
}

function StatCard(props: {
  title: string;
  value: string;
  sub?: string;
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
      border: "#e5e7eb",
      bg: "#ffffff",
      accent: "#111827",
    },
  };

  return (
    <div
      style={{
        border: `1px solid ${toneMap[tone].border}`,
        borderRadius: 20,
        padding: 18,
        background: toneMap[tone].bg,
        boxShadow: "0 10px 30px rgba(15, 23, 42, 0.04)",
        minHeight: 112,
        minWidth: 0,
      }}
    >
      <div
        style={{
          fontSize: 13,
          color: "#6b7280",
          marginBottom: 10,
          fontWeight: 700,
        }}
      >
        {props.title}
      </div>

      <div
        style={{
          fontSize: 28,
          fontWeight: 900,
          letterSpacing: -0.5,
          color: toneMap[tone].accent,
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

function EmptyState(props: {
  title: string;
  text: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div
      style={{
        border: "1px dashed #d1d5db",
        borderRadius: 16,
        padding: 18,
        background: "#f9fafb",
      }}
    >
      <div
        style={{
          fontSize: 14,
          fontWeight: 800,
          color: "#111827",
          marginBottom: 6,
        }}
      >
        {props.title}
      </div>

      <div style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.5 }}>
        {props.text}
      </div>

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
        minWidth: 0,
      }}
    >
      <div style={{ fontSize: 14, fontWeight: 900, color: "#111827" }}>
        {props.title}
      </div>

      <div style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.5 }}>
        {props.text}
      </div>

      <div>
        <SmallButton onClick={props.onAction} primary>
          {props.actionLabel}
        </SmallButton>
      </div>
    </div>
  );
}

function Badge(props: {
  text: string;
  tone?: "neutral" | "blue" | "green" | "yellow";
}) {
  const tone = props.tone ?? "neutral";

  const toneMap: Record<
    NonNullable<typeof props.tone>,
    { background: string; border: string; color: string }
  > = {
    neutral: {
      background: "#f3f4f6",
      border: "#e5e7eb",
      color: "#374151",
    },
    blue: {
      background: "#eff6ff",
      border: "#bfdbfe",
      color: "#1d4ed8",
    },
    green: {
      background: "#ecfdf5",
      border: "#a7f3d0",
      color: "#166534",
    },
    yellow: {
      background: "#fffbeb",
      border: "#fde68a",
      color: "#92400e",
    },
  };

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
        border: `1px solid ${toneMap[tone].border}`,
        background: toneMap[tone].background,
        color: toneMap[tone].color,
        whiteSpace: "nowrap",
      }}
    >
      {props.text}
    </span>
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

export default function PlatformAdminHome() {
  const navigate = useNavigate();

  return (
    <PageShell>
      <SectionTitle
        title="Administration plateforme"
        subtitle="Supervisez les copropriétés, les accès principaux, les affectations de rôles et les futurs indicateurs SaaS depuis une interface React dédiée au Super Admin."
        right={
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <SmallButton onClick={() => navigate("/")}>
              Retour au tableau de bord
            </SmallButton>

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
          sub="Nombre de copropriétés supervisées par la plateforme."
          tone="blue"
        />

        <StatCard
          title="Rôles principaux"
          value="—"
          sub="Administrateurs, syndics et gestionnaires affectés."
          tone="green"
        />

        <StatCard
          title="Supervision"
          value="Prévue"
          sub="Base fonctionnelle destinée au pilotage global du SaaS."
          tone="yellow"
        />

        <StatCard
          title="Exploitation"
          value="React"
          sub="L’exploitation normale ne dépendra pas du Django Admin."
          tone="neutral"
        />
      </div>

      <div className="platform-main-grid">
        <Card
          title="Vision produit du module"
          right={<Badge text="Back-office Super Admin" tone="blue" />}
          minHeight={250}
        >
          <div style={{ display: "grid", gap: 14 }}>
            <div style={paragraph}>
              L’administration plateforme doit devenir le point d’entrée officiel
              du Super Admin pour piloter le logiciel en mode SaaS. Le Django
              Admin doit rester un outil technique de secours, pas l’interface
              d’exploitation normale.
            </div>

            <div style={paragraph}>À terme, ce module devra permettre de :</div>

            <div style={bulletList}>
              <div style={bulletItem}>• créer et consulter les copropriétés clientes</div>
              <div style={bulletItem}>• affecter les administrateurs, syndics et gestionnaires</div>
              <div style={bulletItem}>• superviser l’activité globale de la plateforme</div>
              <div style={bulletItem}>• suivre les statuts d’abonnement et de facturation</div>
              <div style={bulletItem}>• préparer l’exploitation commerciale du produit</div>
            </div>
          </div>
        </Card>

        <Card
          title="État actuel"
          minHeight={250}
          right={<Badge text="Pré-intégration UI OK" tone="green" />}
        >
          <EmptyState
            title="Back-office métier à construire"
            text="Le module est visible dans la navigation principale. La prochaine étape consistera à créer les écrans réels : copropriétés, affectations de rôles, supervision plateforme et indicateurs SaaS."
            actionLabel="Retour au tableau de bord"
            onAction={() => navigate("/")}
          />
        </Card>
      </div>

      <Card title="Accès rapides Administration plateforme" minHeight={120}>
        <div className="platform-quick-grid">
          <QuickActionCard
            title="Tableau de bord"
            text="Accédez rapidement à la vue de pilotage globale de la copropriété active."
            actionLabel="Ouvrir le tableau de bord"
            onAction={() => navigate("/")}
          />

          <QuickActionCard
            title="Facturation"
            text="Consultez la couche économique déjà préparée pour les factures et les abonnements."
            actionLabel="Ouvrir Facturation"
            onAction={() => navigate("/billing")}
          />

          <QuickActionCard
            title="Ressources humaines"
            text="Consultez les écrans RH consolidés pendant la phase de cohérence produit."
            actionLabel="Ouvrir RH"
            onAction={() => navigate("/rh")}
          />

          <QuickActionCard
            title="Lots"
            text="Consultez le référentiel des lots, utile pour la cohérence métier transverse."
            actionLabel="Ouvrir Lots"
            onAction={() => navigate("/lots")}
          />
        </div>
      </Card>

      <Card title="Prochaine structuration métier" minHeight={120}>
        <div className="platform-info-grid">
          <InfoBox title="Copropriétés">
            Création, consultation, édition et supervision des copropriétés
            clientes directement depuis le frontend React.
          </InfoBox>

          <InfoBox title="Affectations">
            Affectation des rôles principaux : administrateur de copropriété,
            syndic, gestionnaire ou responsable local.
          </InfoBox>

          <InfoBox title="Supervision SaaS">
            Suivi global des modules, de la facturation, des accès et des
            indicateurs d’exploitation plateforme.
          </InfoBox>
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

        .platform-info-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
        }

        @media (max-width: 1280px) {
          .platform-quick-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .platform-info-grid {
            grid-template-columns: 1fr;
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

const infoBox: CSSProperties = {
  padding: 14,
  borderRadius: 16,
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
};

const infoTitle: CSSProperties = {
  fontSize: 13,
  fontWeight: 900,
  color: "#111827",
  marginBottom: 6,
};

const infoText: CSSProperties = {
  fontSize: 13,
  color: "#64748b",
  lineHeight: 1.55,
};