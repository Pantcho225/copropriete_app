import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import api from "../../api/axios";

type LoadState = "idle" | "loading" | "success" | "error";
type ResolutionStatus = "EN_ATTENTE" | "ADOPTEE" | "REJETEE";
type FlashKind = "success" | "error" | "info";
type MajoriteType = "SIMPLE" | "ABSOLUE" | "QUALIFIEE_2_3" | "UNANIMITE";
type BadgeKind = "neutral" | "success" | "warning" | "danger" | "info";
type ButtonVariant = "primary" | "secondary" | "danger";
type KPIAccent = "neutral" | "success" | "warning" | "danger" | "info";

type ResolutionItem = {
  id: number;
  numero: string;
  ordre?: number | null;
  assemblee_id?: number | null;
  assemblee_ref: string;
  assemblee_titre: string;
  titre: string;
  texte?: string | null;
  type_majorite?: string | null;
  tantieme_categorie?: string | null;
  budget_vote?: number | null;
  cloturee?: boolean;
  travaux_dossier_titre?: string | null;
  statut: ResolutionStatus;
};

type ResolutionResult = {
  resolution_id: number;
  type_majorite?: string;
  decision: "ADOPTEE" | "REJETEE";
  tantiemes?: {
    pour?: number;
    contre?: number;
    abstention?: number;
    exprimes?: number;
    ratio_pour_exprimes?: number;
  };
};

type ResolutionFormValues = {
  ag: number | null;
  ordre: number | null;
  titre: string;
  texte: string;
  type_majorite: MajoriteType;
  budget_vote: string;
};

type DRFPage<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

const RESOLUTION_ENDPOINT = "/api/ag/resolutions/";
const RESOLUTION_ENDPOINT_CANDIDATES = ["/api/ag/resolutions/", "/api/ag/resolutions"];

const INITIAL_FORM: ResolutionFormValues = {
  ag: null,
  ordre: null,
  titre: "",
  texte: "",
  type_majorite: "SIMPLE",
  budget_vote: "",
};

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

    if (
      ["true", "1", "oui", "yes", "ok", "cloturee", "clôturée", "closed", "done"].includes(s)
    ) {
      return true;
    }

    if (["false", "0", "non", "no", "ouverte", "open", "draft"].includes(s)) {
      return false;
    }
  }

  return null;
}

function pickString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function pickNullableString(...values: unknown[]): string | null {
  const s = pickString(...values);
  return s || null;
}

function normalizeDecisionValue(value: unknown): ResolutionStatus | null {
  const s = String(value ?? "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();

  if (["ADOPTEE", "VALIDEE", "VALIDE", "APPROUVEE", "ADOPTED"].includes(s)) {
    return "ADOPTEE";
  }

  if (["REJETEE", "REJETE", "REFUSEE", "REFUSE", "REJECTED"].includes(s)) {
    return "REJETEE";
  }

  if (["EN_ATTENTE", "PENDING"].includes(s)) {
    return "EN_ATTENTE";
  }

  return null;
}

function normalizeResolutionStatusFromRaw(
  row: Record<string, unknown>,
  cloturee?: boolean | null,
): ResolutionStatus {
  const isClosed =
    cloturee ??
    toBooleanOrNull(row.cloturee) ??
    toBooleanOrNull(row.est_cloturee) ??
    toBooleanOrNull(row.closed) ??
    false;

  if (!isClosed) {
    return "EN_ATTENTE";
  }

  const candidates = [
    row.decision,
    row.statut_resolution,
    isRecord(row.resultat_detail) ? row.resultat_detail.decision : null,
    row.resultat,
    row.result,
    row.status_result,
    row.vote_result,
    row.outcome,
    row.statut,
    row.status,
    row.etat,
    row.state,
  ];

  for (const candidate of candidates) {
    const normalized = normalizeDecisionValue(candidate);
    if (normalized && normalized !== "EN_ATTENTE") return normalized;
  }

  const adoptedFlag =
    toBooleanOrNull(row.adoptee) ??
    toBooleanOrNull(row.adopted) ??
    toBooleanOrNull(row.is_adoptee) ??
    toBooleanOrNull(row.is_adopted) ??
    null;

  if (adoptedFlag === true) return "ADOPTEE";

  const rejectedFlag =
    toBooleanOrNull(row.rejetee) ??
    toBooleanOrNull(row.rejected) ??
    toBooleanOrNull(row.is_rejetee) ??
    toBooleanOrNull(row.is_rejected) ??
    null;

  if (rejectedFlag === true) return "REJETEE";

  return "EN_ATTENTE";
}

function normalizeResolutionItem(raw: unknown, index: number): ResolutionItem {
  const row = isRecord(raw) ? raw : {};

  const agObject = isRecord(row.ag) ? row.ag : null;
  const assembleeObject = isRecord(row.assemblee) ? row.assemblee : null;

  const assembleeId =
    toNumberOrNull(row.assemblee_id) ??
    toNumberOrNull(row.ag_id) ??
    toNumberOrNull(row.ag) ??
    toNumberOrNull(row.assemblee) ??
    toNumberOrNull(agObject?.id) ??
    toNumberOrNull(assembleeObject?.id) ??
    null;

  const ordre = toNumberOrNull(row.ordre) ?? toNumberOrNull(row.numero_ordre);

  const cloturee =
    toBooleanOrNull(row.cloturee) ??
    toBooleanOrNull(row.est_cloturee) ??
    toBooleanOrNull(row.closed) ??
    false;

  const numero =
    pickString(row.numero, row.reference, row.code, row.libelle_court) ||
    (ordre !== null ? `R${ordre}` : `R${index + 1}`);

  const assembleeRef =
    pickString(
      row.assemblee_ref,
      row.assemblee_reference,
      row.ag_reference,
      agObject?.reference,
      assembleeObject?.reference,
      agObject?.ref,
      assembleeObject?.ref,
    ) || (assembleeId ? `AG-${assembleeId}` : "—");

  const assembleeTitre =
    pickString(
      row.assemblee_titre,
      row.ag_titre,
      agObject?.titre,
      assembleeObject?.titre,
      agObject?.nom,
      assembleeObject?.nom,
    ) || "Assemblée générale";

  return {
    id: toNumberOrNull(row.id) ?? toNumberOrNull(row.resolution_id) ?? index + 1,
    numero,
    ordre,
    assemblee_id: assembleeId,
    assemblee_ref: assembleeRef,
    assemblee_titre: assembleeTitre,
    titre: pickString(row.titre, row.title, row.intitule, row.nom, row.objet) || "Résolution sans titre",
    texte: pickNullableString(row.texte, row.description, row.contenu, row.resume),
    type_majorite: pickNullableString(row.type_majorite),
    tantieme_categorie: pickNullableString(
      row.tantieme_categorie_effective,
      row.tantieme_categorie_label,
      row.tantieme_categorie,
    ),
    budget_vote:
      toNumberOrNull(row.budget_vote) ??
      toNumberOrNull(row.montant_vote) ??
      toNumberOrNull(row.budget) ??
      null,
    cloturee,
    travaux_dossier_titre: pickNullableString(row.travaux_dossier_titre),
    statut: normalizeResolutionStatusFromRaw(row, cloturee),
  };
}

function normalizeResolutionResult(raw: unknown): ResolutionResult | null {
  const row = isRecord(raw) ? raw : null;
  if (!row) return null;

  const decision = String(row.decision ?? "").trim().toUpperCase();
  if (!["ADOPTEE", "REJETEE"].includes(decision)) return null;

  const tantiemesRow = isRecord(row.tantiemes) ? row.tantiemes : {};
  const ratioRaw =
    typeof tantiemesRow.ratio_pour_exprimes === "number"
      ? tantiemesRow.ratio_pour_exprimes
      : Number(tantiemesRow.ratio_pour_exprimes ?? 0);

  return {
    resolution_id: toNumberOrNull(row.resolution_id) ?? 0,
    type_majorite: pickString(row.type_majorite) || undefined,
    decision: decision as "ADOPTEE" | "REJETEE",
    tantiemes: {
      pour: toNumberOrNull(tantiemesRow.pour) ?? 0,
      contre: toNumberOrNull(tantiemesRow.contre) ?? 0,
      abstention: toNumberOrNull(tantiemesRow.abstention) ?? 0,
      exprimes: toNumberOrNull(tantiemesRow.exprimes) ?? 0,
      ratio_pour_exprimes: Number.isFinite(ratioRaw) ? ratioRaw : 0,
    },
  };
}

function getErrorMessage(error: unknown, fallback: string) {
  const err = error as {
    response?: {
      data?: {
        detail?: string | string[];
        message?: string;
        errors?: Record<string, string[]>;
        [key: string]: unknown;
      };
    };
    message?: string;
  };

  const data = err?.response?.data;

  if (typeof data?.detail === "string" && data.detail.trim()) return data.detail;
  if (Array.isArray(data?.detail) && typeof data.detail[0] === "string") return data.detail[0];
  if (typeof data?.message === "string" && data.message.trim()) return data.message;

  if (data?.errors && typeof data.errors === "object") {
    const firstEntry = Object.values(data.errors)[0];
    if (Array.isArray(firstEntry) && typeof firstEntry[0] === "string") return firstEntry[0];
  }

  if (isRecord(data)) {
    for (const value of Object.values(data)) {
      if (Array.isArray(value) && typeof value[0] === "string") return value[0];
      if (typeof value === "string" && value.trim()) return value;
    }
  }

  return err?.message || fallback;
}

function formatMoneyFCFA(amount?: number | null): string {
  if (amount === null || amount === undefined) return "—";

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

function truncateText(value?: string | null, max = 140): string {
  if (!value) return "—";
  const s = String(value).trim();
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}

function formatPercent(value?: number | null): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "0 %";
  return `${Math.round(value * 100)} %`;
}

function buildCreatePayload(values: ResolutionFormValues) {
  return {
    ag: values.ag,
    ordre: values.ordre,
    titre: values.titre.trim(),
    texte: values.texte.trim(),
    type_majorite: values.type_majorite,
    ...(values.budget_vote.trim() ? { budget_vote: Number(values.budget_vote) } : {}),
  };
}

function getResolutionStatusMeta(item: ResolutionItem): {
  label: string;
  kind: BadgeKind;
  description: string;
} {
  if (item.statut === "ADOPTEE") {
    return {
      label: "Adoptée",
      kind: "success",
      description: "Résolution validée à l’issue du calcul et de la clôture.",
    };
  }

  if (item.statut === "REJETEE") {
    return {
      label: "Rejetée",
      kind: "danger",
      description: "Résolution refusée après traitement des votes.",
    };
  }

  if (item.cloturee) {
    return {
      label: "Clôturée",
      kind: "neutral",
      description: "Résolution clôturée sans décision consolidée visible dans cette vue.",
    };
  }

  return {
    label: "En attente",
    kind: "warning",
    description: "Résolution encore en cours d’analyse ou de clôture.",
  };
}

function PageShell({ children }: { children: ReactNode }) {
  return <div style={pageShellStyle}>{children}</div>;
}

function PageHeader(props: { title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <section style={pageHeaderStyle}>
      <div style={pageHeaderInnerStyle}>
        <div style={pageHeaderCopyStyle}>
          <div style={pageEyebrowStyle}>Pilotage du module AG</div>
          <h1 style={pageTitleStyle}>{props.title}</h1>
          {props.subtitle ? <p style={pageSubtitleStyle}>{props.subtitle}</p> : null}
        </div>
        {props.right ? <div>{props.right}</div> : null}
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
          <div style={heroPillStyle}>ASSEMBLÉES GÉNÉRALES · RÉSOLUTIONS</div>

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
      ? { bg: "#f0fdf4", border: "#bbf7d0", value: "#166534", label: "#15803d" }
      : props.tone === "warning"
        ? { bg: "#fffbeb", border: "#fde68a", value: "#92400e", label: "#b45309" }
        : props.tone === "danger"
          ? { bg: "#fef2f2", border: "#fecaca", value: "#991b1b", label: "#b91c1c" }
          : props.tone === "info"
            ? { bg: "#eff6ff", border: "#bfdbfe", value: "#1d4ed8", label: "#2563eb" }
            : { bg: "#f8fafc", border: "#e2e8f0", value: "#0f172a", label: "#475569" };

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

function AlertBox(props: { kind: FlashKind; title?: string; children: ReactNode }) {
  const tone =
    props.kind === "error"
      ? {
          bg: "linear-gradient(180deg, #fef2f2 0%, #fff7f7 100%)",
          border: "#fecaca",
          text: "#991b1b",
        }
      : props.kind === "success"
        ? {
            bg: "linear-gradient(180deg, #ecfdf5 0%, #f3fff8 100%)",
            border: "#a7f3d0",
            text: "#166534",
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
        lineHeight: 1.55,
        width: "100%",
        minWidth: 0,
        boxSizing: "border-box",
      }}
    >
      {props.title ? <div style={{ fontWeight: 900, marginBottom: 6 }}>{props.title}</div> : null}
      <div style={{ fontSize: 13 }}>{props.children}</div>
    </div>
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

function SmallButton(props: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  primary?: boolean;
  danger?: boolean;
}) {
  const border = props.danger
    ? "1px solid #fecaca"
    : props.primary
      ? "1px solid #c7d2fe"
      : "1px solid #dbe1ea";

  const background = props.danger ? "#fef2f2" : props.primary ? "#eef2ff" : "#ffffff";
  const color = props.danger ? "#991b1b" : props.primary ? "#3730a3" : "#0f172a";

  return (
    <button
      type="button"
      onClick={props.onClick}
      disabled={props.disabled}
      style={{
        minHeight: 42,
        padding: "10px 14px",
        borderRadius: 12,
        border,
        background: props.disabled ? "#f8fafc" : background,
        color: props.disabled ? "#94a3b8" : color,
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

function AppButton(props: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: ButtonVariant;
}) {
  const variant = props.variant ?? "secondary";

  const styles =
    variant === "primary"
      ? {
          border: "1px solid #c7d2fe",
          background: "#eef2ff",
          color: "#3730a3",
          shadow: "0 8px 20px rgba(79, 70, 229, 0.10)",
        }
      : variant === "danger"
        ? {
            border: "1px solid #fecaca",
            background: "#fef2f2",
            color: "#991b1b",
            shadow: "none",
          }
        : {
            border: "1px solid #e2e8f0",
            background: "#ffffff",
            color: "#0f172a",
            shadow: "none",
          };

  return (
    <button
      type="button"
      onClick={props.onClick}
      disabled={props.disabled}
      style={{
        border: styles.border,
        background: props.disabled ? "#f8fafc" : styles.background,
        color: props.disabled ? "#9ca3af" : styles.color,
        borderRadius: 12,
        padding: "10px 14px",
        fontSize: 13,
        fontWeight: 800,
        cursor: props.disabled ? "not-allowed" : "pointer",
        whiteSpace: "nowrap",
        boxShadow: styles.shadow,
      }}
    >
      {props.children}
    </button>
  );
}

function EmptyState(props: { title: string; text: string; actionLabel?: string; onAction?: () => void }) {
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

export default function AGResolutions() {
  const navigate = useNavigate();
  const params = useParams();

  const agIdParam = params.id ?? "";
  const ag = toNumberOrNull(agIdParam);

  const [state, setState] = useState<LoadState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<ResolutionItem[]>([]);
  const [message, setMessage] = useState<{ kind: FlashKind; text: string } | null>(null);

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"TOUS" | ResolutionStatus>("TOUS");

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<ResolutionFormValues>({
    ...INITIAL_FORM,
    ag,
  });

  const [busyResultId, setBusyResultId] = useState<number | null>(null);
  const [busyCloseId, setBusyCloseId] = useState<number | null>(null);
  const [resultByResolution, setResultByResolution] = useState<Record<number, ResolutionResult | null>>({});

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setForm((prev) => ({
        ...prev,
        ag,
      }));
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [ag]);

  const fetchResolutions = useCallback(async () => {
    setState("loading");
    setError(null);

    let lastError: unknown = null;

    for (const endpoint of RESOLUTION_ENDPOINT_CANDIDATES) {
      try {
        const finalEndpoint = ag ? `${endpoint}?ag=${ag}` : endpoint;
        const res = await api.get(finalEndpoint);
        const rawRows = extractRows<Record<string, unknown>>(res?.data);

        const normalized = rawRows
          .map(normalizeResolutionItem)
          .filter((item) => item.id > 0)
          .sort((a, b) => {
            const ao = a.ordre ?? a.id;
            const bo = b.ordre ?? b.id;
            if (ao !== bo) return ao - bo;
            return a.id - b.id;
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
    setError(getErrorMessage(lastError, "Impossible de charger la liste des résolutions."));
  }, [ag]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchResolutions();
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [fetchResolutions]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    return rows.filter((item) => {
      const matchesStatus = statusFilter === "TOUS" ? true : item.statut === statusFilter;
      if (!matchesStatus) return false;
      if (!q) return true;

      const haystack = [
        item.numero,
        item.assemblee_ref,
        item.assemblee_titre,
        item.titre,
        item.texte ?? "",
        item.type_majorite ?? "",
        item.tantieme_categorie ?? "",
        item.travaux_dossier_titre ?? "",
        item.statut,
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(q);
    });
  }, [rows, query, statusFilter]);

  const stats = useMemo(() => {
    return {
      total: rows.length,
      adoptees: rows.filter((x) => x.statut === "ADOPTEE").length,
      rejetees: rows.filter((x) => x.statut === "REJETEE").length,
      attente: rows.filter((x) => x.statut === "EN_ATTENTE").length,
      cloturees: rows.filter((x) => x.cloturee).length,
      avecBudget: rows.filter((x) => x.budget_vote !== null && x.budget_vote !== undefined).length,
    };
  }, [rows]);

  const isLoading = state === "loading";

  function updateField<K extends keyof ResolutionFormValues>(field: K, value: ResolutionFormValues[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function resetForm() {
    setForm({
      ...INITIAL_FORM,
      ag,
    });
  }

  function suggestNextOrdre() {
    const maxOrdre = rows.reduce((max, item) => {
      const ord = item.ordre ?? 0;
      return ord > max ? ord : max;
    }, 0);

    setForm((prev) => ({
      ...prev,
      ag,
      ordre: maxOrdre > 0 ? maxOrdre + 1 : 1,
    }));
    setShowCreateForm(true);
  }

  function validateForm() {
    if (!form.ag) return "L’identifiant de l’assemblée est obligatoire.";
    if (!form.ordre) return "L’ordre de la résolution est obligatoire.";
    if (!form.titre.trim()) return "Le titre de la résolution est obligatoire.";
    if (!form.texte.trim()) return "Le texte de la résolution est obligatoire.";

    if (form.budget_vote.trim()) {
      const n = Number(form.budget_vote);
      if (!Number.isFinite(n) || n < 0) return "Le budget voté doit être un nombre positif ou vide.";
    }

    return null;
  }

  async function handleCreateResolution() {
    const validationError = validateForm();
    if (validationError) {
      setMessage({ kind: "error", text: validationError });
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const payload = buildCreatePayload(form);
      await api.post(RESOLUTION_ENDPOINT, payload);

      setMessage({ kind: "success", text: "Résolution créée avec succès." });
      resetForm();
      setShowCreateForm(false);
      await fetchResolutions();
    } catch (e) {
      setMessage({
        kind: "error",
        text: getErrorMessage(e, "Impossible de créer la résolution."),
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleComputeResult(item: ResolutionItem) {
    setBusyResultId(item.id);
    setMessage(null);

    try {
      const res = await api.get(`/api/ag/resolutions/${item.id}/resultat/`);
      const normalized = normalizeResolutionResult(res.data);

      if (!normalized) throw new Error("Résultat de résolution introuvable.");

      setResultByResolution((prev) => ({
        ...prev,
        [item.id]: normalized,
      }));

      setMessage({
        kind: "success",
        text: `Résultat calculé pour ${item.numero} : ${normalized.decision}.`,
      });
    } catch (e) {
      setMessage({
        kind: "error",
        text: getErrorMessage(e, "Impossible de calculer le résultat de la résolution."),
      });
    } finally {
      setBusyResultId(null);
    }
  }

  async function handleCloseResolution(item: ResolutionItem) {
    const ok = window.confirm(`Voulez-vous vraiment clôturer ${item.numero} ?`);
    if (!ok) return;

    setBusyCloseId(item.id);
    setMessage(null);

    try {
      const payload =
        item.budget_vote !== null && item.budget_vote !== undefined ? { budget_vote: item.budget_vote } : {};

      const res = await api.post(`/api/ag/resolutions/${item.id}/cloturer/`, payload);
      const decision = String(res?.data?.decision ?? "").trim().toUpperCase();

      setMessage({
        kind: "success",
        text:
          decision === "ADOPTEE"
            ? `${item.numero} a été clôturée et adoptée.`
            : decision === "REJETEE"
              ? `${item.numero} a été clôturée et rejetée.`
              : `${item.numero} a été clôturée avec succès.`,
      });

      await fetchResolutions();
    } catch (e) {
      setMessage({
        kind: "error",
        text: getErrorMessage(e, "Impossible de clôturer la résolution."),
      });
    } finally {
      setBusyCloseId(null);
    }
  }

  return (
    <PageShell>
      <PageHeader
        title={ag ? `Résolutions de l’assemblée ${ag}` : "Résolutions"}
        subtitle={
          ag
            ? "Créez, suivez, analysez et clôturez les résolutions de cette assemblée générale dans une lecture plus cohérente avec AGList et AGDetail."
            : "Supervisez les résolutions rattachées aux assemblées générales, leur majorité, leur résultat et leur impact métier."
        }
        right={
          <div style={pageHeaderActionsStyle}>
            {ag ? (
              <AppButton onClick={() => navigate(`/ag/assemblees/${ag}`)} variant="secondary">
                Retour à l’assemblée
              </AppButton>
            ) : (
              <AppButton onClick={() => navigate("/ag")} variant="secondary">
                Retour au module AG
              </AppButton>
            )}

            <AppButton onClick={suggestNextOrdre} variant="primary">
              Ajouter une résolution
            </AppButton>

            {ag ? (
              <AppButton onClick={() => navigate(`/ag/assemblees/${ag}/votes`)} variant="secondary">
                Voir les votes
              </AppButton>
            ) : (
              <AppButton onClick={() => navigate("/ag/assemblees")} variant="secondary">
                Voir les assemblées
              </AppButton>
            )}
          </div>
        }
      />

      <HeroSection
        title={ag ? `Cockpit des résolutions de l’assemblée ${ag}` : "Cockpit des résolutions"}
        text={
          ag
            ? "Cette vue centralise la création, le suivi, le calcul des résultats et la clôture des résolutions de l’assemblée active, avec une grammaire visuelle alignée sur le reste du module AG."
            : "Cette vue centralise la création, l’analyse, le calcul des résultats et la clôture des résolutions rattachées aux assemblées générales."
        }
        primaryLabel="Ajouter une résolution"
        primaryAction={suggestNextOrdre}
        secondaryLabel={ag ? "Retour à l’assemblée" : "Voir les assemblées"}
        secondaryAction={() => (ag ? navigate(`/ag/assemblees/${ag}`) : navigate("/ag/assemblees"))}
      >
        <div style={heroAsidePanelStyle}>
          <div style={heroAsideTitleStyle}>Lecture rapide</div>
          <div style={heroAsideTextStyle}>
            Utilisez cette vue pour suivre les décisions soumises à l’assemblée, leur majorité,
            leur résultat pondéré et leur état de clôture sans surcharge visuelle.
          </div>

          <div style={heroAsideDividerStyle} />

          <div style={heroAsideMiniNoteStyle}>
            Les indicateurs détaillés restent dans les blocs du dessous pour éviter les répétitions
            et garder une vraie cohérence transverse avec AGList et AGDetail.
          </div>
        </div>
      </HeroSection>

      {message ? <AlertBox kind={message.kind}>{message.text}</AlertBox> : null}

      {state === "error" && error ? (
        <AlertBox kind="error" title="Impossible de charger la liste des résolutions.">
          {error}
        </AlertBox>
      ) : null}

      {showCreateForm ? (
        <SectionCard
          title="Créer une résolution"
          subtitle="Renseignez les champs obligatoires pour enregistrer une nouvelle résolution dans l’assemblée concernée."
          right={
            <SmallButton onClick={() => setShowCreateForm(false)} disabled={saving}>
              Fermer
            </SmallButton>
          }
        >
          <div style={formIntroBoxStyle}>
            Cette zone permet d’ajouter rapidement une résolution au cycle AG, avec son ordre,
            son texte, sa majorité et, si nécessaire, son budget voté.
          </div>

          <div className="ag-resolutions-form-grid" style={formGridStyle}>
            <div style={fieldStyle}>
              <label style={labelStyle}>Assemblée (ID) *</label>
              <input
                type="number"
                min="1"
                step="1"
                value={form.ag ?? ""}
                onChange={(e) => updateField("ag", toNumberOrNull(e.target.value))}
                placeholder="Ex. 11"
                style={inputStyle}
                disabled={Boolean(ag)}
              />
              <div style={hintStyle}>
                {ag
                  ? `Cette résolution sera créée dans l’assemblée ${ag}.`
                  : "Saisissez l’identifiant numérique de l’assemblée concernée."}
              </div>
            </div>

            <div style={fieldStyle}>
              <label style={labelStyle}>Ordre *</label>
              <input
                type="number"
                min="1"
                step="1"
                value={form.ordre ?? ""}
                onChange={(e) => updateField("ordre", toNumberOrNull(e.target.value))}
                placeholder="Ex. 1"
                style={inputStyle}
              />
              <div style={hintStyle}>Ordre d’apparition de la résolution dans l’assemblée générale.</div>
            </div>

            <div style={fieldFullStyle}>
              <label style={labelStyle}>Titre *</label>
              <input
                value={form.titre}
                onChange={(e) => updateField("titre", e.target.value)}
                placeholder="Ex. Validation des comptes de l’exercice"
                style={inputStyle}
              />
            </div>

            <div style={fieldFullStyle}>
              <label style={labelStyle}>Texte *</label>
              <textarea
                value={form.texte}
                onChange={(e) => updateField("texte", e.target.value)}
                placeholder="Texte détaillé de la résolution"
                style={textareaStyle}
              />
            </div>

            <div style={fieldStyle}>
              <label style={labelStyle}>Type de majorité *</label>
              <select
                value={form.type_majorite}
                onChange={(e) => updateField("type_majorite", e.target.value as MajoriteType)}
                style={inputStyle}
              >
                <option value="SIMPLE">Majorité simple</option>
                <option value="ABSOLUE">Majorité absolue</option>
                <option value="QUALIFIEE_2_3">Majorité qualifiée 2/3</option>
                <option value="UNANIMITE">Unanimité</option>
              </select>
            </div>

            <div style={fieldStyle}>
              <label style={labelStyle}>Budget voté (optionnel)</label>
              <input
                value={form.budget_vote}
                onChange={(e) => updateField("budget_vote", e.target.value)}
                placeholder="Ex. 1400000"
                style={inputStyle}
              />
            </div>
          </div>

          <div style={formActionsStyle}>
            <SmallButton onClick={resetForm} disabled={saving}>
              Réinitialiser
            </SmallButton>
            <SmallButton primary onClick={() => void handleCreateResolution()} disabled={saving}>
              {saving ? "Création..." : "Créer la résolution"}
            </SmallButton>
          </div>
        </SectionCard>
      ) : null}

      <div className="ag-resolutions-kpi-grid">
        <SummaryCard
          label="Résolutions"
          value={stats.total}
          helper="Nombre total de résolutions visibles dans la sélection courante."
          isLoading={isLoading}
          tone="neutral"
        />
        <SummaryCard
          label="Adoptées"
          value={stats.adoptees}
          helper="Résolutions validées dans le cycle AG."
          isLoading={isLoading}
          tone="success"
        />
        <SummaryCard
          label="Rejetées"
          value={stats.rejetees}
          helper="Résolutions refusées après calcul et clôture."
          isLoading={isLoading}
          tone="danger"
        />
        <SummaryCard
          label="En attente"
          value={stats.attente}
          helper="Résolutions encore non tranchées ou non clôturées."
          isLoading={isLoading}
          tone="warning"
        />
      </div>

      <SectionCard
        title="Recherche et supervision"
        subtitle="Filtrez les résolutions par contenu, statut, majorité ou assemblée."
        right={
          <div style={badgeRowStyle}>
            <Badge text={`${filtered.length} affichée(s)`} kind="info" />
            <Badge text={`${stats.cloturees} clôturée(s)`} kind="success" />
            <Badge text={`${stats.avecBudget} avec budget`} kind="neutral" />
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
                placeholder="Résolution, assemblée, majorité, dossier travaux..."
                style={searchInputStyle}
              />
            </div>

            <div style={fieldGroupCompactStyle}>
              <div style={fieldLabelStyle}>Statut</div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as "TOUS" | ResolutionStatus)}
                style={selectInputStyle}
              >
                <option value="TOUS">Tous les statuts</option>
                <option value="ADOPTEE">Adoptées</option>
                <option value="REJETEE">Rejetées</option>
                <option value="EN_ATTENTE">En attente</option>
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

              <SmallButton onClick={() => void fetchResolutions()} disabled={isLoading}>
                {isLoading ? "Actualisation..." : "Actualiser"}
              </SmallButton>
            </div>
          </div>

          <div style={toolbarMetaStyle}>
            {isLoading ? "Chargement des résolutions..." : `${filtered.length} résolution(s) affichée(s)`}
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Liste des résolutions"
        subtitle="Lecture métier des décisions, de leur cadre, de leur contenu, de leur résultat et de leurs actions."
        right={<Badge text="Suivi métier" kind="info" />}
        flush
      >
        <div style={tableWrapStyle}>
          {isLoading ? (
            <div style={loadingWrapStyle}>Chargement des résolutions...</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 18 }}>
              <EmptyState
                title={rows.length === 0 ? "Aucune résolution enregistrée" : "Aucune résolution à afficher"}
                text={
                  rows.length === 0
                    ? "Aucune résolution n’a encore été trouvée pour cette sélection."
                    : "Aucune résolution ne correspond à la recherche ou aux filtres sélectionnés."
                }
                actionLabel="Créer une résolution"
                onAction={suggestNextOrdre}
              />
            </div>
          ) : (
            <table style={tableStyle}>
              <thead>
                <tr style={{ textAlign: "left" }}>
                  <th style={thStyle}>Résolution</th>
                  <th style={thStyle}>Assemblée</th>
                  <th style={thStyle}>Contenu</th>
                  <th style={thStyle}>Cadre</th>
                  <th style={thStyle}>Budget voté</th>
                  <th style={thStyle}>État</th>
                  <th style={thStyle}>Actions métier</th>
                </tr>
              </thead>

              <tbody>
                {filtered.map((item) => {
                  const result = resultByResolution[item.id];
                  const statusMeta = getResolutionStatusMeta(item);

                  return (
                    <tr key={item.id} style={rowBaseStyle}>
                      <td style={tdMonoStyle}>
                        <div style={{ fontWeight: 900 }}>{item.numero}</div>
                        {item.ordre !== null && item.ordre !== undefined ? (
                          <div style={{ marginTop: 4, fontSize: 12, color: "#64748b" }}>Ordre {item.ordre}</div>
                        ) : null}
                      </td>

                      <td style={tdStyle}>
                        <div style={titleCellStyle}>
                          <div style={titleMainStyle}>{item.assemblee_ref}</div>
                          <div style={titleSubStyle}>{item.assemblee_titre}</div>
                        </div>
                      </td>

                      <td style={tdStyle}>
                        <div style={titleCellStyle}>
                          <div style={titleMainStyle}>{item.titre}</div>
                          {item.texte ? <div style={titleSubStyle}>{truncateText(item.texte, 150)}</div> : null}
                        </div>

                        {result ? (
                          <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
                            <Badge
                              text={`Décision : ${result.decision}`}
                              kind={result.decision === "ADOPTEE" ? "success" : "danger"}
                            />
                            <Badge text={`Exprimés : ${result.tantiemes?.exprimes ?? 0}`} kind="info" />
                            <Badge text={`Pour : ${result.tantiemes?.pour ?? 0}`} kind="success" />
                            <Badge text={`Contre : ${result.tantiemes?.contre ?? 0}`} kind="danger" />
                            <Badge
                              text={`Ratio : ${formatPercent(result.tantiemes?.ratio_pour_exprimes ?? 0)}`}
                              kind="neutral"
                            />
                          </div>
                        ) : null}
                      </td>

                      <td style={tdStyle}>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          {item.type_majorite ? <Badge text={item.type_majorite} kind="neutral" /> : null}
                          {item.tantieme_categorie ? <Badge text={item.tantieme_categorie} kind="info" /> : null}
                          {item.travaux_dossier_titre ? <Badge text={item.travaux_dossier_titre} kind="warning" /> : null}
                        </div>
                      </td>

                      <td style={tdStrongStyle}>{formatMoneyFCFA(item.budget_vote)}</td>

                      <td style={tdStyle}>
                        <div style={titleCellStyle}>
                          <Badge text={statusMeta.label} kind={statusMeta.kind} />
                          <div style={titleSubStyle}>{statusMeta.description}</div>
                        </div>
                      </td>

                      <td style={tdStyle}>
                        <div style={actionsWrapStyle}>
                          <Link
                            to={item.assemblee_id ? `/ag/assemblees/${item.assemblee_id}` : "/ag/assemblees"}
                            style={primaryMiniLinkStyle}
                          >
                            Voir l’assemblée
                          </Link>

                          {!item.cloturee ? (
                            <>
                              <button
                                type="button"
                                onClick={() => void handleComputeResult(item)}
                                disabled={busyResultId === item.id || busyCloseId === item.id}
                                style={{
                                  ...secondaryMiniButtonStyle,
                                  opacity: busyResultId === item.id || busyCloseId === item.id ? 0.6 : 1,
                                  cursor:
                                    busyResultId === item.id || busyCloseId === item.id ? "not-allowed" : "pointer",
                                }}
                              >
                                {busyResultId === item.id ? "Calcul..." : "Calculer"}
                              </button>

                              <button
                                type="button"
                                onClick={() => void handleCloseResolution(item)}
                                disabled={busyCloseId === item.id || busyResultId === item.id}
                                style={{
                                  ...dangerMiniButtonStyle,
                                  opacity: busyCloseId === item.id || busyResultId === item.id ? 0.6 : 1,
                                  cursor:
                                    busyCloseId === item.id || busyResultId === item.id ? "not-allowed" : "pointer",
                                }}
                              >
                                {busyCloseId === item.id ? "Clôture..." : "Clôturer"}
                              </button>
                            </>
                          ) : null}
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

      <AlertBox kind="info" title="Lecture produit">
        Cette page devient le cockpit dédié aux décisions de l’assemblée générale : création,
        analyse, calcul du résultat, clôture et lecture consolidée des éléments utiles au procès-verbal.
      </AlertBox>

      <style>{`
        .ag-resolutions-form-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
        }

        .ag-resolutions-kpi-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 14px;
          min-width: 0;
        }

        @media (max-width: 1280px) {
          .ag-resolutions-kpi-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 980px) {
          .ag-resolutions-form-grid,
          .ag-resolutions-kpi-grid {
            grid-template-columns: 1fr !important;
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
  display: "flex",
  alignItems: "flex-end",
  justifyContent: "space-between",
  gap: 16,
  flexWrap: "wrap",
  minWidth: 0,
};

const pageHeaderCopyStyle: CSSProperties = {
  display: "grid",
  gap: 8,
  minWidth: 0,
};

const pageHeaderActionsStyle: CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
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
  maxWidth: 980,
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

const formIntroBoxStyle: CSSProperties = {
  padding: 14,
  borderRadius: 14,
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
  color: "#475569",
  fontSize: 13,
  lineHeight: 1.6,
  marginBottom: 14,
};

const formGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 14,
};

const fieldStyle: CSSProperties = {
  display: "grid",
  gap: 8,
};

const fieldFullStyle: CSSProperties = {
  ...fieldStyle,
  gridColumn: "1 / -1",
};

const labelStyle: CSSProperties = {
  fontSize: 13,
  fontWeight: 800,
  color: "#334155",
};

const inputStyle: CSSProperties = {
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

const textareaStyle: CSSProperties = {
  ...inputStyle,
  minHeight: 120,
  resize: "vertical",
};

const hintStyle: CSSProperties = {
  fontSize: 12,
  color: "#64748b",
  lineHeight: 1.45,
};

const formActionsStyle: CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  gap: 10,
  flexWrap: "wrap",
  marginTop: 18,
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
  minWidth: 1480,
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

const tdStyle: CSSProperties = {
  padding: "15px 12px",
  borderBottom: "1px solid #f1f5f9",
  verticalAlign: "middle",
  color: "#0f172a",
  fontSize: 14,
};

const tdMonoStyle: CSSProperties = {
  ...tdStyle,
  fontWeight: 800,
  whiteSpace: "nowrap",
};

const tdStrongStyle: CSSProperties = {
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

const secondaryMiniButtonStyle: CSSProperties = {
  padding: "7px 10px",
  borderRadius: 10,
  border: "1px solid #dbeafe",
  background: "#eff6ff",
  fontSize: 12,
  fontWeight: 800,
  color: "#1d4ed8",
};

const dangerMiniButtonStyle: CSSProperties = {
  padding: "7px 10px",
  borderRadius: 10,
  border: "1px solid #fecaca",
  background: "#fef2f2",
  fontSize: 12,
  fontWeight: 800,
  color: "#991b1b",
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