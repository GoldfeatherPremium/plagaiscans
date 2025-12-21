import React, { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { Loader2, Globe, DollarSign, CheckCircle, Clock, CreditCard } from 'lucide-react';

interface VivaPayment {
  id: string;
  user_id: string;
  order_code: string;
  amount_usd: number;
  credits: number;
  status: string;
  transaction_id: string | null;
  merchant_trns: string | null;
  completed_at: string | null;
  created_at: string;
  user_email?: string;
  user_name?: string;
}

export default function AdminVivaPayments() {
  const [payments, setPayments] = useState<VivaPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total: 0,
    completed: 0,
    pending: 0,
    totalUsd: 0,
    totalCredits: 0,
  });

  useEffect(() => {
    fetchPayments();
    
    // Set up realtime subscription
    const channel = supabase
      .channel('viva-payments-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'viva_payments' }, () => {
        fetchPayments();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchPayments = async () => {
    const { data, error } = await supabase
      .from('viva_payments')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching Viva payments:', error);
      setLoading(false);
      return;
    }

    // Fetch user emails
    const userIds = [...new Set(data?.map(p => p.user_id) || [])];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, email, full_name')
      .in('id', userIds);

    const enrichedPayments = (data || []).map(payment => {
      const profile = profiles?.find(p => p.id === payment.user_id);
      return {
        ...payment,
        user_email: profile?.email || 'Unknown',
        user_name: profile?.full_name || '',
      };
    });

    setPayments(enrichedPayments);

    // Calculate stats
    const completed = enrichedPayments.filter(p => p.status === 'completed');
    const pending = enrichedPayments.filter(p => p.status === 'pending');
    
    setStats({
      total: enrichedPayments.length,
      completed: completed.length,
      pending: pending.length,
      totalUsd: completed.reduce((sum, p) => sum + Number(p.amount_usd), 0),
      totalCredits: completed.reduce((sum, p) => sum + p.credits, 0),
    });

    setLoading(false);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-secondary text-secondary-foreground">Completed</Badge>;
      case 'pending':
        return <Badge variant="outline" className="text-amber-600 border-amber-600">Pending</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      case 'expired':
        return <Badge variant="secondary">Expired</Badge>;
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
        <div>
          <h1 className="text-3xl font-display font-bold flex items-center gap-3">
            <Globe className="h-8 w-8 text-[#1A1F71]" />
            Viva.com Payments
          </h1>
          <p className="text-muted-foreground mt-1">Monitor all card payments processed via Viva.com</p>
        </div>

        {/* Stats Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                  <CreditCard className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.total}</p>
                  <p className="text-xs text-muted-foreground">Total Payments</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-secondary/10 flex items-center justify-center">
                  <CheckCircle className="h-5 w-5 text-secondary" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-secondary">{stats.completed}</p>
                  <p className="text-xs text-muted-foreground">Completed</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                  <Clock className="h-5 w-5 text-amber-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-amber-500">{stats.pending}</p>
                  <p className="text-xs text-muted-foreground">Pending</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <DollarSign className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-primary">${stats.totalUsd.toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground">Total Revenue</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-[#1A1F71]/10 flex items-center justify-center">
                  <Globe className="h-5 w-5 text-[#1A1F71]" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.totalCredits}</p>
                  <p className="text-xs text-muted-foreground">Credits Sold</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Payments Table */}
        <Card>
          <CardHeader>
            <CardTitle>All Viva.com Payments</CardTitle>
            <CardDescription>Card payment transactions processed through Viva.com checkout</CardDescription>
          </CardHeader>
          <CardContent>
            {payments.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Globe className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No Viva.com payments yet</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead className="text-right">Credits</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Order Code</TableHead>
                      <TableHead>Transaction ID</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments.map((payment) => (
                      <TableRow key={payment.id}>
                        <TableCell className="whitespace-nowrap">
                          {format(new Date(payment.created_at), 'MMM d, yyyy HH:mm')}
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{payment.user_name || 'No name'}</p>
                            <p className="text-xs text-muted-foreground">{payment.user_email}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-medium">{payment.credits}</TableCell>
                        <TableCell className="text-right font-medium">${Number(payment.amount_usd).toFixed(2)}</TableCell>
                        <TableCell>{getStatusBadge(payment.status)}</TableCell>
                        <TableCell>
                          <code className="text-xs bg-muted px-2 py-1 rounded">{payment.order_code}</code>
                        </TableCell>
                        <TableCell>
                          {payment.transaction_id ? (
                            <code className="text-xs bg-muted px-2 py-1 rounded">{payment.transaction_id}</code>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
