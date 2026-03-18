import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../../api/axios";

type LoadState = "idle" | "loading" | "success" | "error";
type VoteChoice = "POUR" | "CONTRE" | "ABSTENTION";
type FlashKind = "success" | "error" | "info";

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
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(value);
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
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
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
    if (Array.isArray(firstEntry) && typeof firstEntry[0] === "string") return firstEntry[0];
  }

  if (isRecord(data)) {
    for (const value of Object.values(data)) {
      if (Array.isArray(value) && typeof value[0] === "string") {
        return value[0];
      }
      if (typeof value === "string" && value.trim()) {
        return value;
      }
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
      (pickString(row.titre, row.title, row.intitule, row.nom, row.objet, row.reference) || `Résolution #${id}`),
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

function Card(props: { title: string; children: ReactNode; right?: ReactNode }) {
  return (
    <div
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 20,
        padding: 18,
        background: "#ffffff",
        boxShadow: "0 10px 30px rgba(15, 23, 42, 0.04)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 10,
          flexWrap: "wrap",
          alignItems: "center",
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

function StatCard(props: { title: string; value: string | number; sub?: string; isLoading?: boolean }) {
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
      <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 10, fontWeight: 700 }}>{props.title}</div>
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
        <div style={{ marginTop: 8, fontSize: 12, color: "#6b7280", lineHeight: 1.45 }}>{props.sub}</div>
      ) : null}
    </div>
  );
}

function SmallButton(props: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  primary?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      disabled={props.disabled}
      style={{
        border: props.danger
          ? "1px solid #fecaca"
          : props.primary
            ? "1px solid #c7d2fe"
            : "1px solid #e5e7eb",
        background: props.disabled
          ? "#f9fafb"
          : props.danger
            ? "#fef2f2"
            : props.primary
              ? "#eef2ff"
              : "#fff",
        color: props.disabled
          ? "#9ca3af"
          : props.danger
            ? "#991b1b"
            : props.primary
              ? "#3730a3"
              : "#111827",
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

function AlertBox(props: { kind: FlashKind; children: ReactNode }) {
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
        lineHeight: 1.5,
      }}
    >
      {props.children}
    </div>
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
      <div style={{ fontSize: 14, fontWeight: 800, color: "#111827", marginBottom: 6 }}>{props.title}</div>
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

function Badge(props: { text: string; kind?: "neutral" | "success" | "warning" | "danger" | "info" }) {
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

  async function fetchVotes() {
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

      const resolutionLabelMap = new Map<number, string>(normalizedResolutions.map((item) => [item.id, item.label]));

      const voteGroups = await Promise.all(
        normalizedResolutions.map((resolution) => fetchVotesForResolution(resolution.id, resolutionLabelMap)),
      );

      const normalizedVotes = voteGroups
        .flat()
        .filter((item) => item.id > 0)
        .sort((a, b) => b.id - a.id);

      const votablePresences = normalizedPresences
        .filter((item) => item.present_ou_represente)
        .sort((a, b) => a.lot_reference.localeCompare(b.lot_reference, "fr", { numeric: true }));

      setRows(normalizedVotes);
      setResolutionOptions(normalizedResolutions);
      setPresenceOptions(votablePresences);

      setForm((prev) => {
        const nextResolution =
          prev.resolution && normalizedResolutions.some((item) => item.id === prev.resolution)
            ? prev.resolution
            : normalizedResolutions[0]?.id ?? null;

        const nextLot =
          prev.lot && votablePresences.some((item) => item.lot === prev.lot) ? prev.lot : votablePresences[0]?.lot ?? null;

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
  }

  useEffect(() => {
    void fetchVotes();
  }, [agId]);

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

    return {
      totalVotes: rows.length,
      pour: pour.length,
      contre: contre.length,
      abstention: rows.filter((x) => x.choix === "ABSTENTION").length,
      tantiemesExprimes:
        pour.reduce((sum, x) => sum + x.tantiemes, 0) + contre.reduce((sum, x) => sum + x.tantiemes, 0),
      zeroTantieme: rows.filter((x) => x.is_zero_tantieme).length,
    };
  }, [rows]);

  const selectedPresence = useMemo(
    () => presenceOptions.find((item) => item.lot === form.lot) ?? null,
    [presenceOptions, form.lot],
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
      setMessage({ kind: "error", text: getErrorMessage(e, "Impossible d’enregistrer le vote.") });
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <PageShell>
      <SectionTitle
        title="Votes AG"
        subtitle="Enregistrez et consultez les votes des lots sur les résolutions de cette assemblée générale."
        right={
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <SmallButton onClick={() => navigate(`/ag/assemblees/${agId}`)}>Retour au détail AG</SmallButton>
          </div>
        }
      />

      {state === "error" && error ? (
        <AlertBox kind="error">
          <div style={{ fontWeight: 900, marginBottom: 4 }}>Chargement impossible</div>
          <div style={{ fontSize: 13 }}>{error}</div>
        </AlertBox>
      ) : null}

      {message ? (
        <AlertBox kind={message.kind}>
          <div style={{ fontSize: 13 }}>{message.text}</div>
        </AlertBox>
      ) : null}

      {blockingReasons.length > 0 ? (
        <AlertBox kind="error">
          <div style={{ fontWeight: 900, marginBottom: 8 }}>Blocages métier détectés</div>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.6 }}>
            {blockingReasons.map((reason, index) => (
              <li key={`${reason}-${index}`}>{reason}</li>
            ))}
          </ul>
        </AlertBox>
      ) : null}

      <div className="ag-votes-stat-grid">
        <StatCard
          title="Votes"
          value={stats.totalVotes}
          sub="Nombre total de votes enregistrés."
          isLoading={state === "loading"}
        />
        <StatCard
          title="Pour"
          value={stats.pour}
          sub="Votes favorables."
          isLoading={state === "loading"}
        />
        <StatCard
          title="Contre"
          value={stats.contre}
          sub="Votes défavorables."
          isLoading={state === "loading"}
        />
        <StatCard
          title="Tantièmes exprimés"
          value={formatNumber(stats.tantiemesExprimes)}
          sub="Somme des tantièmes pour + contre."
          isLoading={state === "loading"}
        />
      </div>

      <div className="ag-votes-stat-grid ag-votes-stat-grid-secondary">
        <StatCard
          title="Votes à 0 tantième"
          value={stats.zeroTantieme}
          sub="Ils restent tracés mais ne pèsent pas dans le calcul pondéré."
          isLoading={state === "loading"}
        />
      </div>

      <div className="ag-votes-main-grid">
        <Card title="Enregistrer un vote" right={<Badge text="Saisie" kind="neutral" />}>
          <div style={{ display: "grid", gap: 14 }}>
            <div style={field}>
              <label style={label}>Résolution</label>
              <select
                value={form.resolution ?? ""}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    resolution: toNumberOrNull(e.target.value),
                  }))
                }
                style={input}
              >
                <option value="">Sélectionner une résolution</option>
                {resolutionOptions.map((item) => (
                  <option key={item.id} value={item.id}>
                    #{item.id} — {item.label}
                  </option>
                ))}
              </select>

              {resolutionOptions.length === 0 ? (
                <div style={fieldHint}>Aucune résolution chargée pour cette AG.</div>
              ) : (
                <div style={fieldHint}>
                  Sélection métier : vous choisissez la résolution par son libellé, sans saisir son identifiant à la main.
                </div>
              )}
            </div>

            <div style={field}>
              <label style={label}>Lot votant</label>
              <select
                value={form.lot ?? ""}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    lot: toNumberOrNull(e.target.value),
                  }))
                }
                style={input}
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
                <div style={fieldHint}>
                  Aucun lot présent ou représenté n’est disponible. Revenez dans l’écran Présences pour marquer les lots votants.
                </div>
              ) : selectedPresence ? (
                <div style={hintBox}>
                  <div style={hintTitle}>Lot sélectionné</div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                    <Badge text={selectedPresence.lot_reference} kind="info" />
                    <Badge text={`${formatNumber(selectedPresence.tantiemes)} tantièmes`} kind="success" />
                    {selectedPresence.representant_nom ? (
                      <Badge text={`Représentant : ${selectedPresence.representant_nom}`} kind="neutral" />
                    ) : (
                      <Badge text="Présence directe" kind="neutral" />
                    )}
                    {selectedPresence.is_zero_tantieme ? <Badge text="0 tantième" kind="warning" /> : null}
                  </div>

                  {selectedPresence.is_zero_tantieme ? (
                    <div style={warningBox}>
                      Ce lot peut voter, mais son poids est nul dans le calcul pondéré.
                    </div>
                  ) : null}
                </div>
              ) : (
                <div style={fieldHint}>
                  Choisissez un lot réellement présent ou représenté pour éviter les refus métier au moment du vote.
                </div>
              )}
            </div>

            <div style={field}>
              <label style={label}>Choix</label>
              <select
                value={form.choix}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    choix: normalizeChoice(e.target.value),
                  }))
                }
                style={input}
              >
                <option value="POUR">Pour</option>
                <option value="CONTRE">Contre</option>
                <option value="ABSTENTION">Abstention</option>
              </select>
            </div>

            <div style={infoBox}>
              Le poids du vote en tantièmes est calculé par le backend à partir de la présence AG. Il n’est pas saisi
              manuellement dans ce formulaire.
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <SmallButton
                onClick={() => void handleSubmit()}
                primary
                disabled={busyAction === "create" || resolutionOptions.length === 0 || presenceOptions.length === 0}
              >
                {busyAction === "create" ? "Enregistrement..." : "Enregistrer le vote"}
              </SmallButton>
              <SmallButton onClick={resetForm} disabled={busyAction !== null}>
                Réinitialiser
              </SmallButton>
              <SmallButton onClick={() => navigate(`/ag/assemblees/${agId}/presences`)}>
                Gérer les présences
              </SmallButton>
            </div>
          </div>
        </Card>

        <Card title="Liste des votes" right={<Badge text={`${filtered.length} vote(s)`} kind="info" />}>
          <div style={{ display: "grid", gap: 12 }}>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher : résolution, lot, choix..."
              style={input}
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
                  <div
                    key={item.id}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr auto",
                      gap: 12,
                      alignItems: "start",
                      padding: 14,
                      border: "1px solid #eef2f7",
                      borderRadius: 14,
                      background: "#fff",
                    }}
                  >
                    <div style={{ display: "grid", gap: 6 }}>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                        <div style={{ fontSize: 14, fontWeight: 900, color: "#111827" }}>{item.resolution_label}</div>
                        {choiceBadge(item.choix)}
                        <Badge text={`${formatNumber(item.tantiemes)} tantièmes`} kind="info" />
                        {item.is_zero_tantieme ? <Badge text="0 tantième" kind="warning" /> : null}
                      </div>

                      <div style={{ fontSize: 13, color: "#374151" }}>
                        <strong>Lot :</strong> {item.lot_reference}
                      </div>

                      <div style={{ fontSize: 12, color: "#6b7280" }}>
                        <strong>Enregistré le :</strong> {formatDateTimeShort(item.created_at)}
                      </div>

                      {item.is_zero_tantieme ? (
                        <div style={warningBox}>
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
        </Card>
      </div>

      <style>{`
        .ag-votes-stat-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 14px;
        }

        .ag-votes-stat-grid-secondary {
          grid-template-columns: repeat(1, minmax(0, 1fr));
        }

        .ag-votes-main-grid {
          display: grid;
          grid-template-columns: 0.95fr 1.05fr;
          gap: 14px;
        }

        @media (max-width: 1200px) {
          .ag-votes-stat-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .ag-votes-stat-grid-secondary {
            grid-template-columns: 1fr;
          }

          .ag-votes-main-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 760px) {
          .ag-votes-stat-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </PageShell>
  );
}

const field: CSSProperties = {
  display: "grid",
  gap: 8,
};

const label: CSSProperties = {
  fontSize: 13,
  fontWeight: 800,
  color: "#374151",
};

const input: CSSProperties = {
  width: "100%",
  padding: "12px 12px",
  borderRadius: 12,
  border: "1px solid #e5e7eb",
  background: "#fff",
  color: "#111827",
  fontSize: 14,
  boxSizing: "border-box",
};

const fieldHint: CSSProperties = {
  fontSize: 12,
  color: "#6b7280",
  lineHeight: 1.45,
};

const hintBox: CSSProperties = {
  marginTop: 4,
  padding: 12,
  borderRadius: 12,
  border: "1px solid #e5e7eb",
  background: "#f8fafc",
  display: "grid",
  gap: 8,
};

const hintTitle: CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  color: "#475569",
  textTransform: "uppercase",
  letterSpacing: 0.4,
};

const infoBox: CSSProperties = {
  padding: 14,
  borderRadius: 14,
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
  color: "#475569",
  fontSize: 13,
  lineHeight: 1.6,
};

const warningBox: CSSProperties = {
  padding: 12,
  borderRadius: 12,
  background: "#fffbeb",
  border: "1px solid #fde68a",
  color: "#92400e",
  fontSize: 12,
  lineHeight: 1.55,
};