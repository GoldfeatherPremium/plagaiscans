import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface AIDisclaimerProps {
  variant?: 'default' | 'inline';
  className?: string;
}

export function AIDisclaimer({ variant = 'default', className = '' }: AIDisclaimerProps) {
  if (variant === 'inline') {
    return (
      <p className={`text-sm text-muted-foreground italic ${className}`}>
        AI-content indicators are provided to support academic review and should not be considered definitive judgments.
      </p>
    );
  }

  return (
    <Alert variant="default" className={`border-primary/20 bg-primary/5 ${className}`}>
      <AlertCircle className="h-4 w-4 text-primary" />
      <AlertDescription className="text-sm text-muted-foreground">
        AI-content indicators are provided to support academic review and should not be considered definitive judgments.
      </AlertDescription>
    </Alert>
  );
}
