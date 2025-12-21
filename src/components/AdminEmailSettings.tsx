import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/hooks/use-toast';
import { 
  Mail, 
  FileCheck, 
  CreditCard, 
  KeyRound, 
  UserPlus,
  Bell,
  Clock,
  Settings2
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface EmailSetting {
  id: string;
  setting_key: string;
  setting_name: string;
  description: string | null;
  is_enabled: boolean;
  category: string;
  updated_at: string;
}

const settingIcons: Record<string, React.ElementType> = {
  document_completion: FileCheck,
  payment_verified: CreditCard,
  password_reset: KeyRound,
  welcome_email: UserPlus,
  low_credit_reminder: Bell,
  document_pending_reminder: Clock,
};

const categoryConfig: Record<string, { label: string; color: string; description: string }> = {
  transactional: { 
    label: 'Transactional', 
    color: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    description: 'Essential emails triggered by user actions'
  },
  notifications: { 
    label: 'Notifications', 
    color: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    description: 'Reminder and notification emails'
  },
};

export const AdminEmailSettings: React.FC = () => {
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ['email-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('email_settings')
        .select('*')
        .order('category', { ascending: true })
        .order('setting_name', { ascending: true });
      
      if (error) throw error;
      return data as EmailSetting[];
    }
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_enabled }: { id: string; is_enabled: boolean }) => {
      const { error } = await supabase
        .from('email_settings')
        .update({ 
          is_enabled, 
          updated_at: new Date().toISOString() 
        })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-settings'] });
      toast({ title: 'Setting updated' });
    },
    onError: (error: Error) => {
      toast({ 
        title: 'Failed to update setting', 
        description: error.message, 
        variant: 'destructive' 
      });
    }
  });

  const groupedSettings = settings?.reduce((acc, setting) => {
    if (!acc[setting.category]) {
      acc[setting.category] = [];
    }
    acc[setting.category].push(setting);
    return acc;
  }, {} as Record<string, EmailSetting[]>);

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2].map(i => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-4 w-48" />
            </CardHeader>
            <CardContent className="space-y-4">
              {[1, 2, 3].map(j => (
                <div key={j} className="flex items-center justify-between p-4 rounded-lg border">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-10 w-10 rounded-lg" />
                    <div>
                      <Skeleton className="h-5 w-40 mb-1" />
                      <Skeleton className="h-4 w-64" />
                    </div>
                  </div>
                  <Skeleton className="h-6 w-12" />
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Settings2 className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">Email Triggers</h2>
          <p className="text-sm text-muted-foreground">
            Control which automatic emails are sent to users
          </p>
        </div>
      </div>

      {Object.entries(groupedSettings || {}).map(([category, categorySettings]) => {
        const config = categoryConfig[category] || { 
          label: category, 
          color: 'bg-muted text-muted-foreground',
          description: ''
        };
        
        return (
          <Card key={category}>
            <CardHeader>
              <div className="flex items-center gap-2">
                <CardTitle className="text-lg">{config.label} Emails</CardTitle>
                <Badge variant="outline" className={config.color}>
                  {categorySettings.length}
                </Badge>
              </div>
              <CardDescription>{config.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {categorySettings.map((setting) => {
                const Icon = settingIcons[setting.setting_key] || Mail;
                
                return (
                  <div 
                    key={setting.id} 
                    className={`flex items-center justify-between p-4 rounded-lg border transition-colors ${
                      setting.is_enabled ? 'bg-background' : 'bg-muted/30'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                        setting.is_enabled 
                          ? 'bg-primary/10 text-primary' 
                          : 'bg-muted text-muted-foreground'
                      }`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <Label 
                            htmlFor={setting.id} 
                            className={`font-medium cursor-pointer ${
                              !setting.is_enabled && 'text-muted-foreground'
                            }`}
                          >
                            {setting.setting_name}
                          </Label>
                          {!setting.is_enabled && (
                            <Badge variant="outline" className="text-xs">Disabled</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {setting.description}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Updated {formatDistanceToNow(new Date(setting.updated_at), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                    <Switch
                      id={setting.id}
                      checked={setting.is_enabled}
                      onCheckedChange={(checked) => 
                        toggleMutation.mutate({ id: setting.id, is_enabled: checked })
                      }
                      disabled={toggleMutation.isPending}
                    />
                  </div>
                );
              })}
            </CardContent>
          </Card>
        );
      })}

      <Card className="border-amber-500/20 bg-amber-500/5">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <Bell className="h-5 w-5 text-amber-500 mt-0.5" />
            <div>
              <p className="font-medium text-sm">Important Note</p>
              <p className="text-sm text-muted-foreground">
                Disabling transactional emails may affect user experience. Users won't receive 
                important notifications about their documents or payments. Consider your users' 
                needs before disabling these emails.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
