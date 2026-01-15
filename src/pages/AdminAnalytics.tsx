import React, { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { FileText, Users, CheckCircle, Clock, TrendingUp, Loader2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface StaffStats {
  staff_id: string;
  staff_name: string;
  count: number;
}

export default function AdminAnalytics() {
  const [loading, setLoading] = useState(true);
  const [totalUsers, setTotalUsers] = useState(0);
  const [totalDocs, setTotalDocs] = useState(0);
  const [pendingDocs, setPendingDocs] = useState(0);
  const [completedDocs, setCompletedDocs] = useState(0);
  const [dailyStats, setDailyStats] = useState<{ date: string; count: number }[]>([]);
  const [weeklyStats, setWeeklyStats] = useState<{ week: string; count: number }[]>([]);
  const [staffPerformance, setStaffPerformance] = useState<StaffStats[]>([]);

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
      .select('*')
      .or('deleted_by_user.is.null,deleted_by_user.eq.false')
      .limit(50000);
    const allDocs = docs || [];
    setTotalDocs(allDocs.length);
    setPendingDocs(allDocs.filter((d) => d.status === 'pending').length);
    setCompletedDocs(allDocs.filter((d) => d.status === 'completed').length);

    // Calculate daily stats (last 7 days)
    const last7Days: { date: string; count: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const count = allDocs.filter((d) => d.completed_at && d.completed_at.startsWith(dateStr)).length;
      last7Days.push({ date: date.toLocaleDateString('en-US', { weekday: 'short' }), count });
    }
    setDailyStats(last7Days);

    // Calculate weekly stats (last 4 weeks)
    const last4Weeks: { week: string; count: number }[] = [];
    for (let i = 3; i >= 0; i--) {
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - (i + 1) * 7);
      const weekEnd = new Date();
      weekEnd.setDate(weekEnd.getDate() - i * 7);
      const count = allDocs.filter((d) => {
        if (!d.completed_at) return false;
        const completedDate = new Date(d.completed_at);
        return completedDate >= weekStart && completedDate < weekEnd;
      }).length;
      last4Weeks.push({ week: `Week ${4 - i}`, count });
    }
    setWeeklyStats(last4Weeks);

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

  const COLORS = ['hsl(220, 90%, 56%)', 'hsl(160, 70%, 45%)', 'hsl(35, 100%, 50%)', 'hsl(280, 70%, 60%)'];

  const pieData = [
    { name: 'Pending', value: pendingDocs },
    { name: 'In Progress', value: totalDocs - pendingDocs - completedDocs },
    { name: 'Completed', value: completedDocs },
  ].filter((d) => d.value > 0);

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

        {/* Stats Cards */}
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
                <p className="text-2xl font-bold">{totalDocs}</p>
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
                <p className="text-2xl font-bold">{pendingDocs}</p>
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
                <p className="text-2xl font-bold">{completedDocs}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Documents Processed</CardTitle>
              <CardDescription>Daily and weekly processing trends</CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="daily">
                <TabsList className="mb-4">
                  <TabsTrigger value="daily">Daily</TabsTrigger>
                  <TabsTrigger value="weekly">Weekly</TabsTrigger>
                </TabsList>
                <TabsContent value="daily">
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={dailyStats}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="date" className="text-xs" />
                        <YAxis className="text-xs" />
                        <Tooltip />
                        <Bar dataKey="count" fill="hsl(220, 90%, 56%)" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </TabsContent>
                <TabsContent value="weekly">
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={weeklyStats}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="week" className="text-xs" />
                        <YAxis className="text-xs" />
                        <Tooltip />
                        <Bar dataKey="count" fill="hsl(160, 70%, 45%)" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </TabsContent>
              </Tabs>
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