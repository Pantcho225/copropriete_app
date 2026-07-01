// src/store/authStore.ts
import { create } from "zustand";

type AuthState = {
  access: string | null;
  refresh: string | null;
  coproprieteId: string | null;
  coproprieteName: string | null;
  coproprieteLogoUrl: string | null;

  // ✅ Amélioration: état dérivé, pratique dans tout le frontend
  isAuthenticated: boolean;

  // Actions
  setAuth: (payload: { access: string; refresh: string }) => void;
  setCopropriete: (id: string | number | null) => void;
  setCoproprieteBranding: (payload: {
    name?: string | null;
    logoUrl?: string | null;
  }) => void;
  logout: () => void;

  // ✅ Bonus: helper (souvent utile pour axios/interceptors)
  getAccessToken: () => string | null;
};

const KEY_ACCESS = "access";
const KEY_REFRESH = "refresh";
const KEY_COPRO = "coproprieteId";
const KEY_COPRO_NAME = "activeCoproprieteName";
const KEY_COPRO_LOGO_URL = "activeCoproprieteLogoUrl";

export const useAuthStore = create<AuthState>((set, get) => {
  const initialAccess = localStorage.getItem(KEY_ACCESS);
  const initialRefresh = localStorage.getItem(KEY_REFRESH);
  const initialCopro = localStorage.getItem(KEY_COPRO);
  const initialCoproName = localStorage.getItem(KEY_COPRO_NAME);
  const initialCoproLogoUrl = localStorage.getItem(KEY_COPRO_LOGO_URL);

  return {
    access: initialAccess,
    refresh: initialRefresh,
    coproprieteId: initialCopro,
    coproprieteName: initialCoproName,
    coproprieteLogoUrl: initialCoproLogoUrl,

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
        localStorage.removeItem(KEY_COPRO_NAME);
        localStorage.removeItem(KEY_COPRO_LOGO_URL);
        set({
          coproprieteId: null,
          coproprieteName: null,
          coproprieteLogoUrl: null,
        });
        return;
      }

      const v = String(id);
      localStorage.setItem(KEY_COPRO, v);
      localStorage.removeItem(KEY_COPRO_NAME);
      localStorage.removeItem(KEY_COPRO_LOGO_URL);

      set({
        coproprieteId: v,
        coproprieteName: null,
        coproprieteLogoUrl: null,
      });
    },

    setCoproprieteBranding: ({ name, logoUrl }) => {
      const normalizedName = String(name ?? "").trim();
      const normalizedLogoUrl = String(logoUrl ?? "").trim();

      if (normalizedName) {
        localStorage.setItem(KEY_COPRO_NAME, normalizedName);
      } else {
        localStorage.removeItem(KEY_COPRO_NAME);
      }

      if (normalizedLogoUrl) {
        localStorage.setItem(KEY_COPRO_LOGO_URL, normalizedLogoUrl);
      } else {
        localStorage.removeItem(KEY_COPRO_LOGO_URL);
      }

      set({
        coproprieteName: normalizedName || null,
        coproprieteLogoUrl: normalizedLogoUrl || null,
      });
    },

    logout: () => {
      localStorage.removeItem(KEY_ACCESS);
      localStorage.removeItem(KEY_REFRESH);
      localStorage.removeItem(KEY_COPRO);
      localStorage.removeItem(KEY_COPRO_NAME);
      localStorage.removeItem(KEY_COPRO_LOGO_URL);
      set({
        access: null,
        refresh: null,
        coproprieteId: null,
        coproprieteName: null,
        coproprieteLogoUrl: null,
        isAuthenticated: false,
      });
    },

    getAccessToken: () => {
      // priorité au store (state), fallback localStorage si besoin
      return get().access ?? localStorage.getItem(KEY_ACCESS);
    },
  };
});