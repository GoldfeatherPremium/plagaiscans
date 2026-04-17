import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { CheckCircle2, Moon, Loader2, Clock, X } from 'lucide-react';

// Convert ISO UTC string to value usable in <input type="datetime-local"> (local tz)
const isoToLocalInput = (iso: string | null): string => {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

// Convert local datetime-local input value to ISO (UTC)
const localInputToIso = (value: string): string => {
  if (!value) return '';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '';
  return d.toISOString();
};

export const AdminServiceStatusToggle: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingEta, setSavingEta] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [offlineMessage, setOfflineMessage] = useState('');
  const [backOnlineAt, setBackOnlineAt] = useState(''); // datetime-local value
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  const fetchSettings = async () => {
    const { data } = await supabase
      .from('settings')
      .select('key, value, updated_at')
      .in('key', ['service_status', 'service_offline_message', 'service_back_online_at']);

    if (data) {
      const statusRow = data.find(s => s.key === 'service_status');
      const msgRow = data.find(s => s.key === 'service_offline_message');
      const etaRow = data.find(s => s.key === 'service_back_online_at');
      setIsOnline(statusRow?.value !== 'offline');
      setOfflineMessage(msgRow?.value || '');
      setBackOnlineAt(isoToLocalInput(etaRow?.value || null));
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

  const handleSaveEta = async () => {
    setSavingEta(true);
    const value = backOnlineAt ? localInputToIso(backOnlineAt) : '';
    const { error } = await supabase
      .from('settings')
      .upsert(
        { key: 'service_back_online_at', value },
        { onConflict: 'key' }
      );

    if (error) {
      toast({ title: 'Failed to save ETA', description: error.message, variant: 'destructive' });
    } else {
      toast({
        title: value ? 'ETA saved' : 'ETA cleared',
        description: value
          ? 'Customers will see a countdown until this time.'
          : 'Countdown removed from customer view.',
      });
      fetchSettings();
    }
    setSavingEta(false);
  };

  const handleClearEta = async () => {
    setBackOnlineAt('');
    setSavingEta(true);
    const { error } = await supabase
      .from('settings')
      .upsert(
        { key: 'service_back_online_at', value: '' },
        { onConflict: 'key' }
      );

    if (error) {
      toast({ title: 'Failed to clear ETA', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'ETA cleared' });
      fetchSettings();
    }
    setSavingEta(false);
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

        <div className="space-y-2 rounded-lg border p-4">
          <Label htmlFor="back-online-at" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Estimated back online at (optional)
          </Label>
          <p className="text-xs text-muted-foreground">
            If set, customers see a live countdown (e.g. "Back online in 2h 15m") below the offline message.
            Uses your local timezone.
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              id="back-online-at"
              type="datetime-local"
              value={backOnlineAt}
              onChange={(e) => setBackOnlineAt(e.target.value)}
              className="flex-1"
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSaveEta} disabled={savingEta}>
                {savingEta ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save ETA'}
              </Button>
              {backOnlineAt && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleClearEta}
                  disabled={savingEta}
                >
                  <X className="h-4 w-4 mr-1" />
                  Clear
                </Button>
              )}
            </div>
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
