import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import useAuth from './useAuth';

const TOKEN_KEY = 'auth_token';
const mockToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0dXNlciJ9.test';

const mockStorage: Record<string, string> = {};

const fakeLocalStorage = {
  getItem: (key: string) => mockStorage[key] ?? null,
  setItem: (key: string, value: string) => { mockStorage[key] = value; },
  removeItem: (key: string) => { delete mockStorage[key]; },
  clear: () => { Object.keys(mockStorage).forEach(k => delete mockStorage[k]); },
  get length() { return Object.keys(mockStorage).length; },
  key: (i: number) => Object.keys(mockStorage)[i] ?? null,
};

function mockFetchOnce(status: number, body: unknown) {
  return vi.mocked(globalThis.fetch).mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response);
}

beforeEach(() => {
  fakeLocalStorage.clear();
  vi.stubGlobal('localStorage', fakeLocalStorage);
  vi.stubGlobal('fetch', vi.fn());
});

afterAll(() => {
  vi.unstubAllGlobals();
});

describe('useAuth', () => {
  it('login() speichert Token bei Erfolg in localStorage', async () => {
    mockFetchOnce(200, { token: mockToken, user: { username: 'testuser', birthDate: '2000-01-01' } });

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.login('testuser', 'password');
    });

    expect(globalThis.localStorage.getItem(TOKEN_KEY)).toBe(mockToken);
    expect(result.current.isAuthenticated).toBe(true);
  });

  it('login() wirft Fehler bei falschen Credentials', async () => {
    mockFetchOnce(401, { message: 'Ungültiger Benutzername oder Passwort.' });

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await expect(result.current.login('testuser', 'wrong')).rejects.toEqual({
        message: 'Ungültiger Benutzername oder Passwort.',
      });
    });
    expect(globalThis.localStorage.getItem(TOKEN_KEY)).toBeNull();
  });

  it('logout() entfernt Token aus localStorage', async () => {
    globalThis.localStorage.setItem(TOKEN_KEY, mockToken);

    const { result } = renderHook(() => useAuth());

    act(() => {
      result.current.logout();
    });

    expect(globalThis.localStorage.getItem(TOKEN_KEY)).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
  });

  it('isAuthenticated aus gespeichertem Token', async () => {
    globalThis.localStorage.setItem(TOKEN_KEY, mockToken);

    const { result } = renderHook(() => useAuth());

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user?.username).toBe('testuser');
  });
});
