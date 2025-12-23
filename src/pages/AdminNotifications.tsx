import React from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { AdminNotificationManager } from '@/components/AdminNotificationManager';
import { AdminPushNotificationSettings } from '@/components/AdminPushNotificationSettings';
import { AdminPushNotificationSender } from '@/components/AdminPushNotificationSender';
import { PushNotificationLogs } from '@/components/PushNotificationLogs';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Bell, Settings, Send, History } from 'lucide-react';

export default function AdminNotifications() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-display font-bold">Notifications</h1>
          <p className="text-muted-foreground mt-1">
            Manage in-app and push notifications with targeting and delivery controls
          </p>
        </div>

        <Tabs defaultValue="in-app" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="in-app" className="gap-2">
              <Bell className="h-4 w-4" />
              In-App
            </TabsTrigger>
            <TabsTrigger value="push" className="gap-2">
              <Send className="h-4 w-4" />
              Push Send
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-2">
              <Settings className="h-4 w-4" />
              Push Settings
            </TabsTrigger>
            <TabsTrigger value="logs" className="gap-2">
              <History className="h-4 w-4" />
              Push Logs
            </TabsTrigger>
          </TabsList>

          <TabsContent value="in-app" className="mt-6">
            <AdminNotificationManager />
          </TabsContent>

          <TabsContent value="push" className="mt-6">
            <AdminPushNotificationSender />
          </TabsContent>

          <TabsContent value="settings" className="mt-6">
            <AdminPushNotificationSettings />
          </TabsContent>

          <TabsContent value="logs" className="mt-6">
            <PushNotificationLogs />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}