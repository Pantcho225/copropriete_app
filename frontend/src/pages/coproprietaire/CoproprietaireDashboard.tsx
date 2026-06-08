import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Link } from "react-router-dom";

import { getAuthMe, type AuthMeResponse } from "../../api/auth";
import {
  getAppelsCoproprietaire,
  getDocumentsCoproprietaire,
  getMesLotsCoproprietaire,
  getPaiementsCoproprietaire,
  getRelancesCoproprietaire,
  getSituationFinanciereCoproprietaire,
  type CoproprietaireAppelsResponse,
  type CoproprietaireDernierMouvement,
  type CoproprietaireDocumentsResponse,
  type CoproprietaireMesLotsResponse,
  type CoproprietairePaiementsResponse,
  type CoproprietaireRelancesResponse,
  type CoproprietaireSituationFinanciereResponse,
} from "../../api/coproprietaire";

type DashboardState = {
  loading: boolean;
  me: AuthMeResponse | null;
  lots: CoproprietaireMesLotsResponse | null;
  appels: CoproprietaireAppelsResponse | null;
  paiements: CoproprietairePaiementsResponse | null;
  relances: CoproprietaireRelancesResponse | null;
  documents: CoproprietaireDocumentsResponse | null;
  situationFinanciere: CoproprietaireSituationFinanciereResponse | null;
  error: string | null;
  businessWarning: string | null;
};

type Tone = "blue" | "green" | "amber" | "slate" | "indigo" | "rose";

type QuickAction = {
  title: string;
  description: string;
  path: string;
  icon: string;
  tone: Tone;
};

type DashboardSummary = {
  lotsCount: number;
  appelsCount: number;
  totalDu: number;
  totalPaye: number;
  resteAPayer: number;
  paiementsCount: number;
  relancesCount: number;
  dossiersImpayeCount: number;
  nbEnRetard: number;
  documentsCount: number;
  tauxEncaissement: number;
  creditsBancaires: number;
  debitsBancaires: number;
  soldeBancaireEstime: number;
  exerciceAnnee: number | null;
};

const QUICK_ACTIONS: QuickAction[] = [
  {
    title: "Mes lots",
    description: "Consulter les lots rattachés à votre compte.",
    path: "/coproprietaire/mes-lots",
    icon: "🏢",
    tone: "blue",
  },
  {
    title: "Appels de charges",
    description: "Suivre vos appels, montants dus et échéances.",
    path: "/coproprietaire/appels",
    icon: "📄",
    tone: "amber",
  },
  {
    title: "Paiements",
    description: "Vérifier l’historique de vos règlements validés.",
    path: "/coproprietaire/paiements",
    icon: "💳",
    tone: "green",
  },
  {
    title: "Situation financière",
    description: "Voir la synthèse globale, les entrées, sorties et courbes.",
    path: "/coproprietaire/situation-financiere",
    icon: "📊",
    tone: "indigo",
  },
  {
    title: "Relances",
    description: "Voir les rappels liés à vos lots actifs.",
    path: "/coproprietaire/relances",
    icon: "🔔",
    tone: "rose",
  },
  {
    title: "Documents",
    description: "Accéder aux PV, relances PDF et documents utiles.",
    path: "/coproprietaire/documents",
    icon: "📁",
    tone: "slate",
  },
  {
    title: "Assemblées générales",
    description: "Consulter les AG, confirmer votre présence et voter.",
    path: "/coproprietaire/ag",
    icon: "🗳️",
    tone: "indigo",
  },
  {
    title: "Règlement & textes utiles",
    description: "Consulter les règles et repères utiles de la copropriété.",
    path: "/coproprietaire/reglement-textes",
    icon: "📚",
    tone: "slate",
  },
];

const initialState: DashboardState = {
  loading: true,
  me: null,
  lots: null,
  appels: null,
  paiements: null,
  relances: null,
  documents: null,
  situationFinanciere: null,
  error: null,
  businessWarning: null,
};

const parseAmount = (value: string | number | null | undefined) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value !== "string") {
    return 0;
  }

  const parsed = Number(value.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatMoney = (value: string | number | null | undefined) => {
  const amount = parseAmount(value);

  return `${new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: 0,
  }).format(Math.round(amount))} FCFA`;
};

const formatPercent = (value: string | number | null | undefined) => {
  const amount = parseAmount(value);

  return `${new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: 2,
  }).format(amount)} %`;
};

const getTimeFromDate = (value: string | null | undefined) => {
  if (!value) {
    return 0;
  }

  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
};

const formatDate = (value: string | null | undefined) => {
  const time = getTimeFromDate(value);

  if (!time) {
    return "Date non renseignée";
  }

  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(time));
};

const fulfilledValue = <T,>(result: PromiseSettledResult<T>): T | null => {
  return result.status === "fulfilled" ? result.value : null;
};

export default function CoproprietaireDashboard() {
  const [state, setState] = useState<DashboardState>(initialState);

  useEffect(() => {
    let mounted = true;

    async function load() {
      const [
        meResult,
        lotsResult,
        appelsResult,
        paiementsResult,
        relancesResult,
        documentsResult,
        situationFinanciereResult,
      ] = await Promise.allSettled([
        getAuthMe(),
        getMesLotsCoproprietaire(),
        getAppelsCoproprietaire(),
        getPaiementsCoproprietaire(),
        getRelancesCoproprietaire(),
        getDocumentsCoproprietaire(),
        getSituationFinanciereCoproprietaire(),
      ] as const);

      if (!mounted) return;

      if (meResult.status === "rejected") {
        setState({
          ...initialState,
          loading: false,
          error:
            "Impossible de charger votre espace copropriétaire. Veuillez vous reconnecter.",
        });
        return;
      }

      const businessHasError = [
        lotsResult,
        appelsResult,
        paiementsResult,
        relancesResult,
        documentsResult,
        situationFinanciereResult,
      ].some((result) => result.status === "rejected");

      setState({
        loading: false,
        me: meResult.value,
        lots: fulfilledValue(lotsResult),
        appels: fulfilledValue(appelsResult),
        paiements: fulfilledValue(paiementsResult),
        relances: fulfilledValue(relancesResult),
        documents: fulfilledValue(documentsResult),
        situationFinanciere: fulfilledValue(situationFinanciereResult),
        error: null,
        businessWarning: businessHasError
          ? "Certaines informations n’ont pas pu être chargées. Les données disponibles sont affichées."
          : null,
      });
    }

    void load();

    return () => {
      mounted = false;
    };
  }, []);

  const mainMembership = useMemo(() => {
    return (
      state.me?.memberships.find(
        (item) => item.role === "COPROPRIETAIRE" && item.is_active,
      ) ?? null
    );
  }, [state.me]);

  const summary = useMemo<DashboardSummary>(() => {
    const lotsCount = state.lots?.count ?? state.lots?.lots.length ?? 0;

    const appelsCount =
      state.appels?.stats.nb_appels ??
      state.appels?.count ??
      state.appels?.appels.length ??
      0;

    const finance = state.situationFinanciere;

    const totalDu =
      finance !== null
        ? parseAmount(finance.total_appels)
        : parseAmount(state.appels?.stats.total_du);

    const totalPayeAppels =
      finance !== null
        ? parseAmount(finance.total_encaisse)
        : parseAmount(state.appels?.stats.total_paye);

    const totalPayePaiements = parseAmount(state.paiements?.stats.total_paye);

    const resteAPayer =
      finance !== null
        ? parseAmount(finance.reste_a_recouvrer)
        : parseAmount(state.appels?.stats.reste_a_payer);

    const paiementsCount =
      state.paiements?.stats.nb_paiements ??
      state.paiements?.count ??
      state.paiements?.paiements.length ??
      0;

    const relancesCount =
      state.relances?.stats.nb_relances ??
      state.relances?.count ??
      state.relances?.relances.length ??
      0;

    const dossiersImpayeCount =
      state.relances?.stats.nb_dossiers ?? state.relances?.dossiers.length ?? 0;

    const nbEnRetard =
      state.relances?.stats.nb_en_retard ??
      state.appels?.stats.nb_en_retard ??
      0;

    const documentsCount =
      state.documents?.stats.total ??
      state.documents?.count ??
      state.documents?.documents.length ??
      0;

    const tauxEncaissement =
      finance !== null
        ? parseAmount(finance.taux_encaissement)
        : totalDu > 0
          ? (Math.max(totalPayePaiements, totalPayeAppels) / totalDu) * 100
          : 0;

    return {
      lotsCount,
      appelsCount,
      totalDu,
      totalPaye: Math.max(totalPayePaiements, totalPayeAppels),
      resteAPayer,
      paiementsCount,
      relancesCount,
      dossiersImpayeCount,
      nbEnRetard,
      documentsCount,
      tauxEncaissement,
      creditsBancaires: parseAmount(finance?.total_credits_bancaires),
      debitsBancaires: parseAmount(finance?.total_debits_bancaires),
      soldeBancaireEstime: parseAmount(finance?.solde_bancaire_estime),
      exerciceAnnee: finance?.exercice_annee ?? null,
    };
  }, [
    state.appels,
    state.documents,
    state.lots,
    state.paiements,
    state.relances,
    state.situationFinanciere,
  ]);

  const latestPaiements = useMemo(() => {
    return [...(state.paiements?.paiements ?? [])]
      .sort(
        (a, b) =>
          getTimeFromDate(b.date_paiement) - getTimeFromDate(a.date_paiement),
      )
      .slice(0, 2);
  }, [state.paiements]);

  const latestDocuments = useMemo(() => {
    return [...(state.documents?.documents ?? [])]
      .sort(
        (a, b) =>
          getTimeFromDate(b.date_document) - getTimeFromDate(a.date_document),
      )
      .slice(0, 2);
  }, [state.documents]);

  const latestRelances = useMemo(() => {
    return [...(state.relances?.relances ?? [])]
      .sort((a, b) => getTimeFromDate(b.created_at) - getTimeFromDate(a.created_at))
      .slice(0, 1);
  }, [state.relances]);

  const latestMouvements = useMemo(() => {
    return [...(state.situationFinanciere?.derniers_mouvements ?? [])].slice(0, 2);
  }, [state.situationFinanciere]);

  if (state.loading) {
    return (
      <div style={styles.loadingCard}>
        <div style={styles.loadingIcon}>⏳</div>
        <div>
          <p style={styles.loadingTitle}>Chargement de votre tableau de bord...</p>
          <p style={styles.muted}>Nous préparons vos informations personnelles.</p>
        </div>
      </div>
    );
  }

  if (state.error || !state.me) {
    return (
      <div style={styles.alertDanger}>
        <strong>Erreur de chargement</strong>
        <p style={styles.alertText}>{state.error ?? "Profil introuvable."}</p>
      </div>
    );
  }

  const fullName =
    [state.me.user.first_name, state.me.user.last_name].filter(Boolean).join(" ") ||
    state.me.user.username;

  const coproName =
    mainMembership?.copropriete.nom ??
    state.lots?.lots[0]?.copropriete?.nom ??
    state.situationFinanciere?.copropriete_label ??
    "Copropriété non définie";

  const membershipStatus = mainMembership?.is_active ? "Actif" : "À vérifier";

  const situationLabel = summary.resteAPayer > 0 ? "À régulariser" : "À jour";

  const situationTone: Tone = summary.resteAPayer > 0 ? "amber" : "green";
  const soldeTone: Tone = summary.soldeBancaireEstime < 0 ? "rose" : "green";

  return (
    <div style={styles.stack}>
      {state.businessWarning && (
        <div style={styles.alertWarning}>
          <strong>Chargement partiel</strong>
          <p style={styles.alertText}>{state.businessWarning}</p>
        </div>
      )}

      <section style={styles.hero}>
        <div style={styles.heroContent}>
          <div style={styles.heroBadge}>Espace copropriétaire</div>

          <h2 style={styles.heroTitle}>Bonjour {fullName}</h2>

          <p style={styles.heroText}>
            Retrouvez vos informations essentielles : lots, appels de charges,
            paiements, situation financière, relances, documents, assemblées
            générales, présence, votes et règles utiles de la copropriété.
          </p>

          <div style={styles.heroMeta}>
            <span style={styles.metaPill}>Copropriété : {coproName}</span>
            <span style={styles.metaPill}>Profil : Copropriétaire</span>
            <span style={styles.metaPill}>Compte : {membershipStatus}</span>
            <span style={styles.metaPill}>Situation : {situationLabel}</span>
            {summary.exerciceAnnee ? (
              <span style={styles.metaPill}>Exercice : {summary.exerciceAnnee}</span>
            ) : null}
          </div>
        </div>

        <div style={styles.secureBox}>
          <div style={styles.secureIcon}>🔐</div>
          <p style={styles.secureTitle}>Accès sécurisé</p>
          <p style={styles.secureText}>
            Vos données sont filtrées automatiquement selon votre compte, vos lots
            et vos droits copropriétaires.
          </p>
        </div>
      </section>

      <section style={styles.statsGrid}>
        <InfoCard
          label="Lots"
          value={String(summary.lotsCount)}
          description="Lots actifs rattachés à votre compte"
          tone="blue"
        />
        <InfoCard
          label="Reste à payer"
          value={formatMoney(summary.resteAPayer)}
          description={`${summary.nbEnRetard} élément(s) en retard détecté(s)`}
          tone={situationTone}
        />
        <InfoCard
          label="Total encaissé"
          value={formatMoney(summary.totalPaye)}
          description={`${summary.paiementsCount} paiement(s) enregistré(s)`}
          tone="green"
        />
        <InfoCard
          label="Solde estimé"
          value={formatMoney(summary.soldeBancaireEstime)}
          description="Solde global visible de la copropriété"
          tone={soldeTone}
        />
      </section>

      <section style={styles.financialStrip}>
        <div style={styles.financialStripLeft}>
          <div style={styles.financialIcon}>📊</div>

          <div>
            <p style={styles.financialEyebrow}>Transparence financière</p>
            <h3 style={styles.financialTitle}>
              Situation globale de la copropriété
            </h3>
            <p style={styles.financialText}>
              Consultez les appels, encaissements, crédits, débits, solde estimé
              et courbes mensuelles en lecture seule.
            </p>
          </div>
        </div>

        <div style={styles.financialMetrics}>
          <MiniMetric label="Taux" value={formatPercent(summary.tauxEncaissement)} />
          <MiniMetric label="Crédits" value={formatMoney(summary.creditsBancaires)} />
          <MiniMetric label="Débits" value={formatMoney(summary.debitsBancaires)} />
        </div>

        <Link to="/coproprietaire/situation-financiere" style={styles.primaryLink}>
          Voir la situation →
        </Link>
      </section>

      <section style={styles.mainGrid}>
        <div style={styles.card}>
          <div style={styles.sectionHeader}>
            <div>
              <p style={styles.sectionEyebrow}>Accès rapide</p>
              <h3 style={styles.sectionTitle}>Vos démarches courantes</h3>
            </div>

            <span style={styles.sectionPill}>
              {QUICK_ACTIONS.length} modules disponibles
            </span>
          </div>

          <div style={styles.summaryGrid}>
            <SummaryCard
              label="Appels"
              value={String(summary.appelsCount)}
              description={`Total appelé : ${formatMoney(summary.totalDu)}`}
              tone="amber"
            />
            <SummaryCard
              label="Encaissement"
              value={formatPercent(summary.tauxEncaissement)}
              description={`${formatMoney(summary.totalPaye)} encaissé`}
              tone="green"
            />
            <SummaryCard
              label="Situation"
              value={situationLabel}
              description={
                summary.resteAPayer > 0
                  ? `${formatMoney(summary.resteAPayer)} restant à payer`
                  : "Aucun reste à payer détecté"
              }
              tone={situationTone}
            />
          </div>

          <div style={styles.actionsGrid}>
            {QUICK_ACTIONS.map((action) => (
              <ActionCard key={action.path} action={action} />
            ))}
          </div>

          <div style={styles.activityBlock}>
            <div>
              <p style={styles.sectionEyebrow}>Activité récente</p>
              <h3 style={styles.sectionTitle}>Dernières informations visibles</h3>
            </div>

            <div style={styles.activityGrid}>
              <div style={styles.activityList}>
                <p style={styles.activityGroupTitle}>Paiements</p>
                {latestPaiements.length === 0 ? (
                  <p style={styles.emptyText}>Aucun paiement récent.</p>
                ) : (
                  latestPaiements.map((paiement) => (
                    <ActivityItem
                      key={paiement.id}
                      title={paiement.appel_libelle || "Paiement"}
                      meta={`${formatMoney(paiement.montant)} · ${formatDate(
                        paiement.date_paiement,
                      )}`}
                      tone="green"
                    />
                  ))
                )}
              </div>

              <div style={styles.activityList}>
                <p style={styles.activityGroupTitle}>Mouvements</p>
                {latestMouvements.length === 0 ? (
                  <p style={styles.emptyText}>Aucun mouvement récent.</p>
                ) : (
                  latestMouvements.map((mouvement) => (
                    <MouvementActivityItem
                      key={mouvement.id}
                      mouvement={mouvement}
                    />
                  ))
                )}
              </div>

              <div style={styles.activityList}>
                <p style={styles.activityGroupTitle}>Documents</p>
                {latestDocuments.length === 0 ? (
                  <p style={styles.emptyText}>Aucun document récent.</p>
                ) : (
                  latestDocuments.map((document) => (
                    <ActivityItem
                      key={document.id}
                      title={document.titre || document.filename || "Document"}
                      meta={`${document.categorie || "Document"} · ${formatDate(
                        document.date_document,
                      )}`}
                      tone="blue"
                    />
                  ))
                )}
              </div>

              <div style={styles.activityList}>
                <p style={styles.activityGroupTitle}>Relances</p>
                {latestRelances.length === 0 ? (
                  <p style={styles.emptyText}>Aucune relance active.</p>
                ) : (
                  latestRelances.map((relance) => (
                    <ActivityItem
                      key={relance.id}
                      title={relance.objet || relance.appel_libelle || "Relance"}
                      meta={`${relance.statut_label || relance.statut} · ${formatDate(
                        relance.created_at,
                      )}`}
                      tone="rose"
                    />
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        <aside style={styles.sidePanel}>
          <div style={styles.card}>
            <p style={styles.sectionEyebrow}>État de l’espace</p>
            <h3 style={styles.sectionTitle}>Portail copropriétaire opérationnel</h3>

            <p style={styles.paragraph}>
              Votre espace personnel est séparé de l’espace administrateur. Vous
              consultez uniquement les informations liées à vos lots et à votre
              profil copropriétaire.
            </p>

            <div style={styles.statusList}>
              <StatusLine label="Authentification" status="Validé" tone="green" />
              <StatusLine
                label="Récupération d’accès"
                status="Disponible"
                tone="green"
              />
              <StatusLine
                label="Mes lots"
                status={`${summary.lotsCount} lot(s)`}
                tone={summary.lotsCount > 0 ? "green" : "amber"}
              />
              <StatusLine
                label="Appels de charges"
                status={`${summary.appelsCount} appel(s)`}
                tone={summary.nbEnRetard > 0 ? "amber" : "green"}
              />
              <StatusLine
                label="Paiements"
                status={`${summary.paiementsCount} paiement(s)`}
                tone="green"
              />
              <StatusLine
                label="Situation financière"
                status={formatPercent(summary.tauxEncaissement)}
                tone={summary.tauxEncaissement >= 100 ? "green" : "amber"}
              />
              <StatusLine
                label="Relances"
                status={`${summary.relancesCount} relance(s)`}
                tone={summary.relancesCount > 0 ? "rose" : "green"}
              />
              <StatusLine
                label="Documents"
                status={`${summary.documentsCount} document(s)`}
                tone="green"
              />
              <StatusLine
                label="Assemblées générales"
                status="Disponible"
                tone="green"
              />
              <StatusLine
                label="Règlement & textes"
                status="Lecture seule"
                tone="blue"
              />
            </div>
          </div>

          <div style={styles.noteCard}>
            <p style={styles.noteTitle}>Conseil</p>
            <p style={styles.noteText}>
              Pensez à consulter régulièrement vos appels, paiements, situation
              financière, relances, documents, assemblées générales et règles
              utiles afin de garder votre situation à jour.
            </p>
          </div>
        </aside>
      </section>
    </div>
  );
}

function InfoCard({
  label,
  value,
  description,
  tone,
}: {
  label: string;
  value: string;
  description: string;
  tone: Tone;
}) {
  const toneStyle = tones[tone];

  return (
    <div
      style={{
        ...styles.infoCard,
        borderColor: toneStyle.border,
        background: toneStyle.softBackground,
      }}
    >
      <p style={styles.infoLabel}>{label}</p>
      <p style={{ ...styles.infoValue, color: toneStyle.color }}>{value}</p>
      <p style={styles.infoDescription}>{description}</p>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  description,
  tone,
}: {
  label: string;
  value: string;
  description: string;
  tone: Tone;
}) {
  const toneStyle = tones[tone];

  return (
    <div
      style={{
        ...styles.summaryCard,
        borderColor: toneStyle.border,
        background: toneStyle.softBackground,
      }}
    >
      <p style={styles.summaryLabel}>{label}</p>
      <strong style={{ ...styles.summaryValue, color: toneStyle.color }}>
        {value}
      </strong>
      <span style={styles.summaryDescription}>{description}</span>
    </div>
  );
}

function ActionCard({ action }: { action: QuickAction }) {
  const toneStyle = tones[action.tone];

  return (
    <Link
      to={action.path}
      style={{
        ...styles.actionCard,
        borderColor: toneStyle.border,
        background: toneStyle.softBackground,
      }}
    >
      <span
        style={{
          ...styles.actionIcon,
          background: toneStyle.iconBackground,
        }}
      >
        {action.icon}
      </span>

      <span style={styles.actionContent}>
        <span style={styles.actionTitle}>{action.title}</span>
        <span style={styles.actionText}>{action.description}</span>
      </span>

      <span style={{ ...styles.actionArrow, color: toneStyle.color }}>→</span>
    </Link>
  );
}

function StatusLine({
  label,
  status,
  tone,
}: {
  label: string;
  status: string;
  tone: Tone;
}) {
  const toneStyle = tones[tone];

  return (
    <div style={styles.statusLine}>
      <span style={styles.statusLabel}>{label}</span>
      <strong
        style={{
          ...styles.statusBadge,
          background: toneStyle.softBackground,
          color: toneStyle.color,
          borderColor: toneStyle.border,
        }}
      >
        {status}
      </strong>
    </div>
  );
}

function ActivityItem({
  title,
  meta,
  tone,
}: {
  title: string;
  meta: string;
  tone: Tone;
}) {
  const toneStyle = tones[tone];

  return (
    <div style={styles.activityItem}>
      <span
        style={{
          ...styles.activityDot,
          background: toneStyle.iconBackground,
          color: toneStyle.color,
        }}
      >
        •
      </span>
      <span>
        <strong style={styles.activityTitle}>{title}</strong>
        <span style={styles.activityMeta}>{meta}</span>
      </span>
    </div>
  );
}

function MouvementActivityItem({
  mouvement,
}: {
  mouvement: CoproprietaireDernierMouvement;
}) {
  const isCredit = mouvement.sens === "CREDIT";
  const tone: Tone = mouvement.cancelled ? "slate" : isCredit ? "green" : "rose";

  return (
    <ActivityItem
      title={mouvement.libelle || "Mouvement bancaire"}
      meta={`${isCredit ? "+" : "-"}${formatMoney(mouvement.montant)} · ${formatDate(
        mouvement.date_operation,
      )}`}
      tone={tone}
    />
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div style={styles.miniMetric}>
      <span style={styles.miniMetricLabel}>{label}</span>
      <strong style={styles.miniMetricValue}>{value}</strong>
    </div>
  );
}

const tones: Record<
  Tone,
  {
    color: string;
    border: string;
    softBackground: string;
    iconBackground: string;
  }
> = {
  blue: {
    color: "#2563eb",
    border: "#bfdbfe",
    softBackground: "#eff6ff",
    iconBackground: "#dbeafe",
  },
  green: {
    color: "#059669",
    border: "#bbf7d0",
    softBackground: "#ecfdf5",
    iconBackground: "#d1fae5",
  },
  amber: {
    color: "#d97706",
    border: "#fde68a",
    softBackground: "#fffbeb",
    iconBackground: "#fef3c7",
  },
  slate: {
    color: "#475569",
    border: "#e2e8f0",
    softBackground: "#f8fafc",
    iconBackground: "#e2e8f0",
  },
  indigo: {
    color: "#4f46e5",
    border: "#c7d2fe",
    softBackground: "#eef2ff",
    iconBackground: "#e0e7ff",
  },
  rose: {
    color: "#be123c",
    border: "#fecdd3",
    softBackground: "#fff1f2",
    iconBackground: "#ffe4e6",
  },
};

const styles: Record<string, CSSProperties> = {
  stack: {
    display: "flex",
    flexDirection: "column",
    gap: 22,
  },

  hero: {
    borderRadius: 34,
    padding: 30,
    background:
      "linear-gradient(135deg, rgba(30,64,175,0.97), rgba(79,70,229,0.93)), radial-gradient(circle at top right, rgba(56,189,248,0.46), transparent 36%)",
    color: "white",
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) 320px",
    gap: 24,
    boxShadow: "0 30px 85px rgba(30,64,175,0.28)",
    overflow: "hidden",
  },

  heroContent: {
    minWidth: 0,
  },

  heroBadge: {
    display: "inline-flex",
    alignItems: "center",
    borderRadius: 999,
    padding: "7px 11px",
    background: "rgba(255,255,255,0.13)",
    border: "1px solid rgba(255,255,255,0.18)",
    color: "#dbeafe",
    fontSize: 11,
    fontWeight: 950,
    letterSpacing: "0.14em",
    textTransform: "uppercase",
  },

  heroTitle: {
    margin: "14px 0 0",
    fontSize: 36,
    lineHeight: 1.08,
    fontWeight: 950,
    letterSpacing: "-0.04em",
  },

  heroText: {
    margin: "14px 0 0",
    maxWidth: 760,
    color: "#dbeafe",
    fontSize: 15,
    lineHeight: 1.75,
    fontWeight: 550,
  },

  heroMeta: {
    display: "flex",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 22,
  },

  metaPill: {
    borderRadius: 999,
    padding: "8px 12px",
    background: "rgba(255,255,255,0.14)",
    border: "1px solid rgba(255,255,255,0.20)",
    color: "#ffffff",
    fontSize: 12,
    fontWeight: 850,
  },

  secureBox: {
    alignSelf: "stretch",
    borderRadius: 28,
    padding: 22,
    background: "rgba(255,255,255,0.13)",
    border: "1px solid rgba(255,255,255,0.22)",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.10)",
  },

  secureIcon: {
    width: 48,
    height: 48,
    borderRadius: 18,
    background: "rgba(255,255,255,0.14)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 22,
    marginBottom: 14,
  },

  secureTitle: {
    margin: 0,
    fontSize: 18,
    fontWeight: 950,
  },

  secureText: {
    margin: "10px 0 0",
    color: "#dbeafe",
    fontSize: 14,
    lineHeight: 1.6,
  },

  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: 16,
  },

  infoCard: {
    border: "1px solid",
    borderRadius: 26,
    padding: 19,
    boxShadow: "0 16px 44px rgba(15,23,42,0.06)",
    minHeight: 134,
  },

  infoLabel: {
    margin: 0,
    color: "#64748b",
    fontSize: 11,
    fontWeight: 950,
    letterSpacing: "0.14em",
    textTransform: "uppercase",
  },

  infoValue: {
    margin: "12px 0 0",
    fontSize: 22,
    lineHeight: 1.2,
    fontWeight: 950,
    wordBreak: "break-word",
  },

  infoDescription: {
    margin: "8px 0 0",
    color: "#64748b",
    fontSize: 12,
    lineHeight: 1.55,
    fontWeight: 650,
  },

  financialStrip: {
    borderRadius: 30,
    padding: 20,
    background:
      "linear-gradient(135deg, rgba(238,242,255,0.96), rgba(239,246,255,0.94))",
    border: "1px solid #c7d2fe",
    boxShadow: "0 18px 54px rgba(79,70,229,0.10)",
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) auto auto",
    alignItems: "center",
    gap: 18,
  },

  financialStripLeft: {
    display: "flex",
    gap: 14,
    alignItems: "flex-start",
    minWidth: 0,
  },

  financialIcon: {
    width: 46,
    height: 46,
    borderRadius: 18,
    background: "#e0e7ff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 21,
    flexShrink: 0,
  },

  financialEyebrow: {
    margin: 0,
    fontSize: 10,
    fontWeight: 950,
    color: "#4f46e5",
    letterSpacing: "0.15em",
    textTransform: "uppercase",
  },

  financialTitle: {
    margin: "5px 0 0",
    fontSize: 18,
    lineHeight: 1.2,
    fontWeight: 950,
    color: "#0f172a",
    letterSpacing: "-0.03em",
  },

  financialText: {
    margin: "7px 0 0",
    fontSize: 13,
    lineHeight: 1.55,
    color: "#475569",
    fontWeight: 650,
  },

  financialMetrics: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    justifyContent: "flex-end",
  },

  miniMetric: {
    borderRadius: 18,
    padding: "10px 12px",
    background: "rgba(255,255,255,0.82)",
    border: "1px solid #dbeafe",
    minWidth: 108,
  },

  miniMetricLabel: {
    display: "block",
    fontSize: 10,
    fontWeight: 900,
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },

  miniMetricValue: {
    display: "block",
    marginTop: 5,
    fontSize: 13,
    fontWeight: 950,
    color: "#1e293b",
  },

  primaryLink: {
    justifySelf: "end",
    textDecoration: "none",
    borderRadius: 18,
    padding: "12px 14px",
    background: "#4f46e5",
    color: "white",
    fontSize: 13,
    fontWeight: 950,
    boxShadow: "0 14px 36px rgba(79,70,229,0.24)",
    whiteSpace: "nowrap",
  },

  mainGrid: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1.35fr) minmax(340px, 0.65fr)",
    gap: 18,
    alignItems: "start",
  },

  card: {
    borderRadius: 30,
    background: "rgba(255,255,255,0.90)",
    border: "1px solid rgba(226,232,240,0.95)",
    boxShadow: "0 20px 64px rgba(15,23,42,0.08)",
    padding: 23,
  },

  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 16,
    alignItems: "flex-start",
  },

  sectionEyebrow: {
    margin: 0,
    fontSize: 11,
    fontWeight: 950,
    color: "#2563eb",
    letterSpacing: "0.14em",
    textTransform: "uppercase",
  },

  sectionTitle: {
    margin: "7px 0 0",
    fontSize: 20,
    lineHeight: 1.2,
    fontWeight: 950,
    color: "#0f172a",
    letterSpacing: "-0.02em",
  },

  sectionPill: {
    flexShrink: 0,
    borderRadius: 999,
    padding: "8px 11px",
    background: "#eef2ff",
    border: "1px solid #c7d2fe",
    color: "#4f46e5",
    fontSize: 12,
    fontWeight: 900,
  },

  summaryGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 12,
    marginTop: 20,
  },

  summaryCard: {
    border: "1px solid",
    borderRadius: 22,
    padding: 15,
  },

  summaryLabel: {
    margin: 0,
    color: "#64748b",
    fontSize: 11,
    fontWeight: 950,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
  },

  summaryValue: {
    display: "block",
    marginTop: 8,
    fontSize: 19,
    lineHeight: 1.15,
    fontWeight: 950,
  },

  summaryDescription: {
    display: "block",
    marginTop: 7,
    color: "#64748b",
    fontSize: 12,
    lineHeight: 1.45,
    fontWeight: 650,
  },

  actionsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 14,
    marginTop: 20,
  },

  actionCard: {
    borderRadius: 24,
    border: "1px solid",
    padding: 16,
    display: "flex",
    alignItems: "center",
    gap: 13,
    textDecoration: "none",
    color: "#0f172a",
    minHeight: 104,
    boxShadow: "0 14px 34px rgba(15,23,42,0.04)",
  },

  actionIcon: {
    width: 44,
    height: 44,
    borderRadius: 17,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 20,
    flexShrink: 0,
  },

  actionContent: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    minWidth: 0,
  },

  actionTitle: {
    fontSize: 14,
    fontWeight: 950,
    color: "#0f172a",
  },

  actionText: {
    color: "#64748b",
    fontSize: 12,
    lineHeight: 1.45,
    fontWeight: 650,
  },

  actionArrow: {
    marginLeft: "auto",
    fontSize: 20,
    fontWeight: 950,
    flexShrink: 0,
  },

  activityBlock: {
    marginTop: 22,
    borderTop: "1px solid #e2e8f0",
    paddingTop: 20,
  },

  activityGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: 12,
    marginTop: 16,
  },

  activityList: {
    borderRadius: 22,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    padding: 14,
    minHeight: 126,
  },

  activityGroupTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: 13,
    fontWeight: 950,
  },

  activityItem: {
    display: "flex",
    gap: 9,
    marginTop: 12,
    alignItems: "flex-start",
  },

  activityDot: {
    width: 22,
    height: 22,
    borderRadius: 999,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 20,
    lineHeight: 1,
    flexShrink: 0,
  },

  activityTitle: {
    display: "block",
    color: "#0f172a",
    fontSize: 12.5,
    lineHeight: 1.35,
    fontWeight: 900,
  },

  activityMeta: {
    display: "block",
    marginTop: 3,
    color: "#64748b",
    fontSize: 11.5,
    lineHeight: 1.35,
    fontWeight: 650,
  },

  emptyText: {
    margin: "12px 0 0",
    color: "#64748b",
    fontSize: 12,
    lineHeight: 1.5,
    fontWeight: 650,
  },

  sidePanel: {
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },

  paragraph: {
    margin: "14px 0 0",
    fontSize: 14,
    lineHeight: 1.7,
    color: "#64748b",
    fontWeight: 600,
  },

  statusList: {
    marginTop: 18,
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },

  statusLine: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    borderRadius: 18,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    padding: "11px 12px",
    fontSize: 13,
    color: "#475569",
  },

  statusLabel: {
    fontWeight: 750,
  },

  statusBadge: {
    borderRadius: 999,
    border: "1px solid",
    padding: "5px 9px",
    fontSize: 11,
    fontWeight: 950,
    whiteSpace: "nowrap",
  },

  noteCard: {
    borderRadius: 28,
    padding: 20,
    background:
      "linear-gradient(135deg, rgba(15,23,42,0.94), rgba(30,41,59,0.92))",
    color: "white",
    boxShadow: "0 20px 60px rgba(15,23,42,0.16)",
  },

  noteTitle: {
    margin: 0,
    fontSize: 15,
    fontWeight: 950,
  },

  noteText: {
    margin: "9px 0 0",
    fontSize: 13,
    lineHeight: 1.65,
    color: "#cbd5e1",
    fontWeight: 600,
  },

  alertDanger: {
    borderRadius: 26,
    background: "#fff1f2",
    border: "1px solid #fecdd3",
    color: "#be123c",
    padding: 22,
    boxShadow: "0 18px 44px rgba(190,18,60,0.08)",
  },

  alertWarning: {
    borderRadius: 24,
    background: "#fffbeb",
    border: "1px solid #fde68a",
    color: "#92400e",
    padding: 18,
    boxShadow: "0 16px 44px rgba(217,119,6,0.08)",
  },

  alertText: {
    margin: "8px 0 0",
    fontSize: 14,
    lineHeight: 1.6,
  },

  loadingCard: {
    borderRadius: 28,
    background: "rgba(255,255,255,0.92)",
    border: "1px solid rgba(226,232,240,0.95)",
    boxShadow: "0 18px 60px rgba(15,23,42,0.08)",
    padding: 24,
    display: "flex",
    alignItems: "center",
    gap: 14,
  },

  loadingIcon: {
    width: 46,
    height: 46,
    borderRadius: 18,
    background: "#eef2ff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 20,
    flexShrink: 0,
  },

  loadingTitle: {
    margin: 0,
    fontSize: 16,
    fontWeight: 950,
    color: "#0f172a",
  },

  muted: {
    margin: "8px 0 0",
    fontSize: 13,
    color: "#64748b",
    fontWeight: 600,
  },
};