// frontend/src/pages/coproprietaire/CoproprietaireRelances.tsx
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Link } from "react-router-dom";

import {
  getRelancesCoproprietaire,
  type CoproprietaireDossierImpayeItem,
  type CoproprietaireRelanceItem,
  type CoproprietaireRelancesResponse,
} from "../../api/coproprietaire";

type PageState = {
  loading: boolean;
  data: CoproprietaireRelancesResponse | null;
  error: string | null;
};

type DossierFilter = "ALL" | "A_REGULARISER" | "REGULARISES" | "RETARD";
type StatTone = "blue" | "green" | "orange" | "red" | "slate" | "indigo";

export default function CoproprietaireRelances() {
  const [state, setState] = useState<PageState>({
    loading: true,
    data: null,
    error: null,
  });

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<DossierFilter>("ALL");

  useEffect(() => {
    let mounted = true;

    async function loadRelances() {
      try {
        const data = await getRelancesCoproprietaire();

        if (!mounted) return;

        setState({
          loading: false,
          data,
          error: null,
        });
      } catch (error) {
        console.error("Erreur chargement relances copropriétaire", error);

        if (!mounted) return;

        setState({
          loading: false,
          data: null,
          error: "Impossible de charger vos relances pour le moment.",
        });
      }
    }

    void loadRelances();

    return () => {
      mounted = false;
    };
  }, []);

  const dossiers = useMemo(() => {
    return state.data?.dossiers ?? [];
  }, [state.data?.dossiers]);

  const relances = useMemo(() => {
    return state.data?.relances ?? [];
  }, [state.data?.relances]);

  const filteredDossiers = useMemo(() => {
    const q = query.trim().toLowerCase();

    return dossiers.filter((dossier) => {
      const haystack = [
        dossier.appel_libelle,
        dossier.reference_appel,
        dossier.statut_label,
        dossier.lot?.label,
        dossier.lot?.reference,
        dossier.lot?.numero,
        dossier.lot?.type_lot,
        dossier.niveau_relance,
      ]
        .join(" ")
        .toLowerCase();

      const matchesQuery = !q || haystack.includes(q);

      const matchesFilter =
        filter === "ALL" ||
        (filter === "A_REGULARISER" && !dossier.est_regularise) ||
        (filter === "REGULARISES" && dossier.est_regularise) ||
        (filter === "RETARD" && dossier.is_overdue);

      return matchesQuery && matchesFilter;
    });
  }, [dossiers, query, filter]);

  const filteredRelances = useMemo(() => {
    const q = query.trim().toLowerCase();

    return relances.filter((relance) => {
      const haystack = [
        relance.appel_libelle,
        relance.objet,
        relance.message,
        relance.canal,
        relance.statut,
        relance.statut_label,
        relance.lot?.label,
        relance.lot?.reference,
        relance.lot?.numero,
        relance.niveau,
      ]
        .join(" ")
        .toLowerCase();

      return !q || haystack.includes(q);
    });
  }, [relances, query]);

  const stats = state.data?.stats;

  const totalReste = toNumber(stats?.total_reste_a_payer);
  const nbDossiers = toNumber(stats?.nb_dossiers);
  const nbRelances = toNumber(stats?.nb_relances);
  const nbRetard = toNumber(stats?.nb_en_retard);
  const nbRegularises = toNumber(stats?.nb_regularises);

  if (state.loading) {
    return (
      <div style={styles.loadingCard}>
        <div style={styles.loadingIcon}>🔔</div>
        <div>
          <p style={styles.loadingTitle}>Chargement de vos relances...</p>
          <p style={styles.muted}>
            Nous récupérons uniquement les relances liées à vos lots.
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
          <div style={styles.heroBadge}>Suivi des rappels</div>

          <h2 style={styles.heroTitle}>Vos relances</h2>

          <p style={styles.heroText}>
            Consultez les dossiers impayés et les relances rattachés à vos lots.
            Les données affichées sont filtrées côté serveur selon votre compte
            copropriétaire.
          </p>

          <div style={styles.heroMeta}>
            <span style={styles.metaPill}>
              Dossiers : {formatNumber(nbDossiers)}
            </span>
            <span style={styles.metaPill}>
              Relances : {formatNumber(nbRelances)}
            </span>
            <span style={styles.metaPill}>
              Reste à payer : {formatMoneyFCFA(totalReste)}
            </span>
          </div>
        </div>

        <div style={styles.secureBox}>
          <div style={styles.secureIcon}>🔐</div>
          <p style={styles.secureTitle}>Suivi personnel</p>
          <p style={styles.secureText}>
            Un copropriétaire ne peut consulter que ses propres dossiers et
            relances.
          </p>
        </div>
      </section>

      <section style={styles.grid}>
        <StatCard
          title="Reste à payer"
          value={formatMoneyFCFA(totalReste)}
          description="Solde restant sur vos dossiers"
          tone={totalReste > 0 ? "orange" : "green"}
        />
        <StatCard
          title="Dossiers"
          value={formatNumber(nbDossiers)}
          description="Dossiers rattachés à vos lots"
          tone="blue"
        />
        <StatCard
          title="En retard"
          value={formatNumber(nbRetard)}
          description="Échéances dépassées"
          tone={nbRetard > 0 ? "red" : "slate"}
        />
        <StatCard
          title="Régularisés"
          value={formatNumber(nbRegularises)}
          description="Dossiers soldés ou régularisés"
          tone="green"
        />
      </section>

      <section style={styles.card}>
        <div style={styles.sectionHeader}>
          <div>
            <p style={styles.sectionEyebrow}>Dossiers impayés</p>
            <h3 style={styles.sectionTitle}>Vos dossiers à suivre</h3>
            <p style={styles.sectionText}>
              Recherchez un dossier par appel, lot, référence, statut ou niveau
              de relance.
            </p>
          </div>

          <div style={styles.headerActions}>
            <Link to="/coproprietaire/appels" style={styles.secondaryButton}>
              Voir mes appels
            </Link>
            <Link to="/coproprietaire/paiements" style={styles.primaryButton}>
              Mes paiements
            </Link>
          </div>
        </div>

        <div style={styles.filters}>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Rechercher un dossier, un appel, un lot..."
            style={styles.searchInput}
          />

          <select
            value={filter}
            onChange={(event) => setFilter(event.target.value as DossierFilter)}
            style={styles.select}
          >
            <option value="ALL">Tous les dossiers</option>
            <option value="A_REGULARISER">À régulariser</option>
            <option value="REGULARISES">Régularisés</option>
            <option value="RETARD">En retard</option>
          </select>

          <div style={styles.resultPill}>
            {formatNumber(filteredDossiers.length)} dossier(s)
          </div>
        </div>

        {filteredDossiers.length === 0 ? (
          <EmptyState
            icon="📭"
            title="Aucun dossier impayé"
            text="Aucun dossier impayé ne correspond aux critères affichés pour vos lots."
          />
        ) : (
          <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Dossier</th>
                  <th style={styles.th}>Lot</th>
                  <th style={styles.th}>Échéance</th>
                  <th style={styles.thRight}>Initial</th>
                  <th style={styles.thRight}>Payé</th>
                  <th style={styles.thRight}>Reste</th>
                  <th style={styles.th}>Statut</th>
                </tr>
              </thead>

              <tbody>
                {filteredDossiers.map((dossier) => (
                  <DossierRow key={dossier.id} dossier={dossier} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section style={styles.card}>
        <div style={styles.sectionHeader}>
          <div>
            <p style={styles.sectionEyebrow}>Historique</p>
            <h3 style={styles.sectionTitle}>Vos relances reçues</h3>
            <p style={styles.sectionText}>
              Consultez les relances envoyées sur vos dossiers : canal, date,
              montant restant et document associé.
            </p>
          </div>

          <div style={styles.historyPill}>
            {formatNumber(filteredRelances.length)} relance(s)
          </div>
        </div>

        {filteredRelances.length === 0 ? (
          <EmptyState
            icon="🔔"
            title="Aucune relance enregistrée"
            text="Aucune relance n’est actuellement enregistrée pour vos lots."
          />
        ) : (
          <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Relance</th>
                  <th style={styles.th}>Lot</th>
                  <th style={styles.th}>Canal</th>
                  <th style={styles.th}>Date</th>
                  <th style={styles.thRight}>Reste au moment</th>
                  <th style={styles.th}>Statut</th>
                  <th style={styles.th}>Document</th>
                </tr>
              </thead>

              <tbody>
                {filteredRelances.map((relance) => (
                  <RelanceRow key={relance.id} relance={relance} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function DossierRow({
  dossier,
}: {
  dossier: CoproprietaireDossierImpayeItem;
}) {
  return (
    <tr style={styles.tr}>
      <td style={styles.td}>
        <strong style={styles.mainText}>
          {dossier.appel_libelle || "Dossier impayé"}
        </strong>
        <p style={styles.subText}>
          Niveau relance : {formatNumber(dossier.niveau_relance)}
        </p>
      </td>

      <td style={styles.td}>
        <strong style={styles.mainText}>
          {dossier.lot?.label ||
            dossier.lot?.reference ||
            dossier.lot?.numero ||
            "Lot"}
        </strong>
        <p style={styles.subText}>{dossier.lot?.type_lot || "Lot"}</p>
      </td>

      <td style={styles.td}>
        <span style={dossier.is_overdue ? styles.dangerText : styles.mainText}>
          {formatDate(dossier.date_echeance)}
        </span>
      </td>

      <td style={styles.tdRight}>{formatMoneyFCFA(dossier.montant_initial)}</td>
      <td style={styles.tdRight}>{formatMoneyFCFA(dossier.montant_paye)}</td>
      <td style={styles.tdRight}>
        <strong
          style={dossier.est_regularise ? styles.successText : styles.warningText}
        >
          {formatMoneyFCFA(dossier.reste_a_payer)}
        </strong>
      </td>

      <td style={styles.td}>
        <DossierBadge dossier={dossier} />
      </td>
    </tr>
  );
}

function RelanceRow({ relance }: { relance: CoproprietaireRelanceItem }) {
  return (
    <tr style={styles.tr}>
      <td style={styles.td}>
        <strong style={styles.mainText}>
          {relance.objet || relance.appel_libelle || "Relance"}
        </strong>
        <p style={styles.subText}>
          Relance niveau {formatNumber(relance.niveau)}
        </p>
      </td>

      <td style={styles.td}>
        <strong style={styles.mainText}>
          {relance.lot?.label ||
            relance.lot?.reference ||
            relance.lot?.numero ||
            "Lot"}
        </strong>
        <p style={styles.subText}>{relance.lot?.type_lot || "Lot"}</p>
      </td>

      <td style={styles.td}>
        <span style={styles.modePill}>{formatCanal(relance.canal)}</span>
      </td>

      <td style={styles.td}>
        <span style={styles.mainText}>{formatDate(relance.created_at)}</span>
      </td>

      <td style={styles.tdRight}>
        {formatMoneyFCFA(relance.reste_a_payer_au_moment_envoi)}
      </td>

      <td style={styles.td}>
        <RelanceBadge relance={relance} />
      </td>

      <td style={styles.td}>
        {relance.document_pdf_url ? (
          <a
            href={relance.document_pdf_url}
            target="_blank"
            rel="noreferrer"
            style={styles.link}
          >
            Ouvrir
          </a>
        ) : (
          <span style={styles.emptyCell}>—</span>
        )}
      </td>
    </tr>
  );
}

function DossierBadge({
  dossier,
}: {
  dossier: CoproprietaireDossierImpayeItem;
}) {
  if (dossier.est_regularise) {
    return (
      <span style={{ ...styles.badge, ...styles.badgeSuccess }}>Régularisé</span>
    );
  }

  if (dossier.is_overdue) {
    return <span style={{ ...styles.badge, ...styles.badgeDanger }}>En retard</span>;
  }

  return (
    <span style={{ ...styles.badge, ...styles.badgeWarning }}>
      {dossier.statut_label || "À régulariser"}
    </span>
  );
}

function RelanceBadge({ relance }: { relance: CoproprietaireRelanceItem }) {
  const statut = String(relance.statut || "").trim().toUpperCase();

  if (statut === "ECHEC" || statut === "ÉCHEC") {
    return <span style={{ ...styles.badge, ...styles.badgeDanger }}>Échec</span>;
  }

  if (statut === "ANNULEE" || statut === "ANNULÉE") {
    return <span style={{ ...styles.badge, ...styles.badgeNeutral }}>Annulée</span>;
  }

  return (
    <span style={{ ...styles.badge, ...styles.badgeSuccess }}>
      {relance.statut_label || "Envoyée"}
    </span>
  );
}

function EmptyState({
  icon,
  title,
  text,
}: {
  icon: string;
  title: string;
  text: string;
}) {
  return (
    <div style={styles.emptyState}>
      <div style={styles.emptyIcon}>{icon}</div>
      <p style={styles.emptyTitle}>{title}</p>
      <p style={styles.emptyText}>{text}</p>
    </div>
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

function formatCanal(value: string | null | undefined) {
  if (!value) return "—";

  const normalized = value.trim().toUpperCase();

  const labels: Record<string, string> = {
    EMAIL: "Email",
    MAIL: "Email",
    SMS: "SMS",
    WHATSAPP: "WhatsApp",
    APPEL: "Appel",
    COURRIER: "Courrier",
    AUTRE: "Autre",
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
    maxWidth: 800,
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
    maxWidth: 760,
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

  historyPill: {
    borderRadius: 999,
    padding: "9px 12px",
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
    minWidth: 1080,
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

  warningText: {
    color: "#ea580c",
  },

  dangerText: {
    color: "#dc2626",
    fontWeight: 900,
  },

  link: {
    display: "inline-flex",
    alignItems: "center",
    borderRadius: 999,
    padding: "6px 10px",
    background: "#eff6ff",
    border: "1px solid #bfdbfe",
    color: "#2563eb",
    fontSize: 12,
    fontWeight: 950,
    textDecoration: "none",
  },

  emptyCell: {
    color: "#94a3b8",
    fontWeight: 800,
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

  badgeNeutral: {
    background: "#f8fafc",
    borderColor: "#e2e8f0",
    color: "#475569",
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