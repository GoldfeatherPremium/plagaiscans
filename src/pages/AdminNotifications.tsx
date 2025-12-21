import React from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { AdminNotificationManager } from '@/components/AdminNotificationManager';

export default function AdminNotifications() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-display font-bold">Notifications</h1>
          <p className="text-muted-foreground mt-1">
            Create and manage user notifications with targeting and categories
          </p>
        </div>

        <AdminNotificationManager />
      </div>
    </DashboardLayout>
  );
}