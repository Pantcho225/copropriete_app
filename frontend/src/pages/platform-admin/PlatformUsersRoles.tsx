// frontend/src/pages/platform-admin/PlatformUsersRoles.tsx
import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import api from "../../api/axios";
import { ENDPOINTS } from "../../api/endpoints";

type Membre = {
  id: number;
  role: string;
  role_label?: string | null;
  is_active: boolean;
  user_display?: string | null;
  user_detail?: {
    id?: number;
    email?: string | null;
    username?: string | null;
    full_name?: string | null;
    first_name?: string | null;
    last_name?: string | null;
  } | null;
  copropriete_detail?: {
    id?: number;
    nom?: string | null;
    ville?: string | null;
    statut?: string | null;
  } | null;
};

type Tone = "success" | "warning" | "danger" | "neutral" | "info";

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
    maxWidth: 860,
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
    lineHeight: 1.6,
  },
  content: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) 340px",
    gap: 20,
    padding: 24,
    background: "#f8fafc",
  },
  mainCard: {
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
  actionButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 34,
    padding: "0 12px",
    borderRadius: 12,
    border: "1px solid #e2e8f0",
    background: "#ffffff",
    color: "#334155",
    fontSize: 12,
    fontWeight: 900,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  empty: {
    padding: 40,
    textAlign: "center",
    color: "#64748b",
    fontSize: 13,
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

  return "Une erreur est survenue pendant le chargement des utilisateurs.";
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

function getMembreName(membre: Membre): string {
  const fullName =
    membre.user_detail?.full_name ||
    [membre.user_detail?.first_name, membre.user_detail?.last_name]
      .filter(Boolean)
      .join(" ");

  return (
    membre.user_display ||
    fullName ||
    membre.user_detail?.username ||
    "Utilisateur non renseigné"
  );
}

function getMembreEmail(membre: Membre): string {
  return membre.user_detail?.email || membre.user_detail?.username || "—";
}

function getRoleLabel(membre: Membre): string {
  return membre.role_label || membre.role || "Rôle non défini";
}

function getCoproprieteName(membre: Membre): string {
  return membre.copropriete_detail?.nom || "Copropriété non renseignée";
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("fr-FR").format(value);
}

function includesText(value: string | number | null | undefined, query: string): boolean {
  return String(value ?? "")
    .toLowerCase()
    .includes(query.toLowerCase());
}

export default function PlatformUsersRoles() {
  const [rows, setRows] = useState<Membre[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);
  const [q, setQ] = useState("");
  const [error, setError] = useState("");

  const stats = useMemo(() => {
    const active = rows.filter((item) => item.is_active).length;
    const inactive = rows.filter((item) => !item.is_active).length;
    const roles = new Set(rows.map((item) => getRoleLabel(item))).size;

    return {
      total: rows.length,
      active,
      inactive,
      roles,
    };
  }, [rows]);

  const filteredRows = useMemo(() => {
    const query = q.trim();

    if (!query) return rows;

    return rows.filter((item) => {
      return (
        includesText(getMembreName(item), query) ||
        includesText(getMembreEmail(item), query) ||
        includesText(getRoleLabel(item), query) ||
        includesText(getCoproprieteName(item), query) ||
        includesText(item.is_active ? "actif" : "inactif", query)
      );
    });
  }, [q, rows]);

  const topRoles = useMemo(() => {
    const counter = new Map<string, number>();

    for (const item of rows) {
      const label = getRoleLabel(item);
      counter.set(label, (counter.get(label) ?? 0) + 1);
    }

    return Array.from(counter.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4);
  }, [rows]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await api.get(ENDPOINTS.platform.membres);
      setRows(extractRows<Membre>(response.data));
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  async function toggleMembre(membre: Membre) {
    setActionLoadingId(membre.id);
    setError("");

    try {
      const endpoint = membre.is_active
        ? ENDPOINTS.platform.membreDesactiver(membre.id)
        : ENDPOINTS.platform.membreActiver(membre.id);

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
              <p style={styles.eyebrow}>Super Admin · Utilisateurs & rôles</p>
              <h1 style={styles.title}>Utilisateurs & rôles</h1>
              <p style={styles.heroText}>
                Supervisez les rattachements des utilisateurs aux copropriétés,
                leurs rôles locaux et leur statut d’accès. Cette page devient le
                tableau de contrôle des habilitations côté plateforme.
              </p>
            </div>

            <div style={styles.actions}>
              <Link to="/platform-admin" style={styles.heroButtonSecondary}>
                Retour plateforme
              </Link>
              <Link to="/platform-admin/coproprietes" style={styles.heroButtonPrimary}>
                Copropriétés
              </Link>
            </div>
          </div>

          <div style={styles.statsGrid}>
            <div style={styles.statCard}>
              <p style={styles.statLabel}>Rattachements</p>
              <p style={styles.statValue}>{formatNumber(stats.total)}</p>
              <p style={styles.statHint}>Utilisateurs liés aux copropriétés</p>
            </div>

            <div style={styles.statCard}>
              <p style={{ ...styles.statLabel, color: "#bbf7d0" }}>Actifs</p>
              <p style={styles.statValue}>{formatNumber(stats.active)}</p>
              <p style={{ ...styles.statHint, color: "#dcfce7" }}>
                Accès actuellement ouverts
              </p>
            </div>

            <div style={styles.statCard}>
              <p style={{ ...styles.statLabel, color: "#e2e8f0" }}>Inactifs</p>
              <p style={styles.statValue}>{formatNumber(stats.inactive)}</p>
              <p style={styles.statHint}>Accès désactivés ou suspendus</p>
            </div>

            <div style={styles.statCard}>
              <p style={styles.statLabel}>Rôles distincts</p>
              <p style={styles.statValue}>{formatNumber(stats.roles)}</p>
              <p style={styles.statHint}>Typologies de responsabilités locales</p>
            </div>
          </div>
        </div>

        <div style={styles.content}>
          <main style={styles.mainCard}>
            <div style={styles.cardHeader}>
              <div>
                <p style={styles.cardEyebrow}>Gestion des accès</p>
                <h2 style={styles.cardTitle}>Registre utilisateurs & rôles</h2>
                <p style={styles.cardSubtitle}>
                  {formatNumber(filteredRows.length)} rattachement
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
                    cursor: loading ? "not-allowed" : "pointer",
                  }}
                >
                  {loading ? "Chargement..." : "Rafraîchir"}
                </button>

                <Link to="/platform-admin/coproprietes" style={styles.buttonPrimary}>
                  Gérer les copropriétés
                </Link>
              </div>
            </div>

            <div style={styles.searchWrap}>
              <input
                value={q}
                onChange={(event) => setQ(event.target.value)}
                placeholder="Rechercher par utilisateur, email, rôle, copropriété ou statut..."
                style={styles.searchInput}
              />
            </div>

            {error ? <div style={styles.error}>{error}</div> : null}

            <div style={styles.tableWrap}>
              <div style={styles.tableScroll}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Utilisateur</th>
                      <th style={styles.th}>Email</th>
                      <th style={styles.th}>Copropriété</th>
                      <th style={styles.th}>Rôle</th>
                      <th style={styles.th}>Statut</th>
                      <th style={styles.thRight}>Action</th>
                    </tr>
                  </thead>

                  <tbody>
                    {loading ? (
                      <tr>
                        <td style={styles.empty} colSpan={6}>
                          Chargement des utilisateurs et rôles...
                        </td>
                      </tr>
                    ) : filteredRows.length === 0 ? (
                      <tr>
                        <td style={styles.empty} colSpan={6}>
                          Aucun rattachement utilisateur trouvé.
                        </td>
                      </tr>
                    ) : (
                      filteredRows.map((membre) => {
                        const actionBusy = actionLoadingId === membre.id;

                        return (
                          <tr key={membre.id}>
                            <td style={styles.td}>
                              <p style={styles.rowTitle}>{getMembreName(membre)}</p>
                              <p style={styles.muted}>ID rattachement #{membre.id}</p>
                            </td>

                            <td style={styles.td}>{getMembreEmail(membre)}</td>

                            <td style={styles.td}>
                              <p style={styles.rowTitle}>
                                {getCoproprieteName(membre)}
                              </p>
                              <p style={styles.muted}>
                                {membre.copropriete_detail?.ville ||
                                  "Ville non renseignée"}
                              </p>
                            </td>

                            <td style={styles.td}>
                              <span style={badgeStyle("info")}>
                                {getRoleLabel(membre)}
                              </span>
                            </td>

                            <td style={styles.td}>
                              <span
                                style={badgeStyle(
                                  membre.is_active ? "success" : "neutral",
                                )}
                              >
                                {membre.is_active ? "Actif" : "Inactif"}
                              </span>
                            </td>

                            <td style={styles.tdRight}>
                              <button
                                type="button"
                                onClick={() => void toggleMembre(membre)}
                                disabled={actionBusy}
                                style={{
                                  ...styles.actionButton,
                                  opacity: actionBusy ? 0.65 : 1,
                                  cursor: actionBusy ? "not-allowed" : "pointer",
                                }}
                              >
                                {actionBusy
                                  ? "Traitement..."
                                  : membre.is_active
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
          </main>

          <aside style={styles.side}>
            <div style={styles.sideCard}>
              <p style={styles.sideEyebrow}>Lecture métier</p>
              <h2 style={styles.sideTitle}>Habilitations locales</h2>
              <p style={styles.sideText}>
                Un utilisateur peut être rattaché à une copropriété avec un rôle
                local. C’est cette affectation qui permet de contrôler les accès
                aux modules métier.
              </p>
            </div>

            <div style={styles.sideCardBlue}>
              <p style={{ ...styles.sideEyebrow, color: "#4f46e5" }}>
                Suite recommandée
              </p>
              <h3 style={{ ...styles.sideTitle, color: "#312e81" }}>
                Structurer les accès
              </h3>
              <div style={{ display: "grid", gap: 10, marginTop: 16 }}>
                <Link to="/platform-admin/coproprietes" style={styles.sideLink}>
                  Ouvrir les copropriétés
                  <span>→</span>
                </Link>

                <Link
                  to="/platform-admin/referentiel-copropriete"
                  style={styles.sideLink}
                >
                  Ouvrir le référentiel
                  <span>→</span>
                </Link>
              </div>
            </div>

            <div style={styles.sideCardGreen}>
              <p style={{ ...styles.sideEyebrow, color: "#047857" }}>
                Rôles principaux
              </p>
              <h3 style={{ ...styles.sideTitle, color: "#064e3b" }}>
                Répartition rapide
              </h3>

              <div style={styles.checklist}>
                {topRoles.length === 0 ? (
                  <div style={{ ...styles.checklistItem, borderBottom: "none" }}>
                    <span style={styles.checklistLabel}>Aucun rôle</span>
                    <span style={styles.checklistValue}>—</span>
                  </div>
                ) : (
                  topRoles.map(([role, count], index) => (
                    <div
                      key={role}
                      style={{
                        ...styles.checklistItem,
                        borderBottom:
                          index === topRoles.length - 1
                            ? "none"
                            : styles.checklistItem.borderBottom,
                      }}
                    >
                      <span style={styles.checklistLabel}>{role}</span>
                      <span style={styles.checklistValue}>
                        {formatNumber(count)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div style={styles.sideCard}>
              <p style={styles.sideEyebrow}>Contrôle rapide</p>
              <div style={styles.checklist}>
                <div style={styles.checklistItem}>
                  <span style={styles.checklistLabel}>Données chargées</span>
                  <span style={styles.checklistValue}>
                    {loading ? "..." : "OK"}
                  </span>
                </div>

                <div style={styles.checklistItem}>
                  <span style={styles.checklistLabel}>Recherche locale</span>
                  <span style={styles.checklistValue}>
                    {q.trim() ? "Active" : "Inactive"}
                  </span>
                </div>

                <div style={{ ...styles.checklistItem, borderBottom: "none" }}>
                  <span style={styles.checklistLabel}>Accès actifs</span>
                  <span style={{ ...styles.checklistValue, color: "#047857" }}>
                    {formatNumber(stats.active)}
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