import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";

interface ErrorRetryProps {
  message?: string;
  onRetry: () => void;
}

export const ErrorRetry = ({ message, onRetry }: ErrorRetryProps) => {
  const { t } = useLanguage();

  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
        <AlertCircle className="w-6 h-6 text-destructive" />
      </div>
      <p className="text-muted-foreground mb-4">
        {message || t('error.loadFailed')}
      </p>
      <Button variant="outline" onClick={onRetry} className="gap-2">
        <RefreshCw className="w-4 h-4" />
        {t('error.retry')}
      </Button>
    </div>
  );
};
