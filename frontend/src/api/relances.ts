import api from "./axios";
import { ENDPOINTS } from "./endpoints";

export type GeneratedDocumentResponse = {
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

export type GenerateRelancePdfResponse = {
  detail: string;
  relance: unknown;
  document: GeneratedDocumentResponse;
};

export const relancesAPI = {
  getDossiers: async () => {
    const res = await api.get(ENDPOINTS.relancesDossiers);
    return Array.isArray(res.data) ? res.data : (res.data?.results ?? []);
  },

  getDossier: async (id: number | string) => {
    const res = await api.get(ENDPOINTS.relancesDossierDetail(id));
    return res.data;
  },

  getDossiersStats: async () => {
    const res = await api.get(ENDPOINTS.relancesDossiersStats);
    return res.data;
  },

  getRelances: async () => {
    const res = await api.get(ENDPOINTS.relancesHistorique);
    return Array.isArray(res.data) ? res.data : (res.data?.results ?? []);
  },

  getAvis: async () => {
    const res = await api.get(ENDPOINTS.relancesAvis);
    return Array.isArray(res.data) ? res.data : (res.data?.results ?? []);
  },

  envoyerRelanceDossier: async (
    dossierId: number | string,
    payload: {
      canal: string;
      objet: string;
      message: string;
    },
  ) => {
    const res = await api.post(ENDPOINTS.relanceEnvoyer(dossierId), payload);
    return res.data;
  },

  genererAvisRegularisationDossier: async (
    dossierId: number | string,
    payload: {
      canal: string;
      message: string;
    },
  ) => {
    const res = await api.post(ENDPOINTS.relanceGenererAvis(dossierId), payload);
    return res.data;
  },

  genererCourrierRelancePdf: async (
    dossierId: number | string,
    payload?: {
      objet?: string;
      message?: string;
    },
  ): Promise<GenerateRelancePdfResponse> => {
    const res = await api.post(
      ENDPOINTS.documentGenerateRelance(dossierId),
      payload ?? {},
    );

    return res.data;
  },
};