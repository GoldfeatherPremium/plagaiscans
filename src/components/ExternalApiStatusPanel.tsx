import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, RefreshCw, Send, Activity } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface DocRow {
  id: string;
  file_name: string;
  status: string;
  external_api_order_id: string | null;
  external_api_status: string | null;
  external_api_error: string | null;
  external_api_submitted_at: string | null;
  external_api_last_polled_at: string | null;
  external_api_attempt_count: number | null;
}

const statusVariant = (s: string | null): 'default' | 'secondary' | 'destructive' | 'outline' => {
  if (!s) return 'outline';
  if (s === 'completed') return 'default';
  if (['submitted', 'processing', 'queued'].includes(s)) return 'secondary';
  if (['error', 'failed_invalid', 'submit_failed', 'rate_limited'].includes(s)) return 'destructive';
  return 'outline';
};

export function ExternalApiStatusPanel() {
  const [rows, setRows] = useState<DocRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);
  const [batchAction, setBatchAction] = useState<string | null>(null);
  const [autoDispatch, setAutoDispatch] = useState<boolean>(true);
  const [savingToggle, setSavingToggle] = useState(false);

  const loadToggle = async () => {
    const { data } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'external_api_auto_dispatch_enabled')
      .maybeSingle();
    setAutoDispatch(data ? String(data.value) === 'true' : true);
  };

  const toggleAutoDispatch = async (next: boolean) => {
    setSavingToggle(true);
    const prev = autoDispatch;
    setAutoDispatch(next);
    const { error } = await supabase
      .from('settings')
      .upsert({ key: 'external_api_auto_dispatch_enabled', value: String(next) }, { onConflict: 'key' });
    setSavingToggle(false);
    if (error) {
      setAutoDispatch(prev);
      toast.error(error.message);
    } else {
      toast.success(`Auto-dispatch ${next ? 'enabled' : 'disabled'}`);
    }
  };

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('documents')
      .select('id, file_name, status, external_api_order_id, external_api_status, external_api_error, external_api_submitted_at, external_api_last_polled_at, external_api_attempt_count')
      .or('scan_type.is.null,scan_type.neq.similarity_only')
      .neq('deleted_by_user', true)
      .is('cancelled_at', null)
      .or('external_api_status.not.is.null,status.eq.pending')
      .order('uploaded_at', { ascending: false })
      .limit(50);
    if (error) toast.error(error.message);
    setRows((data ?? []) as DocRow[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
    loadToggle();
    const channel = supabase
      .channel('external-api-status-panel')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'documents' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const submitDoc = async (id: string) => {
    setActingId(id);
    try {
      const { data, error } = await supabase.functions.invoke('external-api-submit', { body: { documentId: id } });
      if (error) throw error;
      if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
      toast.success('Submitted to external API');
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Submit failed');
    } finally {
      setActingId(null);
    }
  };

  const pollDoc = async (id: string) => {
    setActingId(id);
    try {
      const { data, error } = await supabase.functions.invoke('external-api-poll', { body: { documentId: id } });
      if (error) throw error;
      if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
      toast.success('Refreshed status');
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Poll failed');
    } finally {
      setActingId(null);
    }
  };

  const runBatch = async (fn: 'external-api-dispatch' | 'external-api-poll') => {
    setBatchAction(fn);
    try {
      const { data, error } = await supabase.functions.invoke(fn, { body: {} });
      if (error) throw error;
      const summary = (data as { dispatched?: number; polled?: number }) ?? {};
      toast.success(`Batch ran: dispatched=${summary.dispatched ?? 0}, polled=${summary.polled ?? 0}`);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Batch failed');
    } finally {
      setBatchAction(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between flex-wrap gap-2">
          <span className="flex items-center gap-2"><Activity className="w-5 h-5" /> External API automation</span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => runBatch('external-api-dispatch')} disabled={batchAction !== null}>
              {batchAction === 'external-api-dispatch' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              <span className="ml-2">Dispatch pending</span>
            </Button>
            <Button size="sm" variant="outline" onClick={() => runBatch('external-api-poll')} disabled={batchAction !== null}>
              {batchAction === 'external-api-poll' ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              <span className="ml-2">Poll all</span>
            </Button>
            <Button size="sm" variant="ghost" onClick={load} disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground mb-3">
          Documents in the AI scan queue are auto-submitted to the external processing API every minute.
          Reports are downloaded automatically when ready. Use the buttons to override manually.
        </p>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>File</TableHead>
                <TableHead>Doc status</TableHead>
                <TableHead>API status</TableHead>
                <TableHead>Order ID</TableHead>
                <TableHead>Attempts</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">No items</TableCell></TableRow>
              )}
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="max-w-[260px] truncate" title={r.file_name}>{r.file_name}</TableCell>
                  <TableCell><Badge variant="outline">{r.status}</Badge></TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(r.external_api_status)}>{r.external_api_status ?? 'not submitted'}</Badge>
                    {r.external_api_error && (
                      <div className="text-xs text-destructive mt-1 max-w-[200px] truncate" title={r.external_api_error}>{r.external_api_error}</div>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{r.external_api_order_id ?? '—'}</TableCell>
                  <TableCell>{r.external_api_attempt_count ?? 0}</TableCell>
                  <TableCell className="text-right">
                    {!r.external_api_order_id && r.status === 'pending' && (
                      <Button size="sm" variant="outline" disabled={actingId === r.id} onClick={() => submitDoc(r.id)}>
                        {actingId === r.id ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Submit'}
                      </Button>
                    )}
                    {r.external_api_order_id && r.external_api_status !== 'completed' && (
                      <Button size="sm" variant="ghost" disabled={actingId === r.id} onClick={() => pollDoc(r.id)}>
                        {actingId === r.id ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Re-poll'}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
