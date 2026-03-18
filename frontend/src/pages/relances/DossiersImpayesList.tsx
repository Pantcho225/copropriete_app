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
        <div
          style={{
            fontSize: 28,
            fontWeight: 900,
            color: "#111827",
            lineHeight: 1.1,
            letterSpacing: -0.4,
          }}
        >
          {props.title}
        </div>
        {props.subtitle ? (
          <div
            style={{
              marginTop: 6,
              color: "#6b7280",
              fontSize: 14,
              lineHeight: 1.5,
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

function SmallButton(props: {
  children: ReactNode;
  onClick?: () => void;
  primary?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={props.disabled}
      onClick={props.onClick}
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
        alignItems: "center",
        justifyContent: "center",
        padding: "4px 10px",
        borderRadius: 999,
        border: `1px solid ${styles.border}`,
        background: styles.background,
        color: styles.color,
        fontSize: 12,
        fontWeight: 700,
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
      <div style={{ fontSize: 14, fontWeight: 800, color: "#111827", marginBottom: 6 }}>
        {props.title}
      </div>
      <div style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.5 }}>
        {props.text}
      </div>
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
      setError(
        e?.response?.data?.detail ||
          e?.message ||
          APP_TEXT.errors.loadFailed
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

    return data.filter((d) => {
      const haystack = [
        d.lot_numero ?? "",
        d.coproprietaire_nom ?? "",
        d.appel_reference ?? "",
        d.reference_appel ?? "",
        d.statut ?? "",
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
        title="Dossiers impayés"
        subtitle="Consultez les dossiers en retard ou non soldés, leur statut, le niveau de relance et le reste à payer."
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
        <AlertBox kind="error">
          <div style={{ fontWeight: 900, marginBottom: 4 }}>Chargement impossible</div>
          <div style={{ lineHeight: 1.5 }}>{error}</div>
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
          placeholder="Rechercher : lot, copropriétaire, appel ou statut..."
          style={searchInput}
        />

        <div style={{ color: "#6b7280", fontSize: 13, fontWeight: 600 }}>
          {isLoading ? APP_TEXT.common.loading : `${filtered.length} dossier(s) affiché(s)`}
        </div>
      </div>

      <div style={tableWrap}>
        {isLoading ? (
          <div style={{ padding: 16, color: "#6b7280" }}>
            Chargement des dossiers impayés…
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 16 }}>
            <EmptyState
              title={APP_TEXT.emptyStates.noDossierImpaye}
              text="Aucun dossier ne remonte pour le moment ou aucun résultat ne correspond à votre recherche."
            />
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left" }}>
                <th style={th}>Lot</th>
                <th style={th}>Copropriétaire</th>
                <th style={th}>Appel</th>
                <th style={th}>Échéance</th>
                <th style={th}>Montant initial</th>
                <th style={th}>Payé</th>
                <th style={th}>Reste à payer</th>
                <th style={th}>Statut</th>
                <th style={th}>Relances</th>
                <th style={th}>Action</th>
              </tr>
            </thead>

            <tbody>
              {filtered.map((d) => (
                <tr key={d.id}>
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
                      {d.est_regularise ? <Badge text="Régularisé" kind="success" /> : null}
                    </div>
                  </td>
                  <td style={td}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <Badge text={`Niveau ${d.niveau_relance || 0}`} kind="warning" />
                      <span style={{ fontSize: 12, color: "#6b7280" }}>
                        {d.relances_count || 0} relance(s)
                      </span>
                    </div>
                  </td>
                  <td style={td}>
                    <SmallButton onClick={() => navigate(`/relances/dossiers/${d.id}`)} primary>
                      Ouvrir
                    </SmallButton>
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