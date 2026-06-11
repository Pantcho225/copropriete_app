// frontend/src/pages/platform-admin/ReferentielCopropriete.tsx
import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import api from "../../api/axios";

type Copropriete = {
  id: number;
  nom: string;
  slug?: string | null;
  ville?: string | null;
  pays?: string | null;
  statut?: string | null;
  is_active?: boolean;
  membres_actifs_count?: number;
};

type Coproprietaire = {
  id: number;
  nom?: string | null;
  prenoms?: string | null;
  email?: string | null;
  telephone?: string | null;
  copropriete?: number | null;
  copropriete_id?: number | null;
};

type Lot = {
  id: number;
  numero?: string | null;
  reference?: string | null;
  type_lot?: string | null;
  copropriete?: number | null;
  copropriete_id?: number | null;
  is_active?: boolean;
  total_tantiemes_value?: string | number | null;
};

type Tantieme = {
  id: number;
  valeur?: string | number | null;
  lot?: number | null;
  lot_id?: number | null;
  copropriete?: number | null;
  copropriete_id?: number | null;
};

type TantiemeCategorie = {
  id: number;
  nom?: string | null;
  code?: string | null;
  copropriete?: number | null;
  copropriete_id?: number | null;
  is_active?: boolean;
};

type Membre = {
  id: number;
  role?: string | null;
  role_label?: string | null;
  is_active?: boolean;
  copropriete?: number | null;
  copropriete_id?: number | null;
  copropriete_detail?: {
    id?: number;
    nom?: string | null;
  } | null;
};

type Tone = "success" | "warning" | "danger" | "neutral" | "info";

const API = {
  coproprietes: "/api/core/coproprietes/",
  coproprietaires: "/api/owners/coproprietaires/",
  lots: "/api/lots/",
  tantiemes: "/api/lot-tantiemes/",
  tantiemeCategories: "/api/tantieme-categories/",
  membres: "/api/core/membres/",
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
  cockpitGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
    gap: 14,
  },
  cockpitCard: {
    display: "block",
    border: "1px solid #e2e8f0",
    borderRadius: 24,
    background: "#ffffff",
    padding: 18,
    textDecoration: "none",
    boxShadow: "0 10px 26px rgba(15,23,42,0.04)",
  },
  cockpitTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: 15,
    fontWeight: 950,
  },
  cockpitText: {
    margin: "8px 0 0",
    color: "#64748b",
    fontSize: 13,
    lineHeight: 1.7,
  },
  cockpitMetric: {
    margin: "16px 0 0",
    color: "#312e81",
    fontSize: 26,
    fontWeight: 950,
    lineHeight: 1,
  },
  cockpitArrow: {
    marginTop: 14,
    color: "#4f46e5",
    fontSize: 13,
    fontWeight: 950,
  },
  healthGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
    gap: 14,
  },
  healthItem: {
    border: "1px solid #e2e8f0",
    borderRadius: 22,
    background: "#ffffff",
    padding: 16,
  },
  healthLabel: {
    margin: 0,
    color: "#64748b",
    fontSize: 12,
    fontWeight: 850,
  },
  healthValue: {
    margin: "8px 0 0",
    color: "#0f172a",
    fontSize: 20,
    fontWeight: 950,
  },
  healthText: {
    margin: "7px 0 0",
    color: "#64748b",
    fontSize: 12,
    lineHeight: 1.6,
  },
  tableWrap: {
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
  td: {
    padding: "16px",
    borderBottom: "1px solid #f1f5f9",
    verticalAlign: "top",
    color: "#334155",
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
  badge: {
    display: "inline-flex",
    alignItems: "center",
    minHeight: 28,
    padding: "0 11px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 900,
    whiteSpace: "nowrap",
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
    const response = (
      error as {
        response?: {
          status?: number;
          data?: unknown;
        };
      }
    ).response;

    const data = response?.data;
    const status = response?.status;

    if (typeof data === "string") {
      const cleaned = data.trim();

      if (
        cleaned.startsWith("<!DOCTYPE") ||
        cleaned.startsWith("<html") ||
        cleaned.includes("<body") ||
        cleaned.includes("Page not found") ||
        cleaned.includes("Traceback") ||
        cleaned.includes("AttributeError at") ||
        cleaned.includes("Request Method:") ||
        cleaned.includes("Exception Type:")
      ) {
        return status === 404
          ? "Donnée référentielle indisponible : un endpoint appelé par le cockpit est introuvable."
          : "Erreur serveur pendant le chargement du référentiel. Consultez le terminal backend pour le détail technique.";
      }

      return cleaned.length > 260
        ? `${cleaned.slice(0, 260)}…`
        : cleaned;
    }

    if (data && typeof data === "object") {
      const maybe = data as {
        detail?: unknown;
        message?: unknown;
        error?: unknown;
        non_field_errors?: unknown;
      };

      if (typeof maybe.detail === "string") return maybe.detail;
      if (typeof maybe.message === "string") return maybe.message;
      if (typeof maybe.error === "string") return maybe.error;

      if (Array.isArray(maybe.non_field_errors)) {
        return maybe.non_field_errors.map(String).join(" ");
      }

      return status
        ? `Erreur ${status} pendant le chargement du référentiel.`
        : "Une réponse API inattendue a été reçue pendant le chargement du référentiel.";
    }
  }

  if (error instanceof Error) return error.message;

  return "Une erreur est survenue pendant le chargement du référentiel.";
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
    ...styles.badge,
    ...map[tone],
  };
}

function getStoredActiveCoproprieteId(): string {
  const keys = [
    "coproprieteId",
    "copropriete_id",
    "activeCoproprieteId",
    "active_copropriete_id",
  ];

  for (const key of keys) {
    const value = window.localStorage.getItem(key);

    if (value) return value;
  }

  return "";
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

function isActiveCopro(item: Copropriete): boolean {
  const normalized = normalizeStatut(item.statut);
  return normalized === "ACTIVE" || Boolean(item.is_active);
}

function getCoproprieteIdFromRow(row: {
  copropriete?: number | null;
  copropriete_id?: number | null;
}): number | null {
  return row.copropriete_id ?? row.copropriete ?? null;
}

export default function ReferentielCopropriete() {
  const [coproprietes, setCoproprietes] = useState<Copropriete[]>([]);
  const [coproprietaires, setCoproprietaires] = useState<Coproprietaire[]>([]);
  const [lots, setLots] = useState<Lot[]>([]);
  const [tantiemes, setTantiemes] = useState<Tantieme[]>([]);
  const [categories, setCategories] = useState<TantiemeCategorie[]>([]);
  const [membres, setMembres] = useState<Membre[]>([]);
  const [activeCoproprieteId, setActiveCoproprieteId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [
        coproprietesResponse,
        coproprietairesResponse,
        lotsResponse,
        tantiemesResponse,
        categoriesResponse,
        membresResponse,
      ] = await Promise.all([
        api.get(API.coproprietes),
        api.get(API.coproprietaires),
        api.get(API.lots),
        api.get(API.tantiemes),
        api.get(API.tantiemeCategories),
        api.get(API.membres),
      ]);

      setCoproprietes(extractRows<Copropriete>(coproprietesResponse.data));
      setCoproprietaires(
        extractRows<Coproprietaire>(coproprietairesResponse.data),
      );
      setLots(extractRows<Lot>(lotsResponse.data));
      setTantiemes(extractRows<Tantieme>(tantiemesResponse.data));
      setCategories(extractRows<TantiemeCategorie>(categoriesResponse.data));
      setMembres(extractRows<Membre>(membresResponse.data));
      setActiveCoproprieteId(getStoredActiveCoproprieteId());
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const activeCopropriete = useMemo(() => {
    const id = Number(activeCoproprieteId);

    if (!id) return null;

    return coproprietes.find((item) => item.id === id) ?? null;
  }, [activeCoproprieteId, coproprietes]);

  const stats = useMemo(() => {
    const activeCoproId = activeCopropriete?.id ?? null;

    const lotsForActive = activeCoproId
      ? lots.filter((item) => getCoproprieteIdFromRow(item) === activeCoproId)
      : lots;

    const coproprietairesForActive = activeCoproId
      ? coproprietaires.filter(
          (item) => getCoproprieteIdFromRow(item) === activeCoproId,
        )
      : coproprietaires;

    const categoriesForActive = activeCoproId
      ? categories.filter((item) => getCoproprieteIdFromRow(item) === activeCoproId)
      : categories;

    const membresForActive = activeCoproId
      ? membres.filter((item) => {
          const direct = getCoproprieteIdFromRow(item);
          const detail = item.copropriete_detail?.id ?? null;

          return direct === activeCoproId || detail === activeCoproId;
        })
      : membres;

    const lotIds = new Set(lotsForActive.map((item) => item.id));

    const tantiemesForActive = tantiemes.filter((item) => {
      const direct = getCoproprieteIdFromRow(item);

      if (activeCoproId && direct) return direct === activeCoproId;
      if (item.lot_id || item.lot) return lotIds.has(item.lot_id ?? item.lot ?? 0);

      return !activeCoproId;
    });

    const totalTantiemes = lotsForActive.reduce((total, lot) => {
      return total + toNumber(lot.total_tantiemes_value);
    }, 0);

    const checks = [
      coproprietes.length > 0,
      coproprietairesForActive.length > 0,
      lotsForActive.length > 0,
      categoriesForActive.length > 0,
      tantiemesForActive.length > 0,
      membresForActive.length > 0,
    ];

    const completed = checks.filter(Boolean).length;
    const completion = Math.round((completed / checks.length) * 100);

    return {
      totalCoproprietes: coproprietes.length,
      activeCoproprietes: coproprietes.filter((item) => isActiveCopro(item)).length,
      coproprietaires: coproprietairesForActive.length,
      lots: lotsForActive.length,
      categories: categoriesForActive.length,
      tantiemes: tantiemesForActive.length,
      membres: membresForActive.length,
      totalTantiemes,
      completion,
      completed,
      totalChecks: checks.length,
    };
  }, [
    activeCopropriete,
    categories,
    coproprietaires,
    coproprietes,
    lots,
    membres,
    tantiemes,
  ]);

  const healthTone: Tone =
    stats.completion >= 80 ? "success" : stats.completion >= 45 ? "warning" : "danger";

  return (
    <div style={styles.page}>
      <section style={styles.shell}>
        <div style={styles.hero}>
          <div style={styles.heroTop}>
            <div>
              <p style={styles.eyebrow}>Super Admin · Référentiel copropriété</p>
              <h1 style={styles.title}>Cockpit référentiel</h1>
              <p style={styles.heroText}>
                Pilotez la préparation complète des copropriétés depuis l’Admin
                React : copropriétaires, lots, catégories de tantièmes, valeurs de
                tantièmes et rôles locaux. Cette page remplace l’ancien écran de
                démonstration statique.
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
              <p style={styles.statLabel}>Copropriété active</p>
              <p style={styles.statValue}>
                {activeCopropriete ? `#${activeCopropriete.id}` : "Aucune"}
              </p>
              <p style={styles.statHint}>
                {activeCopropriete?.nom ||
                  "Sélectionnez une copropriété dans le shell pour filtrer le référentiel"}
              </p>
            </div>

            <div style={styles.statCard}>
              <p style={{ ...styles.statLabel, color: "#bbf7d0" }}>
                Complétude
              </p>
              <p style={styles.statValue}>{stats.completion} %</p>
              <p style={{ ...styles.statHint, color: "#dcfce7" }}>
                {stats.completed}/{stats.totalChecks} blocs référentiels prêts
              </p>
            </div>

            <div style={styles.statCard}>
              <p style={styles.statLabel}>Lots</p>
              <p style={styles.statValue}>{formatNumber(stats.lots)}</p>
              <p style={styles.statHint}>Lots disponibles dans le référentiel</p>
            </div>

            <div style={styles.statCard}>
              <p style={styles.statLabel}>Tantièmes</p>
              <p style={styles.statValue}>{formatNumber(stats.tantiemes)}</p>
              <p style={styles.statHint}>
                Total lots : {formatNumber(stats.totalTantiemes)}
              </p>
            </div>
          </div>
        </div>

        <div style={styles.content}>
          <main style={styles.main}>
            {error ? <div style={styles.error}>{error}</div> : null}

            <section style={styles.card}>
              <div style={styles.cardHeader}>
                <div>
                  <p style={styles.cardEyebrow}>Cockpit opérationnel</p>
                  <h2 style={styles.cardTitle}>Blocs du référentiel</h2>
                  <p style={styles.cardSubtitle}>
                    Accédez aux écrans qui remplacent progressivement l’usage de
                    l’admin Django pour préparer une copropriété complète.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => void loadData()}
                  style={{
                    border: "1px solid #e2e8f0",
                    background: "#ffffff",
                    borderRadius: 15,
                    minHeight: 40,
                    padding: "0 15px",
                    color: "#334155",
                    fontSize: 13,
                    fontWeight: 850,
                    cursor: "pointer",
                  }}
                >
                  {loading ? "Chargement..." : "Rafraîchir"}
                </button>
              </div>

              <div style={styles.cardBody}>
                <div style={styles.cockpitGrid}>
                  <Link
                    to="/platform-admin/coproprietes"
                    style={styles.cockpitCard}
                  >
                    <p style={styles.cockpitTitle}>Copropriétés</p>
                    <p style={styles.cockpitText}>
                      Créer, consulter et administrer les copropriétés clientes.
                    </p>
                    <p style={styles.cockpitMetric}>
                      {formatNumber(stats.totalCoproprietes)}
                    </p>
                    <p style={styles.cockpitArrow}>Ouvrir →</p>
                  </Link>

                  <Link
                    to="/platform-admin/referentiel-copropriete/coproprietaires"
                    style={styles.cockpitCard}
                  >
                    <p style={styles.cockpitTitle}>Copropriétaires</p>
                    <p style={styles.cockpitText}>
                      Créer les copropriétaires et préparer les affectations.
                    </p>
                    <p style={styles.cockpitMetric}>
                      {formatNumber(stats.coproprietaires)}
                    </p>
                    <p style={styles.cockpitArrow}>Ouvrir →</p>
                  </Link>

                  <Link
                    to="/platform-admin/referentiel-copropriete/lots"
                    style={styles.cockpitCard}
                  >
                    <p style={styles.cockpitTitle}>Lots</p>
                    <p style={styles.cockpitText}>
                      Créer les lots, bâtiments, étages et caractéristiques.
                    </p>
                    <p style={styles.cockpitMetric}>{formatNumber(stats.lots)}</p>
                    <p style={styles.cockpitArrow}>Ouvrir →</p>
                  </Link>

                  <Link
                    to="/platform-admin/referentiel-copropriete/tantiemes"
                    style={styles.cockpitCard}
                  >
                    <p style={styles.cockpitTitle}>Tantièmes</p>
                    <p style={styles.cockpitText}>
                      Renseigner les catégories et les valeurs de répartition.
                    </p>
                    <p style={styles.cockpitMetric}>
                      {formatNumber(stats.tantiemes)}
                    </p>
                    <p style={styles.cockpitArrow}>Ouvrir →</p>
                  </Link>

                  <Link
                    to="/platform-admin/utilisateurs-roles"
                    style={styles.cockpitCard}
                  >
                    <p style={styles.cockpitTitle}>Utilisateurs & rôles</p>
                    <p style={styles.cockpitText}>
                      Superviser les rattachements et habilitations locales.
                    </p>
                    <p style={styles.cockpitMetric}>
                      {formatNumber(stats.membres)}
                    </p>
                    <p style={styles.cockpitArrow}>Ouvrir →</p>
                  </Link>

                  <div style={styles.cockpitCard}>
                    <p style={styles.cockpitTitle}>Catégories de tantièmes</p>
                    <p style={styles.cockpitText}>
                      Catégories disponibles pour les clés de répartition.
                    </p>
                    <p style={styles.cockpitMetric}>
                      {formatNumber(stats.categories)}
                    </p>
                    <p style={{ ...styles.cockpitArrow, color: "#64748b" }}>
                      Liées à l’écran tantièmes
                    </p>
                  </div>
                </div>
              </div>
            </section>

            <section style={styles.card}>
              <div style={styles.cardHeader}>
                <div>
                  <p style={styles.cardEyebrow}>Qualité référentiel</p>
                  <h2 style={styles.cardTitle}>État de préparation</h2>
                  <p style={styles.cardSubtitle}>
                    Lecture rapide des données indispensables avant exploitation
                    complète dans les modules métier.
                  </p>
                </div>

                <span style={badgeStyle(healthTone)}>
                  {stats.completion >= 80
                    ? "Référentiel solide"
                    : stats.completion >= 45
                      ? "À compléter"
                      : "Données insuffisantes"}
                </span>
              </div>

              <div style={styles.cardBody}>
                <div style={styles.healthGrid}>
                  <div style={styles.healthItem}>
                    <p style={styles.healthLabel}>Copropriétés actives</p>
                    <p style={styles.healthValue}>
                      {formatNumber(stats.activeCoproprietes)}
                    </p>
                    <p style={styles.healthText}>
                      Copropriétés prêtes à l’exploitation.
                    </p>
                  </div>

                  <div style={styles.healthItem}>
                    <p style={styles.healthLabel}>Copropriétaires</p>
                    <p style={styles.healthValue}>
                      {formatNumber(stats.coproprietaires)}
                    </p>
                    <p style={styles.healthText}>
                      Personnes physiques ou morales à rattacher aux lots.
                    </p>
                  </div>

                  <div style={styles.healthItem}>
                    <p style={styles.healthLabel}>Lots</p>
                    <p style={styles.healthValue}>{formatNumber(stats.lots)}</p>
                    <p style={styles.healthText}>
                      Base indispensable pour charges, AG, votes et relances.
                    </p>
                  </div>

                  <div style={styles.healthItem}>
                    <p style={styles.healthLabel}>Total tantièmes lots</p>
                    <p style={styles.healthValue}>
                      {formatNumber(stats.totalTantiemes)}
                    </p>
                    <p style={styles.healthText}>
                      À contrôler selon la clé officielle de répartition.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            <section style={styles.card}>
              <div style={styles.cardHeader}>
                <div>
                  <p style={styles.cardEyebrow}>Copropriétés récentes</p>
                  <h2 style={styles.cardTitle}>Dernières fiches plateforme</h2>
                  <p style={styles.cardSubtitle}>
                    Aperçu rapide des copropriétés disponibles dans le référentiel.
                  </p>
                </div>
              </div>

              <div style={styles.cardBody}>
                <div style={styles.tableWrap}>
                  <div style={styles.tableScroll}>
                    <table style={styles.table}>
                      <thead>
                        <tr>
                          <th style={styles.th}>Copropriété</th>
                          <th style={styles.th}>Ville</th>
                          <th style={styles.th}>Pays</th>
                          <th style={styles.th}>Statut</th>
                        </tr>
                      </thead>
                      <tbody>
                        {coproprietes.slice(0, 6).map((item) => (
                          <tr key={item.id}>
                            <td style={styles.td}>
                              <Link
                                to={`/platform-admin/coproprietes/${item.id}`}
                                style={{
                                  color: "#0f172a",
                                  fontWeight: 950,
                                  textDecoration: "none",
                                }}
                              >
                                {item.nom}
                              </Link>
                              <p style={styles.muted}>ID #{item.id}</p>
                            </td>
                            <td style={styles.td}>{item.ville || "—"}</td>
                            <td style={styles.td}>{item.pays || "—"}</td>
                            <td style={styles.td}>
                              <span
                                style={badgeStyle(
                                  isActiveCopro(item) ? "success" : "neutral",
                                )}
                              >
                                {item.statut || (item.is_active ? "ACTIVE" : "—")}
                              </span>
                            </td>
                          </tr>
                        ))}

                        {!loading && coproprietes.length === 0 ? (
                          <tr>
                            <td style={styles.td} colSpan={4}>
                              Aucune copropriété trouvée.
                            </td>
                          </tr>
                        ) : null}

                        {loading ? (
                          <tr>
                            <td style={styles.td} colSpan={4}>
                              Chargement des copropriétés...
                            </td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </section>
          </main>

          <aside style={styles.side}>
            <div style={styles.sideCard}>
              <p style={styles.sideEyebrow}>Lecture produit</p>
              <h2 style={styles.sideTitle}>Référentiel central</h2>
              <p style={styles.sideText}>
                Le référentiel copropriété est le socle de tout le SaaS :
                sans lots, tantièmes, copropriétaires et rôles, les modules AG,
                charges, relances et comptabilité ne peuvent pas produire une
                donnée métier fiable.
              </p>
            </div>

            <div style={styles.sideCardBlue}>
              <p style={{ ...styles.sideEyebrow, color: "#4f46e5" }}>
                Copropriété active
              </p>
              <h3 style={{ ...styles.sideTitle, color: "#312e81" }}>
                {activeCopropriete?.nom || "Non sélectionnée"}
              </h3>
              <p style={{ ...styles.sideText, color: "#4338ca" }}>
                {activeCopropriete
                  ? `ID actif détecté : ${activeCopropriete.id}.`
                  : "Le cockpit affiche les données globales lorsque aucune copropriété active n’est détectée."}
              </p>
            </div>

            <div style={styles.sideCardGreen}>
              <p style={{ ...styles.sideEyebrow, color: "#047857" }}>
                Parcours recommandé
              </p>
              <h3 style={{ ...styles.sideTitle, color: "#064e3b" }}>
                Ordre de préparation
              </h3>

              <div style={styles.checklist}>
                <div style={styles.checklistItem}>
                  <span style={styles.checklistLabel}>1. Copropriété</span>
                  <span style={styles.checklistValue}>
                    {stats.totalCoproprietes > 0 ? "OK" : "À créer"}
                  </span>
                </div>

                <div style={styles.checklistItem}>
                  <span style={styles.checklistLabel}>2. Copropriétaires</span>
                  <span style={styles.checklistValue}>
                    {stats.coproprietaires > 0 ? "OK" : "À compléter"}
                  </span>
                </div>

                <div style={styles.checklistItem}>
                  <span style={styles.checklistLabel}>3. Lots</span>
                  <span style={styles.checklistValue}>
                    {stats.lots > 0 ? "OK" : "À compléter"}
                  </span>
                </div>

                <div style={styles.checklistItem}>
                  <span style={styles.checklistLabel}>4. Tantièmes</span>
                  <span style={styles.checklistValue}>
                    {stats.tantiemes > 0 ? "OK" : "À compléter"}
                  </span>
                </div>

                <div style={{ ...styles.checklistItem, borderBottom: "none" }}>
                  <span style={styles.checklistLabel}>5. Rôles locaux</span>
                  <span style={styles.checklistValue}>
                    {stats.membres > 0 ? "OK" : "À compléter"}
                  </span>
                </div>
              </div>
            </div>

            <div style={styles.sideCardAmber}>
              <p style={{ ...styles.sideEyebrow, color: "#b45309" }}>
                Point de vigilance
              </p>
              <h3 style={{ ...styles.sideTitle, color: "#92400e" }}>
                Tantièmes officiels
              </h3>
              <p style={{ ...styles.sideText, color: "#92400e" }}>
                Le total affiché ici est une lecture rapide. Pour une exploitation
                commerciale, il faudra contrôler les clés exactes par catégorie et
                par copropriété.
              </p>
            </div>
          </aside>
        </div>
      </section>
    </div>
  );
}