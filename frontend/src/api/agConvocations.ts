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
  parent_convocation?: number | null;
  parent_reference?: string;
  version?: number;
  is_rectificative?: boolean;
  motif_rectification?: string;
  is_active_version?: boolean;
  is_replaced_version?: boolean;
  replaced_by?: number | null;
  replaced_by_reference?: string | null;
  official_version_label?: string | null;

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

  parent_convocation_reference?: string | null;}

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
  ag_id?: number;
  ag?: number;
  created?: number;
  skipped_existing?: number;
  skipped_duplicate_link?: number;
  skipped_inactive_owner?: number;
  skipped_without_owner?: number;
  total?: number;
  message?: string;
  convocations?: AgConvocation[];
}

export interface GenererPdfConvocationResponse {
  detail: string;
  convocation: AgConvocation;
}

export interface GenererPdfsConvocationsItem {
  id: number;
  reference?: string | null;
  lot_id?: number | null;
  coproprietaire_id?: number | null;
  document_id?: number | null;
  document_url?: string | null;
}

export interface GenererPdfsConvocationsSkippedItem
  extends GenererPdfsConvocationsItem {
  reason: string;
}

export interface GenererPdfsConvocationsErrorItem {
  id: number;
  error: unknown;
}

export interface GenererPdfsConvocationsResponse {
  detail: string;
  ag_id: number;
  total: number;
  generated: number;
  skipped: number;
  errors_count: number;
  generated_items: GenererPdfsConvocationsItem[];
  skipped_items: GenererPdfsConvocationsSkippedItem[];
  errors: GenererPdfsConvocationsErrorItem[];
  convocations?: AgConvocation[];
}

export interface CreerRectificativeAgConvocationResponse {
  detail: string;
  convocation: AgConvocation;
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

export async function genererPdfsConvocationsAg(
  agId: number | string,
): Promise<GenererPdfsConvocationsResponse> {
  const response = await api.post<GenererPdfsConvocationsResponse>(
    `/api/ag/ags/${agId}/generer-pdfs-convocations/`,
  );

  return response.data;
}

export async function genererPdfConvocationAg(
  convocationId: number | string,
): Promise<GenererPdfConvocationResponse> {
  const response = await api.post<GenererPdfConvocationResponse>(
    `/api/ag/convocations/${convocationId}/generer-pdf/`,
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

export async function creerRectificativeAgConvocation(
  convocationId: number,
  motif?: string,
): Promise<CreerRectificativeAgConvocationResponse> {
  const response = await api.post<CreerRectificativeAgConvocationResponse>(
    `/api/ag/convocations/${convocationId}/creer-rectificative/`,
    { motif: motif || "Ordre du jour actualisé après envoi ou consultation." },
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

export type NotifierAgConvocationPayload = {
  canal?: AgConvocationCanal;
};

export type NotifierAgConvocationResponse = {
  detail?: string;
  document_generated?: boolean;
  already_sent?: boolean;
  convocation?: AgConvocation;
};

export async function notifierAgConvocation(
  convocationId: number,
  payload: NotifierAgConvocationPayload = {},
): Promise<AgConvocation> {
  const response = await api.post<
    NotifierAgConvocationResponse | AgConvocation
  >(`/api/ag/convocations/${convocationId}/notifier/`, payload);

  if (
    response.data &&
    typeof response.data === "object" &&
    "convocation" in response.data &&
    response.data.convocation
  ) {
    return response.data.convocation;
  }

  return response.data as AgConvocation;
}

