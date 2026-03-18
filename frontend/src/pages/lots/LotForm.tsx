import { useEffect, useMemo, useState, type CSSProperties, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import api from "../../api/axios";
import { ENDPOINTS } from "../../api/endpoints";

type LoadState = "idle" | "loading" | "success" | "error";
type FlashKind = "success" | "error" | "info";
type ButtonVariant = "primary" | "secondary" | "danger";
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
          <div style={{ marginTop: 8, color: "#6b7280", fontSize: 14, lineHeight: 1.5, maxWidth: 920 }}>
            {props.subtitle}
          </div>
        ) : null}
      </div>
      {props.right ?? null}
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
        whiteSpace: "pre-wrap",
        lineHeight: 1.5,
      }}
    >
      {props.title ? <div style={{ fontWeight: 800, marginBottom: 4 }}>{props.title}</div> : null}
      <div style={{ fontSize: 13 }}>{props.children}</div>
    </div>
  );
}

function AppButton(props: {
  children: ReactNode;
  to?: string;
  variant?: ButtonVariant;
  disabled?: boolean;
  onClick?: () => void;
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

  if (props.to) {
    return (
      <Link
        to={props.to}
        aria-disabled={props.disabled}
        onClick={(e) => {
          if (props.disabled) e.preventDefault();
        }}
        style={{
          border: styles.border,
          background: props.disabled ? "#f9fafb" : styles.background,
          color: props.disabled ? "#9ca3af" : styles.color,
          borderRadius: 12,
          padding: "11px 16px",
          fontSize: 14,
          fontWeight: 800,
          textDecoration: "none",
          display: "inline-flex",
          alignItems: "center",
          whiteSpace: "nowrap",
          cursor: props.disabled ? "not-allowed" : "pointer",
        }}
      >
        {props.children}
      </Link>
    );
  }

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
        padding: "11px 16px",
        fontSize: 14,
        fontWeight: 800,
        cursor: props.disabled ? "not-allowed" : "pointer",
        whiteSpace: "nowrap",
      }}
    >
      {props.children}
    </button>
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

  function resetForm() {
    setValues(INITIAL_VALUES);
    setError(null);
    setSuccess(null);
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
        subtitle="Créez ou modifiez un lot dans la copropriété active afin de l’utiliser ensuite dans les présences, les tantièmes et les votes."
        right={
          <AppButton to="/lots" variant="secondary" disabled={isBusy}>
            Retour à la liste
          </AppButton>
        }
      />

      {loadState === "loading" && isEdit ? (
        <AlertBox kind="info" title="Chargement des données...">
          Récupération des informations du lot en cours.
        </AlertBox>
      ) : null}

      {error ? (
        <AlertBox kind="error" title={isEdit ? "Impossible de modifier ce lot." : "Impossible de créer ce lot."}>
          {error}
        </AlertBox>
      ) : null}

      {success ? (
        <AlertBox kind="success" title="Opération effectuée avec succès.">
          {success}
        </AlertBox>
      ) : null}

      <form onSubmit={handleSubmit} style={card}>
        <div style={formIntroBox}>
          Renseignez les informations principales du lot. La référence et le type de lot sont obligatoires.
        </div>

        <div className="lot-form-grid" style={grid2}>
          <div style={field}>
            <label style={label}>Référence *</label>
            <input
              value={values.reference}
              onChange={(e) => updateField("reference", e.target.value)}
              style={input}
              placeholder="Ex. 101, A101, 407"
              disabled={isBusy}
            />
            <div style={hint}>Identifiant visible du lot dans la copropriété.</div>
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
            <div style={hint}>Catégorie principale utilisée dans la gestion métier.</div>
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
            <div style={hint}>Laissez vide si la surface n’est pas encore renseignée.</div>
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
            <div style={hint}>Indication utile pour l’identification physique du lot.</div>
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
            <div style={hint}>Vous pouvez préciser l’usage, la localisation ou toute information utile.</div>
          </div>
        </div>

        <div style={actions}>
          {!isEdit ? (
            <AppButton onClick={resetForm} variant="secondary" disabled={isBusy}>
              Réinitialiser
            </AppButton>
          ) : (
            <AppButton to="/lots" variant="secondary" disabled={isBusy}>
              Annuler
            </AppButton>
          )}

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

      {loadState !== "loading" ? (
        <AlertBox kind="info" title="Lecture métier du formulaire">
          Les lots servent de base aux présences, aux votes et aux répartitions métier dans la copropriété. Une saisie propre améliore la cohérence globale du produit.
        </AlertBox>
      ) : null}

      <style>{`
        @media (max-width: 900px) {
          .lot-form-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
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

const formIntroBox: CSSProperties = {
  padding: 14,
  borderRadius: 14,
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
  color: "#475569",
  fontSize: 13,
  lineHeight: 1.6,
  marginBottom: 14,
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