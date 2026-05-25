import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import api from "../../api/axios";
import { ENDPOINTS } from "../../api/endpoints";

type LoadState = "idle" | "loading" | "success" | "error";

type TravauxRawItem = Record<string, unknown>;

type DossierDetailView = {
  id: number;
  titre: string;
  description: string;
  fournisseurLabel: string;
  statut: string;

  budgetEstime: number | null;
  budgetVote: number | null;
  budgetReference: number | null;
  totalPaye: number | null;
  resteAPayer: number | null;

  resolutionId: number | null;
  locked: boolean;
  lockedAt?: string | null;

  createdAt?: string | null;
  updatedAt?: string | null;
  submittedAt?: string | null;
  validatedAt?: string | null;
  startedAt?: string | null;
  endedAt?: string | null;

  reference?: string | null;
  notes?: string | null;
};

type BadgeKind = "neutral" | "success" | "warning" | "danger" | "info";
type FlashKind = "error" | "info";

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

function getStatutHint(value?: unknown) {
  const s = normalizeStatut(value);

  if (s === "BROUILLON") return "Le dossier est encore en préparation avant sa soumission.";
  if (s === "SOUMIS_AG") return "Le dossier attend un arbitrage ou un traitement dans le circuit AG.";
  if (s === "A_VALIDER") return "Le dossier est en attente de validation avant poursuite.";
  if (s === "VALIDE") return "Le dossier est validé et peut suivre son exécution prévue.";
  if (s === "EN_COURS") return "Le dossier est en cours d’exécution ou de suivi opérationnel.";
  if (s === "TERMINE") return "Le dossier est terminé sur le plan opérationnel.";
  if (s === "REFUSE") return "Le dossier a été rejeté et ne poursuit pas le flux prévu.";
  if (s === "ANNULE") return "Le dossier a été annulé et sorti du flux actif.";
  if (s === "ARCHIVE") return "Le dossier est conservé à titre d’historique.";

  return "État courant du dossier travaux.";
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

function fmtDateTime(value?: string | null) {
  if (!value) return "—";

  const d = new Date(value);

  if (Number.isNaN(d.getTime())) return String(value);

  return d.toLocaleString("fr-FR");
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

function getMoneyTone(
  value: number | null,
  kind: "paid" | "remaining" | "neutral",
): CSSProperties {
  if (value === null) return { color: "#111827" };

  if (kind === "paid") {
    return { color: value > 0 ? "#166534" : "#111827" };
  }

  if (kind === "remaining") {
    return { color: value > 0 ? "#92400e" : "#166534" };
  }

  return { color: "#111827" };
}

function getBudgetCardTone(kind: "paid" | "remaining" | "neutral", value: number | null) {
  if (kind === "paid") {
    return value !== null && value > 0 ? getTone("success") : getTone("neutral");
  }

  if (kind === "remaining") {
    if (value === null) return getTone("neutral");

    return value > 0 ? getTone("warning") : getTone("success");
  }

  return getTone("neutral");
}

function extractFournisseurLabel(raw: TravauxRawItem) {
  const fournisseur = raw.fournisseur;

  if (fournisseur && typeof fournisseur === "object") {
    const obj = fournisseur as Record<string, unknown>;
    const nom = obj.nom ?? obj.raison_sociale ?? obj.libelle ?? obj.name;

    if (typeof nom === "string" && nom.trim()) return nom.trim();
    if (typeof obj.id === "number") return `Prestataire #${obj.id}`;
  }

  const direct = raw.fournisseur_nom ?? raw.fournisseur_label ?? raw.nom_fournisseur;

  if (typeof direct === "string" && direct.trim()) return direct.trim();

  const fid = toNumberOrNull(raw.fournisseur_id ?? raw.fournisseur);

  if (fid !== null) return `Prestataire #${fid}`;

  return "—";
}

function computeBudgetReference(
  raw: TravauxRawItem,
  budgetEstime: number | null,
  budgetVote: number | null,
) {
  const explicit =
    toNumberOrNull(raw.budget_reference) ??
    toNumberOrNull(raw.budget_retained) ??
    toNumberOrNull(raw.budget_base);

  if (explicit !== null) return explicit;
  if (budgetVote !== null) return budgetVote;
  if (budgetEstime !== null) return budgetEstime;

  return null;
}

function computeTotalPaye(raw: TravauxRawItem) {
  return (
    toNumberOrNull(raw.total_paye) ??
    toNumberOrNull(raw.total_paid) ??
    toNumberOrNull(raw.montant_paye) ??
    toNumberOrNull(raw.total_paiements) ??
    toNumberOrNull(raw.total_regle) ??
    null
  );
}

function computeResteAPayer(
  raw: TravauxRawItem,
  budgetReference: number | null,
  totalPaye: number | null,
) {
  const explicit =
    toNumberOrNull(raw.reste_a_payer) ??
    toNumberOrNull(raw.reste) ??
    toNumberOrNull(raw.solde_restant);

  if (explicit !== null) return explicit;
  if (budgetReference === null) return null;

  return Math.max(budgetReference - (totalPaye ?? 0), 0);
}

function normalizeDossier(raw: TravauxRawItem): DossierDetailView {
  const id = toNumberOrNull(raw.id) ?? toNumberOrNull(raw.pk) ?? 0;

  const titre =
    String(raw.titre ?? raw.objet ?? raw.libelle ?? raw.nom ?? `Dossier #${id}`).trim() ||
    `Dossier #${id}`;

  const description = String(raw.description ?? raw.resume ?? "").trim();
  const notes = String(raw.notes ?? raw.commentaire ?? raw.observations ?? "").trim();

  const budgetEstime =
    toNumberOrNull(raw.budget_estime) ??
    toNumberOrNull(raw.montant_estime) ??
    toNumberOrNull(raw.budget_previsionnel) ??
    null;

  const budgetVote =
    toNumberOrNull(raw.budget_vote) ??
    toNumberOrNull(raw.montant_vote) ??
    toNumberOrNull(raw.budget_valide) ??
    null;

  const budgetReference = computeBudgetReference(raw, budgetEstime, budgetVote);
  const totalPaye = computeTotalPaye(raw);
  const resteAPayer = computeResteAPayer(raw, budgetReference, totalPaye);

  const resolutionId =
    toNumberOrNull(raw.resolution_validation_id) ??
    toNumberOrNull(raw.resolution_id) ??
    toNumberOrNull(raw.resolution_validation) ??
    null;

  const lockedAt = cleanText(raw.locked_at);

  const locked =
    Boolean(raw.is_locked) ||
    Boolean(raw.locked) ||
    Boolean(raw.verrouille) ||
    Boolean(lockedAt);

  return {
    id,
    titre,
    description,
    fournisseurLabel: extractFournisseurLabel(raw),
    statut: normalizeStatut(raw.statut),

    budgetEstime,
    budgetVote,
    budgetReference,
    totalPaye,
    resteAPayer,

    resolutionId,
    locked,
    lockedAt,

    createdAt: cleanText(raw.created_at ?? raw.date_creation),
    updatedAt: cleanText(raw.updated_at ?? raw.date_modification),
    submittedAt: cleanText(raw.submitted_at ?? raw.date_soumission_ag),
    validatedAt: cleanText(raw.validated_at ?? raw.date_validation),
    startedAt: cleanText(raw.started_at ?? raw.date_debut),
    endedAt: cleanText(raw.ended_at ?? raw.date_fin),

    reference: cleanText(raw.reference ?? raw.code ?? raw.numero),
    notes: notes || null,
  };
}

function PageShell({ children }: { children: ReactNode }) {
  return <div style={pageShell}>{children}</div>;
}

function HeroHeader(props: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <section style={heroCard}>
      <div style={heroGlow} />

      <div style={heroGrid}>
        <div style={heroMainBlock}>
          <div style={pageEyebrow}>Travaux · Détail dossier</div>
          <div style={pageTitle}>{props.title}</div>
          {props.subtitle ? <div style={pageSubtitle}>{props.subtitle}</div> : null}

          {props.actions ? <div style={{ ...heroActions, marginTop: 18 }}>{props.actions}</div> : null}
        </div>

        {props.aside ? <div style={heroAsidePanel}>{props.aside}</div> : null}
      </div>
    </section>
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
        overflow: "hidden",
        minWidth: 0,
        ...props.style,
      }}
    >
      {props.children}
    </section>
  );
}

function AlertBox(props: { kind: FlashKind; title?: string; children: ReactNode }) {
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
  primary?: boolean;
  disabled?: boolean;
  title?: string;
}) {
  if (props.to) {
    return (
      <Link
        to={props.to}
        onClick={(e) => {
          if (props.disabled) e.preventDefault();
        }}
        aria-disabled={props.disabled}
        title={props.title}
        style={{
          border: props.primary ? "1px solid #93c5fd" : "1px solid #cbd5e1",
          background: props.disabled ? "#f9fafb" : props.primary ? "#dbeafe" : "#fff",
          color: props.disabled ? "#9ca3af" : props.primary ? "#1e3a8a" : "#111827",
          borderRadius: 12,
          padding: "10px 14px",
          fontSize: 12.5,
          fontWeight: 800,
          textDecoration: "none",
          display: "inline-flex",
          alignItems: "center",
          whiteSpace: "nowrap",
          pointerEvents: props.disabled ? "none" : "auto",
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
      title={props.title}
      style={{
        border: props.primary ? "1px solid #93c5fd" : "1px solid #cbd5e1",
        background: props.disabled ? "#f9fafb" : props.primary ? "#dbeafe" : "#fff",
        color: props.disabled ? "#9ca3af" : props.primary ? "#1e3a8a" : "#111827",
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

function InfoCard(props: { title: string; children: ReactNode; right?: ReactNode }) {
  return (
    <Panel>
      <div style={infoCardHeader}>
        <div style={infoCardTitle}>{props.title}</div>
        {props.right ? <div>{props.right}</div> : null}
      </div>

      <div style={infoCardBody}>{props.children}</div>
    </Panel>
  );
}

function DataGrid(props: { items: Array<{ label: string; value: ReactNode }> }) {
  return (
    <div className="travaux-detail-grid" style={dataGrid}>
      {props.items.map((item) => (
        <div key={String(item.label)} style={dataCell}>
          <div style={dataCellLabel}>{item.label}</div>
          <div style={dataCellValue}>{item.value}</div>
        </div>
      ))}
    </div>
  );
}

function BudgetCard(props: {
  title: string;
  value: string;
  sub?: string;
  tone?: "paid" | "remaining" | "neutral";
  rawValue?: number | null;
}) {
  const tone = getBudgetCardTone(props.tone ?? "neutral", props.rawValue ?? null);

  return (
    <div
      style={{
        border: `1px solid ${tone.border}`,
        borderRadius: 18,
        padding: 14,
        background: tone.softBg,
        minWidth: 0,
      }}
    >
      <div style={{ ...budgetTitle, color: tone.text }}>{props.title}</div>

      <div
        style={{
          fontSize: 22,
          fontWeight: 900,
          letterSpacing: -0.35,
          lineHeight: 1.1,
          overflowWrap: "anywhere",
          ...getMoneyTone(props.rawValue ?? null, props.tone ?? "neutral"),
        }}
      >
        {props.value}
      </div>

      {props.sub ? (
        <div style={{ marginTop: 6, fontSize: 11.5, color: tone.text, lineHeight: 1.45 }}>
          {props.sub}
        </div>
      ) : null}
    </div>
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

function SummaryStat(props: {
  label: string;
  value: ReactNode;
  sub?: string;
  kind?: BadgeKind;
}) {
  const tone = getTone(props.kind ?? "neutral");

  return (
    <div
      style={{
        border: `1px solid ${tone.border}`,
        borderRadius: 16,
        background: tone.softBg,
        padding: 14,
        minWidth: 0,
      }}
    >
      <div style={{ ...summaryLabel, color: tone.text }}>{props.label}</div>
      <div style={{ ...summaryValue, color: tone.strongText }}>{props.value}</div>

      {props.sub ? (
        <div style={{ marginTop: 7, fontSize: 11.5, lineHeight: 1.45, color: tone.text }}>
          {props.sub}
        </div>
      ) : null}
    </div>
  );
}

function EmptyValue({ children }: { children: ReactNode }) {
  return <span style={{ color: "#9ca3af" }}>{children}</span>;
}

function InfoStrip() {
  return (
    <div style={infoStrip}>
      <div style={infoStripText}>
        Cette fiche centralise la lecture produit du dossier : budget, état d’avancement,
        verrouillage, résolution liée, dates utiles et commentaires complémentaires.
      </div>
    </div>
  );
}

export default function TravauxDossierDetail() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  const [state, setState] = useState<LoadState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [item, setItem] = useState<DossierDetailView | null>(null);

  const fetchData = useCallback(async () => {
    if (!id) {
      setState("error");
      setError("Identifiant de dossier de travaux manquant.");
      setItem(null);
      return;
    }

    setState("loading");
    setError(null);

    try {
      const res = await api.get(ENDPOINTS.travauxDossierDetail(id));
      const data = (res?.data ?? {}) as TravauxRawItem;

      setItem(normalizeDossier(data));
      setState("success");
    } catch (e) {
      setState("error");
      setError(getErrorMessage(e, "Impossible de charger le détail du dossier de travaux."));
      setItem(null);
    }
  }, [id]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchData();
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [fetchData]);

  const goBackToDossiers = useCallback(() => {
    navigate("/travaux/dossiers");
  }, [navigate]);

  const handleRefresh = useCallback(() => {
    void fetchData();
  }, [fetchData]);

  const isLoading = state === "loading";

  const finance = useMemo(() => {
    const budgetEstime = item?.budgetEstime ?? null;
    const budgetVote = item?.budgetVote ?? null;
    const budgetReference = item?.budgetReference ?? null;
    const totalPaye = item?.totalPaye ?? null;
    const resteAPayer = item?.resteAPayer ?? null;

    return {
      budgetEstime,
      budgetVote,
      budgetReference,
      totalPaye,
      resteAPayer,
    };
  }, [item]);

  const canOpenResolution = Boolean(item?.resolutionId);
  const canEdit = Boolean(item && !item.locked);

  const statutKind = getStatutKind(item?.statut);
  const statutLabel = humanizeStatut(item?.statut);

  return (
    <PageShell>
      <HeroHeader
        title={item ? item.titre : "Détail du dossier de travaux"}
        subtitle="Consultez la fiche détaillée du dossier, sa situation budgétaire, la résolution liée et le niveau de verrouillage depuis une vue claire, démontrable et exploitable."
        actions={
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <AppButton onClick={goBackToDossiers}>Retour aux dossiers</AppButton>

            {id ? (
              <AppButton
                to={`/travaux/dossiers/${id}/modifier`}
                primary
                disabled={!canEdit}
                title={
                  canEdit
                    ? "Modifier le dossier"
                    : "Ce dossier est verrouillé et ne peut pas être modifié."
                }
              >
                Modifier le dossier
              </AppButton>
            ) : null}

            <AppButton onClick={handleRefresh} disabled={isLoading}>
              {isLoading ? "Actualisation..." : "Actualiser"}
            </AppButton>
          </div>
        }
        aside={
          <div style={{ display: "grid", gap: 10 }}>
            <div style={heroAsideTitle}>Lecture immédiate</div>

            <div style={heroAsideText}>
              Cette fiche doit permettre de comprendre en quelques secondes la maturité du dossier :
              statut courant, solidité budgétaire, résolution liée et niveau de verrouillage.
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Badge text={statutLabel} kind={statutKind} />
              <LockPill locked={Boolean(item?.locked)} />
              {item?.resolutionId ? (
                <Badge text={`Résolution #${item.resolutionId}`} kind="info" />
              ) : null}
            </div>
          </div>
        }
      />

      <InfoStrip />

      {state === "error" && error ? (
        <AlertBox kind="error" title="Impossible de charger le dossier de travaux">
          {error}
        </AlertBox>
      ) : null}

      {isLoading ? (
        <InfoCard title="Chargement">
          <div style={{ color: "#6b7280", fontSize: 13.5 }}>
            Chargement du détail du dossier de travaux...
          </div>
        </InfoCard>
      ) : null}

      {!isLoading && !item && state !== "error" ? (
        <InfoCard title="Aucune donnée">
          <div style={{ color: "#6b7280", fontSize: 13.5 }}>
            Aucun dossier de travaux n’a pu être affiché pour cet identifiant.
          </div>
        </InfoCard>
      ) : null}

      {item ? (
        <>
          <div className="travaux-overview-grid" style={overviewGrid}>
            <InfoCard
              title="Vue d’ensemble"
              right={
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <Badge text={humanizeStatut(item.statut)} kind={getStatutKind(item.statut)} />
                  <LockPill locked={item.locked} />
                </div>
              }
            >
              <div style={{ display: "grid", gap: 14 }}>
                <div>
                  <div style={mainTitle}>{item.titre}</div>

                  {item.description ? (
                    <div style={mainDescription}>{item.description}</div>
                  ) : (
                    <div style={emptyDescription}>Aucune description renseignée.</div>
                  )}
                </div>

                <DataGrid
                  items={[
                    { label: "ID dossier", value: <strong>#{item.id}</strong> },
                    {
                      label: "Référence",
                      value: item.reference ? (
                        item.reference
                      ) : (
                        <EmptyValue>Aucune référence renseignée</EmptyValue>
                      ),
                    },
                    {
                      label: "Prestataire",
                      value:
                        item.fournisseurLabel && item.fournisseurLabel !== "—" ? (
                          item.fournisseurLabel
                        ) : (
                          <EmptyValue>Aucun prestataire associé</EmptyValue>
                        ),
                    },
                    {
                      label: "Résolution liée",
                      value: item.resolutionId ? (
                        <span style={{ fontWeight: 700, color: "#374151" }}>
                          #{item.resolutionId}
                        </span>
                      ) : (
                        <EmptyValue>Aucune résolution liée</EmptyValue>
                      ),
                    },
                    {
                      label: "État de verrouillage",
                      value: item.locked ? (
                        <span style={{ color: "#166534", fontWeight: 800 }}>
                          Dossier verrouillé
                        </span>
                      ) : (
                        <span style={{ color: "#92400e", fontWeight: 800 }}>
                          Dossier non verrouillé
                        </span>
                      ),
                    },
                    {
                      label: "Date de verrouillage",
                      value: item.lockedAt ? (
                        fmtDateTime(item.lockedAt)
                      ) : (
                        <EmptyValue>Aucune date de verrouillage</EmptyValue>
                      ),
                    },
                  ]}
                />
              </div>
            </InfoCard>

            <InfoCard title="Synthèse produit">
              <div className="travaux-summary-grid" style={summaryGrid}>
                <SummaryStat
                  label="Statut"
                  value={humanizeStatut(item.statut)}
                  sub={getStatutHint(item.statut)}
                  kind={getStatutKind(item.statut)}
                />

                <SummaryStat
                  label="Budget de référence"
                  value={fmtMoney(finance.budgetReference)}
                  sub={
                    finance.budgetReference !== null
                      ? "Base retenue pour le suivi financier."
                      : "Aucun budget de référence disponible."
                  }
                  kind="neutral"
                />

                <SummaryStat
                  label="Reste à payer"
                  value={fmtMoney(finance.resteAPayer)}
                  sub={
                    finance.resteAPayer !== null
                      ? "Montant restant à engager ou à régler."
                      : "Aucun reste à payer exploitable."
                  }
                  kind={
                    finance.resteAPayer === null
                      ? "neutral"
                      : finance.resteAPayer > 0
                        ? "warning"
                        : "success"
                  }
                />

                <SummaryStat
                  label="Verrouillage"
                  value={item.locked ? "Verrouillé" : "Non verrouillé"}
                  sub={
                    item.locked
                      ? "Le dossier n’est plus librement modifiable."
                      : "Le dossier reste modifiable dans le flux courant."
                  }
                  kind={item.locked ? "success" : "warning"}
                />
              </div>
            </InfoCard>
          </div>

          <InfoCard title="Situation budgétaire">
            <div className="travaux-budget-grid" style={budgetGrid}>
              <BudgetCard
                title="Budget estimé"
                value={fmtMoney(finance.budgetEstime)}
                rawValue={finance.budgetEstime}
                tone="neutral"
                sub="Montant prévisionnel initial."
              />

              <BudgetCard
                title="Budget voté"
                value={fmtMoney(finance.budgetVote)}
                rawValue={finance.budgetVote}
                tone="neutral"
                sub="Montant validé par décision."
              />

              <BudgetCard
                title="Budget de référence"
                value={fmtMoney(finance.budgetReference)}
                rawValue={finance.budgetReference}
                tone="neutral"
                sub="Base retenue pour le suivi financier."
              />

              <BudgetCard
                title="Total payé"
                value={fmtMoney(finance.totalPaye)}
                rawValue={finance.totalPaye}
                tone="paid"
                sub="Paiements déjà enregistrés."
              />

              <BudgetCard
                title="Reste à payer"
                value={fmtMoney(finance.resteAPayer)}
                rawValue={finance.resteAPayer}
                tone="remaining"
                sub="Montant restant à régler."
              />
            </div>
          </InfoCard>

          <div className="travaux-secondary-grid" style={secondaryGrid}>
            <InfoCard title="Dates utiles">
              <DataGrid
                items={[
                  { label: "Créé le", value: fmtDateTime(item.createdAt) },
                  { label: "Mis à jour le", value: fmtDateTime(item.updatedAt) },
                  {
                    label: "Soumis à l’AG le",
                    value: item.submittedAt ? (
                      fmtDateTime(item.submittedAt)
                    ) : (
                      <EmptyValue>Aucune soumission enregistrée</EmptyValue>
                    ),
                  },
                  {
                    label: "Validé le",
                    value: item.validatedAt ? (
                      fmtDateTime(item.validatedAt)
                    ) : (
                      <EmptyValue>Aucune validation enregistrée</EmptyValue>
                    ),
                  },
                  {
                    label: "Début prévu / réel",
                    value: item.startedAt ? (
                      fmtDate(item.startedAt)
                    ) : (
                      <EmptyValue>Aucune date de début renseignée</EmptyValue>
                    ),
                  },
                  {
                    label: "Fin prévue / réelle",
                    value: item.endedAt ? (
                      fmtDate(item.endedAt)
                    ) : (
                      <EmptyValue>Aucune date de fin renseignée</EmptyValue>
                    ),
                  },
                ]}
              />
            </InfoCard>

            <InfoCard title="Notes complémentaires">
              {item.notes ? (
                <div style={notesText}>{item.notes}</div>
              ) : (
                <div style={{ color: "#9ca3af", fontSize: 13.5 }}>
                  Aucune note complémentaire.
                </div>
              )}
            </InfoCard>
          </div>

          <InfoCard title="Actions rapides">
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <AppButton to="/travaux/dossiers">Retour aux dossiers</AppButton>

              <AppButton
                to={`/travaux/dossiers/${item.id}/modifier`}
                primary
                disabled={!canEdit}
                title={
                  canEdit
                    ? "Modifier le dossier"
                    : "Ce dossier est verrouillé et ne peut pas être modifié."
                }
              >
                Modifier le dossier
              </AppButton>

              <AppButton
                to={canOpenResolution ? `/ag/resolutions/${item.resolutionId}` : undefined}
                disabled={!canOpenResolution}
                title={
                  canOpenResolution
                    ? "Ouvrir la résolution liée"
                    : "Aucune résolution liée à ce dossier."
                }
              >
                Ouvrir la résolution liée
              </AppButton>
            </div>
          </InfoCard>

          <AlertBox kind="info" title="Lecture métier">
            Cette fiche centralise la lecture produit d’un dossier de travaux : statut,
            verrouillage, budget, résolution liée, dates utiles et notes complémentaires.
          </AlertBox>
        </>
      ) : null}

      <style>{`
        @media (max-width: 1280px) {
          .travaux-budget-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
          }
        }

        @media (max-width: 1180px) {
          .travaux-overview-grid,
          .travaux-secondary-grid {
            grid-template-columns: 1fr !important;
          }
        }

        @media (max-width: 980px) {
          .travaux-budget-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }
        }

        @media (max-width: 860px) {
          .travaux-detail-grid,
          .travaux-summary-grid {
            grid-template-columns: 1fr !important;
          }
        }

        @media (max-width: 680px) {
          .travaux-budget-grid {
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

const heroCard: CSSProperties = {
  background:
    "linear-gradient(135deg, rgba(15,23,42,0.98) 0%, rgba(30,41,59,0.96) 55%, rgba(59,130,246,0.88) 100%)",
  borderRadius: 28,
  padding: "28px 30px",
  color: "#ffffff",
  boxShadow: "0 30px 70px rgba(15,23,42,0.18)",
  position: "relative",
  overflow: "hidden",
  minWidth: 0,
};

const heroGlow: CSSProperties = {
  position: "absolute",
  inset: "auto -120px -140px auto",
  width: 280,
  height: 280,
  borderRadius: "50%",
  background:
    "radial-gradient(circle, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0) 72%)",
  pointerEvents: "none",
};

const heroGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1.15fr) minmax(260px, 0.85fr)",
  gap: 18,
  alignItems: "stretch",
  minWidth: 0,
};

const heroMainBlock: CSSProperties = {
  minWidth: 0,
  position: "relative",
  zIndex: 1,
};

const heroActions: CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  alignItems: "center",
};

const heroAsidePanel: CSSProperties = {
  position: "relative",
  zIndex: 1,
  borderRadius: 20,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(255,255,255,0.08)",
  padding: 16,
  display: "grid",
  gap: 10,
  alignContent: "start",
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

const pageEyebrow: CSSProperties = {
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: 0.9,
  textTransform: "uppercase",
  color: "rgba(255,255,255,0.72)",
  marginBottom: 6,
};

const pageTitle: CSSProperties = {
  fontSize: 30,
  fontWeight: 900,
  letterSpacing: -0.5,
  color: "#ffffff",
  lineHeight: 1.08,
};

const pageSubtitle: CSSProperties = {
  marginTop: 6,
  color: "rgba(255,255,255,0.84)",
  fontSize: 13.5,
  lineHeight: 1.6,
  maxWidth: 860,
};

const overviewGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1.05fr) minmax(320px, 0.95fr)",
  gap: 16,
  minWidth: 0,
};

const secondaryGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 16,
  minWidth: 0,
};

const budgetGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
  gap: 12,
  minWidth: 0,
};

const summaryGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 12,
  minWidth: 0,
};

const dataGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 12,
  minWidth: 0,
};

const infoCardHeader: CSSProperties = {
  padding: "14px 16px",
  borderBottom: "1px solid #f3f4f6",
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "center",
  flexWrap: "wrap",
  minWidth: 0,
};

const infoCardTitle: CSSProperties = {
  fontSize: 15,
  fontWeight: 900,
  color: "#111827",
};

const infoCardBody: CSSProperties = {
  padding: 16,
  minWidth: 0,
};

const dataCell: CSSProperties = {
  border: "1px solid #f1f5f9",
  borderRadius: 16,
  background: "#fcfcfd",
  padding: 13,
  minWidth: 0,
};

const dataCellLabel: CSSProperties = {
  fontSize: 11.5,
  fontWeight: 800,
  color: "#6b7280",
  marginBottom: 8,
  textTransform: "uppercase",
  letterSpacing: 0.28,
};

const dataCellValue: CSSProperties = {
  fontSize: 13.5,
  color: "#111827",
  lineHeight: 1.5,
  minWidth: 0,
  overflowWrap: "anywhere",
};

const budgetTitle: CSSProperties = {
  fontSize: 11.5,
  fontWeight: 800,
  marginBottom: 8,
  textTransform: "uppercase",
  letterSpacing: 0.32,
};

const summaryLabel: CSSProperties = {
  fontSize: 11.5,
  fontWeight: 800,
  marginBottom: 8,
  textTransform: "uppercase",
  letterSpacing: 0.28,
};

const summaryValue: CSSProperties = {
  fontSize: 16,
  fontWeight: 900,
  lineHeight: 1.2,
  minWidth: 0,
  overflowWrap: "anywhere",
};

const mainTitle: CSSProperties = {
  fontSize: 22,
  fontWeight: 900,
  color: "#111827",
  lineHeight: 1.15,
  letterSpacing: -0.35,
  overflowWrap: "anywhere",
};

const mainDescription: CSSProperties = {
  marginTop: 8,
  color: "#4b5563",
  fontSize: 13.5,
  lineHeight: 1.65,
  whiteSpace: "pre-wrap",
};

const emptyDescription: CSSProperties = {
  marginTop: 8,
  color: "#9ca3af",
  fontSize: 13.5,
};

const notesText: CSSProperties = {
  color: "#374151",
  fontSize: 13.5,
  lineHeight: 1.65,
  whiteSpace: "pre-wrap",
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