import { useState, type FormEvent } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import useAuth from '../hooks/useAuth';
import AuthCard from '../components/auth/AuthCard';
import AuthInput from '../components/auth/AuthInput';
import AuthButton from '../components/auth/AuthButton';

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const tokenParam = searchParams.get('token');
  const { resetPassword, loading } = useAuth();
  const navigate = useNavigate();
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('');
  const [error, setError] = useState('');

  if (!tokenParam) {
    return (
      <AuthCard title="Passwort zurücksetzen">
        <p style={{ textAlign: 'center', color: 'var(--color-error)', marginBottom: '1rem' }}>
          Ungültiger oder fehlender Reset-Token.
        </p>
        <div style={{ textAlign: 'center' }}>
          <Link to="/forgot-password" style={{ color: 'var(--color-accent)' }}>
            Passwort-Reset erneut anfordern
          </Link>
        </div>
      </AuthCard>
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    if (newPassword.length < 8) {
      setError('Das Passwort muss mindestens 8 Zeichen lang sein.');
      return;
    }

    if (newPassword !== newPasswordConfirm) {
      setError('Passwörter stimmen nicht überein.');
      return;
    }

    try {
      await resetPassword(tokenParam!, newPassword, newPasswordConfirm);
      navigate('/login?reset=success', { replace: true });
    } catch (err: unknown) {
      const apiErr = err as { message?: string };
      setError(apiErr.message || 'Fehler beim Zurücksetzen.');
    }
  }

  return (
    <AuthCard title="Passwort zurücksetzen" subtitle="Wähle ein neues Passwort">
      <form onSubmit={handleSubmit}>
        <AuthInput
          label="Neues Passwort"
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          autoComplete="new-password"
        />
        <AuthInput
          label="Passwort bestätigen"
          type="password"
          value={newPasswordConfirm}
          onChange={(e) => setNewPasswordConfirm(e.target.value)}
          autoComplete="new-password"
        />
        {error && (
          <p style={{ color: 'var(--color-error)', marginBottom: '0.5rem', fontSize: '0.9rem' }}>
            {error}
          </p>
        )}
        <AuthButton type="submit" loading={loading}>
          Passwort zurücksetzen
        </AuthButton>
      </form>
    </AuthCard>
  );
}
