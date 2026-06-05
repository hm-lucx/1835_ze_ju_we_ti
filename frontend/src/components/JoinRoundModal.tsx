import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { apiPost } from '../lib/api';
import QRScanner from './QRScanner';

interface JoinRoundModalProps {
  onClose: () => void;
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  zIndex: 1000, padding: '1rem',
};

const modalStyle: React.CSSProperties = {
  backgroundColor: 'var(--color-surface)',
  border: '1px solid var(--color-border)',
  boxShadow: '0 4px 20px rgba(201, 153, 58, 0.15)',
  padding: '2rem',
  width: '100%',
  maxWidth: 440,
  position: 'relative',
};

const titleStyle: React.CSSProperties = {
  fontFamily: 'var(--font-display)',
  fontSize: '1.3rem',
  fontWeight: 700,
  color: 'var(--color-accent)',
  marginBottom: '1.25rem',
  textAlign: 'center',
};

const tabRowStyle: React.CSSProperties = {
  display: 'flex', borderBottom: '1px solid var(--color-border)', marginBottom: '1rem',
};

const tabStyle = (active: boolean): React.CSSProperties => ({
  flex: 1, padding: '0.5rem', textAlign: 'center', cursor: 'pointer',
  fontFamily: 'var(--font-body)', fontSize: '0.9rem', fontWeight: 600,
  color: active ? 'var(--color-accent)' : 'var(--color-muted)',
  backgroundColor: 'transparent', border: 'none',
  borderBottom: active ? '2px solid var(--color-accent)' : '2px solid transparent',
});

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '0.6rem', fontFamily: 'var(--font-body)', fontSize: '0.95rem',
  backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)',
  color: 'var(--color-text)', boxSizing: 'border-box',
  marginBottom: '0.5rem',
};

const buttonStyle: React.CSSProperties = {
  display: 'block', width: '100%', padding: '0.65rem',
  fontFamily: 'var(--font-body)', fontSize: '1rem', fontWeight: 600,
  color: '#1a1410', backgroundColor: 'var(--color-accent)',
  border: 'none', cursor: 'pointer',
};

const closeStyle: React.CSSProperties = {
  position: 'absolute', top: '0.5rem', right: '0.75rem',
  background: 'none', border: 'none', color: 'var(--color-muted)',
  cursor: 'pointer', fontSize: '1.2rem',
};

export default function JoinRoundModal({ onClose }: JoinRoundModalProps) {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<'link' | 'qr'>('link');
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [qrFallback, setQrFallback] = useState(false);

  async function handleJoin(code: string) {
    if (!token) return;
    setLoading(true);
    setError('');
    try {
      const data = await apiPost('/api/rounds/join', { inviteCode: code }, token) as { roundId: string };
      navigate(`/lobby?game=${data.roundId}`);
    } catch (err: unknown) {
      const msg = (err as { message?: string }).message || 'Beitritt fehlgeschlagen.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit() {
    const trimmed = input.trim();
    if (!trimmed) {
      setError('Bitte gib einen Code oder Link ein.');
      return;
    }
    const match = trimmed.match(/[A-Z0-9]{6}$/i);
    if (match) {
      handleJoin(match[0].toUpperCase());
    } else {
      setError('Ungültiger Code. Gib den 6-stelligen Code oder den vollständigen Link ein.');
    }
  }

  function handleQrScan(code: string) {
    handleJoin(code);
  }

  function handleQrError(msg: string) {
    if (msg.includes('verweigert') || msg.includes('Berechtigung')) {
      setQrFallback(true);
      setTab('link');
      setError('Kamera-Berechtigung verweigert. Bitte Code manuell eingeben.');
    } else {
      setError(msg);
    }
  }

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={e => e.stopPropagation()}>
        <button style={closeStyle} onClick={onClose}>✕</button>
        <h2 style={titleStyle}>Runde beitreten</h2>

        <div style={tabRowStyle}>
          <button style={tabStyle(tab === 'link')} onClick={() => setTab('link')}>
            Link / Code
          </button>
          <button style={tabStyle(tab === 'qr')} onClick={() => setTab('qr')}>
            QR-Code scannen
          </button>
        </div>

        {tab === 'link' && (
          <div>
            <input
              type="text"
              placeholder="Einladungscode (z.B. A3F7K2) oder Link"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              style={inputStyle}
              autoFocus
            />
            <button
              onClick={handleSubmit}
              disabled={loading}
              style={{ ...buttonStyle, opacity: loading ? 0.5 : 1 }}
            >
              {loading ? 'Wird beigetreten…' : 'Beitreten'}
            </button>
          </div>
        )}

        {tab === 'qr' && !qrFallback && (
          <div>
            <QRScanner onScan={handleQrScan} onError={handleQrError} />
          </div>
        )}

        {tab === 'qr' && qrFallback && (
          <p style={{ color: 'var(--color-muted)', fontSize: '0.85rem', textAlign: 'center' }}>
            Kamera nicht verfügbar. Wechsel zum Link-Tab und gib den Code manuell ein.
          </p>
        )}

        {error && (
          <p style={{ color: 'var(--color-error)', fontSize: '0.85rem', textAlign: 'center', marginTop: '0.75rem' }}>
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
