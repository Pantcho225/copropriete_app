import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import api from "../../api/axios";

type LoadState = "idle" | "loading" | "success" | "error";
type ResolutionStatus = "EN_ATTENTE" | "ADOPTEE" | "REJETEE";
type FlashKind = "success" | "error" | "info";
type MajoriteType = "SIMPLE" | "ABSOLUE" | "QUALIFIEE_2_3" | "UNANIMITE";

type ResolutionItem = {
  id: number;
  numero: string;
  ordre?: number | null;
  assemblee_id?: number | null;
  assemblee_ref: string;
  assemblee_titre: string;
  titre: string;
  texte?: string | null;
  type_majorite?: string | null;
  tantieme_categorie?: string | null;
  budget_vote?: number | null;
  cloturee?: boolean;
  travaux_dossier_titre?: string | null;
  statut: ResolutionStatus;
};

type ResolutionResult = {
  resolution_id: number;
  type_majorite?: string;
  decision: "ADOPTEE" | "REJETEE";
  tantiemes?: {
    pour?: number;
    contre?: number;
    abstention?: number;
    exprimes?: number;
    ratio_pour_exprimes?: number;
  };
};

type ResolutionFormValues = {
  ag: number | null;
  ordre: number | null;
  titre: string;
  texte: string;
  type_majorite: MajoriteType;
  budget_vote: string;
};

type DRFPage<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

const RESOLUTION_ENDPOINT = "/api/ag/resolutions/";
const RESOLUTION_ENDPOINT_CANDIDATES = ["/api/ag/resolutions/", "/api/ag/resolutions"];

const INITIAL_FORM: ResolutionFormValues = {
  ag: null,
  ordre: null,
  titre: "",
  texte: "",
  type_majorite: "SIMPLE",
  budget_vote: "",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function isPaginatedResponse<T = unknown>(value: unknown): value is DRFPage<T> {
  return isRecord(value) && Array.isArray(value.results) && typeof value.count === "number";
}

function asArray<T = unknown>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function toNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function toBooleanOrNull(value: unknown): boolean | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const s = value.trim().toLowerCase();
    if (["true", "1", "oui", "yes", "ok"].includes(s)) return true;
    if (["false", "0", "non", "no"].includes(s)) return false;
  }
  return null;
}

function pickString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function pickNullableString(...values: unknown[]): string | null {
  const s = pickString(...values);
  return s || null;
}

function normalizeResolutionStatus(value: unknown, cloturee?: boolean | null): ResolutionStatus {
  const s = String(value ?? "").trim().toUpperCase();

  if (["ADOPTEE", "VALIDEE", "VALIDE", "APPROUVEE"].includes(s)) return "ADOPTEE";
  if (["REJETEE", "REJETE", "REFUSEE", "REFUSE"].includes(s)) return "REJETEE";

  if (cloturee) return "EN_ATTENTE";
  return "EN_ATTENTE";
}

function normalizeResolutionItem(raw: unknown, index: number): ResolutionItem {
  const row = isRecord(raw) ? raw : {};

  const agObject = isRecord(row.ag) ? row.ag : null;
  const assembleeObject = isRecord(row.assemblee) ? row.assemblee : null;

  const assembleeId =
    toNumberOrNull(row.assemblee_id) ??
    toNumberOrNull(row.ag_id) ??
    toNumberOrNull(row.ag) ??
    toNumberOrNull(row.assemblee) ??
    toNumberOrNull(agObject?.id) ??
    toNumberOrNull(assembleeObject?.id) ??
    null;

  const ordre = toNumberOrNull(row.ordre);
  const cloturee = toBooleanOrNull(row.cloturee) ?? false;

  const numero =
    pickString(row.numero, row.reference, row.code) ||
    (ordre !== null ? `R${ordre}` : `R${index + 1}`);

  const assembleeRef =
    pickString(
      row.assemblee_ref,
      row.assemblee_reference,
      row.ag_reference,
      agObject?.reference,
      assembleeObject?.reference,
      agObject?.ref,
      assembleeObject?.ref,
    ) || (assembleeId ? `AG-${assembleeId}` : "—");

  const assembleeTitre =
    pickString(
      row.assemblee_titre,
      row.ag_titre,
      agObject?.titre,
      assembleeObject?.titre,
      agObject?.nom,
      assembleeObject?.nom,
    ) || "Assemblée générale";

  return {
    id: toNumberOrNull(row.id) ?? toNumberOrNull(row.resolution_id) ?? index + 1,
    numero,
    ordre,
    assemblee_id: assembleeId,
    assemblee_ref: assembleeRef,
    assemblee_titre: assembleeTitre,
    titre: pickString(row.titre, row.title, row.intitule, row.nom, row.objet) || "Résolution sans titre",
    texte: pickNullableString(row.texte, row.description, row.contenu),
    type_majorite: pickNullableString(row.type_majorite),
    tantieme_categorie: pickNullableString(
      row.tantieme_categorie_effective,
      row.tantieme_categorie_label,
      row.tantieme_categorie,
    ),
    budget_vote:
      toNumberOrNull(row.budget_vote) ??
      toNumberOrNull(row.montant_vote) ??
      toNumberOrNull(row.budget) ??
      null,
    cloturee,
    travaux_dossier_titre: pickNullableString(row.travaux_dossier_titre),
    statut: normalizeResolutionStatus(row.decision ?? row.statut ?? row.status ?? row.resultat, cloturee),
  };
}

function normalizeResolutionResult(raw: unknown): ResolutionResult | null {
  const row = isRecord(raw) ? raw : null;
  if (!row) return null;

  const decision = String(row.decision ?? "").trim().toUpperCase();
  if (!["ADOPTEE", "REJETEE"].includes(decision)) return null;

  const tantiemesRow = isRecord(row.tantiemes) ? row.tantiemes : {};

  return {
    resolution_id: toNumberOrNull(row.resolution_id) ?? 0,
    type_majorite: pickString(row.type_majorite) || undefined,
    decision: decision as "ADOPTEE" | "REJETEE",
    tantiemes: {
      pour: toNumberOrNull(tantiemesRow.pour) ?? 0,
      contre: toNumberOrNull(tantiemesRow.contre) ?? 0,
      abstention: toNumberOrNull(tantiemesRow.abstention) ?? 0,
      exprimes: toNumberOrNull(tantiemesRow.exprimes) ?? 0,
      ratio_pour_exprimes: Number(tantiemesRow.ratio_pour_exprimes ?? 0),
    },
  };
}

function getErrorMessage(error: unknown, fallback: string) {
  const err = error as {
    response?: {
      data?: {
        detail?: string | string[];
        message?: string;
        errors?: Record<string, string[]>;
        [key: string]: unknown;
      };
    };
    message?: string;
  };

  const data = err?.response?.data;

  if (typeof data?.detail === "string" && data.detail.trim()) return data.detail;
  if (Array.isArray(data?.detail) && typeof data.detail[0] === "string") return data.detail[0];
  if (typeof data?.message === "string" && data.message.trim()) return data.message;

  if (data?.errors && typeof data.errors === "object") {
    const firstEntry = Object.values(data.errors)[0];
    if (Array.isArray(firstEntry) && typeof firstEntry[0] === "string") return firstEntry[0];
  }

  if (isRecord(data)) {
    for (const value of Object.values(data)) {
      if (Array.isArray(value) && typeof value[0] === "string") return value[0];
      if (typeof value === "string" && value.trim()) return value;
    }
  }

  return err?.message || fallback;
}

function PageShell({ children }: { children: ReactNode }) {
  return <div style={{ display: "grid", gap: 16 }}>{children}</div>;
}

function SectionTitle(props: { title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "space-between",
        gap: 12,
        flexWrap: "wrap",
      }}
    >
      <div>
        <div
          style={{
            fontSize: 30,
            fontWeight: 900,
            letterSpacing: -0.6,
            color: "#111827",
            lineHeight: 1.1,
          }}
        >
          {props.title}
        </div>

        {props.subtitle ? (
          <div
            style={{
              fontSize: 14,
              color: "#6b7280",
              marginTop: 6,
              lineHeight: 1.5,
              maxWidth: 920,
            }}
          >
            {props.subtitle}
          </div>
        ) : null}
      </div>

      {props.right ? <div>{props.right}</div> : null}
    </div>
  );
}

function StatCard(props: { title: string; value: string | number; sub?: string; isLoading?: boolean }) {
  return (
    <div
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 20,
        padding: 18,
        background: "#ffffff",
        boxShadow: "0 10px 30px rgba(15, 23, 42, 0.04)",
        minHeight: 112,
      }}
    >
      <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 10, fontWeight: 700 }}>
        {props.title}
      </div>
      <div
        style={{
          fontSize: 28,
          fontWeight: 900,
          letterSpacing: -0.5,
          color: "#111827",
          lineHeight: 1.1,
        }}
      >
        {props.isLoading ? "…" : props.value}
      </div>
      {props.sub ? (
        <div style={{ marginTop: 8, fontSize: 12, color: "#6b7280", lineHeight: 1.45 }}>
          {props.sub}
        </div>
      ) : null}
    </div>
  );
}

function SmallButton(props: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  primary?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      disabled={props.disabled}
      style={{
        border: props.danger
          ? "1px solid #fecaca"
          : props.primary
            ? "1px solid #c7d2fe"
            : "1px solid #e5e7eb",
        background: props.disabled
          ? "#f9fafb"
          : props.danger
            ? "#fef2f2"
            : props.primary
              ? "#eef2ff"
              : "#fff",
        color: props.disabled
          ? "#9ca3af"
          : props.danger
            ? "#991b1b"
            : props.primary
              ? "#3730a3"
              : "#111827",
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

function EmptyState(props: { title: string; text: string; actionLabel?: string; onAction?: () => void }) {
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
      {props.actionLabel && props.onAction ? (
        <div style={{ marginTop: 12 }}>
          <SmallButton onClick={props.onAction} primary>
            {props.actionLabel}
          </SmallButton>
        </div>
      ) : null}
    </div>
  );
}

function AlertBox(props: { kind: "error" | "info" | "success"; children: ReactNode }) {
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
        lineHeight: 1.5,
      }}
    >
      {props.children}
    </div>
  );
}

function Badge(props: { text: string; kind?: "neutral" | "success" | "warning" | "danger" | "info" }) {
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
        fontWeight: 700,
        border: `1px solid ${styles.border}`,
        background: styles.background,
        color: styles.color,
        whiteSpace: "nowrap",
      }}
    >
      {props.text}
    </span>
  );
}

function formatMoneyFCFA(amount?: number | null): string {
  if (amount === null || amount === undefined) return "—";
  try {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "XOF",
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${amount} FCFA`;
  }
}

function truncateText(value?: string | null, max = 120): string {
  if (!value) return "—";
  const s = String(value).trim();
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}

function formatPercent(value?: number | null): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "0 %";
  return `${Math.round(value * 100)} %`;
}

function getStatusBadge(item: ResolutionItem) {
  if (item.cloturee && item.statut === "ADOPTEE") return <Badge text="Adoptée" kind="success" />;
  if (item.cloturee && item.statut === "REJETEE") return <Badge text="Rejetée" kind="danger" />;
  if (item.cloturee) return <Badge text="Clôturée" kind="neutral" />;
  return <Badge text="En attente" kind="warning" />;
}

function buildCreatePayload(values: ResolutionFormValues) {
  return {
    ag: values.ag,
    ordre: values.ordre,
    titre: values.titre.trim(),
    texte: values.texte.trim(),
    type_majorite: values.type_majorite,
    ...(values.budget_vote.trim() ? { budget_vote: Number(values.budget_vote) } : {}),
  };
}

function formatMoneySimple(value?: number | null): string {
  if (value === null || value === undefined) return "0";
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(value);
}

export default function AGResolutions() {
  const navigate = useNavigate();
  const params = useParams();

  const agIdParam = params.id ?? "";
  const ag = toNumberOrNull(agIdParam);

  const [state, setState] = useState<LoadState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<ResolutionItem[]>([]);
  const [message, setMessage] = useState<{ kind: FlashKind; text: string } | null>(null);

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"TOUS" | ResolutionStatus>("TOUS");

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<ResolutionFormValues>({
    ...INITIAL_FORM,
    ag,
  });

  const [busyResultId, setBusyResultId] = useState<number | null>(null);
  const [busyCloseId, setBusyCloseId] = useState<number | null>(null);
  const [resultByResolution, setResultByResolution] = useState<Record<number, ResolutionResult | null>>({});

  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      ag,
    }));
  }, [ag]);

  async function fetchResolutions() {
    setState("loading");
    setError(null);

    let lastError: unknown = null;

    for (const endpoint of RESOLUTION_ENDPOINT_CANDIDATES) {
      try {
        const finalEndpoint = ag ? `${endpoint}?ag=${ag}` : endpoint;
        const res = await api.get(finalEndpoint);
        const data = res?.data;

        const rawRows = isPaginatedResponse<Record<string, unknown>>(data)
          ? data.results
          : asArray<Record<string, unknown>>(data);

        const normalized = rawRows
          .map(normalizeResolutionItem)
          .filter((item) => item.id > 0)
          .sort((a, b) => {
            const ao = a.ordre ?? a.id;
            const bo = b.ordre ?? b.id;
            if (ao !== bo) return ao - bo;
            return a.id - b.id;
          });

        setRows(normalized);
        setState("success");
        return;
      } catch (e) {
        lastError = e;
      }
    }

    setRows([]);
    setState("error");
    setError(getErrorMessage(lastError, "Impossible de charger la liste des résolutions."));
  }

  useEffect(() => {
    void fetchResolutions();
  }, [ag]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    return rows.filter((item) => {
      const matchesStatus = statusFilter === "TOUS" ? true : item.statut === statusFilter;
      if (!matchesStatus) return false;
      if (!q) return true;

      const haystack = [
        item.numero,
        item.assemblee_ref,
        item.assemblee_titre,
        item.titre,
        item.texte ?? "",
        item.type_majorite ?? "",
        item.tantieme_categorie ?? "",
        item.travaux_dossier_titre ?? "",
        item.statut,
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(q);
    });
  }, [rows, query, statusFilter]);

  const stats = useMemo(() => {
    return {
      total: rows.length,
      adoptees: rows.filter((x) => x.statut === "ADOPTEE").length,
      rejetees: rows.filter((x) => x.statut === "REJETEE").length,
      attente: rows.filter((x) => !x.cloturee || x.statut === "EN_ATTENTE").length,
    };
  }, [rows]);

  const isLoading = state === "loading";

  function updateField<K extends keyof ResolutionFormValues>(field: K, value: ResolutionFormValues[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function resetForm() {
    setForm({
      ...INITIAL_FORM,
      ag,
    });
  }

  function suggestNextOrdre() {
    const maxOrdre = rows.reduce((max, item) => {
      const ord = item.ordre ?? 0;
      return ord > max ? ord : max;
    }, 0);

    setForm((prev) => ({
      ...prev,
      ag,
      ordre: maxOrdre > 0 ? maxOrdre + 1 : 1,
    }));
    setShowCreateForm(true);
  }

  function validateForm() {
    if (!form.ag) return "L’identifiant de l’assemblée (AG) est obligatoire.";
    if (!form.ordre) return "L’ordre de la résolution est obligatoire.";
    if (!form.titre.trim()) return "Le titre de la résolution est obligatoire.";
    if (!form.texte.trim()) return "Le texte de la résolution est obligatoire.";

    if (form.budget_vote.trim()) {
      const n = Number(form.budget_vote);
      if (!Number.isFinite(n) || n < 0) return "Le budget voté doit être un nombre positif ou vide.";
    }

    return null;
  }

  async function handleCreateResolution() {
    const validationError = validateForm();
    if (validationError) {
      setMessage({ kind: "error", text: validationError });
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const payload = buildCreatePayload(form);
      await api.post(RESOLUTION_ENDPOINT, payload);

      setMessage({ kind: "success", text: "Résolution créée avec succès." });
      resetForm();
      setShowCreateForm(false);
      await fetchResolutions();
    } catch (e) {
      setMessage({
        kind: "error",
        text: getErrorMessage(e, "Impossible de créer la résolution."),
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleComputeResult(item: ResolutionItem) {
    setBusyResultId(item.id);
    setMessage(null);

    try {
      const res = await api.get(`/api/ag/resolutions/${item.id}/resultat/`);
      const normalized = normalizeResolutionResult(res.data);

      if (!normalized) throw new Error("Résultat de résolution introuvable.");

      setResultByResolution((prev) => ({
        ...prev,
        [item.id]: normalized,
      }));

      setMessage({
        kind: "success",
        text: `Résultat calculé pour ${item.numero} : ${normalized.decision}.`,
      });
    } catch (e) {
      setMessage({
        kind: "error",
        text: getErrorMessage(e, "Impossible de calculer le résultat de la résolution."),
      });
    } finally {
      setBusyResultId(null);
    }
  }

  async function handleCloseResolution(item: ResolutionItem) {
    setBusyCloseId(item.id);
    setMessage(null);

    try {
      const payload =
        item.budget_vote !== null && item.budget_vote !== undefined ? { budget_vote: item.budget_vote } : {};

      const res = await api.post(`/api/ag/resolutions/${item.id}/cloturer/`, payload);
      const decision = String(res?.data?.decision ?? "").trim().toUpperCase();

      setMessage({
        kind: "success",
        text:
          decision === "ADOPTEE"
            ? `${item.numero} a été clôturée et adoptée.`
            : decision === "REJETEE"
              ? `${item.numero} a été clôturée et rejetée.`
              : `${item.numero} a été clôturée avec succès.`,
      });

      await fetchResolutions();
    } catch (e) {
      setMessage({
        kind: "error",
        text: getErrorMessage(e, "Impossible de clôturer la résolution."),
      });
    } finally {
      setBusyCloseId(null);
    }
  }

  return (
    <PageShell>
      <SectionTitle
        title={ag ? `Résolutions de l’AG ${ag}` : "Résolutions"}
        subtitle={
          ag
            ? "Créez, suivez et clôturez les résolutions de cette assemblée générale avant la génération du procès-verbal."
            : "Suivez les résolutions rattachées aux assemblées générales, leur majorité, leur clôture et leur impact métier."
        }
        right={
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {ag ? (
              <SmallButton onClick={() => navigate(`/ag/assemblees/${ag}`)}>Retour à l’assemblée</SmallButton>
            ) : (
              <SmallButton onClick={() => navigate("/ag")}>Retour au module AG</SmallButton>
            )}

            <SmallButton onClick={suggestNextOrdre} primary>
              {showCreateForm ? "Nouvelle résolution" : "Ajouter une résolution"}
            </SmallButton>

            {ag ? (
              <SmallButton onClick={() => navigate(`/ag/assemblees/${ag}/votes`)}>Voir les votes</SmallButton>
            ) : (
              <SmallButton onClick={() => navigate("/ag/assemblees")}>Voir les assemblées</SmallButton>
            )}
          </div>
        }
      />

      {message ? (
        <AlertBox kind={message.kind === "success" ? "success" : message.kind === "error" ? "error" : "info"}>
          <div style={{ fontSize: 13 }}>{message.text}</div>
        </AlertBox>
      ) : null}

      {showCreateForm ? (
        <div style={card}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
              marginBottom: 14,
            }}
          >
            <div style={{ fontSize: 16, fontWeight: 900, color: "#111827" }}>Créer une résolution</div>
            <SmallButton onClick={() => setShowCreateForm(false)} disabled={saving}>
              Fermer
            </SmallButton>
          </div>

          <div style={formGrid}>
            <div style={field}>
              <label style={label}>Assemblée (ID) *</label>
              <input
                type="number"
                min="1"
                step="1"
                value={form.ag ?? ""}
                onChange={(e) => updateField("ag", toNumberOrNull(e.target.value))}
                placeholder="Ex. 11"
                style={input}
                disabled={Boolean(ag)}
              />
              <div style={hint}>
                {ag
                  ? `Cette résolution sera créée dans l’AG ${ag}.`
                  : "Saisissez l’identifiant numérique de l’assemblée concernée."}
              </div>
            </div>

            <div style={field}>
              <label style={label}>Ordre *</label>
              <input
                type="number"
                min="1"
                step="1"
                value={form.ordre ?? ""}
                onChange={(e) => updateField("ordre", toNumberOrNull(e.target.value))}
                placeholder="Ex. 1"
                style={input}
              />
              <div style={hint}>Ordre d’apparition de la résolution dans l’AG.</div>
            </div>

            <div style={fieldFull}>
              <label style={label}>Titre *</label>
              <input
                value={form.titre}
                onChange={(e) => updateField("titre", e.target.value)}
                placeholder="Ex. Validation des comptes de l’exercice"
                style={input}
              />
            </div>

            <div style={fieldFull}>
              <label style={label}>Texte *</label>
              <textarea
                value={form.texte}
                onChange={(e) => updateField("texte", e.target.value)}
                placeholder="Texte détaillé de la résolution"
                style={textarea}
              />
            </div>

            <div style={field}>
              <label style={label}>Type de majorité *</label>
              <select
                value={form.type_majorite}
                onChange={(e) => updateField("type_majorite", e.target.value as MajoriteType)}
                style={input}
              >
                <option value="SIMPLE">Majorité simple</option>
                <option value="ABSOLUE">Majorité absolue</option>
                <option value="QUALIFIEE_2_3">Majorité qualifiée 2/3</option>
                <option value="UNANIMITE">Unanimité</option>
              </select>
            </div>

            <div style={field}>
              <label style={label}>Budget voté (optionnel)</label>
              <input
                value={form.budget_vote}
                onChange={(e) => updateField("budget_vote", e.target.value)}
                placeholder="Ex. 1400000"
                style={input}
              />
            </div>
          </div>

          <div style={actions}>
            <SmallButton onClick={resetForm} disabled={saving}>
              Réinitialiser
            </SmallButton>
            <SmallButton onClick={() => void handleCreateResolution()} primary disabled={saving}>
              {saving ? "Création..." : "Créer la résolution"}
            </SmallButton>
          </div>
        </div>
      ) : null}

      {state === "error" && error ? (
        <AlertBox kind="error">
          <div style={{ fontWeight: 900, marginBottom: 4 }}>Chargement impossible</div>
          <div style={{ fontSize: 13 }}>{error}</div>
        </AlertBox>
      ) : null}

      <div className="ag-resolutions-stat-grid">
        <StatCard title="Résolutions" value={stats.total} sub="Nombre total de résolutions visibles." isLoading={isLoading} />
        <StatCard title="Adoptées" value={stats.adoptees} sub="Résolutions validées dans le cycle AG." isLoading={isLoading} />
        <StatCard title="Rejetées" value={stats.rejetees} sub="Résolutions refusées après clôture." isLoading={isLoading} />
        <StatCard title="En attente" value={stats.attente} sub="Résolutions encore non clôturées ou non tranchées." isLoading={isLoading} />
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher : résolution, assemblée, majorité, dossier travaux..."
            style={searchInput}
          />

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as "TOUS" | ResolutionStatus)}
            style={selectInput}
          >
            <option value="TOUS">Tous les statuts</option>
            <option value="ADOPTEE">Adoptées</option>
            <option value="REJETEE">Rejetées</option>
            <option value="EN_ATTENTE">En attente</option>
          </select>

          <SmallButton onClick={() => void fetchResolutions()} disabled={isLoading}>
            {isLoading ? "Actualisation..." : "Actualiser"}
          </SmallButton>
        </div>

        <div style={{ color: "#6b7280", fontSize: 13, fontWeight: 600 }}>
          {isLoading ? "Chargement des résolutions..." : `${filtered.length} résolution(s) affichée(s)`}
        </div>
      </div>

      <div style={tableWrap}>
        {isLoading ? (
          <div style={{ padding: 16, color: "#6b7280", fontSize: 14 }}>Chargement des résolutions…</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 16 }}>
            <EmptyState
              title={rows.length === 0 ? "Aucune résolution enregistrée" : "Aucune résolution à afficher"}
              text={
                rows.length === 0
                  ? "Aucune résolution n’a encore été trouvée pour cette sélection."
                  : "Aucune résolution ne correspond à la recherche ou aux filtres sélectionnés."
              }
              actionLabel="Créer une résolution"
              onAction={suggestNextOrdre}
            />
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left" }}>
                <th style={th}>Résolution</th>
                <th style={th}>Assemblée</th>
                <th style={th}>Contenu</th>
                <th style={th}>Cadre</th>
                <th style={th}>Budget voté</th>
                <th style={th}>État</th>
                <th style={th}>Actions</th>
              </tr>
            </thead>

            <tbody>
              {filtered.map((item) => {
                const result = resultByResolution[item.id];

                return (
                  <tr key={item.id}>
                    <td style={tdMono}>
                      <div style={{ fontWeight: 900 }}>{item.numero}</div>
                      {item.ordre !== null && item.ordre !== undefined ? (
                        <div style={{ marginTop: 4, fontSize: 12, color: "#6b7280" }}>Ordre {item.ordre}</div>
                      ) : null}
                    </td>

                    <td style={td}>
                      <div style={{ fontWeight: 800, color: "#111827" }}>{item.assemblee_ref}</div>
                      <div style={{ marginTop: 4, fontSize: 12, color: "#6b7280" }}>{item.assemblee_titre}</div>
                    </td>

                    <td style={td}>
                      <div style={{ fontWeight: 700, color: "#111827" }}>{item.titre}</div>
                      {item.texte ? (
                        <div style={{ marginTop: 4, fontSize: 12, color: "#6b7280", lineHeight: 1.45 }}>
                          {truncateText(item.texte, 140)}
                        </div>
                      ) : null}

                      {result ? (
                        <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
                          <Badge
                            text={`Décision : ${result.decision}`}
                            kind={result.decision === "ADOPTEE" ? "success" : "danger"}
                          />
                          <Badge text={`Expr. : ${formatMoneySimple(result.tantiemes?.exprimes)}`} kind="info" />
                          <Badge text={`Pour : ${formatMoneySimple(result.tantiemes?.pour)}`} kind="success" />
                          <Badge text={`Contre : ${formatMoneySimple(result.tantiemes?.contre)}`} kind="danger" />
                          <Badge text={`Ratio : ${formatPercent(result.tantiemes?.ratio_pour_exprimes)}`} kind="neutral" />
                        </div>
                      ) : null}
                    </td>

                    <td style={td}>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {item.type_majorite ? <Badge text={item.type_majorite} kind="neutral" /> : null}
                        {item.tantieme_categorie ? <Badge text={item.tantieme_categorie} kind="info" /> : null}
                        {item.travaux_dossier_titre ? <Badge text={item.travaux_dossier_titre} kind="warning" /> : null}
                      </div>
                    </td>

                    <td style={tdStrong}>{formatMoneyFCFA(item.budget_vote)}</td>

                    <td style={td}>{getStatusBadge(item)}</td>

                    <td style={td}>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <Link
                          to={item.assemblee_id ? `/ag/assemblees/${item.assemblee_id}` : "/ag/assemblees"}
                          style={primaryMiniLink}
                        >
                          Voir l’assemblée
                        </Link>

                        {!item.cloturee ? (
                          <>
                            <button
                              type="button"
                              onClick={() => void handleComputeResult(item)}
                              disabled={busyResultId === item.id || busyCloseId === item.id}
                              style={secondaryMiniButton}
                            >
                              {busyResultId === item.id ? "Calcul..." : "Résultat"}
                            </button>

                            <button
                              type="button"
                              onClick={() => void handleCloseResolution(item)}
                              disabled={busyCloseId === item.id || busyResultId === item.id}
                              style={successMiniButton}
                            >
                              {busyCloseId === item.id ? "Clôture..." : "Clôturer"}
                            </button>
                          </>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <style>{`
        .ag-resolutions-stat-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 14px;
        }

        @media (max-width: 1200px) {
          .ag-resolutions-stat-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 760px) {
          .ag-resolutions-stat-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 900px) {
          .ag-resolutions-form-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </PageShell>
  );
}

const card: CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 20,
  padding: 18,
  background: "#fff",
  boxShadow: "0 10px 30px rgba(15, 23, 42, 0.04)",
};

const formGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 14,
};

const field: CSSProperties = {
  display: "grid",
  gap: 8,
};

const fieldFull: CSSProperties = {
  ...field,
  gridColumn: "1 / -1",
};

const label: CSSProperties = {
  fontSize: 13,
  fontWeight: 800,
  color: "#374151",
};

const input: CSSProperties = {
  width: "100%",
  padding: "11px 12px",
  borderRadius: 12,
  border: "1px solid #e5e7eb",
  background: "#fff",
  color: "#111827",
  fontSize: 14,
  outline: "none",
  boxSizing: "border-box",
};

const textarea: CSSProperties = {
  ...input,
  minHeight: 120,
  resize: "vertical",
};

const hint: CSSProperties = {
  fontSize: 12,
  color: "#6b7280",
  lineHeight: 1.45,
};

const actions: CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  gap: 10,
  flexWrap: "wrap",
  marginTop: 18,
};

const searchInput: CSSProperties = {
  minWidth: 280,
  padding: "11px 12px",
  borderRadius: 12,
  border: "1px solid #e5e7eb",
  background: "#fff",
  color: "#111827",
  fontSize: 14,
  outline: "none",
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

const tdMono: CSSProperties = {
  ...td,
  fontWeight: 700,
  whiteSpace: "nowrap",
};

const tdStrong: CSSProperties = {
  ...td,
  fontWeight: 800,
  whiteSpace: "nowrap",
};

const primaryMiniLink: CSSProperties = {
  padding: "7px 10px",
  borderRadius: 10,
  border: "1px solid #c7d2fe",
  background: "#eef2ff",
  fontSize: 12,
  fontWeight: 700,
  color: "#3730a3",
  textDecoration: "none",
  display: "inline-flex",
  alignItems: "center",
};

const secondaryMiniButton: CSSProperties = {
  padding: "7px 10px",
  borderRadius: 10,
  border: "1px solid #dbeafe",
  background: "#eff6ff",
  fontSize: 12,
  fontWeight: 700,
  color: "#1d4ed8",
  cursor: "pointer",
};

const successMiniButton: CSSProperties = {
  padding: "7px 10px",
  borderRadius: 10,
  border: "1px solid #a7f3d0",
  background: "#ecfdf5",
  fontSize: 12,
  fontWeight: 700,
  color: "#166534",
  cursor: "pointer",
};