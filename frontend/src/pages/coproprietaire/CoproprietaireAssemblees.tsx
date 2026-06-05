// frontend/src/pages/coproprietaire/CoproprietaireAssemblees.tsx
import { useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties, ReactNode } from "react";

import {
  getAssembleesGeneralesCoproprietaire,
  type CoproprietaireAG,
  type CoproprietaireAGResponse,
} from "../../api/coproprietaireAg";
import {
  confirmerPresenceAgCoproprietaire,
  generateMandatAgCoproprietaire,
  voterResolutionAgCoproprietaire,
  type CoproprietairePresenceMode,
  type CoproprietaireVoteChoix,
  type CoproprietaireVoteItem,
} from "../../api/coproprietaire";

type StatTone = "blue" | "green" | "amber" | "slate" | "indigo";
type StatusFilter = "" | "CONVOQUEE" | "OUVERTE" | "CLOTUREE" | "ARCHIVEE" | "ANNULEE";
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
  } | null;
};

type PresenceSummaryLike = {
  items?: PresenceItemLike[];
};

type CoproprietaireAGWithResolutions = CoproprietaireAG & {
  pv_locked?: boolean;
  resolutions?: CoproprietaireResolution[];
  vote_summary?: VoteSummaryLike;
  presence_coproprietaire?: PresenceSummaryLike;
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<{ kind: FlashKind; text: string } | null>(null);
  const [search, setSearch] = useState("");
  const [statut, setStatut] = useState<StatusFilter>("");
  const [generatingMandatAgId, setGeneratingMandatAgId] = useState<number | null>(null);
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
      } catch {
        setError("Impossible de charger vos assemblées générales pour le moment.");
        setData(emptyResponse);
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

  const pvDisponibles = useMemo(() => {
    return assemblees.filter((ag) => ag.has_pv).length;
  }, [assemblees]);

  const showFlash = useCallback((kind: FlashKind, text: string) => {
    setFlash({ kind, text });

    window.setTimeout(() => {
      setFlash((current) => (current?.text === text ? null : current));
    }, 5000);
  }, []);

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
          `Mandat généré avec succès. Référence : ${response.document?.reference || "—"}.`,
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

      let representantNom = "";

      if (mode === "REPRESENTE") {
        const entered = window.prompt(
          "Nom complet du mandataire qui vous représentera à cette AG :",
        );

        if (!entered || !entered.trim()) {
          showFlash(
            "info",
            "Le nom du mandataire est obligatoire pour déclarer une représentation.",
          );
          return;
        }

        representantNom = entered.trim();
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
          representant_nom: representantNom,
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
    [loadAssemblees, showFlash],
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
          `${response.detail} Choix : ${response.vote.choix_label || response.vote.choix}.`,
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
            quorum, présence, résolutions, votes, procurations et procès-verbaux
            disponibles.
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
              confirmer votre présence, participer en ligne, déclarer une
              représentation, voter sur les résolutions ouvertes, ouvrir le
              procès-verbal lorsqu’il est disponible et télécharger votre mandat
              pour les AG encore actives.
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
            {assemblees.map((ag) => (
              <AGCard
                key={ag.id}
                ag={ag as CoproprietaireAGWithResolutions}
                generatingMandat={generatingMandatAgId === ag.id}
                presenceBusy={
                  presenceBusy?.agId === ag.id ? presenceBusy.mode : null
                }
                voteBusy={voteBusy}
                localVotesByResolution={localVotesByResolution}
                onGenerateMandat={handleGenerateMandat}
                onConfirmPresence={handleConfirmPresence}
                onVoteResolution={handleVoteResolution}
              />
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
}

function AGCard({
  ag,
  generatingMandat,
  presenceBusy,
  voteBusy,
  localVotesByResolution,
  onGenerateMandat,
  onConfirmPresence,
  onVoteResolution,
}: {
  ag: CoproprietaireAGWithResolutions;
  generatingMandat: boolean;
  presenceBusy: CoproprietairePresenceMode | null;
  voteBusy: {
    resolutionId: number | string;
    choix: CoproprietaireVoteChoix;
  } | null;
  localVotesByResolution: Record<string, CoproprietaireVoteItem>;
  onGenerateMandat: (ag: CoproprietaireAG) => void;
  onConfirmPresence: (ag: CoproprietaireAG, mode: CoproprietairePresenceMode) => void;
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
  const presenceAvailable = canConfirmPresence(ag);
  const presenceDisabled = !presenceAvailable || presenceBusy !== null;
  const resolutions = Array.isArray(ag.resolutions) ? ag.resolutions : [];

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

          <div style={styles.presenceBox}>
            <p style={styles.presenceBoxTitle}>Ma présence à cette AG</p>
            <p style={styles.presenceBoxText}>
              Déclarez votre participation depuis votre espace copropriétaire.
              Cette action met à jour la présence de votre lot et le calcul du
              quorum.
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
                label="Représenté"
                mode="REPRESENTE"
                busyMode={presenceBusy}
                disabled={presenceDisabled}
                tone="indigo"
                onClick={() => onConfirmPresence(ag, "REPRESENTE")}
              />
            </div>

            {!presenceAvailable ? (
              <p style={styles.presenceUnavailableText}>
                La confirmation de présence est indisponible pour une AG
                clôturée, archivée, annulée ou verrouillée.
              </p>
            ) : null}
          </div>

          <div style={styles.voteBox}>
            <div style={styles.voteBoxHeader}>
              <div>
                <p style={styles.voteBoxTitle}>Mes votes sur les résolutions</p>
                <p style={styles.voteBoxText}>
                  Le vote en ligne est autorisé uniquement lorsque l’AG est
                  ouverte. Chaque vote est unique, verrouillé et tracé.
                </p>
              </div>

              <Badge style={canVoteAg(ag) ? styles.voteOpenBadge : styles.voteClosedBadge}>
                {canVoteAg(ag) ? "Vote ouvert" : "Vote indisponible"}
              </Badge>
            </div>

            {resolutions.length === 0 ? (
              <p style={styles.voteUnavailableText}>
                Aucune résolution détaillée n’est actuellement exposée dans cette
                vue. Le backend doit renvoyer la liste des résolutions de l’AG
                pour afficher les boutons de vote.
              </p>
            ) : (
              <div style={styles.resolutionsList}>
                {resolutions.map((resolution) => {
                  const existingVote = getExistingVoteForResolution(
                    resolution,
                    localVotesByResolution,
                  );
                  const voteAvailable = canVoteResolution(ag, resolution) && !existingVote;
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
                          Vote indisponible : AG non ouverte, PV verrouillé,
                          résolution clôturée ou présence non confirmée.
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

          {ag.has_pv ? (
            <span style={styles.pvHint}>
              {ag.pv_signed_url ? "PV signé disponible" : "PV disponible"}
            </span>
          ) : (
            <span style={styles.pvHintMuted}>Aucun PV disponible</span>
          )}

          <span style={mandatAvailable ? styles.mandatHint : styles.mandatHintMuted}>
            {mandatAvailable
              ? "Mandat disponible pour représentation"
              : "Mandat indisponible pour cette AG"}
          </span>
        </div>
      </div>

      <div style={styles.cardStats}>
        <SmallStat
          label="Résolutions"
          value={formatNumber(ag.total_resolutions)}
        />
        <SmallStat label="Mes votes" value={formatNumber(votesTotal)} />
        <SmallStat
          label="Procès-verbal"
          value={ag.has_pv ? "Disponible" : "Non disponible"}
        />
      </div>
    </article>
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

function canGenerateMandat(ag: CoproprietaireAG): boolean {
  const value = normalize(ag.statut);

  return !["CLOTUREE", "CLÔTURÉE", "ARCHIVEE", "ARCHIVÉE", "ANNULEE", "ANNULÉE"].includes(
    value,
  );
}

function canConfirmPresence(ag: CoproprietaireAG): boolean {
  const value = normalize(ag.statut);
  const pvLocked = (ag as { pv_locked?: boolean }).pv_locked === true;

  return ["CONVOQUEE", "CONVOQUÉE", "OUVERTE"].includes(value) && !pvLocked;
}

function getPresenceItems(ag: CoproprietaireAGWithResolutions): PresenceItemLike[] {
  const presence = ag.presence_coproprietaire;

  return Array.isArray(presence?.items) ? presence.items : [];
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

function hasPresentOrRepresentedLot(ag: CoproprietaireAGWithResolutions): boolean {
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

  hero: {
    borderRadius: 34,
    padding: 30,
    background:
      "linear-gradient(135deg, rgba(15,23,42,0.97), rgba(37,99,235,0.92)), radial-gradient(circle at top right, rgba(125,211,252,0.46), transparent 36%)",
    color: "white",
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) 320px",
    gap: 24,
    boxShadow: "0 30px 85px rgba(15,23,42,0.26)",
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
    color: "#dbeafe",
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
    color: "#dbeafe",
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
    color: "#dbeafe",
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
    color: "#2563eb",
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
    borderRadius: 999,
    padding: "8px 12px",
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    color: "#475569",
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
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
    fontSize: 13,
    fontWeight: 750,
  },

  list: {
    display: "grid",
    gap: 14,
  },

  agCard: {
    border: "1px solid #e2e8f0",
    borderRadius: 24,
    background: "#ffffff",
    padding: 18,
    boxShadow: "0 14px 36px rgba(15,23,42,0.05)",
  },

  agHeader: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr) 240px",
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

  agTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: 19,
    fontWeight: 950,
    letterSpacing: "-0.02em",
    lineHeight: 1.2,
  },

  agMeta: {
    display: "flex",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 8,
    color: "#475569",
    fontSize: 13,
    fontWeight: 750,
  },

  description: {
    margin: "10px 0 0",
    color: "#64748b",
    fontSize: 13,
    lineHeight: 1.6,
  },

  presenceBox: {
    marginTop: 14,
    border: "1px solid #e2e8f0",
    borderRadius: 20,
    background: "#f8fafc",
    padding: 14,
  },

  presenceBoxTitle: {
    margin: 0,
    color: "#0f172a",
    fontSize: 13,
    fontWeight: 950,
  },

  presenceBoxText: {
    margin: "6px 0 0",
    color: "#64748b",
    fontSize: 12,
    lineHeight: 1.55,
  },

  presenceActionsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: 8,
    marginTop: 12,
  },

  presenceButton: {
    border: "1px solid",
    borderRadius: 14,
    padding: "10px 9px",
    fontSize: 12,
    fontWeight: 900,
    transition: "all 0.2s ease",
  },

  presenceUnavailableText: {
    margin: "10px 0 0",
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: 750,
    lineHeight: 1.45,
  },

  voteBox: {
    marginTop: 14,
    border: "1px solid #dbeafe",
    borderRadius: 20,
    background: "#f8fbff",
    padding: 14,
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
    fontSize: 13,
    fontWeight: 950,
  },

  voteBoxText: {
    margin: "6px 0 0",
    color: "#64748b",
    fontSize: 12,
    lineHeight: 1.55,
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

  resolutionsList: {
    display: "grid",
    gap: 10,
    marginTop: 12,
  },

  resolutionCard: {
    border: "1px solid #e2e8f0",
    borderRadius: 18,
    background: "#ffffff",
    padding: 12,
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
    fontSize: 13,
    fontWeight: 950,
    lineHeight: 1.35,
  },

  resolutionText: {
    margin: "6px 0 0",
    color: "#64748b",
    fontSize: 12,
    lineHeight: 1.55,
  },

  resolutionOpenBadge: {
    background: "#ecfdf5",
    color: "#047857",
    borderColor: "#a7f3d0",
  },

  resolutionClosedBadge: {
    background: "#fff1f2",
    color: "#be123c",
    borderColor: "#fecdd3",
  },

  voteActionsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 8,
    marginTop: 10,
  },

  voteButton: {
    border: "1px solid",
    borderRadius: 14,
    padding: "10px 9px",
    fontSize: 12,
    fontWeight: 950,
    transition: "all 0.2s ease",
  },

  voteResult: {
    marginTop: 10,
    border: "1px solid #a7f3d0",
    background: "#ecfdf5",
    color: "#047857",
    borderRadius: 14,
    padding: "10px 12px",
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 12,
    fontWeight: 800,
    lineHeight: 1.45,
  },

  voteResultIcon: {
    fontSize: 14,
  },

  voteUnavailableText: {
    margin: "10px 0 0",
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: 750,
    lineHeight: 1.45,
  },

  agActions: {
    display: "flex",
    flexDirection: "column",
    gap: 9,
    alignItems: "stretch",
  },

  pvButton: {
    border: "1px solid #bfdbfe",
    background: "#eff6ff",
    color: "#1d4ed8",
    borderRadius: 16,
    padding: "11px 14px",
    fontSize: 13,
    fontWeight: 900,
    cursor: "pointer",
  },

  pvButtonDisabled: {
    borderColor: "#e2e8f0",
    background: "#f8fafc",
    color: "#94a3b8",
    cursor: "not-allowed",
  },

  mandatButton: {
    border: "1px solid #c7d2fe",
    background: "#eef2ff",
    color: "#4338ca",
    borderRadius: 16,
    padding: "11px 14px",
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

  pvHint: {
    color: "#047857",
    fontSize: 12,
    fontWeight: 800,
    textAlign: "center",
  },

  pvHintMuted: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: 800,
    textAlign: "center",
  },

  mandatHint: {
    color: "#4338ca",
    fontSize: 12,
    fontWeight: 800,
    textAlign: "center",
  },

  mandatHintMuted: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: 800,
    textAlign: "center",
  },

  cardStats: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 10,
    marginTop: 16,
  },

  smallStat: {
    borderRadius: 18,
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    padding: 12,
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
    margin: "6px 0 0",
    color: "#0f172a",
    fontSize: 16,
    fontWeight: 950,
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
    background: "#eff6ff",
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
};