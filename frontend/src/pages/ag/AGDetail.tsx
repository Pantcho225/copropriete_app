import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../../api/axios";

type LoadState = "idle" | "loading" | "success" | "error";
type AGStatus = "BROUILLON" | "CONVOQUEE" | "OUVERTE" | "CLOTUREE" | "ANNULEE";
type ResolutionStatus = "ADOPTEE" | "REJETEE" | "EN_ATTENTE";
type PVStatus = "NON_GENERE" | "ARCHIVE" | "SIGNE" | "VERROUILLE";
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

  has_zero_tantieme_lots?: boolean;
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
  has_zero_tantieme_lots?: boolean;
};

type ActionResponseLike = {
  detail?: string;
  blocking_reasons?: string[];
  [key: string]: unknown;
};

const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim() || "http://127.0.0.1:8002";

const AG_DETAIL_ENDPOINT_CANDIDATES = (id: string | number) => [`/api/ag/ags/${id}/`, `/api/ag/ags/${id}`];

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

    if (
      [
        "true",
        "1",
        "oui",
        "yes",
        "ok",
        "atteint",
        "genere",
        "généré",
        "disponible",
        "locked",
        "verrouille",
        "verrouillé",
        "cloturee",
        "clôturée",
      ].includes(s)
    ) {
      return true;
    }

    if (
      [
        "false",
        "0",
        "non",
        "no",
        "non_genere",
        "non généré",
        "non genere",
        "indisponible",
        "draft",
        "ouvert",
      ].includes(s)
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

  if (["CONVOQUEE", "CONVOQUÉE"].includes(s)) return "CONVOQUEE";
  if (["OUVERTE", "OPEN", "ACTIVE", "ACTIF", "EN_COURS"].includes(s)) return "OUVERTE";
  if (["CLOTUREE", "CLÔTURÉE", "CLOTURE", "CLOSED", "TERMINEE", "TERMINÉE"].includes(s)) return "CLOTUREE";
  if (["ANNULEE", "ANNULÉE", "CANCELED", "CANCELLED"].includes(s)) return "ANNULEE";
  return "BROUILLON";
}

function normalizeDecisionValue(value: unknown): ResolutionStatus | null {
  const s = String(value ?? "").trim().toUpperCase();

  if (
    [
      "ADOPTEE",
      "ADOPTÉE",
      "VALIDEE",
      "VALIDÉE",
      "VALIDE",
      "APPROUVEE",
      "APPROUVÉE",
      "ADOPTED",
      "POUR",
    ].includes(s)
  ) {
    return "ADOPTEE";
  }

  if (
    [
      "REJETEE",
      "REJETÉE",
      "REJETE",
      "REFUSEE",
      "REFUSÉE",
      "REFUSE",
      "REJECTED",
      "CONTRE",
    ].includes(s)
  ) {
    return "REJETEE";
  }

  if (["EN_ATTENTE", "PENDING"].includes(s)) {
    return "EN_ATTENTE";
  }

  return null;
}

function normalizeResolutionStatusFromRow(row: Record<string, unknown>, cloturee?: boolean | null): ResolutionStatus {
  const resultatDetail = isRecord(row.resultat_detail) ? row.resultat_detail : null;

  const candidates = [
    row.decision,
    row.statut_resolution,
    resultatDetail?.decision,
    row.resultat,
    row.result,
    row.status_result,
    row.vote_result,
    row.outcome,
    row.statut,
    row.status,
  ];

  for (const candidate of candidates) {
    const normalized = normalizeDecisionValue(candidate);
    if (normalized) return normalized;
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

  return cloturee ? "EN_ATTENTE" : "EN_ATTENTE";
}

function normalizePVStatus(value: unknown, row: Record<string, unknown>): PVStatus {
  const explicit = String(value ?? "").trim().toUpperCase();

  if (["NON_GENERE", "NON GÉNÉRÉ", "NON GENERE"].includes(explicit)) return "NON_GENERE";
  if (["ARCHIVE", "ARCHIVÉ", "ARCHIVEE", "ARCHIVÉE"].includes(explicit)) return "ARCHIVE";
  if (["SIGNE", "SIGNÉ"].includes(explicit)) return "SIGNE";
  if (["VERROUILLE", "VERROUILLÉ", "LOCKED"].includes(explicit)) return "VERROUILLE";

  const pvLocked = toBoolean(row.pv_locked);
  const signedPdfUrl = pickNullableString(row.pv_signed_pdf_url);
  const signedAt = pickNullableString(row.pv_signed_at);
  const pdfUrl = pickNullableString(row.pv_pdf_url);
  const generatedAt = pickNullableString(row.pv_generated_at);

  if (pvLocked && (signedPdfUrl || signedAt)) return "VERROUILLE";
  if (signedPdfUrl || signedAt) return "SIGNE";
  if (pdfUrl || generatedAt) return "ARCHIVE";
  return "NON_GENERE";
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

function extractBlockingReasons(data: unknown): string[] {
  if (!isRecord(data)) return [];

  const value = data.blocking_reasons;
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  }
  return [];
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

  if (reasons.length > 0) {
    return reasons.join(" ");
  }

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
    quorum_atteint:
      toBooleanOrNull(row.quorum_atteint) ?? toBooleanOrNull(row.quorum) ?? toBooleanOrNull(row.quorum_ok),
    description:
      pickString(row.description, row.notes, row.commentaire, row.resume, row.objet) ||
      "Aucune description détaillée n’est encore disponible pour cette assemblée.",

    pv_locked: toBoolean(row.pv_locked),
    pv_status: normalizePVStatus(row.pv_status, row),
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

    has_zero_tantieme_lots: toBoolean(row.has_zero_tantieme_lots),
  };
}

function normalizeResolution(raw: unknown, index: number): ResolutionItem {
  const row = isRecord(raw) ? raw : {};

  const id = toNumberOrNull(row.id) ?? toNumberOrNull(row.resolution_id) ?? toNumberOrNull(row.pk) ?? index + 1;
  const ordre = toNumberOrNull(row.ordre) ?? toNumberOrNull(row.numero_ordre);
  const cloturee = toBooleanOrNull(row.cloturee) ?? false;

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
    tantieme_categorie: pickNullableString(row.tantieme_categorie, row.tantieme_categorie_effective),
    cloturee,
    budget_vote: toNumberOrNull(row.budget_vote),
    travaux_dossier_titre: pickNullableString(row.travaux_dossier_titre),
    resultat: normalizeResolutionStatusFromRow(row, cloturee),
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

function getStatusMeta(status: AGStatus): { label: string; kind: BadgeKind } {
  switch (status) {
    case "CONVOQUEE":
      return { label: "Convoquée", kind: "neutral" };
    case "OUVERTE":
      return { label: "Ouverte", kind: "info" };
    case "CLOTUREE":
      return { label: "Clôturée", kind: "success" };
    case "ANNULEE":
      return { label: "Annulée", kind: "danger" };
    default:
      return { label: "Brouillon", kind: "warning" };
  }
}

function getQuorumMeta(value?: boolean | null): { label: string; kind: BadgeKind } {
  if (value === true) return { label: "Atteint", kind: "success" };
  if (value === false) return { label: "Non atteint", kind: "danger" };
  return { label: "À vérifier", kind: "warning" };
}

function getPVMeta(status: PVStatus): { label: string; kind: BadgeKind } {
  switch (status) {
    case "ARCHIVE":
      return { label: "Archivé", kind: "info" };
    case "SIGNE":
      return { label: "Signé", kind: "success" };
    case "VERROUILLE":
      return { label: "Verrouillé", kind: "neutral" };
    default:
      return { label: "Non généré", kind: "warning" };
  }
}

function formatMoneyLikeNumber(value?: number | null) {
  if (value === null || value === undefined) return "0";
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(value);
}

type BadgeKind = "neutral" | "success" | "warning" | "danger" | "info";
type ButtonVariant = "primary" | "secondary" | "danger";

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
        }
      : variant === "danger"
        ? {
            border: "1px solid #fecaca",
            background: "#fef2f2",
            color: "#991b1b",
          }
        : {
            border: "1px solid #e5e7eb",
            background: "#fff",
            color: "#111827",
          };

  return (
    <button
      type="button"
      onClick={props.onClick}
      disabled={props.disabled}
      style={{
        border: styles.border,
        background: props.disabled ? "#f9fafb" : styles.background,
        color: props.disabled ? "#9ca3af" : styles.color,
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
        lineHeight: 1.5,
      }}
    >
      {props.title ? <div style={{ fontWeight: 900, marginBottom: 4 }}>{props.title}</div> : null}
      <div style={{ fontSize: 13 }}>{props.children}</div>
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
          <AppButton onClick={props.onAction} variant="primary">
            {props.actionLabel}
          </AppButton>
        </div>
      ) : null}
    </div>
  );
}

function getResolutionBadge(item: ResolutionItem) {
  if (item.resultat === "ADOPTEE") return <Badge text="Adoptée" kind="success" />;
  if (item.resultat === "REJETEE") return <Badge text="Rejetée" kind="danger" />;
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
  const [blockingReasons, setBlockingReasons] = useState<string[]>([]);

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
          .sort((a, b) => {
            const ao = a.ordre ?? a.id;
            const bo = b.ordre ?? b.id;
            if (ao !== bo) return ao - bo;
            return a.id - b.id;
          });
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
    callback: () => Promise<ActionResponseLike | void>,
    successMessage?: string,
  ) {
    setBusyAction(actionKey);
    setActionMessage(null);
    setBlockingReasons([]);

    try {
      const result = await callback();
      const reasons = extractBlockingReasons(result);

      if (reasons.length > 0) {
        setBlockingReasons(reasons);
      }

      if (successMessage) {
        const detail =
          isRecord(result) && typeof result.detail === "string" && result.detail.trim()
            ? result.detail
            : successMessage;

        setActionMessage({ kind: "success", text: detail });
      }

      await fetchAGDetail();
    } catch (e) {
      const err = e as { response?: { data?: unknown } };
      const reasons = extractBlockingReasons(err?.response?.data);

      if (reasons.length > 0) {
        setBlockingReasons(reasons);
      }

      setActionMessage({
        kind: "error",
        text: getErrorMessage(e, "Impossible d’effectuer cette action."),
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
          has_zero_tantieme_lots: Boolean(data.has_zero_tantieme_lots),
        });
        return res?.data;
      },
      "Calcul du quorum mis à jour avec succès.",
    );
  }

  async function handleInitPresences() {
    await runAction(
      "init-presences",
      async () => {
        const res = await apiPostFirst(endpointActionCandidates(agId, "init-presences"), {});
        return res?.data;
      },
      "Présences initialisées avec succès.",
    );
  }

  async function handleArchivePv() {
    await runAction(
      "pv-archive",
      async () => {
        const res = await apiPostFirst(endpointActionCandidates(agId, "pv/archive"), {});
        return res?.data;
      },
      "PV archivé avec succès.",
    );
  }

  async function handleLockPv() {
    await runAction(
      "pv-lock",
      async () => {
        const res = await apiPostFirst(endpointActionCandidates(agId, "pv/lock"), {});
        return res?.data;
      },
      "PV verrouillé avec succès.",
    );
  }

  async function handleCloseAg() {
    const ok = window.confirm("Voulez-vous vraiment clôturer cette assemblée générale ?");
    if (!ok) return;

    await runAction(
      "close-ag",
      async () => {
        const res = await apiPostFirst(endpointActionCandidates(agId, "close"), {});
        return res?.data;
      },
      "AG clôturée avec succès.",
    );
  }

  async function handleClosePendingResolutions() {
    const pending = resolutions.filter((x) => !x.cloturee);
    if (pending.length === 0) {
      setActionMessage({ kind: "info", text: "Toutes les résolutions sont déjà clôturées." });
      return;
    }

    const ok = window.confirm(`Voulez-vous vraiment clôturer ${pending.length} résolution(s) en attente ?`);
    if (!ok) return;

    await runAction(
      "close-resolutions",
      async () => {
        for (const item of pending) {
          const payload =
            item.budget_vote !== null && item.budget_vote !== undefined ? { budget_vote: item.budget_vote } : {};
          await api.post(`/api/ag/resolutions/${item.id}/cloturer/`, payload);
        }
        return { detail: "Résolutions clôturées avec succès." };
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

        const res = await apiPostFirst(endpointActionCandidates(agId, "pv/sign"), formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        return res?.data;
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
    const enAttente = resolutions.filter((x) => x.resultat === "EN_ATTENTE").length;

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
  const isOpen = ag?.statut === "OUVERTE";
  const isClosed = ag?.statut === "CLOTUREE";
  const isCancelled = ag?.statut === "ANNULEE";

  const canEdit = Boolean(agId) && isOpen && !ag?.pv_locked;
  const canArchive = isOpen && !ag?.pv_locked;
  const canSign = isOpen && !ag?.pv_locked && ag?.pv_status === "ARCHIVE" && Boolean(ag?.pv_pdf_url);
  const canLock = isOpen && !ag?.pv_locked && Boolean(ag?.pv_signed_pdf_url);
  const canCloseResolutions = pendingResolutions.length > 0 && isOpen && !ag?.pv_locked;
  const canClose = isOpen && Boolean(ag?.pv_locked);
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
        subtitle="Consultez le statut, le quorum, les résolutions et le suivi documentaire du procès-verbal depuis une vue unique."
        right={
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <AppButton onClick={() => navigate("/ag/assemblees")} variant="secondary">
              Retour à la liste
            </AppButton>
            <AppButton onClick={() => navigate(`/ag/assemblees/${agId}/modifier`)} disabled={!canEdit} variant="secondary">
              Modifier
            </AppButton>
            <AppButton onClick={() => navigate(`/ag/assemblees/${agId}/presences`)} variant="secondary">
              Voir les présences
            </AppButton>
            <AppButton onClick={() => navigate(`/ag/assemblees/${agId}/votes`)} variant="secondary">
              Voir les votes
            </AppButton>
            <AppButton onClick={() => navigate(`/ag/assemblees/${agId}/pv`)} disabled={!agId} variant="secondary">
              Voir le PV
            </AppButton>
            <AppButton onClick={() => navigate(`/ag/assemblees/${agId}/resolutions`)} variant="primary">
              Voir les résolutions
            </AppButton>
          </div>
        }
      />

      {state === "error" && error ? (
        <AlertBox kind="error" title="Impossible de charger le détail de l’assemblée.">
          {error}
        </AlertBox>
      ) : null}

      {actionMessage ? <AlertBox kind={actionMessage.kind}>{actionMessage.text}</AlertBox> : null}

      {blockingReasons.length > 0 ? (
        <AlertBox kind="error" title="Blocages métier détectés">
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.6 }}>
            {blockingReasons.map((reason, index) => (
              <li key={`${reason}-${index}`}>{reason}</li>
            ))}
          </ul>
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
          title="Rejetées"
          value={stats.rejetees}
          sub="Résolutions clôturées mais non adoptées."
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

      <Card title="Pilotage de l’assemblée" right={statusMeta ? <Badge text={statusMeta.label} kind={statusMeta.kind} /> : undefined}>
        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <AppButton onClick={() => void handleFetchQuorum()} disabled={busyAction !== null} variant="secondary">
              {busyAction === "quorum" ? "Calcul..." : "Voir le quorum"}
            </AppButton>

            <AppButton
              onClick={() => void handleInitPresences()}
              disabled={busyAction !== null || !isOpen || !!ag?.pv_locked}
              variant="secondary"
            >
              {busyAction === "init-presences" ? "Initialisation..." : "Initialiser les présences"}
            </AppButton>

            <AppButton onClick={() => navigate(`/ag/assemblees/${agId}/presences`)} disabled={!agId} variant="secondary">
              Gérer les présences
            </AppButton>

            <AppButton onClick={() => navigate(`/ag/assemblees/${agId}/votes`)} disabled={!agId} variant="secondary">
              Gérer les votes
            </AppButton>

            <AppButton onClick={() => navigate(`/ag/assemblees/${agId}/pv`)} disabled={!agId} variant="secondary">
              Ouvrir la page PV
            </AppButton>

            <AppButton
              onClick={() => void handleArchivePv()}
              disabled={busyAction !== null || !canArchive}
              variant="secondary"
            >
              {busyAction === "pv-archive" ? "Archivage..." : "Archiver le PV"}
            </AppButton>

            <AppButton onClick={handleSelectPfx} disabled={busyAction !== null || !canSign} variant="primary">
              {busyAction === "pv-sign" ? "Signature..." : "Signer le PV"}
            </AppButton>

            <AppButton
              onClick={() => void handleLockPv()}
              disabled={busyAction !== null || !canLock}
              variant="secondary"
            >
              {busyAction === "pv-lock" ? "Verrouillage..." : "Verrouiller le PV"}
            </AppButton>

            <AppButton
              onClick={() => void handleClosePendingResolutions()}
              disabled={busyAction !== null || !canCloseResolutions}
              variant="secondary"
            >
              {busyAction === "close-resolutions" ? "Clôture..." : "Clôturer les résolutions"}
            </AppButton>

            <AppButton onClick={() => void handleCloseAg()} disabled={busyAction !== null || !canClose} variant="danger">
              {busyAction === "close-ag" ? "Clôture..." : "Clôturer l’AG"}
            </AppButton>

            <AppButton onClick={handleOpenSignedBackend} disabled={!hasSignedPdf} variant="secondary">
              Ouvrir le PV signé
            </AppButton>
          </div>

          {quorumData ? (
            <div style={{ display: "grid", gap: 10 }}>
              <div style={infoBox}>
                <strong>Lecture du quorum :</strong> {formatMoneyLikeNumber(quorumData.tantiemes_presents)} /{" "}
                {formatMoneyLikeNumber(quorumData.total_tantiemes_copro)} tantièmes présents — seuil{" "}
                {Math.round((quorumData.seuil || 0) * 100)}% —{" "}
                {quorumData.quorum_atteint ? "quorum atteint" : "quorum non atteint"}.
              </div>

              {quorumData.has_zero_tantieme_lots ? (
                <div style={warningBox}>
                  Certains lots ont 0 tantième. Ils restent visibles dans l’assemblée mais ne pèsent pas dans le calcul pondéré.
                </div>
              ) : null}
            </div>
          ) : null}

          {!isOpen ? (
            <div style={infoBox}>
              {isClosed
                ? "Cette assemblée est clôturée. Les modifications métier ordinaires sont désormais bloquées."
                : isCancelled
                  ? "Cette assemblée est annulée. Les actions métier sont désactivées."
                  : "Cette assemblée n’est pas encore ouverte. Les actions de saisie doivent attendre son ouverture."}
            </div>
          ) : null}
        </div>
      </Card>

      <div className="ag-detail-main-grid">
        <Card
          title="Informations générales"
          right={statusMeta ? <Badge text={statusMeta.label} kind={statusMeta.kind} /> : undefined}
          minHeight={320}
        >
          {isLoading ? (
            <div style={{ color: "#6b7280", fontSize: 14 }}>Chargement des informations générales...</div>
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
                    <Badge text="Verrouillé" kind="success" />
                  ) : (
                    <Badge text="Non verrouillé" kind="warning" />
                  )
                }
              />
              <KeyValueRow
                label="Lots à 0 tantième"
                value={
                  ag.has_zero_tantieme_lots ? (
                    <Badge text="Présents" kind="warning" />
                  ) : (
                    <Badge text="Aucun" kind="success" />
                  )
                }
              />
              {ag.closed_at ? <KeyValueRow label="Clôturée le" value={formatDateTimeShort(ag.closed_at)} /> : null}
            </div>
          )}
        </Card>

        <Card title="Suivi documentaire du PV" minHeight={320} right={<Badge text="Traçabilité" kind="info" />}>
          {isLoading ? (
            <div style={{ color: "#6b7280", fontSize: 14 }}>Chargement des informations documentaires...</div>
          ) : !ag ? (
            <div style={{ fontSize: 14, color: "#6b7280", lineHeight: 1.7 }}>
              Aucune information documentaire n’est disponible pour cette assemblée.
            </div>
          ) : (
            <>
              <div style={{ display: "grid", gap: 10 }}>
                <KeyValueRow label="État PV" value={pvMeta ? <Badge text={pvMeta.label} kind={pvMeta.kind} /> : "—"} />
                <KeyValueRow label="Hash PDF" value={truncateText(ag.pv_signed_hash || ag.pv_pdf_hash, 26)} />
                <KeyValueRow label="Archivé le" value={formatDateTimeShort(ag.pv_generated_at)} />
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
                    Ouvrir le PDF archivé
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
                  Cette section présente l’état documentaire réel du procès-verbal : archivage, signature, verrouillage et traçabilité disponible.
                </div>
              </div>
            </>
          )}
        </Card>
      </div>

      <Card title="Résolutions liées à cette assemblée" right={<Badge text="Lecture métier" kind="info" />} minHeight={120}>
        {isLoading ? (
          <div style={{ color: "#6b7280", fontSize: 14 }}>Chargement des résolutions...</div>
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
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 14px;
        }

        .ag-detail-main-grid {
          display: grid;
          grid-template-columns: 1.05fr 0.95fr;
          gap: 14px;
        }

        @media (max-width: 1400px) {
          .ag-detail-stat-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
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
  padding: 14,
  borderRadius: 14,
  background: "#fffbeb",
  border: "1px solid #fde68a",
  color: "#92400e",
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