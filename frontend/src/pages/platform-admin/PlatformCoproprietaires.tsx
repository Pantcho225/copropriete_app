// frontend/src/pages/platform-admin/PlatformCoproprietaires.tsx
import type { CSSProperties, FormEvent } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";

import api from "../../api/axios";
import { ENDPOINTS } from "../../api/endpoints";
import ModuleHero from "../../components/ui/ModuleHero";
import ModuleStatCard from "../../components/ui/ModuleStatCard";

type Coproprietaire = {
  id: number;
  type_personne: string;
  civilite?: string;
  nom: string;
  prenom?: string;
  raison_sociale?: string;
  display_name?: string;
  email?: string;
  telephone?: string;
  ville?: string;
  pays?: string;
  actif: boolean;
  lots_actifs_count?: number;
  occupants_declares_count?: number;
  has_user_access?: boolean;
  user_account_email?: string | null;
  user_account_username?: string | null;
};

type FormState = {
  id?: number;
  type_personne: "PHYSIQUE" | "MORALE";
  civilite: string;
  nom: string;
  prenom: string;
  raison_sociale: string;
  email: string;
  telephone: string;
  adresse: string;
  ville: string;
  pays: string;
  actif: boolean;
  create_user_access: boolean;
  access_email: string;
  access_phone: string;
};

type Tone = "success" | "warning" | "danger" | "neutral" | "info";

const initialForm: FormState = {
  type_personne: "PHYSIQUE",
  civilite: "",
  nom: "",
  prenom: "",
  raison_sociale: "",
  email: "",
  telephone: "",
  adresse: "",
  ville: "Abidjan",
  pays: "Côte d'Ivoire",
  actif: true,
  create_user_access: false,
  access_email: "",
  access_phone: "",
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
    minHeight: 92,
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
  accessBox: {
    marginTop: 18,
    border: "1px solid #bbf7d0",
    borderRadius: 24,
    background: "#ecfdf5",
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
    minWidth: 1120,
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

function getDisplayName(item: Coproprietaire): string {
  if (item.display_name) return item.display_name;

  if (item.type_personne === "MORALE") {
    return item.raison_sociale || item.nom || "Personne morale";
  }

  return `${item.prenom || ""} ${item.nom || ""}`.trim() || "Copropriétaire";
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

function isValidEmail(value: string): boolean {
  if (!value.trim()) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export default function PlatformCoproprietaires() {
  const [rows, setRows] = useState<Coproprietaire[]>([]);
  const [form, setForm] = useState<FormState>(initialForm);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);
  const [accessLoadingId, setAccessLoadingId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const activeCoproId = getActiveCoproId();

  const stats = useMemo(() => {
    const actifs = rows.filter((item) => item.actif).length;
    const inactifs = rows.filter((item) => !item.actif).length;
    const lots = rows.reduce((total, item) => {
      return total + (item.lots_actifs_count ?? 0);
    }, 0);
    const residents = rows.reduce((total, item) => {
      return total + (item.occupants_declares_count ?? 0);
    }, 0);
    const acces = rows.filter((item) => item.has_user_access).length;

    return {
      total: rows.length,
      actifs,
      inactifs,
      lots,
      residents,
      acces,
    };
  }, [rows]);

  const filteredRows = useMemo(() => {
    const query = q.trim();

    if (!query) return rows;

    return rows.filter((item) => {
      return (
        includesText(getDisplayName(item), query) ||
        includesText(item.email, query) ||
        includesText(item.telephone, query) ||
        includesText(item.ville, query) ||
        includesText(item.pays, query) ||
        includesText(item.lots_actifs_count, query) ||
        includesText(item.occupants_declares_count, query) ||
        includesText(item.actif ? "actif" : "inactif", query) ||
        includesText(item.has_user_access ? "accès" : "sans accès", query)
      );
    });
  }, [q, rows]);

  const canSubmit = useMemo(() => {
    const hasName =
      form.type_personne === "MORALE"
        ? form.raison_sociale.trim().length > 0 || form.nom.trim().length > 0
        : form.nom.trim().length > 0;

    return hasName && isValidEmail(form.email) && isValidEmail(form.access_email);
  }, [
    form.access_email,
    form.email,
    form.nom,
    form.raison_sociale,
    form.type_personne,
  ]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await api.get(ENDPOINTS.platform.coproprietaires, {
        params: {
          ...(activeCoproId ? { copropriete: activeCoproId } : {}),
        },
      });

      setRows(extractRows<Coproprietaire>(response.data));
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
    setForm((previous) => {
      const next = { ...previous, [key]: value };

      if (key === "email" && !previous.access_email) {
        next.access_email = String(value);
      }

      if (key === "telephone" && !previous.access_phone) {
        next.access_phone = String(value);
      }

      return next;
    });
  }

  function resetForm() {
    setForm(initialForm);
  }

  function edit(item: Coproprietaire) {
    setNotice("");
    setForm({
      id: item.id,
      type_personne: item.type_personne === "MORALE" ? "MORALE" : "PHYSIQUE",
      civilite: item.civilite || "",
      nom: item.nom || "",
      prenom: item.prenom || "",
      raison_sociale: item.raison_sociale || "",
      email: item.email || "",
      telephone: item.telephone || "",
      adresse: "",
      ville: item.ville || "Abidjan",
      pays: item.pays || "Côte d'Ivoire",
      actif: item.actif,
      create_user_access: false,
      access_email: item.email || "",
      access_phone: item.telephone || "",
    });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canSubmit) {
      setError("Veuillez renseigner les champs obligatoires et vérifier les emails.");
      return;
    }

    setSaving(true);
    setError("");
    setNotice("");

    try {
      const payload = {
        type_personne: form.type_personne,
        civilite: form.civilite.trim(),
        nom: form.nom.trim(),
        prenom: form.prenom.trim(),
        raison_sociale: form.raison_sociale.trim(),
        email: form.email.trim(),
        telephone: form.telephone.trim(),
        adresse: form.adresse.trim(),
        ville: form.ville.trim(),
        pays: form.pays.trim(),
        actif: form.actif,
        ...(activeCoproId ? { copropriete: activeCoproId } : {}),
      };

      let savedId = form.id;

      if (form.id) {
        await api.patch(ENDPOINTS.platform.coproprietaireDetail(form.id), payload);
      } else {
        const response = await api.post(ENDPOINTS.platform.coproprietaires, payload);
        const created = response.data as { id?: number };
        savedId = created.id;
      }

      if (form.create_user_access && savedId) {
        const accessResponse = await api.post(
          `${ENDPOINTS.platform.coproprietaireDetail(savedId)}create-user-access/`,
        );

        const data = accessResponse.data as {
          temporary_password?: string;
          user?: { username?: string; email?: string };
        };

        if (data.temporary_password) {
          setNotice(
            `Accès créé. Identifiant : ${
              data.user?.username || data.user?.email || "voir réponse API"
            } · Mot de passe temporaire : ${data.temporary_password}`,
          );
        } else {
          setNotice("Accès utilisateur copropriétaire créé avec succès.");
        }
      }

      setForm(initialForm);
      await loadData();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function toggle(item: Coproprietaire) {
    setActionLoadingId(item.id);
    setError("");
    setNotice("");

    try {
      const endpoint = item.actif
        ? ENDPOINTS.platform.coproprietaireDesactiver(item.id)
        : ENDPOINTS.platform.coproprietaireActiver(item.id);

      await api.post(endpoint);
      await loadData();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setActionLoadingId(null);
    }
  }

  async function createAccess(item: Coproprietaire) {
    setAccessLoadingId(item.id);
    setError("");
    setNotice("");

    try {
      const response = await api.post(
        `${ENDPOINTS.platform.coproprietaireDetail(item.id)}create-user-access/`,
      );

      const data = response.data as {
        temporary_password?: string;
        user?: { username?: string; email?: string };
      };

      if (data.temporary_password) {
        setNotice(
          `Accès créé pour ${getDisplayName(item)}. Identifiant : ${
            data.user?.username || data.user?.email || "voir réponse API"
          } · Mot de passe temporaire : ${data.temporary_password}`,
        );
      } else {
        setNotice(`Accès utilisateur créé pour ${getDisplayName(item)}.`);
      }

      await loadData();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setAccessLoadingId(null);
    }
  }

  return (
    <div style={styles.page}>
      <section style={styles.shell}>
        <ModuleHero
          eyebrow="Super Admin · Référentiel copropriété"
          title="Copropriétaires"
          subtitle="Créez et maintenez les copropriétaires rattachés à la copropriété active. Cette page gère le propriétaire juridique du lot ; les résidents réellement présents dans les logements sont suivis dans une page dédiée."
        >
          <div className="moduleStatsGrid">
            <ModuleStatCard
              label="Copropriétaires"
              value={formatNumber(stats.total)}
              hint="Fiches référentielles enregistrées"
              tone="blue"
            />
            <ModuleStatCard
              label="Actifs"
              value={formatNumber(stats.actifs)}
              hint="Exploitables dans les modules métier"
              tone="green"
            />
            <ModuleStatCard
              label="Inactifs"
              value={formatNumber(stats.inactifs)}
              hint="Fiches désactivées"
              tone="neutral"
            />
            <ModuleStatCard
              label="Lots liés"
              value={formatNumber(stats.lots)}
              hint="Lots actifs rattachés"
              tone="purple"
            />
            <ModuleStatCard
              label="Résidents"
              value={formatNumber(stats.residents)}
              hint="Résidents actifs déclarés"
              tone="amber"
            />
            <ModuleStatCard
              label="Accès"
              value={formatNumber(stats.acces)}
              hint="Comptes copropriétaires créés"
              tone="blue"
            />
          </div>
        </ModuleHero>

        <div style={styles.content}>
          <main style={styles.main}>
            <section style={styles.card}>
              <div style={styles.cardHeader}>
                <div>
                  <p style={styles.cardEyebrow}>Fiche copropriétaire</p>
                  <h2 style={styles.cardTitle}>
                    {form.id ? "Modifier un copropriétaire" : "Nouveau copropriétaire"}
                  </h2>
                  <p style={styles.cardSubtitle}>
                    Renseignez la fiche du propriétaire juridique. Le résident réel
                    du logement sera géré dans le registre des résidents afin de
                    conserver une séparation claire.
                  </p>
                </div>

                <button type="button" onClick={resetForm} style={styles.buttonNeutral}>
                  Réinitialiser
                </button>
              </div>

              <div style={styles.cardBody}>
                {error ? <div style={styles.error}>{error}</div> : null}
                {notice ? <div style={styles.notice}>{notice}</div> : null}

                <form onSubmit={(event) => void submit(event)}>
                  <div style={styles.formGrid}>
                    <label style={styles.field}>
                      <span style={styles.label}>Type de personne</span>
                      <select
                        value={form.type_personne}
                        onChange={(event) =>
                          update(
                            "type_personne",
                            event.target.value as FormState["type_personne"],
                          )
                        }
                        style={styles.select}
                      >
                        <option value="PHYSIQUE">Personne physique</option>
                        <option value="MORALE">Personne morale</option>
                      </select>
                    </label>

                    <label style={styles.field}>
                      <span style={styles.label}>Civilité</span>
                      <input
                        value={form.civilite}
                        onChange={(event) => update("civilite", event.target.value)}
                        placeholder="M., Mme, Dr..."
                        style={styles.input}
                      />
                    </label>

                    <label style={styles.field}>
                      <span style={styles.label}>Nom *</span>
                      <input
                        value={form.nom}
                        onChange={(event) => update("nom", event.target.value)}
                        placeholder="Nom"
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
                      <span style={styles.label}>Raison sociale</span>
                      <input
                        value={form.raison_sociale}
                        onChange={(event) =>
                          update("raison_sociale", event.target.value)
                        }
                        placeholder="SCI, entreprise, société..."
                        style={styles.input}
                      />
                    </label>

                    <label style={styles.field}>
                      <span style={styles.label}>Ville</span>
                      <input
                        value={form.ville}
                        onChange={(event) => update("ville", event.target.value)}
                        placeholder="Abidjan"
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
                      <span style={styles.label}>Téléphone</span>
                      <input
                        value={form.telephone}
                        onChange={(event) => update("telephone", event.target.value)}
                        placeholder="+225 ..."
                        style={styles.input}
                      />
                    </label>

                    <label style={styles.field}>
                      <span style={styles.label}>Pays</span>
                      <input
                        value={form.pays}
                        onChange={(event) => update("pays", event.target.value)}
                        placeholder="Côte d'Ivoire"
                        style={styles.input}
                      />
                    </label>
                  </div>

                  <div style={styles.formGridTwo}>
                    <label style={styles.field}>
                      <span style={styles.label}>Adresse</span>
                      <textarea
                        value={form.adresse}
                        onChange={(event) => update("adresse", event.target.value)}
                        placeholder="Adresse complète, quartier, repères..."
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
                            Copropriétaire actif
                          </strong>
                          <p style={styles.helpText}>
                            Une fiche inactive reste dans l’historique mais ne doit
                            plus être utilisée dans les opérations courantes.
                          </p>
                        </span>
                      </label>
                    </div>
                  </div>

                  <div style={styles.accessBox}>
                    <p style={styles.cardEyebrow}>Accès utilisateur copropriétaire</p>

                    <label style={{ ...styles.checkboxLine, marginTop: 12 }}>
                      <input
                        type="checkbox"
                        checked={form.create_user_access}
                        onChange={(event) =>
                          update("create_user_access", event.target.checked)
                        }
                        style={styles.checkbox}
                      />
                      <span>
                        <strong style={{ color: "#064e3b", fontSize: 14 }}>
                          Créer l’accès utilisateur après l’enregistrement
                        </strong>
                        <p style={{ ...styles.helpText, color: "#047857" }}>
                          Le backend génère un mot de passe temporaire, rattache
                          le rôle COPROPRIETAIRE et impose le changement du mot
                          de passe à la première connexion.
                        </p>
                      </span>
                    </label>

                    {form.create_user_access ? (
                      <div style={styles.formGridTwo}>
                        <label style={styles.field}>
                          <span style={styles.label}>Email de connexion</span>
                          <input
                            value={form.access_email}
                            onChange={(event) =>
                              update("access_email", event.target.value)
                            }
                            placeholder="email@exemple.com"
                            type="email"
                            style={styles.input}
                          />
                        </label>

                        <label style={styles.field}>
                          <span style={styles.label}>Téléphone de notification</span>
                          <input
                            value={form.access_phone}
                            onChange={(event) =>
                              update("access_phone", event.target.value)
                            }
                            placeholder="+225 ..."
                            style={styles.input}
                          />
                        </label>
                      </div>
                    ) : null}

                    <div style={styles.notice}>
                      Conservez le mot de passe temporaire affiché après création :
                      il n’est retourné qu’une seule fois par l’API.
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
                            : "Créer le copropriétaire"}
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            </section>

            <section style={styles.card}>
              <div style={styles.cardHeader}>
                <div>
                  <p style={styles.cardEyebrow}>Registre copropriétaires</p>
                  <h2 style={styles.cardTitle}>Fiches existantes</h2>
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
                  placeholder="Rechercher par nom, email, téléphone, ville, lots ou résidents..."
                  style={styles.searchInput}
                />
              </div>

              <div style={styles.tableWrap}>
                <div style={styles.tableScroll}>
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th style={styles.th}>Nom</th>
                        <th style={styles.th}>Contact</th>
                        <th style={styles.th}>Ville / Pays</th>
                        <th style={styles.th}>Lots actifs</th>
                        <th style={styles.th}>Résidents</th>
                        <th style={styles.th}>Accès</th>
                        <th style={styles.th}>Statut</th>
                        <th style={styles.thRight}>Actions</th>
                      </tr>
                    </thead>

                    <tbody>
                      {loading ? (
                        <tr>
                          <td style={styles.empty} colSpan={8}>
                            Chargement des copropriétaires...
                          </td>
                        </tr>
                      ) : filteredRows.length === 0 ? (
                        <tr>
                          <td style={styles.empty} colSpan={8}>
                            Aucun copropriétaire trouvé.
                          </td>
                        </tr>
                      ) : (
                        filteredRows.map((item) => {
                          const actionBusy = actionLoadingId === item.id;
                          const accessBusy = accessLoadingId === item.id;

                          return (
                            <tr key={item.id}>
                              <td style={styles.td}>
                                <p style={styles.rowTitle}>{getDisplayName(item)}</p>
                                <p style={styles.muted}>
                                  {item.type_personne === "MORALE"
                                    ? "Personne morale"
                                    : "Personne physique"}
                                </p>
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
                                  {item.ville?.trim() || "Ville non renseignée"}
                                </p>
                                <p style={styles.muted}>
                                  {item.pays?.trim() || "Côte d'Ivoire"}
                                </p>
                              </td>

                              <td style={styles.td}>
                                <span style={badgeStyle("info")}>
                                  {formatNumber(item.lots_actifs_count ?? 0)}
                                </span>
                              </td>

                              <td style={styles.td}>
                                <span
                                  style={badgeStyle(
                                    (item.occupants_declares_count ?? 0) > 0
                                      ? "success"
                                      : "neutral",
                                  )}
                                >
                                  {formatNumber(item.occupants_declares_count ?? 0)}
                                </span>
                              </td>

                              <td style={styles.td}>
                                <span
                                  style={badgeStyle(
                                    item.has_user_access ? "success" : "warning",
                                  )}
                                >
                                  {item.has_user_access ? "Créé" : "À créer"}
                                </span>
                                {item.user_account_username ||
                                item.user_account_email ? (
                                  <p style={styles.muted}>
                                    {item.user_account_username ||
                                      item.user_account_email}
                                  </p>
                                ) : null}
                              </td>

                              <td style={styles.td}>
                                <span
                                  style={badgeStyle(item.actif ? "success" : "neutral")}
                                >
                                  {item.actif ? "Actif" : "Inactif"}
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

                                  {!item.has_user_access ? (
                                    <button
                                      type="button"
                                      onClick={() => void createAccess(item)}
                                      disabled={accessBusy || !item.email}
                                      style={{
                                        ...styles.buttonNeutral,
                                        minHeight: 34,
                                        fontSize: 12,
                                        opacity:
                                          accessBusy || !item.email ? 0.65 : 1,
                                        cursor:
                                          accessBusy || !item.email
                                            ? "not-allowed"
                                            : "pointer",
                                      }}
                                    >
                                      {accessBusy ? "Création..." : "Créer accès"}
                                    </button>
                                  ) : null}

                                  <button
                                    type="button"
                                    onClick={() => void toggle(item)}
                                    disabled={actionBusy}
                                    style={{
                                      ...styles.buttonNeutral,
                                      minHeight: 34,
                                      fontSize: 12,
                                      opacity: actionBusy ? 0.65 : 1,
                                      cursor: actionBusy ? "not-allowed" : "pointer",
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
              <h2 style={styles.sideTitle}>Propriétaire ≠ résident</h2>
              <p style={styles.sideText}>
                Le copropriétaire est le propriétaire juridique du lot. Le résident
                est la personne qui habite réellement le logement : propriétaire
                occupant, locataire, ayant droit ou autre personne déclarée.
              </p>
            </div>

            <div style={styles.sideCardBlue}>
              <p style={styles.sideEyebrow}>Référentiel enrichi</p>
              <h2 style={styles.sideTitle}>Informations utiles au syndic</h2>

              <div style={styles.checklist}>
                <div style={styles.checklistItem}>
                  <span style={styles.checklistLabel}>Identité propriétaire</span>
                  <span style={styles.checklistValue}>Oui</span>
                </div>
                <div style={styles.checklistItem}>
                  <span style={styles.checklistLabel}>Contacts</span>
                  <span style={styles.checklistValue}>Oui</span>
                </div>
                <div style={styles.checklistItem}>
                  <span style={styles.checklistLabel}>Lots actifs</span>
                  <span style={styles.checklistValue}>Oui</span>
                </div>
                <div style={styles.checklistItem}>
                  <span style={styles.checklistLabel}>Résidents déclarés</span>
                  <span style={styles.checklistValue}>Oui</span>
                </div>
                <div style={styles.checklistItem}>
                  <span style={styles.checklistLabel}>Accès copropriétaire</span>
                  <span style={styles.checklistValue}>Oui</span>
                </div>
              </div>
            </div>

            <div style={styles.sideCardAmber}>
              <p style={styles.sideEyebrow}>Suite du sprint</p>
              <h2 style={styles.sideTitle}>Registre des résidents</h2>
              <p style={styles.sideText}>
                La page dédiée aux résidents permet de gérer le lot occupé, le
                statut d’occupation, le contact, le nombre de résidents, la date
                d’entrée, la date de sortie et le contact d’urgence.
              </p>
            </div>

            <div style={styles.sideCardGreen}>
              <p style={styles.sideEyebrow}>Sécurité</p>
              <h2 style={styles.sideTitle}>Accès limité</h2>
              <p style={styles.sideText}>
                Les comptes créés depuis cette page doivent rester limités à
                l’espace copropriétaire et ne jamais donner accès au back-office
                Admin React.
              </p>
            </div>
          </aside>
        </div>
      </section>
    </div>
  );
}