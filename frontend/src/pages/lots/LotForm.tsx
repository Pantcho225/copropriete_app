import { useEffect, useMemo, useState, type CSSProperties, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import api from "../../api/axios";
import { ENDPOINTS } from "../../api/endpoints";

type LoadState = "idle" | "loading" | "success" | "error";
type LotType = "APPARTEMENT" | "PARKING" | "CAVE" | "COMMERCE" | "AUTRE";

type FormValues = {
  reference: string;
  type_lot: LotType;
  description: string;
  surface: string;
  etage: string;
};

const INITIAL_VALUES: FormValues = {
  reference: "",
  type_lot: "APPARTEMENT",
  description: "",
  surface: "",
  etage: "",
};

const TYPE_OPTIONS: Array<{ value: LotType; label: string }> = [
  { value: "APPARTEMENT", label: "Appartement" },
  { value: "PARKING", label: "Parking" },
  { value: "CAVE", label: "Cave" },
  { value: "COMMERCE", label: "Commerce" },
  { value: "AUTRE", label: "Autre" },
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function pickString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function getErrorMessage(error: unknown, fallback: string) {
  const err = error as {
    response?: { data?: { detail?: string; message?: string; [key: string]: unknown } };
    message?: string;
  };

  const data = err?.response?.data;

  if (typeof data?.detail === "string" && data.detail.trim()) return data.detail;
  if (typeof data?.message === "string" && data.message.trim()) return data.message;

  if (data && typeof data === "object") {
    for (const value of Object.values(data)) {
      if (Array.isArray(value) && typeof value[0] === "string") return value[0];
      if (typeof value === "string" && value.trim()) return value;
    }
  }

  return err?.message || fallback;
}

function normalizeFormValues(raw: unknown): FormValues {
  const row = isRecord(raw) ? raw : {};
  return {
    reference: pickString(row.reference),
    type_lot: (pickString(row.type_lot) as LotType) || "APPARTEMENT",
    description: pickString(row.description),
    surface: pickString(row.surface),
    etage: pickString(row.etage),
  };
}

function buildPayload(values: FormValues) {
  return {
    reference: values.reference.trim(),
    type_lot: values.type_lot,
    description: values.description.trim(),
    surface: values.surface.trim() ? values.surface.trim() : null,
    etage: values.etage.trim(),
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
        <div style={{ fontSize: 30, fontWeight: 900, color: "#111827", lineHeight: 1.1 }}>
          {props.title}
        </div>
        {props.subtitle ? (
          <div style={{ marginTop: 8, color: "#6b7280", fontSize: 14, lineHeight: 1.5 }}>
            {props.subtitle}
          </div>
        ) : null}
      </div>
      {props.right ?? null}
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

export default function LotForm() {
  const navigate = useNavigate();
  const params = useParams();
  const lotId = params.id;
  const isEdit = Boolean(lotId);

  const [loadState, setLoadState] = useState<LoadState>(isEdit ? "loading" : "idle");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [values, setValues] = useState<FormValues>(INITIAL_VALUES);

  const pageTitle = useMemo(() => (isEdit ? "Modifier le lot" : "Nouveau lot"), [isEdit]);

  function updateField<K extends keyof FormValues>(field: K, value: FormValues[K]) {
    setValues((prev) => ({ ...prev, [field]: value }));
  }

  function validate() {
    if (!values.reference.trim()) return "La référence du lot est obligatoire.";
    if (!values.type_lot) return "Le type de lot est obligatoire.";
    if (values.surface.trim()) {
      const n = Number(values.surface);
      if (!Number.isFinite(n) || n < 0) return "La surface doit être un nombre positif ou vide.";
    }
    return null;
  }

  useEffect(() => {
    async function fetchDetail() {
      if (!isEdit || !lotId) {
        setLoadState("idle");
        return;
      }

      setLoadState("loading");
      setError(null);
      setSuccess(null);

      try {
        const res = await api.get(ENDPOINTS.lotDetail(lotId));
        setValues(normalizeFormValues(res.data));
        setLoadState("success");
      } catch (e) {
        setLoadState("error");
        setError(getErrorMessage(e, "Impossible de charger ce lot."));
      }
    }

    void fetchDetail();
  }, [isEdit, lotId]);

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
      const payload = buildPayload(values);

      if (isEdit && lotId) {
        await api.patch(ENDPOINTS.lotDetail(lotId), payload);
        setSuccess("Le lot a bien été mis à jour.");
      } else {
        await api.post(ENDPOINTS.lots, payload);
        setSuccess("Le lot a bien été créé.");
        setValues(INITIAL_VALUES);
      }

      window.setTimeout(() => {
        navigate("/lots");
      }, 500);
    } catch (e) {
      setError(
        getErrorMessage(
          e,
          isEdit ? "Impossible de modifier ce lot." : "Impossible de créer ce lot.",
        ),
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
        subtitle="Créez ou modifiez un lot dans la copropriété active pour l’utiliser ensuite dans les présences, tantièmes et votes."
        right={
          <Link to="/lots" style={secondaryLink}>
            Retour à la liste
          </Link>
        }
      />

      {loadState === "loading" && isEdit ? (
        <AlertBox kind="info">
          <div style={{ fontWeight: 800, marginBottom: 4 }}>Chargement en cours</div>
          <div style={{ fontSize: 13 }}>Récupération des informations du lot…</div>
        </AlertBox>
      ) : null}

      {error ? (
        <AlertBox kind="error">
          <div style={{ fontWeight: 800, marginBottom: 4 }}>
            {isEdit ? "Mise à jour impossible" : "Création impossible"}
          </div>
          <div style={{ fontSize: 13 }}>{error}</div>
        </AlertBox>
      ) : null}

      {success ? (
        <AlertBox kind="success">
          <div style={{ fontWeight: 800, marginBottom: 4 }}>Opération réussie</div>
          <div style={{ fontSize: 13 }}>{success}</div>
        </AlertBox>
      ) : null}

      <form onSubmit={handleSubmit} style={card}>
        <div style={grid2}>
          <div style={field}>
            <label style={label}>Référence *</label>
            <input
              value={values.reference}
              onChange={(e) => updateField("reference", e.target.value)}
              style={input}
              placeholder="Ex. 101, A101, 407"
              disabled={isBusy}
            />
          </div>

          <div style={field}>
            <label style={label}>Type de lot *</label>
            <select
              value={values.type_lot}
              onChange={(e) => updateField("type_lot", e.target.value as LotType)}
              style={input}
              disabled={isBusy}
            >
              {TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div style={field}>
            <label style={label}>Surface (m²)</label>
            <input
              value={values.surface}
              onChange={(e) => updateField("surface", e.target.value)}
              style={input}
              placeholder="Ex. 85.50"
              disabled={isBusy}
            />
          </div>

          <div style={field}>
            <label style={label}>Étage</label>
            <input
              value={values.etage}
              onChange={(e) => updateField("etage", e.target.value)}
              style={input}
              placeholder="Ex. RDC, 1er, 2e"
              disabled={isBusy}
            />
          </div>

          <div style={fieldFull}>
            <label style={label}>Description</label>
            <textarea
              value={values.description}
              onChange={(e) => updateField("description", e.target.value)}
              style={textarea}
              placeholder="Description libre du lot"
              disabled={isBusy}
            />
          </div>
        </div>

        <div style={actions}>
          <Link
            to="/lots"
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
            disabled={isBusy}
            style={{
              ...primaryButton,
              cursor: isBusy ? "not-allowed" : "pointer",
              opacity: isBusy ? 0.8 : 1,
            }}
          >
            {saving ? "Enregistrement..." : isEdit ? "Enregistrer les modifications" : "Créer le lot"}
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

const textarea: CSSProperties = {
  ...input,
  minHeight: 120,
  resize: "vertical",
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