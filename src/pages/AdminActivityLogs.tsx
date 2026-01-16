import React, { useEffect, useState, useMemo } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { Search, Loader2, Activity, FileText, CreditCard, Users, Filter, Download } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatDistanceToNow, format } from 'date-fns';

interface ActivityLog {
  id: string;
  type: 'document' | 'credit' | 'auth';
  action: string;
  user_email?: string;
  user_name?: string;
  details?: string;
  created_at: string;
  metadata?: Record<string, unknown>;
}

export default function AdminActivityLogs() {
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');

  useEffect(() => {
    fetchAllLogs();
  }, []);

  const fetchAllLogs = async () => {
    setLoading(true);
    const allLogs: ActivityLog[] = [];

    // Fetch document activity logs
    const { data: docLogs } = await supabase
      .from('activity_logs')
      .select(`
        id,
        action,
        created_at,
        staff_id,
        document_id
      `)
      .order('created_at', { ascending: false })
      .limit(50000);

    if (docLogs) {
      const staffIds = [...new Set(docLogs.map(d => d.staff_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, email, full_name')
        .in('id', staffIds);

      docLogs.forEach(log => {
        const profile = profiles?.find(p => p.id === log.staff_id);
        allLogs.push({
          id: `doc-${log.id}`,
          type: 'document',
          action: log.action,
          user_email: profile?.email,
          user_name: profile?.full_name || undefined,
          details: `Document ID: ${log.document_id.substring(0, 8)}...`,
          created_at: log.created_at,
        });
      });
    }

    // Fetch credit transactions
    const { data: creditLogs } = await supabase
      .from('credit_transactions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50000);

    if (creditLogs) {
      const userIds = [...new Set(creditLogs.map(c => c.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, email, full_name')
        .in('id', userIds);

      creditLogs.forEach(log => {
        const profile = profiles?.find(p => p.id === log.user_id);
        allLogs.push({
          id: `credit-${log.id}`,
          type: 'credit',
          action: `${log.transaction_type}: ${log.amount > 0 ? '+' : ''}${log.amount} credits`,
          user_email: profile?.email,
          user_name: profile?.full_name || undefined,
          details: log.description || `Balance: ${log.balance_before} → ${log.balance_after}`,
          created_at: log.created_at,
        });
      });
    }

    // Sort all logs by date
    allLogs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    
    setLogs(allLogs);
    setLoading(false);
  };

  const filteredLogs = useMemo(() => {
    let filtered = logs;
    
    if (filterType !== 'all') {
      filtered = filtered.filter(log => log.type === filterType);
    }
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(log =>
        log.action.toLowerCase().includes(query) ||
        log.user_email?.toLowerCase().includes(query) ||
        log.user_name?.toLowerCase().includes(query) ||
        log.details?.toLowerCase().includes(query)
      );
    }
    
    return filtered;
  }, [logs, searchQuery, filterType]);

  const exportLogs = () => {
    const csv = [
      ['Date', 'Type', 'Action', 'User', 'Email', 'Details'].join(','),
      ...filteredLogs.map(log => [
        format(new Date(log.created_at), 'yyyy-MM-dd HH:mm:ss'),
        log.type,
        `"${log.action.replace(/"/g, '""')}"`,
        log.user_name || '',
        log.user_email || '',
        `"${(log.details || '').replace(/"/g, '""')}"`,
      ].join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `activity-logs-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'document': return <FileText className="h-4 w-4" />;
      case 'credit': return <CreditCard className="h-4 w-4" />;
      case 'auth': return <Users className="h-4 w-4" />;
      default: return <Activity className="h-4 w-4" />;
    }
  };

  const getTypeBadgeVariant = (type: string) => {
    switch (type) {
      case 'document': return 'default';
      case 'credit': return 'secondary';
      case 'auth': return 'outline';
      default: return 'default';
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold">Activity Logs</h1>
            <p className="text-muted-foreground mt-1">Complete audit trail of system activities</p>
          </div>
          <Button onClick={exportLogs} variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search logs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-[180px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Activities</SelectItem>
              <SelectItem value="document">Document</SelectItem>
              <SelectItem value="credit">Credit</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Document Actions</p>
                <p className="text-xl font-bold">{logs.filter(l => l.type === 'document').length}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-secondary/10 flex items-center justify-center">
                <CreditCard className="h-5 w-5 text-secondary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Credit Transactions</p>
                <p className="text-xl font-bold">{logs.filter(l => l.type === 'credit').length}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-accent/10 flex items-center justify-center">
                <Activity className="h-5 w-5 text-accent" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Activities</p>
                <p className="text-xl font-bold">{logs.length}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Logs Table */}
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filteredLogs.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Activity className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">No activity logs found</p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                <Table>
                  <TableHeader className="sticky top-0 bg-card z-10">
                    <TableRow>
                      <TableHead className="w-[180px]">Time</TableHead>
                      <TableHead className="w-[100px]">Type</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Details</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="text-sm">
                          <div className="font-medium">
                            {format(new Date(log.created_at), 'MMM dd, yyyy')}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {format(new Date(log.created_at), 'HH:mm:ss')}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={getTypeBadgeVariant(log.type) as "default" | "secondary" | "outline"} className="gap-1">
                            {getTypeIcon(log.type)}
                            {log.type}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium">{log.action}</TableCell>
                        <TableCell>
                          <div className="text-sm">{log.user_name || 'Unknown'}</div>
                          <div className="text-xs text-muted-foreground">{log.user_email}</div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                          {log.details}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        <p className="text-xs text-muted-foreground">
          Showing {filteredLogs.length} of {logs.length} activities
        </p>
      </div>
    </DashboardLayout>
  );
}
