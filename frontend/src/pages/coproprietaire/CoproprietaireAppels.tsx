// frontend/src/pages/coproprietaire/CoproprietaireAppels.tsx
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Link } from "react-router-dom";

import {
  getAppelsCoproprietaire,
  type CoproprietaireAppelItem,
  type CoproprietaireAppelsResponse,
} from "../../api/coproprietaire";

type PageState = {
  loading: boolean;
  data: CoproprietaireAppelsResponse | null;
  error: string | null;
};

type StatusFilter = "ALL" | "A_PAYER" | "PAYE" | "RETARD";
type StatTone = "blue" | "green" | "orange" | "red" | "slate";

export default function CoproprietaireAppels() {
  const [state, setState] = useState<PageState>({
    loading: true,
    data: null,
    error: null,
  });

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");

  useEffect(() => {
    let mounted = true;

    async function loadAppels() {
      try {
        const data = await getAppelsCoproprietaire();

        if (!mounted) return;

        setState({
          loading: false,
          data,
          error: null,
        });
      } catch (error) {
        console.error("Erreur chargement appels copropriétaire", error);

        if (!mounted) return;

        setState({
          loading: false,
          data: null,
          error: "Impossible de charger vos appels de charges pour le moment.",
        });
      }
    }

    void loadAppels();

    return () => {
      mounted = false;
    };
  }, []);

  const appels = useMemo(() => {
    return state.data?.appels ?? [];
  }, [state.data?.appels]);

  const filteredAppels = useMemo(() => {
    const q = query.trim().toLowerCase();

    return appels.filter((appel) => {
      const haystack = [
        appel.libelle,
        appel.type_appel,
        appel.statut_label,
        appel.lot?.label,
        appel.lot?.reference,
        appel.lot?.numero,
        appel.lot?.type_lot,
        appel.exercice?.nom,
        appel.tantieme_categorie?.nom,
      ]
        .join(" ")
        .toLowerCase();

      const matchesQuery = !q || haystack.includes(q);

      const reste = toNumber(appel.reste_a_payer);
      const isPaid = reste <= 0;
      const isLate = appel.is_overdue === true;

      const matchesStatus =
        statusFilter === "ALL" ||
        (statusFilter === "A_PAYER" && reste > 0 && !isLate) ||
        (statusFilter === "PAYE" && isPaid) ||
        (statusFilter === "RETARD" && isLate);

      return matchesQuery && matchesStatus;
    });
  }, [appels, query, statusFilter]);

  const stats = state.data?.stats;
  const totalDu = toNumber(stats?.total_du);
  const totalPaye = toNumber(stats?.total_paye);
  const resteAPayer = toNumber(stats?.reste_a_payer);
  const nbAppels = toNumber(stats?.nb_appels);
  const nbRetard = toNumber(stats?.nb_en_retard);

  const paymentRate = totalDu > 0 ? Math.min(100, (totalPaye / totalDu) * 100) : 0;

  const coproprieteName =
    state.data?.lots?.[0]?.copropriete?.nom || "Copropriété non définie";

  if (state.loading) {
    return (
      <div style={styles.loadingCard}>
        <div style={styles.loadingIcon}>📄</div>
        <div>
          <p style={styles.loadingTitle}>Chargement de vos appels...</p>
          <p style={styles.muted}>
            Nous récupérons uniquement les appels liés à vos lots.
          </p>
        </div>
      </div>
    );
  }

  if (state.error) {
    return (
      <div style={styles.alertDanger}>
        <strong>Erreur de chargement</strong>
        <p style={styles.alertText}>{state.error}</p>
      </div>
    );
  }

  return (
    <div style={styles.stack}>
      <section style={styles.hero}>
        <div style={styles.heroContent}>
          <div style={styles.heroBadge}>Suivi financier personnel</div>

          <h2 style={styles.heroTitle}>Vos appels de charges</h2>

          <p style={styles.heroText}>
            Consultez les appels de fonds associés à vos lots : montants dus,
            règlements enregistrés, échéances et retards éventuels.
          </p>

          <div style={styles.heroMeta}>
            <span style={styles.metaPill}>Copropriété : {coproprieteName}</span>
            <span style={styles.metaPill}>{formatNumber(nbAppels)} appel(s)</span>
            <span style={styles.metaPill}>
              Reste à payer : {formatMoneyFCFA(resteAPayer)}
            </span>
          </div>
        </div>

        <div style={styles.secureBox}>
          <div style={styles.secureIcon}>🔐</div>
          <p style={styles.secureTitle}>Données filtrées</p>
          <p style={styles.secureText}>
            Seuls les appels liés à vos lots rattachés sont affichés dans cet
            espace.
          </p>
        </div>
      </section>

      <section style={styles.grid}>
        <StatCard
          title="Total appelé"
          value={formatMoneyFCFA(totalDu)}
          description="Montant total des appels visibles"
          tone="blue"
        />
        <StatCard
          title="Déjà payé"
          value={formatMoneyFCFA(totalPaye)}
          description="Somme déjà réglée"
          tone="green"
        />
        <StatCard
          title="Reste à payer"
          value={formatMoneyFCFA(resteAPayer)}
          description="Solde restant dû"
          tone={resteAPayer > 0 ? "orange" : "green"}
        />
        <StatCard
          title="En retard"
          value={formatNumber(nbRetard)}
          description="Échéances dépassées"
          tone={nbRetard > 0 ? "red" : "slate"}
        />
      </section>

      <section style={styles.progressCard}>
        <div style={styles.progressHeader}>
          <div>
            <p style={styles.sectionEyebrow}>Progression de paiement</p>
            <h3 style={styles.sectionTitle}>Synthèse de votre situation</h3>
          </div>

          <strong style={styles.progressRate}>{formatNumber(paymentRate)}%</strong>
        </div>

        <div style={styles.progressTrack}>
          <div
            style={{
              ...styles.progressFill,
              width: `${paymentRate}%`,
            }}
          />
        </div>

        <div style={styles.progressFooter}>
          <span>Payé : {formatMoneyFCFA(totalPaye)}</span>
          <span>Reste : {formatMoneyFCFA(resteAPayer)}</span>
        </div>
      </section>

      <section style={styles.card}>
        <div style={styles.sectionHeader}>
          <div>
            <p style={styles.sectionEyebrow}>Suivi des charges</p>
            <h3 style={styles.sectionTitle}>Liste de vos appels</h3>
            <p style={styles.sectionText}>
              Recherchez vos appels par libellé, lot, exercice, type ou statut.
            </p>
          </div>

          <div style={styles.headerActions}>
            <Link to="/coproprietaire/paiements" style={styles.secondaryButton}>
              Mes paiements
            </Link>
            <Link to="/coproprietaire/relances" style={styles.primaryButton}>
              Mes relances
            </Link>
          </div>
        </div>

        <div style={styles.filters}>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Rechercher un appel, un lot, un exercice..."
            style={styles.searchInput}
          />

          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value as StatusFilter)
            }
            style={styles.select}
          >
            <option value="ALL">Tous les appels</option>
            <option value="A_PAYER">À payer</option>
            <option value="PAYE">Payés</option>
            <option value="RETARD">En retard</option>
          </select>

          <div style={styles.resultPill}>
            {formatNumber(filteredAppels.length)} résultat(s)
          </div>
        </div>

        {filteredAppels.length === 0 ? (
          <EmptyState
            title="Aucun appel trouvé"
            text="Aucun appel de charges ne correspond aux critères affichés pour votre compte copropriétaire."
          />
        ) : (
          <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Appel</th>
                  <th style={styles.th}>Lot</th>
                  <th style={styles.th}>Échéance</th>
                  <th style={styles.thRight}>Montant dû</th>
                  <th style={styles.thRight}>Payé</th>
                  <th style={styles.thRight}>Reste</th>
                  <th style={styles.th}>Statut</th>
                </tr>
              </thead>

              <tbody>
                {filteredAppels.map((appel) => (
                  <AppelRow key={appel.id} appel={appel} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function AppelRow({ appel }: { appel: CoproprietaireAppelItem }) {
  const reste = toNumber(appel.reste_a_payer);
  const isPaid = reste <= 0;

  return (
    <tr style={styles.tr}>
      <td style={styles.td}>
        <div>
          <strong style={styles.mainText}>{appel.libelle}</strong>
          <p style={styles.subText}>
            {appel.type_appel || "Type non défini"}
            {appel.exercice?.nom ? ` · ${appel.exercice.nom}` : ""}
          </p>
        </div>
      </td>

      <td style={styles.td}>
        <strong style={styles.mainText}>
          {appel.lot?.label || appel.lot?.reference || appel.lot?.numero || "Lot"}
        </strong>
        <p style={styles.subText}>{appel.lot?.type_lot || "Lot"}</p>
      </td>

      <td style={styles.td}>
        <span style={appel.is_overdue ? styles.dangerText : styles.mainText}>
          {formatDate(appel.date_echeance)}
        </span>
      </td>

      <td style={styles.tdRight}>{formatMoneyFCFA(appel.montant_du)}</td>
      <td style={styles.tdRight}>{formatMoneyFCFA(appel.montant_paye)}</td>
      <td style={styles.tdRight}>
        <strong style={isPaid ? styles.successText : styles.warningText}>
          {formatMoneyFCFA(appel.reste_a_payer)}
        </strong>
      </td>

      <td style={styles.td}>
        <StatusBadge appel={appel} />
      </td>
    </tr>
  );
}

function StatusBadge({ appel }: { appel: CoproprietaireAppelItem }) {
  const reste = toNumber(appel.reste_a_payer);

  if (reste <= 0) {
    return <span style={{ ...styles.badge, ...styles.badgeSuccess }}>Payé</span>;
  }

  if (appel.is_overdue) {
    return (
      <span style={{ ...styles.badge, ...styles.badgeDanger }}>En retard</span>
    );
  }

  return (
    <span style={{ ...styles.badge, ...styles.badgeWarning }}>À payer</span>
  );
}

function StatCard({
  title,
  value,
  description,
  tone,
}: {
  title: string;
  value: string;
  description: string;
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
      <p style={styles.statTitle}>{title}</p>
      <p style={{ ...styles.statValue, color: toneStyle.color }}>{value}</p>
      <p style={styles.statDescription}>{description}</p>
    </div>
  );
}

function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <div style={styles.emptyState}>
      <div style={styles.emptyIcon}>📄</div>
      <p style={styles.emptyTitle}>{title}</p>
      <p style={styles.emptyText}>{text}</p>
    </div>
  );
}

function toNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return 0;

  const numberValue = Number(value);

  return Number.isFinite(numberValue) ? numberValue : 0;
}

function formatMoneyFCFA(value: number | string | null | undefined) {
  const numberValue = toNumber(value);

  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "XOF",
    maximumFractionDigits: 0,
  }).format(numberValue);
}

function formatNumber(value: number | string | null | undefined) {
  const numberValue = toNumber(value);

  return new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: 0,
  }).format(numberValue);
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
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
  orange: {
    background: "#fff7ed",
    border: "#fed7aa",
    color: "#ea580c",
  },
  red: {
    background: "#fef2f2",
    border: "#fecaca",
    color: "#dc2626",
  },
  slate: {
    background: "#f8fafc",
    border: "#e2e8f0",
    color: "#475569",
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
    maxWidth: 780,
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

  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: 16,
  },

  statCard: {
    border: "1px solid",
    borderRadius: 26,
    padding: 19,
    boxShadow: "0 16px 44px rgba(15,23,42,0.06)",
    minHeight: 134,
  },

  statTitle: {
    margin: 0,
    color: "#64748b",
    fontSize: 11,
    fontWeight: 950,
    letterSpacing: "0.14em",
    textTransform: "uppercase",
  },

  statValue: {
    margin: "12px 0 0",
    fontSize: 24,
    lineHeight: 1.2,
    fontWeight: 950,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },

  statDescription: {
    margin: "8px 0 0",
    color: "#64748b",
    fontSize: 12,
    lineHeight: 1.55,
    fontWeight: 650,
  },

  progressCard: {
    borderRadius: 30,
    background: "rgba(255,255,255,0.92)",
    border: "1px solid rgba(226,232,240,0.95)",
    boxShadow: "0 20px 64px rgba(15,23,42,0.08)",
    padding: 24,
  },

  progressHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 16,
    alignItems: "flex-start",
  },

  progressRate: {
    borderRadius: 999,
    padding: "8px 12px",
    background: "#ecfdf5",
    border: "1px solid #bbf7d0",
    color: "#059669",
    fontSize: 13,
    fontWeight: 950,
  },

  progressTrack: {
    marginTop: 18,
    height: 12,
    borderRadius: 999,
    background: "#e2e8f0",
    overflow: "hidden",
  },

  progressFill: {
    height: "100%",
    borderRadius: 999,
    background: "linear-gradient(90deg, #2563eb, #10b981)",
  },

  progressFooter: {
    marginTop: 10,
    display: "flex",
    justifyContent: "space-between",
    gap: 14,
    color: "#64748b",
    fontSize: 13,
    fontWeight: 750,
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
    maxWidth: 720,
    fontSize: 13,
    lineHeight: 1.6,
    color: "#64748b",
    fontWeight: 650,
  },

  headerActions: {
    display: "flex",
    gap: 10,
    flexShrink: 0,
  },

  primaryButton: {
    borderRadius: 16,
    padding: "10px 13px",
    background: "#0f172a",
    color: "#ffffff",
    textDecoration: "none",
    fontSize: 13,
    fontWeight: 900,
    boxShadow: "0 12px 30px rgba(15,23,42,0.16)",
  },

  secondaryButton: {
    borderRadius: 16,
    padding: "10px 13px",
    background: "#eff6ff",
    border: "1px solid #bfdbfe",
    color: "#1d4ed8",
    textDecoration: "none",
    fontSize: 13,
    fontWeight: 900,
  },

  filters: {
    marginTop: 20,
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) 220px auto",
    gap: 12,
    alignItems: "center",
  },

  searchInput: {
    border: "1px solid #e2e8f0",
    background: "#f8fafc",
    borderRadius: 18,
    padding: "13px 15px",
    color: "#0f172a",
    fontSize: 14,
    outline: "none",
  },

  select: {
    border: "1px solid #e2e8f0",
    background: "#f8fafc",
    borderRadius: 18,
    padding: "13px 15px",
    color: "#0f172a",
    fontSize: 14,
    outline: "none",
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

  tableWrapper: {
    marginTop: 20,
    overflowX: "auto",
    borderRadius: 24,
    border: "1px solid #e2e8f0",
    boxShadow: "0 14px 40px rgba(15,23,42,0.04)",
  },

  table: {
    width: "100%",
    borderCollapse: "collapse",
    minWidth: 980,
    background: "white",
  },

  th: {
    padding: "15px 16px",
    textAlign: "left",
    background: "#f8fafc",
    color: "#475569",
    fontSize: 11,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    borderBottom: "1px solid #e2e8f0",
  },

  thRight: {
    padding: "15px 16px",
    textAlign: "right",
    background: "#f8fafc",
    color: "#475569",
    fontSize: 11,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    borderBottom: "1px solid #e2e8f0",
  },

  tr: {
    borderBottom: "1px solid #e2e8f0",
  },

  td: {
    padding: "15px 16px",
    verticalAlign: "middle",
    color: "#0f172a",
    fontSize: 14,
  },

  tdRight: {
    padding: "15px 16px",
    verticalAlign: "middle",
    color: "#0f172a",
    fontSize: 14,
    textAlign: "right",
    whiteSpace: "nowrap",
  },

  mainText: {
    color: "#0f172a",
    fontWeight: 900,
  },

  subText: {
    margin: "5px 0 0",
    color: "#64748b",
    fontSize: 12,
    fontWeight: 650,
  },

  successText: {
    color: "#059669",
  },

  warningText: {
    color: "#ea580c",
  },

  dangerText: {
    color: "#dc2626",
    fontWeight: 900,
  },

  badge: {
    display: "inline-flex",
    alignItems: "center",
    borderRadius: 999,
    padding: "6px 10px",
    fontSize: 12,
    fontWeight: 950,
    border: "1px solid",
    whiteSpace: "nowrap",
  },

  badgeSuccess: {
    background: "#ecfdf5",
    borderColor: "#bbf7d0",
    color: "#047857",
  },

  badgeWarning: {
    background: "#fff7ed",
    borderColor: "#fed7aa",
    color: "#c2410c",
  },

  badgeDanger: {
    background: "#fef2f2",
    borderColor: "#fecaca",
    color: "#b91c1c",
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
    color: "#0f172a",
    fontSize: 17,
    fontWeight: 950,
  },

  emptyText: {
    margin: "8px auto 0",
    maxWidth: 620,
    color: "#64748b",
    fontSize: 14,
    lineHeight: 1.65,
    fontWeight: 600,
  },

  alertDanger: {
    borderRadius: 26,
    border: "1px solid #fecaca",
    background: "#fff1f2",
    color: "#991b1b",
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
    color: "#64748b",
    fontSize: 13,
    fontWeight: 600,
  },
};