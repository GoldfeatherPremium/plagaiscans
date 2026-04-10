import React, { useMemo } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Sparkles, Users, FileText, TrendingUp, UserCheck, UserX } from 'lucide-react';
import { format, subDays, startOfDay } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { SEO } from '@/components/SEO';

const MODE_COLORS: Record<string, string> = {
  standard: 'hsl(var(--primary))',
  advanced: 'hsl(var(--accent))',
  academic: '#10b981',
  creative: '#f59e0b',
};

export default function AdminHumanizerAnalytics() {
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['humanizer-analytics'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('humanizer_usage_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1000);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: profilesMap = {} } = useQuery({
    queryKey: ['humanizer-profiles', logs],
    queryFn: async () => {
      const userIds = [...new Set(logs.filter(l => l.user_id).map(l => l.user_id!))];
      if (!userIds.length) return {};
      const { data } = await supabase
        .from('profiles')
        .select('id, email, full_name')
        .in('id', userIds);
      const map: Record<string, { email: string; full_name: string | null }> = {};
      data?.forEach(p => { map[p.id] = { email: p.email, full_name: p.full_name }; });
      return map;
    },
    enabled: logs.length > 0,
  });

  const stats = useMemo(() => {
    const totalRequests = logs.length;
    const uniqueUsers = new Set(logs.filter(l => l.user_id).map(l => l.user_id)).size;
    const guestRequests = logs.filter(l => !l.user_id).length;
    const loggedInRequests = logs.filter(l => l.user_id).length;
    const totalWords = logs.reduce((sum, l) => sum + (l.word_count || 0), 0);
    const avgScore = totalRequests > 0 ? Math.round(logs.reduce((sum, l) => sum + (l.estimated_score || 0), 0) / totalRequests) : 0;

    return { totalRequests, uniqueUsers, guestRequests, loggedInRequests, totalWords, avgScore };
  }, [logs]);

  const dailyData = useMemo(() => {
    const days: Record<string, number> = {};
    for (let i = 29; i >= 0; i--) {
      const day = format(subDays(new Date(), i), 'MMM dd');
      days[day] = 0;
    }
    logs.forEach(l => {
      const day = format(new Date(l.created_at), 'MMM dd');
      if (day in days) days[day]++;
    });
    return Object.entries(days).map(([date, count]) => ({ date, count }));
  }, [logs]);

  const modeData = useMemo(() => {
    const modes: Record<string, number> = { standard: 0, advanced: 0, academic: 0, creative: 0 };
    logs.forEach(l => { if (l.mode in modes) modes[l.mode]++; });
    return Object.entries(modes).map(([name, value]) => ({ name, value }));
  }, [logs]);

  const recentLogs = logs.slice(0, 50);

  return (
    <DashboardLayout>
      <SEO title="Humanizer Analytics | Admin" />
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            Humanizer Analytics
          </h1>
          <p className="text-muted-foreground">Track AI Humanizer tool usage and engagement</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {[
            { label: 'Total Requests', value: stats.totalRequests, icon: FileText },
            { label: 'Unique Users', value: stats.uniqueUsers, icon: Users },
            { label: 'Logged-in', value: stats.loggedInRequests, icon: UserCheck },
            { label: 'Guest', value: stats.guestRequests, icon: UserX },
            { label: 'Words Processed', value: stats.totalWords.toLocaleString(), icon: FileText },
            { label: 'Avg Score', value: `${stats.avgScore}%`, icon: TrendingUp },
          ].map((stat) => (
            <Card key={stat.label}>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <stat.icon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">{stat.label}</span>
                </div>
                <p className="text-xl font-bold">{stat.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Daily Usage (Last 30 Days)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dailyData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                    <YAxis tick={{ fontSize: 12 }} className="fill-muted-foreground" />
                    <Tooltip />
                    <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Mode Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={modeData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                      {modeData.map((entry) => (
                        <Cell key={entry.name} fill={MODE_COLORS[entry.name] || 'hsl(var(--muted))'} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Requests Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Requests</CardTitle>
            <CardDescription>Last 50 humanization requests</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Words</TableHead>
                  <TableHead>Mode</TableHead>
                  <TableHead>Score</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-xs">{format(new Date(log.created_at), 'MMM dd, HH:mm')}</TableCell>
                    <TableCell className="text-xs">
                      {log.user_id && profilesMap[log.user_id]
                        ? profilesMap[log.user_id].email
                        : <span className="text-muted-foreground">Guest</span>}
                    </TableCell>
                    <TableCell>{log.word_count}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize text-xs">{log.mode}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{log.estimated_score}%</Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {recentLogs.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      No humanizer usage data yet
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
