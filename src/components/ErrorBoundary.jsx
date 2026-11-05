import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null, showDetails: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    console.error('MOLQEN Core Diagnostic Intercept:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          width: '100vw',
          backgroundColor: '#0d1514',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          boxSizing: 'border-box',
          fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif"
        }}>
          <div style={{
            maxWidth: '560px',
            width: '100%',
            background: '#ffffff',
            borderRadius: '16px',
            padding: '32px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)',
            border: '1px solid #e2e8f0'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div style={{
                width: '44px',
                height: '44px',
                borderRadius: '12px',
                background: '#fee2e2',
                color: '#ef4444',
                fontSize: '22px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                ⚠️
              </div>
              <div>
                <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: '#0f172a' }}>
                  Laboratory Session Diagnostic
                </h2>
                <span style={{ fontSize: '11px', color: '#64748b' }}>
                  GLP Integrity Shield • Local UI Recoverable
                </span>
              </div>
            </div>

            <p style={{ fontSize: '13px', color: '#475569', lineHeight: '1.6', margin: '0 0 20px 0' }}>
              MOLQEN OS intercepted an unexpected render issue in the current workspace view. All synchronized chemical ledgers, notebook entries, and presence data in Firestore remain completely secure.
            </p>

            <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={this.handleReload}
                className="tactile-action-btn"
                style={{
                  background: 'linear-gradient(135deg, #2d6a4f 0%, #1b4332 100%)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '10px 18px',
                  fontSize: '12px',
                  fontWeight: '700',
                  cursor: 'pointer'
                }}
              >
                🔄 Reload Workspace Session
              </button>
              <button
                type="button"
                onClick={this.handleReset}
                className="tactile-action-btn"
                style={{
                  background: '#f8fafc',
                  color: '#1e293b',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  padding: '10px 18px',
                  fontSize: '12px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                ↩ Try Resuming Module
              </button>
              <button
                type="button"
                onClick={() => this.setState((prev) => ({ showDetails: !prev.showDetails }))}
                style={{
                  background: 'transparent',
                  color: '#64748b',
                  border: 'none',
                  padding: '10px 12px',
                  fontSize: '12px',
                  cursor: 'pointer',
                  textDecoration: 'underline'
                }}
              >
                {this.state.showDetails ? 'Hide Diagnostics' : 'View Diagnostics'}
              </button>
            </div>

            {this.state.showDetails && (
              <div style={{
                background: '#0f172a',
                color: '#f8fafc',
                borderRadius: '8px',
                padding: '14px',
                fontSize: '11px',
                fontFamily: 'monospace',
                overflowX: 'auto',
                maxHeight: '180px',
                lineHeight: '1.5'
              }}>
                <div style={{ color: '#f87171', fontWeight: '700', marginBottom: '6px' }}>
                  {this.state.error?.toString()}
                </div>
                <div style={{ color: '#94a3b8', whiteSpace: 'pre-wrap' }}>
                  {this.state.errorInfo?.componentStack}
                </div>
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

