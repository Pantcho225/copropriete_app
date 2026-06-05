// frontend/src/api/agProcurations.ts
import api from "./axios";

export type AGProcurationStatut =
  | "EN_ATTENTE"
  | "VALIDEE"
  | "REJETEE"
  | "ANNULEE";

export type AGProcurationItem = {
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

  statut: AGProcurationStatut | string;
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

export type AGProcurationsListParams = {
  agId?: number | string;
  statut?: AGProcurationStatut | string;
  lotId?: number | string;
  coproprietaireId?: number | string;
  includeArchives?: boolean;
};

export type AGProcurationListResponse =
  | AGProcurationItem[]
  | {
      count?: number;
      next?: string | null;
      previous?: string | null;
      results?: AGProcurationItem[];
    };

export type AGProcurationActionResponse = {
  detail: string;
  procuration: AGProcurationItem;
};

export type RejeterAGProcurationPayload = {
  motif_rejet: string;
};

function normalizeListResponse(
  data: AGProcurationListResponse,
): AGProcurationItem[] {
  if (Array.isArray(data)) {
    return data;
  }

  if (Array.isArray(data.results)) {
    return data.results;
  }

  return [];
}

export async function getAGProcurations(params?: AGProcurationsListParams) {
  const response = await api.get<AGProcurationListResponse>(
    "/api/ag/procurations/",
    {
      params: {
        ag: params?.agId,
        statut: params?.statut,
        lot: params?.lotId,
        coproprietaire: params?.coproprietaireId,
        include_archives: params?.includeArchives ? 1 : undefined,
      },
    },
  );

  return normalizeListResponse(response.data);
}

export async function validerAGProcuration(procurationId: number | string) {
  const response = await api.post<AGProcurationActionResponse>(
    `/api/ag/procurations/${procurationId}/valider/`,
  );

  return response.data;
}

export async function rejeterAGProcuration(
  procurationId: number | string,
  payload: RejeterAGProcurationPayload,
) {
  const response = await api.post<AGProcurationActionResponse>(
    `/api/ag/procurations/${procurationId}/rejeter/`,
    payload,
  );

  return response.data;
}

export function getAGProcurationStatutLabel(statut: string | null | undefined) {
  const value = String(statut ?? "").trim().toUpperCase();

  if (value === "EN_ATTENTE") return "En attente";
  if (value === "VALIDEE") return "Validée";
  if (value === "REJETEE") return "Rejetée";
  if (value === "ANNULEE") return "Annulée";

  return value || "Non défini";
}

export function canValidateAGProcuration(procuration: AGProcurationItem) {
  return String(procuration.statut ?? "").trim().toUpperCase() === "EN_ATTENTE";
}

export function canRejectAGProcuration(procuration: AGProcurationItem) {
  return String(procuration.statut ?? "").trim().toUpperCase() === "EN_ATTENTE";
}