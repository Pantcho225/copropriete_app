import { useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { useSearchParams } from "react-router-dom";

import BackButton from "../../components/ui/BackButton";
import api from "../../api/axios";
import {
  annulerAgConvocation,
  creerRectificativeAgConvocation,
  genererConvocationsAg,
  listAgConvocations,
  marquerConvocationConsultee,
  marquerConvocationEnvoyee,
  type AgConvocation,
  type AgConvocationStatut,
  notifierAgConvocation,
} from "../../api/agConvocations";

const STATUT_LABELS: Record<AgConvocationStatut, string> = {
  GENEREE: "Générée",
  ENVOYEE: "Envoyée",
  CONSULTEE: "Consultée",
  ANNULEE: "Annulée",
};

const STATUT_STYLES: Record<AgConvocationStatut, CSSProperties> = {
  GENEREE: {
    background: "#fff7ed",
    color: "#c2410c",
    borderColor: "#fed7aa",
  },
  ENVOYEE: {
    background: "#eff6ff",
    color: "#1d4ed8",
    borderColor: "#bfdbfe",
  },
  CONSULTEE: {
    background: "#ecfdf5",
    color: "#047857",
    borderColor: "#a7f3d0",
  },
  ANNULEE: {
    background: "#fef2f2",
    color: "#b91c1c",
    borderColor: "#fecaca",
  },
};

type ConvocationWithDocument = AgConvocation & {
  document?: number | null;
  document_url?: string | null;
  document_reference?: string | null;
  document_title?: string | null;
};

type ConvocationDisplayFields = ConvocationWithDocument & {
  ag_titre?: string | null;
  ag_title?: string | null;
  ag_libelle?: string | null;
  ag_display?: string | null;
  coproprietaire_label?: string | null;
  coproprietaire_nom?: string | null;
  coproprietaire_display?: string | null;
  owner_nom?: string | null;
  owner_name?: string | null;
  lot_label?: string | null;
  lot_numero?: string | null;
  lot_reference?: string | null;
  lot_display?: string | null;
  canal_label?: string | null;
};

type GeneratePdfResponse = {
  detail?: string;
  convocation?: ConvocationWithDocument;
};

function formatDate(value?: string | null) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function getConvocationOwner(convocation: AgConvocation) {
  const item = convocation as ConvocationDisplayFields;

  return (
    item.coproprietaire_label ||
    item.coproprietaire_nom ||
    item.coproprietaire_display ||
    item.owner_nom ||
    item.owner_name ||
    "Copropriétaire non renseigné"
  );
}

function getConvocationLot(convocation: AgConvocation) {
  const item = convocation as ConvocationDisplayFields;

  return (
    item.lot_label ||
    item.lot_numero ||
    item.lot_reference ||
    item.lot_display ||
    (item.lot ? `Lot #${item.lot}` : "Lot non renseigné")
  );
}

function getConvocationAg(convocation: AgConvocation) {
  const item = convocation as ConvocationDisplayFields;

  return (
    item.ag_titre ||
    item.ag_title ||
    item.ag_libelle ||
    item.ag_display ||
    `AG #${item.ag}`
  );
}

function getConvocationCanal(convocation: AgConvocation) {
  const item = convocation as ConvocationDisplayFields;

  return item.canal_label || item.canal || "—";
}

function getDocumentUrl(convocation: AgConvocation) {
  const withDocument = convocation as ConvocationWithDocument;
  return withDocument.document_url || "";
}

function getDocumentReference(convocation: AgConvocation) {
  const withDocument = convocation as ConvocationWithDocument;
  return withDocument.document_reference || "";
}

function openDocument(url: string) {
  if (!url) {
    return;
  }

  window.open(url, "_blank", "noopener,noreferrer");
}

function getErrorMessage(error: unknown) {
  const possibleAxiosError = error as {
    response?: {
      status?: number;
      data?:
        | string
        | {
            detail?: string;
            message?: string;
            error?: string;
            non_field_errors?: string[];
          };
    };
    message?: string;
  };

  const data = possibleAxiosError.response?.data;
  const status = possibleAxiosError.response?.status;

  if (typeof data === "string") {
    const cleaned = data.trim();

    if (
      cleaned.startsWith("<!DOCTYPE") ||
      cleaned.startsWith("<html") ||
      cleaned.includes("<body") ||
      cleaned.includes("Page not found")
    ) {
      return status === 404
        ? "Action indisponible : l’endpoint demandé est introuvable côté serveur."
        : "Le serveur a retourné une erreur HTML non exploitable. Vérifiez l’endpoint appelé.";
    }

    return cleaned;
  }

  if (data?.detail) {
    return data.detail;
  }

  if (data?.message) {
    return data.message;
  }

  if (data?.error) {
    return data.error;
  }

  if (data?.non_field_errors?.length) {
    return data.non_field_errors.join(" ");
  }

  return possibleAxiosError.message || "Une erreur est survenue.";
}

function StatusBadge({ statut }: { statut: AgConvocationStatut }) {
  return (
    <span style={{ ...styles.statusBadge, ...STATUT_STYLES[statut] }}>
      {STATUT_LABELS[statut] ?? statut}
    </span>
  );
}

export default function AGConvocations() {
  const [searchParams] = useSearchParams();
  const initialAgFilter = searchParams.get("ag") || "";

  const [convocations, setConvocations] = useState<AgConvocation[]>([]);
  const [agFilter, setAgFilter] = useState(initialAgFilter);
  const [statutFilter, setStatutFilter] = useState<AgConvocationStatut | "">("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);
  const [pdfLoadingId, setPdfLoadingId] = useState<number | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadConvocations = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const data = await listAgConvocations({
        ag: agFilter.trim(),
        statut: statutFilter,
      });

      setConvocations(data);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [agFilter, statutFilter]);

  useEffect(() => {
    void loadConvocations();
  }, [loadConvocations]);

  const filteredConvocations = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    if (!normalizedSearch) {
      return convocations;
    }

    return convocations.filter((convocation) => {
      const values = [
        convocation.reference,
        getConvocationOwner(convocation),
        getConvocationLot(convocation),
        getConvocationAg(convocation),
        getConvocationCanal(convocation),
        getDocumentReference(convocation),
        convocation.statut,
        convocation.canal,
      ];

      return values.some((value) =>
        String(value).toLowerCase().includes(normalizedSearch),
      );
    });
  }, [convocations, search]);

  const stats = useMemo(() => {
    return filteredConvocations.reduce(
      (acc, convocation) => {
        acc.total += 1;
        acc[convocation.statut] += 1;
        return acc;
      },
      {
        total: 0,
        GENEREE: 0,
        ENVOYEE: 0,
        CONSULTEE: 0,
        ANNULEE: 0,
      } as Record<AgConvocationStatut | "total", number>,
    );
  }, [filteredConvocations]);

  async function handleGenerate() {
    const agId = agFilter.trim();

    if (!agId) {
      setError("Saisissez d’abord l’identifiant de l’AG à convoquer.");
      setSuccess("");
      return;
    }

    setGenerating(true);
    setError("");
    setSuccess("");

    try {
      const result = await genererConvocationsAg(agId);

      const created = result.created ?? 0;
      const skipped = result.skipped_existing ?? 0;

      setSuccess(
        `Génération terminée : ${created} convocation(s) créée(s), ${skipped} déjà existante(s).`,
      );

      await loadConvocations();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setGenerating(false);
    }
  }

  async function handleGeneratePdf(convocation: AgConvocation) {
    if (convocation.statut === "ANNULEE") {
      setError("Impossible de générer le PDF d’une convocation annulée.");
      setSuccess("");
      return;
    }

    setPdfLoadingId(convocation.id);
    setError("");
    setSuccess("");

    try {
      const response = await api.post<GeneratePdfResponse>(
        `/api/ag/convocations/${convocation.id}/generer-pdf/`,
      );

      const updatedConvocation = response.data.convocation;

      if (updatedConvocation) {
        setConvocations((current) =>
          current.map((item) =>
            item.id === updatedConvocation.id ? updatedConvocation : item,
          ),
        );
      }

      setSuccess(
        response.data.detail || "PDF de convocation généré avec succès.",
      );

      await loadConvocations();

      const pdfUrl =
        (updatedConvocation && getDocumentUrl(updatedConvocation)) ||
        getDocumentUrl(convocation);

      if (pdfUrl) {
        openDocument(pdfUrl);
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setPdfLoadingId(null);
    }
  }

  async function runConvocationAction(
    convocationId: number,
    action: () => Promise<AgConvocation>,
    message: string,
  ) {
    setActionLoadingId(convocationId);
    setError("");
    setSuccess("");

    try {
      await action();
      setSuccess(message);
      await loadConvocations();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setActionLoadingId(null);
    }
  }

  function handleCancel(convocation: AgConvocation) {
    if (
      !window.confirm(
        `Voulez-vous vraiment annuler la convocation ${convocation.reference} ?`,
      )
    ) {
      return;
    }

    void runConvocationAction(
      convocation.id,
      () => annulerAgConvocation(convocation.id),
      "Convocation annulée avec succès.",
    );
  }


  function handleCreateRectificative(convocation: AgConvocation) {
    const confirmed = window.confirm(
      `Créer une convocation rectificative pour ${convocation.reference} ?`,
    );

    if (!confirmed) {
      return;
    }

    setActionLoadingId(convocation.id);
    setError("");
    setSuccess("");

    void (async () => {
      try {
        const result = await creerRectificativeAgConvocation(
          convocation.id,
          "Ordre du jour actualisé après envoi ou consultation.",
        );

        setSuccess(
          result.detail || "Convocation rectificative créée avec succès.",
        );

        if (result.convocation) {
          setConvocations((current) => {
            const exists = current.some((item) => item.id === result.convocation.id);

            if (exists) {
              return current.map((item) =>
                item.id === result.convocation.id ? result.convocation : item,
              );
            }

            return [result.convocation, ...current];
          });
        }

        await loadConvocations();
      } catch (err) {
        setError(getErrorMessage(err));
      } finally {
        setActionLoadingId(null);
      }
    })();
  }

  return (
    <main style={styles.page}>
      <section style={styles.header}>
        <div>
          <div className="pageBackRow">
            <BackButton to="/ag" label="Retour au module AG" />
          </div>

          <p style={styles.eyebrow}>Assemblées générales</p>
          <h1 style={styles.title}>Convocations AG</h1>
          <p style={styles.subtitle}>
            Générez, suivez et tracez les convocations envoyées aux
            copropriétaires avant une assemblée générale.
          </p>
        </div>

        <button
          type="button"
          style={{
            ...styles.primaryButton,
            ...(generating ? styles.buttonDisabled : {}),
          }}
          onClick={handleGenerate}
          disabled={generating}
        >
          {generating ? "Génération..." : "Générer les convocations"}
        </button>
      </section>

      <section style={styles.filtersCard}>
        <div style={styles.filterGroup}>
          <label style={styles.label} htmlFor="agFilter">
            ID de l’AG
          </label>
          <input
            id="agFilter"
            style={styles.input}
            type="number"
            min="1"
            placeholder="Ex : 39"
            value={agFilter}
            onChange={(event) => setAgFilter(event.target.value)}
          />
        </div>

        <div style={styles.filterGroup}>
          <label style={styles.label} htmlFor="statutFilter">
            Statut
          </label>
          <select
            id="statutFilter"
            style={styles.input}
            value={statutFilter}
            onChange={(event) =>
              setStatutFilter(event.target.value as AgConvocationStatut | "")
            }
          >
            <option value="">Tous les statuts</option>
            <option value="GENEREE">Générée</option>
            <option value="ENVOYEE">Envoyée</option>
            <option value="CONSULTEE">Consultée</option>
            <option value="ANNULEE">Annulée</option>
          </select>
        </div>

        <div style={{ ...styles.filterGroup, ...styles.searchGroup }}>
          <label style={styles.label} htmlFor="search">
            Recherche
          </label>
          <input
            id="search"
            style={styles.input}
            type="search"
            placeholder="Référence, lot, copropriétaire..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        <button
          type="button"
          style={styles.secondaryButton}
          onClick={() => void loadConvocations()}
          disabled={loading}
        >
          {loading ? "Chargement..." : "Actualiser"}
        </button>
      </section>

      {error ? <div style={styles.errorBox}>{error}</div> : null}
      {success ? <div style={styles.successBox}>{success}</div> : null}

      <section style={styles.statsGrid}>
        <article style={styles.statCard}>
          <span style={styles.statLabel}>Total</span>
          <strong style={styles.statValue}>{stats.total}</strong>
        </article>

        <article style={styles.statCard}>
          <span style={styles.statLabel}>Générées</span>
          <strong style={styles.statValue}>{stats.GENEREE}</strong>
        </article>

        <article style={styles.statCard}>
          <span style={styles.statLabel}>Envoyées</span>
          <strong style={styles.statValue}>{stats.ENVOYEE}</strong>
        </article>

        <article style={styles.statCard}>
          <span style={styles.statLabel}>Consultées</span>
          <strong style={styles.statValue}>{stats.CONSULTEE}</strong>
        </article>

        <article style={styles.statCard}>
          <span style={styles.statLabel}>Annulées</span>
          <strong style={styles.statValue}>{stats.ANNULEE}</strong>
        </article>
      </section>

      <section style={styles.tableCard}>
        <div style={styles.tableHeader}>
          <div>
            <h2 style={styles.sectionTitle}>Liste des convocations</h2>
            <p style={styles.sectionSubtitle}>
              Chaque ligne conserve la référence, le copropriétaire, le lot,
              les documents PDF et les dates clés de traçabilité.
            </p>
          </div>
        </div>

        {loading ? (
          <div style={styles.emptyState}>Chargement des convocations...</div>
        ) : filteredConvocations.length === 0 ? (
          <div style={styles.emptyState}>
            Aucune convocation trouvée pour les critères sélectionnés.
          </div>
        ) : (
          <div style={styles.tableWrapper}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Référence</th>
                  <th style={styles.th}>AG</th>
                  <th style={styles.th}>Copropriétaire</th>
                  <th style={styles.th}>Lot</th>
                  <th style={styles.th}>Canal</th>
                  <th style={styles.th}>Statut</th>
                  <th style={styles.th}>Générée</th>
                  <th style={styles.th}>Envoyée</th>
                  <th style={styles.th}>Consultée</th>
                  <th style={styles.th}>PDF</th>
                  <th style={styles.th}>Actions</th>
                </tr>
              </thead>

              <tbody>
                {filteredConvocations.map((convocation) => {
                  const isActionLoading = actionLoadingId === convocation.id;
                  const isPdfLoading = pdfLoadingId === convocation.id;
                  const pdfUrl = getDocumentUrl(convocation);

                  const canSend = convocation.statut === "GENEREE";
                  const canMarkConsulted =
                    convocation.statut === "GENEREE" ||
                    convocation.statut === "ENVOYEE";
                  const canCancel = convocation.statut !== "ANNULEE";
                  const canGeneratePdf =
                    convocation.statut !== "ANNULEE" && !isPdfLoading;
                  const canCreateRectificative =
                    Boolean(convocation.is_active_version) &&
                    (convocation.statut === "ENVOYEE" ||
                      convocation.statut === "CONSULTEE");

                  return (
                    <tr key={convocation.id}>
                      <td style={styles.td}>
                        <strong style={styles.reference}>
                          {convocation.reference}
                        </strong>
                        <div style={styles.metaLine}>
                          {convocation.is_rectificative ? "Rectificative" : "Originale"}
                          {" · Version "}
                          {convocation.version || 1}
                        </div>
                        {convocation.is_active_version ? (
                          <div style={styles.metaLine}>
                            Version officielle actuelle
                          </div>
                        ) : null}
                        {convocation.is_replaced_version ? (
                          <div style={styles.metaLine}>
                            Remplacée par{" "}
                            {convocation.replaced_by_reference ||
                              `convocation #${convocation.replaced_by || ""}`}
                          </div>
                        ) : null}
                        {convocation.parent_reference ? (
                          <div style={styles.metaLine}>
                            Parent : {convocation.parent_reference}
                          </div>
                        ) : null}

                        {convocation.notification_traced ? (
                          <div style={styles.metaLine}>
                            Preuve notification :{" "}
                            {convocation.last_notification_proof?.reference ||
                              "enregistrée"}
                            {convocation.last_notification_proof?.created_at
                              ? ` · ${formatDate(convocation.last_notification_proof.created_at)}`
                              : ""}
                          </div>
                        ) : null}

                        {convocation.consultation_acknowledged ? (
                          <div style={styles.metaLine}>
                            Accusé consultation :{" "}
                            {convocation.last_consultation_proof?.reference ||
                              "enregistré"}
                            {convocation.last_consultation_proof?.created_at
                              ? ` · ${formatDate(convocation.last_consultation_proof.created_at)}`
                              : ""}
                          </div>
                        ) : null}
                      </td>

                      <td style={styles.td}>{getConvocationAg(convocation)}</td>

                      <td style={styles.td}>
                        {getConvocationOwner(convocation)}
                      </td>

                      <td style={styles.td}>{getConvocationLot(convocation)}</td>

                      <td style={styles.td}>
                        {getConvocationCanal(convocation)}
                      </td>

                      <td style={styles.td}>
                        <StatusBadge statut={convocation.statut} />
                      </td>

                      <td style={styles.td}>
                        {formatDate(
                          convocation.generated_at || convocation.created_at,
                        )}
                      </td>

                      <td style={styles.td}>{formatDate(convocation.sent_at)}</td>

                      <td style={styles.td}>
                        {formatDate(convocation.consulted_at)}
                      </td>

                      <td style={styles.td}>
                        {pdfUrl ? (
                          <button
                            type="button"
                            style={styles.pdfButton}
                            onClick={() => openDocument(pdfUrl)}
                          >
                            Ouvrir PDF
                          </button>
                        ) : (
                          <button
                            type="button"
                            style={{
                              ...styles.pdfButton,
                              ...(!canGeneratePdf ? styles.buttonDisabled : {}),
                            }}
                            disabled={!canGeneratePdf}
                            onClick={() => void handleGeneratePdf(convocation)}
                          >
                            {isPdfLoading ? "PDF..." : "Générer PDF"}
                          </button>
                        )}
                      </td>

                      <td style={styles.td}>
                        <div style={styles.actions}>
                          {convocation.is_rectificative && convocation.statut === "GENEREE" ? (
                            <button
                              type="button"
                              style={{
                                ...styles.actionButton,
                                ...(isActionLoading ? styles.buttonDisabled : {}),
                              }}
                              disabled={isActionLoading}
                              onClick={() =>
                                void runConvocationAction(
                                  convocation.id,
                                  () =>
                                    notifierAgConvocation(convocation.id, {
                                      canal: convocation.canal || "PLATEFORME",
                                    }),
                                  "Convocation rectificative notifiée au copropriétaire.",
                                )
                              }
                            >
                              Notifier rectificative
                            </button>
                          ) : null}

                          <button
                            type="button"
                            style={{
                              ...styles.actionButton,
                              ...(!canSend || isActionLoading
                                ? styles.buttonDisabled
                                : {}),
                            }}
                            disabled={!canSend || isActionLoading}
                            onClick={() =>
                              void runConvocationAction(
                                convocation.id,
                                () => marquerConvocationEnvoyee(convocation.id),
                                "Convocation marquée comme envoyée.",
                              )
                            }
                          >
                            Envoyée
                          </button>

                          <button
                            type="button"
                            style={{
                              ...styles.actionButton,
                              ...(!canMarkConsulted || isActionLoading
                                ? styles.buttonDisabled
                                : {}),
                            }}
                            disabled={!canMarkConsulted || isActionLoading}
                            onClick={() =>
                              void runConvocationAction(
                                convocation.id,
                                () =>
                                  marquerConvocationConsultee(convocation.id),
                                "Convocation marquée comme consultée.",
                              )
                            }
                          >
                            Consultée
                          </button>

                          {convocation.statut !== "ANNULEE" ? (
                            <button
                              type="button"
                              style={{
                                ...styles.actionButton,
                                ...(!canCreateRectificative || isActionLoading
                                  ? styles.buttonDisabled
                                  : {}),
                              }}
                              disabled={!canCreateRectificative || isActionLoading}
                              onClick={() => handleCreateRectificative(convocation)}
                            >
                              {convocation.is_rectificative
                                ? "Créer nouvelle rectificative"
                                : "Créer rectificative"}
                            </button>
                          ) : null}

                          <button
                            type="button"
                            style={{
                              ...styles.dangerButton,
                              ...(!canCancel || isActionLoading
                                ? styles.buttonDisabled
                                : {}),
                            }}
                            disabled={!canCancel || isActionLoading}
                            onClick={() => handleCancel(convocation)}
                          >
                            Annuler
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    display: "flex",
    flexDirection: "column",
    gap: 24,
  },
  header: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 24,
    padding: 28,
    borderRadius: 28,
    background: "var(--module-hero-gradient)",
    color: "white",
    boxShadow: "0 24px 60px rgba(30, 64, 175, 0.25)",
  },
  eyebrow: {
    margin: 0,
    fontSize: 13,
    fontWeight: 800,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    opacity: 0.85,
  },
  title: {
    margin: "8px 0 10px",
    fontSize: 32,
    lineHeight: 1.1,
    fontWeight: 900,
  },
  subtitle: {
    margin: 0,
    maxWidth: 760,
    fontSize: 15,
    lineHeight: 1.7,
    opacity: 0.92,
  },
  primaryButton: {
    border: "none",
    borderRadius: 16,
    padding: "13px 18px",
    background: "white",
    color: "#1d4ed8",
    fontWeight: 900,
    cursor: "pointer",
    boxShadow: "0 14px 30px rgba(15, 23, 42, 0.18)",
    whiteSpace: "nowrap",
  },
  secondaryButton: {
    border: "1px solid #cbd5e1",
    borderRadius: 14,
    padding: "12px 16px",
    background: "white",
    color: "#0f172a",
    fontWeight: 800,
    cursor: "pointer",
    alignSelf: "end",
  },
  filtersCard: {
    display: "flex",
    alignItems: "end",
    gap: 16,
    padding: 20,
    borderRadius: 24,
    background: "white",
    border: "1px solid #e2e8f0",
    boxShadow: "0 16px 40px rgba(15, 23, 42, 0.06)",
    flexWrap: "wrap",
  },
  filterGroup: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    minWidth: 170,
  },
  searchGroup: {
    flex: 1,
    minWidth: 260,
  },
  label: {
    color: "#475569",
    fontSize: 13,
    fontWeight: 800,
  },
  input: {
    width: "100%",
    border: "1px solid #cbd5e1",
    borderRadius: 14,
    padding: "12px 14px",
    fontSize: 14,
    color: "#0f172a",
    outline: "none",
    background: "#ffffff",
  },
  errorBox: {
    padding: "14px 16px",
    borderRadius: 16,
    background: "#fef2f2",
    border: "1px solid #fecaca",
    color: "#b91c1c",
    fontWeight: 700,
  },
  successBox: {
    padding: "14px 16px",
    borderRadius: 16,
    background: "#ecfdf5",
    border: "1px solid #a7f3d0",
    color: "#047857",
    fontWeight: 700,
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
    gap: 16,
  },
  statCard: {
    padding: 20,
    borderRadius: 22,
    background: "white",
    border: "1px solid #e2e8f0",
    boxShadow: "0 14px 34px rgba(15, 23, 42, 0.05)",
  },
  statLabel: {
    display: "block",
    color: "#64748b",
    fontSize: 13,
    fontWeight: 800,
    marginBottom: 8,
  },
  statValue: {
    display: "block",
    color: "#0f172a",
    fontSize: 30,
    fontWeight: 900,
  },
  tableCard: {
    borderRadius: 26,
    background: "white",
    border: "1px solid #e2e8f0",
    boxShadow: "0 18px 45px rgba(15, 23, 42, 0.07)",
    overflow: "hidden",
  },
  tableHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 16,
    padding: 22,
    borderBottom: "1px solid #e2e8f0",
  },
  sectionTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: 20,
    fontWeight: 900,
  },
  sectionSubtitle: {
    margin: "6px 0 0",
    color: "#64748b",
    fontSize: 14,
    lineHeight: 1.6,
  },
  tableWrapper: {
    width: "100%",
    overflowX: "auto",
  },
  table: {
    width: "100%",
    minWidth: 1280,
    borderCollapse: "collapse",
  },
  th: {
    padding: "14px 16px",
    textAlign: "left",
    color: "#475569",
    background: "#f8fafc",
    borderBottom: "1px solid #e2e8f0",
    fontSize: 12,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  },
  td: {
    padding: "15px 16px",
    color: "#334155",
    borderBottom: "1px solid #edf2f7",
    fontSize: 14,
    verticalAlign: "middle",
  },
  reference: {
    color: "#0f172a",
    fontWeight: 900,
  },
  statusBadge: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid",
    fontSize: 12,
    fontWeight: 900,
    whiteSpace: "nowrap",
  },
  actions: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },
  actionButton: {
    border: "1px solid #bfdbfe",
    borderRadius: 999,
    padding: "8px 11px",
    background: "#eff6ff",
    color: "#1d4ed8",
    fontSize: 12,
    fontWeight: 900,
    cursor: "pointer",
  },
  pdfButton: {
    border: "1px solid #c7d2fe",
    borderRadius: 999,
    padding: "8px 11px",
    background: "#eef2ff",
    color: "#3730a3",
    fontSize: 12,
    fontWeight: 900,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  dangerButton: {
    border: "1px solid #fecaca",
    borderRadius: 999,
    padding: "8px 11px",
    background: "#fef2f2",
    color: "#b91c1c",
    fontSize: 12,
    fontWeight: 900,
    cursor: "pointer",
  },
  buttonDisabled: {
    opacity: 0.55,
    cursor: "not-allowed",
  },
  emptyState: {
    padding: 32,
    color: "#64748b",
    fontWeight: 700,
    textAlign: "center",
  },
};