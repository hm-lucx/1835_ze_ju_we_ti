import { useState, type FormEvent } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import useAuth from '../hooks/useAuth';
import AuthCard from '../components/auth/AuthCard';
import AuthInput from '../components/auth/AuthInput';
import AuthButton from '../components/auth/AuthButton';
import AuthLink from '../components/auth/AuthLink';

export default function LoginPage() {
  const { login, isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  if (isAuthenticated) {
    return <Navigate to="/lobby" replace />;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    if (!username.trim() || !password) {
      setError('Bitte Benutzername und Passwort eingeben.');
      return;
    }

    try {
      await login(username, password);
      navigate('/lobby', { replace: true });
    } catch (err: unknown) {
      const apiErr = err as { message?: string };
      setError(apiErr.message || 'Anmeldung fehlgeschlagen.');
    }
  }

  return (
    <AuthCard title="1835" subtitle="Willkommen zurück">
      <form onSubmit={handleSubmit}>
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
        <AuthButton type="submit" loading={loading}>
          Anmelden
        </AuthButton>
      </form>
      <div style={{ textAlign: 'center', marginTop: '0.75rem' }}>
        <AuthLink to="/forgot-password">Passwort vergessen?</AuthLink>
      </div>
      <p style={{ textAlign: 'center', color: 'var(--color-muted)', fontSize: '0.9rem', marginTop: '1rem' }}>
        Noch kein Konto? <AuthLink to="/register" style={{ marginTop: 0 }}>Registrieren</AuthLink>
      </p>
    </AuthCard>
  );
}
