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
  reference_appel?: string | null;
  date_echeance?: string | null;
  montant_initial?: number | string | null;
  montant_paye?: number | string | null;
  reste_a_payer?: number | string | null;
  statut?: string | null;
  niveau_relance?: number | null;
  relances_count?: number | null;
  est_regularise?: boolean;
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
        background: props.disabled ? "#f9fafb" : props.primary ? "#eef2ff" : "#ffffff",
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
  if (amount == null || amount === "") return "—";
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

function formatDateShort(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("fr-FR");
}

function normalizeStatut(value?: string | null): string {
  return String(value ?? "").trim().toUpperCase();
}

function getStatutLabel(statut?: string | null): string {
  switch (normalizeStatut(statut)) {
    case "REGULARISE":
      return "Régularisé";
    case "PAYE":
      return "Payé";
    case "PARTIELLEMENT_PAYE":
      return "Partiellement payé";
    case "EN_RETARD":
      return "En retard";
    default:
      return "À payer";
  }
}

function getStatutBadge(statut?: string | null) {
  switch (normalizeStatut(statut)) {
    case "REGULARISE":
      return <Badge text="Régularisé" kind="success" />;
    case "PAYE":
      return <Badge text="Payé" kind="success" />;
    case "PARTIELLEMENT_PAYE":
      return <Badge text="Partiellement payé" kind="warning" />;
    case "EN_RETARD":
      return <Badge text="En retard" kind="danger" />;
    default:
      return <Badge text="À payer" kind="info" />;
  }
}

export default function DossiersImpayesList() {
  const navigate = useNavigate();

  const [state, setState] = useState<LoadState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DossierItem[]>([]);
  const [query, setQuery] = useState("");

  async function loadData() {
    setState("loading");
    setError(null);

    try {
      const rows = (await relancesAPI.getDossiers()) as DossierItem[];
      setData(Array.isArray(rows) ? rows : []);
      setState("success");
    } catch (e: any) {
      setState("error");
      setError(e?.response?.data?.detail || e?.message || APP_TEXT.errors.loadFailed);
      setData([]);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return data;

    return data.filter((d) => {
      const haystack = [
        d.lot_numero ?? "",
        d.coproprietaire_nom ?? "",
        d.appel_reference ?? "",
        d.reference_appel ?? "",
        d.statut ?? "",
        d.niveau_relance != null ? `niveau ${d.niveau_relance}` : "",
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(q);
    });
  }, [data, query]);

  const stats = useMemo(() => {
    const total = filtered.length;
    const totalReste = filtered.reduce((sum, item) => {
      const value = Number(item.reste_a_payer ?? 0);
      return sum + (Number.isFinite(value) ? value : 0);
    }, 0);

    const enRetard = filtered.filter((item) => normalizeStatut(item.statut) === "EN_RETARD").length;
    const regularises = filtered.filter(
      (item) => item.est_regularise || normalizeStatut(item.statut) === "REGULARISE"
    ).length;
    const niveauEleve = filtered.filter((item) => Number(item.niveau_relance ?? 0) >= 2).length;

    return {
      total,
      totalReste,
      enRetard,
      regularises,
      niveauEleve,
    };
  }, [filtered]);

  const isLoading = state === "loading";
  const hasData = filtered.length > 0;

  return (
    <PageShell>
      <SectionTitle
        title="Dossiers impayés"
        subtitle="Consultez les dossiers non soldés, identifiez le niveau de relance, suivez le reste à payer et ouvrez rapidement chaque dossier pour poursuivre le traitement."
        right={
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <SmallButton onClick={() => navigate("/relances")}>
              Vue d’ensemble des relances
            </SmallButton>
            <SmallButton onClick={() => navigate("/relances/historique")}>
              Historique des relances
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
          label="Dossiers affichés"
          value={String(stats.total)}
          hint="Nombre de dossiers visibles selon la recherche en cours."
        />
        <KpiCard
          label="Reste à payer"
          value={formatMoneyFCFA(stats.totalReste)}
          hint="Montant cumulé restant sur les dossiers actuellement affichés."
        />
        <KpiCard
          label="En retard"
          value={String(stats.enRetard)}
          hint="Dossiers identifiés en retard de paiement."
        />
        <KpiCard
          label="Niveau de relance élevé"
          value={String(stats.niveauEleve)}
          hint="Dossiers ayant atteint un niveau de relance 2 ou plus."
        />
      </div>

      <Panel style={{ padding: 16 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <div style={{ minWidth: 280, flex: 1 }}>
            <div
              style={{
                fontSize: 13,
                fontWeight: 800,
                color: "#374151",
                marginBottom: 8,
              }}
            >
              Recherche
            </div>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher par lot, copropriétaire, appel, statut ou niveau de relance..."
              style={searchInput}
            />
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-end",
              gap: 6,
              minWidth: 180,
            }}
          >
            <div style={{ color: "#111827", fontSize: 13, fontWeight: 800 }}>
              {isLoading ? APP_TEXT.common.loading : `${filtered.length} dossier(s) affiché(s)`}
            </div>
            <div style={{ color: "#6b7280", fontSize: 12 }}>
              {stats.regularises > 0
                ? `${stats.regularises} dossier(s) régularisé(s) dans cette vue`
                : "Aucun dossier régularisé dans cette vue"}
            </div>
          </div>
        </div>
      </Panel>

      <Panel style={{ overflow: "hidden" }}>
        {isLoading ? (
          <div style={{ padding: 18, color: "#6b7280", fontSize: 14 }}>
            Chargement des dossiers impayés…
          </div>
        ) : !hasData ? (
          <div style={{ padding: 18 }}>
            <EmptyState
              title={APP_TEXT.emptyStates.noDossierImpaye}
              text="Aucun dossier ne remonte pour le moment ou aucun résultat ne correspond à votre recherche actuelle."
            />
          </div>
        ) : (
          <div style={tableWrap}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ textAlign: "left" }}>
                  <th style={th}>Lot</th>
                  <th style={th}>Copropriétaire</th>
                  <th style={th}>Appel</th>
                  <th style={th}>Échéance</th>
                  <th style={th}>Montant initial</th>
                  <th style={th}>Montant payé</th>
                  <th style={th}>Reste à payer</th>
                  <th style={th}>Statut</th>
                  <th style={th}>Relances</th>
                  <th style={th}>Action</th>
                </tr>
              </thead>

              <tbody>
                {filtered.map((d) => {
                  const niveau = Number(d.niveau_relance ?? 0);
                  const count = Number(d.relances_count ?? 0);

                  return (
                    <tr key={d.id} style={{ background: "#ffffff" }}>
                      <td style={tdStrong}>{d.lot_numero || "—"}</td>
                      <td style={td}>{d.coproprietaire_nom || "—"}</td>
                      <td style={td}>{d.appel_reference || d.reference_appel || "—"}</td>
                      <td style={td}>{formatDateShort(d.date_echeance)}</td>
                      <td style={td}>{formatMoneyFCFA(d.montant_initial)}</td>
                      <td style={td}>{formatMoneyFCFA(d.montant_paye)}</td>
                      <td style={tdStrong}>{formatMoneyFCFA(d.reste_a_payer)}</td>

                      <td style={td}>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          {getStatutBadge(d.statut)}
                          {d.est_regularise && normalizeStatut(d.statut) !== "REGULARISE" ? (
                            <Badge text="Régularisé" kind="success" />
                          ) : null}
                        </div>
                        <div style={{ marginTop: 6, fontSize: 12, color: "#6b7280" }}>
                          {getStatutLabel(d.statut)}
                        </div>
                      </td>

                      <td style={td}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <Badge
                            text={`Niveau ${niveau}`}
                            kind={niveau >= 2 ? "danger" : niveau === 1 ? "warning" : "neutral"}
                          />
                          <span style={{ fontSize: 12, color: "#6b7280" }}>
                            {count} relance(s)
                          </span>
                        </div>
                      </td>

                      <td style={td}>
                        <SmallButton onClick={() => navigate(`/relances/dossiers/${d.id}`)} primary>
                          Ouvrir
                        </SmallButton>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <AlertBox kind="info" title="Lecture métier">
        Cette vue aide à identifier les dossiers encore non soldés, à repérer les dossiers les plus sensibles selon leur niveau de relance et à accéder rapidement au détail pour envoyer une relance ou générer un avis de régularisation.
      </AlertBox>
    </PageShell>
  );
}

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
};

const th: CSSProperties = {
  padding: "14px 12px",
  borderBottom: "1px solid #e5e7eb",
  whiteSpace: "nowrap",
  fontSize: 12,
  color: "#6b7280",
  background: "#f9fafb",
  fontWeight: 800,
  textTransform: "uppercase",
  letterSpacing: 0.3,
};

const td: CSSProperties = {
  padding: "14px 12px",
  borderBottom: "1px solid #f3f4f6",
  color: "#111827",
  fontSize: 14,
  verticalAlign: "middle",
};

const tdStrong: CSSProperties = {
  ...td,
  fontWeight: 800,
};