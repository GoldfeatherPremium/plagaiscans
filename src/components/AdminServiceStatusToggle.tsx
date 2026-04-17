import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { CheckCircle2, Moon, Loader2 } from 'lucide-react';

export const AdminServiceStatusToggle: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [offlineMessage, setOfflineMessage] = useState('');
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  const fetchSettings = async () => {
    const { data } = await supabase
      .from('settings')
      .select('key, value, updated_at')
      .in('key', ['service_status', 'service_offline_message']);

    if (data) {
      const statusRow = data.find(s => s.key === 'service_status');
      const msgRow = data.find(s => s.key === 'service_offline_message');
      setIsOnline(statusRow?.value !== 'offline');
      setOfflineMessage(msgRow?.value || '');
      const latest = data
        .map(d => d.updated_at)
        .sort()
        .reverse()[0];
      setUpdatedAt(latest || null);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleToggle = async (checked: boolean) => {
    setSaving(true);
    setIsOnline(checked);
    const { error } = await supabase
      .from('settings')
      .upsert(
        { key: 'service_status', value: checked ? 'online' : 'offline' },
        { onConflict: 'key' }
      );

    if (error) {
      toast({ title: 'Failed to update status', description: error.message, variant: 'destructive' });
      setIsOnline(!checked);
    } else {
      toast({
        title: checked ? 'Service is now Online' : 'Service is now Offline',
        description: checked
          ? 'Customers will see that you are available.'
          : 'Customers will see the offline message.',
      });
      fetchSettings();
    }
    setSaving(false);
  };

  const handleSaveMessage = async () => {
    setSaving(true);
    const { error } = await supabase
      .from('settings')
      .upsert(
        { key: 'service_offline_message', value: offlineMessage },
        { onConflict: 'key' }
      );

    if (error) {
      toast({ title: 'Failed to save message', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Offline message saved' });
      fetchSettings();
    }
    setSaving(false);
  };

  if (loading) {
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
          {isOnline ? (
            <CheckCircle2 className="h-5 w-5 text-green-600" />
          ) : (
            <Moon className="h-5 w-5 text-amber-600" />
          )}
          Service Status
        </CardTitle>
        <CardDescription>
          Toggle whether customers see your team as available. This does NOT block uploads — it only sets expectations.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between rounded-lg border p-4">
          <div className="space-y-0.5">
            <Label className="text-base font-semibold">
              {isOnline ? 'Online — accepting uploads now' : 'Offline — uploads queued'}
            </Label>
            <p className="text-sm text-muted-foreground">
              {isOnline
                ? 'Customers see a green "Service Online" badge.'
                : 'Customers see an amber "Service Offline" notice with your message.'}
            </p>
          </div>
          <Switch checked={isOnline} disabled={saving} onCheckedChange={handleToggle} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="offline-message">Offline message</Label>
          <Textarea
            id="offline-message"
            value={offlineMessage}
            onChange={(e) => setOfflineMessage(e.target.value)}
            placeholder="e.g. We're offline until 9 AM GMT. Your uploads will be queued."
            rows={3}
          />
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Shown to customers when service is offline.
            </p>
            <Button size="sm" onClick={handleSaveMessage} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save message'}
            </Button>
          </div>
        </div>

        {updatedAt && (
          <p className="text-xs text-muted-foreground">
            Last updated: {new Date(updatedAt).toLocaleString()}
          </p>
        )}
      </CardContent>
    </Card>
  );
};
