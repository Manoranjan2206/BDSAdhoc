import React from 'react';

// Top-level ErrorBoundary — the Bold Reports / BoldBI embedded SDK can throw
// during initialization, which previously unmounted the entire SPA. This
// boundary catches those exceptions, lets the rest of the shell stay
// responsive, and offers a retry action.
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, info: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info);
    this.setState({ info });
  }

  reset = () => this.setState({ error: null, info: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-950 p-6">
        <div className="max-w-md text-center space-y-4 bg-white dark:bg-slate-900 rounded-2xl shadow-xl p-8 border border-slate-200 dark:border-slate-800">
          <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 mx-auto flex items-center justify-center text-xl">!</div>
          <h1 className="text-lg font-bold text-slate-900 dark:text-white">Something went wrong</h1>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            The embedded editor failed to initialize. This usually means the
            Bold Reports or Bold BI SDK could not load — try reloading.
          </p>
          <pre className="text-left text-xs bg-slate-100 dark:bg-slate-800 p-3 rounded max-h-32 overflow-auto">{String(error?.message ?? error)}</pre>
          <button
            onClick={this.reset}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }
}
