import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../../api/axios";
import { ENDPOINTS } from "../../api/endpoints";

type LoadState = "idle" | "loading" | "success" | "error";
type BadgeKind = "neutral" | "success" | "warning" | "danger" | "info";
type ButtonVariant = "primary" | "secondary" | "danger";
type FlashKind = "success" | "error" | "info";

type DRFPage<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

type FournisseurRaw = Record<string, unknown>;

type FournisseurView = {
  id: number;
  nom: string;
  email: string | null;
  telephone: string | null;
  adresse: string | null;
  specialite: string | null;
  actif: boolean | null;
  createdAt?: string | null;
};

function isDRFPage<T>(x: unknown): x is DRFPage<T> {
  return Boolean(
    x &&
      typeof x === "object" &&
      Array.isArray((x as DRFPage<T>).results) &&
      typeof (x as DRFPage<T>).count === "number",
  );
}

function asArray<T = unknown>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

function toNumberOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function cleanText(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s ? s : null;
}

function fmtDate(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString("fr-FR");
}

function truncateText(value?: string | null, max = 64) {
  if (!value) return "—";
  const s = String(value).trim();
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}

function getErrorMessage(e: unknown, fallback: string) {
  const err = e as {
    response?: {
      data?: {
        detail?: string;
        message?: string;
        non_field_errors?: string[];
        [key: string]: unknown;
      };
    };
    message?: string;
  };

  const data = err?.response?.data;
  if (data && typeof data === "object") {
    if (typeof data.detail === "string" && data.detail.trim()) return data.detail;
    if (typeof data.message === "string" && data.message.trim()) return data.message;
    if (Array.isArray(data.non_field_errors) && data.non_field_errors.length) {
      return data.non_field_errors.join("\n");
    }
  }

  return err?.message || fallback;
}

function extractNom(raw: FournisseurRaw, id: number) {
  return cleanText(raw.nom) ?? `Fournisseur #${id}`;
}

function extractEmail(raw: FournisseurRaw) {
  return cleanText(raw.email);
}

function extractTelephone(raw: FournisseurRaw) {
  return cleanText(raw.telephone);
}

function extractAdresse(raw: FournisseurRaw) {
  return cleanText(raw.adresse);
}

function extractSpecialite(raw: FournisseurRaw) {
  return cleanText(raw.specialite);
}

function extractActif(raw: FournisseurRaw) {
  const possibleKeys = ["is_active", "actif", "active", "isActive"] as const;

  for (const key of possibleKeys) {
    const value = raw[key];
    if (typeof value === "boolean") return value;
  }

  return null;
}

function normalizeFournisseur(raw: FournisseurRaw): FournisseurView {
  const id = toNumberOrNull(raw.id) ?? 0;

  return {
    id,
    nom: extractNom(raw, id),
    email: extractEmail(raw),
    telephone: extractTelephone(raw),
    adresse: extractAdresse(raw),
    specialite: extractSpecialite(raw),
    actif: extractActif(raw),
    createdAt: cleanText(raw.created_at),
  };
}

function humanizeActif(value: boolean | null) {
  if (value === true) return "Actif";
  if (value === false) return "Inactif";
  return "Non renseigné";
}

function getActifKind(value: boolean | null): BadgeKind {
  if (value === true) return "success";
  if (value === false) return "danger";
  return "neutral";
}

function PageShell({ children }: { children: ReactNode }) {
  return <div style={{ display: "grid", gap: 16 }}>{children}</div>;
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
      <div>
        <div
          style={{
            fontSize: 30,
            fontWeight: 900,
            letterSpacing: -0.5,
            color: "#111827",
            lineHeight: 1.1,
          }}
        >
          {props.title}
        </div>
        {props.subtitle ? (
          <div style={{ marginTop: 8, color: "#6b7280", fontSize: 14, lineHeight: 1.5, maxWidth: 920 }}>
            {props.subtitle}
          </div>
        ) : null}
      </div>

      {props.right ? <div>{props.right}</div> : null}
    </div>
  );
}

function StatCard(props: { title: string; value: string | number; sub?: string }) {
  return (
    <div
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 20,
        padding: 16,
        background: "#fff",
        boxShadow: "0 10px 30px rgba(15, 23, 42, 0.04)",
      }}
    >
      <div style={{ fontSize: 13, color: "#6b7280", fontWeight: 700, marginBottom: 8 }}>
        {props.title}
      </div>
      <div
        style={{
          fontSize: 28,
          fontWeight: 900,
          color: "#111827",
          letterSpacing: -0.4,
          lineHeight: 1.1,
        }}
      >
        {props.value}
      </div>
      {props.sub ? (
        <div style={{ marginTop: 8, fontSize: 12, color: "#6b7280", lineHeight: 1.45 }}>
          {props.sub}
        </div>
      ) : null}
    </div>
  );
}

function AlertBox(props: { kind: FlashKind; title?: string; children: ReactNode }) {
  const tone =
    props.kind === "error"
      ? { bg: "#fef2f2", border: "#fecaca", text: "#991b1b" }
      : props.kind === "success"
        ? { bg: "#ecfdf5", border: "#a7f3d0", text: "#166534" }
        : { bg: "#eff6ff", border: "#bfdbfe", text: "#1d4ed8" };

  return (
    <div
      style={{
        padding: 14,
        borderRadius: 16,
        background: tone.bg,
        border: `1px solid ${tone.border}`,
        color: tone.text,
        whiteSpace: "pre-wrap",
        lineHeight: 1.5,
      }}
    >
      {props.title ? <div style={{ fontWeight: 900, marginBottom: 4 }}>{props.title}</div> : null}
      <div style={{ fontSize: 13 }}>{props.children}</div>
    </div>
  );
}

function AppButton(props: {
  children: ReactNode;
  to?: string;
  onClick?: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
}) {
  const variant = props.variant ?? "secondary";

  const styles =
    variant === "primary"
      ? {
          border: "1px solid #c7d2fe",
          background: "#eef2ff",
          color: "#3730a3",
        }
      : variant === "danger"
        ? {
            border: "1px solid #fecaca",
            background: "#fef2f2",
            color: "#991b1b",
          }
        : {
            border: "1px solid #e5e7eb",
            background: "#fff",
            color: "#111827",
          };

  if (props.to) {
    return (
      <Link
        to={props.to}
        style={{
          border: styles.border,
          background: styles.background,
          color: styles.color,
          borderRadius: 12,
          padding: "10px 14px",
          fontSize: 13,
          fontWeight: 800,
          textDecoration: "none",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          whiteSpace: "nowrap",
        }}
      >
        {props.children}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={props.onClick}
      disabled={props.disabled}
      style={{
        border: styles.border,
        background: props.disabled ? "#f9fafb" : styles.background,
        color: props.disabled ? "#9ca3af" : styles.color,
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

function EmptyState(props: { title: string; text: string; actionLabel?: string; actionTo?: string }) {
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
      <div style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.5 }}>{props.text}</div>

      {props.actionLabel && props.actionTo ? (
        <div style={{ marginTop: 12 }}>
          <AppButton to={props.actionTo} variant="primary">
            {props.actionLabel}
          </AppButton>
        </div>
      ) : null}
    </div>
  );
}

function Badge(props: { text: string; kind?: BadgeKind }) {
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
        fontSize: 12,
        fontWeight: 800,
        whiteSpace: "nowrap",
        border: `1px solid ${styles.border}`,
        background: styles.background,
        color: styles.color,
      }}
    >
      {props.text}
    </span>
  );
}

function MetaLine(props: { children: ReactNode }) {
  return (
    <div
      style={{
        marginTop: 4,
        fontSize: 12,
        color: "#6b7280",
        lineHeight: 1.45,
      }}
    >
      {props.children}
    </div>
  );
}

export default function TravauxFournisseurs() {
  const navigate = useNavigate();

  const [state, setState] = useState<LoadState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<FournisseurView[]>([]);

  const [query, setQuery] = useState("");
  const [actifFilter, setActifFilter] = useState<string>("TOUS");

  async function fetchData() {
    setState("loading");
    setError(null);

    try {
      const res = await api.get(ENDPOINTS.travauxFournisseurs);
      const data = res?.data;
      const items = isDRFPage<FournisseurRaw>(data) ? data.results : asArray<FournisseurRaw>(data);

      setRows(items.map(normalizeFournisseur));
      setState("success");
    } catch (e) {
      setState("error");
      setError(getErrorMessage(e, "Impossible de charger les fournisseurs."));
      setRows([]);
    }
  }

  useEffect(() => {
    void fetchData();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    return rows.filter((item) => {
      const matchActif =
        actifFilter === "TOUS"
          ? true
          : actifFilter === "ACTIF"
            ? item.actif === true
            : actifFilter === "INACTIF"
              ? item.actif === false
              : item.actif === null;

      const haystack = [item.nom, item.email ?? "", item.telephone ?? "", item.adresse ?? "", item.specialite ?? "", String(item.id)]
        .join(" ")
        .toLowerCase();

      const matchQuery = !q ? true : haystack.includes(q);
      return matchActif && matchQuery;
    });
  }, [rows, query, actifFilter]);

  const stats = useMemo(() => {
    const total = filtered.length;
    const actifs = filtered.filter((x) => x.actif === true).length;
    const inactifs = filtered.filter((x) => x.actif === false).length;
    const nonRenseignes = filtered.filter((x) => x.actif === null).length;
    return { total, actifs, inactifs, nonRenseignes };
  }, [filtered]);

  const isLoading = state === "loading";
  const hasRows = rows.length > 0;
  const hasFilters = query.trim().length > 0 || actifFilter !== "TOUS";

  return (
    <PageShell>
      <SectionTitle
        title="Fournisseurs"
        subtitle="Consultez les prestataires enregistrés dans le module Travaux, recherchez rapidement un fournisseur et accédez à sa fiche de modification."
        right={
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <AppButton onClick={() => navigate("/travaux/dossiers")} variant="secondary">
              Retour aux dossiers
            </AppButton>
            <AppButton to="/travaux/fournisseurs/nouveau" variant="primary">
              Nouveau fournisseur
            </AppButton>
          </div>
        }
      />

      <div
        className="travaux-fournisseurs-stats-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
          gap: 14,
        }}
      >
        <StatCard title="Fournisseurs affichés" value={stats.total} sub="Résultats visibles après filtres." />
        <StatCard title="Actifs" value={stats.actifs} sub="Prestataires disponibles pour l’exploitation." />
        <StatCard title="Inactifs" value={stats.inactifs} sub="Prestataires désactivés ou suspendus." />
        <StatCard title="Statut non renseigné" value={stats.nonRenseignes} sub="Fiches à compléter côté données." />
      </div>

      {state === "error" && error ? (
        <AlertBox kind="error" title="Impossible de charger les fournisseurs.">
          {error}
        </AlertBox>
      ) : null}

      <div style={toolbar}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", flex: 1 }}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher par nom, spécialité, téléphone, email ou identifiant..."
            style={input}
          />

          <select value={actifFilter} onChange={(e) => setActifFilter(e.target.value)} style={selectInput}>
            <option value="TOUS">Tous les états</option>
            <option value="ACTIF">Actifs</option>
            <option value="INACTIF">Inactifs</option>
            <option value="INCONNU">Statut non renseigné</option>
          </select>

          <AppButton onClick={() => void fetchData()} disabled={isLoading} variant="secondary">
            {isLoading ? "Actualisation..." : "Actualiser"}
          </AppButton>
        </div>

        <div style={{ color: "#6b7280", fontSize: 13, fontWeight: 600 }}>
          {isLoading ? "Chargement des fournisseurs..." : `${filtered.length} fournisseur(s) affiché(s) sur ${rows.length}`}
        </div>
      </div>

      <div style={tableWrap}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "left" }}>
              <th style={th}>Fournisseur</th>
              <th style={th}>Spécialité</th>
              <th style={th}>Téléphone</th>
              <th style={th}>Email</th>
              <th style={th}>État</th>
              <th style={th}>Créé le</th>
              <th style={th}>Actions</th>
            </tr>
          </thead>

          <tbody>
            {isLoading ? (
              <tr>
                <td style={td} colSpan={7}>
                  <span style={{ color: "#6b7280" }}>Chargement des fournisseurs...</span>
                </td>
              </tr>
            ) : null}

            {!isLoading &&
              filtered.map((item) => (
                <tr key={item.id}>
                  <td style={td}>
                    <div style={{ display: "grid", gap: 4 }}>
                      <div style={{ fontWeight: 800, color: "#111827", fontSize: 14 }}>{truncateText(item.nom, 42)}</div>

                      <MetaLine>
                        ID fournisseur : <span style={{ fontWeight: 800, color: "#374151" }}>#{item.id}</span>
                      </MetaLine>

                      <MetaLine>{truncateText(item.adresse, 58)}</MetaLine>
                    </div>
                  </td>

                  <td style={td}>
                    {item.specialite ? (
                      <Badge text={truncateText(item.specialite, 30)} kind="neutral" />
                    ) : (
                      <span style={{ color: "#9ca3af" }}>Non renseignée</span>
                    )}
                  </td>

                  <td style={td}>{item.telephone || "—"}</td>
                  <td style={td}>{item.email || "—"}</td>

                  <td style={td}>
                    <Badge text={humanizeActif(item.actif)} kind={getActifKind(item.actif)} />
                  </td>

                  <td style={td}>{fmtDate(item.createdAt)}</td>

                  <td style={td}>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <Link to={`/travaux/fournisseurs/${item.id}/modifier`} style={primaryMiniLink}>
                        Modifier
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}

            {!isLoading && filtered.length === 0 ? (
              <tr>
                <td style={td} colSpan={7}>
                  {!hasRows ? (
                    <EmptyState
                      title="Aucun fournisseur enregistré"
                      text="Le module Travaux ne contient encore aucun fournisseur. Vous pouvez créer la première fiche fournisseur pour démarrer la gestion des prestataires."
                      actionLabel="Nouveau fournisseur"
                      actionTo="/travaux/fournisseurs/nouveau"
                    />
                  ) : hasFilters ? (
                    <EmptyState
                      title="Aucun résultat"
                      text="Aucun fournisseur ne correspond aux filtres ou à la recherche en cours. Ajustez vos critères pour afficher d’autres fiches."
                      actionLabel="Nouveau fournisseur"
                      actionTo="/travaux/fournisseurs/nouveau"
                    />
                  ) : (
                    <EmptyState
                      title="Aucun fournisseur à afficher"
                      text="Aucune donnée fournisseur n’est disponible pour le moment."
                      actionLabel="Nouveau fournisseur"
                      actionTo="/travaux/fournisseurs/nouveau"
                    />
                  )}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {state === "success" && rows.length > 0 ? (
        <AlertBox kind="info" title="Lecture métier du sous-module">
          Ce sous-module centralise la gestion des prestataires. Une liaison directe entre un dossier travaux et un fournisseur principal pourra être ajoutée plus tard sans bloquer l’usage actuel.
        </AlertBox>
      ) : null}

      <style>{`
        @media (max-width: 1180px) {
          .travaux-fournisseurs-stats-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }
        }

        @media (max-width: 860px) {
          table {
            min-width: 920px;
          }
        }

        @media (max-width: 680px) {
          .travaux-fournisseurs-stats-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </PageShell>
  );
}

const toolbar: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
  alignItems: "center",
};

const input: CSSProperties = {
  width: 380,
  maxWidth: "100%",
  padding: "11px 12px",
  borderRadius: 12,
  border: "1px solid #e5e7eb",
  background: "#fff",
  color: "#111827",
  fontSize: 13,
  boxSizing: "border-box",
};

const selectInput: CSSProperties = {
  padding: "11px 12px",
  borderRadius: 12,
  border: "1px solid #e5e7eb",
  background: "#fff",
  color: "#111827",
  fontWeight: 700,
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
  verticalAlign: "middle",
  color: "#111827",
  fontSize: 14,
};

const miniLink: CSSProperties = {
  padding: "7px 10px",
  borderRadius: 10,
  border: "1px solid #e5e7eb",
  background: "#fff",
  fontSize: 12,
  fontWeight: 700,
  color: "#111827",
  textDecoration: "none",
  display: "inline-flex",
  alignItems: "center",
};

const primaryMiniLink: CSSProperties = {
  ...miniLink,
  border: "1px solid #c7d2fe",
  background: "#eef2ff",
  color: "#3730a3",
};