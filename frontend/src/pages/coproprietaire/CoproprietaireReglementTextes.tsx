import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";

import {
  getCoproprietaireReglementTextes,
  type CoproprietaireReglementTexte,
  type ReglementTexteCategorie,
} from "../../api/reglementTextes";

type FilterItem = {
  label: string;
  value: ReglementTexteCategorie | "";
};

const FILTERS: FilterItem[] = [
  { label: "Tous", value: "" },
  { label: "Règlement copropriété", value: "REGLEMENT_COPROPRIETE" },
  { label: "Règlement intérieur", value: "REGLEMENT_INTERIEUR" },
  { label: "Textes de loi", value: "TEXTE_LOI" },
  { label: "Notes syndic", value: "NOTE_SYNDIC" },
  { label: "Vie commune", value: "VIE_COMMUNE" },
  { label: "Charges", value: "CHARGES_COTISATIONS" },
  { label: "AG", value: "ASSEMBLEES_GENERALES" },
  { label: "Travaux", value: "TRAVAUX_ENTRETIEN" },
  { label: "Documents", value: "DOCUMENT_ADMINISTRATIF" },
];

const CATEGORY_ICONS: Record<string, string> = {
  REGLEMENT_COPROPRIETE: "📘",
  REGLEMENT_INTERIEUR: "🏡",
  TEXTE_LOI: "⚖️",
  NOTE_SYNDIC: "📝",
  VIE_COMMUNE: "🤝",
  CHARGES_COTISATIONS: "💳",
  ASSEMBLEES_GENERALES: "🗳️",
  TRAVAUX_ENTRETIEN: "🛠️",
  DOCUMENT_ADMINISTRATIF: "📄",
  AUTRE: "📚",
};

export default function CoproprietaireReglementTextes() {
  const [textes, setTextes] = useState<CoproprietaireReglementTexte[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [categorie, setCategorie] = useState<ReglementTexteCategorie | "">("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    let mounted = true;

    async function loadTextes() {
      setLoading(true);
      setError("");

      try {
        const data = await getCoproprietaireReglementTextes({
          categorie,
          q: search.trim(),
        });

        if (mounted) {
          setTextes(data);
        }
      } catch (err) {
        console.error(err);

        if (mounted) {
          setError(
            "Impossible de charger les règlements et textes utiles pour le moment.",
          );
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadTextes();

    return () => {
      mounted = false;
    };
  }, [categorie, search]);

  const stats = useMemo(() => {
    const published = textes.filter((item) => item.statut === "PUBLIE").length;
    const withFile = textes.filter((item) => Boolean(item.fichier_url)).length;
    const categories = new Set(textes.map((item) => item.categorie)).size;

    return {
      total: textes.length,
      published,
      withFile,
      categories,
    };
  }, [textes]);

  const groupedTextes = useMemo(() => {
    const groups = new Map<string, CoproprietaireReglementTexte[]>();

    textes.forEach((item) => {
      const label = item.categorie_label || "Autres documents";

      if (!groups.has(label)) {
        groups.set(label, []);
      }

      groups.get(label)?.push(item);
    });

    return Array.from(groups.entries());
  }, [textes]);

  return (
    <div className="coproOwnerPage coproOwnerTextsPage" style={styles.stack}>
      <section style={styles.hero}>
        <div style={styles.heroContent}>
          <div style={styles.heroBadge}>Lecture seule</div>

          <h2 style={styles.heroTitle}>Règlement & textes utiles</h2>

          <p style={styles.heroText}>
            Retrouvez les règles, notes, documents et textes publiés par le
            syndic ou l’administration de votre copropriété. Seuls les contenus
            officiellement publiés et rendus visibles aux copropriétaires
            apparaissent ici.
          </p>

          <div style={styles.heroMeta}>
            <span style={styles.metaPill}>Publication syndic</span>
            <span style={styles.metaPill}>Consultation copropriétaire</span>
            <span style={styles.metaPill}>Documents utiles</span>
          </div>
        </div>

        <div style={styles.secureBox}>
          <div style={styles.secureIcon}>📚</div>
          <p style={styles.secureTitle}>Textes publiés</p>
          <p style={styles.secureText}>
            Cette page est alimentée par les textes ajoutés et publiés depuis
            l’espace admin/syndic.
          </p>
        </div>
      </section>

      <section style={styles.statsGrid}>
        <StatCard label="Textes visibles" value={stats.total} helper="Publiés pour vous" />
        <StatCard label="Catégories" value={stats.categories} helper="Types de contenus" />
        <StatCard label="Documents joints" value={stats.withFile} helper="Fichiers disponibles" />
        <StatCard label="Statut" value={stats.published} helper="Éléments publiés" />
      </section>

      <section style={styles.noticeCard}>
        <div style={styles.noticeIcon}>ℹ️</div>
        <div>
          <p style={styles.noticeTitle}>Information importante</p>
          <p style={styles.noticeText}>
            Les informations affichées ici ne remplacent pas les actes
            officiels signés ni les conseils d’un professionnel compétent.
            Elles servent de repères pratiques pour les copropriétaires.
          </p>
        </div>
      </section>

      <section className="coproOwnerToolbar" style={styles.toolbar}>
        <div style={styles.searchBlock}>
          <label style={styles.inputLabel}>Recherche</label>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Rechercher un texte, une règle, une note..."
            style={styles.searchInput}
          />
        </div>

        <div style={styles.filterBlock}>
          <label style={styles.inputLabel}>Catégorie</label>
          <select
            value={categorie}
            onChange={(event) =>
              setCategorie(event.target.value as ReglementTexteCategorie | "")
            }
            style={styles.select}
          >
            {FILTERS.map((filter) => (
              <option key={filter.value || "all"} value={filter.value}>
                {filter.label}
              </option>
            ))}
          </select>
        </div>
      </section>

      {error ? <div style={styles.errorBox}>{error}</div> : null}

      {loading ? (
        <section className="coproOwnerMobileSafeCard" style={styles.card}>
          <p style={styles.loadingText}>Chargement des textes utiles...</p>
        </section>
      ) : textes.length === 0 ? (
        <section style={styles.emptyCard}>
          <div style={styles.emptyIcon}>📭</div>
          <h3 style={styles.emptyTitle}>Aucun texte publié pour le moment</h3>
          <p style={styles.emptyText}>
            Le syndic ou l’administration de la copropriété pourra publier ici
            le règlement intérieur, les textes utiles, notes d’information ou
            documents de référence visibles par les copropriétaires.
          </p>
        </section>
      ) : (
        <section style={styles.groupsStack}>
          {groupedTextes.map(([groupLabel, items]) => (
            <div className="coproOwnerMobileSafeCard" key={groupLabel} style={styles.card}>
              <div className="coproOwnerSectionHeader" style={styles.sectionHeader}>
                <div>
                  <p style={styles.sectionEyebrow}>Catégorie</p>
                  <h3 style={styles.sectionTitle}>{groupLabel}</h3>
                </div>

                <span style={styles.counterPill}>
                  {items.length} élément{items.length > 1 ? "s" : ""}
                </span>
              </div>

              <div style={styles.textesList}>
                {items.map((item) => (
                  <TexteCard key={item.id} texte={item} />
                ))}
              </div>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}

function TexteCard({ texte }: { texte: CoproprietaireReglementTexte }) {
  const icon = CATEGORY_ICONS[texte.categorie] || "📚";
  const datePublication = formatDate(texte.date_publication);

  function openFile() {
    if (!texte.fichier_url) {
      return;
    }

    window.open(texte.fichier_url, "_blank", "noopener,noreferrer");
  }

  return (
    <article className="coproOwnerMobileSafeCard" style={styles.texteCard}>
      <div style={styles.texteIcon}>{icon}</div>

      <div style={styles.texteBody}>
        <div style={styles.texteHeader}>
          <div>
            <h4 style={styles.texteTitle}>{texte.titre}</h4>

            <div style={styles.texteMeta}>
              <span style={styles.statusPill}>{texte.statut_label || "Publié"}</span>

              {datePublication ? (
                <span style={styles.metaText}>Publié le {datePublication}</span>
              ) : null}

              {texte.publie_par_label ? (
                <span style={styles.metaText}>Par {texte.publie_par_label}</span>
              ) : null}
            </div>
          </div>

          {texte.fichier_url ? (
            <button type="button" onClick={openFile} style={styles.fileButton}>
              Ouvrir le fichier
            </button>
          ) : null}
        </div>

        {texte.resume ? <p style={styles.texteResume}>{texte.resume}</p> : null}

        {texte.contenu ? (
          <div style={styles.contenuBox}>
            <p style={styles.contenuText}>{texte.contenu}</p>
          </div>
        ) : null}

        {texte.filename ? (
          <p style={styles.filename}>Fichier joint : {texte.filename}</p>
        ) : null}
      </div>
    </article>
  );
}

function StatCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: number | string;
  helper: string;
}) {
  return (
    <article style={styles.statCard}>
      <p style={styles.statLabel}>{label}</p>
      <p style={styles.statValue}>{value}</p>
      <p style={styles.statHelper}>{helper}</p>
    </article>
  );
}

function formatDate(value: string | null | undefined): string {
  if (!value) {
    return "";
  }

  try {
    return new Intl.DateTimeFormat("fr-FR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

const styles: Record<string, CSSProperties> = {
  stack: {
    display: "flex",
    flexDirection: "column",
    gap: 22,
  },

  hero: {
    borderRadius: 34,
    padding: 30,
    background:
      "linear-gradient(135deg, rgba(15,23,42,0.97), rgba(51,65,85,0.94)), radial-gradient(circle at top right, rgba(148,163,184,0.45), transparent 36%)",
    color: "white",
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) 320px",
    gap: 24,
    boxShadow: "0 30px 85px rgba(15,23,42,0.22)",
    overflow: "hidden",
  },

  heroContent: {
    minWidth: 0,
  },

  heroBadge: {
    display: "inline-flex",
    alignItems: "center",
    borderRadius: 999,
    padding: "7px 11px",
    background: "rgba(255,255,255,0.13)",
    border: "1px solid rgba(255,255,255,0.18)",
    color: "#e2e8f0",
    fontSize: 11,
    fontWeight: 950,
    letterSpacing: "0.14em",
    textTransform: "uppercase",
  },

  heroTitle: {
    margin: "14px 0 0",
    fontSize: 36,
    lineHeight: 1.08,
    fontWeight: 950,
    letterSpacing: "-0.04em",
  },

  heroText: {
    margin: "14px 0 0",
    maxWidth: 820,
    color: "#e2e8f0",
    fontSize: 15,
    lineHeight: 1.75,
    fontWeight: 550,
  },

  heroMeta: {
    display: "flex",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 22,
  },

  metaPill: {
    borderRadius: 999,
    padding: "8px 12px",
    background: "rgba(255,255,255,0.14)",
    border: "1px solid rgba(255,255,255,0.20)",
    color: "#ffffff",
    fontSize: 12,
    fontWeight: 850,
  },

  secureBox: {
    alignSelf: "stretch",
    borderRadius: 28,
    padding: 22,
    background: "rgba(255,255,255,0.13)",
    border: "1px solid rgba(255,255,255,0.22)",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.10)",
  },

  secureIcon: {
    width: 48,
    height: 48,
    borderRadius: 18,
    background: "rgba(255,255,255,0.14)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 22,
    marginBottom: 14,
  },

  secureTitle: {
    margin: 0,
    fontSize: 18,
    fontWeight: 950,
  },

  secureText: {
    margin: "10px 0 0",
    color: "#e2e8f0",
    fontSize: 14,
    lineHeight: 1.6,
  },

  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: 14,
  },

  statCard: {
    border: "1px solid #e2e8f0",
    borderRadius: 22,
    background: "#ffffff",
    padding: 18,
    boxShadow: "0 16px 44px rgba(15,23,42,0.06)",
  },

  statLabel: {
    margin: 0,
    color: "#64748b",
    fontSize: 12,
    fontWeight: 850,
  },

  statValue: {
    margin: "8px 0 0",
    color: "#0f172a",
    fontSize: 28,
    fontWeight: 950,
    letterSpacing: "-0.04em",
  },

  statHelper: {
    margin: "5px 0 0",
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: 700,
  },

  noticeCard: {
    border: "1px solid #bfdbfe",
    borderRadius: 24,
    background: "#eff6ff",
    color: "#1e3a8a",
    padding: 18,
    display: "flex",
    gap: 13,
    alignItems: "flex-start",
    boxShadow: "0 16px 44px rgba(37,99,235,0.08)",
  },

  noticeIcon: {
    width: 38,
    height: 38,
    borderRadius: 14,
    background: "#dbeafe",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    fontSize: 18,
  },

  noticeTitle: {
    margin: 0,
    fontSize: 15,
    fontWeight: 950,
  },

  noticeText: {
    margin: "6px 0 0",
    fontSize: 13,
    lineHeight: 1.6,
    color: "#1d4ed8",
    fontWeight: 650,
  },

  toolbar: {
    border: "1px solid #e2e8f0",
    borderRadius: 26,
    background: "#ffffff",
    padding: 18,
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) 280px",
    gap: 14,
    boxShadow: "0 18px 55px rgba(15,23,42,0.07)",
  },

  searchBlock: {
    display: "grid",
    gap: 7,
  },

  filterBlock: {
    display: "grid",
    gap: 7,
  },

  inputLabel: {
    color: "#475569",
    fontSize: 12,
    fontWeight: 900,
  },

  searchInput: {
    width: "100%",
    border: "1px solid #cbd5e1",
    borderRadius: 16,
    padding: "12px 14px",
    fontSize: 14,
    outline: "none",
    background: "#f8fafc",
    color: "#0f172a",
  },

  select: {
    width: "100%",
    border: "1px solid #cbd5e1",
    borderRadius: 16,
    padding: "12px 14px",
    fontSize: 14,
    outline: "none",
    background: "#f8fafc",
    color: "#0f172a",
    fontWeight: 700,
  },

  errorBox: {
    border: "1px solid #fecaca",
    background: "#fff1f2",
    color: "#be123c",
    borderRadius: 18,
    padding: 14,
    fontSize: 13,
    fontWeight: 800,
  },

  card: {
    border: "1px solid #e2e8f0",
    borderRadius: 28,
    background: "#ffffff",
    boxShadow: "0 18px 55px rgba(15,23,42,0.07)",
    padding: 22,
  },

  loadingText: {
    margin: 0,
    color: "#64748b",
    fontSize: 14,
    fontWeight: 700,
  },

  emptyCard: {
    border: "1px dashed #cbd5e1",
    borderRadius: 28,
    background: "#ffffff",
    padding: 34,
    textAlign: "center",
    boxShadow: "0 18px 55px rgba(15,23,42,0.05)",
  },

  emptyIcon: {
    fontSize: 38,
  },

  emptyTitle: {
    margin: "12px 0 0",
    color: "#0f172a",
    fontSize: 21,
    fontWeight: 950,
  },

  emptyText: {
    margin: "8px auto 0",
    maxWidth: 720,
    color: "#64748b",
    fontSize: 14,
    lineHeight: 1.65,
  },

  groupsStack: {
    display: "grid",
    gap: 18,
  },

  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 16,
    alignItems: "flex-start",
    flexWrap: "wrap",
    marginBottom: 18,
  },

  sectionEyebrow: {
    margin: 0,
    color: "#475569",
    fontSize: 11,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.12em",
  },

  sectionTitle: {
    margin: "6px 0 0",
    color: "#0f172a",
    fontSize: 22,
    fontWeight: 950,
    letterSpacing: "-0.03em",
  },

  counterPill: {
    borderRadius: 999,
    padding: "7px 11px",
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    color: "#475569",
    fontSize: 12,
    fontWeight: 900,
  },

  textesList: {
    display: "grid",
    gap: 14,
  },

  texteCard: {
    border: "1px solid #e2e8f0",
    borderRadius: 24,
    background: "#f8fafc",
    padding: 16,
    display: "grid",
    gridTemplateColumns: "48px minmax(0, 1fr)",
    gap: 14,
  },

  texteIcon: {
    width: 48,
    height: 48,
    borderRadius: 18,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 22,
  },

  texteBody: {
    minWidth: 0,
  },

  texteHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "flex-start",
  },

  texteTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: 16,
    fontWeight: 950,
    letterSpacing: "-0.02em",
  },

  texteMeta: {
    marginTop: 8,
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
    alignItems: "center",
  },

  statusPill: {
    borderRadius: 999,
    padding: "5px 9px",
    background: "#ecfdf5",
    border: "1px solid #bbf7d0",
    color: "#047857",
    fontSize: 11,
    fontWeight: 900,
    whiteSpace: "nowrap",
  },

  metaText: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: 700,
  },

  fileButton: {
    border: "1px solid #bfdbfe",
    background: "#eff6ff",
    color: "#1d4ed8",
    borderRadius: 14,
    padding: "9px 11px",
    fontSize: 12,
    fontWeight: 900,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },

  texteResume: {
    margin: "13px 0 0",
    color: "#475569",
    fontSize: 13,
    lineHeight: 1.6,
    fontWeight: 750,
  },

  contenuBox: {
    marginTop: 12,
    borderRadius: 18,
    border: "1px solid #e2e8f0",
    background: "#ffffff",
    padding: 14,
  },

  contenuText: {
    margin: 0,
    color: "#334155",
    fontSize: 13,
    lineHeight: 1.75,
    whiteSpace: "pre-wrap",
  },

  filename: {
    margin: "10px 0 0",
    color: "#64748b",
    fontSize: 12,
    fontWeight: 750,
  },
};