import { useEffect, useMemo, useState, type CSSProperties, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { createEmploye, getEmploye, updateEmploye } from "../../api/rh";
import type { EmployePayload, EmployeStatut } from "../../api/types";
import { PRODUCT_WORDING } from "../../constants/productWording";

type LoadState = "idle" | "loading" | "success" | "error";

type FormValues = {
  nom: string;
  prenoms: string;
  role: string;
  telephone: string;
  email: string;
  date_embauche: string;
  salaire_base: string;
  statut: EmployeStatut;
  notes: string;
};

const INITIAL_VALUES: FormValues = {
  nom: "",
  prenoms: "",
  role: "",
  telephone: "",
  email: "",
  date_embauche: "",
  salaire_base: "",
  statut: "ACTIF",
  notes: "",
};

const ROLE_OPTIONS = [
  { value: "GARDIEN", label: PRODUCT_WORDING.rh.roles.GARDIEN },
  { value: "AGENT_ENTRETIEN", label: PRODUCT_WORDING.rh.roles.AGENT_ENTRETIEN },
  { value: "AGENT_NETTOYAGE", label: PRODUCT_WORDING.rh.roles.AGENT_NETTOYAGE },
  { value: "RESPONSABLE_SITE", label: PRODUCT_WORDING.rh.roles.RESPONSABLE_SITE },
  { value: "ASSISTANT_GESTION", label: PRODUCT_WORDING.rh.roles.ASSISTANT_GESTION },
  { value: "AUTRE", label: PRODUCT_WORDING.rh.roles.AUTRE },
];

const STATUT_OPTIONS: Array<{ value: EmployeStatut; label: string }> = [
  { value: "ACTIF", label: PRODUCT_WORDING.rh.employees.status.active },
  { value: "INACTIF", label: PRODUCT_WORDING.rh.employees.status.inactive },
  { value: "SUSPENDU", label: "Suspendu" },
];

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

function AlertBox(props: { kind: "error" | "info" | "success"; children: ReactNode }) {
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

function getErrorMessage(e: unknown, fallback: string) {
  const err = e as {
    response?: {
      data?: {
        detail?: string;
        non_field_errors?: string[];
        [key: string]: unknown;
      };
    };
    message?: string;
  };

  const data = err?.response?.data;

  if (data && typeof data === "object") {
    if (typeof data.detail === "string" && data.detail.trim()) {
      return data.detail;
    }

    if (Array.isArray(data.non_field_errors) && data.non_field_errors.length) {
      return data.non_field_errors.join("\n");
    }

    const fieldMessages: string[] = [];
    const labelMap: Record<string, string> = {
      nom: "Nom",
      prenoms: "Prénoms",
      role: "Rôle",
      telephone: "Téléphone",
      email: "E-mail",
      date_embauche: "Date d’embauche",
      salaire_base: "Salaire de base",
      statut: "Statut",
      notes: "Notes",
    };

    for (const [key, value] of Object.entries(data)) {
      if (key === "detail" || key === "non_field_errors") continue;

      const label = labelMap[key] ?? key;

      if (Array.isArray(value) && value.length) {
        fieldMessages.push(`${label} : ${value.join(" / ")}`);
      } else if (typeof value === "string" && value.trim()) {
        fieldMessages.push(`${label} : ${value}`);
      }
    }

    if (fieldMessages.length) {
      return fieldMessages.join("\n");
    }
  }

  return err?.message || fallback;
}

function normalizeDate(value?: string | null) {
  if (!value) return "";
  const s = String(value);
  return s.length >= 10 ? s.slice(0, 10) : s;
}

function normalizeRole(value?: string | null) {
  const role = String(value ?? "").trim().toUpperCase();
  if (!role) return "";

  const exists = ROLE_OPTIONS.some((opt) => opt.value === role);
  return exists ? role : "AUTRE";
}

function RequiredMark() {
  return <span style={requiredMark}>*</span>;
}

function FieldHint(props: { children: ReactNode }) {
  return <div style={hint}>{props.children}</div>;
}

export default function EmployeForm() {
  const navigate = useNavigate();
  const params = useParams();
  const employeId = params.id;
  const isEdit = Boolean(employeId);

  const [state, setState] = useState<LoadState>("idle");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [values, setValues] = useState<FormValues>(INITIAL_VALUES);

  useEffect(() => {
    async function run() {
      if (!isEdit || !employeId) return;

      setState("loading");
      setError(null);
      setSuccess(null);

      try {
        const data = await getEmploye(employeId);
        setValues({
          nom: data.nom ?? "",
          prenoms: data.prenoms ?? "",
          role: normalizeRole(data.role),
          telephone: data.telephone ?? "",
          email: data.email ?? "",
          date_embauche: normalizeDate(data.date_embauche),
          salaire_base:
            data.salaire_base !== null && data.salaire_base !== undefined ? String(data.salaire_base) : "",
          statut: data.statut ?? "ACTIF",
          notes: data.notes ?? "",
        });
        setState("success");
      } catch (e) {
        setState("error");
        setError(getErrorMessage(e, PRODUCT_WORDING.rh.employees.loadError));
      }
    }

    void run();
  }, [isEdit, employeId]);

  const pageTitle = useMemo(
    () => (isEdit ? PRODUCT_WORDING.rh.employees.editTitle : PRODUCT_WORDING.rh.employees.createTitle),
    [isEdit]
  );

  function updateField<K extends keyof FormValues>(field: K, value: FormValues[K]) {
    setValues((prev) => ({ ...prev, [field]: value }));
  }

  function buildPayload(): EmployePayload {
    return {
      nom: values.nom.trim(),
      prenoms: values.prenoms.trim(),
      role: values.role.trim().toUpperCase(),
      telephone: values.telephone.trim() || null,
      email: values.email.trim() || null,
      date_embauche: values.date_embauche || null,
      salaire_base: values.salaire_base.trim() ? Number(values.salaire_base) : null,
      statut: values.statut,
      notes: values.notes.trim() || null,
    };
  }

  function validate(payload: EmployePayload) {
    if (!payload.nom) return "Le nom est obligatoire.";
    if (!payload.prenoms) return "Le ou les prénoms sont obligatoires.";
    if (!payload.role) return "Le rôle est obligatoire.";
    if (!payload.telephone) return "Le téléphone est obligatoire.";
    if (!payload.email) return "L’e-mail est obligatoire.";
    if (!payload.notes) return "Les notes sont obligatoires.";

    const validRoles = ROLE_OPTIONS.map((opt) => opt.value);
    if (!validRoles.includes(String(payload.role).toUpperCase())) {
      return "Veuillez sélectionner un rôle valide.";
    }

    if (payload.salaire_base !== null && payload.salaire_base !== undefined) {
      if (Number.isNaN(payload.salaire_base)) return "Le salaire de base doit être un nombre valide.";
      if (payload.salaire_base < 0) return "Le salaire de base ne peut pas être négatif.";
    }

    return null;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const payload = buildPayload();
    const validationError = validate(payload);

    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);

    try {
      if (isEdit && employeId) {
        await updateEmploye(employeId, payload);
        setSuccess(PRODUCT_WORDING.rh.employees.updateSuccess);
      } else {
        await createEmploye(payload);
        setSuccess(PRODUCT_WORDING.rh.employees.createSuccess);
      }

      setTimeout(() => {
        navigate("/rh/employes");
      }, 500);
    } catch (e) {
      setError(
        getErrorMessage(
          e,
          isEdit ? PRODUCT_WORDING.rh.employees.saveError : PRODUCT_WORDING.rh.employees.saveError
        )
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <PageShell>
      <SectionTitle
        title={pageTitle}
        subtitle={
          isEdit
            ? "Mettez à jour les informations de l’employé sélectionné."
            : "Renseignez les informations nécessaires pour enregistrer un nouvel employé."
        }
        right={
          <Link to="/rh/employes" style={ghostLink}>
            Retour à la liste
          </Link>
        }
      />

      {state === "loading" ? (
        <div style={card}>
          <div style={{ color: "#6b7280" }}>Chargement de la fiche employé...</div>
        </div>
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

      {state !== "loading" && (
        <form onSubmit={handleSubmit} style={card}>
          <div style={requiredInfo}>
            Les champs marqués d’un <span style={requiredMark}>*</span> sont obligatoires.
          </div>

          <div style={grid2}>
            <div style={field}>
              <label style={label}>
                Nom <RequiredMark />
              </label>
              <input
                value={values.nom}
                onChange={(e) => updateField("nom", e.target.value)}
                style={input}
                placeholder="Ex. KOUADIO"
              />
            </div>

            <div style={field}>
              <label style={label}>
                Prénoms <RequiredMark />
              </label>
              <input
                value={values.prenoms}
                onChange={(e) => updateField("prenoms", e.target.value)}
                style={input}
                placeholder="Ex. Yao Serge"
              />
            </div>

            <div style={field}>
              <label style={label}>
                Rôle <RequiredMark />
              </label>
              <select
                value={values.role}
                onChange={(e) => updateField("role", e.target.value)}
                style={input}
              >
                <option value="">Sélectionner un rôle</option>
                {ROLE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <FieldHint>Choisissez le rôle principal exercé au sein de la copropriété.</FieldHint>
            </div>

            <div style={field}>
              <label style={label}>Statut</label>
              <select
                value={values.statut}
                onChange={(e) => updateField("statut", e.target.value as EmployeStatut)}
                style={input}
              >
                {STATUT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div style={field}>
              <label style={label}>
                Téléphone <RequiredMark />
              </label>
              <input
                value={values.telephone}
                onChange={(e) => updateField("telephone", e.target.value)}
                style={input}
                placeholder="Ex. 0700000000"
              />
            </div>

            <div style={field}>
              <label style={label}>
                E-mail <RequiredMark />
              </label>
              <input
                value={values.email}
                onChange={(e) => updateField("email", e.target.value)}
                style={input}
                placeholder="Ex. employe@copro.local"
              />
            </div>

            <div style={field}>
              <label style={label}>Date d’embauche</label>
              <input
                type="date"
                value={values.date_embauche}
                onChange={(e) => updateField("date_embauche", e.target.value)}
                style={input}
              />
            </div>

            <div style={field}>
              <label style={label}>Salaire de base</label>
              <input
                type="number"
                min="0"
                step="1"
                value={values.salaire_base}
                onChange={(e) => updateField("salaire_base", e.target.value)}
                style={input}
                placeholder="Ex. 120000"
              />
              <FieldHint>Montant mensuel de référence, si applicable.</FieldHint>
            </div>
          </div>

          <div style={field}>
            <label style={label}>
              Notes <RequiredMark />
            </label>
            <textarea
              value={values.notes}
              onChange={(e) => updateField("notes", e.target.value)}
              style={textarea}
              placeholder="Informations complémentaires..."
            />
            <FieldHint>Ajoutez les informations utiles à la gestion de cet employé.</FieldHint>
          </div>

          <div style={actions}>
            <Link to="/rh/employes" style={secondaryLink}>
              {PRODUCT_WORDING.actions.cancel}
            </Link>

            <button type="submit" disabled={saving} style={primaryButton}>
              {saving
                ? "Enregistrement..."
                : isEdit
                  ? PRODUCT_WORDING.rh.employees.updateSubmit
                  : PRODUCT_WORDING.rh.employees.createSubmit}
            </button>
          </div>
        </form>
      )}
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
  marginTop: 8,
};

const primaryButton: CSSProperties = {
  border: "1px solid #c7d2fe",
  background: "#eef2ff",
  color: "#3730a3",
  borderRadius: 12,
  padding: "11px 16px",
  fontSize: 14,
  fontWeight: 800,
  cursor: "pointer",
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