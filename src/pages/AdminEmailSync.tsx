import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/DashboardLayout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { Loader2, RefreshCw, Trash2, Plus, Mail, Users, AlertCircle, CheckCircle2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

const TAGS = ['customer', 'lead', 'low_credits', 'high_value', 'active', 'inactive_30d'] as const;

export default function AdminEmailSync() {
  const { toast } = useToast();
  const qc = useQueryClient();

  // SendFox config (list id, configuration status)
  const configQ = useQuery({
    queryKey: ['sendfox-config'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('get-sendfox-config');
      if (error) throw error;
      return data as {
        list_id: string;
        token_configured: boolean;
        webhook_configured: boolean;
      };
    },
  });

  // All synced contacts (for counts + tag breakdown)
  const contactsQ = useQuery({
    queryKey: ['sendfox-contacts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sendfox_contacts')
        .select('user_id, email, current_tags, last_synced_at, sync_status')
        .order('last_synced_at', { ascending: false })
        .limit(2000);
      if (error) throw error;
      return data ?? [];
    },
  });

  // Recent log entries
  const logQ = useQuery({
    queryKey: ['sendfox-log'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sendfox_sync_log')
        .select('id, user_id, email, action, status, error, created_at')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 15_000,
  });

  // Suppression list
  const suppressQ = useQuery({
    queryKey: ['email-suppressions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('email_suppressions')
        .select('id, email, reason, source, created_at')
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      return data ?? [];
    },
  });

  // Tag counts
  const tagCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const t of TAGS) counts[t] = 0;
    for (const c of contactsQ.data ?? []) {
      for (const tag of (c.current_tags as string[] | null) ?? []) {
        counts[tag] = (counts[tag] ?? 0) + 1;
      }
    }
    return counts;
  }, [contactsQ.data]);

  const errorCount24h = useMemo(() => {
    const cutoff = Date.now() - 24 * 3600 * 1000;
    return (logQ.data ?? []).filter(
      (r: any) => r.status === 'failed' && new Date(r.created_at).getTime() >= cutoff,
    ).length;
  }, [logQ.data]);

  // Resync mutation
  const resyncM = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('resync-all-sendfox');
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({
        title: 'Resync started',
        description:
          'Background job is processing all profiles. Check the log over the next few minutes.',
      });
      setTimeout(() => {
        qc.invalidateQueries({ queryKey: ['sendfox-log'] });
        qc.invalidateQueries({ queryKey: ['sendfox-contacts'] });
      }, 5000);
    },
    onError: (e: any) => {
      toast({
        title: 'Resync failed to start',
        description: e?.message ?? 'Unknown error',
        variant: 'destructive',
      });
    },
  });

  // Suppression add/remove
  const [newEmail, setNewEmail] = useState('');
  const [newReason, setNewReason] = useState('manual');

  const addSuppressionM = useMutation({
    mutationFn: async () => {
      const email = newEmail.trim().toLowerCase();
      if (!email) throw new Error('Email required');
      const { error } = await supabase
        .from('email_suppressions')
        .upsert({ email, reason: newReason, source: 'manual' }, { onConflict: 'email' });
      if (error) throw error;
    },
    onSuccess: () => {
      setNewEmail('');
      qc.invalidateQueries({ queryKey: ['email-suppressions'] });
      toast({ title: 'Email suppressed', description: 'Promotional sends will skip this address.' });
    },
    onError: (e: any) =>
      toast({ title: 'Failed', description: e?.message, variant: 'destructive' }),
  });

  const removeSuppressionM = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('email_suppressions').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['email-suppressions'] });
      toast({ title: 'Removed from suppression list' });
    },
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-display font-bold flex items-center gap-2">
            <Mail className="h-7 w-7" /> Email Sync (SendFox)
          </h1>
          <p className="text-muted-foreground mt-1">
            Promotional email channel. Transactional emails (receipts, password resets) continue to send via the existing pipeline and are unaffected.
          </p>
        </div>

        {/* Status row */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Synced contacts</CardDescription>
              <CardTitle className="text-3xl">
                {contactsQ.isLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : contactsQ.data?.length ?? 0}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Errors (24h)</CardDescription>
              <CardTitle className={`text-3xl ${errorCount24h > 0 ? 'text-destructive' : ''}`}>
                {errorCount24h}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Suppressed addresses</CardDescription>
              <CardTitle className="text-3xl">{suppressQ.data?.length ?? 0}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>SendFox List ID</CardDescription>
              <CardTitle className="text-xl font-mono">
                {configQ.data?.list_id || '—'}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 text-xs text-muted-foreground space-y-1">
              <div className="flex items-center gap-1">
                {configQ.data?.token_configured ? (
                  <CheckCircle2 className="h-3 w-3 text-green-600" />
                ) : (
                  <AlertCircle className="h-3 w-3 text-destructive" />
                )}
                Access token
              </div>
              <div className="flex items-center gap-1">
                {configQ.data?.webhook_configured ? (
                  <CheckCircle2 className="h-3 w-3 text-green-600" />
                ) : (
                  <AlertCircle className="h-3 w-3 text-destructive" />
                )}
                Webhook secret
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tag breakdown */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" /> Contact tags
              </CardTitle>
              <CardDescription>Current segment sizes (computed at last sync)</CardDescription>
            </div>
            <Button
              onClick={() => resyncM.mutate()}
              disabled={resyncM.isPending}
              size="sm"
            >
              {resyncM.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-1" />
              )}
              Force resync all users
            </Button>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {TAGS.map((t) => (
                <div key={t} className="border rounded-lg p-3">
                  <div className="text-xs text-muted-foreground">{t}</div>
                  <div className="text-2xl font-semibold">{tagCounts[t]}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Suppression manager */}
        <Card>
          <CardHeader>
            <CardTitle>Suppression list</CardTitle>
            <CardDescription>
              Promotional sends skip these addresses. Transactional emails are exempt and always send.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                placeholder="email@example.com"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className="flex-1"
              />
              <Select value={newReason} onValueChange={setNewReason}>
                <SelectTrigger className="w-full sm:w-44"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual</SelectItem>
                  <SelectItem value="user_unsubscribe">Unsubscribe</SelectItem>
                  <SelectItem value="bounce">Bounce</SelectItem>
                  <SelectItem value="complaint">Complaint</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={() => addSuppressionM.mutate()} disabled={addSuppressionM.isPending}>
                <Plus className="h-4 w-4 mr-1" /> Add
              </Button>
            </div>

            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Added</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(suppressQ.data ?? []).slice(0, 50).map((s: any) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-mono text-xs">{s.email}</TableCell>
                      <TableCell><Badge variant="outline">{s.reason}</Badge></TableCell>
                      <TableCell className="text-xs text-muted-foreground">{s.source}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(s.created_at), { addSuffix: true })}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeSuppressionM.mutate(s.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {(suppressQ.data ?? []).length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground text-sm py-6">
                        No suppressed addresses.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Log */}
        <Card>
          <CardHeader>
            <CardTitle>Recent sync activity</CardTitle>
            <CardDescription>Last 50 events (auto-refreshes every 15s)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Error</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(logQ.data ?? []).map((l: any) => (
                    <TableRow key={l.id}>
                      <TableCell className="text-xs whitespace-nowrap">
                        {formatDistanceToNow(new Date(l.created_at), { addSuffix: true })}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{l.email ?? '—'}</TableCell>
                      <TableCell><Badge variant="outline">{l.action}</Badge></TableCell>
                      <TableCell>
                        {l.status === 'success' ? (
                          <Badge className="bg-green-600/10 text-green-700 hover:bg-green-600/10">success</Badge>
                        ) : (
                          <Badge variant="destructive">{l.status}</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-md truncate" title={l.error ?? ''}>
                        {l.error ?? ''}
                      </TableCell>
                    </TableRow>
                  ))}
                  {(logQ.data ?? []).length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground text-sm py-6">
                        No activity yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
