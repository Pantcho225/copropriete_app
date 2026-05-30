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

export async function getDocumentsCoproprietaire(options?: {
  includeHidden?: boolean;
}) {
  const response = await api.get<CoproprietaireDocumentsResponse>(
    "/api/documents/coproprietaire/documents/",
    {
      params: {
        include_hidden: options?.includeHidden ? 1 : undefined,
      },
    },
  );

  return response.data;
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