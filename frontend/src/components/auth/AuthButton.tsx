import type { ButtonHTMLAttributes } from 'react';

interface AuthButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
}

export default function AuthButton({ loading, disabled, children, className, ...buttonProps }: AuthButtonProps) {
  return (
    <button
      type="button"
      {...buttonProps}
      disabled={disabled || loading}
      className={`btn auth-button${className ? ` ${className}` : ''}`}
    >
      {loading ? 'Wird gesendet…' : children}
    </button>
  );
}
