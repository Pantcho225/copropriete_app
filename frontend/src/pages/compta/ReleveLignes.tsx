import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type FormEvent,
  type ReactNode,
} from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import BackButton from "../../components/ui/BackButton";
import api from "../../api/axios";
import { ENDPOINTS } from "../../api/endpoints";

type LoadState = "idle" | "loading" | "success" | "error";
type FlashKind = "success" | "error" | "info";
type ToneKind = "neutral" | "success" | "warning" | "info" | "danger";

type RapprochementTargetType = "PAIEMENT_APPEL" | "PAIEMENT_TRAVAUX" | "MOUVEMENT";

type SuggestionItem = {
  type_cible: RapprochementTargetType;
  cible_id: number;
  label: string;
  montant?: number | string;
  score?: number;
  motif?: string;
  date?: string;
};

type ReleveLigneItem = {
  id: number;
  date_operation?: string;
  date_valeur?: string;
  libelle?: string;
  reference?: string;
  montant?: number | string;
  debit?: number | string | null;
  credit?: number | string | null;
  sens?: string;
  rapproche?: boolean;
  is_ignored?: boolean;
  ignored?: boolean;
  statut?: string;
  note?: string | null;
  rapprochement?: {
    id?: number;
    type_cible?: string;
    cible_id?: number;
    note?: string | null;
  } | null;
};

type ImportDetail = {
  id: number;
  nom_fichier?: string;
  fichier_nom?: string;
  fichier?: string;
  created_at?: string;
  total_lignes?: number;
  lignes_importees?: number;
  lignes_ignorees?: number;
  lignes_rapprochees?: number;
};

type ConfirmAction =
  | {
      open: false;
      type: null;
      line: null;
      loading: false;
    }
  | {
      open: true;
      type: "ignore" | "cancel_rapprochement";
      line: ReleveLigneItem;
      loading: boolean;
    };

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

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

  if (kind === "info") {
    return {
      softBg: "#eff6ff",
      border: "#93c5fd",
      text: "#1d4ed8",
      strongText: "#1e3a8a",
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

function parseNumber(value?: number | string | null) {
  if (typeof value === "number") return value;

  if (typeof value === "string") {
    const normalized = value.replace(/\s/g, "").replace(",", ".");
    const n = Number(normalized);

    return Number.isFinite(n) ? n : 0;
  }

  return 0;
}

function formatMoney(value?: number | string | null) {
  const amount = parseNumber(value);

  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "XOF",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(value?: string | null) {
  if (!value) return "—";

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) return value;

  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(parsed);
}

function normalizeLignesPayload(payload: unknown): ReleveLigneItem[] {
  if (Array.isArray(payload)) return payload as ReleveLigneItem[];

  if (isRecord(payload)) {
    if (Array.isArray(payload.results)) return payload.results as ReleveLigneItem[];
    if (Array.isArray(payload.data)) return payload.data as ReleveLigneItem[];
    if (Array.isArray(payload.items)) return payload.items as ReleveLigneItem[];
    if (Array.isArray(payload.lignes)) return payload.lignes as ReleveLigneItem[];
  }

  return [];
}

function normalizeSuggestionsPayload(payload: unknown): SuggestionItem[] {
  if (Array.isArray(payload)) return payload as SuggestionItem[];

  if (isRecord(payload)) {
    if (Array.isArray(payload.results)) return payload.results as SuggestionItem[];
    if (Array.isArray(payload.suggestions)) return payload.suggestions as SuggestionItem[];
    if (Array.isArray(payload.data)) return payload.data as SuggestionItem[];
    if (Array.isArray(payload.items)) return payload.items as SuggestionItem[];
  }

  return [];
}

function getLineAmount(line: ReleveLigneItem) {
  if (parseNumber(line.credit) > 0) return parseNumber(line.credit);
  if (parseNumber(line.debit) > 0) return parseNumber(line.debit);

  return parseNumber(line.montant);
}

function PageShell({ children }: { children: ReactNode }) {
  return <div style={pageShell}>{children}</div>;
}

function PageHeader({
  title,
  subtitle,
  actions,
  backTo,
  backLabel,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  backTo?: string;
  backLabel?: string;
}) {
  return (
    <section style={heroCard}>
      <div style={heroGlow} />

      <div style={heroHeader}>
        <div style={heroHeaderTextBlock}>
          {backTo || backLabel ? (
            <div className="pageBackRow">
              <BackButton to={backTo} label={backLabel ?? "Retour"} />
            </div>
          ) : null}

          <div style={pageEyebrow}>Comptabilité · Relevés bancaires</div>
          <div style={pageTitle}>{title}</div>
          {subtitle ? <div style={pageSubtitle}>{subtitle}</div> : null}
        </div>

        {actions ? <div style={headerActions}>{actions}</div> : null}
      </div>
    </section>
  );
}

function Card({
  title,
  subtitle,
  children,
  right,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  right?: ReactNode;
}) {
  return (
    <section style={cardStyle}>
      <div style={cardHeader}>
        <div style={{ display: "grid", gap: 4, minWidth: 0 }}>
          <div style={cardTitle}>{title}</div>
          {subtitle ? <div style={cardSubtitle}>{subtitle}</div> : null}
        </div>

        {right ? <div>{right}</div> : null}
      </div>

      {children}
    </section>
  );
}

function StatCard({
  title,
  value,
  tone = "neutral",
}: {
  title: string;
  value: string | number;
  tone?: ToneKind;
}) {
  const palette = getTone(tone);

  return (
    <div
      style={{
        ...statCard,
        background: palette.softBg,
        border: `1px solid ${palette.border}`,
      }}
    >
      <div style={{ ...statLabel, color: palette.text }}>{title}</div>
      <div style={{ ...statValue, color: palette.strongText }}>{value}</div>
    </div>
  );
}

function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div style={emptyState}>
      <div style={emptyStateTitle}>{title}</div>
      {description ? <div style={emptyStateText}>{description}</div> : null}
      {action ? <div style={{ marginTop: 18 }}>{action}</div> : null}
    </div>
  );
}

function FlashMessage({
  kind,
  message,
  onClose,
}: {
  kind: FlashKind;
  message: string;
  onClose: () => void;
}) {
  const tone =
    kind === "success"
      ? { bg: "#dcfce7", color: "#166534", border: "#bbf7d0" }
      : kind === "error"
        ? { bg: "#fee2e2", color: "#991b1b", border: "#fecaca" }
        : { bg: "#e0f2fe", color: "#075985", border: "#bae6fd" };

  return (
    <div
      style={{
        background: tone.bg,
        color: tone.color,
        border: `1px solid ${tone.border}`,
        borderRadius: 16,
        padding: "14px 16px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        minWidth: 0,
      }}
    >
      <strong>{message}</strong>

      <button
        type="button"
        onClick={onClose}
        style={{
          ...softButton,
          padding: "8px 10px",
          background: "rgba(255,255,255,0.72)",
        }}
      >
        Fermer
      </button>
    </div>
  );
}

function GuidanceBox({
  tone,
  title,
  children,
}: {
  tone: ToneKind;
  title: string;
  children: ReactNode;
}) {
  const palette = getTone(tone);

  return (
    <div
      style={{
        border: `1px solid ${palette.border}`,
        background: palette.softBg,
        borderRadius: 18,
        padding: "14px 16px",
        color: palette.text,
        display: "grid",
        gap: 4,
      }}
    >
      <strong style={{ color: palette.strongText }}>{title}</strong>
      <span style={{ fontSize: 14, lineHeight: 1.5 }}>{children}</span>
    </div>
  );
}

function getLineStatusBadge(line: ReleveLigneItem): { label: string; style: CSSProperties } {
  if (line.is_ignored || line.ignored) {
    return {
      label: "Ignorée métier",
      style: {
        ...badgeBase,
        background: "#f3f4f6",
        color: "#374151",
        border: "1px solid #d1d5db",
      },
    };
  }

  if (line.rapproche || line.rapprochement) {
    return {
      label: "Rapprochée",
      style: {
        ...badgeBase,
        background: "#dcfce7",
        color: "#166534",
        border: "1px solid #86efac",
      },
    };
  }

  return {
    label: "À traiter",
    style: {
      ...badgeBase,
      background: "#fef3c7",
      color: "#92400e",
      border: "1px solid #fcd34d",
    },
  };
}

function ConfirmModal({
  open,
  title,
  description,
  details,
  confirmLabel,
  confirmTone = "danger",
  loading,
  onClose,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description: string;
  details?: ReactNode;
  confirmLabel: string;
  confirmTone?: "danger" | "primary";
  loading?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  if (!open) return null;

  return (
    <div style={modalOverlay} onClick={onClose}>
      <div
        style={confirmModalCard}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
      >
        <div style={{ display: "grid", gap: 8 }}>
          <div id="confirm-modal-title" style={confirmModalTitle}>
            {title}
          </div>
          <div style={confirmModalText}>{description}</div>
        </div>

        {details ? <div style={confirmInfoCard}>{details}</div> : null}

        <div style={confirmActions}>
          <button type="button" style={softButton} onClick={onClose} disabled={loading}>
            Fermer
          </button>

          <button
            type="button"
            style={confirmTone === "danger" ? dangerButton : primaryButton}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? "Traitement en cours..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function InfoPill({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: ToneKind;
}) {
  const palette = getTone(tone);

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "6px 10px",
        borderRadius: 999,
        border: `1px solid ${palette.border}`,
        background: palette.softBg,
        color: palette.text,
        fontSize: 12,
        fontWeight: 800,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}

export default function ReleveLignes() {
  const navigate = useNavigate();
  const params = useParams<{ importId: string }>();
  const importId = params.importId;

  const [state, setState] = useState<LoadState>("idle");
  const [importDetail, setImportDetail] = useState<ImportDetail | null>(null);
  const [lignes, setLignes] = useState<ReleveLigneItem[]>([]);
  const [flash, setFlash] = useState<{ kind: FlashKind; message: string } | null>(null);

  const [selectedLine, setSelectedLine] = useState<ReleveLigneItem | null>(null);
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [suggestionsModalOpen, setSuggestionsModalOpen] = useState(false);

  const [rapprocherModalOpen, setRapprocherModalOpen] = useState(false);
  const [targetType, setTargetType] =
    useState<RapprochementTargetType>("PAIEMENT_APPEL");
  const [targetId, setTargetId] = useState("");
  const [rapprocheNote, setRapprocheNote] = useState("");
  const [forceRapprochement, setForceRapprochement] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);

  const [confirmAction, setConfirmAction] = useState<ConfirmAction>({
    open: false,
    type: null,
    line: null,
    loading: false,
  });

  const resetRapprocherForm = useCallback(() => {
    setTargetType("PAIEMENT_APPEL");
    setTargetId("");
    setRapprocheNote("");
    setForceRapprochement(false);
  }, []);

  const closeSuggestionsModal = useCallback(() => {
    setSuggestionsModalOpen(false);
    setSuggestions([]);
  }, []);

  const closeRapprocherModal = useCallback(() => {
    setRapprocherModalOpen(false);
    resetRapprocherForm();
  }, [resetRapprocherForm]);

  const closeConfirmModal = useCallback(() => {
    setConfirmAction({
      open: false,
      type: null,
      line: null,
      loading: false,
    });
  }, []);

  const showFlash = useCallback((kind: FlashKind, message: string) => {
    setFlash({ kind, message });
  }, []);

  const fetchData = useCallback(async () => {
    if (!importId) {
      setState("error");
      return;
    }

    setState("loading");

    try {
      const [detailRes, lignesRes] = await Promise.all([
        api.get(ENDPOINTS.releveImportDetail(importId)),
        api.get(ENDPOINTS.releveImportLignes(importId)),
      ]);

      setImportDetail(detailRes.data ?? null);
      setLignes(normalizeLignesPayload(lignesRes.data));
      setState("success");
    } catch {
      setState("error");
    }
  }, [importId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchData();
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [fetchData]);

  const stats = useMemo(() => {
    const total = lignes.length;
    const rapprochees = lignes.filter((line) => line.rapproche || line.rapprochement).length;
    const ignorees = lignes.filter((line) => line.is_ignored || line.ignored).length;
    const aTraiter = Math.max(total - rapprochees - ignorees, 0);
    const tauxRapprochement = total ? Math.round((rapprochees / total) * 100) : 0;

    let priorite = "Import vide ou aucune ligne bancaire à analyser.";
    let prioriteTone: ToneKind = "neutral";

    if (aTraiter > 0) {
      priorite = `${aTraiter} ligne(s) restent à traiter : ouvrez les suggestions, rapprochez la ligne, créez un mouvement ou ignorez-la si elle n’a pas d’impact métier.`;
      prioriteTone = "warning";
    } else if (total > 0) {
      priorite = "Toutes les lignes sont traitées : l’import bancaire est prêt pour le suivi comptable.";
      prioriteTone = "success";
    }

    return {
      total,
      rapprochees,
      ignorees,
      aTraiter,
      tauxRapprochement,
      priorite,
      prioriteTone,
    };
  }, [lignes]);

  const openSuggestions = useCallback(
    async (line: ReleveLigneItem) => {
      setSelectedLine(line);
      setSuggestionsModalOpen(true);
      setSuggestions([]);
      setSuggestionsLoading(true);

      try {
        const res = await api.get(ENDPOINTS.releveLigneSuggestions(line.id));
        const items = normalizeSuggestionsPayload(res.data);

        setSuggestions(items);

        if (!items.length) {
          showFlash("info", "Aucune suggestion de rapprochement disponible pour cette ligne.");
        }
      } catch {
        showFlash("error", "Impossible de récupérer les suggestions.");
      } finally {
        setSuggestionsLoading(false);
      }
    },
    [showFlash],
  );

  const openRapprocherModal = useCallback(
    (line: ReleveLigneItem, suggestion?: SuggestionItem) => {
      setSelectedLine(line);
      setRapprocherModalOpen(true);

      if (suggestion) {
        setTargetType(suggestion.type_cible);
        setTargetId(String(suggestion.cible_id));
        setRapprocheNote(suggestion.motif || "");
        setForceRapprochement(false);
      } else {
        resetRapprocherForm();
      }
    },
    [resetRapprocherForm],
  );

  const openIgnoreConfirm = useCallback((line: ReleveLigneItem) => {
    setConfirmAction({
      open: true,
      type: "ignore",
      line,
      loading: false,
    });
  }, []);

  const openCancelRapprochementConfirm = useCallback((line: ReleveLigneItem) => {
    setConfirmAction({
      open: true,
      type: "cancel_rapprochement",
      line,
      loading: false,
    });
  }, []);

  const submitRapprochement = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();

      if (!selectedLine) return;

      const cibleId = Number(targetId);

      if (!targetType || !Number.isFinite(cibleId) || cibleId <= 0) {
        showFlash("error", "Impossible d’effectuer le rapprochement.");
        return;
      }

      setSubmitLoading(true);

      try {
        await api.post(ENDPOINTS.releveLigneRapprocher(selectedLine.id), {
          type_cible: targetType,
          cible_id: cibleId,
          note: rapprocheNote || "",
          allow_retarget: forceRapprochement,
          retarget_reason: forceRapprochement
            ? rapprocheNote || "Rapprochement forcé depuis l’interface."
            : "",
        });

        closeRapprocherModal();
        closeSuggestionsModal();
        showFlash("success", "Rapprochement effectué avec succès.");
        await fetchData();
      } catch {
        showFlash("error", "Impossible d’effectuer le rapprochement.");
      } finally {
        setSubmitLoading(false);
      }
    },
    [
      closeRapprocherModal,
      closeSuggestionsModal,
      fetchData,
      forceRapprochement,
      rapprocheNote,
      selectedLine,
      showFlash,
      targetId,
      targetType,
    ],
  );

  const confirmCurrentAction = useCallback(async () => {
    if (!confirmAction.open || !confirmAction.line || !confirmAction.type) return;

    setConfirmAction((prev) => (prev.open ? { ...prev, loading: true } : prev));

    try {
      if (confirmAction.type === "ignore") {
        await api.post(ENDPOINTS.releveLigneIgnorer(confirmAction.line.id));
        showFlash("success", "Ligne ignorée avec succès.");
      } else if (confirmAction.type === "cancel_rapprochement") {
        await api.post(ENDPOINTS.releveLigneAnnulerRapprochement(confirmAction.line.id));
        showFlash("success", "Rapprochement annulé avec succès.");
      }

      closeConfirmModal();
      await fetchData();
    } catch {
      if (confirmAction.type === "ignore") {
        showFlash("error", "Impossible d’ignorer cette ligne.");
      } else {
        showFlash("error", "Impossible d’annuler le rapprochement.");
      }

      closeConfirmModal();
    }
  }, [closeConfirmModal, confirmAction, fetchData, showFlash]);

  const handleCreateMouvement = useCallback(
    async (line: ReleveLigneItem) => {
      try {
        await api.post(ENDPOINTS.releveLigneCreerMouvement(line.id));
        showFlash("success", "Mouvement comptable créé avec succès.");
        await fetchData();
      } catch {
        showFlash("error", "Impossible de créer le mouvement comptable.");
      }
    },
    [fetchData, showFlash],
  );

  const handleRefresh = useCallback(() => {
    void fetchData();
  }, [fetchData]);

  const goToMouvements = useCallback(() => {
    navigate("/compta/mouvements");
  }, [navigate]);

  const confirmTitle =
    confirmAction.type === "ignore" ? "Ignorer cette ligne" : "Annuler le rapprochement";

  const confirmDescription =
    confirmAction.type === "ignore"
      ? "Cette ligne sera marquée comme ignorée métier. Elle restera visible dans l’import, mais ne sera plus traitée comme une ligne active à rapprocher."
      : "Le rapprochement existant sera supprimé. La ligne reviendra dans l’état « À traiter ».";

  const confirmButtonLabel =
    confirmAction.type === "ignore" ? "Confirmer l’ignorance" : "Confirmer l’annulation";

  if (state === "idle" || state === "loading") {
    return (
      <PageShell>
        <EmptyState
          title="Chargement des lignes importées..."
          description="Les lignes bancaires liées à cet import sont en cours de récupération."
        />
      </PageShell>
    );
  }

  if (state === "error") {
    return (
      <PageShell>
        <EmptyState
          title="Impossible de charger les lignes importées"
          description="Une erreur est survenue lors du chargement de cet import bancaire."
          action={
            <button type="button" style={primaryButton} onClick={handleRefresh}>
              Réessayer
            </button>
          }
        />
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageHeader
        title="Lignes importées"
        subtitle="Analysez, rapprochez ou traitez les lignes issues de cet import bancaire."
        backTo="/compta/imports"
        backLabel="Retour aux imports"
        actions={
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" style={softButton} onClick={() => navigate("/compta/imports")}>
              Retour
            </button>

            <button type="button" style={primaryButton} onClick={handleRefresh}>
              Actualiser
            </button>
          </div>
        }
      />

      {flash ? (
        <FlashMessage
          kind={flash.kind}
          message={flash.message}
          onClose={() => setFlash(null)}
        />
      ) : null}

      <div className="releve-lignes-stats-grid" style={statsGrid}>
        <StatCard
          title="Import"
          value={
            importDetail?.nom_fichier ||
            importDetail?.fichier_nom ||
            importDetail?.fichier ||
            `Import #${importId}`
          }
          tone="neutral"
        />
        <StatCard title="Total des lignes" value={stats.total} tone="neutral" />
        <StatCard
          title="Lignes rapprochées"
          value={`${stats.rapprochees} · ${stats.tauxRapprochement}%`}
          tone="success"
        />
        <StatCard title="Ignorées métier" value={stats.ignorees} tone="neutral" />
        <StatCard
          title="À traiter"
          value={stats.aTraiter}
          tone={stats.aTraiter > 0 ? "warning" : "success"}
        />
      </div>

      <GuidanceBox tone={stats.prioriteTone} title="Prochaine action conseillée">
        {stats.priorite}
      </GuidanceBox>

      <Card
        title="Lignes bancaires"
        subtitle="Gérez le rapprochement, l’ignorance métier et la création de mouvements comptables."
        right={
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <InfoPill label={`Créé le ${formatDate(importDetail?.created_at)}`} tone="neutral" />
            <InfoPill label={`${stats.total} ligne(s)`} tone="info" />
          </div>
        }
      >
        {!lignes.length ? (
          <EmptyState
            title="Aucune ligne importée trouvée pour cet import"
            description="Les lignes bancaires s’afficheront ici dès qu’un import exploitable sera disponible."
          />
        ) : (
          <div style={tableWrap}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  {[
                    "Date opération",
                    "Libellé",
                    "Référence",
                    "Montant",
                    "Statut",
                    "Rapprochement",
                    "Actions",
                  ].map((label) => (
                    <th key={label} style={thStyle}>
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {lignes.map((line) => {
                  const status = getLineStatusBadge(line);
                  const montant = getLineAmount(line);
                  const isCredit = parseNumber(line.credit) > 0;
                  const isDebit = !isCredit && montant > 0;

                  return (
                    <tr
                      key={line.id}
                      style={{ transition: "background 0.15s ease" }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = "#f8fafc";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "#ffffff";
                      }}
                    >
                      <td style={tdDate}>{formatDate(line.date_operation || line.date_valeur)}</td>

                      <td style={tdLibelle}>
                        <div style={{ fontWeight: 700, color: "#111827" }}>
                          {line.libelle || "Libellé non renseigné"}
                        </div>

                        {line.note ? (
                          <div style={{ ...subtleText, marginTop: 4 }}>{line.note}</div>
                        ) : null}
                      </td>

                      <td style={tdDefault}>{line.reference || "—"}</td>

                      <td
                        style={{
                          ...tdDefault,
                          fontWeight: 800,
                          color: isCredit ? "#166534" : isDebit ? "#991b1b" : "#0f172a",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {formatMoney(montant)}
                      </td>

                      <td style={tdDefault}>
                        <span style={status.style}>{status.label}</span>
                      </td>

                      <td style={tdDefault}>
                        {line.rapprochement ? (
                          <div style={{ display: "grid", gap: 6 }}>
                            <strong style={{ color: "#111827" }}>
                              {line.rapprochement.type_cible || "Cible liée"}
                            </strong>
                            <span>ID cible : {line.rapprochement.cible_id ?? "—"}</span>
                            {line.rapprochement.note ? (
                              <span style={subtleText}>{line.rapprochement.note}</span>
                            ) : null}
                          </div>
                        ) : (
                          <span style={subtleText}>Aucun rapprochement</span>
                        )}
                      </td>

                      <td style={tdDefault}>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <button
                            type="button"
                            style={infoButton}
                            onClick={() => void openSuggestions(line)}
                          >
                            Suggestions
                          </button>

                          {!line.rapprochement && !line.rapproche ? (
                            <>
                              <button
                                type="button"
                                style={primaryButton}
                                onClick={() => openRapprocherModal(line)}
                              >
                                Rapprocher
                              </button>

                              <button
                                type="button"
                                style={softButton}
                                onClick={() => void handleCreateMouvement(line)}
                              >
                                Créer un mouvement comptable
                              </button>

                              {!line.is_ignored && !line.ignored ? (
                                <button
                                  type="button"
                                  style={warningButton}
                                  onClick={() => openIgnoreConfirm(line)}
                                >
                                  Ignorer (métier)
                                </button>
                              ) : null}
                            </>
                          ) : (
                            <button
                              type="button"
                              style={dangerButton}
                              onClick={() => openCancelRapprochementConfirm(line)}
                            >
                              Annuler le rapprochement
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {suggestionsModalOpen && selectedLine ? (
        <div style={modalOverlay}>
          <div style={modalCard}>
            <div style={rowBetween}>
              <div>
                <h2 style={sectionTitle}>Suggestions de rapprochement</h2>
                <p style={{ ...subtleText, margin: "6px 0 0" }}>
                  Ligne #{selectedLine.id} — {selectedLine.libelle || "Sans libellé"}
                </p>
              </div>

              <button type="button" style={softButton} onClick={closeSuggestionsModal}>
                Fermer
              </button>
            </div>

            {suggestionsLoading ? (
              <div style={{ marginTop: 18 }}>
                <EmptyState
                  title="Chargement des suggestions..."
                  description="Les propositions de rapprochement sont en cours de récupération."
                />
              </div>
            ) : !suggestions.length ? (
              <div style={{ marginTop: 18 }}>
                <EmptyState
                  title="Aucune suggestion de rapprochement disponible pour cette ligne"
                  description="Vous pouvez toujours effectuer un rapprochement manuel."
                  action={
                    <button
                      type="button"
                      style={primaryButton}
                      onClick={() => openRapprocherModal(selectedLine)}
                    >
                      Rapprocher
                    </button>
                  }
                />
              </div>
            ) : (
              <div style={{ display: "grid", gap: 12, marginTop: 18 }}>
                {suggestions.map((item, index) => (
                  <div
                    key={`${item.type_cible}-${item.cible_id}-${index}`}
                    style={suggestionCard}
                  >
                    <div style={rowBetween}>
                      <strong style={{ color: "#111827" }}>{item.label}</strong>

                      {typeof item.score === "number" ? (
                        <span
                          style={{
                            ...badgeBase,
                            background: "#dbeafe",
                            color: "#1e3a8a",
                            border: "1px solid #93c5fd",
                          }}
                        >
                          Score {item.score}
                        </span>
                      ) : null}
                    </div>

                    <div style={subtleText}>
                      Type : {item.type_cible} • ID cible : {item.cible_id}
                    </div>

                    <div style={subtleText}>
                      Montant : {formatMoney(item.montant)}{" "}
                      {item.date ? `• ${formatDate(item.date)}` : ""}
                    </div>

                    {item.motif ? <div style={subtleText}>{item.motif}</div> : null}

                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6 }}>
                      <button
                        type="button"
                        style={primaryButton}
                        onClick={() => openRapprocherModal(selectedLine, item)}
                      >
                        Rapprocher
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}

      {rapprocherModalOpen && selectedLine ? (
        <div style={modalOverlay}>
          <div style={modalCard}>
            <div style={rowBetween}>
              <div>
                <h2 style={sectionTitle}>Rapprocher une ligne</h2>
                <p style={{ ...subtleText, margin: "6px 0 0" }}>
                  Ligne #{selectedLine.id} — {selectedLine.libelle || "Sans libellé"}
                </p>
              </div>

              <button type="button" style={softButton} onClick={closeRapprocherModal}>
                Fermer
              </button>
            </div>

            <form onSubmit={submitRapprochement} style={rapprocherForm}>
              <div style={{ display: "grid", gap: 8 }}>
                <label style={formLabel}>Type de cible</label>
                <select
                  value={targetType}
                  onChange={(e) =>
                    setTargetType(
                      e.target.value as RapprochementTargetType,
                    )
                  }
                  style={fieldInput}
                >
                  <option value="PAIEMENT_APPEL">Paiement appel</option>
                  <option value="PAIEMENT_TRAVAUX">Paiement travaux</option>
                  <option value="MOUVEMENT">Mouvement comptable</option>
                </select>
              </div>

              <div style={{ display: "grid", gap: 8 }}>
                <label style={formLabel}>Identifiant cible</label>
                <input
                  type="number"
                  min={1}
                  value={targetId}
                  onChange={(e) => setTargetId(e.target.value)}
                  placeholder="Exemple : 12"
                  style={fieldInput}
                />
              </div>

              <div style={{ display: "grid", gap: 8 }}>
                <label style={formLabel}>Note</label>
                <textarea
                  value={rapprocheNote}
                  onChange={(e) => setRapprocheNote(e.target.value)}
                  rows={4}
                  placeholder="Ajoutez une note de rapprochement si nécessaire."
                  style={textareaInput}
                />
              </div>

              <label style={checkboxLabel}>
                <input
                  type="checkbox"
                  checked={forceRapprochement}
                  onChange={(e) => setForceRapprochement(e.target.checked)}
                />
                Forcer le rapprochement
              </label>

              <div style={formActions}>
                <button type="button" style={softButton} onClick={closeRapprocherModal}>
                  Fermer
                </button>

                <button type="submit" style={primaryButton} disabled={submitLoading}>
                  {submitLoading ? "Traitement en cours..." : "Rapprocher"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      <ConfirmModal
        open={confirmAction.open}
        title={confirmTitle}
        description={confirmDescription}
        confirmLabel={confirmButtonLabel}
        confirmTone="danger"
        loading={confirmAction.open ? confirmAction.loading : false}
        onClose={closeConfirmModal}
        onConfirm={confirmCurrentAction}
        details={
          confirmAction.open && confirmAction.line ? (
            <div style={{ display: "grid", gap: 6 }}>
              <div>
                <b>Ligne :</b> #{confirmAction.line.id}
              </div>
              <div>
                <b>Date :</b>{" "}
                {formatDate(confirmAction.line.date_operation || confirmAction.line.date_valeur)}
              </div>
              <div>
                <b>Libellé :</b> {confirmAction.line.libelle || "Sans libellé"}
              </div>
              <div>
                <b>Référence :</b> {confirmAction.line.reference || "—"}
              </div>
              <div>
                <b>Montant :</b> {formatMoney(getLineAmount(confirmAction.line))}
              </div>
            </div>
          ) : null
        }
      />

      <section style={bottomActions}>
        <Link to="/compta/imports" style={{ textDecoration: "none" }}>
          <button type="button" style={softButton}>
            Retour
          </button>
        </Link>

        <button type="button" style={primaryButton} onClick={goToMouvements}>
          Voir les mouvements
        </button>
      </section>
    </PageShell>
  );
}

const pageShell: CSSProperties = {
  display: "grid",
  gap: 20,
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

const heroHeader: CSSProperties = {
  display: "flex",
  alignItems: "flex-end",
  justifyContent: "space-between",
  gap: 14,
  flexWrap: "wrap",
  minWidth: 0,
};

const heroHeaderTextBlock: CSSProperties = {
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
  margin: 0,
  fontSize: 30,
  lineHeight: 1.15,
  fontWeight: 800,
  color: "#ffffff",
};

const pageSubtitle: CSSProperties = {
  color: "rgba(255,255,255,0.82)",
  fontSize: 15,
  lineHeight: 1.6,
  maxWidth: 760,
};

const headerActions: CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
  position: "relative",
  zIndex: 1,
};

const cardStyle: CSSProperties = {
  background: "#ffffff",
  border: "1px solid #e5e7eb",
  borderRadius: 22,
  padding: 18,
  boxShadow: "0 10px 30px rgba(15, 23, 42, 0.04)",
  minWidth: 0,
};

const cardHeader: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
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

const statsGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 16,
  minWidth: 0,
};

const statCard: CSSProperties = {
  borderRadius: 20,
  padding: 16,
  boxShadow: "0 10px 30px rgba(15, 23, 42, 0.04)",
  minWidth: 0,
};

const statLabel: CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  marginBottom: 8,
};

const statValue: CSSProperties = {
  marginTop: 8,
  fontSize: 28,
  fontWeight: 800,
  lineHeight: 1.1,
  overflowWrap: "anywhere",
};

const buttonBase: CSSProperties = {
  border: "none",
  borderRadius: 12,
  padding: "10px 14px",
  cursor: "pointer",
  fontWeight: 700,
  fontSize: 14,
};

const primaryButton: CSSProperties = {
  ...buttonBase,
  background: "#2563eb",
  color: "#ffffff",
  boxShadow: "0 10px 24px rgba(37,99,235,0.18)",
};

const infoButton: CSSProperties = {
  ...buttonBase,
  background: "#eff6ff",
  color: "#1e3a8a",
  border: "1px solid #93c5fd",
};

const softButton: CSSProperties = {
  ...buttonBase,
  background: "#f3f4f6",
  color: "#111827",
};

const warningButton: CSSProperties = {
  ...buttonBase,
  background: "#fffbeb",
  color: "#92400e",
  border: "1px solid #fcd34d",
};

const dangerButton: CSSProperties = {
  ...buttonBase,
  background: "#991b1b",
  color: "#ffffff",
};

const sectionTitle: CSSProperties = {
  margin: 0,
  fontSize: 18,
  fontWeight: 800,
  color: "#111827",
};

const subtleText: CSSProperties = {
  color: "#6b7280",
  fontSize: 14,
  lineHeight: 1.5,
};

const rowBetween: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  flexWrap: "wrap",
};

const badgeBase: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "6px 10px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 800,
};

const emptyState: CSSProperties = {
  ...cardStyle,
  textAlign: "center",
  padding: 28,
};

const emptyStateTitle: CSSProperties = {
  fontSize: 18,
  fontWeight: 800,
  color: "#111827",
};

const emptyStateText: CSSProperties = {
  ...subtleText,
  marginTop: 8,
  maxWidth: 560,
  marginInline: "auto",
};

const tableWrap: CSSProperties = {
  overflowX: "auto",
  overscrollBehaviorX: "contain",
  marginTop: 4,
  width: "100%",
  minWidth: 0,
};

const tableStyle: CSSProperties = {
  width: "100%",
  borderCollapse: "separate",
  borderSpacing: 0,
  minWidth: 1120,
};

const thStyle: CSSProperties = {
  textAlign: "left",
  padding: "12px 14px",
  fontSize: 13,
  color: "#6b7280",
  borderBottom: "1px solid #e5e7eb",
  background: "#f8fafc",
  fontWeight: 800,
  whiteSpace: "nowrap",
};

const tdDefault: CSSProperties = {
  padding: "14px",
  borderBottom: "1px solid #f1f5f9",
  color: "#374151",
  verticalAlign: "top",
};

const tdDate: CSSProperties = {
  ...tdDefault,
  color: "#111827",
  whiteSpace: "nowrap",
};

const tdLibelle: CSSProperties = {
  ...tdDefault,
  maxWidth: 320,
};

const modalOverlay: CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(15, 23, 42, 0.45)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 20,
  zIndex: 1200,
};

const modalCard: CSSProperties = {
  width: "100%",
  maxWidth: 760,
  maxHeight: "90vh",
  overflow: "auto",
  background: "#ffffff",
  borderRadius: 22,
  padding: 22,
  boxShadow: "0 30px 70px rgba(15, 23, 42, 0.25)",
};

const confirmModalCard: CSSProperties = {
  width: "100%",
  maxWidth: 560,
  background: "#ffffff",
  borderRadius: 22,
  padding: 22,
  boxShadow: "0 30px 70px rgba(15, 23, 42, 0.25)",
  display: "grid",
  gap: 16,
};

const confirmModalTitle: CSSProperties = {
  fontSize: 22,
  fontWeight: 900,
  color: "#111827",
  lineHeight: 1.2,
};

const confirmModalText: CSSProperties = {
  fontSize: 14,
  color: "#4b5563",
  lineHeight: 1.6,
};

const confirmInfoCard: CSSProperties = {
  padding: 14,
  borderRadius: 16,
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
  fontSize: 13,
  color: "#374151",
  lineHeight: 1.55,
};

const confirmActions: CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  gap: 10,
  flexWrap: "wrap",
};

const suggestionCard: CSSProperties = {
  border: "1px solid #93c5fd",
  background: "#eff6ff",
  borderRadius: 16,
  padding: 16,
  display: "grid",
  gap: 8,
};

const rapprocherForm: CSSProperties = {
  display: "grid",
  gap: 16,
  marginTop: 18,
};

const formLabel: CSSProperties = {
  fontWeight: 700,
  color: "#111827",
};

const fieldInput: CSSProperties = {
  padding: "12px 14px",
  borderRadius: 12,
  border: "1px solid #d1d5db",
  fontSize: 14,
  boxSizing: "border-box",
  width: "100%",
};

const textareaInput: CSSProperties = {
  padding: "12px 14px",
  borderRadius: 12,
  border: "1px solid #d1d5db",
  fontSize: 14,
  resize: "vertical",
  boxSizing: "border-box",
  width: "100%",
};

const checkboxLabel: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  color: "#111827",
  fontWeight: 600,
};

const formActions: CSSProperties = {
  display: "flex",
  gap: 10,
  justifyContent: "flex-end",
  flexWrap: "wrap",
};

const bottomActions: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
};