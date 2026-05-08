import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, RefreshCw, KeyRound, Plus, Trash2, Eye, EyeOff, AlertTriangle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface Account {
  id: string;
  label: string;
  api_token: string;
  max_concurrency: number;
  enabled: boolean;
  credits_remaining: number | null;
  credits_total: number | null;
  concurrency_limit: number | null;
  current_concurrent: number | null;
  daily_limit: number | null;
  daily_usage: number | null;
  expires_at: string | null;
  is_active_remote: boolean | null;
  last_checked_at: string | null;
  last_probe_error: string | null;
  account_name: string | null;
  client_id: string | null;
}

export default function AdminExternalApiAccounts() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showToken, setShowToken] = useState<Record<string, boolean>>({});
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState('');
  const [token, setToken] = useState('');
  const [maxC, setMaxC] = useState(5);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('external_api_accounts')
      .select('*')
      .order('credits_remaining', { ascending: false, nullsFirst: false });
    if (error) toast.error(error.message);
    setAccounts((data ?? []) as Account[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const ch = supabase.channel('ext-api-acc')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'external_api_accounts' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const refresh = async () => {
    setRefreshing(true);
    try {
      const { error } = await supabase.functions.invoke('external-api-account-stats');
      if (error) throw error;
      toast.success('Snapshots refreshed');
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Refresh failed');
    } finally {
      setRefreshing(false);
    }
  };

  const addAccount = async () => {
    if (!label.trim() || !token.trim()) return toast.error('Label and token required');
    setAdding(true);
    const { error } = await supabase.from('external_api_accounts').insert({
      label: label.trim(), api_token: token.trim(), max_concurrency: maxC, enabled: true,
    });
    setAdding(false);
    if (error) return toast.error(error.message);
    toast.success('Account added — refreshing snapshot...');
    setLabel(''); setToken(''); setMaxC(5);
    await refresh();
  };

  const updateRow = async (id: string, patch: Partial<Account>) => {
    const { error } = await supabase.from('external_api_accounts').update(patch).eq('id', id);
    if (error) return toast.error(error.message);
  };

  const removeRow = async (id: string) => {
    if (!confirm('Remove this API account? In-flight documents assigned to it will keep their order IDs but no new submissions will use it.')) return;
    const { error } = await supabase.from('external_api_accounts').delete().eq('id', id);
    if (error) return toast.error(error.message);
    toast.success('Removed');
  };

  const totalCredits = accounts.reduce((s, a) => s + (a.credits_remaining ?? 0), 0);
  const totalInflight = accounts.reduce((s, a) => s + (a.current_concurrent ?? 0), 0);
  const totalSlots = accounts.reduce((s, a) => s + Math.min(a.concurrency_limit ?? a.max_concurrency, a.max_concurrency), 0);

  const statusBadge = (a: Account) => {
    if (!a.enabled) return <Badge variant="secondary">Disabled</Badge>;
    if (a.last_probe_error) return <Badge variant="destructive">Probe error</Badge>;
    if (a.is_active_remote === false) return <Badge variant="destructive">Inactive</Badge>;
    if (a.expires_at && new Date(a.expires_at).getTime() < Date.now()) return <Badge variant="destructive">Expired</Badge>;
    if ((a.credits_remaining ?? 0) <= 0) return <Badge variant="destructive">No credits</Badge>;
    return <Badge>Active</Badge>;
  };

  const expiryColor = (iso: string | null) => {
    if (!iso) return 'text-muted-foreground';
    const days = (new Date(iso).getTime() - Date.now()) / 86400000;
    if (days < 0) return 'text-destructive';
    if (days < 7) return 'text-destructive';
    if (days < 30) return 'text-orange-600';
    return 'text-muted-foreground';
  };

  return (
    <DashboardLayout>
      <div className="container mx-auto p-4 md:p-6 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <KeyRound className="w-6 h-6" /> External API Accounts
            </h1>
            <p className="text-sm text-muted-foreground">
              Monitor credit balance, concurrency, and expiry across all processing API accounts.
            </p>
          </div>
          <Button onClick={refresh} disabled={refreshing} variant="outline">
            {refreshing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            <span className="ml-2">Refresh now</span>
          </Button>
        </div>

        {/* Summary strip */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total credits remaining</CardTitle></CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{totalCredits.toLocaleString()}</div>
              {totalCredits < 50 && (
                <div className="flex items-center gap-1 text-xs text-destructive mt-1">
                  <AlertTriangle className="w-3 h-3" /> Low credits across all accounts
                </div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">In-flight scans</CardTitle></CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{totalInflight} <span className="text-base text-muted-foreground font-normal">/ {totalSlots} slots</span></div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Active accounts</CardTitle></CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{accounts.filter(a => a.enabled && (a.credits_remaining ?? 0) > 0).length} <span className="text-base text-muted-foreground font-normal">/ {accounts.length}</span></div>
            </CardContent>
          </Card>
        </div>

        {/* Account cards */}
        {loading && <div className="text-center py-8"><Loader2 className="w-6 h-6 animate-spin inline" /></div>}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {accounts.map((a) => {
            const creditPct = a.credits_total ? ((a.credits_remaining ?? 0) / a.credits_total) * 100 : 0;
            const slotLimit = Math.min(a.concurrency_limit ?? a.max_concurrency, a.max_concurrency);
            const slotPct = slotLimit > 0 ? ((a.current_concurrent ?? 0) / slotLimit) * 100 : 0;
            return (
              <Card key={a.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <CardTitle className="flex items-center gap-2 flex-wrap">
                        <Input
                          defaultValue={a.label}
                          onBlur={(e) => e.target.value !== a.label && updateRow(a.id, { label: e.target.value })}
                          className="h-8 max-w-[200px]"
                        />
                        {statusBadge(a)}
                      </CardTitle>
                      {a.account_name && (
                        <div className="text-xs text-muted-foreground mt-1">
                          {a.account_name} • {a.client_id}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch checked={a.enabled} onCheckedChange={(v) => updateRow(a.id, { enabled: v })} />
                      <Button size="icon" variant="ghost" onClick={() => removeRow(a.id)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Credits */}
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-muted-foreground">Credits remaining</span>
                      <span className="font-medium">{(a.credits_remaining ?? 0).toLocaleString()} / {(a.credits_total ?? 0).toLocaleString()}</span>
                    </div>
                    <Progress value={creditPct} className="h-2" />
                  </div>

                  {/* Concurrency */}
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-muted-foreground">Concurrency in use</span>
                      <span className="font-medium">{a.current_concurrent ?? 0} / {slotLimit}</span>
                    </div>
                    <Progress value={slotPct} className="h-2" />
                  </div>

                  {/* Daily */}
                  {a.daily_limit !== null && (
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-muted-foreground">Daily usage</span>
                        <span className="font-medium">{a.daily_usage ?? 0} / {a.daily_limit}</span>
                      </div>
                      <Progress value={((a.daily_usage ?? 0) / (a.daily_limit ?? 1)) * 100} className="h-2" />
                    </div>
                  )}

                  {/* Expiry & meta */}
                  <div className="grid grid-cols-2 gap-3 text-xs pt-2 border-t">
                    <div>
                      <div className="text-muted-foreground">Expires</div>
                      <div className={`font-medium ${expiryColor(a.expires_at)}`}>
                        {a.expires_at ? `${new Date(a.expires_at).toLocaleDateString()} (${formatDistanceToNow(new Date(a.expires_at), { addSuffix: true })})` : '—'}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Last checked</div>
                      <div className="font-medium">
                        {a.last_checked_at ? formatDistanceToNow(new Date(a.last_checked_at), { addSuffix: true }) : 'never'}
                      </div>
                    </div>
                  </div>

                  {a.last_probe_error && (
                    <div className="text-xs text-destructive bg-destructive/10 p-2 rounded">
                      Probe error: {a.last_probe_error}
                    </div>
                  )}

                  {/* Settings row */}
                  <div className="flex items-center gap-2 pt-2 border-t">
                    <Label className="text-xs whitespace-nowrap">Cap</Label>
                    <Input
                      type="number" min={1} max={50}
                      defaultValue={a.max_concurrency}
                      onBlur={(e) => Number(e.target.value) !== a.max_concurrency && updateRow(a.id, { max_concurrency: Number(e.target.value) || 1 })}
                      className="h-8 w-20"
                    />
                    <span className="text-xs text-muted-foreground flex-1">Local concurrency cap</span>
                    <Button size="sm" variant="ghost" onClick={() => setShowToken((s) => ({ ...s, [a.id]: !s[a.id] }))}>
                      {showToken[a.id] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                  </div>
                  {showToken[a.id] && (
                    <div className="font-mono text-xs break-all p-2 bg-muted rounded">{a.api_token}</div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Add new */}
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Plus className="w-5 h-5" /> Add account</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-12 gap-2 items-end">
              <div className="md:col-span-3">
                <Label className="text-xs">Label</Label>
                <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Account #4" />
              </div>
              <div className="md:col-span-5">
                <Label className="text-xs">API token</Label>
                <Input value={token} onChange={(e) => setToken(e.target.value)} type="password" placeholder="Bearer token" />
              </div>
              <div className="md:col-span-2">
                <Label className="text-xs">Max concurrency</Label>
                <Input type="number" min={1} max={20} value={maxC} onChange={(e) => setMaxC(Number(e.target.value) || 1)} />
              </div>
              <div className="md:col-span-2">
                <Button onClick={addAccount} disabled={adding} className="w-full">
                  {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  <span className="ml-1">Add</span>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
