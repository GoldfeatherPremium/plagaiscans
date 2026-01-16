import React, { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Wallet, CheckCircle, XCircle, Clock } from 'lucide-react';
import { format } from 'date-fns';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';

interface ManualPayment {
  id: string;
  user_id: string;
  payment_method: string;
  amount_usd: number;
  credits: number;
  status: string;
  transaction_id: string | null;
  created_at: string;
  verified_at: string | null;
  notes: string | null;
  user_email?: string;
  user_name?: string;
}

export default function AdminManualPayments() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [payments, setPayments] = useState<ManualPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    fetchPayments();
  }, []);

  const fetchPayments = async () => {
    setLoading(true);
    
    const { data: paymentsData, error } = await supabase
      .from('manual_payments')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching payments:', error);
      setLoading(false);
      return;
    }

    // Fetch user profiles for the payments
    if (paymentsData && paymentsData.length > 0) {
      const userIds = [...new Set(paymentsData.map(p => p.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, email, full_name')
        .in('id', userIds);

      const enrichedPayments = paymentsData.map(payment => ({
        ...payment,
        user_email: profiles?.find(p => p.id === payment.user_id)?.email,
        user_name: profiles?.find(p => p.id === payment.user_id)?.full_name,
      }));

      setPayments(enrichedPayments);
    } else {
      setPayments([]);
    }
    
    setLoading(false);
  };

  const handleVerify = async (payment: ManualPayment) => {
    setProcessingId(payment.id);
    
    try {
      // Update payment status
      const { error: paymentError } = await supabase
        .from('manual_payments')
        .update({
          status: 'verified',
          verified_at: new Date().toISOString(),
          verified_by: user?.id,
        })
        .eq('id', payment.id);

      if (paymentError) throw paymentError;

      // Get current user balance
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('credit_balance')
        .eq('id', payment.user_id)
        .single();

      if (profileError) throw profileError;

      const currentBalance = profile?.credit_balance || 0;
      const newBalance = currentBalance + payment.credits;

      // Update user credits
      const { error: creditError } = await supabase
        .from('profiles')
        .update({ credit_balance: newBalance })
        .eq('id', payment.user_id);

      if (creditError) throw creditError;

      // Log the transaction
      await supabase.from('credit_transactions').insert({
        user_id: payment.user_id,
        transaction_type: 'purchase',
        amount: payment.credits,
        balance_before: currentBalance,
        balance_after: newBalance,
        description: `Binance Pay purchase - $${payment.amount_usd}`,
        performed_by: user?.id,
      });

      // Send email notification to user
      try {
        await supabase.functions.invoke('send-payment-verified-email', {
          body: {
            userId: payment.user_id,
            credits: payment.credits,
            amountUsd: payment.amount_usd,
            paymentMethod: payment.payment_method,
          },
        });
        console.log('Payment verified email sent');
      } catch (emailError) {
        console.error('Failed to send email:', emailError);
        // Don't fail the whole operation if email fails
      }

      toast({ title: 'Success', description: `Payment verified and ${payment.credits} credits added to user account` });
      fetchPayments();
    } catch (error: any) {
      console.error('Error verifying payment:', error);
      toast({ title: 'Error', description: 'Failed to verify payment', variant: 'destructive' });
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (payment: ManualPayment) => {
    setProcessingId(payment.id);
    
    try {
      const { error } = await supabase
        .from('manual_payments')
        .update({
          status: 'rejected',
          verified_at: new Date().toISOString(),
          verified_by: user?.id,
        })
        .eq('id', payment.id);

      if (error) throw error;

      toast({ title: 'Payment Rejected', description: 'Payment has been marked as rejected' });
      fetchPayments();
    } catch (error: any) {
      console.error('Error rejecting payment:', error);
      toast({ title: 'Error', description: 'Failed to reject payment', variant: 'destructive' });
    } finally {
      setProcessingId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20"><Clock className="h-3 w-3 mr-1" /> Pending</Badge>;
      case 'verified':
        return <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20"><CheckCircle className="h-3 w-3 mr-1" /> Verified</Badge>;
      case 'rejected':
        return <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/20"><XCircle className="h-3 w-3 mr-1" /> Rejected</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const pendingCount = payments.filter(p => p.status === 'pending').length;

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
            <Wallet className="h-8 w-8 text-[#F0B90B]" />
            Manual Payments
            {pendingCount > 0 && (
              <Badge className="bg-yellow-500 text-black">{pendingCount} Pending</Badge>
            )}
          </h1>
          <p className="text-muted-foreground mt-1">Verify Binance Pay and other manual payments</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Payment Requests</CardTitle>
            <CardDescription>Review and verify manual payment submissions</CardDescription>
          </CardHeader>
          <CardContent>
            {payments.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Wallet className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No manual payments yet</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Credits</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-center">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments.map((payment) => (
                      <TableRow key={payment.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{payment.user_name || 'Unknown'}</div>
                            <div className="text-sm text-muted-foreground">{payment.user_email}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Wallet className="h-4 w-4 text-[#F0B90B]" />
                            Binance Pay
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">${payment.amount_usd}</TableCell>
                        <TableCell>{payment.credits}</TableCell>
                        <TableCell>{getStatusBadge(payment.status)}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {format(new Date(payment.created_at), 'MMM dd, yyyy HH:mm')}
                        </TableCell>
                        <TableCell>
                          {payment.status === 'pending' && (
                            <div className="flex items-center justify-center gap-2">
                              <Button
                                size="sm"
                                variant="default"
                                className="bg-green-600 hover:bg-green-700"
                                onClick={() => handleVerify(payment)}
                                disabled={processingId === payment.id}
                              >
                                {processingId === payment.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <CheckCircle className="h-4 w-4" />
                                )}
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleReject(payment)}
                                disabled={processingId === payment.id}
                              >
                                <XCircle className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                          {payment.status !== 'pending' && (
                            <span className="text-xs text-muted-foreground">
                              {payment.verified_at && format(new Date(payment.verified_at), 'MMM dd, HH:mm')}
                            </span>
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
