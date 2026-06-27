import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
} from "react";

import api from "../../api/axios";
import {
  getReunionsRencontresCoproprietaire,
  type CoproprietaireReunionDocument,
  type CoproprietaireReunionRencontre,
} from "../../api/coproprietaire";
import { ENDPOINTS } from "../../api/endpoints";

type LoadState = "idle" | "loading" | "success" | "error";

const typeOptions = [
  ["", "Tous les types"],
  ["REUNION_INTERNE", "Réunions internes"],
  ["INFORMATION_CONCERTATION", "Information / concertation"],
  ["RENCONTRE_FOURNISSEUR", "Rencontres fournisseurs"],
  ["RENCONTRE_AUTORITE", "Rencontres autorités"],
  ["AUTRE", "Autres"],
];

function getErrorMessage(error: unknown, fallback: string) {
  const err = error as {
    response?: { data?: Record<string, unknown> };
    message?: string;
  };

  const data = err.response?.data;

  if (data) {
    if (typeof data.detail === "string") return data.detail;

    const entries = Object.entries(data);
    if (entries.length) {
      return entries
        .map(([key, value]) => {
          if (Array.isArray(value)) return `${key}: ${value.join(" / ")}`;
          if (typeof value === "string") return `${key}: ${value}`;
          return `${key}: ${JSON.stringify(value)}`;
        })
        .join("\n");
    }
  }

  return err.message || fallback;
}

function formatDateTime(value?: string | null) {
  if (!value) return "—";

  const date = new Date(value);

  if (!Number.isNaN(date.getTime())) {
    return date.toLocaleString("fr-FR", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  }

  return String(value);
}

function formatDate(value?: string | null) {
  if (!value) return "—";

  const date = new Date(value);

  if (!Number.isNaN(date.getTime())) {
    return date.toLocaleDateString("fr-FR", {
      dateStyle: "medium",
    });
  }

  return String(value);
}

function formatNumber(value: number | string | null | undefined) {
  return new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function getTypeLabel(item: CoproprietaireReunionRencontre) {
  return item.type_label || item.type || "Réunion";
}

function getStatusLabel(item: CoproprietaireReunionRencontre) {
  return item.statut_label || item.statut || "Publiée";
}

export default function CoproprietaireReunionsRencontres() {
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [items, setItems] = useState<CoproprietaireReunionRencontre[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [typeFilter, setTypeFilter] = useState("");
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState("");

  const selected = useMemo(
    () => items.find((item) => item.id === selectedId) ?? items[0] ?? null,
    [items, selectedId],
  );

  const loadData = useCallback(async () => {
    setLoadState("loading");
    setNotice("");

    try {
      const data = await getReunionsRencontresCoproprietaire({
        type: typeFilter || undefined,
        q: query.trim() || undefined,
      });

      setItems(data);
      setSelectedId((current) => {
        if (current && data.some((item) => item.id === current)) return current;
        return data[0]?.id ?? null;
      });
      setLoadState("success");
    } catch (error) {
      setLoadState("error");
      setNotice(
        getErrorMessage(
          error,
          "Impossible de charger les réunions et rencontres publiées.",
        ),
      );
    }
  }, [query, typeFilter]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadData();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadData]);

  const stats = useMemo(() => {
    const documents = items.reduce(
      (total, item) => total + Number(item.documents?.length ?? 0),
      0,
    );
    const actions = items.reduce(
      (total, item) => total + Number(item.actions?.length ?? 0),
      0,
    );

    return {
      total: items.length,
      documents,
      actions,
    };
  }, [items]);

  const openDocument = useCallback(
    async (documentItem: CoproprietaireReunionDocument, download = false) => {
      setNotice("");

      try {
        const response = await api.get<Blob>(
          ENDPOINTS.coproprietaireReunionDocumentDownload(documentItem.id),
          {
            responseType: "blob",
            params: {
              download: download ? 1 : 0,
            },
          },
        );

        const blobUrl = window.URL.createObjectURL(response.data);
        const filename =
          documentItem.filename || `${documentItem.titre || "document"}.pdf`;

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
        setNotice(getErrorMessage(error, "Impossible d’ouvrir ce document."));
      }
    },
    [],
  );

  return (
    <div className="coproOwnerPage coproOwnerMeetingsPage" style={styles.stack}>
      <section className="coproOwnerMobileSafeCard" style={styles.hero}>
        <div>
          <p style={styles.eyebrow}>Réunions & rencontres</p>
          <h2 style={styles.heroTitle}>Réunions publiées par le syndic</h2>
          <p style={styles.heroText}>
            Consultez les réunions courantes, rencontres prestataires, comptes
            rendus, documents partagés et actions de suivi publiés dans votre
            espace copropriétaire.
          </p>
        </div>

        <div style={styles.heroPills}>
          <span style={styles.pill}>{formatNumber(stats.total)} réunion(s)</span>
          <span style={styles.pill}>{formatNumber(stats.documents)} document(s)</span>
          <span style={styles.pill}>{formatNumber(stats.actions)} action(s)</span>
        </div>
      </section>

      {notice ? <div style={styles.notice}>{notice}</div> : null}

      <section className="coproOwnerMobileSafeCard" style={styles.card}>
        <div style={styles.filters}>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Rechercher une réunion, un lieu, un compte rendu..."
            style={styles.input}
          />

          <select
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value)}
            style={styles.input}
          >
            {typeOptions.map(([value, label]) => (
              <option key={value || "all"} value={value}>
                {label}
              </option>
            ))}
          </select>

          <button type="button" onClick={() => void loadData()} style={styles.secondaryButton}>
            Actualiser
          </button>
        </div>

        {loadState === "loading" ? (
          <div style={styles.empty}>Chargement des réunions publiées...</div>
        ) : loadState === "error" ? (
          <div style={styles.empty}>Impossible de charger les réunions pour le moment.</div>
        ) : items.length === 0 ? (
          <div style={styles.empty}>
            Aucune réunion ou rencontre n’est actuellement publiée dans votre espace.
          </div>
        ) : (
          <div style={styles.grid}>
            <div style={styles.list}>
              {items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedId(item.id)}
                  style={{
                    ...styles.listButton,
                    ...(selected?.id === item.id ? styles.listButtonActive : {}),
                  }}
                >
                  <span style={styles.listType}>{getTypeLabel(item)}</span>
                  <strong>{item.titre}</strong>
                  <span>{formatDateTime(item.date_debut)}</span>
                  <span>{item.lieu || "Lieu non précisé"}</span>
                </button>
              ))}
            </div>

            <div style={styles.detail}>
              {selected ? (
                <>
                  <div style={styles.detailHeader}>
                    <div>
                      <span style={styles.badge}>{getStatusLabel(selected)}</span>
                      <h3 style={styles.detailTitle}>{selected.titre}</h3>
                      <p style={styles.meta}>
                        {getTypeLabel(selected)} · {formatDateTime(selected.date_debut)}
                      </p>
                      <p style={styles.meta}>Lieu : {selected.lieu || "—"}</p>
                      <p style={styles.meta}>Publication : {formatDate(selected.date_publication)}</p>
                    </div>
                  </div>

                  {selected.objet || selected.description ? (
                    <section style={styles.detailBlock}>
                      <h4 style={styles.blockTitle}>Objet</h4>
                      <p style={styles.paragraph}>
                        {selected.objet || selected.description}
                      </p>
                    </section>
                  ) : null}

                  {selected.compte_rendu ? (
                    <section style={styles.detailBlock}>
                      <h4 style={styles.blockTitle}>Compte rendu</h4>
                      <p style={styles.paragraph}>{selected.compte_rendu}</p>
                    </section>
                  ) : null}

                  {selected.decisions ? (
                    <section style={styles.detailBlock}>
                      <h4 style={styles.blockTitle}>Décisions</h4>
                      <p style={styles.paragraph}>{selected.decisions}</p>
                    </section>
                  ) : null}

                  <section style={styles.detailBlock}>
                    <h4 style={styles.blockTitle}>Participants</h4>
                    {(selected.participants ?? []).length === 0 ? (
                      <p style={styles.muted}>Aucun participant publié.</p>
                    ) : (
                      <div style={styles.chipGrid}>
                        {selected.participants?.map((participant) => (
                          <span key={participant.id} style={styles.chip}>
                            {participant.nom_complet}
                            {participant.fonction ? ` · ${participant.fonction}` : ""}
                          </span>
                        ))}
                      </div>
                    )}
                  </section>

                  <section style={styles.detailBlock}>
                    <h4 style={styles.blockTitle}>Documents partagés</h4>
                    {(selected.documents ?? []).length === 0 ? (
                      <p style={styles.muted}>Aucun document partagé.</p>
                    ) : (
                      <div style={styles.itemList}>
                        {selected.documents?.map((doc) => (
                          <article key={doc.id} style={styles.documentRow}>
                            <div>
                              <strong>{doc.titre}</strong>
                              <p style={styles.muted}>
                                {doc.type_label || doc.type} · {doc.filename || "fichier"}
                              </p>
                            </div>
                            <div style={styles.actions}>
                              <button
                                type="button"
                                style={styles.secondaryButton}
                                onClick={() => void openDocument(doc, false)}
                              >
                                Ouvrir
                              </button>
                              <button
                                type="button"
                                style={styles.secondaryButton}
                                onClick={() => void openDocument(doc, true)}
                              >
                                Télécharger
                              </button>
                            </div>
                          </article>
                        ))}
                      </div>
                    )}
                  </section>

                  <section style={styles.detailBlock}>
                    <h4 style={styles.blockTitle}>Actions à suivre</h4>
                    {(selected.actions ?? []).length === 0 ? (
                      <p style={styles.muted}>Aucune action publiée.</p>
                    ) : (
                      <div style={styles.itemList}>
                        {selected.actions?.map((action) => (
                          <article key={action.id} style={styles.actionRow}>
                            <div>
                              <strong>{action.titre}</strong>
                              <p style={styles.muted}>{action.description || "—"}</p>
                              <p style={styles.muted}>
                                Responsable : {action.responsable_nom || "—"}
                              </p>
                            </div>
                            <div style={styles.actionMeta}>
                              <span style={styles.smallBadge}>
                                {action.priorite_label || action.priorite}
                              </span>
                              <span style={styles.smallBadge}>
                                {action.statut_label || action.statut}
                              </span>
                              <span style={styles.muted}>
                                Échéance : {action.echeance || "—"}
                              </span>
                            </div>
                          </article>
                        ))}
                      </div>
                    )}
                  </section>
                </>
              ) : (
                <div style={styles.empty}>Sélectionnez une réunion.</div>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  stack: {
    display: "grid",
    gap: 18,
  },
  hero: {
    display: "flex",
    justifyContent: "space-between",
    gap: 18,
    flexWrap: "wrap",
    padding: 22,
    borderRadius: 24,
    border: "1px solid #bae6fd",
    background: "linear-gradient(135deg, #ecfeff 0%, #ffffff 70%)",
  },
  eyebrow: {
    margin: 0,
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    fontWeight: 900,
    color: "#0891b2",
  },
  heroTitle: {
    margin: "8px 0 0",
    fontSize: 26,
    color: "#0f172a",
    letterSpacing: -0.6,
  },
  heroText: {
    margin: "10px 0 0",
    maxWidth: 780,
    color: "#475569",
    fontSize: 14,
    lineHeight: 1.7,
  },
  heroPills: {
    display: "flex",
    alignItems: "flex-start",
    gap: 8,
    flexWrap: "wrap",
  },
  pill: {
    borderRadius: 999,
    border: "1px solid #67e8f9",
    background: "#ffffff",
    color: "#155e75",
    padding: "8px 10px",
    fontSize: 12,
    fontWeight: 900,
  },
  notice: {
    padding: 12,
    borderRadius: 16,
    border: "1px solid #fca5a5",
    background: "#fef2f2",
    color: "#991b1b",
    fontSize: 13,
    fontWeight: 800,
    whiteSpace: "pre-wrap",
  },
  card: {
    padding: 18,
    borderRadius: 24,
    border: "1px solid #e2e8f0",
    background: "#ffffff",
    boxShadow: "0 10px 28px rgba(15, 23, 42, 0.06)",
  },
  filters: {
    display: "grid",
    gridTemplateColumns: "minmax(240px, 1fr) 240px auto",
    gap: 10,
    marginBottom: 16,
  },
  input: {
    border: "1px solid #cbd5e1",
    borderRadius: 14,
    padding: "10px 12px",
    fontSize: 13,
    color: "#0f172a",
    background: "#ffffff",
  },
  secondaryButton: {
    border: "1px solid #cbd5e1",
    borderRadius: 14,
    padding: "9px 12px",
    background: "#ffffff",
    color: "#0f172a",
    fontSize: 12,
    fontWeight: 900,
    cursor: "pointer",
  },
  empty: {
    padding: 18,
    borderRadius: 18,
    border: "1px dashed #cbd5e1",
    background: "#f8fafc",
    color: "#64748b",
    fontSize: 13,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "minmax(260px, 360px) minmax(0, 1fr)",
    gap: 16,
  },
  list: {
    display: "grid",
    gap: 10,
    alignContent: "start",
  },
  listButton: {
    display: "grid",
    gap: 5,
    textAlign: "left",
    border: "1px solid #e2e8f0",
    borderRadius: 18,
    background: "#f8fafc",
    color: "#0f172a",
    padding: 13,
    cursor: "pointer",
  },
  listButtonActive: {
    borderColor: "#67e8f9",
    background: "#ecfeff",
  },
  listType: {
    fontSize: 11,
    color: "#0891b2",
    fontWeight: 900,
    textTransform: "uppercase",
  },
  detail: {
    minWidth: 0,
    display: "grid",
    gap: 14,
  },
  detailHeader: {
    paddingBottom: 12,
    borderBottom: "1px solid #e2e8f0",
  },
  badge: {
    display: "inline-flex",
    borderRadius: 999,
    border: "1px solid #86efac",
    background: "#ecfdf5",
    color: "#166534",
    padding: "5px 9px",
    fontSize: 11,
    fontWeight: 900,
  },
  detailTitle: {
    margin: "10px 0 0",
    fontSize: 22,
    color: "#0f172a",
  },
  meta: {
    margin: "6px 0 0",
    color: "#64748b",
    fontSize: 13,
  },
  detailBlock: {
    display: "grid",
    gap: 8,
  },
  blockTitle: {
    margin: 0,
    fontSize: 15,
    color: "#0f172a",
    fontWeight: 900,
  },
  paragraph: {
    margin: 0,
    color: "#334155",
    fontSize: 14,
    lineHeight: 1.7,
    whiteSpace: "pre-wrap",
  },
  muted: {
    margin: 0,
    color: "#64748b",
    fontSize: 12,
    lineHeight: 1.5,
  },
  chipGrid: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },
  chip: {
    borderRadius: 999,
    background: "#f1f5f9",
    border: "1px solid #e2e8f0",
    padding: "7px 10px",
    color: "#334155",
    fontSize: 12,
    fontWeight: 800,
  },
  itemList: {
    display: "grid",
    gap: 10,
  },
  documentRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
    padding: 12,
    borderRadius: 16,
    border: "1px solid #e2e8f0",
    background: "#f8fafc",
  },
  actionRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
    padding: 12,
    borderRadius: 16,
    border: "1px solid #e2e8f0",
    background: "#f8fafc",
  },
  actions: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  actionMeta: {
    display: "flex",
    alignItems: "flex-end",
    flexDirection: "column",
    gap: 6,
  },
  smallBadge: {
    borderRadius: 999,
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#334155",
    padding: "5px 8px",
    fontSize: 11,
    fontWeight: 900,
  },
};
