// frontend/src/pages/platform-admin/PlatformCoproprieteForm.tsx
import type { CSSProperties, FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import api from "../../api/axios";
import { ENDPOINTS } from "../../api/endpoints";

type FormState = {
  nom: string;
  adresse: string;
  ville: string;
  pays: string;
  description: string;
  telephone: string;
  email_contact: string;
  statut: "ACTIVE" | "SUSPENDUE" | "ARCHIVEE";
  is_active: boolean;
};

const initialForm: FormState = {
  nom: "",
  adresse: "",
  ville: "Abidjan",
  pays: "Côte d'Ivoire",
  description: "",
  telephone: "",
  email_contact: "",
  statut: "ACTIVE",
  is_active: true,
};

const styles: Record<string, CSSProperties> = {
  page: {
    display: "flex",
    flexDirection: "column",
    gap: 24,
    width: "100%",
  },
  shell: {
    overflow: "hidden",
    border: "1px solid #e2e8f0",
    borderRadius: 32,
    background: "#ffffff",
    boxShadow: "0 24px 80px rgba(15, 23, 42, 0.08)",
  },
  hero: {
    padding: 32,
    color: "#ffffff",
    background:
      "linear-gradient(135deg, #020617 0%, #312e81 48%, #0369a1 100%)",
  },
  heroTop: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 24,
  },
  eyebrow: {
    margin: 0,
    color: "#bfdbfe",
    fontSize: 12,
    fontWeight: 900,
    letterSpacing: "0.22em",
    textTransform: "uppercase",
  },
  title: {
    margin: "12px 0 0",
    fontSize: 36,
    lineHeight: 1.05,
    fontWeight: 950,
    letterSpacing: "-0.04em",
  },
  heroText: {
    maxWidth: 820,
    margin: "14px 0 0",
    color: "rgba(239, 246, 255, 0.92)",
    fontSize: 14,
    lineHeight: 1.8,
  },
  actions: {
    display: "flex",
    flexWrap: "wrap",
    gap: 10,
  },
  heroButtonSecondary: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 42,
    padding: "0 16px",
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.25)",
    background: "rgba(255,255,255,0.10)",
    color: "#ffffff",
    fontSize: 13,
    fontWeight: 850,
    textDecoration: "none",
    boxShadow: "0 10px 24px rgba(15,23,42,0.12)",
  },
  heroButtonPrimary: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 42,
    padding: "0 16px",
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.80)",
    background: "#ffffff",
    color: "#0f172a",
    fontSize: 13,
    fontWeight: 900,
    textDecoration: "none",
    boxShadow: "0 12px 30px rgba(15,23,42,0.18)",
  },
  heroGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
    gap: 12,
    marginTop: 30,
  },
  heroInfoCard: {
    border: "1px solid rgba(255,255,255,0.16)",
    borderRadius: 24,
    padding: 18,
    background: "rgba(255,255,255,0.10)",
    backdropFilter: "blur(12px)",
  },
  heroInfoLabel: {
    margin: 0,
    color: "#bfdbfe",
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
  },
  heroInfoValue: {
    margin: "10px 0 0",
    color: "#ffffff",
    fontSize: 18,
    fontWeight: 950,
    lineHeight: 1.25,
  },
  heroInfoHint: {
    margin: "8px 0 0",
    color: "rgba(219,234,254,0.88)",
    fontSize: 12,
    lineHeight: 1.6,
  },
  content: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) 340px",
    gap: 20,
    padding: 24,
    background: "#f8fafc",
  },
  formCard: {
    overflow: "hidden",
    border: "1px solid #e2e8f0",
    borderRadius: 28,
    background: "#ffffff",
    boxShadow: "0 16px 45px rgba(15,23,42,0.05)",
  },
  cardHeader: {
    padding: 22,
    borderBottom: "1px solid #f1f5f9",
  },
  cardEyebrow: {
    margin: 0,
    color: "#4f46e5",
    fontSize: 11,
    fontWeight: 950,
    letterSpacing: "0.14em",
    textTransform: "uppercase",
  },
  cardTitle: {
    margin: "8px 0 0",
    color: "#020617",
    fontSize: 20,
    fontWeight: 950,
    letterSpacing: "-0.03em",
  },
  cardSubtitle: {
    margin: "8px 0 0",
    color: "#64748b",
    fontSize: 13,
    lineHeight: 1.7,
  },
  formBody: {
    padding: 22,
  },
  section: {
    border: "1px solid #e2e8f0",
    borderRadius: 24,
    padding: 18,
    background: "#ffffff",
  },
  sectionSoft: {
    border: "1px solid #dbeafe",
    borderRadius: 24,
    padding: 18,
    background: "#eff6ff",
  },
  sectionTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: 15,
    fontWeight: 950,
    letterSpacing: "-0.02em",
  },
  sectionText: {
    margin: "6px 0 0",
    color: "#64748b",
    fontSize: 12,
    lineHeight: 1.7,
  },
  gridTwo: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 16,
    marginTop: 18,
  },
  gridOne: {
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: 16,
    marginTop: 18,
  },
  field: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  label: {
    color: "#334155",
    fontSize: 13,
    fontWeight: 850,
  },
  required: {
    color: "#dc2626",
    fontWeight: 950,
  },
  input: {
    width: "100%",
    minHeight: 46,
    borderRadius: 16,
    border: "1px solid #dbe3ef",
    background: "#ffffff",
    padding: "0 14px",
    color: "#0f172a",
    fontSize: 14,
    outline: "none",
    boxShadow: "0 1px 0 rgba(15,23,42,0.02)",
  },
  textarea: {
    width: "100%",
    minHeight: 104,
    resize: "vertical",
    borderRadius: 16,
    border: "1px solid #dbe3ef",
    background: "#ffffff",
    padding: "13px 14px",
    color: "#0f172a",
    fontSize: 14,
    lineHeight: 1.6,
    outline: "none",
    boxShadow: "0 1px 0 rgba(15,23,42,0.02)",
  },
  select: {
    width: "100%",
    minHeight: 46,
    borderRadius: 16,
    border: "1px solid #dbe3ef",
    background: "#ffffff",
    padding: "0 14px",
    color: "#0f172a",
    fontSize: 14,
    outline: "none",
  },
  helpText: {
    margin: 0,
    color: "#94a3b8",
    fontSize: 12,
    lineHeight: 1.5,
  },
  error: {
    marginBottom: 18,
    border: "1px solid #fecaca",
    borderRadius: 18,
    background: "#fef2f2",
    padding: 14,
    color: "#b91c1c",
    fontSize: 13,
    fontWeight: 700,
  },
  formFooter: {
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 14,
    marginTop: 20,
    paddingTop: 20,
    borderTop: "1px solid #f1f5f9",
  },
  footerHint: {
    margin: 0,
    color: "#64748b",
    fontSize: 12,
    lineHeight: 1.6,
  },
  footerActions: {
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "flex-end",
    gap: 10,
  },
  buttonNeutral: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 42,
    padding: "0 16px",
    borderRadius: 16,
    border: "1px solid #e2e8f0",
    background: "#ffffff",
    color: "#334155",
    fontSize: 13,
    fontWeight: 850,
    textDecoration: "none",
    cursor: "pointer",
  },
  buttonPrimary: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 42,
    padding: "0 18px",
    borderRadius: 16,
    border: "1px solid #4f46e5",
    background: "#4f46e5",
    color: "#ffffff",
    fontSize: 13,
    fontWeight: 900,
    textDecoration: "none",
    cursor: "pointer",
    boxShadow: "0 12px 28px rgba(79,70,229,0.22)",
  },
  side: {
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },
  sideCard: {
    border: "1px solid #e2e8f0",
    borderRadius: 26,
    background: "#ffffff",
    padding: 20,
    boxShadow: "0 16px 45px rgba(15,23,42,0.05)",
  },
  sideCardBlue: {
    border: "1px solid #c7d2fe",
    borderRadius: 26,
    background: "#eef2ff",
    padding: 20,
  },
  sideCardGreen: {
    border: "1px solid #bbf7d0",
    borderRadius: 26,
    background: "#ecfdf5",
    padding: 20,
  },
  sideEyebrow: {
    margin: 0,
    color: "#64748b",
    fontSize: 11,
    fontWeight: 950,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
  },
  sideTitle: {
    margin: "8px 0 0",
    color: "#0f172a",
    fontSize: 17,
    fontWeight: 950,
    letterSpacing: "-0.02em",
  },
  sideText: {
    margin: "10px 0 0",
    color: "#475569",
    fontSize: 13,
    lineHeight: 1.7,
  },
  statusBadge: {
    display: "inline-flex",
    alignItems: "center",
    minHeight: 30,
    padding: "0 12px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 950,
    whiteSpace: "nowrap",
  },
  checklist: {
    display: "grid",
    gap: 10,
    marginTop: 16,
  },
  checklistItem: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    borderBottom: "1px solid rgba(148,163,184,0.20)",
    paddingBottom: 10,
  },
  checklistLabel: {
    color: "#64748b",
    fontSize: 13,
  },
  checklistValue: {
    color: "#0f172a",
    fontSize: 13,
    fontWeight: 950,
  },
  loadingCard: {
    border: "1px solid #e2e8f0",
    borderRadius: 28,
    background: "#ffffff",
    padding: 28,
    color: "#64748b",
    fontSize: 14,
    fontWeight: 750,
    boxShadow: "0 16px 45px rgba(15,23,42,0.05)",
  },
};

function getErrorMessage(error: unknown): string {
  if (error && typeof error === "object" && "response" in error) {
    const response = (error as { response?: { data?: unknown } }).response;
    const data = response?.data;

    if (typeof data === "string") return data;

    if (data && typeof data === "object") {
      const maybeDetail = data as { detail?: unknown; message?: unknown };

      if (typeof maybeDetail.detail === "string") return maybeDetail.detail;
      if (typeof maybeDetail.message === "string") return maybeDetail.message;

      return JSON.stringify(data);
    }
  }

  if (error instanceof Error) return error.message;

  return "Une erreur est survenue pendant l’enregistrement.";
}

function statusLabel(value: FormState["statut"]): string {
  if (value === "ACTIVE") return "Active";
  if (value === "SUSPENDUE") return "Suspendue";
  return "Archivée";
}

function statusDescription(value: FormState["statut"]): string {
  if (value === "ACTIVE") {
    return "La copropriété peut être exploitée par les modules métier.";
  }

  if (value === "SUSPENDUE") {
    return "La copropriété reste visible mais son exploitation doit être surveillée.";
  }

  return "La copropriété sort de l’exploitation courante.";
}

function statusBadgeStyle(value: FormState["statut"]): CSSProperties {
  if (value === "ACTIVE") {
    return {
      ...styles.statusBadge,
      border: "1px solid #bbf7d0",
      background: "#ecfdf5",
      color: "#047857",
    };
  }

  if (value === "SUSPENDUE") {
    return {
      ...styles.statusBadge,
      border: "1px solid #fde68a",
      background: "#fffbeb",
      color: "#b45309",
    };
  }

  return {
    ...styles.statusBadge,
    border: "1px solid #e2e8f0",
    background: "#f1f5f9",
    color: "#475569",
  };
}

function isValidEmail(value: string): boolean {
  if (!value.trim()) return true;

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export default function PlatformCoproprieteForm() {
  const { id } = useParams();
  const navigate = useNavigate();

  const isEdit = Boolean(id);

  const [form, setForm] = useState<FormState>(initialForm);
  const [loading, setLoading] = useState(Boolean(id));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const canSubmit = useMemo(() => {
    return form.nom.trim().length > 0 && isValidEmail(form.email_contact);
  }, [form.email_contact, form.nom]);

  const completion = useMemo(() => {
    const checks = [
      form.nom.trim(),
      form.ville.trim(),
      form.pays.trim(),
      form.adresse.trim(),
      form.telephone.trim(),
      form.email_contact.trim(),
    ];

    const done = checks.filter(Boolean).length;

    return Math.round((done / checks.length) * 100);
  }, [form]);

  useEffect(() => {
    if (!id) return undefined;

    const coproprieteId = id;
    const timer = window.setTimeout(() => {
      async function loadData() {
        setLoading(true);
        setError("");

        try {
          const response = await api.get(ENDPOINTS.platform.coproprieteDetail(coproprieteId));
          const data = response.data as Partial<FormState>;

          setForm({
            nom: data.nom ?? "",
            adresse: data.adresse ?? "",
            ville: data.ville ?? "Abidjan",
            pays: data.pays ?? "Côte d'Ivoire",
            description: data.description ?? "",
            telephone: data.telephone ?? "",
            email_contact: data.email_contact ?? "",
            statut: data.statut ?? "ACTIVE",
            is_active: data.is_active ?? true,
          });
        } catch (err) {
          setError(getErrorMessage(err));
        } finally {
          setLoading(false);
        }
      }

      void loadData();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [id]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((previous) => ({
      ...previous,
      [key]: value,
    }));
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!form.nom.trim()) {
      setError("Le nom de la copropriété est obligatoire.");
      return;
    }

    if (!isValidEmail(form.email_contact)) {
      setError("L’adresse email de contact n’est pas valide.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const payload: FormState = {
        nom: form.nom.trim(),
        adresse: form.adresse.trim(),
        ville: form.ville.trim(),
        pays: form.pays.trim(),
        description: form.description.trim(),
        telephone: form.telephone.trim(),
        email_contact: form.email_contact.trim(),
        statut: form.statut,
        is_active: form.statut === "ACTIVE",
      };

      if (id) {
        await api.put(ENDPOINTS.platform.coproprieteDetail(id), payload);
        navigate(`/platform-admin/coproprietes/${id}`);
      } else {
        const response = await api.post(ENDPOINTS.platform.coproprietes, payload);
        const created = response.data as { id?: number };

        navigate(
          created.id
            ? `/platform-admin/coproprietes/${created.id}`
            : "/platform-admin/coproprietes",
        );
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div style={styles.loadingCard}>Chargement de la copropriété...</div>;
  }

  return (
    <div style={styles.page}>
      <section style={styles.shell}>
        <div style={styles.hero}>
          <div style={styles.heroTop}>
            <div>
              <p style={styles.eyebrow}>
                Super Admin · {isEdit ? "Modification" : "Création"}
              </p>
              <h1 style={styles.title}>
                {isEdit ? "Modifier la copropriété" : "Nouvelle copropriété"}
              </h1>
              <p style={styles.heroText}>
                Renseignez les informations de base nécessaires pour préparer la
                copropriété dans l’Admin React. Cette fiche servira ensuite de
                socle aux copropriétaires, lots, tantièmes et rôles locaux.
              </p>
            </div>

            <div style={styles.actions}>
              <Link
                to="/platform-admin/coproprietes"
                style={styles.heroButtonSecondary}
              >
                Retour aux copropriétés
              </Link>
              <Link to="/platform-admin" style={styles.heroButtonPrimary}>
                Administration plateforme
              </Link>
            </div>
          </div>

          <div style={styles.heroGrid}>
            <div style={styles.heroInfoCard}>
              <p style={styles.heroInfoLabel}>Mode</p>
              <p style={styles.heroInfoValue}>{isEdit ? "Édition" : "Création"}</p>
              <p style={styles.heroInfoHint}>
                {isEdit
                  ? "Mise à jour d’une copropriété existante."
                  : "Ajout d’une nouvelle copropriété cliente."}
              </p>
            </div>

            <div style={styles.heroInfoCard}>
              <p style={styles.heroInfoLabel}>Statut cible</p>
              <p style={styles.heroInfoValue}>{statusLabel(form.statut)}</p>
              <p style={styles.heroInfoHint}>{statusDescription(form.statut)}</p>
            </div>

            <div style={styles.heroInfoCard}>
              <p style={styles.heroInfoLabel}>Complétude</p>
              <p style={styles.heroInfoValue}>{completion} %</p>
              <p style={styles.heroInfoHint}>
                Niveau de renseignement de la fiche plateforme.
              </p>
            </div>
          </div>
        </div>

        <div style={styles.content}>
          <form onSubmit={(event) => void onSubmit(event)} style={styles.formCard}>
            <div style={styles.cardHeader}>
              <p style={styles.cardEyebrow}>Informations administratives</p>
              <h2 style={styles.cardTitle}>Fiche copropriété</h2>
              <p style={styles.cardSubtitle}>
                Les champs ci-dessous constituent le référentiel minimal pour
                créer une copropriété exploitable par les modules métier.
              </p>
            </div>

            <div style={styles.formBody}>
              {error ? <div style={styles.error}>{error}</div> : null}

              <div style={{ display: "grid", gap: 18 }}>
                <section style={styles.section}>
                  <h3 style={styles.sectionTitle}>Identité de la copropriété</h3>
                  <p style={styles.sectionText}>
                    Définissez le nom officiel et la localisation principale de
                    la copropriété.
                  </p>

                  <div style={styles.gridTwo}>
                    <label style={styles.field}>
                      <span style={styles.label}>
                        Nom <span style={styles.required}>*</span>
                      </span>
                      <input
                        value={form.nom}
                        onChange={(event) => update("nom", event.target.value)}
                        required
                        placeholder="Ex. Résidence Les Jardins d’Ébène"
                        style={styles.input}
                      />
                      <p style={styles.helpText}>
                        Nom visible dans l’administration et les modules métier.
                      </p>
                    </label>

                    <label style={styles.field}>
                      <span style={styles.label}>Ville</span>
                      <input
                        value={form.ville}
                        onChange={(event) => update("ville", event.target.value)}
                        placeholder="Ex. Abidjan"
                        style={styles.input}
                      />
                    </label>

                    <label style={styles.field}>
                      <span style={styles.label}>Pays</span>
                      <input
                        value={form.pays}
                        onChange={(event) => update("pays", event.target.value)}
                        placeholder="Ex. Côte d'Ivoire"
                        style={styles.input}
                      />
                    </label>

                    <label style={styles.field}>
                      <span style={styles.label}>Statut d’exploitation</span>
                      <select
                        value={form.statut}
                        onChange={(event) =>
                          update(
                            "statut",
                            event.target.value as FormState["statut"],
                          )
                        }
                        style={styles.select}
                      >
                        <option value="ACTIVE">Active</option>
                        <option value="SUSPENDUE">Suspendue</option>
                        <option value="ARCHIVEE">Archivée</option>
                      </select>
                    </label>
                  </div>
                </section>

                <section style={styles.sectionSoft}>
                  <h3 style={styles.sectionTitle}>Coordonnées & contact</h3>
                  <p style={styles.sectionText}>
                    Ces informations facilitent le suivi administratif de la
                    copropriété et sa préparation commerciale.
                  </p>

                  <div style={styles.gridTwo}>
                    <label style={styles.field}>
                      <span style={styles.label}>Téléphone</span>
                      <input
                        value={form.telephone}
                        onChange={(event) =>
                          update("telephone", event.target.value)
                        }
                        placeholder="Ex. +225 07 00 00 00 00"
                        style={styles.input}
                      />
                    </label>

                    <label style={styles.field}>
                      <span style={styles.label}>Email de contact</span>
                      <input
                        type="email"
                        value={form.email_contact}
                        onChange={(event) =>
                          update("email_contact", event.target.value)
                        }
                        placeholder="contact@copropriete.ci"
                        style={styles.input}
                      />
                      <p style={styles.helpText}>
                        Facultatif, mais recommandé pour une fiche complète.
                      </p>
                    </label>
                  </div>
                </section>

                <section style={styles.section}>
                  <h3 style={styles.sectionTitle}>Adresse & description</h3>
                  <p style={styles.sectionText}>
                    Ajoutez les informations utiles au pilotage et à la
                    compréhension du périmètre de gestion.
                  </p>

                  <div style={styles.gridOne}>
                    <label style={styles.field}>
                      <span style={styles.label}>Adresse</span>
                      <textarea
                        value={form.adresse}
                        onChange={(event) => update("adresse", event.target.value)}
                        rows={3}
                        placeholder="Adresse complète, quartier, repères..."
                        style={styles.textarea}
                      />
                    </label>

                    <label style={styles.field}>
                      <span style={styles.label}>Description</span>
                      <textarea
                        value={form.description}
                        onChange={(event) =>
                          update("description", event.target.value)
                        }
                        rows={4}
                        placeholder="Informations complémentaires : contexte, taille approximative, particularités de gestion..."
                        style={{ ...styles.textarea, minHeight: 128 }}
                      />
                    </label>
                  </div>
                </section>
              </div>

              <div style={styles.formFooter}>
                <p style={styles.footerHint}>
                  Le statut actif ouvrira la copropriété aux modules métier une
                  fois les lots, tantièmes et rôles préparés.
                </p>

                <div style={styles.footerActions}>
                  <Link to="/platform-admin/coproprietes" style={styles.buttonNeutral}>
                    Annuler
                  </Link>

                  <button
                    type="submit"
                    disabled={saving || !canSubmit}
                    style={{
                      ...styles.buttonPrimary,
                      opacity: saving || !canSubmit ? 0.65 : 1,
                      cursor: saving || !canSubmit ? "not-allowed" : "pointer",
                    }}
                  >
                    {saving
                      ? "Enregistrement..."
                      : isEdit
                        ? "Enregistrer les modifications"
                        : "Créer la copropriété"}
                  </button>
                </div>
              </div>
            </div>
          </form>

          <aside style={styles.side}>
            <div style={styles.sideCard}>
              <p style={styles.sideEyebrow}>Aperçu statut</p>
              <h2 style={styles.sideTitle}>Exploitation</h2>
              <p style={styles.sideText}>
                Le statut contrôle la disponibilité opérationnelle de la
                copropriété dans la plateforme.
              </p>

              <div style={{ marginTop: 16 }}>
                <span style={statusBadgeStyle(form.statut)}>
                  {statusLabel(form.statut)}
                </span>
              </div>

              <p style={styles.sideText}>{statusDescription(form.statut)}</p>
            </div>

            <div style={styles.sideCardBlue}>
              <p style={{ ...styles.sideEyebrow, color: "#4f46e5" }}>
                Suite logique
              </p>
              <h3 style={{ ...styles.sideTitle, color: "#312e81" }}>
                Préparer le référentiel
              </h3>
              <p style={{ ...styles.sideText, color: "#4338ca" }}>
                Après création, continuez avec les copropriétaires, les lots, les
                catégories de tantièmes et les tantièmes de lots.
              </p>
            </div>

            <div style={styles.sideCardGreen}>
              <p style={{ ...styles.sideEyebrow, color: "#047857" }}>
                Qualité de fiche
              </p>
              <h3 style={{ ...styles.sideTitle, color: "#064e3b" }}>
                Complétude : {completion} %
              </h3>

              <div style={styles.checklist}>
                <div style={styles.checklistItem}>
                  <span style={styles.checklistLabel}>Nom</span>
                  <span style={styles.checklistValue}>
                    {form.nom.trim() ? "OK" : "Requis"}
                  </span>
                </div>

                <div style={styles.checklistItem}>
                  <span style={styles.checklistLabel}>Ville / Pays</span>
                  <span style={styles.checklistValue}>
                    {form.ville.trim() && form.pays.trim() ? "OK" : "À compléter"}
                  </span>
                </div>

                <div style={styles.checklistItem}>
                  <span style={styles.checklistLabel}>Contact</span>
                  <span style={styles.checklistValue}>
                    {form.telephone.trim() || form.email_contact.trim()
                      ? "Renseigné"
                      : "Optionnel"}
                  </span>
                </div>

                <div style={{ ...styles.checklistItem, borderBottom: "none" }}>
                  <span style={styles.checklistLabel}>Email valide</span>
                  <span style={styles.checklistValue}>
                    {isValidEmail(form.email_contact) ? "OK" : "À corriger"}
                  </span>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </section>
    </div>
  );
}