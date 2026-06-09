import api from "./axios";

export type CoproprietairePresenceAG = {
  status: string;
  label: string;
  count: number;
};

export type CoproprietaireVoteSummary = {
  total: number;
  par_choix: Record<string, number>;
};

export type CoproprietaireAG = {
  id: number;
  titre: string;
  description: string;
  statut: string;
  statut_label: string;
  date_ag: string | null;
  lieu: string;
  quorum_atteint: boolean | null;
  pv_locked: boolean;
  pv_url: string | null;
  pv_signed_url: string | null;
  has_pv: boolean;
  total_resolutions: number;
  presence_coproprietaire: CoproprietairePresenceAG;
  vote_summary: CoproprietaireVoteSummary;
};

export type CoproprietaireAGStats = {
  total: number;
  a_venir: number;
  ouvertes: number;
  cloturees: number;
  pv_disponibles: number;
};

export type CoproprietaireAGResponse = {
  count: number;
  stats: CoproprietaireAGStats;
  assemblees: CoproprietaireAG[];
};

export type GetAssembleesGeneralesCoproprietaireParams = {
  search?: string;
  statut?: string;
};

export type CoproprietaireAgConvocationStatut =
  | "GENEREE"
  | "ENVOYEE"
  | "CONSULTEE"
  | "ANNULEE";

export type CoproprietaireAgConvocationCanal =
  | "PLATEFORME"
  | "EMAIL"
  | "SMS"
  | "WHATSAPP"
  | "PAPIER";

export type CoproprietaireAgConvocation = {
  id: number;
  reference: string;

  ag: number;
  ag_titre: string;
  ag_date_ag: string | null;

  copropriete: number | null;
  copropriete_label: string;

  coproprietaire: number | null;
  coproprietaire_label: string;

  lot: number | null;
  lot_label: string;
  lot_reference: string;
  lot_numero: string;

  document: number | null;
  document_url: string | null;

  statut: CoproprietaireAgConvocationStatut;
  statut_label: string;

  canal: CoproprietaireAgConvocationCanal;
  canal_label: string;

  objet: string;
  message: string;

  generated_at: string | null;
  sent_at: string | null;
  consulted_at: string | null;
  cancelled_at: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type CoproprietaireAgConvocationsResponse = {
  count: number;
  convocations: CoproprietaireAgConvocation[];
};

export type GetConvocationsCoproprietaireParams = {
  ag?: number | string;
  statut?: CoproprietaireAgConvocationStatut | string;
};

export type ConsulterConvocationCoproprietaireResponse = {
  detail: string;
  convocation: CoproprietaireAgConvocation;
};

export async function getAssembleesGeneralesCoproprietaire(
  params?: GetAssembleesGeneralesCoproprietaireParams,
): Promise<CoproprietaireAGResponse> {
  const response = await api.get<CoproprietaireAGResponse>(
    "/api/ag/coproprietaire/assemblees/",
    {
      params,
    },
  );

  return response.data;
}

export async function getConvocationsCoproprietaire(
  params?: GetConvocationsCoproprietaireParams,
): Promise<CoproprietaireAgConvocationsResponse> {
  const response = await api.get<CoproprietaireAgConvocationsResponse>(
    "/api/ag/coproprietaire/convocations/",
    {
      params,
    },
  );

  return response.data;
}

export async function consulterConvocationCoproprietaire(
  convocationId: number | string,
): Promise<ConsulterConvocationCoproprietaireResponse> {
  const response = await api.post<ConsulterConvocationCoproprietaireResponse>(
    `/api/ag/coproprietaire/convocations/${convocationId}/consulter/`,
  );

  return response.data;
}
