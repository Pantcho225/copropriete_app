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

type FournisseurResponse = {
  id: number;
  nom?: string | null;
  specialite?: string | null;
  email?: string | null;
  telephone?: string | null;
  adresse?: string | null;
  identifiant?: string | null;
  is_active?: boolean | null;
  actif?: boolean | null;
  active?: boolean | null;
  isActive?: boolean | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type FournisseurPayload = {
  nom: string;
  specialite: string;
  email: string;
  telephone: string;
  adresse: string;
  identifiant: string;
  is_active: boolean;
};

type FormValues = {
  nom: string;
  specialite: string;
  email: string;
  telephone: string;
  adresse: string;
  identifiant: string;
  is_active: boolean;
};

const INITIAL_VALUES: FormValues = {
  nom: "",
  specialite: "",
  email: "",
  telephone: "",
  adresse: "",
  identifiant: "",
  is_active: true,
};

function cleanText(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function fmtDateTime(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString("fr-FR");
}

function extractActif(data?: FournisseurResponse | null) {
  if (!data) return true;

  if (typeof data.is_active === "boolean") return data.is_active;
  if (typeof data.actif === "boolean") return data.actif;
  if (typeof data.active === "boolean") return data.active;
  if (typeof data.isActive === "boolean") return data.isActive;

  return true;
}

function humanizeActif(value: boolean) {
  return value ? "Actif" : "Inactif";
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
      nom: "Nom",
      specialite: "Spécialité",
      email: "Email",
      telephone: "Téléphone",
      adresse: "Adresse",
      identifiant: "Identifiant",
      is_active: "État",
      actif: "État",
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
              maxWidth: 900,
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

function FieldHint(props: { children: ReactNode }) {
  return (
    <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.45 }}>
      {props.children}
    </div>
  );
}

export default function TravauxFournisseurForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  const [state, setState] = useState<LoadState>(isEdit ? "loading" : "success");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<FournisseurResponse | null>(null);
  const [values, setValues] = useState<FormValues>(INITIAL_VALUES);

  useEffect(() => {
    async function run() {
      if (!isEdit || !id) return;

      setState("loading");
      setError(null);
      setSuccess(null);

      try {
        const { data } = await api.get<FournisseurResponse>(ENDPOINTS.travauxFournisseurDetail(id));

        setLoaded(data);
        setValues({
          nom: cleanText(data.nom),
          specialite: cleanText(data.specialite),
          email: cleanText(data.email),
          telephone: cleanText(data.telephone),
          adresse: cleanText(data.adresse),
          identifiant: cleanText(data.identifiant),
          is_active: extractActif(data),
        });

        setState("success");
      } catch (e) {
        setState("error");
        setLoaded(null);
        setError(getErrorMessage(e, "Impossible de charger ce fournisseur."));
      }
    }

    void run();
  }, [id, isEdit]);

  const pageTitle = useMemo(
    () => (isEdit ? "Modifier le fournisseur" : "Nouveau fournisseur"),
    [isEdit]
  );

  const pageSubtitle = useMemo(
    () =>
      isEdit
        ? "Mettez à jour les informations de la fiche fournisseur sélectionnée."
        : "Renseignez les informations utiles pour enregistrer un nouveau fournisseur dans le module Travaux.",
    [isEdit]
  );

  function updateField<K extends keyof FormValues>(field: K, value: FormValues[K]) {
    setValues((prev) => ({ ...prev, [field]: value }));
  }

  function buildPayload(): FournisseurPayload {
    return {
      nom: values.nom.trim(),
      specialite: values.specialite.trim(),
      email: normalizeEmail(values.email),
      telephone: values.telephone.trim(),
      adresse: values.adresse.trim(),
      identifiant: values.identifiant.trim(),
      is_active: Boolean(values.is_active),
    };
  }

  function validate(payload: FournisseurPayload) {
    if (!payload.nom) return "Le nom du fournisseur est obligatoire.";
    if (payload.nom.length < 2) return "Le nom du fournisseur doit contenir au moins 2 caractères.";

    if (payload.email) {
      const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email);
      if (!ok) return "L’adresse email n’est pas valide.";
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
      if (isEdit && id) {
        await api.patch(ENDPOINTS.travauxFournisseurDetail(id), payload);
        setSuccess("Le fournisseur a bien été mis à jour.");
      } else {
        await api.post(ENDPOINTS.travauxFournisseurs, payload);
        setSuccess("Le fournisseur a bien été créé.");
      }

      window.setTimeout(() => {
        navigate("/travaux/fournisseurs");
      }, 700);
    } catch (e) {
      setError(
        getErrorMessage(
          e,
          isEdit ? "Impossible de modifier ce fournisseur." : "Impossible d’enregistrer ce fournisseur."
        )
      );
    } finally {
      setSaving(false);
    }
  }

  const isBusy = state === "loading" || saving;
  const canShowForm = !isEdit || state === "success";

  return (
    <PageShell>
      <SectionTitle
        title={pageTitle}
        subtitle={pageSubtitle}
        right={
          <Link to="/travaux/fournisseurs" style={ghostLink}>
            Retour à la liste
          </Link>
        }
      />

      {state === "loading" ? (
        <div style={card}>
          <div style={{ color: "#6b7280" }}>Chargement du fournisseur...</div>
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
        <div style={infoGrid} className="travaux-fournisseur-form-info-grid">
          <InfoCard title="ID fournisseur">#{loaded.id}</InfoCard>
          <InfoCard title="Créé le">{fmtDateTime(loaded.created_at)}</InfoCard>
          <InfoCard title="Mis à jour le">{fmtDateTime(loaded.updated_at)}</InfoCard>
          <InfoCard title="État">{humanizeActif(values.is_active)}</InfoCard>
        </div>
      ) : null}

      {isEdit && loaded ? (
        <AlertBox kind="info">
          Cette fiche permet de maintenir les informations du prestataire. La liaison directe entre fournisseur et
          dossier travaux pourra être renforcée plus tard sans bloquer l’exploitation actuelle.
        </AlertBox>
      ) : null}

      {state === "error" && isEdit ? (
        <div style={card}>
          <div style={{ color: "#6b7280", fontSize: 14, lineHeight: 1.6 }}>
            Le formulaire ne peut pas être affiché tant que le chargement du fournisseur n’a pas abouti.
          </div>
        </div>
      ) : null}

      {canShowForm ? (
        <form onSubmit={handleSubmit} style={card}>
          <div style={requiredInfo}>
            Les champs marqués d’un <span style={requiredMark}>*</span> sont obligatoires.
          </div>

          <div style={grid2} className="travaux-fournisseur-form-grid">
            <div style={field}>
              <label style={label}>
                Nom du fournisseur <RequiredMark />
              </label>
              <input
                value={values.nom}
                onChange={(e) => updateField("nom", e.target.value)}
                style={input}
                placeholder="Ex. ETS TOITURE PRO"
                disabled={isBusy}
              />
              <FieldHint>Nom commercial ou raison sociale du prestataire.</FieldHint>
            </div>

            <div style={field}>
              <label style={label}>Spécialité</label>
              <input
                value={values.specialite}
                onChange={(e) => updateField("specialite", e.target.value)}
                style={input}
                placeholder="Ex. Couverture, plomberie, peinture"
                disabled={isBusy}
              />
              <FieldHint>Champ optionnel mais utile pour filtrer et retrouver rapidement le prestataire.</FieldHint>
            </div>

            <div style={field}>
              <label style={label}>Téléphone</label>
              <input
                value={values.telephone}
                onChange={(e) => updateField("telephone", e.target.value)}
                style={input}
                placeholder="Ex. 07 00 00 00 00"
                disabled={isBusy}
              />
            </div>

            <div style={field}>
              <label style={label}>Email</label>
              <input
                type="email"
                value={values.email}
                onChange={(e) => updateField("email", e.target.value)}
                style={input}
                placeholder="Ex. contact@prestataire.ci"
                disabled={isBusy}
              />
            </div>

            <div style={field}>
              <label style={label}>Adresse</label>
              <input
                value={values.adresse}
                onChange={(e) => updateField("adresse", e.target.value)}
                style={input}
                placeholder="Ex. Cocody, Riviera, Abidjan"
                disabled={isBusy}
              />
            </div>

            <div style={field}>
              <label style={label}>Identifiant</label>
              <input
                value={values.identifiant}
                onChange={(e) => updateField("identifiant", e.target.value)}
                style={input}
                placeholder="Ex. RCCM, IFU, SIRET ou référence interne"
                disabled={isBusy}
              />
              <FieldHint>
                Champ secondaire utile pour l’exploitation, le contrôle ou une future montée en gamme du module.
              </FieldHint>
            </div>

            <div style={{ ...field, gridColumn: "1 / -1" }}>
              <label style={label}>État du fournisseur</label>
              <select
                value={values.is_active ? "ACTIF" : "INACTIF"}
                onChange={(e) => updateField("is_active", e.target.value === "ACTIF")}
                style={selectInput}
                disabled={isBusy}
              >
                <option value="ACTIF">Actif</option>
                <option value="INACTIF">Inactif</option>
              </select>
              <FieldHint>
                Un fournisseur inactif reste historisé mais n’est plus considéré comme prestataire courant.
              </FieldHint>
            </div>
          </div>

          <div style={actions}>
            <Link
              to="/travaux/fournisseurs"
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
              disabled={isBusy}
              style={{
                ...primaryButton,
                opacity: isBusy ? 0.8 : 1,
                cursor: isBusy ? "not-allowed" : "pointer",
              }}
            >
              {saving
                ? "Enregistrement..."
                : isEdit
                  ? "Enregistrer les modifications"
                  : "Créer le fournisseur"}
            </button>
          </div>
        </form>
      ) : null}

      <style>{`
        @media (max-width: 900px) {
          .travaux-fournisseur-form-info-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }

          .travaux-fournisseur-form-grid {
            grid-template-columns: 1fr !important;
          }
        }

        @media (max-width: 680px) {
          .travaux-fournisseur-form-info-grid {
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

const infoGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
  gap: 14,
};

const grid2: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
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

const selectInput: CSSProperties = {
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
  marginTop: 16,
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