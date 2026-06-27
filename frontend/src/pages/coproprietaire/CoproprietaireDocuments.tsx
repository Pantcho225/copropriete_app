// frontend/src/pages/coproprietaire/CoproprietaireDocuments.tsx
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
} from "react";

import api from "../../api/axios";

import {
  getDocumentsCoproprietaire,
  hideDocumentCoproprietaire,
  restoreDocumentCoproprietaire,
  type CoproprietaireDocumentItem,
  type CoproprietaireDocumentsResponse,
} from "../../api/coproprietaire";

type PageState = {
  loading: boolean;
  data: CoproprietaireDocumentsResponse | null;
  error: string | null;
};

type CategoryFilter = "ALL" | "RELANCE" | "AG" | "AUTRE";
type VisibilityFilter = "VISIBLE" | "HIDDEN";
type StatTone = "blue" | "green" | "orange" | "slate" | "indigo";

export default function CoproprietaireDocuments() {
  const [state, setState] = useState<PageState>({
    loading: true,
    data: null,
    error: null,
  });

  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("ALL");
  const [visibilityFilter, setVisibilityFilter] =
    useState<VisibilityFilter>("VISIBLE");
  const [busyDocumentId, setBusyDocumentId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const includeHidden = visibilityFilter === "HIDDEN";

  const loadDocuments = useCallback(async () => {
    setState((current) => ({
      ...current,
      loading: true,
      error: null,
    }));

    try {
      const data = await getDocumentsCoproprietaire({
        includeHidden,
      });

      setState({
        loading: false,
        data,
        error: null,
      });
    } catch (error) {
      console.error("Erreur chargement documents copropriétaire", error);

      setState({
        loading: false,
        data: null,
        error: "Impossible de charger vos documents pour le moment.",
      });
    }
  }, [includeHidden]);

  useEffect(() => {
    void loadDocuments();
  }, [loadDocuments]);

  const allDocuments = useMemo(() => {
    return state.data?.documents ?? [];
  }, [state.data?.documents]);

  const visibleDocuments = useMemo(() => {
    return allDocuments.filter((documentItem) => !documentItem.is_hidden);
  }, [allDocuments]);

  const hiddenDocuments = useMemo(() => {
    return allDocuments.filter((documentItem) => documentItem.is_hidden);
  }, [allDocuments]);

  const stats = state.data?.stats;

  const visibleCount =
    visibilityFilter === "HIDDEN"
      ? visibleDocuments.length
      : allDocuments.filter((documentItem) => !documentItem.is_hidden).length;

  const hiddenCount = stats?.masques ?? hiddenDocuments.length;

  const documentsForTab = useMemo(() => {
    if (visibilityFilter === "HIDDEN") {
      return allDocuments.filter((documentItem) => documentItem.is_hidden);
    }

    return allDocuments.filter((documentItem) => !documentItem.is_hidden);
  }, [allDocuments, visibilityFilter]);

  const filteredDocuments = useMemo(() => {
    const q = query.trim().toLowerCase();

    return documentsForTab.filter((documentItem) => {
      const haystack = [
        documentItem.titre,
        documentItem.categorie,
        documentItem.source,
        documentItem.filename,
        documentItem.lot?.label,
        documentItem.lot?.reference,
      ]
        .join(" ")
        .toLowerCase();

      const matchesQuery = !q || haystack.includes(q);

      const matchesCategory =
        categoryFilter === "ALL" ||
        documentItem.categorie === categoryFilter ||
        (categoryFilter === "AUTRE" &&
          !["RELANCE", "AG"].includes(documentItem.categorie));

      return matchesQuery && matchesCategory;
    });
  }, [documentsForTab, query, categoryFilter]);

  async function handleHide(documentItem: CoproprietaireDocumentItem) {
    const confirmed = window.confirm(
      "Masquer ce document de votre espace ? Il ne sera pas supprimé du système et vous pourrez le restaurer plus tard.",
    );

    if (!confirmed) return;

    setBusyDocumentId(documentItem.id);
    setNotice(null);

    try {
      await hideDocumentCoproprietaire(documentItem.id);
      setNotice("Le document a été masqué de votre espace personnel.");
      await loadDocuments();
    } catch (error) {
      console.error("Erreur masquage document", error);
      setNotice("Impossible de masquer ce document pour le moment.");
    } finally {
      setBusyDocumentId(null);
    }
  }

  async function handleRestore(documentItem: CoproprietaireDocumentItem) {
    setBusyDocumentId(documentItem.id);
    setNotice(null);

    try {
      await restoreDocumentCoproprietaire(documentItem.id);
      setNotice("Le document a été restauré dans votre espace personnel.");
      await loadDocuments();
    } catch (error) {
      console.error("Erreur restauration document", error);
      setNotice("Impossible de restaurer ce document pour le moment.");
    } finally {
      setBusyDocumentId(null);
    }
  }

  async function handleOpenDocument(
    documentItem: CoproprietaireDocumentItem,
    download = false,
  ) {
    if (!documentItem.url) {
      setNotice("Le lien du document est indisponible.");
      return;
    }

    setBusyDocumentId(documentItem.id);
    setNotice(null);

    try {
      const response = await api.get<Blob>(documentItem.url, {
        responseType: "blob",
        params: {
          download: download ? 1 : 0,
        },
      });

      const blobUrl = window.URL.createObjectURL(response.data);
      const filename =
        documentItem.filename ||
        `${documentItem.titre || "document-coproprietaire"}.pdf`;

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
    } catch (error) {
      console.error("Erreur ouverture document copropriétaire", error);
      setNotice("Impossible d’ouvrir ce document pour le moment.");
    } finally {
      setBusyDocumentId(null);
    }
  }

  if (state.loading) {
    return (
      <div style={styles.loadingCard}>
        <div style={styles.loadingIcon}>📁</div>
        <div>
          <p style={styles.loadingTitle}>Chargement de vos documents...</p>
          <p style={styles.muted}>
            Nous récupérons uniquement les documents accessibles à votre compte.
          </p>
        </div>
      </div>
    );
  }

  if (state.error) {
    return (
      <div style={styles.alertDanger}>
        <strong>Erreur de chargement</strong>
        <p style={styles.alertText}>{state.error}</p>
      </div>
    );
  }

  return (
    <div className="coproOwnerPage coproOwnerDocumentsPage" style={styles.stack}>
      <section style={styles.hero}>
        <div style={styles.heroContent}>
          <div style={styles.heroBadge}>Bibliothèque personnelle</div>

          <h2 style={styles.heroTitle}>Vos documents</h2>

          <p style={styles.heroText}>
            Consultez vos procès-verbaux, relances et documents partagés. Vous
            pouvez masquer un document de votre vue sans le supprimer du système.
          </p>

          <div style={styles.heroMeta}>
            <span style={styles.metaPill}>
              Visibles : {formatNumber(visibleCount)}
            </span>
            <span style={styles.metaPill}>
              Masqués : {formatNumber(hiddenCount)}
            </span>
            <span style={styles.metaPill}>
              PV AG : {formatNumber(stats?.ag ?? 0)}
            </span>
          </div>
        </div>

        <div style={styles.secureBox}>
          <div style={styles.secureIcon}>🔐</div>
          <p style={styles.secureTitle}>Documents sécurisés</p>
          <p style={styles.secureText}>
            Les documents officiels restent conservés. Le masquage concerne
            uniquement votre affichage personnel.
          </p>
        </div>
      </section>

      {notice ? <div style={styles.notice}>{notice}</div> : null}

      <section style={styles.grid}>
        <StatCard
          title="Documents visibles"
          value={formatNumber(visibleCount)}
          description="Documents actuellement affichés"
          tone="blue"
        />
        <StatCard
          title="Masqués"
          value={formatNumber(hiddenCount)}
          description="Retirés de votre vue personnelle"
          tone={hiddenCount > 0 ? "slate" : "indigo"}
        />
        <StatCard
          title="PV AG"
          value={formatNumber(stats?.ag ?? 0)}
          description="Procès-verbaux disponibles"
          tone="green"
        />
        <StatCard
          title="Relances"
          value={formatNumber(stats?.relances ?? 0)}
          description="Documents de relance"
          tone="orange"
        />
      </section>

      <section className="coproOwnerMobileSafeCard" style={styles.card}>
        <div className="coproOwnerToolbar" style={styles.toolbar}>
          <div>
            <p style={styles.sectionEyebrow}>Bibliothèque</p>
            <h3 style={styles.sectionTitle}>
              {visibilityFilter === "VISIBLE"
                ? "Documents disponibles"
                : "Documents masqués"}
            </h3>
            <p style={styles.sectionText}>
              Recherchez, ouvrez ou organisez les documents accessibles à votre
              espace copropriétaire.
            </p>
          </div>

          <div style={styles.tabs}>
            <button
              type="button"
              onClick={() => setVisibilityFilter("VISIBLE")}
              style={{
                ...styles.tabButton,
                ...(visibilityFilter === "VISIBLE" ? styles.tabButtonActive : {}),
              }}
            >
              Visibles
            </button>

            <button
              type="button"
              onClick={() => setVisibilityFilter("HIDDEN")}
              style={{
                ...styles.tabButton,
                ...(visibilityFilter === "HIDDEN" ? styles.tabButtonActive : {}),
              }}
            >
              Masqués
            </button>
          </div>
        </div>

        <div className="coproOwnerFilters" style={styles.filters}>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Rechercher un document, une catégorie, un fichier..."
            style={styles.searchInput}
          />

          <select
            value={categoryFilter}
            onChange={(event) =>
              setCategoryFilter(event.target.value as CategoryFilter)
            }
            style={styles.select}
          >
            <option value="ALL">Tous les documents</option>
            <option value="RELANCE">Relances</option>
            <option value="AG">Assemblée générale</option>
            <option value="AUTRE">Autres</option>
          </select>

          <div style={styles.resultPill}>
            {formatNumber(filteredDocuments.length)} document(s)
          </div>
        </div>

        {filteredDocuments.length === 0 ? (
          <EmptyState
            icon={visibilityFilter === "VISIBLE" ? "📁" : "🙈"}
            title={
              visibilityFilter === "VISIBLE"
                ? "Aucun document disponible"
                : "Aucun document masqué"
            }
            text={
              visibilityFilter === "VISIBLE"
                ? "Aucun document n’est actuellement accessible pour votre compte copropriétaire."
                : "Vous n’avez masqué aucun document pour le moment."
            }
          />
        ) : (
          <div style={styles.documentList}>
            {filteredDocuments.map((documentItem) => (
              <DocumentRow
                key={documentItem.id}
                documentItem={documentItem}
                busy={busyDocumentId === documentItem.id}
                onHide={handleHide}
                onRestore={handleRestore}
                onOpen={handleOpenDocument}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function DocumentRow({
  documentItem,
  busy,
  onHide,
  onRestore,
  onOpen,
}: {
  documentItem: CoproprietaireDocumentItem;
  busy: boolean;
  onHide: (documentItem: CoproprietaireDocumentItem) => void;
  onRestore: (documentItem: CoproprietaireDocumentItem) => void;
  onOpen: (documentItem: CoproprietaireDocumentItem, download?: boolean) => void;
}) {
  const categoryLabel = formatCategory(documentItem.categorie);
  const categoryIcon = getDocumentIcon(documentItem.categorie);

  return (
    <article style={styles.documentRow}>
      <div style={styles.documentIcon}>{categoryIcon}</div>

      <div style={styles.documentMain}>
        <div style={styles.documentHeaderLine}>
          <span style={styles.documentCategory}>{categoryLabel}</span>
          <span style={styles.sourceBadge}>{documentItem.source || "Source"}</span>

          {documentItem.is_hidden ? (
            <span style={styles.hiddenBadge}>Masqué</span>
          ) : null}
        </div>

        <h4 style={styles.documentTitle}>
          {documentItem.titre || "Document sans titre"}
        </h4>

        <div style={styles.documentMetaLine}>
          <span>Date : {formatDate(documentItem.date_document)}</span>
          <span>Fichier : {documentItem.filename || "—"}</span>
          <span>
            Lot : {documentItem.lot?.label || "Document général"}
          </span>
        </div>
      </div>

      <div style={styles.documentActions}>
        {!documentItem.is_hidden ? (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={() => onOpen(documentItem, false)}
              style={{
                ...styles.openButton,
                ...(busy ? styles.disabledButton : {}),
              }}
            >
              {busy ? "Ouverture..." : "Ouvrir"}
            </button>

            <button
              type="button"
              disabled={busy}
              onClick={() => onOpen(documentItem, true)}
              style={{
                ...styles.hideButton,
                ...(busy ? styles.disabledButton : {}),
              }}
            >
              Télécharger
            </button>
          </>
        ) : null}

        {documentItem.is_hidden ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => onRestore(documentItem)}
            style={{
              ...styles.restoreButton,
              ...(busy ? styles.disabledButton : {}),
            }}
          >
            {busy ? "Restauration..." : "Restaurer"}
          </button>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={() => onHide(documentItem)}
            style={{
              ...styles.hideButton,
              ...(busy ? styles.disabledButton : {}),
            }}
          >
            {busy ? "Masquage..." : "Masquer"}
          </button>
        )}
      </div>
    </article>
  );
}

function StatCard({
  title,
  value,
  description,
  tone,
}: {
  title: string;
  value: string;
  description: string;
  tone: StatTone;
}) {
  const toneStyle = statTones[tone];

  return (
    <div
      style={{
        ...styles.statCard,
        borderColor: toneStyle.border,
        background: toneStyle.background,
      }}
    >
      <p style={styles.statTitle}>{title}</p>
      <p style={{ ...styles.statValue, color: toneStyle.color }}>{value}</p>
      <p style={styles.statDescription}>{description}</p>
    </div>
  );
}

function EmptyState({
  icon,
  title,
  text,
}: {
  icon: string;
  title: string;
  text: string;
}) {
  return (
    <div style={styles.emptyState}>
      <div style={styles.emptyIcon}>{icon}</div>
      <p style={styles.emptyTitle}>{title}</p>
      <p style={styles.emptyText}>{text}</p>
    </div>
  );
}

function formatCategory(value: string | null | undefined) {
  const normalized = String(value ?? "").trim().toUpperCase();

  const labels: Record<string, string> = {
    AG: "Assemblée générale",
    RELANCE: "Relance",
    APPEL: "Appel de charges",
    PAIEMENT: "Paiement",
    AUTRE: "Autre",
    ADMINISTRATIF: "Document administratif",
  };

  return labels[normalized] || value || "Document";
}

function getDocumentIcon(value: string | null | undefined) {
  const normalized = String(value ?? "").trim().toUpperCase();

  if (normalized === "AG") return "PV";
  if (normalized === "RELANCE") return "🔔";
  if (normalized === "APPEL") return "📄";
  if (normalized === "PAIEMENT") return "💳";
  if (normalized === "ADMINISTRATIF") return "ADM";

  return "DOC";
}

function formatNumber(value: number | string | null | undefined) {
  const numberValue = Number(value || 0);

  return new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: 0,
  }).format(numberValue);
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

const statTones: Record<
  StatTone,
  { background: string; border: string; color: string }
> = {
  blue: {
    background: "#eff6ff",
    border: "#bfdbfe",
    color: "#2563eb",
  },
  green: {
    background: "#ecfdf5",
    border: "#bbf7d0",
    color: "#059669",
  },
  orange: {
    background: "#fff7ed",
    border: "#fed7aa",
    color: "#ea580c",
  },
  slate: {
    background: "#f8fafc",
    border: "#e2e8f0",
    color: "#475569",
  },
  indigo: {
    background: "#eef2ff",
    border: "#c7d2fe",
    color: "#4f46e5",
  },
};

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
      "linear-gradient(135deg, rgba(15,23,42,0.97), rgba(37,99,235,0.92)), radial-gradient(circle at top right, rgba(125,211,252,0.46), transparent 36%)",
    color: "white",
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) 320px",
    gap: 24,
    boxShadow: "0 30px 85px rgba(15,23,42,0.26)",
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
    color: "#dbeafe",
    fontSize: 11,
    fontWeight: 950,
    letterSpacing: "0.14em",
    textTransform: "uppercase",
  },

  heroTitle: {
    margin: "14px 0 0",
    fontSize: 34,
    lineHeight: 1.08,
    fontWeight: 950,
    letterSpacing: "-0.04em",
  },

  heroText: {
    margin: "14px 0 0",
    maxWidth: 860,
    color: "#dbeafe",
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
    color: "#dbeafe",
    fontSize: 14,
    lineHeight: 1.6,
  },

  notice: {
    borderRadius: 20,
    border: "1px solid #bfdbfe",
    background: "#eff6ff",
    color: "#1e40af",
    padding: "13px 15px",
    fontSize: 14,
    fontWeight: 850,
    boxShadow: "0 12px 30px rgba(37,99,235,0.07)",
  },

  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: 16,
  },

  statCard: {
    border: "1px solid",
    borderRadius: 26,
    padding: 19,
    boxShadow: "0 16px 44px rgba(15,23,42,0.06)",
    minHeight: 134,
  },

  statTitle: {
    margin: 0,
    color: "#64748b",
    fontSize: 11,
    fontWeight: 950,
    letterSpacing: "0.14em",
    textTransform: "uppercase",
  },

  statValue: {
    margin: "12px 0 0",
    fontSize: 24,
    lineHeight: 1.2,
    fontWeight: 950,
  },

  statDescription: {
    margin: "8px 0 0",
    color: "#64748b",
    fontSize: 12,
    lineHeight: 1.55,
    fontWeight: 650,
  },

  card: {
    borderRadius: 30,
    background: "rgba(255,255,255,0.92)",
    border: "1px solid rgba(226,232,240,0.95)",
    boxShadow: "0 20px 64px rgba(15,23,42,0.08)",
    padding: 24,
  },

  toolbar: {
    display: "flex",
    justifyContent: "space-between",
    gap: 18,
    alignItems: "flex-start",
    flexWrap: "wrap",
  },

  sectionEyebrow: {
    margin: 0,
    fontSize: 11,
    fontWeight: 950,
    color: "#2563eb",
    letterSpacing: "0.14em",
    textTransform: "uppercase",
  },

  sectionTitle: {
    margin: "7px 0 0",
    fontSize: 21,
    lineHeight: 1.2,
    fontWeight: 950,
    color: "#0f172a",
    letterSpacing: "-0.02em",
  },

  sectionText: {
    margin: "8px 0 0",
    maxWidth: 760,
    color: "#64748b",
    fontSize: 13,
    lineHeight: 1.6,
    fontWeight: 650,
  },

  tabs: {
    display: "inline-flex",
    gap: 8,
    padding: 4,
    borderRadius: 999,
    background: "#f1f5f9",
    border: "1px solid #e2e8f0",
  },

  tabButton: {
    border: "none",
    borderRadius: 999,
    padding: "9px 13px",
    background: "transparent",
    color: "#475569",
    fontSize: 13,
    fontWeight: 950,
    cursor: "pointer",
  },

  tabButtonActive: {
    background: "white",
    color: "#2563eb",
    boxShadow: "0 8px 20px rgba(15,23,42,0.08)",
  },

  filters: {
    marginTop: 20,
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) 220px auto",
    gap: 12,
    alignItems: "center",
  },

  searchInput: {
    border: "1px solid #e2e8f0",
    background: "#f8fafc",
    borderRadius: 18,
    padding: "13px 15px",
    color: "#0f172a",
    fontSize: 14,
    outline: "none",
  },

  select: {
    border: "1px solid #e2e8f0",
    background: "#f8fafc",
    borderRadius: 18,
    padding: "13px 15px",
    color: "#0f172a",
    fontSize: 14,
    outline: "none",
  },

  resultPill: {
    borderRadius: 999,
    padding: "10px 13px",
    background: "#eef2ff",
    border: "1px solid #c7d2fe",
    color: "#4f46e5",
    fontSize: 12,
    fontWeight: 950,
    whiteSpace: "nowrap",
  },

  documentList: {
    marginTop: 20,
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },

  documentRow: {
    display: "grid",
    gridTemplateColumns: "58px minmax(0, 1fr) auto",
    alignItems: "center",
    gap: 15,
    borderRadius: 24,
    border: "1px solid #e2e8f0",
    background:
      "linear-gradient(180deg, rgba(255,255,255,0.98), rgba(248,250,252,0.96))",
    padding: 15,
    boxShadow: "0 14px 38px rgba(15,23,42,0.055)",
  },

  documentIcon: {
    width: 50,
    height: 50,
    borderRadius: 18,
    background: "#eff6ff",
    border: "1px solid #bfdbfe",
    color: "#1d4ed8",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 12,
    fontWeight: 950,
  },

  documentMain: {
    minWidth: 0,
  },

  documentHeaderLine: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
    alignItems: "center",
  },

  documentCategory: {
    color: "#2563eb",
    fontSize: 11,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },

  sourceBadge: {
    display: "inline-flex",
    alignItems: "center",
    borderRadius: 999,
    padding: "4px 8px",
    background: "#eff6ff",
    border: "1px solid #bfdbfe",
    color: "#1d4ed8",
    fontSize: 11,
    fontWeight: 900,
  },

  hiddenBadge: {
    display: "inline-flex",
    alignItems: "center",
    borderRadius: 999,
    padding: "4px 8px",
    background: "#f8fafc",
    border: "1px solid #cbd5e1",
    color: "#475569",
    fontSize: 11,
    fontWeight: 900,
  },

  documentTitle: {
    margin: "7px 0 0",
    color: "#0f172a",
    fontSize: 15,
    fontWeight: 950,
    lineHeight: 1.35,
  },

  documentMetaLine: {
    marginTop: 8,
    display: "flex",
    flexWrap: "wrap",
    gap: 12,
    color: "#64748b",
    fontSize: 12,
    fontWeight: 700,
  },

  documentActions: {
    display: "flex",
    gap: 8,
    alignItems: "center",
  },

  openButton: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 15,
    padding: "10px 13px",
    background: "#2563eb",
    color: "white",
    textDecoration: "none",
    fontSize: 13,
    fontWeight: 950,
    whiteSpace: "nowrap",
    boxShadow: "0 10px 24px rgba(37,99,235,0.16)",
  },

  hideButton: {
    border: "1px solid #fed7aa",
    borderRadius: 15,
    padding: "10px 13px",
    background: "#fff7ed",
    color: "#c2410c",
    fontSize: 13,
    fontWeight: 950,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },

  restoreButton: {
    border: "1px solid #bbf7d0",
    borderRadius: 15,
    padding: "10px 13px",
    background: "#ecfdf5",
    color: "#047857",
    fontSize: 13,
    fontWeight: 950,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },

  disabledButton: {
    opacity: 0.65,
    cursor: "not-allowed",
  },

  emptyState: {
    marginTop: 20,
    borderRadius: 26,
    border: "1px dashed #cbd5e1",
    background: "#f8fafc",
    padding: 30,
    textAlign: "center",
  },

  emptyIcon: {
    width: 48,
    height: 48,
    margin: "0 auto 12px",
    borderRadius: 18,
    background: "#eef2ff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 22,
  },

  emptyTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: 17,
    fontWeight: 950,
  },

  emptyText: {
    margin: "8px auto 0",
    maxWidth: 620,
    color: "#64748b",
    fontSize: 14,
    lineHeight: 1.65,
    fontWeight: 600,
  },

  alertDanger: {
    borderRadius: 26,
    border: "1px solid #fecaca",
    background: "#fff1f2",
    color: "#991b1b",
    padding: 22,
    boxShadow: "0 18px 44px rgba(190,18,60,0.08)",
  },

  alertText: {
    margin: "8px 0 0",
    fontSize: 14,
    lineHeight: 1.6,
  },

  loadingCard: {
    borderRadius: 28,
    background: "rgba(255,255,255,0.92)",
    border: "1px solid rgba(226,232,240,0.95)",
    boxShadow: "0 18px 60px rgba(15,23,42,0.08)",
    padding: 24,
    display: "flex",
    alignItems: "center",
    gap: 14,
  },

  loadingIcon: {
    width: 46,
    height: 46,
    borderRadius: 18,
    background: "#eef2ff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 20,
    flexShrink: 0,
  },

  loadingTitle: {
    margin: 0,
    fontSize: 16,
    fontWeight: 950,
    color: "#0f172a",
  },

  muted: {
    margin: "8px 0 0",
    color: "#64748b",
    fontSize: 13,
    fontWeight: 600,
  },
};