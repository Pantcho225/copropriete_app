import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type FormEvent,
  type ReactNode,
} from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import api from "../../api/axios";
import { ENDPOINTS } from "../../api/endpoints";

type LoadState = "idle" | "loading" | "success" | "error";

type TravauxStatut =
  | "BROUILLON"
  | "SOUMIS_AG"
  | "VALIDE"
  | "EN_COURS"
  | "TERMINE"
  | "ARCHIVE";

type DossierTravauxResponse = {
  id: number;
  copropriete?: number;
  titre?: string;
  description?: string;
  statut?: TravauxStatut | string | null;
  budget_estime?: string | number | null;
  budget_vote?: string | number | null;
  budget_reference?: string | number | null;
  total_paye?: string | number | null;
  reste_a_payer?: string | number | null;
  resolution_validation?: number | null;
  resolution_validation_id?: number | null;
  locked_at?: string | null;
  locked_by?: number | null;
  is_locked?: boolean;
  locked?: boolean;
  verrouille?: boolean;
  created_at?: string | null;
  updated_at?: string | null;
};

type DossierTravauxPayload = {
  titre: string;
  description: string;
  budget_estime: number;
};

type FormValues = {
  titre: string;
  description: string;
  budget_estime: string;
};

const INITIAL_VALUES: FormValues = {
  titre: "",
  description: "",
  budget_estime: "",
};

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
          <div
            style={{
              marginTop: 8,
              color: "#6b7280",
              fontSize: 14,
              lineHeight: 1.5,
              maxWidth: 920,
            }}
          >
            {props.subtitle}
          </div>
        ) : null}
      </div>

      {props.right ? <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{props.right}</div> : null}
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

function fmtMoney(value?: string | number | null) {
  if (value === null || value === undefined || value === "") return "—";
  const n = Number(value);
  if (Number.isNaN(n)) return String(value);

  try {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "XOF",
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return `${n} FCFA`;
  }
}

function fmtDateTime(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString("fr-FR");
}

function normalizeStatut(value?: string | null) {
  return String(value ?? "").trim().toUpperCase();
}

function humanizeStatut(value?: string | null) {
  const s = normalizeStatut(value);

  if (!s) return "—";
  if (s === "BROUILLON") return "Brouillon";
  if (s === "SOUMIS_AG") return "Soumis à l’AG";
  if (s === "VALIDE") return "Validé";
  if (s === "EN_COURS") return "En cours";
  if (s === "TERMINE") return "Terminé";
  if (s === "ARCHIVE") return "Archivé";

  return s
    .toLowerCase()
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getStatutStyle(statut?: string | null): CSSProperties {
  const s = normalizeStatut(statut);

  if (s === "VALIDE" || s === "TERMINE") {
    return {
      ...badgeBase,
      color: "#166534",
      background: "#ecfdf5",
      border: "1px solid #a7f3d0",
    };
  }

  if (s === "SOUMIS_AG" || s === "EN_COURS") {
    return {
      ...badgeBase,
      color: "#1d4ed8",
      background: "#eff6ff",
      border: "1px solid #bfdbfe",
    };
  }

  if (s === "BROUILLON") {
    return {
      ...badgeBase,
      color: "#374151",
      background: "#f3f4f6",
      border: "1px solid #e5e7eb",
    };
  }

  return {
    ...badgeBase,
    color: "#92400e",
    background: "#fffbeb",
    border: "1px solid #fde68a",
  };
}

function getErrorMessage(e: unknown, fallback: string) {
  const err = e as {
    response?: {
      data?: {
        detail?: string;
        message?: string;
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

    if (typeof data.message === "string" && data.message.trim()) {
      return data.message;
    }

    if (Array.isArray(data.non_field_errors) && data.non_field_errors.length) {
      return data.non_field_errors.join("\n");
    }

    const labelMap: Record<string, string> = {
      titre: "Titre",
      description: "Description",
      budget_estime: "Budget estimé",
      statut: "Statut",
      budget_vote: "Budget voté",
      budget_reference: "Budget de référence",
      total_paye: "Total payé",
      reste_a_payer: "Reste à payer",
      detail: "Détail",
    };

    const fieldMessages: string[] = [];

    for (const [key, value] of Object.entries(data)) {
      if (key === "detail" || key === "non_field_errors" || key === "message") continue;

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

function normalizeDecimalInput(value: string) {
  return value.replace(/\s+/g, "").replace(",", ".");
}

function extractLocked(data?: DossierTravauxResponse | null) {
  if (!data) return false;
  return Boolean(data.is_locked) || Boolean(data.locked) || Boolean(data.verrouille) || Boolean(data.locked_at);
}

function InfoCard(props: { title: string; children: ReactNode }) {
  return (
    <div
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 16,
        padding: 14,
        background: "#fff",
      }}
    >
      <div style={{ fontSize: 12, color: "#6b7280", fontWeight: 700, marginBottom: 8 }}>
        {props.title}
      </div>
      <div style={{ fontSize: 14, fontWeight: 800, color: "#111827", lineHeight: 1.45 }}>{props.children}</div>
    </div>
  );
}

export default function TravauxDossierForm() {
  const navigate = useNavigate();
  const params = useParams();
  const dossierId = params.id;
  const isEdit = Boolean(dossierId);

  const [state, setState] = useState<LoadState>(isEdit ? "loading" : "success");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [values, setValues] = useState<FormValues>(INITIAL_VALUES);
  const [loaded, setLoaded] = useState<DossierTravauxResponse | null>(null);

  useEffect(() => {
    async function run() {
      if (!isEdit || !dossierId) return;

      setState("loading");
      setError(null);
      setSuccess(null);

      try {
        const { data } = await api.get<DossierTravauxResponse>(ENDPOINTS.travauxDossierDetail(dossierId));

        setLoaded(data);
        setValues({
          titre: data.titre ?? "",
          description: data.description ?? "",
          budget_estime:
            data.budget_estime !== null && data.budget_estime !== undefined
              ? String(data.budget_estime)
              : "",
        });

        setState("success");
      } catch (e) {
        setState("error");
        setLoaded(null);
        setError(getErrorMessage(e, "Impossible de charger ce dossier travaux."));
      }
    }

    void run();
  }, [isEdit, dossierId]);

  const pageTitle = useMemo(
    () => (isEdit ? "Modifier le dossier" : "Nouveau dossier"),
    [isEdit]
  );

  const pageSubtitle = useMemo(
    () =>
      isEdit
        ? "Mettez à jour les informations générales du dossier sélectionné. Les données budgétaires avancées et le statut d’exécution restent pilotés par le flux métier."
        : "Renseignez les informations nécessaires pour enregistrer un nouveau dossier dans le module Travaux.",
    [isEdit]
  );

  function updateField<K extends keyof FormValues>(field: K, value: FormValues[K]) {
    setValues((prev) => ({ ...prev, [field]: value }));
  }

  function buildPayload(): DossierTravauxPayload {
    const rawBudget = normalizeDecimalInput(values.budget_estime.trim());

    return {
      titre: values.titre.trim(),
      description: values.description.trim(),
      budget_estime: Number(rawBudget),
    };
  }

  function validate(payload: DossierTravauxPayload) {
    if (!payload.titre) return "Le titre du dossier est obligatoire.";

    if (payload.titre.length < 3) {
      return "Le titre du dossier doit contenir au moins 3 caractères.";
    }

    if (!values.budget_estime.trim()) {
      return "Le budget estimé est obligatoire.";
    }

    if (Number.isNaN(payload.budget_estime)) {
      return "Le budget estimé doit être un nombre valide.";
    }

    if (payload.budget_estime < 0) {
      return "Le budget estimé ne peut pas être négatif.";
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
      let savedId = dossierId;

      if (isEdit && dossierId) {
        await api.patch(ENDPOINTS.travauxDossierDetail(dossierId), payload);
        setSuccess("Le dossier a bien été mis à jour.");
      } else {
        const { data } = await api.post<DossierTravauxResponse>(ENDPOINTS.travauxDossiers, payload);
        savedId = data?.id ? String(data.id) : undefined;
        setSuccess("Le dossier a bien été créé.");
      }

      window.setTimeout(() => {
        if (savedId) {
          navigate(`/travaux/dossiers/${savedId}`);
        } else {
          navigate("/travaux/dossiers");
        }
      }, 700);
    } catch (e) {
      setError(
        getErrorMessage(
          e,
          isEdit ? "Impossible de modifier ce dossier." : "Impossible d’enregistrer ce dossier."
        )
      );
    } finally {
      setSaving(false);
    }
  }

  const isBusy = state === "loading" || saving;
  const isLocked = extractLocked(loaded);
  const canShowForm = !isEdit || state === "success";

  return (
    <PageShell>
      <SectionTitle
        title={pageTitle}
        subtitle={pageSubtitle}
        right={
          <>
            <Link to="/travaux/dossiers" style={ghostLink}>
              Retour à la liste
            </Link>

            {isEdit && dossierId ? (
              <Link to={`/travaux/dossiers/${dossierId}`} style={ghostLink}>
                Ouvrir le dossier
              </Link>
            ) : null}
          </>
        }
      />

      {state === "loading" ? (
        <div style={card}>
          <div style={{ color: "#6b7280" }}>Chargement du formulaire...</div>
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

      {isEdit && loaded ? (
        <div style={infoGrid} className="travaux-form-info-grid">
          <InfoCard title="Statut actuel">
            <span style={getStatutStyle(String(loaded.statut ?? ""))}>{humanizeStatut(String(loaded.statut ?? ""))}</span>
          </InfoCard>

          <InfoCard title="Budget estimé">{fmtMoney(loaded.budget_estime)}</InfoCard>
          <InfoCard title="Budget voté">{fmtMoney(loaded.budget_vote)}</InfoCard>
          <InfoCard title="Budget de référence">{fmtMoney(loaded.budget_reference)}</InfoCard>
          <InfoCard title="Total payé">{fmtMoney(loaded.total_paye)}</InfoCard>
          <InfoCard title="Reste à payer">{fmtMoney(loaded.reste_a_payer)}</InfoCard>

          <InfoCard title="Verrouillage">
            {isLocked ? "Dossier verrouillé" : "Dossier non verrouillé"}
          </InfoCard>

          <InfoCard title="Créé le">{fmtDateTime(loaded.created_at)}</InfoCard>
          <InfoCard title="Mis à jour le">{fmtDateTime(loaded.updated_at)}</InfoCard>
          <InfoCard title="Résolution liée">
            {loaded.resolution_validation_id ?? loaded.resolution_validation ?? "—"}
          </InfoCard>
        </div>
      ) : null}

      {isEdit && isLocked ? (
        <AlertBox kind="info">
          <div style={{ fontWeight: 900, marginBottom: 4 }}>Modification non disponible</div>
          <div style={{ fontSize: 13 }}>
            Ce dossier est verrouillé. La fiche reste consultable, mais le backend refuse toute modification via le formulaire standard.
          </div>
        </AlertBox>
      ) : null}

      {isEdit && loaded && !isLocked ? (
        <AlertBox kind="info">
          Cette fiche permet de maintenir les informations générales du dossier. Le budget voté, le verrouillage et la résolution liée dépendent du flux métier global du module Travaux.
        </AlertBox>
      ) : null}

      {state === "error" && isEdit ? (
        <div style={card}>
          <div style={{ color: "#6b7280", fontSize: 14, lineHeight: 1.6 }}>
            Le formulaire ne peut pas être affiché tant que le chargement du dossier n’a pas abouti.
          </div>
        </div>
      ) : null}

      {canShowForm ? (
        <form onSubmit={handleSubmit} style={card}>
          <div style={requiredInfo}>
            Les champs marqués d’un <span style={requiredMark}>*</span> sont obligatoires.
          </div>

          <div style={grid1}>
            <div style={field}>
              <label style={label}>
                Titre du dossier <RequiredMark />
              </label>
              <input
                value={values.titre}
                onChange={(e) => updateField("titre", e.target.value)}
                style={input}
                placeholder="Ex. Réfection de la toiture"
                disabled={isBusy || isLocked}
              />
              <FieldHint>Intitulé principal du dossier travaux.</FieldHint>
            </div>

            <div style={field}>
              <label style={label}>
                Budget estimé <RequiredMark />
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={values.budget_estime}
                onChange={(e) => updateField("budget_estime", e.target.value)}
                style={input}
                placeholder="Ex. 1400000"
                disabled={isBusy || isLocked}
              />
              <FieldHint>Montant prévisionnel initial du dossier avant validation éventuelle.</FieldHint>
            </div>

            <div style={field}>
              <label style={label}>Description</label>
              <textarea
                value={values.description}
                onChange={(e) => updateField("description", e.target.value)}
                style={textarea}
                placeholder="Décrivez le besoin, le contexte ou les travaux prévus..."
                disabled={isBusy || isLocked}
              />
              <FieldHint>
                Ce champ est optionnel mais utile pour faciliter la lecture du dossier dans la liste et la fiche détail.
              </FieldHint>
            </div>
          </div>

          <div style={actions}>
            <Link
              to={isEdit && dossierId ? `/travaux/dossiers/${dossierId}` : "/travaux/dossiers"}
              style={{
                ...secondaryLink,
                pointerEvents: saving ? "none" : "auto",
                opacity: saving ? 0.7 : 1,
              }}
            >
              Annuler
            </Link>

            <button
              type="submit"
              disabled={isBusy || isLocked}
              style={{
                ...primaryButton,
                opacity: isBusy || isLocked ? 0.8 : 1,
                cursor: isBusy || isLocked ? "not-allowed" : "pointer",
              }}
            >
              {saving
                ? "Enregistrement..."
                : isEdit
                  ? "Enregistrer les modifications"
                  : "Créer le dossier"}
            </button>
          </div>
        </form>
      ) : null}

      <style>{`
        @media (max-width: 900px) {
          .travaux-form-info-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }
        }

        @media (max-width: 680px) {
          .travaux-form-info-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </PageShell>
  );
}

const badgeBase: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "4px 10px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 800,
  whiteSpace: "nowrap",
};

const card: CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 20,
  padding: 18,
  background: "#fff",
  boxShadow: "0 10px 30px rgba(15, 23, 42, 0.04)",
};

const infoGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: 14,
};

const grid1: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr",
  gap: 14,
};

const field: CSSProperties = {
  display: "grid",
  gap: 8,
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
  minHeight: 130,
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