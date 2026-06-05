import type { ReactNode } from 'react';
import AppHeader from './AppHeader';

interface PageShellProps {
  children: ReactNode;
  wide?: boolean;
  withHeader?: boolean;
  center?: boolean;
}

export default function PageShell({ children, wide, withHeader, center }: PageShellProps) {
  const cardClass = wide ? 'page-card page-card--wide' : 'page-card page-card--auth';
  const innerClass = center ? 'page__inner page__inner--center' : 'page__inner';

  return (
    <div className="page">
      {withHeader && <AppHeader />}
      <div className={innerClass}>
        <div className={cardClass}>
          {children}
        </div>
      </div>
    </div>
  );
}
