// frontend/src/pages/platform-admin/PlatformCoproprietesList.tsx
import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import api from "../../api/axios";
import { ENDPOINTS } from "../../api/endpoints";

type Copropriete = {
  id: number;
  nom: string;
  slug?: string | null;
  ville?: string | null;
  commune?: string | null;
  quartier?: string | null;
  pays?: string | null;
  statut?: string | null;
  is_active?: boolean;
  logo_url?: string | null;
  membres_actifs_count?: number;
  membres_count?: number;
  created_at?: string | null;
  updated_at?: string | null;
};

type StatutTone = "success" | "warning" | "neutral" | "danger" | "info";

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
  },
  content: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) 340px",
    gap: 20,
    padding: 24,
    background: "#f8fafc",
  },
  card: {
    border: "1px solid #e2e8f0",
    borderRadius: 28,
    background: "#ffffff",
    boxShadow: "0 16px 45px rgba(15,23,42,0.05)",
  },
  mainCard: {
    border: "1px solid #e2e8f0",
    borderRadius: 28,
    background: "#ffffff",
    boxShadow: "0 16px 45px rgba(15,23,42,0.05)",
    overflow: "hidden",
  },
  cardHeader: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    padding: 22,
    borderBottom: "1px solid #f1f5f9",
  },
  cardTitle: {
    margin: 0,
    color: "#020617",
    fontSize: 18,
    fontWeight: 950,
    letterSpacing: "-0.02em",
  },
  cardSubtitle: {
    margin: "6px 0 0",
    color: "#64748b",
    fontSize: 13,
    lineHeight: 1.6,
  },
  toolbar: {
    display: "flex",
    flexWrap: "wrap",
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
    boxShadow: "0 1px 0 rgba(15,23,42,0.02)",
  },
  error: {
    margin: "0 22px 20px",
    border: "1px solid #fecaca",
    borderRadius: 18,
    background: "#fef2f2",
    padding: 14,
    color: "#b91c1c",
    fontSize: 13,
    fontWeight: 700,
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
    minWidth: 980,
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
  nameLink: {
    color: "#0f172a",
    fontSize: 14,
    fontWeight: 950,
    textDecoration: "none",
  },
  muted: {
    margin: "5px 0 0",
    color: "#64748b",
    fontSize: 12,
    lineHeight: 1.5,
  },
  strong: {
    margin: 0,
    color: "#0f172a",
    fontSize: 14,
    fontWeight: 900,
  },
  rowActions: {
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "flex-end",
    gap: 8,
    minWidth: 280,
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
  sideLink: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    minHeight: 44,
    border: "1px solid #c7d2fe",
    borderRadius: 17,
    background: "#ffffff",
    padding: "0 14px",
    color: "#4338ca",
    fontSize: 13,
    fontWeight: 900,
    textDecoration: "none",
  },
  empty: {
    padding: 42,
    textAlign: "center",
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

  return "Une erreur est survenue pendant le chargement des copropriétés.";
}

function normalizeStatut(value?: string | null): string {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[ÉÈÊË]/g, "E")
    .replace(/[ÀÂÄ]/g, "A")
    .replace(/[ÎÏ]/g, "I")
    .replace(/[ÔÖ]/g, "O")
    .replace(/[ÛÜÙ]/g, "U");
}

function statutLabel(statut?: string | null, isActive?: boolean): string {
  const normalized = normalizeStatut(statut);

  if (normalized === "ACTIVE" || isActive) return "Active";
  if (normalized === "SUSPENDUE" || normalized === "SUSPENDU") return "Suspendue";
  if (normalized === "ARCHIVEE" || normalized === "ARCHIVE") return "Archivée";
  if (normalized === "BROUILLON") return "Brouillon";
  if (normalized === "INACTIVE") return "Inactive";

  return statut || "Non défini";
}

function statutTone(statut?: string | null, isActive?: boolean): StatutTone {
  const normalized = normalizeStatut(statut);

  if (normalized === "ACTIVE" || isActive) return "success";
  if (normalized === "SUSPENDUE" || normalized === "SUSPENDU") return "warning";
  if (normalized === "ARCHIVEE" || normalized === "ARCHIVE") return "neutral";
  if (normalized === "INACTIVE") return "danger";

  return "info";
}

function badgeStyle(tone: StatutTone): CSSProperties {
  const map: Record<StatutTone, CSSProperties> = {
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

function actionStyle(kind: "neutral" | "primary" | "warning" | "danger"): CSSProperties {
  const base: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 34,
    padding: "0 12px",
    borderRadius: 12,
    fontSize: 12,
    fontWeight: 900,
    textDecoration: "none",
    cursor: "pointer",
    whiteSpace: "nowrap",
  };

  if (kind === "primary") {
    return {
      ...base,
      border: "1px solid #c7d2fe",
      background: "#eef2ff",
      color: "#4338ca",
    };
  }

  if (kind === "warning") {
    return {
      ...base,
      border: "1px solid #fde68a",
      background: "#fffbeb",
      color: "#b45309",
    };
  }

  if (kind === "danger") {
    return {
      ...base,
      border: "1px solid #fecaca",
      background: "#fef2f2",
      color: "#b91c1c",
    };
  }

  return {
    ...base,
    border: "1px solid #e2e8f0",
    background: "#ffffff",
    color: "#334155",
  };
}

function formatDate(value?: string | null): string {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("fr-FR").format(value);
}

function getLocation(item: Copropriete): string {
  const parts = [item.commune, item.quartier].filter(Boolean);

  if (parts.length > 0) return parts.join(" · ");

  return item.ville || "Localisation non renseignée";
}

function isArchived(item: Copropriete): boolean {
  const normalized = normalizeStatut(item.statut);
  return normalized === "ARCHIVEE" || normalized === "ARCHIVE";
}

function isSuspended(item: Copropriete): boolean {
  const normalized = normalizeStatut(item.statut);
  return normalized === "SUSPENDUE" || normalized === "SUSPENDU";
}

function isActiveCopro(item: Copropriete): boolean {
  const normalized = normalizeStatut(item.statut);
  return normalized === "ACTIVE" || Boolean(item.is_active);
}

function includesText(value: string | number | null | undefined, query: string): boolean {
  return String(value ?? "")
    .toLowerCase()
    .includes(query.toLowerCase());
}

function getInitials(value: string): string {
  const parts = value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  const initials = parts.map((part) => part[0]?.toUpperCase() ?? "").join("");

  return initials || "CP";
}

export default function PlatformCoproprietesList() {
  const [rows, setRows] = useState<Copropriete[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);
  const [q, setQ] = useState("");
  const [error, setError] = useState("");

  const stats = useMemo(() => {
    return {
      total: rows.length,
      actives: rows.filter((item) => isActiveCopro(item)).length,
      suspendues: rows.filter((item) => isSuspended(item)).length,
      archivees: rows.filter((item) => isArchived(item)).length,
    };
  }, [rows]);

  const filteredRows = useMemo(() => {
    const query = q.trim();

    if (!query) return rows;

    return rows.filter((item) => {
      return (
        includesText(item.nom, query) ||
        includesText(item.slug, query) ||
        includesText(item.ville, query) ||
        includesText(item.commune, query) ||
        includesText(item.quartier, query) ||
        includesText(item.pays, query) ||
        includesText(statutLabel(item.statut, item.is_active), query)
      );
    });
  }, [q, rows]);

  async function loadData() {
    setLoading(true);
    setError("");

    try {
      const response = await api.get(ENDPOINTS.platform.coproprietes);
      setRows(extractRows<Copropriete>(response.data));
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  async function toggleSuspension(item: Copropriete) {
    const actionLabel = isActiveCopro(item) ? "suspendre" : "réactiver";

    const confirmed = window.confirm(
      `Voulez-vous ${actionLabel} la copropriété « ${item.nom} » ?`,
    );

    if (!confirmed) return;

    setActionLoadingId(item.id);
    setError("");

    try {
      const endpoint = isActiveCopro(item)
        ? ENDPOINTS.platform.coproprieteSuspendre(item.id)
        : ENDPOINTS.platform.coproprieteReactiver(item.id);

      await api.post(endpoint);
      await loadData();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setActionLoadingId(null);
    }
  }

  async function archiver(item: Copropriete) {
    const confirmed = window.confirm(
      `Archiver la copropriété « ${item.nom} » ? Cette action la rendra inactive.`,
    );

    if (!confirmed) return;

    setActionLoadingId(item.id);
    setError("");

    try {
      await api.post(ENDPOINTS.platform.coproprieteArchiver(item.id));
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
              <p style={styles.eyebrow}>Super Admin · Référentiel plateforme</p>
              <h1 style={styles.title}>Copropriétés</h1>
              <p style={styles.heroText}>
                Créez, consultez et administrez les copropriétés clientes depuis
                l’Admin React. Cette page devient le point d’entrée officiel pour
                préparer une copropriété avant son exploitation métier.
              </p>
            </div>

            <div style={styles.actions}>
              <Link to="/platform-admin" style={styles.heroButtonSecondary}>
                Retour plateforme
              </Link>
              <Link
                to="/platform-admin/coproprietes/nouveau"
                style={styles.heroButtonPrimary}
              >
                Nouvelle copropriété
              </Link>
            </div>
          </div>

          <div style={styles.statsGrid}>
            <div style={styles.statCard}>
              <p style={styles.statLabel}>Total supervisé</p>
              <p style={styles.statValue}>{formatNumber(stats.total)}</p>
              <p style={styles.statHint}>Copropriétés enregistrées</p>
            </div>

            <div style={styles.statCard}>
              <p style={{ ...styles.statLabel, color: "#bbf7d0" }}>Actives</p>
              <p style={styles.statValue}>{formatNumber(stats.actives)}</p>
              <p style={{ ...styles.statHint, color: "#dcfce7" }}>
                Exploitation ouverte
              </p>
            </div>

            <div style={styles.statCard}>
              <p style={{ ...styles.statLabel, color: "#fde68a" }}>
                Suspendues
              </p>
              <p style={styles.statValue}>{formatNumber(stats.suspendues)}</p>
              <p style={{ ...styles.statHint, color: "#fef3c7" }}>
                À suivre côté plateforme
              </p>
            </div>

            <div style={styles.statCard}>
              <p style={styles.statLabel}>Archivées</p>
              <p style={styles.statValue}>{formatNumber(stats.archivees)}</p>
              <p style={styles.statHint}>Hors exploitation courante</p>
            </div>
          </div>
        </div>

        <div style={styles.content}>
          <div style={styles.mainCard}>
            <div style={styles.cardHeader}>
              <div>
                <h2 style={styles.cardTitle}>Registre des copropriétés</h2>
                <p style={styles.cardSubtitle}>
                  {formatNumber(filteredRows.length)} résultat
                  {filteredRows.length > 1 ? "s" : ""} affiché
                  {q.trim() ? " après filtrage" : ""}.
                </p>
              </div>

              <div style={styles.toolbar}>
                <button
                  type="button"
                  onClick={() => void loadData()}
                  disabled={loading}
                  style={{
                    ...styles.buttonNeutral,
                    opacity: loading ? 0.65 : 1,
                  }}
                >
                  {loading ? "Chargement..." : "Rafraîchir"}
                </button>
                <Link
                  to="/platform-admin/coproprietes/nouveau"
                  style={styles.buttonPrimary}
                >
                  Ajouter une copropriété
                </Link>
              </div>
            </div>

            <div style={styles.searchWrap}>
              <input
                value={q}
                onChange={(event) => setQ(event.target.value)}
                placeholder="Rechercher par nom, ville, commune, quartier, pays ou statut..."
                style={styles.searchInput}
              />
            </div>

            {error ? <div style={styles.error}>{error}</div> : null}

            <div style={styles.tableWrap}>
              <div style={styles.tableScroll}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Copropriété</th>
                      <th style={styles.th}>Localisation</th>
                      <th style={styles.th}>Statut</th>
                      <th style={styles.th}>Membres</th>
                      <th style={styles.th}>Création</th>
                      <th style={styles.thRight}>Actions</th>
                    </tr>
                  </thead>

                  <tbody>
                    {loading ? (
                      <tr>
                        <td style={styles.td} colSpan={6}>
                          Chargement des copropriétés...
                        </td>
                      </tr>
                    ) : filteredRows.length === 0 ? (
                      <tr>
                        <td style={styles.empty} colSpan={6}>
                          <p style={styles.cardTitle}>
                            Aucune copropriété trouvée
                          </p>
                          <p style={styles.cardSubtitle}>
                            Ajustez votre recherche ou créez une nouvelle
                            copropriété depuis l’Admin React.
                          </p>
                          <Link
                            to="/platform-admin/coproprietes/nouveau"
                            style={{ ...styles.buttonPrimary, marginTop: 16 }}
                          >
                            Créer une copropriété
                          </Link>
                        </td>
                      </tr>
                    ) : (
                      filteredRows.map((item) => {
                        const tone = statutTone(item.statut, item.is_active);
                        const membersCount =
                          item.membres_actifs_count ?? item.membres_count ?? 0;
                        const actionBusy = actionLoadingId === item.id;
                        const archived = isArchived(item);

                        return (
                          <tr key={item.id}>
                            <td style={styles.td}>
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 12,
                                }}
                              >
                                <div
                                  style={{
                                    width: 44,
                                    height: 44,
                                    flex: "0 0 auto",
                                    borderRadius: 14,
                                    border: "1px solid #e2e8f0",
                                    background: "#f8fafc",
                                    display: "grid",
                                    placeItems: "center",
                                    overflow: "hidden",
                                  }}
                                  aria-hidden="true"
                                >
                                  {item.logo_url ? (
                                    <img
                                      src={item.logo_url}
                                      alt=""
                                      style={{
                                        width: "100%",
                                        height: "100%",
                                        objectFit: "contain",
                                      }}
                                    />
                                  ) : (
                                    <span
                                      style={{
                                        color: "#475569",
                                        fontSize: 12,
                                        fontWeight: 950,
                                      }}
                                    >
                                      {getInitials(item.nom)}
                                    </span>
                                  )}
                                </div>

                                <div>
                                  <Link
                                    to={`/platform-admin/coproprietes/${item.id}`}
                                    style={styles.nameLink}
                                  >
                                    {item.nom}
                                  </Link>
                                  <p style={styles.muted}>
                                    ID #{item.id}
                                    {item.slug ? ` · ${item.slug}` : ""}
                                  </p>
                                </div>
                              </div>
                            </td>

                            <td style={styles.td}>
                              <p style={styles.strong}>{getLocation(item)}</p>
                              <p style={styles.muted}>
                                {item.pays || "Pays non renseigné"}
                              </p>
                            </td>

                            <td style={styles.td}>
                              <span style={badgeStyle(tone)}>
                                {statutLabel(item.statut, item.is_active)}
                              </span>
                            </td>

                            <td style={styles.td}>
                              <p style={styles.strong}>
                                {formatNumber(membersCount)}
                              </p>
                              <p style={styles.muted}>
                                membre{membersCount > 1 ? "s" : ""} actif
                                {membersCount > 1 ? "s" : ""}
                              </p>
                            </td>

                            <td style={styles.td}>
                              <p style={styles.strong}>
                                {formatDate(item.created_at)}
                              </p>
                              <p style={styles.muted}>
                                Dernière maj : {formatDate(item.updated_at)}
                              </p>
                            </td>

                            <td style={styles.tdRight}>
                              <div style={styles.rowActions}>
                                <Link
                                  to={`/platform-admin/coproprietes/${item.id}`}
                                  style={actionStyle("neutral")}
                                >
                                  Détail
                                </Link>

                                <Link
                                  to={`/platform-admin/coproprietes/${item.id}/modifier`}
                                  style={actionStyle("primary")}
                                >
                                  Modifier
                                </Link>

                                {!archived ? (
                                  <button
                                    type="button"
                                    onClick={() => void toggleSuspension(item)}
                                    disabled={actionBusy}
                                    style={{
                                      ...actionStyle("warning"),
                                      opacity: actionBusy ? 0.65 : 1,
                                    }}
                                  >
                                    {actionBusy
                                      ? "Traitement..."
                                      : isActiveCopro(item)
                                        ? "Suspendre"
                                        : "Réactiver"}
                                  </button>
                                ) : null}

                                {!archived ? (
                                  <button
                                    type="button"
                                    onClick={() => void archiver(item)}
                                    disabled={actionBusy}
                                    style={{
                                      ...actionStyle("danger"),
                                      opacity: actionBusy ? 0.65 : 1,
                                    }}
                                  >
                                    {actionBusy ? "Traitement..." : "Archiver"}
                                  </button>
                                ) : null}
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
          </div>

          <aside style={styles.side}>
            <div style={styles.sideCard}>
              <p style={styles.sideEyebrow}>Lecture métier</p>
              <h2 style={styles.sideTitle}>Socle de préparation SaaS</h2>
              <p style={styles.sideText}>
                Chaque copropriété créée ici pourra recevoir ses copropriétaires,
                ses lots, ses tantièmes, ses rôles locaux et ses premiers
                paramètres d’exploitation.
              </p>
            </div>

            <div style={styles.sideCardBlue}>
              <p style={{ ...styles.sideEyebrow, color: "#4f46e5" }}>
                Suite recommandée
              </p>
              <h3 style={{ ...styles.sideTitle, color: "#312e81" }}>
                Structurer le référentiel
              </h3>

              <div
                style={{
                  display: "grid",
                  gap: 10,
                  marginTop: 16,
                }}
              >
                <Link
                  to="/platform-admin/referentiel-copropriete"
                  style={styles.sideLink}
                >
                  Ouvrir le référentiel copropriété
                  <span>→</span>
                </Link>
                <Link
                  to="/platform-admin/utilisateurs-roles"
                  style={styles.sideLink}
                >
                  Gérer utilisateurs & rôles
                  <span>→</span>
                </Link>
              </div>
            </div>

            <div style={styles.sideCard}>
              <p style={styles.sideEyebrow}>Contrôle rapide</p>

              <div style={{ display: "grid", gap: 14, marginTop: 16 }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                  }}
                >
                  <span style={{ color: "#64748b", fontSize: 13 }}>
                    Données chargées
                  </span>
                  <strong style={{ color: "#0f172a", fontSize: 13 }}>
                    {loading ? "..." : "OK"}
                  </strong>
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                  }}
                >
                  <span style={{ color: "#64748b", fontSize: 13 }}>
                    Recherche locale
                  </span>
                  <strong style={{ color: "#0f172a", fontSize: 13 }}>
                    {q.trim() ? "Active" : "Inactive"}
                  </strong>
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                  }}
                >
                  <span style={{ color: "#64748b", fontSize: 13 }}>
                    Exploitation active
                  </span>
                  <strong style={{ color: "#047857", fontSize: 13 }}>
                    {formatNumber(stats.actives)}
                  </strong>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </section>
    </div>
  );
}