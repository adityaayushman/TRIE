"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { API_URL } from "./api";

export interface Account {
  id: string;
  email: string;
  organisation: string;
  created_at: string;
}

interface AuthState {
  account: Account | null;
  token: string | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, organisation: string) => Promise<void>;
  signOut: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

/** localStorage, not a cookie: the API authenticates with a bearer header and
 * sets no cookie, so there is nothing for the server to read anyway. The
 * honest trade-off is that a token here is readable by any script on the
 * page — acceptable while the token only grants "may post telemetry", and
 * the reason `httpOnly` cookies would be the move if this ever carried more. */
const TOKEN_KEY = "trie.token";

async function post<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const detail = await response
      .json()
      .then((d) => d.detail)
      .catch(() => null);
    // FastAPI validation errors arrive as a list of objects, not a string;
    // rendering that raw would show "[object Object]" to the user.
    throw new Error(
      typeof detail === "string" ? detail : `Request failed (${response.status})`
    );
  }
  return response.json();
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [account, setAccount] = useState<Account | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Revalidate a stored token on load: it may be expired, or signed by a
  // previous deployment's key. Trusting it blindly would show a signed-in
  // shell whose every write then 401s.
  useEffect(() => {
    const stored = typeof window === "undefined" ? null : localStorage.getItem(TOKEN_KEY);
    if (!stored) {
      setLoading(false);
      return;
    }
    fetch(`${API_URL}/auth/me`, { headers: { Authorization: `Bearer ${stored}` } })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("stale token"))))
      .then((me: Account) => {
        setAccount(me);
        setToken(stored);
      })
      .catch(() => localStorage.removeItem(TOKEN_KEY))
      .finally(() => setLoading(false));
  }, []);

  const adopt = useCallback((payload: { access_token: string; user: Account }) => {
    localStorage.setItem(TOKEN_KEY, payload.access_token);
    setToken(payload.access_token);
    setAccount(payload.user);
  }, []);

  const signIn = useCallback(
    async (email: string, password: string) => {
      adopt(await post("/auth/login", { email, password }));
    },
    [adopt]
  );

  const register = useCallback(
    async (email: string, password: string, organisation: string) => {
      adopt(await post("/auth/register", { email, password, organisation }));
    },
    [adopt]
  );

  const signOut = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setAccount(null);
  }, []);

  const value = useMemo(
    () => ({ account, token, loading, signIn, register, signOut }),
    [account, token, loading, signIn, register, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside <AuthProvider>");
  return context;
}
