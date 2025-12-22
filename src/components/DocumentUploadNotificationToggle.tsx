import React, { useEffect, useState } from 'react';
import { FileUp, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export const DocumentUploadNotificationToggle: React.FC = () => {
  const { user, role } = useAuth();
  const [isEnabled, setIsEnabled] = useState(true);
  const [isLoading, setIsLoading] = useState(true);

  // Only show for staff and admin
  if (!user || (role !== 'staff' && role !== 'admin')) {
    return null;
  }

  useEffect(() => {
    const fetchPreference = async () => {
      if (!user) return;

      try {
        const { data, error } = await supabase
          .from('user_notification_preferences')
          .select('document_upload_enabled')
          .eq('user_id', user.id)
          .maybeSingle();

        if (error) {
          console.error('Error fetching preference:', error);
          return;
        }

        if (data) {
          setIsEnabled(data.document_upload_enabled);
        } else {
          // Default to enabled if no preference exists
          setIsEnabled(true);
        }
      } catch (err) {
        console.error('Error:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPreference();
  }, [user]);

  const handleToggle = async (enabled: boolean) => {
    if (!user) return;

    setIsLoading(true);
    try {
      // Check if preference exists
      const { data: existing } = await supabase
        .from('user_notification_preferences')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (existing) {
        // Update existing preference
        const { error } = await supabase
          .from('user_notification_preferences')
          .update({ 
            document_upload_enabled: enabled,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', user.id);

        if (error) throw error;
      } else {
        // Insert new preference
        const { error } = await supabase
          .from('user_notification_preferences')
          .insert({
            user_id: user.id,
            document_upload_enabled: enabled,
          });

        if (error) throw error;
      }

      setIsEnabled(enabled);
      toast.success(enabled 
        ? 'Document upload notifications enabled' 
        : 'Document upload notifications disabled'
      );
    } catch (err: any) {
      console.error('Error updating preference:', err);
      toast.error('Failed to update preference');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileUp className="h-5 w-5" />
          Document Upload Alerts
        </CardTitle>
        <CardDescription>
          Get notified when customers upload new documents.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="doc-upload-toggle">New Document Notifications</Label>
            <p className="text-sm text-muted-foreground">
              Receive push notifications for new uploads
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Switch
                id="doc-upload-toggle"
                checked={isEnabled}
                onCheckedChange={handleToggle}
              />
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
