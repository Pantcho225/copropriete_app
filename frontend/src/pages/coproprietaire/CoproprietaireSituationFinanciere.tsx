import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";

import {
  getSituationFinanciereCoproprietaire,
  type CoproprietaireDernierMouvement,
  type CoproprietaireSituationFinanciereResponse,
  type CoproprietaireSituationMensuelle,
} from "../../api/coproprietaire";

function parseAmount(value: string | number | null | undefined): number {
  if (value === null || value === undefined || value === "") {
    return 0;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : 0;
}

function formatCurrency(value: string | number | null | undefined): string {
  const amount = parseAmount(value);

  return `${amount.toLocaleString("fr-FR", {
    maximumFractionDigits: 0,
  })} FCFA`;
}

function formatPercent(value: string | number | null | undefined): string {
  const amount = parseAmount(value);

  return `${amount.toLocaleString("fr-FR", {
    maximumFractionDigits: 2,
  })} %`;
}

function formatDate(value: string | null | undefined): string {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function getMovementTone(mouvement: CoproprietaireDernierMouvement) {
  if (mouvement.cancelled) {
    return {
      label: "Annulé métier",
      style: styles.badgeMuted,
    };
  }

  if (mouvement.sens === "CREDIT") {
    return {
      label: "Entrée",
      style: styles.badgeSuccess,
    };
  }

  return {
    label: "Sortie",
    style: styles.badgeDanger,
  };
}

function getMaxMonthlyValue(items: CoproprietaireSituationMensuelle[]): number {
  const values = items.flatMap((item) => [
    parseAmount(item.total_appels),
    parseAmount(item.total_paye),
    parseAmount(item.credits),
    parseAmount(item.debits),
  ]);

  return Math.max(...values, 1);
}

function getBarWidth(value: string | number, max: number): string {
  const amount = parseAmount(value);

  if (max <= 0) {
    return "0%";
  }

  return `${Math.min(100, Math.round((amount / max) * 100))}%`;
}

function StatCard(props: {
  label: string;
  value: string;
  helper: string;
  icon: string;
  tone?: "neutral" | "success" | "danger" | "warning";
}) {
  const toneStyle =
    props.tone === "success"
      ? styles.statIconSuccess
      : props.tone === "danger"
        ? styles.statIconDanger
        : props.tone === "warning"
          ? styles.statIconWarning
          : styles.statIconNeutral;

  return (
    <article style={styles.statCard}>
      <div style={styles.statTop}>
        <span style={{ ...styles.statIcon, ...toneStyle }}>{props.icon}</span>
      </div>

      <p style={styles.statLabel}>{props.label}</p>
      <p style={styles.statValue}>{props.value}</p>
      <p style={styles.statHelper}>{props.helper}</p>
    </article>
  );
}

function MonthlyChart(props: { data: CoproprietaireSituationMensuelle[] }) {
  const max = useMemo(() => getMaxMonthlyValue(props.data), [props.data]);

  if (props.data.length === 0) {
    return (
      <div style={styles.emptyBox}>
        Aucune donnée mensuelle disponible pour l’exercice sélectionné.
      </div>
    );
  }

  return (
    <div style={styles.chartList}>
      {props.data.map((item) => (
        <div key={item.mois} style={styles.monthRow}>
          <div style={styles.monthLabel}>
            <span style={styles.monthName}>{item.mois_label}</span>
            <span style={styles.monthSolde}>
              Solde mensuel : {formatCurrency(item.solde_mensuel)}
            </span>
          </div>

          <div style={styles.barsBlock}>
            <BarLine
              label="Appelé"
              value={item.total_appels}
              width={getBarWidth(item.total_appels, max)}
              color="#2563eb"
            />
            <BarLine
              label="Payé"
              value={item.total_paye}
              width={getBarWidth(item.total_paye, max)}
              color="#16a34a"
            />
            <BarLine
              label="Crédits"
              value={item.credits}
              width={getBarWidth(item.credits, max)}
              color="#0891b2"
            />
            <BarLine
              label="Débits"
              value={item.debits}
              width={getBarWidth(item.debits, max)}
              color="#dc2626"
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function BarLine(props: {
  label: string;
  value: string;
  width: string;
  color: string;
}) {
  return (
    <div style={styles.barLine}>
      <span style={styles.barLabel}>{props.label}</span>

      <div style={styles.barTrack}>
        <span
          style={{
            ...styles.barFill,
            width: props.width,
            background: props.color,
          }}
        />
      </div>

      <span style={styles.barValue}>{formatCurrency(props.value)}</span>
    </div>
  );
}

function DerniersMouvements(props: {
  mouvements: CoproprietaireDernierMouvement[];
}) {
  if (props.mouvements.length === 0) {
    return (
      <div style={styles.emptyBox}>
        Aucun mouvement bancaire visible pour cette période.
      </div>
    );
  }

  return (
    <div style={styles.movementList}>
      {props.mouvements.map((mouvement) => {
        const tone = getMovementTone(mouvement);

        return (
          <article key={mouvement.id} style={styles.movementCard}>
            <div style={styles.movementLeft}>
              <div style={styles.movementIcon}>
                {mouvement.sens === "CREDIT" ? "↗" : "↘"}
              </div>

              <div>
                <p style={styles.movementTitle}>{mouvement.libelle}</p>

                <p style={styles.movementMeta}>
                  {formatDate(mouvement.date_operation)}
                  {mouvement.reference ? ` · ${mouvement.reference}` : ""}
                  {mouvement.compte_label ? ` · ${mouvement.compte_label}` : ""}
                </p>

                <div style={styles.movementBadges}>
                  <span style={{ ...styles.badge, ...tone.style }}>
                    {tone.label}
                  </span>

                  {mouvement.rapproche ? (
                    <span style={{ ...styles.badge, ...styles.badgeInfo }}>
                      Rapproché
                    </span>
                  ) : null}
                </div>
              </div>
            </div>

            <div style={styles.movementAmountBlock}>
              <p
                style={{
                  ...styles.movementAmount,
                  color:
                    mouvement.sens === "CREDIT"
                      ? "#047857"
                      : mouvement.cancelled
                        ? "#64748b"
                        : "#be123c",
                }}
              >
                {mouvement.sens === "CREDIT" ? "+" : "-"}
                {formatCurrency(mouvement.montant)}
              </p>

              <p style={styles.movementType}>{mouvement.sens_label}</p>
            </div>
          </article>
        );
      })}
    </div>
  );
}

export default function CoproprietaireSituationFinanciere() {
  const [data, setData] =
    useState<CoproprietaireSituationFinanciereResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadSituation() {
    try {
      setLoading(true);
      setError("");

      const result = await getSituationFinanciereCoproprietaire();

      setData(result);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Impossible de charger la situation financière.";

      setError(message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadSituation();
  }, []);

  const courbeMensuelle = data?.courbe_mensuelle ?? [];
  const solde = parseAmount(data?.solde_bancaire_estime);
  const reste = parseAmount(data?.reste_a_recouvrer);

  if (loading) {
    return (
      <section style={styles.page}>
        <div style={styles.loadingCard}>
          <span style={styles.loadingIcon}>📊</span>
          <p style={styles.loadingTitle}>Chargement de la situation financière…</p>
          <p style={styles.loadingText}>
            Les données de transparence de votre copropriété sont en cours de
            préparation.
          </p>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section style={styles.page}>
        <div style={styles.errorCard}>
          <p style={styles.errorTitle}>Situation financière indisponible</p>
          <p style={styles.errorText}>{error}</p>

          <button type="button" onClick={loadSituation} style={styles.retryButton}>
            Réessayer
          </button>
        </div>
      </section>
    );
  }

  if (!data) {
    return (
      <section style={styles.page}>
        <div style={styles.emptyBox}>Aucune situation financière disponible.</div>
      </section>
    );
  }

  return (
    <section style={styles.page}>
      <div style={styles.hero}>
        <div style={styles.heroContent}>
          <p style={styles.heroEyebrow}>Transparence financière</p>

          <h2 style={styles.heroTitle}>
            Situation financière de {data.copropriete_label}
          </h2>

          <p style={styles.heroText}>
            Consultez une synthèse globale en lecture seule : appels de charges,
            encaissements, reste à recouvrer, mouvements bancaires et évolution
            mensuelle.
          </p>

          <div style={styles.heroMeta}>
            <span style={styles.metaPill}>
              Exercice {data.exercice_annee ?? "—"}
            </span>
            <span style={styles.metaPill}>
              {formatDate(data.periode_debut)} → {formatDate(data.periode_fin)}
            </span>
          </div>
        </div>

        <div style={styles.heroScore}>
          <p style={styles.heroScoreLabel}>Taux d’encaissement</p>
          <p style={styles.heroScoreValue}>
            {formatPercent(data.taux_encaissement)}
          </p>
          <p style={styles.heroScoreText}>
            {data.nb_lignes_payees} ligne(s) payée(s) sur {data.nb_lignes_appel}
          </p>
        </div>
      </div>

      <div style={styles.statsGrid}>
        <StatCard
          icon="📄"
          label="Total appelé"
          value={formatCurrency(data.total_appels)}
          helper={`${data.nb_appels} appel(s) de fonds`}
        />

        <StatCard
          icon="✅"
          label="Total encaissé"
          value={formatCurrency(data.total_encaisse)}
          helper="Paiements enregistrés sur les appels"
          tone="success"
        />

        <StatCard
          icon="⏳"
          label="Reste à recouvrer"
          value={formatCurrency(data.reste_a_recouvrer)}
          helper={
            reste > 0
              ? `${data.nb_lignes_impayees + data.nb_lignes_partielles} ligne(s) à suivre`
              : "Aucun reste à recouvrer sur la période"
          }
          tone={reste > 0 ? "warning" : "success"}
        />

        <StatCard
          icon="🏦"
          label="Solde bancaire estimé"
          value={formatCurrency(data.solde_bancaire_estime)}
          helper="Solde initial + crédits - débits"
          tone={solde < 0 ? "danger" : "success"}
        />

        <StatCard
          icon="↗"
          label="Crédits bancaires"
          value={formatCurrency(data.total_credits_bancaires)}
          helper="Entrées visibles en comptabilité"
          tone="success"
        />

        <StatCard
          icon="↘"
          label="Débits bancaires"
          value={formatCurrency(data.total_debits_bancaires)}
          helper="Sorties visibles en comptabilité"
          tone="danger"
        />
      </div>

      <div style={styles.noticeCard}>
        <div style={styles.noticeIcon}>ℹ️</div>

        <div>
          <p style={styles.noticeTitle}>Lecture transparente, sans action directe</p>
          <p style={styles.noticeText}>{data.message_transparence}</p>
        </div>
      </div>

      <div style={styles.twoColumns}>
        <article style={styles.panelLarge}>
          <div style={styles.panelHeader}>
            <div>
              <p style={styles.panelEyebrow}>Courbes & statistiques</p>
              <h3 style={styles.panelTitle}>Évolution mensuelle</h3>
            </div>

            <span style={styles.panelPill}>{courbeMensuelle.length} mois</span>
          </div>

          <MonthlyChart data={courbeMensuelle} />
        </article>

        <aside style={styles.panelSide}>
          <div style={styles.panelHeaderCompact}>
            <div>
              <p style={styles.panelEyebrow}>Répartition</p>
              <h3 style={styles.panelTitle}>Flux bancaires</h3>
            </div>
          </div>

          <div style={styles.repartitionList}>
            {data.repartition_mouvements.map((item) => (
              <div key={item.type} style={styles.repartitionItem}>
                <div>
                  <p style={styles.repartitionLabel}>{item.label}</p>
                  <p style={styles.repartitionCount}>{item.count} mouvement(s)</p>
                </div>

                <p
                  style={{
                    ...styles.repartitionAmount,
                    color: item.type === "CREDIT" ? "#047857" : "#be123c",
                  }}
                >
                  {formatCurrency(item.montant)}
                </p>
              </div>
            ))}
          </div>

          <div style={styles.statusBox}>
            <p style={styles.statusTitle}>Situation des lignes d’appels</p>

            <div style={styles.statusGrid}>
              <StatusItem label="Payées" value={data.nb_lignes_payees} />
              <StatusItem label="Partielles" value={data.nb_lignes_partielles} />
              <StatusItem label="Impayées" value={data.nb_lignes_impayees} />
            </div>
          </div>
        </aside>
      </div>

      <article style={styles.panelLarge}>
        <div style={styles.panelHeader}>
          <div>
            <p style={styles.panelEyebrow}>Mouvements récents</p>
            <h3 style={styles.panelTitle}>Derniers mouvements bancaires</h3>
          </div>

          <span style={styles.panelPill}>
            {data.derniers_mouvements.length} visible(s)
          </span>
        </div>

        <DerniersMouvements mouvements={data.derniers_mouvements} />
      </article>
    </section>
  );
}

function StatusItem(props: { label: string; value: number }) {
  return (
    <div style={styles.statusItem}>
      <p style={styles.statusValue}>{props.value}</p>
      <p style={styles.statusLabel}>{props.label}</p>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    display: "flex",
    flexDirection: "column",
    gap: 22,
  },

  hero: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) 280px",
    gap: 18,
    padding: 24,
    borderRadius: 32,
    background:
      "linear-gradient(135deg, rgba(15,23,42,0.98), rgba(30,64,175,0.92))",
    color: "#ffffff",
    boxShadow: "0 26px 75px rgba(15,23,42,0.18)",
    overflow: "hidden",
  },

  heroContent: {
    minWidth: 0,
  },

  heroEyebrow: {
    margin: 0,
    fontSize: 11,
    fontWeight: 950,
    letterSpacing: "0.16em",
    textTransform: "uppercase",
    color: "#93c5fd",
  },

  heroTitle: {
    margin: "10px 0 0",
    fontSize: 30,
    lineHeight: 1.14,
    fontWeight: 950,
    letterSpacing: "-0.04em",
  },

  heroText: {
    margin: "12px 0 0",
    maxWidth: 780,
    fontSize: 14,
    lineHeight: 1.7,
    color: "#dbeafe",
    fontWeight: 650,
  },

  heroMeta: {
    marginTop: 18,
    display: "flex",
    flexWrap: "wrap",
    gap: 10,
  },

  metaPill: {
    display: "inline-flex",
    alignItems: "center",
    borderRadius: 999,
    padding: "8px 12px",
    background: "rgba(255,255,255,0.12)",
    border: "1px solid rgba(255,255,255,0.16)",
    color: "#e0f2fe",
    fontSize: 12,
    fontWeight: 900,
  },

  heroScore: {
    borderRadius: 26,
    padding: 20,
    background: "rgba(255,255,255,0.12)",
    border: "1px solid rgba(255,255,255,0.16)",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
  },

  heroScoreLabel: {
    margin: 0,
    fontSize: 12,
    color: "#bfdbfe",
    fontWeight: 900,
  },

  heroScoreValue: {
    margin: "8px 0 0",
    fontSize: 42,
    lineHeight: 1,
    fontWeight: 950,
    letterSpacing: "-0.06em",
  },

  heroScoreText: {
    margin: "10px 0 0",
    fontSize: 12,
    lineHeight: 1.55,
    color: "#dbeafe",
    fontWeight: 750,
  },

  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 16,
  },

  statCard: {
    borderRadius: 26,
    padding: 18,
    background: "rgba(255,255,255,0.92)",
    border: "1px solid rgba(226,232,240,0.95)",
    boxShadow: "0 18px 52px rgba(15,23,42,0.07)",
  },

  statTop: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },

  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 16,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 18,
    fontWeight: 900,
  },

  statIconNeutral: {
    background: "#eff6ff",
    color: "#1d4ed8",
  },

  statIconSuccess: {
    background: "#ecfdf5",
    color: "#047857",
  },

  statIconDanger: {
    background: "#fff1f2",
    color: "#be123c",
  },

  statIconWarning: {
    background: "#fffbeb",
    color: "#b45309",
  },

  statLabel: {
    margin: "14px 0 0",
    fontSize: 12,
    fontWeight: 900,
    letterSpacing: "0.04em",
    textTransform: "uppercase",
    color: "#64748b",
  },

  statValue: {
    margin: "8px 0 0",
    fontSize: 26,
    lineHeight: 1.1,
    fontWeight: 950,
    letterSpacing: "-0.04em",
    color: "#0f172a",
  },

  statHelper: {
    margin: "8px 0 0",
    fontSize: 12,
    lineHeight: 1.55,
    color: "#64748b",
    fontWeight: 700,
  },

  noticeCard: {
    display: "flex",
    gap: 14,
    alignItems: "flex-start",
    borderRadius: 26,
    padding: 18,
    background: "#eff6ff",
    border: "1px solid #bfdbfe",
    boxShadow: "0 18px 45px rgba(37,99,235,0.08)",
  },

  noticeIcon: {
    width: 38,
    height: 38,
    borderRadius: 16,
    background: "#dbeafe",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },

  noticeTitle: {
    margin: 0,
    fontSize: 14,
    fontWeight: 950,
    color: "#1e3a8a",
  },

  noticeText: {
    margin: "6px 0 0",
    fontSize: 13,
    lineHeight: 1.6,
    color: "#1e40af",
    fontWeight: 650,
  },

  twoColumns: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) 360px",
    gap: 18,
    alignItems: "start",
  },

  panelLarge: {
    borderRadius: 30,
    padding: 20,
    background: "rgba(255,255,255,0.94)",
    border: "1px solid rgba(226,232,240,0.95)",
    boxShadow: "0 22px 65px rgba(15,23,42,0.08)",
  },

  panelSide: {
    borderRadius: 30,
    padding: 20,
    background: "rgba(255,255,255,0.94)",
    border: "1px solid rgba(226,232,240,0.95)",
    boxShadow: "0 22px 65px rgba(15,23,42,0.08)",
  },

  panelHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 14,
    alignItems: "flex-start",
    marginBottom: 18,
  },

  panelHeaderCompact: {
    marginBottom: 18,
  },

  panelEyebrow: {
    margin: 0,
    fontSize: 10,
    fontWeight: 950,
    letterSpacing: "0.16em",
    textTransform: "uppercase",
    color: "#2563eb",
  },

  panelTitle: {
    margin: "5px 0 0",
    fontSize: 18,
    fontWeight: 950,
    letterSpacing: "-0.03em",
    color: "#0f172a",
  },

  panelPill: {
    display: "inline-flex",
    alignItems: "center",
    borderRadius: 999,
    padding: "8px 11px",
    background: "#f1f5f9",
    color: "#475569",
    fontSize: 12,
    fontWeight: 900,
    whiteSpace: "nowrap",
  },

  chartList: {
    display: "flex",
    flexDirection: "column",
    gap: 14,
  },

  monthRow: {
    padding: 14,
    borderRadius: 22,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
  },

  monthLabel: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 12,
  },

  monthName: {
    fontSize: 13,
    fontWeight: 950,
    color: "#0f172a",
    textTransform: "capitalize",
  },

  monthSolde: {
    fontSize: 12,
    fontWeight: 850,
    color: "#64748b",
  },

  barsBlock: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },

  barLine: {
    display: "grid",
    gridTemplateColumns: "70px minmax(0, 1fr) 120px",
    alignItems: "center",
    gap: 10,
  },

  barLabel: {
    fontSize: 11,
    fontWeight: 900,
    color: "#64748b",
  },

  barTrack: {
    height: 9,
    borderRadius: 999,
    background: "#e2e8f0",
    overflow: "hidden",
  },

  barFill: {
    display: "block",
    height: "100%",
    borderRadius: 999,
    minWidth: 2,
  },

  barValue: {
    fontSize: 11,
    fontWeight: 900,
    color: "#334155",
    textAlign: "right",
  },

  repartitionList: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },

  repartitionItem: {
    display: "flex",
    justifyContent: "space-between",
    gap: 14,
    padding: 14,
    borderRadius: 20,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
  },

  repartitionLabel: {
    margin: 0,
    fontSize: 13,
    fontWeight: 950,
    color: "#0f172a",
  },

  repartitionCount: {
    margin: "5px 0 0",
    fontSize: 12,
    color: "#64748b",
    fontWeight: 750,
  },

  repartitionAmount: {
    margin: 0,
    fontSize: 14,
    fontWeight: 950,
    whiteSpace: "nowrap",
  },

  statusBox: {
    marginTop: 18,
    padding: 15,
    borderRadius: 22,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
  },

  statusTitle: {
    margin: 0,
    fontSize: 13,
    fontWeight: 950,
    color: "#0f172a",
  },

  statusGrid: {
    marginTop: 12,
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 10,
  },

  statusItem: {
    padding: 12,
    borderRadius: 18,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    textAlign: "center",
  },

  statusValue: {
    margin: 0,
    fontSize: 20,
    fontWeight: 950,
    color: "#0f172a",
  },

  statusLabel: {
    margin: "4px 0 0",
    fontSize: 11,
    fontWeight: 850,
    color: "#64748b",
  },

  movementList: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },

  movementCard: {
    display: "flex",
    justifyContent: "space-between",
    gap: 16,
    alignItems: "flex-start",
    padding: 15,
    borderRadius: 22,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
  },

  movementLeft: {
    display: "flex",
    gap: 12,
    minWidth: 0,
  },

  movementIcon: {
    width: 38,
    height: 38,
    borderRadius: 16,
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 950,
    color: "#2563eb",
    flexShrink: 0,
  },

  movementTitle: {
    margin: 0,
    fontSize: 14,
    fontWeight: 950,
    color: "#0f172a",
  },

  movementMeta: {
    margin: "6px 0 0",
    fontSize: 12,
    lineHeight: 1.45,
    color: "#64748b",
    fontWeight: 700,
  },

  movementBadges: {
    display: "flex",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 9,
  },

  badge: {
    display: "inline-flex",
    alignItems: "center",
    borderRadius: 999,
    padding: "5px 8px",
    fontSize: 11,
    fontWeight: 900,
  },

  badgeSuccess: {
    background: "#ecfdf5",
    color: "#047857",
    border: "1px solid #bbf7d0",
  },

  badgeDanger: {
    background: "#fff1f2",
    color: "#be123c",
    border: "1px solid #fecdd3",
  },

  badgeMuted: {
    background: "#f1f5f9",
    color: "#64748b",
    border: "1px solid #cbd5e1",
  },

  badgeInfo: {
    background: "#eff6ff",
    color: "#1d4ed8",
    border: "1px solid #bfdbfe",
  },

  movementAmountBlock: {
    textAlign: "right",
    flexShrink: 0,
  },

  movementAmount: {
    margin: 0,
    fontSize: 15,
    fontWeight: 950,
  },

  movementType: {
    margin: "5px 0 0",
    fontSize: 11,
    color: "#64748b",
    fontWeight: 850,
  },

  loadingCard: {
    borderRadius: 30,
    padding: 28,
    background: "rgba(255,255,255,0.94)",
    border: "1px solid #e2e8f0",
    boxShadow: "0 22px 65px rgba(15,23,42,0.08)",
    textAlign: "center",
  },

  loadingIcon: {
    fontSize: 34,
  },

  loadingTitle: {
    margin: "12px 0 0",
    fontSize: 18,
    fontWeight: 950,
    color: "#0f172a",
  },

  loadingText: {
    margin: "7px auto 0",
    maxWidth: 560,
    fontSize: 13,
    color: "#64748b",
    lineHeight: 1.6,
    fontWeight: 650,
  },

  errorCard: {
    borderRadius: 30,
    padding: 24,
    background: "#fff1f2",
    border: "1px solid #fecdd3",
    boxShadow: "0 22px 65px rgba(190,18,60,0.08)",
  },

  errorTitle: {
    margin: 0,
    fontSize: 18,
    fontWeight: 950,
    color: "#9f1239",
  },

  errorText: {
    margin: "8px 0 0",
    fontSize: 13,
    lineHeight: 1.6,
    color: "#be123c",
    fontWeight: 700,
  },

  retryButton: {
    marginTop: 16,
    border: "none",
    borderRadius: 16,
    padding: "10px 14px",
    background: "#be123c",
    color: "#ffffff",
    fontSize: 13,
    fontWeight: 900,
    cursor: "pointer",
  },

  emptyBox: {
    borderRadius: 22,
    padding: 18,
    background: "#f8fafc",
    border: "1px dashed #cbd5e1",
    color: "#64748b",
    fontSize: 13,
    fontWeight: 750,
    textAlign: "center",
  },
};