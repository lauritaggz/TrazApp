import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  clearAccessToken,
  getAccessToken,
  setAccessToken,
} from "@/lib/tokenStorage";
import * as authService from "@/services/authService";
import { ApiError, type LoginRequest, type Productor } from "@/types/auth";

interface AuthContextValue {
  productor: Productor | null;
  isAuthenticated: boolean;
  isBootstrapping: boolean;
  login: (payload: LoginRequest) => Promise<void>;
  logout: () => void;
  setProductor: (productor: Productor | null) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [productor, setProductor] = useState<Productor | null>(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function restoreSession() {
      const token = getAccessToken();
      if (!token) {
        if (!cancelled) setIsBootstrapping(false);
        return;
      }

      try {
        const current = await authService.getCurrentProductor();
        if (!cancelled) setProductor(current);
      } catch (error) {
        clearAccessToken();
        if (!cancelled) setProductor(null);
        if (!(error instanceof ApiError)) {
          // Keep bootstrap silent for unexpected errors; user can retry login.
        }
      } finally {
        if (!cancelled) setIsBootstrapping(false);
      }
    }

    void restoreSession();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (payload: LoginRequest) => {
    const response = await authService.login(payload);
    setAccessToken(response.access_token);
    setProductor(response.productor);
  }, []);

  const logout = useCallback(() => {
    clearAccessToken();
    setProductor(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      productor,
      isAuthenticated: productor !== null,
      isBootstrapping,
      login,
      logout,
      setProductor,
    }),
    [productor, isBootstrapping, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth debe usarse dentro de AuthProvider");
  }
  return context;
}
