import { AlertCircle } from "lucide-react";

interface MaintenanceBannerProps {
  message?: string;
  fullPage?: boolean;
}

export function MaintenanceBanner({ message, fullPage }: MaintenanceBannerProps) {
  if (fullPage) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="max-w-md text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center mx-auto">
            <AlertCircle className="w-8 h-8 text-amber-500" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Maintenance en cours</h1>
          <p className="text-muted-foreground">
            {message || "La plateforme est temporairement indisponible pour maintenance. Veuillez réessayer dans quelques minutes."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 flex items-center gap-3">
      <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
      <p className="text-sm text-amber-700 dark:text-amber-400">
        Mode maintenance actif — seuls les admins ont accès. {message}
      </p>
    </div>
  );
}
