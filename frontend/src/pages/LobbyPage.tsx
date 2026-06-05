import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { apiPost, apiGet } from '../lib/api';

interface Player {
  username: string;
  joinedAt: string;
}

interface Account {
  userId: string;
  username: string;
  balance: number;
}

interface Game {
  id: string;
  host: string;
  status: string;
  players: Player[];
  inviteCode: string;
  inviteLink: string;
  inviteLinkShort: string;
  qrCodeSvg?: string;
  startedAt?: string;
  createdAt: string;
  accounts?: Account[];
  bank?: { balance: number } | null;
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

const MIN_PLAYERS = 3;

export default function LobbyPage() {
  const { token, user, logout } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [game, setGame] = useState<Game | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [joinMode, setJoinMode] = useState(false);
  const [joinCode, setJoinCode] = useState('');

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

  async function handleJoinRound() {
    if (!token) return;
    const code = joinCode.trim().match(/[A-Z0-9]{6}$/i);
    if (!code) {
      setError('Bitte gib einen gültigen 6-stelligen Code ein.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const data = await apiPost('/api/rounds/join', { inviteCode: code[0].toUpperCase() }, token) as { roundId: string };
      navigate(`/lobby?game=${data.roundId}`);
    } catch (err: unknown) {
      const msg = (err as { message?: string }).message || 'Beitritt fehlgeschlagen.';
      setError(msg);
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
        navigate(`/game/${game.id}`);
      } else {
        setError(data.message || 'Fehler beim Starten.');
      }
    } catch (err: unknown) {
      setError((err as { message?: string }).message || 'Fehler beim Starten des Spiels.');
    } finally {
      setLoading(false);
    }
  }

  async function handleLeaveGame() {
    if (!token || !game) return;
    setLoading(true);
    setError('');
    try {
      await apiPost(`/api/games/${game.id}/leave`, undefined, token);
      setGame(null);
    } catch (err: unknown) {
      setError((err as { message?: string }).message || 'Austritt fehlgeschlagen.');
    } finally {
      setLoading(false);
    }
  }

  function handleCopyLink() {
    if (!game) return;
    navigator.clipboard.writeText(game.inviteLinkShort);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const loadGame = useCallback(async (gameId: string) => {
    if (!token) return;
    try {
      const data = await apiGet(`/api/games/${gameId}`, token);
      if (data.game) {
        setGame(prev => prev ? { ...prev, ...data.game } : data.game);
      }
    } catch {
      // ignore poll errors
    }
  }, [token]);

  const gameIdParam = searchParams.get('game');

  useEffect(() => {
    if (gameIdParam) {
      loadGame(gameIdParam);
      return;
    }
    if (!token) return;
    apiGet('/api/games/mine', token).then((res) => {
      const games = (res as { games: { id: string }[] }).games;
      if (games.length === 1 && games[0]) {
        navigate(`/lobby?game=${games[0].id}`, { replace: true });
      }
    }).catch(() => {});
  }, [gameIdParam, loadGame, token, navigate]);

  useEffect(() => {
    if (!game || game.status !== 'LOBBY') return;
    const interval = setInterval(() => {
      loadGame(game.id);
    }, 3000);
    return () => clearInterval(interval);
  }, [game, loadGame]);

  useEffect(() => {
    if (game && game.status === 'RUNNING') {
      navigate(`/game/${game.id}`, { replace: true });
    }
  }, [game, navigate]);

  const isHost = game && user && game.host === user.username;
  const canStart = isHost && game && game.players.length >= MIN_PLAYERS;

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

        {!game && !joinMode && (
          <>
            <button
              onClick={handleCreateGame}
              disabled={loading}
              style={{ ...buttonStyle, opacity: loading ? 0.5 : 1 }}
            >
              {loading ? 'Wird erstellt…' : 'Neue Runde erstellen'}
            </button>
            <button
              onClick={() => { setJoinMode(true); setError(''); }}
              style={{
                ...buttonStyle,
                marginTop: '0.75rem',
                backgroundColor: 'transparent',
                border: '1px solid var(--color-accent)',
                color: 'var(--color-accent)',
              }}
            >
              Runde beitreten
            </button>
          </>
        )}

        {!game && joinMode && (
          <div style={{ marginTop: '1rem' }}>
            <p style={{ margin: '0 0 0.5rem', fontSize: '0.9rem', color: 'var(--color-text)', textAlign: 'center' }}>
              Einladungscode eingeben:
            </p>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                type="text"
                placeholder="z.B. A3F7K2"
                value={joinCode}
                onChange={e => setJoinCode(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleJoinRound()}
                style={{
                  flex: 1,
                  padding: '0.6rem',
                  fontFamily: 'var(--font-body)',
                  fontSize: '1rem',
                  backgroundColor: 'var(--color-bg)',
                  border: '1px solid var(--color-border)',
                  color: 'var(--color-text)',
                  textTransform: 'uppercase',
                }}
                autoFocus
              />
              <button
                onClick={handleJoinRound}
                disabled={loading}
                style={{ ...buttonStyle, marginTop: 0, width: 'auto', padding: '0.6rem 1.2rem', whiteSpace: 'nowrap' }}
              >
                {loading ? '…' : 'Beitreten'}
              </button>
            </div>
            <button
              onClick={() => { setJoinMode(false); setJoinCode(''); setError(''); }}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--color-muted)',
                cursor: 'pointer',
                textDecoration: 'underline',
                padding: 0,
                font: 'inherit',
                display: 'block',
                margin: '0.5rem auto 0',
                fontSize: '0.85rem',
              }}
            >
              Abbrechen
            </button>
          </div>
        )}

        {game && (
          <>
            <div style={{ marginTop: '1.5rem', padding: '1rem', border: '1px solid var(--color-border)' }}>
              <p style={{ margin: '0 0 0.5rem', fontWeight: 600, color: 'var(--color-accent)' }}>
                Runde erstellt
              </p>
              <p style={{ margin: '0 0 0.25rem', fontSize: '0.9rem' }}>
                Status: <strong>{game.status}</strong>
              </p>
              <p style={{ margin: '0 0 0.25rem', fontSize: '0.9rem' }}>
                Spieler: {game.players.length} / 7
              </p>
              <ul style={{ margin: '0.5rem 0', fontSize: '0.85rem', color: 'var(--color-muted)' }}>
                {game.players.map(p => (
                  <li key={p.username}>{p.username}{p.username === user?.username ? ' (Du)' : ''}</li>
                ))}
              </ul>

              {!isHost && (
                <button
                  onClick={handleLeaveGame}
                  disabled={loading}
                  style={{ ...buttonStyle, backgroundColor: 'transparent', border: '1px solid var(--color-border)', color: 'var(--color-text)', marginBottom: '1rem' }}
                >
                  {loading ? 'Wird verlassen…' : 'Runde verlassen'}
                </button>
              )}

              <div style={{ marginTop: '1rem', textAlign: 'center' }}>
                <p style={{ margin: '0 0 0.25rem', fontSize: '0.8rem', color: 'var(--color-muted)' }}>
                  Einladungscode
                </p>
                <p style={{ margin: '0 0 0.75rem', fontFamily: 'monospace', fontSize: '1.3rem', fontWeight: 700, color: 'var(--color-accent)', letterSpacing: '0.15em' }}>
                  {game.inviteCode}
                </p>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  readOnly
                  value={game.inviteLinkShort}
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
                <>
                  <button
                    onClick={handleStartGame}
                    disabled={!canStart || loading}
                    style={{
                      ...buttonStyle,
                      opacity: loading ? 0.5 : canStart ? 1 : 0.4,
                      cursor: canStart && !loading ? 'pointer' : 'not-allowed'
                    }}
                  >
                    {loading ? 'Wird gestartet…' : 'Spiel starten'}
                  </button>
                  {!canStart && !loading && (
                    <p style={{ ...mutedStyle, marginTop: '0.5rem', fontSize: '0.8rem' }}>
                      Warte auf mindestens {MIN_PLAYERS} Spieler (aktuell: {game.players.length})
                    </p>
                  )}
                </>
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
