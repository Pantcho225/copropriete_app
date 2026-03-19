import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
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

function PageShell({ children }: { children: ReactNode }) {
  return <div style={pageShell}>{children}</div>;
}

function PageHeader(props: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div style={pageHeader}>
      <div style={{ display: "grid", gap: 6 }}>
        <div style={pageEyebrow}>Relances</div>
        <div style={pageTitle}>{props.title}</div>
        {props.subtitle ? <div style={pageSubtitle}>{props.subtitle}</div> : null}
      </div>

      {props.actions ? <div style={pageHeaderActions}>{props.actions}</div> : null}
    </div>
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
        <div style={{ display: "grid", gap: 4 }}>
          <div style={cardTitle}>{props.title}</div>
          {props.subtitle ? <div style={cardSubtitle}>{props.subtitle}</div> : null}
        </div>

        {props.right ? <div>{props.right}</div> : null}
      </div>

      {props.children}
    </div>
  );
}

function StatCard(props: {
  title: string;
  value: string | number;
  sub?: string;
  isLoading?: boolean;
}) {
  return (
    <div style={statCard}>
      <div style={statLabel}>{props.title}</div>
      <div style={statValue}>{props.isLoading ? "…" : props.value}</div>
      {props.sub ? <div style={statSub}>{props.sub}</div> : null}
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
        border: props.primary ? "1px solid #c7d2fe" : "1px solid #e5e7eb",
        background: props.disabled ? "#f9fafb" : props.primary ? "#eef2ff" : "#ffffff",
        color: props.disabled ? "#9ca3af" : props.primary ? "#3730a3" : "#111827",
        borderRadius: 12,
        padding: "10px 14px",
        fontSize: 13,
        fontWeight: 800,
        cursor: props.disabled ? "not-allowed" : "pointer",
        whiteSpace: "nowrap",
        transition: "all 0.2s ease",
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
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function normalizeStatut(value?: string | null): string {
  return String(value ?? "").trim().toUpperCase();
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

  return <Badge text="À payer" kind="info" />;
}

export default function RelancesDashboard() {
  const navigate = useNavigate();

  const [state, setState] = useState<LoadState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [dossiers, setDossiers] = useState<DossierItem[]>([]);
  const [statsData, setStatsData] = useState<DashboardStatsResponse | null>(null);
  const [relances, setRelances] = useState<RelanceItem[]>([]);

  async function loadData() {
    setState("loading");
    setError(null);

    try {
      const [statsResponse, dossiersResponse, relancesResponse] = await Promise.all([
        relancesAPI.getDossiersStats(),
        relancesAPI.getDossiers(),
        relancesAPI.getRelances(),
      ]);

      setStatsData((statsResponse ?? {}) as DashboardStatsResponse);
      setDossiers(Array.isArray(dossiersResponse) ? (dossiersResponse as DossierItem[]) : []);
      setRelances(Array.isArray(relancesResponse) ? (relancesResponse as RelanceItem[]) : []);
      setState("success");
    } catch (e: any) {
      setState("error");
      setError(e?.response?.data?.detail || e?.message || APP_TEXT.feedback.error.load);
      setStatsData(null);
      setDossiers([]);
      setRelances([]);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  const stats = useMemo<Stats>(() => {
    const dossiersImpayes = dossiers.filter((d) => toNumber(d.reste_a_payer) > 0).length;

    const dossiersRegularisesFromList = dossiers.filter((d) => {
      const statut = normalizeStatut(d.statut);
      return Boolean(d.est_regularise) || statut === "REGULARISE" || toNumber(d.reste_a_payer) <= 0;
    }).length;

    const dossiersRegularises =
      toNumber(statsData?.regularises) > 0 ? toNumber(statsData?.regularises) : dossiersRegularisesFromList;

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
      <PageHeader
        title="Vue d’ensemble des relances"
        subtitle="Suivez les dossiers impayés, les relances réellement envoyées, les montants restant à recouvrer et les régularisations depuis une vue de pilotage unifiée."
        actions={
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <SmallButton onClick={() => navigate("/relances/dossiers")} primary title="Voir les dossiers">
              Voir les dossiers
            </SmallButton>

            <SmallButton onClick={() => navigate("/relances/historique")} title="Voir l’historique">
              Voir l’historique
            </SmallButton>

            <SmallButton onClick={() => navigate("/relances/avis")} title="Voir les avis">
              Voir les avis
            </SmallButton>

            <SmallButton
              onClick={() => void loadData()}
              disabled={isLoading}
              title={APP_TEXT.actions.refresh}
            >
              {isLoading ? APP_TEXT.feedback.loading.default : APP_TEXT.actions.refresh}
            </SmallButton>
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
        />
        <StatCard
          title="Relances envoyées"
          value={stats.relancesEnvoyees}
          sub="Relances dont le statut officiel est envoyé."
          isLoading={isLoading}
        />
        <StatCard
          title="Montant impayé"
          value={formatMoneyFCFA(stats.montantTotalImpayes)}
          sub="Montant cumulé restant à recouvrer sur les dossiers impayés."
          isLoading={isLoading}
        />
        <StatCard
          title="Dossiers régularisés"
          value={stats.dossiersRegularises}
          sub="Dossiers soldés ou marqués comme régularisés."
          isLoading={isLoading}
        />
      </div>

      <Card
        title="Dossiers prioritaires"
        subtitle="Les dossiers les plus sensibles sont classés selon le niveau de relance puis le montant restant à payer."
        right={
          <SmallButton onClick={() => navigate("/relances/dossiers")} title="Voir les dossiers">
            Voir les dossiers
          </SmallButton>
        }
      >
        {isLoading ? (
          <div style={simpleMutedText}>{APP_TEXT.feedback.loading.default}</div>
        ) : priorityDossiers.length === 0 ? (
          <EmptyState
            title="Aucun dossier impayé disponible pour le moment."
            description="Cette vue d’ensemble renforce la lisibilité du module Relances, avec une lecture rapide des impayés, des relances envoyées, des régularisations et des dossiers à traiter."
            action={
              <SmallButton onClick={() => navigate("/relances/dossiers")} primary>
                Voir les dossiers
              </SmallButton>
            }
          />
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {priorityDossiers.map((d) => (
              <div key={d.id} style={rowCard}>
                <div style={{ display: "grid", gap: 6 }}>
                  <div style={{ fontWeight: 900, color: "#111827" }}>
                    {d.lot_numero || d.lot || "Lot non renseigné"} —{" "}
                    {d.coproprietaire_nom || "Copropriétaire non renseigné"}
                  </div>

                  <div style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.45 }}>
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
                    onClick={() => navigate(`/relances/dossiers/${d.id}`)}
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
};

const pageHeader: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
  alignItems: "flex-end",
};

const pageEyebrow: CSSProperties = {
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: 0.9,
  textTransform: "uppercase",
  color: "#6b7280",
};

const pageTitle: CSSProperties = {
  fontSize: 30,
  fontWeight: 900,
  color: "#111827",
  lineHeight: 1.1,
  letterSpacing: -0.5,
};

const pageSubtitle: CSSProperties = {
  marginTop: 6,
  color: "#6b7280",
  fontSize: 14,
  lineHeight: 1.55,
  maxWidth: 920,
};

const pageHeaderActions: CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
  alignItems: "center",
};

const card: CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 22,
  padding: 18,
  background: "#ffffff",
  boxShadow: "0 10px 30px rgba(15, 23, 42, 0.04)",
};

const cardHeader: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
  marginBottom: 14,
  alignItems: "center",
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
  border: "1px solid #e5e7eb",
  borderRadius: 20,
  padding: 16,
  background: "#ffffff",
  boxShadow: "0 10px 30px rgba(15, 23, 42, 0.04)",
};

const statLabel: CSSProperties = {
  fontSize: 13,
  color: "#6b7280",
  fontWeight: 700,
  marginBottom: 10,
};

const statValue: CSSProperties = {
  fontSize: 28,
  fontWeight: 900,
  color: "#111827",
  lineHeight: 1.1,
};

const statSub: CSSProperties = {
  marginTop: 8,
  fontSize: 12,
  color: "#6b7280",
  lineHeight: 1.45,
};

const statsGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
  gap: 14,
};

const rowCard: CSSProperties = {
  border: "1px solid #eef2f7",
  borderRadius: 14,
  padding: 14,
  background: "#ffffff",
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "center",
  flexWrap: "wrap",
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