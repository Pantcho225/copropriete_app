import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { useNavigate } from "react-router-dom";
import { relancesAPI } from "../../api/relances";

type LoadState = "idle" | "loading" | "success" | "error";
type AccentKind = "neutral" | "success" | "warning" | "danger" | "info";
type StatusFilter = "ALL" | "EN_RETARD" | "PARTIELLEMENT_PAYE" | "REGULARISE" | "PAYE";
type RiskFilter = "ALL" | "HIGH" | "MEDIUM" | "LOW";

type DossierItem = {
  id: number;
  lot_numero?: string | null;
  coproprietaire_nom?: string | null;
  appel_reference?: string | null;
  reference_appel?: string | null;
  date_echeance?: string | null;
  montant_initial?: number | string | null;
  montant_paye?: number | string | null;
  reste_a_payer?: number | string | null;
  statut?: string | null;
  niveau_relance?: number | null;
  relances_count?: number | null;
  est_regularise?: boolean;
};

const EMPTY_DOSSIERS: DossierItem[] = [];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function extractArray<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];

  if (isRecord(payload)) {
    if (Array.isArray(payload.results)) return payload.results as T[];
    if (Array.isArray(payload.data)) return payload.data as T[];
    if (Array.isArray(payload.items)) return payload.items as T[];
  }

  return [];
}

function getErrorMessage(error: unknown, fallback: string): string {
  const err = error as {
    response?: {
      data?: {
        detail?: string;
        non_field_errors?: string[];
        [key: string]: unknown;
      };
    };
    message?: string;
  };

  const data = err?.response?.data;

  if (data && typeof data === "object") {
    if (typeof data.detail === "string" && data.detail.trim()) return data.detail;

    if (Array.isArray(data.non_field_errors) && data.non_field_errors.length > 0) {
      return data.non_field_errors.join("\n");
    }

    try {
      const entries = Object.entries(data);

      if (entries.length > 0) {
        return entries
          .map(([key, value]) => {
            const rendered = Array.isArray(value)
              ? value.join(" / ")
              : typeof value === "string"
                ? value
                : JSON.stringify(value);

            return `${key}: ${rendered}`;
          })
          .join("\n");
      }
    } catch {
      return err?.message || fallback;
    }
  }

  return err?.message || fallback;
}

function toNumber(value?: number | string | null): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;

  if (typeof value === "string") {
    const parsed = Number(value.replace(/\s/g, "").replace(",", "."));
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function normalizeStatut(value?: string | null): string {
  return String(value ?? "").trim().toUpperCase();
}

function getTone(kind: AccentKind) {
  if (kind === "success") {
    return {
      softBg: "#ecfdf5",
      border: "#86efac",
      text: "#166534",
      strongText: "#14532d",
      accentBg: "#dcfce7",
      accentText: "#166534",
    };
  }

  if (kind === "warning") {
    return {
      softBg: "#fffbeb",
      border: "#fcd34d",
      text: "#92400e",
      strongText: "#78350f",
      accentBg: "#fef3c7",
      accentText: "#92400e",
    };
  }

  if (kind === "danger") {
    return {
      softBg: "#fef2f2",
      border: "#fca5a5",
      text: "#991b1b",
      strongText: "#7f1d1d",
      accentBg: "#fee2e2",
      accentText: "#991b1b",
    };
  }

  if (kind === "info") {
    return {
      softBg: "#eff6ff",
      border: "#93c5fd",
      text: "#1d4ed8",
      strongText: "#1e3a8a",
      accentBg: "#dbeafe",
      accentText: "#1d4ed8",
    };
  }

  return {
    softBg: "#f8fafc",
    border: "#e2e8f0",
    text: "#475569",
    strongText: "#0f172a",
    accentBg: "#f1f5f9",
    accentText: "#475569",
  };
}

function formatMoneyFCFA(amount?: number | string | null): string {
  if (amount == null || amount === "") return "—";

  const value = toNumber(amount);

  try {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "XOF",
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${value} FCFA`;
  }
}

function formatDateShort(iso?: string | null): string {
  if (!iso) return "—";

  const d = new Date(iso);

  if (Number.isNaN(d.getTime())) return iso;

  return d.toLocaleDateString("fr-FR");
}

function getStatutLabel(statut?: string | null): string {
  switch (normalizeStatut(statut)) {
    case "REGULARISE":
      return "Régularisé";
    case "PAYE":
      return "Payé";
    case "PARTIELLEMENT_PAYE":
      return "Partiellement payé";
    case "EN_RETARD":
      return "En retard";
    default:
      return "À payer";
  }
}

function getRiskLevel(item: DossierItem): "HIGH" | "MEDIUM" | "LOW" {
  const niveau = Number(item.niveau_relance ?? 0);
  const reste = toNumber(item.reste_a_payer);
  const statut = normalizeStatut(item.statut);

  if (statut === "EN_RETARD" && (niveau >= 2 || reste >= 100000)) return "HIGH";
  if (niveau >= 1 || reste > 0) return "MEDIUM";

  return "LOW";
}

function getRiskBadge(item: DossierItem) {
  const risk = getRiskLevel(item);

  if (risk === "HIGH") {
    return <Badge text="Priorité haute" kind="danger" />;
  }

  if (risk === "MEDIUM") {
    return <Badge text="Suivi actif" kind="warning" />;
  }

  return <Badge text="Suivi simple" kind="neutral" />;
}

function getRelanceBadge(niveau: number) {
  if (niveau >= 2) {
    return <Badge text={`Niveau ${niveau}`} kind="danger" />;
  }

  if (niveau === 1) {
    return <Badge text="Niveau 1" kind="warning" />;
  }

  return <Badge text="Niveau 0" kind="neutral" />;
}

function getStatutBadge(statut?: string | null) {
  switch (normalizeStatut(statut)) {
    case "REGULARISE":
      return <Badge text="Régularisé" kind="success" />;
    case "PAYE":
      return <Badge text="Payé" kind="success" />;
    case "PARTIELLEMENT_PAYE":
      return <Badge text="Partiellement payé" kind="warning" />;
    case "EN_RETARD":
      return <Badge text="En retard" kind="danger" />;
    default:
      return <Badge text="À payer" kind="info" />;
  }
}

function PageShell({ children }: { children: ReactNode }) {
  return <div style={pageShell}>{children}</div>;
}

function HeroHeader(props: {
  title: string;
  subtitle?: string;
  leftActions?: ReactNode;
  rightContent?: ReactNode;
}) {
  return (
    <section style={heroCard}>
      <div style={heroGlow} />
      <div style={heroGlowSecondary} />

      <div style={heroLayout}>
        <div style={heroMain}>
          <div style={pageEyebrow}>Relances · Pilotage des impayés</div>
          <div style={pageTitle}>{props.title}</div>
          {props.subtitle ? <div style={pageSubtitle}>{props.subtitle}</div> : null}

          {props.leftActions ? <div style={heroActionsLeft}>{props.leftActions}</div> : null}
        </div>

        {props.rightContent ? <div style={heroSide}>{props.rightContent}</div> : null}
      </div>
    </section>
  );
}

function HeroMiniCard(props: { label: string; value: string; hint?: string }) {
  return (
    <div style={heroMiniCard}>
      <div style={heroMiniLabel}>{props.label}</div>
      <div style={heroMiniValue}>{props.value}</div>
      {props.hint ? <div style={heroMiniHint}>{props.hint}</div> : null}
    </div>
  );
}

function Panel(props: { children: ReactNode; style?: CSSProperties }) {
  return (
    <section
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 24,
        background: "#ffffff",
        boxShadow: "0 18px 45px rgba(15, 23, 42, 0.05)",
        minWidth: 0,
        ...props.style,
      }}
    >
      {props.children}
    </section>
  );
}

function SmallButton(props: {
  children: ReactNode;
  onClick?: () => void;
  primary?: boolean;
  disabled?: boolean;
  warning?: boolean;
}) {
  const tone = props.primary
    ? {
        border: "1px solid #93c5fd",
        background: "#dbeafe",
        color: "#1e3a8a",
      }
    : props.warning
      ? {
          border: "1px solid #fcd34d",
          background: "#fffbeb",
          color: "#92400e",
        }
      : {
          border: "1px solid rgba(255,255,255,0.20)",
          background: "rgba(255,255,255,0.10)",
          color: "#ffffff",
        };

  return (
    <button
      type="button"
      onClick={props.onClick}
      disabled={props.disabled}
      style={{
        ...tone,
        borderRadius: 12,
        padding: "10px 14px",
        fontSize: 13,
        fontWeight: 800,
        cursor: props.disabled ? "not-allowed" : "pointer",
        whiteSpace: "nowrap",
        transition: "all 0.18s ease",
        opacity: props.disabled ? 0.65 : 1,
        boxShadow: props.primary ? "0 10px 24px rgba(37,99,235,0.16)" : "none",
        backdropFilter: props.primary ? undefined : "blur(8px)",
      }}
    >
      {props.children}
    </button>
  );
}

function FilterChip(props: {
  active?: boolean;
  children: ReactNode;
  onClick?: () => void;
  kind?: AccentKind;
}) {
  const tone = getTone(props.kind ?? (props.active ? "info" : "neutral"));

  return (
    <button
      type="button"
      onClick={props.onClick}
      style={{
        border: `1px solid ${tone.border}`,
        background: props.active ? tone.accentBg : "#ffffff",
        color: props.active ? tone.accentText : "#374151",
        borderRadius: 999,
        padding: "9px 12px",
        fontSize: 12,
        fontWeight: 800,
        cursor: "pointer",
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
        alignItems: "center",
        justifyContent: "center",
        padding: "5px 10px",
        borderRadius: 999,
        border: `1px solid ${styles.border}`,
        background: styles.background,
        color: styles.color,
        fontSize: 12,
        fontWeight: 800,
        whiteSpace: "nowrap",
      }}
    >
      {props.text}
    </span>
  );
}

function AlertBox(props: { kind: "error" | "info"; title: string; children: ReactNode }) {
  const tone =
    props.kind === "error"
      ? { bg: "#fef2f2", border: "#fecaca", text: "#991b1b" }
      : { bg: "#eff6ff", border: "#bfdbfe", text: "#1d4ed8" };

  return (
    <div
      style={{
        padding: 16,
        borderRadius: 18,
        background: tone.bg,
        border: `1px solid ${tone.border}`,
        color: tone.text,
      }}
    >
      <div style={{ fontWeight: 900, marginBottom: 6 }}>{props.title}</div>
      <div style={{ lineHeight: 1.55 }}>{props.children}</div>
    </div>
  );
}

function EmptyState(props: { title: string; text: string }) {
  return (
    <div
      style={{
        border: "1px dashed #d1d5db",
        borderRadius: 18,
        padding: 22,
        background: "#f8fafc",
      }}
    >
      <div style={{ fontSize: 15, fontWeight: 900, color: "#111827", marginBottom: 8 }}>
        {props.title}
      </div>
      <div style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.6 }}>{props.text}</div>
    </div>
  );
}

function KpiCard(props: { label: string; value: string; hint?: string; accent?: AccentKind }) {
  const tone = getTone(props.accent ?? "neutral");

  return (
    <div
      style={{
        border: `1px solid ${tone.border}`,
        borderRadius: 20,
        background: tone.softBg,
        padding: 16,
        minHeight: 116,
        boxShadow: "0 10px 24px rgba(15, 23, 42, 0.04)",
        minWidth: 0,
      }}
    >
      <div
        style={{
          fontSize: 12,
          fontWeight: 800,
          color: tone.text,
          textTransform: "uppercase",
          letterSpacing: 0.4,
        }}
      >
        {props.label}
      </div>

      <div
        style={{
          marginTop: 10,
          fontSize: 26,
          fontWeight: 900,
          color: tone.strongText,
          lineHeight: 1.12,
          letterSpacing: -0.3,
          overflowWrap: "anywhere",
        }}
      >
        {props.value}
      </div>

      {props.hint ? (
        <div style={{ marginTop: 8, fontSize: 12, color: tone.text, lineHeight: 1.5 }}>
          {props.hint}
        </div>
      ) : null}
    </div>
  );
}

function InfoStrip() {
  return (
    <div style={infoStrip}>
      <div style={infoStripText}>
        Cette vue met en avant les dossiers non soldés, le niveau de relance atteint, le reste à
        payer et la priorité de traitement afin d’orienter rapidement les actions de recouvrement.
      </div>
    </div>
  );
}

function SummaryCard(props: {
  title: string;
  value: string;
  hint?: string;
  accent?: AccentKind;
}) {
  const tone = getTone(props.accent ?? "neutral");

  return (
    <div
      style={{
        border: `1px solid ${tone.border}`,
        background: "#ffffff",
        borderRadius: 20,
        padding: 16,
        boxShadow: "0 12px 28px rgba(15, 23, 42, 0.04)",
        minWidth: 0,
      }}
    >
      <div
        style={{
          fontSize: 12,
          fontWeight: 800,
          textTransform: "uppercase",
          letterSpacing: 0.4,
          color: tone.text,
          marginBottom: 10,
        }}
      >
        {props.title}
      </div>

      <div
        style={{
          fontSize: 18,
          fontWeight: 900,
          color: tone.strongText,
          lineHeight: 1.35,
        }}
      >
        {props.value}
      </div>

      {props.hint ? (
        <div style={{ marginTop: 8, fontSize: 13, color: "#6b7280", lineHeight: 1.55 }}>
          {props.hint}
        </div>
      ) : null}
    </div>
  );
}

function ActionButton(props: { children: ReactNode; onClick?: () => void }) {
  return (
    <button type="button" onClick={props.onClick} style={actionButton}>
      {props.children}
    </button>
  );
}

export default function DossiersImpayesList() {
  const navigate = useNavigate();

  const [state, setState] = useState<LoadState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DossierItem[]>(EMPTY_DOSSIERS);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [riskFilter, setRiskFilter] = useState<RiskFilter>("ALL");

  const loadData = useCallback(async () => {
    setState("loading");
    setError(null);

    try {
      const rows = await relancesAPI.getDossiers();

      setData(extractArray<DossierItem>(rows));
      setState("success");
    } catch (e) {
      setState("error");
      setError(getErrorMessage(e, "Impossible de charger les dossiers impayés."));
      setData(EMPTY_DOSSIERS);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadData();
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [loadData]);

  const goToOverview = useCallback(() => {
    navigate("/relances");
  }, [navigate]);

  const goToHistorique = useCallback(() => {
    navigate("/relances/historique");
  }, [navigate]);

  const openDossier = useCallback(
    (id: number) => {
      navigate(`/relances/dossiers/${id}`);
    },
    [navigate],
  );

  const handleRefresh = useCallback(() => {
    void loadData();
  }, [loadData]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    return data.filter((d) => {
      const haystack = [
        d.lot_numero ?? "",
        d.coproprietaire_nom ?? "",
        d.appel_reference ?? "",
        d.reference_appel ?? "",
        d.statut ?? "",
        d.niveau_relance != null ? `niveau ${d.niveau_relance}` : "",
      ]
        .join(" ")
        .toLowerCase();

      const matchQuery = !q || haystack.includes(q);

      const statut = normalizeStatut(d.statut);
      const matchStatus =
        statusFilter === "ALL"
          ? true
          : statut === statusFilter ||
            (statusFilter === "REGULARISE" && Boolean(d.est_regularise));

      const risk = getRiskLevel(d);
      const matchRisk = riskFilter === "ALL" ? true : risk === riskFilter;

      return matchQuery && matchStatus && matchRisk;
    });
  }, [data, query, statusFilter, riskFilter]);

  const stats = useMemo(() => {
    const total = filtered.length;
    const totalReste = filtered.reduce((sum, item) => sum + toNumber(item.reste_a_payer), 0);
    const enRetard = filtered.filter((item) => normalizeStatut(item.statut) === "EN_RETARD").length;

    const regularises = filtered.filter(
      (item) => item.est_regularise || normalizeStatut(item.statut) === "REGULARISE",
    ).length;

    const niveauEleve = filtered.filter((item) => Number(item.niveau_relance ?? 0) >= 2).length;

    const partiels = filtered.filter(
      (item) => normalizeStatut(item.statut) === "PARTIELLEMENT_PAYE",
    ).length;

    return {
      total,
      totalReste,
      enRetard,
      regularises,
      niveauEleve,
      partiels,
    };
  }, [filtered]);

  const globalStats = useMemo(() => {
    const total = data.length;
    const totalReste = data.reduce((sum, item) => sum + toNumber(item.reste_a_payer), 0);
    const urgents = data.filter((item) => getRiskLevel(item) === "HIGH").length;

    return {
      total,
      totalReste,
      urgents,
    };
  }, [data]);

  const isLoading = state === "loading";
  const hasData = filtered.length > 0;

  return (
    <PageShell>
      <HeroHeader
        title="Dossiers impayés"
        subtitle="Identifiez les lots à suivre, priorisez les relances les plus sensibles et ouvrez rapidement chaque dossier pour poursuivre le traitement."
        leftActions={
          <>
            <SmallButton onClick={goToOverview}>Vue d’ensemble des relances</SmallButton>

            <SmallButton onClick={goToHistorique}>Historique des relances</SmallButton>

            <SmallButton onClick={handleRefresh} primary disabled={isLoading}>
              {isLoading ? "Chargement..." : "Actualiser"}
            </SmallButton>
          </>
        }
        rightContent={
          <div style={heroSideGrid}>
            <HeroMiniCard
              label="Dossiers suivis"
              value={String(globalStats.total)}
              hint="Volume global chargé"
            />
            <HeroMiniCard
              label="Encours restant"
              value={formatMoneyFCFA(globalStats.totalReste)}
              hint="Reste cumulé global"
            />
            <HeroMiniCard
              label="Priorité haute"
              value={String(globalStats.urgents)}
              hint="Dossiers à actionner vite"
            />
          </div>
        }
      />

      <InfoStrip />

      {state === "error" && error ? (
        <AlertBox kind="error" title="Chargement impossible">
          {error}
        </AlertBox>
      ) : null}

      <div className="relances-dossiers-kpi-grid" style={kpiGrid}>
        <KpiCard
          label="Dossiers affichés"
          value={String(stats.total)}
          hint="Nombre de dossiers visibles selon les filtres en cours."
          accent="neutral"
        />
        <KpiCard
          label="Reste à payer"
          value={formatMoneyFCFA(stats.totalReste)}
          hint="Montant cumulé restant sur les dossiers actuellement affichés."
          accent="danger"
        />
        <KpiCard
          label="En retard"
          value={String(stats.enRetard)}
          hint="Dossiers en retard de paiement dans cette vue."
          accent="warning"
        />
        <KpiCard
          label="Relance élevée"
          value={String(stats.niveauEleve)}
          hint="Dossiers ayant atteint un niveau de relance 2 ou plus."
          accent="info"
        />
      </div>

      <Panel style={{ padding: 18 }}>
        <div style={filtersHeader}>
          <div style={{ minWidth: 280, flex: 1 }}>
            <div style={fieldLabel}>Recherche</div>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher par lot, copropriétaire, appel, statut ou niveau de relance..."
              style={searchInput}
            />
          </div>

          <div style={filtersMeta}>
            <div style={filtersMetaValue}>
              {isLoading ? "Chargement..." : `${filtered.length} dossier(s) affiché(s)`}
            </div>
            <div style={filtersMetaHint}>
              {stats.regularises > 0
                ? `${stats.regularises} dossier(s) régularisé(s) dans la vue courante`
                : "Aucun dossier régularisé dans la vue courante"}
            </div>
          </div>
        </div>

        <div style={filterRow}>
          <div style={filterGroup}>
            <div style={fieldLabel}>Statut</div>

            <div style={chipWrap}>
              <FilterChip
                active={statusFilter === "ALL"}
                onClick={() => setStatusFilter("ALL")}
                kind="neutral"
              >
                Tous
              </FilterChip>

              <FilterChip
                active={statusFilter === "EN_RETARD"}
                onClick={() => setStatusFilter("EN_RETARD")}
                kind="danger"
              >
                En retard
              </FilterChip>

              <FilterChip
                active={statusFilter === "PARTIELLEMENT_PAYE"}
                onClick={() => setStatusFilter("PARTIELLEMENT_PAYE")}
                kind="warning"
              >
                Partiellement payés
              </FilterChip>

              <FilterChip
                active={statusFilter === "REGULARISE"}
                onClick={() => setStatusFilter("REGULARISE")}
                kind="success"
              >
                Régularisés
              </FilterChip>

              <FilterChip
                active={statusFilter === "PAYE"}
                onClick={() => setStatusFilter("PAYE")}
                kind="success"
              >
                Payés
              </FilterChip>
            </div>
          </div>

          <div style={filterGroup}>
            <div style={fieldLabel}>Priorité</div>

            <div style={chipWrap}>
              <FilterChip
                active={riskFilter === "ALL"}
                onClick={() => setRiskFilter("ALL")}
                kind="neutral"
              >
                Toutes
              </FilterChip>

              <FilterChip
                active={riskFilter === "HIGH"}
                onClick={() => setRiskFilter("HIGH")}
                kind="danger"
              >
                Haute
              </FilterChip>

              <FilterChip
                active={riskFilter === "MEDIUM"}
                onClick={() => setRiskFilter("MEDIUM")}
                kind="warning"
              >
                Suivi actif
              </FilterChip>

              <FilterChip
                active={riskFilter === "LOW"}
                onClick={() => setRiskFilter("LOW")}
                kind="info"
              >
                Faible
              </FilterChip>
            </div>
          </div>
        </div>
      </Panel>

      <Panel style={{ padding: 18 }}>
        <div style={sectionHeader}>
          <div>
            <div style={sectionEyebrow}>Lecture rapide</div>
            <div style={sectionTitle}>Synthèse métier de la vue courante</div>
          </div>
        </div>

        <div style={summaryGrid}>
          <SummaryCard
            title="Tension de recouvrement"
            value={stats.enRetard > 0 ? `${stats.enRetard} dossier(s) en retard` : "Situation maîtrisée"}
            hint={
              stats.enRetard > 0
                ? "Les dossiers en retard doivent rester prioritaires dans les relances."
                : "Aucun retard identifié sur la vue actuelle."
            }
            accent={stats.enRetard > 0 ? "warning" : "success"}
          />

          <SummaryCard
            title="Pression d’escalade"
            value={stats.niveauEleve > 0 ? `${stats.niveauEleve} dossier(s) niveau 2+` : "Escalade faible"}
            hint={
              stats.niveauEleve > 0
                ? "Ces dossiers nécessitent un suivi plus ferme ou une action immédiate."
                : "Aucun dossier à niveau de relance élevé."
            }
            accent={stats.niveauEleve > 0 ? "danger" : "info"}
          />

          <SummaryCard
            title="Paiements partiels"
            value={stats.partiels > 0 ? `${stats.partiels} dossier(s) partiels` : "Aucun paiement partiel"}
            hint="Les paiements partiels exigent souvent une relance ciblée jusqu’au solde complet."
            accent={stats.partiels > 0 ? "info" : "neutral"}
          />
        </div>
      </Panel>

      <Panel style={{ overflow: "hidden" }}>
        {isLoading ? (
          <div style={{ padding: 18, color: "#6b7280", fontSize: 14 }}>
            Chargement des dossiers impayés…
          </div>
        ) : !hasData ? (
          <div style={{ padding: 18 }}>
            <EmptyState
              title="Aucun dossier impayé à afficher"
              text="Aucun dossier ne remonte pour le moment ou aucun résultat ne correspond aux filtres actuellement appliqués."
            />
          </div>
        ) : (
          <div style={tableWrap}>
            <table style={tableStyle}>
              <thead>
                <tr style={{ textAlign: "left" }}>
                  <th style={th}>Lot</th>
                  <th style={th}>Copropriétaire</th>
                  <th style={th}>Appel</th>
                  <th style={th}>Échéance</th>
                  <th style={th}>Montant initial</th>
                  <th style={th}>Montant payé</th>
                  <th style={th}>Reste à payer</th>
                  <th style={th}>Statut</th>
                  <th style={th}>Relances</th>
                  <th style={th}>Priorité</th>
                  <th style={th}>Action</th>
                </tr>
              </thead>

              <tbody>
                {filtered.map((d) => {
                  const niveau = Number(d.niveau_relance ?? 0);
                  const count = Number(d.relances_count ?? 0);

                  return (
                    <tr key={d.id} style={{ background: "#ffffff" }}>
                      <td style={tdStrong}>{d.lot_numero || "—"}</td>
                      <td style={td}>{d.coproprietaire_nom || "—"}</td>
                      <td style={td}>{d.appel_reference || d.reference_appel || "—"}</td>
                      <td style={td}>{formatDateShort(d.date_echeance)}</td>
                      <td style={td}>{formatMoneyFCFA(d.montant_initial)}</td>
                      <td style={td}>{formatMoneyFCFA(d.montant_paye)}</td>
                      <td style={{ ...tdStrong, color: "#991b1b" }}>
                        {formatMoneyFCFA(d.reste_a_payer)}
                      </td>

                      <td style={td}>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          {getStatutBadge(d.statut)}
                          {d.est_regularise && normalizeStatut(d.statut) !== "REGULARISE" ? (
                            <Badge text="Régularisé" kind="success" />
                          ) : null}
                        </div>

                        <div style={{ marginTop: 6, fontSize: 12, color: "#6b7280" }}>
                          {getStatutLabel(d.statut)}
                        </div>
                      </td>

                      <td style={td}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          {getRelanceBadge(niveau)}
                          <span style={{ fontSize: 12, color: "#6b7280" }}>
                            {count} relance(s)
                          </span>
                        </div>
                      </td>

                      <td style={td}>{getRiskBadge(d)}</td>

                      <td style={td}>
                        <ActionButton onClick={() => openDossier(d.id)}>Ouvrir le dossier</ActionButton>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <AlertBox kind="info" title="Lecture métier">
        Cette vue aide à repérer les dossiers non soldés, à isoler les cas les plus sensibles selon
        le niveau de relance et le reste à payer, puis à ouvrir rapidement le détail du dossier pour
        envoyer une relance ou générer un avis de régularisation.
      </AlertBox>
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
    "linear-gradient(135deg, rgba(15,23,42,0.98) 0%, rgba(30,41,59,0.96) 52%, rgba(37,99,235,0.88) 100%)",
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
  background: "radial-gradient(circle, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0) 72%)",
  pointerEvents: "none",
};

const heroGlowSecondary: CSSProperties = {
  position: "absolute",
  inset: "-60px auto auto -60px",
  width: 220,
  height: 220,
  borderRadius: "50%",
  background: "radial-gradient(circle, rgba(59,130,246,0.16) 0%, rgba(59,130,246,0) 72%)",
  pointerEvents: "none",
};

const heroLayout: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(360px, 1.3fr) minmax(280px, 0.9fr)",
  gap: 22,
  alignItems: "end",
  position: "relative",
  zIndex: 1,
  minWidth: 0,
};

const heroMain: CSSProperties = {
  minWidth: 0,
};

const heroSide: CSSProperties = {
  minWidth: 0,
};

const heroSideGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
  gap: 12,
  minWidth: 0,
};

const heroMiniCard: CSSProperties = {
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.08)",
  borderRadius: 18,
  padding: 14,
  backdropFilter: "blur(10px)",
  minWidth: 0,
};

const heroMiniLabel: CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  textTransform: "uppercase",
  letterSpacing: 0.5,
  color: "rgba(255,255,255,0.72)",
};

const heroMiniValue: CSSProperties = {
  marginTop: 8,
  fontSize: 22,
  fontWeight: 900,
  lineHeight: 1.1,
  color: "#ffffff",
  overflowWrap: "anywhere",
};

const heroMiniHint: CSSProperties = {
  marginTop: 6,
  fontSize: 12,
  lineHeight: 1.45,
  color: "rgba(255,255,255,0.76)",
};

const heroActionsLeft: CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
  alignItems: "center",
  marginTop: 18,
};

const pageEyebrow: CSSProperties = {
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: 0.9,
  textTransform: "uppercase",
  color: "rgba(255,255,255,0.72)",
  marginBottom: 6,
};

const pageTitle: CSSProperties = {
  fontSize: 30,
  fontWeight: 900,
  color: "#ffffff",
  lineHeight: 1.08,
  letterSpacing: -0.5,
};

const pageSubtitle: CSSProperties = {
  marginTop: 8,
  color: "rgba(255,255,255,0.84)",
  fontSize: 14,
  lineHeight: 1.6,
  maxWidth: 860,
};

const infoStrip: CSSProperties = {
  border: "1px solid #bfdbfe",
  background: "#eff6ff",
  borderRadius: 18,
  padding: "14px 16px",
};

const infoStripText: CSSProperties = {
  fontSize: 13,
  color: "#1d4ed8",
  lineHeight: 1.6,
  fontWeight: 600,
};

const filtersHeader: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 16,
  flexWrap: "wrap",
  alignItems: "flex-end",
  minWidth: 0,
};

const filtersMeta: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-end",
  gap: 6,
  minWidth: 210,
};

const filtersMetaValue: CSSProperties = {
  color: "#111827",
  fontSize: 13,
  fontWeight: 800,
};

const filtersMetaHint: CSSProperties = {
  color: "#6b7280",
  fontSize: 12,
  textAlign: "right",
};

const fieldLabel: CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  color: "#374151",
  marginBottom: 8,
  textTransform: "uppercase",
  letterSpacing: 0.3,
};

const filterRow: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
  gap: 16,
  marginTop: 16,
};

const filterGroup: CSSProperties = {
  minWidth: 0,
};

const chipWrap: CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
};

const searchInput: CSSProperties = {
  width: "100%",
  minWidth: 260,
  padding: "12px 14px",
  borderRadius: 14,
  border: "1px solid #e5e7eb",
  background: "#fff",
  color: "#111827",
  fontSize: 14,
  outline: "none",
  boxSizing: "border-box",
};

const sectionHeader: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "center",
  marginBottom: 14,
  flexWrap: "wrap",
};

const sectionEyebrow: CSSProperties = {
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: 0.8,
  textTransform: "uppercase",
  color: "#64748b",
  marginBottom: 6,
};

const sectionTitle: CSSProperties = {
  fontSize: 18,
  fontWeight: 900,
  color: "#0f172a",
  lineHeight: 1.2,
};

const summaryGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
  gap: 14,
};

const kpiGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 14,
};

const tableWrap: CSSProperties = {
  overflowX: "auto",
  background: "#fff",
  width: "100%",
  minWidth: 0,
};

const tableStyle: CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  minWidth: 1280,
};

const th: CSSProperties = {
  padding: "14px 12px",
  borderBottom: "1px solid #e5e7eb",
  whiteSpace: "nowrap",
  fontSize: 12,
  color: "#6b7280",
  background: "#f8fafc",
  fontWeight: 800,
  textTransform: "uppercase",
  letterSpacing: 0.3,
};

const td: CSSProperties = {
  padding: "14px 12px",
  borderBottom: "1px solid #f1f5f9",
  color: "#111827",
  fontSize: 14,
  verticalAlign: "middle",
};

const tdStrong: CSSProperties = {
  ...td,
  fontWeight: 800,
};

const actionButton: CSSProperties = {
  border: "1px solid #bfdbfe",
  background: "#eff6ff",
  color: "#1d4ed8",
  borderRadius: 12,
  padding: "10px 14px",
  fontSize: 13,
  fontWeight: 800,
  cursor: "pointer",
  whiteSpace: "nowrap",
};