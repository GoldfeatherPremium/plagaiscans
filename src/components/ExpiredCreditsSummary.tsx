import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useExpiredCreditsStats, ExpiredPeriod } from '@/hooks/useExpiredCreditsStats';
import { Loader2, TrendingDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface ExpiredCreditsSummaryProps {
  compact?: boolean;
}

export function ExpiredCreditsSummary({ compact = false }: ExpiredCreditsSummaryProps) {
  const { stats, isLoading, period, setPeriod } = useExpiredCreditsStats();

  const periodLabel: Record<ExpiredPeriod, string> = {
    '7d': 'Last 7 Days',
    '30d': 'Last 30 Days',
    '90d': 'Last 90 Days',
    'all': 'All Time',
  };

  return (
    <Card className="border-dashed border-destructive/30 bg-destructive/5">
      <CardContent className={compact ? 'p-4' : 'p-6'}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <TrendingDown className="h-5 w-5 text-destructive" />
            <h3 className="font-semibold text-sm">Expired Credits Summary</h3>
          </div>
          <Select value={period} onValueChange={(v) => setPeriod(v as ExpiredPeriod)}>
            <SelectTrigger className="w-[140px] h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 Days</SelectItem>
              <SelectItem value="30d">Last 30 Days</SelectItem>
              <SelectItem value="90d">Last 90 Days</SelectItem>
              <SelectItem value="all">All Time</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className={compact ? 'grid grid-cols-2 gap-3' : 'grid grid-cols-4 gap-4'}>
            <div>
              <p className="text-xs text-muted-foreground">Expired Batches</p>
              <p className="text-xl font-bold text-destructive">{stats?.totalBatches || 0}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Wasted</p>
              <p className="text-xl font-bold text-destructive">{stats?.totalExpiredCredits || 0}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                AI Scan <Badge variant="default" className="text-[10px] px-1 py-0 h-4">Full</Badge>
              </p>
              <p className="text-lg font-semibold">{stats?.aiScanExpired || 0}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                Similarity <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4">Sim</Badge>
              </p>
              <p className="text-lg font-semibold">{stats?.similarityExpired || 0}</p>
            </div>
          </div>
        )}

        <p className="text-[11px] text-muted-foreground mt-3">
          {periodLabel[period]} • {stats?.totalBatches || 0} batches / {stats?.totalExpiredCredits || 0} credits expired
        </p>
      </CardContent>
    </Card>
  );
}
