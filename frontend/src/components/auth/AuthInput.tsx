import { type InputHTMLAttributes, useState, useId } from 'react';

const wrapperStyle: React.CSSProperties = {
  marginBottom: '1rem',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  marginBottom: '0.35rem',
  fontSize: '0.9rem',
  color: 'var(--color-text)',
};

const inputBase: React.CSSProperties = {
  display: 'block',
  width: '100%',
  padding: '0.65rem 0.75rem',
  fontFamily: 'var(--font-body)',
  fontSize: '1rem',
  color: 'var(--color-text)',
  backgroundColor: '#1e1812',
  borderWidth: '1px',
  borderStyle: 'solid',
  borderColor: 'var(--color-border)',
  borderRadius: 0,
  outline: 'none',
  transition: 'border-color 0.2s',
};

const errorStyle: React.CSSProperties = {
  color: 'var(--color-error)',
  fontSize: '0.8rem',
  marginTop: '0.25rem',
};

interface AuthInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  errorMessage?: string;
}

export default function AuthInput({ label, errorMessage, id, style, ...inputProps }: AuthInputProps) {
  const generatedId = useId();
  const inputId = id || generatedId;
  const [focused, setFocused] = useState(false);

  return (
    <div style={wrapperStyle}>
      <label htmlFor={inputId} style={labelStyle}>{label}</label>
      <input
        id={inputId}
        {...inputProps}
        style={{
          ...inputBase,
          ...(focused ? { borderColor: 'var(--color-accent)' } : {}),
          ...(errorMessage ? { borderColor: 'var(--color-error)' } : {}),
          ...style,
        }}
        onFocus={(e) => { setFocused(true); inputProps.onFocus?.(e); }}
        onBlur={(e) => { setFocused(false); inputProps.onBlur?.(e); }}
      />
      {errorMessage && <p style={errorStyle}>{errorMessage}</p>}
    </div>
  );
}
