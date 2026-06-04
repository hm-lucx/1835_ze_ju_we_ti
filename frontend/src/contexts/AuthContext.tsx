import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { apiPost } from '../lib/api';

const TOKEN_KEY = 'auth_token';

interface User {
  username: string;
  birthDate: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
}

interface AuthContextValue extends AuthState {
  isAuthenticated: boolean;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string, passwordConfirm: string, birthDate: string, email: string) => Promise<void>;
  forgotPassword: (username: string) => Promise<{ message: string }>;
  resetPassword: (token: string, newPassword: string, newPasswordConfirm: string) => Promise<{ message: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function storeToken(token: string | null) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

function getStoredAuth(): AuthState {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) return { user: null, token: null };
  try {
    const payload = JSON.parse(atob(token.split('.')[1]!));
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      localStorage.removeItem(TOKEN_KEY);
      return { user: null, token: null };
    }
    return {
      token,
      user: { username: payload.sub, birthDate: payload.birthDate || '' },
    };
  } catch {
    localStorage.removeItem(TOKEN_KEY);
    return { user: null, token: null };
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<AuthState>(getStoredAuth);
  const [loading, setLoading] = useState(false);

  const updateAuth = useCallback((next: AuthState) => {
    storeToken(next.token);
    setAuth(next);
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    setLoading(true);
    try {
      const data = await apiPost('/api/auth/login', { username, password });
      updateAuth({ token: data.token, user: data.user });
    } finally {
      setLoading(false);
    }
  }, [updateAuth]);

  const register = useCallback(async (
    username: string,
    password: string,
    passwordConfirm: string,
    birthDate: string,
    email: string,
  ) => {
    setLoading(true);
    try {
      const data = await apiPost('/api/auth/register', { username, password, passwordConfirm, birthDate, email });
      updateAuth({ token: data.token, user: data.user });
    } finally {
      setLoading(false);
    }
  }, [updateAuth]);

  const forgotPassword = useCallback(async (username: string) => {
    setLoading(true);
    try {
      return await apiPost('/api/auth/forgot-password', { username }) as { message: string };
    } finally {
      setLoading(false);
    }
  }, []);

  const resetPassword = useCallback(async (
    token: string,
    newPassword: string,
    newPasswordConfirm: string,
  ) => {
    setLoading(true);
    try {
      return await apiPost('/api/auth/reset-password', { token, newPassword, newPasswordConfirm }) as { message: string };
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    updateAuth({ user: null, token: null });
  }, [updateAuth]);

  return (
    <AuthContext.Provider value={{
      user: auth.user,
      token: auth.token,
      isAuthenticated: !!auth.token,
      loading,
      login,
      register,
      forgotPassword,
      resetPassword,
      logout,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
