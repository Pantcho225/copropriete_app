// frontend/src/pages/platform-admin/PlatformCoproprieteDetail.tsx
import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

import api from "../../api/axios";
import { ENDPOINTS } from "../../api/endpoints";

type Copropriete = {
  id: number;
  nom: string;
  slug?: string | null;
  adresse?: string | null;
  ville?: string | null;
  pays?: string | null;
  description?: string | null;
  telephone?: string | null;
  email_contact?: string | null;
  logo_url?: string | null;
  statut?: string | null;
  is_active?: boolean;
  membres_actifs_count?: number;
};

type Membre = {
  id: number;
  role: string;
  role_label?: string;
  is_active: boolean;
  user_display?: string;
  user_detail?: {
    email?: string;
    username?: string;
    full_name?: string;
  };
  copropriete_detail?: {
    nom?: string;
  };
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
    fontSize: 24,
    lineHeight: 1.15,
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
    gap: 14,
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
  infoGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 14,
  },
  infoItem: {
    border: "1px solid #e2e8f0",
    borderRadius: 20,
    background: "#ffffff",
    padding: 16,
  },
  infoLabel: {
    margin: 0,
    color: "#64748b",
    fontSize: 12,
    fontWeight: 850,
  },
  infoValue: {
    margin: "8px 0 0",
    color: "#0f172a",
    fontSize: 14,
    fontWeight: 900,
    lineHeight: 1.55,
    wordBreak: "break-word",
  },
  softNote: {
    marginTop: 16,
    border: "1px solid #dbeafe",
    borderRadius: 20,
    background: "#eff6ff",
    padding: 16,
    color: "#1e3a8a",
    fontSize: 13,
    lineHeight: 1.7,
  },
  quickGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 14,
  },
  quickCard: {
    display: "block",
    border: "1px solid #e2e8f0",
    borderRadius: 24,
    background: "#ffffff",
    padding: 18,
    textDecoration: "none",
    boxShadow: "0 10px 26px rgba(15,23,42,0.04)",
  },
  quickTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: 15,
    fontWeight: 950,
  },
  quickText: {
    margin: "8px 0 0",
    color: "#64748b",
    fontSize: 13,
    lineHeight: 1.7,
  },
  quickArrow: {
    marginTop: 14,
    color: "#4f46e5",
    fontSize: 13,
    fontWeight: 950,
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
    minWidth: 860,
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
  empty: {
    padding: 38,
    textAlign: "center",
    color: "#64748b",
    fontSize: 13,
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
  if (normalized === "INACTIVE") return "Inactive";

  return statut || "Non défini";
}

function statutTone(statut?: string | null, isActive?: boolean): Tone {
  const normalized = normalizeStatut(statut);

  if (normalized === "ACTIVE" || isActive) return "success";
  if (normalized === "SUSPENDUE" || normalized === "SUSPENDU") return "warning";
  if (normalized === "ARCHIVEE" || normalized === "ARCHIVE") return "neutral";
  if (normalized === "INACTIVE") return "danger";

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

function getMembreName(membre: Membre): string {
  return (
    membre.user_display ||
    membre.user_detail?.full_name ||
    membre.user_detail?.username ||
    "Utilisateur non renseigné"
  );
}

function getMembreEmail(membre: Membre): string {
  return membre.user_detail?.email || membre.user_detail?.username || "—";
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("fr-FR").format(value);
}

function displayValue(value?: string | number | null): string {
  if (value === undefined || value === null || value === "") return "—";
  return String(value);
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

export default function PlatformCoproprieteDetail() {
  const { id } = useParams();

  const [copropriete, setCopropriete] = useState<Copropriete | null>(null);
  const [membres, setMembres] = useState<Membre[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);
  const [error, setError] = useState("");

  const isGlobalUsersView = !id;

  const activeMembers = useMemo(
    () => membres.filter((membre) => membre.is_active).length,
    [membres],
  );

  const inactiveMembers = useMemo(
    () => membres.filter((membre) => !membre.is_active).length,
    [membres],
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      if (id) {
        const [coproResponse, membresResponse] = await Promise.all([
          api.get(ENDPOINTS.platform.coproprieteDetail(id)),
          api.get(ENDPOINTS.platform.coproprieteMembres(id)),
        ]);

        setCopropriete(coproResponse.data as Copropriete);
        setMembres(extractRows<Membre>(membresResponse.data));
      } else {
        const membresResponse = await api.get(ENDPOINTS.platform.membres);

        setCopropriete(null);
        setMembres(extractRows<Membre>(membresResponse.data));
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [id]);

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

  if (loading) {
    return <div style={styles.loadingCard}>Chargement de la fiche...</div>;
  }

  const pageTitle = copropriete?.nom || "Utilisateurs & rôles";
  const statusTone = statutTone(copropriete?.statut, copropriete?.is_active);

  return (
    <div style={styles.page}>
      <section style={styles.shell}>
        <div style={styles.hero}>
          <div style={styles.heroTop}>
            <div>
              <p style={styles.eyebrow}>
                {isGlobalUsersView
                  ? "Super Admin · Utilisateurs & rôles"
                  : "Super Admin · Fiche copropriété"}
              </p>
              <h1 style={styles.title}>{pageTitle}</h1>
              <p style={styles.heroText}>
                {isGlobalUsersView
                  ? "Consultez les utilisateurs rattachés aux copropriétés, leurs rôles locaux et leur statut d’accès."
                  : "Consultez la fiche de la copropriété, ses informations administratives, ses membres et ses accès rapides vers le référentiel de préparation."}
              </p>
            </div>

            <div style={styles.actions}>
              <Link to="/platform-admin/coproprietes" style={styles.heroButtonSecondary}>
                Copropriétés
              </Link>

              {id ? (
                <Link
                  to={`/platform-admin/coproprietes/${id}/modifier`}
                  style={styles.heroButtonPrimary}
                >
                  Modifier la fiche
                </Link>
              ) : (
                <Link to="/platform-admin" style={styles.heroButtonPrimary}>
                  Administration plateforme
                </Link>
              )}
            </div>
          </div>

          <div style={styles.statsGrid}>
            <div style={styles.statCard}>
              <p style={styles.statLabel}>Statut</p>
              <p style={styles.statValue}>
                {copropriete
                  ? statutLabel(copropriete.statut, copropriete.is_active)
                  : "Vue globale"}
              </p>
              <p style={styles.statHint}>
                {copropriete ? "État d’exploitation actuel" : "Tous les rôles locaux"}
              </p>
            </div>

            <div style={styles.statCard}>
              <p style={styles.statLabel}>Membres actifs</p>
              <p style={styles.statValue}>{formatNumber(activeMembers)}</p>
              <p style={styles.statHint}>Accès actuellement ouverts</p>
            </div>

            <div style={styles.statCard}>
              <p style={styles.statLabel}>Membres inactifs</p>
              <p style={styles.statValue}>{formatNumber(inactiveMembers)}</p>
              <p style={styles.statHint}>Accès désactivés ou suspendus</p>
            </div>

            <div style={styles.statCard}>
              <p style={styles.statLabel}>Référentiel</p>
              <p style={styles.statValue}>{id ? `#${id}` : "Global"}</p>
              <p style={styles.statHint}>
                {id ? "Identifiant plateforme" : "Supervision des affectations"}
              </p>
            </div>
          </div>
        </div>

        <div style={styles.content}>
          <main style={styles.main}>
            {error ? <div style={styles.error}>{error}</div> : null}

            {copropriete ? (
              <section style={styles.card}>
                <div style={styles.cardHeader}>
                  <div>
                    <p style={styles.cardEyebrow}>Informations générales</p>
                    <h2 style={styles.cardTitle}>Identité de la copropriété</h2>
                    <p style={styles.cardSubtitle}>
                      Informations administratives utilisées par le Super Admin
                      et les modules métier.
                    </p>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      flexWrap: "wrap",
                      justifyContent: "flex-end",
                    }}
                  >
                    <div
                      style={{
                        width: 62,
                        height: 62,
                        borderRadius: 20,
                        border: "1px solid #e2e8f0",
                        background: "#f8fafc",
                        display: "grid",
                        placeItems: "center",
                        overflow: "hidden",
                      }}
                      aria-label="Logo de la copropriété"
                    >
                      {copropriete.logo_url ? (
                        <img
                          src={copropriete.logo_url}
                          alt={`Logo ${copropriete.nom}`}
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
                            fontSize: 14,
                            fontWeight: 950,
                          }}
                        >
                          {getInitials(copropriete.nom)}
                        </span>
                      )}
                    </div>

                    <span style={badgeStyle(statusTone)}>
                      {statutLabel(copropriete.statut, copropriete.is_active)}
                    </span>
                  </div>
                </div>

                <div style={styles.cardBody}>
                  <div style={styles.infoGrid}>
                    <div style={styles.infoItem}>
                      <p style={styles.infoLabel}>Ville</p>
                      <p style={styles.infoValue}>{displayValue(copropriete.ville)}</p>
                    </div>

                    <div style={styles.infoItem}>
                      <p style={styles.infoLabel}>Pays</p>
                      <p style={styles.infoValue}>{displayValue(copropriete.pays)}</p>
                    </div>

                    <div style={styles.infoItem}>
                      <p style={styles.infoLabel}>Téléphone</p>
                      <p style={styles.infoValue}>
                        {displayValue(copropriete.telephone)}
                      </p>
                    </div>

                    <div style={styles.infoItem}>
                      <p style={styles.infoLabel}>Email de contact</p>
                      <p style={styles.infoValue}>
                        {displayValue(copropriete.email_contact)}
                      </p>
                    </div>

                    <div style={styles.infoItem}>
                      <p style={styles.infoLabel}>Membres actifs</p>
                      <p style={styles.infoValue}>
                        {formatNumber(copropriete.membres_actifs_count ?? activeMembers)}
                      </p>
                    </div>

                    <div style={styles.infoItem}>
                      <p style={styles.infoLabel}>Slug</p>
                      <p style={styles.infoValue}>{displayValue(copropriete.slug)}</p>
                    </div>
                  </div>

                  <div style={styles.softNote}>
                    <strong>Adresse : </strong>
                    {displayValue(copropriete.adresse)}
                    <br />
                    <strong>Description : </strong>
                    {displayValue(copropriete.description)}
                  </div>
                </div>
              </section>
            ) : null}

            {copropriete ? (
              <section style={styles.card}>
                <div style={styles.cardHeader}>
                  <div>
                    <p style={styles.cardEyebrow}>Référentiel copropriété</p>
                    <h2 style={styles.cardTitle}>Accès rapides de préparation</h2>
                    <p style={styles.cardSubtitle}>
                      Continuez la configuration de la copropriété avec les données
                      indispensables aux modules Lots, AG, Comptabilité et Relances.
                    </p>
                  </div>
                </div>

                <div style={styles.cardBody}>
                  <div style={styles.quickGrid}>
                    <Link
                      to="/platform-admin/referentiel-copropriete/coproprietaires"
                      style={styles.quickCard}
                    >
                      <p style={styles.quickTitle}>Copropriétaires</p>
                      <p style={styles.quickText}>
                        Créer, consulter et maintenir les copropriétaires.
                      </p>
                      <p style={styles.quickArrow}>Ouvrir →</p>
                    </Link>

                    <Link
                      to="/platform-admin/referentiel-copropriete/lots"
                      style={styles.quickCard}
                    >
                      <p style={styles.quickTitle}>Lots</p>
                      <p style={styles.quickText}>
                        Créer les lots, types, bâtiments et caractéristiques.
                      </p>
                      <p style={styles.quickArrow}>Ouvrir →</p>
                    </Link>

                    <Link
                      to="/platform-admin/referentiel-copropriete/tantiemes"
                      style={styles.quickCard}
                    >
                      <p style={styles.quickTitle}>Tantièmes</p>
                      <p style={styles.quickText}>
                        Paramétrer les catégories et valeurs de tantièmes.
                      </p>
                      <p style={styles.quickArrow}>Ouvrir →</p>
                    </Link>
                  </div>
                </div>
              </section>
            ) : null}

            <section style={styles.card}>
              <div style={styles.cardHeader}>
                <div>
                  <p style={styles.cardEyebrow}>Accès locaux</p>
                  <h2 style={styles.cardTitle}>Membres & rôles</h2>
                  <p style={styles.cardSubtitle}>
                    {formatNumber(membres.length)} rattachement
                    {membres.length > 1 ? "s" : ""} utilisateur
                    {membres.length > 1 ? "s" : ""} affiché
                    {membres.length > 1 ? "s" : ""}.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => void loadData()}
                  style={styles.actionButton}
                >
                  Rafraîchir
                </button>
              </div>

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
                      {membres.length === 0 ? (
                        <tr>
                          <td style={styles.empty} colSpan={6}>
                            Aucun membre trouvé pour le moment.
                          </td>
                        </tr>
                      ) : (
                        membres.map((membre) => {
                          const actionBusy = actionLoadingId === membre.id;

                          return (
                            <tr key={membre.id}>
                              <td style={styles.td}>
                                <p style={styles.rowTitle}>{getMembreName(membre)}</p>
                                <p style={styles.muted}>ID #{membre.id}</p>
                              </td>

                              <td style={styles.td}>{getMembreEmail(membre)}</td>

                              <td style={styles.td}>
                                {membre.copropriete_detail?.nom ||
                                  copropriete?.nom ||
                                  "—"}
                              </td>

                              <td style={styles.td}>
                                <p style={styles.rowTitle}>
                                  {membre.role_label || membre.role || "—"}
                                </p>
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
            </section>
          </main>

          <aside style={styles.side}>
            <div style={styles.sideCard}>
              <p style={styles.sideEyebrow}>Lecture produit</p>
              <h2 style={styles.sideTitle}>Centre de contrôle</h2>
              <p style={styles.sideText}>
                Cette fiche sert de pont entre la création plateforme et le
                référentiel opérationnel : lots, tantièmes, copropriétaires et
                rôles locaux.
              </p>
            </div>

            <div style={styles.sideCardBlue}>
              <p style={{ ...styles.sideEyebrow, color: "#4f46e5" }}>
                Suite recommandée
              </p>
              <h3 style={{ ...styles.sideTitle, color: "#312e81" }}>
                Compléter le référentiel
              </h3>
              <div style={{ display: "grid", gap: 10, marginTop: 16 }}>
                <Link
                  to="/platform-admin/referentiel-copropriete"
                  style={styles.sideLink}
                >
                  Ouvrir le cockpit référentiel
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

            <div style={styles.sideCardGreen}>
              <p style={{ ...styles.sideEyebrow, color: "#047857" }}>
                État rapide
              </p>
              <h3 style={{ ...styles.sideTitle, color: "#064e3b" }}>
                {activeMembers} membre{activeMembers > 1 ? "s" : ""} actif
                {activeMembers > 1 ? "s" : ""}
              </h3>
              <p style={{ ...styles.sideText, color: "#047857" }}>
                {inactiveMembers} accès inactif
                {inactiveMembers > 1 ? "s" : ""} détecté
                {inactiveMembers > 1 ? "s" : ""}.
              </p>
            </div>
          </aside>
        </div>
      </section>
    </div>
  );
}