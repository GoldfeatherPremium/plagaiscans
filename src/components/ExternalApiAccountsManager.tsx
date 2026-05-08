import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Plus, Trash2, KeyRound } from 'lucide-react';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';

interface ApiAccount {
  id: string;
  label: string;
  api_token: string;
  max_concurrency: number;
  enabled: boolean;
  notes: string | null;
}

export function ExternalApiAccountsManager() {
  const [rows, setRows] = useState<ApiAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showToken, setShowToken] = useState<Record<string, boolean>>({});

  // New row form
  const [label, setLabel] = useState('');
  const [token, setToken] = useState('');
  const [maxC, setMaxC] = useState<number>(4);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('external_api_accounts')
      .select('*')
      .order('created_at', { ascending: true });
    if (error) toast.error(error.message);
    setRows((data ?? []) as ApiAccount[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const addAccount = async () => {
    if (!label.trim() || !token.trim()) {
      toast.error('Label and token are required');
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from('external_api_accounts')
      .insert({ label: label.trim(), api_token: token.trim(), max_concurrency: maxC, enabled: true });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success('Account added');
    setLabel(''); setToken(''); setMaxC(4);
    load();
  };

  const updateRow = async (id: string, patch: Partial<ApiAccount>) => {
    const { error } = await supabase.from('external_api_accounts').update(patch).eq('id', id);
    if (error) return toast.error(error.message);
    load();
  };

  const removeRow = async (id: string) => {
    if (!confirm('Remove this API account? Documents already assigned will keep their order IDs but no new submissions will use it.')) return;
    const { error } = await supabase.from('external_api_accounts').delete().eq('id', id);
    if (error) return toast.error(error.message);
    toast.success('Removed');
    load();
  };

  const mask = (t: string) => t.length <= 8 ? '•'.repeat(t.length) : `${t.slice(0, 4)}…${t.slice(-4)}`;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="w-5 h-5" /> External API accounts
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">
          Add multiple similaritycheck.app API tokens here. The dispatcher distributes pending documents
          across all enabled accounts based on each account's free concurrency, multiplying total throughput.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-2 items-end p-3 border rounded-md bg-muted/30">
          <div className="md:col-span-3">
            <Label className="text-xs">Label</Label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Account #1" />
          </div>
          <div className="md:col-span-5">
            <Label className="text-xs">API token</Label>
            <Input value={token} onChange={(e) => setToken(e.target.value)} placeholder="Bearer token" type="password" />
          </div>
          <div className="md:col-span-2">
            <Label className="text-xs">Max concurrency</Label>
            <Input type="number" min={1} max={20} value={maxC} onChange={(e) => setMaxC(Number(e.target.value) || 1)} />
          </div>
          <div className="md:col-span-2">
            <Button onClick={addAccount} disabled={saving} className="w-full">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              <span className="ml-1">Add</span>
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Label</TableHead>
                <TableHead>Token</TableHead>
                <TableHead>Max</TableHead>
                <TableHead>Enabled</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && <TableRow><TableCell colSpan={5} className="text-center"><Loader2 className="w-4 h-4 animate-spin inline" /></TableCell></TableRow>}
              {!loading && rows.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">No accounts. Add one above.</TableCell></TableRow>
              )}
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <Input
                      defaultValue={r.label}
                      onBlur={(e) => e.target.value !== r.label && updateRow(r.id, { label: e.target.value })}
                      className="h-8"
                    />
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    <button
                      type="button"
                      className="underline-offset-2 hover:underline"
                      onClick={() => setShowToken((s) => ({ ...s, [r.id]: !s[r.id] }))}
                      title="Click to reveal/hide"
                    >
                      {showToken[r.id] ? r.api_token : mask(r.api_token)}
                    </button>
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      defaultValue={r.max_concurrency}
                      min={1}
                      max={20}
                      onBlur={(e) => Number(e.target.value) !== r.max_concurrency && updateRow(r.id, { max_concurrency: Number(e.target.value) || 1 })}
                      className="h-8 w-20"
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Switch checked={r.enabled} onCheckedChange={(v) => updateRow(r.id, { enabled: v })} />
                      <Badge variant={r.enabled ? 'default' : 'secondary'}>{r.enabled ? 'on' : 'off'}</Badge>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="icon" variant="ghost" onClick={() => removeRow(r.id)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
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
