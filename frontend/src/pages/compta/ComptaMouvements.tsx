// src/pages/compta/ComptaMouvements.tsx
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api/axios";
import { ENDPOINTS } from "../../api/endpoints";
import BackButton from "../../components/ui/BackButton";
import { useAuthStore } from "../../store/authStore";

type LoadState = "idle" | "loading" | "success" | "error";
type CancelKind = "ERROR" | "BUSINESS";
type ToneKind = "neutral" | "success" | "warning" | "danger" | "info";

type MouvementItem = {
  id: number;
  copropriete: number;
  compte: number;
  sens: "CREDIT" | "DEBIT" | string;
  montant: string | number;
  date_operation: string;
  reference?: string | null;
  libelle?: string | null;
  note?: string | null;
  is_rapproche?: boolean;
  created_at?: string;

  rapprochement_id?: number | null;
  releve_ligne_id?: number | null;
  releve_import_id?: number | null;

  is_cancelled?: boolean;
  cancel_kind?: CancelKind | string | null;
  cancelled_at?: string | null;
  cancelled_reason?: string | null;
  impacts_balance?: boolean | null;

  source_type?: string | null;
  source_label?: string | null;
  entree_argent_id?: number | null;
  entree_argent_type?: string | null;
  entree_argent_type_label?: string | null;
};

type Paginated<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

type ConfirmState =
  | {
      open: true;
      mouvement: MouvementItem;
      cancelKind: CancelKind;
      reason: string;
    }
  | {
      open: false;
      mouvement: null;
      cancelKind: CancelKind;
      reason: string;
    };

function getTone(kind: ToneKind) {
  if (kind === "success") {
    return {
      softBg: "#ecfdf5",
      border: "#86efac",
      text: "#166534",
      strongText: "#14532d",
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

  if (kind === "info") {
    return {
      softBg: "#eff6ff",
      border: "#93c5fd",
      text: "#1d4ed8",
      strongText: "#1e3a8a",
    };
  }

  return {
    softBg: "#f8fafc",
    border: "#e2e8f0",
    text: "#475569",
    strongText: "#0f172a",
  };
}

function isPaginated<T>(value: unknown): value is Paginated<T> {
  return Boolean(
    value &&
      typeof value === "object" &&
      Array.isArray((value as Paginated<T>).results) &&
      typeof (value as Paginated<T>).count === "number",
  );
}

function normalizeMontant(value: string | number | undefined | null): number | null {
  if (value === undefined || value === null || value === "") return null;

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  const parsed = Number(String(value).replace(/\s/g, "").replace(",", "."));

  return Number.isFinite(parsed) ? parsed : null;
}

function formatMoneyFCFA(amount: number | null): string {
  if (amount === null) return "—";

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

function formatDateShort(value?: string | null): string {
  if (!value) return "—";

  const date = new Date(value);

  if (!Number.isNaN(date.getTime())) {
    return date.toLocaleDateString("fr-FR");
  }

  const raw = String(value);
  return raw.length >= 10 ? raw.slice(0, 10) : raw;
}

function truncateText(value?: string | null, max = 52): string {
  if (!value) return "—";

  const normalized = String(value).trim();

  if (normalized.length <= max) return normalized;

  return `${normalized.slice(0, max - 1)}…`;
}

function getDetailError(error: unknown): string {
  const err = error as {
    response?: {
      data?: {
        detail?: string;
        non_field_errors?: string[];
        [key: string]: unknown;
      };
    };
    message?: string;
  };

  const data = err?.response?.data;

  if (data && typeof data === "object") {
    if (typeof data.detail === "string") return data.detail;

    if (Array.isArray(data.non_field_errors) && data.non_field_errors.length > 0) {
      return data.non_field_errors.join("\n");
    }

    try {
      const entries = Object.entries(data);

      if (entries.length > 0) {
        return entries
          .map(([key, value]) => {
            const rendered = Array.isArray(value)
              ? value.join(" / ")
              : typeof value === "string"
                ? value
                : JSON.stringify(value);

            return `${key}: ${rendered}`;
          })
          .join("\n");
      }
    } catch {
      return err?.message || "Une erreur est survenue lors du chargement.";
    }
  }

  return err?.message || "Une erreur est survenue lors du chargement.";
}

function getSensLabel(sens?: string) {
  const normalized = String(sens ?? "").toUpperCase();

  if (normalized === "CREDIT") return "Crédit";
  if (normalized === "DEBIT") return "Débit";

  return sens || "—";
}

function isMouvementRapproche(mouvement: MouvementItem) {
  return Boolean(
    mouvement.releve_ligne_id || mouvement.rapprochement_id || mouvement.is_rapproche,
  );
}

function isMouvementCancelled(mouvement: MouvementItem) {
  return Boolean(mouvement.is_cancelled);
}

function getCancelKindLabel(kind?: string | null) {
  const normalized = String(kind ?? "").toUpperCase();

  if (normalized === "ERROR") return "Annulation d’erreur";
  if (normalized === "BUSINESS") return "Annulation métier";

  return "Annulé";
}

function PageShell({ children }: { children: ReactNode }) {
  return <div style={pageShell}>{children}</div>;
}

function PageHeader(props: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  backTo?: string;
  backLabel?: string;
}) {
  return (
    <section style={heroCard}>
      <div style={heroGlow} />

      <div style={pageHeader}>
        <div style={pageHeaderTextBlock}>
          {props.backTo || props.backLabel ? (
            <div className="pageBackRow">
              <BackButton to={props.backTo} label={props.backLabel ?? "Retour"} />
            </div>
          ) : null}

          <div style={pageEyebrow}>Comptabilité · Mouvements bancaires</div>
          <div style={pageTitle}>{props.title}</div>
          {props.subtitle ? <div style={pageSubtitle}>{props.subtitle}</div> : null}
        </div>

        {props.actions ? <div style={pageHeaderActions}>{props.actions}</div> : null}
      </div>
    </section>
  );
}

function AlertBox(props: { kind: "error" | "info" | "success"; children: ReactNode }) {
  const tone =
    props.kind === "error"
      ? { bg: "#fef2f2", border: "#fecaca", text: "#991b1b" }
      : props.kind === "success"
        ? { bg: "#ecfdf5", border: "#a7f3d0", text: "#065f46" }
        : { bg: "#eff6ff", border: "#bfdbfe", text: "#1d4ed8" };

  return (
    <div
      style={{
        border: `1px solid ${tone.border}`,
        background: tone.bg,
        color: tone.text,
        padding: 14,
        borderRadius: 16,
        whiteSpace: "pre-wrap",
        lineHeight: 1.55,
      }}
    >
      {props.children}
    </div>
  );
}

function Badge(props: {
  text: string;
  kind: "credit" | "debit" | "neutral" | "warning" | "danger" | "success" | "info";
}) {
  const tone =
    props.kind === "credit"
      ? { background: "#ecfdf5", border: "#a7f3d0", color: "#065f46" }
      : props.kind === "debit"
        ? { background: "#fef2f2", border: "#fecaca", color: "#991b1b" }
        : props.kind === "warning"
          ? { background: "#fffbeb", border: "#fde68a", color: "#92400e" }
          : props.kind === "danger"
            ? { background: "#fef2f2", border: "#fecaca", color: "#991b1b" }
            : props.kind === "success"
              ? { background: "#ecfdf5", border: "#a7f3d0", color: "#065f46" }
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
        border: `1px solid ${tone.border}`,
        background: tone.background,
        color: tone.color,
        whiteSpace: "nowrap",
        fontWeight: 800,
      }}
    >
      {props.text}
    </span>
  );
}

function Card(props: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  right?: ReactNode;
  minHeight?: number;
}) {
  return (
    <div
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 22,
        padding: 18,
        background: "#ffffff",
        boxShadow: "0 10px 30px rgba(15, 23, 42, 0.04)",
        minHeight: props.minHeight,
        minWidth: 0,
      }}
    >
      <div style={cardHeader}>
        <div style={{ display: "grid", gap: 4, minWidth: 0 }}>
          <div style={cardTitle}>{props.title}</div>
          {props.subtitle ? <div style={cardSubtitle}>{props.subtitle}</div> : null}
        </div>

        {props.right ? <div>{props.right}</div> : null}
      </div>

      {props.children}
    </div>
  );
}

function SmallButton(props: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
  primary?: boolean;
  danger?: boolean;
  warning?: boolean;
}) {
  const tone = props.danger
    ? {
        border: "1px solid #fecaca",
        background: "#fef2f2",
        color: "#991b1b",
      }
    : props.primary
      ? {
          border: "1px solid #93c5fd",
          background: "#dbeafe",
          color: "#1e3a8a",
        }
      : props.warning
        ? {
            border: "1px solid #fde68a",
            background: "#fffbeb",
            color: "#92400e",
          }
        : {
            border: "1px solid #e5e7eb",
            background: "#ffffff",
            color: "#111827",
          };

  return (
    <button
      type="button"
      onClick={props.onClick}
      disabled={props.disabled}
      title={props.title}
      style={{
        ...tone,
        borderRadius: 12,
        padding: "9px 12px",
        fontSize: 12,
        fontWeight: 800,
        cursor: props.disabled ? "not-allowed" : "pointer",
        opacity: props.disabled ? 0.6 : 1,
        whiteSpace: "nowrap",
        transition: "all 0.2s ease",
      }}
    >
      {props.children}
    </button>
  );
}

function StatCard(props: { title: string; value: string; sub?: string; tone?: ToneKind }) {
  const tone = getTone(props.tone ?? "neutral");

  return (
    <div
      style={{
        ...statCard,
        background: tone.softBg,
        border: `1px solid ${tone.border}`,
      }}
    >
      <div style={{ ...statTitle, color: tone.text }}>{props.title}</div>
      <div style={{ ...statValue, color: tone.strongText }}>{props.value}</div>
      {props.sub ? <div style={{ ...statSub, color: tone.text }}>{props.sub}</div> : null}
    </div>
  );
}

function EmptyState(props: {
  title: string;
  text: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div style={emptyState}>
      <div style={emptyStateTitle}>{props.title}</div>
      <div style={emptyStateText}>{props.text}</div>

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

export default function ComptaMouvements() {
  const navigate = useNavigate();

  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const coproprieteId = useAuthStore((state) => state.coproprieteId);

  const [state, setState] = useState<LoadState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [ordering, setOrdering] = useState<string>("-date_operation");
  const [query, setQuery] = useState<string>("");

  const [count, setCount] = useState<number>(0);
  const [items, setItems] = useState<MouvementItem[]>([]);

  const [busyIds, setBusyIds] = useState<Record<number, boolean>>({});
  const [confirmState, setConfirmState] = useState<ConfirmState>({
    open: false,
    mouvement: null,
    cancelKind: "ERROR",
    reason: "",
  });

  const canFetch = useMemo(
    () => Boolean(isAuthenticated && coproprieteId),
    [isAuthenticated, coproprieteId],
  );

  const setBusy = useCallback((id: number, value: boolean) => {
    setBusyIds((prev) => ({
      ...prev,
      [id]: value,
    }));
  }, []);

  const fetchList = useCallback(async () => {
    if (!canFetch) return;

    setState("loading");
    setError(null);

    try {
      const response = await api.get(ENDPOINTS.mouvements, {
        params: {
          page,
          page_size: pageSize,
          ordering,
          include_cancelled: 1,
        },
      });

      const data = response?.data;

      if (isPaginated<MouvementItem>(data)) {
        setCount(data.count);
        setItems(data.results);
      } else if (Array.isArray(data)) {
        setCount(data.length);
        setItems(data);
      } else {
        setCount(0);
        setItems([]);
      }

      setState("success");
    } catch (err) {
      setState("error");
      setError(getDetailError(err));
      setItems([]);
      setCount(0);
    }
  }, [canFetch, ordering, page, pageSize]);

  useEffect(() => {
    setPage(1);
    setItems([]);
    setCount(0);
    setError(null);
    setSuccess(null);
    setState("idle");
  }, [coproprieteId]);

  useEffect(() => {
    if (!canFetch) return;

    const timer = window.setTimeout(() => {
      void fetchList();
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [canFetch, fetchList]);

  useEffect(() => {
    setPage(1);
  }, [query]);

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) return items;

    return items.filter((item) => {
      const haystack =
        `${item.libelle ?? ""} ${item.reference ?? ""} ${item.note ?? ""} ${item.sens ?? ""} ${item.cancel_kind ?? ""} ${item.source_label ?? ""} ${item.entree_argent_type_label ?? ""}`.toLowerCase();

      return haystack.includes(normalizedQuery);
    });
  }, [items, query]);

  const totalPages = useMemo(() => {
    if (!count || !pageSize) return 1;

    return Math.max(1, Math.ceil(count / pageSize));
  }, [count, pageSize]);

  const stats = useMemo(() => {
    const totalCredits = filtered
      .filter(
        (item) =>
          String(item.sens).toUpperCase() === "CREDIT" && !isMouvementCancelled(item),
      )
      .reduce((sum, item) => sum + (normalizeMontant(item.montant) ?? 0), 0);

    const totalDebits = filtered
      .filter(
        (item) => String(item.sens).toUpperCase() === "DEBIT" && !isMouvementCancelled(item),
      )
      .reduce((sum, item) => sum + (normalizeMontant(item.montant) ?? 0), 0);

    const rapproches = filtered.filter((item) => isMouvementRapproche(item)).length;
    const nonRapproches = Math.max(0, filtered.length - rapproches);
    const annules = filtered.filter((item) => isMouvementCancelled(item)).length;

    return {
      totalCredits,
      totalDebits,
      rapproches,
      nonRapproches,
      annules,
    };
  }, [filtered]);

  const canAnnulerMouvement = useCallback(
    (mouvement: MouvementItem) => !isMouvementCancelled(mouvement),
    [],
  );

  const openConfirmAnnuler = useCallback(
    (mouvement: MouvementItem) => {
      if (!canAnnulerMouvement(mouvement)) return;

      setConfirmState({
        open: true,
        mouvement,
        cancelKind: "ERROR",
        reason: "",
      });
    },
    [canAnnulerMouvement],
  );

  const closeConfirm = useCallback(() => {
    setConfirmState({
      open: false,
      mouvement: null,
      cancelKind: "ERROR",
      reason: "",
    });
  }, []);

  const submitAnnuler = useCallback(async () => {
    if (!confirmState.open || !confirmState.mouvement) return;

    const mouvement = confirmState.mouvement;

    setBusy(mouvement.id, true);
    setError(null);
    setSuccess(null);

    try {
      const payload = {
        cancel_kind: confirmState.cancelKind,
        reason: confirmState.reason.trim(),
      };

      const response = await api.post(ENDPOINTS.mouvementCancel(mouvement.id), payload);

      const detail =
        typeof response?.data?.detail === "string"
          ? response.data.detail
          : confirmState.cancelKind === "ERROR"
            ? "Le mouvement a bien été annulé comme erreur."
            : "Le mouvement a bien été classé en annulation métier.";

      closeConfirm();
      await fetchList();
      setSuccess(`Mouvement #${mouvement.id} : ${detail}`);
    } catch (err) {
      setError(`Annulation impossible : ${getDetailError(err)}`);
      closeConfirm();
    } finally {
      setBusy(mouvement.id, false);
    }
  }, [closeConfirm, confirmState, fetchList, setBusy]);

  const handleRefresh = useCallback(() => {
    setSuccess(null);
    void fetchList();
  }, [fetchList]);

  const goToDashboard = useCallback(() => {
    navigate("/");
  }, [navigate]);

  const goToImports = useCallback(() => {
    navigate("/compta/imports");
  }, [navigate]);

  const goToImport = useCallback(() => {
    navigate("/compta/import");
  }, [navigate]);

  const goToPreviousPage = useCallback(() => {
    setSuccess(null);
    setPage((prev) => Math.max(1, prev - 1));
  }, []);

  const goToNextPage = useCallback(() => {
    setSuccess(null);
    setPage((prev) => Math.min(totalPages, prev + 1));
  }, [totalPages]);

  if (!isAuthenticated) {
    return (
      <PageShell>
        <Card title="Mouvements bancaires">
          <div style={simpleMutedText}>Veuillez vous connecter pour accéder aux mouvements bancaires.</div>
        </Card>
      </PageShell>
    );
  }

  if (!coproprieteId) {
    return (
      <PageShell>
        <Card title="Mouvements bancaires">
          <div style={simpleMutedText}>
            Veuillez sélectionner une copropriété active pour afficher les mouvements bancaires
            associés.
          </div>
        </Card>
      </PageShell>
    );
  }

  const isLoading = state === "loading";
  const isEmpty = !isLoading && filtered.length === 0;

  return (
    <PageShell>
      <PageHeader
        title="Mouvements bancaires"
        subtitle={`Consultez les opérations de la copropriété active #${coproprieteId}, suivez leur statut de rapprochement et gérez les annulations si nécessaire.`}
        backTo="/compta"
        backLabel="Retour à la comptabilité"
        actions={
          <div style={topActionsRow}>
            <SmallButton onClick={goToDashboard} title="Retour au tableau de bord">
              Retour au tableau de bord
            </SmallButton>

            <SmallButton onClick={goToImports} title="Voir les imports bancaires">
              Voir les imports
            </SmallButton>

            <SmallButton onClick={goToImport} primary title="Importer un relevé bancaire">
              Importer un relevé
            </SmallButton>
          </div>
        }
      />

      <div className="mouvements-stats-grid" style={statsGrid}>
        <StatCard
          title="Mouvements visibles"
          value={String(filtered.length)}
          sub="Résultats affichés sur la page après recherche."
          tone="neutral"
        />
        <StatCard
          title="Crédits actifs"
          value={formatMoneyFCFA(stats.totalCredits)}
          sub="Somme des crédits non annulés sur la vue actuelle."
          tone="success"
        />
        <StatCard
          title="Débits actifs"
          value={formatMoneyFCFA(stats.totalDebits)}
          sub="Somme des débits non annulés sur la vue actuelle."
          tone="danger"
        />
        <StatCard
          title="Mouvements annulés"
          value={String(stats.annules)}
          sub={`${stats.rapproches} rapproché(s) · ${stats.nonRapproches} non rapproché(s).`}
          tone="warning"
        />
      </div>

      {success ? <AlertBox kind="success">{success}</AlertBox> : null}

      {state === "error" && error ? (
        <AlertBox kind="error">
          <div style={{ fontWeight: 900, marginBottom: 4 }}>
            Impossible de charger les mouvements bancaires
          </div>
          <div style={{ fontSize: 13 }}>{error}</div>
        </AlertBox>
      ) : null}

      <Card
        title="Liste des mouvements"
        subtitle="Recherchez, triez et parcourez les mouvements de la copropriété active."
        right={
          <div style={filtersRow}>
            <input
              placeholder="Rechercher : libellé, référence, note..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              style={searchInput}
            />

            <select
              value={ordering}
              onChange={(e) => setOrdering(e.target.value)}
              style={selectInput}
            >
              <option value="-date_operation">Date (récent → ancien)</option>
              <option value="date_operation">Date (ancien → récent)</option>
              <option value="-montant">Montant (élevé → faible)</option>
              <option value="montant">Montant (faible → élevé)</option>
            </select>

            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              style={selectInput}
            >
              <option value={10}>10 / page</option>
              <option value={20}>20 / page</option>
              <option value={50}>50 / page</option>
            </select>

            <SmallButton onClick={handleRefresh} disabled={isLoading} title="Actualiser la liste" primary>
              {isLoading ? "Actualisation..." : "Actualiser"}
            </SmallButton>
          </div>
        }
      >
        {isLoading ? (
          <div style={simpleMutedText}>Chargement des mouvements bancaires…</div>
        ) : isEmpty ? (
          <EmptyState
            title="Aucun mouvement à afficher"
            text="Aucun mouvement ne correspond aux critères actuels. Importez un relevé bancaire pour alimenter cette vue."
            actionLabel="Importer un relevé"
            onAction={goToImport}
          />
        ) : (
          <div style={{ display: "grid", gap: 10, minWidth: 0 }}>
            {filtered.map((mouvement) => {
              const sens = String(mouvement.sens || "").toUpperCase();

              const badgeKind: "credit" | "debit" | "neutral" =
                sens === "CREDIT" ? "credit" : sens === "DEBIT" ? "debit" : "neutral";

              const montant = normalizeMontant(mouvement.montant);
              const isBusy = Boolean(busyIds[mouvement.id]);
              const canCancel = canAnnulerMouvement(mouvement);
              const isRapproche = isMouvementRapproche(mouvement);
              const isCancelled = isMouvementCancelled(mouvement);

              return (
                <div
                  key={mouvement.id}
                  className="mouvement-row"
                  style={{
                    display: "grid",
                    gridTemplateColumns: "100px minmax(0, 1fr) 110px 150px 220px",
                    gap: 12,
                    alignItems: "center",
                    padding: 14,
                    border: `1px solid ${
                      isCancelled ? "#e5e7eb" : isRapproche ? "#93c5fd" : "#fcd34d"
                    }`,
                    borderRadius: 16,
                    background: isCancelled ? "#fafafa" : isRapproche ? "#eff6ff" : "#fffbeb",
                    opacity: isCancelled ? 0.84 : 1,
                    minWidth: 0,
                  }}
                >
                  <div style={dateCell}>{formatDateShort(mouvement.date_operation)}</div>

                  <div style={{ minWidth: 0 }}>
                    <div style={libelleCell} title={mouvement.libelle || "Mouvement bancaire"}>
                      {truncateText(mouvement.libelle || "Mouvement bancaire", 54)}
                    </div>

                    <div style={metaRow}>
                      {mouvement.reference ? (
                        <span style={referenceText}>{truncateText(mouvement.reference, 24)}</span>
                      ) : null}

                      {isRapproche ? (
                        <Badge
                          text={
                            mouvement.releve_ligne_id
                              ? `Rapproché · Ligne #${mouvement.releve_ligne_id}`
                              : "Rapproché"
                          }
                          kind="info"
                        />
                      ) : (
                        <Badge text="Non rapproché" kind="warning" />
                      )}

                      {mouvement.source_type === "ENTREE_ARGENT" ? (
                        <Badge
                          text={
                            mouvement.source_label ||
                            `Entrée d’argent${
                              mouvement.entree_argent_type_label
                                ? ` · ${mouvement.entree_argent_type_label}`
                                : ""
                            }`
                          }
                          kind="success"
                        />
                      ) : null}

                      {isCancelled ? (
                        <Badge
                          text={getCancelKindLabel(mouvement.cancel_kind)}
                          kind={mouvement.cancel_kind === "ERROR" ? "danger" : "success"}
                        />
                      ) : null}
                    </div>

                    {isCancelled && (mouvement.cancelled_reason || mouvement.cancelled_at) ? (
                      <div style={secondaryInfoText}>
                        {mouvement.cancelled_at ? (
                          <>Annulé le {formatDateShort(mouvement.cancelled_at)}. </>
                        ) : null}
                        {mouvement.cancelled_reason ? (
                          <>Motif : {truncateText(mouvement.cancelled_reason, 90)}</>
                        ) : null}
                      </div>
                    ) : mouvement.note ? (
                      <div style={noteText} title={mouvement.note}>
                        {truncateText(mouvement.note, 70)}
                      </div>
                    ) : null}
                  </div>

                  <div style={{ display: "flex", justifyContent: "flex-start" }}>
                    <Badge text={getSensLabel(mouvement.sens)} kind={badgeKind} />
                  </div>

                  <div
                    className="mouvement-amount"
                    style={{
                      ...amountCell,
                      color:
                        sens === "CREDIT"
                          ? "#166534"
                          : sens === "DEBIT"
                            ? "#991b1b"
                            : "#111827",
                    }}
                  >
                    {montant === null ? "—" : formatMoneyFCFA(montant)}
                  </div>

                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <SmallButton
                      danger={canCancel}
                      disabled={!canCancel || isBusy}
                      onClick={() => openConfirmAnnuler(mouvement)}
                      title={
                        canCancel
                          ? "Annuler ce mouvement avec choix du type d’annulation"
                          : "Ce mouvement est déjà annulé."
                      }
                    >
                      {isBusy ? "Traitement..." : canCancel ? "Annuler le mouvement" : "Déjà annulé"}
                    </SmallButton>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div style={paginationRow}>
          <div style={{ fontSize: 12, color: "#6b7280" }}>
            Total : <b>{count}</b> · Page <b>{page}</b> / <b>{totalPages}</b>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <SmallButton onClick={goToPreviousPage} disabled={isLoading || page <= 1}>
              Précédent
            </SmallButton>

            <SmallButton onClick={goToNextPage} disabled={isLoading || page >= totalPages}>
              Suivant
            </SmallButton>
          </div>
        </div>
      </Card>

      <Card
        title="Repères métier"
        subtitle="Points d’attention pour lire correctement les mouvements et choisir le bon type d’annulation."
      >
        <div className="mouvements-help-grid" style={helpGrid}>
          <div style={{ ...helpCard, background: "#eff6ff", border: "1px solid #93c5fd" }}>
            <div style={{ ...helpTitle, color: "#1e3a8a" }}>Rapproché</div>
            <div style={{ ...helpText, color: "#1d4ed8" }}>
              Le mouvement est déjà lié à une ligne importée ou à un rapprochement existant.
            </div>
          </div>

          <div style={{ ...helpCard, background: "#fffbeb", border: "1px solid #fcd34d" }}>
            <div style={{ ...helpTitle, color: "#78350f" }}>Non rapproché</div>
            <div style={{ ...helpText, color: "#92400e" }}>
              Le mouvement n’est pas encore relié à un flux issu d’un relevé ou d’un traitement
              comptable.
            </div>
          </div>

          <div style={{ ...helpCard, background: "#fef2f2", border: "1px solid #fca5a5" }}>
            <div style={{ ...helpTitle, color: "#7f1d1d" }}>Annulation d’erreur</div>
            <div style={{ ...helpText, color: "#991b1b" }}>
              À utiliser quand le mouvement a été enregistré à tort. Il ne doit plus compter dans le
              solde.
            </div>
          </div>

          <div style={{ ...helpCard, background: "#ecfdf5", border: "1px solid #86efac" }}>
            <div style={{ ...helpTitle, color: "#14532d" }}>Annulation métier</div>
            <div style={{ ...helpText, color: "#166534" }}>
              À utiliser quand l’opération bancaire a bien existé, mais que son traitement métier
              doit être neutralisé.
            </div>
          </div>
        </div>
      </Card>

      {confirmState.open && confirmState.mouvement ? (
        <div style={modalBackdrop} onClick={closeConfirm}>
          <div
            style={confirmModal}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-annulation-title"
          >
            <div id="confirm-annulation-title" style={modalTitle}>
              Annuler le mouvement
            </div>

            <div style={modalIntro}>
              Vous êtes sur le point d’annuler le mouvement <b>#{confirmState.mouvement.id}</b>.
            </div>

            <div style={modalInfoCard}>
              <div>
                <b>Date :</b> {formatDateShort(confirmState.mouvement.date_operation)}
              </div>
              <div>
                <b>Montant :</b>{" "}
                {formatMoneyFCFA(normalizeMontant(confirmState.mouvement.montant))}
              </div>
              <div>
                <b>Sens :</b> {getSensLabel(confirmState.mouvement.sens)}
              </div>
              <div>
                <b>Libellé :</b> {confirmState.mouvement.libelle || "Mouvement bancaire"}
              </div>
            </div>

            <div style={{ marginTop: 16 }}>
              <div style={modalSectionTitle}>Type d’annulation</div>

              <label
                style={{
                  ...cancelOptionCard,
                  background: confirmState.cancelKind === "ERROR" ? "#fef2f2" : "#ffffff",
                  border:
                    confirmState.cancelKind === "ERROR"
                      ? "1px solid #fca5a5"
                      : "1px solid #e5e7eb",
                }}
              >
                <div style={cancelOptionRow}>
                  <input
                    type="radio"
                    name="cancel_kind"
                    checked={confirmState.cancelKind === "ERROR"}
                    onChange={() =>
                      setConfirmState((prev) =>
                        prev.open ? { ...prev, cancelKind: "ERROR" } : prev,
                      )
                    }
                  />

                  <div>
                    <div style={cancelOptionTitle}>Annulation d’erreur</div>
                    <div style={cancelOptionText}>
                      À utiliser si le mouvement a été enregistré par erreur. Dans ce cas, il ne doit
                      plus compter dans le solde.
                    </div>
                  </div>
                </div>
              </label>

              <label
                style={{
                  ...cancelOptionCard,
                  marginTop: 10,
                  background: confirmState.cancelKind === "BUSINESS" ? "#ecfdf5" : "#ffffff",
                  border:
                    confirmState.cancelKind === "BUSINESS"
                      ? "1px solid #86efac"
                      : "1px solid #e5e7eb",
                }}
              >
                <div style={cancelOptionRow}>
                  <input
                    type="radio"
                    name="cancel_kind"
                    checked={confirmState.cancelKind === "BUSINESS"}
                    onChange={() =>
                      setConfirmState((prev) =>
                        prev.open ? { ...prev, cancelKind: "BUSINESS" } : prev,
                      )
                    }
                  />

                  <div>
                    <div style={cancelOptionTitle}>Annulation métier</div>
                    <div style={cancelOptionText}>
                      À utiliser si l’opération bancaire a bien eu lieu dans la réalité, mais que le
                      flux métier est annulé. L’impact bancaire reste conservé dans le solde.
                    </div>
                  </div>
                </div>
              </label>
            </div>

            <div style={{ marginTop: 16 }}>
              <div style={modalSectionTitle}>Motif</div>

              <textarea
                value={confirmState.reason}
                onChange={(e) =>
                  setConfirmState((prev) =>
                    prev.open ? { ...prev, reason: e.target.value } : prev,
                  )
                }
                rows={4}
                placeholder="Expliquez brièvement la raison de l’annulation..."
                style={textareaInput}
              />
            </div>

            <div
              style={{
                ...modalConsequenceBox,
                background: confirmState.cancelKind === "ERROR" ? "#fef2f2" : "#ecfdf5",
                border:
                  confirmState.cancelKind === "ERROR"
                    ? "1px solid #fca5a5"
                    : "1px solid #86efac",
                color: confirmState.cancelKind === "ERROR" ? "#991b1b" : "#166534",
              }}
            >
              {confirmState.cancelKind === "ERROR"
                ? "Conséquence : ce mouvement sera considéré comme une erreur et ne comptera plus dans le solde."
                : "Conséquence : ce mouvement sera classé en annulation métier, mais son impact bancaire restera conservé dans le solde."}
            </div>

            <div style={modalActions}>
              <SmallButton onClick={closeConfirm}>Fermer</SmallButton>
              <SmallButton danger onClick={() => void submitAnnuler()}>
                Confirmer l’annulation
              </SmallButton>
            </div>
          </div>
        </div>
      ) : null}

      <style>{`
        .mouvements-stats-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 14px;
        }

        .mouvements-help-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
        }

        @media (max-width: 1100px) {
          .mouvements-stats-grid,
          .mouvements-help-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }
        }

        @media (max-width: 920px) {
          .mouvement-row {
            grid-template-columns: 100px minmax(0, 1fr) !important;
          }

          .mouvement-amount {
            text-align: left !important;
          }
        }

        @media (max-width: 680px) {
          .mouvements-stats-grid,
          .mouvements-help-grid {
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
    "linear-gradient(135deg, rgba(15,23,42,0.98) 0%, rgba(30,41,59,0.96) 55%, rgba(37,99,235,0.88) 100%)",
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

const pageHeader: CSSProperties = {
  display: "flex",
  alignItems: "flex-end",
  justifyContent: "space-between",
  gap: 14,
  flexWrap: "wrap",
  minWidth: 0,
};

const pageHeaderTextBlock: CSSProperties = {
  display: "grid",
  gap: 8,
  position: "relative",
  zIndex: 1,
  minWidth: 0,
};

const pageEyebrow: CSSProperties = {
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: 0.9,
  textTransform: "uppercase",
  color: "rgba(255,255,255,0.72)",
};

const pageTitle: CSSProperties = {
  fontSize: 30,
  fontWeight: 900,
  letterSpacing: -0.5,
  color: "#ffffff",
  lineHeight: 1.1,
};

const pageSubtitle: CSSProperties = {
  fontSize: 14,
  color: "rgba(255,255,255,0.82)",
  lineHeight: 1.55,
  maxWidth: 900,
};

const pageHeaderActions: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
  alignItems: "center",
  position: "relative",
  zIndex: 1,
};

const topActionsRow: CSSProperties = {
  display: "flex",
  gap: 8,
  alignItems: "center",
  flexWrap: "wrap",
};

const cardHeader: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
  marginBottom: 14,
  minWidth: 0,
};

const cardTitle: CSSProperties = {
  fontSize: 15,
  fontWeight: 900,
  color: "#111827",
};

const cardSubtitle: CSSProperties = {
  fontSize: 13,
  color: "#6b7280",
  lineHeight: 1.5,
};

const statCard: CSSProperties = {
  borderRadius: 20,
  padding: 16,
  boxShadow: "0 10px 30px rgba(15, 23, 42, 0.04)",
  minWidth: 0,
};

const statTitle: CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  marginBottom: 8,
};

const statValue: CSSProperties = {
  fontSize: 28,
  fontWeight: 900,
  letterSpacing: -0.4,
  lineHeight: 1.1,
};

const statSub: CSSProperties = {
  marginTop: 8,
  fontSize: 12,
  lineHeight: 1.45,
};

const statsGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
  gap: 14,
};

const filtersRow: CSSProperties = {
  display: "flex",
  gap: 10,
  alignItems: "center",
  flexWrap: "wrap",
};

const searchInput: CSSProperties = {
  width: 260,
  maxWidth: "100%",
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  padding: "10px 12px",
  fontSize: 13,
  outline: "none",
  color: "#111827",
  boxSizing: "border-box",
  background: "#ffffff",
};

const selectInput: CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  padding: "10px 12px",
  fontSize: 12,
  fontWeight: 800,
  background: "#ffffff",
  color: "#111827",
};

const emptyState: CSSProperties = {
  border: "1px dashed #d1d5db",
  borderRadius: 16,
  padding: 18,
  background: "#f9fafb",
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

const simpleMutedText: CSSProperties = {
  color: "#6b7280",
  lineHeight: 1.55,
};

const dateCell: CSSProperties = {
  fontSize: 12,
  color: "#6b7280",
  fontWeight: 700,
};

const libelleCell: CSSProperties = {
  fontSize: 14,
  fontWeight: 900,
  color: "#111827",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const metaRow: CSSProperties = {
  display: "flex",
  gap: 8,
  alignItems: "center",
  marginTop: 6,
  flexWrap: "wrap",
};

const referenceText: CSSProperties = {
  fontSize: 12,
  color: "#6b7280",
};

const secondaryInfoText: CSSProperties = {
  fontSize: 12,
  color: "#6b7280",
  marginTop: 7,
  lineHeight: 1.5,
};

const noteText: CSSProperties = {
  fontSize: 12,
  color: "#6b7280",
  marginTop: 7,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const amountCell: CSSProperties = {
  fontSize: 14,
  fontWeight: 900,
  textAlign: "right",
  whiteSpace: "nowrap",
};

const paginationRow: CSSProperties = {
  marginTop: 14,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
  flexWrap: "wrap",
};

const helpGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
  gap: 12,
};

const helpCard: CSSProperties = {
  borderRadius: 16,
  padding: 16,
  display: "grid",
  gap: 8,
  minWidth: 0,
};

const helpTitle: CSSProperties = {
  fontSize: 14,
  fontWeight: 900,
};

const helpText: CSSProperties = {
  fontSize: 13,
  lineHeight: 1.55,
};

const modalBackdrop: CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(15, 23, 42, 0.45)",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  padding: 16,
  zIndex: 1000,
};

const confirmModal: CSSProperties = {
  width: "min(560px, 96vw)",
  background: "#ffffff",
  borderRadius: 20,
  padding: 18,
  border: "1px solid #e5e7eb",
  boxShadow: "0 24px 60px rgba(15, 23, 42, 0.18)",
};

const modalTitle: CSSProperties = {
  fontWeight: 900,
  fontSize: 20,
  color: "#111827",
};

const modalIntro: CSSProperties = {
  color: "#4b5563",
  lineHeight: 1.6,
  marginTop: 12,
  fontSize: 14,
};

const modalInfoCard: CSSProperties = {
  marginTop: 14,
  padding: 12,
  borderRadius: 14,
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
  fontSize: 13,
  color: "#374151",
  lineHeight: 1.55,
};

const modalSectionTitle: CSSProperties = {
  fontSize: 13,
  fontWeight: 900,
  color: "#111827",
  marginBottom: 10,
};

const cancelOptionCard: CSSProperties = {
  display: "block",
  borderRadius: 14,
  padding: 12,
  cursor: "pointer",
};

const cancelOptionRow: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: 10,
};

const cancelOptionTitle: CSSProperties = {
  fontWeight: 800,
  color: "#111827",
};

const cancelOptionText: CSSProperties = {
  fontSize: 13,
  color: "#6b7280",
  marginTop: 4,
  lineHeight: 1.5,
};

const textareaInput: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  border: "1px solid #e5e7eb",
  borderRadius: 14,
  padding: 12,
  fontSize: 13,
  resize: "vertical",
  outline: "none",
  color: "#111827",
  background: "#ffffff",
};

const modalConsequenceBox: CSSProperties = {
  marginTop: 14,
  fontSize: 13,
  lineHeight: 1.5,
  borderRadius: 14,
  padding: 12,
};

const modalActions: CSSProperties = {
  marginTop: 18,
  display: "flex",
  justifyContent: "flex-end",
  gap: 10,
  flexWrap: "wrap",
};