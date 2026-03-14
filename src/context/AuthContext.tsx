'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from 'react';
import { apiEnabled, apiFetch, getToken, setToken, clearToken } from '../lib/api';

interface User {
  id: string;
  email: string;
}

interface Session {
  access_token: string;
}

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isGuest: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string) => Promise<{ error: string | null; needsConfirmation: boolean }>;
  signOut: () => Promise<void>;
  skipAuth: () => void;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  session: null,
  isLoading: true,
  isGuest: false,
  signIn: async () => ({ error: null }),
  signUp: async () => ({ error: null, needsConfirmation: false }),
  signOut: async () => {},
  skipAuth: () => {},
});

export function AuthContextProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGuest, setIsGuest] = useState(false);

  // Restore session from stored JWT on mount
  useEffect(() => {
    if (!apiEnabled) {
      setIsLoading(false);
      return;
    }

    const token = getToken();
    if (!token) {
      setIsLoading(false);
      return;
    }

    // Validate the stored token
    apiFetch<{ user: User }>('/auth/me')
      .then((data) => {
        setUser(data.user);
        setSession({ access_token: token });
      })
      .catch((err: Error & { status?: number }) => {
        // 401 means token is expired/invalid — clear it
        if (err.status === 401) {
          clearToken();
        }
        // Network error — keep token, user can retry later
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  const signIn = async (email: string, password: string) => {
    if (!apiEnabled) return { error: 'Auth not configured' };
    try {
      const data = await apiFetch<{ user: User; token: string }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      setToken(data.token);
      setUser(data.user);
      setSession({ access_token: data.token });
      return { error: null };
    } catch (err) {
      if (err instanceof Error) {
        return { error: err.message };
      }
      return { error: 'Unable to connect. Check your internet connection.' };
    }
  };

  const signUp = async (email: string, password: string) => {
    if (!apiEnabled) return { error: 'Auth not configured', needsConfirmation: false };
    try {
      const data = await apiFetch<{ user: User; token: string }>('/auth/signup', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      setToken(data.token);
      setUser(data.user);
      setSession({ access_token: data.token });
      // No email confirmation with self-hosted auth
      return { error: null, needsConfirmation: false };
    } catch (err) {
      if (err instanceof Error) {
        return { error: err.message, needsConfirmation: false };
      }
      return { error: 'Unable to connect. Check your internet connection.', needsConfirmation: false };
    }
  };

  const signOut = async () => {
    if (isGuest) {
      setIsGuest(false);
      return;
    }
    clearToken();
    setUser(null);
    setSession(null);
  };

  const skipAuth = () => {
    setIsGuest(true);
  };

  return (
    <AuthContext.Provider value={{ user, session, isLoading, isGuest, signIn, signUp, signOut, skipAuth }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
