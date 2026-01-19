import React, { useState, useMemo } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Shimmer } from '@/components/ui/shimmer';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { 
  FileText, 
  Users, 
  DollarSign, 
  Clock, 
  TrendingUp,
  CheckCircle,
  AlertCircle,
  UserCheck,
  Coins,
  Sparkles,
  Link,
  Upload,
  ArrowUp,
  ArrowDown,
  Minus,
  Calendar
} from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { format, subDays, startOfDay, endOfDay, startOfWeek, startOfMonth, subWeeks, subMonths } from 'date-fns';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar
} from 'recharts';
import { DateRange } from 'react-day-picker';

type Period = 'today' | 'yesterday' | 'week' | 'month' | 'custom';

// Skeleton components for admin dashboard
const MetricCardSkeleton = () => (
  <Card className="overflow-hidden">
    <CardHeader className="flex flex-row items-center justify-between pb-2">
      <Shimmer className="h-4 w-32" />
      <Shimmer className="h-8 w-8 rounded-lg" />
    </CardHeader>
    <CardContent>
      <Shimmer className="h-8 w-20 mb-1" />
      <Shimmer className="h-3 w-24" />
    </CardContent>
  </Card>
);

const ChartSkeleton = () => (
  <Card>
    <CardHeader>
      <Shimmer className="h-6 w-48" />
    </CardHeader>
    <CardContent>
      <div className="h-[300px] flex items-end justify-between gap-2 p-4">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-2">
            <Shimmer 
              className="w-full rounded-t" 
              style={{ height: `${Math.random() * 60 + 40}%` }} 
            />
            <Shimmer className="h-3 w-8" />
          </div>
        ))}
      </div>
    </CardContent>
  </Card>
);

// Helper to get date range for a period
function getDateRange(period: Period, customRange?: DateRange): { start: Date; end: Date; prevStart: Date; prevEnd: Date } {
  const now = new Date();
  let start: Date, end: Date, prevStart: Date, prevEnd: Date;
  
  switch (period) {
    case 'today':
      start = startOfDay(now);
      end = endOfDay(now);
      prevStart = startOfDay(subDays(now, 1));
      prevEnd = endOfDay(subDays(now, 1));
      break;
    case 'yesterday':
      start = startOfDay(subDays(now, 1));
      end = endOfDay(subDays(now, 1));
      prevStart = startOfDay(subDays(now, 2));
      prevEnd = endOfDay(subDays(now, 2));
      break;
    case 'week':
      start = startOfDay(subDays(now, 6));
      end = endOfDay(now);
      prevStart = startOfDay(subDays(now, 13));
      prevEnd = endOfDay(subDays(now, 7));
      break;
    case 'month':
      start = startOfDay(subDays(now, 29));
      end = endOfDay(now);
      prevStart = startOfDay(subDays(now, 59));
      prevEnd = endOfDay(subDays(now, 30));
      break;
    case 'custom':
      if (customRange?.from && customRange?.to) {
        start = startOfDay(customRange.from);
        end = endOfDay(customRange.to);
        const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
        prevStart = startOfDay(subDays(start, daysDiff));
        prevEnd = endOfDay(subDays(start, 1));
      } else {
        start = startOfDay(now);
        end = endOfDay(now);
        prevStart = startOfDay(subDays(now, 1));
        prevEnd = endOfDay(subDays(now, 1));
      }
      break;
    default:
      start = startOfDay(now);
      end = endOfDay(now);
      prevStart = startOfDay(subDays(now, 1));
      prevEnd = endOfDay(subDays(now, 1));
  }
  
  return { start, end, prevStart, prevEnd };
}

export default function AdminDashboardOverview() {
  const [period, setPeriod] = useState<Period>('today');
  const [customRange, setCustomRange] = useState<DateRange | undefined>();
  const [calendarOpen, setCalendarOpen] = useState(false);

  const dateRange = useMemo(() => getDateRange(period, customRange), [period, customRange]);

  // Fetch dashboard metrics with accurate counts
  const { data: metrics, isLoading } = useQuery({
    queryKey: ['admin-dashboard-metrics', period, customRange?.from?.toISOString(), customRange?.to?.toISOString()],
    queryFn: async () => {
      const today = new Date();
      const todayStart = startOfDay(today).toISOString();
      const todayEnd = endOfDay(today).toISOString();
      const yesterday = subDays(today, 1);
      const yesterdayStart = startOfDay(yesterday).toISOString();
      const yesterdayEnd = endOfDay(yesterday).toISOString();
      const last7Days = subDays(today, 7).toISOString();
      const last30Days = subDays(today, 30).toISOString();

      // Period-specific dates
      const periodStart = dateRange.start.toISOString();
      const periodEnd = dateRange.end.toISOString();
      const prevPeriodStart = dateRange.prevStart.toISOString();
      const prevPeriodEnd = dateRange.prevEnd.toISOString();

      // Pending documents count
      const { count: pendingCount } = await supabase
        .from('documents')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending')
        .is('deleted_at', null);

      // In-progress documents count
      const { count: inProgressCount } = await supabase
        .from('documents')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'in_progress')
        .is('deleted_at', null);

      // Completed in period
      const { count: completedInPeriod } = await supabase
        .from('documents')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'completed')
        .gte('completed_at', periodStart)
        .lte('completed_at', periodEnd)
        .is('deleted_at', null);

      // Completed in previous period (for comparison)
      const { count: completedPrevPeriod } = await supabase
        .from('documents')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'completed')
        .gte('completed_at', prevPeriodStart)
        .lte('completed_at', prevPeriodEnd)
        .is('deleted_at', null);

      // Total users
      const { count: totalUsers } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });

      // Active staff (who have processed documents in last 7 days)
      const { data: activeStaff } = await supabase
        .from('documents')
        .select('assigned_staff_id')
        .eq('status', 'completed')
        .gte('completed_at', last7Days)
        .not('assigned_staff_id', 'is', null);
      
      const uniqueActiveStaff = new Set(activeStaff?.map(d => d.assigned_staff_id)).size;

      // Period revenue from credit transactions
      const { data: periodTransactions } = await supabase
        .from('credit_transactions')
        .select('amount')
        .eq('transaction_type', 'purchase')
        .gte('created_at', periodStart)
        .lte('created_at', periodEnd);
      
      const periodRevenue = periodTransactions?.reduce((sum, t) => sum + Math.abs(t.amount), 0) || 0;

      // Previous period revenue for comparison
      const { data: prevPeriodTransactions } = await supabase
        .from('credit_transactions')
        .select('amount')
        .eq('transaction_type', 'purchase')
        .gte('created_at', prevPeriodStart)
        .lte('created_at', prevPeriodEnd);
      
      const prevPeriodRevenue = prevPeriodTransactions?.reduce((sum, t) => sum + Math.abs(t.amount), 0) || 0;

      // Documents per day (last 7 days for chart)
      const { data: recentDocs } = await supabase
        .from('documents')
        .select('uploaded_at, status, completed_at')
        .gte('uploaded_at', last7Days)
        .is('deleted_at', null);

      // Calculate average processing time
      const { data: completedDocs } = await supabase
        .from('documents')
        .select('uploaded_at, completed_at')
        .eq('status', 'completed')
        .not('completed_at', 'is', null)
        .gte('completed_at', last30Days)
        .is('deleted_at', null);

      let avgProcessingTime = 0;
      if (completedDocs && completedDocs.length > 0) {
        const totalMinutes = completedDocs.reduce((sum, doc) => {
          const uploaded = new Date(doc.uploaded_at).getTime();
          const completed = new Date(doc.completed_at!).getTime();
          return sum + (completed - uploaded) / (1000 * 60);
        }, 0);
        avgProcessingTime = Math.round(totalMinutes / completedDocs.length);
      }

      // Fetch credit statistics
      const { data: creditData } = await supabase
        .from('profiles')
        .select('credit_balance, similarity_credit_balance');

      const fullScanCredits = {
        total: creditData?.reduce((sum, p) => sum + (p.credit_balance || 0), 0) || 0,
        usersWithCredits: creditData?.filter(p => (p.credit_balance || 0) > 0).length || 0
      };

      const similarityCredits = {
        total: creditData?.reduce((sum, p) => sum + (p.similarity_credit_balance || 0), 0) || 0,
        usersWithCredits: creditData?.filter(p => (p.similarity_credit_balance || 0) > 0).length || 0
      };

      // Fetch magic link statistics
      const { data: magicLinkData } = await supabase
        .from('magic_upload_links')
        .select('status, max_uploads, current_uploads');

      const magicLinks = {
        total: magicLinkData?.length || 0,
        active: magicLinkData?.filter(l => l.status === 'active').length || 0,
        totalCapacity: magicLinkData?.reduce((sum, l) => sum + (l.max_uploads || 0), 0) || 0,
        uploadsUsed: magicLinkData?.reduce((sum, l) => sum + (l.current_uploads || 0), 0) || 0,
        remainingCapacity: 0
      };
      magicLinks.remainingCapacity = magicLinks.totalCapacity - magicLinks.uploadsUsed;

      // Fetch scan type statistics with ACCURATE COUNTS using count: exact
      // AI Scan (full) - Total
      const { count: fullScanTotal } = await supabase
        .from('documents')
        .select('*', { count: 'exact', head: true })
        .eq('scan_type', 'full')
        .is('deleted_at', null);

      // AI Scan - Completed Total
      const { count: fullScanCompletedTotal } = await supabase
        .from('documents')
        .select('*', { count: 'exact', head: true })
        .eq('scan_type', 'full')
        .eq('status', 'completed')
        .is('deleted_at', null);

      // AI Scan - Completed in Period
      const { count: fullScanCompletedPeriod } = await supabase
        .from('documents')
        .select('*', { count: 'exact', head: true })
        .eq('scan_type', 'full')
        .eq('status', 'completed')
        .gte('completed_at', periodStart)
        .lte('completed_at', periodEnd)
        .is('deleted_at', null);

      // AI Scan - Completed in Previous Period
      const { count: fullScanCompletedPrevPeriod } = await supabase
        .from('documents')
        .select('*', { count: 'exact', head: true })
        .eq('scan_type', 'full')
        .eq('status', 'completed')
        .gte('completed_at', prevPeriodStart)
        .lte('completed_at', prevPeriodEnd)
        .is('deleted_at', null);

      // AI Scan - Pending
      const { count: fullScanPending } = await supabase
        .from('documents')
        .select('*', { count: 'exact', head: true })
        .eq('scan_type', 'full')
        .eq('status', 'pending')
        .is('deleted_at', null);

      // AI Scan - In Progress
      const { count: fullScanInProgress } = await supabase
        .from('documents')
        .select('*', { count: 'exact', head: true })
        .eq('scan_type', 'full')
        .eq('status', 'in_progress')
        .is('deleted_at', null);

      // Similarity Only - Total
      const { count: similarityTotal } = await supabase
        .from('documents')
        .select('*', { count: 'exact', head: true })
        .eq('scan_type', 'similarity_only')
        .is('deleted_at', null);

      // Similarity Only - Completed Total
      const { count: similarityCompletedTotal } = await supabase
        .from('documents')
        .select('*', { count: 'exact', head: true })
        .eq('scan_type', 'similarity_only')
        .eq('status', 'completed')
        .is('deleted_at', null);

      // Similarity Only - Completed in Period
      const { count: similarityCompletedPeriod } = await supabase
        .from('documents')
        .select('*', { count: 'exact', head: true })
        .eq('scan_type', 'similarity_only')
        .eq('status', 'completed')
        .gte('completed_at', periodStart)
        .lte('completed_at', periodEnd)
        .is('deleted_at', null);

      // Similarity Only - Completed in Previous Period
      const { count: similarityCompletedPrevPeriod } = await supabase
        .from('documents')
        .select('*', { count: 'exact', head: true })
        .eq('scan_type', 'similarity_only')
        .eq('status', 'completed')
        .gte('completed_at', prevPeriodStart)
        .lte('completed_at', prevPeriodEnd)
        .is('deleted_at', null);

      // Similarity Only - Pending
      const { count: similarityPending } = await supabase
        .from('documents')
        .select('*', { count: 'exact', head: true })
        .eq('scan_type', 'similarity_only')
        .eq('status', 'pending')
        .is('deleted_at', null);

      // Similarity Only - In Progress
      const { count: similarityInProgress } = await supabase
        .from('documents')
        .select('*', { count: 'exact', head: true })
        .eq('scan_type', 'similarity_only')
        .eq('status', 'in_progress')
        .is('deleted_at', null);

      const scanTypeStats = {
        fullScan: {
          completedPeriod: fullScanCompletedPeriod || 0,
          completedPrevPeriod: fullScanCompletedPrevPeriod || 0,
          completedTotal: fullScanCompletedTotal || 0,
          pending: fullScanPending || 0,
          inProgress: fullScanInProgress || 0,
          total: fullScanTotal || 0
        },
        similarityOnly: {
          completedPeriod: similarityCompletedPeriod || 0,
          completedPrevPeriod: similarityCompletedPrevPeriod || 0,
          completedTotal: similarityCompletedTotal || 0,
          pending: similarityPending || 0,
          inProgress: similarityInProgress || 0,
          total: similarityTotal || 0
        }
      };

      // Process chart data
      const chartData: { date: string; uploads: number; completed: number }[] = [];
      for (let i = 6; i >= 0; i--) {
        const date = subDays(today, i);
        const dateStr = format(date, 'yyyy-MM-dd');
        const dayStart = startOfDay(date).toISOString();
        const dayEnd = endOfDay(date).toISOString();
        
        const uploads = recentDocs?.filter(d => 
          d.uploaded_at >= dayStart && d.uploaded_at <= dayEnd
        ).length || 0;
        
        const completed = recentDocs?.filter(d => 
          d.completed_at && d.completed_at >= dayStart && d.completed_at <= dayEnd
        ).length || 0;

        chartData.push({
          date: format(date, 'EEE'),
          uploads,
          completed
        });
      }

      return {
        pendingCount: pendingCount || 0,
        inProgressCount: inProgressCount || 0,
        completedInPeriod: completedInPeriod || 0,
        completedPrevPeriod: completedPrevPeriod || 0,
        totalUsers: totalUsers || 0,
        activeStaff: uniqueActiveStaff,
        periodRevenue,
        prevPeriodRevenue,
        avgProcessingTime,
        chartData,
        fullScanCredits,
        similarityCredits,
        magicLinks,
        scanTypeStats
      };
    },
    refetchInterval: 30000 // Refresh every 30 seconds
  });

  const formatTime = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const getPeriodLabel = () => {
    switch (period) {
      case 'today': return 'Today';
      case 'yesterday': return 'Yesterday';
      case 'week': return 'This Week';
      case 'month': return 'This Month';
      case 'custom': 
        if (customRange?.from && customRange?.to) {
          return `${format(customRange.from, 'MMM d')} - ${format(customRange.to, 'MMM d')}`;
        }
        return 'Custom';
      default: return 'Today';
    }
  };

  const getComparisonLabel = () => {
    switch (period) {
      case 'today': return 'vs yesterday';
      case 'yesterday': return 'vs day before';
      case 'week': return 'vs last week';
      case 'month': return 'vs last month';
      case 'custom': return 'vs previous period';
      default: return 'vs previous';
    }
  };

  const calculateChange = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 100);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className={isLoading ? '' : 'content-reveal'}>
          <h1 className="text-3xl font-display font-bold">Dashboard Overview</h1>
          <p className="text-muted-foreground">Real-time insights into your platform</p>
        </div>

        {/* Period Selector */}
        <div className={`flex flex-wrap items-center gap-2 ${isLoading ? '' : 'content-reveal'}`}>
          <Tabs value={period} onValueChange={(v) => setPeriod(v as Period)}>
            <TabsList>
              <TabsTrigger value="today">Today</TabsTrigger>
              <TabsTrigger value="yesterday">Yesterday</TabsTrigger>
              <TabsTrigger value="week">This Week</TabsTrigger>
              <TabsTrigger value="month">This Month</TabsTrigger>
              <TabsTrigger value="custom">Custom</TabsTrigger>
            </TabsList>
          </Tabs>
          
          {period === 'custom' && (
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <Calendar className="h-4 w-4" />
                  {customRange?.from && customRange?.to 
                    ? `${format(customRange.from, 'MMM d')} - ${format(customRange.to, 'MMM d, yyyy')}`
                    : 'Select dates'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarComponent
                  mode="range"
                  selected={customRange}
                  onSelect={(range) => {
                    setCustomRange(range);
                    if (range?.from && range?.to) {
                      setCalendarOpen(false);
                    }
                  }}
                  numberOfMonths={2}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          )}
        </div>

        {/* Key Metrics Grid */}
        <div className={`grid gap-4 md:grid-cols-2 lg:grid-cols-4 ${isLoading ? '' : 'content-reveal-stagger'}`}>
          {isLoading ? (
            <>
              <MetricCardSkeleton />
              <MetricCardSkeleton />
              <MetricCardSkeleton />
              <MetricCardSkeleton />
            </>
          ) : (
            <>
              <Card className="group hover:-translate-y-1 hover:shadow-lg hover:border-amber-500/30 transition-all duration-300">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Pending Documents</CardTitle>
                  <div className="h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center transition-all duration-300 group-hover:scale-110">
                    <AlertCircle className="h-4 w-4 text-amber-500" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{metrics?.pendingCount}</div>
                  <p className="text-xs text-muted-foreground">Awaiting processing</p>
                </CardContent>
              </Card>

              <Card className="group hover:-translate-y-1 hover:shadow-lg hover:border-primary/30 transition-all duration-300">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">In Progress</CardTitle>
                  <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center transition-all duration-300 group-hover:scale-110">
                    <Clock className="h-4 w-4 text-primary" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{metrics?.inProgressCount}</div>
                  <p className="text-xs text-muted-foreground">Being processed now</p>
                </CardContent>
              </Card>

              <Card className="group hover:-translate-y-1 hover:shadow-lg hover:border-secondary/30 transition-all duration-300">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Completed ({getPeriodLabel()})</CardTitle>
                  <div className="h-8 w-8 rounded-lg bg-secondary/10 flex items-center justify-center transition-all duration-300 group-hover:scale-110">
                    <CheckCircle className="h-4 w-4 text-secondary" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{metrics?.completedInPeriod}</div>
                  {metrics && (
                    <div className="flex items-center gap-1 mt-1">
                      {metrics.completedInPeriod > metrics.completedPrevPeriod ? (
                        <span className="text-xs text-green-500 flex items-center gap-0.5">
                          <ArrowUp className="h-3 w-3" />
                          {calculateChange(metrics.completedInPeriod, metrics.completedPrevPeriod)}%
                        </span>
                      ) : metrics.completedInPeriod < metrics.completedPrevPeriod ? (
                        <span className="text-xs text-amber-500 flex items-center gap-0.5">
                          <ArrowDown className="h-3 w-3" />
                          {Math.abs(calculateChange(metrics.completedInPeriod, metrics.completedPrevPeriod))}%
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                          <Minus className="h-3 w-3" />
                          0%
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground">{getComparisonLabel()}</span>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="group hover:-translate-y-1 hover:shadow-lg hover:border-primary/30 transition-all duration-300">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Revenue ({getPeriodLabel()})</CardTitle>
                  <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center transition-all duration-300 group-hover:scale-110">
                    <DollarSign className="h-4 w-4 text-primary" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{metrics?.periodRevenue} Credits</div>
                  {metrics && (
                    <div className="flex items-center gap-1 mt-1">
                      {metrics.periodRevenue > metrics.prevPeriodRevenue ? (
                        <span className="text-xs text-green-500 flex items-center gap-0.5">
                          <ArrowUp className="h-3 w-3" />
                          {calculateChange(metrics.periodRevenue, metrics.prevPeriodRevenue)}%
                        </span>
                      ) : metrics.periodRevenue < metrics.prevPeriodRevenue ? (
                        <span className="text-xs text-amber-500 flex items-center gap-0.5">
                          <ArrowDown className="h-3 w-3" />
                          {Math.abs(calculateChange(metrics.periodRevenue, metrics.prevPeriodRevenue))}%
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                          <Minus className="h-3 w-3" />
                          0%
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground">{getComparisonLabel()}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </div>

        {/* Secondary Metrics */}
        <div className={`grid gap-4 md:grid-cols-3 ${isLoading ? '' : 'content-reveal-stagger'}`}>
          {isLoading ? (
            <>
              <MetricCardSkeleton />
              <MetricCardSkeleton />
              <MetricCardSkeleton />
            </>
          ) : (
            <>
              <Card className="group hover:-translate-y-1 hover:shadow-lg transition-all duration-300">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                  <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center transition-all duration-300 group-hover:scale-110 group-hover:bg-primary/10">
                    <Users className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors duration-300" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{metrics?.totalUsers}</div>
                  <p className="text-xs text-muted-foreground">Registered customers</p>
                </CardContent>
              </Card>

              <Card className="group hover:-translate-y-1 hover:shadow-lg transition-all duration-300">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Active Staff</CardTitle>
                  <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center transition-all duration-300 group-hover:scale-110 group-hover:bg-secondary/10">
                    <UserCheck className="h-4 w-4 text-muted-foreground group-hover:text-secondary transition-colors duration-300" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{metrics?.activeStaff}</div>
                  <p className="text-xs text-muted-foreground">Processed docs this week</p>
                </CardContent>
              </Card>

              <Card className="group hover:-translate-y-1 hover:shadow-lg transition-all duration-300">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Avg Processing Time</CardTitle>
                  <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center transition-all duration-300 group-hover:scale-110 group-hover:bg-accent/10">
                    <TrendingUp className="h-4 w-4 text-muted-foreground group-hover:text-accent transition-colors duration-300" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatTime(metrics?.avgProcessingTime || 0)}</div>
                  <p className="text-xs text-muted-foreground">Last 30 days average</p>
                </CardContent>
              </Card>
            </>
          )}
        </div>

        {/* Processing Statistics by Scan Type */}
        <div className={isLoading ? '' : 'content-reveal'}>
          <h2 className="text-xl font-semibold mb-4">Processing Statistics by Scan Type</h2>
        </div>
        <div className={`grid gap-4 md:grid-cols-2 ${isLoading ? '' : 'content-reveal-stagger'}`}>
          {isLoading ? (
            <>
              <MetricCardSkeleton />
              <MetricCardSkeleton />
            </>
          ) : (
            <>
              {/* AI Scan Stats */}
              <Card className="group hover:-translate-y-1 hover:shadow-lg hover:border-primary/30 transition-all duration-300">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <FileText className="h-5 w-5 text-primary" />
                    AI Scan
                  </CardTitle>
                  <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full">
                    {metrics?.scanTypeStats.fullScan.total} total
                  </span>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-3 bg-primary/5 rounded-lg">
                      <div className="text-2xl font-bold text-primary">
                        {metrics?.scanTypeStats.fullScan.completedPeriod}
                      </div>
                      <p className="text-xs text-muted-foreground">{getPeriodLabel()}</p>
                      {metrics && (
                        <div className="flex items-center justify-center mt-1">
                          {metrics.scanTypeStats.fullScan.completedPeriod > metrics.scanTypeStats.fullScan.completedPrevPeriod ? (
                            <span className="text-xs text-green-500 flex items-center gap-0.5">
                              <ArrowUp className="h-3 w-3" />
                              {getComparisonLabel()}
                            </span>
                          ) : metrics.scanTypeStats.fullScan.completedPeriod < metrics.scanTypeStats.fullScan.completedPrevPeriod ? (
                            <span className="text-xs text-amber-500 flex items-center gap-0.5">
                              <ArrowDown className="h-3 w-3" />
                              {getComparisonLabel()}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                              <Minus className="h-3 w-3" />
                              {getComparisonLabel()}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="text-center p-3 bg-muted/50 rounded-lg">
                      <div className="text-2xl font-bold">
                        {metrics?.scanTypeStats.fullScan.completedPrevPeriod}
                      </div>
                      <p className="text-xs text-muted-foreground">Previous Period</p>
                    </div>
                  </div>
                  <div className="flex justify-between text-sm border-t pt-3">
                    <div className="flex flex-col items-center">
                      <span className="font-semibold text-secondary">{metrics?.scanTypeStats.fullScan.completedTotal}</span>
                      <span className="text-xs text-muted-foreground">Completed</span>
                    </div>
                    <div className="flex flex-col items-center">
                      <span className="font-semibold text-amber-500">{metrics?.scanTypeStats.fullScan.pending}</span>
                      <span className="text-xs text-muted-foreground">Pending</span>
                    </div>
                    <div className="flex flex-col items-center">
                      <span className="font-semibold text-primary">{metrics?.scanTypeStats.fullScan.inProgress}</span>
                      <span className="text-xs text-muted-foreground">In Progress</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Similarity Only Stats */}
              <Card className="group hover:-translate-y-1 hover:shadow-lg hover:border-purple-500/30 transition-all duration-300">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-purple-500" />
                    Similarity Only
                  </CardTitle>
                  <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full">
                    {metrics?.scanTypeStats.similarityOnly.total} total
                  </span>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-3 bg-purple-500/5 rounded-lg">
                      <div className="text-2xl font-bold text-purple-500">
                        {metrics?.scanTypeStats.similarityOnly.completedPeriod}
                      </div>
                      <p className="text-xs text-muted-foreground">{getPeriodLabel()}</p>
                      {metrics && (
                        <div className="flex items-center justify-center mt-1">
                          {metrics.scanTypeStats.similarityOnly.completedPeriod > metrics.scanTypeStats.similarityOnly.completedPrevPeriod ? (
                            <span className="text-xs text-green-500 flex items-center gap-0.5">
                              <ArrowUp className="h-3 w-3" />
                              {getComparisonLabel()}
                            </span>
                          ) : metrics.scanTypeStats.similarityOnly.completedPeriod < metrics.scanTypeStats.similarityOnly.completedPrevPeriod ? (
                            <span className="text-xs text-amber-500 flex items-center gap-0.5">
                              <ArrowDown className="h-3 w-3" />
                              {getComparisonLabel()}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                              <Minus className="h-3 w-3" />
                              {getComparisonLabel()}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="text-center p-3 bg-muted/50 rounded-lg">
                      <div className="text-2xl font-bold">
                        {metrics?.scanTypeStats.similarityOnly.completedPrevPeriod}
                      </div>
                      <p className="text-xs text-muted-foreground">Previous Period</p>
                    </div>
                  </div>
                  <div className="flex justify-between text-sm border-t pt-3">
                    <div className="flex flex-col items-center">
                      <span className="font-semibold text-secondary">{metrics?.scanTypeStats.similarityOnly.completedTotal}</span>
                      <span className="text-xs text-muted-foreground">Completed</span>
                    </div>
                    <div className="flex flex-col items-center">
                      <span className="font-semibold text-amber-500">{metrics?.scanTypeStats.similarityOnly.pending}</span>
                      <span className="text-xs text-muted-foreground">Pending</span>
                    </div>
                    <div className="flex flex-col items-center">
                      <span className="font-semibold text-purple-500">{metrics?.scanTypeStats.similarityOnly.inProgress}</span>
                      <span className="text-xs text-muted-foreground">In Progress</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>

        {/* Credits & Magic Links Overview */}
        <div className={isLoading ? '' : 'content-reveal'}>
          <h2 className="text-xl font-semibold mb-4">Credits & Magic Links</h2>
        </div>
        <div className={`grid gap-4 md:grid-cols-2 lg:grid-cols-4 ${isLoading ? '' : 'content-reveal-stagger'}`}>
          {isLoading ? (
            <>
              <MetricCardSkeleton />
              <MetricCardSkeleton />
              <MetricCardSkeleton />
              <MetricCardSkeleton />
            </>
          ) : (
            <>
              <Card className="group hover:-translate-y-1 hover:shadow-lg hover:border-amber-500/30 transition-all duration-300">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Full Scan Credits</CardTitle>
                  <div className="h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center transition-all duration-300 group-hover:scale-110">
                    <Coins className="h-4 w-4 text-amber-500" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{metrics?.fullScanCredits.total}</div>
                  <p className="text-xs text-muted-foreground">
                    {metrics?.fullScanCredits.usersWithCredits} / {metrics?.totalUsers} users have credits
                  </p>
                </CardContent>
              </Card>

              <Card className="group hover:-translate-y-1 hover:shadow-lg hover:border-purple-500/30 transition-all duration-300">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Similarity Credits</CardTitle>
                  <div className="h-8 w-8 rounded-lg bg-purple-500/10 flex items-center justify-center transition-all duration-300 group-hover:scale-110">
                    <Sparkles className="h-4 w-4 text-purple-500" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{metrics?.similarityCredits.total}</div>
                  <p className="text-xs text-muted-foreground">
                    {metrics?.similarityCredits.usersWithCredits} / {metrics?.totalUsers} users have credits
                  </p>
                </CardContent>
              </Card>

              <Card className="group hover:-translate-y-1 hover:shadow-lg hover:border-primary/30 transition-all duration-300">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Magic Links</CardTitle>
                  <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center transition-all duration-300 group-hover:scale-110">
                    <Link className="h-4 w-4 text-primary" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{metrics?.magicLinks.active} active</div>
                  <p className="text-xs text-muted-foreground">
                    {metrics?.magicLinks.total} total links created
                  </p>
                </CardContent>
              </Card>

              <Card className="group hover:-translate-y-1 hover:shadow-lg hover:border-secondary/30 transition-all duration-300">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Link Capacity</CardTitle>
                  <div className="h-8 w-8 rounded-lg bg-secondary/10 flex items-center justify-center transition-all duration-300 group-hover:scale-110">
                    <Upload className="h-4 w-4 text-secondary" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {metrics?.magicLinks.uploadsUsed} / {metrics?.magicLinks.totalCapacity}
                  </div>
                  <Progress 
                    value={metrics?.magicLinks.totalCapacity ? (metrics.magicLinks.uploadsUsed / metrics.magicLinks.totalCapacity) * 100 : 0} 
                    className="h-2 mt-2"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {metrics?.magicLinks.remainingCapacity} remaining
                  </p>
                </CardContent>
              </Card>
            </>
          )}
        </div>

        {/* Charts */}
        <div className={`grid gap-4 md:grid-cols-2 ${isLoading ? '' : 'content-reveal-stagger'}`}>
          {isLoading ? (
            <>
              <ChartSkeleton />
              <ChartSkeleton />
            </>
          ) : (
            <>
              <Card className="content-reveal" style={{ animationDelay: '300ms' }}>
                <CardHeader>
                  <CardTitle>Document Activity (Last 7 Days)</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={metrics?.chartData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="date" className="text-xs" />
                        <YAxis className="text-xs" />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--card))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px'
                          }}
                        />
                        <Area 
                          type="monotone" 
                          dataKey="uploads" 
                          stackId="1"
                          stroke="hsl(var(--primary))" 
                          fill="hsl(var(--primary))" 
                          fillOpacity={0.3}
                          name="Uploads"
                        />
                        <Area 
                          type="monotone" 
                          dataKey="completed" 
                          stackId="2"
                          stroke="hsl(var(--secondary))" 
                          fill="hsl(var(--secondary))" 
                          fillOpacity={0.3}
                          name="Completed"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card className="content-reveal" style={{ animationDelay: '350ms' }}>
                <CardHeader>
                  <CardTitle>Daily Comparison</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={metrics?.chartData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="date" className="text-xs" />
                        <YAxis className="text-xs" />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--card))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px'
                          }}
                        />
                        <Bar dataKey="uploads" fill="hsl(var(--primary))" name="Uploads" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="completed" fill="hsl(var(--secondary))" name="Completed" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
