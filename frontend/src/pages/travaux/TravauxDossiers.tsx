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

type TravauxRawItem = Record<string, unknown>;
type TravauxStatsResponse = Record<string, unknown>;

type DossierView = {
  id: number;
  titre: string;
  description: string;
  fournisseurLabel: string;
  fournisseurSource: "direct" | "paiements" | "suivi";
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
  if (s === "EN_COURS") return "info";
  if (s === "SOUMIS_AG" || s === "A_VALIDER") return "warning";
  if (s === "REFUSE" || s === "ANNULE") return "danger";
  if (s === "BROUILLON" || s === "ARCHIVE") return "neutral";

  return "neutral";
}

function extractFournisseurName(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;

  if (typeof value === "string") return cleanText(value);

  if (typeof value === "number") return `Prestataire #${value}`;

  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const name =
      cleanText(obj.nom) ??
      cleanText(obj.raison_sociale) ??
      cleanText(obj.libelle) ??
      cleanText(obj.name) ??
      cleanText(obj.fournisseur_nom) ??
      cleanText(obj.prestataire_nom);

    if (name) return name;

    const id = toNumberOrNull(obj.id ?? obj.pk ?? obj.fournisseur_id ?? obj.prestataire_id);
    if (id !== null) return `Prestataire #${id}`;
  }

  return null;
}

function extractFournisseurInfo(raw: TravauxRawItem): {
  label: string;
  source: DossierView["fournisseurSource"];
} {
  const directSources = [
    raw.fournisseur,
    raw.prestataire,
    raw.fournisseur_principal,
    raw.prestataire_principal,
    raw.fournisseur_nom,
    raw.fournisseur_label,
    raw.nom_fournisseur,
    raw.prestataire_nom,
    raw.prestataire_label,
    raw.nom_prestataire,
  ];

  for (const source of directSources) {
    const label = extractFournisseurName(source);
    if (label) return { label, source: "direct" };
  }

  const directId = toNumberOrNull(
    raw.fournisseur_id ?? raw.prestataire_id ?? raw.fournisseur_principal_id,
  );
  if (directId !== null) return { label: `Prestataire #${directId}`, source: "direct" };

  const paiementCollections = [
    raw.paiements,
    raw.paiements_travaux,
    raw.travaux_paiements,
    raw.reglements,
    raw.reglements_travaux,
    raw.payments,
  ];

  for (const collection of paiementCollections) {
    if (!Array.isArray(collection)) continue;

    for (const paiement of collection) {
      if (!paiement || typeof paiement !== "object") continue;

      const item = paiement as Record<string, unknown>;
      const label =
        extractFournisseurName(item.fournisseur) ??
        extractFournisseurName(item.prestataire) ??
        extractFournisseurName(item.fournisseur_nom) ??
        extractFournisseurName(item.prestataire_nom) ??
        extractFournisseurName(item.nom_fournisseur) ??
        extractFournisseurName(item.nom_prestataire);

      if (label) return { label, source: "paiements" };
    }
  }

  return { label: "Suivi via paiements", source: "suivi" };
}

function getFournisseurHint(source: DossierView["fournisseurSource"]) {
  if (source === "direct") return "Prestataire principal lié au dossier.";
  if (source === "paiements") return "Prestataire identifié depuis les paiements travaux.";

  return "Aucun prestataire direct : suivi financier dans les paiements.";
}

function getFournisseurKind(source: DossierView["fournisseurSource"]): BadgeKind {
  if (source === "direct") return "success";
  if (source === "paiements") return "info";

  return "warning";
}

function normalizeDossier(raw: TravauxRawItem): DossierView {
  const id = toNumberOrNull(raw.id) ?? toNumberOrNull(raw.pk) ?? 0;

  const titre =
    String(raw.titre ?? raw.objet ?? raw.libelle ?? raw.nom ?? `Dossier #${id}`).trim() ||
    `Dossier #${id}`;

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

  const isLocked =
    Boolean(raw.is_locked) ||
    Boolean(raw.locked) ||
    Boolean(raw.verrouille) ||
    Boolean(lockedAt);

  const fournisseurInfo = extractFournisseurInfo(raw);

  return {
    id,
    titre,
    description,
    fournisseurLabel: fournisseurInfo.label,
    fournisseurSource: fournisseurInfo.source,
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
    toNumberOrNull(data?.total_dossiers) ??
    toNumberOrNull(data?.count) ??
    toNumberOrNull(data?.nb_dossiers) ??
    0;

  const brouillons =
    toNumberOrNull(data?.brouillons) ?? toNumberOrNull(data?.nb_brouillons) ?? 0;

  const soumisAg =
    toNumberOrNull(data?.soumis_ag) ?? toNumberOrNull(data?.nb_soumis_ag) ?? 0;

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

function getTone(kind: BadgeKind) {
  if (kind === "success") {
    return {
      softBg: "#ecfdf5",
      bg: "#dcfce7",
      border: "#86efac",
      strongBorder: "#22c55e",
      text: "#166534",
      strongText: "#14532d",
    };
  }

  if (kind === "info") {
    return {
      softBg: "#eff6ff",
      bg: "#dbeafe",
      border: "#93c5fd",
      strongBorder: "#3b82f6",
      text: "#1d4ed8",
      strongText: "#1e3a8a",
    };
  }

  if (kind === "warning") {
    return {
      softBg: "#fffbeb",
      bg: "#fef3c7",
      border: "#fcd34d",
      strongBorder: "#f59e0b",
      text: "#92400e",
      strongText: "#78350f",
    };
  }

  if (kind === "danger") {
    return {
      softBg: "#fef2f2",
      bg: "#fee2e2",
      border: "#fca5a5",
      strongBorder: "#ef4444",
      text: "#991b1b",
      strongText: "#7f1d1d",
    };
  }

  return {
    softBg: "#f8fafc",
    bg: "#f1f5f9",
    border: "#e2e8f0",
    strongBorder: "#cbd5e1",
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

function PageShellWrapper({ children }: { children: ReactNode }) {
  return <div style={pageShell}>{children}</div>;
}

function HeroHeader(props: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <ModuleHero
      eyebrow="Travaux · Dossiers"
      title={props.title}
      subtitle={props.subtitle}
      actions={props.right}
      aside={props.aside}
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
            background: "#ffffff",
            color: "#0f172a",
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
          fontSize: 12.5,
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

function LockPill({ locked }: { locked: boolean }) {
  return (
    <Badge
      text={locked ? "Verrouillé" : "Non verrouillé"}
      kind={locked ? "success" : "warning"}
    />
  );
}

function MetaLine(props: { children: ReactNode }) {
  return <div style={metaLine}>{props.children}</div>;
}

function InfoStrip() {
  return (
    <div style={infoStrip}>
      <div style={infoStripText}>
        Cette vue centralise le pilotage des dossiers de travaux : statut, budget, résolution liée,
        niveau de validation et verrouillage opérationnel.
      </div>
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

  const fetchData = useCallback(async () => {
    setState("loading");
    setError(null);

    try {
      const [listRes, statsRes] = await Promise.all([
        api.get(ENDPOINTS.travauxDossiers),
        api.get(ENDPOINTS.travauxDossiersStats),
      ]);

      const listData = listRes?.data;
      const items = isDRFPage<TravauxRawItem>(listData)
        ? listData.results
        : asArray<TravauxRawItem>(listData);

      setRows(items.map(normalizeDossier));
      setStatsRaw((statsRes?.data ?? null) as TravauxStatsResponse | null);
      setState("success");
    } catch (e) {
      setState("error");
      setError(getErrorMessage(e, "Impossible de charger les dossiers travaux."));
      setRows([]);
      setStatsRaw(null);
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

  const goToFournisseurs = useCallback(() => {
    navigate("/travaux/fournisseurs");
  }, [navigate]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    return rows.filter((item) => {
      const matchStatut =
        statutFilter === "TOUS" ? true : normalizeStatut(item.statut) === statutFilter;

      const haystack = [
        item.titre,
        item.description,
        item.fournisseurLabel,
        humanizeStatut(item.statut),
        String(item.id),
        item.resolutionId ? `resolution ${item.resolutionId}` : "",
        item.isLocked ? "verrouillé" : "non verrouillé",
        "prestataire",
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
    const brouillonsVisible = filtered.filter(
      (x) => normalizeStatut(x.statut) === "BROUILLON",
    ).length;
    const soumisAgVisible = filtered.filter(
      (x) => normalizeStatut(x.statut) === "SOUMIS_AG",
    ).length;
    const validesVisible = filtered.filter((x) => normalizeStatut(x.statut) === "VALIDE").length;
    const verrouillesVisible = filtered.filter((x) => x.isLocked).length;
    const budgetVisible = filtered.reduce((sum, x) => sum + (x.budget ?? 0), 0);

    return {
      totalApi: apiStats.total,
      totalVisible,
      brouillonsVisible,
      soumisAgVisible,
      validesVisible,
      verrouillesVisible,
      budgetVisible,
      budgetApi: apiStats.budgetTotal,
    };
  }, [statsRaw, filtered]);

  const isLoading = state === "loading";
  const hasRows = rows.length > 0;
  const hasFilters = query.trim().length > 0 || statutFilter !== "TOUS";

  const resultLabel = isLoading
    ? "Chargement des dossiers de travaux..."
    : hasFilters
      ? `${filtered.length} dossier${filtered.length > 1 ? "s" : ""} affiché${
          filtered.length > 1 ? "s" : ""
        }`
      : `${rows.length} dossier${rows.length > 1 ? "s" : ""}`;

  const heroBadges = [
    { text: `${fmtInt(uiStats.totalVisible)} visible(s)`, kind: "neutral" as BadgeKind },
    { text: `${fmtInt(uiStats.validesVisible)} validé(s)`, kind: "success" as BadgeKind },
    { text: `${fmtInt(uiStats.verrouillesVisible)} verrouillé(s)`, kind: "info" as BadgeKind },
  ];

  return (
    <PageShellWrapper>
      <HeroHeader
        title="Dossiers de travaux"
        subtitle="Pilotez les dossiers, suivez leur budget, leur résolution liée et leur niveau de verrouillage depuis une vue centrale plus lisible et plus premium."
        right={
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <AppButton onClick={goToFournisseurs} variant="secondary">
              Prestataires
            </AppButton>

            <AppButton to="/travaux/dossiers/nouveau" variant="primary">
              Nouveau dossier de travaux
            </AppButton>
          </div>
        }
        aside={
          <div style={{ display: "grid", gap: 12 }}>
            <div style={heroAsideTitle}>Cockpit travaux</div>

            <div style={heroAsideText}>
              Utilisez cette vue pour suivre l’avancement des dossiers, distinguer les arbitrages en
              attente, identifier les validations acquises et repérer les dossiers verrouillés.
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {heroBadges.map((item) => (
                <Badge key={item.text} text={item.text} kind={item.kind} />
              ))}
            </div>
          </div>
        }
      />

      <InfoStrip />

      <div className="moduleStatsGrid">
        <StatCard
          title="Dossiers affichés"
          value={uiStats.totalVisible}
          sub={`Total disponible : ${fmtInt(uiStats.totalApi)}`}
          kind="neutral"
        />
        <StatCard
          title="Brouillons"
          value={uiStats.brouillonsVisible}
          sub="Encore en préparation."
          kind="neutral"
        />
        <StatCard
          title="Soumis à l’AG"
          value={uiStats.soumisAgVisible}
          sub="En attente de décision."
          kind="warning"
        />
        <StatCard
          title="Validés"
          value={uiStats.validesVisible}
          sub="Décision approuvée."
          kind="success"
        />
        <StatCard
          title="Budget affiché"
          value={fmtMoney(uiStats.budgetVisible)}
          sub={
            uiStats.budgetApi !== null
              ? `Budget global : ${fmtMoney(uiStats.budgetApi)}`
              : "Somme des budgets visibles."
          }
          kind="info"
        />
      </div>

      {state === "error" && error ? (
        <AlertBox kind="error" title="Impossible de charger les dossiers travaux">
          {error}
        </AlertBox>
      ) : null}

      <Panel style={{ padding: 14 }}>
        <div style={toolbar}>
          <div style={toolbarControls}>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher par dossier, prestataire, résolution ou verrouillage"
              style={input}
            />

            <select
              value={statutFilter}
              onChange={(e) => setStatutFilter(e.target.value)}
              style={selectInput}
            >
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

            <AppButton onClick={handleRefresh} disabled={isLoading} variant="secondary">
              {isLoading ? "Actualisation..." : "Actualiser"}
            </AppButton>
          </div>

          <div style={resultsInfo}>{resultLabel}</div>
        </div>
      </Panel>

      <Panel style={{ overflow: "hidden" }}>
        <div style={tableWrap}>
          <table style={tableStyle}>
            <thead>
              <tr style={{ textAlign: "left" }}>
                <th style={{ ...th, width: "31%" }}>Dossier</th>
                <th style={{ ...th, width: "16%" }}>Prestataire</th>
                <th style={{ ...th, width: "12%" }}>Budget</th>
                <th style={{ ...th, width: "12%" }}>Statut</th>
                <th style={{ ...th, width: "12%" }}>Verrouillage</th>
                <th style={{ ...th, width: "8%" }}>Résolution</th>
                <th style={{ ...th, width: "9%" }}>Créé le</th>
                <th style={{ ...th, width: "12%" }}>Actions</th>
              </tr>
            </thead>

            <tbody>
              {isLoading ? (
                <tr>
                  <td style={td} colSpan={8}>
                    <span style={{ color: "#6b7280" }}>
                      Chargement des dossiers de travaux...
                    </span>
                  </td>
                </tr>
              ) : null}

              {!isLoading &&
                filtered.map((item) => (
                  <tr key={item.id} style={tableRowStyle}>
                    <td style={td}>
                      <div style={{ display: "grid", gap: 4, minWidth: 0 }}>
                        <div style={dossierTitle}>{truncateText(item.titre, 52)}</div>

                        <MetaLine>
                          ID dossier :{" "}
                          <span style={{ fontWeight: 800, color: "#374151" }}>#{item.id}</span>
                        </MetaLine>

                        {item.description ? (
                          <MetaLine>{truncateText(item.description, 78)}</MetaLine>
                        ) : (
                          <MetaLine>
                            <span style={{ color: "#9ca3af" }}>
                              Aucune description renseignée.
                            </span>
                          </MetaLine>
                        )}
                      </div>
                    </td>

                    <td style={td}>
                      <div style={fournisseurCell}>
                        <Badge
                          text={truncateText(item.fournisseurLabel, 30)}
                          kind={getFournisseurKind(item.fournisseurSource)}
                        />
                        <MetaLine>{getFournisseurHint(item.fournisseurSource)}</MetaLine>
                      </div>
                    </td>

                    <td style={tdStrong}>{fmtMoney(item.budget)}</td>

                    <td style={td}>
                      <Badge
                        text={humanizeStatut(item.statut)}
                        kind={getStatutKind(item.statut)}
                      />
                    </td>

                    <td style={td}>
                      <LockPill locked={item.isLocked} />
                    </td>

                    <td style={td}>
                      {item.resolutionId ? (
                        <span style={{ fontWeight: 700, color: "#374151" }}>
                          #{item.resolutionId}
                        </span>
                      ) : (
                        <span style={{ color: "#9ca3af" }}>—</span>
                      )}
                    </td>

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
                          title={
                            item.isLocked
                              ? "Ce dossier est verrouillé et ne peut pas être modifié."
                              : "Modifier le dossier"
                          }
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
                        title="Aucun dossier de travaux enregistré"
                        text="Le module Travaux ne contient encore aucun dossier. Créez un premier dossier pour démarrer le suivi opérationnel."
                        actionLabel="Nouveau dossier de travaux"
                        actionTo="/travaux/dossiers/nouveau"
                      />
                    ) : hasFilters ? (
                      <EmptyState
                        title="Aucun résultat"
                        text="Aucun dossier ne correspond à la recherche ou aux filtres sélectionnés. Ajustez vos critères pour poursuivre."
                        actionLabel="Nouveau dossier de travaux"
                        actionTo="/travaux/dossiers/nouveau"
                      />
                    ) : (
                      <EmptyState
                        title="Aucun dossier à afficher"
                        text="Aucune donnée dossier n’est disponible pour le moment."
                        actionLabel="Nouveau dossier de travaux"
                        actionTo="/travaux/dossiers/nouveau"
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
          Cette liste centralise le pilotage des dossiers. La colonne prestataire reste lisible
          même lorsque le modèle ne porte pas encore de prestataire principal direct sur le dossier.
        </AlertBox>
      ) : null}

      <style>{`
        @media (max-width: 1280px) {
          .travaux-stats-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
          }
        }

        @media (max-width: 980px) {
          .travaux-stats-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }
        }

        @media (max-width: 760px) {
          .travaux-stats-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </PageShellWrapper>
  );
}

const pageShell: CSSProperties = {
  display: "grid",
  gap: 18,
  width: "100%",
  minWidth: 0,
};

const heroAsideTitle: CSSProperties = {
  fontSize: 13,
  fontWeight: 900,
  color: "#ffffff",
  textTransform: "uppercase",
  letterSpacing: 0.5,
};

const heroAsideText: CSSProperties = {
  fontSize: 12.5,
  lineHeight: 1.6,
  color: "rgba(255,255,255,0.84)",
};

const infoStrip: CSSProperties = {
  border: "1px solid #bfdbfe",
  background: "#eff6ff",
  borderRadius: 18,
  padding: "14px 16px",
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
  width: 340,
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
  minWidth: 1180,
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

const tdStrong: CSSProperties = {
  ...td,
  fontWeight: 800,
  whiteSpace: "nowrap",
};

const dossierTitle: CSSProperties = {
  fontWeight: 800,
  color: "#111827",
  fontSize: 14,
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const tableRowStyle: CSSProperties = {
  transition: "background 0.18s ease",
};

const fournisseurCell: CSSProperties = {
  display: "grid",
  gap: 4,
  alignItems: "start",
  minWidth: 0,
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

const disabledMiniLink: CSSProperties = {
  ...miniLink,
  border: "1px solid #e5e7eb",
  background: "#f9fafb",
  color: "#9ca3af",
  cursor: "not-allowed",
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
  lineHeight: 1.55,
};