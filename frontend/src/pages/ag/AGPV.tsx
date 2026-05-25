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
type AGStatus = "BROUILLON" | "CONVOQUEE" | "OUVERTE" | "CLOTUREE" | "ANNULEE";
type PVStatus = "NON_GENERE" | "ARCHIVE" | "SIGNE" | "VERROUILLE";
type BadgeKind = "neutral" | "success" | "warning" | "danger" | "info";
type ButtonVariant = "primary" | "secondary" | "danger";

type AGPVDetail = {
  id: number;
  reference: string;
  titre: string;
  exercice: string;
  date_ag: string;
  heure_ag: string;
  lieu: string;
  statut: AGStatus;
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
  titre: string;
  cloturee?: boolean;
  resultat: "EN_ATTENTE" | "ADOPTEE" | "REJETEE";
};

type DRFPage<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

const RAW_API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim() ||
  "http://127.0.0.1:8002";

const API_BASE_URL = RAW_API_BASE_URL.replace(/\/+$/, "");
const API_ORIGIN = API_BASE_URL.replace(/\/api$/, "");

function AG_DETAIL_ENDPOINT_CANDIDATES(id: string | number) {
  return [`/api/ag/ags/${id}/`, `/api/ag/ags/${id}`];
}

function AG_RESOLUTIONS_ENDPOINT_CANDIDATES(id: string | number) {
  return [
    `/api/ag/resolutions/?ag=${id}`,
    `/api/ag/resolutions?ag=${id}`,
    `/api/ag/resolutions/?assemblee=${id}`,
    `/api/ag/resolutions?assemblee=${id}`,
    `/api/ag/resolutions/?assemblee_generale=${id}`,
    `/api/ag/resolutions?assemblee_generale=${id}`,
    `/api/ag/ags/${id}/resolutions/`,
    `/api/ag/ags/${id}/resolutions`,
  ];
}

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
    const candidates = [value.results, value.items, value.resolutions, value.data];

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
      [
        "true",
        "1",
        "oui",
        "yes",
        "ok",
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
  raw = raw.replace(/^\/api\//, "/");
  raw = raw.replace(/^api\//, "");

  if (raw.startsWith("/media/")) return `${API_ORIGIN}${raw}`;
  if (raw.startsWith("media/")) return `${API_ORIGIN}/${raw}`;
  if (raw.startsWith("/")) return `${API_BASE_URL}${raw}`;

  return `${API_BASE_URL}/${raw}`;
}

function normalizeAGStatus(value: unknown): AGStatus {
  const s = String(value ?? "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();

  if (["CONVOQUEE", "CONVOQUE", "SCHEDULED", "PLANNED"].includes(s)) {
    return "CONVOQUEE";
  }

  if (["OUVERTE", "OPEN", "ACTIVE", "ACTIF", "EN_COURS"].includes(s)) {
    return "OUVERTE";
  }

  if (["CLOTUREE", "CLOTURE", "CLOSED", "TERMINEE", "FINALISEE"].includes(s)) {
    return "CLOTUREE";
  }

  if (["ANNULEE", "ANNULE", "CANCELED", "CANCELLED"].includes(s)) {
    return "ANNULEE";
  }

  return "BROUILLON";
}

function normalizeDecisionValue(value: unknown): ResolutionItem["resultat"] | null {
  const s = String(value ?? "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();

  if (["ADOPTEE", "VALIDEE", "VALIDE", "APPROUVEE", "ADOPTED", "POUR"].includes(s)) {
    return "ADOPTEE";
  }

  if (["REJETEE", "REJETE", "REFUSEE", "REFUSE", "REJECTED", "CONTRE"].includes(s)) {
    return "REJETEE";
  }

  if (["EN_ATTENTE", "PENDING"].includes(s)) {
    return "EN_ATTENTE";
  }

  return null;
}

function normalizePVStatus(value: unknown, row: Record<string, unknown>): PVStatus {
  const explicit = String(value ?? "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();

  if (["NON_GENERE", "NON GENERE"].includes(explicit)) return "NON_GENERE";
  if (["ARCHIVE", "ARCHIVEE"].includes(explicit)) return "ARCHIVE";
  if (["SIGNE"].includes(explicit)) return "SIGNE";
  if (["VERROUILLE", "LOCKED"].includes(explicit)) return "VERROUILLE";

  const pvLocked = toBoolean(row.pv_locked);
  const signedPdfUrl = pickNullableString(row.pv_signed_pdf_url, row.pv_signed_pdf);
  const signedAt = pickNullableString(row.pv_signed_at);
  const pdfUrl = pickNullableString(row.pv_pdf_url, row.pv_pdf);
  const generatedAt = pickNullableString(row.pv_generated_at);

  if (pvLocked) return "VERROUILLE";
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
    return d.toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return raw;
}

function truncateText(value?: string | null, max = 26): string {
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

  if (Array.isArray(data?.detail) && typeof data.detail[0] === "string") {
    return data.detail[0];
  }

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

function normalizeAGDetail(raw: unknown, fallbackId: string): AGPVDetail {
  const row = isRecord(raw) ? raw : {};

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

  const fallbackNumericId = toNumberOrNull(fallbackId) ?? 0;

  return {
    id:
      toNumberOrNull(row.id) ??
      toNumberOrNull(row.ag_id) ??
      toNumberOrNull(row.pk) ??
      fallbackNumericId,
    reference:
      pickString(row.reference, row.ref, row.code) ||
      `AG-${String(fallbackId).padStart(3, "0")}`,
    titre: pickString(row.titre, row.title, row.intitule, row.nom) || "Assemblée générale",
    exercice: exerciceLabel || "—",
    date_ag: pickDate(row.date_ag, row.date, row.date_assemblee, row.date_reunion),
    heure_ag: pickString(row.heure_ag, row.heure, row.time, row.heure_reunion),
    lieu: pickString(row.lieu, row.location, row.endroit) || "—",
    statut: normalizeAGStatus(row.statut ?? row.status ?? row.etat),
    description:
      pickString(row.description, row.notes, row.commentaire, row.resume, row.objet) ||
      "Aucune description détaillée n’est encore disponible pour cette assemblée.",

    pv_locked: toBoolean(row.pv_locked),
    pv_status: normalizePVStatus(row.pv_status, row),
    pv_pdf_url: toAbsoluteBackendUrl(pickNullableString(row.pv_pdf_url, row.pv_pdf)),
    pv_pdf_hash: pickNullableString(row.pv_pdf_hash),
    pv_generated_at: pickNullableString(row.pv_generated_at),
    pv_signed_pdf_url: toAbsoluteBackendUrl(
      pickNullableString(row.pv_signed_pdf_url, row.pv_signed_pdf),
    ),
    pv_signed_hash: pickNullableString(row.pv_signed_hash, row.pv_signed_pdf_hash),
    pv_signed_at: pickNullableString(row.pv_signed_at),
    pv_signer_subject: pickNullableString(row.pv_signer_subject),

    president_nom: pickNullableString(row.president_nom),
    secretaire_nom: pickNullableString(row.secretaire_nom),
    signature_president_url: toAbsoluteBackendUrl(
      pickNullableString(row.signature_president_url),
    ),
    signature_secretaire_url: toAbsoluteBackendUrl(
      pickNullableString(row.signature_secretaire_url),
    ),
    cachet_image_url: toAbsoluteBackendUrl(pickNullableString(row.cachet_image_url)),

    closed_at: pickNullableString(row.closed_at),
    closed_by: toNumberOrNull(row.closed_by),
  };
}

function normalizeResolution(raw: unknown, index: number): ResolutionItem {
  const row = isRecord(raw) ? raw : {};
  const ordre = toNumberOrNull(row.ordre) ?? toNumberOrNull(row.numero_ordre);
  const cloturee = toBooleanOrNull(row.cloturee) ?? false;

  let resultat =
    normalizeDecisionValue(row.decision) ??
    normalizeDecisionValue(row.statut_resolution) ??
    normalizeDecisionValue(isRecord(row.resultat_detail) ? row.resultat_detail.decision : null) ??
    normalizeDecisionValue(row.resultat) ??
    normalizeDecisionValue(row.status) ??
    "EN_ATTENTE";

  if (resultat === "EN_ATTENTE" && cloturee) {
    resultat = "EN_ATTENTE";
  }

  return {
    id: toNumberOrNull(row.id) ?? toNumberOrNull(row.resolution_id) ?? index + 1,
    numero:
      (ordre !== null ? `R${ordre}` : "") ||
      pickString(row.numero, row.reference, row.code, row.libelle_court) ||
      `R${index + 1}`,
    ordre,
    titre:
      pickString(row.titre, row.title, row.intitule, row.nom, row.objet) ||
      "Résolution sans titre",
    cloturee,
    resultat,
  };
}

function getStatusMeta(status: AGStatus): {
  label: string;
  kind: BadgeKind;
  description: string;
} {
  switch (status) {
    case "CONVOQUEE":
      return {
        label: "Convoquée",
        kind: "neutral",
        description: "Assemblée préparée et convoquée, en attente du cycle opérationnel.",
      };
    case "OUVERTE":
      return {
        label: "Ouverte",
        kind: "info",
        description: "Assemblée active avec traitement métier en cours.",
      };
    case "CLOTUREE":
      return {
        label: "Clôturée",
        kind: "success",
        description: "Cycle AG terminé et stabilisé.",
      };
    case "ANNULEE":
      return {
        label: "Annulée",
        kind: "danger",
        description: "Assemblée annulée, actions métier désactivées.",
      };
    default:
      return {
        label: "Brouillon",
        kind: "warning",
        description: "Assemblée en préparation avant ouverture officielle.",
      };
  }
}

function getPVMeta(status: PVStatus): {
  label: string;
  kind: BadgeKind;
  description: string;
} {
  switch (status) {
    case "ARCHIVE":
      return {
        label: "Archivé",
        kind: "info",
        description: "Le PV documentaire existe déjà.",
      };
    case "SIGNE":
      return {
        label: "Signé",
        kind: "success",
        description: "Le PV a été signé numériquement.",
      };
    case "VERROUILLE":
      return {
        label: "Verrouillé",
        kind: "neutral",
        description: "Le PV final est figé.",
      };
    default:
      return {
        label: "Non généré",
        kind: "warning",
        description: "Le PV n’a pas encore été produit.",
      };
  }
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
  children?: ReactNode;
}) {
  return (
    <section style={heroSectionStyle}>
      <div style={heroMainStyle}>
        <div style={heroPillStyle}>ASSEMBLÉES GÉNÉRALES · PROCÈS-VERBAL</div>
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

      {props.children ? <div style={heroAsideStyle}>{props.children}</div> : null}
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
  tone?: "neutral" | "info" | "warning" | "success" | "danger";
}) {
  const tone =
    props.tone === "success"
      ? { bg: "#ecfdf5", border: "#bbf7d0", label: "#166534", value: "#065f46" }
      : props.tone === "warning"
        ? { bg: "#fffbeb", border: "#fde68a", label: "#b45309", value: "#92400e" }
        : props.tone === "info"
          ? { bg: "#eff6ff", border: "#bfdbfe", label: "#2563eb", value: "#1d4ed8" }
          : props.tone === "danger"
            ? { bg: "#fef2f2", border: "#fecaca", label: "#b91c1c", value: "#991b1b" }
            : { bg: "#f8fafc", border: "#e2e8f0", label: "#475569", value: "#0f172a" };

  return (
    <div
      style={{
        border: `1px solid ${tone.border}`,
        borderRadius: 18,
        padding: 16,
        background: tone.bg,
        display: "grid",
        gap: 8,
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
        {props.value}
      </div>
      <div style={{ fontSize: 13, lineHeight: 1.55, color: "#64748b" }}>
        {props.helper}
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

function AlertBox(props: {
  kind: "success" | "info" | "error";
  title?: string;
  children: ReactNode;
}) {
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
        border: "1px dashed #cbd5e1",
        borderRadius: 18,
        padding: 20,
        background: "linear-gradient(180deg, #f8fafc 0%, #ffffff 100%)",
      }}
    >
      <div style={{ fontSize: 15, fontWeight: 900, color: "#0f172a", marginBottom: 8 }}>
        {props.title}
      </div>
      <div style={{ fontSize: 13, color: "#64748b", lineHeight: 1.6 }}>{props.text}</div>

      {props.actionLabel && props.onAction ? (
        <div style={{ marginTop: 14 }}>
          <AppButton onClick={props.onAction} variant="primary">
            {props.actionLabel}
          </AppButton>
        </div>
      ) : null}
    </div>
  );
}

function KeyValueRow(props: { label: string; value: ReactNode }) {
  return (
    <div style={keyValueRowStyle}>
      <div style={keyValueLabelStyle}>{props.label}</div>
      <div style={keyValueValueStyle}>{props.value}</div>
    </div>
  );
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

export default function AGPV() {
  const navigate = useNavigate();
  const params = useParams();
  const agId = params.id ?? "";

  const [state, setState] = useState<LoadState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [ag, setAg] = useState<AGPVDetail | null>(null);
  const [resolutions, setResolutions] = useState<ResolutionItem[]>([]);

  const fetchPVDetail = useCallback(async () => {
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
      const normalizedAG = normalizeAGDetail(detailRes?.data, agId);

      let resolutionRows: ResolutionItem[] = [];

      try {
        const resolutionsRes = await apiGetFirst(AG_RESOLUTIONS_ENDPOINT_CANDIDATES(agId));
        const rawRows = extractRows<Record<string, unknown>>(resolutionsRes?.data);

        resolutionRows = rawRows
          .map(normalizeResolution)
          .filter((item) => item.id > 0)
          .sort((a, b) => {
            const ao = a.ordre ?? a.id;
            const bo = b.ordre ?? b.id;

            if (ao !== bo) return ao - bo;

            return a.id - b.id;
          });
      } catch {
        resolutionRows = [];
      }

      setAg(normalizedAG);
      setResolutions(resolutionRows);
      setState("success");
    } catch (e) {
      setAg(null);
      setResolutions([]);
      setState("error");
      setError(getErrorMessage(e, "Impossible de charger la page du procès-verbal."));
    }
  }, [agId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchPVDetail();
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [fetchPVDetail]);

  const stats = useMemo(() => {
    const adoptees = resolutions.filter((x) => x.resultat === "ADOPTEE").length;
    const rejetees = resolutions.filter((x) => x.resultat === "REJETEE").length;
    const enAttente = resolutions.filter((x) => x.resultat === "EN_ATTENTE").length;

    return {
      total: resolutions.length,
      adoptees,
      rejetees,
      enAttente,
    };
  }, [resolutions]);

  const statusMeta = ag ? getStatusMeta(ag.statut) : null;
  const pvMeta = ag ? getPVMeta(ag.pv_status) : null;

  const canOpenArchived = Boolean(ag?.pv_pdf_url);
  const canOpenSigned = Boolean(ag?.pv_signed_pdf_url);
  const isLoading = state === "loading";

  return (
    <PageShell>
      <PageHeader
        title="Procès-verbal de l’assemblée"
        subtitle="Consultez la situation documentaire de cette assemblée générale, l’état du procès-verbal, la traçabilité du document et les accès utiles vers les PDF archivés ou signés."
        right={
          statusMeta ? (
            <Badge text={statusMeta.label} kind={statusMeta.kind} />
          ) : (
            <Badge text="Chargement" kind="neutral" />
          )
        }
      />

      <HeroSection
        title={ag?.titre || "Vue documentaire du procès-verbal"}
        text={
          ag
            ? `${pvMeta?.description ?? ""} Cette page rassemble les métadonnées du PV final de l’assemblée, son état de signature, son verrouillage et les accès documentaires utiles.`
            : "Cette page rassemble les métadonnées du PV final de l’assemblée, son état de signature, son verrouillage et les accès documentaires utiles."
        }
        primaryLabel="Retour à l’assemblée"
        primaryAction={() => navigate(`/ag/assemblees/${agId}`)}
        secondaryLabel="Voir les résolutions"
        secondaryAction={() => navigate("/ag/resolutions")}
      >
        <div style={heroAsidePanelStyle}>
          <div style={heroAsideTitleStyle}>Fiche documentaire dédiée</div>
          <div style={heroAsideTextStyle}>
            Cette vue sert à lire le statut documentaire réel du procès-verbal de cette assemblée,
            à ouvrir les documents disponibles et à vérifier la cohérence finale avant archivage
            ou consultation.
          </div>

          <div style={heroAsideDividerStyle} />

          <div style={heroBadgeStackStyle}>
            {pvMeta ? <Badge text={`PV ${pvMeta.label}`} kind={pvMeta.kind} /> : null}
            {statusMeta ? <Badge text={statusMeta.label} kind={statusMeta.kind} /> : null}
            {ag?.pv_locked ? (
              <Badge text="PV verrouillé" kind="success" />
            ) : (
              <Badge text="PV non verrouillé" kind="warning" />
            )}
          </div>
        </div>
      </HeroSection>

      {state === "error" && error ? (
        <AlertBox kind="error" title="Impossible de charger la page PV.">
          {error}
        </AlertBox>
      ) : null}

      <div className="ag-pv-kpi-grid">
        <SummaryCard
          label="État documentaire"
          value={isLoading ? "..." : pvMeta?.label || "—"}
          helper="Situation actuelle du procès-verbal de cette assemblée."
          tone="info"
        />
        <SummaryCard
          label="Résolutions"
          value={isLoading ? "..." : stats.total}
          helper="Volume de décisions rattachées à cette assemblée."
          tone="neutral"
        />
        <SummaryCard
          label="Adoptées"
          value={isLoading ? "..." : stats.adoptees}
          helper="Résolutions validées dans le cycle AG."
          tone="success"
        />
        <SummaryCard
          label="En attente"
          value={isLoading ? "..." : stats.enAttente}
          helper="Décisions encore non stabilisées."
          tone="warning"
        />
      </div>

      <div className="ag-pv-main-grid">
        <SectionCard
          title="Informations générales"
          subtitle="Référence, calendrier, lieu, statut et contexte de l’assemblée."
          minHeight={360}
          right={statusMeta ? <Badge text={statusMeta.label} kind={statusMeta.kind} /> : undefined}
        >
          {isLoading ? (
            <div style={{ color: "#64748b", fontSize: 14 }}>
              Chargement des informations générales…
            </div>
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
                label="Statut AG"
                value={statusMeta ? <Badge text={statusMeta.label} kind={statusMeta.kind} /> : "—"}
              />
              <KeyValueRow
                label="Clôturée le"
                value={ag.closed_at ? formatDateTimeShort(ag.closed_at) : "—"}
              />
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="État documentaire du procès-verbal"
          subtitle="Archivage, signature, hash, signataire et verrouillage final."
          minHeight={360}
          right={pvMeta ? <Badge text={pvMeta.label} kind={pvMeta.kind} /> : undefined}
        >
          {isLoading ? (
            <div style={{ color: "#64748b", fontSize: 14 }}>
              Chargement des métadonnées documentaires…
            </div>
          ) : !ag ? (
            <EmptyState
              title="Aucune donnée disponible"
              text="Les informations documentaires du PV n’ont pas pu être chargées."
            />
          ) : (
            <>
              <div>
                <KeyValueRow
                  label="État PV"
                  value={pvMeta ? <Badge text={pvMeta.label} kind={pvMeta.kind} /> : "—"}
                />
                <KeyValueRow
                  label="Verrouillage"
                  value={
                    ag.pv_locked ? (
                      <Badge text="Verrouillé" kind="success" />
                    ) : (
                      <Badge text="Non verrouillé" kind="warning" />
                    )
                  }
                />
                <KeyValueRow
                  label="Hash PDF"
                  value={truncateText(ag.pv_signed_hash || ag.pv_pdf_hash, 28)}
                />
                <KeyValueRow label="Archivé le" value={formatDateTimeShort(ag.pv_generated_at)} />
                <KeyValueRow label="Signé le" value={formatDateTimeShort(ag.pv_signed_at)} />
                <KeyValueRow label="Signataire" value={ag.pv_signer_subject || "—"} />
                <KeyValueRow label="Président" value={ag.president_nom || "—"} />
                <KeyValueRow label="Secrétaire" value={ag.secretaire_nom || "—"} />
              </div>

              <div style={{ marginTop: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
                {ag.pv_signed_pdf_url ? (
                  <a
                    href={ag.pv_signed_pdf_url}
                    target="_blank"
                    rel="noreferrer"
                    style={primaryMiniLinkStyle}
                  >
                    Ouvrir le PDF signé
                  </a>
                ) : null}

                {!ag.pv_signed_pdf_url && ag.pv_pdf_url ? (
                  <a
                    href={ag.pv_pdf_url}
                    target="_blank"
                    rel="noreferrer"
                    style={secondaryMiniLinkStyle}
                  >
                    Ouvrir le PDF archivé
                  </a>
                ) : null}

                {ag.signature_president_url ? (
                  <a
                    href={ag.signature_president_url}
                    target="_blank"
                    rel="noreferrer"
                    style={secondaryMiniLinkStyle}
                  >
                    Signature président
                  </a>
                ) : null}

                {ag.signature_secretaire_url ? (
                  <a
                    href={ag.signature_secretaire_url}
                    target="_blank"
                    rel="noreferrer"
                    style={secondaryMiniLinkStyle}
                  >
                    Signature secrétaire
                  </a>
                ) : null}

                {ag.cachet_image_url ? (
                  <a
                    href={ag.cachet_image_url}
                    target="_blank"
                    rel="noreferrer"
                    style={secondaryMiniLinkStyle}
                  >
                    Cachet
                  </a>
                ) : null}
              </div>

              <div style={{ marginTop: 16 }}>
                <div style={infoBoxStyle}>
                  Cette section correspond au document final de l’assemblée courante. Elle
                  n’est pas une vue globale des PV, mais bien la fiche documentaire du
                  procès-verbal de cette AG.
                </div>
              </div>
            </>
          )}
        </SectionCard>
      </div>

      <SectionCard
        title="Accès rapides"
        subtitle="Navigation utile autour du cycle documentaire de cette assemblée."
        right={<Badge text="Navigation métier" kind="info" />}
      >
        <div className="ag-pv-actions-grid">
          <div style={actionCardStyle}>
            <div style={actionTitleStyle}>Assemblée</div>
            <div style={actionTextStyle}>Revenir à la vue de pilotage générale de cette AG.</div>
            <div>
              <AppButton onClick={() => navigate(`/ag/assemblees/${agId}`)} variant="secondary">
                Voir l’assemblée
              </AppButton>
            </div>
          </div>

          <div style={actionCardStyle}>
            <div style={actionTitleStyle}>Résolutions</div>
            <div style={actionTextStyle}>Consulter les décisions rattachées à cette assemblée.</div>
            <div>
              <AppButton onClick={() => navigate("/ag/resolutions")} variant="secondary">
                Voir les résolutions
              </AppButton>
            </div>
          </div>

          <div style={actionCardStyle}>
            <div style={actionTitleStyle}>Présences</div>
            <div style={actionTextStyle}>Vérifier la base de participation de l’assemblée.</div>
            <div>
              <AppButton onClick={() => navigate(`/ag/assemblees/${agId}/presences`)} variant="secondary">
                Voir les présences
              </AppButton>
            </div>
          </div>

          <div style={actionCardStyle}>
            <div style={actionTitleStyle}>Votes</div>
            <div style={actionTextStyle}>Consulter ou poursuivre le cycle de vote lié à cette AG.</div>
            <div>
              <AppButton onClick={() => navigate(`/ag/assemblees/${agId}/votes`)} variant="secondary">
                Voir les votes
              </AppButton>
            </div>
          </div>
        </div>

        {!canOpenArchived && !canOpenSigned ? (
          <div style={{ marginTop: 16 }}>
            <AlertBox kind="info" title="Aucun document disponible pour l’instant">
              Le procès-verbal n’est pas encore généré ou aucun lien documentaire exploitable
              n’est encore remonté par le backend.
            </AlertBox>
          </div>
        ) : null}
      </SectionCard>

      <SectionCard
        title="Lecture des résolutions"
        subtitle="Vue rapide des décisions qui alimentent le procès-verbal de cette assemblée."
        right={<Badge text={`${stats.total} résolution(s)`} kind="info" />}
      >
        {isLoading ? (
          <div style={{ color: "#64748b", fontSize: 14 }}>Chargement des résolutions…</div>
        ) : resolutions.length === 0 ? (
          <EmptyState
            title="Aucune résolution liée"
            text="Aucune résolution n’a encore été trouvée pour cette assemblée."
            actionLabel="Voir les résolutions"
            onAction={() => navigate("/ag/resolutions")}
          />
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {resolutions.map((item) => (
              <div key={item.id} style={resolutionCardStyle}>
                <div style={resolutionIndexBoxStyle}>
                  <div style={resolutionIndexValueStyle}>{item.numero}</div>
                </div>

                <div style={{ display: "grid", gap: 6, minWidth: 0 }}>
                  <div style={{ fontSize: 15, color: "#0f172a", fontWeight: 900 }}>
                    {item.titre}
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {item.resultat === "ADOPTEE" ? (
                      <Badge text="Adoptée" kind="success" />
                    ) : null}
                    {item.resultat === "REJETEE" ? (
                      <Badge text="Rejetée" kind="danger" />
                    ) : null}
                    {item.resultat === "EN_ATTENTE" ? (
                      <Badge text="En attente" kind="warning" />
                    ) : null}
                    {item.cloturee ? <Badge text="Clôturée" kind="neutral" /> : null}
                  </div>
                </div>

                <div>
                  <Link to="/ag/resolutions" style={secondaryMiniLinkStyle}>
                    Ouvrir
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <AlertBox kind="info" title="Décision produit retenue">
        Cette page est désormais la <strong>fiche documentaire d’une seule assemblée</strong>.
        La vue transverse globale des PV pourra être ajoutée plus tard dans une route distincte
        si le besoin produit est confirmé.
      </AlertBox>

      <style>{`
        .ag-pv-kpi-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 14px;
        }

        .ag-pv-main-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }

        .ag-pv-actions-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
        }

        @media (max-width: 1400px) {
          .ag-pv-kpi-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .ag-pv-actions-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 1180px) {
          .ag-pv-main-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 980px) {
          .ag-pv-kpi-grid,
          .ag-pv-actions-grid {
            grid-template-columns: 1fr !important;
          }
        }

        @media (max-width: 920px) {
          .ag-pv-main-grid {
            gap: 14px;
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
  gridTemplateColumns: "minmax(0, 1.16fr) minmax(320px, 0.84fr)",
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

const heroAsideDividerStyle: CSSProperties = {
  width: "100%",
  height: 1,
  background: "rgba(255,255,255,0.12)",
};

const heroBadgeStackStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
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

const infoBoxStyle: CSSProperties = {
  padding: 14,
  borderRadius: 16,
  background: "#eff6ff",
  border: "1px solid #bfdbfe",
  color: "#1d4ed8",
  fontSize: 13,
  lineHeight: 1.65,
};

const keyValueRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "180px minmax(0, 1fr)",
  gap: 12,
  padding: "12px 0",
  borderBottom: "1px solid #eef2f7",
};

const keyValueLabelStyle: CSSProperties = {
  fontSize: 13,
  fontWeight: 800,
  color: "#475569",
};

const keyValueValueStyle: CSSProperties = {
  fontSize: 13,
  color: "#0f172a",
  lineHeight: 1.6,
  wordBreak: "break-word",
};

const actionCardStyle: CSSProperties = {
  border: "1px solid #e2e8f0",
  borderRadius: 18,
  background: "#f8fafc",
  padding: 16,
  display: "grid",
  gap: 12,
  minWidth: 0,
};

const actionTitleStyle: CSSProperties = {
  fontSize: 15,
  fontWeight: 900,
  color: "#0f172a",
};

const actionTextStyle: CSSProperties = {
  fontSize: 13,
  color: "#64748b",
  lineHeight: 1.6,
};

const resolutionCardStyle: CSSProperties = {
  border: "1px solid #e2e8f0",
  borderRadius: 18,
  background: "#ffffff",
  padding: 16,
  display: "grid",
  gridTemplateColumns: "78px minmax(0, 1fr) auto",
  gap: 14,
  alignItems: "flex-start",
  minWidth: 0,
};

const resolutionIndexBoxStyle: CSSProperties = {
  width: 78,
  minHeight: 72,
  borderRadius: 16,
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
  display: "grid",
  placeItems: "center",
};

const resolutionIndexValueStyle: CSSProperties = {
  fontSize: 18,
  fontWeight: 900,
  color: "#0f172a",
};

const primaryMiniLinkStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 38,
  borderRadius: 12,
  padding: "8px 12px",
  border: "1px solid #c7d2fe",
  background: "#eef2ff",
  color: "#3730a3",
  textDecoration: "none",
  fontSize: 13,
  fontWeight: 800,
};

const secondaryMiniLinkStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 38,
  borderRadius: 12,
  padding: "8px 12px",
  border: "1px solid #e2e8f0",
  background: "#ffffff",
  color: "#0f172a",
  textDecoration: "none",
  fontSize: 13,
  fontWeight: 800,
};