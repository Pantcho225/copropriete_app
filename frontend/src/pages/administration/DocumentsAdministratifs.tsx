import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
} from "react";

import api from "../../api/axios";
import { ENDPOINTS } from "../../api/endpoints";

type LoadState = "idle" | "loading" | "success" | "error";

type Paginated<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

type CategoryItem = {
  id: number;
  name: string;
  code?: string;
  description?: string;
  is_active?: boolean;
};

type AdminDocumentItem = {
  id: number;
  title: string;
  category: number;
  category_label?: string;
  description?: string | null;
  file?: string | null;
  file_url?: string;
  download_url?: string;
  filename?: string;
  original_filename?: string;
  mime_type?: string;
  size_bytes?: number;
  date_document?: string | null;
  visible_to_coproprietaires: boolean;
  published_at?: string | null;
  created_at?: string;
  created_by_label?: string;
};

type FormState = {
  title: string;
  category: string;
  description: string;
  date_document: string;
  visible_to_coproprietaires: boolean;
};

type CategoryFormState = {
  name: string;
  description: string;
};

const initialForm: FormState = {
  title: "",
  category: "",
  description: "",
  date_document: "",
  visible_to_coproprietaires: false,
};

const initialCategoryForm: CategoryFormState = {
  name: "",
  description: "",
};

function isPaginated<T>(value: unknown): value is Paginated<T> {
  return Boolean(
    value &&
      typeof value === "object" &&
      Array.isArray((value as Paginated<T>).results),
  );
}

function normalizeList<T>(value: Paginated<T> | T[] | unknown): T[] {
  if (isPaginated<T>(value)) return value.results;
  if (Array.isArray(value)) return value as T[];
  return [];
}

function getErrorMessage(error: unknown, fallback: string) {
  const err = error as {
    response?: { data?: Record<string, unknown> };
    message?: string;
  };

  const data = err.response?.data;

  if (data) {
    if (typeof data.detail === "string") return data.detail;

    const entries = Object.entries(data);
    if (entries.length) {
      return entries
        .map(([key, value]) => {
          if (Array.isArray(value)) return `${key}: ${value.join(" / ")}`;
          if (typeof value === "string") return `${key}: ${value}`;
          return `${key}: ${JSON.stringify(value)}`;
        })
        .join("\n");
    }
  }

  return err.message || fallback;
}

function formatDate(value?: string | null) {
  if (!value) return "—";

  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) return parsed.toLocaleDateString("fr-FR");

  return String(value).slice(0, 10);
}

function formatSize(bytes?: number) {
  if (!bytes || bytes <= 0) return "—";

  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} Ko`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

function StatCard(props: {
  title: string;
  value: string;
  subtitle: string;
  tone?: "blue" | "green" | "orange" | "slate";
}) {
  const tone =
    props.tone === "green"
      ? {
          bg: "#ecfdf5",
          border: "#86efac",
          title: "#166534",
          value: "#14532d",
        }
      : props.tone === "orange"
        ? {
            bg: "#fffbeb",
            border: "#fcd34d",
            title: "#92400e",
            value: "#78350f",
          }
        : props.tone === "blue"
          ? {
              bg: "#eff6ff",
              border: "#93c5fd",
              title: "#1d4ed8",
              value: "#1e3a8a",
            }
          : {
              bg: "#f8fafc",
              border: "#e2e8f0",
              title: "#475569",
              value: "#0f172a",
            };

  return (
    <div style={{ ...statCard, background: tone.bg, borderColor: tone.border }}>
      <div style={{ ...statTitle, color: tone.title }}>{props.title}</div>
      <div style={{ ...statValue, color: tone.value }}>{props.value}</div>
      <div style={{ ...statSubtitle, color: tone.title }}>{props.subtitle}</div>
    </div>
  );
}

function VisibilityBadge({ visible }: { visible: boolean }) {
  return (
    <span
      style={{
        ...badge,
        ...(visible
          ? {
              background: "#ecfdf5",
              borderColor: "#86efac",
              color: "#166534",
            }
          : {
              background: "#f8fafc",
              borderColor: "#cbd5e1",
              color: "#475569",
            }),
      }}
    >
      {visible ? "Visible copropriétaire" : "Interne"}
    </span>
  );
}

export default function DocumentsAdministratifs() {
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [actionState, setActionState] = useState<LoadState>("idle");

  const [documents, setDocuments] = useState<AdminDocumentItem[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);

  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [visibilityFilter, setVisibilityFilter] = useState("");

  const [form, setForm] = useState<FormState>(initialForm);
  const [categoryForm, setCategoryForm] =
    useState<CategoryFormState>(initialCategoryForm);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">("success");

  const isBusy = loadState === "loading" || actionState === "loading";

  const showMessage = useCallback((type: "success" | "error", value: string) => {
    setMessageType(type);
    setMessage(value);
  }, []);

  const loadData = useCallback(async () => {
    setLoadState("loading");
    setMessage("");

    try {
      const [documentsRes, categoriesRes] = await Promise.all([
        api.get<Paginated<AdminDocumentItem> | AdminDocumentItem[]>(
          ENDPOINTS.documentsAdministratifs,
        ),
        api.get<Paginated<CategoryItem> | CategoryItem[]>(
          ENDPOINTS.documentsAdministrativeCategories,
        ),
      ]);

      const nextDocuments = normalizeList<AdminDocumentItem>(documentsRes.data);
      const nextCategories = normalizeList<CategoryItem>(categoriesRes.data);

      setDocuments(nextDocuments);
      setCategories(nextCategories);

      if (!form.category && nextCategories.length > 0) {
        setForm((current) => ({
          ...current,
          category: current.category || String(nextCategories[0].id),
        }));
      }

      setLoadState("success");
    } catch (error) {
      setLoadState("error");
      showMessage(
        "error",
        getErrorMessage(error, "Impossible de charger les documents administratifs."),
      );
    }
  }, [form.category, showMessage]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadData();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadData]);

  const filteredDocuments = useMemo(() => {
    const q = query.trim().toLowerCase();

    return documents.filter((documentItem) => {
      const matchesQuery =
        !q ||
        [
          documentItem.title,
          documentItem.description,
          documentItem.category_label,
          documentItem.filename,
          documentItem.original_filename,
          documentItem.created_by_label,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(q);

      const matchesCategory =
        !categoryFilter || String(documentItem.category) === String(categoryFilter);

      const matchesVisibility =
        !visibilityFilter ||
        (visibilityFilter === "VISIBLE" && documentItem.visible_to_coproprietaires) ||
        (visibilityFilter === "INTERNE" && !documentItem.visible_to_coproprietaires);

      return matchesQuery && matchesCategory && matchesVisibility;
    });
  }, [categoryFilter, documents, query, visibilityFilter]);

  const stats = useMemo(() => {
    const total = documents.length;
    const visibles = documents.filter((item) => item.visible_to_coproprietaires).length;
    const internes = total - visibles;
    const categoriesCount = categories.length;

    return { total, visibles, internes, categoriesCount };
  }, [categories.length, documents]);

  const createCategory = useCallback(async () => {
    if (!categoryForm.name.trim()) {
      showMessage("error", "Saisissez le nom de la catégorie.");
      return;
    }

    const categoryCode =
      categoryForm.name
        .trim()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 100) || "categorie";

    setActionState("loading");

    try {
      const response = await api.post<CategoryItem>(
        ENDPOINTS.documentsAdministrativeCategories,
        {
          name: categoryForm.name.trim(),
          code: categoryCode,
          description: categoryForm.description.trim(),
          is_active: true,
        },
      );

      setCategoryForm(initialCategoryForm);
      showMessage("success", "Catégorie créée.");
      await loadData();

      if (response.data?.id) {
        setForm((current) => ({ ...current, category: String(response.data.id) }));
      }

      setActionState("success");
    } catch (error) {
      setActionState("error");
      showMessage(
        "error",
        getErrorMessage(error, "Impossible de créer la catégorie."),
      );
    }
  }, [categoryForm, loadData, showMessage]);

  const createDocument = useCallback(async () => {
    if (!form.title.trim()) {
      showMessage("error", "Saisissez le titre du document.");
      return;
    }

    if (!form.category) {
      showMessage("error", "Sélectionnez une catégorie.");
      return;
    }

    if (!selectedFile) {
      showMessage("error", "Ajoutez un fichier PDF ou image.");
      return;
    }

    const payload = new FormData();
    payload.append("title", form.title.trim());
    payload.append("category", form.category);
    payload.append("description", form.description.trim());
    payload.append(
      "visible_to_coproprietaires",
      form.visible_to_coproprietaires ? "true" : "false",
    );

    if (form.date_document) {
      payload.append("date_document", form.date_document);
    }

    payload.append("file", selectedFile);

    setActionState("loading");

    try {
      await api.post(ENDPOINTS.documentsAdministratifs, payload, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      setForm((current) => ({
        ...initialForm,
        category: current.category,
      }));
      setSelectedFile(null);

      const fileInput = document.getElementById(
        "administrative-document-file",
      ) as HTMLInputElement | null;
      if (fileInput) fileInput.value = "";

      showMessage("success", "Document administratif enregistré.");
      await loadData();
      setActionState("success");
    } catch (error) {
      setActionState("error");
      showMessage(
        "error",
        getErrorMessage(error, "Impossible d’enregistrer le document."),
      );
    }
  }, [form, loadData, selectedFile, showMessage]);

  const toggleVisibility = useCallback(
    async (documentItem: AdminDocumentItem) => {
      setActionState("loading");

      try {
        await api.patch(ENDPOINTS.documentAdministratifDetail(documentItem.id), {
          visible_to_coproprietaires: !documentItem.visible_to_coproprietaires,
        });

        showMessage(
          "success",
          documentItem.visible_to_coproprietaires
            ? "Document masqué côté copropriétaire."
            : "Document rendu visible côté copropriétaire.",
        );

        await loadData();
        setActionState("success");
      } catch (error) {
        setActionState("error");
        showMessage(
          "error",
          getErrorMessage(error, "Impossible de modifier la visibilité."),
        );
      }
    },
    [loadData, showMessage],
  );

  const deleteDocument = useCallback(
    async (documentItem: AdminDocumentItem) => {
      const confirmed = window.confirm(
        `Supprimer le document « ${documentItem.title} » ? Cette action retire le document administratif de la bibliothèque.`,
      );

      if (!confirmed) return;

      setActionState("loading");

      try {
        await api.delete(ENDPOINTS.documentAdministratifDetail(documentItem.id));
        showMessage("success", "Document supprimé.");
        await loadData();
        setActionState("success");
      } catch (error) {
        setActionState("error");
        showMessage(
          "error",
          getErrorMessage(error, "Impossible de supprimer le document."),
        );
      }
    },
    [loadData, showMessage],
  );

  const openDocument = useCallback(
    async (documentItem: AdminDocumentItem, download = false) => {
      setActionState("loading");

      try {
        const response = await api.get<Blob>(
          ENDPOINTS.documentAdministratifDownload(documentItem.id),
          {
            responseType: "blob",
            params: {
              download: download ? 1 : 0,
            },
          },
        );

        const blobUrl = window.URL.createObjectURL(response.data);
        const filename =
          documentItem.filename ||
          documentItem.original_filename ||
          `${documentItem.title || "document"}.pdf`;

        if (download) {
          const link = document.createElement("a");
          link.href = blobUrl;
          link.download = filename;
          document.body.appendChild(link);
          link.click();
          link.remove();
          window.URL.revokeObjectURL(blobUrl);
        } else {
          window.open(blobUrl, "_blank", "noopener,noreferrer");
          window.setTimeout(() => window.URL.revokeObjectURL(blobUrl), 60_000);
        }

        setActionState("success");
      } catch (error) {
        setActionState("error");
        showMessage(
          "error",
          getErrorMessage(error, "Impossible d’ouvrir le document."),
        );
      }
    },
    [showMessage],
  );

  return (
    <div className="adminHarmonizedPage adminDocumentsPage" style={page}>
      <section className="adminHarmonizedHero adminHarmonizedHero--violet" style={hero}>
        <p style={eyebrow}>Documents administratifs</p>
        <h1 style={title}>Bibliothèque administrative de la copropriété</h1>
        <p style={subtitle}>
          Téléversez, classez, publiez ou conservez en interne les documents
          administratifs : règlements, courriers, comptes rendus, PV de rencontre,
          pièces institutionnelles et documents de référence.
        </p>

        <div style={heroActions}>
          <button type="button" style={primaryButton} onClick={() => void loadData()} disabled={isBusy}>
            Actualiser
          </button>
        </div>
      </section>

      {message ? (
        <div
          style={{
            ...messageBox,
            ...(messageType === "error" ? messageError : messageSuccess),
          }}
        >
          {message}
        </div>
      ) : null}

      <section style={statsGrid}>
        <StatCard
          title="Documents"
          value={String(stats.total)}
          subtitle="Documents administratifs enregistrés"
          tone="blue"
        />
        <StatCard
          title="Visibles copropriétaire"
          value={String(stats.visibles)}
          subtitle="Documents publiés dans l’espace copropriétaire"
          tone="green"
        />
        <StatCard
          title="Internes"
          value={String(stats.internes)}
          subtitle="Documents réservés à l’administration"
          tone="slate"
        />
        <StatCard
          title="Catégories"
          value={String(stats.categoriesCount)}
          subtitle="Classement documentaire actif"
          tone="orange"
        />
      </section>

      <section style={panel}>
        <div style={panelHeader}>
          <div>
            <h2 style={panelTitle}>Catégories</h2>
            <p style={panelSubtitle}>
              Créez une catégorie avant de téléverser un document si le classement
              souhaité n’existe pas encore.
            </p>
          </div>
        </div>

        <div style={categoryGrid}>
          <label style={fieldLabel}>
            <span>Nom de la catégorie</span>
            <input
              value={categoryForm.name}
              onChange={(event) =>
                setCategoryForm((current) => ({
                  ...current,
                  name: event.target.value,
                }))
              }
              style={input}
              placeholder="Courriers administratifs"
            />
          </label>

          <label style={fieldLabel}>
            <span>Description</span>
            <input
              value={categoryForm.description}
              onChange={(event) =>
                setCategoryForm((current) => ({
                  ...current,
                  description: event.target.value,
                }))
              }
              style={input}
              placeholder="Contrats, courriers, pièces institutionnelles..."
            />
          </label>

          <div style={{ display: "flex", alignItems: "end" }}>
            <button type="button" style={secondaryButton} onClick={() => void createCategory()} disabled={isBusy}>
              Créer la catégorie
            </button>
          </div>
        </div>

        <div style={badgesRow}>
          {categories.length === 0 ? (
            <span style={muted}>Aucune catégorie créée.</span>
          ) : (
            categories.map((category) => (
              <span key={category.id} style={categoryBadge}>
                {category.name}
              </span>
            ))
          )}
        </div>
      </section>

      <section style={panel}>
        <div style={panelHeader}>
          <div>
            <h2 style={panelTitle}>Nouveau document</h2>
            <p style={panelSubtitle}>
              Les fichiers acceptés côté backend sont les PDF et images JPG, PNG ou WEBP.
            </p>
          </div>
        </div>

        <div style={formGrid}>
          <label style={fieldLabel}>
            <span>Titre</span>
            <input
              value={form.title}
              onChange={(event) =>
                setForm((current) => ({ ...current, title: event.target.value }))
              }
              style={input}
              placeholder="Courrier institutionnel"
            />
          </label>

          <label style={fieldLabel}>
            <span>Catégorie</span>
            <select
              value={form.category}
              onChange={(event) =>
                setForm((current) => ({ ...current, category: event.target.value }))
              }
              style={input}
            >
              <option value="">Sélectionner</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>

          <label style={fieldLabel}>
            <span>Date du document</span>
            <input
              type="date"
              value={form.date_document}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  date_document: event.target.value,
                }))
              }
              style={input}
            />
          </label>

          <label style={fieldLabel}>
            <span>Fichier</span>
            <input
              id="administrative-document-file"
              type="file"
              accept=".pdf,image/jpeg,image/png,image/webp"
              onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
              style={input}
            />
          </label>

          <label style={{ ...fieldLabel, gridColumn: "1 / -1" }}>
            <span>Description</span>
            <textarea
              value={form.description}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  description: event.target.value,
                }))
              }
              style={{ ...input, resize: "vertical" }}
              rows={3}
              placeholder="Résumé, contexte administratif ou précision interne."
            />
          </label>

          <label style={checkRow}>
            <input
              type="checkbox"
              checked={form.visible_to_coproprietaires}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  visible_to_coproprietaires: event.target.checked,
                }))
              }
            />
            <span>Rendre visible aux copropriétaires</span>
          </label>

          <div style={formActions}>
            <button type="button" style={primaryButton} onClick={() => void createDocument()} disabled={isBusy}>
              Enregistrer le document
            </button>
            <button
              type="button"
              style={secondaryButton}
              onClick={() => {
                setForm(initialForm);
                setSelectedFile(null);
              }}
              disabled={isBusy}
            >
              Réinitialiser
            </button>
          </div>
        </div>
      </section>

      <section style={panel}>
        <div style={panelHeader}>
          <div>
            <h2 style={panelTitle}>Documents enregistrés</h2>
            <p style={panelSubtitle}>
              Recherchez, ouvrez, téléchargez ou modifiez la visibilité des documents.
            </p>
          </div>
        </div>

        <div style={filtersGrid}>
          <label style={fieldLabel}>
            <span>Recherche</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              style={input}
              placeholder="Titre, fichier, catégorie..."
            />
          </label>

          <label style={fieldLabel}>
            <span>Catégorie</span>
            <select
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
              style={input}
            >
              <option value="">Toutes les catégories</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>

          <label style={fieldLabel}>
            <span>Visibilité</span>
            <select
              value={visibilityFilter}
              onChange={(event) => setVisibilityFilter(event.target.value)}
              style={input}
            >
              <option value="">Tous</option>
              <option value="VISIBLE">Visible copropriétaire</option>
              <option value="INTERNE">Interne</option>
            </select>
          </label>
        </div>

        {loadState === "loading" ? (
          <div style={emptyState}>Chargement des documents administratifs...</div>
        ) : filteredDocuments.length === 0 ? (
          <div style={emptyState}>Aucun document administratif ne correspond aux filtres.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={table}>
              <thead>
                <tr>
                  <th style={th}>Document</th>
                  <th style={th}>Catégorie</th>
                  <th style={th}>Date</th>
                  <th style={th}>Fichier</th>
                  <th style={th}>Visibilité</th>
                  <th style={th}>Actions</th>
                </tr>
              </thead>

              <tbody>
                {filteredDocuments.map((documentItem) => (
                  <tr key={documentItem.id}>
                    <td style={td}>
                      <strong>{documentItem.title}</strong>
                      {documentItem.description ? (
                        <div style={muted}>{documentItem.description}</div>
                      ) : null}
                    </td>
                    <td style={td}>{documentItem.category_label || "—"}</td>
                    <td style={td}>{formatDate(documentItem.date_document)}</td>
                    <td style={td}>
                      <div>{documentItem.filename || documentItem.original_filename || "—"}</div>
                      <div style={muted}>{formatSize(documentItem.size_bytes)}</div>
                    </td>
                    <td style={td}>
                      <VisibilityBadge visible={documentItem.visible_to_coproprietaires} />
                    </td>
                    <td style={td}>
                      <div style={rowActions}>
                        <button
                          type="button"
                          style={smallButton}
                          onClick={() => void openDocument(documentItem, false)}
                          disabled={isBusy}
                        >
                          Ouvrir
                        </button>
                        <button
                          type="button"
                          style={smallButton}
                          onClick={() => void openDocument(documentItem, true)}
                          disabled={isBusy}
                        >
                          Télécharger
                        </button>
                        <button
                          type="button"
                          style={smallButton}
                          onClick={() => void toggleVisibility(documentItem)}
                          disabled={isBusy}
                        >
                          {documentItem.visible_to_coproprietaires
                            ? "Masquer"
                            : "Publier"}
                        </button>
                        <button
                          type="button"
                          style={dangerSmallButton}
                          onClick={() => void deleteDocument(documentItem)}
                          disabled={isBusy}
                        >
                          Supprimer
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

const page: CSSProperties = {
  display: "grid",
  gap: 18,
};

const hero: CSSProperties = {
  padding: 26,
  borderRadius: 26,
  border: "1px solid #e5e7eb",
  background:
    "linear-gradient(135deg, #f5f3ff 0%, #f8fafc 55%, #ffffff 100%)",
  boxShadow: "0 18px 45px rgba(15, 23, 42, 0.06)",
};

const eyebrow: CSSProperties = {
  margin: 0,
  fontSize: 12,
  fontWeight: 900,
  letterSpacing: 0.8,
  textTransform: "uppercase",
  color: "#6d28d9",
};

const title: CSSProperties = {
  margin: "8px 0 0",
  fontSize: 30,
  letterSpacing: -0.7,
  color: "#0f172a",
};

const subtitle: CSSProperties = {
  margin: "12px 0 0",
  maxWidth: 900,
  fontSize: 15,
  lineHeight: 1.7,
  color: "#475569",
};

const heroActions: CSSProperties = {
  marginTop: 18,
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
};

const statsGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
  gap: 12,
};

const statCard: CSSProperties = {
  border: "1px solid",
  borderRadius: 18,
  padding: 18,
};

const statTitle: CSSProperties = {
  fontSize: 13,
  fontWeight: 900,
};

const statValue: CSSProperties = {
  marginTop: 8,
  fontSize: 28,
  fontWeight: 900,
};

const statSubtitle: CSSProperties = {
  marginTop: 6,
  fontSize: 12,
  lineHeight: 1.5,
};

const panel: CSSProperties = {
  padding: 22,
  borderRadius: 24,
  border: "1px solid #e5e7eb",
  background: "#ffffff",
  boxShadow: "0 10px 24px rgba(15, 23, 42, 0.05)",
};

const panelHeader: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
  marginBottom: 16,
};

const panelTitle: CSSProperties = {
  margin: 0,
  fontSize: 18,
  fontWeight: 900,
  color: "#0f172a",
};

const panelSubtitle: CSSProperties = {
  margin: "6px 0 0",
  fontSize: 13,
  lineHeight: 1.5,
  color: "#64748b",
};

const categoryGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(220px, 1fr) minmax(220px, 1.2fr) auto",
  gap: 12,
  alignItems: "end",
};

const formGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 12,
};

const filtersGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 12,
  marginBottom: 16,
};

const fieldLabel: CSSProperties = {
  display: "grid",
  gap: 6,
  fontSize: 12,
  fontWeight: 900,
  color: "#334155",
};

const input: CSSProperties = {
  border: "1px solid #cbd5e1",
  borderRadius: 12,
  padding: "10px 12px",
  fontSize: 13,
  color: "#0f172a",
  background: "#ffffff",
};

const checkRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  fontSize: 13,
  fontWeight: 900,
  color: "#334155",
};

const formActions: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  flexWrap: "wrap",
};

const primaryButton: CSSProperties = {
  border: "1px solid #a78bfa",
  borderRadius: 12,
  padding: "10px 14px",
  background: "#ede9fe",
  color: "#5b21b6",
  fontSize: 13,
  fontWeight: 900,
  cursor: "pointer",
};

const secondaryButton: CSSProperties = {
  border: "1px solid #cbd5e1",
  borderRadius: 12,
  padding: "10px 14px",
  background: "#ffffff",
  color: "#0f172a",
  fontSize: 13,
  fontWeight: 900,
  cursor: "pointer",
};

const smallButton: CSSProperties = {
  ...secondaryButton,
  padding: "7px 10px",
  fontSize: 12,
};

const dangerSmallButton: CSSProperties = {
  border: "1px solid #fca5a5",
  borderRadius: 12,
  padding: "7px 10px",
  background: "#fef2f2",
  color: "#991b1b",
  fontSize: 12,
  fontWeight: 900,
  cursor: "pointer",
};

const badgesRow: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
  marginTop: 14,
};

const categoryBadge: CSSProperties = {
  display: "inline-flex",
  borderRadius: 999,
  padding: "8px 11px",
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
  color: "#334155",
  fontSize: 12,
  fontWeight: 900,
};

const table: CSSProperties = {
  width: "100%",
  minWidth: 980,
  borderCollapse: "collapse",
};

const th: CSSProperties = {
  textAlign: "left",
  padding: "10px 12px",
  borderBottom: "1px solid #e2e8f0",
  fontSize: 11,
  color: "#64748b",
  textTransform: "uppercase",
  letterSpacing: 0.4,
};

const td: CSSProperties = {
  padding: "12px",
  borderBottom: "1px solid #f1f5f9",
  fontSize: 13,
  color: "#334155",
  verticalAlign: "top",
};

const rowActions: CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
};

const muted: CSSProperties = {
  color: "#64748b",
  fontSize: 12,
  lineHeight: 1.5,
};

const emptyState: CSSProperties = {
  padding: 18,
  borderRadius: 18,
  border: "1px dashed #cbd5e1",
  background: "#f8fafc",
  color: "#64748b",
  fontSize: 13,
};

const messageBox: CSSProperties = {
  borderRadius: 16,
  padding: "12px 14px",
  fontSize: 13,
  fontWeight: 800,
  whiteSpace: "pre-wrap",
};

const messageSuccess: CSSProperties = {
  border: "1px solid #86efac",
  background: "#ecfdf5",
  color: "#166534",
};

const messageError: CSSProperties = {
  border: "1px solid #fca5a5",
  background: "#fef2f2",
  color: "#991b1b",
};

const badge: CSSProperties = {
  display: "inline-flex",
  borderRadius: 999,
  border: "1px solid",
  padding: "5px 9px",
  fontSize: 11,
  fontWeight: 900,
};
