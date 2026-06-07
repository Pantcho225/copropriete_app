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
type FlashKind = "success" | "error" | "info";
type BadgeKind = "neutral" | "success" | "warning" | "danger" | "info";

type PresenceItem = {
  id: number;
  ag: number;
  lot: number;
  lot_reference: string;
  lot_type_lot?: string | null;
  tantiemes: number;
  tantiemes_recalcules?: number | null;
  is_zero_tantieme: boolean;
  present_ou_represente: boolean;
  representant_nom: string;
  commentaire: string;
};

type PresenceFormValues = {
  lot: number | null;
  present_ou_represente: boolean;
  representant_nom: string;
  commentaire: string;
};

type DRFPage<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

const INITIAL_FORM: PresenceFormValues = {
  lot: null,
  present_ou_represente: false,
  representant_nom: "",
  commentaire: "",
};

const AGS_ENDPOINT = "/api/ag/ags/";
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
  if (typeof value === "number") return value !== 0;

  if (typeof value === "string") {
    const s = value.trim().toLowerCase();
    return ["true", "1", "oui", "yes", "ok"].includes(s);
  }

  return false;
}

function pickString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }

  return "";
}

function normalizeText(value: string | null | undefined): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function isMandatePresence(item: PresenceItem): boolean {
  const comment = normalizeText(item.commentaire);

  return (
    item.present_ou_represente &&
    Boolean(item.representant_nom.trim()) &&
    (comment.includes("procuration") ||
      comment.includes("mandat") ||
      comment.includes("represent"))
  );
}

function formatNumber(value?: number | null): string {
  if (value === null || value === undefined) return "0";

  return new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: 0,
  }).format(value);
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
      status?: number;
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

function normalizePresenceItem(raw: unknown): PresenceItem {
  const row = isRecord(raw) ? raw : {};
  const tantiemes = toNumberOrNull(row.tantiemes) ?? 0;

  return {
    id: toNumberOrNull(row.id) ?? toNumberOrNull(row.pk) ?? 0,
    ag: toNumberOrNull(row.ag) ?? toNumberOrNull(row.ag_id) ?? 0,
    lot: toNumberOrNull(row.lot) ?? toNumberOrNull(row.lot_id) ?? 0,
    lot_reference:
      pickString(
        row.lot_reference,
        row.reference_lot,
        row.lot_ref,
        row.reference,
        isRecord(row.lot_obj) ? row.lot_obj.reference : undefined,
      ) || `Lot #${toNumberOrNull(row.lot) ?? toNumberOrNull(row.lot_id) ?? "?"}`,
    lot_type_lot: pickString(row.lot_type_lot, row.type_lot) || null,
    tantiemes,
    tantiemes_recalcules: toNumberOrNull(row.tantiemes_recalcules),
    is_zero_tantieme: toBoolean(row.is_zero_tantieme) || tantiemes <= 0,
    present_ou_represente: toBoolean(row.present_ou_represente),
    representant_nom: pickString(row.representant_nom, row.nom_representant),
    commentaire: pickString(row.commentaire, row.note, row.notes),
  };
}

function extractPresenceRows(data: unknown): PresenceItem[] {
  if (isPaginatedResponse<Record<string, unknown>>(data)) {
    return data.results.map(normalizePresenceItem).filter((item) => item.id > 0);
  }

  if (Array.isArray(data)) {
    return data.map(normalizePresenceItem).filter((item) => item.id > 0);
  }

  if (isRecord(data)) {
    const candidates = [data.results, data.items, data.presences, data.data];

    for (const candidate of candidates) {
      if (Array.isArray(candidate)) {
        return candidate.map(normalizePresenceItem).filter((item) => item.id > 0);
      }
    }
  }

  return [];
}

function buildAgInitPresencesUrl(agId: string | number): string {
  return `${AGS_ENDPOINT}${agId}/init-presences/`;
}

function buildAgPresencesListUrl(agId: string | number): string {
  return `${PRESENCES_ENDPOINT}?ag=${agId}`;
}

function buildPresenceDetailUrl(presenceId: string | number): string {
  return `${PRESENCES_ENDPOINT}${presenceId}/`;
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
        <div style={heroPillStyle}>ASSEMBLÉES GÉNÉRALES · PRÉSENCES</div>
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
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
          alignItems: "flex-start",
          marginBottom: 16,
          minWidth: 0,
        }}
      >
        <div style={{ display: "grid", gap: 6, minWidth: 0 }}>
          <div style={{ fontSize: 17, fontWeight: 900, color: "#111827" }}>
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
          <SmallButton onClick={props.onAction} primary>
            {props.actionLabel}
          </SmallButton>
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

export default function AGPresences() {
  const navigate = useNavigate();
  const params = useParams();
  const agId = params.id ?? "";

  const [state, setState] = useState<LoadState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<{ kind: FlashKind; text: string } | null>(null);
  const [blockingReasons, setBlockingReasons] = useState<string[]>([]);
  const [rows, setRows] = useState<PresenceItem[]>([]);
  const [form, setForm] = useState<PresenceFormValues>(INITIAL_FORM);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const fetchPresences = useCallback(async () => {
    if (!agId) {
      setState("error");
      setError("Identifiant d’assemblée introuvable.");
      return;
    }

    setState("loading");
    setError(null);

    try {
      const res = await api.get<unknown>(buildAgPresencesListUrl(agId));

      const normalized = extractPresenceRows(res.data).sort((a, b) =>
        a.lot_reference.localeCompare(b.lot_reference, "fr"),
      );

      setRows(normalized);
      setState("success");
    } catch (e) {
      setRows([]);
      setState("error");
      setError(getErrorMessage(e, "Impossible de charger les présences."));
    }
  }, [agId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchPresences();
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [fetchPresences]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    if (!q) return rows;

    return rows.filter((item) => {
      const haystack = [
        item.lot_reference,
        item.lot_type_lot ?? "",
        item.representant_nom,
        item.commentaire,
        item.present_ou_represente ? "présent représenté oui" : "absent non",
        item.is_zero_tantieme ? "zero tantieme poids nul" : "",
        isMandatePresence(item) ? "mandat procuration représentation validée" : "",
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(q);
    });
  }, [rows, query]);

  const stats = useMemo(() => {
    const presents = rows.filter((x) => x.present_ou_represente);
    const zeroTantieme = rows.filter((x) => x.is_zero_tantieme);
    const mandatePresences = rows.filter(isMandatePresence);

    return {
      totalLots: rows.length,
      presents: presents.length,
      absents: rows.filter((x) => !x.present_ou_represente).length,
      tantiemesPresents: presents.reduce((sum, item) => sum + item.tantiemes, 0),
      zeroTantieme: zeroTantieme.length,
      mandatePresences: mandatePresences.length,
    };
  }, [rows]);

  function resetForm() {
    setForm(INITIAL_FORM);
    setEditingId(null);
  }

  function fillForm(item: PresenceItem) {
    if (isMandatePresence(item)) {
      setMessage({
        kind: "info",
        text:
          "Cette présence provient d’un mandat de représentation validé. Elle est verrouillée dans l’interface afin de préserver la cohérence entre mandat, présence, quorum, votes et procès-verbal.",
      });
      return;
    }

    setEditingId(item.id);
    setForm({
      lot: item.lot,
      present_ou_represente: item.present_ou_represente,
      representant_nom: item.representant_nom,
      commentaire: item.commentaire,
    });
  }

  function validateForm() {
    if (!agId) return "Identifiant d’assemblée introuvable.";
    if (!form.lot) return "Le lot est obligatoire.";

    if (form.present_ou_represente && !form.representant_nom.trim()) {
      return "Le nom du représentant ou du présent est obligatoire.";
    }

    return null;
  }

  async function handleInitPresences() {
    if (!agId) return;

    setBusyAction("init");
    setMessage(null);
    setBlockingReasons([]);

    try {
      const res = await api.post(buildAgInitPresencesUrl(agId), {});
      setMessage({ kind: "success", text: "Présences initialisées avec succès." });
      setBlockingReasons(extractBlockingReasons(res?.data));
      await fetchPresences();
    } catch (e) {
      const err = e as { response?: { data?: unknown } };
      setBlockingReasons(extractBlockingReasons(err?.response?.data));
      setMessage({
        kind: "error",
        text: getErrorMessage(e, "Impossible d’initialiser les présences."),
      });
    } finally {
      setBusyAction(null);
    }
  }

  async function handleSubmit() {
    const validationError = validateForm();

    if (validationError) {
      setMessage({ kind: "error", text: validationError });
      return;
    }

    if (!agId || !form.lot) return;

    const currentEditingItem = rows.find((item) => item.id === editingId);

    if (currentEditingItem && isMandatePresence(currentEditingItem)) {
      setMessage({
        kind: "error",
        text:
          "Cette présence provient d’un mandat validé et ne peut pas être modifiée directement depuis la saisie des présences.",
      });
      return;
    }

    setBusyAction(editingId ? "update" : "create");
    setMessage(null);
    setBlockingReasons([]);

    const payload = {
      ag: Number(agId),
      lot: form.lot,
      present_ou_represente: form.present_ou_represente,
      representant_nom: form.representant_nom.trim(),
      commentaire: form.commentaire.trim(),
    };

    try {
      if (editingId) {
        await api.patch(buildPresenceDetailUrl(editingId), payload);
        setMessage({ kind: "success", text: "Présence mise à jour avec succès." });
      } else {
        await api.post(PRESENCES_ENDPOINT, payload);
        setMessage({ kind: "success", text: "Présence enregistrée avec succès." });
      }

      resetForm();
      await fetchPresences();
    } catch (e) {
      const err = e as { response?: { data?: unknown } };
      setBlockingReasons(extractBlockingReasons(err?.response?.data));
      setMessage({
        kind: "error",
        text: getErrorMessage(e, "Impossible d’enregistrer la présence."),
      });
    } finally {
      setBusyAction(null);
    }
  }

  async function handleDelete(item: PresenceItem) {
    if (isMandatePresence(item)) {
      setMessage({
        kind: "error",
        text:
          "Suppression impossible depuis cette page : cette présence provient d’un mandat de représentation validé.",
      });
      return;
    }

    const ok = window.confirm("Confirmer la suppression de cette présence ?");
    if (!ok) return;

    setBusyAction(`delete-${item.id}`);
    setMessage(null);
    setBlockingReasons([]);

    try {
      await api.delete(buildPresenceDetailUrl(item.id));
      setMessage({ kind: "success", text: "Présence supprimée avec succès." });

      if (editingId === item.id) {
        resetForm();
      }

      await fetchPresences();
    } catch (e) {
      const err = e as { response?: { data?: unknown } };
      setBlockingReasons(extractBlockingReasons(err?.response?.data));
      setMessage({
        kind: "error",
        text: getErrorMessage(e, "Impossible de supprimer la présence."),
      });
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <PageShell>
      <PageHeader
        title="Présences de l’assemblée"
        subtitle="Gérez les présences et représentations des copropriétaires avec suivi du poids réel de vote retenu pour le quorum et les décisions."
        right={
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <SmallButton onClick={() => navigate(`/ag/assemblees/${agId}`)}>
              Retour au détail AG
            </SmallButton>
          </div>
        }
      />

      <HeroSection
        title="Pilotage des présences AG"
        text="Cette vue permet de préparer la base réelle de participation de l’assemblée, indispensable au calcul du quorum, à la pondération des votes et à la cohérence finale du procès-verbal."
        primaryLabel={busyAction === "init" ? "Initialisation..." : "Initialiser les présences"}
        primaryAction={() => void handleInitPresences()}
        secondaryLabel="Voir les votes"
        secondaryAction={() => navigate(`/ag/assemblees/${agId}/votes`)}
        rightPanel={
          <div style={heroAsidePanelStyle}>
            <div style={heroAsideTitleStyle}>Lecture métier</div>
            <div style={heroAsideTextStyle}>
              Les tantièmes sont calculés automatiquement par le backend. Les
              présences issues d’un mandat validé sont protégées afin d’éviter une
              rupture entre procuration, quorum, votes et procès-verbal.
            </div>

            <div style={heroBadgeStackStyle}>
              <Badge text={`${stats.totalLots} lots`} kind="neutral" />
              <Badge text={`${stats.presents} présents`} kind="success" />
              <Badge text={`${stats.mandatePresences} par mandat`} kind="info" />
              <Badge text={`${stats.zeroTantieme} à 0 tantième`} kind="warning" />
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

      <div className="ag-presences-kpi-grid">
        <SummaryCard
          label="Lots concernés"
          value={stats.totalLots}
          helper="Lots actuellement intégrés dans cette assemblée générale."
          isLoading={state === "loading"}
          tone="neutral"
        />
        <SummaryCard
          label="Présence effective"
          value={stats.presents}
          helper="Lots marqués comme présents ou représentés."
          isLoading={state === "loading"}
          tone="success"
        />
        <SummaryCard
          label="Lots absents"
          value={stats.absents}
          helper="Lots encore non présents dans l’assemblée."
          isLoading={state === "loading"}
          tone="warning"
        />
        <SummaryCard
          label="Poids de vote présent"
          value={formatNumber(stats.tantiemesPresents)}
          helper="Base réelle de vote actuellement retenue."
          isLoading={state === "loading"}
          tone="info"
        />
      </div>

      <div className="ag-presences-kpi-grid ag-presences-kpi-grid-secondary">
        <SummaryCard
          label="Présences par mandat"
          value={stats.mandatePresences}
          helper="Présences issues d’un mandat de représentation validé et protégées côté interface."
          isLoading={state === "loading"}
          tone="info"
        />
        <SummaryCard
          label="Lots à 0 tantième"
          value={stats.zeroTantieme}
          helper="Ils restent visibles mais ne pèsent pas dans le calcul pondéré."
          isLoading={state === "loading"}
          tone="warning"
        />
      </div>

      <div className="ag-presences-main-grid">
        <SectionCard
          title={editingId ? "Modifier une présence" : "Enregistrer une présence"}
          subtitle="Renseignez le lot, le statut de présence et les informations utiles de représentation. Les présences issues d’un mandat validé sont protégées et ne se modifient pas depuis ce formulaire."
          right={editingId ? <Badge text="Mode édition" kind="info" /> : <Badge text="Saisie AG" kind="info" />}
          minHeight={560}
        >
          <div style={{ display: "grid", gap: 14 }}>
            <div style={fieldStyle}>
              <label style={labelStyle}>Lot</label>
              <input
                value={form.lot ?? ""}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    lot: toNumberOrNull(e.target.value),
                  }))
                }
                placeholder="Ex : 3 (ID du lot)"
                style={inputStyle}
              />
              <div style={helperTextStyle}>Saisissez l’identifiant du lot (et non son libellé).</div>
            </div>

            <div style={fieldStyle}>
              <label style={labelStyle}>Statut de présence</label>
              <label style={checkboxRowStyle}>
                <input
                  type="checkbox"
                  checked={form.present_ou_represente}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      present_ou_represente: e.target.checked,
                    }))
                  }
                />
                <span>Présent ou représenté</span>
              </label>
            </div>

            <div style={fieldStyle}>
              <label style={labelStyle}>Nom du représentant / présent</label>
              <input
                value={form.representant_nom}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    representant_nom: e.target.value,
                  }))
                }
                placeholder="Nom de la personne présente ou représentante"
                style={inputStyle}
              />
            </div>

            <div style={fieldStyle}>
              <label style={labelStyle}>Commentaire</label>
              <textarea
                value={form.commentaire}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    commentaire: e.target.value,
                  }))
                }
                placeholder="Commentaire libre"
                style={textareaStyle}
              />
            </div>

            <div style={infoBoxStyle}>
              Le poids de présence en tantièmes est calculé par le backend. Il
              n’est pas saisi manuellement dans ce formulaire.
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <SmallButton
                onClick={() => void handleSubmit()}
                primary
                disabled={busyAction === "create" || busyAction === "update"}
              >
                {busyAction === "create"
                  ? "Enregistrement..."
                  : busyAction === "update"
                    ? "Mise à jour..."
                    : editingId
                      ? "Mettre à jour"
                      : "Enregistrer"}
              </SmallButton>

              <SmallButton onClick={resetForm} disabled={busyAction !== null}>
                Réinitialiser
              </SmallButton>
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="Présences des copropriétaires"
          subtitle="Lecture opérationnelle des présences, absences, représentants et tantièmes retenus."
          right={<Badge text={`${filtered.length} ligne(s)`} kind="info" />}
          minHeight={560}
        >
          <div style={{ display: "grid", gap: 12 }}>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher : lot, représentant, mandat, commentaire..."
              style={inputStyle}
            />

            {state === "loading" ? (
              <div style={{ color: "#6b7280", fontSize: 14 }}>Chargement des présences…</div>
            ) : filtered.length === 0 ? (
              <EmptyState
                title={rows.length === 0 ? "Aucune présence enregistrée" : "Aucune présence à afficher"}
                text={
                  rows.length === 0
                    ? "Aucune présence n’a encore été trouvée pour cette assemblée."
                    : "Aucune présence ne correspond à la recherche actuelle."
                }
                actionLabel="Initialiser les présences"
                onAction={() => void handleInitPresences()}
              />
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {filtered.map((item) => {
                  const mandatePresence = isMandatePresence(item);

                  return (
                    <div
                      key={item.id}
                      style={{
                        ...presenceCardStyle,
                        ...(mandatePresence ? mandatePresenceCardStyle : {}),
                      }}
                    >
                      <div style={{ display: "grid", gap: 6 }}>
                        <div
                          style={{
                            display: "flex",
                            gap: 8,
                            flexWrap: "wrap",
                            alignItems: "center",
                          }}
                        >
                          <div style={{ fontSize: 14, fontWeight: 900, color: "#111827" }}>
                            Lot {item.lot_reference}
                          </div>

                          {item.lot_type_lot ? (
                            <Badge text={item.lot_type_lot} kind="neutral" />
                          ) : null}

                          <Badge
                            text={item.present_ou_represente ? "Présent / représenté" : "Absent"}
                            kind={item.present_ou_represente ? "success" : "warning"}
                          />

                          {mandatePresence ? (
                            <Badge text="Mandat validé" kind="info" />
                          ) : null}

                          <Badge text={`${formatNumber(item.tantiemes)} tantièmes`} kind="info" />

                          {item.is_zero_tantieme ? <Badge text="0 tantième" kind="warning" /> : null}
                        </div>

                        <div style={{ fontSize: 13, color: "#374151" }}>
                          <strong>Représentant :</strong> {item.representant_nom || "—"}
                        </div>

                        <div style={{ fontSize: 13, color: "#374151" }}>
                          <strong>Tantièmes AG retenus :</strong> {formatNumber(item.tantiemes)}
                          {item.tantiemes_recalcules !== null &&
                          item.tantiemes_recalcules !== undefined ? (
                            <span style={{ color: "#6b7280" }}>
                              {" "}
                              — référence recalculée : {formatNumber(item.tantiemes_recalcules)}
                            </span>
                          ) : null}
                        </div>

                        <div style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.55 }}>
                          <strong>Commentaire :</strong> {item.commentaire || "—"}
                        </div>

                        {mandatePresence ? (
                          <div style={mandateInfoBoxStyle}>
                            <strong>Présence issue d’un mandat validé.</strong> Cette
                            ligne est protégée côté interface. Toute correction doit
                            passer par un circuit encadré afin de préserver la cohérence
                            entre mandat, quorum, votes et procès-verbal.
                          </div>
                        ) : null}

                        {item.is_zero_tantieme ? (
                          <div style={warningBoxStyle}>
                            Ce lot a 0 tantième. Il reste visible dans l’AG mais ne sera
                            pas pris en compte dans le calcul pondéré.
                          </div>
                        ) : null}
                      </div>

                      {mandatePresence ? (
                        <div style={lockedActionsStyle}>
                          <Badge text="Modification encadrée" kind="info" />
                          <div style={lockedActionsTextStyle}>
                            Suppression désactivée pour les présences issues d’un mandat.
                          </div>
                        </div>
                      ) : (
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <SmallButton onClick={() => fillForm(item)} disabled={busyAction !== null}>
                            Modifier
                          </SmallButton>
                          <SmallButton
                            danger
                            onClick={() => void handleDelete(item)}
                            disabled={busyAction !== null}
                          >
                            {busyAction === `delete-${item.id}` ? "Suppression..." : "Supprimer"}
                          </SmallButton>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </SectionCard>
      </div>

      <AlertBox kind="info" title="Lecture produit">
        Cette page constitue la base du quorum et du vote. Toute incohérence ici
        impacte directement les décisions en assemblée. Les présences issues d’un
        mandat validé sont protégées dans l’interface.
      </AlertBox>

      <style>{`
        .ag-presences-kpi-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 14px;
        }

        .ag-presences-kpi-grid-secondary {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .ag-presences-main-grid {
          display: grid;
          grid-template-columns: 0.95fr 1.05fr;
          gap: 16px;
        }

        @media (max-width: 1280px) {
          .ag-presences-kpi-grid,
          .ag-presences-kpi-grid-secondary {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .ag-presences-main-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 760px) {
          .ag-presences-kpi-grid,
          .ag-presences-kpi-grid-secondary {
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

const helperTextStyle: CSSProperties = {
  fontSize: 12,
  color: "#6b7280",
  lineHeight: 1.5,
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

const textareaStyle: CSSProperties = {
  ...inputStyle,
  minHeight: 110,
  resize: "vertical",
};

const checkboxRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  fontSize: 14,
  color: "#111827",
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

const mandateInfoBoxStyle: CSSProperties = {
  padding: 12,
  borderRadius: 12,
  background: "#eff6ff",
  border: "1px solid #bfdbfe",
  color: "#1d4ed8",
  fontSize: 12,
  lineHeight: 1.55,
};

const presenceCardStyle: CSSProperties = {
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

const mandatePresenceCardStyle: CSSProperties = {
  borderColor: "#bfdbfe",
  background: "#f8fbff",
};

const lockedActionsStyle: CSSProperties = {
  display: "grid",
  gap: 8,
  maxWidth: 180,
};

const lockedActionsTextStyle: CSSProperties = {
  fontSize: 12,
  color: "#64748b",
  lineHeight: 1.45,
};