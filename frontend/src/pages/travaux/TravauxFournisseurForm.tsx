import {
  useCallback,
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
type FlashKind = "success" | "error" | "info";
type BadgeKind = "neutral" | "success" | "warning" | "danger" | "info";
type ButtonVariant = "primary" | "secondary" | "danger";

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

type FormErrors = Partial<Record<keyof FormValues, string>>;

const INITIAL_VALUES: FormValues = {
  nom: "",
  specialite: "",
  email: "",
  telephone: "",
  adresse: "",
  identifiant: "",
  is_active: true,
};

function getTone(kind: BadgeKind) {
  if (kind === "success") {
    return {
      softBg: "#ecfdf5",
      border: "#86efac",
      text: "#166534",
      strongText: "#14532d",
    };
  }

  if (kind === "info") {
    return {
      softBg: "#eff6ff",
      border: "#93c5fd",
      text: "#1d4ed8",
      strongText: "#1e3a8a",
    };
  }

  if (kind === "warning") {
    return {
      softBg: "#fffbeb",
      border: "#fcd34d",
      text: "#92400e",
      strongText: "#78350f",
    };
  }

  if (kind === "danger") {
    return {
      softBg: "#fef2f2",
      border: "#fca5a5",
      text: "#991b1b",
      strongText: "#7f1d1d",
    };
  }

  return {
    softBg: "#f9fafb",
    border: "#e5e7eb",
    text: "#4b5563",
    strongText: "#111827",
  };
}

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

function getActifKind(value: boolean): BadgeKind {
  return value ? "success" : "warning";
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
    if (typeof data.detail === "string" && data.detail.trim()) return data.detail;

    if (typeof data.message === "string" && data.message.trim()) return data.message;

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
      } else if (value !== null && value !== undefined) {
        fieldMessages.push(`${label} : ${JSON.stringify(value)}`);
      }
    }

    if (fieldMessages.length) {
      return fieldMessages.join("\n");
    }
  }

  return err?.message || fallback;
}

function PageShell({ children }: { children: ReactNode }) {
  return <div style={pageShell}>{children}</div>;
}

function SectionTitle(props: { title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <div style={sectionTitleWrapper}>
      <div style={sectionTitleTextBlock}>
        <div style={sectionTitle}>{props.title}</div>

        {props.subtitle ? <div style={sectionSubtitle}>{props.subtitle}</div> : null}
      </div>

      {props.right ? <div style={sectionActions}>{props.right}</div> : null}
    </div>
  );
}

function Panel(props: { children: ReactNode; style?: CSSProperties }) {
  return (
    <section
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 22,
        padding: 16,
        background: "#fff",
        boxShadow: "0 16px 40px rgba(15, 23, 42, 0.05)",
        minWidth: 0,
        ...props.style,
      }}
    >
      {props.children}
    </section>
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
        padding: 13,
        borderRadius: 14,
        background: tone.bg,
        border: `1px solid ${tone.border}`,
        color: tone.text,
        whiteSpace: "pre-wrap",
        lineHeight: 1.5,
        minWidth: 0,
      }}
    >
      {props.title ? <div style={{ fontWeight: 900, marginBottom: 4 }}>{props.title}</div> : null}
      <div style={{ fontSize: 12.5 }}>{props.children}</div>
    </div>
  );
}

function MutedInfoBox(props: { title?: string; children: ReactNode }) {
  return (
    <div style={mutedInfoBox}>
      {props.title ? <div style={mutedInfoTitle}>{props.title}</div> : null}
      <div style={mutedInfoText}>{props.children}</div>
    </div>
  );
}

function AppButton(props: {
  children: ReactNode;
  to?: string;
  onClick?: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
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
          padding: "9px 13px",
          fontSize: 12.5,
          fontWeight: 800,
          textDecoration: "none",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
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
        padding: "9px 13px",
        fontSize: 12.5,
        fontWeight: 800,
        cursor: props.disabled ? "not-allowed" : "pointer",
        whiteSpace: "nowrap",
      }}
    >
      {props.children}
    </button>
  );
}

function RequiredMark() {
  return <span style={requiredMark}>*</span>;
}

function Badge(props: { text: string; kind?: BadgeKind }) {
  const tone = getTone(props.kind ?? "neutral");

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: 26,
        padding: "4px 10px",
        borderRadius: 999,
        fontSize: 11.5,
        fontWeight: 800,
        whiteSpace: "nowrap",
        border: `1px solid ${tone.border}`,
        background: tone.softBg,
        color: tone.text,
      }}
    >
      {props.text}
    </span>
  );
}

function InfoCard(props: { title: string; children: ReactNode; kind?: BadgeKind }) {
  const tone = getTone(props.kind ?? "neutral");

  return (
    <div
      style={{
        border: `1px solid ${tone.border}`,
        borderRadius: 15,
        padding: 12,
        background: tone.softBg,
        minWidth: 0,
      }}
    >
      <div style={{ ...infoCardTitle, color: tone.text }}>{props.title}</div>
      <div
        style={{
          fontSize: 13,
          fontWeight: 800,
          color: tone.strongText,
          lineHeight: 1.4,
          minWidth: 0,
          overflowWrap: "anywhere",
        }}
      >
        {props.children}
      </div>
    </div>
  );
}

function FieldHint(props: { children: ReactNode }) {
  return <div style={hint}>{props.children}</div>;
}

function FieldError(props: { children: ReactNode }) {
  return <div style={fieldError}>{props.children}</div>;
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
  const [fieldErrors, setFieldErrors] = useState<FormErrors>({});

  const fetchFournisseur = useCallback(async () => {
    if (!isEdit || !id) return;

    setState("loading");
    setError(null);
    setSuccess(null);

    try {
      const { data } = await api.get<FournisseurResponse>(
        ENDPOINTS.travauxFournisseurDetail(id),
      );

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
      setError(getErrorMessage(e, "Impossible de charger ce prestataire."));
    }
  }, [id, isEdit]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchFournisseur();
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [fetchFournisseur]);

  const pageTitle = useMemo(
    () => (isEdit ? "Modifier le prestataire" : "Nouveau prestataire"),
    [isEdit],
  );

  const pageSubtitle = useMemo(
    () =>
      isEdit
        ? "Mettez à jour les informations du prestataire pour maintenir un référentiel fiable et exploitable."
        : "Renseignez les informations pour enregistrer un nouveau prestataire dans le module Travaux.",
    [isEdit],
  );

  const updateField = useCallback(<K extends keyof FormValues>(field: K, value: FormValues[K]) => {
    setValues((prev) => ({ ...prev, [field]: value }));
    setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
  }, []);

  const resetForm = useCallback(() => {
    setValues(INITIAL_VALUES);
    setFieldErrors({});
    setError(null);
    setSuccess(null);
  }, []);

  const buildPayload = useCallback((): FournisseurPayload => {
    return {
      nom: values.nom.trim(),
      specialite: values.specialite.trim(),
      email: normalizeEmail(values.email),
      telephone: values.telephone.trim(),
      adresse: values.adresse.trim(),
      identifiant: values.identifiant.trim(),
      is_active: Boolean(values.is_active),
    };
  }, [values]);

  const validate = useCallback((payload: FournisseurPayload) => {
    const nextErrors: FormErrors = {};

    if (!payload.nom) {
      nextErrors.nom = "Ce champ est obligatoire.";
    } else if (payload.nom.length < 2) {
      nextErrors.nom = "Le nom doit contenir au moins 2 caractères.";
    }

    if (payload.email) {
      const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email);

      if (!ok) nextErrors.email = "L’adresse email n’est pas valide.";
    }

    return nextErrors;
  }, []);

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      setError(null);
      setSuccess(null);

      const payload = buildPayload();
      const validationErrors = validate(payload);

      setFieldErrors(validationErrors);

      if (Object.keys(validationErrors).length > 0) {
        setError(
          isEdit
            ? "Corrigez les champs signalés avant de mettre à jour le prestataire."
            : "Corrigez les champs signalés avant de créer le prestataire.",
        );
        return;
      }

      setSaving(true);

      try {
        if (isEdit && id) {
          await api.patch(ENDPOINTS.travauxFournisseurDetail(id), payload);
          setSuccess("Le prestataire a bien été mis à jour.");
        } else {
          await api.post(ENDPOINTS.travauxFournisseurs, payload);
          setSuccess("Le prestataire a bien été créé.");
          setValues(INITIAL_VALUES);
          setFieldErrors({});
        }

        window.setTimeout(() => {
          navigate("/travaux/fournisseurs");
        }, 700);
      } catch (e) {
        setError(
          getErrorMessage(
            e,
            isEdit
              ? "Impossible de modifier ce prestataire."
              : "Impossible d’enregistrer ce prestataire.",
          ),
        );
      } finally {
        setSaving(false);
      }
    },
    [buildPayload, id, isEdit, navigate, validate],
  );

  const isBusy = state === "loading" || saving;
  const canShowForm = !isEdit || state === "success";

  return (
    <PageShell>
      <SectionTitle
        title={pageTitle}
        subtitle={pageSubtitle}
        right={
          <AppButton to="/travaux/fournisseurs" variant="secondary">
            Retour aux prestataires
          </AppButton>
        }
      />

      {state === "loading" ? (
        <AlertBox kind="info" title="Chargement du formulaire">
          Récupération des informations du prestataire en cours.
        </AlertBox>
      ) : null}

      {error ? (
        <AlertBox kind="error" title={isEdit ? "Mise à jour impossible" : "Enregistrement impossible"}>
          {error}
        </AlertBox>
      ) : null}

      {success ? (
        <AlertBox kind="success" title="Opération réussie">
          {success}
        </AlertBox>
      ) : null}

      {isEdit && loaded ? (
        <Panel style={{ paddingTop: 14, paddingBottom: 14 }}>
          <div style={summaryHeader}>
            <div style={summaryTitle}>Synthèse du prestataire</div>
            <Badge text={humanizeActif(values.is_active)} kind={getActifKind(values.is_active)} />
          </div>

          <div style={infoGrid} className="travaux-fournisseur-form-info-grid">
            <InfoCard title="ID prestataire" kind="neutral">
              #{loaded.id}
            </InfoCard>

            <InfoCard title="Créé le" kind="neutral">
              {fmtDateTime(loaded.created_at)}
            </InfoCard>

            <InfoCard title="Mis à jour le" kind="neutral">
              {fmtDateTime(loaded.updated_at)}
            </InfoCard>

            <InfoCard title="État" kind={getActifKind(values.is_active)}>
              <Badge text={humanizeActif(values.is_active)} kind={getActifKind(values.is_active)} />
            </InfoCard>
          </div>
        </Panel>
      ) : null}

      {state === "error" && isEdit ? (
        <Panel>
          <div style={blockedText}>
            Le formulaire ne peut pas être affiché tant que le chargement du prestataire n’a pas
            abouti.
          </div>
        </Panel>
      ) : null}

      {canShowForm ? (
        <Panel>
          <form onSubmit={handleSubmit}>
            <div style={requiredInfo}>
              Les champs marqués d’un <span style={requiredMark}>*</span> sont obligatoires.
            </div>

            <div style={grid2} className="travaux-fournisseur-form-grid">
              <div style={field}>
                <label style={label}>
                  Nom du prestataire <RequiredMark />
                </label>

                <input
                  value={values.nom}
                  onChange={(e) => updateField("nom", e.target.value)}
                  style={fieldErrors.nom ? inputError : input}
                  placeholder="Ex. ETS TOITURE PRO"
                  disabled={isBusy}
                  aria-invalid={Boolean(fieldErrors.nom)}
                />

                {fieldErrors.nom ? <FieldError>{fieldErrors.nom}</FieldError> : null}

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

                <FieldHint>
                  Champ optionnel utile pour filtrer et retrouver rapidement le prestataire.
                </FieldHint>
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
                  style={fieldErrors.email ? inputError : input}
                  placeholder="Ex. contact@prestataire.ci"
                  disabled={isBusy}
                  aria-invalid={Boolean(fieldErrors.email)}
                />

                {fieldErrors.email ? <FieldError>{fieldErrors.email}</FieldError> : null}
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
                  Champ secondaire utile pour l’exploitation, le contrôle ou une future montée en
                  gamme du module.
                </FieldHint>
              </div>

              <div style={{ ...field, gridColumn: "1 / -1" }}>
                <label style={label}>État du prestataire</label>

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
                  Un prestataire inactif reste historisé mais n’est plus utilisé dans les nouveaux
                  dossiers.
                </FieldHint>
              </div>
            </div>

            <div style={actions}>
              {!isEdit ? (
                <AppButton onClick={resetForm} variant="secondary" disabled={isBusy}>
                  Réinitialiser
                </AppButton>
              ) : (
                <AppButton to="/travaux/fournisseurs" variant="secondary" disabled={saving}>
                  Annuler
                </AppButton>
              )}

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
                    : "Créer le prestataire"}
              </button>
            </div>
          </form>
        </Panel>
      ) : null}

      <MutedInfoBox title="Lecture métier">
        Ce formulaire gère les informations principales d’un prestataire intervenant sur les travaux.
        Les liaisons avec les dossiers pourront être enrichies sans modifier cette fiche.
      </MutedInfoBox>

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

const pageShell: CSSProperties = {
  display: "grid",
  gap: 14,
  width: "100%",
  minWidth: 0,
};

const sectionTitleWrapper: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 16,
  flexWrap: "wrap",
  alignItems: "flex-end",
  minWidth: 0,
};

const sectionTitleTextBlock: CSSProperties = {
  minWidth: 280,
};

const sectionTitle: CSSProperties = {
  fontSize: 30,
  fontWeight: 900,
  letterSpacing: -0.5,
  color: "#111827",
  lineHeight: 1.08,
};

const sectionSubtitle: CSSProperties = {
  marginTop: 6,
  color: "#6b7280",
  fontSize: 13,
  lineHeight: 1.55,
  maxWidth: 860,
};

const sectionActions: CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  minWidth: 0,
};

const mutedInfoBox: CSSProperties = {
  padding: "11px 12px",
  borderRadius: 12,
  background: "#eff6ff",
  border: "1px solid #bfdbfe",
  color: "#1d4ed8",
  minWidth: 0,
};

const mutedInfoTitle: CSSProperties = {
  fontSize: 12.5,
  fontWeight: 800,
  marginBottom: 3,
};

const mutedInfoText: CSSProperties = {
  fontSize: 11.5,
  lineHeight: 1.5,
};

const infoCardTitle: CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  marginBottom: 7,
  textTransform: "uppercase",
  letterSpacing: 0.32,
};

const summaryHeader: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
  alignItems: "center",
  marginBottom: 10,
  minWidth: 0,
};

const summaryTitle: CSSProperties = {
  fontSize: 14.5,
  fontWeight: 900,
  color: "#111827",
};

const blockedText: CSSProperties = {
  color: "#6b7280",
  fontSize: 14,
  lineHeight: 1.6,
};

const infoGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
  gap: 10,
  minWidth: 0,
};

const grid2: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 12,
  minWidth: 0,
};

const field: CSSProperties = {
  display: "grid",
  gap: 7,
  minWidth: 0,
};

const label: CSSProperties = {
  fontSize: 13,
  fontWeight: 800,
  color: "#374151",
};

const hint: CSSProperties = {
  fontSize: 11.5,
  color: "#7b8494",
  lineHeight: 1.45,
};

const fieldError: CSSProperties = {
  fontSize: 12,
  color: "#b91c1c",
  lineHeight: 1.45,
  fontWeight: 700,
};

const requiredMark: CSSProperties = {
  color: "#dc2626",
  fontWeight: 900,
  marginLeft: 4,
};

const requiredInfo: CSSProperties = {
  marginBottom: 14,
  padding: "9px 12px",
  borderRadius: 12,
  background: "#fffbeb",
  border: "1px solid #fde68a",
  color: "#92400e",
  fontSize: 12.5,
  lineHeight: 1.5,
};

const input: CSSProperties = {
  width: "100%",
  padding: "11px 12px",
  borderRadius: 12,
  border: "1px solid #e5e7eb",
  background: "#fff",
  color: "#111827",
  fontSize: 14,
  boxSizing: "border-box",
};

const inputError: CSSProperties = {
  ...input,
  border: "1px solid #fca5a5",
  background: "#fffafa",
};

const selectInput: CSSProperties = {
  width: "100%",
  padding: "11px 12px",
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
  marginTop: 8,
};

const primaryButton: CSSProperties = {
  border: "1px solid #c7d2fe",
  background: "#eef2ff",
  color: "#3730a3",
  borderRadius: 12,
  padding: "10px 15px",
  fontSize: 13.5,
  fontWeight: 800,
};