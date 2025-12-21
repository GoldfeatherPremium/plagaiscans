import React from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { AdminEmailPanel } from '@/components/AdminEmailPanel';

export default function AdminEmails() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-display font-bold">Email Center</h1>
          <p className="text-muted-foreground mt-1">
            Send transactional emails to users from noreply@plagaiscans.com
          </p>
        </div>

        <AdminEmailPanel />
      </div>
    </DashboardLayout>
  );
}