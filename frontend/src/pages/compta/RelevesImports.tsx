import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { Link } from "react-router-dom";
import api from "../../api/axios";
import { ENDPOINTS } from "../../api/endpoints";
import BackButton from "../../components/ui/BackButton";

type LoadState = "idle" | "loading" | "success" | "error";
type ToneKind = "neutral" | "success" | "warning" | "info";

type DRFPage<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

type ReleveImportItem = {
  id: number;
  copropriete?: number;
  fichier?: string | null;
  fichier_nom?: string | null;
  hash_unique?: string | null;
  encoding?: string | null;
  delimiter?: string | null;
  nb_lignes?: number | null;
  nb_crees?: number | null;
  nb_ignores?: number | null;
  nb_ignores_doublons?: number | null;
  nb_ignores_invalides?: number | null;
  created_at?: string | null;
  created_by?: number | string | null;
};

function getTone(kind: ToneKind) {
  if (kind === "success") {
    return {
      softBg: "#ecfdf5",
      border: "#86efac",
      text: "#166534",
      strongText: "#14532d",
    };
  }

  if (kind === "warning") {
    return {
      softBg: "#fffbeb",
      border: "#fcd34d",
      text: "#92400e",
      strongText: "#78350f",
    };
  }

  if (kind === "info") {
    return {
      softBg: "#eff6ff",
      border: "#93c5fd",
      text: "#1d4ed8",
      strongText: "#1e3a8a",
    };
  }

  return {
    softBg: "#f8fafc",
    border: "#e2e8f0",
    text: "#475569",
    strongText: "#0f172a",
  };
}

function isDRFPage<T>(value: unknown): value is DRFPage<T> {
  return Boolean(
    value &&
      typeof value === "object" &&
      Array.isArray((value as DRFPage<T>).results),
  );
}

function fmtDateTime(value?: string | null) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleString("fr-FR");
}

function fmtInt(value?: number | null) {
  const parsed = Number(value ?? 0);

  return new Intl.NumberFormat("fr-FR").format(Number.isFinite(parsed) ? parsed : 0);
}

function truncateText(value?: string | null, max = 42) {
  if (!value) return "—";

  const normalized = String(value).trim();

  if (normalized.length <= max) return normalized;

  return `${normalized.slice(0, max - 1)}…`;
}

function displayDelimiter(value?: string | null) {
  if (!value) return "—";
  if (value === ";") return "Point-virgule (;)";
  if (value === ",") return "Virgule (,)";
  if (value === "\t") return "Tabulation";

  return value;
}

function getIgnoredCount(item: ReleveImportItem) {
  if (typeof item.nb_ignores === "number") return item.nb_ignores;

  const doublons =
    typeof item.nb_ignores_doublons === "number" ? item.nb_ignores_doublons : 0;

  const invalides =
    typeof item.nb_ignores_invalides === "number" ? item.nb_ignores_invalides : 0;

  return doublons + invalides;
}

function getErrorMessage(error: unknown, fallback: string) {
  const err = error as {
    response?: { data?: Record<string, unknown> };
    message?: string;
  };

  const detail = err?.response?.data?.detail;

  if (typeof detail === "string" && detail.trim()) return detail;

  if (err?.response?.data && typeof err.response.data === "object") {
    try {
      return JSON.stringify(err.response.data, null, 2);
    } catch {
      return fallback;
    }
  }

  if (typeof err?.message === "string" && err.message.trim()) return err.message;

  return fallback;
}

function PageShell({ children }: { children: ReactNode }) {
  return <div style={pageShell}>{children}</div>;
}

function PageHeader(props: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  backTo?: string;
  backLabel?: string;
}) {
  return (
    <section style={heroCard}>
      <div style={heroGlow} />

      <div style={pageHeader}>
        <div style={pageHeaderTextBlock}>
          {props.backTo || props.backLabel ? (
            <div className="pageBackRow">
              <BackButton to={props.backTo} label={props.backLabel ?? "Retour"} />
            </div>
          ) : null}

          <div style={pageEyebrow}>Comptabilité · Relevés bancaires</div>
          <div style={pageTitle}>{props.title}</div>
          {props.subtitle ? <div style={pageSubtitle}>{props.subtitle}</div> : null}
        </div>

        {props.actions ? <div style={pageHeaderActions}>{props.actions}</div> : null}
      </div>
    </section>
  );
}

function AlertBox(props: { kind: "error" | "info"; children: ReactNode }) {
  const tone =
    props.kind === "error"
      ? { bg: "#fef2f2", border: "#fecaca", text: "#991b1b" }
      : { bg: "#eff6ff", border: "#bfdbfe", text: "#1d4ed8" };

  return (
    <div
      style={{
        padding: 14,
        borderRadius: 16,
        background: tone.bg,
        border: `1px solid ${tone.border}`,
        color: tone.text,
        whiteSpace: "pre-wrap",
        lineHeight: 1.55,
        boxShadow: "0 10px 24px rgba(15, 23, 42, 0.04)",
      }}
    >
      {props.children}
    </div>
  );
}

function SmallButton(props: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  primary?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      disabled={props.disabled}
      title={props.title}
      style={{
        border: props.primary ? "1px solid #93c5fd" : "1px solid #cbd5e1",
        background: props.disabled ? "#f8fafc" : props.primary ? "#dbeafe" : "#ffffff",
        color: props.disabled ? "#94a3b8" : props.primary ? "#1e3a8a" : "#0f172a",
        borderRadius: 12,
        padding: "10px 14px",
        fontSize: 13,
        fontWeight: 800,
        cursor: props.disabled ? "not-allowed" : "pointer",
        whiteSpace: "nowrap",
        transition: "all 0.2s ease",
        boxShadow: props.primary ? "0 10px 24px rgba(37, 99, 235, 0.10)" : "none",
      }}
    >
      {props.children}
    </button>
  );
}

function LinkButton(props: {
  to: string;
  children: ReactNode;
  primary?: boolean;
  title?: string;
}) {
  return (
    <Link
      to={props.to}
      title={props.title}
      style={{
        border: props.primary ? "1px solid #93c5fd" : "1px solid #cbd5e1",
        background: props.primary ? "#dbeafe" : "#ffffff",
        color: props.primary ? "#1e3a8a" : "#0f172a",
        borderRadius: 12,
        padding: "10px 14px",
        fontSize: 13,
        fontWeight: 800,
        textDecoration: "none",
        display: "inline-flex",
        alignItems: "center",
        whiteSpace: "nowrap",
        boxShadow: props.primary ? "0 10px 24px rgba(37, 99, 235, 0.10)" : "none",
      }}
    >
      {props.children}
    </Link>
  );
}

function Card(props: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  right?: ReactNode;
}) {
  return (
    <div style={card}>
      <div style={cardHeader}>
        <div style={{ display: "grid", gap: 4, minWidth: 0 }}>
          <div style={cardTitle}>{props.title}</div>
          {props.subtitle ? <div style={cardSubtitle}>{props.subtitle}</div> : null}
        </div>

        {props.right ? props.right : null}
      </div>

      {props.children}
    </div>
  );
}

function StatCard(props: { title: string; value: string; sub?: string; tone?: ToneKind }) {
  const tone = getTone(props.tone ?? "neutral");

  return (
    <div
      style={{
        ...statCard,
        background: tone.softBg,
        border: `1px solid ${tone.border}`,
      }}
    >
      <div style={{ ...statTitle, color: tone.text }}>{props.title}</div>
      <div style={{ ...statValue, color: tone.strongText }}>{props.value}</div>
      {props.sub ? <div style={{ ...statSub, color: tone.text }}>{props.sub}</div> : null}
    </div>
  );
}

function EmptyState(props: {
  title: string;
  text: string;
  actionLabel?: string;
  actionTo?: string;
}) {
  return (
    <div style={emptyState}>
      <div style={emptyStateTitle}>{props.title}</div>
      <div style={emptyStateText}>{props.text}</div>

      {props.actionLabel && props.actionTo ? (
        <div style={{ marginTop: 12 }}>
          <LinkButton to={props.actionTo} primary>
            {props.actionLabel}
          </LinkButton>
        </div>
      ) : null}
    </div>
  );
}

function Pill(props: {
  children: ReactNode;
  tone?: ToneKind;
}) {
  const tone = getTone(props.tone ?? "neutral");

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "6px 10px",
        borderRadius: 999,
        border: `1px solid ${tone.border}`,
        background: tone.softBg,
        color: tone.text,
        fontSize: 12,
        fontWeight: 800,
        whiteSpace: "nowrap",
      }}
    >
      {props.children}
    </span>
  );
}

export default function RelevesImports() {
  const [state, setState] = useState<LoadState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<ReleveImportItem[]>([]);
  const [query, setQuery] = useState("");

  const fetchImports = useCallback(async () => {
    setState("loading");
    setError(null);

    try {
      const { data } = await api.get(ENDPOINTS.releveImports);

      if (isDRFPage<ReleveImportItem>(data)) {
        setRows(data.results);
      } else if (Array.isArray(data)) {
        setRows(data as ReleveImportItem[]);
      } else {
        setRows([]);
      }

      setState("success");
    } catch (e) {
      setState("error");
      setError(getErrorMessage(e, "Impossible de charger les imports bancaires."));
      setRows([]);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchImports();
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [fetchImports]);

  const filteredRows = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) return rows;

    return rows.filter((row) => {
      const haystack = `${row.id} ${row.fichier_nom ?? ""} ${row.fichier ?? ""} ${
        row.encoding ?? ""
      } ${row.delimiter ?? ""} ${row.hash_unique ?? ""}`.toLowerCase();

      return haystack.includes(normalizedQuery);
    });
  }, [rows, query]);

  const stats = useMemo(() => {
    return {
      totalImports: filteredRows.length,
      totalLignes: filteredRows.reduce((acc, row) => acc + Number(row.nb_lignes ?? 0), 0),
      totalCrees: filteredRows.reduce((acc, row) => acc + Number(row.nb_crees ?? 0), 0),
      totalIgnores: filteredRows.reduce((acc, row) => acc + getIgnoredCount(row), 0),
    };
  }, [filteredRows]);

  const isLoading = state === "loading";
  const isEmpty = state === "success" && filteredRows.length === 0;
  const hasRows = rows.length > 0;
  const hasFilters = query.trim().length > 0;

  const handleRefresh = useCallback(() => {
    void fetchImports();
  }, [fetchImports]);

  return (
    <PageShell>
      <PageHeader
        title="Historique des imports bancaires"
        subtitle="Consultez les relevés déjà importés, contrôlez les volumes traités et accédez rapidement aux lignes à analyser pour la copropriété active."
        backTo="/compta"
        backLabel="Retour à la comptabilité"
        actions={
          <div style={topActionsRow}>
            <LinkButton
              to="/compta/import"
              primary
              title="Importer un nouveau relevé bancaire"
            >
              Importer un relevé
            </LinkButton>

            <SmallButton
              onClick={handleRefresh}
              disabled={isLoading}
              title="Actualiser l’historique"
            >
              {isLoading ? "Actualisation..." : "Actualiser"}
            </SmallButton>
          </div>
        }
      />

      <div className="imports-stats-grid" style={statsGrid}>
        <StatCard
          title="Imports visibles"
          value={fmtInt(stats.totalImports)}
          sub="Nombre d’imports affichés après recherche."
          tone="neutral"
        />
        <StatCard
          title="Lignes détectées"
          value={fmtInt(stats.totalLignes)}
          sub="Volume total de lignes présentes dans les imports affichés."
          tone="info"
        />
        <StatCard
          title="Lignes créées"
          value={fmtInt(stats.totalCrees)}
          sub="Lignes intégrées avec succès dans le système."
          tone="success"
        />
        <StatCard
          title="Ignorées à l’import"
          value={fmtInt(stats.totalIgnores)}
          sub="Doublons ou lignes invalides écartés lors du traitement."
          tone="warning"
        />
      </div>

      {state === "error" && error ? (
        <AlertBox kind="error">
          <div style={{ fontWeight: 900, marginBottom: 4 }}>
            Impossible de charger l’historique des imports
          </div>
          <div style={{ fontSize: 13 }}>{error}</div>
        </AlertBox>
      ) : null}

      <Card
        title="Liste des imports"
        subtitle="Utilisez la recherche pour retrouver rapidement un fichier importé, son encodage, son délimiteur ou son hash."
        right={
          <div style={filtersRow}>
            <input
              placeholder="Rechercher : fichier, encodage, hash..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              style={searchInput}
            />
          </div>
        }
      >
        {isLoading ? (
          <div style={simpleMutedText}>Chargement de l’historique des imports bancaires…</div>
        ) : isEmpty ? (
          !hasRows ? (
            <EmptyState
              title="Aucun import bancaire enregistré"
              text="Aucun relevé bancaire n’a encore été importé pour cette copropriété."
              actionLabel="Importer un relevé"
              actionTo="/compta/import"
            />
          ) : hasFilters ? (
            <EmptyState
              title="Aucun résultat"
              text="Aucun import ne correspond à la recherche en cours."
              actionLabel="Importer un relevé"
              actionTo="/compta/import"
            />
          ) : (
            <EmptyState
              title="Aucun import bancaire à afficher"
              text="Aucune donnée d’import bancaire n’est disponible pour le moment."
              actionLabel="Importer un relevé"
              actionTo="/compta/import"
            />
          )
        ) : (
          <div style={tableWrap}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1180 }}>
              <thead>
                <tr style={{ textAlign: "left" }}>
                  <th style={th}>ID</th>
                  <th style={th}>Fichier</th>
                  <th style={th}>Importé le</th>
                  <th style={th}>Format</th>
                  <th style={th}>Volumes</th>
                  <th style={th}>Accès rapides</th>
                </tr>
              </thead>

              <tbody>
                {filteredRows.map((row) => {
                  const ignoredCount = getIgnoredCount(row);

                  return (
                    <tr key={row.id} style={{ background: "#ffffff" }}>
                      <td style={tdMono}>#{row.id}</td>

                      <td style={{ ...td, minWidth: 260, maxWidth: 320 }}>
                        <div style={fileNameCell} title={row.fichier_nom ?? row.fichier ?? "—"}>
                          {truncateText(row.fichier_nom ?? row.fichier ?? "—", 42)}
                        </div>

                        {row.hash_unique ? (
                          <div style={hashText} title={row.hash_unique}>
                            Hash : {truncateText(row.hash_unique, 24)}
                          </div>
                        ) : null}
                      </td>

                      <td style={td}>{fmtDateTime(row.created_at)}</td>

                      <td style={td}>
                        <div style={{ display: "grid", gap: 6 }}>
                          <Pill tone="neutral">Encodage : {row.encoding ?? "—"}</Pill>
                          <Pill tone="info">Délimiteur : {displayDelimiter(row.delimiter)}</Pill>
                        </div>
                      </td>

                      <td style={td}>
                        <div style={{ display: "grid", gap: 8, minWidth: 220 }}>
                          <div style={volumeRow}>
                            <span style={volumeLabel}>Lignes détectées</span>
                            <span style={{ ...volumeValue, color: "#1d4ed8" }}>
                              {fmtInt(row.nb_lignes)}
                            </span>
                          </div>

                          <div style={volumeRow}>
                            <span style={volumeLabel}>Lignes créées</span>
                            <span style={{ ...volumeValue, color: "#166534" }}>
                              {fmtInt(row.nb_crees)}
                            </span>
                          </div>

                          <div style={volumeRow}>
                            <span style={volumeLabel}>Ignorées à l’import</span>
                            <span style={{ ...volumeValue, color: "#92400e" }}>
                              {fmtInt(ignoredCount)}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td style={td}>
                        <div style={quickActionsWrap}>
                          <Link to={`/compta/imports/${row.id}/lignes`} style={miniLinkPrimary}>
                            Ouvrir les lignes
                          </Link>

                          <Link
                            to={`/compta/imports/${row.id}/lignes?rapproche=0`}
                            style={miniLinkWarning}
                          >
                            Voir les non rapprochées
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card
        title="Lecture rapide"
        subtitle="Repères utiles pour interpréter les imports bancaires affichés."
      >
        <div className="imports-help-grid" style={helpGrid}>
          <div style={{ ...helpCard, background: "#ecfdf5", border: "1px solid #86efac" }}>
            <div style={{ ...helpTitle, color: "#14532d" }}>Lignes créées</div>
            <div style={{ ...helpText, color: "#166534" }}>
              Correspond aux lignes effectivement enregistrées après analyse du fichier importé.
            </div>
          </div>

          <div style={{ ...helpCard, background: "#fffbeb", border: "1px solid #fcd34d" }}>
            <div style={{ ...helpTitle, color: "#78350f" }}>Ignorées à l’import</div>
            <div style={{ ...helpText, color: "#92400e" }}>
              Regroupe les lignes rejetées comme doublons ou considérées invalides au moment de
              l’import.
            </div>
          </div>

          <div style={{ ...helpCard, background: "#eff6ff", border: "1px solid #93c5fd" }}>
            <div style={{ ...helpTitle, color: "#1e3a8a" }}>Ouvrir les lignes</div>
            <div style={{ ...helpText, color: "#1d4ed8" }}>
              Permet d’accéder au détail complet du relevé importé pour poursuivre le traitement.
            </div>
          </div>

          <div style={{ ...helpCard, background: "#fffbeb", border: "1px solid #fcd34d" }}>
            <div style={{ ...helpTitle, color: "#78350f" }}>Non rapprochées</div>
            <div style={{ ...helpText, color: "#92400e" }}>
              Filtre directement les lignes qui restent à rapprocher, corriger ou analyser.
            </div>
          </div>
        </div>
      </Card>

      <style>{`
        .imports-stats-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 14px;
        }

        .imports-help-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
        }

        @media (max-width: 1100px) {
          .imports-stats-grid,
          .imports-help-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }
        }

        @media (max-width: 680px) {
          .imports-stats-grid,
          .imports-help-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </PageShell>
  );
}

const pageShell: CSSProperties = {
  display: "grid",
  gap: 18,
  width: "100%",
  minWidth: 0,
};

const heroCard: CSSProperties = {
  background:
    "linear-gradient(135deg, rgba(15,23,42,0.98) 0%, rgba(30,41,59,0.96) 55%, rgba(37,99,235,0.88) 100%)",
  borderRadius: 28,
  padding: "28px 30px",
  color: "#ffffff",
  boxShadow: "0 30px 70px rgba(15,23,42,0.18)",
  position: "relative",
  overflow: "hidden",
  minWidth: 0,
};

const heroGlow: CSSProperties = {
  position: "absolute",
  inset: "auto -120px -140px auto",
  width: 280,
  height: 280,
  borderRadius: "50%",
  background:
    "radial-gradient(circle, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0) 72%)",
  pointerEvents: "none",
};

const pageHeader: CSSProperties = {
  display: "flex",
  alignItems: "flex-end",
  justifyContent: "space-between",
  gap: 14,
  flexWrap: "wrap",
  minWidth: 0,
};

const pageHeaderTextBlock: CSSProperties = {
  display: "grid",
  gap: 8,
  position: "relative",
  zIndex: 1,
  minWidth: 0,
};

const pageEyebrow: CSSProperties = {
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: 0.9,
  textTransform: "uppercase",
  color: "rgba(255,255,255,0.72)",
};

const pageTitle: CSSProperties = {
  fontSize: 30,
  fontWeight: 900,
  letterSpacing: -0.5,
  color: "#ffffff",
  lineHeight: 1.1,
};

const pageSubtitle: CSSProperties = {
  fontSize: 14,
  color: "rgba(255,255,255,0.82)",
  lineHeight: 1.65,
  maxWidth: 900,
};

const pageHeaderActions: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
  alignItems: "center",
  position: "relative",
  zIndex: 1,
};

const topActionsRow: CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  alignItems: "center",
};

const card: CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 22,
  padding: 18,
  background: "#ffffff",
  boxShadow: "0 10px 30px rgba(15, 23, 42, 0.04)",
  minWidth: 0,
};

const cardHeader: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
  marginBottom: 14,
  minWidth: 0,
};

const cardTitle: CSSProperties = {
  fontSize: 15,
  fontWeight: 900,
  color: "#111827",
};

const cardSubtitle: CSSProperties = {
  fontSize: 13,
  color: "#6b7280",
  lineHeight: 1.5,
};

const statCard: CSSProperties = {
  borderRadius: 20,
  padding: 16,
  boxShadow: "0 10px 30px rgba(15, 23, 42, 0.04)",
  minWidth: 0,
};

const statTitle: CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  marginBottom: 8,
};

const statValue: CSSProperties = {
  fontSize: 28,
  fontWeight: 900,
  letterSpacing: -0.4,
  lineHeight: 1.1,
};

const statSub: CSSProperties = {
  marginTop: 8,
  fontSize: 12,
  lineHeight: 1.45,
};

const statsGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
  gap: 14,
};

const filtersRow: CSSProperties = {
  display: "flex",
  gap: 10,
  alignItems: "center",
  flexWrap: "wrap",
};

const searchInput: CSSProperties = {
  width: 300,
  maxWidth: "100%",
  border: "1px solid #e2e8f0",
  borderRadius: 12,
  padding: "10px 12px",
  fontSize: 13,
  outline: "none",
  color: "#0f172a",
  boxSizing: "border-box",
  background: "#ffffff",
};

const simpleMutedText: CSSProperties = {
  color: "#6b7280",
  lineHeight: 1.55,
};

const emptyState: CSSProperties = {
  border: "1px dashed #cbd5e1",
  borderRadius: 16,
  padding: 18,
  background: "#f8fafc",
};

const emptyStateTitle: CSSProperties = {
  fontSize: 14,
  fontWeight: 800,
  color: "#111827",
  marginBottom: 6,
};

const emptyStateText: CSSProperties = {
  fontSize: 13,
  color: "#6b7280",
  lineHeight: 1.5,
};

const tableWrap: CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 18,
  overflowX: "auto",
  background: "#ffffff",
  width: "100%",
  minWidth: 0,
};

const th: CSSProperties = {
  padding: "14px 12px",
  borderBottom: "1px solid #e5e7eb",
  whiteSpace: "nowrap",
  fontSize: 12,
  color: "#6b7280",
  background: "#f8fafc",
  fontWeight: 800,
  textTransform: "uppercase",
  letterSpacing: 0.3,
};

const td: CSSProperties = {
  padding: "14px 12px",
  borderBottom: "1px solid #f1f5f9",
  verticalAlign: "middle",
  color: "#111827",
  fontSize: 14,
};

const tdMono: CSSProperties = {
  ...td,
  fontWeight: 700,
  whiteSpace: "nowrap",
};

const fileNameCell: CSSProperties = {
  fontWeight: 800,
  color: "#111827",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const hashText: CSSProperties = {
  marginTop: 6,
  fontSize: 12,
  color: "#6b7280",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const volumeRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
};

const volumeLabel: CSSProperties = {
  fontSize: 12,
  color: "#6b7280",
  lineHeight: 1.4,
};

const volumeValue: CSSProperties = {
  fontSize: 13,
  fontWeight: 800,
  whiteSpace: "nowrap",
};

const quickActionsWrap: CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  minWidth: 240,
};

const miniLink: CSSProperties = {
  padding: "8px 10px",
  borderRadius: 10,
  border: "1px solid #cbd5e1",
  textDecoration: "none",
  color: "#0f172a",
  fontSize: 12,
  fontWeight: 800,
  background: "#ffffff",
  whiteSpace: "nowrap",
};

const miniLinkPrimary: CSSProperties = {
  ...miniLink,
  border: "1px solid #93c5fd",
  background: "#eff6ff",
  color: "#1e3a8a",
};

const miniLinkWarning: CSSProperties = {
  ...miniLink,
  border: "1px solid #fcd34d",
  background: "#fffbeb",
  color: "#92400e",
};

const helpGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
  gap: 12,
};

const helpCard: CSSProperties = {
  borderRadius: 16,
  padding: 16,
  display: "grid",
  gap: 8,
  minWidth: 0,
};

const helpTitle: CSSProperties = {
  fontSize: 14,
  fontWeight: 900,
};

const helpText: CSSProperties = {
  fontSize: 13,
  lineHeight: 1.55,
};