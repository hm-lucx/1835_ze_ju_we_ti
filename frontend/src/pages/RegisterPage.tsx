import { useState, useCallback } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import useAuth from '../hooks/useAuth';
import AuthCard from '../components/auth/AuthCard';
import AuthInput from '../components/auth/AuthInput';
import AuthButton from '../components/auth/AuthButton';
import AuthLink from '../components/auth/AuthLink';

function computeAge(birthDate: string): number {
  const [y, m, d] = birthDate.split('-').map(Number);
  if (!y || !m || !d) return 0;
  const now = new Date();
  let age = now.getFullYear() - y;
  const monthDiff = now.getMonth() + 1 - m;
  const dayDiff = now.getDate() - d;
  if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) age -= 1;
  return age;
}

export default function RegisterPage() {
  const { register, isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  if (isAuthenticated) {
    return <Navigate to="/lobby" replace />;
  }

  function validate(): boolean {
    const errors: Record<string, string> = {};
    if (username.trim().length < 3) errors.username = 'Mindestens 3 Zeichen.';
    if (!email) errors.email = 'E-Mail ist erforderlich.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Ungültige E-Mail-Adresse.';
    if (password.length < 8) errors.password = 'Mindestens 8 Zeichen.';
    if (password !== passwordConfirm) errors.passwordConfirm = 'Passwörter stimmen nicht überein.';
    if (!birthDate) errors.birthDate = 'Bitte wähle dein Geburtsdatum.';
    else if (computeAge(birthDate) < 16) errors.birthDate = 'Du musst mindestens 16 Jahre alt sein, um mitzuspielen.';
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  const handleRegister = useCallback(async () => {
    setError('');
    if (!validate()) return;
    try {
      await register(username, password, passwordConfirm, birthDate, email);
      navigate('/lobby', { replace: true });
    } catch (err: unknown) {
      const apiErr = err as { message?: string };
      if (apiErr.message) {
        if (apiErr.message.includes('bereits vergeben')) {
          setFieldErrors({ username: apiErr.message });
        } else {
          setError(apiErr.message);
        }
      } else {
        setError('Registrierung fehlgeschlagen.');
      }
    }
  }, [username, email, birthDate, password, passwordConfirm, register, navigate]);

  return (
    <AuthCard title="Registrierung" subtitle="Tritt dem Spiel bei">
      <div>
        <AuthInput
          label="Benutzername"
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          errorMessage={fieldErrors.username}
          autoComplete="username"
        />
        <AuthInput
          label="E-Mail"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          errorMessage={fieldErrors.email}
          autoComplete="email"
        />
        <AuthInput
          label="Geburtsdatum"
          type="date"
          value={birthDate}
          onChange={(e) => setBirthDate(e.target.value)}
          errorMessage={fieldErrors.birthDate}
        />
        <AuthInput
          label="Passwort"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          errorMessage={fieldErrors.password}
          autoComplete="new-password"
        />
        <AuthInput
          label="Passwort bestätigen"
          type="password"
          value={passwordConfirm}
          onChange={(e) => setPasswordConfirm(e.target.value)}
          errorMessage={fieldErrors.passwordConfirm}
          autoComplete="new-password"
        />
        {error && (
          <p style={{ color: 'var(--color-error)', marginBottom: '0.5rem', fontSize: '0.9rem' }}>
            {error}
          </p>
        )}
        <AuthButton onClick={handleRegister} loading={loading}>
          Registrieren
        </AuthButton>
      </div>
      <p style={{ textAlign: 'center', color: 'var(--color-muted)', fontSize: '0.9rem', marginTop: '1rem' }}>
        Bereits registriert? <AuthLink to="/login" style={{ marginTop: 0 }}>Anmelden</AuthLink>
      </p>
    </AuthCard>
  );
}
