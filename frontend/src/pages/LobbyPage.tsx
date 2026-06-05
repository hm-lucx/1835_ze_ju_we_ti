import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { apiPost, apiGet } from '../lib/api';
import PageShell from '../components/PageShell';

interface Player {
  username: string;
  joinedAt: string;
  resumeConfirmed?: boolean;
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

interface GameSummary {
  id: string;
  host: string;
  status: string;
  createdAt: string;
  startedAt?: string;
  playerCount: number;
  resumeConfirmedCount: number;
}

const MIN_PLAYERS = 3;

function statusLabel(status: string): string {
  switch (status) {
    case 'LOBBY': return 'In Lobby';
    case 'RUNNING': return 'Läuft';
    case 'PAUSED': return 'Pausiert';
    default: return status;
  }
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case 'LOBBY': return 'status-badge status-badge--lobby';
    case 'RUNNING': return 'status-badge status-badge--running';
    case 'PAUSED': return 'status-badge status-badge--paused';
    default: return 'status-badge';
  }
}

export default function LobbyPage() {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [game, setGame] = useState<Game | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [joinMode, setJoinMode] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [myGames, setMyGames] = useState<GameSummary[]>([]);
  const [resumeLoading, setResumeLoading] = useState<string | null>(null);

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

  const loadMyGames = useCallback(async () => {
    if (!token) return;
    try {
      const data = await apiGet('/api/games/mine', token) as { games: GameSummary[] };
      setMyGames(data.games || []);
    } catch {
      // ignore
    }
  }, [token]);

  async function handleConfirmResume(gameId: string) {
    if (!token) return;
    setResumeLoading(gameId);
    try {
      const result = await apiPost(`/api/games/${gameId}/confirm-resume`, {}, token) as {
        allConfirmed?: boolean;
      };
      await loadMyGames();
      if (result.allConfirmed) {
        navigate(`/game/${gameId}`);
      }
    } catch (err: unknown) {
      setError((err as { message?: string }).message || 'Fehler bei Fortsetzung.');
    } finally {
      setResumeLoading(null);
    }
  }

  function handleOpenGame(g: GameSummary) {
    if (g.status === 'RUNNING' || g.status === 'PAUSED') {
      navigate(`/game/${g.id}`);
    } else {
      navigate(`/lobby?game=${g.id}`);
    }
  }

  useEffect(() => {
    loadMyGames();
    if (gameIdParam) {
      loadGame(gameIdParam);
      return;
    }
    if (!token) return;
    apiGet('/api/games/mine', token).then((res) => {
      const games = (res as { games: GameSummary[] }).games;
      if (games.length === 1 && games[0]) {
        const g = games[0];
        if (g.status === 'RUNNING') {
          navigate(`/game/${g.id}`, { replace: true });
        } else if (g.status === 'LOBBY') {
          navigate(`/lobby?game=${g.id}`, { replace: true });
        }
      }
    }).catch(() => {});
  }, [gameIdParam, loadGame, loadMyGames, token, navigate]);

  useEffect(() => {
    if (!game || game.status !== 'LOBBY') return;
    const interval = setInterval(() => {
      loadGame(game.id);
    }, 3000);
    return () => clearInterval(interval);
  }, [game, loadGame]);

  useEffect(() => {
    if (game && (game.status === 'RUNNING' || game.status === 'PAUSED')) {
      navigate(`/game/${game.id}`, { replace: true });
    }
  }, [game, navigate]);

  useEffect(() => {
    const hasPaused = myGames.some(g => g.status === 'PAUSED');
    if (!hasPaused || game) return;
    const interval = setInterval(loadMyGames, 3000);
    return () => clearInterval(interval);
  }, [myGames, game, loadMyGames]);

  const isHost = game && user && game.host === user.username;
  const canStart = isHost && game && game.players.length >= MIN_PLAYERS;

  return (
    <PageShell wide withHeader>
      <h1 className="page-title">Lobby</h1>

      {!game && !joinMode && myGames.length > 0 && (
        <div style={{ marginBottom: '1.5rem' }}>
          <h2 style={{
            fontFamily: 'var(--font-body)',
            fontSize: '0.95rem',
            fontWeight: 600,
            color: 'var(--color-text)',
            margin: '0 0 0.75rem',
          }}>
            Deine Spielrunden
          </h2>
          <ul className="game-list">
            {myGames.map(g => (
              <li key={g.id} className="game-list__item">
                <div className="game-list__row">
                  <div className="game-list__info">
                    <p className="game-list__title">
                      {g.host === user?.username ? 'Deine Runde' : `Runde von ${g.host}`}
                      <span className={statusBadgeClass(g.status)}>{statusLabel(g.status)}</span>
                    </p>
                    <p className="game-list__meta">
                      {g.playerCount} Spieler
                      {g.status === 'PAUSED' && (
                        <> · {g.resumeConfirmedCount}/{g.playerCount} bereit</>
                      )}
                    </p>
                  </div>
                  <div className="btn-group">
                    {g.status === 'PAUSED' && (
                      <button
                        type="button"
                        className="btn btn--inline"
                        onClick={() => handleConfirmResume(g.id)}
                        disabled={resumeLoading === g.id}
                      >
                        {resumeLoading === g.id ? '…' : 'Weiterspielen'}
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn btn--inline btn--secondary"
                      onClick={() => handleOpenGame(g)}
                    >
                      Öffnen
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!game && !joinMode && (
        <>
          <button
            type="button"
            className="btn"
            onClick={handleCreateGame}
            disabled={loading}
          >
            {loading ? 'Wird erstellt…' : 'Neue Runde erstellen'}
          </button>
          <button
            type="button"
            className="btn btn--secondary"
            style={{ marginTop: '0.75rem' }}
            onClick={() => { setJoinMode(true); setError(''); }}
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
          <div className="form-row form-row--nowrap">
            <input
              type="text"
              placeholder="z.B. A3F7K2"
              value={joinCode}
              onChange={e => setJoinCode(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleJoinRound()}
              className="form-input"
              style={{ textTransform: 'uppercase' }}
              autoFocus
            />
            <button
              type="button"
              className="btn btn--inline"
              onClick={handleJoinRound}
              disabled={loading}
              style={{ whiteSpace: 'nowrap' }}
            >
              {loading ? '…' : 'Beitreten'}
            </button>
          </div>
          <button
            type="button"
            className="btn--link"
            onClick={() => { setJoinMode(false); setJoinCode(''); setError(''); }}
            style={{ display: 'block', margin: '0.5rem auto 0', fontSize: '0.85rem' }}
          >
            Abbrechen
          </button>
        </div>
      )}

      {game && (
        <>
          <div className="lobby-panel">
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
                type="button"
                className="btn btn--ghost"
                onClick={handleLeaveGame}
                disabled={loading}
                style={{ marginBottom: '1rem' }}
              >
                {loading ? 'Wird verlassen…' : 'Runde verlassen'}
              </button>
            )}

            <div style={{ marginTop: '1rem', textAlign: 'center' }}>
              <p style={{ margin: '0 0 0.25rem', fontSize: '0.8rem', color: 'var(--color-muted)' }}>
                Einladungscode
              </p>
              <p className="invite-code">{game.inviteCode}</p>
            </div>

            <div className="invite-row">
              <input
                readOnly
                value={game.inviteLinkShort}
                className="form-input form-input--mono"
              />
              <button type="button" className="btn btn--inline" onClick={handleCopyLink}>
                {copied ? 'Kopiert' : 'Kopieren'}
              </button>
            </div>

            {game.qrCodeSvg && (
              <div style={{ marginTop: '1rem', textAlign: 'center' }}>
                <img
                  src={`data:image/svg+xml;utf8,${encodeURIComponent(game.qrCodeSvg)}`}
                  alt="QR-Code zum Beitreten"
                  className="qr-code"
                />
              </div>
            )}

            {isHost && (
              <>
                <button
                  type="button"
                  className="btn"
                  onClick={handleStartGame}
                  disabled={!canStart || loading}
                  style={{ opacity: loading ? 0.5 : canStart ? 1 : 0.4, cursor: canStart && !loading ? 'pointer' : 'not-allowed' }}
                >
                  {loading ? 'Wird gestartet…' : 'Spiel starten'}
                </button>
                {!canStart && !loading && (
                  <p className="page-muted" style={{ marginTop: '0.5rem', fontSize: '0.8rem' }}>
                    Warte auf mindestens {MIN_PLAYERS} Spieler (aktuell: {game.players.length})
                  </p>
                )}
              </>
            )}
          </div>

          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => { setGame(null); setError(''); }}
          >
            Zurück
          </button>
        </>
      )}

      {error && (
        <p className="page-error" style={{ marginTop: '0.5rem' }}>
          {error}
        </p>
      )}
    </PageShell>
  );
}
