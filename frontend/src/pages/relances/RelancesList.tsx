import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { relancesAPI } from "../../api/relances";
import { APP_TEXT } from "../../config/appText";

type LoadState = "idle" | "loading" | "success" | "error";

type RelanceItem = {
  id: number;
  dossier?: number | null;
  lot_numero?: string | null;
  coproprietaire_nom?: string | null;
  appel_reference?: string | null;
  canal?: string | null;
  niveau?: number | null;
  statut?: string | null;
  objet?: string | null;
  message?: string | null;
  montant_du_message?: number | string | null;
  date_envoi?: string | null;
  envoye_par_username?: string | null;
  annulee_at?: string | null;
  motif_annulation?: string | null;
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

function formatDateTimeShort(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.toLocaleDateString("fr-FR")} ${d.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
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

function normalizeStatut(value?: string | null): string {
  return String(value ?? "").trim().toUpperCase();
}

function getRelanceBadge(statut?: string | null) {
  switch (normalizeStatut(statut)) {
    case "ANNULEE":
      return <Badge text="Annulée" kind="danger" />;
    case "ENVOYEE":
      return <Badge text="Envoyée" kind="info" />;
    case "BROUILLON":
      return <Badge text="Brouillon" kind="neutral" />;
    default:
      return <Badge text={statut || "—"} kind="neutral" />;
  }
}

function getCanalBadge(canal?: string | null) {
  const value = String(canal ?? "").trim().toUpperCase();
  switch (value) {
    case "EMAIL":
      return <Badge text="Email" kind="info" />;
    case "SMS":
      return <Badge text="SMS" kind="warning" />;
    case "INTERNE":
      return <Badge text="Interne" kind="neutral" />;
    case "COURRIER":
      return <Badge text="Courrier" kind="success" />;
    default:
      return <Badge text={canal || "—"} kind="neutral" />;
  }
}

export default function RelancesList() {
  const navigate = useNavigate();

  const [state, setState] = useState<LoadState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<RelanceItem[]>([]);
  const [query, setQuery] = useState("");

  async function loadData() {
    setState("loading");
    setError(null);

    try {
      const rows = (await relancesAPI.getRelances()) as RelanceItem[];
      setData(Array.isArray(rows) ? rows : []);
      setState("success");
    } catch (e: any) {
      setState("error");
      setError(e?.response?.data?.detail || e?.message || "Impossible de charger l’historique des relances.");
      setData([]);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return data;

    return data.filter((r) => {
      const haystack = [
        r.coproprietaire_nom ?? "",
        r.lot_numero ?? "",
        r.appel_reference ?? "",
        r.canal ?? "",
        r.objet ?? "",
        r.message ?? "",
        r.statut ?? "",
        r.envoye_par_username ?? "",
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(q);
    });
  }, [data, query]);

  const stats = useMemo(() => {
    const total = filtered.length;
    const envoyees = filtered.filter((item) => normalizeStatut(item.statut) === "ENVOYEE").length;
    const annulees = filtered.filter(
      (item) => normalizeStatut(item.statut) === "ANNULEE" || Boolean(item.annulee_at)
    ).length;
    const totalMontant = filtered.reduce((sum, item) => {
      const value = Number(item.montant_du_message ?? 0);
      return sum + (Number.isFinite(value) ? value : 0);
    }, 0);
    const niveauEleve = filtered.filter((item) => Number(item.niveau ?? 0) >= 2).length;

    return {
      total,
      envoyees,
      annulees,
      totalMontant,
      niveauEleve,
    };
  }, [filtered]);

  const isLoading = state === "loading";
  const hasData = filtered.length > 0;

  return (
    <PageShell>
      <SectionTitle
        title="Historique des relances"
        subtitle="Consultez les relances envoyées, contrôlez leur statut, leur canal, leur niveau et retrouvez rapidement le dossier concerné."
        right={
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <SmallButton onClick={() => navigate("/relances")}>
              Vue d’ensemble des relances
            </SmallButton>
            <SmallButton onClick={() => navigate("/relances/dossiers")}>
              Dossiers impayés
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
          label="Relances affichées"
          value={String(stats.total)}
          hint="Nombre de relances visibles selon la recherche en cours."
        />
        <KpiCard
          label="Montant total"
          value={formatMoneyFCFA(stats.totalMontant)}
          hint="Montant cumulé porté par les relances affichées."
        />
        <KpiCard
          label="Envoyées"
          value={String(stats.envoyees)}
          hint="Relances envoyées et actives dans la vue actuelle."
        />
        <KpiCard
          label="Niveau élevé"
          value={String(stats.niveauEleve)}
          hint="Relances de niveau 2 ou plus, à surveiller en priorité."
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
              placeholder="Rechercher par copropriétaire, lot, appel, canal, objet, message ou émetteur..."
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
              {isLoading ? APP_TEXT.common.loading : `${filtered.length} relance(s) affichée(s)`}
            </div>
            <div style={{ color: "#6b7280", fontSize: 12 }}>
              {stats.annulees > 0
                ? `${stats.annulees} relance(s) annulée(s) dans cette vue`
                : "Aucune relance annulée dans cette vue"}
            </div>
          </div>
        </div>
      </Panel>

      <Panel style={{ overflow: "hidden" }}>
        {isLoading ? (
          <div style={{ padding: 18, color: "#6b7280", fontSize: 14 }}>
            Chargement des relances…
          </div>
        ) : !hasData ? (
          <div style={{ padding: 18 }}>
            <EmptyState
              title="Aucune relance trouvée"
              text="Aucune relance ne remonte pour le moment ou aucune ne correspond à votre recherche actuelle."
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
                  <th style={th}>Canal</th>
                  <th style={th}>Niveau</th>
                  <th style={th}>Montant</th>
                  <th style={th}>Date d’envoi</th>
                  <th style={th}>État</th>
                  <th style={th}>Action</th>
                </tr>
              </thead>

              <tbody>
                {filtered.map((r) => {
                  const niveau = Number(r.niveau ?? 0);

                  return (
                    <tr key={r.id} style={{ background: "#ffffff" }}>
                      <td style={tdStrong}>{r.lot_numero || "—"}</td>
                      <td style={td}>{r.coproprietaire_nom || "—"}</td>
                      <td style={td}>{r.appel_reference || "—"}</td>

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

                      <td style={td}>{formatMoneyFCFA(r.montant_du_message)}</td>
                      <td style={td}>{formatDateTimeShort(r.date_envoi)}</td>

                      <td style={td}>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          {getRelanceBadge(r.statut)}
                          {r.annulee_at ? <Badge text="Annulation tracée" kind="danger" /> : null}
                        </div>

                        {(r.envoye_par_username || r.motif_annulation) ? (
                          <div style={{ marginTop: 6, fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>
                            {r.envoye_par_username ? `Par ${r.envoye_par_username}` : null}
                            {r.envoye_par_username && r.motif_annulation ? " • " : null}
                            {r.motif_annulation ? `Motif : ${r.motif_annulation}` : null}
                          </div>
                        ) : null}
                      </td>

                      <td style={td}>
                        {r.dossier ? (
                          <SmallButton onClick={() => navigate(`/relances/dossiers/${r.dossier}`)} primary>
                            Ouvrir dossier
                          </SmallButton>
                        ) : (
                          <span style={{ color: "#9ca3af", fontSize: 13 }}>—</span>
                        )}
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
        Cette vue permet de suivre l’activité de relance dans le temps, de contrôler les relances envoyées ou annulées, d’identifier les niveaux les plus sensibles et de retrouver rapidement le dossier concerné pour poursuivre le traitement.
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