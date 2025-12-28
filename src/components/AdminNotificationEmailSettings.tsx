import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  Bell, 
  Mail, 
  CreditCard, 
  Clock, 
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  Settings2
} from 'lucide-react';

interface EmailSetting {
  id: string;
  setting_key: string;
  setting_name: string;
  description: string | null;
  is_enabled: boolean;
  category: string;
}

const notificationSettings = [
  {
    key: 'credit_expiry_email',
    name: 'Credit Expiry Reminders',
    description: 'Send email reminders when credits are about to expire (7 days and 1 day before)',
    icon: Clock,
    category: 'notifications',
  },
  {
    key: 'subscription_reminder_email',
    name: 'Subscription Renewal Reminders',
    description: 'Send email reminders before subscription renewal (3 days before)',
    icon: RefreshCw,
    category: 'notifications',
  },
  {
    key: 'payment_confirmation_email',
    name: 'Payment Confirmation Emails',
    description: 'Send email receipts after successful payments',
    icon: CreditCard,
    category: 'notifications',
  },
  {
    key: 'document_completion_email',
    name: 'Document Completion Emails',
    description: 'Notify users when their documents are processed',
    icon: CheckCircle,
    category: 'notifications',
  },
  {
    key: 'welcome_email',
    name: 'Welcome Emails',
    description: 'Send welcome email to new users after registration',
    icon: Mail,
    category: 'notifications',
  },
];

export function AdminNotificationEmailSettings() {
  const queryClient = useQueryClient();
  const [localSettings, setLocalSettings] = useState<Record<string, boolean>>({});

  const { data: settings, isLoading, refetch } = useQuery({
    queryKey: ['email-notification-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('email_settings')
        .select('*')
        .in('setting_key', notificationSettings.map(s => s.key));

      if (error) throw error;
      return data as EmailSetting[];
    },
  });

  useEffect(() => {
    if (settings) {
      const settingsMap: Record<string, boolean> = {};
      settings.forEach(s => {
        settingsMap[s.setting_key] = s.is_enabled;
      });
      // For settings that don't exist in DB yet, default to true
      notificationSettings.forEach(ns => {
        if (!(ns.key in settingsMap)) {
          settingsMap[ns.key] = true;
        }
      });
      setLocalSettings(settingsMap);
    }
  }, [settings]);

  const updateSetting = useMutation({
    mutationFn: async ({ key, enabled }: { key: string; enabled: boolean }) => {
      const existingSetting = settings?.find(s => s.setting_key === key);
      const settingInfo = notificationSettings.find(ns => ns.key === key);
      
      if (existingSetting) {
        const { error } = await supabase
          .from('email_settings')
          .update({ is_enabled: enabled, updated_at: new Date().toISOString() })
          .eq('setting_key', key);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('email_settings')
          .insert({
            setting_key: key,
            setting_name: settingInfo?.name || key,
            description: settingInfo?.description || null,
            is_enabled: enabled,
            category: 'notifications',
          });
        if (error) throw error;
      }
    },
    onSuccess: (_, { key, enabled }) => {
      toast.success(`${enabled ? 'Enabled' : 'Disabled'} notification emails`);
      queryClient.invalidateQueries({ queryKey: ['email-notification-settings'] });
    },
    onError: (error) => {
      toast.error('Failed to update setting');
      console.error(error);
    },
  });

  const handleToggle = (key: string, enabled: boolean) => {
    setLocalSettings(prev => ({ ...prev, [key]: enabled }));
    updateSetting.mutate({ key, enabled });
  };

  const enabledCount = Object.values(localSettings).filter(Boolean).length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Bell className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle>Notification Email Settings</CardTitle>
              <CardDescription>
                Control which automated notification emails are sent to users
              </CardDescription>
            </div>
          </div>
          <Badge variant="outline" className="gap-1">
            <CheckCircle className="h-3 w-3" />
            {enabledCount} of {notificationSettings.length} enabled
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            {notificationSettings.map((setting) => {
              const Icon = setting.icon;
              const isEnabled = localSettings[setting.key] ?? true;
              
              return (
                <div
                  key={setting.key}
                  className={`flex items-center justify-between p-4 rounded-lg border transition-colors ${
                    isEnabled 
                      ? 'bg-green-50/50 border-green-200 dark:bg-green-950/20 dark:border-green-800' 
                      : 'bg-muted/50 border-border'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${isEnabled ? 'bg-green-100 dark:bg-green-900/50' : 'bg-muted'}`}>
                      <Icon className={`h-4 w-4 ${isEnabled ? 'text-green-600' : 'text-muted-foreground'}`} />
                    </div>
                    <div>
                      <Label htmlFor={setting.key} className="font-medium cursor-pointer">
                        {setting.name}
                      </Label>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {setting.description}
                      </p>
                    </div>
                  </div>
                  <Switch
                    id={setting.key}
                    checked={isEnabled}
                    onCheckedChange={(checked) => handleToggle(setting.key, checked)}
                    disabled={updateSetting.isPending}
                  />
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-6 p-4 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
            <div>
              <p className="font-medium text-amber-900 dark:text-amber-100">Important Note</p>
              <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                Disabling notification emails may cause users to miss important updates about their account, 
                credits, and payments. Consider carefully before disabling any of these notifications.
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
