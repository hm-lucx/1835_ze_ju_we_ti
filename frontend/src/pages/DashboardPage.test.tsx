import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import DashboardPage from './DashboardPage';

const mockToken = 'test-token';
const mockUser = { username: 'host1', birthDate: '2000-01-01' };

const mockNavigate = vi.fn();
const mockApiGet = vi.fn();
const mockApiPost = vi.fn();

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
    expect(screen.getAllByText('600 Mark').length).toBeGreaterThanOrEqual(1);
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
      expect(screen.getAllByText('Bank').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('11000 Mark')).toBeInTheDocument();
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
      expect(screen.getAllByText('player1').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('player2').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('sortiert Spieler absteigend nach Kontostand', async () => {
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
          { userId: 'u1', username: 'host1', balance: 300 },
          { userId: 'u2', username: 'player1', balance: 600 },
          { userId: 'u3', username: 'player2', balance: 400 },
        ],
        bank: { balance: 10700 },
      },
    });

    renderPage();

    await waitFor(() => {
      const rows = screen.getAllByRole('row');
      const cells = rows.map(r => r.textContent);
      const playerRow = cells.find(c => c?.includes('player1'));
      const hostRow = cells.find(c => c?.includes('host1'));
      const player2Row = cells.find(c => c?.includes('player2'));
      expect(playerRow).toBeTruthy();
      expect(hostRow).toBeTruthy();
      expect(player2Row).toBeTruthy();
      const tableRows = rows.slice(1, 4);
      expect(tableRows[0]?.textContent).toContain('player1');
      expect(tableRows[1]?.textContent).toContain('player2');
      expect(tableRows[2]?.textContent).toContain('host1');
    });
  });

  it('zeigt Rangposition an', async () => {
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
          { userId: 'u1', username: 'host1', balance: 300 },
          { userId: 'u2', username: 'player1', balance: 600 },
          { userId: 'u3', username: 'player2', balance: 400 },
        ],
        bank: { balance: 10700 },
      },
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('1.')).toBeInTheDocument();
      expect(screen.getByText('2.')).toBeInTheDocument();
      expect(screen.getByText('3.')).toBeInTheDocument();
    });
  });

  it('eigene Zeile hebt sich visuell ab', async () => {
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
      const hostRow = screen.getByText('host1 (Du)').closest('tr');
      expect(hostRow).toBeTruthy();
      expect(hostRow!.textContent).toContain('600\u202fMark');
    });
  });

  it('bei Gleichstand alphabetisch sortiert', async () => {
    mockApiGet.mockResolvedValueOnce({
      game: {
        id: 'game-1',
        host: 'alice',
        status: 'RUNNING',
        players: [
          { username: 'alice', joinedAt: new Date().toISOString() },
          { username: 'bob', joinedAt: new Date().toISOString() },
          { username: 'charlie', joinedAt: new Date().toISOString() },
        ],
        startedAt: new Date().toISOString(),
        accounts: [
          { userId: 'u1', username: 'alice', balance: 500 },
          { userId: 'u2', username: 'bob', balance: 500 },
          { userId: 'u3', username: 'charlie', balance: 300 },
        ],
        bank: { balance: 10700 },
      },
    });

    renderPage();

    await waitFor(() => {
      const rows = screen.getAllByRole('row');
      const tableRows = rows.slice(1, 4);
      expect(tableRows[0]?.textContent).toContain('alice');
      expect(tableRows[1]?.textContent).toContain('bob');
      expect(tableRows[2]?.textContent).toContain('charlie');
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

  it('zeigt Überweisungs-Formular nach Laden an', async () => {
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
      expect(screen.getByText('Geld senden')).toBeInTheDocument();
      expect(screen.getAllByPlaceholderText('Betrag').length).toBe(2);
      expect(screen.getByText('Senden')).toBeInTheDocument();
      expect(screen.getAllByText('Bank').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('player1').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('ruft API bei gültiger Überweisung auf', async () => {
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

    mockApiPost.mockResolvedValueOnce({
      accounts: [
        { userId: 'u1', username: 'host1', balance: 500 },
        { userId: 'u2', username: 'player1', balance: 500 },
      ],
      bank: { balance: 11000 },
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Geld senden')).toBeInTheDocument();
    });

    const amountInput = screen.getAllByPlaceholderText('Betrag')[0]!;
    await userEvent.type(amountInput, '100');

    const sendButton = screen.getByText('Senden');
    await userEvent.click(sendButton);

    await waitFor(() => {
      expect(mockApiPost).toHaveBeenCalledWith(
        '/api/games/game-1/transfer',
        { toUsername: '', amount: 100 },
        'test-token'
      );
    });
  });

  it('zeigt Erfolgsmeldung nach Überweisung', async () => {
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

    mockApiPost.mockResolvedValueOnce({
      accounts: [
        { userId: 'u1', username: 'host1', balance: 500 },
        { userId: 'u2', username: 'player1', balance: 500 },
      ],
      bank: { balance: 11000 },
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Geld senden')).toBeInTheDocument();
    });

    const amountInput = screen.getAllByPlaceholderText('Betrag')[0]!;
    await userEvent.type(amountInput, '100');
    await userEvent.click(screen.getByText('Senden'));

    await waitFor(() => {
      expect(screen.getByText('Überweisung erfolgreich.')).toBeInTheDocument();
    });
  });

  it('zeigt Fehler bei fehlgeschlagener Überweisung', async () => {
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

    mockApiPost.mockRejectedValueOnce({ message: 'Nicht genügend Guthaben.' });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Geld senden')).toBeInTheDocument();
    });

    const amountInput = screen.getAllByPlaceholderText('Betrag')[0]!;
    await userEvent.type(amountInput, '9999');
    await userEvent.click(screen.getByText('Senden'));

    await waitFor(() => {
      expect(screen.getByText('Nicht genügend Guthaben.')).toBeInTheDocument();
    });
  });

  it('zeigt Geld von Bank empfangen Formular', async () => {
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
      expect(screen.getByText('Geld von Bank empfangen')).toBeInTheDocument();
      expect(screen.getByText('Empfangen')).toBeInTheDocument();
    });
  });

  it('ruft receive-from-bank API bei gültigem Betrag auf', async () => {
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

    mockApiPost.mockResolvedValueOnce({
      accounts: [{ userId: 'u1', username: 'host1', balance: 700 }],
      bank: { balance: 11300 },
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Geld von Bank empfangen')).toBeInTheDocument();
    });

    const amountInput = screen.getAllByPlaceholderText('Betrag')[1]!;
    await userEvent.type(amountInput, '100');
    await userEvent.click(screen.getByText('Empfangen'));

    await waitFor(() => {
      expect(mockApiPost).toHaveBeenCalledWith(
        '/api/games/game-1/receive-from-bank',
        { amount: 100 },
        'test-token'
      );
    });
  });

  it('zeigt Erfolgsmeldung nach Empfang von Bank', async () => {
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

    mockApiPost.mockResolvedValueOnce({
      accounts: [{ userId: 'u1', username: 'host1', balance: 700 }],
      bank: { balance: 11300 },
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Geld von Bank empfangen')).toBeInTheDocument();
    });

    const amountInput = screen.getAllByPlaceholderText('Betrag')[1]!;
    await userEvent.type(amountInput, '100');
    await userEvent.click(screen.getByText('Empfangen'));

    await waitFor(() => {
      expect(screen.getByText('Geld von Bank empfangen.')).toBeInTheDocument();
    });
  });

  it('zeigt Fehler bei fehlgeschlagenem Empfang', async () => {
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

    mockApiPost.mockReset();
    mockApiPost.mockRejectedValue({ message: 'Auszahlung fehlgeschlagen.' });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Geld von Bank empfangen')).toBeInTheDocument();
    });

    const amountInput = screen.getAllByPlaceholderText('Betrag')[1]!;
    await userEvent.type(amountInput, '100');
    await userEvent.click(screen.getByText('Empfangen'));

    await waitFor(() => {
      expect(screen.getByText('Auszahlung fehlgeschlagen.')).toBeInTheDocument();
    });
  });

  it('zeigt Bank negativ rot an', async () => {
    mockApiGet.mockResolvedValueOnce({
      game: {
        id: 'game-1',
        host: 'host1',
        status: 'RUNNING',
        players: [{ username: 'host1', joinedAt: new Date().toISOString() }],
        startedAt: new Date().toISOString(),
        accounts: [{ userId: 'u1', username: 'host1', balance: 600 }],
        bank: { balance: -500 },
      },
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('-500 Mark')).toBeInTheDocument();
    });
  });

  it('zeigt Transaktionshistorie nach erfolgreichem Laden', async () => {
    mockApiGet
      .mockResolvedValueOnce({
        game: {
          id: 'game-1',
          host: 'host1',
          status: 'RUNNING',
          players: [{ username: 'host1', joinedAt: new Date().toISOString() }],
          startedAt: new Date().toISOString(),
          accounts: [{ userId: 'u1', username: 'host1', balance: 600 }],
          bank: { balance: 11400 },
        },
      })
      .mockResolvedValueOnce({
        transactions: [
          { id: 't1', amount: 600, type: 'STARTING_CAPITAL', memo: null, fromUsername: null, toUsername: 'host1', createdAt: new Date().toISOString(), runningBalance: 600 },
          { id: 't2', amount: 100, type: 'PLAYER_TRANSFER', memo: 'Test', fromUsername: 'host1', toUsername: 'player1', createdAt: new Date().toISOString(), runningBalance: 500 },
        ],
      });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Transaktionshistorie')).toBeInTheDocument();
      expect(screen.getByText('Startkapital')).toBeInTheDocument();
      expect(screen.getByText('Überweisung')).toBeInTheDocument();
      expect(screen.getByText('Test')).toBeInTheDocument();
    });
  });

  it('zeigt Verwendungszweck-Input in beiden Formularen', async () => {
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
      const memoInputs = screen.getAllByPlaceholderText('Verwendungszweck');
      expect(memoInputs.length).toBe(2);
    });
  });

  it('sendet Verwendungszweck bei Überweisung mit', async () => {
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

    mockApiPost.mockResolvedValueOnce({
      accounts: [
        { userId: 'u1', username: 'host1', balance: 500 },
        { userId: 'u2', username: 'player1', balance: 500 },
      ],
      bank: { balance: 11000 },
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Geld senden')).toBeInTheDocument();
    });

    const amountInput = screen.getAllByPlaceholderText('Betrag')[0]!;
    await userEvent.type(amountInput, '100');

    const memoInputs = screen.getAllByPlaceholderText('Verwendungszweck');
    await userEvent.type(memoInputs[0]!, 'Ablöse');

    await userEvent.click(screen.getByText('Senden'));

    await waitFor(() => {
      expect(mockApiPost).toHaveBeenCalledWith(
        '/api/games/game-1/transfer',
        { toUsername: '', amount: 100, memo: 'Ablöse' },
        'test-token'
      );
    });
  });

  it('sendet Verwendungszweck bei Bankempfang mit', async () => {
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

    mockApiPost.mockResolvedValueOnce({
      accounts: [{ userId: 'u1', username: 'host1', balance: 700 }],
      bank: { balance: 11300 },
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Geld von Bank empfangen')).toBeInTheDocument();
    });

    const amountInput = screen.getAllByPlaceholderText('Betrag')[1]!;
    await userEvent.type(amountInput, '100');

    const memoInputs = screen.getAllByPlaceholderText('Verwendungszweck');
    await userEvent.type(memoInputs[1]!, 'Bankgrund');

    await userEvent.click(screen.getByText('Empfangen'));

    await waitFor(() => {
      expect(mockApiPost).toHaveBeenCalledWith(
        '/api/games/game-1/receive-from-bank',
        { amount: 100, memo: 'Bankgrund' },
        'test-token'
      );
    });
  });
});
