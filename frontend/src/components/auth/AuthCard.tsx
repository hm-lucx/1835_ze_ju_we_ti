import type { ReactNode } from 'react';

const cardStyle: React.CSSProperties = {
  backgroundColor: 'var(--color-surface)',
  border: '1px solid var(--color-border)',
  borderRadius: 0,
  boxShadow: '0 4px 20px rgba(201, 153, 58, 0.15)',
  padding: '2.5rem 2rem',
  width: '100%',
  maxWidth: 420,
};

const titleStyle: React.CSSProperties = {
  fontFamily: 'var(--font-display)',
  fontSize: '1.75rem',
  fontWeight: 700,
  color: 'var(--color-accent)',
  textAlign: 'center',
  marginBottom: '0.25rem',
};

const subtitleStyle: React.CSSProperties = {
  color: 'var(--color-muted)',
  textAlign: 'center',
  marginBottom: '1.5rem',
  fontSize: '0.95rem',
};

interface AuthCardProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
}

export default function AuthCard({ title, subtitle, children }: AuthCardProps) {
  return (
    <div style={cardStyle}>
      <h1 style={titleStyle}>{title}</h1>
      {subtitle && <p style={subtitleStyle}>{subtitle}</p>}
      {children}
    </div>
  );
}
