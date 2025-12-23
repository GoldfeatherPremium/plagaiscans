import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { Bell, Users, Shield, FileUp, Megaphone, Loader2 } from 'lucide-react';

interface SettingToggle {
  key: string;
  label: string;
  description: string;
  icon: React.ElementType;
}

const settingToggles: SettingToggle[] = [
  {
    key: 'push_notifications_enabled',
    label: 'Global Push Notifications',
    description: 'Master toggle for all push notifications',
    icon: Bell,
  },
  {
    key: 'push_customer_notifications_enabled',
    label: 'Customer Notifications',
    description: 'System notifications to customers (credits, documents)',
    icon: Users,
  },
  {
    key: 'push_admin_notifications_enabled',
    label: 'Admin Notifications',
    description: 'Push notifications to admin users',
    icon: Shield,
  },
  {
    key: 'push_staff_notifications_enabled',
    label: 'Staff Notifications',
    description: 'Push notifications to staff members',
    icon: Users,
  },
  {
    key: 'push_document_upload_notifications_enabled',
    label: 'Document Upload Alerts',
    description: 'Notify staff/admin when customers upload documents',
    icon: FileUp,
  },
];

export const AdminPushNotificationSettings: React.FC = () => {
  const queryClient = useQueryClient();

  // Fetch all notification settings
  const { data: settings, isLoading } = useQuery({
    queryKey: ['push-notification-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('settings')
        .select('key, value')
        .in('key', settingToggles.map(s => s.key));
      
      if (error) throw error;
      
      // Convert to map for easy access
      const settingsMap: Record<string, boolean> = {};
      data?.forEach(s => {
        settingsMap[s.key] = s.value === 'true';
      });
      
      // Default to true for any missing settings
      settingToggles.forEach(toggle => {
        if (!(toggle.key in settingsMap)) {
          settingsMap[toggle.key] = true;
        }
      });
      
      return settingsMap;
    },
  });

  // Update setting mutation
  const updateMutation = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: boolean }) => {
      // Check if setting exists
      const { data: existing } = await supabase
        .from('settings')
        .select('id')
        .eq('key', key)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('settings')
          .update({ value: value.toString(), updated_at: new Date().toISOString() })
          .eq('key', key);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('settings')
          .insert({ key, value: value.toString() });
        if (error) throw error;
      }
    },
    onSuccess: (_, { key, value }) => {
      queryClient.invalidateQueries({ queryKey: ['push-notification-settings'] });
      const toggle = settingToggles.find(t => t.key === key);
      toast.success(`${toggle?.label || 'Setting'} ${value ? 'enabled' : 'disabled'}`);
    },
    onError: (error: Error) => {
      toast.error('Failed to update setting: ' + error.message);
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const isGlobalEnabled = settings?.['push_notifications_enabled'] !== false;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Megaphone className="h-5 w-5" />
          Push Notification Settings
        </CardTitle>
        <CardDescription>
          Control which types of push notifications are sent to users
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {settingToggles.map((toggle, index) => {
          const Icon = toggle.icon;
          const isEnabled = settings?.[toggle.key] !== false;
          const isGlobalToggle = toggle.key === 'push_notifications_enabled';
          const isDisabled = !isGlobalToggle && !isGlobalEnabled;

          return (
            <React.Fragment key={toggle.key}>
              {index === 1 && <Separator className="my-4" />}
              <div className={`flex items-center justify-between p-4 rounded-lg border transition-colors ${
                isDisabled ? 'opacity-50 bg-muted/30' : isEnabled ? 'bg-card' : 'bg-muted/30'
              }`}>
                <div className="flex items-start gap-3">
                  <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                    isEnabled && !isDisabled ? 'bg-primary/10' : 'bg-muted'
                  }`}>
                    <Icon className={`h-5 w-5 ${isEnabled && !isDisabled ? 'text-primary' : 'text-muted-foreground'}`} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <Label className="font-medium">{toggle.label}</Label>
                      {isGlobalToggle && (
                        <Badge variant={isEnabled ? 'default' : 'secondary'} className="text-xs">
                          {isEnabled ? 'Active' : 'Disabled'}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{toggle.description}</p>
                  </div>
                </div>
                <Switch
                  checked={isEnabled}
                  onCheckedChange={(checked) => updateMutation.mutate({ key: toggle.key, value: checked })}
                  disabled={isDisabled || updateMutation.isPending}
                />
              </div>
            </React.Fragment>
          );
        })}

        {!isGlobalEnabled && (
          <p className="text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 p-3 rounded-lg">
            ⚠️ Global push notifications are disabled. Enable them to allow individual notification types.
          </p>
        )}
      </CardContent>
    </Card>
  );
};
