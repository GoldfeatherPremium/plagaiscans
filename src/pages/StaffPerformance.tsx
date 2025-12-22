import React, { useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { 
  Trophy, 
  Clock, 
  FileText, 
  TrendingUp,
  Medal,
  Loader2,
  Calendar
} from 'lucide-react';
import { format, subDays } from 'date-fns';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line
} from 'recharts';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface StaffStats {
  id: string;
  email: string;
  full_name: string | null;
  documentsProcessed: number;
  avgProcessingTime: number;
  rank: number;
}

export default function StaffPerformance() {
  const [timeRange, setTimeRange] = useState('7');

  const { data: staffStats, isLoading } = useQuery({
    queryKey: ['staff-performance', timeRange],
    queryFn: async () => {
      const daysAgo = subDays(new Date(), parseInt(timeRange)).toISOString();

      // Get all staff/admin users
      const { data: staffRoles } = await supabase
        .from('user_roles')
        .select('user_id')
        .in('role', ['staff', 'admin']);

      if (!staffRoles || staffRoles.length === 0) return { leaderboard: [], dailyStats: [] };

      const staffIds = staffRoles.map(r => r.user_id);

      // Get staff profiles
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, email, full_name')
        .in('id', staffIds);

      // Get completed documents by staff
      const { data: completedDocs } = await supabase
        .from('documents')
        .select('assigned_staff_id, uploaded_at, completed_at')
        .eq('status', 'completed')
        .not('assigned_staff_id', 'is', null)
        .not('completed_at', 'is', null)
        .gte('completed_at', daysAgo)
        .in('assigned_staff_id', staffIds);

      // Calculate stats per staff
      const statsMap = new Map<string, { count: number; totalTime: number }>();
      
      completedDocs?.forEach(doc => {
        const staffId = doc.assigned_staff_id!;
        const current = statsMap.get(staffId) || { count: 0, totalTime: 0 };
        
        const uploadedTime = new Date(doc.uploaded_at).getTime();
        const completedTime = new Date(doc.completed_at!).getTime();
        const processingTime = (completedTime - uploadedTime) / (1000 * 60); // minutes
        
        statsMap.set(staffId, {
          count: current.count + 1,
          totalTime: current.totalTime + processingTime
        });
      });

      // Build leaderboard
      const leaderboard: StaffStats[] = [];
      profiles?.forEach(profile => {
        const stats = statsMap.get(profile.id);
        leaderboard.push({
          id: profile.id,
          email: profile.email,
          full_name: profile.full_name,
          documentsProcessed: stats?.count || 0,
          avgProcessingTime: stats ? Math.round(stats.totalTime / stats.count) : 0,
          rank: 0
        });
      });

      // Sort by documents processed and assign ranks
      leaderboard.sort((a, b) => b.documentsProcessed - a.documentsProcessed);
      leaderboard.forEach((staff, index) => {
        staff.rank = index + 1;
      });

      // Calculate daily stats for chart
      const dailyStats: { date: string; documents: number }[] = [];
      for (let i = parseInt(timeRange) - 1; i >= 0; i--) {
        const date = subDays(new Date(), i);
        const dateStr = format(date, 'yyyy-MM-dd');
        const count = completedDocs?.filter(d => 
          d.completed_at && format(new Date(d.completed_at), 'yyyy-MM-dd') === dateStr
        ).length || 0;
        
        dailyStats.push({
          date: format(date, 'MMM dd'),
          documents: count
        });
      }

      return { leaderboard, dailyStats };
    }
  });

  const formatTime = (minutes: number) => {
    if (minutes === 0) return 'N/A';
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const getRankBadge = (rank: number) => {
    if (rank === 1) return <Medal className="h-5 w-5 text-yellow-500" />;
    if (rank === 2) return <Medal className="h-5 w-5 text-gray-400" />;
    if (rank === 3) return <Medal className="h-5 w-5 text-amber-600" />;
    return <span className="text-muted-foreground font-medium">#{rank}</span>;
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  const topPerformer = staffStats?.leaderboard[0];
  const totalProcessed = staffStats?.leaderboard.reduce((sum, s) => sum + s.documentsProcessed, 0) || 0;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-display font-bold">Staff Performance</h1>
            <p className="text-muted-foreground">Track team productivity and efficiency</p>
          </div>
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-[180px]">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 Days</SelectItem>
              <SelectItem value="14">Last 14 Days</SelectItem>
              <SelectItem value="30">Last 30 Days</SelectItem>
              <SelectItem value="90">Last 90 Days</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Top Performer</CardTitle>
              <Trophy className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold truncate">
                {topPerformer?.full_name || topPerformer?.email || 'N/A'}
              </div>
              <p className="text-xs text-muted-foreground">
                {topPerformer?.documentsProcessed || 0} documents processed
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Processed</CardTitle>
              <FileText className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalProcessed}</div>
              <p className="text-xs text-muted-foreground">
                By {staffStats?.leaderboard.length || 0} staff members
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Active Staff</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {staffStats?.leaderboard.filter(s => s.documentsProcessed > 0).length || 0}
              </div>
              <p className="text-xs text-muted-foreground">
                Processed at least 1 document
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Processing Trend Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Processing Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={staffStats?.dailyStats}>
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
                  <Line 
                    type="monotone" 
                    dataKey="documents" 
                    stroke="hsl(var(--primary))" 
                    strokeWidth={2}
                    dot={{ fill: 'hsl(var(--primary))' }}
                    name="Documents Processed"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Leaderboard */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5" />
              Staff Leaderboard
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {staffStats?.leaderboard.map((staff) => (
                <div 
                  key={staff.id} 
                  className={`flex items-center gap-4 p-4 rounded-lg ${
                    staff.rank <= 3 ? 'bg-muted/50' : ''
                  }`}
                >
                  <div className="w-8 flex justify-center">
                    {getRankBadge(staff.rank)}
                  </div>
                  
                  <Avatar className="h-10 w-10">
                    <AvatarFallback>
                      {(staff.full_name || staff.email).charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">
                      {staff.full_name || 'Unknown'}
                    </p>
                    <p className="text-sm text-muted-foreground truncate">
                      {staff.email}
                    </p>
                  </div>
                  
                  <div className="text-right">
                    <p className="font-semibold">{staff.documentsProcessed}</p>
                    <p className="text-xs text-muted-foreground">documents</p>
                  </div>
                  
                  <div className="text-right min-w-[80px]">
                    <div className="flex items-center justify-end gap-1">
                      <Clock className="h-3 w-3 text-muted-foreground" />
                      <span className="text-sm">{formatTime(staff.avgProcessingTime)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">avg time</p>
                  </div>
                </div>
              ))}

              {(!staffStats?.leaderboard || staffStats.leaderboard.length === 0) && (
                <p className="text-center text-muted-foreground py-8">
                  No staff activity in the selected period
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
