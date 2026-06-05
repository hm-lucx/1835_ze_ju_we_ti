import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import DashboardPage from './DashboardPage';

const mockToken = 'test-token';
const mockUser = { username: 'host1', birthDate: '2000-01-01' };

const mockNavigate = vi.fn();
const mockApiGet = vi.fn();

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: mockUser,
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
  apiPost: vi.fn(),
  apiGet: (...args: any[]) => mockApiGet(...args),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual as any,
    useParams: () => ({ id: 'game-1' }),
    useNavigate: () => mockNavigate,
  };
});

function renderPage() {
  return render(
    <BrowserRouter>
      <DashboardPage />
    </BrowserRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('DashboardPage', () => {
  it('zeigt Ladezustand während Daten geladen werden', () => {
    mockApiGet.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByText('Lade Spielstand…')).toBeInTheDocument();
  });

  it('zeigt Eigenbalance prominent nach erfolgreichem Laden', async () => {
    mockApiGet.mockResolvedValueOnce({
      game: {
        id: 'game-1',
        host: 'host1',
        status: 'RUNNING',
        players: [
          { username: 'host1', joinedAt: new Date().toISOString() },
          { username: 'player1', joinedAt: new Date().toISOString() },
        ],
        startedAt: new Date().toISOString(),
        accounts: [
          { userId: 'u1', username: 'host1', balance: 600 },
          { userId: 'u2', username: 'player1', balance: 400 },
        ],
        bank: { balance: 11000 },
      },
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Dein Kontostand')).toBeInTheDocument();
    });
    expect(screen.getAllByText('600 €').length).toBeGreaterThanOrEqual(1);
  });

  it('zeigt Bank-Kontostand an', async () => {
    mockApiGet.mockResolvedValueOnce({
      game: {
        id: 'game-1',
        host: 'host1',
        status: 'RUNNING',
        players: [
          { username: 'host1', joinedAt: new Date().toISOString() },
          { username: 'player1', joinedAt: new Date().toISOString() },
        ],
        startedAt: new Date().toISOString(),
        accounts: [
          { userId: 'u1', username: 'host1', balance: 600 },
          { userId: 'u2', username: 'player1', balance: 400 },
        ],
        bank: { balance: 11000 },
      },
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Bank')).toBeInTheDocument();
      expect(screen.getByText('11000 €')).toBeInTheDocument();
    });
  });

  it('zeigt alle Spieler-Kontostände in Tabelle', async () => {
    mockApiGet.mockResolvedValueOnce({
      game: {
        id: 'game-1',
        host: 'host1',
        status: 'RUNNING',
        players: [
          { username: 'host1', joinedAt: new Date().toISOString() },
          { username: 'player1', joinedAt: new Date().toISOString() },
          { username: 'player2', joinedAt: new Date().toISOString() },
        ],
        startedAt: new Date().toISOString(),
        accounts: [
          { userId: 'u1', username: 'host1', balance: 600 },
          { userId: 'u2', username: 'player1', balance: 400 },
          { userId: 'u3', username: 'player2', balance: 500 },
        ],
        bank: { balance: 10500 },
      },
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('host1 (Du)')).toBeInTheDocument();
      expect(screen.getByText('player1')).toBeInTheDocument();
      expect(screen.getByText('player2')).toBeInTheDocument();
    });
  });

  it('zeigt Fehler bei API-Fehler', async () => {
    mockApiGet.mockRejectedValueOnce({ message: 'Spiel nicht gefunden.' });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Spiel nicht gefunden.')).toBeInTheDocument();
    });
  });

  it('zeigt Spiel nicht gefunden bei null game', async () => {
    mockApiGet.mockResolvedValueOnce({ game: null });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Spiel nicht gefunden.')).toBeInTheDocument();
    });
  });

  it('hat Zurück-zur-Lobby-Button', async () => {
    mockApiGet.mockResolvedValueOnce({
      game: {
        id: 'game-1',
        host: 'host1',
        status: 'RUNNING',
        players: [{ username: 'host1', joinedAt: new Date().toISOString() }],
        startedAt: new Date().toISOString(),
        accounts: [{ userId: 'u1', username: 'host1', balance: 600 }],
        bank: { balance: 11400 },
      },
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Zurück zur Lobby')).toBeInTheDocument();
    });

    await screen.getByText('Zurück zur Lobby').click();
    expect(mockNavigate).toHaveBeenCalledWith('/lobby');
  });
});
