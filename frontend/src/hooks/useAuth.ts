import { useState, useCallback } from 'react';

const API_URL = import.meta.env.VITE_API_URL || '';
const TOKEN_KEY = 'auth_token';

interface User {
  username: string;
  birthDate: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
}

interface ApiError {
  message: string;
}

function getStoredAuth(): AuthState {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) return { user: null, token: null };
  try {
    const payload = JSON.parse(atob(token.split('.')[1]!));
    return {
      token,
      user: { username: payload.sub, birthDate: '' },
    };
  } catch {
    localStorage.removeItem(TOKEN_KEY);
    return { user: null, token: null };
  }
}

async function apiPost(path: string, body: unknown) {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw data as ApiError;
  return data;
}

function storeToken(token: string | null) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

export default function useAuth() {
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
    email: string
  ) => {
    setLoading(true);
    try {
      const data = await apiPost('/api/auth/register', {
        username, password, passwordConfirm, birthDate, email,
      });
      updateAuth({ token: data.token, user: data.user });
    } finally {
      setLoading(false);
    }
  }, [updateAuth]);

  const forgotPassword = useCallback(async (username: string) => {
    setLoading(true);
    try {
      return await apiPost('/api/auth/forgot-password', { username }) as { message: string; token?: string };
    } finally {
      setLoading(false);
    }
  }, []);

  const resetPassword = useCallback(async (token: string, newPassword: string, newPasswordConfirm: string) => {
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

  return {
    user: auth.user,
    token: auth.token,
    isAuthenticated: !!auth.token,
    loading,
    login,
    register,
    forgotPassword,
    resetPassword,
    logout,
  };
}
