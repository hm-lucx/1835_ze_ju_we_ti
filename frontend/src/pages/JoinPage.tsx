import { useEffect, useState } from 'react';
import { useSearchParams, useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { apiPost } from '../lib/api';
import PageShell from '../components/PageShell';

export default function JoinPage() {
  const { token } = useAuth();
  const [searchParams] = useSearchParams();
  const { inviteCode: pathCode } = useParams<{ inviteCode?: string }>();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'joining' | 'success' | 'error'>('joining');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) return;

    const gameId = searchParams.get('game');
    const inviteToken = searchParams.get('token');

    if (gameId && inviteToken) {
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
      return;
    }

    if (pathCode) {
      apiPost('/api/rounds/join', { inviteCode: pathCode.toUpperCase() }, token).then(data => {
        const res = data as { roundId: string };
        if (res.roundId) {
          setStatus('success');
          setMessage('Beitritt erfolgreich.');
          setTimeout(() => navigate(`/lobby?game=${res.roundId}`), 1500);
        } else {
          setStatus('error');
          setMessage('Beitritt fehlgeschlagen.');
        }
      }).catch((err: { message?: string }) => {
        setStatus('error');
        setMessage(err.message || 'Beitritt fehlgeschlagen.');
      });
      return;
    }

    setStatus('error');
    setMessage('Ungültiger Einladungslink.');
  }, [token, searchParams, pathCode, navigate]);

  return (
    <PageShell withHeader center>
      {status === 'joining' && <p className="page-muted">Wird der Runde beigetreten…</p>}
      {status === 'success' && (
        <>
          <p style={{ color: 'var(--color-accent)', fontWeight: 600, textAlign: 'center' }}>{message}</p>
          <p className="page-muted" style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}>
            Weiterleitung zur Lobby…
          </p>
        </>
      )}
      {status === 'error' && (
        <>
          <p className="page-error">{message}</p>
          <button type="button" className="btn" style={{ marginTop: '1rem' }} onClick={() => navigate('/lobby')}>
            Zur Lobby
          </button>
        </>
      )}
    </PageShell>
  );
}
