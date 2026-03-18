import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../../api/axios";

type LoadState = "idle" | "loading" | "success" | "error";
type FlashKind = "success" | "error" | "info";

type PresenceItem = {
  id: number;
  ag: number;
  lot: number;
  lot_reference: string;
  lot_type_lot?: string | null;
  tantiemes: number;
  tantiemes_recalcules?: number | null;
  is_zero_tantieme: boolean;
  present_ou_represente: boolean;
  representant_nom: string;
  commentaire: string;
};

type PresenceFormValues = {
  lot: number | null;
  present_ou_represente: boolean;
  representant_nom: string;
  commentaire: string;
};

type DRFPage<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

const INITIAL_FORM: PresenceFormValues = {
  lot: null,
  present_ou_represente: false,
  representant_nom: "",
  commentaire: "",
};

const AGS_ENDPOINT = "/api/ag/ags/";
const PRESENCES_ENDPOINT = "/api/ag/presences/";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function isPaginatedResponse<T = unknown>(value: unknown): value is DRFPage<T> {
  return isRecord(value) && Array.isArray(value.results) && typeof value.count === "number";
}

function toNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function toBoolean(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const s = value.trim().toLowerCase();
    return ["true", "1", "oui", "yes", "ok"].includes(s);
  }
  return false;
}

function pickString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function formatNumber(value?: number | null): string {
  if (value === null || value === undefined) return "0";
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(value);
}

function extractBlockingReasons(data: unknown): string[] {
  if (!isRecord(data)) return [];
  const value = data.blocking_reasons;
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function getErrorMessage(error: unknown, fallback: string) {
  const err = error as {
    response?: {
      data?: {
        detail?: string | string[];
        message?: string;
        errors?: Record<string, string[]>;
        blocking_reasons?: string[];
        [key: string]: unknown;
      };
      status?: number;
    };
    message?: string;
  };

  const data = err?.response?.data;
  const reasons = extractBlockingReasons(data);

  if (reasons.length > 0) return reasons.join(" ");

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

function normalizePresenceItem(raw: unknown): PresenceItem {
  const row = isRecord(raw) ? raw : {};

  const tantiemes = toNumberOrNull(row.tantiemes) ?? 0;

  return {
    id: toNumberOrNull(row.id) ?? toNumberOrNull(row.pk) ?? 0,
    ag: toNumberOrNull(row.ag) ?? toNumberOrNull(row.ag_id) ?? 0,
    lot: toNumberOrNull(row.lot) ?? toNumberOrNull(row.lot_id) ?? 0,
    lot_reference:
      pickString(
        row.lot_reference,
        row.reference_lot,
        row.lot_ref,
        row.reference,
        isRecord(row.lot_obj) ? row.lot_obj.reference : undefined,
      ) || `Lot #${toNumberOrNull(row.lot) ?? toNumberOrNull(row.lot_id) ?? "?"}`,
    lot_type_lot: pickString(row.lot_type_lot, row.type_lot) || null,
    tantiemes,
    tantiemes_recalcules: toNumberOrNull(row.tantiemes_recalcules),
    is_zero_tantieme: toBoolean(row.is_zero_tantieme) || tantiemes <= 0,
    present_ou_represente: toBoolean(row.present_ou_represente),
    representant_nom: pickString(row.representant_nom, row.nom_representant),
    commentaire: pickString(row.commentaire, row.note, row.notes),
  };
}

function extractPresenceRows(data: unknown): PresenceItem[] {
  if (isPaginatedResponse<Record<string, unknown>>(data)) {
    return data.results.map(normalizePresenceItem).filter((item) => item.id > 0);
  }

  if (Array.isArray(data)) {
    return data.map(normalizePresenceItem).filter((item) => item.id > 0);
  }

  if (isRecord(data)) {
    const candidates = [data.results, data.items, data.presences, data.data];

    for (const candidate of candidates) {
      if (Array.isArray(candidate)) {
        return candidate.map(normalizePresenceItem).filter((item) => item.id > 0);
      }
    }
  }

  return [];
}

function buildAgInitPresencesUrl(agId: string | number): string {
  return `${AGS_ENDPOINT}${agId}/init-presences/`;
}

function buildAgPresencesListUrl(agId: string | number): string {
  return `${PRESENCES_ENDPOINT}?ag=${agId}`;
}

function buildPresenceDetailUrl(presenceId: string | number): string {
  return `${PRESENCES_ENDPOINT}${presenceId}/`;
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

function Card(props: { title: string; children: ReactNode; right?: ReactNode }) {
  return (
    <div
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 20,
        padding: 18,
        background: "#ffffff",
        boxShadow: "0 10px 30px rgba(15, 23, 42, 0.04)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 10,
          flexWrap: "wrap",
          alignItems: "center",
          marginBottom: 14,
        }}
      >
        <div style={{ fontSize: 15, fontWeight: 900, color: "#111827" }}>{props.title}</div>
        {props.right ? props.right : null}
      </div>
      {props.children}
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
      <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 10, fontWeight: 700 }}>{props.title}</div>
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
        <div style={{ marginTop: 8, fontSize: 12, color: "#6b7280", lineHeight: 1.45 }}>{props.sub}</div>
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

function AlertBox(props: { kind: FlashKind; children: ReactNode }) {
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
      <div style={{ fontSize: 14, fontWeight: 800, color: "#111827", marginBottom: 6 }}>{props.title}</div>
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

export default function AGPresences() {
  const navigate = useNavigate();
  const params = useParams();
  const agId = params.id ?? "";

  const [state, setState] = useState<LoadState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<{ kind: FlashKind; text: string } | null>(null);
  const [blockingReasons, setBlockingReasons] = useState<string[]>([]);
  const [rows, setRows] = useState<PresenceItem[]>([]);
  const [form, setForm] = useState<PresenceFormValues>(INITIAL_FORM);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  async function fetchPresences() {
    if (!agId) {
      setState("error");
      setError("Identifiant d’assemblée introuvable.");
      return;
    }

    setState("loading");
    setError(null);

    try {
      const res = await api.get<unknown>(buildAgPresencesListUrl(agId));

      const normalized = extractPresenceRows(res.data).sort((a, b) => a.lot_reference.localeCompare(b.lot_reference, "fr"));

      setRows(normalized);
      setState("success");
    } catch (e) {
      setRows([]);
      setState("error");
      setError(getErrorMessage(e, "Impossible de charger les présences."));
    }
  }

  useEffect(() => {
    void fetchPresences();
  }, [agId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;

    return rows.filter((item) => {
      const haystack = [
        item.lot_reference,
        item.lot_type_lot ?? "",
        item.representant_nom,
        item.commentaire,
        item.present_ou_represente ? "présent représenté oui" : "absent non",
        item.is_zero_tantieme ? "zero tantieme poids nul" : "",
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(q);
    });
  }, [rows, query]);

  const stats = useMemo(() => {
    const presents = rows.filter((x) => x.present_ou_represente);
    const zeroTantieme = rows.filter((x) => x.is_zero_tantieme);

    return {
      totalLots: rows.length,
      presents: presents.length,
      absents: rows.filter((x) => !x.present_ou_represente).length,
      tantiemesPresents: presents.reduce((sum, item) => sum + item.tantiemes, 0),
      zeroTantieme: zeroTantieme.length,
    };
  }, [rows]);

  function resetForm() {
    setForm(INITIAL_FORM);
    setEditingId(null);
  }

  function fillForm(item: PresenceItem) {
    setEditingId(item.id);
    setForm({
      lot: item.lot,
      present_ou_represente: item.present_ou_represente,
      representant_nom: item.representant_nom,
      commentaire: item.commentaire,
    });
  }

  function validateForm() {
    if (!agId) return "Identifiant d’assemblée introuvable.";
    if (!form.lot) return "Le lot est obligatoire.";
    if (form.present_ou_represente && !form.representant_nom.trim()) {
      return "Le nom du représentant ou du présent est obligatoire.";
    }
    return null;
  }

  async function handleInitPresences() {
    if (!agId) return;

    setBusyAction("init");
    setMessage(null);
    setBlockingReasons([]);

    try {
      const res = await api.post(buildAgInitPresencesUrl(agId), {});
      setMessage({ kind: "success", text: "Présences initialisées avec succès." });
      setBlockingReasons(extractBlockingReasons(res?.data));
      await fetchPresences();
    } catch (e) {
      const err = e as { response?: { data?: unknown } };
      setBlockingReasons(extractBlockingReasons(err?.response?.data));
      setMessage({
        kind: "error",
        text: getErrorMessage(e, "Impossible d’initialiser les présences."),
      });
    } finally {
      setBusyAction(null);
    }
  }

  async function handleSubmit() {
    const validationError = validateForm();
    if (validationError) {
      setMessage({ kind: "error", text: validationError });
      return;
    }

    if (!agId || !form.lot) return;

    setBusyAction(editingId ? "update" : "create");
    setMessage(null);
    setBlockingReasons([]);

    const payload = {
      ag: Number(agId),
      lot: form.lot,
      present_ou_represente: form.present_ou_represente,
      representant_nom: form.representant_nom.trim(),
      commentaire: form.commentaire.trim(),
    };

    try {
      if (editingId) {
        await api.patch(buildPresenceDetailUrl(editingId), payload);
        setMessage({ kind: "success", text: "Présence mise à jour avec succès." });
      } else {
        await api.post(PRESENCES_ENDPOINT, payload);
        setMessage({ kind: "success", text: "Présence enregistrée avec succès." });
      }

      resetForm();
      await fetchPresences();
    } catch (e) {
      const err = e as { response?: { data?: unknown } };
      setBlockingReasons(extractBlockingReasons(err?.response?.data));
      setMessage({
        kind: "error",
        text: getErrorMessage(e, "Impossible d’enregistrer la présence."),
      });
    } finally {
      setBusyAction(null);
    }
  }

  async function handleDelete(id: number) {
    const ok = window.confirm("Confirmer la suppression de cette présence ?");
    if (!ok) return;

    setBusyAction(`delete-${id}`);
    setMessage(null);
    setBlockingReasons([]);

    try {
      await api.delete(buildPresenceDetailUrl(id));
      setMessage({ kind: "success", text: "Présence supprimée avec succès." });

      if (editingId === id) {
        resetForm();
      }

      await fetchPresences();
    } catch (e) {
      const err = e as { response?: { data?: unknown } };
      setBlockingReasons(extractBlockingReasons(err?.response?.data));
      setMessage({
        kind: "error",
        text: getErrorMessage(e, "Impossible de supprimer la présence."),
      });
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <PageShell>
      <SectionTitle
        title="Présences AG"
        subtitle="Gérez les présences et représentations des lots pour cette assemblée générale, avec suivi des tantièmes effectivement retenus pour l’AG."
        right={
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <SmallButton onClick={() => navigate(`/ag/assemblees/${agId}`)}>Retour au détail AG</SmallButton>
            <SmallButton onClick={() => void handleInitPresences()} primary disabled={busyAction !== null || !agId}>
              {busyAction === "init" ? "Initialisation..." : "Initialiser les présences"}
            </SmallButton>
          </div>
        }
      />

      {state === "error" && error ? (
        <AlertBox kind="error">
          <div style={{ fontWeight: 900, marginBottom: 4 }}>Chargement impossible</div>
          <div style={{ fontSize: 13 }}>{error}</div>
        </AlertBox>
      ) : null}

      {message ? (
        <AlertBox kind={message.kind}>
          <div style={{ fontSize: 13 }}>{message.text}</div>
        </AlertBox>
      ) : null}

      {blockingReasons.length > 0 ? (
        <AlertBox kind="error">
          <div style={{ fontWeight: 900, marginBottom: 8 }}>Blocages métier détectés</div>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.6 }}>
            {blockingReasons.map((reason, index) => (
              <li key={`${reason}-${index}`}>{reason}</li>
            ))}
          </ul>
        </AlertBox>
      ) : null}

      <div className="ag-presences-stat-grid">
        <StatCard
          title="Lots suivis"
          value={stats.totalLots}
          sub="Nombre total de lots présents dans la liste."
          isLoading={state === "loading"}
        />
        <StatCard
          title="Présents / représentés"
          value={stats.presents}
          sub="Lots marqués comme présents ou représentés."
          isLoading={state === "loading"}
        />
        <StatCard
          title="Absents"
          value={stats.absents}
          sub="Lots non présents dans l’assemblée."
          isLoading={state === "loading"}
        />
        <StatCard
          title="Tantièmes présents"
          value={formatNumber(stats.tantiemesPresents)}
          sub="Somme des tantièmes AG présents ou représentés."
          isLoading={state === "loading"}
        />
      </div>

      <div className="ag-presences-stat-grid ag-presences-stat-grid-secondary">
        <StatCard
          title="Lots à 0 tantième"
          value={stats.zeroTantieme}
          sub="Ils restent visibles mais ne pèsent pas dans le calcul pondéré."
          isLoading={state === "loading"}
        />
      </div>

      <div className="ag-presences-main-grid">
        <Card
          title={editingId ? "Modifier une présence" : "Nouvelle présence"}
          right={editingId ? <Badge text="Mode édition" kind="info" /> : <Badge text="Saisie" kind="neutral" />}
        >
          <div style={{ display: "grid", gap: 14 }}>
            <div style={field}>
              <label style={label}>Lot</label>
              <input
                type="number"
                value={form.lot ?? ""}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    lot: toNumberOrNull(e.target.value),
                  }))
                }
                placeholder="Identifiant du lot"
                style={input}
              />
            </div>

            <div style={field}>
              <label style={label}>Statut de présence</label>
              <label style={checkboxRow}>
                <input
                  type="checkbox"
                  checked={form.present_ou_represente}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      present_ou_represente: e.target.checked,
                    }))
                  }
                />
                <span>Présent ou représenté</span>
              </label>
            </div>

            <div style={field}>
              <label style={label}>Nom du représentant / présent</label>
              <input
                value={form.representant_nom}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    representant_nom: e.target.value,
                  }))
                }
                placeholder="Nom de la personne présente ou représentante"
                style={input}
              />
            </div>

            <div style={field}>
              <label style={label}>Commentaire</label>
              <textarea
                value={form.commentaire}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    commentaire: e.target.value,
                  }))
                }
                placeholder="Commentaire libre"
                style={textarea}
              />
            </div>

            <div style={infoBox}>
              Le poids de présence en tantièmes est calculé par le backend. Il n’est pas saisi manuellement dans ce formulaire.
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <SmallButton
                onClick={() => void handleSubmit()}
                primary
                disabled={busyAction === "create" || busyAction === "update"}
              >
                {busyAction === "create"
                  ? "Enregistrement..."
                  : busyAction === "update"
                    ? "Mise à jour..."
                    : editingId
                      ? "Mettre à jour"
                      : "Enregistrer"}
              </SmallButton>

              <SmallButton onClick={resetForm} disabled={busyAction !== null}>
                Réinitialiser
              </SmallButton>
            </div>
          </div>
        </Card>

        <Card title="Liste des présences" right={<Badge text={`${filtered.length} ligne(s)`} kind="info" />}>
          <div style={{ display: "grid", gap: 12 }}>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher : lot, représentant, commentaire..."
              style={input}
            />

            {state === "loading" ? (
              <div style={{ color: "#6b7280", fontSize: 14 }}>Chargement des présences…</div>
            ) : filtered.length === 0 ? (
              <EmptyState
                title={rows.length === 0 ? "Aucune présence enregistrée" : "Aucune présence à afficher"}
                text={
                  rows.length === 0
                    ? "Aucune présence n’a encore été trouvée pour cette assemblée."
                    : "Aucune présence ne correspond à la recherche actuelle."
                }
                actionLabel="Initialiser les présences"
                onAction={() => void handleInitPresences()}
              />
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {filtered.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr auto",
                      gap: 12,
                      alignItems: "start",
                      padding: 14,
                      border: "1px solid #eef2f7",
                      borderRadius: 14,
                      background: "#fff",
                    }}
                  >
                    <div style={{ display: "grid", gap: 6 }}>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                        <div style={{ fontSize: 14, fontWeight: 900, color: "#111827" }}>{item.lot_reference}</div>

                        {item.lot_type_lot ? <Badge text={item.lot_type_lot} kind="neutral" /> : null}

                        <Badge
                          text={item.present_ou_represente ? "Présent / représenté" : "Absent"}
                          kind={item.present_ou_represente ? "success" : "warning"}
                        />

                        <Badge text={`${formatNumber(item.tantiemes)} tantièmes`} kind="info" />

                        {item.is_zero_tantieme ? <Badge text="0 tantième" kind="warning" /> : null}
                      </div>

                      <div style={{ fontSize: 13, color: "#374151" }}>
                        <strong>Représentant :</strong> {item.representant_nom || "—"}
                      </div>

                      <div style={{ fontSize: 13, color: "#374151" }}>
                        <strong>Tantièmes AG retenus :</strong> {formatNumber(item.tantiemes)}
                        {item.tantiemes_recalcules !== null && item.tantiemes_recalcules !== undefined ? (
                          <span style={{ color: "#6b7280" }}>
                            {" "}
                            — référence recalculée : {formatNumber(item.tantiemes_recalcules)}
                          </span>
                        ) : null}
                      </div>

                      <div style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.5 }}>
                        <strong>Commentaire :</strong> {item.commentaire || "—"}
                      </div>

                      {item.is_zero_tantieme ? (
                        <div style={warningBox}>
                          Ce lot a 0 tantième. Il reste visible dans l’AG mais ne sera pas pris en compte dans le calcul pondéré.
                        </div>
                      ) : null}
                    </div>

                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <SmallButton onClick={() => fillForm(item)} disabled={busyAction !== null}>
                        Modifier
                      </SmallButton>
                      <SmallButton danger onClick={() => void handleDelete(item.id)} disabled={busyAction !== null}>
                        {busyAction === `delete-${item.id}` ? "Suppression..." : "Supprimer"}
                      </SmallButton>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>

      <style>{`
        .ag-presences-stat-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 14px;
        }

        .ag-presences-stat-grid-secondary {
          grid-template-columns: repeat(1, minmax(0, 1fr));
        }

        .ag-presences-main-grid {
          display: grid;
          grid-template-columns: 0.95fr 1.05fr;
          gap: 14px;
        }

        @media (max-width: 1200px) {
          .ag-presences-stat-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .ag-presences-stat-grid-secondary {
            grid-template-columns: 1fr;
          }

          .ag-presences-main-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 760px) {
          .ag-presences-stat-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </PageShell>
  );
}

const field: CSSProperties = {
  display: "grid",
  gap: 8,
};

const label: CSSProperties = {
  fontSize: 13,
  fontWeight: 800,
  color: "#374151",
};

const input: CSSProperties = {
  width: "100%",
  padding: "12px 12px",
  borderRadius: 12,
  border: "1px solid #e5e7eb",
  background: "#fff",
  color: "#111827",
  fontSize: 14,
  boxSizing: "border-box",
};

const textarea: CSSProperties = {
  ...input,
  minHeight: 110,
  resize: "vertical",
};

const checkboxRow: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  fontSize: 14,
  color: "#111827",
};

const infoBox: CSSProperties = {
  padding: 14,
  borderRadius: 14,
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
  color: "#475569",
  fontSize: 13,
  lineHeight: 1.6,
};

const warningBox: CSSProperties = {
  padding: 12,
  borderRadius: 12,
  background: "#fffbeb",
  border: "1px solid #fde68a",
  color: "#92400e",
  fontSize: 12,
  lineHeight: 1.55,
};