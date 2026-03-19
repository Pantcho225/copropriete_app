import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { relancesAPI } from "../../api/relances";
import { APP_TEXT } from "../../config/appText";

type LoadState = "idle" | "loading" | "success" | "error";

type AvisRegularisationItem = {
  id: number;
  lot?: string | number | null;
  montant_total_regle?: string | number | null;
  statut?: string | null;
  created_at?: string | null;
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

function getStatutBadge(statut?: string | null) {
  switch (normalizeStatut(statut)) {
    case "GENERE":
      return <Badge text="Généré" kind="info" />;
    case "ENVOYE":
      return <Badge text="Envoyé" kind="success" />;
    case "ANNULE":
      return <Badge text="Annulé" kind="danger" />;
    default:
      return <Badge text={statut || "—"} kind="neutral" />;
  }
}

export default function AvisRegularisation() {
  const navigate = useNavigate();

  const [state, setState] = useState<LoadState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AvisRegularisationItem[]>([]);
  const [query, setQuery] = useState("");

  async function loadData() {
    setState("loading");
    setError(null);

    try {
      const items = (await relancesAPI.getAvis()) as AvisRegularisationItem[];
      setData(Array.isArray(items) ? items : []);
      setState("success");
    } catch (e: any) {
      setState("error");
      setError(
        e?.response?.data?.detail || e?.message || "Impossible de charger les avis de régularisation."
      );
      setData([]);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return data;

    return data.filter((item) => {
      const haystack = [
        item.lot ?? "",
        item.statut ?? "",
        item.montant_total_regle ?? "",
        item.created_at ?? "",
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(q);
    });
  }, [data, query]);

  const stats = useMemo(() => {
    const total = filtered.length;
    const montantTotal = filtered.reduce((sum, item) => {
      const value = Number(item.montant_total_regle ?? 0);
      return sum + (Number.isFinite(value) ? value : 0);
    }, 0);
    const generes = filtered.filter((item) => normalizeStatut(item.statut) === "GENERE").length;
    const envoyes = filtered.filter((item) => normalizeStatut(item.statut) === "ENVOYE").length;

    return {
      total,
      montantTotal,
      generes,
      envoyes,
    };
  }, [filtered]);

  const isLoading = state === "loading";
  const hasData = filtered.length > 0;

  return (
    <PageShell>
      <SectionTitle
        title="Avis de régularisation"
        subtitle="Consultez les avis générés après régularisation, contrôlez leur statut et retrouvez les montants réglés par lot."
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
          label="Avis affichés"
          value={String(stats.total)}
          hint="Nombre d’avis visibles selon la recherche en cours."
        />
        <KpiCard
          label="Montant régularisé"
          value={formatMoneyFCFA(stats.montantTotal)}
          hint="Montant cumulé réglé sur les avis actuellement affichés."
        />
        <KpiCard
          label="Générés"
          value={String(stats.generes)}
          hint="Avis déjà générés dans la vue courante."
        />
        <KpiCard
          label="Envoyés"
          value={String(stats.envoyes)}
          hint="Avis envoyés et tracés dans la vue courante."
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
              placeholder="Rechercher par lot, statut, montant ou date..."
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
              {isLoading ? APP_TEXT.common.loading : `${filtered.length} avis affiché(s)`}
            </div>
            <div style={{ color: "#6b7280", fontSize: 12 }}>
              {stats.envoyes > 0
                ? `${stats.envoyes} avis envoyé(s) dans cette vue`
                : "Aucun avis envoyé dans cette vue"}
            </div>
          </div>
        </div>
      </Panel>

      <Panel style={{ overflow: "hidden" }}>
        {isLoading ? (
          <div style={{ padding: 18, color: "#6b7280", fontSize: 14 }}>
            Chargement des avis de régularisation…
          </div>
        ) : !hasData ? (
          <div style={{ padding: 18 }}>
            <EmptyState
              title="Aucun avis de régularisation"
              text="Aucun avis ne remonte pour le moment ou aucun résultat ne correspond à votre recherche actuelle."
            />
          </div>
        ) : (
          <div style={tableWrap}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ textAlign: "left" }}>
                  <th style={th}>Lot</th>
                  <th style={th}>Montant réglé</th>
                  <th style={th}>Statut</th>
                  <th style={th}>Date de création</th>
                </tr>
              </thead>

              <tbody>
                {filtered.map((a) => (
                  <tr key={a.id} style={{ background: "#ffffff" }}>
                    <td style={tdStrong}>{a.lot ?? "—"}</td>
                    <td style={td}>{formatMoneyFCFA(a.montant_total_regle)}</td>
                    <td style={td}>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {getStatutBadge(a.statut)}
                      </div>
                    </td>
                    <td style={td}>{formatDateTimeShort(a.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <AlertBox kind="info" title="Lecture métier">
        Cette vue permet de suivre les avis émis après régularisation d’un impayé, de vérifier le montant effectivement réglé et de contrôler l’état d’avancement de chaque avis dans le processus de notification.
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