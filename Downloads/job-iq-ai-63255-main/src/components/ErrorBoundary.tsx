import { Component, ErrorInfo, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="flex flex-col items-center justify-center min-h-[200px] p-8 text-center">
            <AlertTriangle className="h-10 w-10 text-destructive mb-4" />
            <h2 className="text-lg font-semibold text-destructive">
              Une erreur est survenue
            </h2>
            <p className="text-muted-foreground mt-2 max-w-md">
              {this.state.error?.message || "Veuillez rafraîchir la page ou réessayer."}
            </p>
            <Button
              onClick={() => this.setState({ hasError: false })}
              className="mt-4"
              variant="outline"
            >
              Réessayer
            </Button>
          </div>
        )
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
