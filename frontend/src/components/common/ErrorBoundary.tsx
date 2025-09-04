'use client';

import React from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<ErrorFallbackProps>;
}

interface ErrorFallbackProps {
  error: Error | null;
  resetError: () => void;
  errorInfo: React.ErrorInfo | null;
}

const DefaultErrorFallback: React.FC<ErrorFallbackProps> = ({ 
  error, 
  resetError,
  errorInfo 
}) => {
  const isDevelopment = process.env.NODE_ENV === 'development';

  const handleReload = () => {
    window.location.reload();
  };

  const handleGoHome = () => {
    window.location.href = '/';
  };

  return (
    <div className="min-h-screen bg-secondary-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="flex items-center justify-center w-16 h-16 bg-error-100 rounded-full">
            <AlertTriangle className="w-8 h-8 text-error-600" />
          </div>
        </div>
        
        <div className="mt-6 text-center">
          <h2 className="text-2xl font-bold text-secondary-900">
            Something went wrong
          </h2>
          <p className="mt-2 text-sm text-secondary-600">
            We encountered an unexpected error. Please try refreshing the page.
          </p>
        </div>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          {isDevelopment && error && (
            <div className="mb-6 p-4 bg-error-50 border border-error-200 rounded-lg">
              <h3 className="text-sm font-medium text-error-800 mb-2">
                Error Details:
              </h3>
              <p className="text-xs text-error-700 font-mono break-all">
                {error.message}
              </p>
              {errorInfo?.componentStack && (
                <details className="mt-2">
                  <summary className="text-xs text-error-600 cursor-pointer">
                    Component Stack
                  </summary>
                  <pre className="text-xs text-error-600 mt-1 whitespace-pre-wrap">
                    {errorInfo.componentStack}
                  </pre>
                </details>
              )}
            </div>
          )}

          <div className="space-y-3">
            <button
              onClick={resetError}
              className="w-full flex justify-center items-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Try Again
            </button>

            <button
              onClick={handleReload}
              className="w-full flex justify-center items-center px-4 py-2 border border-secondary-300 rounded-lg shadow-sm text-sm font-medium text-secondary-700 bg-white hover:bg-secondary-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Reload Page
            </button>

            <button
              onClick={handleGoHome}
              className="w-full flex justify-center items-center px-4 py-2 border border-secondary-300 rounded-lg shadow-sm text-sm font-medium text-secondary-700 bg-white hover:bg-secondary-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors"
            >
              <Home className="w-4 h-4 mr-2" />
              Go Home
            </button>
          </div>

          <div className="mt-6 text-center">
            <p className="text-xs text-secondary-500">
              If this problem persists, please{' '}
              <a 
                href="mailto:support@fluxion.pay" 
                className="text-primary-600 hover:text-primary-500"
              >
                contact support
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
    
    this.setState({
      error,
      errorInfo,
    });

    // Report to error tracking service
    if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
      // In a real app, you would report to Sentry here
      console.log('Would report to Sentry:', { error, errorInfo });
    }
  }

  resetError = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError) {
      const ErrorComponent = this.props.fallback || DefaultErrorFallback;
      
      return (
        <ErrorComponent
          error={this.state.error}
          resetError={this.resetError}
          errorInfo={this.state.errorInfo}
        />
      );
    }

    return this.props.children;
  }
}

// Hook for handling async errors in functional components
export const useErrorHandler = () => {
  const [error, setError] = React.useState<Error | null>(null);

  const resetError = React.useCallback(() => {
    setError(null);
  }, []);

  const captureError = React.useCallback((error: Error) => {
    console.error('Error captured:', error);
    setError(error);
  }, []);

  React.useEffect(() => {
    if (error) {
      throw error;
    }
  }, [error]);

  return { captureError, resetError };
};