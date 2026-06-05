import { Component, type ReactNode, type ErrorInfo } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', padding: '1rem', backgroundColor: 'var(--color-bg)' }}>
          <div style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', padding: '2rem', maxWidth: 420, width: '100%', textAlign: 'center' }}>
            <h1 style={{ fontFamily: 'var(--font-display)', color: 'var(--color-error)', marginBottom: '0.5rem' }}>Fehler</h1>
            <p style={{ color: 'var(--color-text)', marginBottom: '1rem' }}>
              Ein unerwarteter Fehler ist aufgetreten.
            </p>
            <p style={{ color: 'var(--color-muted)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
              {this.state.error?.message}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{ padding: '0.75rem 2rem', fontFamily: 'var(--font-body)', fontSize: '1rem', fontWeight: 600, color: '#1a1410', backgroundColor: 'var(--color-accent)', border: 'none', cursor: 'pointer' }}
            >
              Seite neu laden
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
