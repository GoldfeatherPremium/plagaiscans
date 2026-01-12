import React from 'react';
import { DashboardSidebar } from './DashboardSidebar';
import { DashboardHeader } from './DashboardHeader';
import { WhatsAppSupportButton } from './WhatsAppSupportButton';
import { useAdminDocumentNotifications } from '@/hooks/useAdminDocumentNotifications';
import { useDocumentCompletionNotifications } from '@/hooks/useDocumentCompletionNotifications';
import { usePushSubscriptionHealth } from '@/hooks/usePushSubscriptionHealth';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children }) => {
  // Enable realtime notifications for admins/staff when new documents are uploaded
  useAdminDocumentNotifications();
  
  // Enable document completion notifications for customers
  useDocumentCompletionNotifications();
  
  // Monitor and maintain push subscription health
  usePushSubscriptionHealth();

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