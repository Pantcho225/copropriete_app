import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../../api/axios";

type LoadState = "idle" | "loading" | "success" | "error";
type AGStatus = "BROUILLON" | "OUVERTE" | "CLOTUREE" | "ARCHIVEE";

type AGItem = {
  id: number;
  reference: string;
  titre: string;
  exercice: string;
  date_ag: string;
  lieu?: string;
  statut: AGStatus;
  nb_resolutions: number;
  quorum_atteint?: boolean | null;
  pv_genere?: boolean;
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

function extractRows<T = unknown>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];

  if (isPaginatedResponse<T>(value)) return value.results;

  if (isRecord(value)) {
    const candidates = [value.results, value.items, value.data];
    for (const candidate of candidates) {
      if (Array.isArray(candidate)) return candidate as T[];
    }
  }

  return [];
}

function toNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function toBooleanOrNull(value: unknown): boolean | null {
  if (value === null || value === undefined || value === "") return null;

  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;

  if (typeof value === "string") {
    const s = value.trim().toLowerCase();

    if (["true", "1", "oui", "yes", "ok"].includes(s)) return true;
    if (["false", "0", "non", "no"].includes(s)) return false;

    if (["atteint", "généré", "genere", "disponible", "present"].includes(s)) return true;
    if (["absent", "indisponible", "non_genere", "non généré", "non genere"].includes(s)) return false;
  }

  return null;
}

function hasTruthyValue(value: unknown): boolean {
  if (value === null || value === undefined || value === "") return false;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") return value.trim().length > 0;
  return true;
}

function normalizeStatus(value: unknown): AGStatus {
  const s = String(value ?? "").trim().toUpperCase();

  if (["OUVERTE", "OPEN", "ACTIVE", "ACTIF", "EN_COURS"].includes(s)) return "OUVERTE";
  if (["CLOTUREE", "CLOTURE", "CLOSED", "TERMINEE", "TERMINÉE"].includes(s)) return "CLOTUREE";
  if (["ARCHIVEE", "ARCHIVÉE", "ARCHIVE", "ARCHIVED"].includes(s)) return "ARCHIVEE";
  return "BROUILLON";
}

function pickString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function pickDate(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function normalizeAGItem(raw: unknown): AGItem {
  const row = isRecord(raw) ? raw : {};

  const id =
    toNumberOrNull(row.id) ??
    toNumberOrNull(row.ag_id) ??
    toNumberOrNull(row.pk) ??
    0;

  let exerciceLabel = pickString(
    row.exercice,
    row.exercice_label,
    row.exercice_nom,
    row.exercice_libelle,
  );

  if (isRecord(row.exercice)) {
    exerciceLabel = pickString(
      row.exercice.libelle,
      row.exercice.nom,
      row.exercice.label,
      row.exercice.reference,
      String(row.exercice.id ?? ""),
    );
  }

  const nbResolutions =
    toNumberOrNull(row.nb_resolutions) ??
    toNumberOrNull(row.nombre_resolutions) ??
    toNumberOrNull(row.resolutions_count) ??
    (Array.isArray(row.resolutions) ? row.resolutions.length : null) ??
    0;

  const pvGenere =
    toBooleanOrNull(row.pv_genere) ??
    toBooleanOrNull(row.pv_archive) ??
    toBooleanOrNull(row.pv_disponible) ??
    (hasTruthyValue(row.pv_signed_pdf) ? true : null) ??
    false;

  return {
    id,
    reference: pickString(row.reference, row.ref, row.code) || `AG-${id}`,
    titre: pickString(row.titre, row.title, row.intitule, row.nom) || "Assemblée générale",
    exercice: exerciceLabel || "—",
    date_ag: pickDate(row.date_ag, row.date, row.date_assemblee, row.date_reunion),
    lieu: pickString(row.lieu, row.location, row.endroit),
    statut: normalizeStatus(row.statut ?? row.status ?? row.etat),
    nb_resolutions: nbResolutions,
    quorum_atteint:
      toBooleanOrNull(row.quorum_atteint) ??
      toBooleanOrNull(row.quorum) ??
      toBooleanOrNull(row.quorum_ok),
    pv_genere: pvGenere,
  };
}

function getErrorMessage(error: unknown, fallback: string) {
  const err = error as {
    response?: {
      status?: number;
      data?: {
        detail?: string;
        message?: string;
        [key: string]: unknown;
      };
    };
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
        <div style={{ marginTop: 8, fontSize: 12, color: "#6b7280", lineHeight: 1.45 }}>
          {props.sub}
        </div>
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
      <div style={{ fontSize: 14, fontWeight: 800, color: "#111827", marginBottom: 6 }}>
        {props.title}
      </div>
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

function formatDateShort(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (!Number.isNaN(d.getTime())) return d.toLocaleDateString("fr-FR");
  return iso;
}

function getStatusMeta(
  status: AGStatus,
): { label: string; kind: "neutral" | "success" | "warning" | "info" } {
  switch (status) {
    case "OUVERTE":
      return { label: "Ouverte", kind: "info" };
    case "CLOTUREE":
      return { label: "Clôturée", kind: "success" };
    case "ARCHIVEE":
      return { label: "Archivée", kind: "neutral" };
    default:
      return { label: "Brouillon", kind: "warning" };
  }
}

export default function AGList() {
  const navigate = useNavigate();

  const [state, setState] = useState<LoadState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<AGItem[]>([]);

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"TOUS" | AGStatus>("TOUS");

  async function fetchAssemblies() {
    setState("loading");
    setError(null);

    let lastError: unknown = null;

    for (const endpoint of AG_ENDPOINT_CANDIDATES) {
      try {
        const res = await api.get(endpoint);
        const data = res?.data;

        const normalized = extractRows<Record<string, unknown>>(data)
          .map(normalizeAGItem)
          .filter((item) => item.id > 0)
          .sort((a, b) => {
            const da = new Date(a.date_ag).getTime();
            const db = new Date(b.date_ag).getTime();

            if (Number.isNaN(da) && Number.isNaN(db)) return b.id - a.id;
            if (Number.isNaN(da)) return 1;
            if (Number.isNaN(db)) return -1;

            return db - da;
          });

        setRows(normalized);
        setState("success");
        return;
      } catch (e) {
        lastError = e;
      }
    }

    setRows([]);
    setState("error");
    setError(getErrorMessage(lastError, "Impossible de charger la liste des assemblées générales."));
  }

  useEffect(() => {
    void fetchAssemblies();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    return rows.filter((item) => {
      const matchesStatus = statusFilter === "TOUS" ? true : item.statut === statusFilter;
      if (!matchesStatus) return false;

      if (!q) return true;

      const haystack = [
        item.reference,
        item.titre,
        item.exercice,
        item.lieu ?? "",
        item.statut,
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(q);
    });
  }, [rows, query, statusFilter]);

  const stats = useMemo(() => {
    return {
      total: rows.length,
      ouvertes: rows.filter((x) => x.statut === "OUVERTE").length,
      cloturees: rows.filter((x) => x.statut === "CLOTUREE").length,
      brouillons: rows.filter((x) => x.statut === "BROUILLON").length,
    };
  }, [rows]);

  const isLoading = state === "loading";

  return (
    <PageShell>
      <SectionTitle
        title="Assemblées"
        subtitle="Consultez les assemblées générales, leur statut, leur quorum et leur niveau d’avancement, puis ouvrez directement les écrans métier détaillés : détail, présences, votes et PV."
        right={
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <SmallButton onClick={() => navigate("/ag")}>Retour au module AG</SmallButton>
            <SmallButton onClick={() => navigate("/ag/assemblees/nouveau")} primary>
              Nouvelle assemblée
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

      <div className="ag-list-stat-grid">
        <StatCard
          title="Assemblées générales"
          value={stats.total}
          sub="Nombre total d’assemblées visibles dans la liste."
          isLoading={isLoading}
        />
        <StatCard
          title="Ouvertes"
          value={stats.ouvertes}
          sub="Assemblées actuellement en cours de traitement."
          isLoading={isLoading}
        />
        <StatCard
          title="Clôturées"
          value={stats.cloturees}
          sub="Assemblées finalisées et prêtes pour exploitation."
          isLoading={isLoading}
        />
        <StatCard
          title="Brouillons"
          value={stats.brouillons}
          sub="Assemblées encore en préparation."
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
            placeholder="Rechercher : référence, titre, exercice, lieu..."
            style={searchInput}
          />

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as "TOUS" | AGStatus)}
            style={selectInput}
          >
            <option value="TOUS">Tous les statuts</option>
            <option value="BROUILLON">Brouillons</option>
            <option value="OUVERTE">Ouvertes</option>
            <option value="CLOTUREE">Clôturées</option>
            <option value="ARCHIVEE">Archivées</option>
          </select>

          <SmallButton onClick={() => void fetchAssemblies()} disabled={isLoading}>
            {isLoading ? "Actualisation..." : "Actualiser"}
          </SmallButton>
        </div>

        <div style={{ color: "#6b7280", fontSize: 13, fontWeight: 600 }}>
          {isLoading ? "Chargement des assemblées..." : `${filtered.length} assemblée(s) affichée(s)`}
        </div>
      </div>

      <div style={tableWrap}>
        {isLoading ? (
          <div style={{ padding: 16, color: "#6b7280", fontSize: 14 }}>
            Chargement des assemblées générales…
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 16 }}>
            <EmptyState
              title={rows.length === 0 ? "Aucune assemblée enregistrée" : "Aucune assemblée à afficher"}
              text={
                rows.length === 0
                  ? "Aucune assemblée générale n’a encore été trouvée pour cette copropriété."
                  : "Aucune assemblée ne correspond à la recherche ou aux filtres sélectionnés."
              }
              actionLabel="Nouvelle assemblée"
              onAction={() => navigate("/ag/assemblees/nouveau")}
            />
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1450 }}>
            <thead>
              <tr style={{ textAlign: "left" }}>
                <th style={th}>Référence</th>
                <th style={th}>Assemblée</th>
                <th style={th}>Exercice</th>
                <th style={th}>Date</th>
                <th style={th}>Lieu</th>
                <th style={th}>Résolutions</th>
                <th style={th}>Quorum</th>
                <th style={th}>PV</th>
                <th style={th}>Statut</th>
                <th style={th}>Actions métier</th>
              </tr>
            </thead>

            <tbody>
              {filtered.map((item) => {
                const status = getStatusMeta(item.statut);

                return (
                  <tr key={item.id}>
                    <td style={tdMono}>{item.reference || `AG-${item.id}`}</td>
                    <td style={td}>
                      <div style={{ fontWeight: 800, color: "#111827" }}>
                        {item.titre || "Assemblée générale"}
                      </div>
                    </td>
                    <td style={td}>{item.exercice || "—"}</td>
                    <td style={td}>{formatDateShort(item.date_ag)}</td>
                    <td style={td}>{item.lieu || "—"}</td>
                    <td style={tdStrong}>{item.nb_resolutions}</td>
                    <td style={td}>
                      {item.quorum_atteint === true ? (
                        <Badge text="Atteint" kind="success" />
                      ) : item.quorum_atteint === false ? (
                        <Badge text="Non atteint" kind="danger" />
                      ) : (
                        <Badge text="À vérifier" kind="warning" />
                      )}
                    </td>
                    <td style={td}>
                      {item.pv_genere ? (
                        <Badge text="Généré" kind="success" />
                      ) : (
                        <Badge text="Non généré" kind="neutral" />
                      )}
                    </td>
                    <td style={td}>
                      <Badge text={status.label} kind={status.kind} />
                    </td>
                    <td style={td}>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <Link to={`/ag/assemblees/${item.id}`} style={primaryMiniLink}>
                          Détail
                        </Link>
                        <Link to={`/ag/assemblees/${item.id}/presences`} style={secondaryMiniLink}>
                          Présences
                        </Link>
                        <Link to={`/ag/assemblees/${item.id}/votes`} style={secondaryMiniLink}>
                          Votes
                        </Link>
                        <Link to={`/ag/assemblees/${item.id}/pv`} style={secondaryMiniLink}>
                          PV
                        </Link>
                        <Link to={`/ag/assemblees/${item.id}/modifier`} style={secondaryMiniLink}>
                          Modifier
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <AlertBox kind="info">
        <div style={{ fontWeight: 800, marginBottom: 4 }}>Visibilité AG renforcée</div>
        <div style={{ fontSize: 13 }}>
          Les écrans <strong>Présences</strong>, <strong>Votes</strong> et <strong>PV</strong> sont
          maintenant accessibles directement depuis chaque ligne de la liste des assemblées.
        </div>
      </AlertBox>

      <style>{`
        .ag-list-stat-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 14px;
        }

        @media (max-width: 1200px) {
          .ag-list-stat-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 760px) {
          .ag-list-stat-grid {
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

const tdStrong: CSSProperties = {
  ...td,
  fontWeight: 800,
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