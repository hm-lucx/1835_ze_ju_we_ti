import { Link, type LinkProps } from 'react-router-dom';

const linkStyle: React.CSSProperties = {
  color: 'var(--color-accent)',
  textDecoration: 'underline',
  fontSize: '0.9rem',
  display: 'inline-block',
  marginTop: '0.75rem',
};

export default function AuthLink({ children, style, ...linkProps }: LinkProps) {
  return (
    <Link {...linkProps} style={{ ...linkStyle, ...style }}>
      {children}
    </Link>
  );
}
