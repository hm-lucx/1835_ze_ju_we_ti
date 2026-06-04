import type { ButtonHTMLAttributes } from 'react';

const buttonStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  padding: '0.75rem',
  fontFamily: 'var(--font-body)',
  fontSize: '1.05rem',
  fontWeight: 600,
  color: '#1a1410',
  backgroundColor: 'var(--color-accent)',
  border: 'none',
  borderRadius: 0,
  cursor: 'pointer',
  transition: 'transform 0.15s, opacity 0.15s',
  marginTop: '0.5rem',
};

const disabledStyle: React.CSSProperties = {
  opacity: 0.5,
  cursor: 'not-allowed',
};

interface AuthButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
}

export default function AuthButton({ loading, disabled, children, style, ...buttonProps }: AuthButtonProps) {
  return (
    <button
      {...buttonProps}
      disabled={disabled || loading}
      className="auth-button"
      style={{
        ...buttonStyle,
        ...(disabled || loading ? disabledStyle : {}),
        ...style,
      }}
    >
      {loading ? 'Wird gesendet…' : children}
    </button>
  );
}
