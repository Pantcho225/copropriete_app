// frontend/src/api/axios.ts
import axios, { AxiosError } from "axios";
import type { AxiosRequestConfig, InternalAxiosRequestConfig } from "axios";

import { API_BASE_URL, ENDPOINTS } from "./endpoints";
import { useAuthStore } from "../store/authStore";

type RefreshResponse = {
  access?: string;
  refresh?: string;
  token?: string;
};

type RetriableConfig = AxiosRequestConfig & {
  _retry?: boolean;
};

// ===========================
// Helpers — baseURL robuste
// ===========================
function normalizeBaseUrl(url: string) {
  let value = String(url ?? "").trim().replace(/\/+$/, "");
  value = value.replace(/\/api$/i, "");
  return value;
}

const BASE = normalizeBaseUrl(API_BASE_URL);

function withLeadingSlash(path: string) {
  return path.startsWith("/") ? path : `/${path}`;
}

function isAuthEndpoint(url?: string) {
  if (!url) return false;

  const login = withLeadingSlash(ENDPOINTS.login);
  const refresh = withLeadingSlash(ENDPOINTS.refresh);

  return url.includes(login) || url.includes(refresh);
}

// ===========================
// Helpers — stockage auth
// ===========================
function getStoredAccess(): string | null {
  const state = useAuthStore.getState();

  const candidates = [
    state.access,
    localStorage.getItem("access"),
    localStorage.getItem("accessToken"),
    localStorage.getItem("token"),
  ];

  for (const value of candidates) {
    const token = String(value ?? "").trim();
    if (token) return token;
  }

  return null;
}

function getStoredRefresh(): string | null {
  const state = useAuthStore.getState();

  const candidates = [
    state.refresh,
    localStorage.getItem("refresh"),
    localStorage.getItem("refreshToken"),
  ];

  for (const value of candidates) {
    const token = String(value ?? "").trim();
    if (token) return token;
  }

  return null;
}

function getCoproIdHeaderValue(): string | null {
  const state = useAuthStore.getState();

  const candidates = [
    state.coproprieteId,
    localStorage.getItem("coproprieteId"),
    localStorage.getItem("copropriete_id"),
    localStorage.getItem("activeCoproprieteId"),
  ];

  for (const value of candidates) {
    const coproprieteId = String(value ?? "").trim();
    if (coproprieteId) return coproprieteId;
  }

  return null;
}

function persistTokens(access: string, refresh?: string | null) {
  try {
    localStorage.setItem("access", access);
    localStorage.setItem("accessToken", access);
    localStorage.setItem("token", access);

    if (refresh) {
      localStorage.setItem("refresh", refresh);
      localStorage.setItem("refreshToken", refresh);
    }
  } catch {
    // localStorage indisponible ou bloqué.
  }
}

function clearPersistedTokens() {
  try {
    localStorage.removeItem("access");
    localStorage.removeItem("accessToken");
    localStorage.removeItem("token");
    localStorage.removeItem("refresh");
    localStorage.removeItem("refreshToken");
  } catch {
    // localStorage indisponible ou bloqué.
  }
}

function updateAuthStoreTokens(access: string, refresh?: string | null) {
  const state = useAuthStore.getState();

  const safeRefresh = String(
    refresh ??
      localStorage.getItem("refresh") ??
      localStorage.getItem("refreshToken") ??
      "",
  ).trim();

  if (typeof state.setAuth === "function") {
    state.setAuth({
      access,
      refresh: safeRefresh,
    });
  }
}

function logoutSafely() {
  const state = useAuthStore.getState();

  clearPersistedTokens();

  if (typeof state.logout === "function") {
    state.logout();
  }
}

// ===========================
// Axios instance
// ===========================
const api = axios.create({
  baseURL: BASE,
  timeout: 30000,
});

// ===========================
// Request interceptor
// Bearer + X-Copropriete-Id
// ===========================
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const access = getStoredAccess();
  const coproprieteId = getCoproIdHeaderValue();

  config.headers = config.headers ?? {};
  config.headers.Accept = "application/json";

  if (
    !config.headers["Content-Type"] &&
    config.data &&
    !(config.data instanceof FormData)
  ) {
    config.headers["Content-Type"] = "application/json";
  }

  if (access) {
    config.headers.Authorization = `Bearer ${access}`;
  }

  if (coproprieteId) {
    config.headers["X-Copropriete-Id"] = coproprieteId;
  }

  return config;
});

// ===========================
// Response interceptor
// Refresh automatique sur 401
// ===========================
let isRefreshing = false;
let queue: Array<(token: string | null) => void> = [];

function enqueue(callback: (token: string | null) => void) {
  queue.push(callback);
}

function flush(token: string | null) {
  for (const callback of queue) {
    callback(token);
  }

  queue = [];
}

api.interceptors.response.use(
  (response) => response,

  async (error: AxiosError) => {
    const original = error.config as RetriableConfig | undefined;
    const status = error.response?.status;

    if (!original || status !== 401 || original._retry) {
      return Promise.reject(error);
    }

    if (isAuthEndpoint(original.url)) {
      logoutSafely();
      return Promise.reject(error);
    }

    const refresh = getStoredRefresh();
    const coproprieteId = getCoproIdHeaderValue();

    if (!refresh) {
      logoutSafely();
      return Promise.reject(error);
    }

    original._retry = true;

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        enqueue((newAccess) => {
          if (!newAccess) {
            reject(error);
            return;
          }

          original.headers = original.headers ?? {};
          (original.headers as Record<string, string>).Authorization =
            `Bearer ${newAccess}`;

          if (coproprieteId) {
            (original.headers as Record<string, string>)["X-Copropriete-Id"] =
              coproprieteId;
          }

          resolve(api(original));
        });
      });
    }

    isRefreshing = true;

    try {
      const refreshHeaders: Record<string, string> = {
        Accept: "application/json",
        "Content-Type": "application/json",
      };

      if (coproprieteId) {
        refreshHeaders["X-Copropriete-Id"] = coproprieteId;
      }

      const response = await axios.post<RefreshResponse>(
        `${BASE}${withLeadingSlash(ENDPOINTS.refresh)}`,
        { refresh },
        {
          headers: refreshHeaders,
          timeout: 30000,
        },
      );

      const newAccess = String(
        response.data?.access ?? response.data?.token ?? "",
      ).trim();

      const newRefresh = String(response.data?.refresh ?? refresh ?? "").trim();

      if (!newAccess) {
        throw new Error(
          "Le refresh token n'a pas retourné de nouveau access token.",
        );
      }

      updateAuthStoreTokens(newAccess, newRefresh || refresh);
      persistTokens(newAccess, newRefresh || refresh);
      flush(newAccess);

      original.headers = original.headers ?? {};
      (original.headers as Record<string, string>).Authorization =
        `Bearer ${newAccess}`;

      if (coproprieteId) {
        (original.headers as Record<string, string>)["X-Copropriete-Id"] =
          coproprieteId;
      }

      return api(original);
    } catch (refreshError) {
      flush(null);
      logoutSafely();
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  },
);

export default api;