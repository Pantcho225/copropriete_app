import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { Link } from "react-router-dom";
import api from "../../api/axios";
import { ENDPOINTS } from "../../api/endpoints";

type LoadState = "idle" | "loading" | "success" | "error";
type FlashKind = "success" | "error" | "info";
type BadgeKind = "neutral" | "success" | "warning" | "danger" | "info";
type ButtonVariant = "primary" | "secondary" | "danger";

type LotItem = {
  id: number;
  reference: string;
  type_lot: string;
  description: string;
  surface: string;
  etage: string;
};

type DRFPage<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function isPaginatedResponse<T = unknown>(value: unknown): value is DRFPage<T> {
  return isRecord(value) && Array.isArray(value.results);
}

function pickString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function toNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function formatSurface(value?: string): string {
  if (!value) return "—";
  const n = Number(value);
  if (Number.isFinite(n)) return `${n.toLocaleString("fr-FR")} m²`;
  return value;
}

function normalizeTypeLot(value: string): string {
  const map: Record<string, string> = {
    APPARTEMENT: "Appartement",
    PARKING: "Parking",
    CAVE: "Cave",
    COMMERCE: "Commerce",
    AUTRE: "Autre",
  };
  return map[value] || value || "—";
}

function getErrorMessage(error: unknown, fallback: string) {
  const err = error as {
    response?: { data?: { detail?: string; message?: string; [key: string]: unknown } };
    message?: string;
  };

  const data = err?.response?.data;

  if (typeof data?.detail === "string" && data.detail.trim()) return data.detail;
  if (typeof data?.message === "string" && data.message.trim()) return data.message;

  if (data && typeof data === "object") {
    for (const value of Object.values(data)) {
      if (Array.isArray(value) && typeof value[0] === "string") return value[0];
      if (typeof value === "string" && value.trim()) return value;
    }
  }

  return err?.message || fallback;
}

function extractRows(data: unknown): LotItem[] {
  const normalize = (raw: unknown): LotItem => {
    const row = isRecord(raw) ? raw : {};
    return {
      id: toNumber(row.id),
      reference: pickString(row.reference),
      type_lot: pickString(row.type_lot),
      description: pickString(row.description),
      surface: pickString(row.surface),
      etage: pickString(row.etage),
    };
  };

  if (isPaginatedResponse(data)) return data.results.map(normalize).filter((x) => x.id > 0);
  if (Array.isArray(data)) return data.map(normalize).filter((x) => x.id > 0);

  if (isRecord(data)) {
    const candidates = [data.results, data.items, data.data];
    for (const candidate of candidates) {
      if (Array.isArray(candidate)) {
        return candidate.map(normalize).filter((x) => x.id > 0);
      }
    }
  }

  return [];
}

function PageShell({ children }: { children: ReactNode }) {
  return <div style={{ display: "grid", gap: 16 }}>{children}</div>;
}

function SectionTitle(props: { title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 12,
        alignItems: "flex-end",
        flexWrap: "wrap",
      }}
    >
      <div>
        <div style={{ fontSize: 30, fontWeight: 900, color: "#111827", lineHeight: 1.1 }}>
          {props.title}
        </div>
        {props.subtitle ? (
          <div style={{ marginTop: 6, fontSize: 14, color: "#6b7280", lineHeight: 1.5, maxWidth: 920 }}>
            {props.subtitle}
          </div>
        ) : null}
      </div>
      {props.right ?? null}
    </div>
  );
}

function AlertBox(props: { kind: FlashKind; title?: string; children: ReactNode }) {
  const tone =
    props.kind === "error"
      ? { bg: "#fef2f2", border: "#fecaca", text: "#991b1b" }
      : props.kind === "success"
        ? { bg: "#ecfdf5", border: "#a7f3d0", text: "#166534" }
        : { bg: "#eff6ff", border: "#bfdbfe", text: "#1d4ed8" };

  return (
    <div
      style={{
        padding: 14,
        borderRadius: 16,
        background: tone.bg,
        border: `1px solid ${tone.border}`,
        color: tone.text,
      }}
    >
      {props.title ? <div style={{ fontWeight: 800, marginBottom: 4 }}>{props.title}</div> : null}
      <div style={{ fontSize: 13, lineHeight: 1.5 }}>{props.children}</div>
    </div>
  );
}

function Badge(props: { children: ReactNode; kind?: BadgeKind }) {
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
      {props.children}
    </span>
  );
}

function AppButton(props: {
  children: ReactNode;
  to?: string;
  variant?: ButtonVariant;
  disabled?: boolean;
}) {
  const variant = props.variant ?? "secondary";

  const styles =
    variant === "primary"
      ? {
          border: "1px solid #c7d2fe",
          background: "#eef2ff",
          color: "#3730a3",
        }
      : variant === "danger"
        ? {
            border: "1px solid #fecaca",
            background: "#fef2f2",
            color: "#991b1b",
          }
        : {
            border: "1px solid #e5e7eb",
            background: "#fff",
            color: "#111827",
          };

  return (
    <Link
      to={props.to ?? "#"}
      aria-disabled={props.disabled}
      onClick={(e) => {
        if (props.disabled || !props.to) e.preventDefault();
      }}
      style={{
        border: styles.border,
        background: props.disabled ? "#f9fafb" : styles.background,
        color: props.disabled ? "#9ca3af" : styles.color,
        borderRadius: 12,
        padding: "10px 14px",
        fontSize: 13,
        fontWeight: 800,
        textDecoration: "none",
        display: "inline-flex",
        alignItems: "center",
        whiteSpace: "nowrap",
        cursor: props.disabled ? "not-allowed" : "pointer",
      }}
    >
      {props.children}
    </Link>
  );
}

function EmptyState(props: { title: string; text: string; actionLabel?: string; actionTo?: string }) {
  return (
    <div
      style={{
        border: "1px dashed #d1d5db",
        borderRadius: 16,
        padding: 18,
        background: "#f9fafb",
      }}
    >
      <div style={{ fontWeight: 800, color: "#111827", marginBottom: 6 }}>{props.title}</div>
      <div style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.5 }}>{props.text}</div>
      {props.actionLabel && props.actionTo ? (
        <div style={{ marginTop: 12 }}>
          <AppButton to={props.actionTo} variant="primary">
            {props.actionLabel}
          </AppButton>
        </div>
      ) : null}
    </div>
  );
}

function StatCard(props: { title: string; value: string | number; sub?: string }) {
  return (
    <div
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 20,
        padding: 16,
        background: "#fff",
        boxShadow: "0 10px 30px rgba(15, 23, 42, 0.04)",
      }}
    >
      <div style={{ fontSize: 13, color: "#6b7280", fontWeight: 700, marginBottom: 8 }}>
        {props.title}
      </div>
      <div
        style={{
          fontSize: 28,
          fontWeight: 900,
          color: "#111827",
          letterSpacing: -0.4,
          lineHeight: 1.1,
        }}
      >
        {props.value}
      </div>
      {props.sub ? (
        <div style={{ marginTop: 8, fontSize: 12, color: "#6b7280", lineHeight: 1.45 }}>
          {props.sub}
        </div>
      ) : null}
    </div>
  );
}

export default function LotsList() {
  const [state, setState] = useState<LoadState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<LotItem[]>([]);
  const [query, setQuery] = useState("");

  async function fetchLots() {
    setState("loading");
    setError(null);

    try {
      const res = await api.get(ENDPOINTS.lots);
      setRows(extractRows(res.data));
      setState("success");
    } catch (e) {
      setRows([]);
      setState("error");
      setError(getErrorMessage(e, "Impossible de charger les lots."));
    }
  }

  useEffect(() => {
    void fetchLots();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;

    return rows.filter((item) =>
      [item.reference, item.type_lot, item.description, item.etage].join(" ").toLowerCase().includes(q),
    );
  }, [rows, query]);

  const stats = useMemo(() => {
    return {
      total: rows.length,
      appartements: rows.filter((x) => x.type_lot === "APPARTEMENT").length,
      parkings: rows.filter((x) => x.type_lot === "PARKING").length,
      autres: rows.filter((x) => !["APPARTEMENT", "PARKING"].includes(x.type_lot)).length,
    };
  }, [rows]);

  const isLoading = state === "loading";
  const hasRows = rows.length > 0;
  const hasQuery = query.trim().length > 0;

  return (
    <PageShell>
      <SectionTitle
        title="Lots"
        subtitle="Gérez les lots de la copropriété active pour alimenter correctement les présences, les votes et les répartitions métier."
        right={
          <AppButton to="/lots/nouveau" variant="primary">
            Nouveau lot
          </AppButton>
        }
      />

      <div
        className="lots-stats-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
          gap: 14,
        }}
      >
        <StatCard title="Lots" value={stats.total} sub="Nombre total de lots chargés." />
        <StatCard title="Appartements" value={stats.appartements} sub="Lots de type appartement." />
        <StatCard title="Parkings" value={stats.parkings} sub="Lots de type parking." />
        <StatCard title="Autres lots" value={stats.autres} sub="Caves, commerces et autres catégories." />
      </div>

      {state === "error" && error ? (
        <AlertBox kind="error" title="Impossible de charger les lots.">
          {error}
        </AlertBox>
      ) : null}

      <div style={card}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
            marginBottom: 14,
            alignItems: "center",
          }}
        >
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher : référence, type, description, étage..."
            style={input}
          />

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <Badge kind="neutral">{filtered.length} lot(s) affiché(s)</Badge>
            <button type="button" onClick={() => void fetchLots()} style={secondaryButton}>
              {isLoading ? "Actualisation..." : "Actualiser"}
            </button>
          </div>
        </div>

        {isLoading ? (
          <div style={{ color: "#6b7280", fontSize: 14 }}>Chargement des lots...</div>
        ) : filtered.length === 0 ? (
          <EmptyState
            title={hasRows ? "Aucun résultat" : "Aucun lot enregistré"}
            text={
              hasRows && hasQuery
                ? "Aucun lot ne correspond à la recherche en cours. Ajustez votre saisie pour afficher d’autres lots."
                : "Aucun lot n’a encore été trouvé pour la copropriété active."
            }
            actionLabel="Créer un lot"
            actionTo="/lots/nouveau"
          />
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {filtered.map((item) => (
              <div key={item.id} style={rowCard}>
                <div style={{ display: "grid", gap: 6 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <div style={{ fontSize: 15, fontWeight: 900, color: "#111827" }}>
                      {item.reference || `Lot #${item.id}`}
                    </div>
                    <Badge kind="neutral">{normalizeTypeLot(item.type_lot)}</Badge>
                    <Badge kind="info">{formatSurface(item.surface)}</Badge>
                  </div>

                  <div style={{ fontSize: 13, color: "#374151" }}>
                    <strong>Étage :</strong> {item.etage || "—"}
                  </div>

                  <div style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.5 }}>
                    <strong>Description :</strong> {item.description || "—"}
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "flex-start" }}>
                  <AppButton to={`/lots/${item.id}/modifier`} variant="secondary">
                    Modifier
                  </AppButton>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {state === "success" && rows.length > 0 ? (
        <AlertBox kind="info" title="Lecture métier du module">
          Les lots constituent une base structurante pour les présences, les votes en assemblée générale et les répartitions métier de la copropriété.
        </AlertBox>
      ) : null}

      <style>{`
        @media (max-width: 1180px) {
          .lots-stats-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }
        }

        @media (max-width: 680px) {
          .lots-stats-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </PageShell>
  );
}

const card: CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 20,
  padding: 18,
  background: "#fff",
  boxShadow: "0 10px 30px rgba(15, 23, 42, 0.04)",
};

const rowCard: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr auto",
  gap: 12,
  alignItems: "start",
  padding: 14,
  border: "1px solid #eef2f7",
  borderRadius: 14,
  background: "#fff",
};

const input: CSSProperties = {
  minWidth: 280,
  width: "100%",
  maxWidth: 460,
  padding: "12px 12px",
  borderRadius: 12,
  border: "1px solid #e5e7eb",
  background: "#fff",
  color: "#111827",
  fontSize: 14,
  boxSizing: "border-box",
};

const secondaryButton: CSSProperties = {
  border: "1px solid #e5e7eb",
  background: "#fff",
  color: "#111827",
  borderRadius: 12,
  padding: "10px 14px",
  fontSize: 13,
  fontWeight: 800,
  cursor: "pointer",
};