import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import BackButton from "../../components/ui/BackButton";
import api from "../../api/axios";

type LoadState = "idle" | "loading" | "success" | "error";
type AGStatus = "BROUILLON" | "OUVERTE" | "CLOTUREE" | "ARCHIVEE";
type ResolutionStatus = "EN_ATTENTE" | "ADOPTEE" | "REJETEE";
type BadgeKind = "neutral" | "success" | "warning" | "info" | "danger";
type AccentKind = "neutral" | "success" | "warning" | "danger" | "info";

type AGItem = {
  id: number;
  statut: AGStatus;
  pv_genere?: boolean;
};

type ResolutionItem = {
  id: number;
  statut: ResolutionStatus;
};

type DRFPage<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

const AG_ENDPOINT_CANDIDATES = ["/api/ag/ags/", "/api/ag/ags"];
const RESOLUTION_ENDPOINT_CANDIDATES = ["/api/ag/resolutions/", "/api/ag/resolutions"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function isPaginatedResponse<T = unknown>(value: unknown): value is DRFPage<T> {
  return isRecord(value) && Array.isArray(value.results) && typeof value.count === "number";
}

function extractRows<T = unknown>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];

  if (isPaginatedResponse<T>(value)) return value.results;

  if (isRecord(value)) {
    const candidates = [value.results, value.items, value.data];
    for (const candidate of candidates) {
      if (Array.isArray(candidate)) return candidate as T[];
    }
  }

  return [];
}

function toNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
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

    if (
      ["false", "0", "non", "no", "non_genere", "non généré", "non genere", "indisponible"].includes(
        s,
      )
    ) {
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

function normalizeAGStatus(value: unknown): AGStatus {
  const s = String(value ?? "").trim().toUpperCase();

  if (["OUVERTE", "OPEN", "ACTIVE", "ACTIF", "EN_COURS"].includes(s)) return "OUVERTE";
  if (["CLOTUREE", "CLOTURE", "CLOSED", "TERMINEE", "TERMINÉE"].includes(s)) return "CLOTUREE";
  if (["ARCHIVEE", "ARCHIVÉE", "ARCHIVE", "ARCHIVED"].includes(s)) return "ARCHIVEE";
  return "BROUILLON";
}

function normalizeResolutionStatus(value: unknown): ResolutionStatus {
  const s = String(value ?? "").trim().toUpperCase();

  if (["ADOPTEE", "VALIDEE", "VALIDE", "APPROUVEE", "APPROUVÉE"].includes(s)) return "ADOPTEE";
  if (["REJETEE", "REJETE", "REFUSEE", "REFUSE", "REFUSÉE"].includes(s)) return "REJETEE";
  return "EN_ATTENTE";
}

function normalizeAGItem(raw: unknown, index: number): AGItem {
  const row = isRecord(raw) ? raw : {};

  const pvGenere =
    toBooleanOrNull(row.pv_genere) ??
    toBooleanOrNull(row.pv_archive) ??
    toBooleanOrNull(row.pv_disponible) ??
    (hasTruthyValue(row.pv_pdf) ? true : null) ??
    (hasTruthyValue(row.pv_pdf_url) ? true : null) ??
    (hasTruthyValue(row.pv_signed_pdf) ? true : null) ??
    (hasTruthyValue(row.pv_signed_pdf_url) ? true : null) ??
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

function normalizeResolutionItem(raw: unknown, index: number): ResolutionItem {
  const row = isRecord(raw) ? raw : {};

  return {
    id:
      toNumberOrNull(row.id) ??
      toNumberOrNull(row.resolution_id) ??
      toNumberOrNull(row.pk) ??
      index + 1,
    statut: normalizeResolutionStatus(row.resultat ?? row.statut ?? row.status ?? row.decision),
  };
}

function getErrorMessage(error: unknown, fallback: string) {
  const err = error as {
    response?: {
      data?: {
        detail?: string;
        message?: string;
      };
    };
    message?: string;
  };

  return err?.response?.data?.detail || err?.response?.data?.message || err?.message || fallback;
}

function formatCount(value: number, singular: string, plural?: string) {
  return `${value} ${value > 1 ? plural ?? `${singular}s` : singular}`;
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

function getStatusBadge(statut: AGStatus) {
  if (statut === "OUVERTE") return <Badge text="Ouverte" kind="info" />;
  if (statut === "CLOTUREE") return <Badge text="Clôturée" kind="success" />;
  if (statut === "ARCHIVEE") return <Badge text="Archivée" kind="neutral" />;
  return <Badge text="Brouillon" kind="warning" />;
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
          <div style={pageEyebrow}>Assemblées générales · Pilotage</div>
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

function SmallButton(props: {
  children: ReactNode;
  onClick?: () => void;
  primary?: boolean;
  disabled?: boolean;
}) {
  const tone = props.primary
    ? {
        border: "1px solid #93c5fd",
        background: "#dbeafe",
        color: "#1e3a8a",
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

function Panel(props: { children: ReactNode; style?: CSSProperties }) {
  return (
    <section
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 24,
        background: "#ffffff",
        boxShadow: "0 18px 45px rgba(15, 23, 42, 0.05)",
        ...props.style,
      }}
    >
      {props.children}
    </section>
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

function ActionTile(props: {
  title: string;
  text: string;
  actionLabel: string;
  onAction: () => void;
  disabled?: boolean;
  accent?: AccentKind;
}) {
  const tone = getTone(props.accent ?? "neutral");

  return (
    <div
      style={{
        border: `1px solid ${tone.border}`,
        background: tone.softBg,
        borderRadius: 20,
        padding: 16,
        display: "grid",
        gap: 12,
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 12,
          display: "grid",
          placeItems: "center",
          background: "#ffffff",
          border: `1px solid ${tone.border}`,
          color: tone.accentText,
          fontWeight: 900,
          fontSize: 16,
        }}
      >
        →
      </div>

      <div style={{ display: "grid", gap: 6 }}>
        <div style={{ fontSize: 15, fontWeight: 900, color: tone.strongText }}>{props.title}</div>
        <div style={{ fontSize: 13, lineHeight: 1.6, color: "#64748b" }}>{props.text}</div>
      </div>

      <button
        type="button"
        onClick={props.onAction}
        disabled={props.disabled}
        style={{
          minHeight: 40,
          borderRadius: 12,
          padding: "10px 14px",
          border: `1px solid ${props.disabled ? "#e5e7eb" : tone.border}`,
          background: props.disabled ? "#f3f4f6" : "#ffffff",
          color: props.disabled ? "#9ca3af" : tone.accentText,
          fontSize: 13,
          fontWeight: 800,
          cursor: props.disabled ? "not-allowed" : "pointer",
          justifySelf: "start",
          boxShadow: props.disabled ? "none" : "0 1px 2px rgba(15, 23, 42, 0.04)",
        }}
      >
        {props.actionLabel}
      </button>
    </div>
  );
}

function ProcessStep(props: {
  step: number;
  title: string;
  text: string;
  accent?: AccentKind;
}) {
  const tone = getTone(props.accent ?? "neutral");

  return (
    <div
      style={{
        border: `1px solid ${tone.border}`,
        background: tone.softBg,
        borderRadius: 18,
        padding: 16,
        display: "grid",
        gap: 12,
      }}
    >
      <div
        style={{
          width: 34,
          height: 34,
          borderRadius: 999,
          display: "grid",
          placeItems: "center",
          background: tone.accentBg,
          color: tone.accentText,
          fontSize: 13,
          fontWeight: 900,
        }}
      >
        {props.step}
      </div>

      <div style={{ display: "grid", gap: 6 }}>
        <div style={{ fontSize: 15, fontWeight: 900, color: "#0f172a" }}>{props.title}</div>
        <div style={{ fontSize: 13, lineHeight: 1.6, color: "#64748b" }}>{props.text}</div>
      </div>
    </div>
  );
}

function Badge(props: { text: string; kind?: BadgeKind }) {
  const styles =
    props.kind === "success"
      ? { background: "#ecfdf5", border: "#a7f3d0", color: "#065f46" }
      : props.kind === "warning"
        ? { background: "#fffbeb", border: "#fde68a", color: "#92400e" }
        : props.kind === "info"
          ? { background: "#eff6ff", border: "#bfdbfe", color: "#1d4ed8" }
          : props.kind === "danger"
            ? { background: "#fef2f2", border: "#fecaca", color: "#991b1b" }
            : { background: "#f8fafc", border: "#e2e8f0", color: "#475569" };

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "5px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 800,
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

function AlertBox(props: { kind: "error" | "info"; title: string; children: ReactNode }) {
  const tone =
    props.kind === "error"
      ? {
          bg: "#fef2f2",
          border: "#fecaca",
          title: "#991b1b",
          text: "#b91c1c",
        }
      : {
          bg: "#eff6ff",
          border: "#bfdbfe",
          title: "#1d4ed8",
          text: "#2563eb",
        };

  return (
    <div
      style={{
        padding: 16,
        borderRadius: 18,
        background: tone.bg,
        border: `1px solid ${tone.border}`,
        display: "grid",
        gap: 6,
      }}
    >
      <div style={{ fontSize: 14, fontWeight: 900, color: tone.title }}>{props.title}</div>
      <div style={{ fontSize: 13, lineHeight: 1.6, color: tone.text }}>{props.children}</div>
    </div>
  );
}

export default function AGHome() {
  const navigate = useNavigate();

  const [state, setState] = useState<LoadState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [ags, setAgs] = useState<AGItem[]>([]);
  const [resolutions, setResolutions] = useState<ResolutionItem[]>([]);

  async function loadData() {
    setState("loading");
    setError(null);

    let agRows: AGItem[] = [];
    let resolutionRows: ResolutionItem[] = [];
    let lastError: unknown = null;

    for (const endpoint of AG_ENDPOINT_CANDIDATES) {
      try {
        const res = await api.get(endpoint);
        agRows = extractRows<Record<string, unknown>>(res?.data)
          .map(normalizeAGItem)
          .filter((item) => item.id > 0);
        break;
      } catch (e) {
        lastError = e;
      }
    }

    for (const endpoint of RESOLUTION_ENDPOINT_CANDIDATES) {
      try {
        const res = await api.get(endpoint);
        resolutionRows = extractRows<Record<string, unknown>>(res?.data)
          .map(normalizeResolutionItem)
          .filter((item) => item.id > 0);
        break;
      } catch (e) {
        lastError = e;
      }
    }

    setAgs(agRows);
    setResolutions(resolutionRows);

    if (agRows.length === 0 && resolutionRows.length === 0 && lastError) {
      setState("error");
      setError(getErrorMessage(lastError, "Impossible de charger les indicateurs du module AG."));
      return;
    }

    setState("success");
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData();
  }, []);

  const stats = useMemo(() => {
    const pvGeneres = ags.filter((x) => x.pv_genere).length;
    const assembleesOuvertes = ags.filter((x) => x.statut === "OUVERTE").length;
    const assembleesBrouillon = ags.filter((x) => x.statut === "BROUILLON").length;
    const assembleesCloturees = ags.filter((x) => x.statut === "CLOTUREE").length;
    const assembleesArchivees = ags.filter((x) => x.statut === "ARCHIVEE").length;
    const assembleesASuivre = ags.filter((x) => x.statut === "BROUILLON" || x.statut === "OUVERTE").length;

    const resolutionsEnAttente = resolutions.filter((x) => x.statut === "EN_ATTENTE").length;
    const resolutionsAdoptees = resolutions.filter((x) => x.statut === "ADOPTEE").length;
    const resolutionsRejetees = resolutions.filter((x) => x.statut === "REJETEE").length;

    const firstAg = ags.length > 0 ? ags[0] : null;
    const firstOpenAg = ags.find((x) => x.statut === "OUVERTE") ?? firstAg ?? null;
    const dominantStatus =
      ags.find((x) => x.statut === "OUVERTE")?.statut ??
      ags.find((x) => x.statut === "BROUILLON")?.statut ??
      ags[0]?.statut ??
      null;

    return {
      agTotal: ags.length,
      resolutionsTotal: resolutions.length,
      pvGeneres,
      assembleesOuvertes,
      assembleesBrouillon,
      assembleesCloturees,
      assembleesArchivees,
      assembleesASuivre,
      resolutionsEnAttente,
      resolutionsAdoptees,
      resolutionsRejetees,
      firstAgId: firstAg?.id ?? null,
      firstOpenAgId: firstOpenAg?.id ?? null,
      dominantStatus,
    };
  }, [ags, resolutions]);

  const hasAnyAg = stats.firstAgId !== null;

  const healthBadge: { text: string; kind: BadgeKind } = useMemo(() => {
    if (stats.assembleesOuvertes > 0) return { text: "Cycle AG actif", kind: "info" };
    if (stats.assembleesASuivre > 0) return { text: "Assemblées à suivre", kind: "warning" };
    if (stats.agTotal > 0) return { text: "Module structuré", kind: "success" };
    return { text: "Module à initialiser", kind: "neutral" };
  }, [stats]);

  const summarySentence = useMemo(() => {
    if (stats.agTotal === 0) {
      return "Aucune assemblée n’est encore disponible. Vous pouvez créer une première assemblée pour démarrer le cycle AG et enclencher ensuite résolutions, présences, votes et procès-verbal.";
    }

    return `Le module contient actuellement ${formatCount(stats.agTotal, "assemblée")}, ${formatCount(
      stats.resolutionsTotal,
      "résolution",
    )}, ${formatCount(stats.resolutionsAdoptees, "résolution adoptée")} et ${formatCount(
      stats.pvGeneres,
      "procès-verbal généré",
    )}.`;
  }, [stats]);

  const heroStatusText = useMemo(() => {
    if (stats.agTotal === 0) return "Aucune assemblée détectée";
    if (stats.assembleesOuvertes > 0) return `${stats.assembleesOuvertes} assemblée(s) ouverte(s)`;
    if (stats.assembleesASuivre > 0) return `${stats.assembleesASuivre} assemblée(s) à suivre`;
    return `${stats.agTotal} assemblée(s) structurée(s)`;
  }, [stats]);

  return (
    <PageShell>
      <div style={headerRow}>
        <div style={{ display: "grid", gap: 8 }}>
          <div className="pageBackRow">
            <BackButton to="/dashboard" label="Retour au tableau de bord" />
          </div>

          <span style={sectionEyebrow}>Pilotage du module AG</span>
          <h1 style={headerTitle}>Assemblées générales</h1>
          <p style={headerSubtitle}>
            Pilotez la préparation des assemblées, le suivi des résolutions, les présences, les
            votes et la production des procès-verbaux depuis une vue d’ensemble plus crédible,
            mieux hiérarchisée et plus cohérente avec le reste du produit.
          </p>
        </div>

        <div>
          <Badge text={healthBadge.text} kind={healthBadge.kind} />
        </div>
      </div>

      <HeroHeader
        title="Un cockpit métier plus clair pour vos cycles AG"
        subtitle="Centralisez les assemblées générales, suivez les décisions en cours et accédez rapidement aux écrans clés du parcours métier, de la préparation jusqu’au procès-verbal. Cette page doit servir d’entrée premium, sans répétition inutile avec les indicateurs détaillés situés plus bas."
        leftActions={
          <>
            <SmallButton onClick={() => navigate("/ag/assemblees/nouveau")}>
              Créer une assemblée
            </SmallButton>
            <SmallButton onClick={() => navigate("/ag/assemblees")}>
              Consulter les assemblées
            </SmallButton>
            <SmallButton onClick={() => void loadData()} primary disabled={state === "loading"}>
              {state === "loading" ? "Chargement..." : "Actualiser"}
            </SmallButton>
          </>
        }
        rightContent={
          <div style={heroSideGrid}>
            <HeroMiniCard
              label="Statut global"
              value={heroStatusText}
              hint="Lecture rapide du niveau d’activité"
            />
            <HeroMiniCard
              label="Première AG exploitable"
              value={hasAnyAg ? `#${stats.firstAgId}` : "—"}
              hint="Point d’entrée vers les écrans opérationnels"
            />
            <HeroMiniCard
              label="PV générés"
              value={String(stats.pvGeneres)}
              hint="Progression documentaire du module"
            />
          </div>
        }
      />

      {state === "error" && error ? (
        <AlertBox kind="error" title="Chargement partiel ou impossible">
          {error}
        </AlertBox>
      ) : null}

      {state !== "error" && stats.agTotal === 0 ? (
        <AlertBox kind="info" title="Le module AG est prêt à être initialisé">
          Aucun enregistrement n’a encore été détecté. Commencez par créer une première assemblée,
          puis ajoutez vos résolutions, vos présences et vos votes dans le cycle normal.
        </AlertBox>
      ) : null}

      <div
        className="ag-kpi-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 14,
        }}
      >
        <KpiCard
          label="Assemblées"
          value={state === "loading" ? "..." : String(stats.agTotal)}
          hint="Nombre total d’assemblées visibles dans le module."
          accent="neutral"
        />
        <KpiCard
          label="À suivre"
          value={state === "loading" ? "..." : String(stats.assembleesASuivre)}
          hint="Assemblées en brouillon ou encore ouvertes."
          accent="warning"
        />
        <KpiCard
          label="Résolutions adoptées"
          value={state === "loading" ? "..." : String(stats.resolutionsAdoptees)}
          hint="Décisions déjà validées dans le cycle AG."
          accent="success"
        />
        <KpiCard
          label="PV générés"
          value={state === "loading" ? "..." : String(stats.pvGeneres)}
          hint="Procès-verbaux déjà produits ou signés."
          accent="info"
        />
      </div>

      <Panel style={{ padding: 18 }}>
        <div style={panelHeader}>
          <div>
            <div style={sectionEyebrow}>Accès rapides</div>
            <div style={panelTitle}>Raccourcis utiles du module</div>
            <div style={panelSubtitle}>
              Raccourcis vers les écrans les plus utiles pour exploiter le module au quotidien.
            </div>
          </div>
        </div>

        <div
          className="ag-actions-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: 12,
          }}
        >
          <ActionTile
            title="Créer une assemblée"
            text="Démarrez un nouveau cycle AG sur la copropriété active."
            actionLabel="Nouvelle assemblée"
            onAction={() => navigate("/ag/assemblees/nouveau")}
            accent="info"
          />

          <ActionTile
            title="Voir les assemblées"
            text="Consultez les assemblées préparées, ouvertes, clôturées ou archivées."
            actionLabel="Ouvrir la liste"
            onAction={() => navigate("/ag/assemblees")}
            accent="neutral"
          />

          <ActionTile
            title="Suivre les résolutions"
            text="Accédez à la liste des résolutions pour suivre les décisions prises ou en attente."
            actionLabel="Voir les résolutions"
            onAction={() => navigate("/ag/resolutions")}
            accent="info"
          />

          <ActionTile
            title="Gérer les présences"
            text="Accédez directement à la gestion des présences pour la première assemblée disponible."
            actionLabel="Ouvrir les présences"
            onAction={() => navigate(`/ag/assemblees/${stats.firstOpenAgId ?? stats.firstAgId}/presences`)}
            disabled={!hasAnyAg}
            accent="success"
          />
        </div>
      </Panel>

      <div
        className="ag-main-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.08fr) minmax(320px, 0.92fr)",
          gap: 16,
        }}
      >
        <Panel style={{ padding: 18 }}>
          <div style={panelHeader}>
            <div>
              <div style={sectionEyebrow}>Indicateurs clés</div>
              <div style={panelTitle}>État opérationnel du module</div>
              <div style={panelSubtitle}>
                Lecture rapide de l’état du module et de son activité métier.
              </div>
            </div>
          </div>

          <div
            className="ag-summary-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
              gap: 12,
              marginBottom: 16,
            }}
          >
            <KpiCard
              label="Assemblées en brouillon"
              value={state === "loading" ? "..." : String(stats.assembleesBrouillon)}
              hint="Assemblées encore en préparation avant ouverture."
              accent="warning"
            />
            <KpiCard
              label="Assemblées ouvertes"
              value={state === "loading" ? "..." : String(stats.assembleesOuvertes)}
              hint="Assemblées actuellement en cours de traitement."
              accent="info"
            />
            <KpiCard
              label="Assemblées clôturées"
              value={state === "loading" ? "..." : String(stats.assembleesCloturees)}
              hint="Cycles de vote terminés et stabilisés."
              accent="success"
            />
            <KpiCard
              label="Assemblées archivées"
              value={state === "loading" ? "..." : String(stats.assembleesArchivees)}
              hint="Assemblées finalisées et conservées pour consultation."
              accent="neutral"
            />
          </div>

          <div style={insightBox}>
            <div style={insightTitle}>Synthèse produit</div>
            <div style={insightText}>{summarySentence}</div>
          </div>
        </Panel>

        <Panel style={{ padding: 18 }}>
          <div style={panelHeader}>
            <div>
              <div style={sectionEyebrow}>Décisions et documentation</div>
              <div style={panelTitle}>Lecture concentrée du cycle AG</div>
              <div style={panelSubtitle}>
                Résolutions, décisions et progression documentaire jusqu’au procès-verbal.
              </div>
            </div>
          </div>

          <div style={stackStyle}>
            <div style={metricRowStyle}>
              <span style={metricLabelStyle}>Résolutions en attente</span>
              <Badge text={String(stats.resolutionsEnAttente)} kind="warning" />
            </div>
            <div style={metricRowStyle}>
              <span style={metricLabelStyle}>Résolutions adoptées</span>
              <Badge text={String(stats.resolutionsAdoptees)} kind="success" />
            </div>
            <div style={metricRowStyle}>
              <span style={metricLabelStyle}>Résolutions rejetées</span>
              <Badge text={String(stats.resolutionsRejetees)} kind="danger" />
            </div>
            <div style={metricRowStyle}>
              <span style={metricLabelStyle}>Procès-verbaux générés</span>
              <Badge text={String(stats.pvGeneres)} kind="info" />
            </div>
          </div>

          <div style={insightBoxSecondary}>
            <div style={insightTitle}>Lecture métier</div>
            <div style={insightText}>
              Cette zone permet d’évaluer rapidement le niveau de maturité du cycle AG :
              décisions encore en attente, décisions validées et progression documentaire jusqu’au
              procès-verbal.
            </div>
          </div>
        </Panel>
      </div>

      <div
        className="ag-bottom-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.08fr) minmax(320px, 0.92fr)",
          gap: 16,
        }}
      >
        <Panel style={{ padding: 18 }}>
          <div style={panelHeader}>
            <div>
              <div style={sectionEyebrow}>Parcours recommandé</div>
              <div style={panelTitle}>Ordre conseillé du cycle AG</div>
              <div style={panelSubtitle}>
                Ordre logique pour conduire une assemblée de bout en bout avec cohérence.
              </div>
            </div>
          </div>

          <div
            className="ag-steps-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 12,
            }}
          >
            <ProcessStep
              step={1}
              title="Créer l’assemblée"
              text="Préparez le cadre de l’assemblée, la date, le lieu et les informations structurantes."
              accent="info"
            />
            <ProcessStep
              step={2}
              title="Ajouter les résolutions"
              text="Définissez les décisions à soumettre avant l’ouverture du cycle de vote."
              accent="warning"
            />
            <ProcessStep
              step={3}
              title="Saisir présences et votes"
              text="Enregistrez les participants, vérifiez le quorum et capturez les votes."
              accent="success"
            />
            <ProcessStep
              step={4}
              title="Finaliser le procès-verbal"
              text="Générez, consultez puis verrouillez le PV dans le parcours documentaire final."
              accent="neutral"
            />
          </div>
        </Panel>

        <Panel style={{ padding: 18 }}>
          <div style={panelHeader}>
            <div>
              <div style={sectionEyebrow}>Vision produit</div>
              <div style={panelTitle}>Place du module AG dans la plateforme</div>
              <div style={panelSubtitle}>
                Positionnement du module AG dans la valeur globale du produit.
              </div>
            </div>

            <div>
              <Badge text="Module stratégique" kind="success" />
            </div>
          </div>

          <div style={{ display: "grid", gap: 14 }}>
            <SummaryCard
              title="Flux de gouvernance"
              value="Décision, participation, vote, formalisation"
              hint="Le module AG relie la préparation des décisions, la participation des copropriétaires, le vote et la formalisation du procès-verbal."
              accent="info"
            />

            <SummaryCard
              title="Ambition premium"
              value="Lecture rapide, accès immédiat, cohérence produit"
              hint="Dans une logique premium, cette vue doit servir de cockpit de pilotage : accès utile, structure claire et compréhension instantanée de l’avancement."
              accent="success"
            />

            {stats.dominantStatus ? (
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <span style={{ fontSize: 13, color: "#6b7280", fontWeight: 700 }}>
                  Statut dominant détecté :
                </span>
                {getStatusBadge(stats.dominantStatus)}
              </div>
            ) : null}
          </div>
        </Panel>
      </div>
    </PageShell>
  );
}

const pageShell: CSSProperties = {
  display: "grid",
  gap: 18,
};

const headerRow: CSSProperties = {
  display: "flex",
  alignItems: "flex-end",
  justifyContent: "space-between",
  gap: 16,
  flexWrap: "wrap",
};

const headerTitle: CSSProperties = {
  margin: 0,
  fontSize: 32,
  fontWeight: 900,
  letterSpacing: -0.9,
  color: "#0f172a",
  lineHeight: 1.05,
};

const headerSubtitle: CSSProperties = {
  margin: 0,
  maxWidth: 980,
  fontSize: 14,
  color: "#64748b",
  lineHeight: 1.7,
};

const heroCard: CSSProperties = {
  background: "var(--module-hero-gradient)",
  borderRadius: 28,
  padding: "28px 30px",
  color: "#ffffff",
  boxShadow: "0 30px 70px rgba(15,23,42,0.18)",
  position: "relative",
  overflow: "hidden",
};

const heroGlow: CSSProperties = {
  position: "absolute",
  inset: "auto -120px -140px auto",
  width: 280,
  height: 280,
  borderRadius: "50%",
  background: "radial-gradient(circle, var(--module-hero-glow) 0%, rgba(255,255,255,0) 72%)",
  pointerEvents: "none",
};

const heroGlowSecondary: CSSProperties = {
  position: "absolute",
  inset: "-60px auto auto -60px",
  width: 220,
  height: 220,
  borderRadius: "50%",
  background: "radial-gradient(circle, var(--module-hero-blue-glow) 0%, rgba(59,130,246,0) 72%)",
  pointerEvents: "none",
};

const heroLayout: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(360px, 1.3fr) minmax(280px, 0.9fr)",
  gap: 22,
  alignItems: "end",
  position: "relative",
  zIndex: 1,
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
};

const heroMiniCard: CSSProperties = {
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.08)",
  borderRadius: 18,
  padding: 14,
  backdropFilter: "blur(10px)",
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

const sectionEyebrow: CSSProperties = {
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: 0.8,
  textTransform: "uppercase",
  color: "#2563eb",
  marginBottom: 6,
};

const panelHeader: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "flex-start",
  marginBottom: 14,
  flexWrap: "wrap",
};

const panelTitle: CSSProperties = {
  fontSize: 18,
  fontWeight: 900,
  color: "#0f172a",
  lineHeight: 1.2,
};

const panelSubtitle: CSSProperties = {
  marginTop: 6,
  fontSize: 13,
  color: "#64748b",
  lineHeight: 1.6,
};

const insightBox: CSSProperties = {
  padding: 14,
  borderRadius: 18,
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
};

const insightBoxSecondary: CSSProperties = {
  padding: 14,
  borderRadius: 18,
  background: "#ffffff",
  border: "1px dashed #cbd5e1",
};

const insightTitle: CSSProperties = {
  fontSize: 14,
  fontWeight: 900,
  color: "#0f172a",
  marginBottom: 6,
};

const insightText: CSSProperties = {
  fontSize: 13,
  lineHeight: 1.7,
  color: "#475569",
};

const stackStyle: CSSProperties = {
  display: "grid",
  gap: 12,
  marginBottom: 16,
};

const metricRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  padding: "12px 14px",
  borderRadius: 14,
  border: "1px solid #e2e8f0",
  background: "#f8fafc",
};

const metricLabelStyle: CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  color: "#334155",
};