// src/api/rh.ts
import api from "./axios";
import { ENDPOINTS } from "./endpoints";
import type {
  ContratEmploye,
  ContratEmployePayload,
  Employe,
  EmployePayload,
  Paginated,
} from "./types";

type ListParams = {
  page?: number;
  page_size?: number;
  search?: string;
  statut?: string;
  ordering?: string;
};


function isPaginatedResponse<T>(data: unknown): data is Paginated<T> {
  return Boolean(
    data &&
      typeof data === "object" &&
      Array.isArray((data as Paginated<T>).results)
  );
}

function normalizeListResponse<T>(data: unknown): Paginated<T> {
  if (isPaginatedResponse<T>(data)) {
    return {
      count: typeof data.count === "number" ? data.count : data.results.length,
      next: data.next ?? null,
      previous: data.previous ?? null,
      results: Array.isArray(data.results) ? data.results : [],
    };
  }

  if (Array.isArray(data)) {
    return {
      count: data.length,
      next: null,
      previous: null,
      results: data as T[],
    };
  }

  return {
    count: 0,
    next: null,
    previous: null,
    results: [],
  };
}

function normalizeEmploye(data: unknown): Employe {
  return data as Employe;
}

function normalizeContrat(data: unknown): ContratEmploye {
  const raw = (data ?? {}) as ContratEmploye & {
    employe_detail?: Employe | null;
  };

  const employeIsObject =
    raw?.employe && typeof raw.employe === "object" && !Array.isArray(raw.employe);

  const employeObject = employeIsObject ? (raw.employe as Employe) : null;
  const employeDetail = raw?.employe_detail ?? employeObject ?? null;

  return {
    ...raw,
    employe: raw.employe,
    employe_detail: employeDetail,
  };
}

function normalizeContratsList(data: unknown): Paginated<ContratEmploye> {
  const paginated = normalizeListResponse<unknown>(data);

  return {
    ...paginated,
    results: paginated.results.map((item) => normalizeContrat(item)),
  };
}

// =========================
// RH — Employés
// =========================
export async function getEmployes(params?: ListParams): Promise<Paginated<Employe>> {
  const { data } = await api.get(ENDPOINTS.rhEmployes, { params });
  const normalized = normalizeListResponse<unknown>(data);

  return {
    ...normalized,
    results: normalized.results.map((item) => normalizeEmploye(item)),
  };
}

export async function getEmploye(employeId: number | string): Promise<Employe> {
  const { data } = await api.get(ENDPOINTS.rhEmployeDetail(employeId));
  return normalizeEmploye(data);
}

export async function createEmploye(payload: EmployePayload): Promise<Employe> {
  const { data } = await api.post(ENDPOINTS.rhEmployes, payload);
  return normalizeEmploye(data);
}

export async function updateEmploye(
  employeId: number | string,
  payload: Partial<EmployePayload>
): Promise<Employe> {
  const { data } = await api.patch(ENDPOINTS.rhEmployeDetail(employeId), payload);
  return normalizeEmploye(data);
}

export async function replaceEmploye(
  employeId: number | string,
  payload: EmployePayload
): Promise<Employe> {
  const { data } = await api.put(ENDPOINTS.rhEmployeDetail(employeId), payload);
  return normalizeEmploye(data);
}

export async function activerEmploye(employeId: number | string): Promise<Employe> {
  const { data } = await api.post(ENDPOINTS.rhEmployeActiver(employeId), {});
  return normalizeEmploye(data);
}

export async function desactiverEmploye(employeId: number | string): Promise<Employe> {
  const { data } = await api.post(ENDPOINTS.rhEmployeDesactiver(employeId), {});
  return normalizeEmploye(data);
}

export async function deleteEmploye(employeId: number | string): Promise<void> {
  await api.delete(ENDPOINTS.rhEmployeDetail(employeId));
}

// =========================
// RH — Contrats
// =========================
export async function getContrats(params?: ListParams): Promise<Paginated<ContratEmploye>> {
  const { data } = await api.get(ENDPOINTS.rhContrats, { params });
  return normalizeContratsList(data);
}

export async function getContrat(contratId: number | string): Promise<ContratEmploye> {
  const { data } = await api.get(ENDPOINTS.rhContratDetail(contratId));
  return normalizeContrat(data);
}

export async function createContrat(payload: ContratEmployePayload): Promise<ContratEmploye> {
  const { data } = await api.post(ENDPOINTS.rhContrats, payload);
  return normalizeContrat(data);
}

export async function updateContrat(
  contratId: number | string,
  payload: Partial<ContratEmployePayload>
): Promise<ContratEmploye> {
  const { data } = await api.patch(ENDPOINTS.rhContratDetail(contratId), payload);
  return normalizeContrat(data);
}

export async function replaceContrat(
  contratId: number | string,
  payload: ContratEmployePayload
): Promise<ContratEmploye> {
  const { data } = await api.put(ENDPOINTS.rhContratDetail(contratId), payload);
  return normalizeContrat(data);
}

export async function activerContrat(contratId: number | string): Promise<ContratEmploye> {
  const { data } = await api.post(ENDPOINTS.rhContratActiver(contratId), {});
  return normalizeContrat(data);
}

export async function cloturerContrat(contratId: number | string): Promise<ContratEmploye> {
  const { data } = await api.post(ENDPOINTS.rhContratCloturer(contratId), {});
  return normalizeContrat(data);
}

export async function deleteContrat(contratId: number | string): Promise<void> {
  await api.delete(ENDPOINTS.rhContratDetail(contratId));
}