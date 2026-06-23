import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../../api/axios";
import { ENDPOINTS } from "../../api/endpoints";
import ModuleHero from "../../components/ui/ModuleHero";
import ModuleStatCard from "../../components/ui/ModuleStatCard";

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

    try {
      const entries = Object.entries(data).filter(
        ([key]) => key !== "detail" && key !== "message" && key !== "non_field_errors",
      );

      if (entries.length) {
        return entries
          .map(([key, value]) => {
            if (Array.isArray(value)) return `${key}: ${value.join(" / ")}`;
            if (typeof value === "string") return `${key}: ${value}`;

            return `${key}: ${JSON.stringify(value)}`;
          })
          .join("\n");
      }
    } catch {
      return err?.message || fallback;
    }
  }

  return err?.message || fallback;
}

function extractNom(raw: FournisseurRaw, id: number) {
  return (
    cleanText(raw.nom) ??
    cleanText(raw.raison_sociale) ??
    cleanText(raw.name) ??
    `Prestataire #${id}`
  );
}

function extractEmail(raw: FournisseurRaw) {
  return cleanText(raw.email) ?? cleanText(raw.mail);
}

function extractTelephone(raw: FournisseurRaw) {
  return cleanText(raw.telephone) ?? cleanText(raw.tel) ?? cleanText(raw.phone);
}

function extractAdresse(raw: FournisseurRaw) {
  return cleanText(raw.adresse) ?? cleanText(raw.address);
}

function extractSpecialite(raw: FournisseurRaw) {
  return (
    cleanText(raw.specialite) ??
    cleanText(raw.domaine) ??
    cleanText(raw.type_intervention)
  );
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
  const id = toNumberOrNull(raw.id) ?? toNumberOrNull(raw.pk) ?? 0;

  return {
    id,
    nom: extractNom(raw, id),
    email: extractEmail(raw),
    telephone: extractTelephone(raw),
    adresse: extractAdresse(raw),
    specialite: extractSpecialite(raw),
    actif: extractActif(raw),
    createdAt: cleanText(raw.created_at ?? raw.date_creation),
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

function getTone(kind: BadgeKind) {
  if (kind === "success") {
    return {
      softBg: "#ecfdf5",
      border: "#86efac",
      text: "#166534",
      strongText: "#14532d",
    };
  }

  if (kind === "info") {
    return {
      softBg: "#eff6ff",
      border: "#93c5fd",
      text: "#1d4ed8",
      strongText: "#1e3a8a",
    };
  }

  if (kind === "warning") {
    return {
      softBg: "#fffbeb",
      border: "#fcd34d",
      text: "#92400e",
      strongText: "#78350f",
    };
  }

  if (kind === "danger") {
    return {
      softBg: "#fef2f2",
      border: "#fca5a5",
      text: "#991b1b",
      strongText: "#7f1d1d",
    };
  }

  return {
    softBg: "#f8fafc",
    border: "#e2e8f0",
    text: "#475569",
    strongText: "#0f172a",
  };
}

function toModuleStatTone(kind?: BadgeKind) {
  if (kind === "success") return "green";
  if (kind === "info") return "blue";
  if (kind === "warning") return "amber";
  if (kind === "danger") return "red";
  return "neutral";
}

function PageShell({ children }: { children: ReactNode }) {
  return <div style={pageShell}>{children}</div>;
}

function HeroHeader(props: { title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <ModuleHero
      eyebrow="Travaux · Prestataires"
      title={props.title}
      subtitle={props.subtitle}
      actions={props.right}
    />
  );
}

function Panel(props: { children: ReactNode; style?: CSSProperties }) {
  return (
    <section
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 22,
        background: "#ffffff",
        boxShadow: "0 16px 40px rgba(15, 23, 42, 0.05)",
        minWidth: 0,
        ...props.style,
      }}
    >
      {props.children}
    </section>
  );
}

function StatCard(props: {
  title: string;
  value: string | number;
  sub?: string;
  kind?: BadgeKind;
}) {
  return (
    <ModuleStatCard
      label={props.title}
      value={props.value}
      hint={props.sub}
      tone={toModuleStatTone(props.kind)}
    />
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
        lineHeight: 1.55,
        minWidth: 0,
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
          border: "1px solid #93c5fd",
          background: "#dbeafe",
          color: "#1e3a8a",
        }
      : variant === "danger"
        ? {
            border: "1px solid #fecaca",
            background: "#fef2f2",
            color: "#991b1b",
          }
        : {
            border: "1px solid #cbd5e1",
            background: "#fff",
            color: "#111827",
          };

  if (props.to) {
    return (
      <Link
        to={props.to}
        aria-disabled={props.disabled}
        onClick={(e) => {
          if (props.disabled) e.preventDefault();
        }}
        style={{
          border: styles.border,
          background: props.disabled ? "#f9fafb" : styles.background,
          color: props.disabled ? "#9ca3af" : styles.color,
          borderRadius: 12,
          padding: "10px 14px",
          fontSize: 12.5,
          fontWeight: 800,
          textDecoration: "none",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          whiteSpace: "nowrap",
          cursor: props.disabled ? "not-allowed" : "pointer",
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
        fontSize: 12.5,
        fontWeight: 800,
        cursor: props.disabled ? "not-allowed" : "pointer",
        whiteSpace: "nowrap",
      }}
    >
      {props.children}
    </button>
  );
}

function EmptyState(props: {
  title: string;
  text: string;
  actionLabel?: string;
  actionTo?: string;
}) {
  return (
    <div style={emptyState}>
      <div style={emptyStateTitle}>{props.title}</div>
      <div style={emptyStateText}>{props.text}</div>

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
  const tone = getTone(props.kind ?? "neutral");

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: 28,
        padding: "4px 10px",
        borderRadius: 999,
        fontSize: 11.5,
        fontWeight: 800,
        whiteSpace: "nowrap",
        border: `1px solid ${tone.border}`,
        background: tone.softBg,
        color: tone.text,
      }}
    >
      {props.text}
    </span>
  );
}

function MetaLine(props: { children: ReactNode }) {
  return <div style={metaLine}>{props.children}</div>;
}

function InfoStrip() {
  return (
    <div style={infoStrip}>
      <div style={infoStripText}>
        Cette vue affiche les prestataires actifs par défaut pour une lecture plus claire en
        démonstration. Les prestataires inactifs restent consultables avec le filtre d’état.
      </div>
    </div>
  );
}

export default function TravauxFournisseurs() {
  const navigate = useNavigate();

  const [state, setState] = useState<LoadState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<FournisseurView[]>([]);

  const [query, setQuery] = useState("");
  const [actifFilter, setActifFilter] = useState<string>("ACTIF");

  const fetchData = useCallback(async () => {
    setState("loading");
    setError(null);

    try {
      const res = await api.get(ENDPOINTS.travauxFournisseurs);
      const data = res?.data;
      const items = isDRFPage<FournisseurRaw>(data)
        ? data.results
        : asArray<FournisseurRaw>(data);

      const normalized = items.map(normalizeFournisseur).sort((a, b) => {
        const actifA = a.actif === true ? 0 : a.actif === false ? 1 : 2;
        const actifB = b.actif === true ? 0 : b.actif === false ? 1 : 2;

        if (actifA !== actifB) return actifA - actifB;

        return a.nom.localeCompare(b.nom, "fr", { sensitivity: "base" });
      });

      setRows(normalized);
      setState("success");
    } catch (e) {
      setState("error");
      setError(getErrorMessage(e, "Impossible de charger les prestataires."));
      setRows([]);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchData();
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [fetchData]);

  const handleRefresh = useCallback(() => {
    void fetchData();
  }, [fetchData]);

  const goToDossiers = useCallback(() => {
    navigate("/travaux/dossiers");
  }, [navigate]);

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

      const haystack = [
        item.nom,
        item.email ?? "",
        item.telephone ?? "",
        item.adresse ?? "",
        item.specialite ?? "",
        String(item.id),
        humanizeActif(item.actif),
      ]
        .join(" ")
        .toLowerCase();

      const matchQuery = !q ? true : haystack.includes(q);

      return matchActif && matchQuery;
    });
  }, [rows, query, actifFilter]);

  const globalStats = useMemo(() => {
    const total = rows.length;
    const actifs = rows.filter((x) => x.actif === true).length;
    const inactifs = rows.filter((x) => x.actif === false).length;
    const nonRenseignes = rows.filter((x) => x.actif === null).length;

    return { total, actifs, inactifs, nonRenseignes };
  }, [rows]);

  const displayStats = useMemo(() => {
    const total = filtered.length;
    const actifs = filtered.filter((x) => x.actif === true).length;
    const inactifs = filtered.filter((x) => x.actif === false).length;
    const nonRenseignes = filtered.filter((x) => x.actif === null).length;

    return { total, actifs, inactifs, nonRenseignes };
  }, [filtered]);

  const isLoading = state === "loading";
  const hasRows = rows.length > 0;
  const hasFilters = query.trim().length > 0 || actifFilter !== "ACTIF";

  const resultLabel = isLoading
    ? "Chargement des prestataires..."
    : hasFilters
      ? `${filtered.length} prestataire${filtered.length > 1 ? "s" : ""} affiché${
          filtered.length > 1 ? "s" : ""
        }`
      : `${filtered.length} prestataire${filtered.length > 1 ? "s" : ""} actif${
          filtered.length > 1 ? "s" : ""
        }`;

  return (
    <PageShell>
      <HeroHeader
        title="Prestataires"
        subtitle="Consultez les prestataires actifs du module Travaux, maintenez leurs coordonnées et gardez les archives accessibles sans encombrer la vue principale."
        right={
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <AppButton onClick={goToDossiers} variant="secondary">
              Retour aux dossiers
            </AppButton>

            <AppButton to="/travaux/fournisseurs/nouveau" variant="primary">
              Nouveau prestataire
            </AppButton>
          </div>
        }
      />

      <InfoStrip />

      <div className="moduleStatsGrid">
        <StatCard
          title="Affichés"
          value={displayStats.total}
          sub={`Total référentiel : ${globalStats.total}`}
          kind="neutral"
        />

        <StatCard
          title="Actifs"
          value={globalStats.actifs}
          sub="Prestataires exploitables en démo."
          kind="success"
        />

        <StatCard
          title="Archivés"
          value={globalStats.inactifs}
          sub="Masqués par défaut."
          kind="danger"
        />

        <StatCard
          title="Statut à compléter"
          value={globalStats.nonRenseignes}
          sub="Fiches à enrichir côté données."
          kind="warning"
        />
      </div>

      {state === "error" && error ? (
        <AlertBox kind="error" title="Impossible de charger les prestataires">
          {error}
        </AlertBox>
      ) : null}

      <Panel style={{ padding: 14 }}>
        <div style={toolbar}>
          <div style={toolbarControls}>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher par nom, spécialité, téléphone, email ou identifiant"
              style={input}
            />

            <select
              value={actifFilter}
              onChange={(e) => setActifFilter(e.target.value)}
              style={selectInput}
            >
              <option value="ACTIF">Actifs</option>
              <option value="TOUS">Tous les états</option>
              <option value="INACTIF">Inactifs / archivés</option>
              <option value="INCONNU">Statut non renseigné</option>
            </select>

            <AppButton onClick={handleRefresh} disabled={isLoading} variant="secondary">
              {isLoading ? "Actualisation..." : "Actualiser"}
            </AppButton>
          </div>

          <div style={resultsInfo}>{resultLabel}</div>
        </div>
      </Panel>

      <Panel style={{ overflow: "hidden" }}>
        <div style={tableWrap}>
          <table className="travaux-fournisseurs-table" style={tableStyle}>
            <thead>
              <tr style={{ textAlign: "left" }}>
                <th style={{ ...th, width: "28%" }}>Prestataire</th>
                <th style={{ ...th, width: "16%" }}>Spécialité</th>
                <th style={{ ...th, width: "14%" }}>Téléphone</th>
                <th style={{ ...th, width: "18%" }}>Email</th>
                <th style={{ ...th, width: "12%" }}>État</th>
                <th style={{ ...th, width: "12%" }}>Créé le</th>
                <th style={{ ...th, width: "12%" }}>Actions</th>
              </tr>
            </thead>

            <tbody>
              {isLoading ? (
                <tr>
                  <td style={td} colSpan={7}>
                    <span style={{ color: "#6b7280" }}>Chargement des prestataires...</span>
                  </td>
                </tr>
              ) : null}

              {!isLoading &&
                filtered.map((item) => (
                  <tr key={item.id}>
                    <td style={td}>
                      <div style={{ display: "grid", gap: 2, minWidth: 0 }}>
                        <div style={prestataireTitle}>{truncateText(item.nom, 42)}</div>

                        <MetaLine>
                          ID prestataire :{" "}
                          <span style={{ fontWeight: 800, color: "#374151" }}>#{item.id}</span>
                        </MetaLine>

                        {item.adresse ? (
                          <MetaLine>{truncateText(item.adresse, 58)}</MetaLine>
                        ) : (
                          <MetaLine>
                            <span style={{ color: "#9ca3af" }}>Aucune adresse renseignée.</span>
                          </MetaLine>
                        )}
                      </div>
                    </td>

                    <td style={td}>
                      {item.specialite ? (
                        <Badge text={truncateText(item.specialite, 28)} kind="neutral" />
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
                        title="Aucun prestataire enregistré"
                        text="Le module Travaux ne contient encore aucun prestataire. Créez une première fiche prestataire pour démarrer la gestion des intervenants."
                        actionLabel="Nouveau prestataire"
                        actionTo="/travaux/fournisseurs/nouveau"
                      />
                    ) : hasFilters ? (
                      <EmptyState
                        title="Aucun résultat"
                        text="Aucun prestataire ne correspond aux filtres ou à la recherche en cours. Ajustez vos critères pour poursuivre."
                        actionLabel="Nouveau prestataire"
                        actionTo="/travaux/fournisseurs/nouveau"
                      />
                    ) : (
                      <EmptyState
                        title="Aucun prestataire à afficher"
                        text="Aucune donnée prestataire n’est disponible pour le moment."
                        actionLabel="Nouveau prestataire"
                        actionTo="/travaux/fournisseurs/nouveau"
                      />
                    )}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Panel>

      {state === "success" && rows.length > 0 ? (
        <AlertBox kind="info" title="Lecture métier">
          Les prestataires actifs sont affichés en priorité pour garder une vue claire en exploitation.
          Les archives restent disponibles depuis le filtre “Inactifs / archivés” ou “Tous les états”.
        </AlertBox>
      ) : null}

      <style>{`
        @media (max-width: 1180px) {
          .travaux-fournisseurs-stats-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }
        }

        @media (max-width: 860px) {
          .travaux-fournisseurs-table {
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

const pageShell: CSSProperties = {
  display: "grid",
  gap: 18,
  width: "100%",
  minWidth: 0,
};

const infoStrip: CSSProperties = {
  border: "1px solid #bfdbfe",
  background: "#eff6ff",
  borderRadius: 18,
  padding: "14px 16px",
  minWidth: 0,
};

const infoStripText: CSSProperties = {
  fontSize: 13,
  color: "#1d4ed8",
  lineHeight: 1.6,
  fontWeight: 600,
};

const toolbar: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
  alignItems: "center",
  minWidth: 0,
};

const toolbarControls: CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
  alignItems: "center",
  flex: 1,
  minWidth: 0,
};

const resultsInfo: CSSProperties = {
  color: "#6b7280",
  fontSize: 12.5,
  fontWeight: 700,
  whiteSpace: "nowrap",
};

const input: CSSProperties = {
  width: 360,
  maxWidth: "100%",
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid #e5e7eb",
  background: "#fff",
  color: "#111827",
  fontSize: 13,
  boxSizing: "border-box",
};

const selectInput: CSSProperties = {
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid #e5e7eb",
  background: "#fff",
  color: "#111827",
  fontWeight: 700,
  fontSize: 13,
};

const tableWrap: CSSProperties = {
  overflowX: "auto",
  background: "#fff",
  width: "100%",
  minWidth: 0,
};

const tableStyle: CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  minWidth: 920,
};

const th: CSSProperties = {
  padding: "12px 12px",
  borderBottom: "1px solid #e5e7eb",
  whiteSpace: "nowrap",
  fontSize: 11.5,
  color: "#6b7280",
  background: "#f8fafc",
  fontWeight: 800,
  textTransform: "uppercase",
  letterSpacing: 0.28,
};

const td: CSSProperties = {
  padding: "12px 12px",
  borderBottom: "1px solid #f1f5f9",
  verticalAlign: "middle",
  color: "#111827",
  fontSize: 13.5,
};

const prestataireTitle: CSSProperties = {
  fontWeight: 800,
  color: "#111827",
  fontSize: 14,
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const metaLine: CSSProperties = {
  marginTop: 3,
  fontSize: 12,
  color: "#6b7280",
  lineHeight: 1.45,
};

const emptyState: CSSProperties = {
  border: "1px dashed #d1d5db",
  borderRadius: 16,
  padding: 18,
  background: "#f8fafc",
  minWidth: 0,
};

const emptyStateTitle: CSSProperties = {
  fontSize: 14,
  fontWeight: 800,
  color: "#111827",
  marginBottom: 6,
};

const emptyStateText: CSSProperties = {
  fontSize: 13,
  color: "#6b7280",
  lineHeight: 1.5,
};

const miniLink: CSSProperties = {
  padding: "6px 10px",
  borderRadius: 10,
  border: "1px solid #cbd5e1",
  background: "#fff",
  fontSize: 12,
  fontWeight: 700,
  color: "#111827",
  textDecoration: "none",
  display: "inline-flex",
  alignItems: "center",
  minHeight: 30,
  whiteSpace: "nowrap",
};

const primaryMiniLink: CSSProperties = {
  ...miniLink,
  border: "1px solid #93c5fd",
  background: "#eff6ff",
  color: "#1e3a8a",
};