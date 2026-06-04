import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import AuthInput from './AuthInput';

describe('AuthInput', () => {
  it('rendert Label und Input korrekt', () => {
    render(<AuthInput label="Benutzername" type="text" />);

    expect(screen.getByLabelText('Benutzername')).toBeInTheDocument();
  });

  it('zeigt errorMessage als Fehlertext an', () => {
    render(<AuthInput label="Passwort" type="password" errorMessage="Zu kurz." />);

    expect(screen.getByText('Zu kurz.')).toBeInTheDocument();
  });

  it('zeigt keinen Fehlertext wenn errorMessage undefined', () => {
    const { container } = render(<AuthInput label="Test" type="text" />);

    expect(container.querySelectorAll('[style*="color: var(--color-error)"]')).toHaveLength(0);
  });
});
