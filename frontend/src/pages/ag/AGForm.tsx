import { useEffect, useMemo, useState, type CSSProperties, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import api from "../../api/axios";
import { useAuthStore } from "../../store/authStore";

type LoadState = "idle" | "loading" | "success" | "error";
type AGStatus = "BROUILLON" | "CONVOQUEE" | "OUVERTE" | "CLOTUREE" | "ANNULEE";

type ExerciceOption = {
  id: number;
  label: string;
};

type FormValues = {
  titre: string;
  exercice: number | null;
  date_ag: string;
  heure_ag: string;
  lieu: string;
  statut: AGStatus;
};

type DRFPage<T> = {
  count?: number;
  next?: string | null;
  previous?: string | null;
  results: T[];
};

const INITIAL_VALUES: FormValues = {
  titre: "",
  exercice: null,
  date_ag: "",
  heure_ag: "",
  lieu: "",
  statut: "BROUILLON",
};

const STATUT_OPTIONS: Array<{ value: AGStatus; label: string }> = [
  { value: "BROUILLON", label: "Brouillon" },
  { value: "CONVOQUEE", label: "Convoquée" },
  { value: "OUVERTE", label: "Ouverte" },
  { value: "CLOTUREE", label: "Clôturée" },
  { value: "ANNULEE", label: "Annulée" },
];

const AG_COLLECTION_ENDPOINT = "/api/ag/ags/";
const AG_DETAIL_ENDPOINT = (id: string | number) => `/api/ag/ags/${id}/`;

const EXERCICE_ENDPOINT_CANDIDATES = [
  "/api/billing/exercices/",
  "/api/billing/exercices",
  "/api/billing/exercises/",
  "/api/billing/exercises",
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function isPaginatedResponse<T = unknown>(value: unknown): value is DRFPage<T> {
  return isRecord(value) && Array.isArray(value.results);
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

function normalizeAGStatus(value: unknown): AGStatus {
  const s = String(value ?? "").trim().toUpperCase();

  if (["CONVOQUEE", "CONVOQUÉE"].includes(s)) return "CONVOQUEE";
  if (["OUVERTE", "OPEN", "ACTIVE", "ACTIF", "EN_COURS"].includes(s)) return "OUVERTE";
  if (["CLOTUREE", "CLOTURE", "CLOSED", "TERMINEE", "TERMINÉE"].includes(s)) return "CLOTUREE";
  if (["ANNULEE", "ANNULÉE", "CANCELED", "CANCELLED"].includes(s)) return "ANNULEE";
  return "BROUILLON";
}

function formatDateForInput(value?: string): string {
  if (!value) return "";
  const raw = value.trim();
  if (!raw) return "";

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;

  const isoDate = raw.match(/^(\d{4}-\d{2}-\d{2})T/);
  if (isoDate) return isoDate[1];

  const d = new Date(raw);
  if (!Number.isNaN(d.getTime())) {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  return "";
}

function formatTimeForInput(value?: string): string {
  if (!value) return "";
  const raw = value.trim();
  if (!raw) return "";

  const hhmm = raw.match(/^(\d{2}):(\d{2})(?::\d{2})?$/);
  if (hhmm) return `${hhmm[1]}:${hhmm[2]}`;

  const d = new Date(raw);
  if (!Number.isNaN(d.getTime())) {
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${hh}:${mm}`;
  }

  return "";
}

function getErrorMessage(error: unknown, fallback: string) {
  const err = error as {
    response?: {
      data?: {
        detail?: string;
        message?: string;
        [key: string]: unknown;
      };
      status?: number;
    };
    message?: string;
  };

  const data = err?.response?.data;

  if (typeof data?.detail === "string" && data.detail.trim()) return data.detail;
  if (typeof data?.message === "string" && data.message.trim()) return data.message;

  if (isRecord(data)) {
    const lines: string[] = [];

    for (const [key, value] of Object.entries(data)) {
      if (key === "detail" || key === "message") continue;

      if (Array.isArray(value)) {
        const items = value.map((v) => String(v)).filter(Boolean);
        if (items.length) lines.push(`${key}: ${items.join(", ")}`);
      } else if (typeof value === "string" && value.trim()) {
        lines.push(`${key}: ${value}`);
      }
    }

    if (lines.length) return lines.join("\n");
  }

  return err?.message || fallback;
}

function normalizeExerciceOption(raw: unknown, index: number): ExerciceOption {
  const row = isRecord(raw) ? raw : {};
  const id = toNumberOrNull(row.id) ?? toNumberOrNull(row.pk) ?? index + 1;

  const label =
    pickString(
      row.libelle,
      row.nom,
      row.label,
      row.reference,
      row.titre,
      row.code,
    ) || `Exercice #${id}`;

  return { id, label };
}

function normalizeFormValues(raw: unknown): FormValues {
  const row = isRecord(raw) ? raw : {};

  let exerciceId =
    toNumberOrNull(row.exercice_id) ??
    toNumberOrNull(row.exercice);

  if (isRecord(row.exercice)) {
    exerciceId =
      toNumberOrNull(row.exercice.id) ??
      toNumberOrNull(row.exercice.pk) ??
      exerciceId;
  }

  const rawDateAg = pickDate(row.date_ag, row.date, row.date_assemblee, row.date_reunion);

  return {
    titre: pickString(row.titre, row.title, row.intitule, row.nom),
    exercice: exerciceId,
    date_ag: formatDateForInput(rawDateAg),
    heure_ag: formatTimeForInput(rawDateAg),
    lieu: pickString(row.lieu, row.location, row.endroit),
    statut: normalizeAGStatus(row.statut ?? row.status ?? row.etat),
  };
}

function combineDateAndTime(dateValue: string, timeValue: string): string | null {
  const datePart = dateValue.trim();
  if (!datePart) return null;

  const timePart = timeValue.trim() || "00:00";
  return `${datePart}T${timePart}:00`;
}

function buildPayload(values: FormValues, coproprieteId: number | null) {
  return {
    copropriete: coproprieteId,
    exercice: values.exercice,
    titre: values.titre.trim(),
    date_ag: combineDateAndTime(values.date_ag, values.heure_ag),
    lieu: values.lieu.trim(),
    statut: values.statut,
  };
}

function PageShell({ children }: { children: ReactNode }) {
  return <div style={{ display: "grid", gap: 16 }}>{children}</div>;
}

function SectionTitle(props: { title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 16,
        flexWrap: "wrap",
        alignItems: "flex-end",
      }}
    >
      <div>
        <div
          style={{
            fontSize: 30,
            fontWeight: 900,
            letterSpacing: -0.5,
            color: "#111827",
            lineHeight: 1.1,
          }}
        >
          {props.title}
        </div>
        {props.subtitle ? (
          <div style={{ marginTop: 8, color: "#6b7280", fontSize: 14, lineHeight: 1.5, maxWidth: 860 }}>
            {props.subtitle}
          </div>
        ) : null}
      </div>

      {props.right ? <div>{props.right}</div> : null}
    </div>
  );
}

function AlertBox(props: { kind: "error" | "success" | "info"; children: ReactNode }) {
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
        whiteSpace: "pre-wrap",
        lineHeight: 1.5,
      }}
    >
      {props.children}
    </div>
  );
}

function RequiredMark() {
  return <span style={requiredMark}>*</span>;
}

function FieldHint(props: { children: ReactNode }) {
  return <div style={hint}>{props.children}</div>;
}

export default function AGForm() {
  const navigate = useNavigate();
  const params = useParams();
  const agId = params.id;
  const isEdit = Boolean(agId);

  const coproprieteId = useAuthStore((s) => s.coproprieteId);
  const activeCoproprieteId = useMemo(() => toNumberOrNull(coproprieteId), [coproprieteId]);

  const [loadState, setLoadState] = useState<LoadState>(isEdit ? "loading" : "idle");
  const [saving, setSaving] = useState(false);
  const [loadingExercices, setLoadingExercices] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [values, setValues] = useState<FormValues>(INITIAL_VALUES);
  const [exerciceOptions, setExerciceOptions] = useState<ExerciceOption[]>([]);

  const pageTitle = useMemo(
    () => (isEdit ? "Modifier l’assemblée" : "Nouvelle assemblée"),
    [isEdit]
  );

  function updateField<K extends keyof FormValues>(field: K, value: FormValues[K]) {
    setValues((prev) => ({ ...prev, [field]: value }));
  }

  function validate() {
    if (!activeCoproprieteId) return "Aucune copropriété active n’est sélectionnée.";
    if (!values.titre.trim()) return "Le titre de l’assemblée est obligatoire.";
    if (!values.date_ag.trim()) return "La date de l’assemblée est obligatoire.";
    if (!values.lieu.trim()) return "Le lieu est obligatoire.";

    const fullDate = combineDateAndTime(values.date_ag, values.heure_ag);
    if (!fullDate) return "La date de l’assemblée est obligatoire.";
    if (Number.isNaN(new Date(fullDate).getTime())) return "La date/heure de l’assemblée est invalide.";

    return null;
  }

  useEffect(() => {
    async function fetchExercices() {
      setLoadingExercices(true);

      let loaded: ExerciceOption[] = [];
      for (const endpoint of EXERCICE_ENDPOINT_CANDIDATES) {
        try {
          const res = await api.get(endpoint);
          loaded = extractRows<Record<string, unknown>>(res?.data)
            .map(normalizeExerciceOption)
            .filter((item) => item.id > 0);
          break;
        } catch {
          // endpoint non exposé pour le moment
        }
      }

      setExerciceOptions(loaded);
      setLoadingExercices(false);
    }

    void fetchExercices();
  }, []);

  useEffect(() => {
    async function fetchDetail() {
      if (!isEdit || !agId) {
        setLoadState("idle");
        return;
      }

      setLoadState("loading");
      setError(null);
      setSuccess(null);

      try {
        const res = await api.get(AG_DETAIL_ENDPOINT(agId));
        setValues(normalizeFormValues(res?.data));
        setLoadState("success");
      } catch (e) {
        setLoadState("error");
        setError(getErrorMessage(e, "Impossible de charger cette assemblée."));
      }
    }

    void fetchDetail();
  }, [isEdit, agId]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);

    try {
      const payload = buildPayload(values, activeCoproprieteId);

      if (isEdit && agId) {
        await api.patch(AG_DETAIL_ENDPOINT(agId), payload);
        setSuccess("L’assemblée a bien été mise à jour.");
      } else {
        await api.post(AG_COLLECTION_ENDPOINT, payload);
        setSuccess("L’assemblée a bien été créée.");
        setValues(INITIAL_VALUES);
      }

      window.setTimeout(() => {
        navigate("/ag/assemblees");
      }, 500);
    } catch (e) {
      setError(
        getErrorMessage(
          e,
          isEdit
            ? "Impossible de modifier cette assemblée pour le moment."
            : "Impossible d’enregistrer cette assemblée pour le moment."
        )
      );
    } finally {
      setSaving(false);
    }
  }

  const isBusy = saving || loadState === "loading";

  return (
    <PageShell>
      <SectionTitle
        title={pageTitle}
        subtitle={
          isEdit
            ? "Mettez à jour les informations générales de l’assemblée sélectionnée."
            : "Renseignez les informations principales pour préparer une nouvelle assemblée générale."
        }
        right={
          <Link to="/ag/assemblees" style={ghostLink}>
            Retour à la liste
          </Link>
        }
      />

      {loadState === "loading" && isEdit ? (
        <AlertBox kind="info">
          <div style={{ fontWeight: 900, marginBottom: 4 }}>Chargement en cours</div>
          <div style={{ fontSize: 13 }}>Récupération des informations de l’assemblée…</div>
        </AlertBox>
      ) : null}

      {error ? (
        <AlertBox kind="error">
          <div style={{ fontWeight: 900, marginBottom: 4 }}>
            {isEdit ? "Mise à jour impossible" : "Enregistrement impossible"}
          </div>
          <div style={{ fontSize: 13 }}>{error}</div>
        </AlertBox>
      ) : null}

      {success ? (
        <AlertBox kind="success">
          <div style={{ fontWeight: 900, marginBottom: 4 }}>Opération réussie</div>
          <div style={{ fontSize: 13 }}>{success}</div>
        </AlertBox>
      ) : null}

      <form onSubmit={handleSubmit} style={card}>
        <div style={requiredInfo}>
          Les champs marqués d’un <span style={requiredMark}>*</span> sont obligatoires.
        </div>

        <div style={grid2}>
          <div style={field}>
            <label style={label}>
              Titre <RequiredMark />
            </label>
            <input
              value={values.titre}
              onChange={(e) => updateField("titre", e.target.value)}
              style={input}
              placeholder="Ex. Assemblée générale ordinaire 2026"
              disabled={isBusy}
            />
          </div>

          <div style={field}>
            <label style={label}>Statut</label>
            <select
              value={values.statut}
              onChange={(e) => updateField("statut", e.target.value as AGStatus)}
              style={input}
              disabled={isBusy}
            >
              {STATUT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div style={field}>
            <label style={label}>Exercice</label>

            {exerciceOptions.length > 0 ? (
              <select
                value={values.exercice ?? ""}
                onChange={(e) => updateField("exercice", toNumberOrNull(e.target.value))}
                style={input}
                disabled={isBusy || loadingExercices}
              >
                <option value="">Aucun exercice</option>
                {exerciceOptions.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="number"
                min="1"
                value={values.exercice ?? ""}
                onChange={(e) => updateField("exercice", toNumberOrNull(e.target.value))}
                style={input}
                placeholder="ID exercice (optionnel)"
                disabled={isBusy}
              />
            )}

            <FieldHint>
              {exerciceOptions.length > 0
                ? "Champ optionnel côté backend. L’exercice doit appartenir à la copropriété active."
                : "La liste des exercices n’est pas encore exposée par le backend. Saisissez l’ID si nécessaire, sinon laissez vide."}
            </FieldHint>
          </div>

          <div style={field}>
            <label style={label}>
              Date de l’assemblée <RequiredMark />
            </label>
            <input
              type="date"
              value={values.date_ag}
              onChange={(e) => updateField("date_ag", e.target.value)}
              style={input}
              disabled={isBusy}
            />
          </div>

          <div style={field}>
            <label style={label}>Heure</label>
            <input
              type="time"
              value={values.heure_ag}
              onChange={(e) => updateField("heure_ag", e.target.value)}
              style={input}
              disabled={isBusy}
            />
            <FieldHint>
              L’heure sera fusionnée avec la date pour alimenter le champ backend <strong>date_ag</strong>.
            </FieldHint>
          </div>

          <div style={fieldFull}>
            <label style={label}>
              Lieu <RequiredMark />
            </label>
            <input
              value={values.lieu}
              onChange={(e) => updateField("lieu", e.target.value)}
              style={input}
              placeholder="Ex. Salle polyvalente / Salle de réunion / Visioconférence"
              disabled={isBusy}
            />
          </div>
        </div>

        <div style={infoBox}>
          Cette version du formulaire est alignée sur le backend actuel du module AG :
          titre, exercice, date/heure fusionnées dans <strong>date_ag</strong>, lieu et statut.
        </div>

        <div style={actions}>
          <Link
            to="/ag/assemblees"
            style={{
              ...secondaryLink,
              pointerEvents: isBusy ? "none" : "auto",
              opacity: isBusy ? 0.7 : 1,
            }}
          >
            Annuler
          </Link>

          <button
            type="submit"
            disabled={isBusy || (isEdit && loadState === "error")}
            style={{
              ...primaryButton,
              cursor: isBusy ? "not-allowed" : "pointer",
              opacity: isBusy ? 0.8 : 1,
            }}
          >
            {saving
              ? "Enregistrement..."
              : isEdit
                ? "Enregistrer les modifications"
                : "Créer l’assemblée"}
          </button>
        </div>
      </form>
    </PageShell>
  );
}

const card: CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 20,
  padding: 18,
  background: "#fff",
  boxShadow: "0 10px 30px rgba(15, 23, 42, 0.04)",
};

const grid2: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 14,
};

const field: CSSProperties = {
  display: "grid",
  gap: 8,
  marginBottom: 14,
};

const fieldFull: CSSProperties = {
  ...field,
  gridColumn: "1 / -1",
};

const label: CSSProperties = {
  fontSize: 13,
  fontWeight: 800,
  color: "#374151",
};

const hint: CSSProperties = {
  fontSize: 12,
  color: "#6b7280",
  lineHeight: 1.45,
};

const requiredMark: CSSProperties = {
  color: "#dc2626",
  fontWeight: 900,
  marginLeft: 4,
};

const requiredInfo: CSSProperties = {
  marginBottom: 16,
  padding: "10px 12px",
  borderRadius: 12,
  background: "#fff7ed",
  border: "1px solid #fed7aa",
  color: "#9a3412",
  fontSize: 13,
  lineHeight: 1.5,
};

const infoBox: CSSProperties = {
  marginTop: 4,
  padding: 14,
  borderRadius: 14,
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
  color: "#475569",
  fontSize: 13,
  lineHeight: 1.6,
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

const actions: CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  gap: 10,
  flexWrap: "wrap",
  marginTop: 18,
};

const primaryButton: CSSProperties = {
  border: "1px solid #c7d2fe",
  background: "#eef2ff",
  color: "#3730a3",
  borderRadius: 12,
  padding: "11px 16px",
  fontSize: 14,
  fontWeight: 800,
};

const secondaryLink: CSSProperties = {
  border: "1px solid #e5e7eb",
  background: "#fff",
  color: "#111827",
  borderRadius: 12,
  padding: "11px 16px",
  fontSize: 14,
  fontWeight: 800,
  textDecoration: "none",
  display: "inline-flex",
  alignItems: "center",
};

const ghostLink: CSSProperties = {
  border: "1px solid #e5e7eb",
  background: "#fff",
  color: "#111827",
  borderRadius: 12,
  padding: "10px 14px",
  fontSize: 13,
  fontWeight: 800,
  textDecoration: "none",
  display: "inline-flex",
  alignItems: "center",
};