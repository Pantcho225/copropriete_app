// frontend/src/pages/coproprietaire/CoproprietaireAssemblees.tsx
import { useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties, FormEvent, ReactNode } from "react";

import {
  consulterConvocationCoproprietaire,
  getAssembleesGeneralesCoproprietaire,
  getConvocationsCoproprietaire,
  type CoproprietaireAG,
  type CoproprietaireAGResponse,
  type CoproprietaireAgConvocation,
} from "../../api/coproprietaireAg";
import {
  annulerProcurationAgCoproprietaire,
  confirmerPresenceAgCoproprietaire,
  creerProcurationAgCoproprietaire,
  generateMandatAgCoproprietaire,
  getProcurationsAgCoproprietaire,
  voterResolutionAgCoproprietaire,
  type CoproprietairePresenceMode,
  type CoproprietaireProcurationItem,
  type CoproprietaireVoteChoix,
  type CoproprietaireVoteItem,
} from "../../api/coproprietaire";

type StatTone = "blue" | "green" | "amber" | "slate" | "indigo";
type StatusFilter =
  | ""
  | "CONVOQUEE"
  | "OUVERTE"
  | "CLOTUREE"
  | "ARCHIVEE"
  | "ANNULEE";
type FlashKind = "success" | "error" | "info";
type VoteTone = "green" | "rose" | "slate";

type VoteSummaryLike = {
  total?: number;
  par_choix?: Record<string, number>;
  votes?: CoproprietaireVoteItem[];
};

type CoproprietaireResolution = {
  id: number | string;
  ordre?: number | string | null;
  titre?: string;
  texte?: string;
  cloturee?: boolean;
  vote_summary?: VoteSummaryLike;
};

type PresenceItemLike = {
  present_ou_represente?: boolean;
  lot?: {
    id?: number | string | null;
    label?: string;
    reference?: string;
    numero?: string;
    type_lot?: string;
    etage?: string;
  } | null;
};

type PresenceSummaryLike = {
  status?: string;
  label?: string;
  items?: PresenceItemLike[];
};

type CoproprietaireAGWithResolutions = CoproprietaireAG & {
  pv_locked?: boolean;
  resolutions?: CoproprietaireResolution[];
  vote_summary?: VoteSummaryLike;
  presence_coproprietaire?: PresenceSummaryLike;
};

type ProcurationModalState = {
  ag: CoproprietaireAGWithResolutions;
  lot_id: string;
  mandataire_nom: string;
  mandataire_telephone: string;
  mandataire_email: string;
};

type LotOption = {
  id: number | string;
  label: string;
};

const emptyResponse: CoproprietaireAGResponse = {
  count: 0,
  stats: {
    total: 0,
    a_venir: 0,
    ouvertes: 0,
    cloturees: 0,
    pv_disponibles: 0,
  },
  assemblees: [],
};

const presenceModeLabels: Record<CoproprietairePresenceMode, string> = {
  PRESENT_PHYSIQUE: "Présent physiquement",
  PRESENT_EN_LIGNE: "Présent en ligne",
  REPRESENTE: "Représenté",
  ABSENT: "Absent",
};

const voteChoiceLabels: Record<CoproprietaireVoteChoix, string> = {
  POUR: "Pour",
  CONTRE: "Contre",
  ABSTENTION: "Abstention",
};

export default function CoproprietaireAssemblees() {
  const [data, setData] = useState<CoproprietaireAGResponse>(emptyResponse);
  const [procurations, setProcurations] = useState<
    CoproprietaireProcurationItem[]
  >([]);
  const [convocations, setConvocations] = useState<
    CoproprietaireAgConvocation[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<{ kind: FlashKind; text: string } | null>(
    null,
  );
  const [search, setSearch] = useState("");
  const [statut, setStatut] = useState<StatusFilter>("");
  const [generatingMandatAgId, setGeneratingMandatAgId] = useState<
    number | null
  >(null);
  const [presenceBusy, setPresenceBusy] = useState<{
    agId: number;
    mode: CoproprietairePresenceMode;
  } | null>(null);
  const [voteBusy, setVoteBusy] = useState<{
    resolutionId: number | string;
    choix: CoproprietaireVoteChoix;
  } | null>(null);
  const [localVotesByResolution, setLocalVotesByResolution] = useState<
    Record<string, CoproprietaireVoteItem>
  >({});
  const [procurationModal, setProcurationModal] =
    useState<ProcurationModalState | null>(null);
  const [creatingProcuration, setCreatingProcuration] = useState(false);
  const [cancelingProcurationId, setCancelingProcurationId] = useState<
    number | null
  >(null);
  const [consultingConvocationId, setConsultingConvocationId] = useState<
    number | null
  >(null);

  const loadAssemblees = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!options?.silent) {
        setLoading(true);
      }

      setError(null);

      try {
        const response = await getAssembleesGeneralesCoproprietaire({
          search: search.trim() || undefined,
          statut: statut || undefined,
        });

        setData(response);

        try {
          const procurationsResponse = await getProcurationsAgCoproprietaire();
          setProcurations(procurationsResponse.procurations ?? []);
        } catch {
          setProcurations([]);
        }

        try {
          const convocationsResponse = await getConvocationsCoproprietaire();
          setConvocations(convocationsResponse.convocations ?? []);
        } catch {
          setConvocations([]);
        }
      } catch {
        setError("Impossible de charger vos assemblées générales pour le moment.");
        setData(emptyResponse);
        setProcurations([]);
      } finally {
        if (!options?.silent) {
          setLoading(false);
        }
      }
    },
    [search, statut],
  );

  useEffect(() => {
    let mounted = true;

    async function run() {
      if (!mounted) return;
      await loadAssemblees();
    }

    void run();

    return () => {
      mounted = false;
    };
  }, [loadAssemblees]);

  const assemblees = useMemo(() => data.assemblees ?? [], [data.assemblees]);

  const procurationsByAg = useMemo(() => {
    return procurations.reduce<Record<string, CoproprietaireProcurationItem[]>>(
      (acc, procuration) => {
        const key = String(procuration.ag);

        if (!acc[key]) {
          acc[key] = [];
        }

        acc[key].push(procuration);
        return acc;
      },
      {},
    );
  }, [procurations]);

  const convocationsByAg = useMemo(() => {
    return convocations.reduce<Record<string, CoproprietaireAgConvocation[]>>(
      (acc, convocation) => {
        const key = String(convocation.ag);

        if (!acc[key]) {
          acc[key] = [];
        }

        acc[key].push(convocation);
        return acc;
      },
      {},
    );
  }, [convocations]);

  const pvDisponibles = useMemo(() => {
    return assemblees.filter((ag) => ag.has_pv).length;
  }, [assemblees]);

  const showFlash = useCallback((kind: FlashKind, text: string) => {
    setFlash({ kind, text });

    window.setTimeout(() => {
      setFlash((current) => (current?.text === text ? null : current));
    }, 5000);
  }, []);

  const handleOpenProcurationModal = useCallback(
    (ag: CoproprietaireAGWithResolutions) => {
      if (!canGiveProcuration(ag)) {
        showFlash(
          "info",
          "Le mandat de représentation est disponible uniquement pour une AG convoquée ou ouverte, non verrouillée.",
        );
        return;
      }

      const lotOptions = getPresenceLotOptions(ag);

      setProcurationModal({
        ag,
        lot_id: lotOptions.length === 1 ? String(lotOptions[0].id) : "",
        mandataire_nom: "",
        mandataire_telephone: "",
        mandataire_email: "",
      });
    },
    [showFlash],
  );

  const handleCloseProcurationModal = useCallback(() => {
    if (creatingProcuration) return;
    setProcurationModal(null);
  }, [creatingProcuration]);

  const handleChangeProcurationModal = useCallback(
    (field: keyof Omit<ProcurationModalState, "ag">, value: string) => {
      setProcurationModal((current) => {
        if (!current) return current;

        return {
          ...current,
          [field]: value,
        };
      });
    },
    [],
  );

  const handleSubmitProcuration = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      if (!procurationModal) return;

      const mandataireNom = procurationModal.mandataire_nom.trim();
      const mandataireTelephone =
        procurationModal.mandataire_telephone.trim();
      const mandataireEmail = procurationModal.mandataire_email.trim();
      const lotId = procurationModal.lot_id.trim();

      if (!mandataireNom) {
        showFlash("info", "Le nom complet du mandataire est obligatoire.");
        return;
      }

      try {
        setCreatingProcuration(true);

        const response = await creerProcurationAgCoproprietaire({
          ag_id: procurationModal.ag.id,
          lot_id: lotId || undefined,
          mandataire_nom: mandataireNom,
          mandataire_telephone: mandataireTelephone || undefined,
          mandataire_email: mandataireEmail || undefined,
        });

        showFlash(
          "success",
          `${toMandatWording(response.detail)} Statut : ${
            response.procuration.statut_label || response.procuration.statut
          }.`,
        );

        setProcurationModal(null);
        await loadAssemblees({ silent: true });
      } catch (err) {
        showFlash(
          "error",
          getErrorMessage(
            err,
            "Impossible d’enregistrer votre demande de mandat.",
          ),
        );
      } finally {
        setCreatingProcuration(false);
      }
    },
    [loadAssemblees, procurationModal, showFlash],
  );

  const handleCancelProcuration = useCallback(
    async (procuration: CoproprietaireProcurationItem) => {
      if (!canCancelProcuration(procuration)) {
        showFlash(
          "info",
          "Seuls les mandats en attente peuvent être annulés depuis votre espace.",
        );
        return;
      }

      const confirmed = window.confirm(
        `Annuler le mandat donné à ${procuration.mandataire_nom} ?`,
      );

      if (!confirmed) return;

      try {
        setCancelingProcurationId(procuration.id);

        const response = await annulerProcurationAgCoproprietaire(
          procuration.id,
        );

        showFlash("success", toMandatWording(response.detail));
        await loadAssemblees({ silent: true });
      } catch (err) {
        showFlash(
          "error",
          getErrorMessage(err, "Impossible d’annuler ce mandat."),
        );
      } finally {
        setCancelingProcurationId(null);
      }
    },
    [loadAssemblees, showFlash],
  );

  const handleConsultConvocation = useCallback(
    async (convocation: CoproprietaireAgConvocation) => {
      if (normalize(convocation.statut) === "ANNULEE") {
        showFlash(
          "info",
          "Cette convocation est annulée et ne peut plus être consultée.",
        );
        return;
      }

      if (normalize(convocation.statut) === "CONSULTEE") {
        showFlash("info", "Cette convocation a déjà été consultée.");
        return;
      }

      try {
        setConsultingConvocationId(convocation.id);

        const response = await consulterConvocationCoproprietaire(convocation.id);

        showFlash("success", response.detail);

        if (response.convocation.document_url) {
          openDocument(response.convocation.document_url);
        }

        await loadAssemblees({ silent: true });
      } catch (err) {
        showFlash(
          "error",
          getErrorMessage(err, "Impossible de consulter cette convocation."),
        );
      } finally {
        setConsultingConvocationId(null);
      }
    },
    [loadAssemblees, showFlash],
  );

  const handleGenerateMandat = useCallback(
    async (ag: CoproprietaireAG) => {
      if (!canGenerateMandat(ag)) {
        showFlash(
          "info",
          "Le mandat n’est disponible que pour les assemblées convoquées ou ouvertes.",
        );
        return;
      }

      const confirmed = window.confirm(
        "Télécharger votre mandat de représentation pré-rempli pour cette assemblée générale ?",
      );

      if (!confirmed) return;

      try {
        setGeneratingMandatAgId(ag.id);

        const response = await generateMandatAgCoproprietaire(ag.id);
        const fileUrl = response.document?.file_url || response.document?.file;

        showFlash(
          "success",
          `Mandat généré avec succès. Référence : ${
            response.document?.reference || "—"
          }.`,
        );

        if (fileUrl) {
          window.open(fileUrl, "_blank", "noopener,noreferrer");
        }

        await loadAssemblees({ silent: true });
      } catch (err) {
        showFlash(
          "error",
          getErrorMessage(
            err,
            "Impossible de générer votre mandat pour cette assemblée.",
          ),
        );
      } finally {
        setGeneratingMandatAgId(null);
      }
    },
    [loadAssemblees, showFlash],
  );

  const handleConfirmPresence = useCallback(
    async (ag: CoproprietaireAG, mode: CoproprietairePresenceMode) => {
      if (!canConfirmPresence(ag)) {
        showFlash(
          "info",
          "La confirmation de présence est disponible uniquement pour une AG convoquée ou ouverte.",
        );
        return;
      }

      if (mode === "REPRESENTE") {
        handleOpenProcurationModal(ag as CoproprietaireAGWithResolutions);
        return;
      }

      const label = presenceModeLabels[mode];

      const confirmed = window.confirm(
        mode === "ABSENT"
          ? "Confirmer que vous serez absent à cette assemblée générale ? Cela retirera vos tantièmes du calcul des présents sauf représentation ultérieure."
          : `Confirmer votre statut : ${label} ?`,
      );

      if (!confirmed) return;

      try {
        setPresenceBusy({ agId: ag.id, mode });

        const response = await confirmerPresenceAgCoproprietaire(ag.id, {
          mode_presence: mode,
        });

        showFlash(
          "success",
          `${response.mode_presence_label} confirmé avec succès. Quorum atteint : ${
            response.quorum.quorum_atteint ? "oui" : "non"
          }.`,
        );

        await loadAssemblees({ silent: true });
      } catch (err) {
        showFlash(
          "error",
          getErrorMessage(
            err,
            "Impossible de confirmer votre présence pour cette assemblée.",
          ),
        );
      } finally {
        setPresenceBusy(null);
      }
    },
    [handleOpenProcurationModal, loadAssemblees, showFlash],
  );

  const handleVoteResolution = useCallback(
    async (
      ag: CoproprietaireAGWithResolutions,
      resolution: CoproprietaireResolution,
      choix: CoproprietaireVoteChoix,
    ) => {
      if (!canVoteResolution(ag, resolution)) {
        showFlash(
          "info",
          "Le vote est disponible uniquement pour une AG ouverte, non verrouillée, avec une résolution encore active.",
        );
        return;
      }

      const existingVote = getExistingVoteForResolution(
        resolution,
        localVotesByResolution,
      );

      if (existingVote) {
        showFlash(
          "info",
          `Votre vote est déjà enregistré et verrouillé : ${
            existingVote.choix_label || existingVote.choix
          }.`,
        );
        return;
      }

      const lotId = getFirstPresenceLotId(ag);

      if (!lotId) {
        showFlash(
          "error",
          "Aucun lot présent ou représenté n’a été trouvé pour ce vote. Confirmez d’abord votre présence.",
        );
        return;
      }

      const confirmed = window.confirm(
        `Confirmer votre vote "${voteChoiceLabels[choix]}" pour cette résolution ? Une fois enregistré, le vote sera verrouillé.`,
      );

      if (!confirmed) return;

      try {
        setVoteBusy({ resolutionId: resolution.id, choix });

        const response = await voterResolutionAgCoproprietaire(resolution.id, {
          lot_id: lotId,
          choix,
        });

        setLocalVotesByResolution((current) => ({
          ...current,
          [String(resolution.id)]: response.vote,
        }));

        showFlash(
          "success",
          `${response.detail} Choix : ${
            response.vote.choix_label || response.vote.choix
          }.`,
        );

        await loadAssemblees({ silent: true });
      } catch (err) {
        showFlash(
          "error",
          getErrorMessage(
            err,
            "Impossible d’enregistrer votre vote pour cette résolution.",
          ),
        );
      } finally {
        setVoteBusy(null);
      }
    },
    [loadAssemblees, localVotesByResolution, showFlash],
  );

  if (loading) {
    return (
      <div style={styles.loadingCard}>
        <div style={styles.loadingIcon}>🗳️</div>
        <div>
          <p style={styles.loadingTitle}>Chargement de vos assemblées...</p>
          <p style={styles.muted}>
            Nous récupérons les assemblées générales accessibles à vos lots.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.stack}>
      <section style={styles.hero}>
        <div style={styles.heroContent}>
          <div style={styles.heroBadge}>Vie de la copropriété</div>

          <h2 style={styles.heroTitle}>Vos assemblées générales</h2>

          <p style={styles.heroText}>
            Consultez les assemblées accessibles à vos lots : convocations,
            quorum, présence, résolutions, votes, mandats de représentation et
            procès-verbaux disponibles.
          </p>

          <div style={styles.heroMeta}>
            <span style={styles.metaPill}>
              Total : {formatNumber(data.stats.total)}
            </span>
            <span style={styles.metaPill}>
              Ouvertes : {formatNumber(data.stats.ouvertes)}
            </span>
            <span style={styles.metaPill}>
              PV disponibles : {formatNumber(data.stats.pv_disponibles)}
            </span>
          </div>
        </div>

        <div style={styles.secureBox}>
          <div style={styles.secureIcon}>🔐</div>
          <p style={styles.secureTitle}>Accès sécurisé</p>
          <p style={styles.secureText}>
            Les données sont filtrées automatiquement selon votre compte
            copropriétaire et les lots qui vous sont rattachés. Les votes sont
            uniques, verrouillés et tracés.
          </p>
        </div>
      </section>

      {flash ? <FlashBox kind={flash.kind}>{flash.text}</FlashBox> : null}

      <section style={styles.statsGrid}>
        <StatCard
          label="Total"
          value={data.stats.total}
          hint="Assemblées visibles"
          tone="blue"
        />
        <StatCard
          label="À venir"
          value={data.stats.a_venir}
          hint="Convocations"
          tone="amber"
        />
        <StatCard
          label="Ouvertes"
          value={data.stats.ouvertes}
          hint="Sessions en cours"
          tone="indigo"
        />
        <StatCard
          label="Clôturées"
          value={data.stats.cloturees}
          hint="AG finalisées"
          tone="green"
        />
        <StatCard
          label="PV"
          value={pvDisponibles || data.stats.pv_disponibles}
          hint="Documents disponibles"
          tone="slate"
        />
      </section>

      <section style={styles.card}>
        <div style={styles.sectionHeader}>
          <div>
            <p style={styles.sectionEyebrow}>Assemblées</p>
            <h3 style={styles.sectionTitle}>Liste de vos assemblées générales</h3>
            <p style={styles.sectionText}>
              Recherchez une assemblée par titre, lieu ou statut. Vous pouvez
              confirmer votre présence, participer en ligne, donner un mandat,
              voter sur les résolutions ouvertes, ouvrir le procès-verbal
              lorsqu’il est disponible et télécharger votre mandat pour les AG
              encore actives.
            </p>
          </div>

          <div style={styles.resultPill}>
            {formatNumber(assemblees.length)} résultat(s)
          </div>
        </div>

        <div style={styles.filters}>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Rechercher une assemblée, un lieu, un objet..."
            style={styles.input}
          />

          <select
            value={statut}
            onChange={(event) => setStatut(event.target.value as StatusFilter)}
            style={styles.select}
          >
            <option value="">Tous les statuts</option>
            <option value="CONVOQUEE">Convoquée</option>
            <option value="OUVERTE">Ouverte</option>
            <option value="CLOTUREE">Clôturée</option>
            <option value="ARCHIVEE">Archivée</option>
            <option value="ANNULEE">Annulée</option>
          </select>
        </div>

        {error ? <div style={styles.error}>{error}</div> : null}

        {!error && assemblees.length === 0 ? (
          <EmptyState
            title="Aucune assemblée générale accessible"
            text="Aucune assemblée générale n’est actuellement rattachée à vos lots ou visible depuis votre espace copropriétaire."
          />
        ) : null}

        {!error && assemblees.length > 0 ? (
          <div style={styles.list}>
            {assemblees.map((ag) => {
              const agTyped = ag as CoproprietaireAGWithResolutions;

              return (
                <AGCard
                  key={ag.id}
                  ag={agTyped}
                  procurations={procurationsByAg[String(ag.id)] ?? []}
                  convocations={convocationsByAg[String(ag.id)] ?? []}
                  generatingMandat={generatingMandatAgId === ag.id}
                  presenceBusy={
                    presenceBusy?.agId === ag.id ? presenceBusy.mode : null
                  }
                  voteBusy={voteBusy}
                  localVotesByResolution={localVotesByResolution}
                  cancelingProcurationId={cancelingProcurationId}
                  consultingConvocationId={consultingConvocationId}
                  onGenerateMandat={handleGenerateMandat}
                  onConfirmPresence={handleConfirmPresence}
                  onOpenProcuration={handleOpenProcurationModal}
                  onCancelProcuration={handleCancelProcuration}
                  onConsultConvocation={handleConsultConvocation}
                  onVoteResolution={handleVoteResolution}
                />
              );
            })}
          </div>
        ) : null}
      </section>

      {procurationModal ? (
        <ProcurationModal
          state={procurationModal}
          creating={creatingProcuration}
          onChange={handleChangeProcurationModal}
          onClose={handleCloseProcurationModal}
          onSubmit={handleSubmitProcuration}
        />
      ) : null}
    </div>
  );
}

function AGCard({
  ag,
  procurations,
  convocations,
  generatingMandat,
  presenceBusy,
  voteBusy,
  localVotesByResolution,
  cancelingProcurationId,
  consultingConvocationId,
  onGenerateMandat,
  onConfirmPresence,
  onOpenProcuration,
  onCancelProcuration,
  onConsultConvocation,
  onVoteResolution,
}: {
  ag: CoproprietaireAGWithResolutions;
  procurations: CoproprietaireProcurationItem[];
  convocations: CoproprietaireAgConvocation[];
  generatingMandat: boolean;
  presenceBusy: CoproprietairePresenceMode | null;
  voteBusy: {
    resolutionId: number | string;
    choix: CoproprietaireVoteChoix;
  } | null;
  localVotesByResolution: Record<string, CoproprietaireVoteItem>;
  cancelingProcurationId: number | null;
  consultingConvocationId: number | null;
  onGenerateMandat: (ag: CoproprietaireAG) => void;
  onConfirmPresence: (
    ag: CoproprietaireAG,
    mode: CoproprietairePresenceMode,
  ) => void;
  onOpenProcuration: (ag: CoproprietaireAGWithResolutions) => void;
  onCancelProcuration: (procuration: CoproprietaireProcurationItem) => void;
  onConsultConvocation: (convocation: CoproprietaireAgConvocation) => void;
  onVoteResolution: (
    ag: CoproprietaireAGWithResolutions,
    resolution: CoproprietaireResolution,
    choix: CoproprietaireVoteChoix,
  ) => void;
}) {
  const pvUrl = ag.pv_signed_url || ag.pv_url;
  const presence = ag.presence_coproprietaire;
  const votesTotal = ag.vote_summary?.total ?? 0;
  const mandatAvailable = canGenerateMandat(ag);
  const procurationAvailable = canGiveProcuration(ag);
  const presenceAvailable = canConfirmPresence(ag);
  const presenceDisabled = !presenceAvailable || presenceBusy !== null;
  const resolutions = Array.isArray(ag.resolutions) ? ag.resolutions : [];
  const hasActiveProcuration = procurations.some((item) =>
    ["EN_ATTENTE", "VALIDEE"].includes(normalize(item.statut)),
  );

  return (
    <article style={styles.agCard}>
      <div style={styles.agHeader}>
        <div style={styles.agMain}>
          <div style={styles.badges}>
            <Badge style={getStatusStyle(ag.statut)}>
              {ag.statut_label || ag.statut || "Statut non défini"}
            </Badge>

            <Badge style={getQuorumStyle(ag.quorum_atteint)}>
              {getQuorumLabel(ag.quorum_atteint)}
            </Badge>

            <Badge style={getPresenceStyle(presence?.status)}>
              {presence?.label || "Présence non renseignée"}
            </Badge>
          </div>

          <h4 style={styles.agTitle}>{ag.titre}</h4>

          <div style={styles.agMeta}>
            <span>{formatDate(ag.date_ag)}</span>
            {ag.lieu ? <span>Lieu : {ag.lieu}</span> : null}
          </div>

          <p style={styles.description}>
            {ag.description ||
              "Aucun ordre du jour détaillé n’est disponible pour cette assemblée."}
          </p>

          <ConvocationsPanel
            convocations={convocations}
            consultingConvocationId={consultingConvocationId}
            onConsult={onConsultConvocation}
          />

          <div style={styles.presenceBox}>
            <p style={styles.presenceBoxTitle}>Ma présence à cette AG</p>
            <p style={styles.presenceBoxText}>
              Déclarez votre participation depuis votre espace copropriétaire.
              Le mandat de représentation suit désormais un circuit de demande
              et validation par le syndic avant impact définitif sur la présence.
            </p>

            <div style={styles.presenceActionsGrid}>
              <PresenceButton
                label="Présent physique"
                mode="PRESENT_PHYSIQUE"
                busyMode={presenceBusy}
                disabled={presenceDisabled}
                tone="green"
                onClick={() => onConfirmPresence(ag, "PRESENT_PHYSIQUE")}
              />
              <PresenceButton
                label="Présent en ligne"
                mode="PRESENT_EN_LIGNE"
                busyMode={presenceBusy}
                disabled={presenceDisabled}
                tone="blue"
                onClick={() => onConfirmPresence(ag, "PRESENT_EN_LIGNE")}
              />
              <PresenceButton
                label="Absent"
                mode="ABSENT"
                busyMode={presenceBusy}
                disabled={presenceDisabled}
                tone="amber"
                onClick={() => onConfirmPresence(ag, "ABSENT")}
              />
              <PresenceButton
                label={hasActiveProcuration ? "Mandat créé" : "Donner un mandat"}
                mode="REPRESENTE"
                busyMode={presenceBusy}
                disabled={!procurationAvailable || presenceBusy !== null}
                tone="indigo"
                onClick={() => onOpenProcuration(ag)}
              />
            </div>

            {!presenceAvailable ? (
              <p style={styles.presenceUnavailableText}>
                La confirmation de présence est indisponible pour une AG
                clôturée, archivée, annulée ou verrouillée.
              </p>
            ) : null}
          </div>

          <ProcurationsPanel
            procurations={procurations}
            cancelingProcurationId={cancelingProcurationId}
            onCancel={onCancelProcuration}
          />

          <div style={styles.voteBox}>
            <div style={styles.voteBoxHeader}>
              <div>
                <p style={styles.voteBoxTitle}>Mes votes sur les résolutions</p>
                <p style={styles.voteBoxText}>
                  Les résolutions peuvent être consultées avant l’AG lorsqu’elles
                  sont disponibles. Le vote en ligne ne s’ouvre qu’une fois l’AG
                  officiellement ouverte. Chaque vote est unique, verrouillé et
                  tracé.
                </p>
              </div>

              <Badge
                style={canVoteAg(ag) ? styles.voteOpenBadge : styles.voteClosedBadge}
              >
                {canVoteAg(ag) ? "Vote ouvert" : "Vote indisponible"}
              </Badge>
            </div>

            {resolutions.length === 0 ? (
              <p style={styles.voteUnavailableText}>
                Aucune résolution n’est actuellement affichée pour cette
                assemblée. Les résolutions préparées avant convocation
                apparaîtront ici en consultation lorsqu’elles seront disponibles ;
                le vote restera fermé tant que l’AG n’est pas officiellement
                ouverte.
              </p>
            ) : (
              <div style={styles.resolutionsList}>
                {resolutions.map((resolution) => {
                  const existingVote = getExistingVoteForResolution(
                    resolution,
                    localVotesByResolution,
                  );
                  const voteAvailable =
                    canVoteResolution(ag, resolution) && !existingVote;
                  const resolutionBusy =
                    voteBusy?.resolutionId === resolution.id
                      ? voteBusy.choix
                      : null;

                  return (
                    <div key={String(resolution.id)} style={styles.resolutionCard}>
                      <div style={styles.resolutionHeader}>
                        <div>
                          <p style={styles.resolutionTitle}>
                            {formatResolutionTitle(resolution)}
                          </p>

                          {resolution.texte ? (
                            <p style={styles.resolutionText}>{resolution.texte}</p>
                          ) : null}
                        </div>

                        <Badge
                          style={
                            resolution.cloturee
                              ? styles.resolutionClosedBadge
                              : styles.resolutionOpenBadge
                          }
                        >
                          {resolution.cloturee ? "Clôturée" : "Active"}
                        </Badge>
                      </div>

                      {existingVote ? (
                        <div style={styles.voteResult}>
                          <span style={styles.voteResultIcon}>✅</span>
                          <span>
                            Vote enregistré et verrouillé :{" "}
                            <strong>
                              {existingVote.choix_label || existingVote.choix}
                            </strong>
                          </span>
                        </div>
                      ) : null}

                      <div style={styles.voteActionsGrid}>
                        <VoteButton
                          label="Pour"
                          choix="POUR"
                          tone="green"
                          busyChoice={resolutionBusy}
                          disabled={!voteAvailable || resolutionBusy !== null}
                          onClick={() => onVoteResolution(ag, resolution, "POUR")}
                        />
                        <VoteButton
                          label="Contre"
                          choix="CONTRE"
                          tone="rose"
                          busyChoice={resolutionBusy}
                          disabled={!voteAvailable || resolutionBusy !== null}
                          onClick={() => onVoteResolution(ag, resolution, "CONTRE")}
                        />
                        <VoteButton
                          label="Abstention"
                          choix="ABSTENTION"
                          tone="slate"
                          busyChoice={resolutionBusy}
                          disabled={!voteAvailable || resolutionBusy !== null}
                          onClick={() =>
                            onVoteResolution(ag, resolution, "ABSTENTION")
                          }
                        />
                      </div>

                      {!voteAvailable && !existingVote ? (
                        <p style={styles.voteUnavailableText}>
                          Vote indisponible : le vote s’ouvre uniquement lorsque
                          l’AG est officiellement ouverte, avec une résolution
                          active, un PV non verrouillé et une présence ou
                          représentation confirmée.
                        </p>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div style={styles.agActions}>
          <button
            type="button"
            disabled={!pvUrl}
            onClick={() => openDocument(pvUrl)}
            style={{
              ...styles.pvButton,
              ...(!pvUrl ? styles.pvButtonDisabled : {}),
            }}
          >
            {pvUrl ? "Ouvrir le PV" : "PV indisponible"}
          </button>

          <button
            type="button"
            disabled={!mandatAvailable || generatingMandat}
            onClick={() => onGenerateMandat(ag)}
            title={
              mandatAvailable
                ? "Télécharger votre mandat de représentation pré-rempli"
                : "Mandat indisponible pour une AG clôturée, archivée ou annulée"
            }
            style={{
              ...styles.mandatButton,
              ...(!mandatAvailable || generatingMandat
                ? styles.mandatButtonDisabled
                : {}),
            }}
          >
            {generatingMandat ? "Génération..." : "Télécharger mon mandat"}
          </button>

          <button
            type="button"
            disabled={!procurationAvailable}
            onClick={() => onOpenProcuration(ag)}
            style={{
              ...styles.procurationMainButton,
              ...(!procurationAvailable
                ? styles.procurationMainButtonDisabled
                : {}),
            }}
          >
            Donner un mandat
          </button>

          {ag.has_pv ? (
            <span style={styles.pvHint}>
              {ag.pv_signed_url ? "PV signé disponible" : "PV disponible"}
            </span>
          ) : (
            <span style={styles.pvHintMuted}>Aucun PV disponible</span>
          )}

          <span style={mandatAvailable ? styles.mandatHint : styles.mandatHintMuted}>
            {mandatAvailable
              ? "Mandat PDF disponible"
              : "Mandat indisponible pour cette AG"}
          </span>
        </div>
      </div>

      <div style={styles.cardStats}>
        <SmallStat label="Résolutions" value={formatNumber(ag.total_resolutions)} />
        <SmallStat label="Mes votes" value={formatNumber(votesTotal)} />
        <SmallStat label="Convocations" value={formatNumber(convocations.length)} />
        <SmallStat label="Mandats" value={formatNumber(procurations.length)} />
      </div>
    </article>
  );
}


function ConvocationsPanel({
  convocations,
  consultingConvocationId,
  onConsult,
}: {
  convocations: CoproprietaireAgConvocation[];
  consultingConvocationId: number | null;
  onConsult: (convocation: CoproprietaireAgConvocation) => void;
}) {
  const orderedConvocations = [...convocations].sort((a, b) => {
    const versionDelta = Number(b.version ?? 1) - Number(a.version ?? 1);

    if (versionDelta !== 0) {
      return versionDelta;
    }

    return String(b.generated_at || b.created_at || "").localeCompare(
      String(a.generated_at || a.created_at || ""),
    );
  });

  return (
    <div style={styles.convocationBox}>
      <div style={styles.convocationHeader}>
        <div>
          <p style={styles.convocationTitle}>Mes convocations pour cette AG</p>
          <p style={styles.convocationText}>
            Retrouvez ici votre convocation initiale, les éventuelles
            rectificatives, le motif de correction, le PDF et le statut de
            consultation transmis au syndic.
          </p>
        </div>

        <Badge style={styles.convocationCountBadge}>
          {formatNumber(convocations.length)}
        </Badge>
      </div>

      {orderedConvocations.length === 0 ? (
        <p style={styles.convocationEmpty}>
          Aucune convocation personnelle n’est encore rattachée à cette
          assemblée.
        </p>
      ) : (
        <div style={styles.convocationList}>
          {orderedConvocations.map((convocation) => {
            const isConsulted = normalize(convocation.statut) === "CONSULTEE";
            const isCanceled = normalize(convocation.statut) === "ANNULEE";
            const consulting = consultingConvocationId === convocation.id;
            const isRectificative = Boolean(convocation.is_rectificative);
            const parentReference =
              convocation.parent_convocation_reference ||
              convocation.parent_reference ||
              "";
            const versionLabel = convocation.version
              ? `v${convocation.version}`
              : "version non précisée";

            return (
              <div
                key={convocation.id}
                style={{
                  ...styles.convocationItem,
                  ...(isRectificative ? styles.convocationItemRectificative : {}),
                }}
              >
                <div style={styles.convocationItemMain}>
                  <div style={styles.convocationItemHeader}>
                    <div>
                      <p style={styles.convocationName}>
                        {convocation.reference || "Convocation sans référence"}
                      </p>

                      <div style={styles.convocationBadges}>
                        <Badge
                          style={
                            isRectificative
                              ? styles.convocationRectificativeBadge
                              : styles.convocationInitialBadge
                          }
                        >
                          {isRectificative
                            ? `Rectificative ${versionLabel}`
                            : "Convocation initiale"}
                        </Badge>

                        <Badge style={getConvocationStatusStyle(convocation.statut)}>
                          {convocation.statut_label || convocation.statut}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  {isRectificative ? (
                    <div style={styles.convocationRectificativeNotice}>
                      <strong>Rectificative :</strong>{" "}
                      {convocation.motif_rectification ||
                        "motif de rectification non renseigné."}
                      {parentReference ? (
                        <span style={styles.convocationParentReference}>
                          {" "}
                          Convocation remplacée : {parentReference}
                        </span>
                      ) : null}
                    </div>
                  ) : null}

                  <p style={styles.convocationDetails}>
                    Lot :{" "}
                    {convocation.lot_label ||
                      convocation.lot_reference ||
                      convocation.lot_numero ||
                      "—"}
                  </p>

                  <p style={styles.convocationDetails}>
                    Canal : {convocation.canal_label || convocation.canal || "—"}
                  </p>

                  <p style={styles.convocationDetails}>
                    Générée le {formatDate(convocation.generated_at)}
                  </p>

                  {convocation.sent_at ? (
                    <p style={styles.convocationDetails}>
                      Envoyée le {formatDate(convocation.sent_at)}
                    </p>
                  ) : null}

                  {convocation.consulted_at ? (
                    <p style={styles.convocationDetails}>
                      Consultée le {formatDate(convocation.consulted_at)}
                    </p>
                  ) : null}

                  {convocation.message ? (
                    <p style={styles.convocationMessage}>
                      {convocation.message}
                    </p>
                  ) : null}
                </div>

                <div style={styles.convocationActions}>
                  {convocation.document_url ? (
                    <button
                      type="button"
                      onClick={() => openDocument(convocation.document_url)}
                      style={styles.convocationDocButton}
                    >
                      Ouvrir le PDF
                    </button>
                  ) : (
                    <span style={styles.convocationPdfMissing}>
                      PDF non encore généré
                    </span>
                  )}

                  <button
                    type="button"
                    disabled={isConsulted || isCanceled || consulting}
                    onClick={() => onConsult(convocation)}
                    style={{
                      ...styles.convocationConsultButton,
                      ...(isConsulted || isCanceled || consulting
                        ? styles.convocationConsultButtonDisabled
                        : {}),
                    }}
                  >
                    {consulting
                      ? "Consultation..."
                      : isConsulted
                        ? "Déjà consultée"
                        : "Marquer consultée"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}


function ProcurationsPanel({
  procurations,
  cancelingProcurationId,
  onCancel,
}: {
  procurations: CoproprietaireProcurationItem[];
  cancelingProcurationId: number | null;
  onCancel: (procuration: CoproprietaireProcurationItem) => void;
}) {
  return (
    <div style={styles.procurationBox}>
      <div style={styles.procurationHeader}>
        <div>
          <p style={styles.procurationTitle}>Mes mandats pour cette AG</p>
          <p style={styles.procurationText}>
            Suivez les mandats transmis au syndic : en attente, validés, rejetés
            ou annulés.
          </p>
        </div>

        <Badge style={styles.procurationCountBadge}>
          {formatNumber(procurations.length)}
        </Badge>
      </div>

      {procurations.length === 0 ? (
        <p style={styles.procurationEmpty}>
          Aucun mandat enregistré pour cette assemblée.
        </p>
      ) : (
        <div style={styles.procurationList}>
          {procurations.map((procuration) => {
            const canCancel = canCancelProcuration(procuration);
            const canceling = cancelingProcurationId === procuration.id;

            return (
              <div key={procuration.id} style={styles.procurationItem}>
                <div style={styles.procurationItemMain}>
                  <div style={styles.procurationItemHeader}>
                    <p style={styles.procurationName}>
                      {procuration.mandataire_nom || "Mandataire non renseigné"}
                    </p>

                    <Badge style={getProcurationStatusStyle(procuration.statut)}>
                      {procuration.statut_label || procuration.statut}
                    </Badge>
                  </div>

                  <p style={styles.procurationDetails}>
                    Lot : {procuration.lot_label || procuration.lot_reference || "—"}
                  </p>

                  {procuration.mandataire_telephone ? (
                    <p style={styles.procurationDetails}>
                      Téléphone : {procuration.mandataire_telephone}
                    </p>
                  ) : null}

                  {procuration.mandataire_email ? (
                    <p style={styles.procurationDetails}>
                      Email : {procuration.mandataire_email}
                    </p>
                  ) : null}

                  {procuration.motif_rejet ? (
                    <p style={styles.procurationRejectReason}>
                      Motif du rejet : {procuration.motif_rejet}
                    </p>
                  ) : null}

                  <p style={styles.procurationDate}>
                    Créée le {formatDate(procuration.created_at)}
                  </p>
                </div>

                <div style={styles.procurationActions}>
                  {procuration.document_url ? (
                    <button
                      type="button"
                      onClick={() => openDocument(procuration.document_url)}
                      style={styles.procurationDocButton}
                    >
                      Ouvrir le document
                    </button>
                  ) : null}

                  <button
                    type="button"
                    disabled={!canCancel || canceling}
                    onClick={() => onCancel(procuration)}
                    style={{
                      ...styles.cancelProcurationButton,
                      ...(!canCancel || canceling
                        ? styles.cancelProcurationButtonDisabled
                        : {}),
                    }}
                  >
                    {canceling ? "Annulation..." : "Annuler"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ProcurationModal({
  state,
  creating,
  onChange,
  onClose,
  onSubmit,
}: {
  state: ProcurationModalState;
  creating: boolean;
  onChange: (
    field: keyof Omit<ProcurationModalState, "ag">,
    value: string,
  ) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const lotOptions = getPresenceLotOptions(state.ag);

  return (
    <div style={styles.modalBackdrop}>
      <div style={styles.modalCard}>
        <div style={styles.modalHeader}>
          <div>
            <p style={styles.modalEyebrow}>Mandat AG</p>
            <h3 style={styles.modalTitle}>Donner un mandat</h3>
            <p style={styles.modalText}>
              Désignez le mandataire qui vous représentera pour{" "}
              <strong>{state.ag.titre}</strong>. La demande sera transmise au
              syndic pour validation.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={creating}
            style={styles.modalCloseButton}
          >
            ×
          </button>
        </div>

        <form onSubmit={onSubmit} style={styles.modalForm}>
          {lotOptions.length > 0 ? (
            <label style={styles.fieldGroup}>
              <span style={styles.label}>Lot concerné</span>
              <select
                value={state.lot_id}
                onChange={(event) => onChange("lot_id", event.target.value)}
                style={styles.formSelect}
                disabled={creating}
              >
                <option value="">Sélection automatique si un seul lot actif</option>
                {lotOptions.map((lot) => (
                  <option key={String(lot.id)} value={String(lot.id)}>
                    {lot.label}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <p style={styles.helperText}>
              Aucun lot n’est encore listé dans les présences de cette AG. Si
              votre compte ne possède qu’un seul lot actif, il sera associé
              automatiquement par le backend.
            </p>
          )}

          <label style={styles.fieldGroup}>
            <span style={styles.label}>Nom complet du mandataire *</span>
            <input
              value={state.mandataire_nom}
              onChange={(event) => onChange("mandataire_nom", event.target.value)}
              placeholder="Ex. Kouamé Jean"
              style={styles.formInput}
              disabled={creating}
              required
            />
          </label>

          <label style={styles.fieldGroup}>
            <span style={styles.label}>Téléphone du mandataire</span>
            <input
              value={state.mandataire_telephone}
              onChange={(event) =>
                onChange("mandataire_telephone", event.target.value)
              }
              placeholder="Ex. +225 07 00 00 00 00"
              style={styles.formInput}
              disabled={creating}
            />
          </label>

          <label style={styles.fieldGroup}>
            <span style={styles.label}>Email du mandataire</span>
            <input
              value={state.mandataire_email}
              onChange={(event) =>
                onChange("mandataire_email", event.target.value)
              }
              placeholder="Ex. mandataire@email.com"
              type="email"
              style={styles.formInput}
              disabled={creating}
            />
          </label>

          <p style={styles.helperText}>
            Après enregistrement, le mandat sera en attente. Il ne sera pris en
            compte dans les présences qu’après validation par le syndic.
          </p>

          <div style={styles.modalActions}>
            <button
              type="button"
              onClick={onClose}
              disabled={creating}
              style={styles.secondaryButton}
            >
              Annuler
            </button>

            <button
              type="submit"
              disabled={creating}
              style={{
                ...styles.primaryButton,
                ...(creating ? styles.primaryButtonDisabled : {}),
              }}
            >
              {creating ? "Enregistrement..." : "Envoyer le mandat"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function PresenceButton({
  label,
  mode,
  busyMode,
  disabled,
  tone,
  onClick,
}: {
  label: string;
  mode: CoproprietairePresenceMode;
  busyMode: CoproprietairePresenceMode | null;
  disabled: boolean;
  tone: "green" | "blue" | "amber" | "indigo";
  onClick: () => void;
}) {
  const toneStyle = presenceButtonTones[tone];
  const isBusy = busyMode === mode;

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      style={{
        ...styles.presenceButton,
        borderColor: disabled ? "#e2e8f0" : toneStyle.border,
        background: disabled ? "#f8fafc" : toneStyle.background,
        color: disabled ? "#94a3b8" : toneStyle.color,
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      {isBusy ? "Validation..." : label}
    </button>
  );
}

function VoteButton({
  label,
  choix,
  busyChoice,
  disabled,
  tone,
  onClick,
}: {
  label: string;
  choix: CoproprietaireVoteChoix;
  busyChoice: CoproprietaireVoteChoix | null;
  disabled: boolean;
  tone: VoteTone;
  onClick: () => void;
}) {
  const toneStyle = voteButtonTones[tone];
  const isBusy = busyChoice === choix;

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      style={{
        ...styles.voteButton,
        borderColor: disabled ? "#e2e8f0" : toneStyle.border,
        background: disabled ? "#f8fafc" : toneStyle.background,
        color: disabled ? "#94a3b8" : toneStyle.color,
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      {isBusy ? "Enregistrement..." : label}
    </button>
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
  tone: StatTone;
}) {
  const toneStyle = statTones[tone];

  return (
    <div
      style={{
        ...styles.statCard,
        borderColor: toneStyle.border,
        background: toneStyle.background,
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

function SmallStat({ label, value }: { label: string; value: string }) {
  return (
    <div style={styles.smallStat}>
      <p style={styles.smallStatLabel}>{label}</p>
      <p style={styles.smallStatValue}>{value}</p>
    </div>
  );
}

function Badge({
  children,
  style,
}: {
  children: ReactNode;
  style: CSSProperties;
}) {
  return <span style={{ ...styles.badge, ...style }}>{children}</span>;
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
      <div style={styles.emptyIcon}>🗳️</div>
      <p style={styles.emptyTitle}>{title}</p>
      <p style={styles.emptyText}>{text}</p>
    </div>
  );
}

function getErrorMessage(error: unknown, fallback: string): string {
  const err = error as {
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

  const data = err.response?.data;

  if (typeof data?.detail === "string" && data.detail.trim()) {
    return data.detail;
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

function formatDate(value: string | null): string {
  if (!value) return "Date non renseignée";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Date non renseignée";

  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatNumber(value: number | string | null | undefined) {
  const numberValue = Number(value || 0);

  return new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: 0,
  }).format(numberValue);
}

function normalize(value: string | null | undefined): string {
  return String(value ?? "").trim().toUpperCase();
}

function toMandatWording(value: string): string {
  return value
    .replace(/Procurations/g, "Mandats")
    .replace(/procurations/g, "mandats")
    .replace(/Procuration/g, "Mandat")
    .replace(/procuration/g, "mandat");
}

function canGenerateMandat(ag: CoproprietaireAG): boolean {
  const value = normalize(ag.statut);

  return ![
    "CLOTUREE",
    "CLÔTURÉE",
    "ARCHIVEE",
    "ARCHIVÉE",
    "ANNULEE",
    "ANNULÉE",
  ].includes(value);
}

function canConfirmPresence(ag: CoproprietaireAG): boolean {
  const value = normalize(ag.statut);
  const pvLocked = (ag as { pv_locked?: boolean }).pv_locked === true;

  return ["CONVOQUEE", "CONVOQUÉE", "OUVERTE"].includes(value) && !pvLocked;
}

function canGiveProcuration(ag: CoproprietaireAG): boolean {
  const value = normalize(ag.statut);
  const pvLocked = (ag as { pv_locked?: boolean }).pv_locked === true;

  return ["CONVOQUEE", "CONVOQUÉE", "OUVERTE"].includes(value) && !pvLocked;
}

function canCancelProcuration(
  procuration: CoproprietaireProcurationItem,
): boolean {
  return normalize(procuration.statut) === "EN_ATTENTE";
}

function getPresenceItems(
  ag: CoproprietaireAGWithResolutions,
): PresenceItemLike[] {
  const presence = ag.presence_coproprietaire;

  return Array.isArray(presence?.items) ? presence.items : [];
}

function getPresenceLotOptions(
  ag: CoproprietaireAGWithResolutions,
): LotOption[] {
  const items = getPresenceItems(ag);
  const seen = new Set<string>();
  const options: LotOption[] = [];

  for (const item of items) {
    const id = item.lot?.id;

    if (id == null) continue;

    const key = String(id);

    if (seen.has(key)) continue;

    seen.add(key);

    options.push({
      id,
      label:
        item.lot?.label ||
        item.lot?.reference ||
        item.lot?.numero ||
        `Lot #${String(id)}`,
    });
  }

  return options;
}

function canVoteAg(ag: CoproprietaireAGWithResolutions): boolean {
  const value = normalize(ag.statut);
  const pvLocked = ag.pv_locked === true;
  const hasActivePresence = hasPresentOrRepresentedLot(ag);

  return value === "OUVERTE" && !pvLocked && hasActivePresence;
}

function canVoteResolution(
  ag: CoproprietaireAGWithResolutions,
  resolution: CoproprietaireResolution,
): boolean {
  return canVoteAg(ag) && resolution.cloturee !== true;
}

function hasPresentOrRepresentedLot(
  ag: CoproprietaireAGWithResolutions,
): boolean {
  const items = getPresenceItems(ag);

  return items.some((item: PresenceItemLike) => {
    return item.present_ou_represente === true && item.lot?.id != null;
  });
}

function getFirstPresenceLotId(
  ag: CoproprietaireAGWithResolutions,
): number | string | null {
  const items = getPresenceItems(ag);

  const item = items.find((entry: PresenceItemLike) => {
    return entry.present_ou_represente === true && entry.lot?.id != null;
  });

  return item?.lot?.id ?? null;
}

function getExistingVoteForResolution(
  resolution: CoproprietaireResolution,
  localVotesByResolution: Record<string, CoproprietaireVoteItem>,
): CoproprietaireVoteItem | null {
  const localVote = localVotesByResolution[String(resolution.id)];

  if (localVote) {
    return localVote;
  }

  const votes = resolution.vote_summary?.votes ?? [];

  if (votes.length > 0) {
    return votes[0] ?? null;
  }

  return null;
}

function formatResolutionTitle(resolution: CoproprietaireResolution): string {
  const ordre = resolution.ordre ? `R${resolution.ordre} · ` : "";
  return `${ordre}${resolution.titre || `Résolution #${resolution.id}`}`;
}

function getStatusStyle(statut: string | null | undefined): CSSProperties {
  const value = normalize(statut);

  if (["CLOTUREE", "CLÔTURÉE", "ARCHIVEE", "ARCHIVÉE"].includes(value)) {
    return {
      background: "#ecfdf5",
      color: "#047857",
      borderColor: "#a7f3d0",
    };
  }

  if (value === "OUVERTE") {
    return {
      background: "#eff6ff",
      color: "#1d4ed8",
      borderColor: "#bfdbfe",
    };
  }

  if (["CONVOQUEE", "CONVOQUÉE"].includes(value)) {
    return {
      background: "#fffbeb",
      color: "#b45309",
      borderColor: "#fde68a",
    };
  }

  if (["ANNULEE", "ANNULÉE"].includes(value)) {
    return {
      background: "#fff1f2",
      color: "#be123c",
      borderColor: "#fecdd3",
    };
  }

  return {
    background: "#f8fafc",
    color: "#475569",
    borderColor: "#e2e8f0",
  };
}

function getPresenceStyle(status: string | null | undefined): CSSProperties {
  const value = normalize(status);

  if (["PRESENT", "PRESENT_PHYSIQUE"].includes(value)) {
    return {
      background: "#ecfdf5",
      color: "#047857",
      borderColor: "#a7f3d0",
    };
  }

  if (value === "PRESENT_EN_LIGNE") {
    return {
      background: "#eff6ff",
      color: "#1d4ed8",
      borderColor: "#bfdbfe",
    };
  }

  if (value === "REPRESENTE") {
    return {
      background: "#eef2ff",
      color: "#4338ca",
      borderColor: "#c7d2fe",
    };
  }

  if (value === "ABSENT") {
    return {
      background: "#fffbeb",
      color: "#b45309",
      borderColor: "#fde68a",
    };
  }

  return {
    background: "#f8fafc",
    color: "#475569",
    borderColor: "#e2e8f0",
  };
}


function getConvocationStatusStyle(
  statut: string | null | undefined,
): CSSProperties {
  const value = normalize(statut);

  if (value === "CONSULTEE") {
    return {
      background: "#ecfdf5",
      color: "#047857",
      borderColor: "#a7f3d0",
    };
  }

  if (value === "ENVOYEE") {
    return {
      background: "#eff6ff",
      color: "#1d4ed8",
      borderColor: "#bfdbfe",
    };
  }

  if (value === "GENEREE") {
    return {
      background: "#fffbeb",
      color: "#b45309",
      borderColor: "#fde68a",
    };
  }

  if (value === "ANNULEE") {
    return {
      background: "#fff1f2",
      color: "#be123c",
      borderColor: "#fecdd3",
    };
  }

  return {
    background: "#f8fafc",
    color: "#475569",
    borderColor: "#e2e8f0",
  };
}

function getProcurationStatusStyle(
  statut: string | null | undefined,
): CSSProperties {
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

function getQuorumLabel(value: boolean | null): string {
  if (value === true) return "Quorum atteint";
  if (value === false) return "Quorum non atteint";
  return "Quorum non renseigné";
}

function getQuorumStyle(value: boolean | null): CSSProperties {
  if (value === true) {
    return {
      background: "#ecfdf5",
      color: "#047857",
      borderColor: "#a7f3d0",
    };
  }

  if (value === false) {
    return {
      background: "#fff1f2",
      color: "#be123c",
      borderColor: "#fecdd3",
    };
  }

  return {
    background: "#f8fafc",
    color: "#475569",
    borderColor: "#e2e8f0",
  };
}

function openDocument(url: string | null): void {
  if (!url) return;
  window.open(url, "_blank", "noopener,noreferrer");
}

const statTones: Record<
  StatTone,
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
  slate: {
    background: "#f8fafc",
    border: "#e2e8f0",
    color: "#475569",
  },
  indigo: {
    background: "#eef2ff",
    border: "#c7d2fe",
    color: "#4f46e5",
  },
};

const presenceButtonTones: Record<
  "green" | "blue" | "amber" | "indigo",
  { background: string; border: string; color: string }
> = {
  green: {
    background: "#ecfdf5",
    border: "#a7f3d0",
    color: "#047857",
  },
  blue: {
    background: "#eff6ff",
    border: "#bfdbfe",
    color: "#1d4ed8",
  },
  amber: {
    background: "#fffbeb",
    border: "#fde68a",
    color: "#b45309",
  },
  indigo: {
    background: "#eef2ff",
    border: "#c7d2fe",
    color: "#4338ca",
  },
};

const voteButtonTones: Record<
  VoteTone,
  { background: string; border: string; color: string }
> = {
  green: {
    background: "#ecfdf5",
    border: "#a7f3d0",
    color: "#047857",
  },
  rose: {
    background: "#fff1f2",
    border: "#fecdd3",
    color: "#be123c",
  },
  slate: {
    background: "#f8fafc",
    border: "#cbd5e1",
    color: "#475569",
  },
};

const styles: Record<string, CSSProperties> = {
  stack: {
    display: "flex",
    flexDirection: "column",
    gap: 22,
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

  heroContent: {
    minWidth: 0,
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

  secureBox: {
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

  secureIcon: {
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

  secureTitle: {
    margin: 0,
    fontSize: 18,
    fontWeight: 950,
  },

  secureText: {
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

  resultPill: {
    border: "1px solid #e2e8f0",
    background: "#f8fafc",
    color: "#475569",
    borderRadius: 999,
    padding: "8px 12px",
    fontSize: 12,
    fontWeight: 900,
  },

  filters: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) 220px",
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

  error: {
    border: "1px solid #fecdd3",
    background: "#fff1f2",
    color: "#be123c",
    borderRadius: 18,
    padding: "14px 16px",
    fontSize: 13,
    fontWeight: 750,
    lineHeight: 1.55,
    marginBottom: 18,
  },

  list: {
    display: "grid",
    gap: 16,
  },

  agCard: {
    border: "1px solid #e2e8f0",
    borderRadius: 28,
    background: "#ffffff",
    padding: 20,
    display: "grid",
    gap: 16,
    boxShadow: "0 18px 45px rgba(15,23,42,0.06)",
  },

  agHeader: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) 220px",
    gap: 18,
    alignItems: "start",
  },

  agMain: {
    minWidth: 0,
  },

  badges: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
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

  agTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: 22,
    fontWeight: 950,
    letterSpacing: "-0.03em",
    lineHeight: 1.18,
  },

  agMeta: {
    display: "flex",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 8,
    color: "#64748b",
    fontSize: 13,
    fontWeight: 700,
  },

  description: {
    margin: "12px 0 0",
    color: "#64748b",
    fontSize: 14,
    lineHeight: 1.6,
  },

  presenceBox: {
    marginTop: 16,
    border: "1px solid #e2e8f0",
    borderRadius: 22,
    background: "#f8fafc",
    padding: 16,
    display: "grid",
    gap: 12,
  },

  presenceBoxTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: 15,
    fontWeight: 950,
  },

  presenceBoxText: {
    margin: 0,
    color: "#64748b",
    fontSize: 13,
    lineHeight: 1.55,
  },

  presenceActionsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: 10,
  },

  presenceButton: {
    border: "1px solid #e2e8f0",
    borderRadius: 14,
    padding: "10px 12px",
    fontSize: 12,
    fontWeight: 950,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },

  presenceUnavailableText: {
    margin: 0,
    color: "#92400e",
    fontSize: 12,
    lineHeight: 1.5,
  },

  procurationBox: {
    marginTop: 16,
    border: "1px solid #e0e7ff",
    borderRadius: 22,
    background: "#f8faff",
    padding: 16,
    display: "grid",
    gap: 12,
  },

  procurationHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "flex-start",
  },

  procurationTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: 15,
    fontWeight: 950,
  },

  procurationText: {
    margin: "6px 0 0",
    color: "#64748b",
    fontSize: 13,
    lineHeight: 1.55,
  },

  procurationCountBadge: {
    background: "#eef2ff",
    color: "#4338ca",
    borderColor: "#c7d2fe",
  },

  procurationEmpty: {
    margin: 0,
    color: "#64748b",
    fontSize: 13,
    lineHeight: 1.55,
  },

  procurationList: {
    display: "grid",
    gap: 10,
  },

  procurationItem: {
    border: "1px solid #e2e8f0",
    borderRadius: 18,
    background: "#ffffff",
    padding: 14,
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) auto",
    gap: 12,
    alignItems: "start",
  },

  procurationItemMain: {
    minWidth: 0,
  },

  procurationItemHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    flexWrap: "wrap",
    alignItems: "center",
  },

  procurationName: {
    margin: 0,
    color: "#0f172a",
    fontSize: 14,
    fontWeight: 950,
  },

  procurationDetails: {
    margin: "6px 0 0",
    color: "#475569",
    fontSize: 12,
    lineHeight: 1.45,
  },

  procurationRejectReason: {
    margin: "8px 0 0",
    border: "1px solid #fecdd3",
    background: "#fff1f2",
    color: "#be123c",
    borderRadius: 12,
    padding: 10,
    fontSize: 12,
    lineHeight: 1.45,
  },

  procurationDate: {
    margin: "8px 0 0",
    color: "#94a3b8",
    fontSize: 11,
    fontWeight: 700,
  },

  procurationActions: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    alignItems: "stretch",
  },

  procurationDocButton: {
    border: "1px solid #bfdbfe",
    background: "#eff6ff",
    color: "#1d4ed8",
    borderRadius: 12,
    padding: "8px 10px",
    fontSize: 12,
    fontWeight: 900,
    cursor: "pointer",
  },

  cancelProcurationButton: {
    border: "1px solid #fecdd3",
    background: "#fff1f2",
    color: "#be123c",
    borderRadius: 12,
    padding: "8px 10px",
    fontSize: 12,
    fontWeight: 900,
    cursor: "pointer",
  },

  cancelProcurationButtonDisabled: {
    borderColor: "#e2e8f0",
    background: "#f8fafc",
    color: "#94a3b8",
    cursor: "not-allowed",
  },

  voteBox: {
    marginTop: 16,
    border: "1px solid #e2e8f0",
    borderRadius: 22,
    background: "#ffffff",
    padding: 16,
    display: "grid",
    gap: 12,
  },

  voteBoxHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "flex-start",
    flexWrap: "wrap",
  },

  voteBoxTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: 15,
    fontWeight: 950,
  },

  voteBoxText: {
    margin: "6px 0 0",
    color: "#64748b",
    fontSize: 13,
    lineHeight: 1.55,
    maxWidth: 760,
  },

  voteOpenBadge: {
    background: "#ecfdf5",
    color: "#047857",
    borderColor: "#a7f3d0",
  },

  voteClosedBadge: {
    background: "#f8fafc",
    color: "#64748b",
    borderColor: "#e2e8f0",
  },

  voteUnavailableText: {
    margin: 0,
    color: "#64748b",
    fontSize: 12,
    lineHeight: 1.55,
  },

  resolutionsList: {
    display: "grid",
    gap: 12,
  },

  resolutionCard: {
    border: "1px solid #e2e8f0",
    borderRadius: 18,
    background: "#f8fafc",
    padding: 14,
    display: "grid",
    gap: 12,
  },

  resolutionHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "flex-start",
  },

  resolutionTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: 14,
    fontWeight: 950,
    lineHeight: 1.35,
  },

  resolutionText: {
    margin: "6px 0 0",
    color: "#64748b",
    fontSize: 12,
    lineHeight: 1.5,
  },

  resolutionClosedBadge: {
    background: "#f8fafc",
    color: "#64748b",
    borderColor: "#e2e8f0",
  },

  resolutionOpenBadge: {
    background: "#eff6ff",
    color: "#1d4ed8",
    borderColor: "#bfdbfe",
  },

  voteResult: {
    border: "1px solid #a7f3d0",
    background: "#ecfdf5",
    color: "#047857",
    borderRadius: 14,
    padding: "10px 12px",
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 13,
    lineHeight: 1.45,
  },

  voteResultIcon: {
    fontSize: 15,
    flex: "0 0 auto",
  },

  voteActionsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 8,
  },

  voteButton: {
    border: "1px solid #e2e8f0",
    borderRadius: 14,
    padding: "10px 12px",
    fontSize: 12,
    fontWeight: 950,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },

  agActions: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    alignItems: "stretch",
  },

  pvButton: {
    border: "1px solid #c7d2fe",
    background: "#eef2ff",
    color: "#3730a3",
    borderRadius: 16,
    padding: "12px 14px",
    fontSize: 13,
    fontWeight: 950,
    cursor: "pointer",
  },

  pvButtonDisabled: {
    borderColor: "#e2e8f0",
    background: "#f8fafc",
    color: "#94a3b8",
    cursor: "not-allowed",
  },

  mandatButton: {
    border: "1px solid #bfdbfe",
    background: "#eff6ff",
    color: "#1d4ed8",
    borderRadius: 16,
    padding: "12px 14px",
    fontSize: 13,
    fontWeight: 950,
    cursor: "pointer",
  },

  mandatButtonDisabled: {
    borderColor: "#e2e8f0",
    background: "#f8fafc",
    color: "#94a3b8",
    cursor: "not-allowed",
  },

  procurationMainButton: {
    border: "1px solid #c7d2fe",
    background: "#eef2ff",
    color: "#4338ca",
    borderRadius: 16,
    padding: "12px 14px",
    fontSize: 13,
    fontWeight: 950,
    cursor: "pointer",
  },

  procurationMainButtonDisabled: {
    borderColor: "#e2e8f0",
    background: "#f8fafc",
    color: "#94a3b8",
    cursor: "not-allowed",
  },

  pvHint: {
    color: "#047857",
    fontSize: 12,
    fontWeight: 800,
  },

  pvHintMuted: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: 800,
  },

  mandatHint: {
    color: "#1d4ed8",
    fontSize: 12,
    fontWeight: 800,
  },

  mandatHintMuted: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: 800,
  },

  cardStats: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: 10,
    borderTop: "1px solid #e2e8f0",
    paddingTop: 16,
  },

  smallStat: {
    border: "1px solid #e2e8f0",
    background: "#f8fafc",
    borderRadius: 18,
    padding: 14,
  },

  smallStatLabel: {
    margin: 0,
    color: "#64748b",
    fontSize: 11,
    fontWeight: 900,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  },

  smallStatValue: {
    margin: "8px 0 0",
    color: "#0f172a",
    fontSize: 22,
    fontWeight: 950,
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
    color: "#4f46e5",
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

  formSelect: {
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

  formInput: {
    width: "100%",
    border: "1px solid #dbe3ef",
    borderRadius: 16,
    padding: "12px 14px",
    color: "#0f172a",
    fontSize: 14,
    outline: "none",
    boxSizing: "border-box",
  },

  helperText: {
    margin: 0,
    color: "#64748b",
    fontSize: 12,
    lineHeight: 1.55,
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

  primaryButton: {
    border: "1px solid #4f46e5",
    background: "#4f46e5",
    color: "#ffffff",
    borderRadius: 16,
    padding: "11px 16px",
    fontSize: 13,
    fontWeight: 950,
    cursor: "pointer",
  },

  primaryButtonDisabled: {
    borderColor: "#e2e8f0",
    background: "#f8fafc",
    color: "#94a3b8",
    cursor: "not-allowed",
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
};