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

type LoadState = "idle" | "loading" | "success" | "error";
type FlashKind = "success" | "error" | "info";
type BadgeKind = "neutral" | "success" | "warning" | "danger" | "info";
type ButtonVariant = "primary" | "secondary" | "danger";
type StatTone = "blue" | "green" | "yellow" | "neutral";

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

    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
  }

  return "";
}

function toNumber(value: unknown, fallback = 0): number {
  const n = Number(value);

  return Number.isFinite(n) ? n : fallback;
}

function formatSurface(value?: string): string {
  if (!value) return "—";

  const normalized = String(value).replace(",", ".").trim();
  const n = Number(normalized);

  if (Number.isFinite(n)) return `${n.toLocaleString("fr-FR")} m²`;

  return value;
}

function normalizeTypeLot(value?: string | null): string {
  const key = String(value ?? "").trim().toUpperCase();

  const map: Record<string, string> = {
    APPARTEMENT: "Appartement",
    PARKING: "Parking",
    CAVE: "Cave",
    COMMERCE: "Commerce",
    LOCAL_COMMERCIAL: "Local commercial",
    BUREAU: "Bureau",
    DEPOT: "Dépôt",
    AUTRE: "Autre",
  };

  return map[key] || key || "—";
}

function getTypeBadgeKind(value?: string | null): BadgeKind {
  const key = String(value ?? "").trim().toUpperCase();

  if (key === "APPARTEMENT") return "success";
  if (key === "PARKING") return "info";
  if (key === "CAVE" || key === "DEPOT") return "warning";
  if (key === "COMMERCE" || key === "LOCAL_COMMERCIAL" || key === "BUREAU") {
    return "info";
  }

  return "neutral";
}

function getErrorMessage(error: unknown, fallback: string) {
  const err = error as {
    response?: {
      data?: {
        detail?: string;
        message?: string;
        error?: string;
        non_field_errors?: string[];
        [key: string]: unknown;
      };
    };
    message?: string;
  };

  const data = err?.response?.data;

  if (typeof data?.detail === "string" && data.detail.trim()) return data.detail;
  if (typeof data?.message === "string" && data.message.trim()) return data.message;
  if (typeof data?.error === "string" && data.error.trim()) return data.error;

  if (Array.isArray(data?.non_field_errors) && data.non_field_errors.length) {
    return data.non_field_errors.join("\n");
  }

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
      reference: pickString(row.reference, row.numero, row.code, row.nom),
      type_lot: pickString(row.type_lot, row.type, row.categorie),
      description: pickString(row.description, row.libelle),
      surface: pickString(row.surface, row.superficie),
      etage: pickString(row.etage, row.niveau),
    };
  };

  if (isPaginatedResponse(data)) {
    return data.results.map(normalize).filter((x) => x.id > 0);
  }

  if (Array.isArray(data)) {
    return data.map(normalize).filter((x) => x.id > 0);
  }

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
  return <div style={pageShell}>{children}</div>;
}

function SectionTitle(props: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
}) {
  return (
    <div style={sectionTitleWrapper}>
      <div style={{ minWidth: 0 }}>
        <div style={sectionTitle}>{props.title}</div>

        {props.subtitle ? <div style={sectionSubtitle}>{props.subtitle}</div> : null}
      </div>

      {props.right ? <div style={{ minWidth: 0 }}>{props.right}</div> : null}
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
        minWidth: 0,
      }}
    >
      {props.title ? <div style={{ fontWeight: 900, marginBottom: 4 }}>{props.title}</div> : null}
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
          <AppButton to={props.actionTo} variant="primary">
            {props.actionLabel}
          </AppButton>
        </div>
      ) : null}
    </div>
  );
}

function StatCard(props: {
  title: string;
  value: string | number;
  sub?: string;
  tone?: StatTone;
}) {
  const tone = props.tone ?? "neutral";

  const toneMap: Record<StatTone, { border: string; bg: string; accent: string }> = {
    blue: {
      border: "#bfdbfe",
      bg: "#eff6ff",
      accent: "#1d4ed8",
    },
    green: {
      border: "#a7f3d0",
      bg: "#ecfdf5",
      accent: "#166534",
    },
    yellow: {
      border: "#fde68a",
      bg: "#fffbeb",
      accent: "#92400e",
    },
    neutral: {
      border: "#e5e7eb",
      bg: "#fff",
      accent: "#111827",
    },
  };

  return (
    <div
      style={{
        ...statCard,
        border: `1px solid ${toneMap[tone].border}`,
        background: toneMap[tone].bg,
      }}
    >
      <div style={statTitle}>{props.title}</div>
      <div style={{ ...statValue, color: toneMap[tone].accent }}>{props.value}</div>
      {props.sub ? <div style={statSub}>{props.sub}</div> : null}
    </div>
  );
}

export default function LotsList() {
  const [state, setState] = useState<LoadState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<LotItem[]>([]);
  const [query, setQuery] = useState("");

  const fetchLots = useCallback(async () => {
    setState("loading");
    setError(null);

    try {
      const res = await api.get(ENDPOINTS.lots);

      setRows(extractRows(res.data));
      setState("success");
    } catch (e: unknown) {
      setRows([]);
      setState("error");
      setError(getErrorMessage(e, "Impossible de charger les lots."));
    }
  }, []);

  useEffect(() => {
  const run = async () => {
    await fetchLots();
  };

  void run();
}, [fetchLots]);

  const handleRefresh = useCallback(() => {
    void fetchLots();
  }, [fetchLots]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    if (!q) return rows;

    return rows.filter((item) =>
      [
        item.id,
        item.reference,
        normalizeTypeLot(item.type_lot),
        item.type_lot,
        item.description,
        item.surface,
        item.etage,
      ]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [rows, query]);

  const stats = useMemo(() => {
    return {
      total: rows.length,
      appartements: rows.filter((x) => String(x.type_lot).toUpperCase() === "APPARTEMENT").length,
      parkings: rows.filter((x) => String(x.type_lot).toUpperCase() === "PARKING").length,
      autres: rows.filter(
        (x) => !["APPARTEMENT", "PARKING"].includes(String(x.type_lot).toUpperCase()),
      ).length,
    };
  }, [rows]);

  const isLoading = state === "loading";
  const hasRows = rows.length > 0;
  const hasQuery = query.trim().length > 0;

  return (
    <PageShell>
      <SectionTitle
        title="Lots"
        subtitle="Gérez les lots de la copropriété active afin de sécuriser les tantièmes, les présences, les votes et les répartitions métier."
        right={
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <AppButton to="/lots/nouveau" variant="primary">
              Nouveau lot
            </AppButton>
          </div>
        }
      />

      <div className="lots-stats-grid" style={statsGrid}>
        <StatCard
          title="Lots"
          value={stats.total}
          sub="Nombre total de lots chargés pour la copropriété active."
          tone="blue"
        />

        <StatCard
          title="Appartements"
          value={stats.appartements}
          sub="Lots principaux destinés à l’habitation."
          tone="green"
        />

        <StatCard
          title="Parkings"
          value={stats.parkings}
          sub="Emplacements de stationnement enregistrés."
          tone="neutral"
        />

        <StatCard
          title="Autres lots"
          value={stats.autres}
          sub="Caves, commerces, bureaux et autres catégories."
          tone="yellow"
        />
      </div>

      {state === "error" && error ? (
        <AlertBox kind="error" title="Impossible de charger les lots">
          {error}
        </AlertBox>
      ) : null}

      <div style={card}>
        <div style={toolbar}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher : référence, type, description, étage..."
            style={input}
          />

          <div style={toolbarActions}>
            <Badge kind="neutral">
              {isLoading
                ? "Chargement..."
                : `${filtered.length} lot(s) affiché(s) sur ${rows.length}`}
            </Badge>

            <button
              type="button"
              onClick={handleRefresh}
              disabled={isLoading}
              style={{
                ...secondaryButton,
                opacity: isLoading ? 0.7 : 1,
                cursor: isLoading ? "not-allowed" : "pointer",
              }}
            >
              {isLoading ? "Actualisation..." : "Actualiser"}
            </button>
          </div>
        </div>

        {isLoading ? (
          <div style={{ color: "#6b7280", fontSize: 14 }}>
            Chargement des lots...
          </div>
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
          <div style={{ display: "grid", gap: 10, minWidth: 0 }}>
            {filtered.map((item) => (
              <div key={item.id} style={rowCard}>
                <div style={{ display: "grid", gap: 6, minWidth: 0 }}>
                  <div style={rowHeader}>
                    <div style={lotTitle}>{item.reference || `Lot #${item.id}`}</div>

                    <Badge kind={getTypeBadgeKind(item.type_lot)}>
                      {normalizeTypeLot(item.type_lot)}
                    </Badge>

                    <Badge kind="info">{formatSurface(item.surface)}</Badge>
                  </div>

                  <div style={rowMeta}>
                    <strong>Étage :</strong> {item.etage || "—"}
                  </div>

                  <div style={rowDescription}>
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
        <AlertBox kind="info" title="Lecture métier du module Lots">
          Les lots constituent une base structurante pour les copropriétaires,
          les tantièmes, les présences, les votes en assemblée générale et les
          répartitions de charges.
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

const pageShell: CSSProperties = {
  display: "grid",
  gap: 16,
  minWidth: 0,
};

const sectionTitleWrapper: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "flex-end",
  flexWrap: "wrap",
  minWidth: 0,
};

const sectionTitle: CSSProperties = {
  fontSize: 30,
  fontWeight: 900,
  color: "#111827",
  lineHeight: 1.1,
};

const sectionSubtitle: CSSProperties = {
  marginTop: 6,
  fontSize: 14,
  color: "#6b7280",
  lineHeight: 1.5,
  maxWidth: 920,
};

const statsGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
  gap: 14,
  minWidth: 0,
};

const statCard: CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 20,
  padding: 16,
  background: "#fff",
  boxShadow: "0 10px 30px rgba(15, 23, 42, 0.04)",
  minWidth: 0,
};

const statTitle: CSSProperties = {
  fontSize: 13,
  color: "#6b7280",
  fontWeight: 700,
  marginBottom: 8,
};

const statValue: CSSProperties = {
  fontSize: 28,
  fontWeight: 900,
  color: "#111827",
  letterSpacing: -0.4,
  lineHeight: 1.1,
  overflowWrap: "anywhere",
};

const statSub: CSSProperties = {
  marginTop: 8,
  fontSize: 12,
  color: "#6b7280",
  lineHeight: 1.45,
};

const card: CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 20,
  padding: 18,
  background: "#fff",
  boxShadow: "0 10px 30px rgba(15, 23, 42, 0.04)",
  minWidth: 0,
};

const toolbar: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
  marginBottom: 14,
  alignItems: "center",
  minWidth: 0,
};

const toolbarActions: CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  alignItems: "center",
};

const rowCard: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) auto",
  gap: 12,
  alignItems: "start",
  padding: 14,
  border: "1px solid #eef2f7",
  borderRadius: 14,
  background: "#fff",
  minWidth: 0,
};

const rowHeader: CSSProperties = {
  display: "flex",
  gap: 8,
  alignItems: "center",
  flexWrap: "wrap",
  minWidth: 0,
};

const lotTitle: CSSProperties = {
  fontSize: 15,
  fontWeight: 900,
  color: "#111827",
  minWidth: 0,
  overflowWrap: "anywhere",
};

const rowMeta: CSSProperties = {
  fontSize: 13,
  color: "#374151",
};

const rowDescription: CSSProperties = {
  fontSize: 13,
  color: "#6b7280",
  lineHeight: 1.5,
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
};

const emptyState: CSSProperties = {
  border: "1px dashed #d1d5db",
  borderRadius: 16,
  padding: 18,
  background: "#f9fafb",
  minWidth: 0,
};

const emptyStateTitle: CSSProperties = {
  fontWeight: 800,
  color: "#111827",
  marginBottom: 6,
};

const emptyStateText: CSSProperties = {
  fontSize: 13,
  color: "#6b7280",
  lineHeight: 1.5,
};