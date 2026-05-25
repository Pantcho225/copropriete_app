import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type ReactNode,
} from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../../api/axios";

type LoadState = "loading" | "success" | "error";
type FlashKind = "success" | "error" | "info";
type BadgeKind = "neutral" | "success" | "warning" | "danger" | "info";
type ButtonVariant = "primary" | "secondary" | "danger";
type KPIAccent = "neutral" | "success" | "warning" | "danger" | "info";

type AGStatus =
  | "BROUILLON"
  | "CONVOQUEE"
  | "OUVERTE"
  | "CLOTUREE"
  | "ANNULEE"
  | "ARCHIVEE";

type ResolutionStatus = "ADOPTEE" | "REJETEE" | "EN_ATTENTE";
type PVStatus = "NON_GENERE" | "ARCHIVE" | "SIGNE" | "VERROUILLE";

type AGDetailItem = {
  id: number;
  reference: string;
  titre: string;
  exercice: string;
  date_ag: string;
  heure_ag?: string | null;
  lieu?: string | null;
  statut: AGStatus | string;
  description?: string | null;
  nb_resolutions?: number;
  nb_presences?: number;
  nb_votes?: number;
  quorum_atteint?: boolean | null;
  total_tantiemes_copro?: number | null;
  tantiemes_presents?: number | null;
  seuil_quorum?: number | null;
  pv_status?: PVStatus | string;
  pv_locked?: boolean | null;
  pv_pdf_url?: string | null;
  pv_signed_pdf_url?: string | null;
  pv_generated_at?: string | null;
  pv_signed_at?: string | null;
  pv_signer_subject?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type ResolutionItem = {
  id: number;
  numero?: string | null;
  titre?: string | null;
  objet?: string | null;
  statut?: ResolutionStatus | string | null;
  majorite_requise?: string | null;
  budget_vote?: number | string | null;
};

type PresenceItem = {
  id: number;
  present?: boolean | null;
  est_present?: boolean | null;
  present_ou_represente?: boolean | null;
  lot?: number | string | null;
};

type VoteItem = {
  id: number;
  resolution?: number | null;
  lot?: number | null;
  choix?: string | null;
};

type QuorumResponse = {
  ag_id?: number;
  total_tantiemes_copro?: number | null;
  tantiemes_presents?: number | null;
  quorum_atteint?: boolean | null;
  seuil?: number | null;
  has_zero_tantieme_lots?: boolean | null;
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

function isPaginated<T>(value: unknown): value is DRFPage<T> {
  return isRecord(value) && Array.isArray((value as DRFPage<T>).results) && "count" in value;
}

function extractRows<T = unknown>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];

  if (isPaginated<T>(value)) return value.results;

  if (isRecord(value)) {
    const candidates = [value.results, value.items, value.data];

    for (const candidate of candidates) {
      if (Array.isArray(candidate)) return candidate as T[];
    }
  }

  return [];
}

function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;

  if (typeof value === "string") {
    const normalized = value.replace(/\s/g, "").replace(",", ".");
    const parsed = Number(normalized);

    if (Number.isFinite(parsed)) return parsed;
  }

  return fallback;
}

function toNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;

  const n = toNumber(value, Number.NaN);
  return Number.isFinite(n) ? n : null;
}

function toText(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function toBooleanOrNull(value: unknown): boolean | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;

  if (typeof value === "string") {
    const s = value.trim().toLowerCase();

    if (["true", "1", "oui", "yes", "ok", "present", "présent"].includes(s)) {
      return true;
    }

    if (["false", "0", "non", "no", "absent"].includes(s)) {
      return false;
    }
  }

  return null;
}

function normalizeText(value: unknown, fallback = ""): string {
  return toText(value, fallback)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
}

function normalizeAGStatus(value: unknown): AGStatus {
  const raw = normalizeText(value, "BROUILLON");

  if (raw.includes("ANNU")) return "ANNULEE";
  if (raw.includes("ARCHIV")) return "ARCHIVEE";
  if (raw.includes("CLOT")) return "CLOTUREE";
  if (raw.includes("OUVERT")) return "OUVERTE";
  if (raw.includes("CONVO")) return "CONVOQUEE";

  return "BROUILLON";
}

function normalizeResolutionStatus(value: unknown): ResolutionStatus {
  const raw = normalizeText(value, "EN_ATTENTE");

  if (raw.includes("ADOP") || raw.includes("APPROUV") || raw.includes("VALID")) {
    return "ADOPTEE";
  }

  if (raw.includes("REJET") || raw.includes("REFUS")) {
    return "REJETEE";
  }

  return "EN_ATTENTE";
}

function normalizePVStatusFromAG(data: Record<string, unknown>): PVStatus {
  const explicit = normalizeText(data.pv_status ?? data.pvStatut ?? "", "");

  if (explicit.includes("VERROU")) return "VERROUILLE";
  if (explicit.includes("SIG")) return "SIGNE";
  if (explicit.includes("ARCHIV")) return "ARCHIVE";

  const pvLocked = toBooleanOrNull(data.pv_locked ?? data.pvLocked) === true;

  const signedPdf =
    data.pv_signed_pdf_url ??
    data.pvSignedPdfUrl ??
    data.pv_signed_pdf ??
    data.pvSignedPdf;

  const signedAt = data.pv_signed_at ?? data.pvSignedAt;

  const archivedPdf =
    data.pv_pdf_url ??
    data.pvPdfUrl ??
    data.pv_pdf ??
    data.pvPdf;

  const archivedAt = data.pv_generated_at ?? data.pvGeneratedAt;

  if (pvLocked) return "VERROUILLE";
  if (signedPdf || signedAt) return "SIGNE";
  if (archivedPdf || archivedAt) return "ARCHIVE";

  return "NON_GENERE";
}

function normalizeAGDetail(payload: Record<string, unknown>): AGDetailItem {
  return {
    id: toNumber(payload.id),
    reference: toText(payload.reference) || toText(payload.ref) || `AG-${toNumber(payload.id)}`,
    titre: toText(payload.titre) || toText(payload.title) || "Assemblée générale",
    exercice: toText(payload.exercice) || "—",
    date_ag: toText(payload.date_ag) || toText(payload.date) || toText(payload.dateAG) || "",
    heure_ag: toText(payload.heure_ag) || toText(payload.heure) || toText(payload.time) || null,
    lieu: toText(payload.lieu) || toText(payload.location) || null,
    statut: toText(payload.statut ?? payload.status, "BROUILLON"),
    description: toText(payload.description) || toText(payload.notes) || null,
    nb_resolutions: toNumber(
      payload.nb_resolutions ?? payload.resolutions_count ?? payload.total_resolutions,
      0,
    ),
    nb_presences: toNumber(
      payload.nb_presences ?? payload.presences_count ?? payload.total_presences,
      0,
    ),
    nb_votes: toNumber(payload.nb_votes ?? payload.votes_count ?? payload.total_votes, 0),
    quorum_atteint:
      typeof payload.quorum_atteint === "boolean"
        ? payload.quorum_atteint
        : typeof payload.quorumAtteint === "boolean"
          ? (payload.quorumAtteint as boolean)
          : null,
    total_tantiemes_copro: toNullableNumber(
      payload.total_tantiemes_copro ?? payload.totalTantiemesCopro,
    ),
    tantiemes_presents: toNullableNumber(
      payload.tantiemes_presents ?? payload.tantiemesPresents,
    ),
    seuil_quorum: toNullableNumber(
      payload.seuil_quorum ?? payload.seuil ?? payload.quorum_threshold,
    ),
    pv_status: toText(payload.pv_status ?? payload.pvStatut, ""),
    pv_locked: toBooleanOrNull(payload.pv_locked ?? payload.pvLocked),
    pv_pdf_url:
      toText(payload.pv_pdf_url) ||
      toText(payload.pvPdfUrl) ||
      toText(payload.pv_pdf) ||
      null,
    pv_signed_pdf_url:
      toText(payload.pv_signed_pdf_url) ||
      toText(payload.pvSignedPdfUrl) ||
      toText(payload.pv_signed_pdf) ||
      null,
    pv_generated_at:
      toText(payload.pv_generated_at) || toText(payload.pvGeneratedAt) || null,
    pv_signed_at: toText(payload.pv_signed_at) || toText(payload.pvSignedAt) || null,
    pv_signer_subject:
      toText(payload.pv_signer_subject) || toText(payload.pvSignerSubject) || null,
    created_at: toText(payload.created_at) || null,
    updated_at: toText(payload.updated_at) || null,
  };
}

function normalizeResolution(payload: Record<string, unknown>): ResolutionItem {
  const rawBudget = payload.budget_vote ?? payload.budgetVote ?? null;

  const resultatDetail = isRecord(payload.resultat_detail)
    ? payload.resultat_detail
    : null;

  const rawResolutionStatus =
    payload.decision ??
    payload.resultat ??
    payload.result ??
    payload.statut_resolution ??
    payload.vote_result ??
    payload.outcome ??
    payload.statut ??
    payload.status ??
    resultatDetail?.decision;

  return {
    id: toNumber(payload.id),
    numero: toText(payload.numero) || toText(payload.reference) || null,
    titre: toText(payload.titre) || toText(payload.title) || null,
    objet: toText(payload.objet) || null,
    statut: normalizeResolutionStatus(rawResolutionStatus),
    majorite_requise:
      toText(payload.majorite_requise) || toText(payload.majority_rule) || null,
    budget_vote:
      typeof rawBudget === "number" || typeof rawBudget === "string"
        ? rawBudget
        : null,
  };
}

function formatDate(value?: string | null): string {
  if (!value) return "Non renseignée";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "long",
  }).format(date);
}

function formatDateTime(value?: string | null): string {
  if (!value) return "Non disponible";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatNumber(value?: number | null): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("fr-FR").format(value);
}

function formatPercent(value?: number | null): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";

  const safe = value <= 1 ? value * 100 : value;
  return `${safe.toFixed(0)} %`;
}

function formatCurrency(value?: number | string | null): string {
  const amount = toNullableNumber(value);

  if (amount === null) return "—";

  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "XOF",
    maximumFractionDigits: 0,
  }).format(amount);
}

function buildMediaUrl(value?: string | null): string | null {
  if (!value) return null;

  if (value.startsWith("http://") || value.startsWith("https://")) {
    return value.replace("http://localhost:", "http://127.0.0.1:");
  }

  const baseURL =
    (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/+$/, "") ||
    "http://127.0.0.1:8002";

  const cleanBase = baseURL.replace(/\/api$/, "");

  if (value.startsWith("/api/media/")) {
    return `${cleanBase}${value.replace(/^\/api/, "")}`;
  }

  if (value.startsWith("/media/")) {
    return `${cleanBase}${value}`;
  }

  if (value.startsWith("/")) return `${baseURL}${value}`;

  return `${baseURL}/${value}`;
}

function badgeToneForAG(status: AGStatus): BadgeKind {
  switch (status) {
    case "OUVERTE":
      return "info";
    case "CONVOQUEE":
      return "warning";
    case "CLOTUREE":
    case "ARCHIVEE":
      return "success";
    case "ANNULEE":
      return "danger";
    default:
      return "neutral";
  }
}

function labelForAG(status: AGStatus): string {
  switch (status) {
    case "BROUILLON":
      return "Brouillon";
    case "CONVOQUEE":
      return "Convoquée";
    case "OUVERTE":
      return "Ouverte";
    case "CLOTUREE":
      return "Clôturée";
    case "ANNULEE":
      return "Annulée";
    case "ARCHIVEE":
      return "Archivée";
    default:
      return status;
  }
}

function badgeToneForPV(status: PVStatus): BadgeKind {
  switch (status) {
    case "VERROUILLE":
      return "success";
    case "SIGNE":
      return "info";
    case "ARCHIVE":
      return "warning";
    default:
      return "neutral";
  }
}

function labelForPV(status: PVStatus): string {
  switch (status) {
    case "NON_GENERE":
      return "Non généré";
    case "ARCHIVE":
      return "Archivé";
    case "SIGNE":
      return "Signé";
    case "VERROUILLE":
      return "Verrouillé";
    default:
      return status;
  }
}

function badgeToneForResolution(status: ResolutionStatus): BadgeKind {
  switch (status) {
    case "ADOPTEE":
      return "success";
    case "REJETEE":
      return "danger";
    default:
      return "warning";
  }
}

function labelForResolution(status: ResolutionStatus): string {
  switch (status) {
    case "ADOPTEE":
      return "Adoptée";
    case "REJETEE":
      return "Rejetée";
    default:
      return "En attente";
  }
}

function getResolutionTitle(item: ResolutionItem): string {
  return item.titre || item.objet || item.numero || `Résolution #${item.id}`;
}

function computePresenceRate(presents?: number | null, total?: number | null): number | null {
  if (
    presents === null ||
    presents === undefined ||
    total === null ||
    total === undefined ||
    total <= 0
  ) {
    return null;
  }

  return (presents / total) * 100;
}

function getStatusNarrative(status: AGStatus): string {
  if (status === "OUVERTE") {
    return "L’assemblée est active. Vous pouvez poursuivre les présences, les résolutions, les votes et la production du procès-verbal.";
  }

  if (status === "CONVOQUEE") {
    return "L’assemblée est convoquée. La priorité porte sur la préparation opérationnelle, les présences et la structuration des décisions à traiter.";
  }

  if (status === "CLOTUREE") {
    return "L’assemblée est clôturée. Le pilotage porte désormais sur la traçabilité, le procès-verbal final et l’exploitation des décisions adoptées.";
  }

  if (status === "ARCHIVEE") {
    return "Cette assemblée est archivée. Elle reste disponible pour consultation, traçabilité et contrôle documentaire.";
  }

  if (status === "ANNULEE") {
    return "Cette assemblée est annulée. Les actions métier doivent rester limitées à la consultation.";
  }

  return "L’assemblée est encore en préparation. Vous pouvez finaliser les éléments avant l’ouverture opérationnelle.";
}

function getPVNarrative(status: PVStatus): string {
  switch (status) {
    case "VERROUILLE":
      return "Le procès-verbal est signé et verrouillé. Le dossier documentaire est prêt pour la clôture de l’assemblée.";
    case "SIGNE":
      return "Le procès-verbal est signé. Le verrouillage constitue la prochaine étape attendue.";
    case "ARCHIVE":
      return "Le procès-verbal est archivé, mais pas encore signé. La signature reste l’étape prioritaire.";
    default:
      return "Aucun procès-verbal finalisé n’est encore disponible pour cette assemblée.";
  }
}

function getPVActionHint(args: {
  isArchived: boolean;
  isSigned: boolean;
  isLocked: boolean;
  isClosed: boolean;
  isCancelled: boolean;
  isArchivedAG: boolean;
}): string {
  const { isArchived, isSigned, isLocked, isClosed, isCancelled, isArchivedAG } = args;

  if (isCancelled) {
    return "Assemblée annulée. Les actions de traitement sont limitées à la consultation.";
  }

  if (isClosed) {
    return "Assemblée clôturée. Le cycle métier est terminé.";
  }

  if (isArchivedAG) {
    return "Assemblée archivée. Elle reste disponible pour consultation et contrôle documentaire.";
  }

  if (!isArchived) {
    return "Prochaine étape attendue : archiver le procès-verbal.";
  }

  if (isArchived && !isSigned) {
    return "Prochaine étape attendue : signer le procès-verbal archivé.";
  }

  if (isSigned && !isLocked) {
    return "Prochaine étape attendue : verrouiller le procès-verbal signé.";
  }

  if (isLocked && !isClosed) {
    return "Le procès-verbal est verrouillé. Vous pouvez maintenant clôturer l’assemblée.";
  }

  return "Le cycle documentaire est finalisé pour cette assemblée.";
}

function getBackendErrorMessage(error: unknown, fallback: string): string {
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

  if (typeof data?.detail === "string" && data.detail.trim()) {
    return data.detail;
  }

  if (Array.isArray(data?.detail) && typeof data.detail[0] === "string") {
    return data.detail[0];
  }

  if (typeof data?.message === "string" && data.message.trim()) {
    return data.message;
  }

  if (data?.errors && typeof data.errors === "object") {
    const firstEntry = Object.values(data.errors)[0];

    if (Array.isArray(firstEntry) && typeof firstEntry[0] === "string") {
      return firstEntry[0];
    }
  }

  if (data && typeof data === "object") {
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

async function postToFirstWorkingEndpoint(urls: string[]) {
  let lastError: unknown = null;

  for (const url of urls) {
    try {
      return await api.post(url);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError ?? new Error("Aucun endpoint compatible trouvé.");
}

function PageShell({ children }: { children: ReactNode }) {
  return <div className="agdetail-page">{children}</div>;
}

function PageHeader(props: { title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <div className="agdetail-page-header">
      <div>
        <div className="agdetail-eyebrow">Pilotage du module AG</div>
        <h1>{props.title}</h1>
        {props.subtitle ? <p>{props.subtitle}</p> : null}
      </div>

      {props.right ? <div className="agdetail-header-actions">{props.right}</div> : null}
    </div>
  );
}

function AlertBox(props: { kind: FlashKind; title?: string; children: ReactNode }) {
  return (
    <div className={`agdetail-alert agdetail-alert-${props.kind}`}>
      {props.title ? <strong>{props.title}</strong> : null}
      <span>{props.children}</span>
    </div>
  );
}

function Badge(props: { text: string; kind?: BadgeKind }) {
  return (
    <span className={`agdetail-badge agdetail-badge-${props.kind ?? "neutral"}`}>
      {props.text}
    </span>
  );
}

function AppButton(props: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: ButtonVariant;
}) {
  return (
    <button
      type="button"
      className={`agdetail-btn agdetail-btn-${props.variant ?? "secondary"}`}
      onClick={props.onClick}
      disabled={props.disabled}
    >
      {props.children}
    </button>
  );
}

function SmallButton(props: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  primary?: boolean;
  danger?: boolean;
}) {
  const variant = props.danger ? "danger" : props.primary ? "primary" : "secondary";

  return (
    <button
      type="button"
      className={`agdetail-small-btn agdetail-small-btn-${variant}`}
      onClick={props.onClick}
      disabled={props.disabled}
    >
      {props.children}
    </button>
  );
}

function SummaryCard(props: {
  label: string;
  value: string | number;
  helper: string;
  tone?: KPIAccent;
}) {
  return (
    <div className={`agdetail-summary-card agdetail-summary-${props.tone ?? "neutral"}`}>
      <div className="agdetail-summary-label">{props.label}</div>
      <div className="agdetail-summary-value">{props.value}</div>
      <div className="agdetail-summary-helper">{props.helper}</div>
    </div>
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
    <section className="agdetail-section">
      <div className="agdetail-section-header">
        <div>
          <h2>{props.title}</h2>
          {props.subtitle ? <p>{props.subtitle}</p> : null}
        </div>

        {props.right ? <div>{props.right}</div> : null}
      </div>

      <div className={props.flush ? "agdetail-section-body-flush" : "agdetail-section-body"}>
        {props.children}
      </div>
    </section>
  );
}

function DetailRow(props: { label: string; value: string }) {
  return (
    <div className="agdetail-row">
      <span>{props.label}</span>
      <strong>{props.value}</strong>
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
    <div className="agdetail-empty">
      <strong>{props.title}</strong>
      <p>{props.text}</p>

      {props.actionLabel && props.onAction ? (
        <SmallButton primary onClick={props.onAction}>
          {props.actionLabel}
        </SmallButton>
      ) : null}
    </div>
  );
}

function AGDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const agId = Number(id);

  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [detail, setDetail] = useState<AGDetailItem | null>(null);
  const [resolutions, setResolutions] = useState<ResolutionItem[]>([]);
  const [presenceRows, setPresenceRows] = useState<PresenceItem[]>([]);
  const [voteRows, setVoteRows] = useState<VoteItem[]>([]);
  const [quorum, setQuorum] = useState<QuorumResponse | null>(null);
  const [flash, setFlash] = useState<{ kind: FlashKind; message: string } | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const [showSignModal, setShowSignModal] = useState(false);
  const [signPassword, setSignPassword] = useState("");
  const [signPfxFile, setSignPfxFile] = useState<File | null>(null);

  const showFlash = useCallback((kind: FlashKind, message: string) => {
    setFlash({ kind, message });

    window.setTimeout(() => {
      setFlash((current) => (current?.message === message ? null : current));
    }, 3500);
  }, []);

  const fetchDetail = useCallback(async () => {
    if (!Number.isFinite(agId) || agId <= 0) {
      setLoadState("error");
      setFlash({
        kind: "error",
        message: "Identifiant d’assemblée invalide.",
      });
      return;
    }

    setLoadState("loading");

    try {
      let agData: AGDetailItem | null = null;

      for (const base of AG_ENDPOINT_CANDIDATES) {
        try {
          const response = await api.get(`${base.replace(/\/$/, "")}/${agId}/`);

          if (isRecord(response.data)) {
            agData = normalizeAGDetail(response.data);
            break;
          }
        } catch {
          // endpoint candidat suivant
        }
      }

      if (!agData) {
        throw new Error("Impossible de charger le détail de l’assemblée.");
      }

      let resolutionItems: ResolutionItem[] = [];

      const resolutionQueries = [
        `${RESOLUTION_ENDPOINT_CANDIDATES[0]}?ag=${agId}`,
        `${RESOLUTION_ENDPOINT_CANDIDATES[0]}?assemblee=${agId}`,
        `${RESOLUTION_ENDPOINT_CANDIDATES[0]}?assemblee_generale=${agId}`,
        `/api/ag/ags/${agId}/resolutions/`,
      ];

      for (const url of resolutionQueries) {
        try {
          const response = await api.get(url);
          const rows = extractRows<Record<string, unknown>>(response.data);

          if (
            rows.length > 0 ||
            Array.isArray(response.data) ||
            isPaginated<Record<string, unknown>>(response.data)
          ) {
            resolutionItems = rows.filter(isRecord).map((item) => normalizeResolution(item));
            break;
          }
        } catch {
          // endpoint candidat suivant
        }
      }

      let fetchedPresences: PresenceItem[] = [];

      const presenceQueries = [
        `/api/ag/presences/?ag=${agId}`,
        `/api/ag/presences/?assemblee=${agId}`,
        `/api/ag/presences/?assemblee_generale=${agId}`,
        `/api/ag/ags/${agId}/presences/`,
      ];

      for (const url of presenceQueries) {
        try {
          const response = await api.get(url);
          const rows = extractRows<Record<string, unknown>>(response.data);

          if (
            rows.length > 0 ||
            Array.isArray(response.data) ||
            isPaginated<Record<string, unknown>>(response.data)
          ) {
            fetchedPresences = rows.filter(isRecord) as PresenceItem[];
            break;
          }
        } catch {
          // endpoint candidat suivant
        }
      }

      let fetchedVotes: VoteItem[] = [];

      const voteQueries = [
        `/api/ag/votes/?ag=${agId}`,
        `/api/ag/votes/?assemblee=${agId}`,
        `/api/ag/votes/?assemblee_generale=${agId}`,
        `/api/ag/ags/${agId}/votes/`,
      ];

      for (const url of voteQueries) {
        try {
          const response = await api.get(url);
          const rows = extractRows<Record<string, unknown>>(response.data);

          if (
            rows.length > 0 ||
            Array.isArray(response.data) ||
            isPaginated<Record<string, unknown>>(response.data)
          ) {
            fetchedVotes = rows.filter(isRecord) as VoteItem[];
            break;
          }
        } catch {
          // endpoint candidat suivant
        }
      }

      let quorumData: QuorumResponse | null = null;

      try {
        const response = await api.get(`/api/ag/ags/${agId}/quorum/`);

        if (isRecord(response.data)) {
          quorumData = {
            ag_id: toNullableNumber(response.data.ag_id ?? response.data.id) ?? undefined,
            total_tantiemes_copro: toNullableNumber(response.data.total_tantiemes_copro),
            tantiemes_presents: toNullableNumber(response.data.tantiemes_presents),
            quorum_atteint:
              typeof response.data.quorum_atteint === "boolean"
                ? response.data.quorum_atteint
                : null,
            seuil: toNullableNumber(response.data.seuil),
            has_zero_tantieme_lots:
              typeof response.data.has_zero_tantieme_lots === "boolean"
                ? response.data.has_zero_tantieme_lots
                : null,
          };
        }
      } catch {
        quorumData = null;
      }

      setDetail(agData);
      setResolutions(resolutionItems);
      setPresenceRows(fetchedPresences);
      setVoteRows(fetchedVotes);
      setQuorum(quorumData);
      setLoadState("success");
    } catch (error) {
      console.error(error);
      setLoadState("error");
      setFlash({
        kind: "error",
        message: "Impossible de charger le détail de l’assemblée générale.",
      });
    }
  }, [agId]);

  useEffect(() => {
    void fetchDetail();
  }, [fetchDetail]);

  const agStatus = useMemo<AGStatus>(() => {
    return detail ? normalizeAGStatus(detail.statut) : "BROUILLON";
  }, [detail]);

  const pvStatus = useMemo<PVStatus>(() => {
    return detail
      ? normalizePVStatusFromAG(detail as unknown as Record<string, unknown>)
      : "NON_GENERE";
  }, [detail]);

  const isClosed = agStatus === "CLOTUREE";
  const isCancelled = agStatus === "ANNULEE";
  const isArchivedAG = agStatus === "ARCHIVEE";
  const isReadOnly = isClosed || isCancelled || isArchivedAG;

  const isArchivedPV =
    pvStatus === "ARCHIVE" || pvStatus === "SIGNE" || pvStatus === "VERROUILLE";

  const isSignedPV = pvStatus === "SIGNE" || pvStatus === "VERROUILLE";

  const isLockedPV = pvStatus === "VERROUILLE" || detail?.pv_locked === true;

  const archiveDisabled = isArchivedPV || isReadOnly;
  const signDisabled = !isArchivedPV || isSignedPV || isReadOnly;
  const lockDisabled = !isSignedPV || isLockedPV || isReadOnly;

  /**
   * Point critique du verrouillage AG :
   * Le PV verrouillé doit permettre la clôture de l'assemblée.
   * Il ne faut donc pas masquer le bouton "Clôturer" dès que le PV est verrouillé.
   */
  const closeDisabled = !isLockedPV || isReadOnly;

  const showFinalStateBanner = isClosed || isCancelled || isArchivedAG;

  const finalStateMessage = isClosed
    ? "Cette assemblée est clôturée. Les actions de traitement sont maintenant limitées à la consultation."
    : isCancelled
      ? "Cette assemblée est annulée. Elle reste disponible uniquement pour consultation."
      : isArchivedAG
        ? "Cette assemblée est archivée. Elle reste disponible pour consultation et contrôle documentaire."
        : null;

  const pvPrimaryUrl = useMemo(() => {
    if (!detail) return null;

    return buildMediaUrl(detail.pv_signed_pdf_url) || buildMediaUrl(detail.pv_pdf_url) || null;
  }, [detail]);

  const resolutionStats = useMemo(() => {
    const total = resolutions.length;

    const adopted = resolutions.filter(
      (item) => normalizeResolutionStatus(item.statut) === "ADOPTEE",
    ).length;

    const rejected = resolutions.filter(
      (item) => normalizeResolutionStatus(item.statut) === "REJETEE",
    ).length;

    const pending = total - adopted - rejected;

    return { total, adopted, rejected, pending };
  }, [resolutions]);

  const computedQuorum = useMemo(() => {
    const total = quorum?.total_tantiemes_copro ?? detail?.total_tantiemes_copro ?? null;
    const present = quorum?.tantiemes_presents ?? detail?.tantiemes_presents ?? null;
    const threshold = quorum?.seuil ?? detail?.seuil_quorum ?? null;
    const reached = quorum?.quorum_atteint ?? detail?.quorum_atteint ?? null;

    return {
      total,
      present,
      threshold,
      reached,
      rate: computePresenceRate(present, total),
    };
  }, [detail, quorum]);

  const realPresenceCount = useMemo(() => {
    if (presenceRows.length > 0) {
      return presenceRows.filter((item) => {
        const flags = [item.present, item.est_present, item.present_ou_represente];
        const normalized = flags.map((flag) => toBooleanOrNull(flag)).filter((v) => v !== null);

        if (normalized.length === 0) return true;

        return normalized.some(Boolean);
      }).length;
    }

    return detail?.nb_presences ?? 0;
  }, [presenceRows, detail]);

  const realVoteCount = useMemo(() => {
    if (voteRows.length > 0) return voteRows.length;
    return detail?.nb_votes ?? 0;
  }, [voteRows, detail]);

  const resolvedResolutionsCount =
    resolutions.length > 0 ? resolutions.length : detail?.nb_resolutions ?? 0;

  const resolvedPresencesCount =
    realPresenceCount > 0 ? realPresenceCount : detail?.nb_presences ?? 0;

  const resolvedVotesCount = realVoteCount > 0 ? realVoteCount : detail?.nb_votes ?? 0;

  const pvActionHint = getPVActionHint({
    isArchived: isArchivedPV,
    isSigned: isSignedPV,
    isLocked: isLockedPV,
    isClosed,
    isCancelled,
    isArchivedAG,
  });

  const runAction = useCallback(
    async (key: string, action: () => Promise<unknown>, successMessage: string) => {
      try {
        setBusyAction(key);
        await action();
        showFlash("success", successMessage);
        await fetchDetail();
      } catch (error) {
        console.error(error);
        showFlash(
          "error",
          getBackendErrorMessage(error, "L’action demandée n’a pas pu être exécutée."),
        );
      } finally {
        setBusyAction(null);
      }
    },
    [fetchDetail, showFlash],
  );

  const handleInitPresences = () => {
    if (isReadOnly) {
      showFlash("info", "Assemblée déjà clôturée, archivée ou annulée. Action indisponible.");
      return;
    }

    void runAction(
      "init-presences",
      () => api.post(`/api/ag/ags/${agId}/init-presences/`),
      "Les présences ont été initialisées avec succès.",
    );
  };

  const handleArchivePV = () => {
    if (isReadOnly) {
      showFlash("info", "Assemblée déjà clôturée, archivée ou annulée. Archivage indisponible.");
      return;
    }

    void runAction(
      "archive-pv",
      () =>
        postToFirstWorkingEndpoint([
          `/api/ag/ags/${agId}/pv/archive/`,
          `/api/ag/ags/${agId}/pv/archiver/`,
          `/api/ag/ags/${agId}/pv/generate/`,
          `/api/ag/ags/${agId}/pv/generer/`,
        ]),
      "Le procès-verbal a été archivé avec succès.",
    );
  };

  const handleOpenSignModal = () => {
    if (!detail) return;

    if (isReadOnly) {
      showFlash("info", "Assemblée déjà clôturée, archivée ou annulée. Signature indisponible.");
      return;
    }

    if (!isArchivedPV) {
      showFlash("error", "Vous devez d’abord archiver le PV avant de le signer.");
      return;
    }

    if (isSignedPV) {
      showFlash("info", "Le procès-verbal est déjà signé.");
      return;
    }

    setShowSignModal(true);
  };

  const handleCloseSignModal = () => {
    if (busyAction === "sign-pv") return;

    setShowSignModal(false);
    setSignPassword("");
    setSignPfxFile(null);
  };

  const handlePfxFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file =
      event.target.files && event.target.files.length > 0 ? event.target.files[0] : null;

    setSignPfxFile(file);
  };

  const handleConfirmSignPV = async () => {
    if (busyAction === "sign-pv") return;
    if (!detail) return;

    if (isReadOnly) {
      showFlash("info", "Assemblée déjà clôturée, archivée ou annulée. Signature indisponible.");
      return;
    }

    if (!isArchivedPV) {
      showFlash("error", "Le PV doit être archivé avant signature.");
      return;
    }

    if (!signPfxFile) {
      showFlash("error", "Veuillez sélectionner un fichier .p12 ou .pfx.");
      return;
    }

    if (!signPassword.trim()) {
      showFlash("error", "Veuillez saisir le mot de passe du certificat.");
      return;
    }

    try {
      setBusyAction("sign-pv");

      const formData = new FormData();
      formData.append("pfx", signPfxFile);
      formData.append("password", signPassword.trim());

      await api.post(`/api/ag/ags/${agId}/pv/sign/`, formData, {
        timeout: 60000,
      });

      setShowSignModal(false);
      setSignPassword("");
      setSignPfxFile(null);

      showFlash("success", "Le procès-verbal a été signé avec succès.");
      await fetchDetail();
    } catch (error) {
      console.error(error);
      showFlash("error", getBackendErrorMessage(error, "La signature du procès-verbal a échoué."));
    } finally {
      setBusyAction(null);
    }
  };

  const handleLockPV = () => {
    if (isReadOnly) {
      showFlash("info", "Assemblée déjà clôturée, archivée ou annulée. Verrouillage indisponible.");
      return;
    }

    if (!isSignedPV) {
      showFlash("error", "Le PV doit être signé avant verrouillage.");
      return;
    }

    void runAction(
      "lock-pv",
      () =>
        postToFirstWorkingEndpoint([
          `/api/ag/ags/${agId}/pv/lock/`,
          `/api/ag/ags/${agId}/pv/verrouiller/`,
        ]),
      "Le procès-verbal a été verrouillé avec succès.",
    );
  };

  const handleCloseAG = () => {
    if (isReadOnly) {
      showFlash("info", "Assemblée déjà clôturée, archivée ou annulée.");
      return;
    }

    if (!isLockedPV) {
      showFlash("error", "Vous devez verrouiller le PV avant de clôturer l’assemblée.");
      return;
    }

    void runAction(
      "close-ag",
      () =>
        postToFirstWorkingEndpoint([
          `/api/ag/ags/${agId}/close/`,
          `/api/ag/ags/${agId}/cloturer/`,
        ]),
      "L’assemblée a été clôturée avec succès.",
    );
  };

  if (loadState === "loading") {
    return (
      <PageShell>
        <AlertBox kind="info" title="Chargement">
          Chargement du cockpit AG…
        </AlertBox>
      </PageShell>
    );
  }

  if (loadState === "error" || !detail) {
    return (
      <PageShell>
        <AlertBox kind="error" title="Impossible de charger cette assemblée">
          Nous n’avons pas pu récupérer les informations de détail pour cette assemblée générale.
        </AlertBox>

        <div className="agdetail-actions-line">
          <AppButton onClick={() => void fetchDetail()} variant="primary">
            Réessayer
          </AppButton>

          <AppButton onClick={() => navigate("/ag/assemblees")} variant="secondary">
            Retour à la liste
          </AppButton>
        </div>

        <AGDetailStyles />
      </PageShell>
    );
  }

  return (
    <>
      <PageShell>
        <PageHeader
          title={detail.titre}
          subtitle={`${detail.reference} · Exercice ${detail.exercice} · ${formatDate(
            detail.date_ag,
          )}${detail.lieu ? ` · ${detail.lieu}` : ""}`}
          right={
            <>
              <AppButton onClick={() => navigate("/ag/assemblees")} variant="secondary">
                Consulter les assemblées
              </AppButton>

              <AppButton onClick={() => navigate("/ag/assemblees/nouveau")} variant="secondary">
                Nouvelle assemblée
              </AppButton>
            </>
          }
        />

        <section className="agdetail-hero">
          <div className="agdetail-hero-main">
            <div className="agdetail-hero-pill">ASSEMBLÉES GÉNÉRALES · DÉTAIL</div>

            <h2>Cockpit de pilotage de l’assemblée</h2>

            <p>
              Cette vue centralise l’état de l’assemblée, le quorum, les résolutions,
              les votes et le cycle documentaire du procès-verbal dans une lecture
              unifiée et compacte.
            </p>

            <div className="agdetail-hero-actions">
              <AppButton
                onClick={() => navigate(`/ag/assemblees/${agId}/presences`)}
                variant="primary"
              >
                {isReadOnly ? "Consulter les présences" : "Gérer les présences"}
              </AppButton>

              <AppButton onClick={() => navigate("/ag/resolutions")} variant="secondary">
                Voir les résolutions
              </AppButton>
            </div>

            <div className="agdetail-summary-grid">
              <SummaryCard
                label="Résolutions"
                value={formatNumber(resolvedResolutionsCount)}
                helper="Volume rattaché à cette assemblée."
                tone="neutral"
              />

              <SummaryCard
                label="Présences"
                value={formatNumber(resolvedPresencesCount)}
                helper="Présences enregistrées ou détectées."
                tone="info"
              />

              <SummaryCard
                label="Votes"
                value={formatNumber(resolvedVotesCount)}
                helper="Votes saisis sur l’assemblée."
                tone="warning"
              />

              <SummaryCard
                label="PV"
                value={labelForPV(pvStatus)}
                helper="État documentaire du procès-verbal."
                tone={badgeToneForPV(pvStatus)}
              />
            </div>
          </div>

          <aside className="agdetail-hero-aside">
            <h3>Lecture métier</h3>
            <p>{getStatusNarrative(agStatus)}</p>

            <div className="agdetail-hero-separator" />

            <p>{getPVNarrative(pvStatus)}</p>

            <div className="agdetail-badge-line">
              <Badge text={labelForAG(agStatus)} kind={badgeToneForAG(agStatus)} />
              <Badge text={`PV ${labelForPV(pvStatus)}`} kind={badgeToneForPV(pvStatus)} />
            </div>
          </aside>
        </section>

        {flash ? <AlertBox kind={flash.kind}>{flash.message}</AlertBox> : null}

        <div className="agdetail-main-grid">
          <SectionCard
            title="Synthèse opérationnelle"
            subtitle="Lecture rapide sur la tenue, le quorum et l’état général."
            right={
              <div className="agdetail-badge-line">
                <Badge text={labelForAG(agStatus)} kind={badgeToneForAG(agStatus)} />

                <Badge
                  text={
                    computedQuorum.reached === null
                      ? "Quorum à confirmer"
                      : computedQuorum.reached
                        ? "Quorum atteint"
                        : "Quorum non atteint"
                  }
                  kind={
                    computedQuorum.reached === null
                      ? "neutral"
                      : computedQuorum.reached
                        ? "success"
                        : "warning"
                  }
                />
              </div>
            }
          >
            <div className="agdetail-kpi-grid">
              <SummaryCard
                label="Statut AG"
                value={labelForAG(agStatus)}
                helper="État courant du cycle."
                tone={badgeToneForAG(agStatus)}
              />

              <SummaryCard
                label="Quorum"
                value={
                  computedQuorum.reached === null
                    ? "À confirmer"
                    : computedQuorum.reached
                      ? "Atteint"
                      : "Non atteint"
                }
                helper="Capacité de décision collective."
                tone={
                  computedQuorum.reached === null
                    ? "neutral"
                    : computedQuorum.reached
                      ? "success"
                      : "warning"
                }
              />

              <SummaryCard
                label="Tantièmes présents"
                value={formatNumber(computedQuorum.present)}
                helper={
                  computedQuorum.total
                    ? `sur ${formatNumber(computedQuorum.total)} tantièmes`
                    : "Volume présent enregistré"
                }
                tone="info"
              />

              <SummaryCard
                label="Taux de présence"
                value={
                  computedQuorum.rate === null
                    ? "—"
                    : `${computedQuorum.rate.toFixed(0)} %`
                }
                helper="Part de tantièmes présents."
                tone="neutral"
              />
            </div>

            <div className="agdetail-details-list">
              <DetailRow label="Référence" value={detail.reference} />
              <DetailRow label="Exercice" value={detail.exercice} />
              <DetailRow label="Date" value={formatDate(detail.date_ag)} />
              <DetailRow label="Heure" value={detail.heure_ag || "Non renseignée"} />
              <DetailRow label="Lieu" value={detail.lieu || "Non renseigné"} />
              <DetailRow label="Seuil de quorum" value={formatPercent(computedQuorum.threshold)} />
            </div>
          </SectionCard>

          <SectionCard
            title="Cycle procès-verbal"
            subtitle="Archivage, signature, verrouillage et clôture de l’assemblée."
            right={
              pvPrimaryUrl ? (
                <a
                  href={pvPrimaryUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="agdetail-mini-link"
                >
                  Ouvrir le PV
                </a>
              ) : (
                <Badge text="Aucun document" kind="neutral" />
              )
            }
          >
            <div className="agdetail-pv-head">
              <div>
                <span>État actuel</span>
                <strong>{labelForPV(pvStatus)}</strong>
              </div>

              <Badge text={labelForPV(pvStatus)} kind={badgeToneForPV(pvStatus)} />
            </div>

            <p className="agdetail-paragraph">{getPVNarrative(pvStatus)}</p>

            <div className="agdetail-details-list">
              <DetailRow label="PV généré le" value={formatDateTime(detail.pv_generated_at)} />
              <DetailRow label="PV signé le" value={formatDateTime(detail.pv_signed_at)} />
              <DetailRow
                label="Signataire"
                value={detail.pv_signer_subject || "Non disponible"}
              />
              <DetailRow label="Verrouillage" value={detail.pv_locked ? "Oui" : "Non"} />
            </div>

            {showFinalStateBanner && finalStateMessage ? (
              <AlertBox kind="info" title="Cycle documentaire finalisé">
                {finalStateMessage}
              </AlertBox>
            ) : null}

            {!showFinalStateBanner ? (
              <div className="agdetail-action-stack">
                <SmallButton
                  onClick={handleArchivePV}
                  disabled={archiveDisabled || busyAction === "archive-pv"}
                >
                  {busyAction === "archive-pv" ? "Archivage..." : "Archiver le PV"}
                </SmallButton>

                <SmallButton
                  onClick={handleOpenSignModal}
                  disabled={signDisabled || busyAction === "sign-pv"}
                >
                  {busyAction === "sign-pv" ? "Signature..." : "Signer le PV"}
                </SmallButton>

                <SmallButton
                  onClick={handleLockPV}
                  disabled={lockDisabled || busyAction === "lock-pv"}
                >
                  {busyAction === "lock-pv" ? "Verrouillage..." : "Verrouiller le PV"}
                </SmallButton>

                <SmallButton
                  danger
                  onClick={handleCloseAG}
                  disabled={closeDisabled || busyAction === "close-ag"}
                >
                  {busyAction === "close-ag" ? "Clôture..." : "Clôturer l’assemblée"}
                </SmallButton>
              </div>
            ) : (
              <div className="agdetail-action-stack">
                {pvPrimaryUrl ? (
                  <SmallButton
                    onClick={() =>
                      window.open(pvPrimaryUrl, "_blank", "noopener,noreferrer")
                    }
                  >
                    Consulter le PV
                  </SmallButton>
                ) : null}

                <SmallButton onClick={() => navigate("/ag/resolutions")}>
                  Voir les résolutions
                </SmallButton>

                <SmallButton onClick={() => navigate(`/ag/assemblees/${agId}/votes`)}>
                  Voir les votes
                </SmallButton>
              </div>
            )}

            <AlertBox kind="info">{pvActionHint}</AlertBox>
          </SectionCard>
        </div>

        <div className="agdetail-middle-grid">
          <SectionCard
            title="Accès rapides"
            subtitle={
              isReadOnly
                ? "Entrées de consultation adaptées à une assemblée finalisée."
                : "Entrées opérationnelles pour piloter le cycle AG."
            }
          >
            <div className="agdetail-quick-grid">
              <div className="agdetail-quick-card">
                <strong>
                  {isReadOnly ? "Présences enregistrées" : "Initialiser les présences"}
                </strong>

                <p>
                  {isReadOnly
                    ? "La phase de préparation est terminée. Vous pouvez consulter les présences enregistrées."
                    : "Préparer la présence des lots avant ou pendant l’assemblée."}
                </p>

                <SmallButton
                  primary={!isReadOnly}
                  onClick={
                    isReadOnly
                      ? () => navigate(`/ag/assemblees/${agId}/presences`)
                      : handleInitPresences
                  }
                  disabled={!isReadOnly && busyAction === "init-presences"}
                >
                  {!isReadOnly && busyAction === "init-presences"
                    ? "Initialisation..."
                    : isReadOnly
                      ? "Consulter les présences"
                      : "Initialiser"}
                </SmallButton>
              </div>

              <div className="agdetail-quick-card">
                <strong>{isReadOnly ? "Feuille de présence" : "Gérer les présences"}</strong>

                <p>
                  {isReadOnly
                    ? "Accéder à la feuille de présence en lecture pour contrôle et traçabilité."
                    : "Accéder à la feuille de présence et mettre à jour les participants."}
                </p>

                <SmallButton onClick={() => navigate(`/ag/assemblees/${agId}/presences`)}>
                  {isReadOnly ? "Voir les présences" : "Ouvrir les présences"}
                </SmallButton>
              </div>

              <div className="agdetail-quick-card">
                <strong>Consulter les résolutions</strong>

                <p>Suivre les décisions, la majorité requise et l’état des votes.</p>

                <SmallButton onClick={() => navigate("/ag/resolutions")}>
                  Voir les résolutions
                </SmallButton>
              </div>

              <div className="agdetail-quick-card">
                <strong>{isReadOnly ? "Votes enregistrés" : "Voir les votes"}</strong>

                <p>
                  {isReadOnly
                    ? "Accéder aux votes saisis pour contrôle, lecture et vérification finale."
                    : "Accéder rapidement à l’écran des votes de cette assemblée."}
                </p>

                <SmallButton onClick={() => navigate(`/ag/assemblees/${agId}/votes`)}>
                  {isReadOnly ? "Consulter les votes" : "Ouvrir les votes"}
                </SmallButton>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="Vision produit"
            subtitle="Lecture stratégique de la qualité d’exécution de cette assemblée."
          >
            <div className="agdetail-kpi-grid">
              <SummaryCard
                label="Adoptées"
                value={formatNumber(resolutionStats.adopted)}
                helper="Décisions validées en séance."
                tone="success"
              />

              <SummaryCard
                label="En attente"
                value={formatNumber(resolutionStats.pending)}
                helper="Points restant à arbitrer."
                tone="warning"
              />

              <SummaryCard
                label="Rejetées"
                value={formatNumber(resolutionStats.rejected)}
                helper="Décisions non retenues."
                tone="danger"
              />

              <SummaryCard
                label="Maturité documentaire"
                value={labelForPV(pvStatus)}
                helper="Niveau d’avancement du dossier AG."
                tone={badgeToneForPV(pvStatus)}
              />
            </div>

            <AlertBox kind="info" title="Lecture de pilotage">
              Une assemblée premium se lit ici comme un cycle continu : préparation,
              présence, résolution, vote, procès-verbal, verrouillage et clôture.
            </AlertBox>
          </SectionCard>
        </div>

        <SectionCard
          title="Résolutions récentes"
          subtitle="Aperçu immédiat des dernières résolutions rattachées à cette assemblée."
          right={
            <AppButton onClick={() => navigate("/ag/resolutions")} variant="secondary">
              Voir tout le module Résolutions
            </AppButton>
          }
          flush
        >
          <div className="agdetail-table-wrap">
            {resolutions.length === 0 ? (
              <div className="agdetail-table-empty">
                <EmptyState
                  title="Aucune résolution remontée"
                  text="Aucune résolution n’est encore remontée pour cette assemblée."
                  actionLabel="Voir les résolutions"
                  onAction={() => navigate("/ag/resolutions")}
                />
              </div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Référence</th>
                    <th>Intitulé</th>
                    <th>Majorité</th>
                    <th>Budget voté</th>
                    <th>Statut</th>
                  </tr>
                </thead>

                <tbody>
                  {resolutions.slice(0, 6).map((item) => {
                    const status = normalizeResolutionStatus(item.statut);

                    return (
                      <tr key={item.id}>
                        <td>{item.numero || `#${item.id}`}</td>
                        <td>
                          <strong>{getResolutionTitle(item)}</strong>
                        </td>
                        <td>{item.majorite_requise || "—"}</td>
                        <td>{formatCurrency(item.budget_vote)}</td>
                        <td>
                          <Badge
                            text={labelForResolution(status)}
                            kind={badgeToneForResolution(status)}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </SectionCard>

        <SectionCard
          title="Traçabilité"
          subtitle="Informations utiles pour l’historique, le contrôle et l’audit."
        >
          <div className="agdetail-audit-grid">
            <SummaryCard
              label="Créée le"
              value={formatDateTime(detail.created_at)}
              helper="Horodatage de création."
              tone="neutral"
            />

            <SummaryCard
              label="Dernière mise à jour"
              value={formatDateTime(detail.updated_at)}
              helper="Dernier changement détecté."
              tone="info"
            />

            <SummaryCard
              label="Référence"
              value={detail.reference}
              helper="Référence métier du dossier AG."
              tone="neutral"
            />

            <SummaryCard
              label="État"
              value={labelForAG(agStatus)}
              helper="Statut courant du dossier."
              tone={badgeToneForAG(agStatus)}
            />
          </div>
        </SectionCard>

        <AGDetailStyles />
      </PageShell>

      {showSignModal ? (
        <div
          className="agdetail-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Signer le procès-verbal"
        >
          <div className="agdetail-modal">
            <div className="agdetail-modal-header">
              <span>Signature du procès-verbal</span>
              <h2>Signer le PV avec un certificat PFX</h2>
              <p>
                Importez le certificat <code>.p12</code> ou <code>.pfx</code>,
                puis saisissez son mot de passe pour lancer la signature numérique.
              </p>
            </div>

            <div className="agdetail-modal-body">
              <AlertBox kind="info">
                Après signature, vérifiez l’état du procès-verbal. Si le backend ne
                l’a pas verrouillé automatiquement, utilisez ensuite l’action
                “Verrouiller le PV”, puis clôturez l’assemblée.
              </AlertBox>

              <label className="agdetail-field">
                <span>Fichier certificat (.p12 / .pfx)</span>
                <input
                  type="file"
                  accept=".p12,.pfx,application/x-pkcs12"
                  onChange={handlePfxFileChange}
                  disabled={busyAction === "sign-pv"}
                />
                <small>
                  Fichier sélectionné : {signPfxFile ? signPfxFile.name : "Aucun fichier choisi"}
                </small>
              </label>

              <label className="agdetail-field">
                <span>Mot de passe du certificat</span>
                <input
                  type="password"
                  value={signPassword}
                  onChange={(event) => setSignPassword(event.target.value)}
                  placeholder="Saisir le mot de passe"
                  disabled={busyAction === "sign-pv"}
                />
              </label>
            </div>

            <div className="agdetail-modal-footer">
              <AppButton
                onClick={handleCloseSignModal}
                variant="secondary"
                disabled={busyAction === "sign-pv"}
              >
                Annuler
              </AppButton>

              <AppButton
                onClick={handleConfirmSignPV}
                variant="primary"
                disabled={busyAction === "sign-pv"}
              >
                {busyAction === "sign-pv" ? "Signature en cours..." : "Signer le PV"}
              </AppButton>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

export default AGDetail;

function AGDetailStyles() {
  return (
    <style>{`
      .agdetail-page {
        display: grid;
        gap: 14px;
        width: 100%;
        min-width: 0;
        overflow-x: hidden;
      }

      .agdetail-page-header {
        display: flex;
        align-items: flex-end;
        justify-content: space-between;
        gap: 12px;
        flex-wrap: wrap;
        min-width: 0;
      }

      .agdetail-page-header h1 {
        margin: 0;
        font-size: 26px;
        line-height: 1.05;
        font-weight: 900;
        letter-spacing: -0.8px;
        color: #0f172a;
      }

      .agdetail-page-header p {
        margin: 6px 0 0;
        max-width: 980px;
        font-size: 12px;
        line-height: 1.55;
        color: #64748b;
      }

      .agdetail-eyebrow {
        font-size: 10px;
        font-weight: 900;
        letter-spacing: 0.8px;
        text-transform: uppercase;
        color: #2563eb;
        margin-bottom: 6px;
      }

      .agdetail-header-actions,
      .agdetail-actions-line {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }

      .agdetail-hero {
        border-radius: 20px;
        padding: 14px 16px;
        background: linear-gradient(135deg, #0f172a 0%, #172554 44%, #2563eb 100%);
        box-shadow: 0 12px 28px rgba(37, 99, 235, 0.10);
        display: grid;
        grid-template-columns: minmax(0, 1.15fr) minmax(240px, 0.85fr);
        gap: 12px;
        min-width: 0;
        overflow: hidden;
      }

      .agdetail-hero-main {
        display: grid;
        gap: 10px;
        align-content: start;
        min-width: 0;
      }

      .agdetail-hero-pill {
        display: inline-flex;
        align-items: center;
        width: fit-content;
        max-width: 100%;
        padding: 4px 8px;
        border-radius: 999px;
        border: 1px solid rgba(255,255,255,0.12);
        background: rgba(255,255,255,0.08);
        font-size: 9px;
        font-weight: 800;
        letter-spacing: 0.8px;
        text-transform: uppercase;
        color: rgba(255,255,255,0.84);
      }

      .agdetail-hero h2 {
        margin: 0;
        font-size: 21px;
        line-height: 1.06;
        font-weight: 900;
        letter-spacing: -0.6px;
        color: #ffffff;
      }

      .agdetail-hero p {
        margin: 0;
        max-width: 760px;
        font-size: 11.5px;
        line-height: 1.55;
        color: rgba(255,255,255,0.84);
      }

      .agdetail-hero-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        justify-content: flex-start;
        align-items: center;
        min-width: 0;
      }

      .agdetail-hero-aside {
        min-width: 0;
        border-radius: 14px;
        padding: 12px;
        background: rgba(255,255,255,0.08);
        border: 1px solid rgba(255,255,255,0.12);
        display: grid;
        gap: 10px;
        align-content: start;
      }

      .agdetail-hero-aside h3 {
        margin: 0;
        font-size: 11px;
        font-weight: 900;
        color: #ffffff;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      .agdetail-hero-aside p {
        font-size: 11.5px;
        line-height: 1.55;
        color: rgba(255,255,255,0.82);
      }

      .agdetail-hero-separator {
        width: 100%;
        height: 1px;
        background: rgba(255,255,255,0.12);
      }

      .agdetail-summary-grid,
      .agdetail-kpi-grid,
      .agdetail-audit-grid {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 10px;
        min-width: 0;
      }

      .agdetail-main-grid {
        display: grid;
        grid-template-columns: minmax(0, 1.25fr) minmax(280px, 0.95fr);
        gap: 14px;
      }

      .agdetail-middle-grid {
        display: grid;
        grid-template-columns: minmax(0, 1.05fr) minmax(280px, 0.95fr);
        gap: 14px;
      }

      .agdetail-section {
        border: 1px solid #e2e8f0;
        border-radius: 18px;
        padding: 14px;
        background: #ffffff;
        box-shadow: 0 8px 22px rgba(15, 23, 42, 0.04);
        width: 100%;
        min-width: 0;
        box-sizing: border-box;
      }

      .agdetail-section-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 10px;
        flex-wrap: wrap;
        margin-bottom: 12px;
        min-width: 0;
      }

      .agdetail-section-header h2 {
        margin: 0;
        font-size: 16px;
        line-height: 1.15;
        font-weight: 900;
        color: #0f172a;
      }

      .agdetail-section-header p {
        margin: 4px 0 0;
        font-size: 11.5px;
        line-height: 1.5;
        color: #64748b;
      }

      .agdetail-section-body {
        display: grid;
        gap: 12px;
        width: 100%;
        min-width: 0;
      }

      .agdetail-section-body-flush {
        width: 100%;
        min-width: 0;
      }

      .agdetail-summary-card {
        border: 1px solid #e2e8f0;
        border-radius: 16px;
        background: #f8fafc;
        padding: 12px;
        display: grid;
        gap: 6px;
        min-width: 0;
        box-sizing: border-box;
      }

      .agdetail-summary-label {
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 0.6px;
        font-weight: 900;
        color: #475569;
      }

      .agdetail-summary-value {
        font-size: 18px;
        line-height: 1.05;
        font-weight: 900;
        letter-spacing: -0.4px;
        color: #0f172a;
      }

      .agdetail-summary-helper {
        font-size: 11px;
        line-height: 1.45;
        color: #64748b;
      }

      .agdetail-summary-success {
        background: #f0fdf4;
        border-color: #bbf7d0;
      }

      .agdetail-summary-success .agdetail-summary-value {
        color: #166534;
      }

      .agdetail-summary-info {
        background: #eff6ff;
        border-color: #bfdbfe;
      }

      .agdetail-summary-info .agdetail-summary-value {
        color: #1d4ed8;
      }

      .agdetail-summary-warning {
        background: #fffbeb;
        border-color: #fde68a;
      }

      .agdetail-summary-warning .agdetail-summary-value {
        color: #92400e;
      }

      .agdetail-summary-danger {
        background: #fef2f2;
        border-color: #fecaca;
      }

      .agdetail-summary-danger .agdetail-summary-value {
        color: #991b1b;
      }

      .agdetail-alert {
        padding: 12px;
        border-radius: 14px;
        line-height: 1.5;
        width: 100%;
        min-width: 0;
        box-sizing: border-box;
        display: grid;
        gap: 4px;
        font-size: 12px;
      }

      .agdetail-alert strong {
        font-weight: 900;
        font-size: 12px;
      }

      .agdetail-alert-success {
        background: linear-gradient(180deg, #ecfdf5 0%, #f3fff8 100%);
        border: 1px solid #a7f3d0;
        color: #166534;
      }

      .agdetail-alert-error {
        background: linear-gradient(180deg, #fef2f2 0%, #fff7f7 100%);
        border: 1px solid #fecaca;
        color: #991b1b;
      }

      .agdetail-alert-info {
        background: linear-gradient(180deg, #eff6ff 0%, #f8fbff 100%);
        border: 1px solid #bfdbfe;
        color: #1d4ed8;
      }

      .agdetail-badge-line {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        align-items: center;
      }

      .agdetail-badge {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 4px 8px;
        border-radius: 999px;
        font-size: 10px;
        font-weight: 800;
        border: 1px solid #e2e8f0;
        background: #f8fafc;
        color: #475569;
        white-space: nowrap;
      }

      .agdetail-badge-success {
        background: #ecfdf5;
        border-color: #a7f3d0;
        color: #065f46;
      }

      .agdetail-badge-warning {
        background: #fffbeb;
        border-color: #fde68a;
        color: #92400e;
      }

      .agdetail-badge-danger {
        background: #fef2f2;
        border-color: #fecaca;
        color: #991b1b;
      }

      .agdetail-badge-info {
        background: #eff6ff;
        border-color: #bfdbfe;
        color: #1d4ed8;
      }

      .agdetail-btn,
      .agdetail-small-btn {
        border-radius: 10px;
        font-weight: 800;
        cursor: pointer;
        white-space: nowrap;
        transition: opacity 0.15s ease, transform 0.15s ease;
      }

      .agdetail-btn {
        min-height: 34px;
        padding: 8px 12px;
        font-size: 12px;
      }

      .agdetail-small-btn {
        min-height: 34px;
        padding: 8px 12px;
        font-size: 12px;
      }

      .agdetail-btn:disabled,
      .agdetail-small-btn:disabled {
        cursor: not-allowed;
        opacity: 0.55;
      }

      .agdetail-btn-primary,
      .agdetail-small-btn-primary {
        border: 1px solid #c7d2fe;
        background: #eef2ff;
        color: #3730a3;
        box-shadow: 0 8px 20px rgba(79, 70, 229, 0.10);
      }

      .agdetail-btn-secondary,
      .agdetail-small-btn-secondary {
        border: 1px solid #e2e8f0;
        background: #ffffff;
        color: #0f172a;
      }

      .agdetail-btn-danger,
      .agdetail-small-btn-danger {
        border: 1px solid #fecaca;
        background: #fef2f2;
        color: #991b1b;
      }

      .agdetail-details-list {
        display: grid;
        gap: 8px;
      }

      .agdetail-row {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        padding-bottom: 8px;
        border-bottom: 1px dashed rgba(148,163,184,0.28);
        align-items: center;
        flex-wrap: wrap;
      }

      .agdetail-row span {
        font-size: 11.5px;
        font-weight: 700;
        color: #64748b;
      }

      .agdetail-row strong {
        font-size: 12px;
        font-weight: 800;
        color: #0f172a;
        text-align: right;
      }

      .agdetail-pv-head {
        display: flex;
        justify-content: space-between;
        gap: 10px;
        align-items: center;
        flex-wrap: wrap;
      }

      .agdetail-pv-head span {
        font-size: 11.5px;
        font-weight: 700;
        color: #64748b;
      }

      .agdetail-pv-head strong {
        display: block;
        margin-top: 4px;
        font-size: 20px;
        font-weight: 900;
        color: #0f172a;
      }

      .agdetail-paragraph {
        margin: 0;
        font-size: 12px;
        line-height: 1.6;
        color: #475569;
      }

      .agdetail-action-stack {
        display: grid;
        gap: 8px;
      }

      .agdetail-mini-link {
        padding: 6px 9px;
        border-radius: 9px;
        border: 1px solid #c7d2fe;
        background: #eef2ff;
        font-size: 11px;
        font-weight: 800;
        color: #3730a3;
        text-decoration: none;
        display: inline-flex;
        align-items: center;
      }

      .agdetail-quick-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 10px;
      }

      .agdetail-quick-card {
        display: grid;
        gap: 8px;
        padding: 12px;
        border-radius: 14px;
        background: #f8fafc;
        border: 1px solid rgba(148,163,184,0.14);
      }

      .agdetail-quick-card strong {
        font-size: 13px;
        font-weight: 800;
        color: #0f172a;
      }

      .agdetail-quick-card p {
        margin: 0;
        font-size: 11.5px;
        line-height: 1.5;
        color: #475569;
      }

      .agdetail-table-wrap {
        border: 1px solid #e2e8f0;
        border-radius: 16px;
        overflow-x: auto;
        overflow-y: hidden;
        background: #ffffff;
        box-shadow: 0 10px 26px rgba(15, 23, 42, 0.04);
        width: 100%;
        min-width: 0;
      }

      .agdetail-table-wrap table {
        width: 100%;
        min-width: 820px;
        border-collapse: collapse;
      }

      .agdetail-table-wrap th {
        padding: 10px;
        border-bottom: 1px solid #e2e8f0;
        white-space: nowrap;
        font-size: 10.5px;
        color: #64748b;
        background: #f8fafc;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.3px;
        text-align: left;
      }

      .agdetail-table-wrap td {
        padding: 10px;
        border-bottom: 1px solid #f1f5f9;
        vertical-align: middle;
        color: #0f172a;
        font-size: 12px;
      }

      .agdetail-table-empty {
        padding: 14px;
      }

      .agdetail-empty {
        border: 1px dashed #cbd5e1;
        border-radius: 14px;
        padding: 18px;
        background: linear-gradient(180deg, #f8fafc 0%, #ffffff 100%);
        display: grid;
        gap: 8px;
      }

      .agdetail-empty strong {
        font-size: 14px;
        font-weight: 900;
        color: #0f172a;
      }

      .agdetail-empty p {
        margin: 0;
        font-size: 12px;
        color: #64748b;
        line-height: 1.55;
      }

      .agdetail-modal-overlay {
        position: fixed;
        inset: 0;
        background: rgba(15,23,42,0.55);
        backdrop-filter: blur(3px);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 18px;
        z-index: 9999;
      }

      .agdetail-modal {
        width: 100%;
        max-width: 560px;
        border-radius: 18px;
        background: #ffffff;
        border: 1px solid rgba(148,163,184,0.16);
        box-shadow: 0 24px 70px rgba(15,23,42,0.20);
        display: grid;
        gap: 14px;
        padding: 18px;
      }

      .agdetail-modal-header {
        display: grid;
        gap: 6px;
      }

      .agdetail-modal-header span {
        font-size: 11px;
        font-weight: 800;
        color: #1d4ed8;
        letter-spacing: 0.06em;
        text-transform: uppercase;
      }

      .agdetail-modal-header h2 {
        margin: 0;
        font-size: 22px;
        line-height: 1.1;
        font-weight: 800;
        color: #0f172a;
      }

      .agdetail-modal-header p {
        margin: 0;
        font-size: 12px;
        line-height: 1.6;
        color: #64748b;
      }

      .agdetail-modal-body {
        display: grid;
        gap: 12px;
      }

      .agdetail-field {
        display: grid;
        gap: 6px;
      }

      .agdetail-field span {
        font-size: 12px;
        font-weight: 700;
        color: #334155;
      }

      .agdetail-field small {
        font-size: 11px;
        color: #64748b;
        line-height: 1.45;
      }

      .agdetail-field input {
        width: 100%;
        padding: 10px 12px;
        border-radius: 12px;
        border: 1px solid rgba(148,163,184,0.24);
        background: #ffffff;
        color: #0f172a;
        font-size: 12px;
        outline: none;
        box-sizing: border-box;
      }

      .agdetail-modal-footer {
        display: flex;
        justify-content: flex-end;
        gap: 10px;
        flex-wrap: wrap;
      }

      @media (max-width: 1400px) {
        .agdetail-summary-grid,
        .agdetail-kpi-grid,
        .agdetail-audit-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .agdetail-main-grid,
        .agdetail-middle-grid {
          grid-template-columns: 1fr;
        }
      }

      @media (max-width: 980px) {
        .agdetail-hero {
          grid-template-columns: 1fr;
        }

        .agdetail-quick-grid {
          grid-template-columns: 1fr;
        }
      }

      @media (max-width: 760px) {
        .agdetail-summary-grid,
        .agdetail-kpi-grid,
        .agdetail-audit-grid {
          grid-template-columns: 1fr;
        }

        .agdetail-page-header h1 {
          font-size: 22px;
        }

        .agdetail-hero h2 {
          font-size: 19px;
        }
      }
    `}</style>
  );
}