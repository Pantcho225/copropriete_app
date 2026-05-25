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
type StatusFilter = "ALL" | "GENERE" | "ENVOYE" | "ECHEC" | "ANNULE";
type CanalFilter = "ALL" | "EMAIL" | "SMS" | "INTERNE" | "WHATSAPP" | "COURRIER";
type DocumentFilter = "ALL" | "WITH_PDF" | "WITHOUT_PDF";

type AvisItem = {
  id: number;
  dossier?: number | null;
  lot_numero?: string | null;
  coproprietaire_nom?: string | null;
  appel_reference?: string | null;
  montant_initial?: number | string | null;
  montant_total_regle?: number | string | null;
  date_regularisation?: string | null;
  canal?: string | null;
  statut?: string | null;
  message?: string | null;
  genere_par_username?: string | null;
  envoye_at?: string | null;
  motif_echec?: string | null;
  document_pdf?: string | null;
};

const CANAL_LABELS: Record<string, string> = {
  INTERNE: "Interne",
  EMAIL: "Email",
  SMS: "SMS",
  WHATSAPP: "WhatsApp",
  COURRIER: "Courrier",
};

const EMPTY_AVIS: AvisItem[] = [];

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

function normalizeCanal(value?: string | null): string {
  return String(value ?? "").trim().toUpperCase();
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

function getCanalLabel(canal?: string | null): string {
  const key = normalizeCanal(canal);

  return CANAL_LABELS[key] || canal || "—";
}

function getCanalBadge(canal?: string | null) {
  const key = normalizeCanal(canal);

  switch (key) {
    case "EMAIL":
      return <Badge text="Email" kind="info" />;
    case "SMS":
      return <Badge text="SMS" kind="warning" />;
    case "WHATSAPP":
      return <Badge text="WhatsApp" kind="success" />;
    case "COURRIER":
      return <Badge text="Courrier" kind="neutral" />;
    case "INTERNE":
      return <Badge text="Interne" kind="neutral" />;
    default:
      return <Badge text={getCanalLabel(canal)} kind="neutral" />;
  }
}

function getAvisBadge(statut?: string | null) {
  switch (normalizeStatut(statut)) {
    case "ECHEC":
      return <Badge text="Échec" kind="danger" />;
    case "ENVOYE":
      return <Badge text="Envoyé" kind="info" />;
    case "GENERE":
      return <Badge text="Généré" kind="success" />;
    case "ANNULE":
      return <Badge text="Annulé" kind="danger" />;
    default:
      return <Badge text={statut || "—"} kind="neutral" />;
  }
}

function getDeliveryState(item: AvisItem): "HIGH" | "MEDIUM" | "LOW" {
  const statut = normalizeStatut(item.statut);

  if (statut === "ECHEC" || Boolean(item.motif_echec)) return "HIGH";
  if (statut === "ENVOYE" || Boolean(item.envoye_at)) return "LOW";

  return "MEDIUM";
}

function getDeliveryBadge(item: AvisItem) {
  const state = getDeliveryState(item);

  if (state === "HIGH") return <Badge text="Suivi critique" kind="danger" />;
  if (state === "MEDIUM") return <Badge text="Suivi actif" kind="warning" />;

  return <Badge text="Traçabilité OK" kind="success" />;
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
          <div style={pageEyebrow}>Relances · Avis de régularisation</div>
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
  success?: boolean;
}) {
  const tone = props.primary
    ? {
        border: "1px solid #93c5fd",
        background: "#dbeafe",
        color: "#1e3a8a",
      }
    : props.success
      ? {
          border: "1px solid #86efac",
          background: "#ecfdf5",
          color: "#166534",
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
        Cette vue permet de contrôler les avis émis après régularisation, leur état d’envoi, le
        canal utilisé, la présence du document PDF et le montant effectivement réglé.
      </div>
    </div>
  );
}

function ActionButton(props: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  success?: boolean;
}) {
  const tone = props.success
    ? {
        border: "1px solid #a7f3d0",
        background: "#ecfdf5",
        color: "#065f46",
      }
    : {
        border: "1px solid #bfdbfe",
        background: "#eff6ff",
        color: "#1d4ed8",
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
        opacity: props.disabled ? 0.6 : 1,
      }}
    >
      {props.children}
    </button>
  );
}

export default function AvisRegularisationList() {
  const navigate = useNavigate();

  const [state, setState] = useState<LoadState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AvisItem[]>(EMPTY_AVIS);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [canalFilter, setCanalFilter] = useState<CanalFilter>("ALL");
  const [documentFilter, setDocumentFilter] = useState<DocumentFilter>("ALL");

  const loadData = useCallback(async () => {
    setState("loading");
    setError(null);

    try {
      const payload = await relancesAPI.getAvis();

      setData(extractArray<AvisItem>(payload));
      setState("success");
    } catch (e) {
      setState("error");
      setError(getErrorMessage(e, "Impossible de charger les avis de régularisation."));
      setData(EMPTY_AVIS);
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

  const goToHistorique = useCallback(() => {
    navigate("/relances/historique");
  }, [navigate]);

  const openDossier = useCallback(
    (dossierId: number) => {
      navigate(`/relances/dossiers/${dossierId}`);
    },
    [navigate],
  );

  const openPdf = useCallback((pdfUrl: string) => {
    window.open(pdfUrl, "_blank", "noopener,noreferrer");
  }, []);

  const handleRefresh = useCallback(() => {
    void loadData();
  }, [loadData]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    return data.filter((a) => {
      const haystack = [
        a.coproprietaire_nom ?? "",
        a.lot_numero ?? "",
        a.appel_reference ?? "",
        a.canal ?? "",
        a.statut ?? "",
        a.message ?? "",
        a.genere_par_username ?? "",
        a.motif_echec ?? "",
      ]
        .join(" ")
        .toLowerCase();

      const matchQuery = !q || haystack.includes(q);

      const statut = normalizeStatut(a.statut);
      const matchStatus = statusFilter === "ALL" ? true : statut === statusFilter;

      const canal = normalizeCanal(a.canal);
      const matchCanal = canalFilter === "ALL" ? true : canal === canalFilter;

      const hasPdf = Boolean(a.document_pdf);
      const matchDocument =
        documentFilter === "ALL"
          ? true
          : documentFilter === "WITH_PDF"
            ? hasPdf
            : !hasPdf;

      return matchQuery && matchStatus && matchCanal && matchDocument;
    });
  }, [data, query, statusFilter, canalFilter, documentFilter]);

  const stats = useMemo(() => {
    const total = filtered.length;
    const totalRegle = filtered.reduce((sum, item) => sum + toNumber(item.montant_total_regle), 0);
    const envoyes = filtered.filter(
      (item) => normalizeStatut(item.statut) === "ENVOYE" || Boolean(item.envoye_at),
    ).length;
    const generes = filtered.filter((item) => normalizeStatut(item.statut) === "GENERE").length;
    const echecs = filtered.filter(
      (item) => normalizeStatut(item.statut) === "ECHEC" || Boolean(item.motif_echec),
    ).length;
    const avecPdf = filtered.filter((item) => Boolean(item.document_pdf)).length;

    return {
      total,
      totalRegle,
      envoyes,
      generes,
      echecs,
      avecPdf,
    };
  }, [filtered]);

  const globalStats = useMemo(() => {
    const total = data.length;
    const totalRegle = data.reduce((sum, item) => sum + toNumber(item.montant_total_regle), 0);
    const echecs = data.filter(
      (item) => normalizeStatut(item.statut) === "ECHEC" || Boolean(item.motif_echec),
    ).length;

    return {
      total,
      totalRegle,
      echecs,
    };
  }, [data]);

  const isLoading = state === "loading";
  const hasData = filtered.length > 0;

  return (
    <PageShell>
      <HeroHeader
        title="Avis de régularisation"
        subtitle="Consultez les avis générés après régularisation d’un dossier, contrôlez leur statut, leur canal d’émission, leur document associé et retrouvez rapidement le dossier concerné."
        leftActions={
          <>
            <SmallButton onClick={goToOverview}>Vue d’ensemble des relances</SmallButton>

            <SmallButton onClick={goToDossiers}>Dossiers impayés</SmallButton>

            <SmallButton onClick={goToHistorique}>Historique des relances</SmallButton>

            <SmallButton onClick={handleRefresh} primary disabled={isLoading}>
              {isLoading ? "Chargement..." : "Actualiser"}
            </SmallButton>
          </>
        }
        rightContent={
          <div style={heroSideGrid}>
            <HeroMiniCard
              label="Avis suivis"
              value={String(globalStats.total)}
              hint="Volume global chargé"
            />
            <HeroMiniCard
              label="Montant régularisé"
              value={formatMoneyFCFA(globalStats.totalRegle)}
              hint="Montant cumulé réglé"
            />
            <HeroMiniCard
              label="Échecs"
              value={String(globalStats.echecs)}
              hint="Avis à surveiller"
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

      <div className="avis-regularisation-kpi-grid" style={kpiGrid}>
        <KpiCard
          label="Avis affichés"
          value={String(stats.total)}
          hint="Nombre d’avis visibles selon les filtres en cours."
          accent="neutral"
        />
        <KpiCard
          label="Montant régularisé"
          value={formatMoneyFCFA(stats.totalRegle)}
          hint="Montant cumulé réglé sur les avis affichés."
          accent="success"
        />
        <KpiCard
          label="Envoyés"
          value={String(stats.envoyes)}
          hint="Avis déjà envoyés ou dont l’envoi est tracé."
          accent="info"
        />
        <KpiCard
          label="Échecs"
          value={String(stats.echecs)}
          hint="Avis en échec ou comportant un motif d’échec enregistré."
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
              placeholder="Rechercher par copropriétaire, lot, appel, canal, statut, message, émetteur ou motif d’échec..."
              style={searchInput}
            />
          </div>

          <div style={filtersMeta}>
            <div style={filtersMetaValue}>
              {isLoading ? "Chargement..." : `${filtered.length} avis affiché(s)`}
            </div>

            <div style={filtersMetaHint}>
              {stats.avecPdf > 0
                ? `${stats.avecPdf} avis avec document PDF dans cette vue`
                : "Aucun document PDF dans cette vue"}
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

              <FilterChip active={statusFilter === "GENERE"} onClick={() => setStatusFilter("GENERE")} kind="success">
                Générés
              </FilterChip>

              <FilterChip active={statusFilter === "ENVOYE"} onClick={() => setStatusFilter("ENVOYE")} kind="info">
                Envoyés
              </FilterChip>

              <FilterChip active={statusFilter === "ECHEC"} onClick={() => setStatusFilter("ECHEC")} kind="danger">
                Échecs
              </FilterChip>

              <FilterChip active={statusFilter === "ANNULE"} onClick={() => setStatusFilter("ANNULE")} kind="warning">
                Annulés
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

              <FilterChip active={canalFilter === "WHATSAPP"} onClick={() => setCanalFilter("WHATSAPP")} kind="success">
                WhatsApp
              </FilterChip>

              <FilterChip active={canalFilter === "COURRIER"} onClick={() => setCanalFilter("COURRIER")} kind="neutral">
                Courrier
              </FilterChip>
            </div>
          </div>

          <div style={filterGroup}>
            <div style={fieldLabel}>Document</div>

            <div style={chipWrap}>
              <FilterChip
                active={documentFilter === "ALL"}
                onClick={() => setDocumentFilter("ALL")}
                kind="neutral"
              >
                Tous
              </FilterChip>

              <FilterChip
                active={documentFilter === "WITH_PDF"}
                onClick={() => setDocumentFilter("WITH_PDF")}
                kind="success"
              >
                Avec PDF
              </FilterChip>

              <FilterChip
                active={documentFilter === "WITHOUT_PDF"}
                onClick={() => setDocumentFilter("WITHOUT_PDF")}
                kind="warning"
              >
                Sans PDF
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
            title="Traçabilité d’envoi"
            value={stats.envoyes > 0 ? `${stats.envoyes} avis envoyés` : "Aucun envoi tracé"}
            hint={
              stats.envoyes > 0
                ? "Les avis envoyés confirment la fin du flux de notification après régularisation."
                : "Aucun avis envoyé n’apparaît dans la vue actuelle."
            }
            accent={stats.envoyes > 0 ? "info" : "neutral"}
          />

          <SummaryCard
            title="Documents disponibles"
            value={stats.avecPdf > 0 ? `${stats.avecPdf} document(s) PDF` : "Aucun PDF"}
            hint="Le document PDF facilite la consultation et la preuve de notification."
            accent={stats.avecPdf > 0 ? "success" : "warning"}
          />

          <SummaryCard
            title="Vigilance d’exécution"
            value={stats.echecs > 0 ? `${stats.echecs} avis en échec` : "Aucun échec détecté"}
            hint={
              stats.echecs > 0
                ? "Les avis en échec doivent être repris ou vérifiés rapidement."
                : "Aucun motif d’échec identifié dans la vue actuelle."
            }
            accent={stats.echecs > 0 ? "danger" : "success"}
          />
        </div>
      </Panel>

      <Panel style={{ overflow: "hidden" }}>
        {isLoading ? (
          <div style={{ padding: 18, color: "#6b7280", fontSize: 14 }}>
            Chargement des avis de régularisation…
          </div>
        ) : !hasData ? (
          <div style={{ padding: 18 }}>
            <EmptyState
              title="Aucun avis de régularisation"
              text="Aucun avis ne remonte pour le moment ou aucun résultat ne correspond aux filtres actuellement appliqués."
            />
          </div>
        ) : (
          <div style={tableWrap}>
            <table style={tableStyle}>
              <thead>
                <tr style={{ textAlign: "left" }}>
                  <th style={th}>Lot</th>
                  <th style={th}>Copropriétaire</th>
                  <th style={th}>Appel de fonds</th>
                  <th style={th}>Montant initial</th>
                  <th style={th}>Montant réglé</th>
                  <th style={th}>Date de régularisation</th>
                  <th style={th}>Canal</th>
                  <th style={th}>État</th>
                  <th style={th}>Suivi</th>
                  <th style={th}>Action</th>
                </tr>
              </thead>

              <tbody>
                {filtered.map((a) => (
                  <tr key={a.id} style={{ background: "#ffffff" }}>
                    <td style={tdStrong}>{a.lot_numero || "—"}</td>
                    <td style={td}>{a.coproprietaire_nom || "—"}</td>
                    <td style={td}>{a.appel_reference || "—"}</td>
                    <td style={td}>{formatMoneyFCFA(a.montant_initial)}</td>
                    <td style={{ ...tdStrong, color: "#166534" }}>
                      {formatMoneyFCFA(a.montant_total_regle)}
                    </td>
                    <td style={td}>{formatDateTimeShort(a.date_regularisation)}</td>

                    <td style={td}>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {getCanalBadge(a.canal)}
                      </div>
                    </td>

                    <td style={td}>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {getAvisBadge(a.statut)}
                        {a.envoye_at ? <Badge text="Envoi tracé" kind="info" /> : null}
                        {a.motif_echec ? <Badge text="Motif d’échec" kind="danger" /> : null}
                        {a.document_pdf ? <Badge text="PDF disponible" kind="success" /> : null}
                      </div>

                      {a.genere_par_username || a.motif_echec ? (
                        <div style={rowSubText}>
                          {a.genere_par_username ? `Généré par ${a.genere_par_username}` : null}
                          {a.genere_par_username && a.motif_echec ? " • " : null}
                          {a.motif_echec ? `Motif : ${a.motif_echec}` : null}
                        </div>
                      ) : null}
                    </td>

                    <td style={td}>{getDeliveryBadge(a)}</td>

                    <td style={td}>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {a.dossier ? (
                          <ActionButton onClick={() => openDossier(Number(a.dossier))}>
                            Ouvrir le dossier
                          </ActionButton>
                        ) : null}

                        {!a.dossier && a.document_pdf ? (
                          <ActionButton onClick={() => openPdf(a.document_pdf as string)} success>
                            Ouvrir le PDF
                          </ActionButton>
                        ) : null}

                        {!a.dossier && !a.document_pdf ? (
                          <span style={{ color: "#9ca3af", fontSize: 13 }}>—</span>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <AlertBox kind="info" title="Lecture métier">
        Cette vue permet de suivre les avis émis après régularisation d’un impayé, de vérifier le
        montant effectivement réglé, de contrôler l’état d’envoi, la présence du document et de
        retrouver rapidement le dossier ou le support concerné.
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
  maxWidth: 920,
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
  minWidth: 0,
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
  minWidth: 1620,
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

const rowSubText: CSSProperties = {
  marginTop: 6,
  fontSize: 12,
  color: "#6b7280",
  lineHeight: 1.5,
};

const emptyState: CSSProperties = {
  border: "1px dashed #d1d5db",
  borderRadius: 18,
  padding: 22,
  background: "#f8fafc",
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