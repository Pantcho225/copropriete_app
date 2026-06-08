// frontend/src/pages/administration/ReglementTextesApplicables.tsx
import type { CSSProperties, FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";

import {
  archiverReglementTexteApplicable,
  createReglementTexteApplicable,
  getReglementTextesApplicables,
  masquerReglementTexteApplicable,
  publierReglementTexteApplicable,
  rendreVisibleReglementTexteApplicable,
  updateReglementTexteApplicable,
  type ReglementTexteApplicable,
  type ReglementTexteCategorie,
  type ReglementTexteFilters,
  type ReglementTextePayload,
  type ReglementTexteStatut,
} from "../../api/reglementTextes";

type FormState = {
  id: number | null;
  titre: string;
  categorie: ReglementTexteCategorie;
  resume: string;
  contenu: string;
  statut: ReglementTexteStatut;
  visible_coproprietaire: boolean;
  ordre_affichage: string;
  fichier: File | null;
};

const EMPTY_FORM: FormState = {
  id: null,
  titre: "",
  categorie: "REGLEMENT_INTERIEUR",
  resume: "",
  contenu: "",
  statut: "BROUILLON",
  visible_coproprietaire: false,
  ordre_affichage: "10",
  fichier: null,
};

const CATEGORIES: Array<{
  value: ReglementTexteCategorie | "";
  label: string;
}> = [
  { value: "", label: "Toutes les catégories" },
  { value: "REGLEMENT_COPROPRIETE", label: "Règlement de copropriété" },
  { value: "REGLEMENT_INTERIEUR", label: "Règlement intérieur" },
  { value: "TEXTE_LOI", label: "Texte de loi" },
  { value: "NOTE_SYNDIC", label: "Note syndic" },
  { value: "VIE_COMMUNE", label: "Vie commune" },
  { value: "CHARGES_COTISATIONS", label: "Charges & cotisations" },
  { value: "ASSEMBLEES_GENERALES", label: "Assemblées générales" },
  { value: "TRAVAUX_ENTRETIEN", label: "Travaux & entretien" },
  { value: "DOCUMENT_ADMINISTRATIF", label: "Document administratif" },
  { value: "AUTRE", label: "Autre" },
];

const STATUTS: Array<{
  value: ReglementTexteStatut | "";
  label: string;
}> = [
  { value: "", label: "Tous les statuts" },
  { value: "BROUILLON", label: "Brouillon" },
  { value: "PUBLIE", label: "Publié" },
  { value: "ARCHIVE", label: "Archivé" },
];

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Une erreur est survenue.";
}

function formatDate(value: string | null | undefined) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function getStatutTone(statut: string) {
  if (statut === "PUBLIE") {
    return styles.badgeGreen;
  }

  if (statut === "ARCHIVE") {
    return styles.badgeSlate;
  }

  return styles.badgeAmber;
}

function toPayload(form: FormState): ReglementTextePayload {
  return {
    titre: form.titre.trim(),
    categorie: form.categorie,
    resume: form.resume.trim(),
    contenu: form.contenu.trim(),
    statut: form.statut,
    visible_coproprietaire: form.visible_coproprietaire,
    ordre_affichage: Number(form.ordre_affichage || 0),
    fichier: form.fichier,
  };
}

function isFormValid(form: FormState) {
  return (
    form.titre.trim().length >= 3 &&
    form.resume.trim().length >= 10 &&
    form.contenu.trim().length >= 10
  );
}

export default function ReglementTextesApplicables() {
  const [items, setItems] = useState<ReglementTexteApplicable[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [filters, setFilters] = useState<ReglementTexteFilters>({
    categorie: "",
    statut: "",
    visible_coproprietaire: "",
    q: "",
  });

  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  async function loadItems() {
    try {
      setLoading(true);
      setError("");

      const data = await getReglementTextesApplicables(filters);

      setItems(data);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stats = useMemo(() => {
    const total = items.length;
    const publies = items.filter((item) => item.statut === "PUBLIE").length;
    const brouillons = items.filter((item) => item.statut === "BROUILLON").length;
    const archives = items.filter((item) => item.statut === "ARCHIVE").length;
    const visibles = items.filter((item) => item.visible_coproprietaire).length;

    return {
      total,
      publies,
      brouillons,
      archives,
      visibles,
    };
  }, [items]);

  function resetForm() {
    setForm(EMPTY_FORM);
  }

  function editItem(item: ReglementTexteApplicable) {
    setForm({
      id: item.id,
      titre: item.titre || "",
      categorie: item.categorie as ReglementTexteCategorie,
      resume: item.resume || "",
      contenu: item.contenu || "",
      statut: item.statut as ReglementTexteStatut,
      visible_coproprietaire: Boolean(item.visible_coproprietaire),
      ordre_affichage: String(item.ordre_affichage ?? 10),
      fichier: null,
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!isFormValid(form)) {
      setError(
        "Veuillez renseigner un titre, un résumé et un contenu suffisamment détaillés.",
      );
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const payload = toPayload(form);

      if (form.id) {
        await updateReglementTexteApplicable(form.id, payload);
        setSuccess("Texte réglementaire mis à jour avec succès.");
      } else {
        await createReglementTexteApplicable(payload);
        setSuccess("Texte réglementaire créé avec succès.");
      }

      resetForm();
      await loadItems();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function runAction(
    callback: () => Promise<ReglementTexteApplicable | unknown>,
    message: string,
  ) {
    try {
      setSaving(true);
      setError("");
      setSuccess("");

      await callback();
      setSuccess(message);
      await loadItems();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  function updateFilter<K extends keyof ReglementTexteFilters>(
    key: K,
    value: ReglementTexteFilters[K],
  ) {
    setFilters((current) => ({
      ...current,
      [key]: value,
    }));
  }

  return (
    <div style={styles.page}>
      <section style={styles.hero}>
        <div>
          <p style={styles.eyebrow}>Règlement & textes applicables</p>

          <h1 style={styles.title}>Repères réglementaires de la copropriété</h1>

          <p style={styles.subtitle}>
            Créez, publiez, archivez et rendez visibles les règles internes,
            notes syndic, textes utiles et documents de référence accessibles aux
            copropriétaires.
          </p>

          <div style={styles.heroActions}>
            <button type="button" onClick={loadItems} style={styles.secondaryButton}>
              Actualiser
            </button>

            <button type="button" onClick={resetForm} style={styles.primaryButton}>
              Nouveau texte
            </button>
          </div>
        </div>

        <div style={styles.heroCard}>
          <p style={styles.heroCardLabel}>Diffusion copropriétaire</p>
          <p style={styles.heroCardValue}>{stats.visibles}</p>
          <p style={styles.heroCardText}>
            texte(s) actuellement visibles côté copropriétaire.
          </p>
        </div>
      </section>

      <section style={styles.statsGrid}>
        <StatCard label="Total" value={stats.total} tone="blue" />
        <StatCard label="Publiés" value={stats.publies} tone="green" />
        <StatCard label="Brouillons" value={stats.brouillons} tone="amber" />
        <StatCard label="Archivés" value={stats.archives} tone="slate" />
      </section>

      {error ? (
        <div style={styles.alertDanger}>
          <strong>Erreur</strong>
          <p style={styles.alertText}>{error}</p>
        </div>
      ) : null}

      {success ? (
        <div style={styles.alertSuccess}>
          <strong>Succès</strong>
          <p style={styles.alertText}>{success}</p>
        </div>
      ) : null}

      <section style={styles.formPanel}>
        <div style={styles.sectionHeader}>
          <div>
            <p style={styles.sectionEyebrow}>
              {form.id ? "Modification" : "Création"}
            </p>
            <h2 style={styles.sectionTitle}>
              {form.id ? "Modifier un texte" : "Créer un texte réglementaire"}
            </h2>
          </div>

          {form.id ? (
            <button type="button" onClick={resetForm} style={styles.lightButton}>
              Annuler la modification
            </button>
          ) : null}
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.formGrid}>
            <label style={styles.field}>
              <span style={styles.label}>Titre</span>
              <input
                value={form.titre}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    titre: event.target.value,
                  }))
                }
                placeholder="Ex. Règlement intérieur de la résidence"
                style={styles.input}
              />
            </label>

            <label style={styles.field}>
              <span style={styles.label}>Catégorie</span>
              <select
                value={form.categorie}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    categorie: event.target.value as ReglementTexteCategorie,
                  }))
                }
                style={styles.input}
              >
                {CATEGORIES.filter((category) => category.value !== "").map(
                  (category) => (
                    <option key={category.value} value={category.value}>
                      {category.label}
                    </option>
                  ),
                )}
              </select>
            </label>

            <label style={styles.field}>
              <span style={styles.label}>Statut</span>
              <select
                value={form.statut}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    statut: event.target.value as ReglementTexteStatut,
                  }))
                }
                style={styles.input}
              >
                {STATUTS.filter((statut) => statut.value !== "").map((statut) => (
                  <option key={statut.value} value={statut.value}>
                    {statut.label}
                  </option>
                ))}
              </select>
            </label>

            <label style={styles.field}>
              <span style={styles.label}>Ordre d’affichage</span>
              <input
                type="number"
                value={form.ordre_affichage}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    ordre_affichage: event.target.value,
                  }))
                }
                min={0}
                style={styles.input}
              />
            </label>
          </div>

          <label style={styles.checkboxLine}>
            <input
              type="checkbox"
              checked={form.visible_coproprietaire}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  visible_coproprietaire: event.target.checked,
                }))
              }
            />
            <span>Rendre visible côté copropriétaire</span>
          </label>

          <label style={styles.field}>
            <span style={styles.label}>Résumé</span>
            <textarea
              value={form.resume}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  resume: event.target.value,
                }))
              }
              placeholder="Résumé court affiché dans les listes."
              rows={3}
              style={styles.textarea}
            />
          </label>

          <label style={styles.field}>
            <span style={styles.label}>Contenu</span>
            <textarea
              value={form.contenu}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  contenu: event.target.value,
                }))
              }
              placeholder="Texte complet, note syndic ou repère réglementaire."
              rows={8}
              style={styles.textarea}
            />
          </label>

          <label style={styles.field}>
            <span style={styles.label}>Document joint optionnel</span>
            <input
              type="file"
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  fichier: event.target.files?.[0] ?? null,
                }))
              }
              style={styles.fileInput}
            />
          </label>

          <div style={styles.formActions}>
            <button type="submit" disabled={saving} style={styles.primaryButton}>
              {saving
                ? "Enregistrement..."
                : form.id
                  ? "Mettre à jour"
                  : "Créer le texte"}
            </button>

            <button type="button" onClick={resetForm} style={styles.secondaryButton}>
              Réinitialiser
            </button>
          </div>
        </form>
      </section>

      <section style={styles.filtersPanel}>
        <div style={styles.filtersGrid}>
          <input
            value={filters.q ?? ""}
            onChange={(event) => updateFilter("q", event.target.value)}
            placeholder="Rechercher un titre, une note, un contenu..."
            style={styles.input}
          />

          <select
            value={filters.categorie ?? ""}
            onChange={(event) =>
              updateFilter(
                "categorie",
                event.target.value as ReglementTexteCategorie | "",
              )
            }
            style={styles.input}
          >
            {CATEGORIES.map((category) => (
              <option key={category.value || "ALL"} value={category.value}>
                {category.label}
              </option>
            ))}
          </select>

          <select
            value={filters.statut ?? ""}
            onChange={(event) =>
              updateFilter("statut", event.target.value as ReglementTexteStatut | "")
            }
            style={styles.input}
          >
            {STATUTS.map((statut) => (
              <option key={statut.value || "ALL"} value={statut.value}>
                {statut.label}
              </option>
            ))}
          </select>

          <select
            value={
              typeof filters.visible_coproprietaire === "boolean"
                ? String(filters.visible_coproprietaire)
                : ""
            }
            onChange={(event) => {
              const value = event.target.value;

              updateFilter(
                "visible_coproprietaire",
                value === "" ? "" : value === "true",
              );
            }}
            style={styles.input}
          >
            <option value="">Toutes visibilités</option>
            <option value="true">Visible copropriétaire</option>
            <option value="false">Masqué copropriétaire</option>
          </select>

          <button type="button" onClick={loadItems} style={styles.primaryButton}>
            Filtrer
          </button>
        </div>
      </section>

      <section style={styles.listPanel}>
        <div style={styles.sectionHeader}>
          <div>
            <p style={styles.sectionEyebrow}>Registre</p>
            <h2 style={styles.sectionTitle}>Textes enregistrés</h2>
          </div>

          <span style={styles.countPill}>{items.length} texte(s)</span>
        </div>

        {loading ? (
          <div style={styles.emptyState}>Chargement des textes...</div>
        ) : items.length === 0 ? (
          <div style={styles.emptyState}>
            Aucun texte ne correspond aux critères sélectionnés.
          </div>
        ) : (
          <div style={styles.itemsList}>
            {items.map((item) => (
              <article key={item.id} style={styles.itemCard}>
                <div style={styles.itemMain}>
                  <div style={styles.itemHeader}>
                    <div>
                      <p style={styles.itemCategory}>
                        {item.categorie_label || item.categorie}
                      </p>
                      <h3 style={styles.itemTitle}>{item.titre}</h3>
                    </div>

                    <div style={styles.badges}>
                      <span style={{ ...styles.badge, ...getStatutTone(item.statut) }}>
                        {item.statut_label || item.statut}
                      </span>

                      <span
                        style={{
                          ...styles.badge,
                          ...(item.visible_coproprietaire
                            ? styles.badgeGreen
                            : styles.badgeSlate),
                        }}
                      >
                        {item.visible_coproprietaire
                          ? "Visible copropriétaire"
                          : "Masqué"}
                      </span>
                    </div>
                  </div>

                  <p style={styles.itemResume}>{item.resume}</p>

                  <div style={styles.itemMeta}>
                    <span>Ordre : {item.ordre_affichage}</span>
                    <span>Publié : {formatDate(item.date_publication)}</span>
                    <span>Créé : {formatDate(item.created_at)}</span>
                    {item.filename ? <span>Fichier : {item.filename}</span> : null}
                  </div>
                </div>

                <div style={styles.itemActions}>
                  <button type="button" onClick={() => editItem(item)} style={styles.lightButton}>
                    Modifier
                  </button>

                  <button
                    type="button"
                    disabled={saving || item.statut === "PUBLIE"}
                    onClick={() =>
                      runAction(
                        () => publierReglementTexteApplicable(item.id),
                        "Texte publié avec succès.",
                      )
                    }
                    style={styles.successButton}
                  >
                    Publier
                  </button>

                  {item.visible_coproprietaire ? (
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() =>
                        runAction(
                          () => masquerReglementTexteApplicable(item.id),
                          "Texte masqué côté copropriétaire.",
                        )
                      }
                      style={styles.secondaryButton}
                    >
                      Masquer
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() =>
                        runAction(
                          () => rendreVisibleReglementTexteApplicable(item.id),
                          "Texte rendu visible côté copropriétaire.",
                        )
                      }
                      style={styles.secondaryButton}
                    >
                      Rendre visible
                    </button>
                  )}

                  <button
                    type="button"
                    disabled={saving || item.statut === "ARCHIVE"}
                    onClick={() =>
                      runAction(
                        () => archiverReglementTexteApplicable(item.id),
                        "Texte archivé avec succès.",
                      )
                    }
                    style={styles.dangerButton}
                  >
                    Archiver
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section style={styles.warningPanel}>
        <h2 style={styles.warningTitle}>Important</h2>
        <p style={styles.warningText}>
          Les contenus juridiques affichés dans cette partie doivent rester
          informatifs, sourcés et validés par un professionnel du droit avant toute
          utilisation officielle auprès des copropriétaires.
        </p>
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "blue" | "green" | "amber" | "slate";
}) {
  const toneStyle =
    tone === "green"
      ? styles.statGreen
      : tone === "amber"
        ? styles.statAmber
        : tone === "slate"
          ? styles.statSlate
          : styles.statBlue;

  return (
    <article style={{ ...styles.statCard, ...toneStyle }}>
      <p style={styles.statLabel}>{label}</p>
      <p style={styles.statValue}>{value}</p>
    </article>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    display: "grid",
    gap: 24,
  },

  hero: {
    padding: 26,
    borderRadius: 28,
    border: "1px solid #e5e7eb",
    background:
      "linear-gradient(135deg, #fefce8 0%, #f8fafc 55%, #ffffff 100%)",
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) 260px",
    gap: 20,
    alignItems: "stretch",
    boxShadow: "0 18px 50px rgba(15,23,42,0.06)",
  },

  eyebrow: {
    margin: 0,
    fontSize: 12,
    fontWeight: 900,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: "#a16207",
  },

  title: {
    margin: "8px 0 0",
    fontSize: 30,
    letterSpacing: -0.8,
    color: "#0f172a",
  },

  subtitle: {
    margin: "12px 0 0",
    maxWidth: 900,
    fontSize: 15,
    lineHeight: 1.7,
    color: "#475569",
    fontWeight: 650,
  },

  heroActions: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    marginTop: 18,
  },

  heroCard: {
    borderRadius: 24,
    background: "#ffffff",
    border: "1px solid #fde68a",
    padding: 20,
    boxShadow: "0 14px 35px rgba(161,98,7,0.08)",
  },

  heroCardLabel: {
    margin: 0,
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    color: "#a16207",
  },

  heroCardValue: {
    margin: "12px 0 0",
    fontSize: 38,
    fontWeight: 950,
    color: "#0f172a",
  },

  heroCardText: {
    margin: "8px 0 0",
    fontSize: 13,
    lineHeight: 1.55,
    color: "#64748b",
    fontWeight: 650,
  },

  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: 14,
  },

  statCard: {
    borderRadius: 22,
    padding: 18,
    border: "1px solid",
  },

  statBlue: {
    background: "#eff6ff",
    borderColor: "#bfdbfe",
    color: "#1d4ed8",
  },

  statGreen: {
    background: "#ecfdf5",
    borderColor: "#bbf7d0",
    color: "#047857",
  },

  statAmber: {
    background: "#fffbeb",
    borderColor: "#fde68a",
    color: "#a16207",
  },

  statSlate: {
    background: "#f8fafc",
    borderColor: "#e2e8f0",
    color: "#475569",
  },

  statLabel: {
    margin: 0,
    fontSize: 12,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: "0.12em",
  },

  statValue: {
    margin: "10px 0 0",
    fontSize: 28,
    fontWeight: 950,
  },

  alertDanger: {
    borderRadius: 20,
    padding: 16,
    background: "#fff1f2",
    border: "1px solid #fecdd3",
    color: "#be123c",
  },

  alertSuccess: {
    borderRadius: 20,
    padding: 16,
    background: "#ecfdf5",
    border: "1px solid #bbf7d0",
    color: "#047857",
  },

  alertText: {
    margin: "6px 0 0",
    fontSize: 13,
    lineHeight: 1.6,
    fontWeight: 650,
  },

  formPanel: {
    padding: 22,
    borderRadius: 26,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    boxShadow: "0 16px 44px rgba(15,23,42,0.06)",
  },

  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 16,
    alignItems: "flex-start",
  },

  sectionEyebrow: {
    margin: 0,
    fontSize: 11,
    fontWeight: 900,
    color: "#2563eb",
    letterSpacing: "0.14em",
    textTransform: "uppercase",
  },

  sectionTitle: {
    margin: "6px 0 0",
    fontSize: 20,
    fontWeight: 950,
    color: "#0f172a",
  },

  form: {
    display: "grid",
    gap: 16,
    marginTop: 18,
  },

  formGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: 14,
  },

  field: {
    display: "grid",
    gap: 7,
  },

  label: {
    fontSize: 12,
    fontWeight: 900,
    color: "#334155",
  },

  input: {
    width: "100%",
    border: "1px solid #cbd5e1",
    borderRadius: 16,
    padding: "11px 12px",
    fontSize: 13,
    color: "#0f172a",
    background: "#ffffff",
  },

  textarea: {
    width: "100%",
    border: "1px solid #cbd5e1",
    borderRadius: 18,
    padding: 12,
    fontSize: 13,
    lineHeight: 1.6,
    color: "#0f172a",
    resize: "vertical",
  },

  fileInput: {
    border: "1px dashed #cbd5e1",
    borderRadius: 16,
    padding: 12,
    background: "#f8fafc",
    fontSize: 13,
  },

  checkboxLine: {
    display: "inline-flex",
    gap: 9,
    alignItems: "center",
    fontSize: 13,
    fontWeight: 800,
    color: "#334155",
  },

  formActions: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
  },

  filtersPanel: {
    padding: 18,
    borderRadius: 24,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
  },

  filtersGrid: {
    display: "grid",
    gridTemplateColumns: "minmax(240px, 1fr) 220px 180px 210px auto",
    gap: 12,
    alignItems: "center",
  },

  listPanel: {
    padding: 22,
    borderRadius: 26,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    boxShadow: "0 16px 44px rgba(15,23,42,0.06)",
  },

  countPill: {
    borderRadius: 999,
    padding: "8px 12px",
    background: "#eff6ff",
    border: "1px solid #bfdbfe",
    color: "#1d4ed8",
    fontSize: 12,
    fontWeight: 900,
  },

  emptyState: {
    marginTop: 18,
    borderRadius: 22,
    padding: 22,
    background: "#f8fafc",
    border: "1px dashed #cbd5e1",
    color: "#64748b",
    fontSize: 14,
    fontWeight: 700,
    textAlign: "center",
  },

  itemsList: {
    display: "grid",
    gap: 14,
    marginTop: 18,
  },

  itemCard: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) 210px",
    gap: 16,
    borderRadius: 24,
    padding: 18,
    border: "1px solid #e2e8f0",
    background: "#f8fafc",
  },

  itemMain: {
    minWidth: 0,
  },

  itemHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 14,
    alignItems: "flex-start",
  },

  itemCategory: {
    margin: 0,
    fontSize: 11,
    fontWeight: 900,
    color: "#2563eb",
    letterSpacing: "0.12em",
    textTransform: "uppercase",
  },

  itemTitle: {
    margin: "5px 0 0",
    fontSize: 18,
    fontWeight: 950,
    color: "#0f172a",
  },

  itemResume: {
    margin: "10px 0 0",
    color: "#475569",
    fontSize: 13,
    lineHeight: 1.6,
    fontWeight: 650,
  },

  itemMeta: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
    color: "#64748b",
    fontSize: 12,
    fontWeight: 700,
  },

  itemActions: {
    display: "grid",
    gap: 8,
    alignContent: "start",
  },

  badges: {
    display: "flex",
    flexWrap: "wrap",
    gap: 6,
    justifyContent: "flex-end",
  },

  badge: {
    borderRadius: 999,
    padding: "6px 9px",
    border: "1px solid",
    fontSize: 11,
    fontWeight: 900,
    whiteSpace: "nowrap",
  },

  badgeGreen: {
    background: "#ecfdf5",
    color: "#047857",
    borderColor: "#bbf7d0",
  },

  badgeAmber: {
    background: "#fffbeb",
    color: "#a16207",
    borderColor: "#fde68a",
  },

  badgeSlate: {
    background: "#f1f5f9",
    color: "#475569",
    borderColor: "#cbd5e1",
  },

  primaryButton: {
    border: "none",
    borderRadius: 16,
    padding: "11px 14px",
    background: "#2563eb",
    color: "#ffffff",
    fontSize: 13,
    fontWeight: 900,
    cursor: "pointer",
  },

  successButton: {
    border: "1px solid #bbf7d0",
    borderRadius: 16,
    padding: "10px 12px",
    background: "#ecfdf5",
    color: "#047857",
    fontSize: 13,
    fontWeight: 900,
    cursor: "pointer",
  },

  secondaryButton: {
    border: "1px solid #cbd5e1",
    borderRadius: 16,
    padding: "10px 12px",
    background: "#ffffff",
    color: "#334155",
    fontSize: 13,
    fontWeight: 900,
    cursor: "pointer",
  },

  lightButton: {
    border: "1px solid #dbeafe",
    borderRadius: 16,
    padding: "10px 12px",
    background: "#eff6ff",
    color: "#1d4ed8",
    fontSize: 13,
    fontWeight: 900,
    cursor: "pointer",
  },

  dangerButton: {
    border: "1px solid #fecdd3",
    borderRadius: 16,
    padding: "10px 12px",
    background: "#fff1f2",
    color: "#be123c",
    fontSize: 13,
    fontWeight: 900,
    cursor: "pointer",
  },

  warningPanel: {
    padding: 18,
    borderRadius: 22,
    border: "1px solid #fed7aa",
    background: "#fff7ed",
  },

  warningTitle: {
    margin: "0 0 8px",
    fontSize: 16,
    fontWeight: 900,
    color: "#9a3412",
  },

  warningText: {
    margin: 0,
    fontSize: 14,
    lineHeight: 1.7,
    color: "#9a3412",
    fontWeight: 700,
  },
};