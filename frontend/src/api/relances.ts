import api from "./axios";
import { ENDPOINTS } from "./endpoints";

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
    }
  ) => {
    const res = await api.post(ENDPOINTS.relanceEnvoyer(dossierId), payload);
    return res.data;
  },

  genererAvisRegularisationDossier: async (
    dossierId: number | string,
    payload: {
      canal: string;
      message: string;
    }
  ) => {
    const res = await api.post(ENDPOINTS.relanceGenererAvis(dossierId), payload);
    return res.data;
  },
};