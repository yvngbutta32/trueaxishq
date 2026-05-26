import React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  panelName?: string;
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * PanelErrorBoundary — wraps each dashboard panel so a runtime error
 * in one panel does not crash the entire dashboard.
 *
 * Usage:
 *   <PanelErrorBoundary panelName="Invoices">
 *     <InvoicesPanel />
 *   </PanelErrorBoundary>
 */
export class PanelErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Log to console for debugging; in production this could go to Sentry etc.
    console.error(`[PanelErrorBoundary] ${this.props.panelName ?? "Panel"} crashed:`, error, info);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
          <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center mb-4">
            <AlertTriangle className="w-7 h-7 text-red-400" />
          </div>
          <h3 className="text-base font-bold text-[#1C1C1E] mb-1" style={{ fontFamily: "Space Grotesk, sans-serif" }}>
            {this.props.panelName ? `${this.props.panelName} ran into a problem` : "Something went wrong"}
          </h3>
          <p className="text-sm text-gray-500 max-w-xs mb-5">
            An unexpected error occurred. Your data is safe — try refreshing this panel or reloading the page.
          </p>
          <button
            onClick={this.handleReset}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#E8A020] text-white text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            <RefreshCw className="w-4 h-4" />
            Try Again
          </button>
          {this.state.error && (
            <details className="mt-4 text-left max-w-sm">
              <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600">Technical details</summary>
              <pre className="mt-2 text-[10px] text-gray-400 bg-gray-50 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-all">
                {this.state.error.message}
              </pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
