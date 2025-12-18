import React from 'react';
import { DashboardSidebar } from './DashboardSidebar';
import { CreditBalanceHeader } from './CreditBalanceHeader';
import { NotificationBell } from './NotificationBell';
import { WhatsAppSupportButton } from './WhatsAppSupportButton';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children }) => {
  return (
    <div className="min-h-screen bg-background">
      <DashboardSidebar />
      <CreditBalanceHeader />
      <NotificationBell />
      <main className="p-8 pt-20">
        {children}
      </main>
      <WhatsAppSupportButton />
    </div>
  );
};