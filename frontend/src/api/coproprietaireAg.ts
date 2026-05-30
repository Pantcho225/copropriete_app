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