// frontend/src/pages/platform-admin/PlatformAdminHome.tsx
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
              maxWidth: 980,
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

function getActiveCoproId() {
  return (
    localStorage.getItem("coproprieteId") ||
    localStorage.getItem("copropriete_id") ||
    localStorage.getItem("activeCoproprieteId") ||
    ""
  );
}

export default function PlatformAdminHome() {
  const navigate = useNavigate();
  const activeCoproId = getActiveCoproId();

  return (
    <PageShell>
      <SectionTitle
        title="Administration plateforme"
        subtitle="Pilotez la plateforme, les copropriétés clientes, les accès utilisateurs et le référentiel opérationnel de la copropriété active depuis l’Admin React."
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
          title="Copropriété active"
          value={activeCoproId ? `#${activeCoproId}` : "—"}
          sub="Contexte actuellement chargé dans l’Admin React."
          tone="blue"
        />

        <StatCard
          title="Référentiel"
          value="Disponible"
          sub="Copropriétaires, lots, résidents et tantièmes accessibles."
          tone="green"
        />

        <StatCard
          title="Super Admin"
          value="React"
          sub="L’exploitation courante ne dépend plus du Django Admin."
          tone="neutral"
        />

        <StatCard
          title="SaaS"
          value="En cours"
          sub="Supervision, abonnements et indicateurs globaux à enrichir."
          tone="yellow"
        />
      </div>

      <div className="platform-main-grid">
        <Card
          title="Cockpit Super Admin"
          right={<Badge text="Back-office React" tone="blue" />}
          minHeight={250}
        >
          <div style={{ display: "grid", gap: 14 }}>
            <div style={paragraph}>
              Cette page sert de point d’entrée au Super Admin. Elle ne remplace
              pas les écrans métier détaillés, mais donne un accès direct aux
              blocs essentiels : copropriétés clientes, utilisateurs, rôles et
              référentiel de la copropriété active.
            </div>

            <div style={paragraph}>
              Le Django Admin doit rester un outil technique de secours. La
              gestion quotidienne doit se faire dans l’interface React.
            </div>

            <div style={bulletList}>
              <div style={bulletItem}>• créer et consulter les copropriétés clientes</div>
              <div style={bulletItem}>• gérer les utilisateurs et les rôles locaux</div>
              <div style={bulletItem}>• accéder au référentiel de la copropriété active</div>
              <div style={bulletItem}>• préparer les indicateurs de supervision SaaS</div>
              <div style={bulletItem}>• structurer l’exploitation commerciale du produit</div>
            </div>
          </div>
        </Card>

        <Card
          title="Référentiel copropriété actif"
          minHeight={250}
          right={<Badge text="Opérationnel" tone="green" />}
        >
          <div style={{ display: "grid", gap: 14 }}>
            <div style={paragraph}>
              Le référentiel est désormais exploitable depuis l’Admin React. Le
              Super Admin peut accéder rapidement aux données structurantes de la
              copropriété active : copropriétaires, lots, résidents, tantièmes et
              accès utilisateurs.
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <SmallButton
                onClick={() =>
                  navigate("/platform-admin/referentiel-copropriete")
                }
                primary
              >
                Ouvrir le référentiel
              </SmallButton>

              <SmallButton
                onClick={() =>
                  navigate("/platform-admin/referentiel-copropriete/coproprietaires")
                }
              >
                Copropriétaires
              </SmallButton>

              <SmallButton
                onClick={() =>
                  navigate("/platform-admin/referentiel-copropriete/occupants")
                }
              >
                Résidents des lots
              </SmallButton>
            </div>
          </div>
        </Card>
      </div>

      <Card title="Référentiel copropriété actif" minHeight={120}>
        <div className="platform-referentiel-grid">
          <QuickActionCard
            title="Copropriétaires"
            text="Créez, consultez et maintenez les propriétaires juridiques rattachés à la copropriété active."
            actionLabel="Ouvrir les copropriétaires"
            onAction={() =>
              navigate("/platform-admin/referentiel-copropriete/coproprietaires")
            }
          />

          <QuickActionCard
            title="Lots & tantièmes"
            text="Gérez les lots, surfaces, étages, nombre de pièces, catégories et valeurs de tantièmes."
            actionLabel="Ouvrir les lots"
            onAction={() =>
              navigate("/platform-admin/referentiel-copropriete/lots")
            }
          />

          <QuickActionCard
            title="Résidents des lots"
            text="Suivez les personnes qui occupent réellement les lots : propriétaire occupant, locataire ou ayant droit."
            actionLabel="Ouvrir les résidents"
            onAction={() =>
              navigate("/platform-admin/referentiel-copropriete/occupants")
            }
          />

          <QuickActionCard
            title="Tantièmes"
            text="Paramétrez les catégories et valeurs utilisées pour les répartitions, votes et appels de fonds."
            actionLabel="Ouvrir les tantièmes"
            onAction={() =>
              navigate("/platform-admin/referentiel-copropriete/tantiemes")
            }
          />
        </div>
      </Card>

      <Card title="Accès rapides Administration plateforme" minHeight={120}>
        <div className="platform-quick-grid">
          <QuickActionCard
            title="Copropriétés"
            text="Créez, consultez et administrez les copropriétés clientes de la plateforme."
            actionLabel="Ouvrir les copropriétés"
            onAction={() => navigate("/platform-admin/coproprietes")}
          />

          <QuickActionCard
            title="Utilisateurs & rôles"
            text="Gérez les rattachements utilisateurs, les rôles locaux et les accès aux copropriétés."
            actionLabel="Ouvrir les rôles"
            onAction={() => navigate("/platform-admin/utilisateurs-roles")}
          />

          <QuickActionCard
            title="Tableau de bord"
            text="Accédez à la vue de pilotage globale de la copropriété active."
            actionLabel="Ouvrir le tableau de bord"
            onAction={() => navigate("/")}
          />

          <QuickActionCard
            title="Facturation"
            text="Consultez la couche économique déjà préparée pour les factures, paiements et abonnements."
            actionLabel="Ouvrir Facturation"
            onAction={() => navigate("/billing")}
          />
        </div>
      </Card>

      <Card title="Structuration métier disponible" minHeight={120}>
        <div className="platform-info-grid">
          <InfoBox title="Copropriétés clientes">
            Le Super Admin dispose d’un accès dédié pour créer, consulter et
            administrer les copropriétés depuis le frontend React.
          </InfoBox>

          <InfoBox title="Référentiel de la copropriété active">
            Les copropriétaires, lots, tantièmes et résidents des lots sont
            désormais accessibles sans passer par le Django Admin.
          </InfoBox>

          <InfoBox title="Supervision SaaS à enrichir">
            Les prochaines évolutions devront consolider les indicateurs
            d’exploitation, les abonnements, les accès et la facturation plateforme.
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

        .platform-referentiel-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
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
          .platform-referentiel-grid,
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

          .platform-referentiel-grid,
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