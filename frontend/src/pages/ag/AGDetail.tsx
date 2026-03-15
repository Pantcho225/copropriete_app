import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../../api/axios";

type LoadState = "idle" | "loading" | "success" | "error";
type AGStatus = "BROUILLON" | "OUVERTE" | "CLOTUREE" | "ARCHIVEE";
type ResolutionStatus = "ADOPTEE" | "REJETEE" | "EN_ATTENTE";
type PVStatus = "BROUILLON" | "GENERE" | "SIGNE" | "ARCHIVE";
type FlashKind = "success" | "info" | "error";

type AGDetailItem = {
  id: number;
  reference: string;
  titre: string;
  exercice: string;
  date_ag: string;
  heure_ag: string;
  lieu: string;
  statut: AGStatus;
  quorum_atteint?: boolean | null;
  description: string;

  pv_locked: boolean;
  pv_status: PVStatus;
  pv_pdf_url?: string | null;
  pv_pdf_hash?: string | null;
  pv_generated_at?: string | null;
  pv_signed_pdf_url?: string | null;
  pv_signed_hash?: string | null;
  pv_signed_at?: string | null;
  pv_signer_subject?: string | null;

  president_nom?: string | null;
  secretaire_nom?: string | null;
  signature_president_url?: string | null;
  signature_secretaire_url?: string | null;
  cachet_image_url?: string | null;

  closed_at?: string | null;
  closed_by?: number | null;
};

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
  cloturee?: boolean;
  budget_vote?: number | null;
  travaux_dossier_titre?: string | null;
  resultat: ResolutionStatus;
};

type DRFPage<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

type QuorumPayload = {
  ag_id: number;
  total_tantiemes_copro: number;
  tantiemes_presents: number;
  quorum_atteint: boolean;
  seuil: number;
};

const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim() || "http://127.0.0.1:8002";

const AG_DETAIL_ENDPOINT_CANDIDATES = (id: string | number) => [
  `/api/ag/ags/${id}/`,
  `/api/ag/ags/${id}`,
];

const AG_RESOLUTIONS_ENDPOINT_CANDIDATES = (id: string | number) => [
  `/api/ag/resolutions/?ag=${id}`,
  `/api/ag/resolutions?ag=${id}`,
  `/api/ag/resolutions/?assemblee=${id}`,
  `/api/ag/resolutions?assemblee=${id}`,
  `/api/ag/resolutions/?assemblee_generale=${id}`,
  `/api/ag/resolutions?assemblee_generale=${id}`,
  `/api/ag/ags/${id}/resolutions/`,
  `/api/ag/ags/${id}/resolutions`,
];

function endpointActionCandidates(id: string | number, suffix: string) {
  return [`/api/ag/ags/${id}/${suffix}/`, `/api/ag/ags/${id}/${suffix}`];
}

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

function toBooleanOrNull(value: unknown): boolean | null {
  if (value === null || value === undefined || value === "") return null;

  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;

  if (typeof value === "string") {
    const s = value.trim().toLowerCase();

    if (["true", "1", "oui", "yes", "ok", "atteint", "genere", "généré", "disponible", "locked"].includes(s)) {
      return true;
    }

    if (
      ["false", "0", "non", "no", "non_genere", "non généré", "non genere", "indisponible", "draft"].includes(s)
    ) {
      return false;
    }
  }

  return null;
}

function toBoolean(value: unknown): boolean {
  return toBooleanOrNull(value) === true;
}

function pickString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function pickNullableString(...values: unknown[]): string | null {
  const v = pickString(...values);
  return v || null;
}

function pickDate(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function toAbsoluteBackendUrl(url?: string | null): string | null {
  if (!url || !url.trim()) return null;

  let raw = url.trim();

  if (/^https?:\/\//i.test(raw)) {
    raw = raw.replace("://localhost:", "://127.0.0.1:");
    raw = raw.replace("/api/media/", "/media/");
    return raw;
  }

  raw = raw.replace(/^\/api\/media\//, "/media/");
  raw = raw.replace(/^api\/media\//, "media/");

  if (raw.startsWith("/")) {
    return `${API_BASE_URL}${raw}`;
  }

  return `${API_BASE_URL}/${raw}`;
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

  if (["ADOPTEE", "VALIDEE", "VALIDE", "APPROUVEE"].includes(s)) return "ADOPTEE";
  if (["REJETEE", "REJETE", "REFUSEE", "REFUSE"].includes(s)) return "REJETEE";
  return "EN_ATTENTE";
}

function inferPVStatus(row: Record<string, unknown>): PVStatus {
  const pvLocked = toBoolean(row.pv_locked);
  const signedPdfUrl = pickNullableString(row.pv_signed_pdf_url);
  const signedAt = pickNullableString(row.pv_signed_at);
  const pdfUrl = pickNullableString(row.pv_pdf_url);
  const generatedAt = pickNullableString(row.pv_generated_at);

  if (pvLocked && (signedPdfUrl || signedAt)) return "ARCHIVE";
  if (signedPdfUrl || signedAt) return "SIGNE";
  if (pdfUrl || generatedAt) return "GENERE";
  return "BROUILLON";
}

function formatDateShort(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (!Number.isNaN(d.getTime())) return d.toLocaleDateString("fr-FR");
  return iso;
}

function formatDateTimeShort(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (!Number.isNaN(d.getTime())) {
    return `${d.toLocaleDateString("fr-FR")} ${d.toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
    })}`;
  }
  return iso;
}

function formatTimeShort(value?: string | null): string {
  if (!value) return "—";

  const raw = value.trim();
  if (!raw) return "—";

  const timeMatch = raw.match(/^(\d{2}):(\d{2})(?::\d{2})?$/);
  if (timeMatch) return `${timeMatch[1]}:${timeMatch[2]}`;

  const d = new Date(raw);
  if (!Number.isNaN(d.getTime())) {
    return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  }

  return raw;
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

function truncateText(value?: string | null, max = 24): string {
  if (!value) return "—";
  const s = String(value).trim();
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
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

function normalizeAGDetail(raw: unknown, fallbackId: string): AGDetailItem {
  const row = isRecord(raw) ? raw : {};

  let exerciceLabel = pickString(row.exercice, row.exercice_label, row.exercice_nom, row.exercice_libelle);

  if (isRecord(row.exercice)) {
    exerciceLabel = pickString(
      row.exercice.libelle,
      row.exercice.nom,
      row.exercice.label,
      row.exercice.reference,
      String(row.exercice.id ?? ""),
    );
  }

  return {
    id: toNumberOrNull(row.id) ?? toNumberOrNull(row.ag_id) ?? toNumberOrNull(row.pk) ?? Number(fallbackId) ?? 0,
    reference: pickString(row.reference, row.ref, row.code) || `AG-${String(fallbackId).padStart(3, "0")}`,
    titre: pickString(row.titre, row.title, row.intitule, row.nom) || "Assemblée générale",
    exercice: exerciceLabel || "—",
    date_ag: pickDate(row.date_ag, row.date, row.date_assemblee, row.date_reunion),
    heure_ag: pickString(row.heure_ag, row.heure, row.time, row.heure_reunion),
    lieu: pickString(row.lieu, row.location, row.endroit) || "—",
    statut: normalizeAGStatus(row.statut ?? row.status ?? row.etat),
    quorum_atteint: toBooleanOrNull(row.quorum_atteint) ?? toBooleanOrNull(row.quorum) ?? toBooleanOrNull(row.quorum_ok),
    description:
      pickString(row.description, row.notes, row.commentaire, row.resume, row.objet) ||
      "Aucune description détaillée n’est encore disponible pour cette assemblée.",

    pv_locked: toBoolean(row.pv_locked),
    pv_status: inferPVStatus(row),
    pv_pdf_url: toAbsoluteBackendUrl(pickNullableString(row.pv_pdf_url)),
    pv_pdf_hash: pickNullableString(row.pv_pdf_hash),
    pv_generated_at: pickNullableString(row.pv_generated_at),
    pv_signed_pdf_url: toAbsoluteBackendUrl(pickNullableString(row.pv_signed_pdf_url)),
    pv_signed_hash: pickNullableString(row.pv_signed_hash),
    pv_signed_at: pickNullableString(row.pv_signed_at),
    pv_signer_subject: pickNullableString(row.pv_signer_subject),

    president_nom: pickNullableString(row.president_nom),
    secretaire_nom: pickNullableString(row.secretaire_nom),
    signature_president_url: toAbsoluteBackendUrl(pickNullableString(row.signature_president_url)),
    signature_secretaire_url: toAbsoluteBackendUrl(pickNullableString(row.signature_secretaire_url)),
    cachet_image_url: toAbsoluteBackendUrl(pickNullableString(row.cachet_image_url)),

    closed_at: pickNullableString(row.closed_at),
    closed_by: toNumberOrNull(row.closed_by),
  };
}

function normalizeResolution(raw: unknown, index: number): ResolutionItem {
  const row = isRecord(raw) ? raw : {};

  const id = toNumberOrNull(row.id) ?? toNumberOrNull(row.resolution_id) ?? toNumberOrNull(row.pk) ?? index + 1;
  const ordre = toNumberOrNull(row.ordre) ?? toNumberOrNull(row.numero_ordre);

  return {
    id,
    numero:
      (ordre !== null ? `R${ordre}` : "") ||
      pickString(row.numero, row.reference, row.code, row.libelle_court) ||
      `R${index + 1}`,
    ordre,
    assemblee_id: toNumberOrNull(row.assemblee_id) ?? toNumberOrNull(row.assemblee) ?? toNumberOrNull(row.ag) ?? null,
    assemblee_ref: pickString(row.assemblee_ref, row.assemblee_reference, row.ag_reference) || "—",
    assemblee_titre:
      pickString(row.assemblee_titre, row.assemblee_nom, row.assemblee_title, row.ag_titre) || "Assemblée générale",
    titre: pickString(row.titre, row.title, row.intitule, row.nom, row.objet) || "Résolution sans titre",
    texte: pickNullableString(row.texte, row.description, row.resume),
    type_majorite: pickNullableString(row.type_majorite),
    tantieme_categorie: pickNullableString(row.tantieme_categorie),
    cloturee: toBooleanOrNull(row.cloturee) ?? false,
    budget_vote: toNumberOrNull(row.budget_vote),
    travaux_dossier_titre: pickNullableString(row.travaux_dossier_titre),
    resultat: normalizeResolutionStatus(row.resultat ?? row.statut ?? row.status ?? row.decision),
  };
}

function extractResolutionRows(data: unknown): ResolutionItem[] {
  if (isPaginatedResponse<Record<string, unknown>>(data)) {
    return data.results.map(normalizeResolution);
  }

  if (Array.isArray(data)) {
    return data.map(normalizeResolution);
  }

  if (isRecord(data)) {
    const candidates = [data.results, data.items, data.resolutions, data.data];
    for (const candidate of candidates) {
      if (Array.isArray(candidate)) {
        return candidate.map(normalizeResolution);
      }
    }
  }

  return [];
}

function getStatusMeta(status: AGStatus): { label: string; kind: "neutral" | "success" | "warning" | "info" } {
  switch (status) {
    case "OUVERTE":
      return { label: "Ouverte", kind: "info" };
    case "CLOTUREE":
      return { label: "Clôturée", kind: "success" };
    case "ARCHIVEE":
      return { label: "Archivée", kind: "neutral" };
    default:
      return { label: "Brouillon", kind: "warning" };
  }
}

function getQuorumMeta(value?: boolean | null): { label: string; kind: "success" | "danger" | "warning" } {
  if (value === true) return { label: "Atteint", kind: "success" };
  if (value === false) return { label: "Non atteint", kind: "danger" };
  return { label: "À vérifier", kind: "warning" };
}

function getPVMeta(status: PVStatus): { label: string; kind: "neutral" | "success" | "warning" | "info" } {
  switch (status) {
    case "GENERE":
      return { label: "Généré", kind: "info" };
    case "SIGNE":
      return { label: "Signé", kind: "success" };
    case "ARCHIVE":
      return { label: "Archivé", kind: "neutral" };
    default:
      return { label: "Brouillon", kind: "warning" };
  }
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

function Card(props: { title: string; children: ReactNode; right?: ReactNode; minHeight?: number }) {
  return (
    <div
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 20,
        padding: 18,
        background: "#ffffff",
        boxShadow: "0 10px 30px rgba(15, 23, 42, 0.04)",
        minHeight: props.minHeight,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          flexWrap: "wrap",
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

function Badge(props: {
  text: string;
  kind?: "neutral" | "success" | "warning" | "danger" | "info";
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

function KeyValueRow(props: { label: string; value: ReactNode }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "220px 1fr",
        gap: 12,
        padding: "10px 0",
        borderBottom: "1px solid #f3f4f6",
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 800, color: "#6b7280" }}>{props.label}</div>
      <div style={{ fontSize: 14, color: "#111827", lineHeight: 1.55 }}>{props.value}</div>
    </div>
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

function getResolutionBadge(item: ResolutionItem) {
  if (item.cloturee && item.resultat === "ADOPTEE") return <Badge text="Adoptée" kind="success" />;
  if (item.cloturee && item.resultat === "REJETEE") return <Badge text="Rejetée" kind="danger" />;
  if (item.cloturee) return <Badge text="Clôturée" kind="neutral" />;
  return <Badge text="En attente" kind="warning" />;
}

async function apiGetFirst(urls: string[]) {
  let lastError: unknown = null;
  for (const url of urls) {
    try {
      return await api.get(url);
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError ?? new Error("Requête impossible.");
}

async function apiPostFirst(urls: string[], data?: unknown, config?: Record<string, unknown>) {
  let lastError: unknown = null;
  for (const url of urls) {
    try {
      return await api.post(url, data, config);
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError ?? new Error("Action impossible.");
}

export default function AGDetail() {
  const navigate = useNavigate();
  const params = useParams();
  const agId = params.id ?? "";

  const signFileRef = useRef<HTMLInputElement | null>(null);

  const [state, setState] = useState<LoadState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<{ kind: FlashKind; text: string } | null>(null);

  const [ag, setAg] = useState<AGDetailItem | null>(null);
  const [resolutions, setResolutions] = useState<ResolutionItem[]>([]);
  const [quorumData, setQuorumData] = useState<QuorumPayload | null>(null);

  const [busyAction, setBusyAction] = useState<string | null>(null);

  async function fetchAGDetail() {
    if (!agId) {
      setState("error");
      setError("Identifiant d’assemblée introuvable.");
      setAg(null);
      setResolutions([]);
      return;
    }

    setState("loading");
    setError(null);

    try {
      const detailRes = await apiGetFirst(AG_DETAIL_ENDPOINT_CANDIDATES(agId));
      const detailData = detailRes?.data;
      const normalizedAG = normalizeAGDetail(detailData, agId);
      setAg(normalizedAG);

      let loadedResolutions: ResolutionItem[] = [];

      try {
        const resolutionsRes = await apiGetFirst(AG_RESOLUTIONS_ENDPOINT_CANDIDATES(agId));
        loadedResolutions = extractResolutionRows(resolutionsRes?.data)
          .filter((item) => item.id > 0)
          .sort((a, b) => (a.ordre ?? 9999) - (b.ordre ?? 9999));
      } catch {
        loadedResolutions = [];
      }

      setResolutions(loadedResolutions);
      setState("success");
    } catch (e) {
      setAg(null);
      setResolutions([]);
      setState("error");
      setError(getErrorMessage(e, "Impossible de charger le détail de l’assemblée."));
    }
  }

  useEffect(() => {
    void fetchAGDetail();
  }, [agId]);

  async function runAction(
    actionKey: string,
    callback: () => Promise<void>,
    successMessage?: string,
  ) {
    setBusyAction(actionKey);
    setActionMessage(null);

    try {
      await callback();
      if (successMessage) {
        setActionMessage({ kind: "success", text: successMessage });
      }
      await fetchAGDetail();
    } catch (e) {
      setActionMessage({
        kind: "error",
        text: getErrorMessage(e, "Action impossible pour le moment."),
      });
    } finally {
      setBusyAction(null);
    }
  }

  async function handleFetchQuorum() {
    await runAction(
      "quorum",
      async () => {
        const res = await apiGetFirst(endpointActionCandidates(agId, "quorum"));
        const data = res?.data as Partial<QuorumPayload>;
        setQuorumData({
          ag_id: Number(data.ag_id ?? agId),
          total_tantiemes_copro: Number(data.total_tantiemes_copro ?? 0),
          tantiemes_presents: Number(data.tantiemes_presents ?? 0),
          quorum_atteint: Boolean(data.quorum_atteint),
          seuil: Number(data.seuil ?? 0.5),
        });
      },
      "Calcul du quorum mis à jour.",
    );
  }

  async function handleInitPresences() {
    await runAction(
      "init-presences",
      async () => {
        await apiPostFirst(endpointActionCandidates(agId, "init-presences"), {});
      },
      "Présences initialisées avec succès.",
    );
  }

  async function handleArchivePv() {
    await runAction(
      "pv-archive",
      async () => {
        await apiPostFirst(endpointActionCandidates(agId, "pv/archive"), {});
      },
      "PV archivé avec succès.",
    );
  }

  async function handleLockPv() {
    await runAction(
      "pv-lock",
      async () => {
        await apiPostFirst(endpointActionCandidates(agId, "pv/lock"), {});
      },
      "PV verrouillé.",
    );
  }

  async function handleCloseAg() {
    const ok = window.confirm("Confirmer la clôture de cette AG ?");
    if (!ok) return;

    await runAction(
      "close-ag",
      async () => {
        await apiPostFirst(endpointActionCandidates(agId, "close"), {});
      },
      "AG clôturée avec succès.",
    );
  }

  async function handleClosePendingResolutions() {
    const pending = resolutions.filter((x) => !x.cloturee);
    if (pending.length === 0) {
      setActionMessage({ kind: "info", text: "Toutes les résolutions de cette AG sont déjà clôturées." });
      return;
    }

    const ok = window.confirm(`Clôturer ${pending.length} résolution(s) encore en attente pour cette AG ?`);
    if (!ok) return;

    await runAction(
      "close-resolutions",
      async () => {
        for (const item of pending) {
          const payload =
            item.budget_vote !== null && item.budget_vote !== undefined
              ? { budget_vote: item.budget_vote }
              : {};
          await api.post(`/api/ag/resolutions/${item.id}/cloturer/`, payload);
        }
      },
      "Résolutions clôturées avec succès.",
    );
  }

  function handleOpenSignedBackend() {
    if (!agId) return;

    const explicitSignedUrl = toAbsoluteBackendUrl(ag?.pv_signed_pdf_url);
    if (explicitSignedUrl) {
      window.open(explicitSignedUrl, "_blank", "noopener,noreferrer");
      return;
    }

    if (ag?.pv_pdf_url) {
      const fallbackMediaUrl = toAbsoluteBackendUrl(ag.pv_pdf_url)?.replace("/ag/pv/", "/ag/pv_signed/");
      if (fallbackMediaUrl) {
        window.open(fallbackMediaUrl, "_blank", "noopener,noreferrer");
        return;
      }
    }

    setActionMessage({
      kind: "error",
      text: "Impossible de déterminer l’URL du PV signé.",
    });
  }

  function handleSelectPfx() {
    signFileRef.current?.click();
  }

  async function handleSignPvFileSelected(file: File | null) {
    if (!file) return;

    const password = window.prompt("Mot de passe du certificat PFX/P12 :");
    if (!password) {
      setActionMessage({ kind: "info", text: "Signature annulée : mot de passe non fourni." });
      if (signFileRef.current) signFileRef.current.value = "";
      return;
    }

    await runAction(
      "pv-sign",
      async () => {
        const formData = new FormData();
        formData.append("pfx", file);
        formData.append("password", password);

        await apiPostFirst(endpointActionCandidates(agId, "pv/sign"), formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      },
      "PV signé avec succès.",
    );

    if (signFileRef.current) {
      signFileRef.current.value = "";
    }
  }

  const stats = useMemo(() => {
    const adoptees = resolutions.filter((x) => x.resultat === "ADOPTEE").length;
    const rejetees = resolutions.filter((x) => x.resultat === "REJETEE").length;
    const enAttente = resolutions.filter((x) => !x.cloturee || x.resultat === "EN_ATTENTE").length;

    return {
      resolutions: resolutions.length,
      adoptees,
      rejetees,
      enAttente,
      pv: ag ? getPVMeta(ag.pv_status).label : "—",
    };
  }, [ag, resolutions]);

  const statusMeta = ag ? getStatusMeta(ag.statut) : null;
  const quorumMeta = ag ? getQuorumMeta(ag.quorum_atteint) : null;
  const pvMeta = ag ? getPVMeta(ag.pv_status) : null;
  const isLoading = state === "loading";

  const pendingResolutions = resolutions.filter((x) => !x.cloturee);
  const canEdit = Boolean(agId) && !ag?.pv_locked && ag?.statut !== "CLOTUREE";
  const canArchive = ag?.statut !== "CLOTUREE" && !ag?.pv_locked;
  const canSign = Boolean(ag?.pv_pdf_url) && !ag?.pv_locked && ag?.statut !== "CLOTUREE";
  const canLock = Boolean(ag?.pv_signed_pdf_url) && !ag?.pv_locked && ag?.statut !== "CLOTUREE";
  const canCloseResolutions = pendingResolutions.length > 0 && ag?.statut !== "CLOTUREE" && !ag?.pv_locked;
  const canClose = Boolean(ag?.pv_locked) && ag?.statut !== "CLOTUREE";
  const hasSignedPdf = Boolean(ag?.pv_signed_pdf_url || ag?.pv_pdf_url);

  return (
    <PageShell>
      <input
        ref={signFileRef}
        type="file"
        accept=".p12,.pfx,application/x-pkcs12"
        style={{ display: "none" }}
        onChange={(e) => {
          const file = e.target.files?.[0] ?? null;
          void handleSignPvFileSelected(file);
        }}
      />

      <SectionTitle
        title="Détail de l’assemblée"
        subtitle="Consultez les informations principales, le statut, le quorum, les résolutions et l’état documentaire réel du procès-verbal."
        right={
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <SmallButton onClick={() => navigate("/ag/assemblees")}>Retour à la liste</SmallButton>
            <SmallButton onClick={() => navigate(`/ag/assemblees/${agId}/modifier`)} disabled={!canEdit}>
              Modifier
            </SmallButton>
            <SmallButton onClick={() => navigate(`/ag/assemblees/${agId}/presences`)}>
              Voir les présences
            </SmallButton>
            <SmallButton onClick={() => navigate(`/ag/assemblees/${agId}/votes`)}>
              Voir les votes
            </SmallButton>
            <SmallButton onClick={() => navigate(`/ag/assemblees/${agId}/pv`)} disabled={!agId}>
              Voir le PV
            </SmallButton>
            <SmallButton onClick={() => navigate(`/ag/assemblees/${agId}/resolutions`)} primary>
              Voir les résolutions
            </SmallButton>
          </div>
        }
      />

      {state === "error" && error ? (
        <AlertBox kind="error">
          <div style={{ fontWeight: 900, marginBottom: 4 }}>Chargement impossible</div>
          <div style={{ fontSize: 13 }}>{error}</div>
        </AlertBox>
      ) : null}

      {actionMessage ? (
        <AlertBox kind={actionMessage.kind}>
          <div style={{ fontSize: 13 }}>{actionMessage.text}</div>
        </AlertBox>
      ) : null}

      <div className="ag-detail-stat-grid">
        <StatCard
          title="Résolutions"
          value={stats.resolutions}
          sub="Nombre total de résolutions rattachées à cette assemblée."
          isLoading={isLoading}
        />
        <StatCard
          title="Adoptées"
          value={stats.adoptees}
          sub="Résolutions adoptées dans le cycle AG."
          isLoading={isLoading}
        />
        <StatCard
          title="En attente"
          value={stats.enAttente}
          sub="Résolutions encore non clôturées ou non tranchées."
          isLoading={isLoading}
        />
        <StatCard
          title="Procès-verbal"
          value={stats.pv}
          sub="État documentaire réel du procès-verbal."
          isLoading={isLoading}
        />
      </div>

      <Card title="Actions métier AG" right={<Badge text="Backend branché" kind="success" />}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <SmallButton onClick={() => void handleFetchQuorum()} disabled={busyAction !== null}>
            {busyAction === "quorum" ? "Calcul..." : "Voir le quorum"}
          </SmallButton>

          <SmallButton
            onClick={() => void handleInitPresences()}
            disabled={busyAction !== null || ag?.pv_locked || ag?.statut === "CLOTUREE"}
          >
            {busyAction === "init-presences" ? "Initialisation..." : "Initialiser les présences"}
          </SmallButton>

          <SmallButton onClick={() => navigate(`/ag/assemblees/${agId}/presences`)} disabled={!agId}>
            Gérer les présences
          </SmallButton>

          <SmallButton onClick={() => navigate(`/ag/assemblees/${agId}/votes`)} disabled={!agId}>
            Gérer les votes
          </SmallButton>

          <SmallButton onClick={() => navigate(`/ag/assemblees/${agId}/pv`)} disabled={!agId}>
            Ouvrir la page PV
          </SmallButton>

          <SmallButton
            onClick={() => void handleClosePendingResolutions()}
            disabled={busyAction !== null || !canCloseResolutions}
          >
            {busyAction === "close-resolutions" ? "Clôture..." : "Clôturer les résolutions"}
          </SmallButton>

          <SmallButton onClick={() => void handleArchivePv()} disabled={busyAction !== null || !canArchive}>
            {busyAction === "pv-archive" ? "Archivage..." : "Archiver le PV"}
          </SmallButton>

          <SmallButton onClick={handleSelectPfx} disabled={busyAction !== null || !canSign}>
            {busyAction === "pv-sign" ? "Signature..." : "Signer le PV"}
          </SmallButton>

          <SmallButton onClick={() => void handleLockPv()} disabled={busyAction !== null || !canLock}>
            {busyAction === "pv-lock" ? "Verrouillage..." : "Verrouiller le PV"}
          </SmallButton>

          <SmallButton onClick={() => void handleCloseAg()} disabled={busyAction !== null || !canClose}>
            {busyAction === "close-ag" ? "Clôture..." : "Clôturer l’AG"}
          </SmallButton>

          <SmallButton onClick={handleOpenSignedBackend} disabled={!hasSignedPdf}>
            Ouvrir le PV signé
          </SmallButton>
        </div>

        {quorumData ? (
          <div style={{ marginTop: 14 }}>
            <div style={infoBox}>
              Quorum : {formatMoneyLikeNumber(quorumData.tantiemes_presents)} /{" "}
              {formatMoneyLikeNumber(quorumData.total_tantiemes_copro)} tantièmes présents — seuil{" "}
              {Math.round((quorumData.seuil || 0) * 100)}% —{" "}
              {quorumData.quorum_atteint ? "atteint" : "non atteint"}.
            </div>
          </div>
        ) : null}
      </Card>

      <div className="ag-detail-main-grid">
        <Card
          title="Informations générales"
          right={statusMeta ? <Badge text={statusMeta.label} kind={statusMeta.kind} /> : undefined}
          minHeight={320}
        >
          {isLoading ? (
            <div style={{ color: "#6b7280", fontSize: 14 }}>Chargement des informations générales…</div>
          ) : !ag ? (
            <EmptyState
              title="Assemblée introuvable"
              text="Le détail de cette assemblée n’a pas pu être chargé."
              actionLabel="Retour à la liste"
              onAction={() => navigate("/ag/assemblees")}
            />
          ) : (
            <div>
              <KeyValueRow label="Référence" value={ag.reference} />
              <KeyValueRow label="Titre" value={ag.titre} />
              <KeyValueRow label="Exercice" value={ag.exercice} />
              <KeyValueRow label="Date" value={formatDateShort(ag.date_ag)} />
              <KeyValueRow label="Heure" value={formatTimeShort(ag.heure_ag)} />
              <KeyValueRow label="Lieu" value={ag.lieu || "—"} />
              <KeyValueRow
                label="Quorum"
                value={quorumMeta ? <Badge text={quorumMeta.label} kind={quorumMeta.kind} /> : "—"}
              />
              <KeyValueRow
                label="Procès-verbal"
                value={pvMeta ? <Badge text={pvMeta.label} kind={pvMeta.kind} /> : "—"}
              />
              <KeyValueRow
                label="Verrouillage PV"
                value={
                  ag.pv_locked ? (
                    <Badge text="Verrouillé" kind="neutral" />
                  ) : (
                    <Badge text="Non verrouillé" kind="warning" />
                  )
                }
              />
              {ag.closed_at ? <KeyValueRow label="Clôturée le" value={formatDateTimeShort(ag.closed_at)} /> : null}
            </div>
          )}
        </Card>

        <Card title="État documentaire du PV" minHeight={320} right={<Badge text="Traçabilité" kind="info" />}>
          {isLoading ? (
            <div style={{ color: "#6b7280", fontSize: 14 }}>Chargement des informations documentaires…</div>
          ) : !ag ? (
            <div style={{ fontSize: 14, color: "#6b7280", lineHeight: 1.7 }}>
              Aucune information documentaire n’est disponible pour cette assemblée.
            </div>
          ) : (
            <>
              <div style={{ display: "grid", gap: 10 }}>
                <KeyValueRow label="État PV" value={pvMeta ? <Badge text={pvMeta.label} kind={pvMeta.kind} /> : "—"} />
                <KeyValueRow label="Hash PDF" value={truncateText(ag.pv_signed_hash || ag.pv_pdf_hash, 26)} />
                <KeyValueRow label="Généré le" value={formatDateTimeShort(ag.pv_generated_at)} />
                <KeyValueRow label="Signé le" value={formatDateTimeShort(ag.pv_signed_at)} />
                <KeyValueRow label="Signataire" value={ag.pv_signer_subject || "—"} />
                <KeyValueRow label="Président" value={ag.president_nom || "—"} />
                <KeyValueRow label="Secrétaire" value={ag.secretaire_nom || "—"} />
              </div>

              <div style={{ marginTop: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
                {ag.pv_signed_pdf_url ? (
                  <a href={ag.pv_signed_pdf_url} target="_blank" rel="noreferrer" style={primaryMiniLink}>
                    Ouvrir le PDF signé
                  </a>
                ) : null}

                {!ag.pv_signed_pdf_url && ag.pv_pdf_url ? (
                  <a href={ag.pv_pdf_url} target="_blank" rel="noreferrer" style={secondaryMiniLink}>
                    Ouvrir le PDF
                  </a>
                ) : null}

                {ag.signature_president_url ? (
                  <a href={ag.signature_president_url} target="_blank" rel="noreferrer" style={secondaryMiniLink}>
                    Signature président
                  </a>
                ) : null}

                {ag.signature_secretaire_url ? (
                  <a href={ag.signature_secretaire_url} target="_blank" rel="noreferrer" style={secondaryMiniLink}>
                    Signature secrétaire
                  </a>
                ) : null}

                {ag.cachet_image_url ? (
                  <a href={ag.cachet_image_url} target="_blank" rel="noreferrer" style={secondaryMiniLink}>
                    Cachet
                  </a>
                ) : null}
              </div>

              <div style={{ marginTop: 16 }}>
                <div style={infoBox}>
                  Cette vue détail reflète l’état documentaire réel exposé par le backend : génération,
                  signature, verrouillage et éléments de traçabilité du procès-verbal.
                </div>
              </div>
            </>
          )}
        </Card>
      </div>

      <Card title="Résolutions liées à cette assemblée" right={<Badge text="Aperçu métier" kind="info" />} minHeight={120}>
        {isLoading ? (
          <div style={{ color: "#6b7280", fontSize: 14 }}>Chargement des résolutions…</div>
        ) : resolutions.length === 0 ? (
          <EmptyState
            title="Aucune résolution liée"
            text="Aucune résolution n’a encore été trouvée pour cette assemblée."
          />
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {resolutions.map((item) => (
              <div
                key={item.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "86px 1fr auto",
                  gap: 12,
                  alignItems: "start",
                  padding: 12,
                  border: "1px solid #eef2f7",
                  borderRadius: 14,
                  background: "#fff",
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 900, color: "#111827" }}>{item.numero}</div>

                <div style={{ display: "grid", gap: 6 }}>
                  <div style={{ fontSize: 14, color: "#111827", fontWeight: 700 }}>{item.titre}</div>

                  {item.texte ? (
                    <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>{item.texte}</div>
                  ) : null}

                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {item.type_majorite ? <Badge text={item.type_majorite} kind="neutral" /> : null}
                    {item.tantieme_categorie ? <Badge text={item.tantieme_categorie} kind="neutral" /> : null}
                    {item.travaux_dossier_titre ? <Badge text={item.travaux_dossier_titre} kind="info" /> : null}
                    {item.budget_vote !== null && item.budget_vote !== undefined ? (
                      <Badge text={formatMoneyFCFA(item.budget_vote)} kind="success" />
                    ) : null}
                  </div>
                </div>

                <div>{getResolutionBadge(item)}</div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <style>{`
        .ag-detail-stat-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 14px;
        }

        .ag-detail-main-grid {
          display: grid;
          grid-template-columns: 1.05fr 0.95fr;
          gap: 14px;
        }

        @media (max-width: 1200px) {
          .ag-detail-stat-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .ag-detail-main-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 760px) {
          .ag-detail-stat-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 680px) {
          .ag-detail-main-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </PageShell>
  );
}

function formatMoneyLikeNumber(value?: number | null) {
  if (value === null || value === undefined) return "0";
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(value);
}

const infoBox: CSSProperties = {
  padding: 14,
  borderRadius: 14,
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
  color: "#475569",
  fontSize: 13,
  lineHeight: 1.6,
};

const primaryMiniLink: CSSProperties = {
  padding: "7px 10px",
  borderRadius: 10,
  border: "1px solid #c7d2fe",
  background: "#eef2ff",
  fontSize: 12,
  fontWeight: 700,
  color: "#3730a3",
  textDecoration: "none",
  display: "inline-flex",
  alignItems: "center",
};

const secondaryMiniLink: CSSProperties = {
  padding: "7px 10px",
  borderRadius: 10,
  border: "1px solid #e5e7eb",
  background: "#fff",
  fontSize: 12,
  fontWeight: 700,
  color: "#111827",
  textDecoration: "none",
  display: "inline-flex",
  alignItems: "center",
};