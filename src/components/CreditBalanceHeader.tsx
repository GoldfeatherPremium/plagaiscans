import React from 'react';
import { Coins } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

export const CreditBalanceHeader: React.FC = () => {
  const { profile, role } = useAuth();

  if (role !== 'customer' || !profile) return null;

  return (
    <div className="fixed top-4 right-4 z-40 flex items-center gap-2 px-4 py-2 bg-card border border-border rounded-full shadow-lg">
      <Coins className="h-5 w-5 text-primary" />
      <div className="flex flex-col">
        <span className="text-xs text-muted-foreground leading-none">Credits</span>
        <span className="text-lg font-bold text-primary leading-tight">{profile.credit_balance}</span>
      </div>
    </div>
  );
};
