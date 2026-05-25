import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../../api/axios";

type LoadState = "idle" | "loading" | "success" | "error";
type VoteChoice = "POUR" | "CONTRE" | "ABSTENTION";
type FlashKind = "success" | "error" | "info";
type BadgeKind = "neutral" | "success" | "warning" | "danger" | "info";

type ResolutionOption = {
  id: number;
  label: string;
};

type PresenceOption = {
  id: number;
  ag: number;
  lot: number;
  lot_reference: string;
  tantiemes: number;
  is_zero_tantieme: boolean;
  present_ou_represente: boolean;
  representant_nom: string;
};

type VoteItem = {
  id: number;
  resolution: number;
  resolution_label: string;
  lot: number;
  lot_reference: string;
  choix: VoteChoice;
  tantiemes: number;
  is_zero_tantieme: boolean;
  created_at?: string | null;
};

type VoteFormValues = {
  resolution: number | null;
  lot: number | null;
  choix: VoteChoice;
};

type DRFPage<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

const INITIAL_FORM: VoteFormValues = {
  resolution: null,
  lot: null,
  choix: "POUR",
};

const VOTES_ENDPOINT = "/api/ag/votes/";
const RESOLUTIONS_ENDPOINT = "/api/ag/resolutions/";
const PRESENCES_ENDPOINT = "/api/ag/presences/";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function isPaginatedResponse<T = unknown>(value: unknown): value is DRFPage<T> {
  return isRecord(value) && Array.isArray(value.results) && typeof value.count === "number";
}

function toNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;

  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function toBoolean(value: unknown): boolean {
  if (typeof value === "boolean") return value;

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return ["true", "1", "yes", "oui"].includes(normalized);
  }

  if (typeof value === "number") return value === 1;

  return false;
}

function pickString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }

  return "";
}

function normalizeChoice(value: unknown): VoteChoice {
  const s = String(value ?? "").trim().toUpperCase();

  if (s === "CONTRE") return "CONTRE";
  if (s === "ABSTENTION") return "ABSTENTION";

  return "POUR";
}

function formatNumber(value?: number | null): string {
  if (value === null || value === undefined) return "0";

  return new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDateTimeShort(value?: string | null): string {
  if (!value) return "—";

  const d = new Date(value);

  if (!Number.isNaN(d.getTime())) {
    return `${d.toLocaleDateString("fr-FR")} ${d.toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
    })}`;
  }

  return value;
}

function extractBlockingReasons(data: unknown): string[] {
  if (!isRecord(data)) return [];

  const value = data.blocking_reasons;

  if (!Array.isArray(value)) return [];

  return value.filter(
    (item): item is string => typeof item === "string" && item.trim().length > 0,
  );
}

function getErrorMessage(error: unknown, fallback: string) {
  const err = error as {
    response?: {
      data?: {
        detail?: string | string[];
        message?: string;
        errors?: Record<string, string[]>;
        blocking_reasons?: string[];
        [key: string]: unknown;
      };
    };
    message?: string;
  };

  const data = err?.response?.data;
  const reasons = extractBlockingReasons(data);

  if (reasons.length > 0) return reasons.join(" ");

  if (typeof data?.detail === "string" && data.detail.trim()) return data.detail;
  if (Array.isArray(data?.detail) && typeof data.detail[0] === "string") return data.detail[0];
  if (typeof data?.message === "string" && data.message.trim()) return data.message;

  if (data?.errors && typeof data.errors === "object") {
    const firstEntry = Object.values(data.errors)[0];

    if (Array.isArray(firstEntry) && typeof firstEntry[0] === "string") {
      return firstEntry[0];
    }
  }

  if (isRecord(data)) {
    for (const value of Object.values(data)) {
      if (Array.isArray(value) && typeof value[0] === "string") return value[0];
      if (typeof value === "string" && value.trim()) return value;
    }
  }

  return err?.message || fallback;
}

function normalizeVoteItem(raw: unknown): VoteItem {
  const row = isRecord(raw) ? raw : {};
  const tantiemes = toNumberOrNull(row.tantiemes) ?? 0;

  return {
    id: toNumberOrNull(row.id) ?? toNumberOrNull(row.pk) ?? 0,
    resolution: toNumberOrNull(row.resolution) ?? toNumberOrNull(row.resolution_id) ?? 0,
    resolution_label:
      pickString(
        row.resolution_label,
        row.resolution_titre,
        row.resolution_nom,
        row.resolution_reference,
        row.resolution_intitule,
        isRecord(row.resolution_obj)
          ? pickString(
              row.resolution_obj.titre,
              row.resolution_obj.title,
              row.resolution_obj.intitule,
              row.resolution_obj.nom,
            )
          : undefined,
      ) || `Résolution #${toNumberOrNull(row.resolution) ?? 0}`,
    lot: toNumberOrNull(row.lot) ?? toNumberOrNull(row.lot_id) ?? 0,
    lot_reference:
      pickString(
        row.lot_reference,
        row.reference_lot,
        row.lot_ref,
        isRecord(row.lot_obj) ? row.lot_obj.reference : undefined,
      ) || `Lot #${toNumberOrNull(row.lot) ?? 0}`,
    choix: normalizeChoice(row.choix),
    tantiemes,
    is_zero_tantieme: toBoolean(row.is_zero_tantieme) || tantiemes <= 0,
    created_at: pickString(row.created_at, row.date_vote, row.created, row.timestamp) || null,
  };
}

function normalizeResolutionOption(raw: unknown, index: number): ResolutionOption {
  const row = isRecord(raw) ? raw : {};
  const id = toNumberOrNull(row.id) ?? toNumberOrNull(row.pk) ?? index + 1;
  const ordre = toNumberOrNull(row.ordre) ?? toNumberOrNull(row.numero);

  return {
    id,
    label:
      (ordre !== null ? `R${ordre} — ` : "") +
      (pickString(row.titre, row.title, row.intitule, row.nom, row.objet, row.reference) ||
        `Résolution #${id}`),
  };
}

function normalizePresenceOption(raw: unknown): PresenceOption {
  const row = isRecord(raw) ? raw : {};
  const tantiemes = toNumberOrNull(row.tantiemes) ?? 0;

  return {
    id: toNumberOrNull(row.id) ?? 0,
    ag: toNumberOrNull(row.ag) ?? 0,
    lot: toNumberOrNull(row.lot) ?? 0,
    lot_reference:
      pickString(
        row.lot_reference,
        row.reference_lot,
        row.lot_ref,
        isRecord(row.lot_obj) ? row.lot_obj.reference : undefined,
      ) || `Lot #${toNumberOrNull(row.lot) ?? 0}`,
    tantiemes,
    is_zero_tantieme: toBoolean(row.is_zero_tantieme) || tantiemes <= 0,
    present_ou_represente: toBoolean(row.present_ou_represente),
    representant_nom: pickString(row.representant_nom, row.present_nom, row.nom_representant),
  };
}

function extractVoteRows(data: unknown): VoteItem[] {
  if (isPaginatedResponse<Record<string, unknown>>(data)) {
    return data.results.map(normalizeVoteItem).filter((item) => item.id > 0);
  }

  if (Array.isArray(data)) {
    return data.map(normalizeVoteItem).filter((item) => item.id > 0);
  }

  if (isRecord(data)) {
    const candidates = [data.results, data.items, data.votes, data.data];

    for (const candidate of candidates) {
      if (Array.isArray(candidate)) {
        return candidate.map(normalizeVoteItem).filter((item) => item.id > 0);
      }
    }
  }

  return [];
}

function extractResolutionRows(data: unknown): ResolutionOption[] {
  if (isPaginatedResponse<Record<string, unknown>>(data)) {
    return data.results.map(normalizeResolutionOption).filter((item) => item.id > 0);
  }

  if (Array.isArray(data)) {
    return data.map(normalizeResolutionOption).filter((item) => item.id > 0);
  }

  if (isRecord(data)) {
    const candidates = [data.results, data.items, data.resolutions, data.data];

    for (const candidate of candidates) {
      if (Array.isArray(candidate)) {
        return candidate.map(normalizeResolutionOption).filter((item) => item.id > 0);
      }
    }
  }

  return [];
}

function extractPresenceRows(data: unknown): PresenceOption[] {
  if (isPaginatedResponse<Record<string, unknown>>(data)) {
    return data.results.map(normalizePresenceOption).filter((item) => item.id > 0);
  }

  if (Array.isArray(data)) {
    return data.map(normalizePresenceOption).filter((item) => item.id > 0);
  }

  if (isRecord(data)) {
    const candidates = [data.results, data.items, data.presences, data.data];

    for (const candidate of candidates) {
      if (Array.isArray(candidate)) {
        return candidate.map(normalizePresenceOption).filter((item) => item.id > 0);
      }
    }
  }

  return [];
}

async function fetchResolutionsForAg(agId: string | number): Promise<ResolutionOption[]> {
  const res = await api.get<unknown>(`${RESOLUTIONS_ENDPOINT}?ag=${agId}`);
  return extractResolutionRows(res.data);
}

async function fetchVotesForResolution(
  resolutionId: string | number,
  resolutionLabelMap: Map<number, string>,
): Promise<VoteItem[]> {
  const res = await api.get<unknown>(`${VOTES_ENDPOINT}?resolution=${resolutionId}`);
  const rows = extractVoteRows(res.data);

  return rows.map((item) => ({
    ...item,
    resolution_label: resolutionLabelMap.get(item.resolution) || item.resolution_label,
  }));
}

async function fetchPresencesForAg(agId: string | number): Promise<PresenceOption[]> {
  const res = await api.get<unknown>(`${PRESENCES_ENDPOINT}?ag=${agId}`);
  return extractPresenceRows(res.data);
}

function PageShell({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        display: "grid",
        gap: 20,
        width: "100%",
        minWidth: 0,
        overflowX: "hidden",
      }}
    >
      {children}
    </div>
  );
}

function PageHeader(props: { title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "space-between",
        gap: 16,
        flexWrap: "wrap",
        minWidth: 0,
      }}
    >
      <div style={{ display: "grid", gap: 8, minWidth: 0 }}>
        <span style={pageEyebrowStyle}>Pilotage du module AG</span>
        <h1 style={pageTitleStyle}>{props.title}</h1>
        {props.subtitle ? <p style={pageSubtitleStyle}>{props.subtitle}</p> : null}
      </div>

      {props.right ? <div>{props.right}</div> : null}
    </div>
  );
}

function HeroSection(props: {
  title: string;
  text: string;
  primaryLabel: string;
  primaryAction: () => void;
  secondaryLabel: string;
  secondaryAction: () => void;
  rightPanel?: ReactNode;
}) {
  return (
    <section style={heroSectionStyle}>
      <div style={heroMainStyle}>
        <div style={heroPillStyle}>ASSEMBLÉES GÉNÉRALES · VOTES</div>
        <div style={heroTitleStyle}>{props.title}</div>
        <div style={heroTextStyle}>{props.text}</div>

        <div style={heroActionsStyle}>
          <button type="button" onClick={props.primaryAction} style={heroPrimaryButtonStyle}>
            {props.primaryLabel}
          </button>
          <button type="button" onClick={props.secondaryAction} style={heroSecondaryButtonStyle}>
            {props.secondaryLabel}
          </button>
        </div>
      </div>

      {props.rightPanel ? <div style={heroAsideStyle}>{props.rightPanel}</div> : null}
    </section>
  );
}

function SectionCard(props: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  children: ReactNode;
  minHeight?: number;
}) {
  return (
    <section
      style={{
        border: "1px solid #e2e8f0",
        borderRadius: 24,
        padding: 20,
        background: "#ffffff",
        boxShadow: "0 10px 28px rgba(15, 23, 42, 0.05)",
        minHeight: props.minHeight,
        minWidth: 0,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
          marginBottom: 16,
          minWidth: 0,
        }}
      >
        <div style={{ display: "grid", gap: 6, minWidth: 0 }}>
          <div style={{ fontSize: 17, fontWeight: 900, color: "#0f172a" }}>
            {props.title}
          </div>
          {props.subtitle ? <div style={cardSubtitleStyle}>{props.subtitle}</div> : null}
        </div>

        {props.right ? <div>{props.right}</div> : null}
      </div>

      {props.children}
    </section>
  );
}

function SummaryCard(props: {
  label: string;
  value: string | number;
  helper: string;
  isLoading?: boolean;
  tone?: "neutral" | "success" | "warning" | "info";
}) {
  const tone =
    props.tone === "success"
      ? { bg: "#ecfdf5", border: "#bbf7d0", label: "#166534", value: "#065f46" }
      : props.tone === "warning"
        ? { bg: "#fffbeb", border: "#fde68a", label: "#b45309", value: "#92400e" }
        : props.tone === "info"
          ? { bg: "#eff6ff", border: "#bfdbfe", label: "#2563eb", value: "#1d4ed8" }
          : { bg: "#f8fafc", border: "#e2e8f0", label: "#475569", value: "#0f172a" };

  return (
    <div
      style={{
        border: `1px solid ${tone.border}`,
        borderRadius: 18,
        padding: 16,
        background: tone.bg,
        display: "grid",
        gap: 10,
        minWidth: 0,
      }}
    >
      <div
        style={{
          fontSize: 12,
          textTransform: "uppercase",
          letterSpacing: 0.5,
          fontWeight: 800,
          color: tone.label,
        }}
      >
        {props.label}
      </div>

      <div
        style={{
          fontSize: 28,
          fontWeight: 900,
          lineHeight: 1,
          color: tone.value,
        }}
      >
        {props.isLoading ? "…" : props.value}
      </div>

      <div style={{ fontSize: 13, color: "#64748b", lineHeight: 1.55 }}>{props.helper}</div>
    </div>
  );
}

function AppButton(props: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "danger";
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

function AlertBox(props: { kind: FlashKind; title?: string; children: ReactNode }) {
  const tone =
    props.kind === "error"
      ? { bg: "#fef2f2", border: "#fecaca", text: "#991b1b" }
      : props.kind === "success"
        ? { bg: "#ecfdf5", border: "#a7f3d0", text: "#166534" }
        : { bg: "#eff6ff", border: "#bfdbfe", text: "#1d4ed8" };

  return (
    <div
      style={{
        padding: 14,
        borderRadius: 16,
        background: tone.bg,
        border: `1px solid ${tone.border}`,
        color: tone.text,
        lineHeight: 1.55,
      }}
    >
      {props.title ? <div style={{ fontWeight: 900, marginBottom: 6 }}>{props.title}</div> : null}
      <div style={{ fontSize: 13 }}>{props.children}</div>
    </div>
  );
}

function EmptyState(props: {
  title: string;
  text: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
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
      <div style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.55 }}>{props.text}</div>

      {props.actionLabel && props.onAction ? (
        <div style={{ marginTop: 12 }}>
          <AppButton onClick={props.onAction} variant="primary">
            {props.actionLabel}
          </AppButton>
        </div>
      ) : null}
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

function choiceBadge(choice: VoteChoice) {
  if (choice === "POUR") return <Badge text="Pour" kind="success" />;
  if (choice === "CONTRE") return <Badge text="Contre" kind="danger" />;

  return <Badge text="Abstention" kind="warning" />;
}

export default function AGVotes() {
  const navigate = useNavigate();
  const params = useParams();
  const agId = params.id ?? "";

  const [state, setState] = useState<LoadState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<{ kind: FlashKind; text: string } | null>(null);
  const [blockingReasons, setBlockingReasons] = useState<string[]>([]);

  const [rows, setRows] = useState<VoteItem[]>([]);
  const [resolutionOptions, setResolutionOptions] = useState<ResolutionOption[]>([]);
  const [presenceOptions, setPresenceOptions] = useState<PresenceOption[]>([]);
  const [form, setForm] = useState<VoteFormValues>(INITIAL_FORM);

  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const fetchVotes = useCallback(async () => {
    if (!agId) {
      setState("error");
      setError("Identifiant d’assemblée introuvable.");
      return;
    }

    setState("loading");
    setError(null);

    try {
      const [normalizedResolutions, normalizedPresences] = await Promise.all([
        fetchResolutionsForAg(agId),
        fetchPresencesForAg(agId),
      ]);

      const resolutionLabelMap = new Map<number, string>(
        normalizedResolutions.map((item) => [item.id, item.label]),
      );

      const voteGroups = await Promise.all(
        normalizedResolutions.map((resolution) =>
          fetchVotesForResolution(resolution.id, resolutionLabelMap),
        ),
      );

      const normalizedVotes = voteGroups
        .flat()
        .filter((item) => item.id > 0)
        .sort((a, b) => b.id - a.id);

      const votablePresences = normalizedPresences
        .filter((item) => item.present_ou_represente)
        .sort((a, b) =>
          a.lot_reference.localeCompare(b.lot_reference, "fr", {
            numeric: true,
          }),
        );

      setRows(normalizedVotes);
      setResolutionOptions(normalizedResolutions);
      setPresenceOptions(votablePresences);

      setForm((prev) => {
        const nextResolution =
          prev.resolution && normalizedResolutions.some((item) => item.id === prev.resolution)
            ? prev.resolution
            : normalizedResolutions[0]?.id ?? null;

        const nextLot =
          prev.lot && votablePresences.some((item) => item.lot === prev.lot)
            ? prev.lot
            : votablePresences[0]?.lot ?? null;

        return {
          ...prev,
          resolution: nextResolution,
          lot: nextLot,
        };
      });

      setState("success");
    } catch (e) {
      setRows([]);
      setResolutionOptions([]);
      setPresenceOptions([]);
      setState("error");
      setError(getErrorMessage(e, "Impossible de charger les votes."));
    }
  }, [agId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchVotes();
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [fetchVotes]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    if (!q) return rows;

    return rows.filter((item) => {
      const haystack = [
        item.resolution_label,
        item.lot_reference,
        item.choix,
        item.is_zero_tantieme ? "zero tantieme poids nul" : "",
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(q);
    });
  }, [rows, query]);

  const stats = useMemo(() => {
    const pour = rows.filter((x) => x.choix === "POUR");
    const contre = rows.filter((x) => x.choix === "CONTRE");
    const abstention = rows.filter((x) => x.choix === "ABSTENTION");

    return {
      totalVotes: rows.length,
      pour: pour.length,
      contre: contre.length,
      abstention: abstention.length,
      tantiemesExprimes:
        pour.reduce((sum, x) => sum + x.tantiemes, 0) +
        contre.reduce((sum, x) => sum + x.tantiemes, 0),
      zeroTantieme: rows.filter((x) => x.is_zero_tantieme).length,
    };
  }, [rows]);

  const selectedPresence = useMemo(
    () => presenceOptions.find((item) => item.lot === form.lot) ?? null,
    [presenceOptions, form.lot],
  );

  const selectedResolution = useMemo(
    () => resolutionOptions.find((item) => item.id === form.resolution) ?? null,
    [resolutionOptions, form.resolution],
  );

  function resetForm() {
    setForm({
      resolution: resolutionOptions[0]?.id ?? null,
      lot: presenceOptions[0]?.lot ?? null,
      choix: "POUR",
    });
  }

  function validateForm() {
    if (!agId) return "Identifiant d’assemblée introuvable.";
    if (!form.resolution) return "La résolution est obligatoire.";
    if (!form.lot) return "Le lot votant est obligatoire.";
    if (!form.choix) return "Le choix du vote est obligatoire.";

    if (!presenceOptions.some((item) => item.lot === form.lot)) {
      return "Le lot sélectionné n’est pas présent ou représenté pour cette AG.";
    }

    return null;
  }

  async function handleSubmit() {
    const validationError = validateForm();

    if (validationError) {
      setMessage({ kind: "error", text: validationError });
      return;
    }

    setBusyAction("create");
    setMessage(null);
    setBlockingReasons([]);

    try {
      await api.post(VOTES_ENDPOINT, {
        resolution: form.resolution,
        lot: form.lot,
        choix: form.choix,
      });

      setMessage({ kind: "success", text: "Vote enregistré avec succès." });
      resetForm();
      await fetchVotes();
    } catch (e) {
      const err = e as { response?: { data?: unknown } };
      setBlockingReasons(extractBlockingReasons(err?.response?.data));
      setMessage({
        kind: "error",
        text: getErrorMessage(e, "Impossible d’enregistrer le vote."),
      });
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <PageShell>
      <PageHeader
        title="Votes de l’assemblée"
        subtitle="Enregistrez et consultez les votes des lots sur les résolutions de cette assemblée générale, avec une lecture claire du poids réellement exprimé et des cas à 0 tantième."
        right={
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <AppButton onClick={() => navigate(`/ag/assemblees/${agId}`)} variant="secondary">
              Retour au détail AG
            </AppButton>
          </div>
        }
      />

      <HeroSection
        title="Pilotage des votes AG"
        text="Saisissez les votes, contrôlez les tantièmes réellement exprimés et sécurisez la traçabilité des choix enregistrés sur chaque résolution."
        primaryLabel="Gérer les présences"
        primaryAction={() => navigate(`/ag/assemblees/${agId}/presences`)}
        secondaryLabel="Voir les résolutions"
        secondaryAction={() => navigate(`/ag/assemblees/${agId}/resolutions`)}
        rightPanel={
          <div style={heroAsidePanelStyle}>
            <div style={heroAsideTitleStyle}>Lecture métier du vote</div>
            <div style={heroAsideTextStyle}>
              Les votes sont saisis à partir des lots présents ou représentés. Le poids en tantièmes
              est calculé par le backend et les lots à 0 tantième restent tracés sans peser dans le
              résultat pondéré.
            </div>

            <div style={heroBadgeStackStyle}>
              <Badge text={`${resolutionOptions.length} résolution(s)`} kind="info" />
              <Badge text={`${presenceOptions.length} lot(s) votant(s)`} kind="neutral" />
              <Badge text={`${stats.zeroTantieme} vote(s) à 0 tantième`} kind="warning" />
            </div>
          </div>
        }
      />

      {state === "error" && error ? (
        <AlertBox kind="error" title="Chargement impossible">
          {error}
        </AlertBox>
      ) : null}

      {message ? <AlertBox kind={message.kind}>{message.text}</AlertBox> : null}

      {blockingReasons.length > 0 ? (
        <AlertBox kind="error" title="Blocages métier détectés">
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.6 }}>
            {blockingReasons.map((reason, index) => (
              <li key={`${reason}-${index}`}>{reason}</li>
            ))}
          </ul>
        </AlertBox>
      ) : null}

      <div className="ag-votes-kpi-grid">
        <SummaryCard
          label="Votes enregistrés"
          value={stats.totalVotes}
          helper="Nombre total de votes actuellement tracés."
          isLoading={state === "loading"}
          tone="neutral"
        />
        <SummaryCard
          label="Votes favorables"
          value={stats.pour}
          helper="Votes exprimés en faveur des résolutions."
          isLoading={state === "loading"}
          tone="success"
        />
        <SummaryCard
          label="Votes défavorables"
          value={stats.contre}
          helper="Votes exprimés contre les résolutions."
          isLoading={state === "loading"}
          tone="warning"
        />
        <SummaryCard
          label="Poids exprimé"
          value={formatNumber(stats.tantiemesExprimes)}
          helper="Somme pondérée des voix pour et contre."
          isLoading={state === "loading"}
          tone="info"
        />
      </div>

      <div className="ag-votes-kpi-grid ag-votes-kpi-grid-secondary">
        <SummaryCard
          label="Abstentions"
          value={stats.abstention}
          helper="Votes enregistrés sans prise de position pour ou contre."
          isLoading={state === "loading"}
          tone="neutral"
        />
        <SummaryCard
          label="Votes à 0 tantième"
          value={stats.zeroTantieme}
          helper="Ils restent tracés mais ne pèsent pas dans le calcul pondéré."
          isLoading={state === "loading"}
          tone="warning"
        />
      </div>

      <div className="ag-votes-main-grid">
        <SectionCard
          title="Enregistrer un vote"
          subtitle="Saisissez un vote à partir d’une résolution active et d’un lot présent ou représenté."
          right={<Badge text="Saisie métier" kind="info" />}
          minHeight={580}
        >
          <div style={{ display: "grid", gap: 14 }}>
            <div style={fieldStyle}>
              <label style={labelStyle}>Résolution</label>
              <select
                value={form.resolution ?? ""}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    resolution: toNumberOrNull(e.target.value),
                  }))
                }
                style={inputStyle}
              >
                <option value="">Sélectionner une résolution</option>
                {resolutionOptions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>

              {resolutionOptions.length === 0 ? (
                <div style={fieldHintStyle}>Aucune résolution chargée pour cette AG.</div>
              ) : selectedResolution ? (
                <div style={hintBoxStyle}>
                  <div style={hintTitleStyle}>Résolution sélectionnée</div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                    <Badge text={selectedResolution.label} kind="info" />
                  </div>
                </div>
              ) : (
                <div style={fieldHintStyle}>
                  Sélection métier : vous choisissez la résolution par son libellé, sans saisir son
                  identifiant à la main.
                </div>
              )}
            </div>

            <div style={fieldStyle}>
              <label style={labelStyle}>Lot votant</label>
              <select
                value={form.lot ?? ""}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    lot: toNumberOrNull(e.target.value),
                  }))
                }
                style={inputStyle}
              >
                <option value="">Sélectionner un lot présent / représenté</option>
                {presenceOptions.map((item) => (
                  <option key={item.id} value={item.lot}>
                    {item.lot_reference} — {formatNumber(item.tantiemes)} tantièmes
                    {item.representant_nom ? ` — ${item.representant_nom}` : ""}
                    {item.is_zero_tantieme ? " — 0 tantième" : ""}
                  </option>
                ))}
              </select>

              {presenceOptions.length === 0 ? (
                <div style={fieldHintStyle}>
                  Aucun lot présent ou représenté n’est disponible. Revenez dans l’écran Présences
                  pour marquer les lots votants.
                </div>
              ) : selectedPresence ? (
                <div style={hintBoxStyle}>
                  <div style={hintTitleStyle}>Lot sélectionné</div>

                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                    <Badge text={`Lot ${selectedPresence.lot_reference}`} kind="info" />
                    <Badge text={`${formatNumber(selectedPresence.tantiemes)} tantièmes`} kind="success" />
                    {selectedPresence.representant_nom ? (
                      <Badge text={`Représentant : ${selectedPresence.representant_nom}`} kind="neutral" />
                    ) : (
                      <Badge text="Présence directe" kind="neutral" />
                    )}
                    {selectedPresence.is_zero_tantieme ? <Badge text="0 tantième" kind="warning" /> : null}
                  </div>

                  {selectedPresence.is_zero_tantieme ? (
                    <div style={warningBoxStyle}>
                      Ce lot peut voter, mais son poids est nul dans le calcul pondéré.
                    </div>
                  ) : null}
                </div>
              ) : (
                <div style={fieldHintStyle}>
                  Choisissez un lot réellement présent ou représenté pour éviter les refus métier au
                  moment du vote.
                </div>
              )}
            </div>

            <div style={fieldStyle}>
              <label style={labelStyle}>Choix du vote</label>
              <select
                value={form.choix}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    choix: normalizeChoice(e.target.value),
                  }))
                }
                style={inputStyle}
              >
                <option value="POUR">Pour</option>
                <option value="CONTRE">Contre</option>
                <option value="ABSTENTION">Abstention</option>
              </select>
            </div>

            <div style={infoBoxStyle}>
              Le poids du vote en tantièmes est calculé par le backend à partir de la présence AG.
              Il n’est pas saisi manuellement dans ce formulaire.
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <AppButton
                onClick={() => void handleSubmit()}
                variant="primary"
                disabled={busyAction === "create" || resolutionOptions.length === 0 || presenceOptions.length === 0}
              >
                {busyAction === "create" ? "Enregistrement..." : "Enregistrer le vote"}
              </AppButton>

              <AppButton onClick={resetForm} disabled={busyAction !== null} variant="secondary">
                Réinitialiser
              </AppButton>

              <AppButton onClick={() => navigate(`/ag/assemblees/${agId}/presences`)} variant="secondary">
                Gérer les présences
              </AppButton>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="Votes enregistrés"
          subtitle="Historique visible des votes saisis, avec recherche par résolution, lot ou choix."
          right={<Badge text={`${filtered.length} vote(s)`} kind="info" />}
          minHeight={580}
        >
          <div style={{ display: "grid", gap: 12 }}>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher : résolution, lot, choix..."
              style={inputStyle}
            />

            {state === "loading" ? (
              <div style={{ color: "#6b7280", fontSize: 14 }}>Chargement des votes…</div>
            ) : filtered.length === 0 ? (
              <EmptyState
                title={rows.length === 0 ? "Aucun vote enregistré" : "Aucun vote à afficher"}
                text={
                  rows.length === 0
                    ? "Aucun vote n’a encore été trouvé pour cette assemblée."
                    : "Aucun vote ne correspond à la recherche actuelle."
                }
              />
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {filtered.map((item) => (
                  <div key={item.id} style={voteCardStyle}>
                    <div style={{ display: "grid", gap: 8, minWidth: 0 }}>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                        <div style={{ fontSize: 14, fontWeight: 900, color: "#111827" }}>
                          {item.resolution_label}
                        </div>
                        {choiceBadge(item.choix)}
                        <Badge text={`${formatNumber(item.tantiemes)} tantièmes`} kind="info" />
                        {item.is_zero_tantieme ? <Badge text="0 tantième" kind="warning" /> : null}
                      </div>

                      <div style={dividerStyle} />

                      <div style={{ fontSize: 13, color: "#374151" }}>
                        <strong>Lot :</strong> {item.lot_reference}
                      </div>

                      <div style={{ fontSize: 12, color: "#6b7280" }}>
                        <strong>Enregistré le :</strong> {formatDateTimeShort(item.created_at)}
                      </div>

                      {item.is_zero_tantieme ? (
                        <div style={warningBoxStyle}>
                          Ce vote est tracé, mais son poids est nul dans le calcul pondéré.
                        </div>
                      ) : null}
                    </div>

                    <div>
                      <Badge text={`#${item.id}`} kind="neutral" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </SectionCard>
      </div>

      <AlertBox kind="info" title="Lecture produit">
        Cette page devient le cockpit dédié au vote AG : saisie des choix, lecture pondérée des
        tantièmes exprimés, traçabilité des cas particuliers et consultation consolidée de
        l’historique.
      </AlertBox>

      <style>{`
        .ag-votes-kpi-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 14px;
        }

        .ag-votes-kpi-grid-secondary {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .ag-votes-main-grid {
          display: grid;
          grid-template-columns: 0.94fr 1.06fr;
          gap: 16px;
        }

        @media (max-width: 1280px) {
          .ag-votes-kpi-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .ag-votes-main-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 900px) {
          .ag-votes-kpi-grid,
          .ag-votes-kpi-grid-secondary {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </PageShell>
  );
}

const pageEyebrowStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  letterSpacing: 0.8,
  textTransform: "uppercase",
  color: "#2563eb",
};

const pageTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: 32,
  fontWeight: 900,
  letterSpacing: -0.9,
  color: "#0f172a",
  lineHeight: 1.05,
};

const pageSubtitleStyle: CSSProperties = {
  margin: 0,
  maxWidth: 980,
  fontSize: 14,
  color: "#64748b",
  lineHeight: 1.7,
};

const cardSubtitleStyle: CSSProperties = {
  fontSize: 13,
  color: "#64748b",
  lineHeight: 1.55,
};

const heroSectionStyle: CSSProperties = {
  borderRadius: 24,
  padding: 22,
  display: "grid",
  gridTemplateColumns: "minmax(0, 1.12fr) minmax(320px, 0.88fr)",
  gap: 18,
  alignItems: "stretch",
  background: "linear-gradient(135deg, #0f172a 0%, #1e293b 48%, #2563eb 100%)",
  boxShadow: "0 18px 38px rgba(37, 99, 235, 0.16)",
  color: "#ffffff",
  minWidth: 0,
};

const heroMainStyle: CSSProperties = {
  display: "grid",
  gap: 16,
  alignContent: "start",
  minWidth: 0,
};

const heroPillStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  width: "fit-content",
  padding: "6px 10px",
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.08)",
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: 0.8,
  textTransform: "uppercase",
  color: "rgba(255,255,255,0.84)",
};

const heroTitleStyle: CSSProperties = {
  fontSize: 28,
  fontWeight: 900,
  lineHeight: 1.12,
  letterSpacing: -0.6,
  color: "#ffffff",
};

const heroTextStyle: CSSProperties = {
  fontSize: 13,
  lineHeight: 1.7,
  color: "rgba(255,255,255,0.88)",
  maxWidth: 760,
};

const heroActionsStyle: CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
  alignItems: "center",
  justifyContent: "flex-start",
};

const heroAsideStyle: CSSProperties = {
  display: "flex",
  alignItems: "stretch",
  minWidth: 0,
};

const heroAsidePanelStyle: CSSProperties = {
  width: "100%",
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

const heroBadgeStackStyle: CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  alignItems: "center",
};

const heroPrimaryButtonStyle: CSSProperties = {
  border: "1px solid rgba(255,255,255,0.14)",
  background: "#ffffff",
  color: "#0f172a",
  borderRadius: 12,
  padding: "10px 14px",
  fontSize: 13,
  fontWeight: 800,
  cursor: "pointer",
};

const heroSecondaryButtonStyle: CSSProperties = {
  border: "1px solid rgba(255,255,255,0.16)",
  background: "rgba(255,255,255,0.08)",
  color: "#ffffff",
  borderRadius: 12,
  padding: "10px 14px",
  fontSize: 13,
  fontWeight: 800,
  cursor: "pointer",
};

const fieldStyle: CSSProperties = {
  display: "grid",
  gap: 8,
};

const labelStyle: CSSProperties = {
  fontSize: 13,
  fontWeight: 800,
  color: "#374151",
};

const inputStyle: CSSProperties = {
  width: "100%",
  padding: "12px 12px",
  borderRadius: 12,
  border: "1px solid #e5e7eb",
  background: "#fff",
  color: "#111827",
  fontSize: 14,
  boxSizing: "border-box",
};

const fieldHintStyle: CSSProperties = {
  fontSize: 12,
  color: "#6b7280",
  lineHeight: 1.45,
};

const hintBoxStyle: CSSProperties = {
  marginTop: 4,
  padding: 12,
  borderRadius: 12,
  border: "1px solid #e5e7eb",
  background: "#f8fafc",
  display: "grid",
  gap: 8,
};

const hintTitleStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  color: "#475569",
  textTransform: "uppercase",
  letterSpacing: 0.4,
};

const infoBoxStyle: CSSProperties = {
  padding: 14,
  borderRadius: 14,
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
  color: "#475569",
  fontSize: 13,
  lineHeight: 1.6,
};

const warningBoxStyle: CSSProperties = {
  padding: 12,
  borderRadius: 12,
  background: "#fffbeb",
  border: "1px solid #fde68a",
  color: "#92400e",
  fontSize: 12,
  lineHeight: 1.55,
};

const voteCardStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr auto",
  gap: 12,
  alignItems: "start",
  padding: 14,
  border: "1px solid #eef2f7",
  borderRadius: 14,
  background: "#fff",
  minWidth: 0,
};

const dividerStyle: CSSProperties = {
  height: 1,
  background: "#eef2f7",
};