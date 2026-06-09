import api from "./axios";

export type AgConvocationStatut =
  | "GENEREE"
  | "ENVOYEE"
  | "CONSULTEE"
  | "ANNULEE";

export type AgConvocationCanal =
  | "PLATEFORME"
  | "EMAIL"
  | "SMS"
  | "WHATSAPP"
  | "PAPIER";

export interface AgConvocation {
  id: number;
  reference: string;

  ag: number;
  ag_titre?: string | null;
  ag_title?: string | null;
  ag_libelle?: string | null;
  ag_display?: string | null;
  ag_date_ag?: string | null;

  copropriete?: number | null;
  copropriete_label?: string | null;

  coproprietaire?: number | null;
  coproprietaire_nom?: string | null;
  coproprietaire_label?: string | null;
  coproprietaire_display?: string | null;
  owner_nom?: string | null;
  owner_name?: string | null;

  lot?: number | null;
  lot_numero?: string | null;
  lot_reference?: string | null;
  lot_label?: string | null;
  lot_display?: string | null;

  document?: number | null;
  document_url?: string | null;

  statut: AgConvocationStatut;
  statut_label?: string | null;

  canal: AgConvocationCanal;
  canal_label?: string | null;

  objet?: string | null;
  message?: string | null;

  generated_at?: string | null;
  generated_by?: number | null;
  generated_by_label?: string | null;

  created_at?: string | null;
  updated_at?: string | null;

  sent_at?: string | null;
  sent_by?: number | string | null;
  sent_by_label?: string | null;
  sent_by_username?: string | null;

  consulted_at?: string | null;

  cancelled_at?: string | null;
  cancelled_by?: number | null;
  cancelled_by_label?: string | null;
  cancellation_reason?: string | null;

  metadata?: Record<string, unknown> | null;
}

export interface AgConvocationListResponse {
  count?: number;
  next?: string | null;
  previous?: string | null;
  results?: AgConvocation[];
}

export interface AgConvocationFilters {
  ag?: number | string;
  statut?: AgConvocationStatut | "";
  search?: string;
}

export interface GenererConvocationsResponse {
  ag?: number;
  created?: number;
  skipped_existing?: number;
  total?: number;
  message?: string;
  convocations?: AgConvocation[];
}

function cleanParams(filters?: AgConvocationFilters) {
  const params: Record<string, string | number> = {};

  if (!filters) {
    return params;
  }

  if (filters.ag !== undefined && String(filters.ag).trim() !== "") {
    params.ag = filters.ag;
  }

  if (filters.statut) {
    params.statut = filters.statut;
  }

  if (filters.search && filters.search.trim() !== "") {
    params.search = filters.search.trim();
  }

  return params;
}

function normalizeListResponse(
  data: AgConvocation[] | AgConvocationListResponse,
): AgConvocation[] {
  if (Array.isArray(data)) {
    return data;
  }

  return data.results ?? [];
}

export async function listAgConvocations(
  filters?: AgConvocationFilters,
): Promise<AgConvocation[]> {
  const response = await api.get<AgConvocation[] | AgConvocationListResponse>(
    "/api/ag/convocations/",
    {
      params: cleanParams(filters),
    },
  );

  return normalizeListResponse(response.data);
}

export async function genererConvocationsAg(
  agId: number | string,
): Promise<GenererConvocationsResponse> {
  const response = await api.post<GenererConvocationsResponse>(
    `/api/ag/ags/${agId}/generer-convocations/`,
  );

  return response.data;
}

export async function marquerConvocationEnvoyee(
  convocationId: number,
): Promise<AgConvocation> {
  const response = await api.post<AgConvocation>(
    `/api/ag/convocations/${convocationId}/marquer-envoyee/`,
  );

  return response.data;
}

export async function marquerConvocationConsultee(
  convocationId: number,
): Promise<AgConvocation> {
  const response = await api.post<AgConvocation>(
    `/api/ag/convocations/${convocationId}/marquer-consultee/`,
  );

  return response.data;
}

export async function annulerAgConvocation(
  convocationId: number,
): Promise<AgConvocation> {
  const response = await api.post<AgConvocation>(
    `/api/ag/convocations/${convocationId}/annuler/`,
  );

  return response.data;
}