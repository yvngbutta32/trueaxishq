import { cn } from "@/lib/utils";
import { AlertTriangle, RotateCcw, Home } from "lucide-react";
import { Component, ReactNode } from "react";

interface Props {
  children: ReactNode;
  /** If true, shows a compact inline error instead of full-screen */
  inline?: boolean;
  /** Label for the section (shown in error message) */
  section?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  retryCount: number;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, retryCount: 0 };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error("[ErrorBoundary] Caught error:", error, info);
  }

  handleRetry = () => {
    this.setState((prev) => ({
      hasError: false,
      error: null,
      retryCount: prev.retryCount + 1,
    }));
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    const { inline, section } = this.props;

    // Compact inline error for panel-level boundaries
    if (inline) {
      return (
        <div
          role="alert"
          className="flex flex-col items-center justify-center gap-3 p-8 text-center rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800"
        >
          <AlertTriangle className="w-8 h-8 text-red-500" aria-hidden="true" />
          <div>
            <p className="font-semibold text-red-700 dark:text-red-400">
              {section ? `${section} failed to load` : "Something went wrong"}
            </p>
            <p className="text-sm text-red-500 mt-1">
              {this.state.error?.message || "An unexpected error occurred."}
            </p>
          </div>
          <button
            onClick={this.handleRetry}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 active:scale-95 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
          >
            <RotateCcw className="w-4 h-4" aria-hidden="true" />
            Try Again
          </button>
        </div>
      );
    }

    // Full-screen error for top-level boundary
    return (
      <div
        role="alert"
        className="flex items-center justify-center min-h-screen p-6 bg-background"
      >
        <div className="flex flex-col items-center w-full max-w-lg text-center">
          <div className="w-16 h-16 rounded-2xl bg-red-100 dark:bg-red-950/30 flex items-center justify-center mb-6">
            <AlertTriangle className="w-8 h-8 text-red-500" aria-hidden="true" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">
            Something went wrong
          </h1>
          <p className="text-muted-foreground mb-6">
            An unexpected error occurred. You can try reloading the page or go
            back to the home page.
          </p>

          {/* Error details (collapsible in production) */}
          {this.state.error && (
            <details className="w-full mb-6 text-left">
              <summary className="text-sm text-muted-foreground cursor-pointer hover:text-foreground transition-colors mb-2">
                Technical details
              </summary>
              <div className="p-3 rounded-lg bg-muted overflow-auto max-h-40">
                <pre className="text-xs text-muted-foreground whitespace-pre-wrap break-words">
                  {this.state.error.message}
                  {"\n\n"}
                  {this.state.error.stack}
                </pre>
              </div>
            </details>
          )}

          <div className="flex flex-col sm:flex-row gap-3 w-full">
            <button
              onClick={this.handleRetry}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold",
                "bg-[#00C9A7] text-white hover:bg-[#00b396] active:scale-95 transition-all",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00C9A7] focus-visible:ring-offset-2"
              )}
            >
              <RotateCcw className="w-4 h-4" aria-hidden="true" />
              Try Again
            </button>
            <button
              onClick={() => (window.location.href = "/")}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold",
                "bg-muted text-foreground hover:bg-muted/80 active:scale-95 transition-all",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border focus-visible:ring-offset-2"
              )}
            >
              <Home className="w-4 h-4" aria-hidden="true" />
              Go Home
            </button>
          </div>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
