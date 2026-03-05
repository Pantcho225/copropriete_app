// src/api/axios.ts
import axios, { AxiosError } from "axios";
import type { AxiosRequestConfig, InternalAxiosRequestConfig } from "axios";
import { API_BASE_URL } from "../config";
import { ENDPOINTS } from "./endpoints";
import { useAuthStore } from "../store/authStore";

type RefreshResponse = { access?: string; refresh?: string; token?: string };

type RetriableConfig = AxiosRequestConfig & {
  _retry?: boolean;
};

// ---------------------------
// Helpers: baseURL robuste
// ---------------------------
function normalizeBaseUrl(url: string) {
  let u = String(url ?? "").replace(/\/+$/, "");
  u = u.replace(/\/api$/i, ""); // retire /api si présent
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
  // url peut être relatif ("/api/...") ou absolu selon axios
  return url.includes(login) || url.includes(refresh);
}

function getCoproIdHeaderValue(): string | null {
  const st = useAuthStore.getState();
  const copro = st.coproprieteId ?? localStorage.getItem("coproprieteId");
  const v = (copro ?? "").trim();
  return v ? v : null;
}

// ---------------------------
// Axios instance
// ---------------------------
const api = axios.create({
  baseURL: BASE, // ex: http://127.0.0.1:8002
  timeout: 30000,
});

// ---------------------------
// Request: headers (Bearer + copro)
// ---------------------------
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const st = useAuthStore.getState();

  config.headers = config.headers ?? {};
  config.headers.Accept = "application/json";

  // Bearer
  if (st.access) {
    config.headers.Authorization = `Bearer ${st.access}`;
  }

  // X-Copropriete-Id (ne jamais envoyer vide)
  const copro = getCoproIdHeaderValue();
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
  (r) => r,
  async (error: AxiosError) => {
    const original = error.config as RetriableConfig | undefined;
    const status = error.response?.status;

    if (!original || status !== 401 || original._retry) {
      return Promise.reject(error);
    }

    // Évite boucle si 401 sur login/refresh
    if (isAuthEndpoint(original.url)) {
      const st = useAuthStore.getState();
      st.logout?.();
      return Promise.reject(error);
    }

    const st = useAuthStore.getState();
    if (!st.refresh) {
      st.logout?.();
      return Promise.reject(error);
    }

    // IMPORTANT: si pas de coproId, refresh impossible sur ton backend
    const copro = getCoproIdHeaderValue();
    if (!copro) {
      st.logout?.();
      return Promise.reject(error);
    }

    original._retry = true;

    // Si refresh déjà en cours, on met en file d'attente
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        enqueue((newAccess) => {
          if (!newAccess) return reject(error);
          original.headers = original.headers ?? {};
          (original.headers as any).Authorization = `Bearer ${newAccess}`;
          // sécurité: réinjecte aussi le header copro
          (original.headers as any)["X-Copropriete-Id"] = copro;
          resolve(api(original));
        });
      });
    }

    isRefreshing = true;

    try {
      // axios "nu" pour éviter boucle d'interceptors
      const res = await axios.post<RefreshResponse>(
        `${BASE}${withLeadingSlash(ENDPOINTS.refresh)}`,
        { refresh: st.refresh },
        {
          headers: {
            Accept: "application/json",
            "X-Copropriete-Id": copro,
          },
          timeout: 30000,
        }
      );

      const newAccess = res.data?.access ?? res.data?.token ?? null;
      const newRefresh = res.data?.refresh ?? st.refresh;

      if (!newAccess) throw new Error("Refresh did not return access token.");

      st.setAuth?.({ access: newAccess, refresh: newRefresh });

      flush(newAccess);

      // rejoue la requête originale
      original.headers = original.headers ?? {};
      (original.headers as any).Authorization = `Bearer ${newAccess}`;
      (original.headers as any)["X-Copropriete-Id"] = copro;

      return api(original);
    } catch (e) {
      flush(null);
      st.logout?.();
      return Promise.reject(e);
    } finally {
      isRefreshing = false;
    }
  }
);

export default api;