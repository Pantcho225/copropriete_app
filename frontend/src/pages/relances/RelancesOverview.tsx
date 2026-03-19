import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { relancesAPI } from "../../api/relances";
import { APP_TEXT } from "../../config/appText";

type LoadState = "idle" | "loading" | "success" | "error";

type DossierItem = {
  id: number;
  lot_numero?: string | null;
  coproprietaire_nom?: string | null;
  appel_reference?: string | null;
  reste_a_payer?: number | string | null;
  statut?: string | null;
  niveau_relance?: number | null;
  est_regularise?: boolean;
};

type RelanceItem = {
  id: number;
  dossier?: number | null;
  statut?: string | null;
  canal?: string | null;
  niveau?: number | null;
};

function PageShell({ children }: { children: ReactNode }) {
  return <div style={{ display: "grid", gap: 18 }}>{children}</div>;
}

function SectionTitle(props: { title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 16,
        flexWrap: "wrap",
        alignItems: "flex-end",
      }}
    >
      <div style={{ minWidth: 280 }}>
        <div
          style={{
            fontSize: 30,
            fontWeight: 900,
            color: "#111827",
            lineHeight: 1.08,
            letterSpacing: -0.5,
          }}
        >
          {props.title}
        </div>

        {props.subtitle ? (
          <div
            style={{
              marginTop: 8,
              color: "#6b7280",
              fontSize: 14,
              lineHeight: 1.55,
              maxWidth: 920,
            }}
          >
            {props.subtitle}
          </div>
        ) : null}
      </div>

      {props.right}
    </div>
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
        border: props.primary ? "1px solid #c7d2fe" : "1px solid #e5e7eb",
        background: props.disabled ? "#f9fafb" : props.primary ? "#eef2ff" : "#fff",
        color: props.disabled ? "#9ca3af" : props.primary ? "#3730a3" : "#111827",
        borderRadius: 12,
        padding: "10px 14px",
        fontSize: 13,
        fontWeight: 800,
        cursor: props.disabled ? "not-allowed" : "pointer",
        whiteSpace: "nowrap",
        transition: "all 0.18s ease",
      }}
    >
      {props.children}
    </button>
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
    <div
      style={{
        border: "1px dashed #d1d5db",
        borderRadius: 18,
        padding: 22,
        background: "#f9fafb",
      }}
    >
      <div style={{ fontSize: 15, fontWeight: 900, color: "#111827", marginBottom: 8 }}>
        {props.title}
      </div>
      <div style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.6 }}>{props.text}</div>
    </div>
  );
}

function KpiCard(props: { label: string; value: string; hint?: string }) {
  return (
    <div
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 18,
        background: "linear-gradient(180deg, #ffffff 0%, #fafafa 100%)",
        padding: 16,
        minHeight: 104,
      }}
    >
      <div
        style={{
          fontSize: 12,
          fontWeight: 800,
          color: "#6b7280",
          textTransform: "uppercase",
          letterSpacing: 0.4,
        }}
      >
        {props.label}
      </div>
      <div
        style={{
          marginTop: 10,
          fontSize: 24,
          fontWeight: 900,
          color: "#111827",
          lineHeight: 1.15,
        }}
      >
        {props.value}
      </div>
      {props.hint ? (
        <div style={{ marginTop: 8, fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>
          {props.hint}
        </div>
      ) : null}
    </div>
  );
}

function formatMoneyFCFA(amount?: number | string | null): string {
  if (amount == null || amount === "") return "0 FCFA";
  const value = Number(amount);
  if (!Number.isFinite(value)) return String(amount);

  try {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "XOF",
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${value} FCFA`;
  }
}

function normalizeStatut(value?: string | null): string {
  return String(value ?? "").trim().toUpperCase();
}

export default function RelancesOverview() {
  const navigate = useNavigate();

  const [state, setState] = useState<LoadState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [dossiers, setDossiers] = useState<DossierItem[]>([]);
  const [relances, setRelances] = useState<RelanceItem[]>([]);

  async function loadData() {
    setState("loading");
    setError(null);

    try {
      const [d, r] = await Promise.all([
        relancesAPI.getDossiers(),
        relancesAPI.getRelances(),
      ]);

      setDossiers(Array.isArray(d) ? d : []);
      setRelances(Array.isArray(r) ? r : []);
      setState("success");
    } catch (e: any) {
      setDossiers([]);
      setRelances([]);
      setState("error");
      setError(
        e?.response?.data?.detail ||
          e?.message ||
          APP_TEXT.errors.loadFailed
      );
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  const stats = useMemo(() => {
    const montantImpayé = dossiers.reduce((acc, d) => {
      const value = Number(d.reste_a_payer ?? 0);
      return acc + (Number.isFinite(value) ? value : 0);
    }, 0);

    const dossiersImpayes = dossiers.filter((d) => {
      const reste = Number(d.reste_a_payer ?? 0);
      return Number.isFinite(reste) && reste > 0;
    }).length;

    const dossiersRegularises = dossiers.filter((d) => {
      const reste = Number(d.reste_a_payer ?? 0);
      return Boolean(d.est_regularise) || (Number.isFinite(reste) && reste <= 0);
    }).length;

    const relancesEnvoyees = relances.filter(
      (r) => normalizeStatut(r.statut) === "ENVOYE"
    ).length;

    const relancesNiveauEleve = relances.filter(
      (r) => Number(r.niveau ?? 0) >= 2
    ).length;

    return {
      dossiersImpayes,
      dossiersRegularises,
      relancesEnvoyees,
      relancesNiveauEleve,
      montantImpayé,
    };
  }, [dossiers, relances]);

  const isLoading = state === "loading";
  const hasAnyData = dossiers.length > 0 || relances.length > 0;

  return (
    <PageShell>
      <SectionTitle
        title="Vue d’ensemble des relances"
        subtitle="Supervisez les impayés, suivez les relances déjà envoyées, contrôlez les montants encore dus et repérez rapidement les dossiers régularisés."
        right={
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <SmallButton onClick={() => navigate("/relances/dossiers")}>
              Dossiers impayés
            </SmallButton>
            <SmallButton onClick={() => navigate("/relances/historique")}>
              Historique des relances
            </SmallButton>
            <SmallButton onClick={() => navigate("/relances/avis")}>
              Avis de régularisation
            </SmallButton>
            <SmallButton onClick={() => void loadData()} primary disabled={isLoading}>
              {isLoading ? APP_TEXT.common.loading : APP_TEXT.common.refresh}
            </SmallButton>
          </div>
        }
      />

      {state === "error" && error ? (
        <AlertBox kind="error" title="Chargement impossible">
          {error}
        </AlertBox>
      ) : null}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 14,
        }}
      >
        <KpiCard
          label="Dossiers impayés"
          value={String(stats.dossiersImpayes)}
          hint="Nombre de dossiers présentant encore un reste à payer."
        />
        <KpiCard
          label="Relances envoyées"
          value={String(stats.relancesEnvoyees)}
          hint="Relances dont le statut est officiellement envoyé."
        />
        <KpiCard
          label="Montant impayé"
          value={formatMoneyFCFA(stats.montantImpayé)}
          hint="Montant cumulé restant à recouvrer sur les dossiers impayés."
        />
        <KpiCard
          label="Dossiers régularisés"
          value={String(stats.dossiersRegularises)}
          hint="Dossiers soldés ou marqués comme régularisés."
        />
      </div>

      <Panel style={{ padding: 18 }}>
        {!isLoading && !hasAnyData ? (
          <EmptyState
            title="Aucune donnée de relance disponible"
            text="Aucun dossier impayé ni aucune relance ne remonte pour le moment sur la copropriété active."
          />
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: 14,
            }}
          >
            <div style={summaryCard}>
              <div style={summaryTitle}>Synthèse dossiers</div>
              <div style={summaryText}>
                {stats.dossiersImpayes} dossier(s) impayé(s) et {stats.dossiersRegularises} dossier(s)
                régularisé(s).
              </div>
            </div>

            <div style={summaryCard}>
              <div style={summaryTitle}>Synthèse relances</div>
              <div style={summaryText}>
                {stats.relancesEnvoyees} relance(s) envoyée(s) et {stats.relancesNiveauEleve} relance(s)
                de niveau élevé à surveiller.
              </div>
            </div>

            <div style={summaryCard}>
              <div style={summaryTitle}>Encours à traiter</div>
              <div style={summaryText}>
                Le montant actuellement encore dû est de {formatMoneyFCFA(stats.montantImpayé)}.
              </div>
            </div>
          </div>
        )}
      </Panel>

      <AlertBox kind="info" title="Lecture métier">
        Cette vue consolide l’état global du module Relances. Les indicateurs doivent rester alignés sur la logique métier officielle : impayés, relances envoyées, montants à recouvrer et dossiers régularisés.
      </AlertBox>
    </PageShell>
  );
}

const summaryCard: CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 18,
  background: "#fafafa",
  padding: 16,
};

const summaryTitle: CSSProperties = {
  fontSize: 13,
  fontWeight: 800,
  color: "#374151",
  marginBottom: 8,
  textTransform: "uppercase",
  letterSpacing: 0.3,
};

const summaryText: CSSProperties = {
  fontSize: 14,
  color: "#111827",
  lineHeight: 1.6,
};