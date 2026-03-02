import React, { useEffect, useState, useMemo } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { Search, Loader2, Activity, FileText, CreditCard, Filter, Download, Zap, BarChart3, Wallet } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { format } from 'date-fns';
import { PeriodSelector, DateRangeValue, getDateRangeForPeriod } from '@/components/PeriodSelector';

interface ActivityLog {
  id: string;
  type: 'document' | 'credit' | 'paddle' | 'manual';
  action: string;
  user_email?: string;
  user_name?: string;
  details?: string;
  created_at: string;
  credit_type?: string; // 'full' = AI, 'similarity_only' = Similarity
  source?: string;
  amount?: number;
  transaction_type?: string;
}

export default function AdminActivityLogs() {
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [creditTypeFilter, setCreditTypeFilter] = useState<string>('all');
  const [dateRange, setDateRange] = useState<DateRangeValue>(() => getDateRangeForPeriod('this_month'));

  useEffect(() => {
    fetchAllLogs();
  }, []);

  const fetchAllLogs = async () => {
    setLoading(true);
    const allLogs: ActivityLog[] = [];

    // Fetch all data in parallel
    const [docResult, creditResult, paddleResult, manualResult] = await Promise.all([
      supabase.from('activity_logs').select('id, action, created_at, staff_id, document_id').order('created_at', { ascending: false }).limit(50000),
      supabase.from('credit_transactions').select('*').order('created_at', { ascending: false }).limit(50000),
      supabase.from('paddle_payments').select('*').eq('status', 'completed').order('created_at', { ascending: false }).limit(50000),
      supabase.from('manual_payments').select('*').eq('status', 'verified').order('created_at', { ascending: false }).limit(50000),
    ]);

    // Collect all unique user IDs for profile lookup
    const userIds = new Set<string>();
    docResult.data?.forEach(d => userIds.add(d.staff_id));
    creditResult.data?.forEach(c => userIds.add(c.user_id));
    paddleResult.data?.forEach(p => userIds.add(p.user_id));
    manualResult.data?.forEach(m => userIds.add(m.user_id));

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, email, full_name')
      .in('id', [...userIds]);

    const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

    // Map document logs
    docResult.data?.forEach(log => {
      const profile = profileMap.get(log.staff_id);
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

    // Map credit transactions
    creditResult.data?.forEach(log => {
      const profile = profileMap.get(log.user_id);
      allLogs.push({
        id: `credit-${log.id}`,
        type: 'credit',
        action: `${log.transaction_type}: ${log.amount > 0 ? '+' : ''}${log.amount} credits`,
        user_email: profile?.email,
        user_name: profile?.full_name || undefined,
        details: log.description || `Balance: ${log.balance_before} → ${log.balance_after}`,
        created_at: log.created_at,
        credit_type: log.credit_type,
        amount: log.amount,
        transaction_type: log.transaction_type,
        source: 'credit_transaction',
      });
    });

    // Map paddle payments
    paddleResult.data?.forEach(log => {
      const profile = profileMap.get(log.user_id);
      allLogs.push({
        id: `paddle-${log.id}`,
        type: 'paddle',
        action: `Paddle Payment: +${log.credits} credits`,
        user_email: profile?.email || log.customer_email || undefined,
        user_name: profile?.full_name || undefined,
        details: `$${log.amount_usd} ${log.currency || 'USD'} • ${log.credit_type === 'similarity_only' ? 'Similarity' : 'AI'} Credits`,
        created_at: log.created_at,
        credit_type: log.credit_type,
        amount: log.credits,
        transaction_type: 'add',
        source: 'paddle',
      });
    });

    // Map manual payments
    manualResult.data?.forEach(log => {
      const profile = profileMap.get(log.user_id);
      allLogs.push({
        id: `manual-${log.id}`,
        type: 'manual',
        action: `Manual Payment: +${log.credits} credits`,
        user_email: profile?.email,
        user_name: profile?.full_name || undefined,
        details: `$${log.amount_usd} via ${log.payment_method}${log.notes ? ' • ' + log.notes : ''}`,
        created_at: log.created_at,
        amount: log.credits,
        transaction_type: 'add',
        source: 'manual',
      });
    });

    allLogs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    setLogs(allLogs);
    setLoading(false);
  };

  const filteredLogs = useMemo(() => {
    let filtered = logs;

    // Date range filter
    filtered = filtered.filter(log => {
      const logDate = new Date(log.created_at);
      return logDate >= dateRange.start && logDate <= dateRange.end;
    });

    // Type filter
    if (filterType !== 'all') {
      filtered = filtered.filter(log => log.type === filterType);
    }

    // Credit type sub-filter
    if (creditTypeFilter !== 'all') {
      filtered = filtered.filter(log => {
        if (log.type === 'document') return true;
        return log.credit_type === creditTypeFilter;
      });
    }

    // Search
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
  }, [logs, searchQuery, filterType, creditTypeFilter, dateRange]);

  // Credit summary stats from filtered data
  const creditStats = useMemo(() => {
    const creditLogs = filteredLogs.filter(l => 
      (l.type === 'credit' || l.type === 'paddle' || l.type === 'manual') && 
      l.transaction_type === 'add' && 
      (l.amount ?? 0) > 0
    );
    const aiCredits = creditLogs
      .filter(l => l.credit_type === 'full' || (!l.credit_type && l.type === 'manual'))
      .reduce((sum, l) => sum + (l.amount || 0), 0);
    const simCredits = creditLogs
      .filter(l => l.credit_type === 'similarity_only')
      .reduce((sum, l) => sum + (l.amount || 0), 0);
    return { aiCredits, simCredits, totalTransactions: filteredLogs.length };
  }, [filteredLogs]);

  const exportLogs = () => {
    const csv = [
      ['Date', 'Type', 'Credit Type', 'Action', 'User', 'Email', 'Details'].join(','),
      ...filteredLogs.map(log => [
        format(new Date(log.created_at), 'yyyy-MM-dd HH:mm:ss'),
        log.type,
        log.credit_type || '',
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
      case 'paddle': return <Wallet className="h-4 w-4" />;
      case 'manual': return <BarChart3 className="h-4 w-4" />;
      default: return <Activity className="h-4 w-4" />;
    }
  };

  const getTypeBadgeVariant = (type: string): "default" | "secondary" | "outline" | "destructive" => {
    switch (type) {
      case 'document': return 'default';
      case 'credit': return 'secondary';
      case 'paddle': return 'outline';
      case 'manual': return 'outline';
      default: return 'default';
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
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

        {/* Credit Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Zap className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">AI Credits Added</p>
                <p className="text-xl font-bold">{creditStats.aiCredits.toLocaleString()}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <FileText className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Similarity Credits Added</p>
                <p className="text-xl font-bold">{creditStats.simCredits.toLocaleString()}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-accent/10 flex items-center justify-center">
                <Activity className="h-5 w-5 text-accent-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Activities</p>
                <p className="text-xl font-bold">{creditStats.totalTransactions.toLocaleString()}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                <CreditCard className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Credits Added</p>
                <p className="text-xl font-bold">{(creditStats.aiCredits + creditStats.simCredits).toLocaleString()}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-4">
          <PeriodSelector value={dateRange} onChange={setDateRange} />
          <div className="flex flex-col sm:flex-row gap-3">
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
                <SelectItem value="credit">Credit Transaction</SelectItem>
                <SelectItem value="paddle">Paddle Payment</SelectItem>
                <SelectItem value="manual">Manual Payment</SelectItem>
              </SelectContent>
            </Select>
            <Select value={creditTypeFilter} onValueChange={setCreditTypeFilter}>
              <SelectTrigger className="w-[180px]">
                <Zap className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Credit type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Credit Types</SelectItem>
                <SelectItem value="full">AI Credits</SelectItem>
                <SelectItem value="similarity_only">Similarity Credits</SelectItem>
              </SelectContent>
            </Select>
          </div>
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
                      <TableHead className="w-[120px]">Type</TableHead>
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
                          <Badge variant={getTypeBadgeVariant(log.type)} className="gap-1">
                            {getTypeIcon(log.type)}
                            {log.type === 'paddle' ? 'Paddle' : log.type === 'manual' ? 'Manual' : log.type}
                          </Badge>
                          {log.credit_type && (
                            <div className="text-xs text-muted-foreground mt-1">
                              {log.credit_type === 'full' ? 'AI' : 'Similarity'}
                            </div>
                          )}
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
          Showing {filteredLogs.length.toLocaleString()} of {logs.length.toLocaleString()} activities
        </p>
      </div>
    </DashboardLayout>
  );
}
