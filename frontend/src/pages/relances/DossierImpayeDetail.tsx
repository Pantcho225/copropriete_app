import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { relancesAPI } from "../../api/relances";
import { APP_TEXT } from "../../config/appText";

type LoadState = "idle" | "loading" | "success" | "error";
type FlashKind = "success" | "error" | "info";
type PendingAction = "relance" | "avis" | null;

type RelanceItem = {
  id: number;
  niveau?: number | null;
  canal?: string | null;
  statut?: string | null;
  objet?: string | null;
  message?: string | null;
  montant_du_message?: number | string | null;
  date_envoi?: string | null;
  envoye_par_username?: string | null;
};

type AvisItem = {
  id: number;
  statut?: string | null;
  canal?: string | null;
  montant_initial?: number | string | null;
  montant_total_regle?: number | string | null;
  date_regularisation?: string | null;
  message?: string | null;
  genere_par_username?: string | null;
};

type DossierItem = {
  id: number;
  copropriete?: number | null;
  lot?: number | null;
  appel?: number | null;
  lot_numero?: string | null;
  coproprietaire_nom?: string | null;
  appel_reference?: string | null;
  reference_appel?: string | null;
  date_echeance?: string | null;
  montant_initial?: number | string | null;
  montant_paye?: number | string | null;
  reste_a_payer?: number | string | null;
  statut?: string | null;
  niveau_relance?: number | null;
  relances_count?: number | null;
  est_regularise?: boolean;
  regularise_at?: string | null;
  date_dernier_paiement?: string | null;
  commentaire_interne?: string | null;
  relances?: RelanceItem[];
  avis_regularisation?: AvisItem | null;
};

type RelanceFormState = {
  canal: string;
  objet: string;
  message: string;
};

type AvisFormState = {
  canal: string;
  message: string;
};

const CANAL_OPTIONS = [
  { value: "INTERNE", label: "Interne" },
  { value: "EMAIL", label: "Email" },
  { value: "SMS", label: "SMS" },
  { value: "WHATSAPP", label: "WhatsApp" },
  { value: "COURRIER", label: "Courrier" },
] as const;

function PageShell({ children }: { children: ReactNode }) {
  return <div style={pageShell}>{children}</div>;
}

function PageHeader(props: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div style={pageHeader}>
      <div style={{ display: "grid", gap: 6 }}>
        <div style={pageEyebrow}>Relances</div>
        <div style={pageTitle}>{props.title}</div>
        {props.subtitle ? <div style={pageSubtitle}>{props.subtitle}</div> : null}
      </div>
      {props.actions ? <div style={pageHeaderActions}>{props.actions}</div> : null}
    </div>
  );
}

function Card(props: { title: string; subtitle?: string; children: ReactNode; right?: ReactNode }) {
  return (
    <div style={card}>
      <div style={cardHeader}>
        <div style={{ display: "grid", gap: 4 }}>
          <div style={cardTitle}>{props.title}</div>
          {props.subtitle ? <div style={cardSubtitle}>{props.subtitle}</div> : null}
        </div>
        {props.right}
      </div>
      {props.children}
    </div>
  );
}

function SmallButton(props: {
  children: ReactNode;
  onClick?: () => void;
  primary?: boolean;
  disabled?: boolean;
  danger?: boolean;
  title?: string;
}) {
  const tone = props.danger
    ? {
        border: "1px solid #fecaca",
        background: "#fef2f2",
        color: props.disabled ? "#fca5a5" : "#991b1b",
      }
    : props.primary
      ? {
          border: "1px solid #c7d2fe",
          background: "#eef2ff",
          color: props.disabled ? "#818cf8" : "#3730a3",
        }
      : {
          border: "1px solid #e5e7eb",
          background: "#ffffff",
          color: props.disabled ? "#9ca3af" : "#111827",
        };

  return (
    <button
      type="button"
      disabled={props.disabled}
      onClick={props.onClick}
      title={props.title}
      style={{
        ...tone,
        borderRadius: 12,
        padding: "10px 14px",
        fontSize: 13,
        fontWeight: 800,
        cursor: props.disabled ? "not-allowed" : "pointer",
        whiteSpace: "nowrap",
        transition: "all 0.2s ease",
      }}
    >
      {props.children}
    </button>
  );
}

function Badge(props: { text: string; kind?: "success" | "warning" | "danger" | "info" | "neutral" }) {
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
        border: `1px solid ${styles.border}`,
        background: styles.background,
        color: styles.color,
        fontSize: 12,
        fontWeight: 800,
        whiteSpace: "nowrap",
      }}
    >
      {props.text}
    </span>
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
        whiteSpace: "pre-wrap",
        lineHeight: 1.5,
      }}
    >
      {props.children}
    </div>
  );
}

function KeyValueRow(props: { label: string; value: ReactNode }) {
  return (
    <div style={keyValueRow}>
      <div style={keyValueLabel}>{props.label}</div>
      <div style={keyValueValue}>{props.value}</div>
    </div>
  );
}

function Field(props: {
  label: string;
  children: ReactNode;
  help?: string;
}) {
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <label style={fieldLabel}>{props.label}</label>
      {props.children}
      {props.help ? <div style={fieldHelp}>{props.help}</div> : null}
    </div>
  );
}

function Modal(props: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <div style={modalBackdrop} onClick={props.onClose}>
      <div
        style={modalCard}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div style={{ display: "grid", gap: 6, marginBottom: 18 }}>
          <div style={modalTitle}>{props.title}</div>
          {props.subtitle ? <div style={modalSubtitle}>{props.subtitle}</div> : null}
        </div>
        {props.children}
      </div>
    </div>
  );
}

function EmptyState(props: { title: string; description?: string }) {
  return (
    <div style={emptyState}>
      <div style={emptyStateTitle}>{props.title}</div>
      {props.description ? <div style={emptyStateText}>{props.description}</div> : null}
    </div>
  );
}

function formatMoneyFCFA(amount?: number | string | null): string {
  if (amount == null || amount === "") return "—";
  const value = Number(amount);
  if (!Number.isFinite(value)) return String(amount);
  try {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "XOF",
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${value} FCFA`;
  }
}

function formatDateShort(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("fr-FR");
}

function formatDateTimeShort(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.toLocaleDateString("fr-FR")} ${d.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

function normalizeStatut(value?: string | null): string {
  return String(value ?? "").trim().toUpperCase();
}

function getCanalLabel(canal?: string | null): string {
  const normalized = String(canal ?? "").trim().toUpperCase();
  const found = CANAL_OPTIONS.find((opt) => opt.value === normalized);
  return found?.label || canal || "—";
}

function getDossierBadge(statut?: string | null) {
  switch (normalizeStatut(statut)) {
    case "REGULARISE":
      return <Badge text="Régularisé" kind="success" />;
    case "PAYE":
      return <Badge text="Payé" kind="success" />;
    case "PARTIELLEMENT_PAYE":
      return <Badge text="Partiellement payé" kind="warning" />;
    case "EN_RETARD":
      return <Badge text="En retard" kind="danger" />;
    default:
      return <Badge text="À payer" kind="info" />;
  }
}

function getRelanceBadge(statut?: string | null) {
  switch (normalizeStatut(statut)) {
    case "ANNULEE":
      return <Badge text="Annulée" kind="danger" />;
    case "ENVOYEE":
      return <Badge text="Envoyée" kind="info" />;
    default:
      return <Badge text={statut || "—"} kind="neutral" />;
  }
}

function getAvisBadge(statut?: string | null) {
  switch (normalizeStatut(statut)) {
    case "ECHEC":
      return <Badge text="Échec" kind="danger" />;
    case "ENVOYE":
      return <Badge text="Envoyé" kind="info" />;
    case "GENERE":
      return <Badge text="Généré" kind="success" />;
    default:
      return <Badge text={statut || "—"} kind="neutral" />;
  }
}

export default function DossierImpayeDetail() {
  const navigate = useNavigate();
  const { id } = useParams();

  const [state, setState] = useState<LoadState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<{ kind: FlashKind; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [dossier, setDossier] = useState<DossierItem | null>(null);

  const [isRelanceModalOpen, setIsRelanceModalOpen] = useState(false);
  const [isAvisModalOpen, setIsAvisModalOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);

  const [relanceForm, setRelanceForm] = useState<RelanceFormState>({
    canal: "INTERNE",
    objet: "",
    message: "",
  });

  const [avisForm, setAvisForm] = useState<AvisFormState>({
    canal: "INTERNE",
    message: "Votre situation est régularisée. Merci.",
  });

  const [relanceFormError, setRelanceFormError] = useState<string | null>(null);
  const [avisFormError, setAvisFormError] = useState<string | null>(null);

  async function load() {
    if (!id) return;

    setState("loading");
    setError(null);

    try {
      const data = (await relancesAPI.getDossier(Number(id))) as DossierItem;
      setDossier(data);
      setState("success");
    } catch (e: any) {
      setState("error");
      setError(e?.response?.data?.detail || e?.message || APP_TEXT.errors.loadFailed);
      setDossier(null);
    }
  }

  useEffect(() => {
    void load();
  }, [id]);

  const canRelancer = useMemo(() => {
    if (!dossier) return false;
    const reste = Number(dossier.reste_a_payer ?? 0);
    return Number.isFinite(reste) && reste > 0 && !dossier.est_regularise;
  }, [dossier]);

  const canGenerateAvis = useMemo(() => {
    if (!dossier) return false;
    const reste = Number(dossier.reste_a_payer ?? 0);
    return dossier.est_regularise === true || (Number.isFinite(reste) && reste <= 0);
  }, [dossier]);

  function openRelanceModal() {
    if (!dossier) return;

    setRelanceForm({
      canal: "INTERNE",
      objet: `Relance ${dossier.appel_reference || dossier.reference_appel || ""}`.trim(),
      message: `Bonjour, un solde de ${formatMoneyFCFA(
        dossier.reste_a_payer
      )} reste dû pour ${dossier.appel_reference || dossier.reference_appel || "cet appel"}.`,
    });
    setRelanceFormError(null);
    setPendingAction(null);
    setIsRelanceModalOpen(true);
  }

  function openAvisModal() {
    setAvisForm({
      canal: "INTERNE",
      message: "Votre situation est régularisée. Merci.",
    });
    setAvisFormError(null);
    setPendingAction(null);
    setIsAvisModalOpen(true);
  }

  function closeRelanceModal() {
    if (busy === "relance") return;
    setIsRelanceModalOpen(false);
    setRelanceFormError(null);
    setPendingAction(null);
  }

  function closeAvisModal() {
    if (busy === "avis") return;
    setIsAvisModalOpen(false);
    setAvisFormError(null);
    setPendingAction(null);
  }

  function askConfirmRelance() {
    const canal = relanceForm.canal.trim();
    const objet = relanceForm.objet.trim();
    const message = relanceForm.message.trim();

    if (!canal) {
      setRelanceFormError("Le canal de relance est obligatoire.");
      return;
    }

    if (!objet) {
      setRelanceFormError("L’objet de la relance est obligatoire.");
      return;
    }

    if (!message) {
      setRelanceFormError("Le message de la relance est obligatoire.");
      return;
    }

    setRelanceFormError(null);
    setPendingAction("relance");
  }

  function askConfirmAvis() {
    const canal = avisForm.canal.trim();
    const message = avisForm.message.trim();

    if (!canal) {
      setAvisFormError("Le canal de l’avis est obligatoire.");
      return;
    }

    if (!message) {
      setAvisFormError("Le message de l’avis est obligatoire.");
      return;
    }

    setAvisFormError(null);
    setPendingAction("avis");
  }

  async function submitRelance() {
    if (!dossier) return;

    const canal = relanceForm.canal.trim();
    const objet = relanceForm.objet.trim();
    const message = relanceForm.message.trim();

    setBusy("relance");
    setFlash(null);
    setRelanceFormError(null);

    try {
      await relancesAPI.envoyerRelanceDossier(dossier.id, {
        canal,
        objet,
        message,
      });
      setIsRelanceModalOpen(false);
      setPendingAction(null);
      setFlash({ kind: "success", text: APP_TEXT.success.relanceSent });
      await load();
    } catch (e: any) {
      setRelanceFormError(
        e?.response?.data?.detail || e?.message || APP_TEXT.errors.actionFailed
      );
      setPendingAction(null);
    } finally {
      setBusy(null);
    }
  }

  async function submitAvis() {
    if (!dossier) return;

    const canal = avisForm.canal.trim();
    const message = avisForm.message.trim();

    setBusy("avis");
    setFlash(null);
    setAvisFormError(null);

    try {
      await relancesAPI.genererAvisRegularisationDossier(dossier.id, {
        canal,
        message,
      });
      setIsAvisModalOpen(false);
      setPendingAction(null);
      setFlash({ kind: "success", text: APP_TEXT.success.avisGenerated });
      await load();
    } catch (e: any) {
      setAvisFormError(
        e?.response?.data?.detail || e?.message || APP_TEXT.errors.actionFailed
      );
      setPendingAction(null);
    } finally {
      setBusy(null);
    }
  }

  if (!id) {
    return (
      <PageShell>
        <AlertBox kind="error">Identifiant de dossier introuvable.</AlertBox>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageHeader
        title={dossier ? `Détail du dossier impayé #${dossier.id}` : "Détail du dossier impayé"}
        subtitle="Consultez le dossier, son historique de relances et l’éventuel avis de régularisation."
        actions={
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <SmallButton onClick={() => navigate("/relances/dossiers")}>
              Retour aux dossiers impayés
            </SmallButton>

            <SmallButton
              onClick={openRelanceModal}
              primary
              disabled={!canRelancer || busy !== null}
            >
              {busy === "relance" ? "Envoi..." : "Envoyer une relance"}
            </SmallButton>

            <SmallButton
              onClick={openAvisModal}
              disabled={!canGenerateAvis || busy !== null}
            >
              {busy === "avis" ? "Génération..." : "Générer l’avis"}
            </SmallButton>
          </div>
        }
      />

      {state === "error" && error ? (
        <AlertBox kind="error">
          <div style={{ fontWeight: 900, marginBottom: 4 }}>Chargement impossible</div>
          <div>{error}</div>
        </AlertBox>
      ) : null}

      {flash ? <AlertBox kind={flash.kind}>{flash.text}</AlertBox> : null}

      <div className="relances-detail-grid" style={detailGrid}>
        <Card title="Informations du dossier">
          {state === "loading" ? (
            <div style={simpleMutedText}>{APP_TEXT.common.loading}</div>
          ) : !dossier ? (
            <EmptyState title="Aucune donnée disponible" description={APP_TEXT.common.noData} />
          ) : (
            <>
              <KeyValueRow label="Lot" value={dossier.lot_numero || "—"} />
              <KeyValueRow label="Copropriétaire" value={dossier.coproprietaire_nom || "—"} />
              <KeyValueRow
                label="Appel de fonds"
                value={dossier.appel_reference || dossier.reference_appel || "—"}
              />
              <KeyValueRow label="Échéance" value={formatDateShort(dossier.date_echeance)} />
              <KeyValueRow label="Montant initial" value={formatMoneyFCFA(dossier.montant_initial)} />
              <KeyValueRow label="Montant payé" value={formatMoneyFCFA(dossier.montant_paye)} />
              <KeyValueRow label="Reste à payer" value={formatMoneyFCFA(dossier.reste_a_payer)} />
              <KeyValueRow label="Statut" value={getDossierBadge(dossier.statut)} />
              <KeyValueRow
                label="Niveau de relance"
                value={<Badge text={`Niveau ${dossier.niveau_relance || 0}`} kind="warning" />}
              />
              <KeyValueRow label="Nombre de relances" value={`${dossier.relances_count || 0}`} />
            </>
          )}
        </Card>

        <Card title="Suivi de régularisation">
          {state === "loading" ? (
            <div style={simpleMutedText}>{APP_TEXT.common.loading}</div>
          ) : !dossier ? (
            <EmptyState title="Aucune donnée disponible" description={APP_TEXT.common.noData} />
          ) : (
            <>
              <KeyValueRow
                label="Régularisé"
                value={
                  dossier.est_regularise ? (
                    <Badge text="Oui" kind="success" />
                  ) : (
                    <Badge text="Non" kind="danger" />
                  )
                }
              />
              <KeyValueRow
                label="Date de régularisation"
                value={formatDateTimeShort(dossier.regularise_at)}
              />
              <KeyValueRow
                label="Dernier paiement"
                value={formatDateTimeShort(dossier.date_dernier_paiement)}
              />
              <KeyValueRow
                label="Commentaire interne"
                value={dossier.commentaire_interne || "—"}
              />
              <KeyValueRow
                label="Avis de régularisation"
                value={
                  dossier.avis_regularisation ? (
                    getAvisBadge(dossier.avis_regularisation.statut)
                  ) : (
                    <Badge text="Aucun avis" kind="warning" />
                  )
                }
              />
            </>
          )}
        </Card>
      </div>

      <Card
        title="Historique des relances"
        subtitle="Consultez les relances déjà envoyées pour ce dossier impayé."
      >
        {state === "loading" ? (
          <div style={simpleMutedText}>{APP_TEXT.common.loading}</div>
        ) : !dossier?.relances || dossier.relances.length === 0 ? (
          <EmptyState title="Aucune relance enregistrée" description={APP_TEXT.emptyStates.noRelance} />
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {dossier.relances.map((r) => (
              <div key={r.id} style={rowCard}>
                <div style={{ display: "grid", gap: 6 }}>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <Badge text={`Niveau ${r.niveau || 0}`} kind="warning" />
                    <Badge text={getCanalLabel(r.canal)} kind="info" />
                    {getRelanceBadge(r.statut)}
                  </div>

                  <div style={{ fontSize: 14, fontWeight: 800, color: "#111827" }}>
                    {r.objet || "Sans objet"}
                  </div>

                  <div style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.6 }}>
                    {r.message || "Aucun message"}
                  </div>

                  <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.45 }}>
                    Envoyée le {formatDateTimeShort(r.date_envoi)} • par {r.envoye_par_username || "—"} • montant{" "}
                    {formatMoneyFCFA(r.montant_du_message)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card
        title="Avis de régularisation"
        subtitle="Consultez l’avis généré lorsque le dossier a été régularisé."
      >
        {state === "loading" ? (
          <div style={simpleMutedText}>{APP_TEXT.common.loading}</div>
        ) : !dossier?.avis_regularisation ? (
          <EmptyState title="Aucun avis disponible" description={APP_TEXT.emptyStates.noAvis} />
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            <KeyValueRow label="Statut" value={getAvisBadge(dossier.avis_regularisation.statut)} />
            <KeyValueRow label="Canal" value={getCanalLabel(dossier.avis_regularisation.canal)} />
            <KeyValueRow
              label="Montant initial"
              value={formatMoneyFCFA(dossier.avis_regularisation.montant_initial)}
            />
            <KeyValueRow
              label="Montant réglé"
              value={formatMoneyFCFA(dossier.avis_regularisation.montant_total_regle)}
            />
            <KeyValueRow
              label="Date de régularisation"
              value={formatDateTimeShort(dossier.avis_regularisation.date_regularisation)}
            />
            <KeyValueRow
              label="Généré par"
              value={dossier.avis_regularisation.genere_par_username || "—"}
            />
            <KeyValueRow label="Message" value={dossier.avis_regularisation.message || "—"} />
          </div>
        )}
      </Card>

      {isRelanceModalOpen ? (
        <Modal
          title="Envoyer une relance"
          subtitle="Renseignez le canal, l’objet et le message avant validation."
          onClose={closeRelanceModal}
        >
          <div style={{ display: "grid", gap: 16 }}>
            <Field label="Canal">
              <select
                value={relanceForm.canal}
                onChange={(e) => setRelanceForm((prev) => ({ ...prev, canal: e.target.value }))}
                style={input}
              >
                {CANAL_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Objet">
              <input
                value={relanceForm.objet}
                onChange={(e) => setRelanceForm((prev) => ({ ...prev, objet: e.target.value }))}
                style={input}
                placeholder="Objet de la relance"
              />
            </Field>

            <Field label="Message">
              <textarea
                value={relanceForm.message}
                onChange={(e) => setRelanceForm((prev) => ({ ...prev, message: e.target.value }))}
                style={textarea}
                rows={6}
                placeholder="Message de relance"
              />
            </Field>

            {relanceFormError ? <AlertBox kind="error">{relanceFormError}</AlertBox> : null}

            <div style={modalActions}>
              <SmallButton onClick={closeRelanceModal} disabled={busy === "relance"}>
                {APP_TEXT.common.cancel}
              </SmallButton>
              <SmallButton onClick={askConfirmRelance} primary disabled={busy === "relance"}>
                Continuer
              </SmallButton>
            </div>
          </div>
        </Modal>
      ) : null}

      {isAvisModalOpen ? (
        <Modal
          title="Générer l’avis de régularisation"
          subtitle="Renseignez le canal et le message avant validation."
          onClose={closeAvisModal}
        >
          <div style={{ display: "grid", gap: 16 }}>
            <Field label="Canal">
              <select
                value={avisForm.canal}
                onChange={(e) => setAvisForm((prev) => ({ ...prev, canal: e.target.value }))}
                style={input}
              >
                {CANAL_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Message">
              <textarea
                value={avisForm.message}
                onChange={(e) => setAvisForm((prev) => ({ ...prev, message: e.target.value }))}
                style={textarea}
                rows={5}
                placeholder="Message de l’avis"
              />
            </Field>

            {avisFormError ? <AlertBox kind="error">{avisFormError}</AlertBox> : null}

            <div style={modalActions}>
              <SmallButton onClick={closeAvisModal} disabled={busy === "avis"}>
                {APP_TEXT.common.cancel}
              </SmallButton>
              <SmallButton onClick={askConfirmAvis} primary disabled={busy === "avis"}>
                Continuer
              </SmallButton>
            </div>
          </div>
        </Modal>
      ) : null}

      {pendingAction === "relance" && dossier ? (
        <Modal
          title="Confirmer l’envoi de la relance"
          subtitle="Vérifiez les informations avant d’envoyer la relance."
          onClose={() => setPendingAction(null)}
        >
          <div style={{ display: "grid", gap: 14 }}>
            <div style={confirmBox}>
              <div style={confirmRow}>
                <strong>Canal :</strong> {getCanalLabel(relanceForm.canal)}
              </div>
              <div style={confirmRow}>
                <strong>Objet :</strong> {relanceForm.objet || "—"}
              </div>
              <div style={confirmRow}>
                <strong>Lot :</strong> {dossier.lot_numero || "—"}
              </div>
              <div style={confirmRow}>
                <strong>Copropriétaire :</strong> {dossier.coproprietaire_nom || "—"}
              </div>
              <div style={confirmRow}>
                <strong>Reste à payer :</strong> {formatMoneyFCFA(dossier.reste_a_payer)}
              </div>
              <div style={{ ...confirmRow, display: "block" }}>
                <strong>Message :</strong>
                <div style={{ marginTop: 8, whiteSpace: "pre-wrap", color: "#374151" }}>
                  {relanceForm.message}
                </div>
              </div>
            </div>

            <div style={modalActions}>
              <SmallButton onClick={() => setPendingAction(null)} disabled={busy === "relance"}>
                Retour
              </SmallButton>
              <SmallButton onClick={submitRelance} primary disabled={busy === "relance"}>
                {busy === "relance" ? "Envoi..." : "Confirmer l’envoi"}
              </SmallButton>
            </div>
          </div>
        </Modal>
      ) : null}

      {pendingAction === "avis" && dossier ? (
        <Modal
          title="Confirmer la génération de l’avis"
          subtitle="Vérifiez les informations avant de générer l’avis de régularisation."
          onClose={() => setPendingAction(null)}
        >
          <div style={{ display: "grid", gap: 14 }}>
            <div style={confirmBox}>
              <div style={confirmRow}>
                <strong>Canal :</strong> {getCanalLabel(avisForm.canal)}
              </div>
              <div style={confirmRow}>
                <strong>Lot :</strong> {dossier.lot_numero || "—"}
              </div>
              <div style={confirmRow}>
                <strong>Copropriétaire :</strong> {dossier.coproprietaire_nom || "—"}
              </div>
              <div style={confirmRow}>
                <strong>Montant réglé :</strong> {formatMoneyFCFA(dossier.montant_paye)}
              </div>
              <div style={{ ...confirmRow, display: "block" }}>
                <strong>Message :</strong>
                <div style={{ marginTop: 8, whiteSpace: "pre-wrap", color: "#374151" }}>
                  {avisForm.message}
                </div>
              </div>
            </div>

            <div style={modalActions}>
              <SmallButton onClick={() => setPendingAction(null)} disabled={busy === "avis"}>
                Retour
              </SmallButton>
              <SmallButton onClick={submitAvis} primary disabled={busy === "avis"}>
                {busy === "avis" ? "Génération..." : "Confirmer la génération"}
              </SmallButton>
            </div>
          </div>
        </Modal>
      ) : null}

      <style>{`
        .relances-detail-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px;
        }

        @media (max-width: 980px) {
          .relances-detail-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </PageShell>
  );
}

const pageShell: CSSProperties = {
  display: "grid",
  gap: 18,
};

const pageHeader: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
  alignItems: "flex-end",
};

const pageEyebrow: CSSProperties = {
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: 0.9,
  textTransform: "uppercase",
  color: "#6b7280",
};

const pageTitle: CSSProperties = {
  fontSize: 30,
  fontWeight: 900,
  color: "#111827",
  lineHeight: 1.1,
  letterSpacing: -0.5,
};

const pageSubtitle: CSSProperties = {
  marginTop: 6,
  color: "#6b7280",
  fontSize: 14,
  lineHeight: 1.55,
  maxWidth: 920,
};

const pageHeaderActions: CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
  alignItems: "center",
};

const detailGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 14,
};

const card: CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 22,
  padding: 18,
  background: "#ffffff",
  boxShadow: "0 10px 30px rgba(15, 23, 42, 0.04)",
};

const cardHeader: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 10,
  flexWrap: "wrap",
  marginBottom: 14,
  alignItems: "center",
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

const rowCard: CSSProperties = {
  border: "1px solid #eef2f7",
  borderRadius: 14,
  padding: 14,
  background: "#ffffff",
};

const keyValueRow: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "220px 1fr",
  gap: 12,
  padding: "10px 0",
  borderBottom: "1px solid #f3f4f6",
};

const keyValueLabel: CSSProperties = {
  fontSize: 13,
  fontWeight: 800,
  color: "#6b7280",
};

const keyValueValue: CSSProperties = {
  fontSize: 14,
  color: "#111827",
  lineHeight: 1.55,
};

const fieldLabel: CSSProperties = {
  fontSize: 13,
  fontWeight: 800,
  color: "#4b5563",
};

const fieldHelp: CSSProperties = {
  fontSize: 12,
  color: "#6b7280",
  lineHeight: 1.4,
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

const modalCard: CSSProperties = {
  width: "min(680px, 96vw)",
  background: "#ffffff",
  borderRadius: 24,
  padding: 22,
  border: "1px solid #e5e7eb",
  boxShadow: "0 24px 60px rgba(15, 23, 42, 0.18)",
  maxHeight: "92vh",
  overflowY: "auto",
};

const modalTitle: CSSProperties = {
  fontSize: 22,
  fontWeight: 900,
  color: "#111827",
  lineHeight: 1.2,
};

const modalSubtitle: CSSProperties = {
  fontSize: 14,
  color: "#6b7280",
  lineHeight: 1.55,
};

const input: CSSProperties = {
  width: "100%",
  padding: "12px 13px",
  borderRadius: 12,
  border: "1px solid #d1d5db",
  background: "#ffffff",
  color: "#111827",
  fontSize: 14,
  outline: "none",
  boxSizing: "border-box",
};

const textarea: CSSProperties = {
  ...input,
  resize: "vertical",
  minHeight: 120,
};

const confirmBox: CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 16,
  background: "#f8fafc",
  padding: 14,
  display: "grid",
  gap: 10,
};

const confirmRow: CSSProperties = {
  fontSize: 14,
  color: "#111827",
  lineHeight: 1.5,
};

const modalActions: CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  gap: 10,
  flexWrap: "wrap",
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
  lineHeight: 1.5,
};