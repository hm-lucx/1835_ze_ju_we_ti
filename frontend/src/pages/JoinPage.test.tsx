import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import JoinPage from './JoinPage';

const mockToken = 'test-token';
const mockNavigate = vi.fn();
const mockApiPost = vi.fn();

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { username: 'player1', birthDate: '2000-01-01' },
    token: mockToken,
    isAuthenticated: true,
    loading: false,
    login: vi.fn(),
    register: vi.fn(),
    forgotPassword: vi.fn(),
    resetPassword: vi.fn(),
    logout: vi.fn(),
  }),
  AuthProvider: ({ children }: any) => children,
}));

vi.mock('../lib/api', () => ({
  apiPost: (...args: any[]) => mockApiPost(...args),
  apiGet: vi.fn(),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual as any,
    useNavigate: () => mockNavigate,
  };
});

beforeEach(() => {
  vi.clearAllMocks();
});

function renderWithRoute(gameId: string, token: string) {
  return render(
    <MemoryRouter initialEntries={[`/join?game=${gameId}&token=${token}`]}>
      <JoinPage />
    </MemoryRouter>
  );
}

describe('JoinPage', () => {
  it('zeigt Beitritts-Status beim Laden', () => {
    mockApiPost.mockResolvedValueOnce(new Promise(() => {}));
    renderWithRoute('game-1', 'valid-token');
    expect(screen.getByText('Wird der Runde beigetreten…')).toBeInTheDocument();
  });

  it('zeigt Erfolgsmeldung bei erfolgreichem Beitritt', async () => {
    mockApiPost.mockResolvedValueOnce({
      message: 'Du bist der Runde beigetreten.',
      game: { id: 'game-1', status: 'LOBBY' },
    });

    renderWithRoute('game-1', 'valid-token');

    await waitFor(() => {
      expect(screen.getByText('Du bist der Runde beigetreten.')).toBeInTheDocument();
    });
    expect(screen.getByText('Weiterleitung zur Lobby…')).toBeInTheDocument();
  });

  it('zeigt Fehlermeldung bei fehlgeschlagenem Beitritt', async () => {
    mockApiPost.mockRejectedValueOnce({ message: 'Diese Runde hat bereits begonnen.' });

    renderWithRoute('game-1', 'valid-token');

    await waitFor(() => {
      expect(screen.getByText('Diese Runde hat bereits begonnen.')).toBeInTheDocument();
    });
    expect(screen.getByText('Zum Dashboard')).toBeInTheDocument();
  });

  it('zeigt Fehler bei fehlenden Query-Parametern', () => {
    render(
      <MemoryRouter initialEntries={['/join']}>
        <JoinPage />
      </MemoryRouter>
    );

    expect(screen.getByText('Ungültiger Einladungslink.')).toBeInTheDocument();
  });

  it('zeigt Fehler bei fehlendem game-Parameter', () => {
    render(
      <MemoryRouter initialEntries={['/join?token=sometoken']}>
        <JoinPage />
      </MemoryRouter>
    );

    expect(screen.getByText('Ungültiger Einladungslink.')).toBeInTheDocument();
  });

  it('navigiert zur Lobby nach erfolgreichem Beitritt', async () => {
    mockApiPost.mockResolvedValueOnce({
      message: 'Du bist der Runde beigetreten.',
      game: { id: 'game-1', status: 'LOBBY' },
    });

    renderWithRoute('game-1', 'valid-token');

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/lobby?game=game-1');
    }, { timeout: 5000, interval: 100 });
  });

  it('zeigt Zur-Lobby-Button bei Fehler', async () => {
    mockApiPost.mockRejectedValueOnce({ message: 'Spielrunde nicht gefunden.' });

    renderWithRoute('game-1', 'valid-token');

    await waitFor(() => {
      expect(screen.getByText('Zum Dashboard')).toBeInTheDocument();
    }, { timeout: 5000, interval: 100 });
  });
});
