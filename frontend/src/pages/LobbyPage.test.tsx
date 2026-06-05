import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import LobbyPage from './LobbyPage';

const mockToken = 'test-token';
const mockUser = { username: 'host1', birthDate: '2000-01-01' };

const mockNavigate = vi.fn();
const mockApiPost = vi.fn();
const mockApiGet = vi.fn();
const mockApiDelete = vi.fn();

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
  apiPost: (...args: any[]) => mockApiPost(...args),
  apiGet: (...args: any[]) => mockApiGet(...args),
  apiDelete: (...args: any[]) => mockApiDelete(...args),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual as any,
    useNavigate: () => mockNavigate,
    useSearchParams: () => [new URLSearchParams(), vi.fn()],
  };
});

function renderPage() {
  return render(
    <BrowserRouter>
      <LobbyPage />
    </BrowserRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockApiGet.mockResolvedValue({ games: [] });
});

describe('LobbyPage', () => {
  it('zeigt Erstellen-Button wenn kein Spiel geladen ist', () => {
    renderPage();
    expect(screen.getByText('Neue Runde erstellen')).toBeInTheDocument();
  });

  it('erstellt ein Spiel beim Klick auf Erstellen', async () => {
    mockApiPost.mockResolvedValueOnce({
      game: {
        id: 'game-1',
        host: 'host1',
        status: 'LOBBY',
        players: [{ username: 'host1', joinedAt: new Date().toISOString() }],
        inviteLink: 'http://localhost:5173/join?token=abc&game=game-1',
        qrCodeSvg: '<svg></svg>',
        createdAt: new Date().toISOString(),
      },
    });

    renderPage();
    await userEvent.click(screen.getByText('Neue Runde erstellen'));

    await waitFor(() => {
      expect(screen.getByText('Runde erstellt')).toBeInTheDocument();
    });
    expect(screen.getByText(/Spieler: 1 \/ 7/)).toBeInTheDocument();
  });

  it('zeigt Fehler beim Erstellen wenn API fehlschlägt', async () => {
    mockApiPost.mockRejectedValueOnce({ message: 'Fehler beim Erstellen.' });

    renderPage();
    await userEvent.click(screen.getByText('Neue Runde erstellen'));

    await waitFor(() => {
      expect(screen.getByText('Fehler beim Erstellen.')).toBeInTheDocument();
    });
  });

  it('zeigt Spielerliste nach Erstellung an', async () => {
    mockApiPost.mockResolvedValueOnce({
      game: {
        id: 'game-1',
        host: 'host1',
        status: 'LOBBY',
        players: [
          { username: 'host1', joinedAt: new Date().toISOString() },
          { username: 'player1', joinedAt: new Date().toISOString() },
        ],
        inviteLink: 'http://localhost:5173/join?token=abc&game=game-1',
        qrCodeSvg: '<svg></svg>',
        createdAt: new Date().toISOString(),
      },
    });

    renderPage();
    await userEvent.click(screen.getByText('Neue Runde erstellen'));

    await waitFor(() => {
      expect(screen.getByText('host1 (Du)')).toBeInTheDocument();
      expect(screen.getByText('player1')).toBeInTheDocument();
    });
  });

  it('Start-Button ist deaktiviert mit weniger als 3 Spielern', async () => {
    mockApiPost.mockResolvedValueOnce({
      game: {
        id: 'game-1',
        host: 'host1',
        status: 'LOBBY',
        players: [{ username: 'host1', joinedAt: new Date().toISOString() }],
        inviteLink: 'http://localhost:5173/join?token=abc&game=game-1',
        qrCodeSvg: '<svg></svg>',
        createdAt: new Date().toISOString(),
      },
    });

    renderPage();
    await userEvent.click(screen.getByText('Neue Runde erstellen'));

    await waitFor(() => {
      const startButton = screen.getByText('Spiel starten');
      expect(startButton.closest('button')).toBeDisabled();
    });

    expect(screen.getByText(/Warte auf mindestens 3 Spieler/)).toBeInTheDocument();
  });

  it('Start-Button ist aktiviert mit 3 Spielern', async () => {
    mockApiPost.mockResolvedValueOnce({
      game: {
        id: 'game-1',
        host: 'host1',
        status: 'LOBBY',
        players: [
          { username: 'host1', joinedAt: new Date().toISOString() },
          { username: 'player1', joinedAt: new Date().toISOString() },
          { username: 'player2', joinedAt: new Date().toISOString() },
        ],
        inviteLink: 'http://localhost:5173/join?token=abc&game=game-1',
        qrCodeSvg: '<svg></svg>',
        createdAt: new Date().toISOString(),
      },
    });

    renderPage();
    await userEvent.click(screen.getByText('Neue Runde erstellen'));

    await waitFor(() => {
      const startButton = screen.getByText('Spiel starten');
      expect(startButton.closest('button')).not.toBeDisabled();
    });
  });

  it('navigiert zum Dashboard nach erfolgreichem Start', async () => {
    mockApiPost.mockResolvedValueOnce({
      game: {
        id: 'game-1',
        host: 'host1',
        status: 'LOBBY',
        players: [
          { username: 'host1', joinedAt: new Date().toISOString() },
          { username: 'player1', joinedAt: new Date().toISOString() },
          { username: 'player2', joinedAt: new Date().toISOString() },
        ],
        inviteLink: 'http://localhost:5173/join?token=abc&game=game-1',
        qrCodeSvg: '<svg></svg>',
        createdAt: new Date().toISOString(),
      },
    });

    renderPage();
    await userEvent.click(screen.getByText('Neue Runde erstellen'));

    await waitFor(() => {
      expect(screen.getByText('Spiel starten')).toBeInTheDocument();
    });

    mockApiPost.mockResolvedValueOnce({
      game: {
        id: 'game-1',
        host: 'host1',
        status: 'RUNNING',
        startedAt: new Date().toISOString(),
        accounts: [
          { userId: 'u1', username: 'host1', balance: 600 },
          { userId: 'u2', username: 'player1', balance: 600 },
          { userId: 'u3', username: 'player2', balance: 600 },
        ],
        bank: { balance: 10200 },
      },
    });

    await userEvent.click(screen.getByText('Spiel starten'));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/game/game-1');
    });
  });

  it('zeigt QR-Code nach Spielerstellung an', async () => {
    mockApiPost.mockResolvedValueOnce({
      game: {
        id: 'game-1',
        host: 'host1',
        status: 'LOBBY',
        players: [{ username: 'host1', joinedAt: new Date().toISOString() }],
        inviteCode: 'ABC123',
        inviteLink: 'http://localhost:5173/join?token=abc&game=game-1',
        inviteLinkShort: 'http://localhost:5173/join/ABC123',
        qrCodeSvg: '<svg viewBox="0 0 100 100"><rect/></svg>',
        createdAt: new Date().toISOString(),
      },
    });

    renderPage();
    await userEvent.click(screen.getByText('Neue Runde erstellen'));

    await waitFor(() => {
      const qrImage = screen.getByAltText('QR-Code zum Beitreten');
      expect(qrImage).toBeInTheDocument();
      expect(qrImage).toHaveAttribute('src', expect.stringContaining('svg'));
    });
  });

  it('zeigt angemeldeten Benutzernamen an', () => {
    renderPage();
    expect(screen.getByText(/host1/)).toBeInTheDocument();
  });

  it('zeigt Runde beitreten Button im leeren Zustand', () => {
    renderPage();
    expect(screen.getByText('Runde beitreten')).toBeInTheDocument();
  });

  it('zeigt Eingabefeld nach Klick auf Runde beitreten', async () => {
    renderPage();
    await userEvent.click(screen.getByText('Runde beitreten'));
    expect(screen.getByPlaceholderText('z.B. A3F7K2')).toBeInTheDocument();
    expect(screen.getByText('Beitreten')).toBeInTheDocument();
    expect(screen.getByText('Abbrechen')).toBeInTheDocument();
  });

  it('schließt Eingabefeld bei Klick auf Abbrechen', async () => {
    renderPage();
    await userEvent.click(screen.getByText('Runde beitreten'));
    await userEvent.click(screen.getByText('Abbrechen'));
    expect(screen.queryByPlaceholderText('z.B. A3F7K2')).not.toBeInTheDocument();
  });

  it('ruft API bei gültigem Code auf und navigiert', async () => {
    mockApiPost.mockResolvedValueOnce({ roundId: 'round-1' });
    renderPage();
    await userEvent.click(screen.getByText('Runde beitreten'));
    const input = screen.getByPlaceholderText('z.B. A3F7K2');
    await userEvent.type(input, 'ABCD12');
    await userEvent.click(screen.getByText('Beitreten'));
    await waitFor(() => {
      expect(mockApiPost).toHaveBeenCalledWith('/api/rounds/join', { inviteCode: 'ABCD12' }, 'test-token');
    });
    expect(mockNavigate).toHaveBeenCalledWith('/lobby?game=round-1');
  });

  it('zeigt Fehler bei ungültigem Code', async () => {
    renderPage();
    await userEvent.click(screen.getByText('Runde beitreten'));
    const input = screen.getByPlaceholderText('z.B. A3F7K2');
    await userEvent.type(input, 'ab');
    await userEvent.click(screen.getByText('Beitreten'));
    expect(screen.getByText('Bitte gib einen gültigen 6-stelligen Code ein.')).toBeInTheDocument();
  });

  it('zeigt Fehlermeldung wenn API join fehlschlägt', async () => {
    mockApiPost.mockRejectedValueOnce({ message: 'Runde nicht gefunden.' });
    renderPage();
    await userEvent.click(screen.getByText('Runde beitreten'));
    const input = screen.getByPlaceholderText('z.B. A3F7K2');
    await userEvent.type(input, 'WRONG1');
    await userEvent.click(screen.getByText('Beitreten'));
    await waitFor(() => {
      expect(screen.getByText('Runde nicht gefunden.')).toBeInTheDocument();
    });
  });

  it('zeigt eigene Spielrunden mit Status-Badge', async () => {
    mockApiGet.mockResolvedValue({
      games: [
        {
          id: 'game-lobby',
          host: 'host1',
          status: 'LOBBY',
          createdAt: new Date().toISOString(),
          playerCount: 2,
          resumeConfirmedCount: 0,
        },
        {
          id: 'game-paused',
          host: 'other',
          status: 'PAUSED',
          createdAt: new Date().toISOString(),
          playerCount: 4,
          resumeConfirmedCount: 2,
        },
      ],
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Deine Spielrunden')).toBeInTheDocument();
      expect(screen.getByText('In Lobby')).toBeInTheDocument();
      expect(screen.getByText('Pausiert')).toBeInTheDocument();
      expect(screen.getByText(/2\/4 bereit/)).toBeInTheDocument();
    });
  });

  it('öffnet laufendes Spiel direkt ohne Code', async () => {
    mockApiGet.mockResolvedValue({
      games: [{
        id: 'game-running',
        host: 'host1',
        status: 'RUNNING',
        createdAt: new Date().toISOString(),
        playerCount: 3,
        resumeConfirmedCount: 0,
      }],
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Läuft')).toBeInTheDocument();
    });

    const openButtons = screen.getAllByText('Öffnen');
    await userEvent.click(openButtons[0]!);
    expect(mockNavigate).toHaveBeenCalledWith('/game/game-running');
  });

  it('bestätigt Fortsetzung eines pausierten Spiels', async () => {
    mockApiGet.mockResolvedValue({
      games: [{
        id: 'game-paused',
        host: 'host1',
        status: 'PAUSED',
        createdAt: new Date().toISOString(),
        playerCount: 3,
        resumeConfirmedCount: 1,
      }],
    });
    mockApiPost.mockResolvedValueOnce({ allConfirmed: false, resumeConfirmedCount: 2 });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Weiterspielen')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText('Weiterspielen'));

    await waitFor(() => {
      expect(mockApiPost).toHaveBeenCalledWith('/api/games/game-paused/confirm-resume', {}, 'test-token');
    });
  });

  it('löscht eigene Lobby-Runde aus der Liste', async () => {
    const originalConfirm = window.confirm;
    window.confirm = vi.fn(() => true);
    mockApiGet.mockResolvedValue({
      games: [{
        id: 'game-lobby',
        host: 'host1',
        status: 'LOBBY',
        createdAt: new Date().toISOString(),
        playerCount: 1,
        resumeConfirmedCount: 0,
      }],
    });
    mockApiDelete.mockResolvedValueOnce({ deleted: true });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Löschen')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText('Löschen'));

    await waitFor(() => {
      expect(mockApiDelete).toHaveBeenCalledWith('/api/games/game-lobby', 'test-token');
    });

    window.confirm = originalConfirm;
  });
});
