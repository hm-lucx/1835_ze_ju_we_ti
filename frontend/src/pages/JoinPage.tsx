import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import useAuth from '../hooks/useAuth';

const API_URL = import.meta.env.VITE_API_URL || '';

async function apiPost(path: string, token: string, body: unknown) {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  return res.json();
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

    apiPost(`/api/games/${gameId}/join`, token, { inviteToken }).then(data => {
      if (data.message && data.game) {
        setStatus('success');
        setMessage(data.message);
      } else {
        setStatus('error');
        setMessage(data.message || 'Beitritt fehlgeschlagen.');
      }
    }).catch(() => {
      setStatus('error');
      setMessage('Beitritt fehlgeschlagen.');
    });
  }, [token, searchParams]);

  return (
    <div style={centerStyle}>
      <div style={cardStyle}>
        {status === 'joining' && <p>Wird der Runde beigetreten…</p>}
        {status === 'success' && (
          <>
            <p style={{ color: 'var(--color-accent)', fontWeight: 600 }}>{message}</p>
            <button
              onClick={() => navigate('/lobby')}
              style={{ marginTop: '1rem', padding: '0.75rem 2rem', fontFamily: 'var(--font-body)', fontSize: '1rem', fontWeight: 600, color: '#1a1410', backgroundColor: 'var(--color-accent)', border: 'none', cursor: 'pointer' }}
            >
              Zur Lobby
            </button>
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
