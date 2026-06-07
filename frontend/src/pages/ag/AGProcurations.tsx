// frontend/src/pages/ag/AGProcurations.tsx
import { useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties, FormEvent, ReactNode } from "react";

import {
  canRejectAGProcuration,
  canValidateAGProcuration,
  getAGProcurations,
  getAGProcurationStatutLabel,
  rejeterAGProcuration,
  validerAGProcuration,
  type AGProcurationItem,
  type AGProcurationStatut,
} from "../../api/agProcurations";

type FlashKind = "success" | "error" | "info";
type StatutFilter = "" | AGProcurationStatut;

const statutOptions: Array<{ value: StatutFilter; label: string }> = [
  { value: "", label: "Tous les statuts" },
  { value: "EN_ATTENTE", label: "En attente" },
  { value: "VALIDEE", label: "Validés" },
  { value: "REJETEE", label: "Rejetés" },
  { value: "ANNULEE", label: "Annulés" },
];

export default function AGProcurations() {
  const [items, setItems] = useState<AGProcurationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<{ kind: FlashKind; text: string } | null>(
    null,
  );

  const [statut, setStatut] = useState<StatutFilter>("");
  const [agId, setAgId] = useState("");
  const [search, setSearch] = useState("");

  const [validatingId, setValidatingId] = useState<number | null>(null);
  const [rejectingId, setRejectingId] = useState<number | null>(null);
  const [rejectModal, setRejectModal] = useState<AGProcurationItem | null>(null);
  const [rejectMotif, setRejectMotif] = useState("");

  const showFlash = useCallback((kind: FlashKind, text: string) => {
    setFlash({ kind, text });

    window.setTimeout(() => {
      setFlash((current) => (current?.text === text ? null : current));
    }, 5000);
  }, []);

  const loadProcurations = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!options?.silent) {
        setLoading(true);
      }

      setError(null);

      try {
        const rows = await getAGProcurations({
          agId: agId.trim() || undefined,
          statut: statut || undefined,
        });

        setItems(rows);
      } catch (err) {
        setError(
          getErrorMessage(
            err,
            "Impossible de charger les mandats de représentation pour le moment.",
          ),
        );
        setItems([]);
      } finally {
        if (!options?.silent) {
          setLoading(false);
        }
      }
    },
    [agId, statut],
  );

  useEffect(() => {
    void loadProcurations();
  }, [loadProcurations]);

  const filteredItems = useMemo(() => {
    const query = normalize(search);

    if (!query) return items;

    return items.filter((item) => {
      const haystack = normalize(
        [
          item.ag_titre,
          item.coproprietaire_label,
          item.lot_label,
          item.lot_reference,
          item.lot_numero,
          item.mandataire_nom,
          item.mandataire_telephone,
          item.mandataire_email,
          item.statut_label,
          item.motif_rejet,
        ]
          .filter(Boolean)
          .join(" "),
      );

      return haystack.includes(query);
    });
  }, [items, search]);

  const stats = useMemo(() => {
    return {
      total: items.length,
      enAttente: items.filter((item) => normalize(item.statut) === "EN_ATTENTE")
        .length,
      validees: items.filter((item) => normalize(item.statut) === "VALIDEE")
        .length,
      rejetees: items.filter((item) => normalize(item.statut) === "REJETEE")
        .length,
      annulees: items.filter((item) => normalize(item.statut) === "ANNULEE")
        .length,
    };
  }, [items]);

  const handleRefresh = useCallback(() => {
    void loadProcurations();
  }, [loadProcurations]);

  const handleValidate = useCallback(
    async (item: AGProcurationItem) => {
      if (!canValidateAGProcuration(item)) {
        showFlash("info", "Seuls les mandats en attente peuvent être validés.");
        return;
      }

      const confirmed = window.confirm(
        `Valider le mandat donné à ${item.mandataire_nom} pour le lot ${
          item.lot_label || item.lot_reference || `#${item.lot}`
        } ?`,
      );

      if (!confirmed) return;

      try {
        setValidatingId(item.id);

        const response = await validerAGProcuration(item.id);

        showFlash("success", response.detail || "Mandat validé avec succès.");
        await loadProcurations({ silent: true });
      } catch (err) {
        showFlash("error", getErrorMessage(err, "Impossible de valider ce mandat."));
      } finally {
        setValidatingId(null);
      }
    },
    [loadProcurations, showFlash],
  );

  const openRejectModal = useCallback(
    (item: AGProcurationItem) => {
      if (!canRejectAGProcuration(item)) {
        showFlash("info", "Seuls les mandats en attente peuvent être rejetés.");
        return;
      }

      setRejectModal(item);
      setRejectMotif("");
    },
    [showFlash],
  );

  const closeRejectModal = useCallback(() => {
    if (rejectingId !== null) return;

    setRejectModal(null);
    setRejectMotif("");
  }, [rejectingId]);

  const handleRejectSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      if (!rejectModal) return;

      const motif = rejectMotif.trim();

      if (!motif) {
        showFlash("info", "Le motif de rejet est obligatoire.");
        return;
      }

      try {
        setRejectingId(rejectModal.id);

        const response = await rejeterAGProcuration(rejectModal.id, {
          motif_rejet: motif,
        });

        showFlash("success", response.detail || "Mandat rejeté avec succès.");
        setRejectModal(null);
        setRejectMotif("");
        await loadProcurations({ silent: true });
      } catch (err) {
        showFlash("error", getErrorMessage(err, "Impossible de rejeter ce mandat."));
      } finally {
        setRejectingId(null);
      }
    },
    [loadProcurations, rejectModal, rejectMotif, showFlash],
  );

  if (loading) {
    return (
      <div style={styles.loadingCard}>
        <div style={styles.loadingIcon}>🧾</div>
        <div>
          <p style={styles.loadingTitle}>Chargement des mandats...</p>
          <p style={styles.muted}>
            Nous récupérons les mandats transmis par les copropriétaires.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.stack}>
      <section style={styles.hero}>
        <div>
          <div style={styles.heroBadge}>Assemblées générales</div>
          <h2 style={styles.heroTitle}>Mandats de représentation</h2>
          <p style={styles.heroText}>
            Consultez, validez ou rejetez les mandats transmis par les
            copropriétaires. Un mandat validé alimente automatiquement la présence
            représentée du lot concerné et renforce la traçabilité du cycle AG.
          </p>

          <div style={styles.heroMeta}>
            <span style={styles.metaPill}>Total : {formatNumber(stats.total)}</span>
            <span style={styles.metaPill}>
              En attente : {formatNumber(stats.enAttente)}
            </span>
            <span style={styles.metaPill}>
              Validés : {formatNumber(stats.validees)}
            </span>
          </div>
        </div>

        <div style={styles.sideBox}>
          <div style={styles.sideIcon}>⚖️</div>
          <p style={styles.sideTitle}>Traçabilité juridique</p>
          <p style={styles.sideText}>
            Les validations et rejets sont historisés côté backend avec l’acteur,
            la date, le statut et le motif éventuel. Les décisions traitées ne
            doivent pas être modifiées comme de simples présences manuelles.
          </p>
        </div>
      </section>

      {flash ? <FlashBox kind={flash.kind}>{flash.text}</FlashBox> : null}
      {error ? <FlashBox kind="error">{error}</FlashBox> : null}

      <section style={styles.statsGrid}>
        <StatCard label="Total" value={stats.total} hint="Mandats reçus" tone="blue" />
        <StatCard
          label="En attente"
          value={stats.enAttente}
          hint="À traiter"
          tone="amber"
        />
        <StatCard label="Validés" value={stats.validees} hint="Acceptés" tone="green" />
        <StatCard label="Rejetés" value={stats.rejetees} hint="Refusés" tone="rose" />
        <StatCard
          label="Annulés"
          value={stats.annulees}
          hint="Annulés côté copropriétaire"
          tone="slate"
        />
      </section>

      <section style={styles.card}>
        <div style={styles.sectionHeader}>
          <div>
            <p style={styles.sectionEyebrow}>Traitement syndic</p>
            <h3 style={styles.sectionTitle}>Registre des mandats</h3>
            <p style={styles.sectionText}>
              Filtrez par statut, recherchez un mandataire, un lot, un
              copropriétaire ou une assemblée. Les actions de validation et de
              rejet ne sont disponibles que pour les mandats en attente.
            </p>
          </div>

          <button type="button" onClick={handleRefresh} style={styles.refreshButton}>
            Actualiser
          </button>
        </div>

        <div style={styles.filters}>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Rechercher mandataire, lot, copropriétaire, AG..."
            style={styles.input}
          />

          <input
            value={agId}
            onChange={(event) => setAgId(event.target.value)}
            placeholder="Filtrer par ID AG"
            style={styles.input}
          />

          <select
            value={statut}
            onChange={(event) => setStatut(event.target.value as StatutFilter)}
            style={styles.select}
          >
            {statutOptions.map((option) => (
              <option key={option.value || "ALL"} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {filteredItems.length === 0 ? (
          <EmptyState
            title="Aucun mandat trouvé"
            text="Aucun mandat de représentation ne correspond aux filtres actuels."
          />
        ) : (
          <div style={styles.list}>
            {filteredItems.map((item) => (
              <ProcurationCard
                key={item.id}
                item={item}
                validating={validatingId === item.id}
                rejecting={rejectingId === item.id}
                onValidate={handleValidate}
                onReject={openRejectModal}
              />
            ))}
          </div>
        )}
      </section>

      {rejectModal ? (
        <RejectModal
          item={rejectModal}
          motif={rejectMotif}
          rejecting={rejectingId === rejectModal.id}
          onMotifChange={setRejectMotif}
          onClose={closeRejectModal}
          onSubmit={handleRejectSubmit}
        />
      ) : null}
    </div>
  );
}

function ProcurationCard({
  item,
  validating,
  rejecting,
  onValidate,
  onReject,
}: {
  item: AGProcurationItem;
  validating: boolean;
  rejecting: boolean;
  onValidate: (item: AGProcurationItem) => void;
  onReject: (item: AGProcurationItem) => void;
}) {
  const canValidate = canValidateAGProcuration(item);
  const canReject = canRejectAGProcuration(item);
  const canAct = canValidate || canReject;
  const statusLabel = item.statut_label || getAGProcurationStatutLabel(item.statut);

  return (
    <article style={styles.procurationCard}>
      <div style={styles.procurationMain}>
        <div style={styles.badges}>
          <Badge style={getStatusStyle(item.statut)}>{statusLabel}</Badge>

          <Badge style={styles.agBadge}>AG #{item.ag}</Badge>
        </div>

        <h4 style={styles.procurationTitle}>
          {item.mandataire_nom || "Mandataire non renseigné"}
        </h4>

        <p style={styles.procurationSubtitle}>
          Mandataire désigné par{" "}
          <strong>
            {item.coproprietaire_label || `Copropriétaire #${item.coproprietaire}`}
          </strong>
        </p>

        <div style={styles.infoGrid}>
          <Info label="Assemblée" value={item.ag_titre || `AG #${item.ag}`} />
          <Info
            label="Lot"
            value={
              item.lot_label ||
              item.lot_reference ||
              item.lot_numero ||
              `Lot #${item.lot}`
            }
          />
          <Info
            label="Téléphone mandataire"
            value={item.mandataire_telephone || "—"}
          />
          <Info label="Email mandataire" value={item.mandataire_email || "—"} />
          <Info label="Créé le" value={formatDate(item.created_at)} />
          <Info label="Traitement" value={getTreatmentLabel(item)} />
        </div>

        {item.motif_rejet ? (
          <div style={styles.rejectReason}>
            <strong>Motif du rejet :</strong> {item.motif_rejet}
          </div>
        ) : null}

        {item.document_url ? (
          <button
            type="button"
            onClick={() =>
              window.open(item.document_url || "", "_blank", "noopener,noreferrer")
            }
            style={styles.documentButton}
          >
            Ouvrir le document joint
          </button>
        ) : null}
      </div>

      <div style={styles.actions}>
        {canAct ? (
          <>
            <button
              type="button"
              disabled={!canValidate || validating || rejecting}
              onClick={() => onValidate(item)}
              style={{
                ...styles.validateButton,
                ...(!canValidate || validating || rejecting
                  ? styles.actionButtonDisabled
                  : {}),
              }}
            >
              {validating ? "Validation..." : "Valider"}
            </button>

            <button
              type="button"
              disabled={!canReject || validating || rejecting}
              onClick={() => onReject(item)}
              style={{
                ...styles.rejectButton,
                ...(!canReject || validating || rejecting
                  ? styles.actionButtonDisabled
                  : {}),
              }}
            >
              {rejecting ? "Rejet..." : "Rejeter"}
            </button>
          </>
        ) : (
          <div style={styles.decisionBox}>
            <p style={styles.decisionTitle}>Décision déjà traitée</p>
            <p style={styles.decisionText}>Statut : {statusLabel}</p>
            <p style={styles.decisionHint}>
              Cette décision est historisée. Toute correction doit passer par un
              circuit encadré afin de préserver la cohérence AG.
            </p>
          </div>
        )}
      </div>
    </article>
  );
}

function RejectModal({
  item,
  motif,
  rejecting,
  onMotifChange,
  onClose,
  onSubmit,
}: {
  item: AGProcurationItem;
  motif: string;
  rejecting: boolean;
  onMotifChange: (value: string) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <div style={styles.modalBackdrop}>
      <div style={styles.modalCard}>
        <div style={styles.modalHeader}>
          <div>
            <p style={styles.modalEyebrow}>Rejet du mandat</p>
            <h3 style={styles.modalTitle}>Motif de rejet obligatoire</h3>
            <p style={styles.modalText}>
              Vous allez rejeter le mandat donné à{" "}
              <strong>{item.mandataire_nom}</strong> pour le lot{" "}
              <strong>{item.lot_label || item.lot_reference || `#${item.lot}`}</strong>.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={rejecting}
            style={styles.modalCloseButton}
          >
            ×
          </button>
        </div>

        <form onSubmit={onSubmit} style={styles.modalForm}>
          <label style={styles.fieldGroup}>
            <span style={styles.label}>Motif de rejet *</span>
            <textarea
              value={motif}
              onChange={(event) => onMotifChange(event.target.value)}
              placeholder="Ex. Mandataire non identifié, mandat incomplet, incohérence avec le lot..."
              style={styles.textarea}
              rows={5}
              disabled={rejecting}
              required
            />
          </label>

          <div style={styles.modalActions}>
            <button
              type="button"
              onClick={onClose}
              disabled={rejecting}
              style={styles.secondaryButton}
            >
              Annuler
            </button>

            <button
              type="submit"
              disabled={rejecting}
              style={{
                ...styles.primaryRejectButton,
                ...(rejecting ? styles.actionButtonDisabled : {}),
              }}
            >
              {rejecting ? "Rejet en cours..." : "Confirmer le rejet"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: number;
  hint: string;
  tone: "blue" | "green" | "amber" | "rose" | "slate";
}) {
  const toneStyle = statTones[tone];

  return (
    <div
      style={{
        ...styles.statCard,
        background: toneStyle.background,
        borderColor: toneStyle.border,
      }}
    >
      <p style={styles.statLabel}>{label}</p>
      <p style={{ ...styles.statValue, color: toneStyle.color }}>
        {formatNumber(value)}
      </p>
      <p style={styles.statHint}>{hint}</p>
    </div>
  );
}

function Badge({ children, style }: { children: ReactNode; style: CSSProperties }) {
  return <span style={{ ...styles.badge, ...style }}>{children}</span>;
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div style={styles.infoItem}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function FlashBox({ kind, children }: { kind: FlashKind; children: ReactNode }) {
  const tone =
    kind === "success"
      ? {
          background: "#ecfdf5",
          borderColor: "#a7f3d0",
          color: "#047857",
        }
      : kind === "error"
        ? {
            background: "#fff1f2",
            borderColor: "#fecdd3",
            color: "#be123c",
          }
        : {
            background: "#eff6ff",
            borderColor: "#bfdbfe",
            color: "#1d4ed8",
          };

  return (
    <div
      style={{
        ...styles.flash,
        background: tone.background,
        borderColor: tone.borderColor,
        color: tone.color,
      }}
    >
      {children}
    </div>
  );
}

function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <div style={styles.emptyState}>
      <div style={styles.emptyIcon}>🧾</div>
      <p style={styles.emptyTitle}>{title}</p>
      <p style={styles.emptyText}>{text}</p>
    </div>
  );
}

function normalize(value: string | null | undefined): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
}

function formatNumber(value: number | string | null | undefined) {
  const numberValue = Number(value || 0);

  return new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: 0,
  }).format(numberValue);
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function getTreatmentLabel(item: AGProcurationItem): string {
  const statut = normalize(item.statut);

  if (statut === "VALIDEE") {
    return `Validé le ${formatDate(item.validated_at)}`;
  }

  if (statut === "REJETEE") {
    return `Rejeté le ${formatDate(item.rejected_at)}`;
  }

  if (statut === "ANNULEE") {
    return "Annulé par le copropriétaire";
  }

  return "En attente de traitement";
}

function getStatusStyle(statut: string | null | undefined): CSSProperties {
  const value = normalize(statut);

  if (value === "VALIDEE") {
    return {
      background: "#ecfdf5",
      color: "#047857",
      borderColor: "#a7f3d0",
    };
  }

  if (value === "EN_ATTENTE") {
    return {
      background: "#fffbeb",
      color: "#b45309",
      borderColor: "#fde68a",
    };
  }

  if (value === "REJETEE") {
    return {
      background: "#fff1f2",
      color: "#be123c",
      borderColor: "#fecdd3",
    };
  }

  if (value === "ANNULEE") {
    return {
      background: "#f8fafc",
      color: "#64748b",
      borderColor: "#e2e8f0",
    };
  }

  return {
    background: "#f8fafc",
    color: "#475569",
    borderColor: "#e2e8f0",
  };
}

function getErrorMessage(error: unknown, fallback: string): string {
  const err = error as {
    response?: {
      data?: {
        detail?: string | string[];
        message?: string;
        non_field_errors?: string[];
        [key: string]: unknown;
      };
    };
    message?: string;
  };

  const data = err.response?.data;

  if (typeof data?.detail === "string" && data.detail.trim()) {
    return data.detail;
  }

  if (Array.isArray(data?.detail) && typeof data.detail[0] === "string") {
    return data.detail[0];
  }

  if (typeof data?.message === "string" && data.message.trim()) {
    return data.message;
  }

  if (Array.isArray(data?.non_field_errors) && data.non_field_errors.length > 0) {
    return data.non_field_errors.join("\n");
  }

  if (data && typeof data === "object") {
    for (const value of Object.values(data)) {
      if (typeof value === "string" && value.trim()) return value;

      if (Array.isArray(value) && typeof value[0] === "string") {
        return value[0];
      }
    }
  }

  return err.message || fallback;
}

const statTones: Record<
  "blue" | "green" | "amber" | "rose" | "slate",
  { background: string; border: string; color: string }
> = {
  blue: {
    background: "#eff6ff",
    border: "#bfdbfe",
    color: "#2563eb",
  },
  green: {
    background: "#ecfdf5",
    border: "#bbf7d0",
    color: "#059669",
  },
  amber: {
    background: "#fffbeb",
    border: "#fde68a",
    color: "#d97706",
  },
  rose: {
    background: "#fff1f2",
    border: "#fecdd3",
    color: "#be123c",
  },
  slate: {
    background: "#f8fafc",
    border: "#e2e8f0",
    color: "#475569",
  },
};

const styles: Record<string, CSSProperties> = {
  stack: {
    display: "flex",
    flexDirection: "column",
    gap: 22,
  },

  hero: {
    borderRadius: 34,
    padding: 30,
    background:
      "linear-gradient(135deg, rgba(15,23,42,0.97), rgba(79,70,229,0.94)), radial-gradient(circle at top right, rgba(196,181,253,0.45), transparent 36%)",
    color: "white",
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) 320px",
    gap: 24,
    boxShadow: "0 30px 85px rgba(15,23,42,0.25)",
    overflow: "hidden",
  },

  heroBadge: {
    display: "inline-flex",
    alignItems: "center",
    borderRadius: 999,
    padding: "7px 11px",
    background: "rgba(255,255,255,0.13)",
    border: "1px solid rgba(255,255,255,0.18)",
    color: "#ede9fe",
    fontSize: 11,
    fontWeight: 950,
    letterSpacing: "0.14em",
    textTransform: "uppercase",
  },

  heroTitle: {
    margin: "14px 0 0",
    fontSize: 34,
    lineHeight: 1.08,
    fontWeight: 950,
    letterSpacing: "-0.04em",
  },

  heroText: {
    margin: "14px 0 0",
    maxWidth: 820,
    color: "#ede9fe",
    fontSize: 15,
    lineHeight: 1.75,
    fontWeight: 550,
  },

  heroMeta: {
    display: "flex",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 22,
  },

  metaPill: {
    borderRadius: 999,
    padding: "8px 12px",
    background: "rgba(255,255,255,0.14)",
    border: "1px solid rgba(255,255,255,0.20)",
    color: "#ffffff",
    fontSize: 12,
    fontWeight: 850,
  },

  sideBox: {
    alignSelf: "stretch",
    borderRadius: 28,
    padding: 22,
    background: "rgba(255,255,255,0.13)",
    border: "1px solid rgba(255,255,255,0.22)",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.10)",
  },

  sideIcon: {
    width: 48,
    height: 48,
    borderRadius: 18,
    background: "rgba(255,255,255,0.14)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 22,
    marginBottom: 14,
  },

  sideTitle: {
    margin: 0,
    fontSize: 18,
    fontWeight: 950,
  },

  sideText: {
    margin: "10px 0 0",
    color: "#ede9fe",
    fontSize: 14,
    lineHeight: 1.6,
  },

  flash: {
    border: "1px solid",
    borderRadius: 18,
    padding: "14px 16px",
    fontSize: 13,
    fontWeight: 750,
    lineHeight: 1.55,
    whiteSpace: "pre-wrap",
  },

  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
    gap: 14,
  },

  statCard: {
    border: "1px solid #e2e8f0",
    borderRadius: 24,
    padding: 18,
    boxShadow: "0 14px 35px rgba(15,23,42,0.06)",
  },

  statLabel: {
    margin: 0,
    color: "#64748b",
    fontSize: 12,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },

  statValue: {
    margin: "10px 0 0",
    fontSize: 28,
    fontWeight: 950,
    lineHeight: 1,
  },

  statHint: {
    margin: "8px 0 0",
    color: "#64748b",
    fontSize: 13,
    lineHeight: 1.45,
  },

  card: {
    border: "1px solid #e2e8f0",
    borderRadius: 28,
    background: "#ffffff",
    boxShadow: "0 18px 55px rgba(15,23,42,0.07)",
    padding: 22,
  },

  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 16,
    alignItems: "flex-start",
    flexWrap: "wrap",
    marginBottom: 18,
  },

  sectionEyebrow: {
    margin: 0,
    color: "#4f46e5",
    fontSize: 11,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.12em",
  },

  sectionTitle: {
    margin: "6px 0 0",
    color: "#0f172a",
    fontSize: 22,
    fontWeight: 950,
    letterSpacing: "-0.03em",
  },

  sectionText: {
    margin: "8px 0 0",
    color: "#64748b",
    fontSize: 14,
    lineHeight: 1.6,
    maxWidth: 820,
  },

  refreshButton: {
    border: "1px solid #c7d2fe",
    background: "#eef2ff",
    color: "#4338ca",
    borderRadius: 16,
    padding: "10px 14px",
    fontSize: 13,
    fontWeight: 950,
    cursor: "pointer",
  },

  filters: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) 160px 220px",
    gap: 12,
    marginBottom: 18,
  },

  input: {
    width: "100%",
    border: "1px solid #dbe3ef",
    borderRadius: 16,
    padding: "12px 14px",
    color: "#0f172a",
    fontSize: 14,
    outline: "none",
    boxSizing: "border-box",
  },

  select: {
    width: "100%",
    border: "1px solid #dbe3ef",
    borderRadius: 16,
    padding: "12px 14px",
    color: "#0f172a",
    fontSize: 14,
    outline: "none",
    background: "#ffffff",
    boxSizing: "border-box",
  },

  list: {
    display: "grid",
    gap: 14,
  },

  procurationCard: {
    border: "1px solid #e2e8f0",
    borderRadius: 24,
    background: "#ffffff",
    padding: 18,
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) 190px",
    gap: 16,
    alignItems: "start",
    boxShadow: "0 14px 36px rgba(15,23,42,0.05)",
  },

  procurationMain: {
    minWidth: 0,
  },

  badges: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 10,
  },

  badge: {
    display: "inline-flex",
    alignItems: "center",
    border: "1px solid",
    borderRadius: 999,
    padding: "5px 9px",
    fontSize: 11,
    fontWeight: 900,
    whiteSpace: "nowrap",
  },

  agBadge: {
    background: "#eff6ff",
    color: "#1d4ed8",
    borderColor: "#bfdbfe",
  },

  procurationTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: 19,
    fontWeight: 950,
    letterSpacing: "-0.02em",
    lineHeight: 1.2,
  },

  procurationSubtitle: {
    margin: "8px 0 0",
    color: "#64748b",
    fontSize: 13,
    lineHeight: 1.55,
  },

  infoGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 10,
    marginTop: 14,
  },

  infoItem: {
    border: "1px solid #e2e8f0",
    borderRadius: 16,
    background: "#f8fafc",
    padding: 12,
    display: "grid",
    gap: 5,
  },

  rejectReason: {
    marginTop: 12,
    border: "1px solid #fecdd3",
    background: "#fff1f2",
    color: "#be123c",
    borderRadius: 16,
    padding: 12,
    fontSize: 12,
    lineHeight: 1.55,
  },

  documentButton: {
    marginTop: 12,
    border: "1px solid #bfdbfe",
    background: "#eff6ff",
    color: "#1d4ed8",
    borderRadius: 14,
    padding: "9px 12px",
    fontSize: 12,
    fontWeight: 900,
    cursor: "pointer",
  },

  actions: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },

  validateButton: {
    border: "1px solid #a7f3d0",
    background: "#ecfdf5",
    color: "#047857",
    borderRadius: 16,
    padding: "11px 14px",
    fontSize: 13,
    fontWeight: 950,
    cursor: "pointer",
  },

  rejectButton: {
    border: "1px solid #fecdd3",
    background: "#fff1f2",
    color: "#be123c",
    borderRadius: 16,
    padding: "11px 14px",
    fontSize: 13,
    fontWeight: 950,
    cursor: "pointer",
  },

  actionButtonDisabled: {
    borderColor: "#e2e8f0",
    background: "#f8fafc",
    color: "#94a3b8",
    cursor: "not-allowed",
  },

  decisionBox: {
    border: "1px solid #e2e8f0",
    borderRadius: 18,
    background: "#f8fafc",
    padding: 14,
  },

  decisionTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: 13,
    fontWeight: 950,
  },

  decisionText: {
    margin: "7px 0 0",
    color: "#334155",
    fontSize: 13,
    fontWeight: 850,
  },

  decisionHint: {
    margin: "7px 0 0",
    color: "#64748b",
    fontSize: 12,
    lineHeight: 1.5,
  },

  emptyState: {
    border: "1px dashed #cbd5e1",
    borderRadius: 24,
    padding: 26,
    textAlign: "center",
    background: "#f8fafc",
  },

  emptyIcon: {
    fontSize: 30,
    marginBottom: 10,
  },

  emptyTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: 17,
    fontWeight: 950,
  },

  emptyText: {
    margin: "8px auto 0",
    maxWidth: 620,
    color: "#64748b",
    fontSize: 14,
    lineHeight: 1.6,
  },

  loadingCard: {
    border: "1px solid #e2e8f0",
    borderRadius: 28,
    background: "#ffffff",
    boxShadow: "0 18px 55px rgba(15,23,42,0.07)",
    padding: 28,
    display: "flex",
    gap: 16,
    alignItems: "center",
  },

  loadingIcon: {
    width: 52,
    height: 52,
    borderRadius: 20,
    background: "#eef2ff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 24,
  },

  loadingTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: 17,
    fontWeight: 950,
  },

  muted: {
    margin: "6px 0 0",
    color: "#64748b",
    fontSize: 14,
    lineHeight: 1.5,
  },

  modalBackdrop: {
    position: "fixed",
    inset: 0,
    zIndex: 80,
    background: "rgba(15,23,42,0.48)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 18,
  },

  modalCard: {
    width: "100%",
    maxWidth: 620,
    borderRadius: 28,
    background: "#ffffff",
    boxShadow: "0 32px 90px rgba(15,23,42,0.32)",
    border: "1px solid #e2e8f0",
    padding: 22,
  },

  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 16,
    alignItems: "flex-start",
  },

  modalEyebrow: {
    margin: 0,
    color: "#be123c",
    fontSize: 11,
    fontWeight: 950,
    textTransform: "uppercase",
    letterSpacing: "0.12em",
  },

  modalTitle: {
    margin: "6px 0 0",
    color: "#0f172a",
    fontSize: 24,
    fontWeight: 950,
    letterSpacing: "-0.03em",
  },

  modalText: {
    margin: "8px 0 0",
    color: "#64748b",
    fontSize: 13,
    lineHeight: 1.6,
  },

  modalCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 14,
    border: "1px solid #e2e8f0",
    background: "#f8fafc",
    color: "#475569",
    cursor: "pointer",
    fontSize: 22,
    lineHeight: 1,
  },

  modalForm: {
    display: "grid",
    gap: 14,
    marginTop: 18,
  },

  fieldGroup: {
    display: "grid",
    gap: 7,
  },

  label: {
    color: "#334155",
    fontSize: 12,
    fontWeight: 900,
  },

  textarea: {
    width: "100%",
    border: "1px solid #dbe3ef",
    borderRadius: 16,
    padding: "12px 14px",
    color: "#0f172a",
    fontSize: 14,
    outline: "none",
    resize: "vertical",
    boxSizing: "border-box",
    fontFamily: "inherit",
  },

  modalActions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: 10,
    flexWrap: "wrap",
    marginTop: 4,
  },

  secondaryButton: {
    border: "1px solid #e2e8f0",
    background: "#ffffff",
    color: "#475569",
    borderRadius: 16,
    padding: "11px 14px",
    fontSize: 13,
    fontWeight: 900,
    cursor: "pointer",
  },

  primaryRejectButton: {
    border: "1px solid #be123c",
    background: "#be123c",
    color: "#ffffff",
    borderRadius: 16,
    padding: "11px 16px",
    fontSize: 13,
    fontWeight: 950,
    cursor: "pointer",
  },
};