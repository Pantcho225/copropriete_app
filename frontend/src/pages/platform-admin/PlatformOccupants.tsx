// frontend/src/pages/platform-admin/PlatformOccupants.tsx
import type { CSSProperties, FormEvent } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";

import api from "../../api/axios";
import { ENDPOINTS } from "../../api/endpoints";

type Lot = {
  id: number;
  reference: string;
  numero?: string;
  label?: string;
  batiment?: string;
  escalier?: string;
  etage?: string;
  porte?: string;
  actif: boolean;
};

type Coproprietaire = {
  id: number;
  display_name?: string;
  nom: string;
  prenom?: string;
  raison_sociale?: string;
  type_personne?: string;
  actif: boolean;
};

type Occupant = {
  id: number;
  copropriete?: number;
  lot: number;
  lot_reference?: string;
  lot_label?: string;
  coproprietaire?: number | null;
  coproprietaire_display?: string;
  nom: string;
  prenom?: string;
  display_name?: string;
  telephone?: string;
  email?: string;
  contact_label?: string;
  statut_occupation: string;
  statut_occupation_label?: string;
  occupant_principal: boolean;
  nombre_occupants?: number | null;
  date_entree?: string | null;
  date_sortie?: string | null;
  contact_urgence_nom?: string;
  contact_urgence_telephone?: string;
  notes?: string;
  actif: boolean;
  is_active?: boolean;
  periode_label?: string;
};

type FormState = {
  id?: number;
  lot: string;
  coproprietaire: string;
  nom: string;
  prenom: string;
  telephone: string;
  email: string;
  statut_occupation: string;
  occupant_principal: boolean;
  nombre_occupants: string;
  date_entree: string;
  date_sortie: string;
  contact_urgence_nom: string;
  contact_urgence_telephone: string;
  notes: string;
  actif: boolean;
};

type Tone = "success" | "warning" | "danger" | "neutral" | "info";

const initialForm: FormState = {
  lot: "",
  coproprietaire: "",
  nom: "",
  prenom: "",
  telephone: "",
  email: "",
  statut_occupation: "PROPRIETAIRE_OCCUPANT",
  occupant_principal: true,
  nombre_occupants: "",
  date_entree: "",
  date_sortie: "",
  contact_urgence_nom: "",
  contact_urgence_telephone: "",
  notes: "",
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
    maxWidth: 960,
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
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 16,
  },
  formGridTwo: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
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
    minWidth: 1220,
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

function displayLot(item: Lot): string {
  return item.label || item.reference || item.numero || `Lot #${item.id}`;
}

function displayCoproprietaire(item: Coproprietaire): string {
  if (item.display_name) return item.display_name;
  if (item.type_personne === "MORALE") return item.raison_sociale || item.nom;
  return `${item.prenom || ""} ${item.nom || ""}`.trim() || `#${item.id}`;
}

function displayOccupant(item: Occupant): string {
  return item.display_name || `${item.prenom || ""} ${item.nom || ""}`.trim();
}

function statutOccupationLabel(value?: string | null): string {
  if (value === "PROPRIETAIRE_OCCUPANT") return "Propriétaire occupant";
  if (value === "LOCATAIRE") return "Locataire";
  if (value === "AYANT_DROIT") return "Ayant droit";
  if (value === "AUTRE") return "Autre";
  return value || "Non défini";
}

function statutTone(value?: string | null, actif?: boolean): Tone {
  if (!actif) return "neutral";
  if (value === "PROPRIETAIRE_OCCUPANT") return "success";
  if (value === "LOCATAIRE") return "info";
  if (value === "AYANT_DROIT") return "warning";
  return "neutral";
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

function normalizeIntegerField(value: string): number | null {
  const trimmed = value.trim();

  if (!trimmed) return null;

  const parsed = Number(trimmed);

  if (!Number.isFinite(parsed)) return null;

  return Math.max(1, Math.trunc(parsed));
}

export default function PlatformOccupants() {
  const [rows, setRows] = useState<Occupant[]>([]);
  const [lots, setLots] = useState<Lot[]>([]);
  const [coproprietaires, setCoproprietaires] = useState<Coproprietaire[]>([]);
  const [form, setForm] = useState<FormState>(initialForm);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);
  const [error, setError] = useState("");

  const activeCoproId = getActiveCoproId();

  const stats = useMemo(() => {
    const actifs = rows.filter((item) => item.actif && item.date_sortie == null).length;
    const inactifs = rows.filter((item) => !item.actif || item.date_sortie).length;
    const principaux = rows.filter((item) => item.occupant_principal).length;
    const totalOccupantsDeclares = rows.reduce((total, item) => {
      return total + (item.nombre_occupants ?? 0);
    }, 0);

    return {
      total: rows.length,
      actifs,
      inactifs,
      principaux,
      totalOccupantsDeclares,
    };
  }, [rows]);

  const filteredRows = useMemo(() => {
    const query = q.trim();

    if (!query) return rows;

    return rows.filter((item) => {
      return (
        includesText(displayOccupant(item), query) ||
        includesText(item.telephone, query) ||
        includesText(item.email, query) ||
        includesText(item.lot_reference, query) ||
        includesText(item.lot_label, query) ||
        includesText(item.coproprietaire_display, query) ||
        includesText(item.statut_occupation_label, query) ||
        includesText(statutOccupationLabel(item.statut_occupation), query) ||
        includesText(item.contact_urgence_nom, query) ||
        includesText(item.contact_urgence_telephone, query)
      );
    });
  }, [q, rows]);

  const canSubmit = useMemo(() => {
    return form.lot.trim().length > 0 && form.nom.trim().length > 0;
  }, [form.lot, form.nom]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const params = {
        ...(activeCoproId ? { copropriete: activeCoproId } : {}),
      };

      const [occupantsResponse, lotsResponse, coproprietairesResponse] =
        await Promise.all([
          api.get(ENDPOINTS.platform.occupantsLots, { params }),
          api.get(ENDPOINTS.platform.lots, { params }),
          api.get(ENDPOINTS.platform.coproprietaires, { params }),
        ]);

      setRows(extractRows<Occupant>(occupantsResponse.data));
      setLots(extractRows<Lot>(lotsResponse.data));
      setCoproprietaires(extractRows<Coproprietaire>(coproprietairesResponse.data));
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

  function edit(item: Occupant) {
    setForm({
      id: item.id,
      lot: item.lot ? String(item.lot) : "",
      coproprietaire: item.coproprietaire ? String(item.coproprietaire) : "",
      nom: item.nom || "",
      prenom: item.prenom || "",
      telephone: item.telephone || "",
      email: item.email || "",
      statut_occupation: item.statut_occupation || "PROPRIETAIRE_OCCUPANT",
      occupant_principal: item.occupant_principal,
      nombre_occupants:
        item.nombre_occupants !== null && item.nombre_occupants !== undefined
          ? String(item.nombre_occupants)
          : "",
      date_entree: item.date_entree || "",
      date_sortie: item.date_sortie || "",
      contact_urgence_nom: item.contact_urgence_nom || "",
      contact_urgence_telephone: item.contact_urgence_telephone || "",
      notes: item.notes || "",
      actif: item.actif,
    });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canSubmit) {
      setError("Le lot et le nom de l’occupant sont obligatoires.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const payload = {
        lot: Number(form.lot),
        coproprietaire: form.coproprietaire ? Number(form.coproprietaire) : null,
        nom: form.nom.trim(),
        prenom: form.prenom.trim(),
        telephone: form.telephone.trim(),
        email: form.email.trim(),
        statut_occupation: form.statut_occupation,
        occupant_principal: form.occupant_principal,
        nombre_occupants: normalizeIntegerField(form.nombre_occupants),
        date_entree: form.date_entree || null,
        date_sortie: form.date_sortie || null,
        contact_urgence_nom: form.contact_urgence_nom.trim(),
        contact_urgence_telephone: form.contact_urgence_telephone.trim(),
        notes: form.notes.trim(),
        actif: form.actif,
        ...(activeCoproId ? { copropriete: activeCoproId } : {}),
      };

      if (form.id) {
        await api.patch(ENDPOINTS.platform.occupantLotDetail(form.id), payload);
      } else {
        await api.post(ENDPOINTS.platform.occupantsLots, payload);
      }

      setForm(initialForm);
      await loadData();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function cloturer(item: Occupant) {
    setActionLoadingId(item.id);
    setError("");

    try {
      await api.post(ENDPOINTS.platform.occupantLotCloturer(item.id));
      await loadData();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setActionLoadingId(null);
    }
  }

  async function rouvrir(item: Occupant) {
    setActionLoadingId(item.id);
    setError("");

    try {
      await api.post(ENDPOINTS.platform.occupantLotRouvrir(item.id));
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
              <h1 style={styles.title}>Occupants & habitants</h1>
              <p style={styles.heroText}>
                Gérez les personnes qui habitent réellement les lots : propriétaire
                occupant, locataire, ayant droit ou autre. Ce registre complète la
                fiche propriétaire sans collecter inutilement le nom de tous les
                membres du foyer.
              </p>
            </div>
          </div>

          <div style={styles.statsGrid}>
            <div style={styles.statCard}>
              <p style={styles.statLabel}>Fiches occupants</p>
              <p style={styles.statValue}>{formatNumber(stats.total)}</p>
              <p style={styles.statHint}>Occupations historisées</p>
            </div>

            <div style={styles.statCard}>
              <p style={{ ...styles.statLabel, color: "#bbf7d0" }}>Actifs</p>
              <p style={styles.statValue}>{formatNumber(stats.actifs)}</p>
              <p style={{ ...styles.statHint, color: "#dcfce7" }}>
                Habitants actuellement déclarés
              </p>
            </div>

            <div style={styles.statCard}>
              <p style={{ ...styles.statLabel, color: "#e2e8f0" }}>Clôturés</p>
              <p style={styles.statValue}>{formatNumber(stats.inactifs)}</p>
              <p style={styles.statHint}>Sorties ou fiches inactives</p>
            </div>

            <div style={styles.statCard}>
              <p style={styles.statLabel}>Occupants principaux</p>
              <p style={styles.statValue}>{formatNumber(stats.principaux)}</p>
              <p style={styles.statHint}>Fiches principales par lot</p>
            </div>

            <div style={styles.statCard}>
              <p style={styles.statLabel}>Total déclaré</p>
              <p style={styles.statValue}>
                {formatNumber(stats.totalOccupantsDeclares)}
              </p>
              <p style={styles.statHint}>Nombre d’occupants déclaré</p>
            </div>
          </div>
        </div>

        <div style={styles.content}>
          <main style={styles.main}>
            <section style={styles.card}>
              <div style={styles.cardHeader}>
                <div>
                  <p style={styles.cardEyebrow}>Fiche occupant</p>
                  <h2 style={styles.cardTitle}>
                    {form.id ? "Modifier un occupant" : "Nouvel occupant"}
                  </h2>
                  <p style={styles.cardSubtitle}>
                    Renseignez l’occupant principal ou l’habitant de référence du
                    lot. Pour la première version, on conserve le nombre total
                    d’occupants sans lister toute la composition du foyer.
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
                      <span style={styles.label}>Lot occupé *</span>
                      <select
                        value={form.lot}
                        onChange={(event) => update("lot", event.target.value)}
                        required
                        style={styles.select}
                      >
                        <option value="">Sélectionner un lot</option>
                        {lots.map((lot) => (
                          <option key={lot.id} value={lot.id}>
                            {displayLot(lot)}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label style={styles.field}>
                      <span style={styles.label}>Copropriétaire lié</span>
                      <select
                        value={form.coproprietaire}
                        onChange={(event) =>
                          update("coproprietaire", event.target.value)
                        }
                        style={styles.select}
                      >
                        <option value="">Aucun rattachement direct</option>
                        {coproprietaires.map((item) => (
                          <option key={item.id} value={item.id}>
                            {displayCoproprietaire(item)}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label style={styles.field}>
                      <span style={styles.label}>Statut d’occupation</span>
                      <select
                        value={form.statut_occupation}
                        onChange={(event) =>
                          update("statut_occupation", event.target.value)
                        }
                        style={styles.select}
                      >
                        <option value="PROPRIETAIRE_OCCUPANT">
                          Propriétaire occupant
                        </option>
                        <option value="LOCATAIRE">Locataire</option>
                        <option value="AYANT_DROIT">Ayant droit</option>
                        <option value="AUTRE">Autre</option>
                      </select>
                    </label>

                    <label style={styles.field}>
                      <span style={styles.label}>Nom *</span>
                      <input
                        value={form.nom}
                        onChange={(event) => update("nom", event.target.value)}
                        placeholder="Nom de l’occupant"
                        required
                        style={styles.input}
                      />
                    </label>

                    <label style={styles.field}>
                      <span style={styles.label}>Prénom</span>
                      <input
                        value={form.prenom}
                        onChange={(event) => update("prenom", event.target.value)}
                        placeholder="Prénom"
                        style={styles.input}
                      />
                    </label>

                    <label style={styles.field}>
                      <span style={styles.label}>Téléphone</span>
                      <input
                        value={form.telephone}
                        onChange={(event) => update("telephone", event.target.value)}
                        placeholder="+225 ..."
                        style={styles.input}
                      />
                    </label>

                    <label style={styles.field}>
                      <span style={styles.label}>Email</span>
                      <input
                        value={form.email}
                        onChange={(event) => update("email", event.target.value)}
                        placeholder="email@exemple.com"
                        type="email"
                        style={styles.input}
                      />
                    </label>

                    <label style={styles.field}>
                      <span style={styles.label}>Nombre d’occupants</span>
                      <input
                        value={form.nombre_occupants}
                        onChange={(event) =>
                          update("nombre_occupants", event.target.value)
                        }
                        placeholder="Ex. 4"
                        type="number"
                        min="1"
                        step="1"
                        style={styles.input}
                      />
                    </label>

                    <label style={styles.field}>
                      <span style={styles.label}>Date d’entrée</span>
                      <input
                        value={form.date_entree}
                        onChange={(event) =>
                          update("date_entree", event.target.value)
                        }
                        type="date"
                        style={styles.input}
                      />
                    </label>

                    <label style={styles.field}>
                      <span style={styles.label}>Date de sortie</span>
                      <input
                        value={form.date_sortie}
                        onChange={(event) =>
                          update("date_sortie", event.target.value)
                        }
                        type="date"
                        style={styles.input}
                      />
                    </label>

                    <label style={styles.field}>
                      <span style={styles.label}>Contact urgence</span>
                      <input
                        value={form.contact_urgence_nom}
                        onChange={(event) =>
                          update("contact_urgence_nom", event.target.value)
                        }
                        placeholder="Nom du contact"
                        style={styles.input}
                      />
                    </label>

                    <label style={styles.field}>
                      <span style={styles.label}>Téléphone urgence</span>
                      <input
                        value={form.contact_urgence_telephone}
                        onChange={(event) =>
                          update("contact_urgence_telephone", event.target.value)
                        }
                        placeholder="+225 ..."
                        style={styles.input}
                      />
                    </label>
                  </div>

                  <div style={styles.formGridTwo}>
                    <label style={styles.field}>
                      <span style={styles.label}>Notes</span>
                      <textarea
                        value={form.notes}
                        onChange={(event) => update("notes", event.target.value)}
                        placeholder="Observations utiles au syndic..."
                        style={styles.textarea}
                      />
                    </label>

                    <div style={styles.softBox}>
                      <p style={styles.cardEyebrow}>Statut de l’occupation</p>

                      <label style={styles.checkboxLine}>
                        <input
                          type="checkbox"
                          checked={form.occupant_principal}
                          onChange={(event) =>
                            update("occupant_principal", event.target.checked)
                          }
                          style={styles.checkbox}
                        />
                        <span>
                          <strong style={{ color: "#0f172a", fontSize: 14 }}>
                            Occupant principal du lot
                          </strong>
                          <p style={styles.helpText}>
                            Un seul occupant principal actif est autorisé par lot.
                          </p>
                        </span>
                      </label>

                      <label style={{ ...styles.checkboxLine, marginTop: 14 }}>
                        <input
                          type="checkbox"
                          checked={form.actif}
                          onChange={(event) => update("actif", event.target.checked)}
                          style={styles.checkbox}
                        />
                        <span>
                          <strong style={{ color: "#0f172a", fontSize: 14 }}>
                            Fiche active
                          </strong>
                          <p style={styles.helpText}>
                            Une fiche clôturée reste dans l’historique.
                          </p>
                        </span>
                      </label>

                      <div style={styles.notice}>
                        La date de sortie clôture automatiquement la fiche côté
                        backend.
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
                            : "Créer l’occupant"}
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            </section>

            <section style={styles.card}>
              <div style={styles.cardHeader}>
                <div>
                  <p style={styles.cardEyebrow}>Registre occupants</p>
                  <h2 style={styles.cardTitle}>Occupants déclarés</h2>
                  <p style={styles.cardSubtitle}>
                    {formatNumber(filteredRows.length)} fiche
                    {filteredRows.length > 1 ? "s" : ""} affichée
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
                  placeholder="Rechercher par occupant, lot, statut, contact, copropriétaire..."
                  style={styles.searchInput}
                />
              </div>

              <div style={styles.tableWrap}>
                <div style={styles.tableScroll}>
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th style={styles.th}>Occupant</th>
                        <th style={styles.th}>Lot</th>
                        <th style={styles.th}>Statut</th>
                        <th style={styles.th}>Contact</th>
                        <th style={styles.th}>Copropriétaire lié</th>
                        <th style={styles.th}>Nombre</th>
                        <th style={styles.th}>Période</th>
                        <th style={styles.th}>État</th>
                        <th style={styles.thRight}>Actions</th>
                      </tr>
                    </thead>

                    <tbody>
                      {loading ? (
                        <tr>
                          <td style={styles.empty} colSpan={9}>
                            Chargement des occupants...
                          </td>
                        </tr>
                      ) : filteredRows.length === 0 ? (
                        <tr>
                          <td style={styles.empty} colSpan={9}>
                            Aucun occupant trouvé.
                          </td>
                        </tr>
                      ) : (
                        filteredRows.map((item) => {
                          const active = item.actif && !item.date_sortie;
                          const actionBusy = actionLoadingId === item.id;

                          return (
                            <tr key={item.id}>
                              <td style={styles.td}>
                                <p style={styles.rowTitle}>{displayOccupant(item)}</p>
                                <p style={styles.muted}>
                                  {item.occupant_principal
                                    ? "Occupant principal"
                                    : "Occupant secondaire"}
                                </p>
                              </td>

                              <td style={styles.td}>
                                <p style={styles.rowTitle}>
                                  {item.lot_label || item.lot_reference || item.lot}
                                </p>
                                <p style={styles.muted}>Lot occupé</p>
                              </td>

                              <td style={styles.td}>
                                <span
                                  style={badgeStyle(
                                    statutTone(item.statut_occupation, active),
                                  )}
                                >
                                  {item.statut_occupation_label ||
                                    statutOccupationLabel(item.statut_occupation)}
                                </span>
                              </td>

                              <td style={styles.td}>
                                <p style={styles.rowTitle}>
                                  {item.telephone || "Téléphone non renseigné"}
                                </p>
                                <p style={styles.muted}>
                                  {item.email || "Email non renseigné"}
                                </p>
                              </td>

                              <td style={styles.td}>
                                <p style={styles.rowTitle}>
                                  {item.coproprietaire_display || "Non rattaché"}
                                </p>
                                <p style={styles.muted}>Référence propriétaire</p>
                              </td>

                              <td style={styles.td}>
                                {item.nombre_occupants
                                  ? formatNumber(item.nombre_occupants)
                                  : "—"}
                              </td>

                              <td style={styles.td}>
                                <p style={styles.rowTitle}>
                                  {item.periode_label || "Non renseignée"}
                                </p>
                                <p style={styles.muted}>
                                  {item.date_entree || "—"} →{" "}
                                  {item.date_sortie || "en cours"}
                                </p>
                              </td>

                              <td style={styles.td}>
                                <span style={badgeStyle(active ? "success" : "neutral")}>
                                  {active ? "Actif" : "Clôturé"}
                                </span>
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

                                  {active ? (
                                    <button
                                      type="button"
                                      onClick={() => void cloturer(item)}
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
                                      {actionBusy ? "Traitement..." : "Clôturer"}
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => void rouvrir(item)}
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
                                      {actionBusy ? "Traitement..." : "Rouvrir"}
                                    </button>
                                  )}
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
              <h2 style={styles.sideTitle}>Habitant réel du lot</h2>
              <p style={styles.sideText}>
                Cette page sert à identifier qui habite réellement dans le lot,
                sans confondre cette personne avec le propriétaire juridique.
              </p>
            </div>

            <div style={styles.sideCardBlue}>
              <p style={styles.sideEyebrow}>Informations retenues</p>
              <h2 style={styles.sideTitle}>Version équilibrée</h2>

              <div style={styles.checklist}>
                <div style={styles.checklistItem}>
                  <span style={styles.checklistLabel}>Occupant principal</span>
                  <span style={styles.checklistValue}>Oui</span>
                </div>
                <div style={styles.checklistItem}>
                  <span style={styles.checklistLabel}>Statut occupation</span>
                  <span style={styles.checklistValue}>Oui</span>
                </div>
                <div style={styles.checklistItem}>
                  <span style={styles.checklistLabel}>Contact</span>
                  <span style={styles.checklistValue}>Oui</span>
                </div>
                <div style={styles.checklistItem}>
                  <span style={styles.checklistLabel}>Nombre occupants</span>
                  <span style={styles.checklistValue}>Oui</span>
                </div>
                <div style={styles.checklistItem}>
                  <span style={styles.checklistLabel}>Tous les noms du foyer</span>
                  <span style={styles.checklistValue}>Non</span>
                </div>
              </div>
            </div>

            <div style={styles.sideCardAmber}>
              <p style={styles.sideEyebrow}>Protection</p>
              <h2 style={styles.sideTitle}>Pas trop intrusif</h2>
              <p style={styles.sideText}>
                Le SaaS conserve l’information utile au syndic sans devenir trop
                intrusif : on enregistre l’occupant principal et le nombre total
                d’occupants, pas toute la composition familiale.
              </p>
            </div>

            <div style={styles.sideCardGreen}>
              <p style={styles.sideEyebrow}>Utilité</p>
              <h2 style={styles.sideTitle}>Interventions & communication</h2>
              <p style={styles.sideText}>
                Ces données serviront aux signalements, notifications, visites
                techniques, urgences, travaux et communication quotidienne.
              </p>
            </div>
          </aside>
        </div>
      </section>
    </div>
  );
}