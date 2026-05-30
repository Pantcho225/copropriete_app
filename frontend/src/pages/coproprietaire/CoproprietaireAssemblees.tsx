// frontend/src/pages/coproprietaire/CoproprietaireAssemblees.tsx
import { useEffect, useMemo, useState } from "react";
import type { CSSProperties, ReactNode } from "react";

import {
  getAssembleesGeneralesCoproprietaire,
  type CoproprietaireAG,
  type CoproprietaireAGResponse,
} from "../../api/coproprietaireAg";

type StatTone = "blue" | "green" | "amber" | "slate" | "indigo";
type StatusFilter = "" | "CONVOQUEE" | "OUVERTE" | "CLOTUREE" | "ARCHIVEE" | "ANNULEE";

const emptyResponse: CoproprietaireAGResponse = {
  count: 0,
  stats: {
    total: 0,
    a_venir: 0,
    ouvertes: 0,
    cloturees: 0,
    pv_disponibles: 0,
  },
  assemblees: [],
};

export default function CoproprietaireAssemblees() {
  const [data, setData] = useState<CoproprietaireAGResponse>(emptyResponse);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statut, setStatut] = useState<StatusFilter>("");

  useEffect(() => {
    let mounted = true;

    async function loadAssemblees() {
      setLoading(true);
      setError(null);

      try {
        const response = await getAssembleesGeneralesCoproprietaire({
          search: search.trim() || undefined,
          statut: statut || undefined,
        });

        if (mounted) {
          setData(response);
        }
      } catch {
        if (mounted) {
          setError(
            "Impossible de charger vos assemblées générales pour le moment.",
          );
          setData(emptyResponse);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    void loadAssemblees();

    return () => {
      mounted = false;
    };
  }, [search, statut]);

  const assemblees = useMemo(() => data.assemblees ?? [], [data.assemblees]);

  const pvDisponibles = useMemo(() => {
    return assemblees.filter((ag) => ag.has_pv).length;
  }, [assemblees]);

  if (loading) {
    return (
      <div style={styles.loadingCard}>
        <div style={styles.loadingIcon}>🗳️</div>
        <div>
          <p style={styles.loadingTitle}>Chargement de vos assemblées...</p>
          <p style={styles.muted}>
            Nous récupérons les assemblées générales accessibles à vos lots.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.stack}>
      <section style={styles.hero}>
        <div style={styles.heroContent}>
          <div style={styles.heroBadge}>Vie de la copropriété</div>

          <h2 style={styles.heroTitle}>Vos assemblées générales</h2>

          <p style={styles.heroText}>
            Consultez les assemblées accessibles à vos lots : convocations,
            quorum, présence, résolutions, votes et procès-verbaux disponibles.
          </p>

          <div style={styles.heroMeta}>
            <span style={styles.metaPill}>
              Total : {formatNumber(data.stats.total)}
            </span>
            <span style={styles.metaPill}>
              Ouvertes : {formatNumber(data.stats.ouvertes)}
            </span>
            <span style={styles.metaPill}>
              PV disponibles : {formatNumber(data.stats.pv_disponibles)}
            </span>
          </div>
        </div>

        <div style={styles.secureBox}>
          <div style={styles.secureIcon}>🔐</div>
          <p style={styles.secureTitle}>Accès sécurisé</p>
          <p style={styles.secureText}>
            Les données sont filtrées automatiquement selon votre compte
            copropriétaire et les lots qui vous sont rattachés.
          </p>
        </div>
      </section>

      <section style={styles.statsGrid}>
        <StatCard
          label="Total"
          value={data.stats.total}
          hint="Assemblées visibles"
          tone="blue"
        />
        <StatCard
          label="À venir"
          value={data.stats.a_venir}
          hint="Convocations"
          tone="amber"
        />
        <StatCard
          label="Ouvertes"
          value={data.stats.ouvertes}
          hint="Sessions en cours"
          tone="indigo"
        />
        <StatCard
          label="Clôturées"
          value={data.stats.cloturees}
          hint="AG finalisées"
          tone="green"
        />
        <StatCard
          label="PV"
          value={pvDisponibles || data.stats.pv_disponibles}
          hint="Documents disponibles"
          tone="slate"
        />
      </section>

      <section style={styles.card}>
        <div style={styles.sectionHeader}>
          <div>
            <p style={styles.sectionEyebrow}>Assemblées</p>
            <h3 style={styles.sectionTitle}>Liste de vos assemblées générales</h3>
            <p style={styles.sectionText}>
              Recherchez une assemblée par titre, lieu ou statut, puis ouvrez le
              procès-verbal lorsqu’il est disponible.
            </p>
          </div>

          <div style={styles.resultPill}>
            {formatNumber(assemblees.length)} résultat(s)
          </div>
        </div>

        <div style={styles.filters}>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Rechercher une assemblée, un lieu, un objet..."
            style={styles.input}
          />

          <select
            value={statut}
            onChange={(event) => setStatut(event.target.value as StatusFilter)}
            style={styles.select}
          >
            <option value="">Tous les statuts</option>
            <option value="CONVOQUEE">Convoquée</option>
            <option value="OUVERTE">Ouverte</option>
            <option value="CLOTUREE">Clôturée</option>
            <option value="ARCHIVEE">Archivée</option>
            <option value="ANNULEE">Annulée</option>
          </select>
        </div>

        {error ? <div style={styles.error}>{error}</div> : null}

        {!error && assemblees.length === 0 ? (
          <EmptyState
            title="Aucune assemblée générale accessible"
            text="Aucune assemblée générale n’est actuellement rattachée à vos lots ou visible depuis votre espace copropriétaire."
          />
        ) : null}

        {!error && assemblees.length > 0 ? (
          <div style={styles.list}>
            {assemblees.map((ag) => (
              <AGCard key={ag.id} ag={ag} />
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
}

function AGCard({ ag }: { ag: CoproprietaireAG }) {
  const pvUrl = ag.pv_signed_url || ag.pv_url;
  const presence = ag.presence_coproprietaire;
  const votesTotal = ag.vote_summary?.total ?? 0;

  return (
    <article style={styles.agCard}>
      <div style={styles.agHeader}>
        <div style={styles.agMain}>
          <div style={styles.badges}>
            <Badge style={getStatusStyle(ag.statut)}>
              {ag.statut_label || ag.statut || "Statut non défini"}
            </Badge>

            <Badge style={getQuorumStyle(ag.quorum_atteint)}>
              {getQuorumLabel(ag.quorum_atteint)}
            </Badge>

            <Badge style={getPresenceStyle(presence?.status)}>
              {presence?.label || "Présence non renseignée"}
            </Badge>
          </div>

          <h4 style={styles.agTitle}>{ag.titre}</h4>

          <div style={styles.agMeta}>
            <span>{formatDate(ag.date_ag)}</span>
            {ag.lieu ? <span>Lieu : {ag.lieu}</span> : null}
          </div>

          <p style={styles.description}>
            {ag.description ||
              "Aucun ordre du jour détaillé n’est disponible pour cette assemblée."}
          </p>
        </div>

        <div style={styles.agActions}>
          <button
            type="button"
            disabled={!pvUrl}
            onClick={() => openDocument(pvUrl)}
            style={{
              ...styles.pvButton,
              ...(!pvUrl ? styles.pvButtonDisabled : {}),
            }}
          >
            {pvUrl ? "Ouvrir le PV" : "PV indisponible"}
          </button>

          {ag.has_pv ? (
            <span style={styles.pvHint}>
              {ag.pv_signed_url ? "PV signé disponible" : "PV disponible"}
            </span>
          ) : (
            <span style={styles.pvHintMuted}>Aucun PV disponible</span>
          )}
        </div>
      </div>

      <div style={styles.cardStats}>
        <SmallStat
          label="Résolutions"
          value={formatNumber(ag.total_resolutions)}
        />
        <SmallStat label="Mes votes" value={formatNumber(votesTotal)} />
        <SmallStat
          label="Procès-verbal"
          value={ag.has_pv ? "Disponible" : "Non disponible"}
        />
      </div>
    </article>
  );
}

function StatCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: number;
  hint: string;
  tone: StatTone;
}) {
  const toneStyle = statTones[tone];

  return (
    <div
      style={{
        ...styles.statCard,
        borderColor: toneStyle.border,
        background: toneStyle.background,
      }}
    >
      <p style={styles.statLabel}>{label}</p>
      <p style={{ ...styles.statValue, color: toneStyle.color }}>
        {formatNumber(value)}
      </p>
      <p style={styles.statHint}>{hint}</p>
    </div>
  );
}

function SmallStat({ label, value }: { label: string; value: string }) {
  return (
    <div style={styles.smallStat}>
      <p style={styles.smallStatLabel}>{label}</p>
      <p style={styles.smallStatValue}>{value}</p>
    </div>
  );
}

function Badge({
  children,
  style,
}: {
  children: ReactNode;
  style: CSSProperties;
}) {
  return <span style={{ ...styles.badge, ...style }}>{children}</span>;
}

function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <div style={styles.emptyState}>
      <div style={styles.emptyIcon}>🗳️</div>
      <p style={styles.emptyTitle}>{title}</p>
      <p style={styles.emptyText}>{text}</p>
    </div>
  );
}

function formatDate(value: string | null): string {
  if (!value) return "Date non renseignée";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Date non renseignée";

  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatNumber(value: number | string | null | undefined) {
  const numberValue = Number(value || 0);

  return new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: 0,
  }).format(numberValue);
}

function normalize(value: string | null | undefined): string {
  return String(value ?? "").trim().toUpperCase();
}

function getStatusStyle(statut: string | null | undefined): CSSProperties {
  const value = normalize(statut);

  if (["CLOTUREE", "CLÔTURÉE", "ARCHIVEE", "ARCHIVÉE"].includes(value)) {
    return {
      background: "#ecfdf5",
      color: "#047857",
      borderColor: "#a7f3d0",
    };
  }

  if (value === "OUVERTE") {
    return {
      background: "#eff6ff",
      color: "#1d4ed8",
      borderColor: "#bfdbfe",
    };
  }

  if (["CONVOQUEE", "CONVOQUÉE"].includes(value)) {
    return {
      background: "#fffbeb",
      color: "#b45309",
      borderColor: "#fde68a",
    };
  }

  if (["ANNULEE", "ANNULÉE"].includes(value)) {
    return {
      background: "#fff1f2",
      color: "#be123c",
      borderColor: "#fecdd3",
    };
  }

  return {
    background: "#f8fafc",
    color: "#475569",
    borderColor: "#e2e8f0",
  };
}

function getPresenceStyle(status: string | null | undefined): CSSProperties {
  const value = normalize(status);

  if (value === "PRESENT") {
    return {
      background: "#ecfdf5",
      color: "#047857",
      borderColor: "#a7f3d0",
    };
  }

  if (value === "ABSENT") {
    return {
      background: "#fffbeb",
      color: "#b45309",
      borderColor: "#fde68a",
    };
  }

  return {
    background: "#f8fafc",
    color: "#475569",
    borderColor: "#e2e8f0",
  };
}

function getQuorumLabel(value: boolean | null): string {
  if (value === true) return "Quorum atteint";
  if (value === false) return "Quorum non atteint";
  return "Quorum non renseigné";
}

function getQuorumStyle(value: boolean | null): CSSProperties {
  if (value === true) {
    return {
      background: "#ecfdf5",
      color: "#047857",
      borderColor: "#a7f3d0",
    };
  }

  if (value === false) {
    return {
      background: "#fff1f2",
      color: "#be123c",
      borderColor: "#fecdd3",
    };
  }

  return {
    background: "#f8fafc",
    color: "#475569",
    borderColor: "#e2e8f0",
  };
}

function openDocument(url: string | null): void {
  if (!url) return;
  window.open(url, "_blank", "noopener,noreferrer");
}

const statTones: Record<
  StatTone,
  { background: string; border: string; color: string }
> = {
  blue: {
    background: "#eff6ff",
    border: "#bfdbfe",
    color: "#2563eb",
  },
  green: {
    background: "#ecfdf5",
    border: "#bbf7d0",
    color: "#059669",
  },
  amber: {
    background: "#fffbeb",
    border: "#fde68a",
    color: "#d97706",
  },
  slate: {
    background: "#f8fafc",
    border: "#e2e8f0",
    color: "#475569",
  },
  indigo: {
    background: "#eef2ff",
    border: "#c7d2fe",
    color: "#4f46e5",
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
      "linear-gradient(135deg, rgba(15,23,42,0.97), rgba(37,99,235,0.92)), radial-gradient(circle at top right, rgba(125,211,252,0.46), transparent 36%)",
    color: "white",
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) 320px",
    gap: 24,
    boxShadow: "0 30px 85px rgba(15,23,42,0.26)",
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
    fontSize: 34,
    lineHeight: 1.08,
    fontWeight: 950,
    letterSpacing: "-0.04em",
  },

  heroText: {
    margin: "14px 0 0",
    maxWidth: 820,
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
    gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
    gap: 16,
  },

  statCard: {
    border: "1px solid",
    borderRadius: 26,
    padding: 19,
    boxShadow: "0 16px 44px rgba(15,23,42,0.06)",
    minHeight: 134,
  },

  statLabel: {
    margin: 0,
    fontSize: 11,
    fontWeight: 950,
    letterSpacing: "0.14em",
    textTransform: "uppercase",
    color: "#64748b",
  },

  statValue: {
    margin: "12px 0 0",
    fontSize: 30,
    lineHeight: 1.1,
    fontWeight: 950,
  },

  statHint: {
    margin: "8px 0 0",
    fontSize: 12,
    color: "#64748b",
    lineHeight: 1.55,
    fontWeight: 650,
  },

  card: {
    borderRadius: 30,
    background: "rgba(255,255,255,0.92)",
    border: "1px solid rgba(226,232,240,0.95)",
    boxShadow: "0 20px 64px rgba(15,23,42,0.08)",
    padding: 24,
  },

  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 18,
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
    fontSize: 21,
    lineHeight: 1.2,
    fontWeight: 950,
    color: "#0f172a",
    letterSpacing: "-0.02em",
  },

  sectionText: {
    margin: "8px 0 0",
    maxWidth: 760,
    fontSize: 13,
    lineHeight: 1.6,
    color: "#64748b",
    fontWeight: 650,
  },

  resultPill: {
    borderRadius: 999,
    padding: "10px 13px",
    background: "#eef2ff",
    border: "1px solid #c7d2fe",
    color: "#4f46e5",
    fontSize: 12,
    fontWeight: 950,
    whiteSpace: "nowrap",
  },

  filters: {
    marginTop: 20,
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) 240px",
    gap: 12,
    alignItems: "center",
  },

  input: {
    border: "1px solid #e2e8f0",
    borderRadius: 18,
    padding: "13px 15px",
    fontSize: 14,
    outline: "none",
    color: "#0f172a",
    background: "#f8fafc",
  },

  select: {
    border: "1px solid #e2e8f0",
    borderRadius: 18,
    padding: "13px 15px",
    fontSize: 14,
    outline: "none",
    color: "#0f172a",
    background: "#f8fafc",
  },

  list: {
    marginTop: 20,
    display: "grid",
    gap: 14,
  },

  agCard: {
    borderRadius: 26,
    padding: 20,
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.98), rgba(248,250,252,0.96))",
    border: "1px solid #e2e8f0",
    boxShadow: "0 16px 44px rgba(15,23,42,0.06)",
  },

  agHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 18,
  },

  agMain: {
    minWidth: 0,
  },

  badges: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
  },

  badge: {
    display: "inline-flex",
    alignItems: "center",
    border: "1px solid",
    borderRadius: 999,
    padding: "6px 10px",
    fontSize: 12,
    fontWeight: 950,
    whiteSpace: "nowrap",
  },

  agTitle: {
    margin: "14px 0 0",
    fontSize: 20,
    lineHeight: 1.25,
    fontWeight: 950,
    color: "#0f172a",
    letterSpacing: "-0.02em",
  },

  agMeta: {
    marginTop: 8,
    display: "flex",
    flexWrap: "wrap",
    gap: 16,
    fontSize: 13,
    color: "#64748b",
    fontWeight: 700,
  },

  description: {
    margin: "10px 0 0",
    maxWidth: 900,
    fontSize: 14,
    lineHeight: 1.65,
    color: "#475569",
    fontWeight: 600,
  },

  agActions: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    alignItems: "flex-end",
    flexShrink: 0,
  },

  pvButton: {
    border: "none",
    borderRadius: 16,
    padding: "11px 15px",
    background: "#0f172a",
    color: "white",
    fontSize: 13,
    fontWeight: 950,
    cursor: "pointer",
    boxShadow: "0 12px 30px rgba(15,23,42,0.18)",
    whiteSpace: "nowrap",
  },

  pvButtonDisabled: {
    background: "#e2e8f0",
    color: "#94a3b8",
    cursor: "not-allowed",
    boxShadow: "none",
  },

  pvHint: {
    color: "#059669",
    fontSize: 12,
    fontWeight: 850,
  },

  pvHintMuted: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: 850,
  },

  cardStats: {
    marginTop: 18,
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 12,
  },

  smallStat: {
    borderRadius: 18,
    padding: 14,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
  },

  smallStatLabel: {
    margin: 0,
    fontSize: 11,
    fontWeight: 950,
    letterSpacing: "0.13em",
    textTransform: "uppercase",
    color: "#64748b",
  },

  smallStatValue: {
    margin: "8px 0 0",
    fontSize: 16,
    fontWeight: 950,
    color: "#0f172a",
  },

  error: {
    marginTop: 18,
    borderRadius: 22,
    padding: 16,
    background: "#fff1f2",
    border: "1px solid #fecdd3",
    color: "#be123c",
    fontSize: 14,
    fontWeight: 850,
  },

  emptyState: {
    marginTop: 20,
    borderRadius: 26,
    border: "1px dashed #cbd5e1",
    background: "#f8fafc",
    padding: 30,
    textAlign: "center",
  },

  emptyIcon: {
    width: 48,
    height: 48,
    margin: "0 auto 12px",
    borderRadius: 18,
    background: "#eef2ff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 22,
  },

  emptyTitle: {
    margin: 0,
    fontSize: 17,
    fontWeight: 950,
    color: "#0f172a",
  },

  emptyText: {
    maxWidth: 640,
    margin: "8px auto 0",
    fontSize: 14,
    lineHeight: 1.65,
    color: "#64748b",
    fontWeight: 600,
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