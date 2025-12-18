import React from 'react';
import { DashboardSidebar } from './DashboardSidebar';
import { WhatsAppButton } from './WhatsAppButton';
import { useAuth } from '@/contexts/AuthContext';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children }) => {
  const { role } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      <DashboardSidebar />
      <main className="p-8 pt-20">
        {children}
      </main>
      {role === 'customer' && <WhatsAppButton />}
    </div>
  );
};