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

type TravauxRawItem = Record<string, unknown>;
type TravauxStatsResponse = Record<string, unknown>;

type DossierView = {
  id: number;
  titre: string;
  description: string;
  fournisseurLabel: string;
  statut: string;
  budget: number | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  submittedAt?: string | null;
  validatedAt?: string | null;
  lockedAt?: string | null;
  isLocked: boolean;
  resolutionId?: number | null;
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

function fmtInt(v?: number | null) {
  const n = Number(v ?? 0);
  if (Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("fr-FR").format(n);
}

function fmtMoney(value?: number | null) {
  if (value === null || value === undefined) return "—";
  const n = Number(value);
  if (Number.isNaN(n)) return "—";

  try {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "XOF",
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return `${n} FCFA`;
  }
}

function fmtDate(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString("fr-FR");
}

function truncateText(value?: string | null, max = 72) {
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
          .map(([k, v]) => {
            if (Array.isArray(v)) return `${k}: ${v.join(" / ")}`;
            if (typeof v === "string") return `${k}: ${v}`;
            return `${k}: ${JSON.stringify(v)}`;
          })
          .join("\n");
      }
    } catch {
      //
    }
  }

  return err?.message || fallback;
}

function normalizeStatut(value?: unknown) {
  return String(value ?? "").trim().toUpperCase();
}

function humanizeStatut(value?: unknown) {
  const s = normalizeStatut(value);

  if (!s) return "—";
  if (s === "BROUILLON") return "Brouillon";
  if (s === "SOUMIS_AG") return "Soumis à l’AG";
  if (s === "A_VALIDER") return "À valider";
  if (s === "VALIDE") return "Validé";
  if (s === "REFUSE") return "Refusé";
  if (s === "ANNULE") return "Annulé";
  if (s === "EN_COURS") return "En cours";
  if (s === "TERMINE") return "Terminé";
  if (s === "ARCHIVE") return "Archivé";

  return s
    .toLowerCase()
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getStatutKind(statut?: unknown): BadgeKind {
  const s = normalizeStatut(statut);

  if (s === "VALIDE" || s === "TERMINE") return "success";
  if (s === "SOUMIS_AG" || s === "A_VALIDER" || s === "EN_COURS") return "info";
  if (s === "BROUILLON") return "neutral";
  if (s === "REFUSE" || s === "ANNULE") return "danger";
  return "warning";
}

function extractFournisseurLabel(raw: TravauxRawItem) {
  const fournisseur = raw.fournisseur;

  if (fournisseur && typeof fournisseur === "object") {
    const obj = fournisseur as Record<string, unknown>;
    const nom = obj.nom ?? obj.raison_sociale ?? obj.libelle ?? obj.name;
    if (typeof nom === "string" && nom.trim()) return nom.trim();
    if (typeof obj.id === "number") return `Fournisseur #${obj.id}`;
  }

  const direct = raw.fournisseur_nom ?? raw.fournisseur_label ?? raw.nom_fournisseur;
  if (typeof direct === "string" && direct.trim()) return direct.trim();

  const fid = toNumberOrNull(raw.fournisseur_id ?? raw.fournisseur);
  if (fid !== null) return `Fournisseur #${fid}`;

  return "—";
}

function normalizeDossier(raw: TravauxRawItem): DossierView {
  const id = toNumberOrNull(raw.id) ?? toNumberOrNull(raw.pk) ?? 0;

  const titre =
    String(raw.titre ?? raw.objet ?? raw.libelle ?? raw.nom ?? `Dossier #${id}`).trim() || `Dossier #${id}`;

  const description = String(raw.description ?? raw.notes ?? raw.resume ?? "").trim();

  const budget =
    toNumberOrNull(raw.budget_vote) ??
    toNumberOrNull(raw.budget_reference) ??
    toNumberOrNull(raw.budget_estime) ??
    toNumberOrNull(raw.montant_estime) ??
    toNumberOrNull(raw.montant) ??
    null;

  const resolutionId =
    toNumberOrNull(raw.resolution_validation_id) ??
    toNumberOrNull(raw.resolution_id) ??
    toNumberOrNull(raw.resolution_validation) ??
    null;

  const lockedAt = cleanText(raw.locked_at);
  const isLocked = Boolean(raw.is_locked) || Boolean(raw.locked) || Boolean(raw.verrouille) || Boolean(lockedAt);

  return {
    id,
    titre,
    description,
    fournisseurLabel: extractFournisseurLabel(raw),
    statut: normalizeStatut(raw.statut),
    budget,
    createdAt: cleanText(raw.created_at ?? raw.date_creation),
    updatedAt: cleanText(raw.updated_at ?? raw.date_modification),
    submittedAt: cleanText(raw.submitted_at ?? raw.date_soumission_ag),
    validatedAt: cleanText(raw.validated_at ?? raw.date_validation),
    lockedAt,
    isLocked,
    resolutionId,
  };
}

function extractStats(data: TravauxStatsResponse | null) {
  const total =
    toNumberOrNull(data?.total_dossiers) ?? toNumberOrNull(data?.count) ?? toNumberOrNull(data?.nb_dossiers) ?? 0;

  const brouillons = toNumberOrNull(data?.brouillons) ?? toNumberOrNull(data?.nb_brouillons) ?? 0;

  const soumisAg = toNumberOrNull(data?.soumis_ag) ?? toNumberOrNull(data?.nb_soumis_ag) ?? 0;

  const valides = toNumberOrNull(data?.valides) ?? toNumberOrNull(data?.nb_valides) ?? 0;

  const budgetTotal =
    toNumberOrNull(data?.budget_total) ??
    toNumberOrNull(data?.budget_vote_total) ??
    toNumberOrNull(data?.montant_total) ??
    null;

  return {
    total,
    brouillons,
    soumisAg,
    valides,
    budgetTotal,
  };
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
      <div style={{ fontSize: 13, color: "#6b7280", fontWeight: 700, marginBottom: 8 }}>{props.title}</div>
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
        <div style={{ marginTop: 8, fontSize: 12, color: "#6b7280", lineHeight: 1.45 }}>{props.sub}</div>
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
      <div style={{ fontSize: 14, fontWeight: 800, color: "#111827", marginBottom: 6 }}>{props.title}</div>
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

function LockPill({ locked }: { locked: boolean }) {
  return <Badge text={locked ? "Verrouillé" : "Non verrouillé"} kind={locked ? "success" : "warning"} />;
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

export default function TravauxDossiers() {
  const navigate = useNavigate();

  const [state, setState] = useState<LoadState>("idle");
  const [error, setError] = useState<string | null>(null);

  const [rows, setRows] = useState<DossierView[]>([]);
  const [statsRaw, setStatsRaw] = useState<TravauxStatsResponse | null>(null);

  const [query, setQuery] = useState("");
  const [statutFilter, setStatutFilter] = useState<string>("TOUS");

  async function fetchData() {
    setState("loading");
    setError(null);

    try {
      const [listRes, statsRes] = await Promise.all([
        api.get(ENDPOINTS.travauxDossiers),
        api.get(ENDPOINTS.travauxDossiersStats),
      ]);

      const listData = listRes?.data;
      const items = isDRFPage<TravauxRawItem>(listData) ? listData.results : asArray<TravauxRawItem>(listData);

      setRows(items.map(normalizeDossier));
      setStatsRaw((statsRes?.data ?? null) as TravauxStatsResponse | null);
      setState("success");
    } catch (e) {
      setState("error");
      setError(getErrorMessage(e, "Impossible de charger les dossiers travaux."));
      setRows([]);
      setStatsRaw(null);
    }
  }

  useEffect(() => {
    void fetchData();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    return rows.filter((item) => {
      const matchStatut = statutFilter === "TOUS" ? true : normalizeStatut(item.statut) === statutFilter;

      const haystack = [
        item.titre,
        item.description,
        item.fournisseurLabel,
        humanizeStatut(item.statut),
        String(item.id),
        item.resolutionId ? `resolution ${item.resolutionId}` : "",
        item.isLocked ? "verrouillé" : "non verrouillé",
      ]
        .join(" ")
        .toLowerCase();

      const matchQuery = !q ? true : haystack.includes(q);

      return matchStatut && matchQuery;
    });
  }, [rows, query, statutFilter]);

  const uiStats = useMemo(() => {
    const apiStats = extractStats(statsRaw);

    const totalVisible = filtered.length;
    const brouillonsVisible = filtered.filter((x) => normalizeStatut(x.statut) === "BROUILLON").length;
    const soumisAgVisible = filtered.filter((x) => normalizeStatut(x.statut) === "SOUMIS_AG").length;
    const validesVisible = filtered.filter((x) => normalizeStatut(x.statut) === "VALIDE").length;
    const budgetVisible = filtered.reduce((sum, x) => sum + (x.budget ?? 0), 0);

    return {
      totalApi: apiStats.total,
      totalVisible,
      brouillonsVisible,
      soumisAgVisible,
      validesVisible,
      budgetVisible,
      budgetApi: apiStats.budgetTotal,
    };
  }, [statsRaw, filtered]);

  const isLoading = state === "loading";
  const hasRows = rows.length > 0;
  const hasFilters = query.trim().length > 0 || statutFilter !== "TOUS";

  return (
    <PageShell>
      <SectionTitle
        title="Dossiers travaux"
        subtitle="Pilotez les dossiers de travaux, leur budget de référence, leur état d’avancement, la résolution liée et leur niveau de verrouillage depuis un écran unique."
        right={
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <AppButton onClick={() => navigate("/")} variant="secondary">
              Retour au tableau de bord
            </AppButton>
            <AppButton to="/travaux/dossiers/nouveau" variant="primary">
              Nouveau dossier
            </AppButton>
          </div>
        }
      />

      <div
        className="travaux-stats-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
          gap: 14,
        }}
      >
        <StatCard
          title="Dossiers affichés"
          value={uiStats.totalVisible}
          sub={`Total remonté par l’API : ${fmtInt(uiStats.totalApi)}`}
        />
        <StatCard
          title="Brouillons"
          value={uiStats.brouillonsVisible}
          sub="Dossiers encore en préparation."
        />
        <StatCard
          title="Soumis à l’AG"
          value={uiStats.soumisAgVisible}
          sub="Dossiers en attente de décision."
        />
        <StatCard
          title="Validés"
          value={uiStats.validesVisible}
          sub="Dossiers déjà validés."
        />
        <StatCard
          title="Budget affiché"
          value={fmtMoney(uiStats.budgetVisible)}
          sub={
            uiStats.budgetApi !== null ? `Budget total API : ${fmtMoney(uiStats.budgetApi)}` : "Somme des budgets visibles."
          }
        />
      </div>

      {state === "error" && error ? (
        <AlertBox kind="error" title="Impossible de charger les dossiers travaux.">
          {error}
        </AlertBox>
      ) : null}

      <div style={toolbar}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", flex: 1 }}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher par dossier, fournisseur, résolution ou verrouillage..."
            style={input}
          />

          <select value={statutFilter} onChange={(e) => setStatutFilter(e.target.value)} style={selectInput}>
            <option value="TOUS">Tous les statuts</option>
            <option value="BROUILLON">Brouillons</option>
            <option value="SOUMIS_AG">Soumis à l’AG</option>
            <option value="A_VALIDER">À valider</option>
            <option value="VALIDE">Validés</option>
            <option value="EN_COURS">En cours</option>
            <option value="TERMINE">Terminés</option>
            <option value="REFUSE">Refusés</option>
            <option value="ANNULE">Annulés</option>
            <option value="ARCHIVE">Archivés</option>
          </select>

          <AppButton onClick={() => void fetchData()} disabled={isLoading} variant="secondary">
            {isLoading ? "Actualisation..." : "Actualiser"}
          </AppButton>
        </div>

        <div style={{ color: "#6b7280", fontSize: 13, fontWeight: 600 }}>
          {isLoading ? "Chargement des dossiers travaux..." : `${filtered.length} dossier(s) affiché(s) sur ${rows.length}`}
        </div>
      </div>

      <div style={tableWrap}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "left" }}>
              <th style={th}>Dossier</th>
              <th style={th}>Fournisseur</th>
              <th style={th}>Budget</th>
              <th style={th}>Statut</th>
              <th style={th}>Verrouillage</th>
              <th style={th}>Résolution</th>
              <th style={th}>Créé le</th>
              <th style={th}>Actions</th>
            </tr>
          </thead>

          <tbody>
            {isLoading ? (
              <tr>
                <td style={td} colSpan={8}>
                  <span style={{ color: "#6b7280" }}>Chargement des dossiers travaux...</span>
                </td>
              </tr>
            ) : null}

            {!isLoading &&
              filtered.map((item) => (
                <tr key={item.id}>
                  <td style={td}>
                    <div style={{ display: "grid", gap: 4 }}>
                      <div style={{ fontWeight: 800, color: "#111827" }}>{truncateText(item.titre, 44)}</div>
                      <MetaLine>
                        ID dossier : <span style={{ fontWeight: 800, color: "#374151" }}>#{item.id}</span>
                      </MetaLine>

                      {item.description ? (
                        <MetaLine>{truncateText(item.description, 72)}</MetaLine>
                      ) : (
                        <MetaLine>
                          <span style={{ color: "#9ca3af" }}>Aucune description renseignée.</span>
                        </MetaLine>
                      )}
                    </div>
                  </td>

                  <td style={td}>
                    {item.fournisseurLabel && item.fournisseurLabel !== "—" ? (
                      truncateText(item.fournisseurLabel, 32)
                    ) : (
                      <span style={{ color: "#9ca3af" }}>Non renseigné</span>
                    )}
                  </td>

                  <td style={tdStrong}>{fmtMoney(item.budget)}</td>

                  <td style={td}>
                    <Badge text={humanizeStatut(item.statut)} kind={getStatutKind(item.statut)} />
                  </td>

                  <td style={td}>
                    <LockPill locked={item.isLocked} />
                  </td>

                  <td style={td}>{item.resolutionId ? `#${item.resolutionId}` : "—"}</td>
                  <td style={td}>{fmtDate(item.createdAt)}</td>

                  <td style={td}>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <Link to={`/travaux/dossiers/${item.id}`} style={miniLink}>
                        Ouvrir
                      </Link>

                      <Link
                        to={`/travaux/dossiers/${item.id}/modifier`}
                        style={item.isLocked ? disabledMiniLink : primaryMiniLink}
                        onClick={(e) => {
                          if (item.isLocked) e.preventDefault();
                        }}
                        aria-disabled={item.isLocked}
                        title={item.isLocked ? "Ce dossier est verrouillé et ne peut pas être modifié." : "Modifier le dossier"}
                      >
                        Modifier
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}

            {!isLoading && filtered.length === 0 ? (
              <tr>
                <td style={td} colSpan={8}>
                  {!hasRows ? (
                    <EmptyState
                      title="Aucun dossier travaux enregistré"
                      text="Le module Travaux ne contient encore aucun dossier. Vous pouvez créer un premier dossier pour démarrer le suivi opérationnel."
                      actionLabel="Nouveau dossier"
                      actionTo="/travaux/dossiers/nouveau"
                    />
                  ) : hasFilters ? (
                    <EmptyState
                      title="Aucun résultat"
                      text="Aucun dossier ne correspond à la recherche ou aux filtres sélectionnés. Ajustez vos critères pour afficher d’autres dossiers."
                      actionLabel="Nouveau dossier"
                      actionTo="/travaux/dossiers/nouveau"
                    />
                  ) : (
                    <EmptyState
                      title="Aucun dossier à afficher"
                      text="Aucune donnée dossier n’est disponible pour le moment."
                      actionLabel="Nouveau dossier"
                      actionTo="/travaux/dossiers/nouveau"
                    />
                  )}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {state === "success" && rows.length > 0 ? (
        <AlertBox kind="info" title="Lecture métier du module">
          Cet écran centralise le pilotage des dossiers travaux. La lecture détaillée du budget, de la résolution liée et du verrouillage se poursuit dans la fiche de détail de chaque dossier.
        </AlertBox>
      ) : null}

      <style>{`
        @media (max-width: 1280px) {
          .travaux-stats-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
          }
        }

        @media (max-width: 900px) {
          .travaux-stats-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }
        }

        @media (max-width: 680px) {
          .travaux-stats-grid {
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
  width: 360,
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

const tdStrong: CSSProperties = {
  ...td,
  fontWeight: 800,
  whiteSpace: "nowrap",
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

const disabledMiniLink: CSSProperties = {
  ...miniLink,
  border: "1px solid #e5e7eb",
  background: "#f9fafb",
  color: "#9ca3af",
  cursor: "not-allowed",
};