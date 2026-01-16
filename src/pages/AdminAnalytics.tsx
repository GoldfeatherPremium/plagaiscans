import React, { useEffect, useState, useMemo } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area } from 'recharts';
import { FileText, Users, CheckCircle, Clock, TrendingUp, Loader2, Calendar as CalendarIcon } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays, subWeeks, subMonths, isWithinInterval, eachDayOfInterval, eachWeekOfInterval, eachMonthOfInterval } from 'date-fns';
import { cn } from '@/lib/utils';

interface StaffStats {
  staff_id: string;
  staff_name: string;
  count: number;
}

interface Document {
  id: string;
  status: string;
  completed_at: string | null;
  deleted_by_user?: boolean | null;
}

type TimeRange = 'today' | 'week' | 'month' | 'custom';

export default function AdminAnalytics() {
  const [loading, setLoading] = useState(true);
  const [totalUsers, setTotalUsers] = useState(0);
  const [allDocs, setAllDocs] = useState<Document[]>([]);
  const [staffPerformance, setStaffPerformance] = useState<StaffStats[]>([]);
  
  // Time range state
  const [timeRange, setTimeRange] = useState<TimeRange>('week');
  const [customDateFrom, setCustomDateFrom] = useState<Date | undefined>();
  const [customDateTo, setCustomDateTo] = useState<Date | undefined>();
  const [chartView, setChartView] = useState<'daily' | 'weekly' | 'monthly'>('daily');

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    setLoading(true);

    // Fetch total users
    const { count: userCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
    setTotalUsers(userCount || 0);

    // Fetch documents - filter out deleted ones and use high limit
    const { data: docs } = await supabase
      .from('documents')
      .select('id, status, completed_at, deleted_by_user')
      .or('deleted_by_user.is.null,deleted_by_user.eq.false')
      .limit(50000);
    setAllDocs(docs || []);

    // Fetch staff performance
    const { data: activityLogs } = await supabase
      .from('activity_logs')
      .select('staff_id')
      .eq('action', 'Changed status to completed');

    if (activityLogs) {
      const staffCounts: Record<string, number> = {};
      activityLogs.forEach((log) => {
        staffCounts[log.staff_id] = (staffCounts[log.staff_id] || 0) + 1;
      });

      const staffIds = Object.keys(staffCounts);
      if (staffIds.length > 0) {
        const { data: staffProfiles } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', staffIds);

        const performance: StaffStats[] = staffIds.map((id) => ({
          staff_id: id,
          staff_name: staffProfiles?.find((p) => p.id === id)?.full_name || 
                     staffProfiles?.find((p) => p.id === id)?.email || 'Unknown',
          count: staffCounts[id],
        }));
        setStaffPerformance(performance.sort((a, b) => b.count - a.count));
      }
    }

    setLoading(false);
  };

  // Computed stats
  const stats = useMemo(() => {
    const now = new Date();
    const todayStart = startOfDay(now);
    const todayEnd = endOfDay(now);
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);

    const completedDocs = allDocs.filter(d => d.status === 'completed' && d.completed_at);
    
    const completedToday = completedDocs.filter(d => {
      const date = new Date(d.completed_at!);
      return isWithinInterval(date, { start: todayStart, end: todayEnd });
    }).length;

    const completedThisWeek = completedDocs.filter(d => {
      const date = new Date(d.completed_at!);
      return isWithinInterval(date, { start: weekStart, end: weekEnd });
    }).length;

    const completedThisMonth = completedDocs.filter(d => {
      const date = new Date(d.completed_at!);
      return isWithinInterval(date, { start: monthStart, end: monthEnd });
    }).length;

    let completedCustom = 0;
    if (customDateFrom && customDateTo) {
      completedCustom = completedDocs.filter(d => {
        const date = new Date(d.completed_at!);
        return isWithinInterval(date, { start: startOfDay(customDateFrom), end: endOfDay(customDateTo) });
      }).length;
    }

    return {
      total: allDocs.length,
      pending: allDocs.filter(d => d.status === 'pending').length,
      completed: completedDocs.length,
      completedToday,
      completedThisWeek,
      completedThisMonth,
      completedCustom,
    };
  }, [allDocs, customDateFrom, customDateTo]);

  // Chart data based on selected view
  const chartData = useMemo(() => {
    const completedDocs = allDocs.filter(d => d.status === 'completed' && d.completed_at);
    const now = new Date();

    if (chartView === 'daily') {
      // Last 7 days
      const days = eachDayOfInterval({ start: subDays(now, 6), end: now });
      return days.map(day => {
        const dayStart = startOfDay(day);
        const dayEnd = endOfDay(day);
        const count = completedDocs.filter(d => {
          const date = new Date(d.completed_at!);
          return isWithinInterval(date, { start: dayStart, end: dayEnd });
        }).length;
        return {
          label: format(day, 'EEE'),
          fullLabel: format(day, 'MMM d'),
          count,
        };
      });
    }

    if (chartView === 'weekly') {
      // Last 8 weeks
      const weeks = eachWeekOfInterval({ start: subWeeks(now, 7), end: now }, { weekStartsOn: 1 });
      return weeks.map((weekStart, index) => {
        const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
        const count = completedDocs.filter(d => {
          const date = new Date(d.completed_at!);
          return isWithinInterval(date, { start: weekStart, end: weekEnd });
        }).length;
        return {
          label: `W${index + 1}`,
          fullLabel: `${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d')}`,
          count,
        };
      });
    }

    // Monthly - last 6 months
    const months = eachMonthOfInterval({ start: subMonths(now, 5), end: now });
    return months.map(monthDate => {
      const monthStart = startOfMonth(monthDate);
      const monthEnd = endOfMonth(monthDate);
      const count = completedDocs.filter(d => {
        const date = new Date(d.completed_at!);
        return isWithinInterval(date, { start: monthStart, end: monthEnd });
      }).length;
      return {
        label: format(monthDate, 'MMM'),
        fullLabel: format(monthDate, 'MMMM yyyy'),
        count,
      };
    });
  }, [allDocs, chartView]);

  // Custom range chart data
  const customChartData = useMemo(() => {
    if (!customDateFrom || !customDateTo) return [];
    
    const completedDocs = allDocs.filter(d => d.status === 'completed' && d.completed_at);
    const days = eachDayOfInterval({ start: customDateFrom, end: customDateTo });
    
    // If more than 31 days, group by week
    if (days.length > 31) {
      const weeks = eachWeekOfInterval({ start: customDateFrom, end: customDateTo }, { weekStartsOn: 1 });
      return weeks.map((weekStart) => {
        const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
        const count = completedDocs.filter(d => {
          const date = new Date(d.completed_at!);
          return isWithinInterval(date, { start: weekStart, end: weekEnd > customDateTo ? customDateTo : weekEnd });
        }).length;
        return {
          label: format(weekStart, 'MMM d'),
          fullLabel: `${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d')}`,
          count,
        };
      });
    }

    return days.map(day => {
      const dayStart = startOfDay(day);
      const dayEnd = endOfDay(day);
      const count = completedDocs.filter(d => {
        const date = new Date(d.completed_at!);
        return isWithinInterval(date, { start: dayStart, end: dayEnd });
      }).length;
      return {
        label: format(day, 'MMM d'),
        fullLabel: format(day, 'EEEE, MMM d'),
        count,
      };
    });
  }, [allDocs, customDateFrom, customDateTo]);

  const COLORS = ['hsl(220, 90%, 56%)', 'hsl(160, 70%, 45%)', 'hsl(35, 100%, 50%)', 'hsl(280, 70%, 60%)'];

  const pieData = [
    { name: 'Pending', value: stats.pending },
    { name: 'In Progress', value: stats.total - stats.pending - stats.completed },
    { name: 'Completed', value: stats.completed },
  ].filter((d) => d.value > 0);

  const getActiveCount = () => {
    switch (timeRange) {
      case 'today': return stats.completedToday;
      case 'week': return stats.completedThisWeek;
      case 'month': return stats.completedThisMonth;
      case 'custom': return stats.completedCustom;
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-display font-bold">Analytics Dashboard</h1>
          <p className="text-muted-foreground mt-1">Platform performance overview</p>
        </div>

        {/* Time Range Selector */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground mr-2">View completed:</span>
              <Button
                variant={timeRange === 'today' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTimeRange('today')}
              >
                Today
              </Button>
              <Button
                variant={timeRange === 'week' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTimeRange('week')}
              >
                This Week
              </Button>
              <Button
                variant={timeRange === 'month' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTimeRange('month')}
              >
                This Month
              </Button>
              
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={timeRange === 'custom' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setTimeRange('custom')}
                    className="gap-2"
                  >
                    <CalendarIcon className="h-4 w-4" />
                    Custom
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-4" align="start">
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm font-medium mb-2">From Date</p>
                      <Calendar
                        mode="single"
                        selected={customDateFrom}
                        onSelect={setCustomDateFrom}
                        disabled={(date) => date > new Date() || (customDateTo ? date > customDateTo : false)}
                        initialFocus
                      />
                    </div>
                    <div>
                      <p className="text-sm font-medium mb-2">To Date</p>
                      <Calendar
                        mode="single"
                        selected={customDateTo}
                        onSelect={setCustomDateTo}
                        disabled={(date) => date > new Date() || (customDateFrom ? date < customDateFrom : false)}
                      />
                    </div>
                    {customDateFrom && customDateTo && (
                      <p className="text-sm text-muted-foreground text-center">
                        {format(customDateFrom, 'MMM d, yyyy')} - {format(customDateTo, 'MMM d, yyyy')}
                      </p>
                    )}
                  </div>
                </PopoverContent>
              </Popover>

              {timeRange === 'custom' && customDateFrom && customDateTo && (
                <span className="text-sm text-muted-foreground ml-2">
                  {format(customDateFrom, 'MMM d')} - {format(customDateTo, 'MMM d, yyyy')}
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Completed Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className={cn("cursor-pointer transition-all", timeRange === 'today' && "ring-2 ring-primary")} onClick={() => setTimeRange('today')}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Today</p>
              <p className="text-3xl font-bold text-primary mt-1">{stats.completedToday}</p>
              <p className="text-xs text-muted-foreground">completed</p>
            </CardContent>
          </Card>
          <Card className={cn("cursor-pointer transition-all", timeRange === 'week' && "ring-2 ring-primary")} onClick={() => setTimeRange('week')}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">This Week</p>
              <p className="text-3xl font-bold text-primary mt-1">{stats.completedThisWeek}</p>
              <p className="text-xs text-muted-foreground">completed</p>
            </CardContent>
          </Card>
          <Card className={cn("cursor-pointer transition-all", timeRange === 'month' && "ring-2 ring-primary")} onClick={() => setTimeRange('month')}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">This Month</p>
              <p className="text-3xl font-bold text-primary mt-1">{stats.completedThisMonth}</p>
              <p className="text-xs text-muted-foreground">completed</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">All Time</p>
              <p className="text-3xl font-bold text-secondary mt-1">{stats.completed}</p>
              <p className="text-xs text-muted-foreground">completed</p>
            </CardContent>
          </Card>
        </div>

        {/* Overview Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6 flex items-center gap-4">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Users</p>
                <p className="text-2xl font-bold">{totalUsers}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6 flex items-center gap-4">
              <div className="h-12 w-12 rounded-lg bg-secondary/10 flex items-center justify-center">
                <FileText className="h-6 w-6 text-secondary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Documents</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6 flex items-center gap-4">
              <div className="h-12 w-12 rounded-lg bg-accent/10 flex items-center justify-center">
                <Clock className="h-6 w-6 text-accent" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pending</p>
                <p className="text-2xl font-bold">{stats.pending}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6 flex items-center gap-4">
              <div className="h-12 w-12 rounded-lg bg-secondary/10 flex items-center justify-center">
                <CheckCircle className="h-6 w-6 text-secondary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Completed</p>
                <p className="text-2xl font-bold">{stats.completed}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Completion Trends</CardTitle>
              <CardDescription>Documents completed over time</CardDescription>
            </CardHeader>
            <CardContent>
              {timeRange === 'custom' && customDateFrom && customDateTo ? (
                <div>
                  <div className="mb-4 text-sm text-muted-foreground">
                    Custom range: {format(customDateFrom, 'MMM d, yyyy')} - {format(customDateTo, 'MMM d, yyyy')}
                  </div>
                  <div className="h-[300px]">
                    {customChartData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={customChartData}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis dataKey="label" className="text-xs" />
                          <YAxis className="text-xs" />
                          <Tooltip 
                            labelFormatter={(_, payload) => payload?.[0]?.payload?.fullLabel || ''}
                            formatter={(value: number) => [value, 'Completed']}
                          />
                          <Area type="monotone" dataKey="count" fill="hsl(220, 90%, 56%)" fillOpacity={0.3} stroke="hsl(220, 90%, 56%)" strokeWidth={2} />
                        </AreaChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex items-center justify-center h-full text-muted-foreground">
                        Select a date range to view data
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <Tabs value={chartView} onValueChange={(v) => setChartView(v as typeof chartView)}>
                  <TabsList className="mb-4">
                    <TabsTrigger value="daily">Daily</TabsTrigger>
                    <TabsTrigger value="weekly">Weekly</TabsTrigger>
                    <TabsTrigger value="monthly">Monthly</TabsTrigger>
                  </TabsList>
                  <TabsContent value="daily">
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis dataKey="label" className="text-xs" />
                          <YAxis className="text-xs" />
                          <Tooltip 
                            labelFormatter={(_, payload) => payload?.[0]?.payload?.fullLabel || ''}
                            formatter={(value: number) => [value, 'Completed']}
                          />
                          <Bar dataKey="count" fill="hsl(220, 90%, 56%)" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </TabsContent>
                  <TabsContent value="weekly">
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis dataKey="label" className="text-xs" />
                          <YAxis className="text-xs" />
                          <Tooltip 
                            labelFormatter={(_, payload) => payload?.[0]?.payload?.fullLabel || ''}
                            formatter={(value: number) => [value, 'Completed']}
                          />
                          <Bar dataKey="count" fill="hsl(160, 70%, 45%)" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </TabsContent>
                  <TabsContent value="monthly">
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis dataKey="label" className="text-xs" />
                          <YAxis className="text-xs" />
                          <Tooltip 
                            labelFormatter={(_, payload) => payload?.[0]?.payload?.fullLabel || ''}
                            formatter={(value: number) => [value, 'Completed']}
                          />
                          <Area type="monotone" dataKey="count" fill="hsl(280, 70%, 60%)" fillOpacity={0.3} stroke="hsl(280, 70%, 60%)" strokeWidth={2} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </TabsContent>
                </Tabs>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Document Status</CardTitle>
              <CardDescription>Current status breakdown</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                {pieData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={5}
                        dataKey="value"
                        label={({ name, value }) => `${name}: ${value}`}
                      >
                        {pieData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    No documents yet
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Staff Performance */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Staff Performance
            </CardTitle>
            <CardDescription>Documents processed by each staff member</CardDescription>
          </CardHeader>
          <CardContent>
            {staffPerformance.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No processing data yet</p>
            ) : (
              <div className="space-y-4">
                {staffPerformance.map((staff, index) => (
                  <div key={staff.staff_id} className="flex items-center gap-4">
                    <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{staff.staff_name}</p>
                      <div className="w-full h-2 rounded-full bg-muted mt-1">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{
                            width: `${(staff.count / (staffPerformance[0]?.count || 1)) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                    <p className="font-bold text-lg">{staff.count}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
