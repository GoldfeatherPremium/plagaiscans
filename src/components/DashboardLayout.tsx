import React from 'react';
import { DashboardSidebar } from './DashboardSidebar';
import { DashboardHeader } from './DashboardHeader';
import { WhatsAppSupportButton } from './WhatsAppSupportButton';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children }) => {
  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader />
      <DashboardSidebar />
      <main className="p-8 pt-24 page-enter">
        <div className="stagger-children">
          {children}
        </div>
      </main>
      <WhatsAppSupportButton />
    </div>
  );
};