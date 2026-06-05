import { useState, useCallback } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { apiGet, apiPost } from '../lib/api';
import AuthCard from '../components/auth/AuthCard';
import AuthInput from '../components/auth/AuthInput';
import AuthButton from '../components/auth/AuthButton';
import AuthLink from '../components/auth/AuthLink';

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

interface ActiveGame {
  id: string;
  host: string;
  status: string;
  startedAt: string | null;
}

export default function LoginPage() {
  const { login, token, isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [activeGame, setActiveGame] = useState<ActiveGame | null>(null);
  const [leaveLoading, setLeaveLoading] = useState(false);

  if (isAuthenticated && !activeGame) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleLogin = useCallback(async () => {
    setError('');
    if (!username.trim() || !password) {
      setError('Bitte Benutzername und Passwort eingeben.');
      return;
    }
    try {
      const data = await login(username, password);

      const res = await apiGet('/api/games/mine', data.token);
      const games = (res as { games: ActiveGame[] }).games;
      if (games.length > 0 && games[0]) {
        setActiveGame(games[0]);
      } else {
        navigate('/dashboard', { replace: true });
      }
    } catch (err: unknown) {
      const apiErr = err as { message?: string };
      setError(apiErr.message || 'Anmeldung fehlgeschlagen.');
    }
  }, [username, password, login, navigate]);

  async function handleRejoin() {
    if (!activeGame) return;
    navigate(`/lobby?game=${activeGame.id}`, { replace: true });
  }

  async function handleLeaveAndStart() {
    if (!activeGame || !token) return;
    setLeaveLoading(true);
    try {
      await apiPost(`/api/games/${activeGame.id}/leave`, undefined, token);
      setActiveGame(null);
      navigate('/dashboard', { replace: true });
    } catch {
      navigate('/dashboard', { replace: true });
    }
  }

  return (
    <AuthCard title="1835" subtitle="Willkommen zurück">
      {activeGame ? (
        <div>
          <p style={{ margin: '0 0 0.75rem', fontWeight: 600, fontSize: '1rem', textAlign: 'center' }}>
            Du hast noch eine aktive Runde
          </p>
          <div style={{ padding: '0.75rem', border: '1px solid var(--color-border)', marginBottom: '1rem', fontSize: '0.9rem' }}>
            <p style={{ margin: '0 0 0.25rem' }}>
              Status: <strong>{activeGame.status === 'LOBBY' ? 'Runde erstellt' : 'Spiel läuft'}</strong>
            </p>
            <p style={{ margin: 0, color: 'var(--color-muted)' }}>
              Host: {activeGame.host}
            </p>
          </div>
          <AuthButton onClick={handleRejoin}>
            Zurück zur Runde
          </AuthButton>
          <button
            onClick={handleLeaveAndStart}
            disabled={leaveLoading}
            style={{ ...buttonStyle, backgroundColor: 'transparent', border: '1px solid var(--color-border)', color: 'var(--color-text)', marginTop: '0.5rem' }}
          >
            {leaveLoading ? 'Wird verlassen…' : 'Runde verlassen'}
          </button>
        </div>
      ) : (
        <div>
          <AuthInput
            label="Benutzername"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
          />
          <AuthInput
            label="Passwort"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
          {error && (
            <p style={{ color: 'var(--color-error)', marginBottom: '0.5rem', fontSize: '0.9rem' }}>
              {error}
            </p>
          )}
          <AuthButton onClick={handleLogin} loading={loading}>
            Anmelden
          </AuthButton>
        </div>
      )}
      {!activeGame && (
        <>
          <div style={{ textAlign: 'center', marginTop: '0.75rem' }}>
            <AuthLink to="/forgot-password">Passwort vergessen?</AuthLink>
          </div>
          <p style={{ textAlign: 'center', color: 'var(--color-muted)', fontSize: '0.9rem', marginTop: '1rem' }}>
            Noch kein Konto? <AuthLink to="/register" style={{ marginTop: 0 }}>Registrieren</AuthLink>
          </p>
        </>
      )}
    </AuthCard>
  );
}
