import React from 'react';
import {AlertTriangle, RotateCcw} from 'lucide-react';

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<{children: React.ReactNode}, State> {
  constructor(props: {children: React.ReactNode}) {
    super(props);
    this.state = {hasError: false, message: ''};
  }

  static getDerivedStateFromError(error: Error): State {
    let display = error.message || 'An unexpected error occurred.';
    try {
      const parsed = JSON.parse(error.message);
      if (parsed?.error) display = parsed.error;
    } catch {
      // Plain error message
    }
    return {hasError: true, message: display};
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-light-surface dark:bg-dark-surface p-6">
          <div className="max-w-md w-full rounded-xl bg-light-surface-bright dark:bg-dark-surface-container border border-light-outline-variant dark:border-dark-outline-variant p-6 flex flex-col gap-4">
            <div className="flex items-center gap-3 text-light-error dark:text-dark-error">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h1 className="font-headline text-xl font-bold">Something went wrong</h1>
            </div>
            <p className="text-sm text-light-on-surface-variant dark:text-dark-on-surface-variant">
              {this.state.message}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-light-primary dark:bg-dark-primary text-light-on-primary dark:text-dark-on-primary text-sm font-semibold whitespace-nowrap"
            >
              <RotateCcw className="w-4 h-4" />
              Reload Storefront
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
