import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('Page crashed:', error, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center ambient-bg text-[var(--text)]">
        <h1 className="text-3xl heading-serif mb-3">Something went wrong.</h1>
        <p className="text-[var(--muted-light)] text-sm mb-6 max-w-md">
          This page hit an error. Your saved data is safe. Reloading usually fixes it.
        </p>
        <button onClick={() => window.location.assign('/dashboard')} className="btn-primary px-6 py-3 text-xs uppercase tracking-widest">
          Back to Dashboard
        </button>
      </div>
    );
  }
}
