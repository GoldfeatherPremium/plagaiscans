import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Activity, CheckCircle2, XCircle, Loader2, Send, RefreshCw } from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';

interface Counts {
  total: number;
  completed: number;
  failed: number;
  inProgress: number;
  notSubmitted: number;
}

interface TrendPoint {
  date: string;
  submitted: number;
  completed: number;
  failed: number;
}

const RANGES = [7, 14, 30, 90] as const;
type Range = typeof RANGES[number];

export default function AdminExternalApiStats() {
  const [counts, setCounts] = useState<Counts | null>(null);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [range, setRange] = useState<Range>(30);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      // Fetch counts
      const since = new Date();
      since.setDate(since.getDate() - range);
      const sinceIso = since.toISOString();

      const { data: rows, error } = await supabase
        .from('documents')
        .select('external_api_status, external_api_submitted_at, external_api_order_id, completed_at, status')
        .or('deleted_by_user.is.null,deleted_by_user.eq.false')
        .is('cancelled_at', null)
        .or('scan_type.is.null,scan_type.neq.similarity_only')
        .limit(20000);
      if (error) throw error;

      const completed = (rows || []).filter(r => r.external_api_status === 'completed').length;
      const failed = (rows || []).filter(r => ['error', 'failed_invalid', 'submit_failed', 'rate_limited'].includes(r.external_api_status || '')).length;
      const inProgress = (rows || []).filter(r => ['submitted', 'processing', 'queued'].includes(r.external_api_status || '')).length;
      const total = (rows || []).filter(r => !!r.external_api_order_id).length;
      const notSubmitted = (rows || []).filter(r => r.status === 'pending' && !r.external_api_order_id).length;

      setCounts({ total, completed, failed, inProgress, notSubmitted });

      // Build trend
      const map = new Map<string, TrendPoint>();
      for (let i = 0; i < range; i++) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const k = d.toISOString().slice(0, 10);
        map.set(k, { date: k, submitted: 0, completed: 0, failed: 0 });
      }
      (rows || []).forEach(r => {
        if (r.external_api_submitted_at) {
          const k = r.external_api_submitted_at.slice(0, 10);
          if (k >= sinceIso.slice(0, 10)) {
            const p = map.get(k);
            if (p) p.submitted += 1;
          }
        }
        if (r.external_api_status === 'completed' && r.completed_at) {
          const k = r.completed_at.slice(0, 10);
          if (k >= sinceIso.slice(0, 10)) {
            const p = map.get(k);
            if (p) p.completed += 1;
          }
        }
        if (['error', 'failed_invalid', 'submit_failed'].includes(r.external_api_status || '') && r.external_api_submitted_at) {
          const k = r.external_api_submitted_at.slice(0, 10);
          if (k >= sinceIso.slice(0, 10)) {
            const p = map.get(k);
            if (p) p.failed += 1;
          }
        }
      });
      const sorted = Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
      setTrend(sorted);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load stats');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [range]);

  const cards = [
    { label: 'Total Submitted', value: counts?.total ?? 0, icon: Send, color: 'text-primary' },
    { label: 'Completed', value: counts?.completed ?? 0, icon: CheckCircle2, color: 'text-green-600' },
    { label: 'In Progress', value: counts?.inProgress ?? 0, icon: Loader2, color: 'text-blue-600' },
    { label: 'Failed', value: counts?.failed ?? 0, icon: XCircle, color: 'text-destructive' },
  ];

  const successRate = counts && counts.total > 0
    ? ((counts.completed / counts.total) * 100).toFixed(1)
    : '0.0';

  return (
    <DashboardLayout>
      <div className="space-y-6 p-4 md:p-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Activity className="w-6 h-6" /> External API Statistics
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Processing metrics for documents sent to the external content analysis API.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-md border overflow-hidden">
              {RANGES.map(r => (
                <button
                  key={r}
                  onClick={() => setRange(r)}
                  className={`px-3 py-1.5 text-xs ${range === r ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted'}`}
                >
                  {r}d
                </button>
              ))}
            </div>
            <Button size="sm" variant="outline" onClick={load} disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {cards.map(c => (
            <Card key={c.label}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">{c.label}</p>
                    <p className="text-2xl font-bold mt-1">{c.value.toLocaleString()}</p>
                  </div>
                  <c.icon className={`w-8 h-8 ${c.color}`} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Success Rate</p>
              <p className="text-2xl font-bold mt-1">{successRate}%</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Pending (not yet submitted)</p>
              <p className="text-2xl font-bold mt-1">{counts?.notSubmitted ?? 0}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Status</p>
                <Badge variant={counts && counts.inProgress > 0 ? 'secondary' : 'default'} className="mt-2">
                  {counts && counts.inProgress > 0 ? 'Active processing' : 'Idle'}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Trend over last {range} days</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trend}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v) => v.slice(5)}
                  />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="submitted" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="completed" stroke="hsl(142 71% 45%)" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="failed" stroke="hsl(var(--destructive))" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
