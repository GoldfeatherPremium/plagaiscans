import React from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { AdminEmailPanel } from '@/components/AdminEmailPanel';
import { AdminEmailSettings } from '@/components/AdminEmailSettings';
import { AdminNotificationEmailSettings } from '@/components/AdminNotificationEmailSettings';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Mail, Settings2, Bell } from 'lucide-react';

export default function AdminEmails() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-display font-bold">Email Center</h1>
          <p className="text-muted-foreground mt-1">
            Send emails and manage email settings
          </p>
        </div>

        <Tabs defaultValue="send" className="w-full">
          <TabsList className="grid w-full max-w-lg grid-cols-3">
            <TabsTrigger value="send" className="gap-2">
              <Mail className="h-4 w-4" />
              Send Emails
            </TabsTrigger>
            <TabsTrigger value="notifications" className="gap-2">
              <Bell className="h-4 w-4" />
              Notifications
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-2">
              <Settings2 className="h-4 w-4" />
              Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="send" className="mt-6">
            <AdminEmailPanel />
          </TabsContent>

          <TabsContent value="notifications" className="mt-6">
            <AdminNotificationEmailSettings />
          </TabsContent>

          <TabsContent value="settings" className="mt-6">
            <AdminEmailSettings />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
