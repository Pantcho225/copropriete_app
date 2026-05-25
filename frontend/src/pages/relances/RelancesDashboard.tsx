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
import { APP_TEXT } from "../../constants/appText";

type LoadState = "idle" | "loading" | "success" | "error";

type DossierItem = {
  id: number;
  statut?: string;
  reste_a_payer?: number | string | null;
  lot_numero?: string | null;
  lot?: string | number | null;
  coproprietaire_nom?: string | null;
  appel_reference?: string | null;
  reference_appel?: string | null;
  date_echeance?: string | null;
  niveau_relance?: number | null;
  est_regularise?: boolean | null;
};

type DashboardStatsResponse = {
  total?: number;
  regularises?: number;
  non_regularises?: number;
};

type Stats = {
  dossiersImpayes: number;
  relancesEnvoyees: number;
  dossiersRegularises: number;
  relancesNiveauEleve: number;
  montantTotalImpayes: number;
};

type RelanceItem = {
  id: number;
  statut?: string | null;
  niveau?: number | null;
};

type AccentKind = "neutral" | "success" | "warning" | "danger" | "info";
type BadgeKind = "success" | "warning" | "danger" | "info" | "neutral";

const EMPTY_DOSSIERS: DossierItem[] = [];
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

function formatMoneyFCFA(amount?: number | null): string {
  if (amount == null) return "—";

  try {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "XOF",
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${amount} FCFA`;
  }
}

function formatDateShort(iso?: string | null): string {
  if (!iso) return "—";

  const d = new Date(iso);

  if (Number.isNaN(d.getTime())) return iso;

  return d.toLocaleDateString("fr-FR");
}

function toNumber(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;

  if (typeof value === "string") {
    const parsed = Number(value.replace(/\s/g, "").replace(",", "."));

    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function normalizeStatut(value?: string | null): string {
  return String(value ?? "").trim().toUpperCase();
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
    border: "#e5e7eb",
    text: "#4b5563",
    strongText: "#111827",
  };
}

function PageShell({ children }: { children: ReactNode }) {
  return <div style={pageShell}>{children}</div>;
}

function HeroHeader(props: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <section style={heroCard}>
      <div style={heroGlow} />

      <div style={heroGrid}>
        <div style={heroTextBlock}>
          <div style={pageEyebrow}>Relances · Vue d’ensemble</div>
          <div style={pageTitle}>{props.title}</div>
          {props.subtitle ? <div style={pageSubtitle}>{props.subtitle}</div> : null}
          {props.actions ? <div style={{ ...heroActions, marginTop: 18 }}>{props.actions}</div> : null}
        </div>

        {props.aside ? <div style={heroAsidePanel}>{props.aside}</div> : null}
      </div>
    </section>
  );
}

function Card(props: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  right?: ReactNode;
}) {
  return (
    <section style={card}>
      <div style={cardHeader}>
        <div style={{ display: "grid", gap: 4, minWidth: 0 }}>
          <div style={cardTitle}>{props.title}</div>
          {props.subtitle ? <div style={cardSubtitle}>{props.subtitle}</div> : null}
        </div>

        {props.right ? <div>{props.right}</div> : null}
      </div>

      {props.children}
    </section>
  );
}

function StatCard(props: {
  title: string;
  value: string | number;
  sub?: string;
  isLoading?: boolean;
  accent?: AccentKind;
}) {
  const tone = getTone(props.accent ?? "neutral");

  return (
    <div
      style={{
        ...statCard,
        border: `1px solid ${tone.border}`,
        background: tone.softBg,
      }}
    >
      <div style={{ ...statTitle, color: tone.text }}>{props.title}</div>

      <div style={{ ...statValue, color: tone.strongText }}>
        {props.isLoading ? "…" : props.value}
      </div>

      {props.sub ? <div style={{ ...statSub, color: tone.text }}>{props.sub}</div> : null}
    </div>
  );
}

function SmallButton(props: {
  children: ReactNode;
  onClick?: () => void;
  primary?: boolean;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      disabled={props.disabled}
      onClick={props.onClick}
      title={props.title}
      style={{
        border: props.primary ? "1px solid #93c5fd" : "1px solid #cbd5e1",
        background: props.disabled ? "#f9fafb" : props.primary ? "#dbeafe" : "#ffffff",
        color: props.disabled ? "#9ca3af" : props.primary ? "#1e3a8a" : "#111827",
        borderRadius: 12,
        padding: "10px 14px",
        fontSize: 13,
        fontWeight: 800,
        cursor: props.disabled ? "not-allowed" : "pointer",
        whiteSpace: "nowrap",
        transition: "all 0.2s ease",
        boxShadow: props.primary ? "0 10px 24px rgba(37,99,235,0.10)" : "none",
      }}
    >
      {props.children}
    </button>
  );
}

function Badge(props: { text: string; kind?: BadgeKind }) {
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
        lineHeight: 1.5,
      }}
    >
      {props.children}
    </div>
  );
}

function EmptyState(props: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div style={emptyState}>
      <div style={emptyStateTitle}>{props.title}</div>
      {props.description ? <div style={emptyStateText}>{props.description}</div> : null}
      {props.action ? <div style={{ marginTop: 14 }}>{props.action}</div> : null}
    </div>
  );
}

function getStatutBadge(statut?: string | null, estRegularise?: boolean | null) {
  const normalized = normalizeStatut(statut);

  if (estRegularise || normalized === "REGULARISE") {
    return <Badge text="Régularisé" kind="success" />;
  }

  if (normalized === "EN_RETARD") {
    return <Badge text="En retard" kind="danger" />;
  }

  if (normalized === "PARTIELLEMENT_PAYE") {
    return <Badge text="Partiellement payé" kind="warning" />;
  }

  if (normalized === "PAYE") {
    return <Badge text="Payé" kind="success" />;
  }

  return <Badge text="À traiter" kind="info" />;
}

export default function RelancesDashboard() {
  const navigate = useNavigate();

  const [state, setState] = useState<LoadState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [dossiers, setDossiers] = useState<DossierItem[]>(EMPTY_DOSSIERS);
  const [statsData, setStatsData] = useState<DashboardStatsResponse | null>(null);
  const [relances, setRelances] = useState<RelanceItem[]>(EMPTY_RELANCES);

  const loadData = useCallback(async () => {
    setState("loading");
    setError(null);

    try {
      const [statsResponse, dossiersResponse, relancesResponse] = await Promise.all([
        relancesAPI.getDossiersStats(),
        relancesAPI.getDossiers(),
        relancesAPI.getRelances(),
      ]);

      setStatsData(isRecord(statsResponse) ? (statsResponse as DashboardStatsResponse) : {});
      setDossiers(extractArray<DossierItem>(dossiersResponse));
      setRelances(extractArray<RelanceItem>(relancesResponse));
      setState("success");
    } catch (e) {
      setState("error");
      setError(getErrorMessage(e, APP_TEXT.feedback.error.load));
      setStatsData(null);
      setDossiers(EMPTY_DOSSIERS);
      setRelances(EMPTY_RELANCES);
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

  const goToDossiers = useCallback(() => {
    navigate("/relances/dossiers");
  }, [navigate]);

  const goToHistorique = useCallback(() => {
    navigate("/relances/historique");
  }, [navigate]);

  const goToAvis = useCallback(() => {
    navigate("/relances/avis");
  }, [navigate]);

  const openDossier = useCallback(
    (id: number) => {
      navigate(`/relances/dossiers/${id}`);
    },
    [navigate],
  );

  const handleRefresh = useCallback(() => {
    void loadData();
  }, [loadData]);

  const stats = useMemo<Stats>(() => {
    const dossiersImpayes = dossiers.filter((d) => toNumber(d.reste_a_payer) > 0).length;

    const dossiersRegularisesFromList = dossiers.filter((d) => {
      const statut = normalizeStatut(d.statut);

      return Boolean(d.est_regularise) || statut === "REGULARISE" || toNumber(d.reste_a_payer) <= 0;
    }).length;

    const dossiersRegularises =
      toNumber(statsData?.regularises) > 0
        ? toNumber(statsData?.regularises)
        : dossiersRegularisesFromList;

    const relancesEnvoyees = relances.filter((r) => normalizeStatut(r.statut) === "ENVOYE").length;
    const relancesNiveauEleve = relances.filter((r) => toNumber(r.niveau) >= 2).length;

    return {
      dossiersImpayes,
      relancesEnvoyees,
      dossiersRegularises,
      relancesNiveauEleve,
      montantTotalImpayes: dossiers.reduce((acc, d) => acc + toNumber(d.reste_a_payer), 0),
    };
  }, [statsData, dossiers, relances]);

  const priorityDossiers = useMemo(() => {
    return dossiers
      .filter((d) => toNumber(d.reste_a_payer) > 0)
      .sort((a, b) => {
        const levelDiff = toNumber(b.niveau_relance) - toNumber(a.niveau_relance);

        if (levelDiff !== 0) return levelDiff;

        return toNumber(b.reste_a_payer) - toNumber(a.reste_a_payer);
      })
      .slice(0, 5);
  }, [dossiers]);

  const isLoading = state === "loading";

  return (
    <PageShell>
      <HeroHeader
        title="Vue d’ensemble des relances"
        subtitle="Suivez les dossiers impayés, les relances réellement envoyées, les montants restant à recouvrer et les régularisations depuis une vue de pilotage unifiée."
        actions={
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <SmallButton onClick={goToDossiers} primary title="Voir les dossiers">
              Voir les dossiers
            </SmallButton>

            <SmallButton onClick={goToHistorique} title="Voir l’historique">
              Voir l’historique
            </SmallButton>

            <SmallButton onClick={goToAvis} title="Voir les avis">
              Voir les avis
            </SmallButton>

            <SmallButton onClick={handleRefresh} disabled={isLoading} title={APP_TEXT.actions.refresh}>
              {isLoading ? APP_TEXT.feedback.loading.default : APP_TEXT.actions.refresh}
            </SmallButton>
          </div>
        }
        aside={
          <div style={{ display: "grid", gap: 10 }}>
            <div style={heroAsideTitle}>Cockpit recouvrement</div>

            <div style={heroAsideText}>
              Cette vue permet d’identifier rapidement les dossiers sensibles, le volume réel des
              impayés, les relances déjà envoyées et les régularisations enregistrées.
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Badge text={`${stats.dossiersImpayes} impayé(s)`} kind="danger" />
              <Badge text={`${stats.relancesEnvoyees} relance(s) envoyée(s)`} kind="info" />
              <Badge text={`${stats.dossiersRegularises} régularisé(s)`} kind="success" />
            </div>
          </div>
        }
      />

      {state === "error" && error ? (
        <AlertBox kind="error">
          <div style={{ fontWeight: 900, marginBottom: 4 }}>{APP_TEXT.feedback.error.load}</div>
          <div>{error}</div>
        </AlertBox>
      ) : null}

      <div className="relances-dashboard-grid" style={statsGrid}>
        <StatCard
          title="Dossiers impayés"
          value={stats.dossiersImpayes}
          sub="Nombre de dossiers présentant encore un reste à payer."
          isLoading={isLoading}
          accent="danger"
        />

        <StatCard
          title="Relances envoyées"
          value={stats.relancesEnvoyees}
          sub="Relances dont le statut officiel est envoyé."
          isLoading={isLoading}
          accent="info"
        />

        <StatCard
          title="Montant impayé"
          value={formatMoneyFCFA(stats.montantTotalImpayes)}
          sub="Montant cumulé restant à recouvrer."
          isLoading={isLoading}
          accent="warning"
        />

        <StatCard
          title="Dossiers régularisés"
          value={stats.dossiersRegularises}
          sub="Dossiers soldés ou marqués comme régularisés."
          isLoading={isLoading}
          accent="success"
        />
      </div>

      <Card
        title="Dossiers prioritaires"
        subtitle="Les dossiers les plus sensibles sont classés selon le niveau de relance puis le montant restant à payer."
        right={
          <SmallButton onClick={goToDossiers} title="Voir les dossiers">
            Voir les dossiers
          </SmallButton>
        }
      >
        {isLoading ? (
          <div style={simpleMutedText}>{APP_TEXT.feedback.loading.default}</div>
        ) : priorityDossiers.length === 0 ? (
          <EmptyState
            title="Aucun dossier impayé disponible pour le moment."
            description="Cette vue d’ensemble permet une lecture rapide des impayés, des relances envoyées, des régularisations et des dossiers à traiter."
            action={
              <SmallButton onClick={goToDossiers} primary>
                Voir les dossiers
              </SmallButton>
            }
          />
        ) : (
          <div style={{ display: "grid", gap: 10, minWidth: 0 }}>
            {priorityDossiers.map((d) => (
              <div key={d.id} className="relances-row-card" style={rowCard}>
                <div style={{ display: "grid", gap: 6, minWidth: 0 }}>
                  <div style={rowTitle}>
                    {d.lot_numero || d.lot || "Lot non renseigné"} —{" "}
                    {d.coproprietaire_nom || "Copropriétaire non renseigné"}
                  </div>

                  <div style={rowMeta}>
                    Appel : {d.appel_reference || d.reference_appel || "—"} • Échéance :{" "}
                    {formatDateShort(d.date_echeance)}
                  </div>

                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {getStatutBadge(d.statut, d.est_regularise)}
                    <Badge
                      text={`Reste à payer : ${formatMoneyFCFA(toNumber(d.reste_a_payer))}`}
                      kind="danger"
                    />
                    <Badge text={`Niveau ${d.niveau_relance || 0}`} kind="warning" />
                  </div>
                </div>

                <div>
                  <SmallButton
                    onClick={() => openDossier(d.id)}
                    primary
                    title="Ouvrir le dossier"
                  >
                    Ouvrir le dossier
                  </SmallButton>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <AlertBox kind="info">
        <div style={{ fontWeight: 900, marginBottom: 4 }}>Positionnement produit</div>
        <div style={{ fontSize: 13, lineHeight: 1.5 }}>
          Cette vue d’ensemble renforce la lisibilité du module Relances, avec une lecture rapide des
          impayés, des relances envoyées, des régularisations et des dossiers à traiter.
        </div>
      </AlertBox>

      <style>{`
        .relances-dashboard-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 14px;
        }

        @media (max-width: 1200px) {
          .relances-dashboard-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .relances-dashboard-hero {
            grid-template-columns: 1fr !important;
          }
        }

        @media (max-width: 920px) {
          .relances-row-card {
            grid-template-columns: 1fr !important;
          }
        }

        @media (max-width: 700px) {
          .relances-dashboard-grid {
            grid-template-columns: 1fr;
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
    "linear-gradient(135deg, rgba(15,23,42,0.98) 0%, rgba(30,41,59,0.96) 55%, rgba(59,130,246,0.88) 100%)",
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

const heroGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1.2fr) minmax(260px, 0.8fr)",
  gap: 18,
  alignItems: "stretch",
  minWidth: 0,
};

const heroTextBlock: CSSProperties = {
  minWidth: 0,
  position: "relative",
  zIndex: 1,
};

const heroActions: CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  alignItems: "center",
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
  marginTop: 6,
  color: "rgba(255,255,255,0.84)",
  fontSize: 13.5,
  lineHeight: 1.6,
  maxWidth: 860,
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
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
  marginBottom: 14,
  alignItems: "center",
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
  fontSize: 12,
  fontWeight: 800,
  marginBottom: 8,
  textTransform: "uppercase",
  letterSpacing: 0.3,
};

const statValue: CSSProperties = {
  fontSize: 28,
  fontWeight: 900,
  lineHeight: 1.08,
  overflowWrap: "anywhere",
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
  minWidth: 0,
};

const rowCard: CSSProperties = {
  border: "1px solid #eef2f7",
  borderRadius: 14,
  padding: 14,
  background: "#ffffff",
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) auto",
  gap: 12,
  alignItems: "center",
  minWidth: 0,
};

const rowTitle: CSSProperties = {
  fontWeight: 900,
  color: "#111827",
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const rowMeta: CSSProperties = {
  fontSize: 13,
  color: "#6b7280",
  lineHeight: 1.45,
};

const emptyState: CSSProperties = {
  border: "1px dashed #d1d5db",
  borderRadius: 16,
  padding: 18,
  background: "#f9fafb",
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

const simpleMutedText: CSSProperties = {
  color: "#6b7280",
  lineHeight: 1.5,
};