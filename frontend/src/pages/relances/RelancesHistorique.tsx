import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { useNavigate } from "react-router-dom";
import { relancesAPI } from "../../api/relances";

type LoadState = "idle" | "loading" | "success" | "error";
type AccentKind = "neutral" | "success" | "warning" | "danger" | "info";

type RelanceItem = {
  id: number;
  created_at?: string | null;
  date_envoi?: string | null;
  canal?: string | null;
  statut?: string | null;
  objet?: string | null;
  message?: string | null;
  niveau?: number | null;
  envoye_par_username?: string | null;
  lot_numero?: string | null;
  coproprietaire_nom?: string | null;
};

const CANAL_LABELS: Record<string, string> = {
  INTERNE: "Interne",
  EMAIL: "Email",
  SMS: "SMS",
  WHATSAPP: "WhatsApp",
  COURRIER: "Courrier",
};

const EMPTY_RELANCES: RelanceItem[] = [];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function extractArray<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];

  if (isRecord(payload)) {
    if (Array.isArray(payload.results)) return payload.results as T[];
    if (Array.isArray(payload.data)) return payload.data as T[];
    if (Array.isArray(payload.items)) return payload.items as T[];
  }

  return [];
}

function getErrorMessage(error: unknown, fallback: string): string {
  const err = error as {
    response?: {
      data?: {
        detail?: string;
        non_field_errors?: string[];
        [key: string]: unknown;
      };
    };
    message?: string;
  };

  const data = err?.response?.data;

  if (data && typeof data === "object") {
    if (typeof data.detail === "string" && data.detail.trim()) return data.detail;

    if (Array.isArray(data.non_field_errors) && data.non_field_errors.length > 0) {
      return data.non_field_errors.join("\n");
    }

    try {
      const entries = Object.entries(data);

      if (entries.length > 0) {
        return entries
          .map(([key, value]) => {
            const rendered = Array.isArray(value)
              ? value.join(" / ")
              : typeof value === "string"
                ? value
                : JSON.stringify(value);

            return `${key}: ${rendered}`;
          })
          .join("\n");
      }
    } catch {
      return err?.message || fallback;
    }
  }

  return err?.message || fallback;
}

function getTone(kind: AccentKind) {
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

  if (kind === "danger") {
    return {
      softBg: "#fef2f2",
      border: "#fca5a5",
      text: "#991b1b",
      strongText: "#7f1d1d",
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

function PageShell({ children }: { children: ReactNode }) {
  return <div style={pageShell}>{children}</div>;
}

function HeroHeader(props: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <section style={heroCard}>
      <div style={heroGlow} />

      <div style={heroGrid}>
        <div style={heroMainBlock}>
          <div style={pageEyebrow}>Relances · Historique</div>
          <div style={pageTitle}>{props.title}</div>
          {props.subtitle ? <div style={pageSubtitle}>{props.subtitle}</div> : null}
          {props.right ? <div style={{ ...heroActions, marginTop: 18 }}>{props.right}</div> : null}
        </div>

        {props.aside ? <div style={heroAsidePanel}>{props.aside}</div> : null}
      </div>
    </section>
  );
}

function Panel(props: { children: ReactNode; style?: CSSProperties }) {
  return (
    <section
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 24,
        background: "#ffffff",
        boxShadow: "0 18px 45px rgba(15, 23, 42, 0.05)",
        minWidth: 0,
        ...props.style,
      }}
    >
      {props.children}
    </section>
  );
}

function SmallButton(props: {
  children: ReactNode;
  onClick?: () => void;
  primary?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      disabled={props.disabled}
      style={{
        border: props.primary ? "1px solid #93c5fd" : "1px solid #cbd5e1",
        background: props.disabled ? "#f9fafb" : props.primary ? "#dbeafe" : "#ffffff",
        color: props.disabled ? "#9ca3af" : props.primary ? "#1e3a8a" : "#0f172a",
        borderRadius: 12,
        padding: "10px 14px",
        fontSize: 13,
        fontWeight: 800,
        cursor: props.disabled ? "not-allowed" : "pointer",
        whiteSpace: "nowrap",
        transition: "all 0.18s ease",
        opacity: props.disabled ? 0.65 : 1,
        boxShadow: props.primary ? "0 10px 24px rgba(37,99,235,0.10)" : "none",
      }}
    >
      {props.children}
    </button>
  );
}

function Badge(props: {
  text: string;
  kind?: "success" | "warning" | "danger" | "info" | "neutral";
}) {
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
        padding: "5px 10px",
        borderRadius: 999,
        border: `1px solid ${styles.border}`,
        background: styles.background,
        color: styles.color,
        fontSize: 12,
        fontWeight: 800,
        whiteSpace: "nowrap",
      }}
    >
      {props.text}
    </span>
  );
}

function AlertBox(props: { kind: "error" | "info"; title: string; children: ReactNode }) {
  const tone =
    props.kind === "error"
      ? { bg: "#fef2f2", border: "#fecaca", text: "#991b1b" }
      : { bg: "#eff6ff", border: "#bfdbfe", text: "#1d4ed8" };

  return (
    <div
      style={{
        padding: 16,
        borderRadius: 18,
        background: tone.bg,
        border: `1px solid ${tone.border}`,
        color: tone.text,
      }}
    >
      <div style={{ fontWeight: 900, marginBottom: 6 }}>{props.title}</div>
      <div style={{ lineHeight: 1.55 }}>{props.children}</div>
    </div>
  );
}

function EmptyState(props: { title: string; text: string }) {
  return (
    <div style={emptyState}>
      <div style={emptyStateTitle}>{props.title}</div>
      <div style={emptyStateText}>{props.text}</div>
    </div>
  );
}

function KpiCard(props: { label: string; value: string; hint?: string; accent?: AccentKind }) {
  const tone = getTone(props.accent ?? "neutral");

  return (
    <div
      style={{
        border: `1px solid ${tone.border}`,
        borderRadius: 20,
        background: tone.softBg,
        padding: 16,
        minHeight: 108,
        boxShadow: "0 10px 24px rgba(15, 23, 42, 0.04)",
        minWidth: 0,
      }}
    >
      <div
        style={{
          fontSize: 12,
          fontWeight: 800,
          color: tone.text,
          textTransform: "uppercase",
          letterSpacing: 0.4,
        }}
      >
        {props.label}
      </div>

      <div
        style={{
          marginTop: 10,
          fontSize: 26,
          fontWeight: 900,
          color: tone.strongText,
          lineHeight: 1.12,
          letterSpacing: -0.3,
          overflowWrap: "anywhere",
        }}
      >
        {props.value}
      </div>

      {props.hint ? (
        <div style={{ marginTop: 8, fontSize: 12, color: tone.text, lineHeight: 1.5 }}>
          {props.hint}
        </div>
      ) : null}
    </div>
  );
}

function InfoStrip() {
  return (
    <div style={infoStrip}>
      <div style={infoStripText}>
        Cette vue permet de suivre les relances déjà générées, leur canal d’envoi, leur statut,
        leur niveau et leur contenu pour mieux contrôler le cycle de recouvrement.
      </div>
    </div>
  );
}

function formatDateTimeShort(iso?: string | null): string {
  if (!iso) return "—";

  const d = new Date(iso);

  if (Number.isNaN(d.getTime())) return iso;

  return `${d.toLocaleDateString("fr-FR")} ${d.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

function normalizeStatut(value?: string | null): string {
  return String(value ?? "").trim().toUpperCase();
}

function getCanalLabel(canal?: string | null): string {
  const key = String(canal ?? "").trim().toUpperCase();

  return CANAL_LABELS[key] || canal || "—";
}

function getCanalBadge(canal?: string | null) {
  const key = String(canal ?? "").trim().toUpperCase();

  switch (key) {
    case "EMAIL":
      return <Badge text="Email" kind="info" />;
    case "SMS":
      return <Badge text="SMS" kind="warning" />;
    case "WHATSAPP":
      return <Badge text="WhatsApp" kind="success" />;
    case "COURRIER":
      return <Badge text="Courrier" kind="neutral" />;
    case "INTERNE":
      return <Badge text="Interne" kind="neutral" />;
    default:
      return <Badge text={getCanalLabel(canal)} kind="neutral" />;
  }
}

function getRelanceBadge(statut?: string | null) {
  switch (normalizeStatut(statut)) {
    case "ANNULEE":
      return <Badge text="Annulée" kind="danger" />;
    case "ENVOYEE":
    case "ENVOYE":
      return <Badge text="Envoyée" kind="info" />;
    case "BROUILLON":
      return <Badge text="Brouillon" kind="warning" />;
    default:
      return <Badge text={statut || "—"} kind="neutral" />;
  }
}

export default function RelancesHistorique() {
  const navigate = useNavigate();

  const [state, setState] = useState<LoadState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<RelanceItem[]>(EMPTY_RELANCES);
  const [query, setQuery] = useState("");

  const loadData = useCallback(async () => {
    setState("loading");
    setError(null);

    try {
      const payload = await relancesAPI.getRelances();

      setData(extractArray<RelanceItem>(payload));
      setState("success");
    } catch (e) {
      setState("error");
      setError(getErrorMessage(e, "Impossible de charger l’historique des relances."));
      setData(EMPTY_RELANCES);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadData();
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [loadData]);

  const goToOverview = useCallback(() => {
    navigate("/relances");
  }, [navigate]);

  const goToDossiers = useCallback(() => {
    navigate("/relances/dossiers");
  }, [navigate]);

  const handleRefresh = useCallback(() => {
    void loadData();
  }, [loadData]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    if (!q) return data;

    return data.filter((r) => {
      const haystack = [
        r.canal ?? "",
        r.statut ?? "",
        r.objet ?? "",
        r.message ?? "",
        r.envoye_par_username ?? "",
        r.lot_numero ?? "",
        r.coproprietaire_nom ?? "",
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(q);
    });
  }, [data, query]);

  const stats = useMemo(() => {
    const total = filtered.length;

    const envoyees = filtered.filter((item) => {
      const statut = normalizeStatut(item.statut);

      return statut === "ENVOYEE" || statut === "ENVOYE";
    }).length;

    const annulees = filtered.filter((item) => normalizeStatut(item.statut) === "ANNULEE").length;
    const niveauEleve = filtered.filter((item) => Number(item.niveau ?? 0) >= 2).length;

    return {
      total,
      envoyees,
      annulees,
      niveauEleve,
    };
  }, [filtered]);

  const isLoading = state === "loading";

  return (
    <PageShell>
      <HeroHeader
        title="Historique des relances"
        subtitle="Consultez les relances déjà générées, leur canal, leur statut, leur contenu et leurs informations d’envoi."
        right={
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <SmallButton onClick={goToOverview}>Vue d’ensemble des relances</SmallButton>

            <SmallButton onClick={goToDossiers}>Dossiers impayés</SmallButton>

            <SmallButton onClick={handleRefresh} primary disabled={isLoading}>
              {isLoading ? "Chargement..." : "Actualiser"}
            </SmallButton>
          </div>
        }
        aside={
          <div style={{ display: "grid", gap: 10 }}>
            <div style={heroAsideTitle}>Contrôle d’activité</div>

            <div style={heroAsideText}>
              Cette vue permet de relire l’activité des relances dans le temps, d’identifier les
              canaux utilisés, les statuts critiques et les niveaux à surveiller.
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Badge text={`${stats.total} relance(s)`} kind="neutral" />
              <Badge text={`${stats.envoyees} envoyée(s)`} kind="info" />
              <Badge text={`${stats.annulees} annulée(s)`} kind="danger" />
            </div>
          </div>
        }
      />

      <InfoStrip />

      {state === "error" && error ? (
        <AlertBox kind="error" title="Chargement impossible">
          {error}
        </AlertBox>
      ) : null}

      <div className="relances-historique-kpi-grid" style={kpiGrid}>
        <KpiCard
          label="Relances affichées"
          value={String(stats.total)}
          hint="Nombre de relances visibles selon la recherche en cours."
          accent="neutral"
        />
        <KpiCard
          label="Envoyées"
          value={String(stats.envoyees)}
          hint="Relances envoyées et actives dans la vue actuelle."
          accent="info"
        />
        <KpiCard
          label="Annulées"
          value={String(stats.annulees)}
          hint="Relances annulées ou arrêtées dans cette vue."
          accent="danger"
        />
        <KpiCard
          label="Niveau élevé"
          value={String(stats.niveauEleve)}
          hint="Relances de niveau 2 ou plus, à surveiller en priorité."
          accent="warning"
        />
      </div>

      <Panel style={{ padding: 16 }}>
        <div style={searchPanelRow}>
          <div style={{ minWidth: 280, flex: 1 }}>
            <div style={fieldLabel}>Recherche</div>

            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher : canal, statut, objet, message, lot, copropriétaire..."
              style={searchInput}
            />
          </div>

          <div style={searchMetaText}>
            {isLoading ? "Chargement..." : `${filtered.length} relance(s) affichée(s)`}
          </div>
        </div>
      </Panel>

      <Panel style={{ overflow: "hidden" }}>
        {isLoading ? (
          <div style={{ padding: 16, color: "#6b7280" }}>
            Chargement de l’historique des relances…
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 16 }}>
            <EmptyState
              title="Aucune relance enregistrée"
              text="Aucune relance ne remonte pour le moment ou aucun résultat ne correspond à votre recherche."
            />
          </div>
        ) : (
          <div style={tableWrap}>
            <table style={tableStyle}>
              <thead>
                <tr style={{ textAlign: "left" }}>
                  <th style={th}>Date</th>
                  <th style={th}>Lot</th>
                  <th style={th}>Copropriétaire</th>
                  <th style={th}>Canal</th>
                  <th style={th}>Niveau</th>
                  <th style={th}>Statut</th>
                  <th style={th}>Objet</th>
                  <th style={th}>Message</th>
                  <th style={th}>Envoyé par</th>
                </tr>
              </thead>

              <tbody>
                {filtered.map((r) => {
                  const dateValue = r.date_envoi || r.created_at;
                  const niveau = Number(r.niveau ?? 0);

                  return (
                    <tr key={r.id}>
                      <td style={td}>{formatDateTimeShort(dateValue)}</td>
                      <td style={tdStrong}>{r.lot_numero || "—"}</td>
                      <td style={td}>{r.coproprietaire_nom || "—"}</td>
                      <td style={td}>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                          {getCanalBadge(r.canal)}
                        </div>
                      </td>
                      <td style={td}>
                        <Badge
                          text={`Niveau ${niveau || 0}`}
                          kind={niveau >= 2 ? "danger" : niveau === 1 ? "warning" : "neutral"}
                        />
                      </td>
                      <td style={td}>{getRelanceBadge(r.statut)}</td>
                      <td style={tdStrong}>{r.objet || "—"}</td>
                      <td style={tdMessage}>{r.message || "—"}</td>
                      <td style={td}>{r.envoye_par_username || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <AlertBox kind="info" title="Lecture métier">
        Cette vue permet de relire l’activité de relance dans le temps, de contrôler les canaux et
        statuts utilisés, et d’identifier rapidement les niveaux de relance les plus sensibles.
      </AlertBox>

      <style>{`
        .relances-historique-kpi-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 14px;
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
    "linear-gradient(135deg, rgba(15,23,42,0.98) 0%, rgba(30,41,59,0.96) 55%, rgba(59,130,246,0.86) 100%)",
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
  background: "radial-gradient(circle, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0) 72%)",
  pointerEvents: "none",
};

const heroGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1.18fr) minmax(260px, 0.82fr)",
  gap: 18,
  alignItems: "stretch",
  minWidth: 0,
};

const heroMainBlock: CSSProperties = {
  minWidth: 280,
  position: "relative",
  zIndex: 1,
};

const heroAsidePanel: CSSProperties = {
  position: "relative",
  zIndex: 1,
  borderRadius: 20,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.08)",
  padding: 16,
  display: "grid",
  gap: 10,
  alignContent: "start",
  minWidth: 0,
};

const heroAsideTitle: CSSProperties = {
  fontSize: 13,
  fontWeight: 900,
  color: "#ffffff",
  textTransform: "uppercase",
  letterSpacing: 0.5,
};

const heroAsideText: CSSProperties = {
  fontSize: 12.5,
  lineHeight: 1.6,
  color: "rgba(255,255,255,0.84)",
};

const heroActions: CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
  alignItems: "center",
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
  color: "#ffffff",
  lineHeight: 1.08,
  letterSpacing: -0.5,
};

const pageSubtitle: CSSProperties = {
  marginTop: 8,
  color: "rgba(255,255,255,0.84)",
  fontSize: 14,
  lineHeight: 1.6,
  maxWidth: 920,
};

const kpiGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 14,
  minWidth: 0,
};

const infoStrip: CSSProperties = {
  border: "1px solid #bfdbfe",
  background: "#eff6ff",
  borderRadius: 18,
  padding: "14px 16px",
};

const infoStripText: CSSProperties = {
  fontSize: 13,
  color: "#1d4ed8",
  lineHeight: 1.6,
  fontWeight: 600,
};

const searchPanelRow: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
  alignItems: "center",
  minWidth: 0,
};

const fieldLabel: CSSProperties = {
  fontSize: 13,
  fontWeight: 800,
  color: "#374151",
  marginBottom: 8,
};

const searchMetaText: CSSProperties = {
  color: "#6b7280",
  fontSize: 13,
  fontWeight: 600,
};

const searchInput: CSSProperties = {
  width: "100%",
  minWidth: 260,
  padding: "12px 14px",
  borderRadius: 14,
  border: "1px solid #e5e7eb",
  background: "#fff",
  color: "#111827",
  fontSize: 14,
  outline: "none",
  boxSizing: "border-box",
};

const tableWrap: CSSProperties = {
  overflowX: "auto",
  background: "#fff",
  width: "100%",
  minWidth: 0,
};

const tableStyle: CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  minWidth: 1280,
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
  color: "#111827",
  fontSize: 14,
  verticalAlign: "middle",
};

const tdStrong: CSSProperties = {
  ...td,
  fontWeight: 800,
};

const tdMessage: CSSProperties = {
  ...td,
  minWidth: 320,
  lineHeight: 1.5,
};

const emptyState: CSSProperties = {
  border: "1px dashed #d1d5db",
  borderRadius: 18,
  padding: 22,
  background: "#f8fafc",
};

const emptyStateTitle: CSSProperties = {
  fontSize: 15,
  fontWeight: 900,
  color: "#111827",
  marginBottom: 8,
};

const emptyStateText: CSSProperties = {
  fontSize: 13,
  color: "#6b7280",
  lineHeight: 1.6,
};