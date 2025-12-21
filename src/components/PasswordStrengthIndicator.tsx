import React, { useMemo } from 'react';
import { Check, X } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

interface PasswordStrengthIndicatorProps {
  password: string;
}

interface PasswordRequirement {
  label: string;
  test: (password: string) => boolean;
}

const requirements: PasswordRequirement[] = [
  { label: 'At least 8 characters', test: (p) => p.length >= 8 },
  { label: 'Uppercase letter (A-Z)', test: (p) => /[A-Z]/.test(p) },
  { label: 'Lowercase letter (a-z)', test: (p) => /[a-z]/.test(p) },
  { label: 'Number (0-9)', test: (p) => /[0-9]/.test(p) },
  { label: 'Special character (!@#$%^&*)', test: (p) => /[^A-Za-z0-9]/.test(p) },
];

export function PasswordStrengthIndicator({ password }: PasswordStrengthIndicatorProps) {
  const { strength, passedCount, results } = useMemo(() => {
    const results = requirements.map((req) => ({
      ...req,
      passed: req.test(password),
    }));
    const passedCount = results.filter((r) => r.passed).length;
    const strength = (passedCount / requirements.length) * 100;
    return { strength, passedCount, results };
  }, [password]);

  const getStrengthLabel = () => {
    if (passedCount === 0) return { label: '', color: 'text-muted-foreground' };
    if (passedCount <= 2) return { label: 'Weak', color: 'text-destructive' };
    if (passedCount <= 3) return { label: 'Fair', color: 'text-amber-500' };
    if (passedCount <= 4) return { label: 'Good', color: 'text-primary' };
    return { label: 'Strong', color: 'text-secondary' };
  };

  const getProgressColor = () => {
    if (passedCount <= 2) return 'bg-destructive';
    if (passedCount <= 3) return 'bg-amber-500';
    if (passedCount <= 4) return 'bg-primary';
    return 'bg-secondary';
  };

  const strengthInfo = getStrengthLabel();

  if (!password) return null;

  return (
    <div className="space-y-3 mt-2">
      {/* Strength Bar */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Password strength</span>
          <span className={`font-medium ${strengthInfo.color}`}>
            {strengthInfo.label}
          </span>
        </div>
        <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
          <div 
            className={`h-full transition-all duration-300 rounded-full ${getProgressColor()}`}
            style={{ width: `${strength}%` }}
          />
        </div>
      </div>

      {/* Requirements Checklist */}
      <div className="grid grid-cols-1 gap-1.5">
        {results.map((req, index) => (
          <div 
            key={index}
            className={`flex items-center gap-2 text-xs transition-colors ${
              req.passed ? 'text-secondary' : 'text-muted-foreground'
            }`}
          >
            {req.passed ? (
              <Check className="h-3 w-3 flex-shrink-0" />
            ) : (
              <X className="h-3 w-3 flex-shrink-0" />
            )}
            <span>{req.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
