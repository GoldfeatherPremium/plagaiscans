import React, { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Bitcoin, DollarSign, Clock, CheckCircle, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface CryptoPayment {
  id: string;
  user_id: string;
  payment_id: string;
  order_id: string | null;
  credits: number;
  amount_usd: number;
  pay_amount: number | null;
  pay_currency: string | null;
  pay_address: string | null;
  status: string;
  created_at: string;
  user_email?: string;
}

export default function AdminCryptoPayments() {
  const [payments, setPayments] = useState<CryptoPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [expiring, setExpiring] = useState(false);
  const [stats, setStats] = useState({
    total: 0,
    completed: 0,
    pending: 0,
    totalUsd: 0,
  });

  useEffect(() => {
    fetchPayments();
  }, []);

  const fetchPayments = async () => {
    const { data: paymentsData, error } = await supabase
      .from('crypto_payments')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching payments:', error);
      setLoading(false);
      return;
    }

    // Fetch user emails
    const userIds = [...new Set(paymentsData?.map(p => p.user_id) || [])];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, email')
      .in('id', userIds);

    const profileMap = new Map(profiles?.map(p => [p.id, p.email]) || []);

    const enrichedPayments = paymentsData?.map(p => ({
      ...p,
      user_email: profileMap.get(p.user_id) || 'Unknown',
    })) || [];

    setPayments(enrichedPayments);

    // Calculate stats
    const completed = enrichedPayments.filter(p => p.status === 'finished');
    setStats({
      total: enrichedPayments.length,
      completed: completed.length,
      pending: enrichedPayments.filter(p => ['waiting', 'confirming'].includes(p.status)).length,
      totalUsd: completed.reduce((sum, p) => sum + Number(p.amount_usd), 0),
    });

    setLoading(false);
  };

  const runExpirationCheck = async () => {
    setExpiring(true);
    try {
      const { data, error } = await supabase.functions.invoke('expire-crypto-payments');
      
      if (error) throw error;
      
      if (data.expiredCount > 0) {
        toast.success(`Expired ${data.expiredCount} payment(s)`);
        fetchPayments();
      } else {
        toast.info('No payments to expire');
      }
    } catch (error) {
      console.error('Error running expiration check:', error);
      toast.error('Failed to run expiration check');
    } finally {
      setExpiring(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'finished':
        return <Badge className="bg-green-500">Completed</Badge>;
      case 'confirming':
        return <Badge className="bg-blue-500">Confirming</Badge>;
      case 'waiting':
        return <Badge variant="secondary">Waiting</Badge>;
      case 'expired':
        return <Badge variant="destructive">Expired</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-display font-bold">Crypto Payments</h1>
            <p className="text-muted-foreground mt-1">
              Monitor USDT payments via NOWPayments
            </p>
          </div>
          <Button 
            onClick={runExpirationCheck} 
            disabled={expiring}
            variant="outline"
          >
            {expiring ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Run Expiration Check
          </Button>
        </div>

        {/* Stats */}
        <div className="grid sm:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Bitcoin className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Payments</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                <CheckCircle className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Completed</p>
                <p className="text-2xl font-bold">{stats.completed}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="h-10 w-10 rounded-lg bg-yellow-500/10 flex items-center justify-center">
                <Clock className="h-5 w-5 text-yellow-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pending</p>
                <p className="text-2xl font-bold">{stats.pending}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="h-10 w-10 rounded-lg bg-secondary/10 flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-secondary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Revenue</p>
                <p className="text-2xl font-bold">${stats.totalUsd.toFixed(2)}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Payments Table */}
        <Card>
          <CardHeader>
            <CardTitle>Payment History</CardTitle>
            <CardDescription>All USDT payment transactions</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Credits</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>USDT</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Payment ID</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      No crypto payments yet
                    </TableCell>
                  </TableRow>
                ) : (
                  payments.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell className="text-sm">
                        {format(new Date(payment.created_at), 'MMM dd, yyyy HH:mm')}
                      </TableCell>
                      <TableCell className="text-sm">{payment.user_email}</TableCell>
                      <TableCell className="font-medium">{payment.credits}</TableCell>
                      <TableCell>${payment.amount_usd}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {payment.pay_amount} {payment.pay_currency?.toUpperCase()}
                      </TableCell>
                      <TableCell>{getStatusBadge(payment.status)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground font-mono">
                        {payment.payment_id.slice(0, 12)}...
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
