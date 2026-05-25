import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import { APP_TEXT } from "../constants/appText";

type LoadState = "idle" | "loading" | "success" | "error";

type AGStatus =
  | "BROUILLON"
  | "CONVOQUEE"
  | "OUVERTE"
  | "CLOTUREE"
  | "ANNULEE"
  | "ARCHIVEE";

type ToneKind = "neutral" | "success" | "info" | "warning" | "danger";

type MouvementItem = {
  id: number;
  sens: string;
  montant: string | number;
  date_operation: string;
  reference?: string;
  libelle?: string;
  note?: string;
  is_rapproche?: boolean;
};

type SeriesPoint = {
  date: string;
  credit?: number;
  debit?: number;
  net?: number;
  cumul_net?: number;
};

type AGDashboardItem = {
  id: number;
  statut: AGStatus;
  pv_genere?: boolean;
  pv_signe?: boolean;
  pv_locked?: boolean;
  reference?: string;
  titre?: string;
  date_ag?: string;
  lieu?: string;
};

type DashboardData = {
  compta?: {
    totaux?: {
      revenus?: number;
      depenses?: number;
      solde?: number;
      total_credit?: number;
      total_debit?: number;
      nb_non_rapproches?: number;
      series_days?: number;
    };
    comptes?: Array<{
      compte?: string;
      solde?: number;
    }>;
    series?: SeriesPoint[];
    derniers_mouvements?: MouvementItem[];
  };
  travaux?: {
    total?: number;
    brouillons?: number;
    soumis_ag?: number;
    valides?: number;
    rejetes?: number;
    clotures?: number;
    budget_estime_total?: number;
    budget_vote_total?: number;
    total_paye?: number;
    reste_a_payer?: number;
  };
  ag?: {
    total?: number;
    ouvertes?: number;
    cloturees?: number;
    brouillons?: number;
    archivees?: number;
    recentes?: AGDashboardItem[];
  };
  billing?: {
    total_factures?: number;
    montant_total?: number;
    montant_paye?: number;
    montant_impaye?: number;
    brouillons?: number;
    emises?: number;
    payees?: number;
    en_retard?: number;
  };
};

type StatCardProps = {
  title: string;
  value: ReactNode;
  subtitle?: string;
  tone?: ToneKind;
};

function getTone(kind: ToneKind) {
  if (kind === "success") {
    return {
      softBg: "#ecfdf5",
      bg: "#dcfce7",
      border: "#86efac",
      text: "#166534",
      strongText: "#14532d",
    };
  }

  if (kind === "info") {
    return {
      softBg: "#eff6ff",
      bg: "#dbeafe",
      border: "#93c5fd",
      text: "#1d4ed8",
      strongText: "#1e3a8a",
    };
  }

  if (kind === "warning") {
    return {
      softBg: "#fffbeb",
      bg: "#fef3c7",
      border: "#fcd34d",
      text: "#92400e",
      strongText: "#78350f",
    };
  }

  if (kind === "danger") {
    return {
      softBg: "#fef2f2",
      bg: "#fee2e2",
      border: "#fca5a5",
      text: "#991b1b",
      strongText: "#7f1d1d",
    };
  }

  return {
    softBg: "#f9fafb",
    bg: "#f3f4f6",
    border: "#e5e7eb",
    text: "#4b5563",
    strongText: "#111827",
  };
}

function formatMoney(value?: number | string | null) {
  const numberValue =
    typeof value === "string" ? Number(value) : typeof value === "number" ? value : 0;

  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "XOF",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(numberValue) ? numberValue : 0);
}

function formatDate(value?: string | null) {
  if (!value) return "—";

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) return value;

  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(parsed);
}

function parseNumber(value?: number | string | null) {
  if (typeof value === "number") return value;

  if (typeof value === "string") {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }

  return 0;
}

function normalizeAGStatus(value: unknown): AGStatus {
  const s = String(value ?? "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();

  if (["OUVERTE", "OPEN", "ACTIVE", "ACTIF", "EN_COURS"].includes(s)) {
    return "OUVERTE";
  }

  if (["CONVOQUEE", "CONVOQUE", "CONVOCATION", "SCHEDULED", "PLANNED"].includes(s)) {
    return "CONVOQUEE";
  }

  if (["CLOTUREE", "CLOTURE", "CLOSED", "TERMINEE", "FINALISEE", "FINALISE"].includes(s)) {
    return "CLOTUREE";
  }

  if (["ARCHIVEE", "ARCHIVE", "ARCHIVED"].includes(s)) {
    return "ARCHIVEE";
  }

  if (["ANNULEE", "ANNULE", "CANCELLED", "CANCELED"].includes(s)) {
    return "ANNULEE";
  }

  return "BROUILLON";
}

function normalizeAGDashboardItem(item: AGDashboardItem): AGDashboardItem {
  return {
    ...item,
    statut: normalizeAGStatus(item.statut),
  };
}

async function getFirstSuccessful<T>(urls: string[]): Promise<T> {
  let lastError: unknown = null;

  for (const url of urls) {
    try {
      const res = await api.get<T>(url);
      return res.data;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError ?? new Error("Aucun endpoint compatible.");
}

function StatCard({ title, value, subtitle, tone = "neutral" }: StatCardProps) {
  const palette = getTone(tone);

  return (
    <div
      style={{
        ...cardStyle,
        background: palette.softBg,
        border: `1px solid ${palette.border}`,
      }}
    >
      <div style={{ color: palette.text, fontSize: 13, fontWeight: 700 }}>{title}</div>
      <div style={{ ...kpiValue, color: palette.strongText }}>{value}</div>

      {subtitle ? (
        <div style={{ ...mutedText, marginTop: 8, color: palette.text }}>{subtitle}</div>
      ) : null}
    </div>
  );
}

function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div
      style={{
        ...cardStyle,
        textAlign: "center",
        padding: 28,
      }}
    >
      <div style={{ fontSize: 18, fontWeight: 800, color: "#111827" }}>{title}</div>

      {description ? (
        <div style={{ ...mutedText, marginTop: 8, maxWidth: 520, marginInline: "auto" }}>
          {description}
        </div>
      ) : null}

      {action ? <div style={{ marginTop: 18 }}>{action}</div> : null}
    </div>
  );
}

function getAGBadgeStyle(status?: AGStatus): CSSProperties {
  switch (status) {
    case "OUVERTE":
      return { ...badgeBase, background: "#eff6ff", color: "#1d4ed8" };
    case "CLOTUREE":
      return { ...badgeBase, background: "#ecfdf5", color: "#166534" };
    case "ARCHIVEE":
      return { ...badgeBase, background: "#f3f4f6", color: "#374151" };
    case "BROUILLON":
      return { ...badgeBase, background: "#f3f4f6", color: "#374151" };
    case "CONVOQUEE":
      return { ...badgeBase, background: "#fef3c7", color: "#92400e" };
    case "ANNULEE":
      return { ...badgeBase, background: "#fee2e2", color: "#991b1b" };
    default:
      return { ...badgeBase, background: "#f3f4f6", color: "#374151" };
  }
}

function getAGStatusLabel(status?: AGStatus) {
  switch (status) {
    case "BROUILLON":
      return APP_TEXT.statuses.ag.draft;
    case "CONVOQUEE":
      return APP_TEXT.statuses.ag.convened;
    case "OUVERTE":
      return APP_TEXT.statuses.ag.open;
    case "CLOTUREE":
      return APP_TEXT.statuses.ag.closed;
    case "ARCHIVEE":
      return "Archivée";
    case "ANNULEE":
      return APP_TEXT.statuses.common.cancelled;
    default:
      return APP_TEXT.feedback.error.default;
  }
}

export default function Dashboard() {
  const navigate = useNavigate();

  const [state, setState] = useState<LoadState>("idle");
  const [data, setData] = useState<DashboardData | null>(null);

  const fetchDashboard = useCallback(async () => {
    setState("loading");

    try {
      const [comptaRes, travauxRes, agRes, billingRes] = await Promise.allSettled([
        api.get("/api/compta/mouvements/dashboard/?series_days=30"),
        api.get("/api/travaux/dossiers/stats/"),
        getFirstSuccessful<DashboardData["ag"]>([
          "/api/ag/assemblees/dashboard/",
          "/api/ag/ags/dashboard/",
          "/api/ag/dashboard/",
        ]),
        api.get("/api/billing/dashboard/"),
      ]);

      const nextData: DashboardData = {};

      if (comptaRes.status === "fulfilled") {
        nextData.compta = comptaRes.value.data ?? {};
      }

      if (travauxRes.status === "fulfilled") {
        nextData.travaux = travauxRes.value.data ?? {};
      }

      if (agRes.status === "fulfilled") {
        const agPayload = agRes.value ?? {};

        nextData.ag = {
          ...agPayload,
          recentes: Array.isArray(agPayload.recentes)
            ? agPayload.recentes.map(normalizeAGDashboardItem)
            : [],
        };
      }

      if (billingRes.status === "fulfilled") {
        nextData.billing = billingRes.value.data ?? {};
      }

      const allFailed =
        comptaRes.status === "rejected" &&
        travauxRes.status === "rejected" &&
        agRes.status === "rejected" &&
        billingRes.status === "rejected";

      if (allFailed) {
        setData(null);
        setState("error");
        return;
      }

      setData(nextData);
      setState("success");
    } catch {
      setData(null);
      setState("error");
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchDashboard();
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [fetchDashboard]);

  const comptaTotals = useMemo(() => {
    return data?.compta?.totaux ?? {};
  }, [data?.compta?.totaux]);

  const comptaSeries = useMemo(() => {
    return data?.compta?.series ?? [];
  }, [data?.compta?.series]);

  const mouvements = useMemo(() => {
    return data?.compta?.derniers_mouvements ?? [];
  }, [data?.compta?.derniers_mouvements]);

  const travauxStats = useMemo(() => {
    return data?.travaux ?? {};
  }, [data?.travaux]);

  const agStats = useMemo(() => {
    return data?.ag ?? {};
  }, [data?.ag]);

  const billingStats = useMemo(() => {
    return data?.billing ?? {};
  }, [data?.billing]);

  const dashboardCards = useMemo(
    () => [
      {
        title: APP_TEXT.pages.dashboard.cards.comptaBalance,
        value: formatMoney(comptaTotals.solde),
        subtitle: APP_TEXT.pages.dashboard.cardsSubtitles.comptaBalance,
        tone: parseNumber(comptaTotals.solde) >= 0 ? ("success" as ToneKind) : ("danger" as ToneKind),
      },
      {
        title: APP_TEXT.pages.dashboard.cards.unreconciledEntries,
        value: parseNumber(comptaTotals.nb_non_rapproches ?? 0),
        subtitle: APP_TEXT.pages.dashboard.cardsSubtitles.unreconciledEntries,
        tone:
          parseNumber(comptaTotals.nb_non_rapproches ?? 0) > 0
            ? ("warning" as ToneKind)
            : ("success" as ToneKind),
      },
      {
        title: APP_TEXT.pages.dashboard.cards.travauxFiles,
        value: parseNumber(travauxStats.total ?? 0),
        subtitle: APP_TEXT.pages.dashboard.cardsSubtitles.travauxFiles,
        tone: "neutral" as ToneKind,
      },
      {
        title: APP_TEXT.pages.dashboard.cards.assemblies,
        value: parseNumber(agStats.total ?? 0),
        subtitle: APP_TEXT.pages.dashboard.cardsSubtitles.assemblies,
        tone: "info" as ToneKind,
      },
      {
        title: APP_TEXT.pages.dashboard.cards.invoices,
        value: parseNumber(billingStats.total_factures ?? 0),
        subtitle: APP_TEXT.pages.dashboard.cardsSubtitles.invoices,
        tone: "neutral" as ToneKind,
      },
      {
        title: APP_TEXT.pages.dashboard.cards.unpaidAmount,
        value: formatMoney(billingStats.montant_impaye),
        subtitle: APP_TEXT.pages.dashboard.cardsSubtitles.unpaidAmount,
        tone:
          parseNumber(billingStats.montant_impaye ?? 0) > 0
            ? ("warning" as ToneKind)
            : ("success" as ToneKind),
      },
    ],
    [
      agStats.total,
      billingStats.montant_impaye,
      billingStats.total_factures,
      comptaTotals.nb_non_rapproches,
      comptaTotals.solde,
      travauxStats.total,
    ],
  );

  const seriesSummary = useMemo(() => {
    if (!comptaSeries.length) return null;

    const credits = comptaSeries.reduce((sum, item) => sum + parseNumber(item.credit), 0);
    const debits = comptaSeries.reduce((sum, item) => sum + parseNumber(item.debit), 0);
    const lastPoint = comptaSeries[comptaSeries.length - 1];

    return {
      credits,
      debits,
      cumulNet: parseNumber(lastPoint?.cumul_net),
    };
  }, [comptaSeries]);

  if (state === "loading" || state === "idle") {
    return (
      <div style={pageWrap}>
        <EmptyState
          title={APP_TEXT.feedback.loading.default}
          description={APP_TEXT.pages.dashboard.subtitle}
        />
      </div>
    );
  }

  if (state === "error") {
    return (
      <div style={pageWrap}>
        <EmptyState
          title={APP_TEXT.feedback.error.load}
          description={APP_TEXT.feedback.error.default}
          action={
            <button type="button" style={primaryButton} onClick={() => void fetchDashboard()}>
              {APP_TEXT.actions.retry}
            </button>
          }
        />
      </div>
    );
  }

  return (
    <div style={pageWrap}>
      <section style={heroCard}>
        <div style={rowBetween}>
          <div style={{ maxWidth: 760 }}>
            <div
              style={{
                ...badgeBase,
                background: "rgba(255,255,255,0.14)",
                color: "#ffffff",
                marginBottom: 14,
              }}
            >
              {APP_TEXT.pages.dashboard.heroBadge}
            </div>

            <h1
              style={{
                margin: 0,
                fontSize: 30,
                lineHeight: 1.15,
                fontWeight: 800,
              }}
            >
              {APP_TEXT.pages.dashboard.title}
            </h1>

            <p
              style={{
                margin: "12px 0 0",
                color: "rgba(255,255,255,0.85)",
                fontSize: 15,
                lineHeight: 1.6,
              }}
            >
              {APP_TEXT.pages.dashboard.subtitle}
            </p>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button type="button" style={softButton} onClick={() => void fetchDashboard()}>
              {APP_TEXT.actions.refresh}
            </button>

            <button type="button" style={primaryButton} onClick={() => navigate("/compta")}>
              {APP_TEXT.actions.viewDetails}
            </button>
          </div>
        </div>
      </section>

      <section>
        <div style={gridCards}>
          {dashboardCards.map((item) => (
            <StatCard
              key={item.title}
              title={item.title}
              value={item.value}
              subtitle={item.subtitle}
              tone={item.tone}
            />
          ))}
        </div>
      </section>

      <section className="dashboard-grid-large" style={sectionGridTwo}>
        <div style={cardStyle}>
          <div style={rowBetween}>
            <div>
              <h2 style={sectionTitle}>{APP_TEXT.pages.dashboard.blocks.comptaTrendTitle}</h2>
              <p style={sectionSubtle}>{APP_TEXT.pages.dashboard.blocks.comptaTrendSubtitle}</p>
            </div>
          </div>

          {!seriesSummary ? (
            <div style={{ marginTop: 16 }}>
              <EmptyState
                title={APP_TEXT.feedback.empty.default}
                description={APP_TEXT.pages.dashboard.blocks.comptaTrendEmptyDescription}
              />
            </div>
          ) : (
            <div style={{ ...gridCards, marginTop: 18 }}>
              <StatCard
                title={APP_TEXT.pages.dashboard.blocks.cumulativeCredits}
                value={formatMoney(seriesSummary.credits)}
                tone="success"
              />
              <StatCard
                title={APP_TEXT.pages.dashboard.blocks.cumulativeDebits}
                value={formatMoney(seriesSummary.debits)}
                tone="danger"
              />
              <StatCard
                title={APP_TEXT.pages.dashboard.blocks.cumulativeNet}
                value={formatMoney(seriesSummary.cumulNet)}
                tone={seriesSummary.cumulNet >= 0 ? "info" : "danger"}
              />
            </div>
          )}
        </div>

        <div style={cardStyle}>
          <div style={rowBetween}>
            <div>
              <h2 style={sectionTitle}>{APP_TEXT.pages.dashboard.blocks.travauxTitle}</h2>
              <p style={sectionSubtle}>{APP_TEXT.pages.dashboard.blocks.travauxSubtitle}</p>
            </div>

            <button type="button" style={softButton} onClick={() => navigate("/travaux")}>
              {APP_TEXT.actions.viewDetails}
            </button>
          </div>

          <div style={{ ...listStyle, marginTop: 18 }}>
            <div style={{ ...listItemStyle, background: "#ecfdf5", border: "1px solid #86efac" }}>
              <span>{APP_TEXT.pages.dashboard.blocks.validatedFiles}</span>
              <strong style={{ color: "#14532d" }}>{parseNumber(travauxStats.valides ?? 0)}</strong>
            </div>

            <div style={{ ...listItemStyle, background: "#eff6ff", border: "1px solid #93c5fd" }}>
              <span>{APP_TEXT.pages.dashboard.blocks.closedFiles}</span>
              <strong style={{ color: "#1e3a8a" }}>{parseNumber(travauxStats.clotures ?? 0)}</strong>
            </div>

            <div style={{ ...listItemStyle, background: "#ecfdf5", border: "1px solid #86efac" }}>
              <span>{APP_TEXT.pages.dashboard.blocks.paidTotal}</span>
              <strong style={{ color: "#14532d" }}>{formatMoney(travauxStats.total_paye)}</strong>
            </div>

            <div style={{ ...listItemStyle, background: "#fffbeb", border: "1px solid #fcd34d" }}>
              <span>{APP_TEXT.pages.dashboard.blocks.remainingToPay}</span>
              <strong style={{ color: "#78350f" }}>{formatMoney(travauxStats.reste_a_payer)}</strong>
            </div>
          </div>
        </div>
      </section>

      <section className="dashboard-grid-equal" style={sectionGridEqual}>
        <div style={cardStyle}>
          <div style={rowBetween}>
            <div>
              <h2 style={sectionTitle}>{APP_TEXT.pages.dashboard.blocks.recentActivityTitle}</h2>
              <p style={sectionSubtle}>{APP_TEXT.pages.dashboard.blocks.recentActivitySubtitle}</p>
            </div>

            <button type="button" style={softButton} onClick={() => navigate("/compta/mouvements")}>
              {APP_TEXT.actions.viewDetails}
            </button>
          </div>

          {!mouvements.length ? (
            <div style={{ marginTop: 18 }}>
              <EmptyState
                title={APP_TEXT.pages.dashboard.blocks.recentActivityEmptyTitle}
                description={APP_TEXT.pages.dashboard.blocks.recentActivityEmptyDescription}
              />
            </div>
          ) : (
            <div style={listStyle}>
              {mouvements.slice(0, 6).map((item) => {
                const isCredit = String(item.sens).toUpperCase() === "CREDIT";
                const isReconciled = Boolean(item.is_rapproche);

                return (
                  <div
                    key={item.id}
                    style={{
                      ...listItemStyle,
                      background: isReconciled ? "#f8fafc" : "#fffbeb",
                      border: isReconciled ? "1px solid #e2e8f0" : "1px solid #fcd34d",
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontWeight: 700,
                          color: "#111827",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {item.libelle || item.reference || `Mouvement #${item.id}`}
                      </div>

                      <div style={{ ...mutedText, marginTop: 4 }}>
                        {formatDate(item.date_operation)}
                        {isReconciled
                          ? ` • ${APP_TEXT.statuses.compta.reconciled}`
                          : ` • ${APP_TEXT.statuses.compta.unreconciled}`}
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span
                        style={{
                          ...badgeBase,
                          background: isReconciled ? "#ecfdf5" : "#fffbeb",
                          color: isReconciled ? "#166534" : "#92400e",
                        }}
                      >
                        {isReconciled
                          ? APP_TEXT.statuses.compta.reconciled
                          : APP_TEXT.statuses.compta.unreconciled}
                      </span>

                      <div
                        style={{
                          fontWeight: 800,
                          color: isCredit ? "#166534" : "#991b1b",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {formatMoney(item.montant)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div style={cardStyle}>
          <div style={rowBetween}>
            <div>
              <h2 style={sectionTitle}>{APP_TEXT.pages.dashboard.blocks.agTitle}</h2>
              <p style={sectionSubtle}>{APP_TEXT.pages.dashboard.blocks.agSubtitle}</p>
            </div>

            <button type="button" style={softButton} onClick={() => navigate("/ag")}>
              {APP_TEXT.actions.viewDetails}
            </button>
          </div>

          {!agStats.recentes?.length ? (
            <div style={{ marginTop: 18 }}>
              <EmptyState
                title={APP_TEXT.feedback.empty.default}
                description={APP_TEXT.pages.dashboard.blocks.agEmptyDescription}
              />
            </div>
          ) : (
            <div style={listStyle}>
              {agStats.recentes.slice(0, 5).map((ag) => (
                <div key={ag.id} style={listItemStyle}>
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontWeight: 700,
                        color: "#111827",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {ag.reference || `AG #${ag.id}`}
                      {ag.titre ? ` — ${ag.titre}` : ""}
                    </div>

                    <div style={{ ...mutedText, marginTop: 4 }}>
                      {formatDate(ag.date_ag)} {ag.lieu ? `• ${ag.lieu}` : ""}
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={getAGBadgeStyle(ag.statut)}>{getAGStatusLabel(ag.statut)}</span>

                    {ag.pv_locked ? (
                      <span style={{ ...badgeBase, background: "#ede9fe", color: "#6d28d9" }}>
                        {APP_TEXT.pages.dashboard.pv.locked}
                      </span>
                    ) : ag.pv_signe ? (
                      <span style={{ ...badgeBase, background: "#e0f2fe", color: "#0369a1" }}>
                        {APP_TEXT.pages.dashboard.pv.signed}
                      </span>
                    ) : ag.pv_genere ? (
                      <span style={{ ...badgeBase, background: "#fef3c7", color: "#92400e" }}>
                        {APP_TEXT.pages.dashboard.pv.generated}
                      </span>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section>
        <div style={cardStyle}>
          <div style={rowBetween}>
            <div>
              <h2 style={sectionTitle}>{APP_TEXT.pages.dashboard.blocks.billingTitle}</h2>
              <p style={sectionSubtle}>{APP_TEXT.pages.dashboard.blocks.billingSubtitle}</p>
            </div>

            <button type="button" style={softButton} onClick={() => navigate("/billing")}>
              {APP_TEXT.actions.viewDetails}
            </button>
          </div>

          <div style={{ ...gridCards, marginTop: 18 }}>
            <StatCard
              title={APP_TEXT.pages.dashboard.blocks.totalAmount}
              value={formatMoney(billingStats.montant_total)}
              tone="neutral"
            />
            <StatCard
              title={APP_TEXT.pages.dashboard.blocks.paidAmount}
              value={formatMoney(billingStats.montant_paye)}
              tone="success"
            />
            <StatCard
              title={APP_TEXT.pages.dashboard.blocks.unpaidAmount}
              value={formatMoney(billingStats.montant_impaye)}
              tone={parseNumber(billingStats.montant_impaye ?? 0) > 0 ? "warning" : "success"}
            />
            <StatCard
              title={APP_TEXT.pages.dashboard.blocks.overdueInvoices}
              value={parseNumber(billingStats.en_retard ?? 0)}
              tone={parseNumber(billingStats.en_retard ?? 0) > 0 ? "danger" : "success"}
            />
          </div>
        </div>
      </section>

      <style>{`
        @media (max-width: 1100px) {
          .dashboard-grid-large,
          .dashboard-grid-equal {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}

const pageWrap: CSSProperties = {
  display: "grid",
  gap: 20,
  width: "100%",
  minWidth: 0,
  overflowX: "hidden",
};

const heroCard: CSSProperties = {
  background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
  color: "#ffffff",
  borderRadius: 24,
  padding: 24,
  boxShadow: "0 20px 40px rgba(15, 23, 42, 0.18)",
};

const gridCards: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 16,
};

const sectionGridTwo: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1.4fr) minmax(320px, 0.9fr)",
  gap: 20,
};

const sectionGridEqual: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
  gap: 20,
};

const cardStyle: CSSProperties = {
  background: "#ffffff",
  border: "1px solid #e5e7eb",
  borderRadius: 20,
  padding: 18,
  boxShadow: "0 10px 30px rgba(15, 23, 42, 0.06)",
};

const sectionTitle: CSSProperties = {
  fontSize: 18,
  fontWeight: 700,
  color: "#111827",
  margin: 0,
};

const sectionSubtle: CSSProperties = {
  margin: "6px 0 0",
  color: "#6b7280",
  fontSize: 14,
};

const rowBetween: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
};

const kpiValue: CSSProperties = {
  fontSize: 28,
  fontWeight: 800,
  marginTop: 8,
};

const mutedText: CSSProperties = {
  color: "#6b7280",
  fontSize: 14,
};

const badgeBase: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  padding: "6px 10px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 700,
};

const buttonBase: CSSProperties = {
  border: "none",
  borderRadius: 12,
  padding: "10px 14px",
  cursor: "pointer",
  fontWeight: 700,
  fontSize: 14,
};

const primaryButton: CSSProperties = {
  ...buttonBase,
  background: "#111827",
  color: "#ffffff",
};

const softButton: CSSProperties = {
  ...buttonBase,
  background: "#f3f4f6",
  color: "#111827",
};

const listStyle: CSSProperties = {
  display: "grid",
  gap: 12,
  marginTop: 16,
};

const listItemStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  padding: "14px 16px",
  borderRadius: 16,
  border: "1px solid #e5e7eb",
  background: "#ffffff",
};