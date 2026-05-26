import { create } from "zustand";

export type Tokens = {
  access: string;
  refresh: string;
};

type AuthState = {
  access: string | null;
  refresh: string | null;
  coproprieteId: string | null;
  isAuthenticated: boolean;

  setAuth: (tokens: Partial<Tokens>) => void;
  setTokens: (tokens: Tokens) => void;
  setCopropriete: (coproprieteId: string | number | null) => void;
  logout: () => void;
};

const LS_TOKENS = "auth.tokens";
const LS_COPRO_ID = "auth.coproId";

/**
 * Anciens alias conservés pour compatibilité avec axios.ts
 * et d’éventuels anciens composants.
 */
const LS_ACCESS = "access";
const LS_ACCESS_TOKEN = "accessToken";
const LS_TOKEN = "token";
const LS_REFRESH = "refresh";
const LS_REFRESH_TOKEN = "refreshToken";
const LS_COPRO_LEGACY = "coproprieteId";

function safeParseTokens(raw: string | null): Tokens | null {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<Tokens>;

    const access = String(parsed.access ?? "").trim();
    const refresh = String(parsed.refresh ?? "").trim();

    if (!access || !refresh) return null;

    return { access, refresh };
  } catch {
    return null;
  }
}

function getInitialTokens(): Tokens | null {
  const grouped = safeParseTokens(localStorage.getItem(LS_TOKENS));

  if (grouped) return grouped;

  const access =
    localStorage.getItem(LS_ACCESS) ||
    localStorage.getItem(LS_ACCESS_TOKEN) ||
    localStorage.getItem(LS_TOKEN) ||
    "";

  const refresh =
    localStorage.getItem(LS_REFRESH) ||
    localStorage.getItem(LS_REFRESH_TOKEN) ||
    "";

  const normalizedAccess = access.trim();
  const normalizedRefresh = refresh.trim();

  if (!normalizedAccess || !normalizedRefresh) return null;

  return {
    access: normalizedAccess,
    refresh: normalizedRefresh,
  };
}

function getInitialCoproId(): string | null {
  const value =
    localStorage.getItem(LS_COPRO_ID) ||
    localStorage.getItem(LS_COPRO_LEGACY) ||
    "";

  const normalized = value.trim();

  return normalized || null;
}

function persistTokens(tokens: Tokens) {
  localStorage.setItem(LS_TOKENS, JSON.stringify(tokens));

  /**
   * On garde ces clés aussi car axios.ts lit encore ces alias.
   * Cela évite les ruptures pendant la consolidation.
   */
  localStorage.setItem(LS_ACCESS, tokens.access);
  localStorage.setItem(LS_ACCESS_TOKEN, tokens.access);
  localStorage.setItem(LS_TOKEN, tokens.access);
  localStorage.setItem(LS_REFRESH, tokens.refresh);
  localStorage.setItem(LS_REFRESH_TOKEN, tokens.refresh);
}

function clearTokens() {
  localStorage.removeItem(LS_TOKENS);
  localStorage.removeItem(LS_ACCESS);
  localStorage.removeItem(LS_ACCESS_TOKEN);
  localStorage.removeItem(LS_TOKEN);
  localStorage.removeItem(LS_REFRESH);
  localStorage.removeItem(LS_REFRESH_TOKEN);
}

function persistCoproId(coproprieteId: string) {
  localStorage.setItem(LS_COPRO_ID, coproprieteId);

  /**
   * Alias lu par axios.ts.
   */
  localStorage.setItem(LS_COPRO_LEGACY, coproprieteId);
}

function clearCoproId() {
  localStorage.removeItem(LS_COPRO_ID);
  localStorage.removeItem(LS_COPRO_LEGACY);
}

const initialTokens = getInitialTokens();
const initialCoproId = getInitialCoproId();

export const useAuthStore = create<AuthState>((set, get) => ({
  access: initialTokens?.access ?? null,
  refresh: initialTokens?.refresh ?? null,
  coproprieteId: initialCoproId,
  isAuthenticated: Boolean(initialTokens?.access),

  setAuth: (tokens) => {
    const current = get();

    const access = String(tokens.access ?? current.access ?? "").trim();
    const refresh = String(tokens.refresh ?? current.refresh ?? "").trim();

    if (!access) {
      clearTokens();

      set({
        access: null,
        refresh: null,
        isAuthenticated: false,
      });

      return;
    }

    const nextTokens: Tokens = {
      access,
      refresh,
    };

    persistTokens(nextTokens);

    set({
      access,
      refresh,
      isAuthenticated: true,
    });
  },

  setTokens: (tokens) => {
    const access = String(tokens.access ?? "").trim();
    const refresh = String(tokens.refresh ?? "").trim();

    if (!access) {
      clearTokens();

      set({
        access: null,
        refresh: null,
        isAuthenticated: false,
      });

      return;
    }

    const nextTokens: Tokens = {
      access,
      refresh,
    };

    persistTokens(nextTokens);

    set({
      access,
      refresh,
      isAuthenticated: true,
    });
  },

  setCopropriete: (coproprieteId) => {
    const normalized = String(coproprieteId ?? "").trim();

    if (!normalized) {
      clearCoproId();

      set({
        coproprieteId: null,
      });

      return;
    }

    persistCoproId(normalized);

    set({
      coproprieteId: normalized,
    });
  },

  logout: () => {
    clearTokens();

    set({
      access: null,
      refresh: null,
      isAuthenticated: false,
    });
  },
}));

/**
 * Objet conservé pour compatibilité avec les anciens appels éventuels :
 * authStore.getTokens(), authStore.setTokens(), etc.
 */
export const authStore = {
  getTokens(): Tokens | null {
    return getInitialTokens();
  },

  setTokens(tokens: Tokens) {
    persistTokens(tokens);

    useAuthStore.setState({
      access: tokens.access,
      refresh: tokens.refresh,
      isAuthenticated: Boolean(tokens.access),
    });
  },

  clearTokens() {
    clearTokens();

    useAuthStore.setState({
      access: null,
      refresh: null,
      isAuthenticated: false,
    });
  },

  getCoproId(): string | null {
    return getInitialCoproId();
  },

  setCoproId(coproId: string) {
    const normalized = String(coproId ?? "").trim();

    if (!normalized) return;

    persistCoproId(normalized);

    useAuthStore.setState({
      coproprieteId: normalized,
    });
  },

  clearCoproId() {
    clearCoproId();

    useAuthStore.setState({
      coproprieteId: null,
    });
  },
};