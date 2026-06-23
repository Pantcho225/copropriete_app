// src/pages/compta/ImportCSV.tsx
import {
  useCallback,
  useMemo,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type ReactNode,
} from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api/axios";
import { ENDPOINTS } from "../../api/endpoints";
import BackButton from "../../components/ui/BackButton";

type LoadState = "idle" | "loading" | "success" | "error";
type ToneKind = "neutral" | "success" | "warning" | "info" | "danger";

type ImportCsvResponse = {
  import_id: number;
  hash_unique?: string;
  encoding?: string;
  delimiter?: string;
  nb_lignes?: number;
  nb_crees?: number;
  nb_ignores?: number;
  nb_ignores_doublons?: number;
  nb_ignores_invalides?: number;
  detail?: string | Record<string, unknown>;
};

function getErrorMessage(e: unknown, fallback: string) {
  const err = e as {
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

function displayDelimiter(v?: string) {
  if (!v) return "—";
  if (v === ";") return "Point-virgule (;)";
  if (v === ",") return "Virgule (,)";
  if (v === "\t") return "Tabulation";

  return v;
}

function pickIgnoredCount(result: ImportCsvResponse | null) {
  if (!result) return null;

  if (typeof result.nb_ignores === "number") return result.nb_ignores;

  const doublons =
    typeof result.nb_ignores_doublons === "number" ? result.nb_ignores_doublons : 0;
  const invalides =
    typeof result.nb_ignores_invalides === "number" ? result.nb_ignores_invalides : 0;

  if (doublons > 0 || invalides > 0) return doublons + invalides;

  if (typeof result.nb_ignores_doublons === "number") return result.nb_ignores_doublons;
  if (typeof result.nb_ignores_invalides === "number") return result.nb_ignores_invalides;

  return null;
}

function fmtInt(value?: number | null) {
  const n = Number(value ?? 0);

  return new Intl.NumberFormat("fr-FR").format(Number.isFinite(n) ? n : 0);
}

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

  if (kind === "danger") {
    return {
      softBg: "#fef2f2",
      border: "#fecaca",
      text: "#991b1b",
      strongText: "#7f1d1d",
    };
  }

  return {
    softBg: "#f8fafc",
    border: "#e2e8f0",
    text: "#475569",
    strongText: "#0f172a",
  };
}

function PageShell({ children }: { children: ReactNode }) {
  return <div style={pageShell}>{children}</div>;
}

function SectionTitle(props: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  backTo?: string;
  backLabel?: string;
}) {
  return (
    <section style={heroCard}>
      <div style={heroGlow} />

      <div style={heroHeader}>
        <div style={heroTextBlock}>
          {props.backTo || props.backLabel ? (
            <div className="pageBackRow">
              <BackButton to={props.backTo} label={props.backLabel ?? "Retour"} />
            </div>
          ) : null}

          <div style={pageEyebrow}>Comptabilité · Relevés bancaires</div>

          <div style={pageTitle}>{props.title}</div>

          {props.subtitle ? <div style={pageSubtitle}>{props.subtitle}</div> : null}
        </div>

        {props.right ? <div style={heroActions}>{props.right}</div> : null}
      </div>
    </section>
  );
}

function AlertBox(props: { kind: "error" | "info" | "success"; children: ReactNode }) {
  const tone =
    props.kind === "error"
      ? {
          bg: "#fef2f2",
          border: "#fecaca",
          text: "#991b1b",
        }
      : props.kind === "success"
        ? {
            bg: "#ecfdf5",
            border: "#a7f3d0",
            text: "#065f46",
          }
        : {
            bg: "#eff6ff",
            border: "#bfdbfe",
            text: "#1d4ed8",
          };

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

function SmallButton(props: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  primary?: boolean;
  warning?: boolean;
}) {
  const styleTone = props.primary
    ? {
        border: "1px solid #93c5fd",
        background: "#dbeafe",
        color: "#1e3a8a",
      }
    : props.warning
      ? {
          border: "1px solid #fcd34d",
          background: "#fffbeb",
          color: "#92400e",
        }
      : {
          border: "1px solid #cbd5e1",
          background: "#ffffff",
          color: "#0f172a",
        };

  return (
    <button
      type="button"
      onClick={props.onClick}
      disabled={props.disabled}
      style={{
        ...styleTone,
        borderRadius: 12,
        padding: "10px 14px",
        fontSize: 13,
        fontWeight: 800,
        cursor: props.disabled ? "not-allowed" : "pointer",
        whiteSpace: "nowrap",
        opacity: props.disabled ? 0.65 : 1,
        boxShadow: props.primary ? "0 10px 24px rgba(37,99,235,0.10)" : "none",
      }}
    >
      {props.children}
    </button>
  );
}

function Card(props: {
  title: string;
  children: ReactNode;
  right?: ReactNode;
  subtitle?: string;
}) {
  return (
    <section style={card}>
      <div style={cardHeader}>
        <div style={{ display: "grid", gap: 4 }}>
          <div style={cardTitle}>{props.title}</div>
          {props.subtitle ? <div style={cardSubtitle}>{props.subtitle}</div> : null}
        </div>

        {props.right ? props.right : null}
      </div>

      {props.children}
    </section>
  );
}

function EmptyInfoBox(props: { title: string; text: string }) {
  return (
    <div style={emptyState}>
      <div style={emptyStateTitle}>{props.title}</div>
      <div style={emptyStateText}>{props.text}</div>
    </div>
  );
}

function InfoBadge(props: { label: string; tone?: ToneKind }) {
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
      {props.label}
    </span>
  );
}

export default function ImportCSV() {
  const navigate = useNavigate();

  const [file, setFile] = useState<File | null>(null);
  const [delimiter, setDelimiter] = useState(";");
  const [state, setState] = useState<LoadState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportCsvResponse | null>(null);

  const ignoredCount = useMemo(() => pickIgnoredCount(result), [result]);

  const fileSizeLabel = useMemo(() => {
    if (!file) return null;

    return `${(file.size / 1024).toLocaleString("fr-FR", {
      maximumFractionDigits: 1,
    })} Ko`;
  }, [file]);

  const stateLabel = useMemo(() => {
    if (state === "loading") return "Import en cours";
    if (state === "success") return "Import terminé";
    if (state === "error") return "Erreur";

    return "Prêt";
  }, [state]);

  const stateTone: ToneKind = useMemo(() => {
    if (state === "loading") return "info";
    if (state === "success") return "success";
    if (state === "error") return "danger";

    return "neutral";
  }, [state]);

  const hasSuccess = state === "success" && Boolean(result);
  const importId = result?.import_id ?? null;

  const goToImports = useCallback(() => {
    navigate("/compta/imports");
  }, [navigate]);

  const goToMovements = useCallback(() => {
    navigate("/compta/mouvements");
  }, [navigate]);

  const openLignes = useCallback(() => {
    if (!importId) return;

    navigate(`/compta/imports/${importId}/lignes`);
  }, [navigate, importId]);

  const resetForm = useCallback(() => {
    setFile(null);
    setDelimiter(";");
    setResult(null);
    setError(null);
    setState("idle");
  }, []);

  const handleFileChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0] ?? null;

    setFile(selectedFile);
    setError(null);
    setResult(null);

    if (selectedFile) {
      setState("idle");
    }
  }, []);

  const handleDelimiterChange = useCallback((event: ChangeEvent<HTMLSelectElement>) => {
    setDelimiter(event.target.value);
  }, []);

  const handleImport = useCallback(async () => {
    setError(null);
    setResult(null);

    if (!file) {
      setError("Veuillez sélectionner un fichier CSV avant de lancer l’import.");
      setState("error");
      return;
    }

    setState("loading");

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("delimiter", delimiter);

      const { data } = await api.post<ImportCsvResponse>(ENDPOINTS.importCSV, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      setResult(data);
      setState("success");
    } catch (e) {
      setError(getErrorMessage(e, "Une erreur est survenue lors de l’import bancaire."));
      setState("error");
    }
  }, [delimiter, file]);

  return (
    <PageShell>
      <SectionTitle
        title="Importer un relevé"
        subtitle="Importez un relevé bancaire au format CSV, puis poursuivez le traitement à partir des lignes importées pour faciliter le rapprochement bancaire et le suivi comptable."
        backTo="/compta"
        backLabel="Retour à la comptabilité"
        right={
          <div style={heroActions}>
            <SmallButton onClick={goToImports} primary>
              Voir les imports
            </SmallButton>

            <SmallButton onClick={goToMovements}>Voir les mouvements</SmallButton>
          </div>
        }
      />

      <div className="importcsv-stats-grid" style={statsGrid}>
        <StatCard
          title="Fichier sélectionné"
          value={file ? "Oui" : "Non"}
          sub={
            file
              ? `${file.name}${fileSizeLabel ? ` · ${fileSizeLabel}` : ""}`
              : "Aucun fichier n’a encore été sélectionné."
          }
          tone="neutral"
        />

        <StatCard
          title="Délimiteur"
          value={displayDelimiter(delimiter)}
          sub="Format utilisé pour lire le fichier importé."
          tone="info"
        />

        <StatCard
          title="État de l’import"
          value={stateLabel}
          sub="Suivi de l’opération en cours."
          tone={stateTone}
        />

        <StatCard
          title="Identifiant d’import"
          value={result?.import_id ? String(result.import_id) : "—"}
          sub="Disponible après un import réussi."
          tone={result?.import_id ? "success" : "neutral"}
        />
      </div>

      {error ? (
        <AlertBox kind="error">
          <div style={{ fontWeight: 900, marginBottom: 4 }}>
            Impossible d’importer le relevé bancaire
          </div>
          <div style={{ fontSize: 13 }}>{error}</div>
        </AlertBox>
      ) : null}

      {hasSuccess ? (
        <AlertBox kind="success">
          <div style={{ fontWeight: 900, marginBottom: 4 }}>
            Le relevé bancaire a bien été importé
          </div>

          <div style={{ fontSize: 13 }}>
            Vous pouvez maintenant consulter les lignes importées pour poursuivre le traitement.
          </div>
        </AlertBox>
      ) : null}

      <Card
        title="Préparer l’import bancaire"
        subtitle="Sélectionnez un fichier CSV, choisissez le bon délimiteur, puis lancez l’import."
        right={
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <SmallButton onClick={resetForm} disabled={state === "loading"} warning>
              Réinitialiser
            </SmallButton>

            <SmallButton onClick={() => void handleImport()} disabled={state === "loading"} primary>
              {state === "loading" ? "Import en cours..." : "Importer le relevé"}
            </SmallButton>
          </div>
        }
      >
        <div className="importcsv-form-grid" style={formGrid}>
          <div>
            <div style={label}>Fichier CSV</div>

            <label style={uploadBox}>
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={handleFileChange}
                style={{ display: "none" }}
              />

              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
                <InfoBadge
                  label={file ? "Fichier prêt" : "En attente de sélection"}
                  tone={file ? "success" : "neutral"}
                />
                <InfoBadge label="CSV requis" tone="info" />
              </div>

              <div style={uploadTitle}>
                {file ? "Fichier prêt à être importé" : "Choisir un fichier CSV"}
              </div>

              <div style={uploadText}>
                {file
                  ? `${file.name}${fileSizeLabel ? ` · ${fileSizeLabel}` : ""}`
                  : "Formats acceptés : .csv ou text/csv"}
              </div>
            </label>
          </div>

          <div>
            <div style={label}>Délimiteur</div>

            <select value={delimiter} onChange={handleDelimiterChange} style={input}>
              <option value=";">Point-virgule ;</option>
              <option value=",">Virgule ,</option>
              <option value={"\t"}>Tabulation</option>
            </select>

            <div style={hintBox}>
              Choisissez le délimiteur correspondant au format du relevé bancaire reçu.
            </div>
          </div>
        </div>
      </Card>

      {result ? (
        <Card
          title="Résultat de l’import bancaire"
          subtitle="Résumé de l’opération et accès direct à la suite du traitement."
          right={
            <SmallButton onClick={openLignes} primary>
              Voir les lignes importées
            </SmallButton>
          }
        >
          <div className="importcsv-result-grid" style={resultStatsGrid}>
            <StatCard
              title="Lignes importées"
              value={typeof result.nb_lignes === "number" ? fmtInt(result.nb_lignes) : "—"}
              sub="Nombre total de lignes détectées dans le fichier."
              tone="info"
            />

            <StatCard
              title="Lignes créées"
              value={typeof result.nb_crees === "number" ? fmtInt(result.nb_crees) : "—"}
              sub="Nombre de lignes effectivement importées."
              tone="success"
            />

            <StatCard
              title="Ignorées à l’import"
              value={ignoredCount !== null ? fmtInt(ignoredCount) : "—"}
              sub="Doublons ou lignes invalides selon les contrôles appliqués."
              tone="warning"
            />

            <StatCard
              title="Encodage détecté"
              value={result.encoding ?? "—"}
              sub={`Délimiteur utilisé : ${displayDelimiter(result.delimiter ?? delimiter)}`}
              tone="neutral"
            />
          </div>

          <div className="importcsv-detail-grid" style={detailGrid}>
            <div style={summaryPanel}>
              <div style={panelTitle}>Synthèse de l’import</div>

              <div style={{ display: "grid", gap: 10 }}>
                <div style={lineItem}>
                  <span style={lineLabel}>Identifiant d’import</span>
                  <span style={lineValue}>#{result.import_id}</span>
                </div>

                <div style={lineItem}>
                  <span style={lineLabel}>Encodage</span>
                  <span style={lineValue}>{result.encoding ?? "—"}</span>
                </div>

                <div style={lineItem}>
                  <span style={lineLabel}>Délimiteur</span>
                  <span style={lineValue}>{displayDelimiter(result.delimiter ?? delimiter)}</span>
                </div>

                <div style={lineItem}>
                  <span style={lineLabel}>Hash du fichier</span>
                  <span style={hashValue}>{result.hash_unique ?? "—"}</span>
                </div>
              </div>
            </div>

            <div style={nextStepPanel}>
              <div style={panelTitleBlue}>Étape suivante recommandée</div>

              <div style={nextStepText}>
                Ouvrez les lignes importées pour consulter les statuts, lancer des suggestions de
                rapprochement, ignorer certaines lignes ou créer des mouvements si nécessaire.
              </div>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
                <SmallButton onClick={openLignes} primary>
                  Ouvrir les lignes importées
                </SmallButton>

                <SmallButton onClick={goToImports}>Voir les imports</SmallButton>
              </div>
            </div>
          </div>

          {result.detail ? (
            <details style={{ marginTop: 16 }}>
              <summary style={detailsSummary}>Voir les informations techniques</summary>
              <pre style={technicalPre}>
                {typeof result.detail === "string"
                  ? result.detail
                  : JSON.stringify(result.detail, null, 2)}
              </pre>
            </details>
          ) : null}
        </Card>
      ) : (
        <Card
          title="Après l’import bancaire"
          subtitle="Le résumé de l’opération s’affichera ici après un import réussi."
        >
          <EmptyInfoBox
            title="Aucun résultat d’import disponible"
            text="Une fois le relevé bancaire importé avec succès, un résumé complet s’affichera ici avec un accès direct aux lignes importées."
          />
        </Card>
      )}

      <style>{`
        @media (max-width: 1100px) {
          .importcsv-stats-grid,
          .importcsv-result-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }
        }

        @media (max-width: 900px) {
          .importcsv-form-grid,
          .importcsv-detail-grid {
            grid-template-columns: 1fr !important;
          }
        }

        @media (max-width: 680px) {
          .importcsv-stats-grid,
          .importcsv-result-grid {
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

const heroHeader: CSSProperties = {
  display: "flex",
  alignItems: "flex-end",
  justifyContent: "space-between",
  gap: 14,
  flexWrap: "wrap",
  minWidth: 0,
};

const heroTextBlock: CSSProperties = {
  position: "relative",
  zIndex: 1,
  minWidth: 0,
};

const heroActions: CSSProperties = {
  display: "flex",
  gap: 8,
  alignItems: "center",
  flexWrap: "wrap",
  position: "relative",
  zIndex: 1,
};

const pageEyebrow: CSSProperties = {
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: 0.9,
  textTransform: "uppercase",
  color: "rgba(255,255,255,0.72)",
  marginBottom: 6,
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
  marginTop: 8,
  lineHeight: 1.6,
  maxWidth: 860,
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

const statsGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
  gap: 14,
};

const formGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1.3fr 0.7fr",
  gap: 16,
};

const uploadBox: CSSProperties = {
  display: "block",
  border: "1px dashed #cbd5e1",
  borderRadius: 16,
  padding: 18,
  background: "#f8fafc",
  cursor: "pointer",
};

const uploadTitle: CSSProperties = {
  fontSize: 14,
  fontWeight: 800,
  color: "#111827",
  marginBottom: 6,
};

const uploadText: CSSProperties = {
  fontSize: 13,
  color: "#6b7280",
  lineHeight: 1.5,
};

const hintBox: CSSProperties = {
  marginTop: 12,
  padding: 12,
  borderRadius: 14,
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
  fontSize: 12,
  color: "#6b7280",
  lineHeight: 1.5,
};

const resultStatsGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
  gap: 14,
};

const detailGrid: CSSProperties = {
  marginTop: 16,
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 14,
};

const summaryPanel: CSSProperties = {
  border: "1px solid #e2e8f0",
  borderRadius: 16,
  padding: 14,
  background: "#ffffff",
  minWidth: 0,
};

const nextStepPanel: CSSProperties = {
  border: "1px solid #93c5fd",
  borderRadius: 16,
  padding: 14,
  background: "#eff6ff",
  minWidth: 0,
};

const panelTitle: CSSProperties = {
  fontSize: 13,
  color: "#6b7280",
  fontWeight: 700,
  marginBottom: 10,
};

const panelTitleBlue: CSSProperties = {
  fontSize: 13,
  color: "#1e3a8a",
  fontWeight: 800,
  marginBottom: 10,
};

const nextStepText: CSSProperties = {
  fontSize: 13,
  color: "#1d4ed8",
  lineHeight: 1.6,
};

const lineItem: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "flex-start",
  paddingBottom: 8,
  borderBottom: "1px dashed #e2e8f0",
};

const lineLabel: CSSProperties = {
  fontSize: 13,
  color: "#6b7280",
};

const lineValue: CSSProperties = {
  fontSize: 13,
  color: "#111827",
  fontWeight: 800,
  textAlign: "right",
};

const hashValue: CSSProperties = {
  fontSize: 12,
  color: "#111827",
  fontWeight: 700,
  textAlign: "right",
  wordBreak: "break-all",
  maxWidth: 260,
};

const detailsSummary: CSSProperties = {
  cursor: "pointer",
  fontWeight: 700,
  color: "#111827",
};

const technicalPre: CSSProperties = {
  marginTop: 10,
  whiteSpace: "pre-wrap",
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
  borderRadius: 14,
  padding: 14,
  fontSize: 12,
  color: "#334155",
};

const label: CSSProperties = {
  fontSize: 13,
  color: "#6b7280",
  fontWeight: 700,
  marginBottom: 8,
};

const input: CSSProperties = {
  width: "100%",
  padding: "11px 12px",
  borderRadius: 12,
  border: "1px solid #e2e8f0",
  background: "#fff",
  color: "#111827",
  boxSizing: "border-box",
};