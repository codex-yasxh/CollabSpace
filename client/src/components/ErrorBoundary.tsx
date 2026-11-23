import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "./ui/Button.js";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Top-level and route-level error boundary per blueprint and T7.2:
 * Renders a plain recovery message and a "Back to documents" button.
 * Prevents white/blank screens on uncaught runtime errors.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error("Uncaught error caught by ErrorBoundary:", error, errorInfo);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-fog flex flex-col justify-center items-center px-4 py-12">
          <div className="w-full max-w-auth bg-paper border border-line rounded-control p-6 flex flex-col gap-4 text-center">
            <div className="text-center mb-1">
              <a
                href="/"
                className="text-ui-md font-serif font-semibold text-ink tracking-tight focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-2"
              >
                CollabSpace
              </a>
            </div>

            <h1 className="text-ui-md font-medium text-ink">Something went wrong</h1>
            <p className="text-ui-sm text-ink-soft">
              An unexpected error occurred. You can return to your documents.
            </p>

            <div className="pt-2">
              <Button
                variant="secondary"
                className="w-full"
                onClick={() => {
                  this.setState({ hasError: false, error: null });
                  window.location.href = "/";
                }}
              >
                Back to documents
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
