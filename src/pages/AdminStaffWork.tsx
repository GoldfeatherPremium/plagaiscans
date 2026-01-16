import React, { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { FileText, Loader2, Calendar, User, Clock } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

interface StaffMember {
  id: string;
  full_name: string | null;
  email: string;
}

interface ProcessedDocument {
  id: string;
  file_name: string;
  completed_at: string;
  staff_id: string;
  staff_name: string;
}

interface DailyStats {
  date: string;
  displayDate: string;
  count: number;
  staffBreakdown: Record<string, number>;
}

export default function AdminStaffWork() {
  const [loading, setLoading] = useState(true);
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<string>('all');
  const [dailyStats, setDailyStats] = useState<DailyStats[]>([]);
  const [weeklyStats, setWeeklyStats] = useState<{ week: string; count: number }[]>([]);
  const [processedDocs, setProcessedDocs] = useState<ProcessedDocument[]>([]);
  const [todayCount, setTodayCount] = useState(0);
  const [weekCount, setWeekCount] = useState(0);

  useEffect(() => {
    fetchData();
  }, [selectedStaff]);

  const fetchData = async () => {
    setLoading(true);

    // Fetch staff members (users with staff or admin role)
    const { data: staffRoles } = await supabase
      .from('user_roles')
      .select('user_id')
      .in('role', ['staff', 'admin']);

    const staffIds = staffRoles?.map((r) => r.user_id) || [];

    if (staffIds.length > 0) {
      const { data: staffProfiles } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', staffIds);

      setStaffMembers(staffProfiles || []);
    }

    // Fetch activity logs for completed documents
    let logsQuery = supabase
      .from('activity_logs')
      .select('*')
      .eq('action', 'Changed status to completed')
      .order('created_at', { ascending: false })
      .limit(50000);

    if (selectedStaff !== 'all') {
      logsQuery = logsQuery.eq('staff_id', selectedStaff);
    }

    const { data: logs } = await logsQuery;
    const activityLogs = logs || [];

    // Fetch document details for the logs
    const docIds = [...new Set(activityLogs.map((l) => l.document_id))];
    let documents: Record<string, any> = {};

    if (docIds.length > 0) {
      const { data: docs } = await supabase
        .from('documents')
        .select('id, file_name, completed_at')
        .in('id', docIds)
        .limit(50000);

      docs?.forEach((d) => {
        documents[d.id] = d;
      });
    }

    // Get staff names map
    const { data: allStaffProfiles } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .in('id', [...new Set(activityLogs.map((l) => l.staff_id))]);

    const staffMap: Record<string, string> = {};
    allStaffProfiles?.forEach((p) => {
      staffMap[p.id] = p.full_name || p.email;
    });

    // Build processed documents list
    const processed: ProcessedDocument[] = activityLogs.map((log) => ({
      id: log.document_id,
      file_name: documents[log.document_id]?.file_name || 'Unknown',
      completed_at: log.created_at,
      staff_id: log.staff_id,
      staff_name: staffMap[log.staff_id] || 'Unknown',
    }));

    setProcessedDocs(processed);

    // Calculate today's count
    const today = new Date().toISOString().split('T')[0];
    const todayDocs = processed.filter((d) => d.completed_at.startsWith(today));
    setTodayCount(todayDocs.length);

    // Calculate this week's count
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    weekStart.setHours(0, 0, 0, 0);
    const weekDocs = processed.filter((d) => new Date(d.completed_at) >= weekStart);
    setWeekCount(weekDocs.length);

    // Calculate daily stats (last 7 days)
    const last7Days: DailyStats[] = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const dayLogs = activityLogs.filter((l) => l.created_at.startsWith(dateStr));
      
      const staffBreakdown: Record<string, number> = {};
      dayLogs.forEach((l) => {
        staffBreakdown[l.staff_id] = (staffBreakdown[l.staff_id] || 0) + 1;
      });

      last7Days.push({
        date: dateStr,
        displayDate: date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
        count: dayLogs.length,
        staffBreakdown,
      });
    }
    setDailyStats(last7Days);

    // Calculate weekly stats (last 4 weeks)
    const last4Weeks: { week: string; count: number }[] = [];
    for (let i = 3; i >= 0; i--) {
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - (i + 1) * 7);
      const weekEnd = new Date();
      weekEnd.setDate(weekEnd.getDate() - i * 7);
      const count = activityLogs.filter((l) => {
        const logDate = new Date(l.created_at);
        return logDate >= weekStart && logDate < weekEnd;
      }).length;
      last4Weeks.push({ week: `Week ${4 - i}`, count });
    }
    setWeeklyStats(last4Weeks);

    setLoading(false);
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString(),
      time: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
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
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold">Staff Work Details</h1>
            <p className="text-muted-foreground mt-1">Monitor staff processing activity</p>
          </div>
          <Select value={selectedStaff} onValueChange={setSelectedStaff}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filter by staff" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Staff</SelectItem>
              {staffMembers.map((staff) => (
                <SelectItem key={staff.id} value={staff.id}>
                  {staff.full_name || staff.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-6 flex items-center gap-4">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <Calendar className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Today's Processing</p>
                <p className="text-2xl font-bold">{todayCount}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6 flex items-center gap-4">
              <div className="h-12 w-12 rounded-lg bg-secondary/10 flex items-center justify-center">
                <Clock className="h-6 w-6 text-secondary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">This Week</p>
                <p className="text-2xl font-bold">{weekCount}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6 flex items-center gap-4">
              <div className="h-12 w-12 rounded-lg bg-accent/10 flex items-center justify-center">
                <User className="h-6 w-6 text-accent" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Active Staff</p>
                <p className="text-2xl font-bold">{staffMembers.length}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <Card>
          <CardHeader>
            <CardTitle>Processing Trends</CardTitle>
            <CardDescription>Documents processed over time</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="daily">
              <TabsList className="mb-4">
                <TabsTrigger value="daily">Daily (Last 7 Days)</TabsTrigger>
                <TabsTrigger value="weekly">Weekly (Last 4 Weeks)</TabsTrigger>
              </TabsList>
              <TabsContent value="daily">
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dailyStats}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="displayDate" className="text-xs" />
                      <YAxis className="text-xs" />
                      <Tooltip 
                        content={({ active, payload, label }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload as DailyStats;
                            return (
                              <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
                                <p className="font-medium mb-2">{label}</p>
                                <p className="text-primary font-bold">Total: {data.count}</p>
                                {Object.keys(data.staffBreakdown).length > 0 && (
                                  <div className="mt-2 pt-2 border-t border-border">
                                    <p className="text-xs text-muted-foreground mb-1">By Staff:</p>
                                    {Object.entries(data.staffBreakdown).map(([staffId, count]) => (
                                      <p key={staffId} className="text-xs">
                                        {staffMembers.find((s) => s.id === staffId)?.full_name || 
                                         staffMembers.find((s) => s.id === staffId)?.email || 
                                         'Unknown'}: {count}
                                      </p>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
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
                      <Bar dataKey="count" fill="hsl(var(--secondary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Daily Breakdown by Staff */}
        <Card>
          <CardHeader>
            <CardTitle>Daily Staff Performance</CardTitle>
            <CardDescription>Documents processed by each staff member per day (last 7 days)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Staff Member</TableHead>
                    {dailyStats.map((day) => (
                      <TableHead key={day.date} className="text-center">
                        {day.displayDate}
                      </TableHead>
                    ))}
                    <TableHead className="text-center">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {staffMembers.map((staff) => {
                    const total = dailyStats.reduce(
                      (sum, day) => sum + (day.staffBreakdown[staff.id] || 0),
                      0
                    );
                    return (
                      <TableRow key={staff.id}>
                        <TableCell className="font-medium">
                          {staff.full_name || staff.email}
                        </TableCell>
                        {dailyStats.map((day) => (
                          <TableCell key={day.date} className="text-center">
                            {day.staffBreakdown[staff.id] || 0}
                          </TableCell>
                        ))}
                        <TableCell className="text-center font-bold text-primary">
                          {total}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Recent Processed Documents */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Processed Documents</CardTitle>
            <CardDescription>
              {selectedStaff === 'all' 
                ? 'All staff members' 
                : `Filtered by: ${staffMembers.find((s) => s.id === selectedStaff)?.full_name || 
                   staffMembers.find((s) => s.id === selectedStaff)?.email}`
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            {processedDocs.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">No processed documents found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>Document</TableHead>
                      <TableHead>Processed By</TableHead>
                      <TableHead>Date &amp; Time</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {processedDocs.slice(0, 50).map((doc, index) => {
                      const { date, time } = formatDateTime(doc.completed_at);
                      return (
                        <TableRow key={`${doc.id}-${index}`}>
                          <TableCell className="font-medium">{index + 1}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <FileText className="h-4 w-4 text-primary flex-shrink-0" />
                              <span className="truncate max-w-[200px]" title={doc.file_name}>
                                {doc.file_name}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{doc.staff_name}</Badge>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              <div>{date}</div>
                              <div className="text-muted-foreground">{time}</div>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                {processedDocs.length > 50 && (
                  <p className="text-center text-sm text-muted-foreground mt-4">
                    Showing first 50 of {processedDocs.length} documents
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
