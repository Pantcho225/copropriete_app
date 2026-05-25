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
type BadgeKind = "neutral" | "success" | "warning" | "danger" | "info";
type ButtonVariant = "primary" | "secondary" | "danger";
type FlashKind = "success" | "error" | "info";

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

type FormErrors = Partial<Record<keyof FormValues, string>>;

const INITIAL_VALUES: FormValues = {
  titre: "",
  description: "",
  budget_estime: "",
};

function getTone(kind: BadgeKind) {
  if (kind === "success") {
    return {
      softBg: "#ecfdf5",
      bg: "#dcfce7",
      border: "#86efac",
      strongBorder: "#22c55e",
      text: "#166534",
      strongText: "#14532d",
    };
  }

  if (kind === "info") {
    return {
      softBg: "#eff6ff",
      bg: "#dbeafe",
      border: "#93c5fd",
      strongBorder: "#3b82f6",
      text: "#1d4ed8",
      strongText: "#1e3a8a",
    };
  }

  if (kind === "warning") {
    return {
      softBg: "#fffbeb",
      bg: "#fef3c7",
      border: "#fcd34d",
      strongBorder: "#f59e0b",
      text: "#92400e",
      strongText: "#78350f",
    };
  }

  if (kind === "danger") {
    return {
      softBg: "#fef2f2",
      bg: "#fee2e2",
      border: "#fca5a5",
      strongBorder: "#ef4444",
      text: "#991b1b",
      strongText: "#7f1d1d",
    };
  }

  return {
    softBg: "#f9fafb",
    bg: "#f3f4f6",
    border: "#e5e7eb",
    strongBorder: "#d1d5db",
    text: "#4b5563",
    strongText: "#111827",
  };
}

function PageShell({ children }: { children: ReactNode }) {
  return <div style={pageShell}>{children}</div>;
}

function SectionTitle(props: { title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <div style={sectionTitleWrapper}>
      <div style={{ minWidth: 280 }}>
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

function FieldHint(props: { children: ReactNode }) {
  return <div style={hint}>{props.children}</div>;
}

function FieldError(props: { children: ReactNode }) {
  return <div style={fieldError}>{props.children}</div>;
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

function getStatutKind(statut?: string | null): BadgeKind {
  const s = normalizeStatut(statut);

  if (s === "VALIDE" || s === "TERMINE") return "success";
  if (s === "EN_COURS") return "info";
  if (s === "SOUMIS_AG") return "warning";
  if (s === "BROUILLON" || s === "ARCHIVE") return "neutral";

  return "neutral";
}

function getMoneyKind(
  value?: string | number | null,
  mode: "paid" | "remaining" | "neutral" = "neutral",
): BadgeKind {
  const num = value === null || value === undefined || value === "" ? null : Number(value);

  if (num === null || Number.isNaN(num)) return "neutral";

  if (mode === "paid") return num > 0 ? "success" : "neutral";
  if (mode === "remaining") return num > 0 ? "warning" : "success";

  return "neutral";
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

  return (
    Boolean(data.is_locked) ||
    Boolean(data.locked) ||
    Boolean(data.verrouille) ||
    Boolean(data.locked_at)
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
      <div style={infoCardTitle}>{props.title}</div>
      <div style={{ fontSize: 13, fontWeight: 800, color: tone.strongText, lineHeight: 1.4 }}>
        {props.children}
      </div>
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
  const [fieldErrors, setFieldErrors] = useState<FormErrors>({});
  const [loaded, setLoaded] = useState<DossierTravauxResponse | null>(null);

  const fetchDossier = useCallback(async () => {
    if (!isEdit || !dossierId) return;

    setState("loading");
    setError(null);
    setSuccess(null);

    try {
      const { data } = await api.get<DossierTravauxResponse>(
        ENDPOINTS.travauxDossierDetail(dossierId),
      );

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
      setError(getErrorMessage(e, "Impossible de charger ce dossier de travaux."));
    }
  }, [isEdit, dossierId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchDossier();
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [fetchDossier]);

  const pageTitle = useMemo(
    () => (isEdit ? "Modifier le dossier de travaux" : "Nouveau dossier de travaux"),
    [isEdit],
  );

  const pageSubtitle = useMemo(
    () =>
      isEdit
        ? "Mettez à jour les informations générales du dossier sélectionné. Les données budgétaires avancées, la validation AG et le verrouillage restent pilotés par le flux métier."
        : "Renseignez les informations utiles pour enregistrer un nouveau dossier dans le module Travaux.",
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

  const buildPayload = useCallback((): DossierTravauxPayload => {
    const rawBudget = normalizeDecimalInput(values.budget_estime.trim());

    return {
      titre: values.titre.trim(),
      description: values.description.trim(),
      budget_estime: Number(rawBudget),
    };
  }, [values]);

  const validate = useCallback(
    (payload: DossierTravauxPayload) => {
      const nextErrors: FormErrors = {};

      if (!payload.titre) {
        nextErrors.titre = "Ce champ est obligatoire.";
      } else if (payload.titre.length < 3) {
        nextErrors.titre = "Le titre doit contenir au moins 3 caractères.";
      }

      if (!values.budget_estime.trim()) {
        nextErrors.budget_estime = "Ce champ est obligatoire.";
      } else if (Number.isNaN(payload.budget_estime)) {
        nextErrors.budget_estime = "Saisissez un montant valide.";
      } else if (payload.budget_estime < 0) {
        nextErrors.budget_estime = "Le budget ne peut pas être négatif.";
      }

      return nextErrors;
    },
    [values.budget_estime],
  );

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
            ? "Corrigez les champs signalés avant d’enregistrer les modifications."
            : "Corrigez les champs signalés avant de créer le dossier.",
        );
        return;
      }

      setSaving(true);

      try {
        let savedId = dossierId;

        if (isEdit && dossierId) {
          await api.patch(ENDPOINTS.travauxDossierDetail(dossierId), payload);
          setSuccess("Le dossier de travaux a bien été mis à jour.");
        } else {
          const { data } = await api.post<DossierTravauxResponse>(
            ENDPOINTS.travauxDossiers,
            payload,
          );

          savedId = data?.id ? String(data.id) : undefined;
          setSuccess("Le dossier de travaux a bien été créé.");
          setValues(INITIAL_VALUES);
          setFieldErrors({});
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
            isEdit
              ? "Impossible de modifier ce dossier de travaux."
              : "Impossible d’enregistrer ce dossier de travaux.",
          ),
        );
      } finally {
        setSaving(false);
      }
    },
    [buildPayload, dossierId, isEdit, navigate, validate],
  );

  const isBusy = state === "loading" || saving;
  const isLocked = extractLocked(loaded);
  const canShowForm = !isEdit || state === "success";

  const titreInputStyle = fieldErrors.titre ? inputError : input;
  const budgetInputStyle = fieldErrors.budget_estime ? inputError : input;

  return (
    <PageShell>
      <SectionTitle
        title={pageTitle}
        subtitle={pageSubtitle}
        right={
          <>
            <AppButton to="/travaux/dossiers" variant="secondary">
              Retour aux dossiers
            </AppButton>

            {isEdit && dossierId ? (
              <AppButton to={`/travaux/dossiers/${dossierId}`} variant="secondary">
                Ouvrir le dossier
              </AppButton>
            ) : null}
          </>
        }
      />

      {state === "loading" ? (
        <AlertBox kind="info" title="Chargement du formulaire">
          Récupération des informations du dossier en cours.
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
            <div style={summaryTitle}>Synthèse du dossier</div>

            <Badge
              text={humanizeStatut(String(loaded.statut ?? ""))}
              kind={getStatutKind(String(loaded.statut ?? ""))}
            />
          </div>

          <div style={infoGrid} className="travaux-form-info-grid">
            <InfoCard title="Budget estimé" kind="neutral">
              {fmtMoney(loaded.budget_estime)}
            </InfoCard>

            <InfoCard title="Budget voté" kind="neutral">
              {fmtMoney(loaded.budget_vote)}
            </InfoCard>

            <InfoCard title="Budget de référence" kind="neutral">
              {fmtMoney(loaded.budget_reference)}
            </InfoCard>

            <InfoCard title="Total payé" kind={getMoneyKind(loaded.total_paye, "paid")}>
              {fmtMoney(loaded.total_paye)}
            </InfoCard>

            <InfoCard title="Reste à payer" kind={getMoneyKind(loaded.reste_a_payer, "remaining")}>
              {fmtMoney(loaded.reste_a_payer)}
            </InfoCard>

            <InfoCard title="Verrouillage" kind={isLocked ? "success" : "warning"}>
              <Badge
                text={isLocked ? "Dossier verrouillé" : "Dossier non verrouillé"}
                kind={isLocked ? "success" : "warning"}
              />
            </InfoCard>

            <InfoCard title="Créé le" kind="neutral">
              {fmtDateTime(loaded.created_at)}
            </InfoCard>

            <InfoCard title="Mis à jour le" kind="neutral">
              {fmtDateTime(loaded.updated_at)}
            </InfoCard>

            <InfoCard
              title="Résolution liée"
              kind={loaded.resolution_validation_id ?? loaded.resolution_validation ? "info" : "neutral"}
            >
              {loaded.resolution_validation_id ?? loaded.resolution_validation ?? "—"}
            </InfoCard>
          </div>
        </Panel>
      ) : null}

      {isEdit && isLocked ? (
        <AlertBox kind="info" title="Modification non disponible">
          Ce dossier est verrouillé. La fiche reste consultable, mais la modification standard n’est
          plus autorisée.
        </AlertBox>
      ) : null}

      {state === "error" && isEdit ? (
        <Panel>
          <div style={blockedText}>
            Le formulaire ne peut pas être affiché tant que le chargement du dossier n’a pas abouti.
          </div>
        </Panel>
      ) : null}

      {canShowForm ? (
        <Panel>
          <form onSubmit={handleSubmit}>
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
                  style={titreInputStyle}
                  placeholder="Ex. Réfection de la toiture"
                  disabled={isBusy || isLocked}
                  aria-invalid={Boolean(fieldErrors.titre)}
                />

                {fieldErrors.titre ? <FieldError>{fieldErrors.titre}</FieldError> : null}

                <FieldHint>Intitulé principal du dossier de travaux.</FieldHint>
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
                  style={budgetInputStyle}
                  placeholder="Ex. 1400000"
                  disabled={isBusy || isLocked}
                  aria-invalid={Boolean(fieldErrors.budget_estime)}
                />

                {fieldErrors.budget_estime ? (
                  <FieldError>{fieldErrors.budget_estime}</FieldError>
                ) : null}

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
                  Champ optionnel utile pour améliorer la lecture du dossier dans la liste et la
                  fiche détail.
                </FieldHint>
              </div>
            </div>

            <div style={actions}>
              {!isEdit ? (
                <AppButton onClick={resetForm} variant="secondary" disabled={isBusy}>
                  Réinitialiser
                </AppButton>
              ) : (
                <AppButton
                  to={isEdit && dossierId ? `/travaux/dossiers/${dossierId}` : "/travaux/dossiers"}
                  variant="secondary"
                  disabled={saving}
                >
                  Annuler
                </AppButton>
              )}

              <button
                type="submit"
                disabled={isBusy || isLocked}
                style={{
                  ...primaryButton,
                  opacity: isBusy || isLocked ? 0.8 : 1,
                  cursor: isBusy || isLocked ? "not-allowed" : "pointer",
                }}
              >
                {saving ? "Enregistrement..." : isEdit ? "Enregistrer les modifications" : "Créer le dossier"}
              </button>
            </div>
          </form>
        </Panel>
      ) : null}

      <MutedInfoBox title="Lecture métier">
        Ce formulaire gère les informations générales d’un dossier. Les montants avancés, le
        verrouillage et la validation AG restent pilotés par le flux métier global.
      </MutedInfoBox>

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

const fieldError: CSSProperties = {
  fontSize: 12,
  color: "#b91c1c",
  lineHeight: 1.45,
  fontWeight: 700,
};

const infoCardTitle: CSSProperties = {
  fontSize: 11,
  color: "#475569",
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
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: 10,
  minWidth: 0,
};

const grid1: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr",
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

const textarea: CSSProperties = {
  ...input,
  minHeight: 112,
  resize: "vertical",
};

const actions: CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  gap: 10,
  flexWrap: "wrap",
  marginTop: 6,
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