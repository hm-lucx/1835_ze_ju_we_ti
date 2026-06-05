import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { apiGet, apiPost } from '../lib/api';

interface Account {
  userId: string;
  username: string;
  balance: number;
}

interface Game {
  id: string;
  host: string;
  status: string;
  players: { username: string; joinedAt: string }[];
  startedAt?: string;
  accounts: Account[];
  bank: { balance: number } | null;
}

const centerStyle = {
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  minHeight: '100vh',
  padding: '1rem',
} as const;

const cardStyle = {
  backgroundColor: 'var(--color-surface)',
  border: '1px solid var(--color-border)',
  boxShadow: '0 4px 20px rgba(201, 153, 58, 0.15)',
  padding: '2.5rem 2rem',
  width: '100%',
  maxWidth: 560,
} as const;

const titleStyle = {
  fontFamily: 'var(--font-display)',
  fontSize: '1.75rem',
  fontWeight: 700,
  color: 'var(--color-accent)',
  textAlign: 'center',
  marginBottom: '1.5rem',
} as const;

const balanceCardStyle = {
  backgroundColor: 'var(--color-bg)',
  border: '2px solid var(--color-accent)',
  padding: '1.5rem',
  textAlign: 'center',
  marginBottom: '1rem',
} as const;

const balanceAmountStyle = {
  fontSize: '2.5rem',
  fontWeight: 700,
  color: 'var(--color-accent)',
  marginTop: '0.25rem',
} as const;

const mutedStyle = {
  color: 'var(--color-muted)',
  fontSize: '0.9rem',
  textAlign: 'center',
} as const;

const buttonStyle = {
  display: 'block',
  width: '100%',
  padding: '0.75rem',
  fontFamily: 'var(--font-body)',
  fontSize: '1.05rem',
  fontWeight: 600,
  color: '#1a1410',
  backgroundColor: 'var(--color-accent)',
  border: 'none',
  cursor: 'pointer',
  marginTop: '0.5rem',
} as const;

const POLL_INTERVAL = 5000;

export default function DashboardPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { token, user } = useAuth();
  const [game, setGame] = useState<Game | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const myAccount = game?.accounts?.find(a => a.username === user?.username);
  const otherPlayers = game?.accounts?.filter(a => a.username !== user?.username) || [];

  const [transferAmount, setTransferAmount] = useState('');
  const [transferRecipient, setTransferRecipient] = useState('');
  const [transferError, setTransferError] = useState('');
  const [transferLoading, setTransferLoading] = useState(false);
  const [transferSuccess, setTransferSuccess] = useState('');

  async function handleTransfer() {
    if (!token || !id || !myAccount) return;
    const amount = parseInt(transferAmount, 10);
    if (!Number.isInteger(amount) || amount <= 0) {
      setTransferError('Betrag muss eine positive ganze Zahl sein.');
      return;
    }
    if (amount > myAccount.balance) {
      setTransferError('Nicht genügend Guthaben.');
      return;
    }
    setTransferLoading(true);
    setTransferError('');
    setTransferSuccess('');
    try {
      const data = await apiPost(`/api/games/${id}/transfer`, { toUsername: transferRecipient, amount }, token) as { accounts: Account[]; bank: { balance: number } };
      setGame(prev => prev ? { ...prev, accounts: data.accounts, bank: data.bank } : null);
      setTransferAmount('');
      setTransferSuccess('Überweisung erfolgreich.');
    } catch (err: unknown) {
      setTransferError((err as { message?: string }).message || 'Überweisung fehlgeschlagen.');
    } finally {
      setTransferLoading(false);
    }
  }

  const loadGame = useCallback(async () => {
    if (!token || !id) return;
    try {
      const data = await apiGet(`/api/games/${id}`, token);
      if (data.game) {
        setGame(data.game as Game);
      }
    } catch (err: unknown) {
      const msg = (err as { message?: string }).message || 'Fehler beim Laden des Spielstands.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [id, token]);

  useEffect(() => {
    loadGame();
  }, [loadGame]);

  useEffect(() => {
    if (!game) return;
    if (game.status !== 'RUNNING') return;
    const interval = setInterval(loadGame, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [game, loadGame]);

  if (loading) {
    return (
      <div style={centerStyle}>
        <div style={cardStyle}>
          <p style={mutedStyle}>Lade Spielstand…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={centerStyle}>
        <div style={cardStyle}>
          <p style={{ color: 'var(--color-error)', textAlign: 'center', marginBottom: '1rem' }}>{error}</p>
          <button
            onClick={() => navigate('/lobby')}
            style={{ ...buttonStyle, backgroundColor: 'transparent', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
          >
            Zurück zur Lobby
          </button>
        </div>
      </div>
    );
  }

  if (!game) {
    return (
      <div style={centerStyle}>
        <div style={cardStyle}>
          <p style={mutedStyle}>Spiel nicht gefunden.</p>
          <button
            onClick={() => navigate('/lobby')}
            style={{ ...buttonStyle, backgroundColor: 'transparent', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
          >
            Zurück zur Lobby
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={centerStyle}>
      <div style={cardStyle}>
        <h1 style={titleStyle}>Spiel-Dashboard</h1>

        <p style={mutedStyle}>
          Angemeldet als <strong>{user?.username}</strong>
        </p>

        {game.startedAt && (
          <p style={{ ...mutedStyle, marginTop: '0.5rem', fontSize: '0.85rem' }}>
            Gestartet: {new Date(game.startedAt).toLocaleString()}
          </p>
        )}

        {myAccount && (
          <div style={balanceCardStyle}>
            <p style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600 }}>Dein Kontostand</p>
            <p style={balanceAmountStyle}>{myAccount.balance} €</p>
          </div>
        )}

        {game.bank && (
          <div style={{ ...balanceCardStyle, borderColor: 'var(--color-border)', marginBottom: '1.5rem' }}>
            <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--color-muted)' }}>Bank</p>
            <p style={{ ...balanceAmountStyle, fontSize: '1.8rem', color: 'var(--color-text)' }}>{game.bank.balance} €</p>
          </div>
        )}

        <table style={{ width: '100%', fontSize: '0.85rem', borderCollapse: 'collapse', marginBottom: '1.5rem' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: '0.25rem 0.5rem', borderBottom: '1px solid var(--color-border)' }}>Spieler</th>
              <th style={{ textAlign: 'right', padding: '0.25rem 0.5rem', borderBottom: '1px solid var(--color-border)' }}>Kontostand</th>
            </tr>
          </thead>
          <tbody>
            {game.accounts.map(a => (
              <tr key={a.userId}>
                <td style={{ padding: '0.25rem 0.5rem', fontWeight: a.username === user?.username ? 700 : 400 }}>
                  {a.username}{a.username === user?.username ? ' (Du)' : ''}
                </td>
                <td style={{ textAlign: 'right', padding: '0.25rem 0.5rem' }}>{a.balance} €</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '1rem', marginBottom: '1rem' }}>
          <p style={{ margin: '0 0 0.75rem', fontWeight: 600, fontSize: '0.95rem', textAlign: 'center' }}>Geld senden</p>

          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <input
              type="number"
              min={1}
              max={myAccount?.balance || 0}
              value={transferAmount}
              onChange={e => { setTransferAmount(e.target.value); setTransferError(''); setTransferSuccess(''); }}
              placeholder="Betrag"
              style={{
                flex: 1,
                padding: '0.5rem',
                fontFamily: 'var(--font-body)',
                fontSize: '0.9rem',
                backgroundColor: 'var(--color-bg)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text)',
              }}
            />
            <select
              value={transferRecipient}
              onChange={e => { setTransferRecipient(e.target.value); setTransferError(''); setTransferSuccess(''); }}
              style={{
                flex: 1,
                padding: '0.5rem',
                fontFamily: 'var(--font-body)',
                fontSize: '0.9rem',
                backgroundColor: 'var(--color-bg)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text)',
              }}
            >
              <option value="">Bank</option>
              {otherPlayers.map(a => (
                <option key={a.userId} value={a.username}>{a.username}</option>
              ))}
            </select>
          </div>

          <button
            onClick={handleTransfer}
            disabled={transferLoading || !transferAmount || !myAccount}
            style={{
              ...buttonStyle,
              opacity: transferLoading || !transferAmount || !myAccount ? 0.5 : 1,
              cursor: transferLoading || !transferAmount || !myAccount ? 'not-allowed' : 'pointer',
            }}
          >
            {transferLoading ? 'Wird gesendet…' : 'Senden'}
          </button>

          {transferError && (
            <p style={{ color: 'var(--color-error)', marginTop: '0.5rem', fontSize: '0.85rem', textAlign: 'center' }}>{transferError}</p>
          )}
          {transferSuccess && (
            <p style={{ color: 'var(--color-accent)', marginTop: '0.5rem', fontSize: '0.85rem', textAlign: 'center' }}>{transferSuccess}</p>
          )}
        </div>

        <button
          onClick={() => navigate('/lobby')}
          style={{ ...buttonStyle, backgroundColor: 'transparent', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
        >
          Zurück zur Lobby
        </button>
      </div>
    </div>
  );
}
