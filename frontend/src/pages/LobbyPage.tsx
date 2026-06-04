import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { apiPost } from '../lib/api';

interface Player {
  username: string;
  joinedAt: string;
}

interface Game {
  id: string;
  host: string;
  status: string;
  players: Player[];
  inviteLink: string;
  qrCodeSvg?: string;
  startedAt?: string;
  createdAt: string;
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

const mutedStyle = {
  color: 'var(--color-muted)',
  fontSize: '0.9rem',
  textAlign: 'center',
} as const;

export default function LobbyPage() {
  const { token, user, logout } = useAuth();
  const navigate = useNavigate();
  const [game, setGame] = useState<Game | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  async function handleCreateGame() {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const data = await apiPost('/api/games', undefined, token);
      if (data.game) {
        setGame(data.game);
      } else {
        setError(data.message || 'Fehler beim Erstellen der Runde.');
      }
    } catch (err: unknown) {
      setError((err as { message?: string }).message || 'Fehler beim Erstellen der Runde.');
    } finally {
      setLoading(false);
    }
  }

  async function handleStartGame() {
    if (!token || !game) return;
    setLoading(true);
    setError('');
    try {
      const data = await apiPost(`/api/games/${game.id}/start`, undefined, token);
      if (data.game) {
        setGame(prev => prev ? { ...prev, status: data.game.status, startedAt: data.game.startedAt } : null);
      } else {
        setError(data.message || 'Fehler beim Starten.');
      }
    } catch (err: unknown) {
      setError((err as { message?: string }).message || 'Fehler beim Starten des Spiels.');
    } finally {
      setLoading(false);
    }
  }

  function handleCopyLink() {
    if (!game) return;
    navigator.clipboard.writeText(game.inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const isHost = game && user && game.host === user.username;

  return (
    <div style={centerStyle}>
      <div style={cardStyle}>
        <h1 style={titleStyle}>Lobby</h1>

        <p style={mutedStyle}>
          Angemeldet als <strong>{user?.username}</strong>
          {' – '}
          <button
            onClick={() => { logout(); navigate('/login'); }}
            style={{ background: 'none', border: 'none', color: 'var(--color-accent)', cursor: 'pointer', textDecoration: 'underline', padding: 0, font: 'inherit' }}
          >
            Abmelden
          </button>
        </p>

        {!game && (
          <button
            onClick={handleCreateGame}
            disabled={loading}
            style={{ ...buttonStyle, opacity: loading ? 0.5 : 1 }}
          >
            {loading ? 'Wird erstellt…' : 'Neue Runde erstellen'}
          </button>
        )}

        {game && (
          <>
            <div style={{ marginTop: '1.5rem', padding: '1rem', border: '1px solid var(--color-border)' }}>
              <p style={{ margin: '0 0 0.5rem', fontWeight: 600, color: 'var(--color-accent)' }}>
                {game.status === 'RUNNING' ? 'Spiel läuft' : 'Runde erstellt'}
              </p>
              <p style={{ margin: '0 0 0.25rem', fontSize: '0.9rem' }}>
                Status: <strong>{game.status}</strong>
              </p>
              <p style={{ margin: '0 0 0.25rem', fontSize: '0.9rem' }}>
                Spieler: {game.players.length}
              </p>
              <ul style={{ margin: '0.5rem 0', fontSize: '0.85rem', color: 'var(--color-muted)' }}>
                {game.players.map(p => (
                  <li key={p.username}>{p.username}{p.username === user?.username ? ' (Du)' : ''}</li>
                ))}
              </ul>

              {game.status === 'LOBBY' && (
                <>
                  <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
                    <input
                      readOnly
                      value={game.inviteLink}
                      style={{ flex: 1, padding: '0.5rem', fontFamily: 'monospace', fontSize: '0.8rem', backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
                    />
                    <button onClick={handleCopyLink} style={{ ...buttonStyle, marginTop: 0, width: 'auto', padding: '0.5rem 1rem', fontSize: '0.85rem' }}>
                      {copied ? 'Kopiert' : 'Kopieren'}
                    </button>
                  </div>

                  {game.qrCodeSvg && (
                    <div style={{ marginTop: '1rem', textAlign: 'center' }}>
                      <img
                        src={`data:image/svg+xml;utf8,${encodeURIComponent(game.qrCodeSvg)}`}
                        alt="QR-Code zum Beitreten"
                        style={{ width: 160, height: 160 }}
                      />
                    </div>
                  )}

                  {isHost && (
                    <button
                      onClick={handleStartGame}
                      disabled={loading}
                      style={{ ...buttonStyle, opacity: loading ? 0.5 : 1 }}
                    >
                      {loading ? 'Wird gestartet…' : 'Spiel starten'}
                    </button>
                  )}
                </>
              )}

              {game.status === 'RUNNING' && (
                <p style={{ ...mutedStyle, marginTop: '1rem' }}>
                  Spiel läuft seit {game.startedAt ? new Date(game.startedAt).toLocaleString() : '?'}
                </p>
              )}
            </div>

            <button
              onClick={() => { setGame(null); setError(''); }}
              style={{ ...buttonStyle, backgroundColor: 'transparent', border: '1px solid var(--color-border)', color: 'var(--color-text)' }}
            >
              Zurück
            </button>
          </>
        )}

        {error && (
          <p style={{ color: 'var(--color-error)', marginTop: '0.5rem', fontSize: '0.9rem', textAlign: 'center' }}>
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
