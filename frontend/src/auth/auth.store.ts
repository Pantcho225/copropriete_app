export type Tokens = { access: string; refresh: string };

const LS_TOKENS = "auth.tokens";
const LS_COPRO_ID = "auth.coproId";

export const authStore = {
  getTokens(): Tokens | null {
    const raw = localStorage.getItem(LS_TOKENS);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as Tokens;
    } catch {
      return null;
    }
  },
  setTokens(tokens: Tokens) {
    localStorage.setItem(LS_TOKENS, JSON.stringify(tokens));
  },
  clearTokens() {
    localStorage.removeItem(LS_TOKENS);
  },

  getCoproId(): string | null {
    return localStorage.getItem(LS_COPRO_ID);
  },
  setCoproId(coproId: string) {
    localStorage.setItem(LS_COPRO_ID, coproId);
  },
  clearCoproId() {
    localStorage.removeItem(LS_COPRO_ID);
  },
};