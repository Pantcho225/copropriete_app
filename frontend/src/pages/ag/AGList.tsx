import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../../api/axios";

type LoadState = "idle" | "loading" | "success" | "error";

type AGStatus =
  | "BROUILLON"
  | "CONVOQUEE"
  | "OUVERTE"
  | "CLOTUREE"
  | "ANNULEE"
  | "ARCHIVEE";

type KPIAccent = "neutral" | "success" | "warning" | "danger" | "info";
type BadgeKind = "neutral" | "success" | "warning" | "danger" | "info";

type AGItem = {
  id: number;
  reference: string;
  titre: string;
  exercice: string;
  date_ag: string;
  lieu?: string;
  statut: AGStatus;
  nb_resolutions: number;
  quorum_atteint?: boolean | null;
  pv_genere?: boolean;
};

type DRFPage<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

const AG_ENDPOINT_CANDIDATES = ["/api/ag/ags/", "/api/ag/ags"];

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

    if (["true", "1", "oui", "yes", "ok"].includes(s)) return true;

    if (["false", "0", "non", "no"].includes(s)) return false;

    if (["atteint", "généré", "genere", "disponible", "present"].includes(s)) {
      return true;
    }

    if (["absent", "indisponible", "non_genere", "non généré", "non genere"].includes(s)) {
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

function normalizeStatus(value: unknown): AGStatus {
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

function pickString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }

  return "";
}

function pickDate(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }

  return "";
}

function normalizeAGItem(raw: unknown): AGItem {
  const row = isRecord(raw) ? raw : {};

  const id = toNumberOrNull(row.id) ?? toNumberOrNull(row.ag_id) ?? toNumberOrNull(row.pk) ?? 0;

  let exerciceLabel = pickString(
    row.exercice,
    row.exercice_label,
    row.exercice_nom,
    row.exercice_libelle,
  );

  if (isRecord(row.exercice)) {
    exerciceLabel = pickString(
      row.exercice.libelle,
      row.exercice.nom,
      row.exercice.label,
      row.exercice.reference,
      String(row.exercice.id ?? ""),
    );
  }

  const nbResolutions =
    toNumberOrNull(row.nb_resolutions) ??
    toNumberOrNull(row.nombre_resolutions) ??
    toNumberOrNull(row.resolutions_count) ??
    (Array.isArray(row.resolutions) ? row.resolutions.length : null) ??
    0;

  const pvGenere =
    toBooleanOrNull(row.pv_genere) ??
    toBooleanOrNull(row.pv_archive) ??
    toBooleanOrNull(row.pv_disponible) ??
    toBooleanOrNull(row.pv_locked) ??
    (hasTruthyValue(row.pv_signed_pdf) ? true : null) ??
    (hasTruthyValue(row.pv_signed_pdf_url) ? true : null) ??
    (hasTruthyValue(row.pv_pdf) ? true : null) ??
    (hasTruthyValue(row.pv_pdf_url) ? true : null) ??
    false;

  return {
    id,
    reference: pickString(row.reference, row.ref, row.code) || `AG-${id}`,
    titre: pickString(row.titre, row.title, row.intitule, row.nom) || "Assemblée générale",
    exercice: exerciceLabel || "—",
    date_ag: pickDate(row.date_ag, row.date, row.date_assemblee, row.date_reunion),
    lieu: pickString(row.lieu, row.location, row.endroit),
    statut: normalizeStatus(row.statut ?? row.status ?? row.etat),
    nb_resolutions: nbResolutions,
    quorum_atteint:
      toBooleanOrNull(row.quorum_atteint) ??
      toBooleanOrNull(row.quorum) ??
      toBooleanOrNull(row.quorum_ok),
    pv_genere: pvGenere,
  };
}

function getErrorMessage(error: unknown, fallback: string) {
  const err = error as {
    response?: {
      status?: number;
      data?: {
        detail?: string;
        message?: string;
        [key: string]: unknown;
      };
    };
    message?: string;
  };

  return err?.response?.data?.detail || err?.response?.data?.message || err?.message || fallback;
}

function formatDateShort(iso?: string): string {
  if (!iso) return "—";

  const d = new Date(iso);
  if (!Number.isNaN(d.getTime())) return d.toLocaleDateString("fr-FR");

  return iso;
}

function getStatusMeta(
  status: AGStatus,
): { label: string; kind: BadgeKind; description: string } {
  switch (status) {
    case "CONVOQUEE":
      return {
        label: "Convoquée",
        kind: "warning",
        description: "Assemblée programmée et convoquée, en attente d’ouverture.",
      };

    case "OUVERTE":
      return {
        label: "Ouverte",
        kind: "info",
        description: "Assemblée active, en cours de traitement.",
      };

    case "CLOTUREE":
      return {
        label: "Clôturée",
        kind: "success",
        description: "Assemblée finalisée sur le plan métier.",
      };

    case "ARCHIVEE":
      return {
        label: "Archivée",
        kind: "success",
        description: "Assemblée archivée et disponible pour consultation documentaire.",
      };

    case "ANNULEE":
      return {
        label: "Annulée",
        kind: "danger",
        description: "Assemblée interrompue ou invalidée sur le cycle métier.",
      };

    default:
      return {
        label: "Brouillon",
        kind: "neutral",
        description: "Assemblée en préparation avant convocation ou ouverture.",
      };
  }
}

function getPVMeta(item: AGItem): { label: string; kind: BadgeKind } {
  if (item.pv_genere) {
    if (item.statut === "CLOTUREE" || item.statut === "ARCHIVEE") {
      return { label: "Disponible", kind: "success" };
    }

    return { label: "Généré", kind: "success" };
  }

  if (item.statut === "OUVERTE") return { label: "À produire", kind: "warning" };

  return { label: "Non généré", kind: "neutral" };
}

function getQuorumMeta(value: boolean | null | undefined): { label: string; kind: BadgeKind } {
  if (value === true) return { label: "Atteint", kind: "success" };
  if (value === false) return { label: "Non atteint", kind: "danger" };

  return { label: "À vérifier", kind: "warning" };
}

function PageShell({ children }: { children: ReactNode }) {
  return <div style={pageShellStyle}>{children}</div>;
}

function PageHeader(props: { title: string; subtitle?: string }) {
  return (
    <section style={pageHeaderStyle}>
      <div style={pageHeaderInnerStyle}>
        <div style={pageHeaderCopyStyle}>
          <div style={pageEyebrowStyle}>Pilotage du module AG</div>
          <h1 style={pageTitleStyle}>{props.title}</h1>
          {props.subtitle ? <p style={pageSubtitleStyle}>{props.subtitle}</p> : null}
        </div>
      </div>
    </section>
  );
}

function SectionCard(props: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  children: ReactNode;
  flush?: boolean;
}) {
  return (
    <section style={sectionCardStyle}>
      <div style={sectionCardHeaderStyle}>
        <div style={sectionCardTitleWrapStyle}>
          <div style={sectionCardTitleStyle}>{props.title}</div>
          {props.subtitle ? <div style={sectionCardSubtitleStyle}>{props.subtitle}</div> : null}
        </div>

        {props.right ? <div style={sectionCardRightStyle}>{props.right}</div> : null}
      </div>

      <div style={props.flush ? { minWidth: 0 } : sectionCardBodyStyle}>{props.children}</div>
    </section>
  );
}

function HeroSection(props: {
  title: string;
  text: string;
  primaryLabel: string;
  primaryAction: () => void;
  secondaryLabel: string;
  secondaryAction: () => void;
  children?: ReactNode;
}) {
  return (
    <section style={heroCardStyle}>
      <div style={heroGridStyle}>
        <div style={heroMainStyle}>
          <div style={heroPillStyle}>ASSEMBLÉES GÉNÉRALES · LISTE</div>

          <div style={heroCopyBlockStyle}>
            <h2 style={heroTitleStyle}>{props.title}</h2>
            <p style={heroTextStyle}>{props.text}</p>
          </div>

          <div style={heroActionsStyle}>
            <button type="button" onClick={props.primaryAction} style={heroPrimaryButtonStyle}>
              {props.primaryLabel}
            </button>

            <button type="button" onClick={props.secondaryAction} style={heroSecondaryButtonStyle}>
              {props.secondaryLabel}
            </button>
          </div>
        </div>

        {props.children ? <div style={heroAsideStyle}>{props.children}</div> : null}
      </div>
    </section>
  );
}

function SummaryCard(props: {
  label: string;
  value: string | number;
  helper: string;
  tone?: KPIAccent;
  isLoading?: boolean;
}) {
  const tone =
    props.tone === "success"
      ? {
          bg: "#f0fdf4",
          border: "#bbf7d0",
          value: "#166534",
          label: "#15803d",
        }
      : props.tone === "warning"
        ? {
            bg: "#fffbeb",
            border: "#fde68a",
            value: "#92400e",
            label: "#b45309",
          }
        : props.tone === "danger"
          ? {
              bg: "#fef2f2",
              border: "#fecaca",
              value: "#991b1b",
              label: "#b91c1c",
            }
          : props.tone === "info"
            ? {
                bg: "#eff6ff",
                border: "#bfdbfe",
                value: "#1d4ed8",
                label: "#2563eb",
              }
            : {
                bg: "#f8fafc",
                border: "#e2e8f0",
                value: "#0f172a",
                label: "#475569",
              };

  return (
    <div
      style={{
        border: `1px solid ${tone.border}`,
        borderRadius: 20,
        background: tone.bg,
        padding: 18,
        display: "grid",
        gap: 10,
        minWidth: 0,
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          fontSize: 11,
          textTransform: "uppercase",
          letterSpacing: 0.7,
          fontWeight: 900,
          color: tone.label,
        }}
      >
        {props.label}
      </div>

      <div
        style={{
          fontSize: 30,
          lineHeight: 1,
          fontWeight: 900,
          letterSpacing: -0.6,
          color: tone.value,
        }}
      >
        {props.isLoading ? "..." : props.value}
      </div>

      <div style={{ fontSize: 13, lineHeight: 1.6, color: "#64748b" }}>{props.helper}</div>
    </div>
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
        minHeight: 42,
        padding: "10px 14px",
        borderRadius: 12,
        border: props.primary ? "1px solid #c7d2fe" : "1px solid #dbe1ea",
        background: props.disabled ? "#f8fafc" : props.primary ? "#eef2ff" : "#ffffff",
        color: props.disabled ? "#94a3b8" : props.primary ? "#3730a3" : "#0f172a",
        fontSize: 13,
        fontWeight: 800,
        cursor: props.disabled ? "not-allowed" : "pointer",
        whiteSpace: "nowrap",
        boxShadow: props.primary ? "0 10px 24px rgba(79, 70, 229, 0.10)" : "none",
      }}
    >
      {props.children}
    </button>
  );
}

function Badge(props: { text: string; kind?: BadgeKind }) {
  const styles =
    props.kind === "success"
      ? { background: "#ecfdf5", border: "#a7f3d0", color: "#065f46" }
      : props.kind === "warning"
        ? { background: "#fffbeb", border: "#fde68a", color: "#92400e" }
        : props.kind === "danger"
          ? { background: "#fef2f2", border: "#fecaca", color: "#991b1b" }
          : props.kind === "info"
            ? { background: "#eff6ff", border: "#bfdbfe", color: "#1d4ed8" }
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

function FilterStatCard(props: {
  label: string;
  value: number;
  accent: KPIAccent;
  isActive?: boolean;
  onClick?: () => void;
}) {
  const tone =
    props.accent === "success"
      ? { bg: "#ecfdf5", border: "#bbf7d0", color: "#065f46" }
      : props.accent === "warning"
        ? { bg: "#fffbeb", border: "#fde68a", color: "#92400e" }
        : props.accent === "danger"
          ? { bg: "#fef2f2", border: "#fecaca", color: "#991b1b" }
          : props.accent === "info"
            ? { bg: "#eff6ff", border: "#bfdbfe", color: "#1d4ed8" }
            : { bg: "#f8fafc", border: "#e2e8f0", color: "#475569" };

  return (
    <button
      type="button"
      onClick={props.onClick}
      style={{
        width: "100%",
        minWidth: 0,
        textAlign: "left",
        borderRadius: 18,
        padding: 16,
        cursor: "pointer",
        border: `1px solid ${props.isActive ? tone.border : "#e2e8f0"}`,
        background: props.isActive ? tone.bg : "#ffffff",
        boxShadow: props.isActive ? "0 10px 24px rgba(15, 23, 42, 0.06)" : "none",
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 800, color: tone.color, marginBottom: 10 }}>
        {props.label}
      </div>
      <div style={{ fontSize: 28, lineHeight: 1, fontWeight: 900, color: "#0f172a" }}>
        {props.value}
      </div>
    </button>
  );
}

function EmptyState(props: {
  title: string;
  text: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div style={emptyStateStyle}>
      <div style={emptyStateTitleStyle}>{props.title}</div>
      <div style={emptyStateTextStyle}>{props.text}</div>

      {props.actionLabel && props.onAction ? (
        <div style={{ marginTop: 14 }}>
          <SmallButton primary onClick={props.onAction}>
            {props.actionLabel}
          </SmallButton>
        </div>
      ) : null}
    </div>
  );
}

function AlertBox(props: { kind: "error" | "info"; children: ReactNode }) {
  const tone =
    props.kind === "error"
      ? {
          bg: "linear-gradient(180deg, #fef2f2 0%, #fff7f7 100%)",
          border: "#fecaca",
          text: "#991b1b",
        }
      : {
          bg: "linear-gradient(180deg, #eff6ff 0%, #f8fbff 100%)",
          border: "#bfdbfe",
          text: "#1d4ed8",
        };

  return (
    <div
      style={{
        padding: 16,
        borderRadius: 18,
        background: tone.bg,
        border: `1px solid ${tone.border}`,
        color: tone.text,
        lineHeight: 1.6,
        width: "100%",
        minWidth: 0,
        boxSizing: "border-box",
      }}
    >
      {props.children}
    </div>
  );
}

export default function AGList() {
  const navigate = useNavigate();

  const [state, setState] = useState<LoadState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<AGItem[]>([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"TOUS" | AGStatus>("TOUS");

  const fetchAssemblies = useCallback(async () => {
    setState("loading");
    setError(null);

    let lastError: unknown = null;

    for (const endpoint of AG_ENDPOINT_CANDIDATES) {
      try {
        const res = await api.get(endpoint);

        const normalized = extractRows<Record<string, unknown>>(res?.data)
          .map(normalizeAGItem)
          .filter((item) => item.id > 0)
          .sort((a, b) => {
            const da = new Date(a.date_ag).getTime();
            const db = new Date(b.date_ag).getTime();

            if (Number.isNaN(da) && Number.isNaN(db)) return b.id - a.id;
            if (Number.isNaN(da)) return 1;
            if (Number.isNaN(db)) return -1;

            return db - da;
          });

        setRows(normalized);
        setState("success");
        return;
      } catch (e) {
        lastError = e;
      }
    }

    setRows([]);
    setState("error");
    setError(getErrorMessage(lastError, "Impossible de charger la liste des assemblées générales."));
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchAssemblies();
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [fetchAssemblies]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    return rows.filter((item) => {
      const matchesStatus = statusFilter === "TOUS" ? true : item.statut === statusFilter;
      if (!matchesStatus) return false;

      if (!q) return true;

      const haystack = [item.reference, item.titre, item.exercice, item.lieu ?? "", item.statut]
        .join(" ")
        .toLowerCase();

      return haystack.includes(q);
    });
  }, [rows, query, statusFilter]);

  const stats = useMemo(() => {
    return {
      total: rows.length,
      brouillons: rows.filter((x) => x.statut === "BROUILLON").length,
      convoquees: rows.filter((x) => x.statut === "CONVOQUEE").length,
      ouvertes: rows.filter((x) => x.statut === "OUVERTE").length,
      cloturees: rows.filter((x) => x.statut === "CLOTUREE").length,
      archivees: rows.filter((x) => x.statut === "ARCHIVEE").length,
      annulees: rows.filter((x) => x.statut === "ANNULEE").length,
      pvGeneres: rows.filter((x) => x.pv_genere).length,
      quorumOk: rows.filter((x) => x.quorum_atteint === true).length,
    };
  }, [rows]);

  const isLoading = state === "loading";

  return (
    <PageShell>
      <PageHeader
        title="Assemblées générales"
        subtitle="Consultez les assemblées, leur statut, le volume de résolutions, la situation du quorum et l’état du procès-verbal depuis une vue de supervision plus claire, plus cohérente et mieux alignée avec le reste du module AG."
      />

      <HeroSection
        title="Cockpit de supervision des assemblées"
        text="Cette page centralise le cycle AG pour suivre la préparation, la convocation, l’ouverture, les résolutions, le quorum et la situation du procès-verbal dans une lecture métier unifiée."
        primaryLabel="Nouvelle assemblée"
        primaryAction={() => navigate("/ag/assemblees/nouveau")}
        secondaryLabel="Retour au module AG"
        secondaryAction={() => navigate("/ag")}
      >
        <div style={heroAsidePanelStyle}>
          <div style={heroAsideTitleStyle}>Lecture transverse</div>
          <div style={heroAsideTextStyle}>
            Utilisez cette liste comme porte d’entrée du module pour accéder rapidement au détail,
            aux présences, aux votes, aux résolutions et au procès-verbal sans dispersion visuelle.
          </div>

          <div style={heroAsideDividerStyle} />

          <div style={heroAsideMiniNoteStyle}>
            Les indicateurs détaillés restent volontairement dans les blocs inférieurs afin d’éviter
            les répétitions entre le hero et les cartes de synthèse.
          </div>
        </div>
      </HeroSection>

      {state === "error" && error ? (
        <AlertBox kind="error">
          <div style={{ fontWeight: 900, marginBottom: 6 }}>Chargement impossible</div>
          <div style={{ fontSize: 13 }}>{error}</div>
        </AlertBox>
      ) : null}

      <div className="aglist-summary-grid">
        <SummaryCard
          label="Assemblées"
          value={stats.total}
          helper="Nombre total d’assemblées visibles dans le portefeuille courant."
          isLoading={isLoading}
          tone="neutral"
        />
        <SummaryCard
          label="Ouvertes"
          value={stats.ouvertes}
          helper="Assemblées actuellement en cours de traitement."
          isLoading={isLoading}
          tone="info"
        />
        <SummaryCard
          label="Clôturées"
          value={stats.cloturees}
          helper="Assemblées déjà finalisées sur le plan métier."
          isLoading={isLoading}
          tone="success"
        />
        <SummaryCard
          label="PV disponibles"
          value={stats.pvGeneres}
          helper="Assemblées disposant déjà d’un procès-verbal généré, archivé ou signé."
          isLoading={isLoading}
          tone="warning"
        />
      </div>

      <SectionCard
        title="Filtres rapides"
        subtitle="Bascules directes pour lire plus vite l’état du portefeuille d’assemblées."
        right={<Badge text={`${filtered.length} affichée(s)`} kind="info" />}
      >
        <div className="aglist-filter-grid">
          <FilterStatCard
            label="Tous les statuts"
            value={stats.total}
            accent="neutral"
            isActive={statusFilter === "TOUS"}
            onClick={() => setStatusFilter("TOUS")}
          />
          <FilterStatCard
            label="Brouillons"
            value={stats.brouillons}
            accent="neutral"
            isActive={statusFilter === "BROUILLON"}
            onClick={() => setStatusFilter("BROUILLON")}
          />
          <FilterStatCard
            label="Convoquées"
            value={stats.convoquees}
            accent="warning"
            isActive={statusFilter === "CONVOQUEE"}
            onClick={() => setStatusFilter("CONVOQUEE")}
          />
          <FilterStatCard
            label="Ouvertes"
            value={stats.ouvertes}
            accent="info"
            isActive={statusFilter === "OUVERTE"}
            onClick={() => setStatusFilter("OUVERTE")}
          />
          <FilterStatCard
            label="Clôturées"
            value={stats.cloturees}
            accent="success"
            isActive={statusFilter === "CLOTUREE"}
            onClick={() => setStatusFilter("CLOTUREE")}
          />
          <FilterStatCard
            label="Archivées"
            value={stats.archivees}
            accent="success"
            isActive={statusFilter === "ARCHIVEE"}
            onClick={() => setStatusFilter("ARCHIVEE")}
          />
          <FilterStatCard
            label="Annulées"
            value={stats.annulees}
            accent="danger"
            isActive={statusFilter === "ANNULEE"}
            onClick={() => setStatusFilter("ANNULEE")}
          />
        </div>
      </SectionCard>

      <SectionCard
        title="Recherche et supervision"
        subtitle="Filtrez la liste par référence, titre, exercice, lieu ou statut."
        right={
          <div style={badgeRowStyle}>
            <Badge text={`${stats.brouillons} brouillon(s)`} kind="neutral" />
            <Badge text={`${stats.convoquees} convoquée(s)`} kind="warning" />
            <Badge text={`${stats.ouvertes} ouverte(s)`} kind="info" />
            <Badge text={`${stats.cloturees} clôturée(s)`} kind="success" />
            <Badge text={`${stats.archivees} archivée(s)`} kind="success" />
            <Badge text={`${stats.quorumOk} quorum atteint`} kind="success" />
          </div>
        }
      >
        <div style={toolbarWrapStyle}>
          <div style={toolbarInputsWrapStyle}>
            <div style={fieldGroupFluidStyle}>
              <div style={fieldLabelStyle}>Recherche</div>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Référence, titre, exercice, lieu…"
                style={searchInputStyle}
              />
            </div>

            <div style={fieldGroupCompactStyle}>
              <div style={fieldLabelStyle}>Statut</div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as "TOUS" | AGStatus)}
                style={selectInputStyle}
              >
                <option value="TOUS">Tous les statuts</option>
                <option value="BROUILLON">Brouillons</option>
                <option value="CONVOQUEE">Convoquées</option>
                <option value="OUVERTE">Ouvertes</option>
                <option value="CLOTUREE">Clôturées</option>
                <option value="ARCHIVEE">Archivées</option>
                <option value="ANNULEE">Annulées</option>
              </select>
            </div>

            <div style={toolbarButtonsStyle}>
              <SmallButton
                onClick={() => {
                  setQuery("");
                  setStatusFilter("TOUS");
                }}
                disabled={!query && statusFilter === "TOUS"}
              >
                Réinitialiser
              </SmallButton>

              <SmallButton onClick={() => void fetchAssemblies()} disabled={isLoading}>
                {isLoading ? "Actualisation..." : "Actualiser"}
              </SmallButton>
            </div>
          </div>

          <div style={toolbarMetaStyle}>
            {isLoading ? "Chargement des assemblées..." : `${filtered.length} assemblée(s) affichée(s)`}
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Liste des assemblées"
        subtitle="Point central de supervision opérationnelle du module AG."
        right={<Badge text="Supervision métier" kind="info" />}
        flush
      >
        <div style={tableWrapStyle}>
          {isLoading ? (
            <div style={loadingWrapStyle}>Chargement des assemblées générales…</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 18 }}>
              <EmptyState
                title={rows.length === 0 ? "Aucune assemblée enregistrée" : "Aucune assemblée à afficher"}
                text={
                  rows.length === 0
                    ? "Aucune assemblée générale n’a encore été trouvée pour cette copropriété."
                    : "Aucune assemblée ne correspond à la recherche ou aux filtres sélectionnés."
                }
                actionLabel="Nouvelle assemblée"
                onAction={() => navigate("/ag/assemblees/nouveau")}
              />
            </div>
          ) : (
            <table style={tableStyle}>
              <thead>
                <tr style={{ textAlign: "left" }}>
                  <th style={thStyle}>Référence</th>
                  <th style={thStyle}>Assemblée</th>
                  <th style={thStyle}>Exercice</th>
                  <th style={thStyle}>Date</th>
                  <th style={thStyle}>Lieu</th>
                  <th style={thCenterStyle}>Résolutions</th>
                  <th style={thCenterStyle}>Quorum</th>
                  <th style={thCenterStyle}>PV</th>
                  <th style={thStyle}>Statut</th>
                  <th style={thStyle}>Actions métier</th>
                </tr>
              </thead>

              <tbody>
                {filtered.map((item) => {
                  const status = getStatusMeta(item.statut);
                  const quorum = getQuorumMeta(item.quorum_atteint);
                  const pv = getPVMeta(item);

                  return (
                    <tr key={item.id} style={rowBaseStyle}>
                      <td style={tdMonoStyle}>{item.reference || `AG-${item.id}`}</td>

                      <td style={tdStyle}>
                        <div style={titleCellStyle}>
                          <div style={titleMainStyle}>{item.titre || "Assemblée générale"}</div>
                          <div style={titleSubStyle}>
                            {status.description} · AG #{item.id}
                          </div>
                        </div>
                      </td>

                      <td style={tdStyle}>{item.exercice || "—"}</td>
                      <td style={tdStyle}>{formatDateShort(item.date_ag)}</td>
                      <td style={tdStyle}>{item.lieu || "—"}</td>

                      <td style={tdCenterStyle}>
                        <div style={metricPillStyle}>
                          <span style={metricValueStyle}>{item.nb_resolutions}</span>
                          <span style={metricLabelSmallStyle}>résolution(s)</span>
                        </div>
                      </td>

                      <td style={tdCenterStyle}>
                        <Badge text={quorum.label} kind={quorum.kind} />
                      </td>

                      <td style={tdCenterStyle}>
                        <Badge text={pv.label} kind={pv.kind} />
                      </td>

                      <td style={tdStyle}>
                        <Badge text={status.label} kind={status.kind} />
                      </td>

                      <td style={tdStyle}>
                        <div style={actionsWrapStyle}>
                          <Link to={`/ag/assemblees/${item.id}`} style={primaryMiniLinkStyle}>
                            Ouvrir
                          </Link>
                          <Link to={`/ag/assemblees/${item.id}/presences`} style={secondaryMiniLinkStyle}>
                            Présences
                          </Link>
                          <Link to={`/ag/assemblees/${item.id}/votes`} style={secondaryMiniLinkStyle}>
                            Votes
                          </Link>
                          <Link to={`/ag/assemblees/${item.id}/pv`} style={secondaryMiniLinkStyle}>
                            PV
                          </Link>
                          <Link to={`/ag/assemblees/${item.id}/resolutions`} style={secondaryMiniLinkStyle}>
                            Résolutions
                          </Link>
                          <Link to={`/ag/assemblees/${item.id}/modifier`} style={secondaryMiniLinkStyle}>
                            Modifier
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </SectionCard>

      <AlertBox kind="info">
        <div style={{ fontWeight: 900, marginBottom: 6 }}>Cohérence transverse renforcée</div>
        <div style={{ fontSize: 13 }}>
          Cette vue devient le cockpit de supervision du module Assemblées générales, avec un langage
          visuel aligné sur le détail d’assemblée et le suivi des résolutions.
        </div>
      </AlertBox>

      <style>{`
        .aglist-summary-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 14px;
          min-width: 0;
        }

        .aglist-filter-grid {
          display: grid;
          grid-template-columns: repeat(7, minmax(0, 1fr));
          gap: 12px;
          min-width: 0;
        }

        @media (max-width: 1500px) {
          .aglist-filter-grid {
            grid-template-columns: repeat(4, minmax(0, 1fr));
          }
        }

        @media (max-width: 1400px) {
          .aglist-summary-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 980px) {
          .aglist-filter-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 760px) {
          .aglist-summary-grid,
          .aglist-filter-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </PageShell>
  );
}

const pageShellStyle: CSSProperties = {
  display: "grid",
  gap: 20,
  width: "100%",
  minWidth: 0,
  overflowX: "hidden",
};

const pageHeaderStyle: CSSProperties = {
  width: "100%",
  minWidth: 0,
};

const pageHeaderInnerStyle: CSSProperties = {
  display: "grid",
  gap: 10,
  minWidth: 0,
};

const pageHeaderCopyStyle: CSSProperties = {
  display: "grid",
  gap: 6,
  minWidth: 0,
};

const pageEyebrowStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: 0.9,
  textTransform: "uppercase",
  color: "#2563eb",
};

const pageTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: 32,
  lineHeight: 1.02,
  fontWeight: 900,
  letterSpacing: -0.9,
  color: "#0f172a",
};

const pageSubtitleStyle: CSSProperties = {
  margin: 0,
  maxWidth: 900,
  fontSize: 13,
  lineHeight: 1.65,
  color: "#64748b",
};

const sectionCardStyle: CSSProperties = {
  border: "1px solid #e2e8f0",
  borderRadius: 24,
  padding: 20,
  background: "#ffffff",
  boxShadow: "0 10px 28px rgba(15, 23, 42, 0.05)",
  width: "100%",
  minWidth: 0,
  boxSizing: "border-box",
};

const sectionCardHeaderStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 12,
  flexWrap: "wrap",
  marginBottom: 16,
  minWidth: 0,
};

const sectionCardTitleWrapStyle: CSSProperties = {
  display: "grid",
  gap: 6,
  minWidth: 0,
};

const sectionCardTitleStyle: CSSProperties = {
  fontSize: 18,
  lineHeight: 1.2,
  fontWeight: 900,
  color: "#0f172a",
};

const sectionCardSubtitleStyle: CSSProperties = {
  fontSize: 13,
  lineHeight: 1.6,
  color: "#64748b",
};

const sectionCardRightStyle: CSSProperties = {
  minWidth: 0,
};

const sectionCardBodyStyle: CSSProperties = {
  width: "100%",
  minWidth: 0,
};

const heroCardStyle: CSSProperties = {
  borderRadius: 24,
  padding: "18px 20px",
  background: "linear-gradient(135deg, #0f172a 0%, #172554 44%, #2563eb 100%)",
  boxShadow: "0 16px 32px rgba(37, 99, 235, 0.12)",
  width: "100%",
  minWidth: 0,
  overflow: "hidden",
  boxSizing: "border-box",
};

const heroGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1.2fr) minmax(260px, 0.8fr)",
  gap: 16,
  alignItems: "stretch",
  width: "100%",
  minWidth: 0,
};

const heroMainStyle: CSSProperties = {
  display: "grid",
  gap: 14,
  alignContent: "start",
  minWidth: 0,
  justifyItems: "start",
};

const heroPillStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  width: "fit-content",
  maxWidth: "100%",
  padding: "5px 10px",
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.08)",
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: 0.8,
  textTransform: "uppercase",
  color: "rgba(255,255,255,0.84)",
};

const heroCopyBlockStyle: CSSProperties = {
  display: "grid",
  gap: 8,
  minWidth: 0,
};

const heroTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: 25,
  lineHeight: 1.08,
  fontWeight: 900,
  letterSpacing: -0.7,
  color: "#ffffff",
};

const heroTextStyle: CSSProperties = {
  margin: 0,
  maxWidth: 720,
  fontSize: 12.5,
  lineHeight: 1.6,
  color: "rgba(255,255,255,0.84)",
};

const heroActionsStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 10,
  justifyContent: "flex-start",
  alignItems: "center",
  minWidth: 0,
};

const heroPrimaryButtonStyle: CSSProperties = {
  minHeight: 40,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "#ffffff",
  color: "#0f172a",
  borderRadius: 12,
  padding: "9px 13px",
  fontSize: 12.5,
  fontWeight: 800,
  cursor: "pointer",
  boxShadow: "0 1px 2px rgba(15, 23, 42, 0.08)",
};

const heroSecondaryButtonStyle: CSSProperties = {
  minHeight: 40,
  border: "1px solid rgba(255,255,255,0.18)",
  background: "rgba(255,255,255,0.08)",
  color: "#ffffff",
  borderRadius: 12,
  padding: "9px 13px",
  fontSize: 12.5,
  fontWeight: 800,
  cursor: "pointer",
};

const heroAsideStyle: CSSProperties = {
  minWidth: 0,
  display: "flex",
  alignItems: "stretch",
};

const heroAsidePanelStyle: CSSProperties = {
  width: "100%",
  minWidth: 0,
  borderRadius: 18,
  padding: 16,
  background: "rgba(255,255,255,0.08)",
  border: "1px solid rgba(255,255,255,0.12)",
  display: "grid",
  gap: 12,
  alignContent: "start",
};

const heroAsideTitleStyle: CSSProperties = {
  fontSize: 13,
  fontWeight: 900,
  color: "#ffffff",
  textTransform: "uppercase",
  letterSpacing: 0.5,
};

const heroAsideTextStyle: CSSProperties = {
  fontSize: 12.5,
  lineHeight: 1.6,
  color: "rgba(255,255,255,0.82)",
};

const heroAsideDividerStyle: CSSProperties = {
  width: "100%",
  height: 1,
  background: "rgba(255,255,255,0.12)",
};

const heroAsideMiniNoteStyle: CSSProperties = {
  fontSize: 12,
  lineHeight: 1.6,
  color: "rgba(255,255,255,0.72)",
};

const badgeRowStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
  alignItems: "center",
};

const toolbarWrapStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-end",
  gap: 16,
  flexWrap: "wrap",
  width: "100%",
  minWidth: 0,
};

const toolbarInputsWrapStyle: CSSProperties = {
  display: "flex",
  gap: 12,
  flexWrap: "wrap",
  alignItems: "flex-end",
  flex: "1 1 720px",
  minWidth: 0,
};

const toolbarButtonsStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 10,
  alignItems: "flex-end",
};

const toolbarMetaStyle: CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  color: "#64748b",
  textAlign: "right",
};

const fieldGroupFluidStyle: CSSProperties = {
  display: "grid",
  gap: 6,
  minWidth: 260,
  flex: "1 1 340px",
};

const fieldGroupCompactStyle: CSSProperties = {
  display: "grid",
  gap: 6,
  minWidth: 180,
  flex: "0 1 220px",
};

const fieldLabelStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  color: "#64748b",
  textTransform: "uppercase",
  letterSpacing: 0.3,
};

const searchInputStyle: CSSProperties = {
  width: "100%",
  padding: "11px 12px",
  borderRadius: 12,
  border: "1px solid #e2e8f0",
  background: "#ffffff",
  color: "#0f172a",
  fontSize: 14,
  outline: "none",
  boxSizing: "border-box",
};

const selectInputStyle: CSSProperties = {
  width: "100%",
  padding: "11px 12px",
  borderRadius: 12,
  border: "1px solid #e2e8f0",
  background: "#ffffff",
  color: "#0f172a",
  fontWeight: 700,
  boxSizing: "border-box",
};

const tableWrapStyle: CSSProperties = {
  border: "1px solid #e2e8f0",
  borderRadius: 22,
  overflowX: "auto",
  overflowY: "hidden",
  background: "#ffffff",
  boxShadow: "0 12px 32px rgba(15, 23, 42, 0.05)",
  width: "100%",
  minWidth: 0,
};

const tableStyle: CSSProperties = {
  width: "100%",
  minWidth: 1360,
  borderCollapse: "collapse",
};

const loadingWrapStyle: CSSProperties = {
  padding: 18,
  color: "#64748b",
  fontSize: 14,
};

const thStyle: CSSProperties = {
  padding: "14px 12px",
  borderBottom: "1px solid #e2e8f0",
  whiteSpace: "nowrap",
  fontSize: 12,
  color: "#64748b",
  background: "#f8fafc",
  fontWeight: 800,
  textTransform: "uppercase",
  letterSpacing: 0.3,
};

const thCenterStyle: CSSProperties = {
  ...thStyle,
  textAlign: "center",
};

const tdStyle: CSSProperties = {
  padding: "15px 12px",
  borderBottom: "1px solid #f1f5f9",
  verticalAlign: "middle",
  color: "#0f172a",
  fontSize: 14,
};

const tdCenterStyle: CSSProperties = {
  ...tdStyle,
  textAlign: "center",
};

const tdMonoStyle: CSSProperties = {
  ...tdStyle,
  fontWeight: 800,
  whiteSpace: "nowrap",
};

const titleCellStyle: CSSProperties = {
  display: "grid",
  gap: 4,
  minWidth: 0,
};

const titleMainStyle: CSSProperties = {
  fontWeight: 800,
  color: "#0f172a",
};

const titleSubStyle: CSSProperties = {
  fontSize: 12,
  color: "#64748b",
  lineHeight: 1.45,
};

const metricPillStyle: CSSProperties = {
  display: "inline-grid",
  gap: 3,
  justifyItems: "center",
  padding: "8px 12px",
  borderRadius: 14,
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
};

const metricValueStyle: CSSProperties = {
  fontSize: 16,
  fontWeight: 900,
  color: "#0f172a",
  lineHeight: 1,
};

const metricLabelSmallStyle: CSSProperties = {
  fontSize: 11,
  color: "#64748b",
  fontWeight: 700,
};

const actionsWrapStyle: CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
};

const rowBaseStyle: CSSProperties = {
  transition: "background 0.2s ease",
};

const primaryMiniLinkStyle: CSSProperties = {
  padding: "7px 10px",
  borderRadius: 10,
  border: "1px solid #c7d2fe",
  background: "#eef2ff",
  fontSize: 12,
  fontWeight: 800,
  color: "#3730a3",
  textDecoration: "none",
  display: "inline-flex",
  alignItems: "center",
};

const secondaryMiniLinkStyle: CSSProperties = {
  padding: "7px 10px",
  borderRadius: 10,
  border: "1px solid #e2e8f0",
  background: "#ffffff",
  fontSize: 12,
  fontWeight: 800,
  color: "#0f172a",
  textDecoration: "none",
  display: "inline-flex",
  alignItems: "center",
};

const emptyStateStyle: CSSProperties = {
  border: "1px dashed #cbd5e1",
  borderRadius: 18,
  padding: 22,
  background: "linear-gradient(180deg, #f8fafc 0%, #ffffff 100%)",
};

const emptyStateTitleStyle: CSSProperties = {
  fontSize: 15,
  fontWeight: 900,
  color: "#0f172a",
  marginBottom: 8,
};

const emptyStateTextStyle: CSSProperties = {
  fontSize: 13,
  color: "#64748b",
  lineHeight: 1.6,
};