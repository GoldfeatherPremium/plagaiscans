import React, { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { Loader2, Globe, DollarSign, CheckCircle, Clock, CreditCard, RefreshCcw, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

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
  const { user } = useAuth();
  const [payments, setPayments] = useState<VivaPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ id: string; action: 'complete' | 'refund' } | null>(null);
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

  const handleMarkCompleted = async (payment: VivaPayment) => {
    setProcessingId(payment.id);
    try {
      // Update payment status
      const { error: updateError } = await supabase
        .from('viva_payments')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', payment.id);

      if (updateError) throw updateError;

      // Add credits to user's balance
      const { data: profile } = await supabase
        .from('profiles')
        .select('credit_balance')
        .eq('id', payment.user_id)
        .single();

      const currentBalance = profile?.credit_balance || 0;
      const newBalance = currentBalance + payment.credits;

      await supabase
        .from('profiles')
        .update({ credit_balance: newBalance })
        .eq('id', payment.user_id);

      // Log the transaction
      await supabase.from('credit_transactions').insert({
        user_id: payment.user_id,
        amount: payment.credits,
        balance_before: currentBalance,
        balance_after: newBalance,
        transaction_type: 'purchase',
        description: `Manual Viva.com verification - ${payment.credits} credits`,
        performed_by: user?.id,
      });

      // Send notification
      await supabase.from('user_notifications').insert({
        user_id: payment.user_id,
        title: '✅ Payment Verified',
        message: `Your Viva.com payment of $${payment.amount_usd} has been verified. ${payment.credits} credits have been added to your account.`,
        created_by: user?.id,
      });

      toast.success('Payment marked as completed and credits added');
      setConfirmAction(null);
      fetchPayments();
    } catch (error: any) {
      console.error('Error completing payment:', error);
      toast.error('Failed to complete payment');
    } finally {
      setProcessingId(null);
    }
  };

  const handleMarkRefunded = async (payment: VivaPayment) => {
    setProcessingId(payment.id);
    try {
      // If already completed, deduct credits
      if (payment.status === 'completed') {
        const { data: profile } = await supabase
          .from('profiles')
          .select('credit_balance')
          .eq('id', payment.user_id)
          .single();

        const currentBalance = profile?.credit_balance || 0;
        const newBalance = Math.max(0, currentBalance - payment.credits);

        await supabase
          .from('profiles')
          .update({ credit_balance: newBalance })
          .eq('id', payment.user_id);

        // Log the transaction
        await supabase.from('credit_transactions').insert({
          user_id: payment.user_id,
          amount: -payment.credits,
          balance_before: currentBalance,
          balance_after: newBalance,
          transaction_type: 'refund',
          description: `Viva.com refund - ${payment.credits} credits`,
          performed_by: user?.id,
        });
      }

      // Update payment status
      await supabase
        .from('viva_payments')
        .update({ status: 'refunded' })
        .eq('id', payment.id);

      // Send notification
      await supabase.from('user_notifications').insert({
        user_id: payment.user_id,
        title: '💸 Payment Refunded',
        message: `Your Viva.com payment of $${payment.amount_usd} has been refunded.`,
        created_by: user?.id,
      });

      toast.success('Payment marked as refunded');
      setConfirmAction(null);
      fetchPayments();
    } catch (error: any) {
      console.error('Error refunding payment:', error);
      toast.error('Failed to refund payment');
    } finally {
      setProcessingId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-secondary text-secondary-foreground">Completed</Badge>;
      case 'pending':
        return <Badge variant="outline" className="text-amber-600 border-amber-600">Pending</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      case 'refunded':
        return <Badge variant="outline" className="text-purple-600 border-purple-600">Refunded</Badge>;
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
                      <TableHead>Actions</TableHead>
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
                          <div className="flex gap-2">
                            {payment.status === 'pending' && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-secondary border-secondary hover:bg-secondary/10"
                                onClick={() => setConfirmAction({ id: payment.id, action: 'complete' })}
                                disabled={processingId === payment.id}
                              >
                                {processingId === payment.id ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                )}
                                Complete
                              </Button>
                            )}
                            {(payment.status === 'pending' || payment.status === 'completed') && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-destructive border-destructive hover:bg-destructive/10"
                                onClick={() => setConfirmAction({ id: payment.id, action: 'refund' })}
                                disabled={processingId === payment.id}
                              >
                                {processingId === payment.id ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <RefreshCcw className="h-3 w-3 mr-1" />
                                )}
                                Refund
                              </Button>
                            )}
                            {payment.status !== 'pending' && payment.status !== 'completed' && (
                              <span className="text-muted-foreground text-xs">—</span>
                            )}
                          </div>
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

      {/* Confirmation Dialog */}
      <AlertDialog open={!!confirmAction} onOpenChange={() => setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction?.action === 'complete' ? 'Complete Payment?' : 'Refund Payment?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction?.action === 'complete' 
                ? 'This will add credits to the user\'s account and mark the payment as completed.'
                : 'This will mark the payment as refunded. If already completed, credits will be deducted from the user\'s account.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={!!processingId}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const payment = payments.find(p => p.id === confirmAction?.id);
                if (payment) {
                  if (confirmAction?.action === 'complete') {
                    handleMarkCompleted(payment);
                  } else {
                    handleMarkRefunded(payment);
                  }
                }
              }}
              disabled={!!processingId}
              className={confirmAction?.action === 'refund' ? 'bg-destructive hover:bg-destructive/90' : ''}
            >
              {processingId ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {confirmAction?.action === 'complete' ? 'Complete' : 'Refund'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
