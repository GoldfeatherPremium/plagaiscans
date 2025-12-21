import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { Bell, Settings2, Sparkles, Megaphone, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NotificationPreferences {
  id: string;
  user_id: string;
  system_enabled: boolean;
  promotional_enabled: boolean;
  updates_enabled: boolean;
}

const defaultPreferences: Omit<NotificationPreferences, 'id' | 'user_id'> = {
  system_enabled: true,
  promotional_enabled: true,
  updates_enabled: true,
};

const categoryInfo = [
  {
    key: 'system_enabled' as const,
    label: 'System Notifications',
    description: 'Important system alerts, maintenance notices, and security updates',
    icon: Settings2,
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
    required: true,
  },
  {
    key: 'promotional_enabled' as const,
    label: 'Promotional',
    description: 'Special offers, discounts, and promotional content',
    icon: Sparkles,
    color: 'text-purple-500',
    bgColor: 'bg-purple-500/10',
    required: false,
  },
  {
    key: 'updates_enabled' as const,
    label: 'Product Updates',
    description: 'New features, improvements, and platform updates',
    icon: Megaphone,
    color: 'text-green-500',
    bgColor: 'bg-green-500/10',
    required: false,
  },
];

export const NotificationPreferences: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch user preferences
  const { data: preferences, isLoading } = useQuery({
    queryKey: ['notification-preferences', user?.id],
    queryFn: async () => {
      if (!user) return null;

      const { data, error } = await supabase
        .from('user_notification_preferences')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;

      // If no preferences exist, return defaults (will be created on first toggle)
      if (!data) {
        return { 
          ...defaultPreferences, 
          user_id: user.id,
          id: null 
        } as NotificationPreferences;
      }

      return data as NotificationPreferences;
    },
    enabled: !!user,
  });

  // Update preferences mutation
  const updateMutation = useMutation({
    mutationFn: async (updates: Partial<NotificationPreferences>) => {
      if (!user) throw new Error('Not authenticated');

      // Check if preferences exist
      const { data: existing } = await supabase
        .from('user_notification_preferences')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (existing) {
        // Update existing
        const { error } = await supabase
          .from('user_notification_preferences')
          .update(updates)
          .eq('user_id', user.id);
        
        if (error) throw error;
      } else {
        // Create new with defaults + updates
        const { error } = await supabase
          .from('user_notification_preferences')
          .insert({
            user_id: user.id,
            ...defaultPreferences,
            ...updates,
          });
        
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-preferences', user?.id] });
      toast({ title: 'Preferences updated' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const handleToggle = (key: keyof Omit<NotificationPreferences, 'id' | 'user_id'>, value: boolean) => {
    updateMutation.mutate({ [key]: value });
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Notification Preferences
        </CardTitle>
        <CardDescription>
          Choose which types of notifications you want to receive
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {categoryInfo.map((category) => {
          const Icon = category.icon;
          const isEnabled = preferences?.[category.key] ?? defaultPreferences[category.key];
          
          return (
            <div 
              key={category.key} 
              className={cn(
                "flex items-center justify-between p-4 rounded-lg border transition-colors",
                isEnabled ? "bg-card" : "bg-muted/30"
              )}
            >
              <div className="flex items-start gap-3">
                <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center", category.bgColor)}>
                  <Icon className={cn("h-5 w-5", category.color)} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <Label htmlFor={category.key} className="font-medium cursor-pointer">
                      {category.label}
                    </Label>
                    {category.required && (
                      <span className="text-xs text-muted-foreground">(Required)</span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {category.description}
                  </p>
                </div>
              </div>
              <Switch
                id={category.key}
                checked={isEnabled}
                onCheckedChange={(checked) => handleToggle(category.key, checked)}
                disabled={category.required || updateMutation.isPending}
              />
            </div>
          );
        })}

        <p className="text-xs text-muted-foreground pt-2">
          System notifications cannot be disabled as they contain important information about your account and service.
        </p>
      </CardContent>
    </Card>
  );
};