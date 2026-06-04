import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import LoginPage from './LoginPage';

const mockLogin = vi.fn();

vi.mock('../hooks/useAuth', () => ({
  default: () => ({
    user: null,
    token: null,
    isAuthenticated: false,
    loading: false,
    login: mockLogin,
    register: vi.fn(),
    forgotPassword: vi.fn(),
    resetPassword: vi.fn(),
    logout: vi.fn(),
  }),
}));

function renderPage() {
  return render(
    <BrowserRouter>
      <LoginPage />
    </BrowserRouter>
  );
}

beforeEach(() => {
  mockLogin.mockReset();
});

describe('LoginPage', () => {
  it('rendert Benutzername- und Passwort-Feld', () => {
    renderPage();

    expect(screen.getByLabelText('Benutzername')).toBeInTheDocument();
    expect(screen.getByLabelText('Passwort')).toBeInTheDocument();
  });

  it('zeigt Fehlermeldung bei leeren Feldern', async () => {
    renderPage();

    await userEvent.click(screen.getByRole('button', { name: /Anmelden/i }));

    expect(screen.getByText('Bitte Benutzername und Passwort eingeben.')).toBeInTheDocument();
    expect(mockLogin).not.toHaveBeenCalled();
  });

  it('zeigt Fehlermeldung wenn API 401 zurückgibt', async () => {
    mockLogin.mockRejectedValueOnce({ message: 'Ungültiger Benutzername oder Passwort.' });

    renderPage();

    await userEvent.type(screen.getByLabelText('Benutzername'), 'test');
    await userEvent.type(screen.getByLabelText('Passwort'), 'wrong');
    await userEvent.click(screen.getByRole('button', { name: /Anmelden/i }));

    expect(await screen.findByText('Ungültiger Benutzername oder Passwort.')).toBeInTheDocument();
  });

  it('enthält Link zu Registrierung und Passwort vergessen', () => {
    renderPage();

    expect(screen.getByText('Registrieren')).toBeInTheDocument();
    expect(screen.getByText('Passwort vergessen?')).toBeInTheDocument();
  });
});
