// src/pages/Dashboard.tsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import { useAuthStore } from "../store/authStore";

type LoadState = "idle" | "loading" | "success" | "error";

type MouvementItem = {
  id: number;
  sens: string; // "CREDIT" | "DEBIT"
  montant: string | number;
  date_operation: string; // YYYY-MM-DD
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

type DashboardStats = {
  totalDossiersTravaux: number | null;

  // Billing
  appelsActifs: number | null;
  impayesEnCours: number | null;
  restantAppels: number | null;

  // Compta
  soldeBancaire: number | null;
  totalCredit: number | null;
  totalDebit: number | null;
  nbNonRapproches: number | null;

  // Series sparkline
  series: SeriesPoint[];

  // Mouvements
  derniersMouvements: MouvementItem[];
};

const EMPTY_STATS: DashboardStats = {
  totalDossiersTravaux: null,

  appelsActifs: null,
  impayesEnCours: null,
  restantAppels: null,

  soldeBancaire: null,
  totalCredit: null,
  totalDebit: null,
  nbNonRapproches: null,

  series: [],

  derniersMouvements: [],
};

// ----------------- Helpers -----------------
function toNumberOrNull(v: any): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function asArray<T = any>(v: any): T[] {
  return Array.isArray(v) ? v : [];
}

function formatMoneyFCFA(amount: number | null): string {
  if (amount === null) return "—";
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

function formatInt(v: number | null): string {
  if (v === null) return "—";
  return new Intl.NumberFormat("fr-FR").format(v);
}

function formatDateShort(iso?: string): string {
  if (!iso) return "—";
  const s = String(iso);
  return s.length >= 10 ? s.slice(0, 10) : s;
}

function getDetailError(e: any): string {
  return (
    e?.response?.data?.detail ||
    e?.response?.data?.message ||
    e?.message ||
    "Erreur lors du chargement du tableau de bord."
  );
}

function normalizeMontant(m: string | number | undefined): number | null {
  if (m === undefined || m === null) return null;
  const n = Number(m);
  return Number.isFinite(n) ? n : null;
}

function isAllNullOrZero(values: Array<number | null>) {
  return values.every((v) => v === null || v === 0);
}

// --- Sparkline helpers ---
function pickSeriesValue(p: SeriesPoint): number | null {
  // priorité: cumul_net, sinon net, sinon credit - debit
  const c = toNumberOrNull((p as any)?.cumul_net);
  if (c !== null) return c;
  const n = toNumberOrNull((p as any)?.net);
  if (n !== null) return n;
  const credit = toNumberOrNull((p as any)?.credit);
  const debit = toNumberOrNull((p as any)?.debit);
  if (credit !== null || debit !== null) return (credit ?? 0) - (debit ?? 0);
  return null;
}

function buildSparkPath(series: SeriesPoint[], width = 220, height = 44, pad = 4) {
  const vals = series.map(pickSeriesValue).filter((v): v is number => v !== null);
  if (vals.length < 2) return { d: "", y0: height - pad, min: 0, max: 0 };

  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min || 1;

  const usableW = width - pad * 2;
  const usableH = height - pad * 2;

  const points = vals.map((v, i) => {
    const x = pad + (i * usableW) / (vals.length - 1);
    const y = pad + (1 - (v - min) / span) * usableH; // inversé (haut = max)
    return { x, y };
  });

  const d = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
    .join(" ");

  // ligne baseline (0) si 0 est dans le range
  let y0 = height - pad;
  if (min <= 0 && max >= 0) {
    y0 = pad + (1 - (0 - min) / span) * usableH;
  }

  return { d, y0, min, max };
}

// ----------------- UI -----------------
function StatCard(props: { title: string; value: string; sub?: string; isLoading?: boolean }) {
  return (
    <div
      style={{
        border: "1px solid #e7e7e7",
        borderRadius: 14,
        padding: 16,
        background: "#fff",
        boxShadow: "0 1px 10px rgba(0,0,0,0.04)",
        minHeight: 86,
      }}
    >
      <div style={{ fontSize: 13, color: "#555", marginBottom: 8 }}>{props.title}</div>
      <div style={{ fontSize: 24, fontWeight: 900, letterSpacing: -0.2 }}>
        {props.isLoading ? "…" : props.value}
      </div>
      {props.sub ? <div style={{ marginTop: 6, fontSize: 12, color: "#777" }}>{props.sub}</div> : null}
    </div>
  );
}

function Card(props: { title: string; children: any; right?: any }) {
  return (
    <div style={{ border: "1px solid #e7e7e7", borderRadius: 14, padding: 16, background: "#fff" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <div style={{ fontSize: 14, fontWeight: 900 }}>{props.title}</div>
        {props.right ? props.right : null}
      </div>
      <div style={{ marginTop: 10 }}>{props.children}</div>
    </div>
  );
}

function AlertBox(props: { kind: "error" | "info"; children: any }) {
  const bg = props.kind === "error" ? "#fff2f2" : "#f2f7ff";
  const border = props.kind === "error" ? "#ffcccc" : "#cfe2ff";
  const color = props.kind === "error" ? "#8a1f1f" : "#1f3a8a";
  return (
    <div style={{ border: `1px solid ${border}`, background: bg, color, padding: 12, borderRadius: 12 }}>
      {props.children}
    </div>
  );
}

function Badge(props: { text: string; kind: "credit" | "debit" | "neutral" }) {
  const { text, kind } = props;
  const styles =
    kind === "credit"
      ? { background: "#ecfdf5", border: "#a7f3d0", color: "#065f46" }
      : kind === "debit"
        ? { background: "#fff1f2", border: "#fecdd3", color: "#9f1239" }
        : { background: "#f3f4f6", border: "#e5e7eb", color: "#374151" };

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "2px 8px",
        borderRadius: 999,
        fontSize: 12,
        border: `1px solid ${styles.border}`,
        background: styles.background,
        color: styles.color,
        whiteSpace: "nowrap",
      }}
    >
      {text}
    </span>
  );
}

function SmallButton(props: { children: any; onClick?: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={props.onClick}
      disabled={props.disabled}
      style={{
        border: "1px solid #e7e7e7",
        background: props.disabled ? "#f7f7f7" : "#fff",
        borderRadius: 10,
        padding: "8px 10px",
        fontSize: 12,
        fontWeight: 700,
        cursor: props.disabled ? "not-allowed" : "pointer",
      }}
    >
      {props.children}
    </button>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();

  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const coproprieteId = useAuthStore((s) => s.coproprieteId);

  const [state, setState] = useState<LoadState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<DashboardStats>(EMPTY_STATS);

  // ✅ filtre de période
  const [seriesDays, setSeriesDays] = useState<number>(30);

  // ✅ fetch seulement si authentifié + copro sélectionnée
  const canFetch = useMemo(() => Boolean(isAuthenticated && coproprieteId), [isAuthenticated, coproprieteId]);

  // ✅ reset UI quand copro change
  useEffect(() => {
    setStats(EMPTY_STATS);
    setState("idle");
    setError(null);
  }, [coproprieteId]);

  useEffect(() => {
    if (!canFetch) return;

    let alive = true;

    async function load() {
      setState("loading");
      setError(null);

      try {
        const travauxReq = api.get("/api/travaux/dossiers/stats/");
        const billingReq = api.get("/api/billing/dashboard/");
        const comptaReq = api.get(`/api/compta/mouvements/dashboard/?series_days=${seriesDays}`);
        const lastMovesReq = api.get("/api/compta/mouvements/?ordering=-date_operation");

        const [travauxRes, billingRes, comptaRes, movesRes] = await Promise.all([
          travauxReq,
          billingReq,
          comptaReq,
          lastMovesReq,
        ]);

        if (!alive) return;

        const travauxData = travauxRes?.data ?? {};
        const billingData = billingRes?.data ?? {};
        const comptaData = comptaRes?.data ?? {};
        const movesList = asArray<MouvementItem>(movesRes?.data);

        // ---- Travaux ----
        const totalDossiersTravaux =
          toNumberOrNull(travauxData?.total_dossiers) ??
          toNumberOrNull(travauxData?.totaux?.total_dossiers) ??
          toNumberOrNull(travauxData?.count) ??
          toNumberOrNull(travauxData?.nb_dossiers) ??
          null;

        // ---- Billing (structure réelle: billingData.lignes.*) ----
        const lignes = billingData?.lignes ?? {};
        const appelsActifs =
          toNumberOrNull(lignes?.nb) ??
          toNumberOrNull(billingData?.appels_actifs) ??
          toNumberOrNull(billingData?.totaux?.appels_actifs) ??
          null;

        const impayesEnCours =
          (Array.isArray(lignes?.impayes_top10) ? lignes.impayes_top10.length : null) ??
          toNumberOrNull(billingData?.impayes_en_cours) ??
          toNumberOrNull(billingData?.totaux?.impayes_en_cours) ??
          null;

        const restantAppels = toNumberOrNull(lignes?.restant) ?? toNumberOrNull(lignes?.reste_a_payer) ?? null;

        // ---- Compta ----
        const soldeBancaire = toNumberOrNull(comptaData?.totaux?.solde) ?? null;
        const totalCredit = toNumberOrNull(comptaData?.totaux?.total_credit) ?? null;
        const totalDebit = toNumberOrNull(comptaData?.totaux?.total_debit) ?? null;
        const nbNonRapproches = toNumberOrNull(comptaData?.totaux?.nb_non_rapproches) ?? null;

        const series = asArray<SeriesPoint>(comptaData?.series);
        const derniersMouvements = movesList.slice(0, 5);

        setStats({
          totalDossiersTravaux,
          appelsActifs,
          impayesEnCours,
          restantAppels,
          soldeBancaire,
          totalCredit,
          totalDebit,
          nbNonRapproches,
          series,
          derniersMouvements,
        });

        setState("success");
      } catch (e: any) {
        if (!alive) return;
        setState("error");
        setError(String(getDetailError(e)));
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, [canFetch, coproprieteId, seriesDays]);

  const isLoading = state === "loading";

  if (!isAuthenticated) {
    return (
      <div style={{ padding: 18 }}>
        <AlertBox kind="info">Vous n’êtes pas connecté. Veuillez vous authentifier.</AlertBox>
      </div>
    );
  }

  if (!coproprieteId) {
    return (
      <div style={{ padding: 18 }}>
        <AlertBox kind="info">Aucune copropriété sélectionnée. Clique sur “Changer copro”.</AlertBox>
      </div>
    );
  }

  const emptyCompta = isAllNullOrZero([stats.soldeBancaire, stats.totalCredit, stats.totalDebit, stats.nbNonRapproches]);

  const subImpayes =
    stats.restantAppels !== null ? `Restant : ${formatMoneyFCFA(stats.restantAppels)}` : "Nb lots en impayé (top)";

  const spark = buildSparkPath(stats.series, 220, 44, 4);

  return (
    <div style={{ padding: 18 }}>
      {/* Header */}
      <div style={{ marginBottom: 14, display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: -0.2 }}>Tableau de bord</div>
          <div style={{ fontSize: 13, color: "#666", marginTop: 4 }}>
            Données consolidées (Travaux, Billing, Compta). Copropriété active : <b>{coproprieteId}</b>
          </div>
        </div>

        {/* Filter */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ fontSize: 12, color: "#666" }}>Période</div>
          <select
            value={seriesDays}
            onChange={(e) => setSeriesDays(Number(e.target.value))}
            style={{
              border: "1px solid #e7e7e7",
              borderRadius: 10,
              padding: "8px 10px",
              fontSize: 12,
              fontWeight: 700,
              background: "#fff",
            }}
          >
            <option value={30}>30 jours</option>
            <option value={90}>90 jours</option>
            <option value={180}>180 jours</option>
          </select>
        </div>
      </div>

      {state === "error" && error ? (
        <div style={{ marginBottom: 12 }}>
          <AlertBox kind="error">
            <div style={{ fontWeight: 900, marginBottom: 4 }}>Chargement impossible</div>
            <div style={{ fontSize: 13 }}>{error}</div>
            <div style={{ fontSize: 12, marginTop: 8, color: "#6b7280" }}>
              Vérifie : token OK + en-tête <b>X-Copropriete-Id</b> + endpoints backend.
            </div>
          </AlertBox>
        </div>
      ) : null}

      {/* Top stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12 }}>
        <StatCard
          title="Dossiers Travaux"
          value={formatInt(stats.totalDossiersTravaux)}
          sub="Nombre total de dossiers (tous statuts)"
          isLoading={isLoading}
        />
        <StatCard title="Appels actifs" value={formatInt(stats.appelsActifs)} sub="Nb lignes d’appel (période)" isLoading={isLoading} />
        <StatCard title="Impayés en cours" value={formatInt(stats.impayesEnCours)} sub={subImpayes} isLoading={isLoading} />
        <StatCard
          title="Solde bancaire"
          value={formatMoneyFCFA(stats.soldeBancaire)}
          sub={`Compta (série sur ${seriesDays} jours)`}
          isLoading={isLoading}
        />
      </div>

      {/* Bottom cards */}
      <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Card
          title="Compta — Total"
          right={
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {stats.nbNonRapproches !== null ? <Badge text={`Non rapprochés : ${stats.nbNonRapproches}`} kind="neutral" /> : null}
              <SmallButton onClick={() => navigate("/compta/mouvements")}>Voir tout</SmallButton>
            </div>
          }
        >
          {isLoading ? (
            <div style={{ color: "#666" }}>Chargement…</div>
          ) : emptyCompta ? (
            <div style={{ color: "#666" }}>Aucun compte/mouvement trouvé pour cette copropriété. Importez un CSV pour alimenter la compta.</div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
              <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontSize: 12, color: "#666", marginBottom: 6 }}>Crédit total</div>
                  <div style={{ fontSize: 18, fontWeight: 900 }}>{formatMoneyFCFA(stats.totalCredit)}</div>
                </div>
                <div style={{ width: 1, background: "#eee", margin: "0 4px" }} />
                <div>
                  <div style={{ fontSize: 12, color: "#666", marginBottom: 6 }}>Débit total</div>
                  <div style={{ fontSize: 18, fontWeight: 900 }}>{formatMoneyFCFA(stats.totalDebit)}</div>
                </div>
              </div>

              {/* Sparkline */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                <div style={{ fontSize: 12, color: "#666" }}>Tendance</div>
                <svg width={220} height={44} style={{ display: "block" }}>
                  {/* baseline */}
                  <line x1="4" y1={spark.y0} x2="216" y2={spark.y0} stroke="#eee" strokeWidth="1" />
                  {/* path */}
                  {spark.d ? <path d={spark.d} fill="none" stroke="#111" strokeWidth="2" /> : null}
                </svg>
              </div>
            </div>
          )}

          <div style={{ marginTop: 10, fontSize: 12, color: "#777" }}>
            Source : <code>/api/compta/mouvements/dashboard/?series_days={seriesDays}</code> → <code>totaux</code> + <code>series</code>
          </div>
        </Card>

        <Card
          title="Derniers mouvements"
          right={
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span style={{ fontSize: 12, color: "#777" }}>Top 5</span>
              <SmallButton onClick={() => navigate("/compta/mouvements")} disabled={isLoading}>
                Voir tout
              </SmallButton>
            </div>
          }
        >
          {isLoading ? (
            <div style={{ color: "#666" }}>Chargement…</div>
          ) : stats.derniersMouvements.length === 0 ? (
            <div style={{ color: "#666" }}>
              Aucun mouvement à afficher. (Source : <code>/api/compta/mouvements/</code>)
            </div>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              {stats.derniersMouvements.map((m) => {
                const sens = String(m.sens || "").toUpperCase();
                const kind = sens === "CREDIT" ? "credit" : sens === "DEBIT" ? "debit" : "neutral";
                const montant = normalizeMontant(m.montant);

                return (
                  <div
                    key={m.id}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "92px 1fr auto",
                      gap: 10,
                      alignItems: "center",
                      padding: "10px 10px",
                      border: "1px solid #f0f0f0",
                      borderRadius: 12,
                    }}
                  >
                    <div style={{ fontSize: 12, color: "#666" }}>{formatDateShort(m.date_operation)}</div>

                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 900, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {m.libelle || m.reference || "Mouvement"}
                      </div>
                      {m.reference ? <div style={{ fontSize: 12, color: "#777" }}>{m.reference}</div> : null}
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <Badge text={sens || "—"} kind={kind as any} />
                      <div style={{ fontSize: 13, fontWeight: 900 }}>{montant === null ? "—" : formatMoneyFCFA(montant)}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div style={{ marginTop: 10, fontSize: 12, color: "#777" }}>
            Source : <code>/api/compta/mouvements/?ordering=-date_operation</code>
          </div>
        </Card>
      </div>

      <div style={{ marginTop: 12 }}>
        <Card title="Notes techniques">
          <ul style={{ margin: 0, paddingLeft: 18, color: "#555", fontSize: 13, lineHeight: 1.5 }}>
            <li>
              Dashboard Compta : <code>/api/compta/mouvements/dashboard/?series_days=30/90/180</code> →{" "}
              <code>totaux.solde</code>, <code>totaux.total_credit</code>, <code>totaux.total_debit</code>, <code>series</code>.
            </li>
            <li>
              Derniers mouvements : <code>/api/compta/mouvements/?ordering=-date_operation</code> (liste directe).
            </li>
            <li>
              Billing : <code>/api/billing/dashboard/</code> → <code>lignes.nb</code>, <code>lignes.impayes_top10</code>, <code>lignes.restant</code>.
            </li>
            <li>
              401 = jeton absent/expiré ; 400 = <code>X-Copropriete-Id</code> manquant ; 404 = mauvais endpoint.
            </li>
          </ul>
        </Card>
      </div>

      {/* Responsive */}
      <style>{`
        @media (max-width: 1100px) {
          div[style*="grid-template-columns: repeat(4"] { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
        }
        @media (max-width: 900px) {
          div[style*="grid-template-columns: 1fr 1fr"] { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 640px) {
          div[style*="grid-template-columns: repeat(4"] { grid-template-columns: repeat(1, minmax(0, 1fr)) !important; }
        }
        code { background: #f6f6f6; padding: 1px 6px; border-radius: 8px; }
      `}</style>
    </div>
  );
}