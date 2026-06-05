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
  backgroundColor: '#1e1812',
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
        className="form-input"
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
