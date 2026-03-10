import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
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

  if (s === "BROUILLON") return "Le dossier peut encore être enrichi avant soumission.";
  if (s === "SOUMIS_AG") return "Le dossier a été soumis pour traitement dans le circuit AG.";
  if (s === "A_VALIDER") return "Le dossier attend une validation avant exécution complète.";
  if (s === "VALIDE") return "Le dossier est validé et prêt pour l’exploitation prévue.";
  if (s === "EN_COURS") return "Le dossier est en cours d’exécution ou de suivi.";
  if (s === "TERMINE") return "Le dossier est clôturé sur le plan opérationnel.";
  if (s === "REFUSE") return "Le dossier n’a pas été retenu ou a été rejeté.";
  if (s === "ANNULE") return "Le dossier a été annulé et ne suit plus le flux actif.";
  if (s === "ARCHIVE") return "Le dossier est conservé à titre d’historique.";
  return "État courant du dossier travaux.";
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
        ([key]) => key !== "detail" && key !== "message" && key !== "non_field_errors"
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

function getStatutStyle(statut?: unknown): CSSProperties {
  const s = normalizeStatut(statut);

  if (s === "VALIDE" || s === "TERMINE") {
    return {
      ...badgeBase,
      color: "#166534",
      background: "#ecfdf5",
      border: "1px solid #a7f3d0",
    };
  }

  if (s === "SOUMIS_AG" || s === "A_VALIDER" || s === "EN_COURS") {
    return {
      ...badgeBase,
      color: "#1d4ed8",
      background: "#eff6ff",
      border: "1px solid #bfdbfe",
    };
  }

  if (s === "BROUILLON") {
    return {
      ...badgeBase,
      color: "#374151",
      background: "#f3f4f6",
      border: "1px solid #e5e7eb",
    };
  }

  if (s === "REFUSE" || s === "ANNULE") {
    return {
      ...badgeBase,
      color: "#991b1b",
      background: "#fef2f2",
      border: "1px solid #fecaca",
    };
  }

  return {
    ...badgeBase,
    color: "#92400e",
    background: "#fffbeb",
    border: "1px solid #fde68a",
  };
}

function getMoneyTone(value: number | null, kind: "paid" | "remaining" | "neutral"): CSSProperties {
  if (value === null) return { color: "#111827" };

  if (kind === "paid") {
    return { color: value > 0 ? "#166534" : "#111827" };
  }

  if (kind === "remaining") {
    return { color: value > 0 ? "#92400e" : "#166534" };
  }

  return { color: "#111827" };
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

function computeBudgetReference(raw: TravauxRawItem, budgetEstime: number | null, budgetVote: number | null) {
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

function computeResteAPayer(raw: TravauxRawItem, budgetReference: number | null, totalPaye: number | null) {
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
        whiteSpace: "pre-wrap",
        lineHeight: 1.5,
      }}
    >
      {props.children}
    </div>
  );
}

function SmallButton(props: {
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
          border: props.primary ? "1px solid #c7d2fe" : "1px solid #e5e7eb",
          background: props.disabled ? "#f9fafb" : props.primary ? "#eef2ff" : "#fff",
          color: props.disabled ? "#9ca3af" : props.primary ? "#3730a3" : "#111827",
          borderRadius: 12,
          padding: "10px 14px",
          fontSize: 13,
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

function InfoCard(props: { title: string; children: ReactNode; right?: ReactNode }) {
  return (
    <section
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 20,
        background: "#fff",
        boxShadow: "0 10px 30px rgba(15, 23, 42, 0.04)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "16px 18px",
          borderBottom: "1px solid #f3f4f6",
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <div style={{ fontSize: 16, fontWeight: 900, color: "#111827" }}>{props.title}</div>
        {props.right ? <div>{props.right}</div> : null}
      </div>

      <div style={{ padding: 18 }}>{props.children}</div>
    </section>
  );
}

function DataGrid(props: { items: Array<{ label: string; value: ReactNode }> }) {
  return (
    <div
      className="travaux-detail-grid"
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
        gap: 14,
      }}
    >
      {props.items.map((item) => (
        <div
          key={String(item.label)}
          style={{
            border: "1px solid #f3f4f6",
            borderRadius: 16,
            background: "#fcfcfd",
            padding: 14,
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 800, color: "#6b7280", marginBottom: 8 }}>
            {item.label}
          </div>
          <div style={{ fontSize: 14, color: "#111827", lineHeight: 1.5 }}>{item.value}</div>
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
  return (
    <div
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 18,
        padding: 16,
        background: "#fff",
      }}
    >
      <div style={{ fontSize: 13, color: "#6b7280", fontWeight: 800, marginBottom: 8 }}>
        {props.title}
      </div>
      <div
        style={{
          fontSize: 24,
          fontWeight: 900,
          letterSpacing: -0.4,
          lineHeight: 1.1,
          ...getMoneyTone(props.rawValue ?? null, props.tone ?? "neutral"),
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

function LockPill({ locked }: { locked: boolean }) {
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
        color: locked ? "#166534" : "#92400e",
        background: locked ? "#ecfdf5" : "#fffbeb",
        border: locked ? "1px solid #a7f3d0" : "1px solid #fde68a",
      }}
    >
      {locked ? "Verrouillé" : "Non verrouillé"}
    </span>
  );
}

function SummaryStat(props: { label: string; value: ReactNode; sub?: string }) {
  return (
    <div
      style={{
        border: "1px solid #eef2f7",
        borderRadius: 18,
        background: "#fff",
        padding: 16,
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 800, color: "#6b7280", marginBottom: 8 }}>{props.label}</div>
      <div style={{ fontSize: 18, fontWeight: 900, color: "#111827", lineHeight: 1.2 }}>{props.value}</div>
      {props.sub ? (
        <div style={{ marginTop: 8, fontSize: 12, lineHeight: 1.45, color: "#6b7280" }}>{props.sub}</div>
      ) : null}
    </div>
  );
}

export default function TravauxDossierDetail() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  const [state, setState] = useState<LoadState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [item, setItem] = useState<DossierDetailView | null>(null);

  async function fetchData() {
    if (!id) {
      setState("error");
      setError("Identifiant de dossier travaux manquant.");
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
      setError(getErrorMessage(e, "Impossible de charger le détail du dossier travaux."));
      setItem(null);
    }
  }

  useEffect(() => {
    void fetchData();
  }, [id]);

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

  return (
    <PageShell>
      <SectionTitle
        title={item ? item.titre : "Détail du dossier travaux"}
        subtitle="Consultez la fiche détaillée du dossier, sa situation budgétaire, son état d’avancement, la résolution liée et le niveau de verrouillage."
        right={
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <SmallButton onClick={() => navigate("/travaux/dossiers")}>Retour à la liste</SmallButton>

            {id ? (
              <SmallButton
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
              </SmallButton>
            ) : null}

            <SmallButton onClick={() => void fetchData()} disabled={isLoading}>
              {isLoading ? "Actualisation..." : "Actualiser"}
            </SmallButton>
          </div>
        }
      />

      {state === "error" && error ? (
        <AlertBox kind="error">
          <div style={{ fontWeight: 900, marginBottom: 4 }}>Impossible de charger le dossier travaux</div>
          <div style={{ fontSize: 13 }}>{error}</div>
        </AlertBox>
      ) : null}

      {isLoading ? (
        <InfoCard title="Chargement">
          <div style={{ color: "#6b7280", fontSize: 14 }}>Chargement du détail du dossier travaux...</div>
        </InfoCard>
      ) : null}

      {!isLoading && !item && state !== "error" ? (
        <InfoCard title="Aucune donnée">
          <div style={{ color: "#6b7280", fontSize: 14 }}>
            Aucun dossier travaux n’a pu être affiché pour cet identifiant.
          </div>
        </InfoCard>
      ) : null}

      {item ? (
        <>
          <InfoCard
            title="Vue d’ensemble"
            right={
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <span style={getStatutStyle(item.statut)}>{humanizeStatut(item.statut)}</span>
                <LockPill locked={item.locked} />
              </div>
            }
          >
            <div style={{ display: "grid", gap: 16 }}>
              <div>
                <div
                  style={{
                    fontSize: 24,
                    fontWeight: 900,
                    color: "#111827",
                    lineHeight: 1.15,
                    letterSpacing: -0.4,
                  }}
                >
                  {item.titre}
                </div>

                {item.description ? (
                  <div
                    style={{
                      marginTop: 10,
                      color: "#4b5563",
                      fontSize: 14,
                      lineHeight: 1.7,
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    {item.description}
                  </div>
                ) : (
                  <div style={{ marginTop: 10, color: "#9ca3af", fontSize: 14 }}>
                    Aucune description renseignée.
                  </div>
                )}
              </div>

              <div
                className="travaux-summary-grid"
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                  gap: 14,
                }}
              >
                <SummaryStat label="Statut" value={humanizeStatut(item.statut)} sub={getStatutHint(item.statut)} />
                <SummaryStat
                  label="Résolution liée"
                  value={item.resolutionId ? `#${item.resolutionId}` : "—"}
                  sub={item.resolutionId ? "Le dossier est rattaché à une résolution." : "Aucune résolution liée."}
                />
                <SummaryStat
                  label="Fournisseur"
                  value={item.fournisseurLabel || "—"}
                  sub={
                    item.fournisseurLabel && item.fournisseurLabel !== "—"
                      ? "Prestataire actuellement associé au dossier."
                      : "Aucun fournisseur exploitable n’est affiché."
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
                />
              </div>

              <DataGrid
                items={[
                  { label: "ID dossier", value: <strong>#{item.id}</strong> },
                  { label: "Référence", value: item.reference || "—" },
                  { label: "Fournisseur", value: item.fournisseurLabel || "—" },
                  { label: "Résolution liée", value: item.resolutionId ? `#${item.resolutionId}` : "—" },
                  {
                    label: "État de verrouillage",
                    value: item.locked ? (
                      <span style={{ color: "#166534", fontWeight: 800 }}>Dossier verrouillé</span>
                    ) : (
                      <span style={{ color: "#92400e", fontWeight: 800 }}>Dossier non verrouillé</span>
                    ),
                  },
                  {
                    label: "Date de verrouillage",
                    value: item.lockedAt ? fmtDateTime(item.lockedAt) : "—",
                  },
                ]}
              />
            </div>
          </InfoCard>

          <InfoCard title="Situation budgétaire">
            <div
              className="travaux-budget-grid"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
                gap: 14,
              }}
            >
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
                sub="Paiements déjà enregistrés sur ce dossier."
              />
              <BudgetCard
                title="Reste à payer"
                value={fmtMoney(finance.resteAPayer)}
                rawValue={finance.resteAPayer}
                tone="remaining"
                sub="Montant restant à engager ou à régler."
              />
            </div>
          </InfoCard>

          <InfoCard title="Dates utiles">
            <DataGrid
              items={[
                { label: "Créé le", value: fmtDateTime(item.createdAt) },
                { label: "Mis à jour le", value: fmtDateTime(item.updatedAt) },
                { label: "Soumis à l’AG le", value: fmtDateTime(item.submittedAt) },
                { label: "Validé le", value: fmtDateTime(item.validatedAt) },
                { label: "Début prévu / réel", value: fmtDate(item.startedAt) },
                { label: "Fin prévue / réelle", value: fmtDate(item.endedAt) },
              ]}
            />
          </InfoCard>

          <InfoCard title="Notes complémentaires">
            {item.notes ? (
              <div
                style={{
                  color: "#374151",
                  fontSize: 14,
                  lineHeight: 1.7,
                  whiteSpace: "pre-wrap",
                }}
              >
                {item.notes}
              </div>
            ) : (
              <div style={{ color: "#9ca3af", fontSize: 14 }}>Aucune note complémentaire.</div>
            )}
          </InfoCard>

          <InfoCard title="Actions rapides">
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <SmallButton to="/travaux/dossiers">Retour à la liste</SmallButton>

              <SmallButton
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
              </SmallButton>

              <SmallButton
                to={canOpenResolution ? `/ag/resolutions/${item.resolutionId}` : undefined}
                disabled={!canOpenResolution}
                title={
                  canOpenResolution
                    ? "Ouvrir la résolution liée"
                    : "Aucune résolution liée à ce dossier."
                }
              >
                Ouvrir la résolution liée
              </SmallButton>
            </div>
          </InfoCard>
        </>
      ) : null}

      <style>{`
        @media (max-width: 1180px) {
          .travaux-budget-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }

          .travaux-summary-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }
        }

        @media (max-width: 860px) {
          .travaux-detail-grid {
            grid-template-columns: 1fr !important;
          }

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

const badgeBase: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "4px 10px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 800,
  whiteSpace: "nowrap",
};