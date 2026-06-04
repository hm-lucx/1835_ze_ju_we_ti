import { useState, type FormEvent } from 'react';
import useAuth from '../hooks/useAuth';
import AuthCard from '../components/auth/AuthCard';
import AuthInput from '../components/auth/AuthInput';
import AuthButton from '../components/auth/AuthButton';
import AuthLink from '../components/auth/AuthLink';

export default function ForgotPasswordPage() {
  const { forgotPassword, loading } = useAuth();
  const [username, setUsername] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    if (!username.trim()) {
      setError('Bitte gib deinen Benutzernamen ein.');
      return;
    }

    try {
      await forgotPassword(username);
      setSubmitted(true);
    } catch (err: unknown) {
      const apiErr = err as { message?: string };
      setError(apiErr.message || 'Fehler beim Senden.');
    }
  }

  if (submitted) {
    return (
      <AuthCard title="Passwort vergessen">
        <p style={{ textAlign: 'center', color: 'var(--color-text)', marginBottom: '1rem' }}>
          Wenn der Benutzer existiert, wurde ein Reset-Token erstellt.
        </p>
        <div style={{ textAlign: 'center' }}>
          <AuthLink to="/login">Zurück zum Login</AuthLink>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Passwort vergessen" subtitle="Gib deinen Benutzernamen ein">
      <form onSubmit={handleSubmit}>
        <AuthInput
          label="Benutzername"
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
        />
        {error && (
          <p style={{ color: 'var(--color-error)', marginBottom: '0.5rem', fontSize: '0.9rem' }}>
            {error}
          </p>
        )}
        <AuthButton type="submit" loading={loading}>
          Senden
        </AuthButton>
      </form>
      <div style={{ textAlign: 'center', marginTop: '0.75rem' }}>
        <AuthLink to="/login">Zurück zum Login</AuthLink>
      </div>
    </AuthCard>
  );
}
