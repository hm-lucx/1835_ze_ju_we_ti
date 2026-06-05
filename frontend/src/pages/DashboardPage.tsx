import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { apiPost, apiGet } from '../lib/api';
import JoinRoundModal from '../components/JoinRoundModal';

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
  maxWidth: 480,
  textAlign: 'center',
} as const;

const titleStyle = {
  fontFamily: 'var(--font-display)',
  fontSize: '1.75rem',
  fontWeight: 700,
  color: 'var(--color-accent)',
  marginBottom: '1rem',
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

const secondaryButtonStyle = {
  ...buttonStyle,
  backgroundColor: 'transparent',
  border: '1px solid var(--color-border)',
  color: 'var(--color-text)',
  marginTop: '0.75rem',
} as const;

const mutedStyle = {
  color: 'var(--color-muted)',
  fontSize: '0.9rem',
  textAlign: 'center',
} as const;

export default function DashboardPage() {
  const { token, user, logout } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [games, setGames] = useState<{ id: string; host: string; status: string; createdAt: string }[]>([]);

  useEffect(() => {
    if (!token) return;
    apiGet('/api/games/mine', token).then((res: unknown) => {
      setGames((res as { games: typeof games }).games || []);
    }).catch(() => {});
  }, [token]);

  async function handleCreateGame() {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const data = await apiPost('/api/games', undefined, token);
      if (data.game) {
        navigate(`/lobby?game=${data.game.id}`);
      } else {
        setError(data.message || 'Fehler beim Erstellen der Runde.');
      }
    } catch (err: unknown) {
      setError((err as { message?: string }).message || 'Fehler beim Erstellen der Runde.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={centerStyle}>
      <div style={cardStyle}>
        <h1 style={titleStyle}>1835</h1>
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

        <div style={{ marginTop: '2rem' }}>
          <button
            onClick={handleCreateGame}
            disabled={loading}
            style={{ ...buttonStyle, opacity: loading ? 0.5 : 1 }}
          >
            {loading ? 'Wird erstellt…' : 'Neue Runde erstellen'}
          </button>

          <button
            onClick={() => setShowJoinModal(true)}
            style={secondaryButtonStyle}
          >
            Runde beitreten
          </button>
        </div>

        {games.length > 0 && (
          <div style={{ marginTop: '2rem' }}>
            <h3 style={{ ...mutedStyle, marginBottom: '0.75rem', fontWeight: 600 }}>Meine Runden</h3>
            {games.map(g => (
              <button
                key={g.id}
                onClick={() => navigate(`/lobby?game=${g.id}`)}
                style={{
                  display: 'block', width: '100%', padding: '0.6rem', textAlign: 'left',
                  backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)',
                  color: 'var(--color-text)', cursor: 'pointer', marginBottom: '0.4rem',
                  fontFamily: 'var(--font-body)', fontSize: '0.9rem',
                }}
              >
                <strong>{g.host}</strong> – {g.status === 'LOBBY' ? 'In der Lobby' : 'Läuft'}
                <span style={{ float: 'right', color: 'var(--color-muted)', fontSize: '0.8rem' }}>
                  {new Date(g.createdAt).toLocaleDateString()}
                </span>
              </button>
            ))}
          </div>
        )}

        {error && (
          <p style={{ color: 'var(--color-error)', marginTop: '0.5rem', fontSize: '0.9rem' }}>
            {error}
          </p>
        )}
      </div>

      {showJoinModal && <JoinRoundModal onClose={() => setShowJoinModal(false)} />}
    </div>
  );
}
