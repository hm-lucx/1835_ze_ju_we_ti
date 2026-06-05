import type { ReactNode } from 'react';
import PageShell from '../PageShell';

interface AuthCardProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
}

export default function AuthCard({ title, subtitle, children }: AuthCardProps) {
  return (
    <PageShell center>
      <h1 className="page-title" style={{ marginBottom: subtitle ? '0.25rem' : undefined }}>{title}</h1>
      {subtitle && <p className="page-muted" style={{ marginBottom: '1.5rem' }}>{subtitle}</p>}
      {children}
    </PageShell>
  );
}
