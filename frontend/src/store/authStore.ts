// src/store/authStore.ts
import { create } from "zustand";

type AuthState = {
  access: string | null;
  refresh: string | null;
  coproprieteId: string | null;

  // ✅ Amélioration: état dérivé, pratique dans tout le frontend
  isAuthenticated: boolean;

  // Actions
  setAuth: (payload: { access: string; refresh: string }) => void;
  setCopropriete: (id: string | number | null) => void;
  logout: () => void;

  // ✅ Bonus: helper (souvent utile pour axios/interceptors)
  getAccessToken: () => string | null;
};

const KEY_ACCESS = "access";
const KEY_REFRESH = "refresh";
const KEY_COPRO = "coproprieteId";

export const useAuthStore = create<AuthState>((set, get) => {
  const initialAccess = localStorage.getItem(KEY_ACCESS);
  const initialRefresh = localStorage.getItem(KEY_REFRESH);
  const initialCopro = localStorage.getItem(KEY_COPRO);

  return {
    access: initialAccess,
    refresh: initialRefresh,
    coproprieteId: initialCopro,

    // ✅ dérivé
    isAuthenticated: Boolean(initialAccess),

    setAuth: ({ access, refresh }) => {
      localStorage.setItem(KEY_ACCESS, access);
      localStorage.setItem(KEY_REFRESH, refresh);
      set({ access, refresh, isAuthenticated: true });
    },

    setCopropriete: (id) => {
      if (id === null || id === undefined || id === "") {
        localStorage.removeItem(KEY_COPRO);
        set({ coproprieteId: null });
        return;
      }
      const v = String(id);
      localStorage.setItem(KEY_COPRO, v);
      set({ coproprieteId: v });
    },

    logout: () => {
      localStorage.removeItem(KEY_ACCESS);
      localStorage.removeItem(KEY_REFRESH);
      localStorage.removeItem(KEY_COPRO);
      set({ access: null, refresh: null, coproprieteId: null, isAuthenticated: false });
    },

    getAccessToken: () => {
      // priorité au store (state), fallback localStorage si besoin
      return get().access ?? localStorage.getItem(KEY_ACCESS);
    },
  };
});