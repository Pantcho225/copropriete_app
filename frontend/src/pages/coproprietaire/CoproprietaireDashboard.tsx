import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Link } from "react-router-dom";

import { getAuthMe, type AuthMeResponse } from "../../api/auth";

type DashboardState = {
  loading: boolean;
  me: AuthMeResponse | null;
  error: string | null;
};

type Tone = "blue" | "green" | "amber" | "slate" | "indigo" | "rose";

type QuickAction = {
  title: string;
  description: string;
  path: string;
  icon: string;
  tone: Tone;
};

const QUICK_ACTIONS: QuickAction[] = [
  {
    title: "Mes lots",
    description: "Consulter les lots rattachés à votre compte.",
    path: "/coproprietaire/mes-lots",
    icon: "🏢",
    tone: "blue",
  },
  {
    title: "Appels de charges",
    description: "Suivre vos appels, montants dus et échéances.",
    path: "/coproprietaire/appels",
    icon: "📄",
    tone: "amber",
  },
  {
    title: "Paiements",
    description: "Vérifier l’historique de vos règlements.",
    path: "/coproprietaire/paiements",
    icon: "💳",
    tone: "green",
  },
  {
    title: "Relances",
    description: "Voir les rappels liés à vos lots.",
    path: "/coproprietaire/relances",
    icon: "🔔",
    tone: "rose",
  },
  {
    title: "Documents",
    description: "Accéder aux PV et documents utiles.",
    path: "/coproprietaire/documents",
    icon: "📁",
    tone: "slate",
  },
  {
    title: "Assemblées générales",
    description: "Consulter vos AG, votes, résolutions et PV.",
    path: "/coproprietaire/ag",
    icon: "🗳️",
    tone: "indigo",
  },
];

export default function CoproprietaireDashboard() {
  const [state, setState] = useState<DashboardState>({
    loading: true,
    me: null,
    error: null,
  });

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        const me = await getAuthMe();

        if (!mounted) return;

        setState({
          loading: false,
          me,
          error: null,
        });
      } catch {
        if (!mounted) return;

        setState({
          loading: false,
          me: null,
          error: "Impossible de charger votre espace copropriétaire.",
        });
      }
    }

    load();

    return () => {
      mounted = false;
    };
  }, []);

  const mainMembership = useMemo(() => {
    return (
      state.me?.memberships.find(
        (item) => item.role === "COPROPRIETAIRE" && item.is_active,
      ) ?? null
    );
  }, [state.me]);

  if (state.loading) {
    return (
      <div style={styles.loadingCard}>
        <div style={styles.loadingIcon}>⏳</div>
        <div>
          <p style={styles.loadingTitle}>Chargement de votre tableau de bord...</p>
          <p style={styles.muted}>Nous préparons vos informations personnelles.</p>
        </div>
      </div>
    );
  }

  if (state.error || !state.me) {
    return (
      <div style={styles.alertDanger}>
        <strong>Erreur de chargement</strong>
        <p style={styles.alertText}>{state.error ?? "Profil introuvable."}</p>
      </div>
    );
  }

  const fullName =
    [state.me.user.first_name, state.me.user.last_name].filter(Boolean).join(" ") ||
    state.me.user.username;

  const coproName = mainMembership?.copropriete.nom ?? "Copropriété non définie";
  const membershipStatus = mainMembership?.is_active ? "Actif" : "À vérifier";

  return (
    <div style={styles.stack}>
      <section style={styles.hero}>
        <div style={styles.heroContent}>
          <div style={styles.heroBadge}>Portail personnel</div>

          <h2 style={styles.heroTitle}>Bonjour {fullName}</h2>

          <p style={styles.heroText}>
            Retrouvez vos informations essentielles : lots, appels de charges,
            paiements, relances, documents et assemblées générales.
          </p>

          <div style={styles.heroMeta}>
            <span style={styles.metaPill}>Copropriété : {coproName}</span>
            <span style={styles.metaPill}>Profil : Copropriétaire</span>
            <span style={styles.metaPill}>Statut : {membershipStatus}</span>
          </div>
        </div>

        <div style={styles.secureBox}>
          <div style={styles.secureIcon}>🔐</div>
          <p style={styles.secureTitle}>Accès sécurisé</p>
          <p style={styles.secureText}>
            Vos données sont automatiquement filtrées selon votre compte et vos
            lots rattachés.
          </p>
        </div>
      </section>

      <section style={styles.statsGrid}>
        <InfoCard
          label="Compte"
          value="Sécurisé"
          description="Session copropriétaire active"
          tone="green"
        />
        <InfoCard
          label="Copropriété"
          value={coproName}
          description="Résidence rattachée à votre profil"
          tone="blue"
        />
        <InfoCard
          label="Rôle"
          value="Copropriétaire"
          description="Accès personnel séparé de l’administration"
          tone="indigo"
        />
        <InfoCard
          label="Données"
          value="Filtrées"
          description="Lots, charges et documents personnels"
          tone="slate"
        />
      </section>

      <section style={styles.mainGrid}>
        <div style={styles.card}>
          <div style={styles.sectionHeader}>
            <div>
              <p style={styles.sectionEyebrow}>Accès rapide</p>
              <h3 style={styles.sectionTitle}>Vos démarches courantes</h3>
            </div>

            <span style={styles.sectionPill}>6 modules disponibles</span>
          </div>

          <div style={styles.actionsGrid}>
            {QUICK_ACTIONS.map((action) => (
              <ActionCard key={action.path} action={action} />
            ))}
          </div>
        </div>

        <aside style={styles.sidePanel}>
          <div style={styles.card}>
            <p style={styles.sectionEyebrow}>Situation du portail</p>
            <h3 style={styles.sectionTitle}>Espace copropriétaire opérationnel</h3>

            <p style={styles.paragraph}>
              Votre espace personnel est séparé de l’espace administrateur. Vous
              pouvez consulter les informations accessibles à votre profil sans
              gérer les données globales de la copropriété.
            </p>

            <div style={styles.statusList}>
              <StatusLine label="Authentification" status="Validé" tone="green" />
              <StatusLine label="Mes lots" status="Disponible" tone="green" />
              <StatusLine label="Appels de charges" status="Disponible" tone="green" />
              <StatusLine label="Paiements" status="Disponible" tone="green" />
              <StatusLine label="Relances" status="Disponible" tone="green" />
              <StatusLine label="Documents" status="Disponible" tone="green" />
              <StatusLine label="Assemblées générales" status="Disponible" tone="green" />
            </div>
          </div>

          <div style={styles.noteCard}>
            <p style={styles.noteTitle}>Conseil</p>
            <p style={styles.noteText}>
              Consultez régulièrement vos appels, relances et documents afin de
              garder votre situation copropriétaire à jour.
            </p>
          </div>
        </aside>
      </section>
    </div>
  );
}

function InfoCard({
  label,
  value,
  description,
  tone,
}: {
  label: string;
  value: string;
  description: string;
  tone: Tone;
}) {
  const toneStyle = tones[tone];

  return (
    <div
      style={{
        ...styles.infoCard,
        borderColor: toneStyle.border,
        background: toneStyle.softBackground,
      }}
    >
      <p style={styles.infoLabel}>{label}</p>
      <p style={{ ...styles.infoValue, color: toneStyle.color }}>{value}</p>
      <p style={styles.infoDescription}>{description}</p>
    </div>
  );
}

function ActionCard({ action }: { action: QuickAction }) {
  const toneStyle = tones[action.tone];

  return (
    <Link
      to={action.path}
      style={{
        ...styles.actionCard,
        borderColor: toneStyle.border,
        background: toneStyle.softBackground,
      }}
    >
      <span
        style={{
          ...styles.actionIcon,
          background: toneStyle.iconBackground,
        }}
      >
        {action.icon}
      </span>

      <span style={styles.actionContent}>
        <span style={styles.actionTitle}>{action.title}</span>
        <span style={styles.actionText}>{action.description}</span>
      </span>

      <span style={{ ...styles.actionArrow, color: toneStyle.color }}>→</span>
    </Link>
  );
}

function StatusLine({
  label,
  status,
  tone,
}: {
  label: string;
  status: string;
  tone: Tone;
}) {
  const toneStyle = tones[tone];

  return (
    <div style={styles.statusLine}>
      <span style={styles.statusLabel}>{label}</span>
      <strong
        style={{
          ...styles.statusBadge,
          background: toneStyle.softBackground,
          color: toneStyle.color,
          borderColor: toneStyle.border,
        }}
      >
        {status}
      </strong>
    </div>
  );
}

const tones: Record<
  Tone,
  {
    color: string;
    border: string;
    softBackground: string;
    iconBackground: string;
  }
> = {
  blue: {
    color: "#2563eb",
    border: "#bfdbfe",
    softBackground: "#eff6ff",
    iconBackground: "#dbeafe",
  },
  green: {
    color: "#059669",
    border: "#bbf7d0",
    softBackground: "#ecfdf5",
    iconBackground: "#d1fae5",
  },
  amber: {
    color: "#d97706",
    border: "#fde68a",
    softBackground: "#fffbeb",
    iconBackground: "#fef3c7",
  },
  slate: {
    color: "#475569",
    border: "#e2e8f0",
    softBackground: "#f8fafc",
    iconBackground: "#e2e8f0",
  },
  indigo: {
    color: "#4f46e5",
    border: "#c7d2fe",
    softBackground: "#eef2ff",
    iconBackground: "#e0e7ff",
  },
  rose: {
    color: "#be123c",
    border: "#fecdd3",
    softBackground: "#fff1f2",
    iconBackground: "#ffe4e6",
  },
};

const styles: Record<string, CSSProperties> = {
  stack: {
    display: "flex",
    flexDirection: "column",
    gap: 22,
  },

  hero: {
    borderRadius: 34,
    padding: 30,
    background:
      "linear-gradient(135deg, rgba(30,64,175,0.97), rgba(79,70,229,0.93)), radial-gradient(circle at top right, rgba(56,189,248,0.46), transparent 36%)",
    color: "white",
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) 320px",
    gap: 24,
    boxShadow: "0 30px 85px rgba(30,64,175,0.28)",
    overflow: "hidden",
  },

  heroContent: {
    minWidth: 0,
  },

  heroBadge: {
    display: "inline-flex",
    alignItems: "center",
    borderRadius: 999,
    padding: "7px 11px",
    background: "rgba(255,255,255,0.13)",
    border: "1px solid rgba(255,255,255,0.18)",
    color: "#dbeafe",
    fontSize: 11,
    fontWeight: 950,
    letterSpacing: "0.14em",
    textTransform: "uppercase",
  },

  heroTitle: {
    margin: "14px 0 0",
    fontSize: 36,
    lineHeight: 1.08,
    fontWeight: 950,
    letterSpacing: "-0.04em",
  },

  heroText: {
    margin: "14px 0 0",
    maxWidth: 760,
    color: "#dbeafe",
    fontSize: 15,
    lineHeight: 1.75,
    fontWeight: 550,
  },

  heroMeta: {
    display: "flex",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 22,
  },

  metaPill: {
    borderRadius: 999,
    padding: "8px 12px",
    background: "rgba(255,255,255,0.14)",
    border: "1px solid rgba(255,255,255,0.20)",
    color: "#ffffff",
    fontSize: 12,
    fontWeight: 850,
  },

  secureBox: {
    alignSelf: "stretch",
    borderRadius: 28,
    padding: 22,
    background: "rgba(255,255,255,0.13)",
    border: "1px solid rgba(255,255,255,0.22)",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.10)",
  },

  secureIcon: {
    width: 48,
    height: 48,
    borderRadius: 18,
    background: "rgba(255,255,255,0.14)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 22,
    marginBottom: 14,
  },

  secureTitle: {
    margin: 0,
    fontSize: 18,
    fontWeight: 950,
  },

  secureText: {
    margin: "10px 0 0",
    color: "#dbeafe",
    fontSize: 14,
    lineHeight: 1.6,
  },

  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: 16,
  },

  infoCard: {
    border: "1px solid",
    borderRadius: 26,
    padding: 19,
    boxShadow: "0 16px 44px rgba(15,23,42,0.06)",
    minHeight: 134,
  },

  infoLabel: {
    margin: 0,
    color: "#64748b",
    fontSize: 11,
    fontWeight: 950,
    letterSpacing: "0.14em",
    textTransform: "uppercase",
  },

  infoValue: {
    margin: "12px 0 0",
    fontSize: 22,
    lineHeight: 1.2,
    fontWeight: 950,
    wordBreak: "break-word",
  },

  infoDescription: {
    margin: "8px 0 0",
    color: "#64748b",
    fontSize: 12,
    lineHeight: 1.55,
    fontWeight: 650,
  },

  mainGrid: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.35fr) minmax(340px, 0.65fr)",
    gap: 18,
    alignItems: "start",
  },

  card: {
    borderRadius: 30,
    background: "rgba(255,255,255,0.90)",
    border: "1px solid rgba(226,232,240,0.95)",
    boxShadow: "0 20px 64px rgba(15,23,42,0.08)",
    padding: 23,
  },

  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 16,
    alignItems: "flex-start",
  },

  sectionEyebrow: {
    margin: 0,
    fontSize: 11,
    fontWeight: 950,
    color: "#2563eb",
    letterSpacing: "0.14em",
    textTransform: "uppercase",
  },

  sectionTitle: {
    margin: "7px 0 0",
    fontSize: 20,
    lineHeight: 1.2,
    fontWeight: 950,
    color: "#0f172a",
    letterSpacing: "-0.02em",
  },

  sectionPill: {
    flexShrink: 0,
    borderRadius: 999,
    padding: "8px 11px",
    background: "#eef2ff",
    border: "1px solid #c7d2fe",
    color: "#4f46e5",
    fontSize: 12,
    fontWeight: 900,
  },

  actionsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 14,
    marginTop: 20,
  },

  actionCard: {
    borderRadius: 24,
    border: "1px solid",
    padding: 16,
    display: "flex",
    alignItems: "center",
    gap: 13,
    textDecoration: "none",
    color: "#0f172a",
    minHeight: 104,
    boxShadow: "0 14px 34px rgba(15,23,42,0.04)",
  },

  actionIcon: {
    width: 44,
    height: 44,
    borderRadius: 17,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 20,
    flexShrink: 0,
  },

  actionContent: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    minWidth: 0,
  },

  actionTitle: {
    fontSize: 14,
    fontWeight: 950,
    color: "#0f172a",
  },

  actionText: {
    color: "#64748b",
    fontSize: 12,
    lineHeight: 1.45,
    fontWeight: 650,
  },

  actionArrow: {
    marginLeft: "auto",
    fontSize: 20,
    fontWeight: 950,
    flexShrink: 0,
  },

  sidePanel: {
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },

  paragraph: {
    margin: "14px 0 0",
    fontSize: 14,
    lineHeight: 1.7,
    color: "#64748b",
    fontWeight: 600,
  },

  statusList: {
    marginTop: 18,
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },

  statusLine: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    borderRadius: 18,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    padding: "11px 12px",
    fontSize: 13,
    color: "#475569",
  },

  statusLabel: {
    fontWeight: 750,
  },

  statusBadge: {
    borderRadius: 999,
    border: "1px solid",
    padding: "5px 9px",
    fontSize: 11,
    fontWeight: 950,
    whiteSpace: "nowrap",
  },

  noteCard: {
    borderRadius: 28,
    padding: 20,
    background:
      "linear-gradient(135deg, rgba(15,23,42,0.94), rgba(30,41,59,0.92))",
    color: "white",
    boxShadow: "0 20px 60px rgba(15,23,42,0.16)",
  },

  noteTitle: {
    margin: 0,
    fontSize: 15,
    fontWeight: 950,
  },

  noteText: {
    margin: "9px 0 0",
    fontSize: 13,
    lineHeight: 1.65,
    color: "#cbd5e1",
    fontWeight: 600,
  },

  alertDanger: {
    borderRadius: 26,
    background: "#fff1f2",
    border: "1px solid #fecdd3",
    color: "#be123c",
    padding: 22,
    boxShadow: "0 18px 44px rgba(190,18,60,0.08)",
  },

  alertText: {
    margin: "8px 0 0",
    fontSize: 14,
    lineHeight: 1.6,
  },

  loadingCard: {
    borderRadius: 28,
    background: "rgba(255,255,255,0.92)",
    border: "1px solid rgba(226,232,240,0.95)",
    boxShadow: "0 18px 60px rgba(15,23,42,0.08)",
    padding: 24,
    display: "flex",
    alignItems: "center",
    gap: 14,
  },

  loadingIcon: {
    width: 46,
    height: 46,
    borderRadius: 18,
    background: "#eef2ff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 20,
    flexShrink: 0,
  },

  loadingTitle: {
    margin: 0,
    fontSize: 16,
    fontWeight: 950,
    color: "#0f172a",
  },

  muted: {
    margin: "8px 0 0",
    fontSize: 13,
    color: "#64748b",
    fontWeight: 600,
  },
};