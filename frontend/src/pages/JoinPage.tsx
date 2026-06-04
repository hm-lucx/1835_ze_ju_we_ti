import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { apiPost } from '../lib/api';

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
  maxWidth: 420,
  textAlign: 'center',
} as const;

export default function JoinPage() {
  const { token } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'joining' | 'success' | 'error'>('joining');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) return;

    const gameId = searchParams.get('game');
    const inviteToken = searchParams.get('token');

    if (!gameId || !inviteToken) {
      setStatus('error');
      setMessage('Ungültiger Einladungslink.');
      return;
    }

    apiPost(`/api/games/${gameId}/join`, { inviteToken }, token).then(data => {
      if (data.message && data.game) {
        setStatus('success');
        setMessage(data.message);
        setTimeout(() => navigate(`/lobby?game=${gameId}`), 1500);
      } else {
        setStatus('error');
        setMessage(data.message || 'Beitritt fehlgeschlagen.');
      }
    }).catch((err: { message?: string }) => {
      setStatus('error');
      setMessage(err.message || 'Beitritt fehlgeschlagen.');
    });
  }, [token, searchParams, navigate]);

  return (
    <div style={centerStyle}>
      <div style={cardStyle}>
        {status === 'joining' && <p>Wird der Runde beigetreten…</p>}
        {status === 'success' && (
          <>
            <p style={{ color: 'var(--color-accent)', fontWeight: 600 }}>{message}</p>
            <p style={{ color: 'var(--color-muted)', fontSize: '0.85rem', marginTop: '0.5rem' }}>
              Weiterleitung zur Lobby…
            </p>
          </>
        )}
        {status === 'error' && (
          <>
            <p style={{ color: 'var(--color-error)' }}>{message}</p>
            <button
              onClick={() => navigate('/lobby')}
              style={{ marginTop: '1rem', padding: '0.75rem 2rem', fontFamily: 'var(--font-body)', fontSize: '1rem', fontWeight: 600, color: '#1a1410', backgroundColor: 'var(--color-accent)', border: 'none', cursor: 'pointer' }}
            >
              Zur Lobby
            </button>
          </>
        )}
      </div>
    </div>
  );
}
