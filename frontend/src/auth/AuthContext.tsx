import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { fetchCurrentTenant, fetchMe, logout as apiLogout, type Tenant, type User } from "../api/auth";
import { tokenStore } from "../api/client";

type AuthState = {
  user: User | null;
  tenant: Tenant | null;
  loading: boolean;
  refresh: () => Promise<void>;
  signOut: () => void;
};

const AuthCtx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    if (!tokenStore.getAccess()) {
      setUser(null);
      setTenant(null);
      setLoading(false);
      return;
    }
    try {
      const [me, t] = await Promise.all([fetchMe(), fetchCurrentTenant().catch(() => null)]);
      setUser(me);
      setTenant(t);
    } catch {
      setUser(null);
      setTenant(null);
      tokenStore.clear();
    } finally {
      setLoading(false);
    }
  }

  function signOut() {
    apiLogout();
    setUser(null);
    setTenant(null);
  }

  useEffect(() => {
    void refresh();
  }, []);

  return (
    <AuthCtx.Provider value={{ user, tenant, loading, refresh, signOut }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
