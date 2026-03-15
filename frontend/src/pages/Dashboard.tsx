import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import { useAuthStore } from "../store/authStore";

type LoadState = "idle" | "loading" | "success" | "error";
type AGStatus = "BROUILLON" | "OUVERTE" | "CLOTUREE" | "ARCHIVEE";

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
};

type DashboardStats = {
  totalDossiersTravaux: number | null;
  appelsActifs: number | null;
  impayesEnCours: number | null;
  restantAppels: number | null;
  soldeBancaire: number | null;
  totalCredit: number | null;
  totalDebit: number | null;
  nbNonRapproches: number | null;
  series: SeriesPoint[];
  derniersMouvements: MouvementItem[];

  // AG
  totalAG: number | null;
  agOuvertes: number | null;
  agPvsGeneres: number | null;
  firstAgId: number | null;
};

const EMPTY_STATS: DashboardStats = {
  totalDossiersTravaux: null,
  appelsActifs: null,
  impayesEnCours: null,
  restantAppels: null,
  soldeBancaire: null,
  totalCredit: null,
  totalDebit: null,
  nbNonRapproches: null,
  series: [],
  derniersMouvements: [],

  totalAG: null,
  agOuvertes: null,
  agPvsGeneres: null,
  firstAgId: null,
};

const DASHBOARD_ROUTES = {
  comptaImport: "/compta/import",
  comptaImports: "/compta/imports",
  comptaMouvements: "/compta/mouvements",
  comptaStats: "/compta/stats",

  rhEmployes: "/rh/employes",
  rhContrats: "/rh/contrats",

  travauxDossiers: "/travaux/dossiers",
  travauxFournisseurs: "/travaux/fournisseurs",

  agHome: "/ag",
  agList: "/ag/assemblees",
  agResolutions: "/ag/resolutions",

  billing: "/billing",
  platformAdmin: "/platform-admin",
};

const AG_ENDPOINT_CANDIDATES = ["/api/ag/ags/", "/api/ag/ags"];

function toNumberOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return Boolean(v && typeof v === "object" && !Array.isArray(v));
}

function isPaginatedResponse<T = unknown>(v: unknown): v is { results: T[] } {
  return Boolean(v && typeof v === "object" && Array.isArray((v as { results?: T[] }).results));
}

function extractRows<T = unknown>(v: unknown): T[] {
  if (Array.isArray(v)) return v as T[];

  if (isPaginatedResponse<T>(v)) return v.results;

  if (isRecord(v)) {
    const candidates = [v.results, v.items, v.data];
    for (const candidate of candidates) {
      if (Array.isArray(candidate)) return candidate as T[];
    }
  }

  return [];
}

function formatMoneyFCFA(amount: number | null): string {
  if (amount === null) return "—";
  try {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "XOF",
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${amount} FCFA`;
  }
}

function formatInt(v: number | null): string {
  if (v === null) return "—";
  return new Intl.NumberFormat("fr-FR").format(v);
}

function formatDateShort(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (!Number.isNaN(d.getTime())) {
    return d.toLocaleDateString("fr-FR");
  }
  const s = String(iso);
  return s.length >= 10 ? s.slice(0, 10) : s;
}

function getDetailError(e: unknown): string {
  const err = e as {
    response?: { data?: { detail?: string; message?: string } };
    message?: string;
  };

  return (
    err?.response?.data?.detail ||
    err?.response?.data?.message ||
    err?.message ||
    "Une erreur est survenue lors du chargement du tableau de bord."
  );
}

function normalizeMontant(m: string | number | undefined): number | null {
  if (m === undefined || m === null || m === "") return null;
  const n = Number(m);
  return Number.isFinite(n) ? n : null;
}

function isAllNullOrZero(values: Array<number | null>) {
  return values.every((v) => v === null || v === 0);
}

function truncateText(value?: string, max = 42) {
  if (!value) return "";
  const s = String(value).trim();
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}

function pickSeriesValue(p: SeriesPoint): number | null {
  const cumul = toNumberOrNull(p?.cumul_net);
  if (cumul !== null) return cumul;

  const net = toNumberOrNull(p?.net);
  if (net !== null) return net;

  const credit = toNumberOrNull(p?.credit);
  const debit = toNumberOrNull(p?.debit);
  if (credit !== null || debit !== null) return (credit ?? 0) - (debit ?? 0);

  return null;
}

function normalizeAGStatus(value: unknown): AGStatus {
  const s = String(value ?? "").trim().toUpperCase();

  if (["OUVERTE", "OPEN", "ACTIVE", "ACTIF", "EN_COURS"].includes(s)) return "OUVERTE";
  if (["CLOTUREE", "CLOTURE", "CLOSED", "TERMINEE", "TERMINÉE"].includes(s)) return "CLOTUREE";
  if (["ARCHIVEE", "ARCHIVÉE", "ARCHIVE", "ARCHIVED"].includes(s)) return "ARCHIVEE";
  return "BROUILLON";
}

function toBooleanOrNull(value: unknown): boolean | null {
  if (value === null || value === undefined || value === "") return null;

  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;

  if (typeof value === "string") {
    const s = value.trim().toLowerCase();

    if (["true", "1", "oui", "yes", "ok", "genere", "généré", "disponible"].includes(s)) {
      return true;
    }

    if (["false", "0", "non", "no", "non_genere", "non généré", "non genere", "indisponible"].includes(s)) {
      return false;
    }
  }

  return null;
}

function hasTruthyValue(value: unknown): boolean {
  if (value === null || value === undefined || value === "") return false;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") return value.trim().length > 0;
  return true;
}

function normalizeAGDashboardItem(raw: unknown, index: number): AGDashboardItem {
  const row = isRecord(raw) ? raw : {};

  const pvGenere =
    toBooleanOrNull(row.pv_genere) ??
    toBooleanOrNull(row.pv_archive) ??
    toBooleanOrNull(row.pv_disponible) ??
    (hasTruthyValue(row.pv_signed_pdf) ? true : null) ??
    false;

  return {
    id:
      toNumberOrNull(row.id) ??
      toNumberOrNull(row.ag_id) ??
      toNumberOrNull(row.pk) ??
      index + 1,
    statut: normalizeAGStatus(row.statut ?? row.status ?? row.etat),
    pv_genere: pvGenere,
  };
}

function buildSparkPath(series: SeriesPoint[], width = 260, height = 64, pad = 6) {
  const vals = series.map(pickSeriesValue).filter((v): v is number => v !== null);

  if (vals.length < 2) {
    return { d: "", y0: height - pad, min: 0, max: 0 };
  }

  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min || 1;

  const usableW = width - pad * 2;
  const usableH = height - pad * 2;

  const points = vals.map((v, i) => {
    const x = pad + (i * usableW) / (vals.length - 1);
    const y = pad + (1 - (v - min) / span) * usableH;
    return { x, y };
  });

  const d = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
    .join(" ");

  let y0 = height - pad;
  if (min <= 0 && max >= 0) {
    y0 = pad + (1 - (0 - min) / span) * usableH;
  }

  return { d, y0, min, max };
}

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
      }}
    >
      {props.children}
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

function StatCard(props: {
  title: string;
  value: string;
  sub?: string;
  isLoading?: boolean;
}) {
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
        {props.isLoading ? "…" : props.value}
      </div>
      {props.sub ? (
        <div style={{ marginTop: 8, fontSize: 12, color: "#6b7280", lineHeight: 1.45 }}>
          {props.sub}
        </div>
      ) : null}
    </div>
  );
}

function Badge(props: { text: string; kind: "credit" | "debit" | "neutral" | "warning" | "success" | "info" }) {
  const styles =
    props.kind === "credit" || props.kind === "success"
      ? { background: "#ecfdf5", border: "#a7f3d0", color: "#065f46" }
      : props.kind === "debit"
        ? { background: "#fef2f2", border: "#fecaca", color: "#991b1b" }
        : props.kind === "warning"
          ? { background: "#fffbeb", border: "#fde68a", color: "#92400e" }
          : props.kind === "info"
            ? { background: "#eff6ff", border: "#bfdbfe", color: "#1d4ed8" }
            : { background: "#f3f4f6", border: "#e5e7eb", color: "#374151" };

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
        border: `1px solid ${styles.border}`,
        background: styles.background,
        color: styles.color,
        whiteSpace: "nowrap",
      }}
    >
      {props.text}
    </span>
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
        padding: "9px 12px",
        fontSize: 12,
        fontWeight: 800,
        cursor: props.disabled ? "not-allowed" : "pointer",
        transition: "all 0.15s ease",
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

function KeyValueMetric(props: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 6 }}>{props.label}</div>
      <div style={{ fontSize: 20, fontWeight: 900, color: "#111827", lineHeight: 1.2 }}>
        {props.value}
      </div>
    </div>
  );
}

function QuickActionCard(props: {
  title: string;
  text: string;
  actionLabel: string;
  onAction: () => void;
  disabled?: boolean;
  badge?: ReactNode;
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
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ fontSize: 14, fontWeight: 900, color: "#111827" }}>{props.title}</div>
        {props.badge ?? null}
      </div>
      <div style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.5 }}>{props.text}</div>
      <div>
        <SmallButton onClick={props.onAction} primary disabled={props.disabled}>
          {props.actionLabel}
        </SmallButton>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();

  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const coproprieteId = useAuthStore((s) => s.coproprieteId);

  const [state, setState] = useState<LoadState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<DashboardStats>(EMPTY_STATS);
  const [seriesDays, setSeriesDays] = useState<number>(30);

  const canFetch = useMemo(() => Boolean(isAuthenticated && coproprieteId), [isAuthenticated, coproprieteId]);

  useEffect(() => {
    setStats(EMPTY_STATS);
    setState("idle");
    setError(null);
  }, [coproprieteId]);

  useEffect(() => {
    if (!canFetch) return;

    let alive = true;

    async function load() {
      setState("loading");
      setError(null);

      try {
        const [travauxRes, billingRes, comptaRes, movesRes, agRes] = await Promise.all([
          api.get("/api/travaux/dossiers/stats/"),
          api.get("/api/billing/dashboard/"),
          api.get(`/api/compta/mouvements/dashboard/?series_days=${seriesDays}`),
          api.get("/api/compta/mouvements/?ordering=-date_operation"),
          (async () => {
            let lastError: unknown = null;
            for (const endpoint of AG_ENDPOINT_CANDIDATES) {
              try {
                return await api.get(endpoint);
              } catch (e) {
                lastError = e;
              }
            }
            throw lastError ?? new Error("Impossible de charger les assemblées.");
          })(),
        ]);

        if (!alive) return;

        const travauxData = travauxRes?.data ?? {};
        const billingData = billingRes?.data ?? {};
        const comptaData = comptaRes?.data ?? {};
        const movesData = movesRes?.data ?? {};
        const agData = agRes?.data ?? {};

        const movesList = extractRows<MouvementItem>(movesData);
        const agList = extractRows<Record<string, unknown>>(agData)
          .map(normalizeAGDashboardItem)
          .filter((item) => item.id > 0);

        const totalDossiersTravaux =
          toNumberOrNull(travauxData?.total_dossiers) ??
          toNumberOrNull(travauxData?.totaux?.total_dossiers) ??
          toNumberOrNull(travauxData?.count) ??
          toNumberOrNull(travauxData?.nb_dossiers) ??
          null;

        const lignes = billingData?.lignes ?? {};
        const appelsActifs =
          toNumberOrNull(lignes?.nb) ??
          toNumberOrNull(billingData?.appels_actifs) ??
          toNumberOrNull(billingData?.totaux?.appels_actifs) ??
          null;

        const impayesEnCours = Array.isArray(lignes?.impayes_top10)
          ? lignes.impayes_top10.length
          : (toNumberOrNull(billingData?.impayes_en_cours) ??
            toNumberOrNull(billingData?.totaux?.impayes_en_cours) ??
            null);

        const restantAppels =
          toNumberOrNull(lignes?.restant) ??
          toNumberOrNull(lignes?.reste_a_payer) ??
          null;

        const soldeBancaire = toNumberOrNull(comptaData?.totaux?.solde) ?? null;
        const totalCredit = toNumberOrNull(comptaData?.totaux?.total_credit) ?? null;
        const totalDebit = toNumberOrNull(comptaData?.totaux?.total_debit) ?? null;
        const nbNonRapproches = toNumberOrNull(comptaData?.totaux?.nb_non_rapproches) ?? null;

        const series = extractRows<SeriesPoint>(comptaData?.series);
        const derniersMouvements = movesList.slice(0, 5);

        const totalAG = agList.length;
        const agOuvertes = agList.filter((x) => x.statut === "OUVERTE").length;
        const agPvsGeneres = agList.filter((x) => x.pv_genere).length;
        const firstAgId = agList.length > 0 ? agList[0].id : null;

        setStats({
          totalDossiersTravaux,
          appelsActifs,
          impayesEnCours,
          restantAppels,
          soldeBancaire,
          totalCredit,
          totalDebit,
          nbNonRapproches,
          series,
          derniersMouvements,

          totalAG,
          agOuvertes,
          agPvsGeneres,
          firstAgId,
        });

        setState("success");
      } catch (e) {
        if (!alive) return;
        setState("error");
        setError(String(getDetailError(e)));
      }
    }

    void load();

    return () => {
      alive = false;
    };
  }, [canFetch, coproprieteId, seriesDays]);

  const isLoading = state === "loading";

  if (!isAuthenticated) {
    return (
      <PageShell>
        <AlertBox kind="info">
          Vous n’êtes pas connecté. Veuillez vous authentifier pour accéder au tableau de bord.
        </AlertBox>
      </PageShell>
    );
  }

  if (!coproprieteId) {
    return (
      <PageShell>
        <AlertBox kind="info">
          Aucune copropriété n’est sélectionnée. Utilisez l’action « Changer de copropriété » pour afficher les indicateurs associés.
        </AlertBox>
      </PageShell>
    );
  }

  const emptyCompta = isAllNullOrZero([
    stats.soldeBancaire,
    stats.totalCredit,
    stats.totalDebit,
    stats.nbNonRapproches,
  ]);

  const subImpayes =
    stats.restantAppels !== null
      ? `Montant restant dû : ${formatMoneyFCFA(stats.restantAppels)}`
      : "Vue synthétique des impayés actuellement suivis.";

  const spark = buildSparkPath(stats.series, 260, 64, 6);
  const hasSeries = Boolean(spark.d);
  const hasAnyAg = stats.firstAgId !== null;

  return (
    <PageShell>
      <SectionTitle
        title="Tableau de bord"
        subtitle={`Pilotez l’activité de votre copropriété depuis une vue d’ensemble claire, centralisée et orientée produit. Copropriété active : #${coproprieteId}.`}
        right={
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <label style={{ fontSize: 12, color: "#6b7280", fontWeight: 700 }}>Période analysée</label>
            <select
              value={seriesDays}
              onChange={(e) => setSeriesDays(Number(e.target.value))}
              disabled={isLoading}
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 12,
                padding: "10px 12px",
                fontSize: 12,
                fontWeight: 800,
                background: "#fff",
                color: "#111827",
                minWidth: 120,
              }}
            >
              <option value={30}>30 jours</option>
              <option value={90}>90 jours</option>
              <option value={180}>180 jours</option>
            </select>

            <SmallButton onClick={() => navigate(DASHBOARD_ROUTES.comptaStats)} disabled={isLoading}>
              Voir les statistiques
            </SmallButton>
          </div>
        }
      />

      {state === "error" && error ? (
        <AlertBox kind="error">
          <div style={{ fontWeight: 900, marginBottom: 4 }}>
            Impossible de charger le tableau de bord
          </div>
          <div style={{ fontSize: 13, lineHeight: 1.5 }}>{error}</div>
        </AlertBox>
      ) : null}

      <div className="dashboard-stat-grid">
        <StatCard
          title="Solde bancaire"
          value={formatMoneyFCFA(stats.soldeBancaire)}
          sub={`Situation comptable observée sur ${seriesDays} jours.`}
          isLoading={isLoading}
        />
        <StatCard
          title="Appels de fonds actifs"
          value={formatInt(stats.appelsActifs)}
          sub="Indicateur issu du module Facturation."
          isLoading={isLoading}
        />
        <StatCard
          title="Impayés en cours"
          value={formatInt(stats.impayesEnCours)}
          sub={subImpayes}
          isLoading={isLoading}
        />
        <StatCard
          title="Dossiers travaux"
          value={formatInt(stats.totalDossiersTravaux)}
          sub="Nombre total de dossiers travaux enregistrés."
          isLoading={isLoading}
        />
      </div>

      <div className="dashboard-main-grid">
        <Card
          title="Pilotage comptable"
          right={
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              {stats.nbNonRapproches !== null ? (
                <Badge
                  text={`Non rapprochés : ${formatInt(stats.nbNonRapproches)}`}
                  kind={stats.nbNonRapproches > 0 ? "warning" : "neutral"}
                />
              ) : null}
              <SmallButton onClick={() => navigate(DASHBOARD_ROUTES.comptaMouvements)} disabled={isLoading}>
                Voir les mouvements
              </SmallButton>
            </div>
          }
          minHeight={260}
        >
          {isLoading ? (
            <div style={{ color: "#6b7280", fontSize: 14 }}>
              Chargement des indicateurs comptables…
            </div>
          ) : emptyCompta ? (
            <EmptyState
              title="Aucune donnée comptable disponible"
              text="Aucun compte ou mouvement bancaire n’a encore été trouvé pour cette copropriété. Importez un relevé bancaire pour commencer le suivi comptable."
              actionLabel="Importer un relevé"
              onAction={() => navigate(DASHBOARD_ROUTES.comptaImport)}
            />
          ) : (
            <div style={{ display: "grid", gap: 18 }}>
              <div
                className="dashboard-metrics-grid"
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                  gap: 14,
                }}
              >
                <KeyValueMetric label="Crédits totaux" value={formatMoneyFCFA(stats.totalCredit)} />
                <KeyValueMetric label="Débits totaux" value={formatMoneyFCFA(stats.totalDebit)} />
                <KeyValueMetric label="Solde bancaire" value={formatMoneyFCFA(stats.soldeBancaire)} />
              </div>

              <div
                style={{
                  borderTop: "1px solid #f1f5f9",
                  paddingTop: 16,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 8,
                    marginBottom: 10,
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 800, color: "#111827" }}>
                    Tendance récente
                  </div>
                  <div style={{ fontSize: 12, color: "#6b7280" }}>{seriesDays} derniers jours</div>
                </div>

                {hasSeries ? (
                  <div
                    style={{
                      border: "1px solid #f1f5f9",
                      borderRadius: 14,
                      padding: 12,
                      background: "#fcfcfd",
                    }}
                  >
                    <svg width="100%" height="70" viewBox="0 0 260 64" preserveAspectRatio="none">
                      <line
                        x1="6"
                        y1={spark.y0}
                        x2="254"
                        y2={spark.y0}
                        stroke="#e5e7eb"
                        strokeWidth="1"
                      />
                      <path
                        d={spark.d}
                        fill="none"
                        stroke="#111827"
                        strokeWidth="2.4"
                        strokeLinecap="round"
                      />
                    </svg>
                  </div>
                ) : (
                  <div style={{ fontSize: 13, color: "#6b7280" }}>
                    Les données disponibles sont encore insuffisantes pour afficher une tendance sur la période sélectionnée.
                  </div>
                )}
              </div>
            </div>
          )}
        </Card>

        <Card
          title="Activité bancaire récente"
          right={
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <Badge text="5 derniers mouvements" kind="neutral" />
              <SmallButton onClick={() => navigate(DASHBOARD_ROUTES.comptaMouvements)} disabled={isLoading}>
                Voir tout
              </SmallButton>
            </div>
          }
          minHeight={260}
        >
          {isLoading ? (
            <div style={{ color: "#6b7280", fontSize: 14 }}>
              Chargement de l’activité récente…
            </div>
          ) : stats.derniersMouvements.length === 0 ? (
            <EmptyState
              title="Aucune activité récente disponible"
              text="Les derniers mouvements bancaires apparaîtront ici dès que des opérations auront été enregistrées."
              actionLabel="Voir les imports"
              onAction={() => navigate(DASHBOARD_ROUTES.comptaImports)}
            />
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {stats.derniersMouvements.map((m) => {
                const sens = String(m.sens || "").toUpperCase();
                const kind: "credit" | "debit" | "neutral" =
                  sens === "CREDIT" ? "credit" : sens === "DEBIT" ? "debit" : "neutral";
                const montant = normalizeMontant(m.montant);
                const titre = m.libelle || m.reference || "Mouvement bancaire";

                return (
                  <div
                    key={m.id}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "96px 1fr auto",
                      gap: 12,
                      alignItems: "center",
                      padding: 12,
                      border: "1px solid #eef2f7",
                      borderRadius: 14,
                      background: "#fff",
                    }}
                  >
                    <div style={{ fontSize: 12, color: "#6b7280", fontWeight: 700 }}>
                      {formatDateShort(m.date_operation)}
                    </div>

                    <div style={{ minWidth: 0 }}>
                      <div
                        title={titre}
                        style={{
                          fontSize: 14,
                          fontWeight: 900,
                          color: "#111827",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {truncateText(titre, 38)}
                      </div>

                      <div
                        style={{
                          display: "flex",
                          gap: 8,
                          alignItems: "center",
                          marginTop: 6,
                          flexWrap: "wrap",
                        }}
                      >
                        {m.reference ? (
                          <span style={{ fontSize: 12, color: "#6b7280" }}>
                            {truncateText(m.reference, 28)}
                          </span>
                        ) : null}
                        {m.is_rapproche === true ? <Badge text="Rapproché" kind="neutral" /> : null}
                      </div>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        flexWrap: "wrap",
                        justifyContent: "flex-end",
                      }}
                    >
                      <Badge text={sens || "—"} kind={kind} />
                      <div style={{ fontSize: 14, fontWeight: 900, color: "#111827" }}>
                        {montant === null ? "—" : formatMoneyFCFA(montant)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      <Card
        title="Assemblées générales"
        right={
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            {stats.totalAG !== null ? (
              <Badge text={`AG : ${formatInt(stats.totalAG)}`} kind="info" />
            ) : null}
            <SmallButton onClick={() => navigate(DASHBOARD_ROUTES.agList)} disabled={isLoading}>
              Voir la liste AG
            </SmallButton>
          </div>
        }
        minHeight={180}
      >
        {isLoading ? (
          <div style={{ color: "#6b7280", fontSize: 14 }}>Chargement des indicateurs AG…</div>
        ) : stats.totalAG === null || stats.totalAG === 0 ? (
          <EmptyState
            title="Aucune assemblée générale disponible"
            text="Le module AG est accessible, mais aucune assemblée n’a encore été trouvée pour cette copropriété."
            actionLabel="Ouvrir le module AG"
            onAction={() => navigate(DASHBOARD_ROUTES.agHome)}
          />
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
              gap: 14,
            }}
            className="dashboard-ag-grid"
          >
            <KeyValueMetric label="Assemblées totales" value={formatInt(stats.totalAG)} />
            <KeyValueMetric label="Assemblées ouvertes" value={formatInt(stats.agOuvertes)} />
            <KeyValueMetric label="PV générés" value={formatInt(stats.agPvsGeneres)} />
          </div>
        )}
      </Card>

      <Card title="Accès rapides" minHeight={120}>
        <div className="dashboard-quick-grid">
          <QuickActionCard
            title="Importer un relevé"
            text="Ajoutez un relevé bancaire pour traiter les lignes importées et lancer les rapprochements."
            actionLabel="Importer un relevé"
            onAction={() => navigate(DASHBOARD_ROUTES.comptaImport)}
          />
          <QuickActionCard
            title="Consulter les imports bancaires"
            text="Accédez à l’historique des imports bancaires et poursuivez le traitement des lignes."
            actionLabel="Voir les imports"
            onAction={() => navigate(DASHBOARD_ROUTES.comptaImports)}
          />
          <QuickActionCard
            title="Consulter les mouvements bancaires"
            text="Suivez les mouvements bancaires enregistrés pour la copropriété active."
            actionLabel="Voir les mouvements"
            onAction={() => navigate(DASHBOARD_ROUTES.comptaMouvements)}
          />
          <QuickActionCard
            title="Voir les statistiques comptables"
            text="Analysez les principaux indicateurs comptables et la situation bancaire globale."
            actionLabel="Voir les statistiques"
            onAction={() => navigate(DASHBOARD_ROUTES.comptaStats)}
          />
          <QuickActionCard
            title="Gérer les employés"
            text="Accédez à la liste des employés rattachés à cette copropriété."
            actionLabel="Voir les employés"
            onAction={() => navigate(DASHBOARD_ROUTES.rhEmployes)}
          />
          <QuickActionCard
            title="Gérer les contrats"
            text="Consultez les contrats, leurs périodes d’activité et leur statut."
            actionLabel="Voir les contrats"
            onAction={() => navigate(DASHBOARD_ROUTES.rhContrats)}
          />
          <QuickActionCard
            title="Gérer les dossiers travaux"
            text="Suivez les dossiers travaux, leur budget, leur résolution liée et leur verrouillage."
            actionLabel="Voir les dossiers"
            onAction={() => navigate(DASHBOARD_ROUTES.travauxDossiers)}
          />
          <QuickActionCard
            title="Gérer les fournisseurs"
            text="Consultez les fournisseurs enregistrés dans le module Travaux et maintenez leurs fiches."
            actionLabel="Voir les fournisseurs"
            onAction={() => navigate(DASHBOARD_ROUTES.travauxFournisseurs)}
          />
          <QuickActionCard
            title="Module AG"
            text="Accédez à l’espace Assemblées générales pour suivre le cycle complet AG."
            actionLabel="Ouvrir AG"
            onAction={() => navigate(DASHBOARD_ROUTES.agHome)}
            badge={<Badge text="Visible" kind="success" />}
          />
          <QuickActionCard
            title="Liste des AG"
            text="Consultez directement la liste des assemblées générales disponibles."
            actionLabel="Voir les AG"
            onAction={() => navigate(DASHBOARD_ROUTES.agList)}
          />
          <QuickActionCard
            title="Résolutions AG"
            text="Suivez les résolutions liées aux assemblées et leur statut métier."
            actionLabel="Voir les résolutions"
            onAction={() => navigate(DASHBOARD_ROUTES.agResolutions)}
          />
          <QuickActionCard
            title="Présences AG"
            text="Accédez directement aux présences de la première AG disponible."
            actionLabel="Voir les présences"
            onAction={() => navigate(`/ag/assemblees/${stats.firstAgId}/presences`)}
            disabled={!hasAnyAg}
            badge={<Badge text={hasAnyAg ? "Visible" : "Aucune AG"} kind={hasAnyAg ? "success" : "warning"} />}
          />
          <QuickActionCard
            title="Votes AG"
            text="Accédez directement aux votes de la première AG disponible."
            actionLabel="Voir les votes"
            onAction={() => navigate(`/ag/assemblees/${stats.firstAgId}/votes`)}
            disabled={!hasAnyAg}
            badge={<Badge text={hasAnyAg ? "Visible" : "Aucune AG"} kind={hasAnyAg ? "success" : "warning"} />}
          />
          <QuickActionCard
            title="Détail AG"
            text="Ouvrez une AG disponible pour accéder au quorum, au PV, aux présences et aux votes."
            actionLabel="Ouvrir le détail"
            onAction={() => navigate(`/ag/assemblees/${stats.firstAgId}`)}
            disabled={!hasAnyAg}
            badge={<Badge text={hasAnyAg ? "Recommandé" : "Aucune AG"} kind={hasAnyAg ? "info" : "warning"} />}
          />
          <QuickActionCard
            title="Facturation"
            text="Accédez au module Facturation pour piloter les appels de fonds, les lignes et les impayés."
            actionLabel="Ouvrir la facturation"
            onAction={() => navigate(DASHBOARD_ROUTES.billing)}
          />
          <QuickActionCard
            title="Administration plateforme"
            text="Accédez au back-office plateforme pour superviser les copropriétés et les rôles principaux."
            actionLabel="Ouvrir l’administration"
            onAction={() => navigate(DASHBOARD_ROUTES.platformAdmin)}
          />
        </div>
      </Card>

      <AlertBox kind="info">
        <div style={{ fontWeight: 900, marginBottom: 4 }}>Visibilité transverse du module AG</div>
        <div style={{ fontSize: 13, lineHeight: 1.5 }}>
          Le tableau de bord expose désormais le module <strong>Assemblées générales</strong> de façon plus visible,
          avec accès directs vers la liste, les résolutions, les présences, les votes et le détail d’une AG disponible.
        </div>
      </AlertBox>

      <style>{`
        .dashboard-stat-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 14px;
        }

        .dashboard-main-grid {
          display: grid;
          grid-template-columns: 1.15fr 1fr;
          gap: 14px;
        }

        .dashboard-quick-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
        }

        .dashboard-ag-grid {
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }

        @media (max-width: 1280px) {
          .dashboard-quick-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }

        @media (max-width: 1200px) {
          .dashboard-stat-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .dashboard-main-grid {
            grid-template-columns: 1fr;
          }

          .dashboard-quick-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 760px) {
          .dashboard-stat-grid {
            grid-template-columns: 1fr;
          }

          .dashboard-metrics-grid {
            grid-template-columns: 1fr !important;
          }

          .dashboard-quick-grid,
          .dashboard-ag-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 640px) {
          .dashboard-main-grid > div,
          .dashboard-stat-grid > div {
            min-width: 0;
          }
        }
      `}</style>
    </PageShell>
  );
}