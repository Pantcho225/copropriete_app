import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { relancesAPI } from "../../api/relances";

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
  return <div style={{ display: "grid", gap: 16 }}>{children}</div>;
}

function SectionTitle(props: { title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 12,
        flexWrap: "wrap",
        alignItems: "flex-end",
      }}
    >
      <div>
        <div style={{ fontSize: 30, fontWeight: 900, color: "#111827", lineHeight: 1.1 }}>
          {props.title}
        </div>
        {props.subtitle ? (
          <div style={{ marginTop: 6, color: "#6b7280", fontSize: 14, lineHeight: 1.5 }}>
            {props.subtitle}
          </div>
        ) : null}
      </div>
      {props.right}
    </div>
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
      }}
    >
      {props.children}
    </button>
  );
}

function Badge(props: { text: string; kind?: "success" | "warning" | "danger" | "info" | "neutral" }) {
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
        padding: "4px 10px",
        borderRadius: 999,
        border: `1px solid ${styles.border}`,
        background: styles.background,
        color: styles.color,
        fontSize: 12,
        fontWeight: 700,
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
      }}
    >
      {props.children}
    </div>
  );
}

function EmptyState(props: { title: string; text: string }) {
  return (
    <div
      style={{
        border: "1px dashed #d1d5db",
        borderRadius: 16,
        padding: 18,
        background: "#f9fafb",
      }}
    >
      <div style={{ fontSize: 14, fontWeight: 800, color: "#111827", marginBottom: 6 }}>{props.title}</div>
      <div style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.5 }}>{props.text}</div>
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

function getRelanceBadge(statut?: string | null) {
  switch ((statut || "").toUpperCase()) {
    case "ANNULEE":
      return <Badge text="Annulée" kind="danger" />;
    case "ENVOYEE":
      return <Badge text="Envoyée" kind="info" />;
    default:
      return <Badge text={statut || "—"} kind="neutral" />;
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
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(q);
    });
  }, [data, query]);

  const isLoading = state === "loading";

  return (
    <PageShell>
      <SectionTitle
        title="Historique des relances"
        subtitle="Consultez l’ensemble des relances envoyées, leur canal, leur statut et le dossier associé."
        right={
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <SmallButton onClick={() => navigate("/relances")}>Retour au tableau de bord</SmallButton>
            <SmallButton onClick={() => navigate("/relances/dossiers")}>Voir les dossiers</SmallButton>
            <SmallButton onClick={() => void loadData()} primary disabled={isLoading}>
              {isLoading ? "Actualisation..." : "Actualiser"}
            </SmallButton>
          </div>
        }
      />

      {state === "error" && error ? (
        <AlertBox kind="error">
          <div style={{ fontWeight: 900, marginBottom: 4 }}>Chargement impossible</div>
          <div>{error}</div>
        </AlertBox>
      ) : null}

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher : copropriétaire, lot, appel, canal, objet..."
          style={searchInput}
        />

        <div style={{ color: "#6b7280", fontSize: 13, fontWeight: 600 }}>
          {isLoading ? "Chargement..." : `${filtered.length} relance(s) affichée(s)`}
        </div>
      </div>

      <div style={tableWrap}>
        {isLoading ? (
          <div style={{ padding: 16, color: "#6b7280" }}>Chargement des relances…</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 16 }}>
            <EmptyState
              title="Aucune relance trouvée"
              text="Aucune relance ne remonte pour le moment ou aucune ne correspond à la recherche."
            />
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left" }}>
                <th style={th}>Lot</th>
                <th style={th}>Copropriétaire</th>
                <th style={th}>Appel</th>
                <th style={th}>Canal</th>
                <th style={th}>Niveau</th>
                <th style={th}>Montant</th>
                <th style={th}>Date envoi</th>
                <th style={th}>État</th>
                <th style={th}>Action</th>
              </tr>
            </thead>

            <tbody>
              {filtered.map((r) => (
                <tr key={r.id}>
                  <td style={tdStrong}>{r.lot_numero || "—"}</td>
                  <td style={td}>{r.coproprietaire_nom || "—"}</td>
                  <td style={td}>{r.appel_reference || "—"}</td>
                  <td style={td}>{r.canal || "—"}</td>
                  <td style={td}>{r.niveau ?? "—"}</td>
                  <td style={td}>{formatMoneyFCFA(r.montant_du_message)}</td>
                  <td style={td}>{formatDateTimeShort(r.date_envoi)}</td>
                  <td style={td}>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {getRelanceBadge(r.statut)}
                      {r.annulee_at ? <Badge text="Annulation tracée" kind="danger" /> : null}
                    </div>
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
              ))}
            </tbody>
          </table>
        )}
      </div>
    </PageShell>
  );
}

const searchInput: CSSProperties = {
  minWidth: 320,
  padding: "11px 12px",
  borderRadius: 12,
  border: "1px solid #e5e7eb",
  background: "#fff",
  color: "#111827",
  fontSize: 14,
  outline: "none",
};

const tableWrap: CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 20,
  overflowX: "auto",
  background: "#fff",
  boxShadow: "0 10px 30px rgba(15, 23, 42, 0.04)",
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