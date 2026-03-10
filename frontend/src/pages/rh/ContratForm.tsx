import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type FormEvent,
  type ReactNode,
} from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { createContrat, getContrat, getEmployes, updateContrat } from "../../api/rh";
import type { ContratEmployePayload, ContratStatut, Employe } from "../../api/types";

type LoadState = "idle" | "loading" | "success" | "error";

type FormValues = {
  employe: string;
  type_contrat: string;
  date_debut: string;
  date_fin: string;
  salaire_mensuel: string;
  statut: ContratStatut;
  notes: string;
};

const INITIAL_VALUES: FormValues = {
  employe: "",
  type_contrat: "",
  date_debut: "",
  date_fin: "",
  salaire_mensuel: "",
  statut: "ACTIF",
  notes: "",
};

const TYPE_CONTRAT_OPTIONS = [
  { value: "CDI", label: "CDI" },
  { value: "CDD", label: "CDD" },
];

const STATUT_OPTIONS: Array<{ value: ContratStatut; label: string }> = [
  { value: "ACTIF", label: "Actif" },
  { value: "TERMINE", label: "Terminé" },
  { value: "BROUILLON", label: "Brouillon" },
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

function AlertBox(props: { kind: "error" | "success"; children: ReactNode }) {
  const tone =
    props.kind === "error"
      ? { bg: "#fef2f2", border: "#fecaca", text: "#991b1b" }
      : { bg: "#ecfdf5", border: "#a7f3d0", text: "#166534" };

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
      employe: "Employé",
      type_contrat: "Type de contrat",
      date_debut: "Date de début",
      date_fin: "Date de fin",
      salaire_mensuel: "Salaire mensuel",
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

function RequiredMark() {
  return <span style={requiredMark}>*</span>;
}

function FieldHint(props: { children: ReactNode }) {
  return <div style={hint}>{props.children}</div>;
}

export default function ContratForm() {
  const navigate = useNavigate();
  const params = useParams();
  const contratId = params.id;
  const isEdit = Boolean(contratId);

  const [state, setState] = useState<LoadState>("idle");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [employes, setEmployes] = useState<Employe[]>([]);
  const [values, setValues] = useState<FormValues>(INITIAL_VALUES);

  useEffect(() => {
    let isMounted = true;

    async function run() {
      setState("loading");
      setError(null);
      setSuccess(null);

      try {
        const empData = await getEmployes();
        if (!isMounted) return;

        setEmployes(Array.isArray(empData.results) ? empData.results : []);

        if (isEdit && contratId) {
          const contrat = await getContrat(contratId);
          if (!isMounted) return;

          setValues({
            employe: String(
              typeof contrat.employe === "number" ? contrat.employe : contrat.employe?.id ?? ""
            ),
            type_contrat: contrat.type_contrat ?? "",
            date_debut: normalizeDate(contrat.date_debut),
            date_fin: normalizeDate(contrat.date_fin),
            salaire_mensuel:
              contrat.salaire_mensuel !== null && contrat.salaire_mensuel !== undefined
                ? String(contrat.salaire_mensuel)
                : "",
            statut: contrat.statut ?? "ACTIF",
            notes: contrat.notes ?? "",
          });
        }

        if (isMounted) setState("success");
      } catch (e) {
        if (!isMounted) return;
        setState("error");
        setError(getErrorMessage(e, "Impossible de charger le formulaire du contrat."));
      }
    }

    void run();

    return () => {
      isMounted = false;
    };
  }, [isEdit, contratId]);

  const pageTitle = useMemo(
    () => (isEdit ? "Modifier le contrat" : "Nouveau contrat"),
    [isEdit]
  );

  function updateField<K extends keyof FormValues>(field: K, value: FormValues[K]) {
    setValues((prev) => ({ ...prev, [field]: value }));
  }

  function buildPayload(): ContratEmployePayload {
    return {
      employe: Number(values.employe),
      type_contrat: values.type_contrat.trim().toUpperCase(),
      date_debut: values.date_debut,
      date_fin: values.date_fin || null,
      salaire_mensuel: values.salaire_mensuel.trim()
        ? Number(values.salaire_mensuel.replace(",", "."))
        : null,
      statut: values.statut,
      notes: values.notes.trim() || null,
    };
  }

  function validate(payload: ContratEmployePayload) {
    if (!payload.employe || Number.isNaN(payload.employe)) {
      return "Veuillez sélectionner un employé.";
    }

    if (!payload.type_contrat) {
      return "Le type de contrat est obligatoire.";
    }

    if (!payload.date_debut) {
      return "La date de début est obligatoire.";
    }

    if (!payload.notes || !String(payload.notes).trim()) {
      return "Les notes sont obligatoires.";
    }

    const validTypes = TYPE_CONTRAT_OPTIONS.map((opt) => opt.value);
    if (!validTypes.includes(String(payload.type_contrat).toUpperCase())) {
      return "Veuillez sélectionner un type de contrat valide.";
    }

    if (payload.salaire_mensuel !== null && payload.salaire_mensuel !== undefined) {
      if (Number.isNaN(payload.salaire_mensuel)) {
        return "Le salaire mensuel doit être un nombre valide.";
      }
      if (payload.salaire_mensuel < 0) {
        return "Le salaire mensuel ne peut pas être négatif.";
      }
    }

    if (payload.date_fin && payload.date_debut && payload.date_fin < payload.date_debut) {
      return "La date de fin ne peut pas être antérieure à la date de début.";
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
      if (isEdit && contratId) {
        await updateContrat(contratId, payload);
        setSuccess("Le contrat a bien été mis à jour.");
      } else {
        await createContrat(payload);
        setSuccess("Le contrat a bien été créé.");
      }

      window.setTimeout(() => {
        navigate("/rh/contrats");
      }, 500);
    } catch (e) {
      setError(
        getErrorMessage(
          e,
          isEdit
            ? "Impossible de modifier ce contrat pour le moment."
            : "Impossible d’enregistrer ce contrat pour le moment."
        )
      );
    } finally {
      setSaving(false);
    }
  }

  const isBusy = state === "loading" || saving;

  return (
    <PageShell>
      <SectionTitle
        title={pageTitle}
        subtitle={
          isEdit
            ? "Mettez à jour les informations du contrat sélectionné."
            : "Renseignez les informations nécessaires pour enregistrer un nouveau contrat."
        }
        right={
          <Link to="/rh/contrats" style={ghostLink}>
            Retour à la liste
          </Link>
        }
      />

      {state === "loading" ? (
        <div style={card}>
          <div style={{ color: "#6b7280" }}>Chargement du formulaire du contrat...</div>
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
                Employé <RequiredMark />
              </label>
              <select
                value={values.employe}
                onChange={(e) => updateField("employe", e.target.value)}
                style={input}
                disabled={isBusy}
              >
                <option value="">Sélectionner un employé</option>
                {employes.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.nom} {emp.prenoms}
                  </option>
                ))}
              </select>
              <FieldHint>Sélectionnez l’employé concerné par ce contrat.</FieldHint>
            </div>

            <div style={field}>
              <label style={label}>
                Type de contrat <RequiredMark />
              </label>
              <select
                value={values.type_contrat}
                onChange={(e) => updateField("type_contrat", e.target.value)}
                style={input}
                disabled={isBusy}
              >
                <option value="">Sélectionner un type</option>
                {TYPE_CONTRAT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <FieldHint>Choisissez le type de contrat applicable.</FieldHint>
            </div>

            <div style={field}>
              <label style={label}>
                Date de début <RequiredMark />
              </label>
              <input
                type="date"
                value={values.date_debut}
                onChange={(e) => updateField("date_debut", e.target.value)}
                style={input}
                disabled={isBusy}
              />
            </div>

            <div style={field}>
              <label style={label}>Date de fin</label>
              <input
                type="date"
                value={values.date_fin}
                onChange={(e) => updateField("date_fin", e.target.value)}
                style={input}
                disabled={isBusy}
              />
              <FieldHint>Laissez vide pour un contrat sans date de fin définie.</FieldHint>
            </div>

            <div style={field}>
              <label style={label}>Salaire mensuel</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={values.salaire_mensuel}
                onChange={(e) => updateField("salaire_mensuel", e.target.value)}
                style={input}
                placeholder="Ex. 120000"
                disabled={isBusy}
              />
            </div>

            <div style={field}>
              <label style={label}>Statut</label>
              <select
                value={values.statut}
                onChange={(e) => updateField("statut", e.target.value as ContratStatut)}
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
              disabled={isBusy}
            />
            <FieldHint>Ajoutez les précisions utiles à la gestion du contrat.</FieldHint>
          </div>

          <div style={actions}>
            <Link
              to="/rh/contrats"
              style={{
                ...secondaryLink,
                pointerEvents: saving ? "none" : "auto",
                opacity: saving ? 0.7 : 1,
              }}
            >
              Annuler
            </Link>

            <button type="submit" disabled={isBusy} style={primaryButton}>
              {saving
                ? "Enregistrement..."
                : isEdit
                  ? "Enregistrer les modifications"
                  : "Créer le contrat"}
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