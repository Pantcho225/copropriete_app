// frontend/src/pages/coproprietaire/CoproprietairePaiements.tsx
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Link } from "react-router-dom";

import {
  getPaiementsCoproprietaire,
  type CoproprietairePaiementItem,
  type CoproprietairePaiementsResponse,
} from "../../api/coproprietaire";

type PageState = {
  loading: boolean;
  data: CoproprietairePaiementsResponse | null;
  error: string | null;
};

type StatusFilter = "ALL" | "VALIDES" | "ANNULES";
type StatTone = "blue" | "green" | "red" | "slate" | "indigo";

export default function CoproprietairePaiements() {
  const [state, setState] = useState<PageState>({
    loading: true,
    data: null,
    error: null,
  });

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");

  useEffect(() => {
    let mounted = true;

    async function loadPaiements() {
      try {
        const data = await getPaiementsCoproprietaire();

        if (!mounted) return;

        setState({
          loading: false,
          data,
          error: null,
        });
      } catch (error) {
        console.error("Erreur chargement paiements copropriétaire", error);

        if (!mounted) return;

        setState({
          loading: false,
          data: null,
          error: "Impossible de charger vos paiements pour le moment.",
        });
      }
    }

    void loadPaiements();

    return () => {
      mounted = false;
    };
  }, []);

  const paiements = useMemo(() => {
    return state.data?.paiements ?? [];
  }, [state.data?.paiements]);

  const filteredPaiements = useMemo(() => {
    const q = query.trim().toLowerCase();

    return paiements.filter((paiement) => {
      const haystack = [
        paiement.appel_libelle,
        paiement.lot?.label,
        paiement.lot?.reference,
        paiement.lot?.numero,
        paiement.lot?.type_lot,
        paiement.mode_paiement,
        paiement.reference,
        paiement.statut_label,
        paiement.id,
      ]
        .join(" ")
        .toLowerCase();

      const matchesQuery = !q || haystack.includes(q);

      const matchesStatus =
        statusFilter === "ALL" ||
        (statusFilter === "VALIDES" && !paiement.is_cancelled) ||
        (statusFilter === "ANNULES" && paiement.is_cancelled);

      return matchesQuery && matchesStatus;
    });
  }, [paiements, query, statusFilter]);

  const stats = state.data?.stats;

  const totalPaye = toNumber(stats?.total_paye);
  const nbPaiements = toNumber(stats?.nb_paiements);
  const nbAnnules = toNumber(stats?.nb_annules);
  const nbValides = Math.max(0, nbPaiements - nbAnnules);

  const validAmount = useMemo(() => {
    return paiements
      .filter((paiement) => !paiement.is_cancelled)
      .reduce((sum, paiement) => sum + toNumber(paiement.montant), 0);
  }, [paiements]);

  const cancelledAmount = useMemo(() => {
    return paiements
      .filter((paiement) => paiement.is_cancelled)
      .reduce((sum, paiement) => sum + toNumber(paiement.montant), 0);
  }, [paiements]);

  if (state.loading) {
    return (
      <div style={styles.loadingCard}>
        <div style={styles.loadingIcon}>💳</div>
        <div>
          <p style={styles.loadingTitle}>Chargement de vos paiements...</p>
          <p style={styles.muted}>
            Nous récupérons uniquement les règlements associés à vos lots.
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
          <div style={styles.heroBadge}>Historique financier</div>

          <h2 style={styles.heroTitle}>Vos paiements</h2>

          <p style={styles.heroText}>
            Consultez les règlements enregistrés sur vos appels de charges :
            montant, date, mode de paiement, référence et statut de validation.
          </p>

          <div style={styles.heroMeta}>
            <span style={styles.metaPill}>
              {formatNumber(nbPaiements)} paiement(s)
            </span>
            <span style={styles.metaPill}>
              Total payé : {formatMoneyFCFA(totalPaye)}
            </span>
            <span style={styles.metaPill}>
              Annulés : {formatNumber(nbAnnules)}
            </span>
          </div>
        </div>

        <div style={styles.secureBox}>
          <div style={styles.secureIcon}>🔐</div>
          <p style={styles.secureTitle}>Suivi sécurisé</p>
          <p style={styles.secureText}>
            Un copropriétaire ne peut consulter que les paiements rattachés à
            ses propres lots.
          </p>
        </div>
      </section>

      <section style={styles.grid}>
        <StatCard
          title="Total payé"
          value={formatMoneyFCFA(totalPaye)}
          description="Somme totale retournée par votre espace"
          tone="green"
        />
        <StatCard
          title="Paiements validés"
          value={formatNumber(nbValides)}
          description="Règlements actifs et non annulés"
          tone="blue"
        />
        <StatCard
          title="Montant validé"
          value={formatMoneyFCFA(validAmount)}
          description="Total des paiements encore actifs"
          tone="indigo"
        />
        <StatCard
          title="Annulés"
          value={formatNumber(nbAnnules)}
          description={`Montant annulé : ${formatMoneyFCFA(cancelledAmount)}`}
          tone={nbAnnules > 0 ? "red" : "slate"}
        />
      </section>

      <section style={styles.card}>
        <div style={styles.sectionHeader}>
          <div>
            <p style={styles.sectionEyebrow}>Historique</p>
            <h3 style={styles.sectionTitle}>Liste de vos paiements</h3>
            <p style={styles.sectionText}>
              Recherchez un règlement par appel, lot, référence, mode ou statut.
            </p>
          </div>

          <div style={styles.headerActions}>
            <Link to="/coproprietaire/appels" style={styles.secondaryButton}>
              Voir mes appels
            </Link>
            <Link to="/coproprietaire/documents" style={styles.primaryButton}>
              Mes documents
            </Link>
          </div>
        </div>

        <div style={styles.filters}>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Rechercher un paiement, un appel, un lot..."
            style={styles.searchInput}
          />

          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value as StatusFilter)
            }
            style={styles.select}
          >
            <option value="ALL">Tous les paiements</option>
            <option value="VALIDES">Validés</option>
            <option value="ANNULES">Annulés</option>
          </select>

          <div style={styles.resultPill}>
            {formatNumber(filteredPaiements.length)} résultat(s)
          </div>
        </div>

        {filteredPaiements.length === 0 ? (
          <EmptyState
            title="Aucun paiement trouvé"
            text="Aucun paiement ne correspond aux critères affichés pour votre compte copropriétaire."
          />
        ) : (
          <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Paiement</th>
                  <th style={styles.th}>Lot</th>
                  <th style={styles.th}>Date</th>
                  <th style={styles.th}>Mode</th>
                  <th style={styles.th}>Référence</th>
                  <th style={styles.thRight}>Montant</th>
                  <th style={styles.th}>Statut</th>
                </tr>
              </thead>

              <tbody>
                {filteredPaiements.map((paiement) => (
                  <PaiementRow key={paiement.id} paiement={paiement} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function PaiementRow({
  paiement,
}: {
  paiement: CoproprietairePaiementItem;
}) {
  return (
    <tr style={styles.tr}>
      <td style={styles.td}>
        <strong style={styles.mainText}>
          {paiement.appel_libelle || "Paiement"}
        </strong>
        <p style={styles.subText}>Paiement #{paiement.id}</p>
      </td>

      <td style={styles.td}>
        <strong style={styles.mainText}>
          {paiement.lot?.label ||
            paiement.lot?.reference ||
            paiement.lot?.numero ||
            "Lot"}
        </strong>
        <p style={styles.subText}>{paiement.lot?.type_lot || "Lot"}</p>
      </td>

      <td style={styles.td}>
        <span style={styles.mainText}>
          {formatDate(paiement.date_paiement)}
        </span>
      </td>

      <td style={styles.td}>
        <span style={styles.modePill}>
          {formatModePaiement(paiement.mode_paiement)}
        </span>
      </td>

      <td style={styles.td}>
        <span style={styles.referenceText}>{paiement.reference || "—"}</span>
      </td>

      <td style={styles.tdRight}>
        <strong
          style={paiement.is_cancelled ? styles.dangerText : styles.successText}
        >
          {formatMoneyFCFA(paiement.montant)}
        </strong>
      </td>

      <td style={styles.td}>
        <StatusBadge paiement={paiement} />
      </td>
    </tr>
  );
}

function StatusBadge({
  paiement,
}: {
  paiement: CoproprietairePaiementItem;
}) {
  if (paiement.is_cancelled) {
    return <span style={{ ...styles.badge, ...styles.badgeDanger }}>Annulé</span>;
  }

  return <span style={{ ...styles.badge, ...styles.badgeSuccess }}>Validé</span>;
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
      <div style={styles.emptyIcon}>💳</div>
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

function formatModePaiement(value: string | null | undefined) {
  if (!value) return "—";

  const normalized = value.trim().toUpperCase();

  const labels: Record<string, string> = {
    ESPECES: "Espèces",
    ESPÈCES: "Espèces",
    CASH: "Espèces",
    VIREMENT: "Virement",
    CHEQUE: "Chèque",
    CHÈQUE: "Chèque",
    MOBILE_MONEY: "Mobile Money",
    WAVE: "Wave",
    ORANGE_MONEY: "Orange Money",
    OM: "Orange Money",
    CARTE: "Carte",
  };

  return labels[normalized] || value;
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

  referenceText: {
    color: "#475569",
    fontSize: 13,
    fontWeight: 750,
  },

  modePill: {
    display: "inline-flex",
    alignItems: "center",
    borderRadius: 999,
    padding: "6px 9px",
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    color: "#334155",
    fontSize: 12,
    fontWeight: 900,
    whiteSpace: "nowrap",
  },

  successText: {
    color: "#059669",
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