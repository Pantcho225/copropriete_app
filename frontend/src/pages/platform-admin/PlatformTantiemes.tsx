// frontend/src/pages/platform-admin/PlatformTantiemes.tsx
import type { CSSProperties, FormEvent } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";

import api from "../../api/axios";
import { ENDPOINTS } from "../../api/endpoints";
import ModuleHero from "../../components/ui/ModuleHero";
import ModuleStatCard from "../../components/ui/ModuleStatCard";

type Lot = {
  id: number;
  reference: string;
  label?: string;
};

type Categorie = {
  id: number;
  code: string;
  libelle: string;
  description?: string;
  actif: boolean;
  total_lots_count?: number;
  total_valeur?: string | number | null;
};

type LotTantieme = {
  id: number;
  lot: number;
  lot_label?: string;
  lot_reference?: string;
  categorie: number;
  categorie_code?: string;
  categorie_libelle?: string;
  valeur: string | number;
};

type CategoryForm = {
  code: string;
  libelle: string;
  description: string;
  actif: boolean;
};

type ValueForm = {
  lot: string;
  categorie: string;
  valeur: string;
};

type Tone = "success" | "warning" | "danger" | "neutral" | "info";

const initialCategory: CategoryForm = {
  code: "",
  libelle: "",
  description: "",
  actif: true,
};

const initialValue: ValueForm = {
  lot: "",
  categorie: "",
  valeur: "",
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
    maxWidth: 900,
    margin: "14px 0 0",
    color: "rgba(239, 246, 255, 0.92)",
    fontSize: 14,
    lineHeight: 1.8,
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
    gap: 12,
    marginTop: 30,
  },
  statCard: {
    border: "1px solid rgba(255,255,255,0.16)",
    borderRadius: 24,
    padding: 18,
    background: "rgba(255,255,255,0.10)",
    backdropFilter: "blur(12px)",
  },
  statLabel: {
    margin: 0,
    color: "#bfdbfe",
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
  },
  statValue: {
    margin: "10px 0 0",
    fontSize: 32,
    lineHeight: 1,
    fontWeight: 950,
    color: "#ffffff",
  },
  statHint: {
    margin: "8px 0 0",
    color: "rgba(219,234,254,0.88)",
    fontSize: 12,
    fontWeight: 650,
    lineHeight: 1.6,
  },
  content: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) 360px",
    gap: 20,
    padding: 24,
    background: "#f8fafc",
  },
  main: {
    display: "flex",
    flexDirection: "column",
    gap: 20,
  },
  formGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 20,
  },
  card: {
    overflow: "hidden",
    border: "1px solid #e2e8f0",
    borderRadius: 28,
    background: "#ffffff",
    boxShadow: "0 16px 45px rgba(15,23,42,0.05)",
  },
  cardHeader: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 16,
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
  cardBody: {
    padding: 22,
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
  textarea: {
    width: "100%",
    minHeight: 100,
    resize: "vertical",
    borderRadius: 16,
    border: "1px solid #dbe3ef",
    background: "#ffffff",
    padding: "13px 14px",
    color: "#0f172a",
    fontSize: 14,
    lineHeight: 1.6,
    outline: "none",
  },
  checkboxLine: {
    display: "flex",
    alignItems: "flex-start",
    gap: 12,
    marginTop: 16,
  },
  checkbox: {
    marginTop: 3,
    width: 18,
    height: 18,
    accentColor: "#4f46e5",
  },
  helpText: {
    margin: "6px 0 0",
    color: "#64748b",
    fontSize: 12,
    lineHeight: 1.6,
  },
  error: {
    border: "1px solid #fecaca",
    borderRadius: 18,
    background: "#fef2f2",
    padding: 14,
    color: "#b91c1c",
    fontSize: 13,
    fontWeight: 700,
  },
  notice: {
    marginTop: 14,
    border: "1px solid #fde68a",
    borderRadius: 18,
    background: "#fffbeb",
    padding: 14,
    color: "#92400e",
    fontSize: 13,
    lineHeight: 1.7,
  },
  footer: {
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 14,
    marginTop: 20,
    paddingTop: 20,
    borderTop: "1px solid #f1f5f9",
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
    minHeight: 40,
    padding: "0 15px",
    borderRadius: 15,
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
    minHeight: 40,
    padding: "0 15px",
    borderRadius: 15,
    border: "1px solid #4f46e5",
    background: "#4f46e5",
    color: "#ffffff",
    fontSize: 13,
    fontWeight: 900,
    textDecoration: "none",
    cursor: "pointer",
    boxShadow: "0 12px 28px rgba(79,70,229,0.22)",
  },
  tableWrap: {
    margin: "0 22px 22px",
    overflow: "hidden",
    border: "1px solid #e2e8f0",
    borderRadius: 24,
    background: "#ffffff",
  },
  tableScroll: {
    overflowX: "auto",
  },
  table: {
    width: "100%",
    minWidth: 900,
    borderCollapse: "collapse",
    fontSize: 13,
  },
  th: {
    padding: "14px 16px",
    background: "#f8fafc",
    borderBottom: "1px solid #e2e8f0",
    color: "#64748b",
    fontSize: 11,
    fontWeight: 950,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    textAlign: "left",
    whiteSpace: "nowrap",
  },
  thRight: {
    padding: "14px 16px",
    background: "#f8fafc",
    borderBottom: "1px solid #e2e8f0",
    color: "#64748b",
    fontSize: 11,
    fontWeight: 950,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    textAlign: "right",
    whiteSpace: "nowrap",
  },
  td: {
    padding: "16px",
    borderBottom: "1px solid #f1f5f9",
    verticalAlign: "top",
    color: "#334155",
  },
  tdRight: {
    padding: "16px",
    borderBottom: "1px solid #f1f5f9",
    verticalAlign: "top",
    textAlign: "right",
  },
  rowTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: 14,
    fontWeight: 950,
  },
  muted: {
    margin: "5px 0 0",
    color: "#64748b",
    fontSize: 12,
    lineHeight: 1.5,
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
  sideCardAmber: {
    border: "1px solid #fde68a",
    borderRadius: 26,
    background: "#fffbeb",
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
  empty: {
    padding: 40,
    textAlign: "center",
    color: "#64748b",
    fontSize: 13,
  },
};

function extractRows<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];

  if (payload && typeof payload === "object") {
    const data = payload as {
      results?: unknown;
      items?: unknown;
      data?: unknown;
    };

    if (Array.isArray(data.results)) return data.results as T[];
    if (Array.isArray(data.items)) return data.items as T[];
    if (Array.isArray(data.data)) return data.data as T[];
  }

  return [];
}

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

  return "Une erreur est survenue.";
}

function getActiveCoproId() {
  return (
    localStorage.getItem("coproprieteId") ||
    localStorage.getItem("copropriete_id") ||
    localStorage.getItem("activeCoproprieteId") ||
    ""
  );
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: 4,
  }).format(value);
}

function toNumber(value: string | number | null | undefined): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;

  if (typeof value === "string") {
    const parsed = Number(value.replace(",", "."));
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function badgeStyle(tone: Tone): CSSProperties {
  const map: Record<Tone, CSSProperties> = {
    success: {
      border: "1px solid #bbf7d0",
      background: "#ecfdf5",
      color: "#047857",
    },
    warning: {
      border: "1px solid #fde68a",
      background: "#fffbeb",
      color: "#b45309",
    },
    danger: {
      border: "1px solid #fecaca",
      background: "#fef2f2",
      color: "#b91c1c",
    },
    info: {
      border: "1px solid #bfdbfe",
      background: "#eff6ff",
      color: "#1d4ed8",
    },
    neutral: {
      border: "1px solid #e2e8f0",
      background: "#f1f5f9",
      color: "#475569",
    },
  };

  return {
    display: "inline-flex",
    alignItems: "center",
    minHeight: 28,
    padding: "0 11px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 900,
    whiteSpace: "nowrap",
    ...map[tone],
  };
}

function getLotLabel(lot: Lot): string {
  return lot.label || lot.reference || `Lot #${lot.id}`;
}

function getValueLotLabel(item: LotTantieme): string {
  return item.lot_label || item.lot_reference || `Lot #${item.lot}`;
}

function getCategoryLabel(item: Categorie): string {
  return `${item.code} — ${item.libelle}`;
}

function getValueCategoryLabel(item: LotTantieme): string {
  const code = item.categorie_code || `Catégorie #${item.categorie}`;
  return item.categorie_libelle ? `${code} — ${item.categorie_libelle}` : code;
}

export default function PlatformTantiemes() {
  const [lots, setLots] = useState<Lot[]>([]);
  const [categories, setCategories] = useState<Categorie[]>([]);
  const [values, setValues] = useState<LotTantieme[]>([]);
  const [categoryForm, setCategoryForm] = useState<CategoryForm>(initialCategory);
  const [valueForm, setValueForm] = useState<ValueForm>(initialValue);
  const [loading, setLoading] = useState(true);
  const [savingCategory, setSavingCategory] = useState(false);
  const [savingValue, setSavingValue] = useState(false);
  const [actionCategoryId, setActionCategoryId] = useState<number | null>(null);
  const [deletingValueId, setDeletingValueId] = useState<number | null>(null);
  const [error, setError] = useState("");

  const activeCoproId = getActiveCoproId();

  const stats = useMemo(() => {
    const activeCategories = categories.filter((item) => item.actif).length;
    const inactiveCategories = categories.filter((item) => !item.actif).length;
    const totalCategoryValue = categories.reduce((total, item) => {
      return total + toNumber(item.total_valeur);
    }, 0);
    const totalValues = values.reduce((total, item) => {
      return total + toNumber(item.valeur);
    }, 0);

    return {
      lots: lots.length,
      categories: categories.length,
      activeCategories,
      inactiveCategories,
      values: values.length,
      totalCategoryValue,
      totalValues,
    };
  }, [categories, lots.length, values]);

  const canSubmitCategory = useMemo(() => {
    return categoryForm.code.trim().length > 0 && categoryForm.libelle.trim().length > 0;
  }, [categoryForm.code, categoryForm.libelle]);

  const canSubmitValue = useMemo(() => {
    return (
      valueForm.lot.trim().length > 0 &&
      valueForm.categorie.trim().length > 0 &&
      valueForm.valeur.trim().length > 0 &&
      toNumber(valueForm.valeur) >= 0
    );
  }, [valueForm.categorie, valueForm.lot, valueForm.valeur]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    const params = activeCoproId ? { copropriete: activeCoproId } : undefined;

    try {
      const [lotsResponse, categoriesResponse, valuesResponse] = await Promise.all([
        api.get(ENDPOINTS.platform.lots, { params }),
        api.get(ENDPOINTS.platform.tantiemeCategories, { params }),
        api.get(ENDPOINTS.platform.lotTantiemes, { params }),
      ]);

      setLots(extractRows<Lot>(lotsResponse.data));
      setCategories(extractRows<Categorie>(categoriesResponse.data));
      setValues(extractRows<LotTantieme>(valuesResponse.data));
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [activeCoproId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  function updateCategory<K extends keyof CategoryForm>(
    key: K,
    value: CategoryForm[K],
  ) {
    setCategoryForm((previous) => ({ ...previous, [key]: value }));
  }

  function updateValue<K extends keyof ValueForm>(key: K, value: ValueForm[K]) {
    setValueForm((previous) => ({ ...previous, [key]: value }));
  }

  async function submitCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canSubmitCategory) {
      setError("Le code et le libellé de la catégorie sont obligatoires.");
      return;
    }

    setSavingCategory(true);
    setError("");

    try {
      await api.post(ENDPOINTS.platform.tantiemeCategories, {
        code: categoryForm.code.trim().toUpperCase(),
        libelle: categoryForm.libelle.trim(),
        description: categoryForm.description.trim(),
        actif: categoryForm.actif,
        ...(activeCoproId ? { copropriete: activeCoproId } : {}),
      });

      setCategoryForm(initialCategory);
      await loadData();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSavingCategory(false);
    }
  }

  async function submitValue(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canSubmitValue) {
      setError("Veuillez choisir un lot, une catégorie et une valeur valide.");
      return;
    }

    setSavingValue(true);
    setError("");

    try {
      await api.post(ENDPOINTS.platform.lotTantiemes, {
        lot: Number(valueForm.lot),
        categorie: Number(valueForm.categorie),
        valeur: valueForm.valeur,
      });

      setValueForm(initialValue);
      await loadData();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSavingValue(false);
    }
  }

  async function toggleCategory(item: Categorie) {
    setActionCategoryId(item.id);
    setError("");

    try {
      const endpoint = item.actif
        ? ENDPOINTS.platform.tantiemeCategorieDesactiver(item.id)
        : ENDPOINTS.platform.tantiemeCategorieActiver(item.id);

      await api.post(endpoint);
      await loadData();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setActionCategoryId(null);
    }
  }

  async function deleteValue(item: LotTantieme) {
    const confirmed = window.confirm("Supprimer cette valeur de tantième ?");
    if (!confirmed) return;

    setDeletingValueId(item.id);
    setError("");

    try {
      await api.delete(ENDPOINTS.lotTantiemeDetail(item.id));
      await loadData();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setDeletingValueId(null);
    }
  }

  return (
    <div style={styles.page}>
      <section style={styles.shell}>
        <ModuleHero
          eyebrow="Super Admin · Référentiel copropriété"
          title="Tantièmes"
          subtitle="Paramétrez les catégories et les valeurs de tantièmes utilisées pour les répartitions, les votes, les appels de fonds et la cohérence des assemblées générales."
        >
          <div className="moduleStatsGrid">
            <ModuleStatCard
              label="Lots disponibles"
              value={formatNumber(stats.lots)}
              hint="Lots pouvant recevoir des tantièmes"
              tone="blue"
            />
            <ModuleStatCard
              label="Catégories actives"
              value={formatNumber(stats.activeCategories)}
              hint="Clés de répartition utilisables"
              tone="green"
            />
            <ModuleStatCard
              label="Valeurs saisies"
              value={formatNumber(stats.values)}
              hint="Affectations lot / catégorie"
              tone="purple"
            />
            <ModuleStatCard
              label="Total valeurs"
              value={formatNumber(stats.totalValues)}
              hint="Somme rapide des tantièmes saisis"
              tone="amber"
            />
          </div>
        </ModuleHero>

        <div style={styles.content}>
          <main style={styles.main}>
            {error ? <div style={styles.error}>{error}</div> : null}

            <section style={styles.formGrid}>
              <form onSubmit={(event) => void submitCategory(event)} style={styles.card}>
                <div style={styles.cardHeader}>
                  <div>
                    <p style={styles.cardEyebrow}>Catégorie de tantièmes</p>
                    <h2 style={styles.cardTitle}>Nouvelle catégorie</h2>
                    <p style={styles.cardSubtitle}>
                      Créez une clé de répartition : générale, ascenseur,
                      parking, charges spéciales, etc.
                    </p>
                  </div>
                </div>

                <div style={styles.cardBody}>
                  <div style={{ display: "grid", gap: 16 }}>
                    <label style={styles.field}>
                      <span style={styles.label}>Code *</span>
                      <input
                        value={categoryForm.code}
                        onChange={(event) =>
                          updateCategory("code", event.target.value)
                        }
                        placeholder="GENERAL, ASCENSEUR..."
                        required
                        style={styles.input}
                      />
                    </label>

                    <label style={styles.field}>
                      <span style={styles.label}>Libellé *</span>
                      <input
                        value={categoryForm.libelle}
                        onChange={(event) =>
                          updateCategory("libelle", event.target.value)
                        }
                        placeholder="Charges générales"
                        required
                        style={styles.input}
                      />
                    </label>

                    <label style={styles.field}>
                      <span style={styles.label}>Description</span>
                      <textarea
                        value={categoryForm.description}
                        onChange={(event) =>
                          updateCategory("description", event.target.value)
                        }
                        placeholder="Précisez l’usage de cette catégorie..."
                        style={styles.textarea}
                      />
                    </label>

                    <label style={styles.checkboxLine}>
                      <input
                        type="checkbox"
                        checked={categoryForm.actif}
                        onChange={(event) =>
                          updateCategory("actif", event.target.checked)
                        }
                        style={styles.checkbox}
                      />
                      <span>
                        <strong style={{ color: "#0f172a", fontSize: 14 }}>
                          Catégorie active
                        </strong>
                        <p style={styles.helpText}>
                          Une catégorie inactive reste conservée mais ne devrait
                          plus servir aux nouvelles répartitions.
                        </p>
                      </span>
                    </label>

                    <div style={styles.footer}>
                      <p style={styles.helpText}>
                        Copropriété active :{" "}
                        <strong>{activeCoproId || "aucune"}</strong>
                      </p>

                      <button
                        type="submit"
                        disabled={savingCategory || !canSubmitCategory}
                        style={{
                          ...styles.buttonPrimary,
                          opacity:
                            savingCategory || !canSubmitCategory ? 0.65 : 1,
                          cursor:
                            savingCategory || !canSubmitCategory
                              ? "not-allowed"
                              : "pointer",
                        }}
                      >
                        {savingCategory
                          ? "Enregistrement..."
                          : "Créer la catégorie"}
                      </button>
                    </div>
                  </div>
                </div>
              </form>

              <form onSubmit={(event) => void submitValue(event)} style={styles.card}>
                <div style={styles.cardHeader}>
                  <div>
                    <p style={styles.cardEyebrow}>Valeur de tantième</p>
                    <h2 style={styles.cardTitle}>Affecter une valeur</h2>
                    <p style={styles.cardSubtitle}>
                      Associez une valeur de tantième à un lot pour une catégorie
                      donnée.
                    </p>
                  </div>
                </div>

                <div style={styles.cardBody}>
                  <div style={{ display: "grid", gap: 16 }}>
                    <label style={styles.field}>
                      <span style={styles.label}>Lot *</span>
                      <select
                        value={valueForm.lot}
                        onChange={(event) => updateValue("lot", event.target.value)}
                        required
                        style={styles.select}
                      >
                        <option value="">Choisir un lot</option>
                        {lots.map((lot) => (
                          <option key={lot.id} value={lot.id}>
                            {getLotLabel(lot)}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label style={styles.field}>
                      <span style={styles.label}>Catégorie *</span>
                      <select
                        value={valueForm.categorie}
                        onChange={(event) =>
                          updateValue("categorie", event.target.value)
                        }
                        required
                        style={styles.select}
                      >
                        <option value="">Choisir une catégorie</option>
                        {categories.map((category) => (
                          <option key={category.id} value={category.id}>
                            {getCategoryLabel(category)}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label style={styles.field}>
                      <span style={styles.label}>Valeur *</span>
                      <input
                        value={valueForm.valeur}
                        onChange={(event) =>
                          updateValue("valeur", event.target.value)
                        }
                        placeholder="Ex. 120"
                        required
                        type="number"
                        min="0"
                        step="0.0001"
                        style={styles.input}
                      />
                    </label>

                    <div style={styles.notice}>
                      Un tantième mal renseigné peut fausser les appels de fonds,
                      les relances, le quorum et le poids des votes en AG.
                    </div>

                    <div style={styles.footer}>
                      <p style={styles.helpText}>
                        Lots : <strong>{formatNumber(lots.length)}</strong> ·
                        Catégories :{" "}
                        <strong>{formatNumber(categories.length)}</strong>
                      </p>

                      <button
                        type="submit"
                        disabled={savingValue || !canSubmitValue}
                        style={{
                          ...styles.buttonPrimary,
                          opacity: savingValue || !canSubmitValue ? 0.65 : 1,
                          cursor:
                            savingValue || !canSubmitValue
                              ? "not-allowed"
                              : "pointer",
                        }}
                      >
                        {savingValue ? "Enregistrement..." : "Affecter la valeur"}
                      </button>
                    </div>
                  </div>
                </div>
              </form>
            </section>

            <section style={styles.card}>
              <div style={styles.cardHeader}>
                <div>
                  <p style={styles.cardEyebrow}>Catégories</p>
                  <h2 style={styles.cardTitle}>Catégories de tantièmes</h2>
                  <p style={styles.cardSubtitle}>
                    {formatNumber(categories.length)} catégorie
                    {categories.length > 1 ? "s" : ""} affichée
                    {categories.length > 1 ? "s" : ""}.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => void loadData()}
                  disabled={loading}
                  style={{
                    ...styles.buttonNeutral,
                    opacity: loading ? 0.65 : 1,
                    cursor: loading ? "not-allowed" : "pointer",
                  }}
                >
                  {loading ? "Chargement..." : "Actualiser"}
                </button>
              </div>

              <div style={styles.tableWrap}>
                <div style={styles.tableScroll}>
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th style={styles.th}>Code</th>
                        <th style={styles.th}>Libellé</th>
                        <th style={styles.th}>Lots</th>
                        <th style={styles.th}>Total</th>
                        <th style={styles.th}>Statut</th>
                        <th style={styles.thRight}>Action</th>
                      </tr>
                    </thead>

                    <tbody>
                      {loading ? (
                        <tr>
                          <td style={styles.empty} colSpan={6}>
                            Chargement des catégories...
                          </td>
                        </tr>
                      ) : categories.length === 0 ? (
                        <tr>
                          <td style={styles.empty} colSpan={6}>
                            Aucune catégorie trouvée.
                          </td>
                        </tr>
                      ) : (
                        categories.map((item) => {
                          const actionBusy = actionCategoryId === item.id;

                          return (
                            <tr key={item.id}>
                              <td style={styles.td}>
                                <p style={styles.rowTitle}>{item.code}</p>
                                <p style={styles.muted}>
                                  {item.description || "Description non renseignée"}
                                </p>
                              </td>

                              <td style={styles.td}>{item.libelle}</td>

                              <td style={styles.td}>
                                {formatNumber(item.total_lots_count ?? 0)}
                              </td>

                              <td style={styles.td}>
                                {formatNumber(toNumber(item.total_valeur))}
                              </td>

                              <td style={styles.td}>
                                <span
                                  style={badgeStyle(
                                    item.actif ? "success" : "neutral",
                                  )}
                                >
                                  {item.actif ? "Active" : "Inactive"}
                                </span>
                              </td>

                              <td style={styles.tdRight}>
                                <button
                                  type="button"
                                  onClick={() => void toggleCategory(item)}
                                  disabled={actionBusy}
                                  style={{
                                    ...styles.buttonNeutral,
                                    minHeight: 34,
                                    fontSize: 12,
                                    opacity: actionBusy ? 0.65 : 1,
                                    cursor: actionBusy
                                      ? "not-allowed"
                                      : "pointer",
                                  }}
                                >
                                  {actionBusy
                                    ? "Traitement..."
                                    : item.actif
                                      ? "Désactiver"
                                      : "Activer"}
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>

            <section style={styles.card}>
              <div style={styles.cardHeader}>
                <div>
                  <p style={styles.cardEyebrow}>Valeurs par lot</p>
                  <h2 style={styles.cardTitle}>Affectations de tantièmes</h2>
                  <p style={styles.cardSubtitle}>
                    {formatNumber(values.length)} valeur
                    {values.length > 1 ? "s" : ""} de tantième saisie
                    {values.length > 1 ? "s" : ""}.
                  </p>
                </div>
              </div>

              <div style={styles.tableWrap}>
                <div style={styles.tableScroll}>
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th style={styles.th}>Lot</th>
                        <th style={styles.th}>Catégorie</th>
                        <th style={styles.th}>Valeur</th>
                        <th style={styles.thRight}>Action</th>
                      </tr>
                    </thead>

                    <tbody>
                      {values.length === 0 ? (
                        <tr>
                          <td style={styles.empty} colSpan={4}>
                            Aucune valeur de tantième trouvée.
                          </td>
                        </tr>
                      ) : (
                        values.map((item) => {
                          const deleting = deletingValueId === item.id;

                          return (
                            <tr key={item.id}>
                              <td style={styles.td}>
                                <p style={styles.rowTitle}>
                                  {getValueLotLabel(item)}
                                </p>
                                <p style={styles.muted}>ID lot #{item.lot}</p>
                              </td>

                              <td style={styles.td}>
                                {getValueCategoryLabel(item)}
                              </td>

                              <td style={styles.td}>
                                <p style={styles.rowTitle}>
                                  {formatNumber(toNumber(item.valeur))}
                                </p>
                              </td>

                              <td style={styles.tdRight}>
                                <button
                                  type="button"
                                  onClick={() => void deleteValue(item)}
                                  disabled={deleting}
                                  style={{
                                    ...styles.buttonNeutral,
                                    minHeight: 34,
                                    fontSize: 12,
                                    border: "1px solid #fecaca",
                                    color: "#b91c1c",
                                    background: "#fef2f2",
                                    opacity: deleting ? 0.65 : 1,
                                    cursor: deleting ? "not-allowed" : "pointer",
                                  }}
                                >
                                  {deleting ? "Suppression..." : "Supprimer"}
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          </main>

          <aside style={styles.side}>
            <div style={styles.sideCard}>
              <p style={styles.sideEyebrow}>Lecture métier</p>
              <h2 style={styles.sideTitle}>Clés de répartition</h2>
              <p style={styles.sideText}>
                Les tantièmes déterminent la répartition des charges, le poids
                des votes, le quorum et certains indicateurs de relance.
              </p>
            </div>

            <div style={styles.sideCardBlue}>
              <p style={{ ...styles.sideEyebrow, color: "#4f46e5" }}>
                Contrôle qualité
              </p>
              <h3 style={{ ...styles.sideTitle, color: "#312e81" }}>
                Valeurs à vérifier
              </h3>
              <p style={{ ...styles.sideText, color: "#4338ca" }}>
                Pour une copropriété complète, chaque lot concerné doit disposer
                de valeurs cohérentes dans les catégories utilisées.
              </p>
            </div>

            <div style={styles.sideCardGreen}>
              <p style={{ ...styles.sideEyebrow, color: "#047857" }}>
                Synthèse rapide
              </p>
              <h3 style={{ ...styles.sideTitle, color: "#064e3b" }}>
                {formatNumber(stats.values)} valeur
                {stats.values > 1 ? "s" : ""} saisie
                {stats.values > 1 ? "s" : ""}
              </h3>

              <div style={styles.checklist}>
                <div style={styles.checklistItem}>
                  <span style={styles.checklistLabel}>Lots</span>
                  <span style={styles.checklistValue}>
                    {formatNumber(stats.lots)}
                  </span>
                </div>

                <div style={styles.checklistItem}>
                  <span style={styles.checklistLabel}>Catégories</span>
                  <span style={styles.checklistValue}>
                    {formatNumber(stats.categories)}
                  </span>
                </div>

                <div style={styles.checklistItem}>
                  <span style={styles.checklistLabel}>Inactives</span>
                  <span style={styles.checklistValue}>
                    {formatNumber(stats.inactiveCategories)}
                  </span>
                </div>

                <div style={{ ...styles.checklistItem, borderBottom: "none" }}>
                  <span style={styles.checklistLabel}>Total valeurs</span>
                  <span style={styles.checklistValue}>
                    {formatNumber(stats.totalValues)}
                  </span>
                </div>
              </div>
            </div>

            <div style={styles.sideCardAmber}>
              <p style={{ ...styles.sideEyebrow, color: "#b45309" }}>
                Point de vigilance
              </p>
              <h3 style={{ ...styles.sideTitle, color: "#92400e" }}>
                Lots à zéro
              </h3>
              <p style={{ ...styles.sideText, color: "#92400e" }}>
                Les lots sans tantième doivent être contrôlés avant exploitation
                réelle. Cela évite les incohérences dans les charges, AG et
                relances.
              </p>
            </div>
          </aside>
        </div>
      </section>
    </div>
  );
}