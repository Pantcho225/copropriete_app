// frontend/src/api/coproprietaire.ts
import api from "./axios";

export type CoproprietaireMesLotsResponse = {
  count: number;
  coproprietaire: {
    id: number;
    nom: string;
    prenoms: string;
    email: string;
  } | null;
  lots: CoproprietaireLot[];
};

export type CoproprietaireLot = {
  id: number;
  lot_id?: number;
  label?: string;
  numero?: string;
  reference?: string;
  type_lot?: string;
  etage?: string;
  surface?: string | number | null;
  description?: string;
  type_droit?: string;
  quote_part?: string | number | null;
  copropriete?: {
    id: number;
    nom: string;
  };
};

export async function getMesLotsCoproprietaire() {
  const response = await api.get<CoproprietaireMesLotsResponse>(
    "/api/owners/coproprietaire/mes-lots/",
  );

  return response.data;
}

export type CoproprietaireLotLite = {
  id: number;
  label: string;
  copropriete: {
    id: number;
    nom: string;
  };
  type_droit: string;
  quote_part: string;
};

export type CoproprietaireAppelItem = {
  id: number;
  ligne_id: number;
  appel_id: number;
  libelle: string;
  type_appel: string;
  date_emission: string | null;
  date_echeance: string | null;
  montant_du: string;
  montant_paye: string;
  reste_a_payer: string;
  statut: string;
  statut_label: string;
  is_overdue: boolean;
  lot: {
    id: number;
    label: string;
    reference: string;
    numero: string;
    type_lot: string;
    etage: string;
  };
  exercice: {
    id: number | null;
    nom: string;
  };
  tantieme_categorie: {
    id: number | null;
    nom: string;
    code: string;
  };
};

export type CoproprietaireAppelsResponse = {
  count: number;
  stats: {
    total_du: string;
    total_paye: string;
    reste_a_payer: string;
    nb_appels: number;
    nb_en_retard: number;
  };
  lots: CoproprietaireLotLite[];
  appels: CoproprietaireAppelItem[];
};

export async function getAppelsCoproprietaire() {
  const response = await api.get<CoproprietaireAppelsResponse>(
    "/api/billing/coproprietaire/appels/",
  );

  return response.data;
}

export type CoproprietairePaiementItem = {
  id: number;
  ligne_id: number | null;
  appel_id: number | null;
  appel_libelle: string;
  lot: {
    id: number | null;
    label: string;
    reference: string;
    numero: string;
    type_lot: string;
    etage: string;
  };
  montant: string;
  date_paiement: string | null;
  mode_paiement: string;
  reference: string;
  statut: string;
  statut_label: string;
  is_cancelled: boolean;
};

export type CoproprietairePaiementsResponse = {
  count: number;
  stats: {
    total_paye: string;
    nb_paiements: number;
    nb_annules: number;
  };
  paiements: CoproprietairePaiementItem[];
};

export async function getPaiementsCoproprietaire() {
  const response = await api.get<CoproprietairePaiementsResponse>(
    "/api/billing/coproprietaire/paiements/",
  );

  return response.data;
}

export type CoproprietaireDossierImpayeItem = {
  id: number;
  appel_id: number | null;
  appel_libelle: string;
  reference_appel: string;
  date_echeance: string | null;
  montant_initial: string;
  montant_paye: string;
  reste_a_payer: string;
  statut: string;
  statut_label: string;
  niveau_relance: number;
  relances_count: number;
  derniere_relance_at: string | null;
  date_dernier_paiement: string | null;
  est_regularise: boolean;
  is_overdue: boolean;
  lot: {
    id: number | null;
    label: string;
    reference: string;
    numero: string;
    type_lot: string;
    etage: string;
  };
};

export type CoproprietaireRelanceItem = {
  id: number;
  dossier_id: number | null;
  appel_id: number | null;
  appel_libelle: string;
  lot: {
    id: number | null;
    label: string;
    reference: string;
    numero: string;
    type_lot: string;
    etage: string;
  };
  niveau: number;
  canal: string;
  statut: string;
  statut_label: string;
  objet: string;
  message: string;
  montant_du_message: string;
  reste_a_payer_au_moment_envoi: string;
  created_at: string | null;
  updated_at: string | null;
  document_pdf_url: string;
};

export type CoproprietaireRelancesResponse = {
  count: number;
  stats: {
    nb_dossiers: number;
    nb_relances: number;
    nb_en_retard: number;
    nb_regularises: number;
    total_initial: string;
    total_reste_a_payer: string;
    nb_envoyees: number;
    nb_echecs: number;
    nb_annulees: number;
  };
  dossiers: CoproprietaireDossierImpayeItem[];
  relances: CoproprietaireRelanceItem[];
};

export async function getRelancesCoproprietaire() {
  const response = await api.get<CoproprietaireRelancesResponse>(
    "/api/relances/coproprietaire/relances/",
  );

  return response.data;
}

export type CoproprietaireDocumentItem = {
  id: string;
  titre: string;
  categorie: string;
  source: string;
  url: string;
  filename: string;
  date_document: string | null;
  lot: {
    id: number | null;
    label: string;
    reference: string;
    numero: string;
    type_lot: string;
    etage: string;
  };
  meta: Record<string, unknown>;
  is_hidden: boolean;
  hidden_at: string | null;
};

export type CoproprietaireDocumentsResponse = {
  count: number;
  stats: {
    total: number;
    relances: number;
    ag: number;
    autres: number;
    masques: number;
  };
  documents: CoproprietaireDocumentItem[];
};

export type CoproprietaireAdministrativeDocumentItem = {
  id: number;
  title: string;
  category: number;
  category_label?: string;
  description?: string | null;
  file_url?: string;
  download_url?: string;
  filename?: string;
  original_filename?: string;
  date_document?: string | null;
  visible_to_coproprietaires?: boolean;
  created_at?: string;
};

type PaginatedResponse<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

function normalizeList<T>(value: PaginatedResponse<T> | T[] | unknown): T[] {
  if (
    value &&
    typeof value === "object" &&
    Array.isArray((value as PaginatedResponse<T>).results)
  ) {
    return (value as PaginatedResponse<T>).results;
  }

  if (Array.isArray(value)) return value as T[];

  return [];
}

function mapAdministrativeDocumentToOwnerDocument(
  item: CoproprietaireAdministrativeDocumentItem,
): CoproprietaireDocumentItem {
  return {
    id: `ADMINISTRATIF-${item.id}`,
    titre: item.title,
    categorie: "ADMINISTRATIF",
    source: "Document administratif",
    url: item.download_url || item.file_url || "",
    filename: item.filename || item.original_filename || "",
    date_document: item.date_document || item.created_at || null,
    lot: {
      id: null,
      label: "",
      reference: "",
      numero: "",
      type_lot: "",
      etage: "",
    },
    meta: {
      administrative_document_id: item.id,
      description: item.description || "",
      category_label: item.category_label || "",
    },
    is_hidden: false,
    hidden_at: null,
  };
}

export async function getDocumentsCoproprietaire(options?: {
  includeHidden?: boolean;
}) {
  const [documentsResponse, administratifsResponse] = await Promise.all([
    api.get<CoproprietaireDocumentsResponse>(
      "/api/documents/coproprietaire/documents/",
      {
        params: {
          include_hidden: options?.includeHidden ? 1 : undefined,
        },
      },
    ),
    api.get<
      PaginatedResponse<CoproprietaireAdministrativeDocumentItem> |
        CoproprietaireAdministrativeDocumentItem[]
    >("/api/documents/coproprietaire/administratifs/"),
  ]);

  const baseData = documentsResponse.data;
  const administrativeDocuments = normalizeList<CoproprietaireAdministrativeDocumentItem>(
    administratifsResponse.data,
  ).map(mapAdministrativeDocumentToOwnerDocument);

  const mergedDocuments = [...administrativeDocuments, ...(baseData.documents ?? [])];

  return {
    ...baseData,
    count: mergedDocuments.length,
    stats: {
      ...baseData.stats,
      total: mergedDocuments.length,
      autres: (baseData.stats?.autres ?? 0) + administrativeDocuments.length,
    },
    documents: mergedDocuments,
  };
}

export async function hideDocumentCoproprietaire(documentId: string) {
  const response = await api.post<{
    success: boolean;
    created: boolean;
    document_id: string;
    hidden_at: string | null;
  }>("/api/documents/coproprietaire/documents/masquer/", {
    document_id: documentId,
  });

  return response.data;
}

export async function restoreDocumentCoproprietaire(documentId: string) {
  const response = await api.post<{
    success: boolean;
    restored: boolean;
    document_id: string;
  }>("/api/documents/coproprietaire/documents/restaurer/", {
    document_id: documentId,
  });

  return response.data;
}

export type GeneratedDocumentCoproprietaire = {
  id: number;
  copropriete: number;
  document_type: string;
  document_type_label: string;
  title: string;
  reference: string;
  file: string;
  file_url: string;
  filename: string;
  file_hash: string;
  related_owner: number | null;
  related_owner_label: string;
  related_lot: number | null;
  related_lot_label: string;
  related_ag: number | null;
  related_ag_label: string;
  related_dossier_impaye: number | null;
  related_relance: number | null;
  is_visible_to_owner: boolean;
  status: string;
  status_label: string;
  metadata: Record<string, unknown>;
  created_by: number | null;
  created_at: string;
  updated_at: string;
};

export type GenerateMandatAgCoproprietaireResponse = {
  detail: string;
  document: GeneratedDocumentCoproprietaire;
};

export async function generateMandatAgCoproprietaire(
  agId: number | string,
  payload?: {
    lot_id?: number | string;
    mandataire_nom?: string;
    mandataire_telephone?: string;
  },
) {
  const response = await api.post<GenerateMandatAgCoproprietaireResponse>(
    `/api/documents/coproprietaire/ag/${agId}/mandat/`,
    payload ?? {},
  );

  return response.data;
}

export type CoproprietaireProcurationStatut =
  | "EN_ATTENTE"
  | "VALIDEE"
  | "REJETEE"
  | "ANNULEE";

export type CoproprietaireProcurationItem = {
  id: number;
  ag: number;
  ag_titre: string;
  ag_date_ag: string | null;
  coproprietaire: number;
  coproprietaire_label: string;
  lot: number;
  lot_reference: string;
  lot_numero: string;
  lot_label: string;
  mandataire_nom: string;
  mandataire_telephone: string;
  mandataire_email: string;
  document: number | null;
  document_url: string | null;
  document_reference: string;
  document_title: string;
  statut: CoproprietaireProcurationStatut | string;
  statut_label: string;
  motif_rejet: string;
  created_by: number | null;
  created_by_label: string;
  validated_by: number | null;
  validated_by_label: string;
  validated_at: string | null;
  rejected_by: number | null;
  rejected_by_label: string;
  rejected_at: string | null;
  ip_address: string | null;
  user_agent: string;
  created_at: string;
  updated_at: string;
};

export type CoproprietaireProcurationsResponse = {
  count: number;
  procurations: CoproprietaireProcurationItem[];
};

export type CreerProcurationAgCoproprietairePayload = {
  ag_id: number | string;
  lot_id?: number | string;
  mandataire_nom: string;
  mandataire_telephone?: string;
  mandataire_email?: string;
};

export type CreerProcurationAgCoproprietaireResponse = {
  detail: string;
  procuration: CoproprietaireProcurationItem;
};

export type AnnulerProcurationAgCoproprietaireResponse = {
  detail: string;
  procuration: CoproprietaireProcurationItem;
};

export async function getProcurationsAgCoproprietaire(options?: {
  agId?: number | string;
  statut?: CoproprietaireProcurationStatut | string;
}) {
  const response = await api.get<CoproprietaireProcurationsResponse>(
    "/api/ag/coproprietaire/procurations/",
    {
      params: {
        ag: options?.agId,
        statut: options?.statut,
      },
    },
  );

  return response.data;
}

export async function creerProcurationAgCoproprietaire(
  payload: CreerProcurationAgCoproprietairePayload,
) {
  const response = await api.post<CreerProcurationAgCoproprietaireResponse>(
    "/api/ag/coproprietaire/procurations/",
    payload,
  );

  return response.data;
}

export async function annulerProcurationAgCoproprietaire(
  procurationId: number | string,
) {
  const response = await api.post<AnnulerProcurationAgCoproprietaireResponse>(
    `/api/ag/coproprietaire/procurations/${procurationId}/annuler/`,
  );

  return response.data;
}

export type CoproprietairePresenceMode =
  | "PRESENT_PHYSIQUE"
  | "PRESENT_EN_LIGNE"
  | "REPRESENTE"
  | "ABSENT";

export type CoproprietairePresenceResponse = {
  detail: string;
  ag_id: number;
  mode_presence: CoproprietairePresenceMode;
  mode_presence_label: string;
  updated_count: number;
  presence_coproprietaire: {
    status: string;
    label: string;
    count: number;
    items: Array<{
      id: number;
      status: string;
      mode_presence: string;
      label: string;
      present_ou_represente: boolean;
      representant_nom: string;
      commentaire: string;
      tantiemes: string;
      lot: {
        id: number | null;
        label: string;
        reference: string;
        numero: string;
        type_lot: string;
        etage: string;
      };
    }>;
  };
  quorum: {
    total_tantiemes_copro: string;
    total_tantiemes_presents: string;
    quorum_atteint: boolean;
  };
};

export async function confirmerPresenceAgCoproprietaire(
  agId: number | string,
  payload: {
    mode_presence: CoproprietairePresenceMode;
    lot_id?: number | string;
    representant_nom?: string;
    commentaire?: string;
  },
) {
  const response = await api.post<CoproprietairePresenceResponse>(
    `/api/ag/coproprietaire/assemblees/${agId}/presence/`,
    payload,
  );

  return response.data;
}

export type CoproprietaireVoteChoix = "POUR" | "CONTRE" | "ABSTENTION";

export type CoproprietaireVoteLot = {
  id: number | string | null;
  label: string;
  reference: string;
  numero: string;
};

export type CoproprietaireVoteItem = {
  id: number | string;
  resolution_id: number | string;
  lot: CoproprietaireVoteLot;
  choix: CoproprietaireVoteChoix | string;
  choix_label: string;
  tantiemes: string;
  source: string;
  locked: boolean | string;
  locked_at: string | null;
  created_at: string | null;
};

export type CoproprietaireVoteSummary = {
  total: number;
  par_choix: Record<string, number>;
  votes: CoproprietaireVoteItem[];
};

export type CoproprietaireVoteResponse = {
  detail: string;
  ag_id: number;
  resolution_id: number;
  vote: CoproprietaireVoteItem;
  vote_summary: CoproprietaireVoteSummary;
};

export async function voterResolutionAgCoproprietaire(
  resolutionId: number | string,
  payload: {
    lot_id: number | string;
    choix: CoproprietaireVoteChoix;
  },
) {
  const response = await api.post<CoproprietaireVoteResponse>(
    `/api/ag/coproprietaire/resolutions/${resolutionId}/vote/`,
    payload,
  );

  return response.data;
}

// =========================================================
// Situation financière globale copropriétaire
// =========================================================

export type CoproprietaireSituationMensuelle = {
  mois: string;
  mois_label: string;
  total_appels: string;
  total_paye: string;
  credits: string;
  debits: string;
  solde_mensuel: string;
};

export type CoproprietaireRepartitionMouvement = {
  type: "CREDIT" | "DEBIT" | string;
  label: string;
  montant: string;
  count: number;
};

export type CoproprietaireDernierMouvement = {
  id: number;
  date_operation: string;
  sens: "CREDIT" | "DEBIT" | string;
  sens_label: string;
  montant: string;
  libelle: string;
  reference: string;
  compte_label: string;
  rapproche: boolean;
  cancelled: boolean;
  cancel_kind: string;
};

export type CoproprietaireSituationFinanciereResponse = {
  copropriete_id: number;
  copropriete_label: string;
  devise: string;

  exercice_id: number | null;
  exercice_annee: number | null;
  periode_debut: string | null;
  periode_fin: string | null;

  total_appels: string;
  total_encaisse: string;
  reste_a_recouvrer: string;
  taux_encaissement: string;

  total_credits_bancaires: string;
  total_debits_bancaires: string;
  solde_bancaire_estime: string;

  nb_appels: number;
  nb_lignes_appel: number;
  nb_lignes_impayees: number;
  nb_lignes_partielles: number;
  nb_lignes_payees: number;

  courbe_mensuelle: CoproprietaireSituationMensuelle[];
  repartition_mouvements: CoproprietaireRepartitionMouvement[];
  derniers_mouvements: CoproprietaireDernierMouvement[];

  message_transparence: string;
};

export async function getSituationFinanciereCoproprietaire(options?: {
  exerciceId?: number | string;
  annee?: number | string;
  coproprieteId?: number | string;
}) {
  const response = await api.get<CoproprietaireSituationFinanciereResponse>(
    "/api/billing/coproprietaire/situation-financiere/",
    {
      params: {
        exercice_id: options?.exerciceId,
        annee: options?.annee,
        copropriete_id: options?.coproprieteId,
      },
    },
  );

  return response.data;
}
export type CoproprietaireReunionParticipant = {
  id: number;
  type: string;
  type_label?: string;
  nom_complet: string;
  organisation?: string;
  fonction?: string;
  present?: boolean;
  ordre?: number;
};

export type CoproprietaireReunionDocument = {
  id: number;
  reunion: number;
  type: string;
  type_label?: string;
  titre: string;
  description?: string;
  download_url?: string;
  filename?: string;
  visible_coproprietaire?: boolean;
};

export type CoproprietaireReunionAction = {
  id: number;
  titre: string;
  description?: string;
  statut: string;
  statut_label?: string;
  priorite: string;
  priorite_label?: string;
  responsable_nom?: string;
  echeance?: string | null;
  date_cloture?: string | null;
  ordre?: number;
};

export type CoproprietaireReunionRencontre = {
  id: number;
  type: string;
  type_label?: string;
  statut: string;
  statut_label?: string;
  titre: string;
  reference?: string;
  objet?: string;
  description?: string;
  date_debut: string;
  date_fin?: string | null;
  lieu?: string;
  compte_rendu?: string;
  decisions?: string;
  date_publication?: string | null;
  participants?: CoproprietaireReunionParticipant[];
  documents?: CoproprietaireReunionDocument[];
  actions?: CoproprietaireReunionAction[];
  created_at?: string;
  updated_at?: string;
};

export async function getReunionsRencontresCoproprietaire(params?: {
  type?: string;
  q?: string;
}) {
  const response = await api.get<
    PaginatedResponse<CoproprietaireReunionRencontre> |
      CoproprietaireReunionRencontre[]
  >("/api/reunions/coproprietaire/rencontres/", {
    params,
  });

  return normalizeList<CoproprietaireReunionRencontre>(response.data);
}
