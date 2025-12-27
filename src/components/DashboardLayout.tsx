import React from 'react';
import { DashboardSidebar } from './DashboardSidebar';
import { DashboardHeader } from './DashboardHeader';
import { WhatsAppSupportButton } from './WhatsAppSupportButton';
import { PageTransition } from './PageTransition';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children }) => {
  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Animated background elements */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[150px] animate-pulse-glow" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-secondary/5 rounded-full blur-[120px] animate-pulse-glow" style={{ animationDelay: '2s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-accent/3 rounded-full blur-[180px] animate-morph" />
      </div>
      
      <DashboardHeader />
      <DashboardSidebar />
      <PageTransition>
        <main className="relative z-10 p-4 md:p-8 pt-20 md:pt-24">
          {children}
        </main>
      </PageTransition>
      <WhatsAppSupportButton />
    </div>
  );
};