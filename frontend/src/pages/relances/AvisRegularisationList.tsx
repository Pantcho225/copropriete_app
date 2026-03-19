import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { relancesAPI } from "../../api/relances";
import { APP_TEXT } from "../../config/appText";

type LoadState = "idle" | "loading" | "success" | "error";

type AvisItem = {
  id: number;
  dossier?: number | null;
  lot_numero?: string | null;
  coproprietaire_nom?: string | null;
  appel_reference?: string | null;
  montant_initial?: number | string | null;
  montant_total_regle?: number | string | null;
  date_regularisation?: string | null;
  canal?: string | null;
  statut?: string | null;
  message?: string | null;
  genere_par_username?: string | null;
  envoye_at?: string | null;
  motif_echec?: string | null;
  document_pdf?: string | null;
};

const CANAL_LABELS: Record<string, string> = {
  INTERNE: "Interne",
  EMAIL: "Email",
  SMS: "SMS",
  WHATSAPP: "WhatsApp",
  COURRIER: "Courrier",
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

function getCanalLabel(canal?: string | null): string {
  const key = String(canal ?? "").trim().toUpperCase();
  return CANAL_LABELS[key] || canal || "—";
}

function getCanalBadge(canal?: string | null) {
  const key = String(canal ?? "").trim().toUpperCase();

  switch (key) {
    case "EMAIL":
      return <Badge text="Email" kind="info" />;
    case "SMS":
      return <Badge text="SMS" kind="warning" />;
    case "WHATSAPP":
      return <Badge text="WhatsApp" kind="success" />;
    case "COURRIER":
      return <Badge text="Courrier" kind="neutral" />;
    case "INTERNE":
      return <Badge text="Interne" kind="neutral" />;
    default:
      return <Badge text={getCanalLabel(canal)} kind="neutral" />;
  }
}

function getAvisBadge(statut?: string | null) {
  switch (normalizeStatut(statut)) {
    case "ECHEC":
      return <Badge text="Échec" kind="danger" />;
    case "ENVOYE":
      return <Badge text="Envoyé" kind="info" />;
    case "GENERE":
      return <Badge text="Généré" kind="success" />;
    case "ANNULE":
      return <Badge text="Annulé" kind="danger" />;
    default:
      return <Badge text={statut || "—"} kind="neutral" />;
  }
}

export default function AvisRegularisationList() {
  const navigate = useNavigate();

  const [state, setState] = useState<LoadState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AvisItem[]>([]);
  const [query, setQuery] = useState("");

  async function loadData() {
    setState("loading");
    setError(null);

    try {
      const rows = (await relancesAPI.getAvis()) as AvisItem[];
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

    return data.filter((a) => {
      const haystack = [
        a.coproprietaire_nom ?? "",
        a.lot_numero ?? "",
        a.appel_reference ?? "",
        a.canal ?? "",
        a.statut ?? "",
        a.message ?? "",
        a.genere_par_username ?? "",
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(q);
    });
  }, [data, query]);

  const stats = useMemo(() => {
    const total = filtered.length;
    const totalRegle = filtered.reduce((sum, item) => {
      const value = Number(item.montant_total_regle ?? 0);
      return sum + (Number.isFinite(value) ? value : 0);
    }, 0);
    const envoyes = filtered.filter((item) => normalizeStatut(item.statut) === "ENVOYE").length;
    const generes = filtered.filter((item) => normalizeStatut(item.statut) === "GENERE").length;
    const echecs = filtered.filter(
      (item) => normalizeStatut(item.statut) === "ECHEC" || Boolean(item.motif_echec)
    ).length;

    return {
      total,
      totalRegle,
      envoyes,
      generes,
      echecs,
    };
  }, [filtered]);

  const isLoading = state === "loading";
  const hasData = filtered.length > 0;

  return (
    <PageShell>
      <SectionTitle
        title="Avis de régularisation"
        subtitle="Consultez les avis générés après régularisation d’un dossier, contrôlez leur statut, leur canal d’émission et retrouvez rapidement le dossier concerné."
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
          label="Avis affichés"
          value={String(stats.total)}
          hint="Nombre d’avis visibles selon la recherche en cours."
        />
        <KpiCard
          label="Montant régularisé"
          value={formatMoneyFCFA(stats.totalRegle)}
          hint="Montant cumulé réglé sur les avis affichés."
        />
        <KpiCard
          label="Envoyés"
          value={String(stats.envoyes)}
          hint="Avis déjà envoyés et tracés dans la vue courante."
        />
        <KpiCard
          label="Échecs"
          value={String(stats.echecs)}
          hint="Avis en échec ou comportant un motif d’échec enregistré."
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
              placeholder="Rechercher par copropriétaire, lot, appel, canal, statut, message ou émetteur..."
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
              {stats.generes > 0
                ? `${stats.generes} avis généré(s) dans cette vue`
                : "Aucun avis généré dans cette vue"}
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
              title={APP_TEXT.emptyStates.noAvis}
              text="Aucun avis ne remonte pour le moment ou aucun résultat ne correspond à votre recherche actuelle."
            />
          </div>
        ) : (
          <div style={tableWrap}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ textAlign: "left" }}>
                  <th style={th}>Lot</th>
                  <th style={th}>Copropriétaire</th>
                  <th style={th}>Appel de fonds</th>
                  <th style={th}>Montant initial</th>
                  <th style={th}>Montant réglé</th>
                  <th style={th}>Date de régularisation</th>
                  <th style={th}>Canal</th>
                  <th style={th}>État</th>
                  <th style={th}>Action</th>
                </tr>
              </thead>

              <tbody>
                {filtered.map((a) => (
                  <tr key={a.id} style={{ background: "#ffffff" }}>
                    <td style={tdStrong}>{a.lot_numero || "—"}</td>
                    <td style={td}>{a.coproprietaire_nom || "—"}</td>
                    <td style={td}>{a.appel_reference || "—"}</td>
                    <td style={td}>{formatMoneyFCFA(a.montant_initial)}</td>
                    <td style={tdStrong}>{formatMoneyFCFA(a.montant_total_regle)}</td>
                    <td style={td}>{formatDateTimeShort(a.date_regularisation)}</td>

                    <td style={td}>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {getCanalBadge(a.canal)}
                      </div>
                    </td>

                    <td style={td}>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {getAvisBadge(a.statut)}
                        {a.envoye_at ? <Badge text="Envoi tracé" kind="info" /> : null}
                        {a.motif_echec ? <Badge text="Motif d’échec" kind="danger" /> : null}
                      </div>

                      {(a.genere_par_username || a.motif_echec) ? (
                        <div style={{ marginTop: 6, fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>
                          {a.genere_par_username ? `Généré par ${a.genere_par_username}` : null}
                          {a.genere_par_username && a.motif_echec ? " • " : null}
                          {a.motif_echec ? `Motif : ${a.motif_echec}` : null}
                        </div>
                      ) : null}
                    </td>

                    <td style={td}>
                      {a.dossier ? (
                        <SmallButton onClick={() => navigate(`/relances/dossiers/${a.dossier}`)} primary>
                          Ouvrir le dossier
                        </SmallButton>
                      ) : a.document_pdf ? (
                        <SmallButton onClick={() => window.open(a.document_pdf as string, "_blank")} primary>
                          Ouvrir le PDF
                        </SmallButton>
                      ) : (
                        <span style={{ color: "#9ca3af", fontSize: 13 }}>—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <AlertBox kind="info" title="Lecture métier">
        Cette vue permet de suivre les avis émis après régularisation d’un impayé, de vérifier le montant effectivement réglé, de contrôler l’état d’envoi et de retrouver rapidement le dossier ou le document concerné.
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