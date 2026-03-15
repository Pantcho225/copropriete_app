import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../../api/axios";

type LoadState = "idle" | "loading" | "success" | "error";
type PVStatus = "BROUILLON" | "GENERE" | "SIGNE" | "ARCHIVE";
type AGStatus = "BROUILLON" | "OUVERTE" | "CLOTUREE" | "ARCHIVEE";

type PVItem = {
  id: number;
  reference: string;
  assemblee_id: number;
  assemblee_ref: string;
  assemblee_titre: string;
  date_ag: string;
  statut: PVStatus;
  ag_statut: AGStatus;
  pv_locked: boolean;
  hash?: string;
  pv_pdf_url?: string | null;
  pv_signed_pdf_url?: string | null;
  genere_le?: string | null;
  signe_le?: string | null;
  archive_le?: string | null;
  signataire?: string | null;
};

type DRFPage<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

const AG_ENDPOINT_CANDIDATES = ["/api/ag/ags/", "/api/ag/ags"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function isPaginatedResponse<T = unknown>(value: unknown): value is DRFPage<T> {
  return isRecord(value) && Array.isArray(value.results) && typeof value.count === "number";
}

function asArray<T = unknown>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function toNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function toBoolean(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const s = value.trim().toLowerCase();
    return ["true", "1", "oui", "yes", "ok"].includes(s);
  }
  return false;
}

function pickString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function pickNullableString(...values: unknown[]): string | null {
  const v = pickString(...values);
  return v || null;
}

function pickDate(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function normalizeAGStatus(value: unknown): AGStatus {
  const s = String(value ?? "").trim().toUpperCase();
  if (["OUVERTE", "OPEN", "ACTIVE", "ACTIF", "EN_COURS"].includes(s)) return "OUVERTE";
  if (["CLOTUREE", "CLOTURE", "CLOSED", "TERMINEE", "TERMINÉE"].includes(s)) return "CLOTUREE";
  if (["ARCHIVEE", "ARCHIVÉE", "ARCHIVE", "ARCHIVED"].includes(s)) return "ARCHIVEE";
  return "BROUILLON";
}

function inferPVStatus(row: Record<string, unknown>): PVStatus {
  const pvLocked = toBoolean(row.pv_locked);
  const signedPdfUrl = pickNullableString(row.pv_signed_pdf_url);
  const signedAt = pickNullableString(row.pv_signed_at);
  const pdfUrl = pickNullableString(row.pv_pdf_url);
  const generatedAt = pickNullableString(row.pv_generated_at);

  if (pvLocked && (signedPdfUrl || signedAt)) return "ARCHIVE";
  if (signedPdfUrl || signedAt) return "SIGNE";
  if (pdfUrl || generatedAt) return "GENERE";
  return "BROUILLON";
}

function normalizePVItem(raw: unknown, index: number): PVItem {
  const row = isRecord(raw) ? raw : {};

  const agId =
    toNumberOrNull(row.id) ??
    toNumberOrNull(row.ag_id) ??
    toNumberOrNull(row.pk) ??
    index + 1;

  const pvPdfUrl = pickNullableString(row.pv_pdf_url);
  const pvSignedPdfUrl = pickNullableString(row.pv_signed_pdf_url);
  const genereLe = pickNullableString(row.pv_generated_at);
  const signeLe = pickNullableString(row.pv_signed_at);
  const pvLocked = toBoolean(row.pv_locked);

  return {
    id: agId,
    reference: pickString(row.reference, row.ref, row.code) || `PV-AG-${String(agId).padStart(5, "0")}`,
    assemblee_id: agId,
    assemblee_ref: pickString(row.reference, row.ref, row.code) || `AG-${agId}`,
    assemblee_titre: pickString(row.titre, row.title, row.intitule, row.nom) || "Assemblée générale",
    date_ag: pickDate(row.date_ag, row.date, row.date_assemblee),
    statut: inferPVStatus(row),
    ag_statut: normalizeAGStatus(row.statut ?? row.status ?? row.etat),
    pv_locked: pvLocked,
    hash: pickNullableString(row.pv_signed_hash, row.pv_pdf_hash) ?? undefined,
    pv_pdf_url: pvPdfUrl,
    pv_signed_pdf_url: pvSignedPdfUrl,
    genere_le: genereLe,
    signe_le: signeLe,
    archive_le: pvLocked ? signeLe ?? genereLe : null,
    signataire: pickNullableString(row.pv_signer_subject),
  };
}

function getErrorMessage(error: unknown, fallback: string) {
  const err = error as {
    response?: { data?: { detail?: string; message?: string } };
    message?: string;
  };
  return err?.response?.data?.detail || err?.response?.data?.message || err?.message || fallback;
}

function PageShell({ children }: { children: ReactNode }) {
  return <div style={{ display: "grid", gap: 16 }}>{children}</div>;
}

function SectionTitle(props: { title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "space-between",
        gap: 12,
        flexWrap: "wrap",
      }}
    >
      <div>
        <div
          style={{
            fontSize: 30,
            fontWeight: 900,
            letterSpacing: -0.6,
            color: "#111827",
            lineHeight: 1.1,
          }}
        >
          {props.title}
        </div>

        {props.subtitle ? (
          <div
            style={{
              fontSize: 14,
              color: "#6b7280",
              marginTop: 6,
              lineHeight: 1.5,
              maxWidth: 920,
            }}
          >
            {props.subtitle}
          </div>
        ) : null}
      </div>

      {props.right ? <div>{props.right}</div> : null}
    </div>
  );
}

function StatCard(props: { title: string; value: string | number; sub?: string; isLoading?: boolean }) {
  return (
    <div
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 20,
        padding: 18,
        background: "#ffffff",
        boxShadow: "0 10px 30px rgba(15, 23, 42, 0.04)",
        minHeight: 112,
      }}
    >
      <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 10, fontWeight: 700 }}>
        {props.title}
      </div>
      <div
        style={{
          fontSize: 28,
          fontWeight: 900,
          letterSpacing: -0.5,
          color: "#111827",
          lineHeight: 1.1,
        }}
      >
        {props.isLoading ? "…" : props.value}
      </div>
      {props.sub ? (
        <div style={{ marginTop: 8, fontSize: 12, color: "#6b7280", lineHeight: 1.45 }}>{props.sub}</div>
      ) : null}
    </div>
  );
}

function SmallButton(props: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      disabled={props.disabled}
      style={{
        border: props.primary ? "1px solid #c7d2fe" : "1px solid #e5e7eb",
        background: props.disabled ? "#f9fafb" : props.primary ? "#eef2ff" : "#fff",
        color: props.disabled ? "#9ca3af" : props.primary ? "#3730a3" : "#111827",
        borderRadius: 12,
        padding: "10px 14px",
        fontSize: 13,
        fontWeight: 800,
        cursor: props.disabled ? "not-allowed" : "pointer",
        whiteSpace: "nowrap",
      }}
    >
      {props.children}
    </button>
  );
}

function EmptyState(props: { title: string; text: string; actionLabel?: string; onAction?: () => void }) {
  return (
    <div
      style={{
        border: "1px dashed #d1d5db",
        borderRadius: 16,
        padding: 18,
        background: "#f9fafb",
      }}
    >
      <div style={{ fontSize: 14, fontWeight: 800, color: "#111827", marginBottom: 6 }}>{props.title}</div>
      <div style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.5 }}>{props.text}</div>
      {props.actionLabel && props.onAction ? (
        <div style={{ marginTop: 12 }}>
          <SmallButton onClick={props.onAction} primary>
            {props.actionLabel}
          </SmallButton>
        </div>
      ) : null}
    </div>
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
        lineHeight: 1.5,
      }}
    >
      {props.children}
    </div>
  );
}

function Badge(props: { text: string; kind?: "neutral" | "success" | "warning" | "danger" | "info" }) {
  const styles =
    props.kind === "success"
      ? { background: "#ecfdf5", border: "#a7f3d0", color: "#065f46" }
      : props.kind === "warning"
        ? { background: "#fffbeb", border: "#fde68a", color: "#92400e" }
        : props.kind === "danger"
          ? { background: "#fef2f2", border: "#fecaca", color: "#991b1b" }
          : props.kind === "info"
            ? { background: "#eff6ff", border: "#bfdbfe", color: "#1d4ed8" }
            : { background: "#f3f4f6", border: "#e5e7eb", color: "#374151" };

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "4px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 700,
        border: `1px solid ${styles.border}`,
        background: styles.background,
        color: styles.color,
        whiteSpace: "nowrap",
      }}
    >
      {props.text}
    </span>
  );
}

function formatDateShort(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (!Number.isNaN(d.getTime())) return d.toLocaleDateString("fr-FR");
  return iso;
}

function formatDateTimeShort(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (!Number.isNaN(d.getTime())) {
    return `${d.toLocaleDateString("fr-FR")} ${d.toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
    })}`;
  }
  return iso;
}

function truncateText(value?: string | null, max = 20) {
  if (!value) return "—";
  const s = String(value).trim();
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}

function getPVStatusBadge(status: PVStatus) {
  switch (status) {
    case "GENERE":
      return <Badge text="Généré" kind="info" />;
    case "SIGNE":
      return <Badge text="Signé" kind="success" />;
    case "ARCHIVE":
      return <Badge text="Archivé" kind="neutral" />;
    default:
      return <Badge text="Brouillon" kind="warning" />;
  }
}

function getAGStatusBadge(status: AGStatus) {
  switch (status) {
    case "OUVERTE":
      return <Badge text="AG ouverte" kind="info" />;
    case "CLOTUREE":
      return <Badge text="AG clôturée" kind="success" />;
    case "ARCHIVEE":
      return <Badge text="AG archivée" kind="neutral" />;
    default:
      return <Badge text="AG brouillon" kind="warning" />;
  }
}

export default function AGPV() {
  const navigate = useNavigate();

  const [state, setState] = useState<LoadState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<PVItem[]>([]);

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"TOUS" | PVStatus>("TOUS");

  async function fetchPVs() {
    setState("loading");
    setError(null);

    let lastError: unknown = null;
    let loadedRows: PVItem[] = [];

    for (const endpoint of AG_ENDPOINT_CANDIDATES) {
      try {
        const res = await api.get(endpoint);
        const data = res?.data;

        const rawRows = isPaginatedResponse<Record<string, unknown>>(data)
          ? data.results
          : asArray<Record<string, unknown>>(data);

        loadedRows = rawRows
          .map(normalizePVItem)
          .filter((item) => item.id > 0)
          .sort((a, b) => {
            const da = new Date(a.date_ag).getTime();
            const db = new Date(b.date_ag).getTime();

            if (Number.isNaN(da) && Number.isNaN(db)) return b.id - a.id;
            if (Number.isNaN(da)) return 1;
            if (Number.isNaN(db)) return -1;

            return db - da;
          });

        break;
      } catch (e) {
        lastError = e;
      }
    }

    setRows(loadedRows);

    if (loadedRows.length === 0 && lastError) {
      setState("error");
      setError(getErrorMessage(lastError, "Impossible de charger la vue des procès-verbaux."));
      return;
    }

    setState("success");
  }

  useEffect(() => {
    void fetchPVs();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    return rows.filter((item) => {
      const matchesStatus = statusFilter === "TOUS" ? true : item.statut === statusFilter;
      if (!matchesStatus) return false;
      if (!q) return true;

      const haystack = [
        item.reference,
        item.assemblee_ref,
        item.assemblee_titre,
        item.statut,
        item.hash ?? "",
        item.signataire ?? "",
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(q);
    });
  }, [rows, query, statusFilter]);

  const stats = useMemo(() => {
    return {
      total: rows.length,
      generes: rows.filter((x) => x.statut === "GENERE").length,
      signes: rows.filter((x) => x.statut === "SIGNE").length,
      archives: rows.filter((x) => x.statut === "ARCHIVE").length,
    };
  }, [rows]);

  const isLoading = state === "loading";

  return (
    <PageShell>
      <SectionTitle
        title="Procès-verbaux"
        subtitle="Suivez les documents PV à partir des assemblées générales, avec leur traçabilité, leur état de signature et leur niveau de verrouillage documentaire."
        right={
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <SmallButton onClick={() => navigate("/ag")}>Retour au module AG</SmallButton>
            <SmallButton onClick={() => navigate("/ag/assemblees")} primary>
              Voir les assemblées
            </SmallButton>
          </div>
        }
      />

      {state === "error" && error ? (
        <AlertBox kind="error">
          <div style={{ fontWeight: 900, marginBottom: 4 }}>Chargement impossible</div>
          <div style={{ fontSize: 13 }}>{error}</div>
        </AlertBox>
      ) : null}

      <div className="ag-pv-stat-grid">
        <StatCard
          title="Procès-verbaux"
          value={stats.total}
          sub="Nombre total de vues documentaires disponibles."
          isLoading={isLoading}
        />
        <StatCard
          title="Générés"
          value={stats.generes}
          sub="PV générés mais pas encore signés."
          isLoading={isLoading}
        />
        <StatCard
          title="Signés"
          value={stats.signes}
          sub="PV signés numériquement."
          isLoading={isLoading}
        />
        <StatCard
          title="Archivés"
          value={stats.archives}
          sub="PV verrouillés et figés dans le cycle documentaire."
          isLoading={isLoading}
        />
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher : assemblée, référence, hash, signataire..."
            style={searchInput}
          />

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as "TOUS" | PVStatus)}
            style={selectInput}
          >
            <option value="TOUS">Tous les statuts</option>
            <option value="BROUILLON">Brouillons</option>
            <option value="GENERE">Générés</option>
            <option value="SIGNE">Signés</option>
            <option value="ARCHIVE">Archivés</option>
          </select>

          <SmallButton onClick={() => void fetchPVs()} disabled={isLoading}>
            {isLoading ? "Actualisation..." : "Actualiser"}
          </SmallButton>
        </div>

        <div style={{ color: "#6b7280", fontSize: 13, fontWeight: 600 }}>
          {isLoading ? "Chargement des procès-verbaux..." : `${filtered.length} procès-verbal(aux) affiché(s)`}
        </div>
      </div>

      <div style={tableWrap}>
        {isLoading ? (
          <div style={{ padding: 16, color: "#6b7280", fontSize: 14 }}>
            Chargement des procès-verbaux…
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 16 }}>
            <EmptyState
              title={rows.length === 0 ? "Aucun procès-verbal enregistré" : "Aucun procès-verbal à afficher"}
              text={
                rows.length === 0
                  ? "Aucune assemblée ne remonte encore d’information documentaire PV exploitable."
                  : "Aucun procès-verbal ne correspond à la recherche ou aux filtres sélectionnés."
              }
              actionLabel="Voir les assemblées"
              onAction={() => navigate("/ag/assemblees")}
            />
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left" }}>
                <th style={th}>Référence PV</th>
                <th style={th}>Assemblée</th>
                <th style={th}>Date AG</th>
                <th style={th}>Hash</th>
                <th style={th}>Généré le</th>
                <th style={th}>Signé le</th>
                <th style={th}>Signataire</th>
                <th style={th}>État</th>
                <th style={th}>Actions</th>
              </tr>
            </thead>

            <tbody>
              {filtered.map((item) => (
                <tr key={item.id}>
                  <td style={tdMono}>{item.reference}</td>
                  <td style={td}>
                    <div style={{ fontWeight: 800, color: "#111827" }}>{item.assemblee_ref}</div>
                    <div style={{ marginTop: 4, fontSize: 12, color: "#6b7280" }}>{item.assemblee_titre}</div>
                  </td>
                  <td style={td}>{formatDateShort(item.date_ag)}</td>
                  <td style={td}>{truncateText(item.hash, 18)}</td>
                  <td style={td}>{formatDateTimeShort(item.genere_le)}</td>
                  <td style={td}>{formatDateTimeShort(item.signe_le)}</td>
                  <td style={td}>{item.signataire || "—"}</td>
                  <td style={td}>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {getPVStatusBadge(item.statut)}
                      {getAGStatusBadge(item.ag_statut)}
                      {item.pv_locked ? <Badge text="Verrouillé" kind="neutral" /> : null}
                    </div>
                  </td>
                  <td style={td}>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <Link to={`/ag/assemblees/${item.assemblee_id}`} style={primaryMiniLink}>
                        Voir l’assemblée
                      </Link>

                      {item.pv_signed_pdf_url ? (
                        <a
                          href={item.pv_signed_pdf_url}
                          target="_blank"
                          rel="noreferrer"
                          style={secondaryMiniLink}
                        >
                          PDF signé
                        </a>
                      ) : item.pv_pdf_url ? (
                        <a
                          href={item.pv_pdf_url}
                          target="_blank"
                          rel="noreferrer"
                          style={secondaryMiniLink}
                        >
                          PDF
                        </a>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <style>{`
        .ag-pv-stat-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 14px;
        }

        @media (max-width: 1200px) {
          .ag-pv-stat-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 760px) {
          .ag-pv-stat-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </PageShell>
  );
}

const searchInput: CSSProperties = {
  minWidth: 280,
  padding: "11px 12px",
  borderRadius: 12,
  border: "1px solid #e5e7eb",
  background: "#fff",
  color: "#111827",
  fontSize: 14,
  outline: "none",
};

const selectInput: CSSProperties = {
  padding: "11px 12px",
  borderRadius: 12,
  border: "1px solid #e5e7eb",
  background: "#fff",
  color: "#111827",
  fontWeight: 700,
};

const tableWrap: CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 20,
  overflowX: "auto",
  background: "#fff",
  boxShadow: "0 10px 30px rgba(15, 23, 42, 0.04)",
};

const th: CSSProperties = {
  padding: "14px 12px",
  borderBottom: "1px solid #e5e7eb",
  whiteSpace: "nowrap",
  fontSize: 12,
  color: "#6b7280",
  background: "#f9fafb",
  fontWeight: 800,
  textTransform: "uppercase",
  letterSpacing: 0.3,
};

const td: CSSProperties = {
  padding: "14px 12px",
  borderBottom: "1px solid #f3f4f6",
  verticalAlign: "middle",
  color: "#111827",
  fontSize: 14,
};

const tdMono: CSSProperties = {
  ...td,
  fontWeight: 700,
  whiteSpace: "nowrap",
};

const primaryMiniLink: CSSProperties = {
  padding: "7px 10px",
  borderRadius: 10,
  border: "1px solid #c7d2fe",
  background: "#eef2ff",
  fontSize: 12,
  fontWeight: 700,
  color: "#3730a3",
  textDecoration: "none",
  display: "inline-flex",
  alignItems: "center",
};

const secondaryMiniLink: CSSProperties = {
  padding: "7px 10px",
  borderRadius: 10,
  border: "1px solid #e5e7eb",
  background: "#fff",
  fontSize: 12,
  fontWeight: 700,
  color: "#111827",
  textDecoration: "none",
  display: "inline-flex",
  alignItems: "center",
};