import React from 'react';
import { DashboardSidebar } from './DashboardSidebar';
import { WhatsAppButton } from './WhatsAppButton';
import { CreditBalanceHeader } from './CreditBalanceHeader';
import { NotificationBell } from './NotificationBell';
import { useAuth } from '@/contexts/AuthContext';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children }) => {
  const { role } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      <DashboardSidebar />
      <CreditBalanceHeader />
      <NotificationBell />
      <main className="p-8 pt-20">
        {children}
      </main>
      {role === 'customer' && <WhatsAppButton />}
    </div>
  );
};