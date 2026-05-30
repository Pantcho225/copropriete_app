// frontend/src/pages/platform-admin/PlatformLots.tsx
import type { CSSProperties, FormEvent } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";

import api from "../../api/axios";
import { ENDPOINTS } from "../../api/endpoints";

type Lot = {
  id: number;
  reference: string;
  numero?: string;
  label?: string;
  type_lot: string;
  statut?: string;
  batiment?: string;
  escalier?: string;
  etage?: string;
  porte?: string;
  surface?: string | number | null;
  actif: boolean;
  total_tantiemes_value?: string | number | null;
  proprietaire_principal_display?: string;
};

type FormState = {
  id?: number;
  reference: string;
  numero: string;
  type_lot: string;
  statut: string;
  batiment: string;
  escalier: string;
  etage: string;
  porte: string;
  description: string;
  surface: string;
  actif: boolean;
};

type Tone = "success" | "warning" | "danger" | "neutral" | "info";

const initialForm: FormState = {
  reference: "",
  numero: "",
  type_lot: "APPARTEMENT",
  statut: "OCCUPE",
  batiment: "",
  escalier: "",
  etage: "",
  porte: "",
  description: "",
  surface: "",
  actif: true,
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
  formGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: 16,
  },
  formGridTwo: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 16,
    marginTop: 16,
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
  softBox: {
    marginTop: 18,
    border: "1px solid #c7d2fe",
    borderRadius: 24,
    background: "#eef2ff",
    padding: 18,
  },
  checkboxLine: {
    display: "flex",
    alignItems: "flex-start",
    gap: 12,
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
    marginBottom: 18,
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
  searchWrap: {
    padding: "0 22px 20px",
  },
  searchInput: {
    width: "100%",
    minHeight: 46,
    borderRadius: 18,
    border: "1px solid #dbe3ef",
    background: "#ffffff",
    padding: "0 16px",
    color: "#0f172a",
    fontSize: 14,
    outline: "none",
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
    minWidth: 1040,
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
  return new Intl.NumberFormat("fr-FR").format(value);
}

function toNumber(value: string | number | null | undefined): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;

  if (typeof value === "string") {
    const parsed = Number(value.replace(",", "."));
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function getLotLabel(item: Lot): string {
  return item.label || item.reference || item.numero || `Lot #${item.id}`;
}

function typeLotLabel(value?: string | null): string {
  if (value === "APPARTEMENT") return "Appartement";
  if (value === "PARKING") return "Parking";
  if (value === "CAVE") return "Cave";
  if (value === "COMMERCE") return "Commerce";
  if (value === "BUREAU") return "Bureau";
  if (value === "DEPOT") return "Dépôt";
  if (value === "AUTRE") return "Autre";
  return value || "Non défini";
}

function statutLabel(value?: string | null): string {
  if (value === "OCCUPE") return "Occupé";
  if (value === "VACANT") return "Vacant";
  if (value === "EN_TRAVAUX") return "En travaux";
  if (value === "INACTIF") return "Inactif";
  return value || "Non défini";
}

function statutTone(value?: string | null, actif?: boolean): Tone {
  if (!actif) return "neutral";
  if (value === "OCCUPE") return "success";
  if (value === "VACANT") return "warning";
  if (value === "EN_TRAVAUX") return "info";
  if (value === "INACTIF") return "neutral";
  return "info";
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

function includesText(value: string | number | null | undefined, query: string): boolean {
  return String(value ?? "")
    .toLowerCase()
    .includes(query.toLowerCase());
}

export default function PlatformLots() {
  const [rows, setRows] = useState<Lot[]>([]);
  const [form, setForm] = useState<FormState>(initialForm);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);
  const [error, setError] = useState("");

  const activeCoproId = getActiveCoproId();

  const stats = useMemo(() => {
    const actifs = rows.filter((item) => item.actif).length;
    const inactifs = rows.filter((item) => !item.actif).length;
    const totalSurface = rows.reduce((total, item) => total + toNumber(item.surface), 0);
    const totalTantiemes = rows.reduce((total, item) => {
      return total + toNumber(item.total_tantiemes_value);
    }, 0);

    return {
      total: rows.length,
      actifs,
      inactifs,
      totalSurface,
      totalTantiemes,
    };
  }, [rows]);

  const filteredRows = useMemo(() => {
    const query = q.trim();

    if (!query) return rows;

    return rows.filter((item) => {
      return (
        includesText(getLotLabel(item), query) ||
        includesText(item.reference, query) ||
        includesText(item.numero, query) ||
        includesText(typeLotLabel(item.type_lot), query) ||
        includesText(statutLabel(item.statut), query) ||
        includesText(item.batiment, query) ||
        includesText(item.etage, query) ||
        includesText(item.porte, query) ||
        includesText(item.proprietaire_principal_display, query)
      );
    });
  }, [q, rows]);

  const canSubmit = useMemo(() => {
    return form.reference.trim().length > 0;
  }, [form.reference]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await api.get(ENDPOINTS.platform.lots, {
        params: {
          ...(activeCoproId ? { copropriete: activeCoproId } : {}),
        },
      });

      setRows(extractRows<Lot>(response.data));
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [activeCoproId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((previous) => ({ ...previous, [key]: value }));
  }

  function resetForm() {
    setForm(initialForm);
  }

  function edit(item: Lot) {
    setForm({
      id: item.id,
      reference: item.reference || "",
      numero: item.numero || "",
      type_lot: item.type_lot || "APPARTEMENT",
      statut: item.statut || "OCCUPE",
      batiment: item.batiment || "",
      escalier: item.escalier || "",
      etage: item.etage || "",
      porte: item.porte || "",
      description: "",
      surface: item.surface ? String(item.surface) : "",
      actif: item.actif,
    });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canSubmit) {
      setError("La référence du lot est obligatoire.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const payload = {
        reference: form.reference.trim(),
        numero: form.numero.trim(),
        type_lot: form.type_lot,
        statut: form.statut,
        batiment: form.batiment.trim(),
        escalier: form.escalier.trim(),
        etage: form.etage.trim(),
        porte: form.porte.trim(),
        description: form.description.trim(),
        surface: form.surface ? form.surface : null,
        actif: form.actif,
        ...(activeCoproId ? { copropriete: activeCoproId } : {}),
      };

      if (form.id) {
        await api.patch(ENDPOINTS.platform.lotDetail(form.id), payload);
      } else {
        await api.post(ENDPOINTS.platform.lots, payload);
      }

      setForm(initialForm);
      await loadData();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function toggle(item: Lot) {
    setActionLoadingId(item.id);
    setError("");

    try {
      const endpoint = item.actif
        ? ENDPOINTS.platform.lotDesactiver(item.id)
        : ENDPOINTS.platform.lotActiver(item.id);

      await api.post(endpoint);
      await loadData();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setActionLoadingId(null);
    }
  }

  return (
    <div style={styles.page}>
      <section style={styles.shell}>
        <div style={styles.hero}>
          <div style={styles.heroTop}>
            <div>
              <p style={styles.eyebrow}>Super Admin · Référentiel copropriété</p>
              <h1 style={styles.title}>Lots</h1>
              <p style={styles.heroText}>
                Créez et maintenez les lots de référence. Les lots sont le socle
                des tantièmes, des appels de charges, des relances, des votes en
                assemblée générale et de l’espace copropriétaire.
              </p>
            </div>
          </div>

          <div style={styles.statsGrid}>
            <div style={styles.statCard}>
              <p style={styles.statLabel}>Lots</p>
              <p style={styles.statValue}>{formatNumber(stats.total)}</p>
              <p style={styles.statHint}>Unités référentielles enregistrées</p>
            </div>

            <div style={styles.statCard}>
              <p style={{ ...styles.statLabel, color: "#bbf7d0" }}>Actifs</p>
              <p style={styles.statValue}>{formatNumber(stats.actifs)}</p>
              <p style={{ ...styles.statHint, color: "#dcfce7" }}>
                Exploitables dans les modules métier
              </p>
            </div>

            <div style={styles.statCard}>
              <p style={{ ...styles.statLabel, color: "#e2e8f0" }}>Inactifs</p>
              <p style={styles.statValue}>{formatNumber(stats.inactifs)}</p>
              <p style={styles.statHint}>Lots hors exploitation courante</p>
            </div>

            <div style={styles.statCard}>
              <p style={styles.statLabel}>Tantièmes lus</p>
              <p style={styles.statValue}>{formatNumber(stats.totalTantiemes)}</p>
              <p style={styles.statHint}>Total rapide depuis les fiches lots</p>
            </div>
          </div>
        </div>

        <div style={styles.content}>
          <main style={styles.main}>
            <section style={styles.card}>
              <div style={styles.cardHeader}>
                <div>
                  <p style={styles.cardEyebrow}>Fiche lot</p>
                  <h2 style={styles.cardTitle}>
                    {form.id ? "Modifier un lot" : "Nouveau lot"}
                  </h2>
                  <p style={styles.cardSubtitle}>
                    Renseignez les caractéristiques du lot. Les tantièmes seront
                    gérés dans l’écran dédié afin de conserver une séparation
                    claire entre identité du lot et clés de répartition.
                  </p>
                </div>

                <button type="button" onClick={resetForm} style={styles.buttonNeutral}>
                  Réinitialiser
                </button>
              </div>

              <div style={styles.cardBody}>
                {error ? <div style={styles.error}>{error}</div> : null}

                <form onSubmit={(event) => void submit(event)}>
                  <div style={styles.formGrid}>
                    <label style={styles.field}>
                      <span style={styles.label}>Référence *</span>
                      <input
                        value={form.reference}
                        onChange={(event) => update("reference", event.target.value)}
                        placeholder="Ex. A101"
                        required
                        style={styles.input}
                      />
                    </label>

                    <label style={styles.field}>
                      <span style={styles.label}>Numéro</span>
                      <input
                        value={form.numero}
                        onChange={(event) => update("numero", event.target.value)}
                        placeholder="Ex. 101"
                        style={styles.input}
                      />
                    </label>

                    <label style={styles.field}>
                      <span style={styles.label}>Type de lot</span>
                      <select
                        value={form.type_lot}
                        onChange={(event) => update("type_lot", event.target.value)}
                        style={styles.select}
                      >
                        <option value="APPARTEMENT">Appartement</option>
                        <option value="PARKING">Parking</option>
                        <option value="CAVE">Cave</option>
                        <option value="COMMERCE">Commerce</option>
                        <option value="BUREAU">Bureau</option>
                        <option value="DEPOT">Dépôt</option>
                        <option value="AUTRE">Autre</option>
                      </select>
                    </label>

                    <label style={styles.field}>
                      <span style={styles.label}>Statut d’occupation</span>
                      <select
                        value={form.statut}
                        onChange={(event) => update("statut", event.target.value)}
                        style={styles.select}
                      >
                        <option value="OCCUPE">Occupé</option>
                        <option value="VACANT">Vacant</option>
                        <option value="EN_TRAVAUX">En travaux</option>
                        <option value="INACTIF">Inactif</option>
                      </select>
                    </label>

                    <label style={styles.field}>
                      <span style={styles.label}>Bâtiment</span>
                      <input
                        value={form.batiment}
                        onChange={(event) => update("batiment", event.target.value)}
                        placeholder="Ex. Bâtiment A"
                        style={styles.input}
                      />
                    </label>

                    <label style={styles.field}>
                      <span style={styles.label}>Escalier</span>
                      <input
                        value={form.escalier}
                        onChange={(event) => update("escalier", event.target.value)}
                        placeholder="Ex. Escalier 1"
                        style={styles.input}
                      />
                    </label>

                    <label style={styles.field}>
                      <span style={styles.label}>Étage</span>
                      <input
                        value={form.etage}
                        onChange={(event) => update("etage", event.target.value)}
                        placeholder="Ex. 2"
                        style={styles.input}
                      />
                    </label>

                    <label style={styles.field}>
                      <span style={styles.label}>Porte</span>
                      <input
                        value={form.porte}
                        onChange={(event) => update("porte", event.target.value)}
                        placeholder="Ex. 12"
                        style={styles.input}
                      />
                    </label>

                    <label style={styles.field}>
                      <span style={styles.label}>Surface m²</span>
                      <input
                        value={form.surface}
                        onChange={(event) => update("surface", event.target.value)}
                        placeholder="Ex. 85.5"
                        type="number"
                        min="0"
                        step="0.01"
                        style={styles.input}
                      />
                    </label>
                  </div>

                  <div style={styles.formGridTwo}>
                    <label style={styles.field}>
                      <span style={styles.label}>Description</span>
                      <textarea
                        value={form.description}
                        onChange={(event) =>
                          update("description", event.target.value)
                        }
                        placeholder="Informations utiles : usage, particularités, observations..."
                        style={styles.textarea}
                      />
                    </label>

                    <div style={styles.softBox}>
                      <p style={styles.cardEyebrow}>Statut référentiel</p>
                      <label style={styles.checkboxLine}>
                        <input
                          type="checkbox"
                          checked={form.actif}
                          onChange={(event) => update("actif", event.target.checked)}
                          style={styles.checkbox}
                        />
                        <span>
                          <strong style={{ color: "#0f172a", fontSize: 14 }}>
                            Lot actif
                          </strong>
                          <p style={styles.helpText}>
                            Un lot inactif reste dans l’historique mais ne doit
                            plus être utilisé dans les opérations courantes.
                          </p>
                        </span>
                      </label>

                      <div style={styles.notice}>
                        Les tantièmes et l’affectation détaillée aux
                        copropriétaires doivent être pilotés dans les écrans
                        dédiés pour éviter les incohérences AG / charges.
                      </div>
                    </div>
                  </div>

                  <div style={styles.footer}>
                    <p style={styles.helpText}>
                      Copropriété active détectée :{" "}
                      <strong>{activeCoproId || "aucune"}</strong>
                    </p>

                    <div style={styles.footerActions}>
                      {form.id ? (
                        <button
                          type="button"
                          onClick={resetForm}
                          style={styles.buttonNeutral}
                        >
                          Annuler la modification
                        </button>
                      ) : null}

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
                          : form.id
                            ? "Enregistrer les modifications"
                            : "Créer le lot"}
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            </section>

            <section style={styles.card}>
              <div style={styles.cardHeader}>
                <div>
                  <p style={styles.cardEyebrow}>Registre des lots</p>
                  <h2 style={styles.cardTitle}>Lots existants</h2>
                  <p style={styles.cardSubtitle}>
                    {formatNumber(filteredRows.length)} lot
                    {filteredRows.length > 1 ? "s" : ""} affiché
                    {q.trim() ? " après filtrage" : ""}.
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

              <div style={styles.searchWrap}>
                <input
                  value={q}
                  onChange={(event) => setQ(event.target.value)}
                  placeholder="Rechercher par référence, type, statut, bâtiment, propriétaire..."
                  style={styles.searchInput}
                />
              </div>

              <div style={styles.tableWrap}>
                <div style={styles.tableScroll}>
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th style={styles.th}>Lot</th>
                        <th style={styles.th}>Type</th>
                        <th style={styles.th}>Statut</th>
                        <th style={styles.th}>Surface</th>
                        <th style={styles.th}>Tantièmes</th>
                        <th style={styles.th}>Propriétaire</th>
                        <th style={styles.thRight}>Actions</th>
                      </tr>
                    </thead>

                    <tbody>
                      {loading ? (
                        <tr>
                          <td style={styles.empty} colSpan={7}>
                            Chargement des lots...
                          </td>
                        </tr>
                      ) : filteredRows.length === 0 ? (
                        <tr>
                          <td style={styles.empty} colSpan={7}>
                            Aucun lot trouvé.
                          </td>
                        </tr>
                      ) : (
                        filteredRows.map((item) => {
                          const actionBusy = actionLoadingId === item.id;
                          const tantiemes = toNumber(item.total_tantiemes_value);

                          return (
                            <tr key={item.id}>
                              <td style={styles.td}>
                                <p style={styles.rowTitle}>{getLotLabel(item)}</p>
                                <p style={styles.muted}>
                                  {item.batiment || "Bâtiment non renseigné"}
                                  {item.etage ? ` · Étage ${item.etage}` : ""}
                                  {item.porte ? ` · Porte ${item.porte}` : ""}
                                </p>
                              </td>

                              <td style={styles.td}>{typeLotLabel(item.type_lot)}</td>

                              <td style={styles.td}>
                                <span
                                  style={badgeStyle(
                                    statutTone(item.statut, item.actif),
                                  )}
                                >
                                  {item.actif ? statutLabel(item.statut) : "Inactif"}
                                </span>
                              </td>

                              <td style={styles.td}>
                                {item.surface ? `${item.surface} m²` : "—"}
                              </td>

                              <td style={styles.td}>
                                <p style={styles.rowTitle}>
                                  {formatNumber(tantiemes)}
                                </p>
                                <p style={styles.muted}>
                                  {tantiemes > 0
                                    ? "Renseigné"
                                    : "À compléter dans Tantièmes"}
                                </p>
                              </td>

                              <td style={styles.td}>
                                {item.proprietaire_principal_display || "—"}
                              </td>

                              <td style={styles.tdRight}>
                                <div
                                  style={{
                                    display: "flex",
                                    justifyContent: "flex-end",
                                    flexWrap: "wrap",
                                    gap: 8,
                                  }}
                                >
                                  <button
                                    type="button"
                                    onClick={() => edit(item)}
                                    style={{
                                      ...styles.buttonNeutral,
                                      minHeight: 34,
                                      fontSize: 12,
                                    }}
                                  >
                                    Modifier
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => void toggle(item)}
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
                                </div>
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
              <h2 style={styles.sideTitle}>Lot = unité centrale</h2>
              <p style={styles.sideText}>
                Le lot est utilisé dans les charges, les paiements, les relances,
                les présences en AG, les votes, les tantièmes et le futur espace
                copropriétaire.
              </p>
            </div>

            <div style={styles.sideCardBlue}>
              <p style={{ ...styles.sideEyebrow, color: "#4f46e5" }}>
                Contrôle référentiel
              </p>
              <h3 style={{ ...styles.sideTitle, color: "#312e81" }}>
                Tantièmes à surveiller
              </h3>
              <p style={{ ...styles.sideText, color: "#4338ca" }}>
                Un lot sans tantième peut fausser la répartition des charges, le
                quorum AG et le poids des votes. Les lots à 0 doivent être revus.
              </p>
            </div>

            <div style={styles.sideCardGreen}>
              <p style={{ ...styles.sideEyebrow, color: "#047857" }}>
                Synthèse rapide
              </p>
              <h3 style={{ ...styles.sideTitle, color: "#064e3b" }}>
                {formatNumber(stats.actifs)} lot{stats.actifs > 1 ? "s" : ""} actif
                {stats.actifs > 1 ? "s" : ""}
              </h3>

              <div style={styles.checklist}>
                <div style={styles.checklistItem}>
                  <span style={styles.checklistLabel}>Total</span>
                  <span style={styles.checklistValue}>
                    {formatNumber(stats.total)}
                  </span>
                </div>

                <div style={styles.checklistItem}>
                  <span style={styles.checklistLabel}>Inactifs</span>
                  <span style={styles.checklistValue}>
                    {formatNumber(stats.inactifs)}
                  </span>
                </div>

                <div style={styles.checklistItem}>
                  <span style={styles.checklistLabel}>Surface totale</span>
                  <span style={styles.checklistValue}>
                    {formatNumber(stats.totalSurface)} m²
                  </span>
                </div>

                <div style={{ ...styles.checklistItem, borderBottom: "none" }}>
                  <span style={styles.checklistLabel}>Total tantièmes</span>
                  <span style={styles.checklistValue}>
                    {formatNumber(stats.totalTantiemes)}
                  </span>
                </div>
              </div>
            </div>

            <div style={styles.sideCardAmber}>
              <p style={{ ...styles.sideEyebrow, color: "#b45309" }}>
                Point de vigilance
              </p>
              <h3 style={{ ...styles.sideTitle, color: "#92400e" }}>
                Affectations propriétaires
              </h3>
              <p style={{ ...styles.sideText, color: "#92400e" }}>
                La fiche lot affiche le propriétaire principal si l’API le renvoie.
                L’affectation détaillée propriétaire-lot devra rester contrôlée
                par une table dédiée.
              </p>
            </div>
          </aside>
        </div>
      </section>
    </div>
  );
}