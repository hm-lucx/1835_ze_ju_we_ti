import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import RegisterPage from './RegisterPage';

const mockRegister = vi.fn();

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: null,
    token: null,
    isAuthenticated: false,
    loading: false,
    login: vi.fn(),
    register: mockRegister,
    forgotPassword: vi.fn(),
    resetPassword: vi.fn(),
    logout: vi.fn(),
  }),
  AuthProvider: ({ children }: any) => children,
}));

function renderPage() {
  return render(
    <BrowserRouter>
      <RegisterPage />
    </BrowserRouter>
  );
}

beforeEach(() => {
  mockRegister.mockReset();
});

describe('RegisterPage', () => {
  it('rendert alle Formularfelder', () => {
    renderPage();

    expect(screen.getByLabelText('Benutzername')).toBeInTheDocument();
    expect(screen.getByLabelText('E-Mail')).toBeInTheDocument();
    expect(screen.getByLabelText('Geburtsdatum')).toBeInTheDocument();
    expect(screen.getByLabelText('Passwort')).toBeInTheDocument();
    expect(screen.getByLabelText('Passwort bestätigen')).toBeInTheDocument();
  });

  it('Alterscheck: Nutzer unter 16 → clientseitige Fehlermeldung', async () => {
    renderPage();

    await userEvent.type(screen.getByLabelText('Benutzername'), 'jung');
    await userEvent.type(screen.getByLabelText('E-Mail'), 'jung@test.de');
    await userEvent.type(screen.getByLabelText('Geburtsdatum'), '2015-06-04');
    await userEvent.type(screen.getByLabelText('Passwort'), 'GeheimesPasswort123');
    await userEvent.type(screen.getByLabelText('Passwort bestätigen'), 'GeheimesPasswort123');
    await userEvent.click(screen.getByRole('button', { name: /Registrieren/i }));

    expect(screen.getByText(/mindestens 16 Jahre alt/i)).toBeInTheDocument();
    expect(mockRegister).not.toHaveBeenCalled();
  });

  it('Passwort-Mismatch → Fehlermeldung, kein API-Call', async () => {
    renderPage();

    await userEvent.type(screen.getByLabelText('Benutzername'), 'testuser');
    await userEvent.type(screen.getByLabelText('E-Mail'), 'test@test.de');
    await userEvent.type(screen.getByLabelText('Geburtsdatum'), '2000-01-01');
    await userEvent.type(screen.getByLabelText('Passwort'), 'Passwort123');
    await userEvent.type(screen.getByLabelText('Passwort bestätigen'), 'AnderesPasswort');
    await userEvent.click(screen.getByRole('button', { name: /Registrieren/i }));

    expect(screen.getByText('Passwörter stimmen nicht überein.')).toBeInTheDocument();
    expect(mockRegister).not.toHaveBeenCalled();
  });

  it('Benutzername zu kurz (< 3 Zeichen) → Fehlermeldung', async () => {
    renderPage();

    await userEvent.type(screen.getByLabelText('Benutzername'), 'ab');
    await userEvent.type(screen.getByLabelText('E-Mail'), 'ab@test.de');
    await userEvent.type(screen.getByLabelText('Geburtsdatum'), '2000-01-01');
    await userEvent.type(screen.getByLabelText('Passwort'), 'Passwort123');
    await userEvent.type(screen.getByLabelText('Passwort bestätigen'), 'Passwort123');
    await userEvent.click(screen.getByRole('button', { name: /Registrieren/i }));

    expect(screen.getByText('Mindestens 3 Zeichen.')).toBeInTheDocument();
    expect(mockRegister).not.toHaveBeenCalled();
  });

  it('enthält Link zum Login', () => {
    renderPage();

    expect(screen.getByText('Anmelden')).toBeInTheDocument();
  });
});
