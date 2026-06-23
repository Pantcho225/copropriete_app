// src/pages/compta/ComptaStats.tsx
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api/axios";
import { ENDPOINTS } from "../../api/endpoints";
import BackButton from "../../components/ui/BackButton";

type LoadState = "idle" | "loading" | "success" | "error";
type ToneKind = "neutral" | "success" | "warning" | "danger" | "info";

type DashboardCompte = {
  compte_id: number;
  nom: string;
  devise?: string;
  solde_initial?: number;
  total_credit?: number;
  total_debit?: number;
  solde_theorique?: number;
};

type DashboardSerie = {
  date: string;
  credit?: number;
  debit?: number;
  net?: number;
  cumul_net?: number;
};

type DashboardResponse = {
  copropriete_id: number;
  totaux: {
    revenus?: number;
    depenses?: number;
    solde?: number;
    total_credit?: number;
    total_debit?: number;
    solde_net_mouvements?: number;
    nb_non_rapproches?: number;
    series_days?: number;
  };
  comptes: DashboardCompte[];
  series: DashboardSerie[];
};

type SeriesPointWithNumbers = DashboardSerie & {
  netValue: number;
  creditValue: number;
  debitValue: number;
  cumulValue: number;
};

const EMPTY_SERIES: DashboardSerie[] = [];
const EMPTY_COMPTES: DashboardCompte[] = [];

function getTone(kind: ToneKind) {
  if (kind === "success") {
    return {
      softBg: "#ecfdf5",
      border: "#86efac",
      text: "#166534",
      strongText: "#14532d",
    };
  }

  if (kind === "warning") {
    return {
      softBg: "#fffbeb",
      border: "#fcd34d",
      text: "#92400e",
      strongText: "#78350f",
    };
  }

  if (kind === "danger") {
    return {
      softBg: "#fef2f2",
      border: "#fca5a5",
      text: "#991b1b",
      strongText: "#7f1d1d",
    };
  }

  if (kind === "info") {
    return {
      softBg: "#eff6ff",
      border: "#93c5fd",
      text: "#1d4ed8",
      strongText: "#1e3a8a",
    };
  }

  return {
    softBg: "#f9fafb",
    border: "#e5e7eb",
    text: "#4b5563",
    strongText: "#111827",
  };
}

function fmtMoney(value?: number | null) {
  const n = Number(value ?? 0);

  if (Number.isNaN(n)) return "—";

  return new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(n);
}

function fmtInt(value?: number | null) {
  const n = Number(value ?? 0);

  if (Number.isNaN(n)) return "—";

  return new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: 0,
  }).format(n);
}

function fmtDate(value?: string | null) {
  if (!value) return "—";

  const d = new Date(value);

  if (Number.isNaN(d.getTime())) return String(value);

  return d.toLocaleDateString("fr-FR");
}

function getErrorMessage(e: unknown, fallback: string) {
  const err = e as {
    response?: { data?: Record<string, unknown> };
    message?: string;
  };

  const detail = err?.response?.data?.detail;

  if (typeof detail === "string" && detail.trim()) return detail;

  if (err?.response?.data && typeof err.response.data === "object") {
    try {
      return JSON.stringify(err.response.data, null, 2);
    } catch {
      return fallback;
    }
  }

  if (typeof err?.message === "string" && err.message.trim()) return err.message;

  return fallback;
}

function getSeriesTone(net: number) {
  if (net > 0) {
    return {
      label: "Positive",
      chipBg: "#ecfdf5",
      chipBorder: "#a7f3d0",
      chipText: "#065f46",
      barBg: "rgba(34,197,94,0.42)",
      cardBg: "#f8fffb",
      cardBorder: "#bbf7d0",
    };
  }

  if (net < 0) {
    return {
      label: "Négative",
      chipBg: "#fef2f2",
      chipBorder: "#fecaca",
      chipText: "#991b1b",
      barBg: "rgba(239,68,68,0.42)",
      cardBg: "#fffafa",
      cardBorder: "#fecaca",
    };
  }

  return {
    label: "Neutre",
    chipBg: "#f3f4f6",
    chipBorder: "#e5e7eb",
    chipText: "#374151",
    barBg: "rgba(156,163,175,0.45)",
    cardBg: "#fafafa",
    cardBorder: "#e5e7eb",
  };
}

function PageShell({ children }: { children: ReactNode }) {
  return <div style={pageShell}>{children}</div>;
}

function SectionTitle(props: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  backTo?: string;
  backLabel?: string;
}) {
  return (
    <section style={heroCard}>
      <div style={heroGlow} />

      <div style={heroHeader}>
        <div style={heroTextBlock}>
          {props.backTo || props.backLabel ? (
            <div className="pageBackRow">
              <BackButton to={props.backTo} label={props.backLabel ?? "Retour"} />
            </div>
          ) : null}

          <div style={pageEyebrow}>Comptabilité · Statistiques</div>
          <div style={pageTitle}>{props.title}</div>
          {props.subtitle ? <div style={pageSubtitle}>{props.subtitle}</div> : null}
        </div>

        {props.right ? <div style={heroActions}>{props.right}</div> : null}
      </div>
    </section>
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
        border: props.primary ? "1px solid #93c5fd" : "1px solid #cbd5e1",
        background: props.disabled ? "#f9fafb" : props.primary ? "#dbeafe" : "#ffffff",
        color: props.disabled ? "#9ca3af" : props.primary ? "#1e3a8a" : "#111827",
        borderRadius: 12,
        padding: "10px 14px",
        fontSize: 13,
        fontWeight: 800,
        cursor: props.disabled ? "not-allowed" : "pointer",
        whiteSpace: "nowrap",
        boxShadow: props.primary ? "0 10px 24px rgba(37,99,235,0.10)" : "none",
      }}
    >
      {props.children}
    </button>
  );
}

function Card(props: {
  title: string;
  children: ReactNode;
  right?: ReactNode;
  subtitle?: string;
}) {
  return (
    <section style={card}>
      <div style={cardHeader}>
        <div style={{ display: "grid", gap: 4, minWidth: 0 }}>
          <div style={cardTitle}>{props.title}</div>
          {props.subtitle ? <div style={cardSubtitle}>{props.subtitle}</div> : null}
        </div>

        {props.right ? props.right : null}
      </div>

      {props.children}
    </section>
  );
}

function StatCard(props: { title: string; value: string; sub?: string; tone?: ToneKind }) {
  const tone = getTone(props.tone ?? "neutral");

  return (
    <div
      style={{
        ...statCard,
        border: `1px solid ${tone.border}`,
        background: tone.softBg,
      }}
    >
      <div style={{ ...statTitle, color: tone.text }}>{props.title}</div>

      <div style={{ ...statValue, color: tone.strongText }}>{props.value}</div>

      {props.sub ? <div style={{ ...statSub, color: tone.text }}>{props.sub}</div> : null}
    </div>
  );
}

function EmptyState(props: { title: string; text: string }) {
  return (
    <div style={emptyState}>
      <div style={emptyStateTitle}>{props.title}</div>
      <div style={emptyStateText}>{props.text}</div>
    </div>
  );
}

function AlertBox(props: { kind: "error" | "info"; children: ReactNode }) {
  const tone =
    props.kind === "error"
      ? {
          bg: "#fef2f2",
          border: "#fecaca",
          text: "#991b1b",
        }
      : {
          bg: "#eff6ff",
          border: "#bfdbfe",
          text: "#1d4ed8",
        };

  return (
    <div
      style={{
        border: `1px solid ${tone.border}`,
        background: tone.bg,
        color: tone.text,
        padding: 14,
        borderRadius: 16,
        whiteSpace: "pre-wrap",
        lineHeight: 1.5,
      }}
    >
      {props.children}
    </div>
  );
}

function MiniKpiCard(props: { title: string; value: string; sub?: string; tone?: ToneKind }) {
  const tone = getTone(props.tone ?? "neutral");

  return (
    <div
      style={{
        border: `1px solid ${tone.border}`,
        borderRadius: 16,
        padding: 14,
        background: tone.softBg,
        minWidth: 0,
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 800, color: tone.text, marginBottom: 6 }}>
        {props.title}
      </div>

      <div style={{ fontSize: 22, fontWeight: 900, color: tone.strongText, lineHeight: 1.1 }}>
        {props.value}
      </div>

      {props.sub ? (
        <div style={{ marginTop: 6, fontSize: 12, color: tone.text, lineHeight: 1.45 }}>
          {props.sub}
        </div>
      ) : null}
    </div>
  );
}

export default function ComptaStats() {
  const navigate = useNavigate();

  const [state, setState] = useState<LoadState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [seriesDays, setSeriesDays] = useState(30);
  const [data, setData] = useState<DashboardResponse | null>(null);

  const fetchStats = useCallback(async (days: number) => {
    setState("loading");
    setError(null);

    try {
      const response = await api.get<DashboardResponse>(
        ENDPOINTS.comptaMouvementsDashboard(days),
      );

      setData(response.data);
      setState("success");
    } catch (e) {
      setError(getErrorMessage(e, "Impossible de charger les statistiques comptables."));
      setData(null);
      setState("error");
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchStats(seriesDays);
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [fetchStats, seriesDays]);

  const goToMouvements = useCallback(() => {
    navigate("/compta/mouvements");
  }, [navigate]);

  const handleRefresh = useCallback(() => {
    void fetchStats(seriesDays);
  }, [fetchStats, seriesDays]);

  const dashboardSeries = data?.series ?? EMPTY_SERIES;
  const dashboardComptes = data?.comptes ?? EMPTY_COMPTES;

  const latestSeries = useMemo(() => {
    return dashboardSeries.slice(-10);
  }, [dashboardSeries]);

  const maxAbsNet = useMemo(() => {
    if (!latestSeries.length) return 1;

    const vals = latestSeries.map((x) => Math.abs(Number(x.net ?? 0)));

    return Math.max(...vals, 1);
  }, [latestSeries]);

  const summary = useMemo(() => {
    return {
      revenus: data?.totaux?.revenus ?? 0,
      depenses: data?.totaux?.depenses ?? 0,
      solde: data?.totaux?.solde ?? 0,
      totalCredit: data?.totaux?.total_credit ?? 0,
      totalDebit: data?.totaux?.total_debit ?? 0,
      soldeNetMouvements: data?.totaux?.solde_net_mouvements ?? 0,
      nbNonRapproches: data?.totaux?.nb_non_rapproches ?? 0,
      serieDays: data?.totaux?.series_days ?? seriesDays,
      comptesCount: dashboardComptes.length,
      coproprieteId: data?.copropriete_id ?? null,
    };
  }, [data, dashboardComptes.length, seriesDays]);

  const seriesInsights = useMemo(() => {
    const list: SeriesPointWithNumbers[] = latestSeries.map((item) => ({
      ...item,
      netValue: Number(item.net ?? 0),
      creditValue: Number(item.credit ?? 0),
      debitValue: Number(item.debit ?? 0),
      cumulValue: Number(item.cumul_net ?? 0),
    }));

    const activeDays = list.filter(
      (item) => item.creditValue !== 0 || item.debitValue !== 0 || item.netValue !== 0,
    );

    const positiveDays = list.filter((item) => item.netValue > 0).length;
    const negativeDays = list.filter((item) => item.netValue < 0).length;
    const neutralDays = list.filter((item) => item.netValue === 0).length;

    const bestDay =
      activeDays.length > 0
        ? activeDays.reduce(
            (best, current) => (current.netValue > best.netValue ? current : best),
            activeDays[0],
          )
        : null;

    const worstDay =
      activeDays.length > 0
        ? activeDays.reduce(
            (worst, current) => (current.netValue < worst.netValue ? current : worst),
            activeDays[0],
          )
        : null;

    const lastPoint = list.length > 0 ? list[list.length - 1] : null;

    const averageNet =
      activeDays.length > 0
        ? activeDays.reduce((sum, item) => sum + item.netValue, 0) / activeDays.length
        : 0;

    const weakActivity = activeDays.length <= 1;
    const fullyNeutral = list.length > 0 && neutralDays === list.length;

    let insightMessage = "La période présente une activité comptable exploitable.";

    if (fullyNeutral) {
      insightMessage =
        "La période affichée ne contient pas de variation journalière significative. Le cumul reste globalement stable sur les points remontés.";
    } else if (weakActivity) {
      insightMessage =
        "L’activité journalière reste faible sur la période sélectionnée. Les variations constatées sont limitées.";
    } else if (positiveDays > negativeDays) {
      insightMessage =
        "La dynamique récente est plutôt favorable, avec davantage de journées positives que négatives.";
    } else if (negativeDays > positiveDays) {
      insightMessage =
        "La dynamique récente reste sous tension, avec davantage de journées négatives que positives.";
    }

    return {
      activeDays: activeDays.length,
      positiveDays,
      negativeDays,
      neutralDays,
      bestDay,
      worstDay,
      lastPoint,
      averageNet,
      weakActivity,
      fullyNeutral,
      insightMessage,
    };
  }, [latestSeries]);

  const visibleSeries = useMemo(() => {
    if (!latestSeries.length) return EMPTY_SERIES;

    if (seriesInsights.fullyNeutral) {
      return latestSeries.slice(-4);
    }

    if (seriesInsights.weakActivity) {
      const activeDates = new Set(
        latestSeries
          .filter(
            (item) =>
              Number(item.net ?? 0) !== 0 ||
              Number(item.credit ?? 0) !== 0 ||
              Number(item.debit ?? 0) !== 0,
          )
          .map((item) => item.date),
      );

      const selected = latestSeries.filter((item) => activeDates.has(item.date));
      const trailing = latestSeries.slice(-2);

      const mergedMap = new Map<string, DashboardSerie>();

      [...selected, ...trailing].forEach((item) => {
        mergedMap.set(item.date, item);
      });

      return Array.from(mergedMap.values());
    }

    return latestSeries;
  }, [latestSeries, seriesInsights]);

  const isLoading = state === "loading";
  const hasComptes = dashboardComptes.length > 0;
  const hasSeries = visibleSeries.length > 0;

  return (
    <PageShell>
      <SectionTitle
        title="Statistiques comptables"
        subtitle={`Vue synthétique des soldes, mouvements et comptes bancaires${
          summary.coproprieteId ? ` — copropriété #${summary.coproprieteId}` : ""
        }.`}
        backTo="/compta"
        backLabel="Retour à la comptabilité"
        right={
          <div style={heroActions}>
            <select
              value={seriesDays}
              onChange={(e) => setSeriesDays(Number(e.target.value))}
              style={input}
            >
              <option value={7}>7 jours</option>
              <option value={15}>15 jours</option>
              <option value={30}>30 jours</option>
              <option value={60}>60 jours</option>
              <option value={90}>90 jours</option>
            </select>

            <SmallButton onClick={goToMouvements}>Voir les mouvements</SmallButton>

            <SmallButton onClick={handleRefresh} disabled={isLoading} primary>
              {isLoading ? "Actualisation..." : "Actualiser"}
            </SmallButton>
          </div>
        }
      />

      {state === "error" && error ? (
        <AlertBox kind="error">
          <div style={{ fontWeight: 900, marginBottom: 4 }}>
            Impossible de charger les statistiques comptables
          </div>
          <div style={{ fontSize: 13 }}>{error}</div>
        </AlertBox>
      ) : null}

      <div className="stats-top-grid">
        <StatCard
          title="Revenus"
          value={fmtMoney(summary.revenus)}
          sub="Entrées enregistrées sur la période analysée."
          tone="success"
        />
        <StatCard
          title="Dépenses"
          value={fmtMoney(summary.depenses)}
          sub="Sorties enregistrées sur la période analysée."
          tone="danger"
        />
        <StatCard
          title="Solde global"
          value={fmtMoney(summary.solde)}
          sub="Solde global remonté par le tableau de bord comptable."
          tone={Number(summary.solde) >= 0 ? "info" : "danger"}
        />
        <StatCard
          title="Non rapprochés"
          value={fmtInt(summary.nbNonRapproches)}
          sub="Mouvements encore non rapprochés."
          tone={Number(summary.nbNonRapproches) > 0 ? "warning" : "success"}
        />
      </div>

      <div className="stats-top-grid">
        <StatCard
          title="Crédits"
          value={fmtMoney(summary.totalCredit)}
          sub="Somme totale des crédits."
          tone="success"
        />
        <StatCard
          title="Débits"
          value={fmtMoney(summary.totalDebit)}
          sub="Somme totale des débits."
          tone="danger"
        />
        <StatCard
          title="Net des mouvements"
          value={fmtMoney(summary.soldeNetMouvements)}
          sub="Différence nette entre crédits et débits."
          tone={Number(summary.soldeNetMouvements) >= 0 ? "info" : "danger"}
        />
        <StatCard
          title="Période analysée"
          value={`${fmtInt(summary.serieDays)} j`}
          sub="Fenêtre utilisée pour la série journalière."
          tone="neutral"
        />
      </div>

      <Card
        title="Lecture rapide de la période"
        subtitle="Indicateurs synthétiques pour comprendre rapidement la dynamique récente."
      >
        <div
          style={{
            marginBottom: 14,
            padding: 14,
            borderRadius: 16,
            border: `1px solid ${
              seriesInsights.fullyNeutral
                ? "#e5e7eb"
                : seriesInsights.weakActivity
                  ? "#fcd34d"
                  : seriesInsights.positiveDays > seriesInsights.negativeDays
                    ? "#86efac"
                    : seriesInsights.negativeDays > seriesInsights.positiveDays
                      ? "#fca5a5"
                      : "#93c5fd"
            }`,
            background: seriesInsights.fullyNeutral
              ? "#f9fafb"
              : seriesInsights.weakActivity
                ? "#fffbeb"
                : seriesInsights.positiveDays > seriesInsights.negativeDays
                  ? "#ecfdf5"
                  : seriesInsights.negativeDays > seriesInsights.positiveDays
                    ? "#fef2f2"
                    : "#eff6ff",
            fontSize: 13,
            color: "#374151",
            lineHeight: 1.6,
          }}
        >
          <b style={{ color: "#111827" }}>Lecture produit :</b>{" "}
          {seriesInsights.insightMessage}
        </div>

        <div className="stats-mini-grid">
          <MiniKpiCard
            title="Jours actifs"
            value={fmtInt(seriesInsights.activeDays)}
            sub="Jours avec une variation ou un mouvement détectable."
            tone="info"
          />
          <MiniKpiCard
            title="Jours positifs"
            value={fmtInt(seriesInsights.positiveDays)}
            sub="Journées avec un net supérieur à zéro."
            tone="success"
          />
          <MiniKpiCard
            title="Jours négatifs"
            value={fmtInt(seriesInsights.negativeDays)}
            sub="Journées avec un net inférieur à zéro."
            tone="danger"
          />
          <MiniKpiCard
            title="Jours neutres"
            value={fmtInt(seriesInsights.neutralDays)}
            sub="Journées sans variation nette."
            tone="neutral"
          />
          <MiniKpiCard
            title="Meilleure journée"
            value={seriesInsights.bestDay ? fmtMoney(seriesInsights.bestDay.netValue) : "—"}
            sub={
              seriesInsights.bestDay
                ? `Le ${fmtDate(seriesInsights.bestDay.date)}`
                : "Aucune journée active détectée."
            }
            tone="success"
          />
          <MiniKpiCard
            title="Journée la plus faible"
            value={seriesInsights.worstDay ? fmtMoney(seriesInsights.worstDay.netValue) : "—"}
            sub={
              seriesInsights.worstDay
                ? `Le ${fmtDate(seriesInsights.worstDay.date)}`
                : "Aucune journée active détectée."
            }
            tone="danger"
          />
          <MiniKpiCard
            title="Net moyen actif"
            value={seriesInsights.activeDays > 0 ? fmtMoney(seriesInsights.averageNet) : "—"}
            sub={
              seriesInsights.activeDays > 0
                ? "Moyenne du net sur les journées actives."
                : "Aucune journée active pour calculer une moyenne."
            }
            tone={seriesInsights.averageNet >= 0 ? "info" : "danger"}
          />
          <MiniKpiCard
            title="Dernier cumul"
            value={seriesInsights.lastPoint ? fmtMoney(seriesInsights.lastPoint.cumulValue) : "—"}
            sub={
              seriesInsights.lastPoint
                ? `Au ${fmtDate(seriesInsights.lastPoint.date)}`
                : "Aucune donnée disponible."
            }
            tone={
              seriesInsights.lastPoint
                ? Number(seriesInsights.lastPoint.cumulValue) >= 0
                  ? "info"
                  : "danger"
                : "neutral"
            }
          />
        </div>
      </Card>

      <Card
        title="Comptes bancaires"
        subtitle="Soldes et volumes remontés pour les comptes suivis par le tableau de bord."
        right={
          <div style={{ fontSize: 13, color: "#6b7280" }}>
            {fmtInt(summary.comptesCount)} compte(s)
          </div>
        }
      >
        {!hasComptes && state === "success" ? (
          <EmptyState
            title="Aucun compte bancaire à afficher"
            text="Aucun compte n’est actuellement remonté par le tableau de bord comptable."
          />
        ) : (
          <div style={tableWrap}>
            <table style={tableStyle}>
              <thead>
                <tr style={{ textAlign: "left" }}>
                  <th style={th}>Compte</th>
                  <th style={th}>Devise</th>
                  <th style={th}>Solde initial</th>
                  <th style={th}>Crédits</th>
                  <th style={th}>Débits</th>
                  <th style={th}>Solde théorique</th>
                </tr>
              </thead>

              <tbody>
                {dashboardComptes.map((c) => (
                  <tr key={c.compte_id}>
                    <td style={tdStrong}>{c.nom}</td>
                    <td style={td}>{c.devise ?? "—"}</td>
                    <td style={td}>{fmtMoney(c.solde_initial)}</td>
                    <td style={{ ...td, color: "#166534", fontWeight: 700 }}>
                      {fmtMoney(c.total_credit)}
                    </td>
                    <td style={{ ...td, color: "#991b1b", fontWeight: 700 }}>
                      {fmtMoney(c.total_debit)}
                    </td>
                    <td
                      style={{
                        ...tdStrong,
                        color: Number(c.solde_theorique ?? 0) >= 0 ? "#1e3a8a" : "#991b1b",
                      }}
                    >
                      {fmtMoney(c.solde_theorique)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card
        title="Évolution journalière récente"
        subtitle={
          seriesInsights.fullyNeutral
            ? "La période est majoritairement neutre. Seuls quelques repères récents sont affichés pour éviter une lecture répétitive."
            : seriesInsights.weakActivity
              ? "L’activité étant faible, les points les plus utiles sont privilégiés."
              : "Lecture détaillée des derniers points de série remontés par le tableau de bord."
        }
        right={
          <div style={{ fontSize: 13, color: "#6b7280" }}>
            {fmtInt(visibleSeries.length)} point(s) affiché(s)
          </div>
        }
      >
        {hasSeries ? (
          <div style={{ display: "grid", gap: 12 }}>
            {visibleSeries.map((item, idx) => {
              const net = Number(item.net ?? 0);
              const tone = getSeriesTone(net);
              const widthPct = `${Math.max((Math.abs(net) / maxAbsNet) * 100, 2)}%`;

              return (
                <div
                  key={`${item.date}-${idx}`}
                  style={{
                    border: `1px solid ${tone.cardBorder}`,
                    borderRadius: 16,
                    padding: 14,
                    background: tone.cardBg,
                    minWidth: 0,
                  }}
                >
                  <div className="series-row" style={seriesRow}>
                    <div style={seriesDateCell}>{fmtDate(item.date)}</div>

                    <div style={{ fontSize: 13, color: "#166534" }}>
                      Crédit : {fmtMoney(item.credit)}
                    </div>

                    <div style={{ fontSize: 13, color: "#991b1b" }}>
                      Débit : {fmtMoney(item.debit)}
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          padding: "4px 10px",
                          borderRadius: 999,
                          fontSize: 12,
                          fontWeight: 800,
                          border: `1px solid ${tone.chipBorder}`,
                          background: tone.chipBg,
                          color: tone.chipText,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {tone.label}
                      </span>
                    </div>

                    <div style={barOuter}>
                      <div
                        style={{
                          width: widthPct,
                          height: "100%",
                          background: tone.barBg,
                          borderRadius: 999,
                        }}
                      />
                    </div>

                    <div style={{ fontSize: 13, color: "#6b7280" }}>
                      Cumul : {fmtMoney(item.cumul_net)}
                    </div>
                  </div>

                  <div style={seriesExplanation}>
                    <span>
                      <b>Net :</b> {fmtMoney(net)}
                    </span>
                    <span>
                      <b>Lecture :</b>{" "}
                      {net > 0
                        ? "La journée se termine avec un solde net positif."
                        : net < 0
                          ? "La journée se termine avec un solde net négatif."
                          : "Aucune variation nette significative n’est enregistrée sur cette journée."}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState
            title="Aucune évolution disponible"
            text="Aucun point de série n’est actuellement disponible pour la période sélectionnée."
          />
        )}
      </Card>

      <style>{`
        .stats-top-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 14px;
        }

        .stats-mini-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
        }

        @media (max-width: 1100px) {
          .stats-top-grid,
          .stats-mini-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }
        }

        @media (max-width: 900px) {
          .series-row {
            grid-template-columns: 1fr !important;
            gap: 8px !important;
          }
        }

        @media (max-width: 680px) {
          .stats-top-grid,
          .stats-mini-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </PageShell>
  );
}

const pageShell: CSSProperties = {
  display: "grid",
  gap: 18,
  width: "100%",
  minWidth: 0,
};

const heroCard: CSSProperties = {
  background:
    "linear-gradient(135deg, rgba(15,23,42,0.98) 0%, rgba(30,41,59,0.96) 55%, rgba(37,99,235,0.88) 100%)",
  borderRadius: 28,
  padding: "28px 30px",
  color: "#ffffff",
  boxShadow: "0 30px 70px rgba(15,23,42,0.18)",
  position: "relative",
  overflow: "hidden",
  minWidth: 0,
};

const heroGlow: CSSProperties = {
  position: "absolute",
  inset: "auto -120px -140px auto",
  width: 280,
  height: 280,
  borderRadius: "50%",
  background:
    "radial-gradient(circle, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0) 72%)",
  pointerEvents: "none",
};

const heroHeader: CSSProperties = {
  display: "flex",
  alignItems: "flex-end",
  justifyContent: "space-between",
  gap: 14,
  flexWrap: "wrap",
  minWidth: 0,
};

const heroTextBlock: CSSProperties = {
  display: "grid",
  gap: 8,
  position: "relative",
  zIndex: 1,
  minWidth: 0,
};

const heroActions: CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
  alignItems: "center",
  position: "relative",
  zIndex: 1,
};

const pageEyebrow: CSSProperties = {
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: 0.9,
  textTransform: "uppercase",
  color: "rgba(255,255,255,0.72)",
};

const pageTitle: CSSProperties = {
  fontSize: 30,
  fontWeight: 900,
  letterSpacing: -0.5,
  color: "#ffffff",
  lineHeight: 1.1,
};

const pageSubtitle: CSSProperties = {
  fontSize: 14,
  color: "rgba(255,255,255,0.82)",
  lineHeight: 1.55,
  maxWidth: 900,
};

const card: CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 22,
  padding: 18,
  background: "#ffffff",
  boxShadow: "0 10px 30px rgba(15, 23, 42, 0.04)",
  minWidth: 0,
};

const cardHeader: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
  marginBottom: 14,
  minWidth: 0,
};

const cardTitle: CSSProperties = {
  fontSize: 15,
  fontWeight: 900,
  color: "#111827",
};

const cardSubtitle: CSSProperties = {
  fontSize: 13,
  color: "#6b7280",
  lineHeight: 1.5,
};

const statCard: CSSProperties = {
  borderRadius: 20,
  padding: 16,
  boxShadow: "0 10px 30px rgba(15, 23, 42, 0.04)",
  minWidth: 0,
};

const statTitle: CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  marginBottom: 8,
};

const statValue: CSSProperties = {
  fontSize: 28,
  fontWeight: 900,
  letterSpacing: -0.4,
  lineHeight: 1.1,
  overflowWrap: "anywhere",
};

const statSub: CSSProperties = {
  marginTop: 8,
  fontSize: 12,
  lineHeight: 1.45,
};

const emptyState: CSSProperties = {
  border: "1px dashed #d1d5db",
  borderRadius: 16,
  padding: 18,
  background: "#f9fafb",
};

const emptyStateTitle: CSSProperties = {
  fontSize: 14,
  fontWeight: 800,
  color: "#111827",
  marginBottom: 6,
};

const emptyStateText: CSSProperties = {
  fontSize: 13,
  color: "#6b7280",
  lineHeight: 1.5,
};

const input: CSSProperties = {
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  color: "#111827",
  fontWeight: 700,
  boxSizing: "border-box",
};

const tableWrap: CSSProperties = {
  overflowX: "auto",
  width: "100%",
  minWidth: 0,
};

const tableStyle: CSSProperties = {
  width: "100%",
  minWidth: 920,
  borderCollapse: "collapse",
};

const th: CSSProperties = {
  padding: "14px 12px",
  borderBottom: "1px solid #e5e7eb",
  whiteSpace: "nowrap",
  fontSize: 12,
  color: "#6b7280",
  background: "#f9fafb",
  fontWeight: 800,
  textTransform: "uppercase",
  letterSpacing: 0.3,
};

const td: CSSProperties = {
  padding: "14px 12px",
  borderBottom: "1px solid #f3f4f6",
  whiteSpace: "nowrap",
  color: "#111827",
  fontSize: 14,
};

const tdStrong: CSSProperties = {
  ...td,
  fontWeight: 800,
};

const seriesRow: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "120px 120px 120px 120px 1fr 140px",
  gap: 10,
  alignItems: "center",
  minWidth: 0,
};

const seriesDateCell: CSSProperties = {
  fontSize: 13,
  color: "#111827",
  fontWeight: 800,
};

const barOuter: CSSProperties = {
  height: 12,
  borderRadius: 999,
  background: "#e5e7eb",
  overflow: "hidden",
};

const seriesExplanation: CSSProperties = {
  marginTop: 10,
  display: "flex",
  gap: 16,
  flexWrap: "wrap",
  fontSize: 13,
  color: "#374151",
};