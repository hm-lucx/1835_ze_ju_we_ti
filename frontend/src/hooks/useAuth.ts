import { useState, useCallback, useEffect } from 'react';

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

export default function useAuth() {
  const [auth, setAuth] = useState<AuthState>(getStoredAuth);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (auth.token) {
      localStorage.setItem(TOKEN_KEY, auth.token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  }, [auth.token]);

  const login = useCallback(async (username: string, password: string) => {
    setLoading(true);
    try {
      const data = await apiPost('/api/auth/login', { username, password });
      setAuth({ token: data.token, user: data.user });
    } finally {
      setLoading(false);
    }
  }, []);

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
      setAuth({ token: data.token, user: data.user });
    } finally {
      setLoading(false);
    }
  }, []);

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
    setAuth({ user: null, token: null });
  }, []);

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
