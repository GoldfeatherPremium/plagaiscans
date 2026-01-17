import React, { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Globe, Loader2, Search, RefreshCw, DollarSign, CreditCard, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';

interface VivaPayment {
  id: string;
  user_id: string;
  order_code: string;
  transaction_id: string | null;
  amount_usd: number;
  credits: number;
  credit_type: string;
  status: string;
  customer_email: string | null;
  source_code: string | null;
  created_at: string;
  completed_at: string | null;
  user_email?: string;
  user_name?: string;
}

interface VivaWebhookLog {
  id: string;
  event_id: string;
  event_type_id: number | null;
  event_type: string | null;
  order_code: string | null;
  transaction_id: string | null;
  processed: boolean;
  processed_at: string | null;
  error_message: string | null;
  created_at: string;
}

interface Stats {
  totalPayments: number;
  totalRevenue: number;
  completedPayments: number;
  pendingPayments: number;
  todayPayments: number;
  todayRevenue: number;
}

export default function AdminVivaPayments() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState<VivaPayment[]>([]);
  const [webhookLogs, setWebhookLogs] = useState<VivaWebhookLog[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalPayments: 0,
    totalRevenue: 0,
    completedPayments: 0,
    pendingPayments: 0,
    todayPayments: 0,
    todayRevenue: 0,
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async () => {
    setRefreshing(true);
    try {
      // Fetch payments
      const { data: paymentsData, error: paymentsError } = await supabase
        .from('viva_payments')
        .select('*')
        .order('created_at', { ascending: false });

      if (paymentsError) throw paymentsError;

      // Fetch user details
      if (paymentsData && paymentsData.length > 0) {
        const userIds = [...new Set(paymentsData.map(p => p.user_id))];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, email, full_name')
          .in('id', userIds);

        const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

        const enrichedPayments = paymentsData.map(payment => ({
          ...payment,
          user_email: profileMap.get(payment.user_id)?.email || 'Unknown',
          user_name: profileMap.get(payment.user_id)?.full_name || '',
        }));

        setPayments(enrichedPayments);

        // Calculate stats
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const completed = paymentsData.filter(p => p.status === 'completed');
        const pending = paymentsData.filter(p => p.status === 'pending');
        const todayPayments = completed.filter(p => new Date(p.completed_at || p.created_at) >= today);

        setStats({
          totalPayments: paymentsData.length,
          totalRevenue: completed.reduce((sum, p) => sum + Number(p.amount_usd), 0),
          completedPayments: completed.length,
          pendingPayments: pending.length,
          todayPayments: todayPayments.length,
          todayRevenue: todayPayments.reduce((sum, p) => sum + Number(p.amount_usd), 0),
        });
      }

      // Fetch webhook logs
      const { data: logsData, error: logsError } = await supabase
        .from('viva_webhook_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (logsError) throw logsError;
      setWebhookLogs(logsData || []);

    } catch (error: any) {
      console.error('Error fetching data:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch Viva.com payments',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-500 hover:bg-green-600"><CheckCircle className="h-3 w-3 mr-1" />Completed</Badge>;
      case 'pending':
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      case 'failed':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Failed</Badge>;
      case 'expired':
        return <Badge variant="outline"><AlertCircle className="h-3 w-3 mr-1" />Expired</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const filteredPayments = payments.filter(payment => {
    const query = searchQuery.toLowerCase();
    return (
      payment.order_code.toLowerCase().includes(query) ||
      payment.user_email?.toLowerCase().includes(query) ||
      payment.customer_email?.toLowerCase().includes(query) ||
      payment.transaction_id?.toLowerCase().includes(query)
    );
  });

  if (loading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <Skeleton className="h-10 w-64" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
          <Skeleton className="h-96" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Globe className="h-8 w-8 text-[#1A1F71]" />
              Viva.com Payments
            </h1>
            <p className="text-muted-foreground">Manage Viva.com payment transactions</p>
          </div>
          <Button onClick={fetchData} disabled={refreshing} variant="outline">
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Revenue</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-green-500" />
                <span className="text-2xl font-bold">${stats.totalRevenue.toFixed(2)}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">{stats.completedPayments} completed payments</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Today's Revenue</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-blue-500" />
                <span className="text-2xl font-bold">${stats.todayRevenue.toFixed(2)}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">{stats.todayPayments} payments today</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Pending</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-amber-500" />
                <span className="text-2xl font-bold">{stats.pendingPayments}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Awaiting completion</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Transactions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-purple-500" />
                <span className="text-2xl font-bold">{stats.totalPayments}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">All time</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="payments">
          <TabsList>
            <TabsTrigger value="payments">Payments</TabsTrigger>
            <TabsTrigger value="webhooks">Webhook Logs</TabsTrigger>
          </TabsList>

          <TabsContent value="payments" className="mt-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>All Payments</CardTitle>
                    <CardDescription>View and manage Viva.com transactions</CardDescription>
                  </div>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search payments..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 w-64"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Order Code</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Credits</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredPayments.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                            No payments found
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredPayments.map((payment) => (
                          <TableRow key={payment.id}>
                            <TableCell className="font-mono text-sm">{payment.order_code}</TableCell>
                            <TableCell>
                              <div>
                                <p className="font-medium">{payment.user_name || 'Unknown'}</p>
                                <p className="text-xs text-muted-foreground">{payment.user_email}</p>
                              </div>
                            </TableCell>
                            <TableCell className="font-medium">${Number(payment.amount_usd).toFixed(2)}</TableCell>
                            <TableCell>
                              <Badge variant="outline">
                                {payment.credits} {payment.credit_type === 'similarity' ? 'Sim' : 'Full'}
                              </Badge>
                            </TableCell>
                            <TableCell>{getStatusBadge(payment.status)}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {format(new Date(payment.created_at), 'MMM d, yyyy HH:mm')}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="webhooks" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Webhook Logs</CardTitle>
                <CardDescription>Recent webhook events from Viva.com</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Event Type</TableHead>
                        <TableHead>Order Code</TableHead>
                        <TableHead>Transaction ID</TableHead>
                        <TableHead>Processed</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {webhookLogs.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                            No webhook logs found
                          </TableCell>
                        </TableRow>
                      ) : (
                        webhookLogs.map((log) => (
                          <TableRow key={log.id}>
                            <TableCell>
                              <Badge variant="outline">
                                {log.event_type || `Event ${log.event_type_id}`}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-mono text-sm">{log.order_code || '-'}</TableCell>
                            <TableCell className="font-mono text-sm">{log.transaction_id || '-'}</TableCell>
                            <TableCell>
                              {log.processed ? (
                                <Badge className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" />Yes</Badge>
                              ) : (
                                <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pending</Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {format(new Date(log.created_at), 'MMM d, yyyy HH:mm:ss')}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
