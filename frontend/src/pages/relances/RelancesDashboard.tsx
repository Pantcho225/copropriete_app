import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { relancesAPI } from "../../api/relances";
import { APP_TEXT } from "../../constants/appText";

type LoadState = "idle" | "loading" | "success" | "error";

type DossierItem = {
  id: number;
  statut?: string;
  reste_a_payer?: number | string | null;
  lot_numero?: string | null;
  lot?: string | number | null;
  coproprietaire_nom?: string | null;
  appel_reference?: string | null;
  reference_appel?: string | null;
  date_echeance?: string | null;
  niveau_relance?: number | null;
};

type DashboardStatsResponse = {
  total?: number;
  en_retard?: number;
  payes?: number;
  regularises?: number;
  partiellement_payes?: number;
  non_regularises?: number;
};

type Stats = {
  total: number;
  enRetard: number;
  payes: number;
  regularises: number;
  partiels: number;
  montantTotalImpayes: number;
};

function PageShell({ children }: { children: ReactNode }) {
  return <div style={{ display: "grid", gap: 16 }}>{children}</div>;
}

function SectionTitle(props: { title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 12,
        flexWrap: "wrap",
        alignItems: "flex-end",
      }}
    >
      <div>
        <div
          style={{
            fontSize: 28,
            fontWeight: 900,
            color: "#111827",
            lineHeight: 1.1,
            letterSpacing: -0.4,
          }}
        >
          {props.title}
        </div>
        {props.subtitle ? (
          <div
            style={{
              marginTop: 6,
              color: "#6b7280",
              fontSize: 14,
              lineHeight: 1.5,
              maxWidth: 920,
            }}
          >
            {props.subtitle}
          </div>
        ) : null}
      </div>
      {props.right}
    </div>
  );
}

function StatCard(props: {
  title: string;
  value: string | number;
  sub?: string;
  isLoading?: boolean;
}) {
  return (
    <div style={card}>
      <div style={{ fontSize: 13, color: "#6b7280", fontWeight: 700, marginBottom: 10 }}>
        {props.title}
      </div>
      <div style={{ fontSize: 28, fontWeight: 900, color: "#111827", lineHeight: 1.1 }}>
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

function SmallButton(props: {
  children: ReactNode;
  onClick?: () => void;
  primary?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={props.disabled}
      onClick={props.onClick}
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

function Badge(props: {
  text: string;
  kind?: "success" | "warning" | "danger" | "info" | "neutral";
}) {
  const styles =
    props.kind === "success"
      ? { background: "#ecfdf5", border: "#a7f3d0", color: "#065f46" }
      : props.kind === "warning"
        ? { background: "#fffbeb", border: "#fde68a", color: "#92400e" }
        : props.kind === "danger"
          ? { background: "#fef2f2", border: "#fecaca", color: "#991b1b" }
          : props.kind === "info"
            ? { background: "#eff6ff", border: "#bfdbfe", color: "#1d4ed8" }
            : { background: "#f3f4f6", border: "#e5e7eb", color: "#374151" };

  return (
    <span
      style={{
        display: "inline-flex",
        padding: "4px 10px",
        borderRadius: 999,
        border: `1px solid ${styles.border}`,
        background: styles.background,
        color: styles.color,
        fontSize: 12,
        fontWeight: 700,
        whiteSpace: "nowrap",
      }}
    >
      {props.text}
    </span>
  );
}

function AlertBox(props: { kind: "error" | "info"; children: ReactNode }) {
  const tone =
    props.kind === "error"
      ? { bg: "#fef2f2", border: "#fecaca", text: "#991b1b" }
      : { bg: "#eff6ff", border: "#bfdbfe", text: "#1d4ed8" };

  return (
    <div
      style={{
        padding: 14,
        borderRadius: 16,
        background: tone.bg,
        border: `1px solid ${tone.border}`,
        color: tone.text,
      }}
    >
      {props.children}
    </div>
  );
}

function formatMoneyFCFA(amount?: number | null): string {
  if (amount == null) return "—";
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

function formatDateShort(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("fr-FR");
}

function toNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function normalizeStatut(value?: string | null): string {
  return String(value ?? "").trim().toUpperCase();
}

function getStatutBadge(statut?: string | null) {
  switch (normalizeStatut(statut)) {
    case "REGULARISE":
      return <Badge text={APP_TEXT.statuses.relances.regularised} kind="success" />;
    case "PAYE":
      return <Badge text={APP_TEXT.statuses.compta.paid} kind="success" />;
    case "PARTIELLEMENT_PAYE":
      return <Badge text={APP_TEXT.statuses.compta.partial} kind="warning" />;
    case "EN_RETARD":
      return (
        <Badge
          text={APP_TEXT.pages.relances.home.extra.priority.overdueStatus}
          kind="danger"
        />
      );
    default:
      return (
        <Badge
          text={APP_TEXT.pages.relances.home.extra.priority.payableFallback}
          kind="info"
        />
      );
  }
}

export default function RelancesDashboard() {
  const navigate = useNavigate();

  const [state, setState] = useState<LoadState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [dossiers, setDossiers] = useState<DossierItem[]>([]);
  const [statsData, setStatsData] = useState<DashboardStatsResponse | null>(null);

  async function loadData() {
    setState("loading");
    setError(null);

    try {
      const [statsResponse, dossiersResponse] = await Promise.all([
        relancesAPI.getDossiersStats(),
        relancesAPI.getDossiers(),
      ]);

      setStatsData((statsResponse ?? {}) as DashboardStatsResponse);
      setDossiers(Array.isArray(dossiersResponse) ? (dossiersResponse as DossierItem[]) : []);
      setState("success");
    } catch (e: any) {
      setState("error");
      setError(
        e?.response?.data?.detail ||
          e?.message ||
          APP_TEXT.feedback.error.load
      );
      setStatsData(null);
      setDossiers([]);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  const stats = useMemo<Stats>(() => {
    return {
      total: toNumber(statsData?.total),
      enRetard: toNumber(statsData?.en_retard),
      payes: toNumber(statsData?.payes),
      regularises: toNumber(statsData?.regularises),
      partiels: toNumber(statsData?.partiellement_payes),
      montantTotalImpayes: dossiers.reduce((acc, d) => acc + toNumber(d.reste_a_payer), 0),
    };
  }, [statsData, dossiers]);

  const urgentDossiers = useMemo(() => {
    return dossiers
      .filter((d) => {
        const statut = normalizeStatut(d.statut);
        return statut === "EN_RETARD" || statut === "PARTIELLEMENT_PAYE";
      })
      .sort((a, b) => toNumber(b.reste_a_payer) - toNumber(a.reste_a_payer))
      .slice(0, 5);
  }, [dossiers]);

  const isLoading = state === "loading";

  return (
    <PageShell>
      <SectionTitle
        title={APP_TEXT.pages.relances.homeTitle}
        subtitle={APP_TEXT.pages.relances.homeSubtitle}
        right={
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <SmallButton onClick={() => navigate("/relances/dossiers")} primary>
              {APP_TEXT.pages.relances.home.quickActions.openFoldersAction}
            </SmallButton>
            <SmallButton onClick={() => navigate("/relances/historique")}>
              {APP_TEXT.pages.relances.home.quickActions.openHistoryAction}
            </SmallButton>
            <SmallButton onClick={() => navigate("/relances/avis")}>
              {APP_TEXT.pages.relances.home.quickActions.openNoticesAction}
            </SmallButton>
            <SmallButton onClick={() => void loadData()} disabled={isLoading}>
              {isLoading ? APP_TEXT.feedback.loading.default : APP_TEXT.actions.refresh}
            </SmallButton>
          </div>
        }
      />

      {state === "error" && error ? (
        <AlertBox kind="error">
          <div style={{ fontWeight: 900, marginBottom: 4 }}>
            {APP_TEXT.feedback.error.load}
          </div>
          <div style={{ lineHeight: 1.5 }}>{error}</div>
        </AlertBox>
      ) : null}

      <div className="relances-dashboard-grid">
        <StatCard
          title={APP_TEXT.pages.relances.home.cards.folders}
          value={stats.total}
          sub={APP_TEXT.pages.relances.home.cardsSubtitles.folders}
          isLoading={isLoading}
        />
        <StatCard
          title={APP_TEXT.pages.relances.home.extra.cards.overdue}
          value={stats.enRetard}
          sub={APP_TEXT.pages.relances.home.extra.cardsSubtitles.overdue}
          isLoading={isLoading}
        />
        <StatCard
          title={APP_TEXT.pages.relances.home.extra.cards.partial}
          value={stats.partiels}
          sub={APP_TEXT.pages.relances.home.extra.cardsSubtitles.partial}
          isLoading={isLoading}
        />
        <StatCard
          title={APP_TEXT.pages.relances.home.extra.cards.paid}
          value={stats.payes}
          sub={APP_TEXT.pages.relances.home.extra.cardsSubtitles.paid}
          isLoading={isLoading}
        />
        <StatCard
          title={APP_TEXT.pages.relances.home.cards.notices}
          value={stats.regularises}
          sub={APP_TEXT.pages.relances.home.cardsSubtitles.notices}
          isLoading={isLoading}
        />
        <StatCard
          title={APP_TEXT.pages.relances.home.cards.unpaidAmount}
          value={formatMoneyFCFA(stats.montantTotalImpayes)}
          sub={APP_TEXT.pages.relances.home.cardsSubtitles.unpaidAmount}
          isLoading={isLoading}
        />
      </div>

      <div style={card}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
            marginBottom: 14,
            alignItems: "center",
          }}
        >
          <div style={{ display: "grid", gap: 4 }}>
            <div style={{ fontSize: 16, fontWeight: 900, color: "#111827" }}>
              {APP_TEXT.pages.relances.home.extra.priority.title}
            </div>
            <div style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.5 }}>
              {APP_TEXT.pages.relances.home.extra.priority.subtitle}
            </div>
          </div>

          <SmallButton onClick={() => navigate("/relances/dossiers")}>
            {APP_TEXT.pages.relances.home.quickActions.openFoldersAction}
          </SmallButton>
        </div>

        {isLoading ? (
          <div style={{ color: "#6b7280" }}>{APP_TEXT.feedback.loading.default}</div>
        ) : urgentDossiers.length === 0 ? (
          <AlertBox kind="info">
            {APP_TEXT.pages.relances.home.empty.folders}
          </AlertBox>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {urgentDossiers.map((d) => (
              <div key={d.id} style={rowCard}>
                <div style={{ display: "grid", gap: 6 }}>
                  <div style={{ fontWeight: 900, color: "#111827" }}>
                    {d.lot_numero || d.lot || APP_TEXT.pages.relances.home.extra.priority.lotFallback} —{" "}
                    {d.coproprietaire_nom ||
                      APP_TEXT.pages.relances.home.extra.priority.ownerFallback}
                  </div>

                  <div style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.45 }}>
                    {APP_TEXT.pages.relances.home.extra.priority.callLabel} :{" "}
                    {d.appel_reference || d.reference_appel || "—"} •{" "}
                    {APP_TEXT.pages.relances.home.extra.priority.dueDateLabel} :{" "}
                    {formatDateShort(d.date_echeance)}
                  </div>

                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {getStatutBadge(d.statut)}
                    <Badge
                      text={`${
                        APP_TEXT.pages.relances.home.extra.priority.remainingLabel
                      } : ${formatMoneyFCFA(toNumber(d.reste_a_payer))}`}
                      kind="danger"
                    />
                    <Badge
                      text={`${
                        APP_TEXT.pages.relances.home.extra.priority.levelLabel
                      } ${d.niveau_relance || 0}`}
                      kind="warning"
                    />
                  </div>
                </div>

                <div>
                  <SmallButton onClick={() => navigate(`/relances/dossiers/${d.id}`)} primary>
                    {APP_TEXT.pages.relances.home.extra.priority.openAction}
                  </SmallButton>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <AlertBox kind="info">
        <div style={{ fontWeight: 900, marginBottom: 4 }}>
          {APP_TEXT.pages.relances.home.extra.productNote.title}
        </div>
        <div style={{ fontSize: 13, lineHeight: 1.5 }}>
          {APP_TEXT.pages.relances.home.extra.productNote.description}
        </div>
      </AlertBox>

      <style>{`
        .relances-dashboard-grid {
          display: grid;
          grid-template-columns: repeat(6, minmax(0, 1fr));
          gap: 14px;
        }

        @media (max-width: 1500px) {
          .relances-dashboard-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }

        @media (max-width: 900px) {
          .relances-dashboard-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 700px) {
          .relances-dashboard-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </PageShell>
  );
}

const card: CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 20,
  padding: 18,
  background: "#fff",
  boxShadow: "0 10px 30px rgba(15, 23, 42, 0.04)",
};

const rowCard: CSSProperties = {
  border: "1px solid #eef2f7",
  borderRadius: 14,
  padding: 14,
  background: "#fff",
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "center",
  flexWrap: "wrap",
};