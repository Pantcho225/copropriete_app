import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";
import { API_BASE_URL, ENDPOINTS } from "./endpoints";
import { authStore } from "../auth/auth.store";

type RefreshResponse = { access: string };

export const http = axios.create({
  baseURL: API_BASE_URL,
  timeout: 20000,
});

let isRefreshing = false;
let pending: Array<(token: string | null) => void> = [];

function subscribe(cb: (token: string | null) => void) {
  pending.push(cb);
}
function flush(token: string | null) {
  pending.forEach((cb) => cb(token));
  pending = [];
}

http.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const tokens = authStore.getTokens();
  const coproId = authStore.getCoproId();

  config.headers = config.headers ?? {};

  if (tokens?.access) config.headers.Authorization = `Bearer ${tokens.access}`;
  if (coproId) config.headers["X-Copropriete-Id"] = coproId;

  return config;
});

http.interceptors.response.use(
  (r) => r,
  async (error: AxiosError) => {
    const status = error.response?.status;
    const original = error.config as any;

    if (status !== 401 || original?._retry) throw error;

    const tokens = authStore.getTokens();
    if (!tokens?.refresh) {
      authStore.clearTokens();
      throw error;
    }

    original._retry = true;

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        subscribe((newToken) => {
          if (!newToken) return reject(error);
          original.headers = original.headers ?? {};
          original.headers.Authorization = `Bearer ${newToken}`;
          resolve(http(original));
        });
      });
    }

    isRefreshing = true;
    try {
      const r = await axios.post<RefreshResponse>(
        `${API_BASE_URL}${ENDPOINTS.refresh}`,
        { refresh: tokens.refresh },
        { timeout: 20000 }
      );

      const newAccess = r.data.access;
      authStore.setTokens({ ...tokens, access: newAccess });
      flush(newAccess);

      original.headers = original.headers ?? {};
      original.headers.Authorization = `Bearer ${newAccess}`;
      return http(original);
    } catch (e) {
      authStore.clearTokens();
      flush(null);
      throw e;
    } finally {
      isRefreshing = false;
    }
  }
);