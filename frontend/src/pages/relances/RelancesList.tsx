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
import { APP_TEXT } from "../../config/appText";

type LoadState = "idle" | "loading" | "success" | "error";
type AccentKind = "neutral" | "success" | "warning" | "danger" | "info";
type StatusFilter = "ALL" | "ENVOYEE" | "ANNULEE" | "BROUILLON";
type CanalFilter = "ALL" | "EMAIL" | "SMS" | "INTERNE" | "COURRIER" | "WHATSAPP";
type LevelFilter = "ALL" | "L0" | "L1" | "L2_PLUS";

type RelanceItem = {
  id: number;
  dossier?: number | null;
  lot_numero?: string | null;
  coproprietaire_nom?: string | null;
  appel_reference?: string | null;
  canal?: string | null;
  niveau?: number | null;
  statut?: string | null;
  objet?: string | null;
  message?: string | null;
  montant_du_message?: number | string | null;
  date_envoi?: string | null;
  envoye_par_username?: string | null;
  annulee_at?: string | null;
  motif_annulation?: string | null;
};

type ApiError = {
  response?: {
    data?: {
      detail?: string;
      message?: string;
      non_field_errors?: string[];
      [key: string]: unknown;
    };
  };
  message?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function extractRelanceItems(payload: unknown): RelanceItem[] {
  if (Array.isArray(payload)) return payload as RelanceItem[];

  if (isRecord(payload)) {
    if (Array.isArray(payload.results)) return payload.results as RelanceItem[];
    if (Array.isArray(payload.data)) return payload.data as RelanceItem[];
    if (Array.isArray(payload.items)) return payload.items as RelanceItem[];
  }

  return [];
}

function getErrorMessage(error: unknown, fallback: string): string {
  const err = error as ApiError;
  const data = err?.response?.data;

  if (data && typeof data === "object") {
    if (typeof data.detail === "string" && data.detail.trim()) return data.detail;
    if (typeof data.message === "string" && data.message.trim()) return data.message;

    if (Array.isArray(data.non_field_errors) && data.non_field_errors.length > 0) {
      return data.non_field_errors.join("\n");
    }

    try {
      const entries = Object.entries(data);

      if (entries.length > 0) {
        return entries
          .map(([key, value]) => {
            if (Array.isArray(value)) return `${key}: ${value.join(" / ")}`;
            if (typeof value === "string") return `${key}: ${value}`;
            return `${key}: ${JSON.stringify(value)}`;
          })
          .join("\n");
      }
    } catch {
      return err?.message || fallback;
    }
  }

  return err?.message || fallback;
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

function normalizeStatut(value?: string | null): string {
  return String(value ?? "").trim().toUpperCase();
}

function normalizeCanal(value?: string | null): string {
  return String(value ?? "").trim().toUpperCase();
}

function toNumber(value?: number | string | null): number {
  const n = Number(value ?? 0);

  return Number.isFinite(n) ? n : 0;
}

function formatDateTimeShort(iso?: string | null): string {
  if (!iso) return "—";

  const d = new Date(iso);

  if (Number.isNaN(d.getTime())) return iso;

  return `${d.toLocaleDateString("fr-FR")} ${d.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

function formatMoneyFCFA(amount?: number | string | null): string {
  if (amount == null || amount === "") return "—";

  const value = Number(amount);

  if (!Number.isFinite(value)) return String(amount);

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

function getRelanceBadge(statut?: string | null, annuleeAt?: string | null) {
  const normalized = normalizeStatut(statut);

  if (annuleeAt || normalized === "ANNULEE") {
    return <Badge text="Annulée" kind="danger" />;
  }

  switch (normalized) {
    case "ENVOYEE":
    case "ENVOYE":
      return <Badge text="Envoyée" kind="info" />;
    case "BROUILLON":
      return <Badge text="Brouillon" kind="warning" />;
    default:
      return <Badge text={statut || "—"} kind="neutral" />;
  }
}

function getCanalBadge(canal?: string | null) {
  const value = normalizeCanal(canal);

  switch (value) {
    case "EMAIL":
      return <Badge text="Email" kind="info" />;
    case "SMS":
      return <Badge text="SMS" kind="warning" />;
    case "INTERNE":
      return <Badge text="Interne" kind="neutral" />;
    case "COURRIER":
      return <Badge text="Courrier" kind="success" />;
    case "WHATSAPP":
      return <Badge text="WhatsApp" kind="info" />;
    default:
      return <Badge text={canal || "—"} kind="neutral" />;
  }
}

function getLevelBadge(level?: number | null) {
  const niveau = Number(level ?? 0);

  if (niveau >= 2) {
    return <Badge text={`Niveau ${niveau}`} kind="danger" />;
  }

  if (niveau === 1) {
    return <Badge text="Niveau 1" kind="warning" />;
  }

  return <Badge text="Niveau 0" kind="neutral" />;
}

function getPriority(item: RelanceItem): "HIGH" | "MEDIUM" | "LOW" {
  const niveau = Number(item.niveau ?? 0);
  const statut = normalizeStatut(item.statut);

  if (item.annulee_at || statut === "ANNULEE") return "LOW";
  if (niveau >= 2) return "HIGH";
  if (niveau === 1 || statut === "BROUILLON") return "MEDIUM";

  return "LOW";
}

function getPriorityBadge(item: RelanceItem) {
  const priority = getPriority(item);

  if (priority === "HIGH") return <Badge text="Priorité haute" kind="danger" />;
  if (priority === "MEDIUM") return <Badge text="Suivi actif" kind="warning" />;

  return <Badge text="Suivi simple" kind="neutral" />;
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
          <div style={pageEyebrow}>Relances · Historique</div>
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
        minWidth: 0,
      }}
    >
      <div style={{ fontWeight: 900, marginBottom: 6 }}>{props.title}</div>
      <div style={{ lineHeight: 1.55 }}>{props.children}</div>
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

function InfoStrip() {
  return (
    <div style={infoStrip}>
      <div style={infoStripText}>
        Cette vue permet de suivre dans le temps les relances envoyées, annulées ou en attente,
        ainsi que les niveaux, canaux utilisés et dossiers concernés.
      </div>
    </div>
  );
}

function ActionButton(props: { children: ReactNode; onClick?: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      disabled={props.disabled}
      style={{
        border: "1px solid #bfdbfe",
        background: "#eff6ff",
        color: "#1d4ed8",
        borderRadius: 12,
        padding: "10px 14px",
        fontSize: 13,
        fontWeight: 800,
        cursor: props.disabled ? "not-allowed" : "pointer",
        whiteSpace: "nowrap",
        opacity: props.disabled ? 0.6 : 1,
      }}
    >
      {props.children}
    </button>
  );
}

export default function RelancesList() {
  const navigate = useNavigate();

  const [state, setState] = useState<LoadState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<RelanceItem[]>([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [canalFilter, setCanalFilter] = useState<CanalFilter>("ALL");
  const [levelFilter, setLevelFilter] = useState<LevelFilter>("ALL");

  const loadData = useCallback(async () => {
    setState("loading");
    setError(null);

    try {
      const payload = await relancesAPI.getRelances();

      setData(extractRelanceItems(payload));
      setState("success");
    } catch (e: unknown) {
      setState("error");
      setError(getErrorMessage(e, "Impossible de charger l’historique des relances."));
      setData([]);
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

  const goToDossiers = useCallback(() => {
    navigate("/relances/dossiers");
  }, [navigate]);

  const goToAvis = useCallback(() => {
    navigate("/relances/avis");
  }, [navigate]);

  const handleRefresh = useCallback(() => {
    void loadData();
  }, [loadData]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    return data.filter((relance) => {
      const haystack = [
        relance.coproprietaire_nom ?? "",
        relance.lot_numero ?? "",
        relance.appel_reference ?? "",
        relance.canal ?? "",
        relance.objet ?? "",
        relance.message ?? "",
        relance.statut ?? "",
        relance.envoye_par_username ?? "",
      ]
        .join(" ")
        .toLowerCase();

      const matchQuery = !q || haystack.includes(q);

      const normalizedStatut = relance.annulee_at ? "ANNULEE" : normalizeStatut(relance.statut);

      const matchStatus =
        statusFilter === "ALL"
          ? true
          : statusFilter === "ENVOYEE"
            ? normalizedStatut === "ENVOYEE" || normalizedStatut === "ENVOYE"
            : normalizedStatut === statusFilter;

      const normalizedCanal = normalizeCanal(relance.canal);
      const matchCanal = canalFilter === "ALL" ? true : normalizedCanal === canalFilter;

      const niveau = Number(relance.niveau ?? 0);

      const matchLevel =
        levelFilter === "ALL"
          ? true
          : levelFilter === "L0"
            ? niveau === 0
            : levelFilter === "L1"
              ? niveau === 1
              : niveau >= 2;

      return matchQuery && matchStatus && matchCanal && matchLevel;
    });
  }, [data, query, statusFilter, canalFilter, levelFilter]);

  const stats = useMemo(() => {
    const total = filtered.length;

    const envoyees = filtered.filter((item) => {
      const statut = item.annulee_at ? "ANNULEE" : normalizeStatut(item.statut);

      return statut === "ENVOYEE" || statut === "ENVOYE";
    }).length;

    const annulees = filtered.filter(
      (item) => normalizeStatut(item.statut) === "ANNULEE" || Boolean(item.annulee_at),
    ).length;

    const totalMontant = filtered.reduce((sum, item) => sum + toNumber(item.montant_du_message), 0);
    const niveauEleve = filtered.filter((item) => Number(item.niveau ?? 0) >= 2).length;
    const brouillons = filtered.filter((item) => normalizeStatut(item.statut) === "BROUILLON").length;

    return {
      total,
      envoyees,
      annulees,
      totalMontant,
      niveauEleve,
      brouillons,
    };
  }, [filtered]);

  const globalStats = useMemo(() => {
    const total = data.length;
    const totalMontant = data.reduce((sum, item) => sum + toNumber(item.montant_du_message), 0);
    const urgentes = data.filter((item) => getPriority(item) === "HIGH").length;

    return {
      total,
      totalMontant,
      urgentes,
    };
  }, [data]);

  const isLoading = state === "loading";
  const hasData = filtered.length > 0;

  return (
    <PageShell>
      <HeroHeader
        title="Historique des relances"
        subtitle="Consultez les relances envoyées, contrôlez leur statut, leur canal, leur niveau et retrouvez rapidement le dossier concerné pour poursuivre le traitement."
        leftActions={
          <>
            <SmallButton onClick={goToOverview} primary={false}>
              Vue d’ensemble des relances
            </SmallButton>

            <SmallButton onClick={goToDossiers} primary={false}>
              Dossiers impayés
            </SmallButton>

            <SmallButton onClick={goToAvis} primary={false}>
              Avis de régularisation
            </SmallButton>

            <SmallButton onClick={handleRefresh} primary disabled={isLoading}>
              {isLoading ? APP_TEXT.common.loading : APP_TEXT.common.refresh}
            </SmallButton>
          </>
        }
        rightContent={
          <div style={heroSideGrid}>
            <HeroMiniCard
              label="Relances suivies"
              value={String(globalStats.total)}
              hint="Volume global chargé"
            />
            <HeroMiniCard
              label="Montant cumulé"
              value={formatMoneyFCFA(globalStats.totalMontant)}
              hint="Montant porté par l’historique"
            />
            <HeroMiniCard
              label="Niveau élevé"
              value={String(globalStats.urgentes)}
              hint="Relances à forte vigilance"
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

      <div className="relances-history-kpi-grid" style={kpiGrid}>
        <KpiCard
          label="Relances affichées"
          value={String(stats.total)}
          hint="Nombre de relances visibles selon les filtres en cours."
          accent="neutral"
        />
        <KpiCard
          label="Montant total"
          value={formatMoneyFCFA(stats.totalMontant)}
          hint="Montant cumulé porté par les relances visibles."
          accent="warning"
        />
        <KpiCard
          label="Envoyées"
          value={String(stats.envoyees)}
          hint="Relances envoyées et actives dans la vue actuelle."
          accent="info"
        />
        <KpiCard
          label="Annulées"
          value={String(stats.annulees)}
          hint="Relances annulées ou tracées comme annulées."
          accent="danger"
        />
      </div>

      <Panel style={{ padding: 18 }}>
        <div style={filtersHeader}>
          <div style={{ minWidth: 280, flex: 1 }}>
            <div style={fieldLabel}>Recherche</div>

            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher par copropriétaire, lot, appel, canal, objet, message ou émetteur..."
              style={searchInput}
            />
          </div>

          <div style={filtersMeta}>
            <div style={filtersMetaValue}>
              {isLoading ? APP_TEXT.common.loading : `${filtered.length} relance(s) affichée(s)`}
            </div>

            <div style={filtersMetaHint}>
              {stats.annulees > 0
                ? `${stats.annulees} relance(s) annulée(s) dans cette vue`
                : "Aucune relance annulée dans cette vue"}
            </div>
          </div>
        </div>

        <div style={filterRow}>
          <div style={filterGroup}>
            <div style={fieldLabel}>Statut</div>

            <div style={chipWrap}>
              <FilterChip active={statusFilter === "ALL"} onClick={() => setStatusFilter("ALL")} kind="neutral">
                Tous
              </FilterChip>

              <FilterChip active={statusFilter === "ENVOYEE"} onClick={() => setStatusFilter("ENVOYEE")} kind="info">
                Envoyées
              </FilterChip>

              <FilterChip active={statusFilter === "ANNULEE"} onClick={() => setStatusFilter("ANNULEE")} kind="danger">
                Annulées
              </FilterChip>

              <FilterChip active={statusFilter === "BROUILLON"} onClick={() => setStatusFilter("BROUILLON")} kind="warning">
                Brouillons
              </FilterChip>
            </div>
          </div>

          <div style={filterGroup}>
            <div style={fieldLabel}>Canal</div>

            <div style={chipWrap}>
              <FilterChip active={canalFilter === "ALL"} onClick={() => setCanalFilter("ALL")} kind="neutral">
                Tous
              </FilterChip>

              <FilterChip active={canalFilter === "EMAIL"} onClick={() => setCanalFilter("EMAIL")} kind="info">
                Email
              </FilterChip>

              <FilterChip active={canalFilter === "SMS"} onClick={() => setCanalFilter("SMS")} kind="warning">
                SMS
              </FilterChip>

              <FilterChip active={canalFilter === "INTERNE"} onClick={() => setCanalFilter("INTERNE")} kind="neutral">
                Interne
              </FilterChip>

              <FilterChip active={canalFilter === "COURRIER"} onClick={() => setCanalFilter("COURRIER")} kind="success">
                Courrier
              </FilterChip>

              <FilterChip active={canalFilter === "WHATSAPP"} onClick={() => setCanalFilter("WHATSAPP")} kind="info">
                WhatsApp
              </FilterChip>
            </div>
          </div>

          <div style={filterGroup}>
            <div style={fieldLabel}>Niveau</div>

            <div style={chipWrap}>
              <FilterChip active={levelFilter === "ALL"} onClick={() => setLevelFilter("ALL")} kind="neutral">
                Tous
              </FilterChip>

              <FilterChip active={levelFilter === "L0"} onClick={() => setLevelFilter("L0")} kind="neutral">
                Niveau 0
              </FilterChip>

              <FilterChip active={levelFilter === "L1"} onClick={() => setLevelFilter("L1")} kind="warning">
                Niveau 1
              </FilterChip>

              <FilterChip active={levelFilter === "L2_PLUS"} onClick={() => setLevelFilter("L2_PLUS")} kind="danger">
                Niveau 2+
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
            title="Flux actif"
            value={stats.envoyees > 0 ? `${stats.envoyees} relance(s) envoyée(s)` : "Aucune relance active"}
            hint={
              stats.envoyees > 0
                ? "Les relances envoyées matérialisent l’activité en cours de recouvrement."
                : "Aucune relance envoyée n’apparaît dans la vue actuelle."
            }
            accent={stats.envoyees > 0 ? "info" : "neutral"}
          />

          <SummaryCard
            title="Pression d’escalade"
            value={stats.niveauEleve > 0 ? `${stats.niveauEleve} relance(s) niveau 2+` : "Escalade faible"}
            hint={
              stats.niveauEleve > 0
                ? "Les niveaux élevés doivent être surveillés en priorité."
                : "Aucune relance de niveau élevé dans cette vue."
            }
            accent={stats.niveauEleve > 0 ? "danger" : "success"}
          />

          <SummaryCard
            title="Relances en attente"
            value={stats.brouillons > 0 ? `${stats.brouillons} brouillon(s)` : "Aucun brouillon"}
            hint="Les brouillons peuvent signaler des relances préparées mais non encore émises."
            accent={stats.brouillons > 0 ? "warning" : "neutral"}
          />
        </div>
      </Panel>

      <Panel style={{ overflow: "hidden" }}>
        {isLoading ? (
          <div style={{ padding: 18, color: "#6b7280", fontSize: 14 }}>
            Chargement des relances…
          </div>
        ) : !hasData ? (
          <div style={{ padding: 18 }}>
            <EmptyState
              title="Aucune relance trouvée"
              text="Aucune relance ne remonte pour le moment ou aucune ne correspond aux filtres actuellement appliqués."
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
                  <th style={th}>Canal</th>
                  <th style={th}>Niveau</th>
                  <th style={th}>Objet</th>
                  <th style={th}>Montant</th>
                  <th style={th}>Date d’envoi</th>
                  <th style={th}>État</th>
                  <th style={th}>Priorité</th>
                  <th style={th}>Action</th>
                </tr>
              </thead>

              <tbody>
                {filtered.map((relance) => (
                  <tr key={relance.id} style={{ background: "#ffffff" }}>
                    <td style={tdStrong}>{relance.lot_numero || "—"}</td>
                    <td style={td}>{relance.coproprietaire_nom || "—"}</td>
                    <td style={td}>{relance.appel_reference || "—"}</td>

                    <td style={td}>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {getCanalBadge(relance.canal)}
                      </div>
                    </td>

                    <td style={td}>{getLevelBadge(relance.niveau)}</td>

                    <td style={td}>
                      <div style={{ display: "grid", gap: 4, minWidth: 0 }}>
                        <div style={{ fontWeight: 800, color: "#111827" }}>
                          {relance.objet || "Sans objet"}
                        </div>

                        {relance.message ? (
                          <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.45 }}>
                            {relance.message.length > 90
                              ? `${relance.message.slice(0, 89)}…`
                              : relance.message}
                          </div>
                        ) : null}
                      </div>
                    </td>

                    <td style={tdStrong}>{formatMoneyFCFA(relance.montant_du_message)}</td>
                    <td style={td}>{formatDateTimeShort(relance.date_envoi)}</td>

                    <td style={td}>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {getRelanceBadge(relance.statut, relance.annulee_at)}
                        {relance.annulee_at ? <Badge text="Annulation tracée" kind="danger" /> : null}
                      </div>

                      {relance.envoye_par_username || relance.motif_annulation ? (
                        <div style={{ marginTop: 6, fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>
                          {relance.envoye_par_username ? `Par ${relance.envoye_par_username}` : null}
                          {relance.envoye_par_username && relance.motif_annulation ? " • " : null}
                          {relance.motif_annulation ? `Motif : ${relance.motif_annulation}` : null}
                        </div>
                      ) : null}
                    </td>

                    <td style={td}>{getPriorityBadge(relance)}</td>

                    <td style={td}>
                      <ActionButton
                        onClick={() => {
                          if (relance.dossier) navigate(`/relances/dossiers/${relance.dossier}`);
                        }}
                        disabled={!relance.dossier}
                      >
                        {relance.dossier ? "Ouvrir le dossier" : "Dossier indisponible"}
                      </ActionButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <AlertBox kind="info" title="Lecture métier">
        Cette vue permet de suivre l’activité de relance dans le temps, de contrôler les relances
        envoyées ou annulées, d’identifier les niveaux les plus sensibles et de retrouver rapidement
        le dossier concerné pour poursuivre le traitement.
      </AlertBox>
    </PageShell>
  );
}

const pageShell: CSSProperties = {
  display: "grid",
  gap: 18,
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
  background:
    "radial-gradient(circle, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0) 72%)",
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

const kpiGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 14,
  minWidth: 0,
};

const infoStrip: CSSProperties = {
  border: "1px solid #bfdbfe",
  background: "#eff6ff",
  borderRadius: 18,
  padding: "14px 16px",
  minWidth: 0,
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
  minWidth: 0,
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
  minWidth: 0,
};

const tableWrap: CSSProperties = {
  overflowX: "auto",
  background: "#fff",
  minWidth: 0,
};

const tableStyle: CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  minWidth: 1560,
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

const emptyState: CSSProperties = {
  border: "1px dashed #d1d5db",
  borderRadius: 18,
  padding: 22,
  background: "#f8fafc",
  minWidth: 0,
};

const emptyStateTitle: CSSProperties = {
  fontSize: 15,
  fontWeight: 900,
  color: "#111827",
  marginBottom: 8,
};

const emptyStateText: CSSProperties = {
  fontSize: 13,
  color: "#6b7280",
  lineHeight: 1.6,
};