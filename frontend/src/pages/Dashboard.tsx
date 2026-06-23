import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import ModuleHero from "../components/ui/ModuleHero";
import ModuleStatCard from "../components/ui/ModuleStatCard";

type LoadState = "loading" | "success" | "error";
type ToneKind = "neutral" | "success" | "info" | "warning" | "danger";

type AGStatus =
  | "BROUILLON"
  | "CONVOQUEE"
  | "OUVERTE"
  | "CLOTUREE"
  | "ANNULEE"
  | "ARCHIVEE";

type MouvementItem = {
  id: number;
  sens: string;
  montant: string | number;
  date_operation: string;
  reference?: string;
  libelle?: string;
  note?: string;
  is_rapproche?: boolean;
};

type SeriesPoint = {
  date: string;
  credit?: number;
  debit?: number;
  net?: number;
  cumul_net?: number;
};

type AGDashboardItem = {
  id: number;
  statut: AGStatus;
  pv_genere?: boolean;
  pv_signe?: boolean;
  pv_locked?: boolean;
  reference?: string;
  titre?: string;
  date_ag?: string;
  lieu?: string;
};

type DashboardData = {
  compta?: {
    totaux?: {
      revenus?: number;
      depenses?: number;
      solde?: number;
      total_credit?: number;
      total_debit?: number;
      nb_non_rapproches?: number;
      series_days?: number;
    };
    comptes?: Array<{
      compte?: string;
      nom?: string;
      solde?: number;
    }>;
    series?: SeriesPoint[];
    derniers_mouvements?: MouvementItem[];
  };
  travaux?: {
    total?: number;
    brouillons?: number;
    soumis_ag?: number;
    valides?: number;
    rejetes?: number;
    clotures?: number;
    budget_estime_total?: number;
    budget_vote_total?: number;
    total_paye?: number;
    reste_a_payer?: number;
  };
  ag?: {
    total?: number;
    ouvertes?: number;
    cloturees?: number;
    brouillons?: number;
    archivees?: number;
    recentes?: AGDashboardItem[];
  };
  billing?: {
    total_factures?: number;
    montant_total?: number;
    montant_paye?: number;
    montant_impaye?: number;
    brouillons?: number;
    emises?: number;
    payees?: number;
    en_retard?: number;
  };
};

type StatCardProps = {
  title: string;
  value: ReactNode;
  subtitle?: string;
  tone?: ToneKind;
};

type QuickAction = {
  title: string;
  text: string;
  label: string;
  to: string;
  tone?: ToneKind;
};

function toModuleStatTone(kind?: ToneKind) {
  if (kind === "success") return "green";
  if (kind === "info") return "blue";
  if (kind === "warning") return "amber";
  if (kind === "danger") return "red";
  return "neutral";
}

function getTone(kind: ToneKind) {
  if (kind === "success") {
    return {
      softBg: "#ecfdf5",
      bg: "#dcfce7",
      border: "#86efac",
      text: "#166534",
      strongText: "#14532d",
    };
  }

  if (kind === "info") {
    return {
      softBg: "#eff6ff",
      bg: "#dbeafe",
      border: "#93c5fd",
      text: "#1d4ed8",
      strongText: "#1e3a8a",
    };
  }

  if (kind === "warning") {
    return {
      softBg: "#fffbeb",
      bg: "#fef3c7",
      border: "#fcd34d",
      text: "#92400e",
      strongText: "#78350f",
    };
  }

  if (kind === "danger") {
    return {
      softBg: "#fef2f2",
      bg: "#fee2e2",
      border: "#fca5a5",
      text: "#991b1b",
      strongText: "#7f1d1d",
    };
  }

  return {
    softBg: "#f9fafb",
    bg: "#f3f4f6",
    border: "#e5e7eb",
    text: "#4b5563",
    strongText: "#111827",
  };
}

function formatMoney(value?: number | string | null) {
  const numberValue =
    typeof value === "string" ? Number(value) : typeof value === "number" ? value : 0;

  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "XOF",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(numberValue) ? numberValue : 0);
}

function formatDate(value?: string | null) {
  if (!value) return "—";

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) return value;

  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(parsed);
}

function parseNumber(value?: number | string | null) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;

  if (typeof value === "string") {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }

  return 0;
}

function normalizeAGStatus(value: unknown): AGStatus {
  const s = String(value ?? "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();

  if (["OUVERTE", "OPEN", "ACTIVE", "ACTIF", "EN_COURS"].includes(s)) {
    return "OUVERTE";
  }

  if (["CONVOQUEE", "CONVOQUE", "CONVOCATION", "SCHEDULED", "PLANNED"].includes(s)) {
    return "CONVOQUEE";
  }

  if (["CLOTUREE", "CLOTURE", "CLOSED", "TERMINEE", "FINALISEE", "FINALISE"].includes(s)) {
    return "CLOTUREE";
  }

  if (["ARCHIVEE", "ARCHIVE", "ARCHIVED"].includes(s)) {
    return "ARCHIVEE";
  }

  if (["ANNULEE", "ANNULE", "CANCELLED", "CANCELED"].includes(s)) {
    return "ANNULEE";
  }

  return "BROUILLON";
}

function normalizeAGDashboardItem(item: AGDashboardItem): AGDashboardItem {
  return {
    ...item,
    statut: normalizeAGStatus(item.statut),
  };
}

async function getFirstSuccessful<T>(urls: string[]): Promise<T> {
  let lastError: unknown = null;

  for (const url of urls) {
    try {
      const res = await api.get<T>(url);
      return res.data;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError ?? new Error("Aucun endpoint compatible.");
}

function getAGStatusLabel(status?: AGStatus) {
  switch (status) {
    case "BROUILLON":
      return "Brouillon";
    case "CONVOQUEE":
      return "Convoquée";
    case "OUVERTE":
      return "Ouverte";
    case "CLOTUREE":
      return "Clôturée";
    case "ARCHIVEE":
      return "Archivée";
    case "ANNULEE":
      return "Annulée";
    default:
      return "Statut inconnu";
  }
}

function getAGBadgeStyle(status?: AGStatus): CSSProperties {
  switch (status) {
    case "OUVERTE":
      return { ...badgeBase, background: "#eff6ff", color: "#1d4ed8" };
    case "CLOTUREE":
      return { ...badgeBase, background: "#ecfdf5", color: "#166534" };
    case "ARCHIVEE":
      return { ...badgeBase, background: "#f3f4f6", color: "#374151" };
    case "BROUILLON":
      return { ...badgeBase, background: "#f3f4f6", color: "#374151" };
    case "CONVOQUEE":
      return { ...badgeBase, background: "#fef3c7", color: "#92400e" };
    case "ANNULEE":
      return { ...badgeBase, background: "#fee2e2", color: "#991b1b" };
    default:
      return { ...badgeBase, background: "#f3f4f6", color: "#374151" };
  }
}

function StatCard({ title, value, subtitle, tone = "neutral" }: StatCardProps) {
  const palette = getTone(tone);

  return (
    <div
      style={{
        ...cardStyle,
        background: palette.softBg,
        border: `1px solid ${palette.border}`,
      }}
    >
      <div style={{ color: palette.text, fontSize: 13, fontWeight: 800 }}>
        {title}
      </div>

      <div style={{ ...kpiValue, color: palette.strongText }}>{value}</div>

      {subtitle ? (
        <div style={{ ...mutedText, marginTop: 8, color: palette.text }}>
          {subtitle}
        </div>
      ) : null}
    </div>
  );
}

function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div
      style={{
        ...cardStyle,
        textAlign: "center",
        padding: 28,
      }}
    >
      <div style={{ fontSize: 18, fontWeight: 900, color: "#111827" }}>
        {title}
      </div>

      {description ? (
        <div
          style={{
            ...mutedText,
            marginTop: 8,
            maxWidth: 560,
            marginInline: "auto",
            lineHeight: 1.6,
          }}
        >
          {description}
        </div>
      ) : null}

      {action ? <div style={{ marginTop: 18 }}>{action}</div> : null}
    </div>
  );
}

function SectionHeader(props: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div style={rowBetween}>
      <div>
        <h2 style={sectionTitle}>{props.title}</h2>
        {props.subtitle ? <p style={sectionSubtle}>{props.subtitle}</p> : null}
      </div>

      {props.action}
    </div>
  );
}

function QuickActionCard({ title, text, label, to, tone = "neutral" }: QuickAction) {
  const navigate = useNavigate();
  const palette = getTone(tone);

  return (
    <div
      style={{
        border: `1px solid ${palette.border}`,
        borderRadius: 18,
        padding: 16,
        background: "#ffffff",
        display: "grid",
        gap: 10,
      }}
    >
      <div style={{ fontSize: 14, fontWeight: 900, color: "#111827" }}>
        {title}
      </div>

      <div style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.5 }}>
        {text}
      </div>

      <div>
        <button
          type="button"
          style={{
            ...softButton,
            background: palette.softBg,
            color: palette.strongText,
            border: `1px solid ${palette.border}`,
          }}
          onClick={() => navigate(to)}
        >
          {label}
        </button>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();

  const [state, setState] = useState<LoadState>("loading");
  const [data, setData] = useState<DashboardData | null>(null);

  const fetchDashboard = useCallback(async (showLoading = true) => {
    if (showLoading) setState("loading");

    try {
      const [comptaRes, travauxRes, agRes, billingRes] = await Promise.allSettled([
        api.get("/api/compta/mouvements/dashboard/?series_days=30"),
        api.get("/api/travaux/dossiers/stats/"),
        getFirstSuccessful<DashboardData["ag"]>([
          "/api/ag/ags/dashboard/",
          "/api/ag/assemblees/dashboard/",
          "/api/ag/dashboard/",
        ]),
        api.get("/api/billing/dashboard/"),
      ]);

      const nextData: DashboardData = {};

      if (comptaRes.status === "fulfilled") {
        nextData.compta = comptaRes.value.data ?? {};
      }

      if (travauxRes.status === "fulfilled") {
        nextData.travaux = travauxRes.value.data ?? {};
      }

      if (agRes.status === "fulfilled") {
        const agPayload = agRes.value ?? {};

        nextData.ag = {
          ...agPayload,
          recentes: Array.isArray(agPayload.recentes)
            ? agPayload.recentes.map(normalizeAGDashboardItem)
            : [],
        };
      }

      if (billingRes.status === "fulfilled") {
        nextData.billing = billingRes.value.data ?? {};
      }

      const allFailed =
        comptaRes.status === "rejected" &&
        travauxRes.status === "rejected" &&
        agRes.status === "rejected" &&
        billingRes.status === "rejected";

      if (allFailed) {
        setData(null);
        setState("error");
        return;
      }

      setData(nextData);
      setState("success");
    } catch {
      setData(null);
      setState("error");
    }
  }, []);

  useEffect(() => {
  const timer = window.setTimeout(() => {
    void fetchDashboard(false);
  }, 0);

  return () => {
    window.clearTimeout(timer);
  };
}, [fetchDashboard]);
  const comptaTotals = useMemo(() => data?.compta?.totaux ?? {}, [data?.compta?.totaux]);
  const comptaSeries = useMemo(() => data?.compta?.series ?? [], [data?.compta?.series]);
  const mouvements = useMemo(
    () => data?.compta?.derniers_mouvements ?? [],
    [data?.compta?.derniers_mouvements],
  );
  const travauxStats = useMemo(() => data?.travaux ?? {}, [data?.travaux]);
  const agStats = useMemo(() => data?.ag ?? {}, [data?.ag]);
  const billingStats = useMemo(() => data?.billing ?? {}, [data?.billing]);

  const dashboardCards = useMemo(
    () => [
      {
        title: "Solde comptable",
        value: formatMoney(comptaTotals.solde),
        subtitle: "Solde global calculé depuis le tableau de bord comptable.",
        tone: parseNumber(comptaTotals.solde) >= 0 ? "success" : "danger",
      },
      {
        title: "Écritures non rapprochées",
        value: parseNumber(comptaTotals.nb_non_rapproches ?? 0),
        subtitle: "Lignes bancaires ou mouvements restant à vérifier.",
        tone: parseNumber(comptaTotals.nb_non_rapproches ?? 0) > 0 ? "warning" : "success",
      },
      {
        title: "Dossiers travaux",
        value: parseNumber(travauxStats.total ?? 0),
        subtitle: "Nombre de dossiers de travaux suivis dans l’application.",
        tone: "info",
      },
      {
        title: "Assemblées générales",
        value: parseNumber(agStats.total ?? 0),
        subtitle: "Assemblées préparées, ouvertes, clôturées ou archivées.",
        tone: "neutral",
      },
      {
        title: "Factures",
        value: parseNumber(billingStats.total_factures ?? 0),
        subtitle: "Factures disponibles dans le module Facturation.",
        tone: "neutral",
      },
      {
        title: "Montant impayé",
        value: formatMoney(billingStats.montant_impaye),
        subtitle: "Montant non réglé côté facturation, si le module est branché.",
        tone: parseNumber(billingStats.montant_impaye ?? 0) > 0 ? "warning" : "success",
      },
    ],
    [
      agStats.total,
      billingStats.montant_impaye,
      billingStats.total_factures,
      comptaTotals.nb_non_rapproches,
      comptaTotals.solde,
      travauxStats.total,
    ],
  );

  const seriesSummary = useMemo(() => {
    if (!comptaSeries.length) return null;

    const credits = comptaSeries.reduce((sum, item) => sum + parseNumber(item.credit), 0);
    const debits = comptaSeries.reduce((sum, item) => sum + parseNumber(item.debit), 0);
    const lastPoint = comptaSeries[comptaSeries.length - 1];

    return {
      credits,
      debits,
      cumulNet: parseNumber(lastPoint?.cumul_net),
    };
  }, [comptaSeries]);

  const quickActions: QuickAction[] = [
    {
      title: "Comptabilité",
      text: "Suivre les mouvements, les imports bancaires, les rapprochements et les indicateurs financiers.",
      label: "Ouvrir Comptabilité",
      to: "/compta",
      tone: "success",
    },
    {
      title: "Relances",
      text: "Piloter les dossiers impayés, les relances envoyées et les avis de régularisation.",
      label: "Ouvrir Relances",
      to: "/relances",
      tone: "warning",
    },
    {
      title: "Assemblées générales",
      text: "Gérer les présences, résolutions, votes, procès-verbaux et signatures.",
      label: "Ouvrir AG",
      to: "/ag",
      tone: "info",
    },
    {
      title: "Travaux",
      text: "Suivre les dossiers de travaux, budgets, validations AG et prestataires.",
      label: "Ouvrir Travaux",
      to: "/travaux",
      tone: "neutral",
    },
    {
      title: "Ressources humaines",
      text: "Consulter les employés, contrats et informations RH opérationnelles.",
      label: "Ouvrir RH",
      to: "/rh",
      tone: "info",
    },
    {
      title: "Lots",
      text: "Gérer les lots de la copropriété, base des tantièmes, présences et votes.",
      label: "Ouvrir Lots",
      to: "/lots",
      tone: "success",
    },
    {
      title: "Facturation",
      text: "Préparer les factures, l’abonnement et la future couche économique SaaS.",
      label: "Ouvrir Facturation",
      to: "/billing",
      tone: "warning",
    },
    {
      title: "Plateforme",
      text: "Accéder au back-office Super Admin pour la supervision SaaS future.",
      label: "Ouvrir Plateforme",
      to: "/platform-admin",
      tone: "neutral",
    },
  ];

  if (state === "loading") {
    return (
      <div style={pageWrap}>
        <EmptyState
          title="Chargement du tableau de bord"
          description="Récupération des indicateurs disponibles pour la copropriété active."
        />
      </div>
    );
  }

  if (state === "error") {
    return (
      <div style={pageWrap}>
        <EmptyState
          title="Chargement impossible"
          description="Aucun indicateur global n’a pu être récupéré. Vérifiez le backend, le token et la copropriété active."
          action={
            <button type="button" style={primaryButton} onClick={() => void fetchDashboard()}>
              Réessayer
            </button>
          }
        />
      </div>
    );
  }

  return (
    <div style={pageWrap}>
      <ModuleHero
        eyebrow="Vue d’ensemble produit"
        title="Pilotez votre copropriété depuis un cockpit clair, centralisé et commercialisable."
        subtitle="Retrouvez les indicateurs comptables, travaux, assemblées, facturation et les accès rapides vers les modules consolidés : RH, Lots, Facturation et Super Admin."
        actions={
          <>
            <button
              type="button"
              className="moduleButton moduleButton--heroDark"
              onClick={() => void fetchDashboard()}
            >
              Actualiser
            </button>

            <button
              type="button"
              className="moduleButton moduleButton--hero"
              onClick={() => navigate("/compta")}
            >
              Voir Comptabilité
            </button>
          </>
        }
      >
        <div className="moduleStatsGrid">
          {dashboardCards.map((item) => (
            <ModuleStatCard
              key={item.title}
              label={item.title}
              value={String(item.value ?? "—")}
              hint={item.subtitle}
              tone={toModuleStatTone(item.tone as ToneKind)}
            />
          ))}
        </div>
      </ModuleHero>

      <section>
        <div style={cardStyle}>
          <SectionHeader
            title="Accès rapides"
            subtitle="Ouvrez rapidement les modules principaux de l’application."
          />

          <div className="dashboard-quick-grid" style={quickGrid}>
            {quickActions.map((item) => (
              <QuickActionCard key={item.to} {...item} />
            ))}
          </div>
        </div>
      </section>

      <section className="dashboard-grid-large" style={sectionGridTwo}>
        <div style={cardStyle}>
          <SectionHeader
            title="Synthèse comptable"
            subtitle="Lecture consolidée des crédits, débits et solde net sur la période disponible."
            action={
              <button type="button" style={softButton} onClick={() => navigate("/compta/stats")}>
                Voir les statistiques
              </button>
            }
          />

          {!seriesSummary ? (
            <div style={{ marginTop: 16 }}>
              <EmptyState
                title="Aucune série disponible"
                description="Les indicateurs comptables seront affichés dès que les séries seront disponibles."
              />
            </div>
          ) : (
            <div style={{ ...gridCards, marginTop: 18 }}>
              <StatCard
                title="Crédits cumulés"
                value={formatMoney(seriesSummary.credits)}
                tone="success"
              />
              <StatCard
                title="Débits cumulés"
                value={formatMoney(seriesSummary.debits)}
                tone="danger"
              />
              <StatCard
                title="Net cumulé"
                value={formatMoney(seriesSummary.cumulNet)}
                tone={seriesSummary.cumulNet >= 0 ? "info" : "danger"}
              />
            </div>
          )}
        </div>

        <div style={cardStyle}>
          <SectionHeader
            title="Travaux"
            subtitle="Dossiers, validations, paiements et reste à payer."
            action={
              <button type="button" style={softButton} onClick={() => navigate("/travaux")}>
                Voir Travaux
              </button>
            }
          />

          <div style={{ ...listStyle, marginTop: 18 }}>
            <div style={{ ...listItemStyle, background: "#ecfdf5", border: "1px solid #86efac" }}>
              <span>Dossiers validés</span>
              <strong style={{ color: "#14532d" }}>{parseNumber(travauxStats.valides ?? 0)}</strong>
            </div>

            <div style={{ ...listItemStyle, background: "#eff6ff", border: "1px solid #93c5fd" }}>
              <span>Dossiers clôturés</span>
              <strong style={{ color: "#1e3a8a" }}>{parseNumber(travauxStats.clotures ?? 0)}</strong>
            </div>

            <div style={{ ...listItemStyle, background: "#ecfdf5", border: "1px solid #86efac" }}>
              <span>Total payé</span>
              <strong style={{ color: "#14532d" }}>{formatMoney(travauxStats.total_paye)}</strong>
            </div>

            <div style={{ ...listItemStyle, background: "#fffbeb", border: "1px solid #fcd34d" }}>
              <span>Reste à payer</span>
              <strong style={{ color: "#78350f" }}>{formatMoney(travauxStats.reste_a_payer)}</strong>
            </div>
          </div>
        </div>
      </section>

      <section className="dashboard-grid-equal" style={sectionGridEqual}>
        <div style={cardStyle}>
          <SectionHeader
            title="Activité comptable récente"
            subtitle="Derniers mouvements chargés depuis le module Comptabilité."
            action={
              <button type="button" style={softButton} onClick={() => navigate("/compta/mouvements")}>
                Voir les mouvements
              </button>
            }
          />

          {!mouvements.length ? (
            <div style={{ marginTop: 18 }}>
              <EmptyState
                title="Aucun mouvement récent"
                description="Les derniers mouvements apparaîtront ici après import ou saisie comptable."
              />
            </div>
          ) : (
            <div style={listStyle}>
              {mouvements.slice(0, 6).map((item) => {
                const isCredit = String(item.sens).toUpperCase() === "CREDIT";
                const isReconciled = Boolean(item.is_rapproche);

                return (
                  <div
                    key={item.id}
                    style={{
                      ...listItemStyle,
                      background: isReconciled ? "#f8fafc" : "#fffbeb",
                      border: isReconciled ? "1px solid #e2e8f0" : "1px solid #fcd34d",
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontWeight: 800,
                          color: "#111827",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {item.libelle || item.reference || `Mouvement #${item.id}`}
                      </div>

                      <div style={{ ...mutedText, marginTop: 4 }}>
                        {formatDate(item.date_operation)}
                        {isReconciled ? " • Rapproché" : " • Non rapproché"}
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span
                        style={{
                          ...badgeBase,
                          background: isReconciled ? "#ecfdf5" : "#fffbeb",
                          color: isReconciled ? "#166534" : "#92400e",
                        }}
                      >
                        {isReconciled ? "Rapproché" : "À traiter"}
                      </span>

                      <div
                        style={{
                          fontWeight: 900,
                          color: isCredit ? "#166534" : "#991b1b",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {formatMoney(item.montant)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div style={cardStyle}>
          <SectionHeader
            title="Assemblées générales"
            subtitle="Dernières assemblées disponibles et état du procès-verbal."
            action={
              <button type="button" style={softButton} onClick={() => navigate("/ag")}>
                Voir AG
              </button>
            }
          />

          {!agStats.recentes?.length ? (
            <div style={{ marginTop: 18 }}>
              <EmptyState
                title="Aucune assemblée récente"
                description="Les assemblées récentes apparaîtront ici dès que le dashboard AG sera disponible."
              />
            </div>
          ) : (
            <div style={listStyle}>
              {agStats.recentes.slice(0, 5).map((ag) => (
                <div key={ag.id} style={listItemStyle}>
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontWeight: 800,
                        color: "#111827",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {ag.reference || `AG #${ag.id}`}
                      {ag.titre ? ` — ${ag.titre}` : ""}
                    </div>

                    <div style={{ ...mutedText, marginTop: 4 }}>
                      {formatDate(ag.date_ag)} {ag.lieu ? `• ${ag.lieu}` : ""}
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={getAGBadgeStyle(ag.statut)}>{getAGStatusLabel(ag.statut)}</span>

                    {ag.pv_locked ? (
                      <span style={{ ...badgeBase, background: "#ede9fe", color: "#6d28d9" }}>
                        PV verrouillé
                      </span>
                    ) : ag.pv_signe ? (
                      <span style={{ ...badgeBase, background: "#e0f2fe", color: "#0369a1" }}>
                        PV signé
                      </span>
                    ) : ag.pv_genere ? (
                      <span style={{ ...badgeBase, background: "#fef3c7", color: "#92400e" }}>
                        PV généré
                      </span>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section>
        <div style={cardStyle}>
          <SectionHeader
            title="Facturation et vision SaaS"
            subtitle="Lecture provisoire des indicateurs de facturation, abonnement et supervision plateforme."
            action={
              <button type="button" style={softButton} onClick={() => navigate("/billing")}>
                Voir Facturation
              </button>
            }
          />

          <div style={{ ...gridCards, marginTop: 18 }}>
            <StatCard
              title="Montant facturé"
              value={formatMoney(billingStats.montant_total)}
              tone="neutral"
            />
            <StatCard
              title="Montant payé"
              value={formatMoney(billingStats.montant_paye)}
              tone="success"
            />
            <StatCard
              title="Montant impayé"
              value={formatMoney(billingStats.montant_impaye)}
              tone={parseNumber(billingStats.montant_impaye ?? 0) > 0 ? "warning" : "success"}
            />
            <StatCard
              title="Factures en retard"
              value={parseNumber(billingStats.en_retard ?? 0)}
              tone={parseNumber(billingStats.en_retard ?? 0) > 0 ? "danger" : "success"}
            />
          </div>
        </div>
      </section>

      <style>{`
        @media (max-width: 1100px) {
          .dashboard-grid-large,
          .dashboard-grid-equal {
            grid-template-columns: 1fr !important;
          }
        }

        @media (max-width: 900px) {
          .dashboard-quick-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }
        }

        @media (max-width: 680px) {
          .dashboard-quick-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}

const pageWrap: CSSProperties = {
  display: "grid",
  gap: 20,
  width: "100%",
  minWidth: 0,
  overflowX: "hidden",
};

const gridCards: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 16,
};

const quickGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
  gap: 12,
  marginTop: 18,
};

const sectionGridTwo: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1.4fr) minmax(320px, 0.9fr)",
  gap: 20,
};

const sectionGridEqual: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
  gap: 20,
};

const cardStyle: CSSProperties = {
  background: "#ffffff",
  border: "1px solid #e5e7eb",
  borderRadius: 20,
  padding: 18,
  boxShadow: "0 10px 30px rgba(15, 23, 42, 0.06)",
  minWidth: 0,
};

const sectionTitle: CSSProperties = {
  fontSize: 18,
  fontWeight: 900,
  color: "#111827",
  margin: 0,
};

const sectionSubtle: CSSProperties = {
  margin: "6px 0 0",
  color: "#6b7280",
  fontSize: 14,
  lineHeight: 1.5,
};

const rowBetween: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
};

const kpiValue: CSSProperties = {
  fontSize: 28,
  fontWeight: 900,
  marginTop: 8,
};

const mutedText: CSSProperties = {
  color: "#6b7280",
  fontSize: 14,
};

const badgeBase: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  padding: "6px 10px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 800,
};

const buttonBase: CSSProperties = {
  border: "none",
  borderRadius: 12,
  padding: "10px 14px",
  cursor: "pointer",
  fontWeight: 800,
  fontSize: 14,
};

const primaryButton: CSSProperties = {
  ...buttonBase,
  background: "#111827",
  color: "#ffffff",
};

const softButton: CSSProperties = {
  ...buttonBase,
  background: "#f3f4f6",
  color: "#111827",
};

const listStyle: CSSProperties = {
  display: "grid",
  gap: 12,
  marginTop: 16,
};

const listItemStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  padding: "14px 16px",
  borderRadius: 16,
  border: "1px solid #e5e7eb",
  background: "#ffffff",
};