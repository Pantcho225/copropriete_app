// src/api/axios.ts
import axios, { AxiosError } from "axios";
import type { AxiosRequestConfig, InternalAxiosRequestConfig } from "axios";
import { API_BASE_URL } from "../config";
import { ENDPOINTS } from "./endpoints";
import { useAuthStore } from "../store/authStore";

type RefreshResponse = {
  access?: string;
  refresh?: string;
  token?: string;
};

type RetriableConfig = AxiosRequestConfig & {
  _retry?: boolean;
};

// ---------------------------
// Helpers: baseURL robuste
// ---------------------------
function normalizeBaseUrl(url: string) {
  let u = String(url ?? "").trim().replace(/\/+$/, "");
  u = u.replace(/\/api$/i, "");
  return u;
}
const BASE = normalizeBaseUrl(API_BASE_URL);

function withLeadingSlash(p: string) {
  return p.startsWith("/") ? p : `/${p}`;
}

function isAuthEndpoint(url?: string) {
  if (!url) return false;
  const login = withLeadingSlash(ENDPOINTS.login);
  const refresh = withLeadingSlash(ENDPOINTS.refresh);
  return url.includes(login) || url.includes(refresh);
}

function getStoredAccess(): string | null {
  const st = useAuthStore.getState();
  const candidates = [
    st.access,
    localStorage.getItem("access"),
    localStorage.getItem("accessToken"),
    localStorage.getItem("token"),
  ];

  for (const v of candidates) {
    const s = String(v ?? "").trim();
    if (s) return s;
  }
  return null;
}

function getStoredRefresh(): string | null {
  const st = useAuthStore.getState();
  const candidates = [
    st.refresh,
    localStorage.getItem("refresh"),
    localStorage.getItem("refreshToken"),
  ];

  for (const v of candidates) {
    const s = String(v ?? "").trim();
    if (s) return s;
  }
  return null;
}

function getCoproIdHeaderValue(): string | null {
  const st = useAuthStore.getState();
  const copro = st.coproprieteId ?? localStorage.getItem("coproprieteId");
  const v = String(copro ?? "").trim();
  return v ? v : null;
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
    //
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
    //
  }
}

// ---------------------------
// Axios instance
// ---------------------------
const api = axios.create({
  baseURL: BASE,
  timeout: 30000,
});

// ---------------------------
// Request: headers (Bearer + copro)
// ---------------------------
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const access = getStoredAccess();
  const copro = getCoproIdHeaderValue();

  config.headers = config.headers ?? {};
  config.headers.Accept = "application/json";

  if (!config.headers["Content-Type"] && config.data && !(config.data instanceof FormData)) {
    config.headers["Content-Type"] = "application/json";
  }

  if (access) {
    config.headers.Authorization = `Bearer ${access}`;
  }

  if (copro) {
    config.headers["X-Copropriete-Id"] = copro;
  }

  return config;
});

// ---------------------------
// Response: refresh automatique sur 401
// ---------------------------
let isRefreshing = false;
let queue: Array<(token: string | null) => void> = [];

function enqueue(cb: (token: string | null) => void) {
  queue.push(cb);
}

function flush(token: string | null) {
  for (const cb of queue) cb(token);
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
      const st = useAuthStore.getState();
      clearPersistedTokens();
      st.logout?.();
      return Promise.reject(error);
    }

    const st = useAuthStore.getState();
    const refresh = getStoredRefresh();
    const copro = getCoproIdHeaderValue();

    if (!refresh) {
      clearPersistedTokens();
      st.logout?.();
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
          (original.headers as Record<string, string>).Authorization = `Bearer ${newAccess}`;

          if (copro) {
            (original.headers as Record<string, string>)["X-Copropriete-Id"] = copro;
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

      if (copro) {
        refreshHeaders["X-Copropriete-Id"] = copro;
      }

      const res = await axios.post<RefreshResponse>(
        `${BASE}${withLeadingSlash(ENDPOINTS.refresh)}`,
        { refresh },
        {
          headers: refreshHeaders,
          timeout: 30000,
        }
      );

      const newAccess = String(res.data?.access ?? res.data?.token ?? "").trim();
      const newRefresh = String(res.data?.refresh ?? refresh ?? "").trim();

      if (!newAccess) {
        throw new Error("Refresh did not return an access token.");
      }

      st.setAuth?.({
        access: newAccess,
        refresh: newRefresh || refresh,
      });

      persistTokens(newAccess, newRefresh || refresh);
      flush(newAccess);

      original.headers = original.headers ?? {};
      (original.headers as Record<string, string>).Authorization = `Bearer ${newAccess}`;

      if (copro) {
        (original.headers as Record<string, string>)["X-Copropriete-Id"] = copro;
      }

      return api(original);
    } catch (refreshError) {
      flush(null);
      clearPersistedTokens();
      st.logout?.();
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);

export default api;