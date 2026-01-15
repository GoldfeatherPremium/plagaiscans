import React, { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Wallet, Clock, CheckCircle, XCircle, Loader2, CreditCard, Bitcoin, ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';

interface ManualPayment {
  id: string;
  payment_method: string;
  amount_usd: number;
  credits: number;
  status: string;
  transaction_id: string | null;
  notes: string | null;
  created_at: string;
  verified_at: string | null;
}

interface CryptoPayment {
  id: string;
  amount_usd: number;
  credits: number;
  status: string;
  pay_currency: string | null;
  pay_amount: number | null;
  created_at: string;
}

interface StripePayment {
  id: string;
  session_id: string;
  amount_usd: number;
  credits: number;
  status: string;
  receipt_url: string | null;
  created_at: string;
  completed_at: string | null;
}

export default function PaymentHistory() {
  const { t } = useTranslation('dashboard');
  const { user } = useAuth();
  const [manualPayments, setManualPayments] = useState<ManualPayment[]>([]);
  const [cryptoPayments, setCryptoPayments] = useState<CryptoPayment[]>([]);
  const [stripePayments, setStripePayments] = useState<StripePayment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPayments = async () => {
      if (!user) return;

      const [manualRes, cryptoRes, stripeRes] = await Promise.all([
        supabase
          .from('manual_payments')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(5000),
        supabase
          .from('crypto_payments')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(5000),
        supabase
          .from('stripe_payments')
          .select('id, session_id, amount_usd, credits, status, receipt_url, created_at, completed_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(5000),
      ]);

      if (manualRes.data) setManualPayments(manualRes.data);
      if (cryptoRes.data) setCryptoPayments(cryptoRes.data);
      if (stripeRes.data) setStripePayments(stripeRes.data as StripePayment[]);
      setLoading(false);
    };

    fetchPayments();

    // Real-time subscription
    if (user) {
      const manualChannel = supabase
        .channel('manual-payments-history')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'manual_payments',
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            if (payload.eventType === 'UPDATE') {
              setManualPayments(prev =>
                prev.map(p => p.id === payload.new.id ? payload.new as ManualPayment : p)
              );
            } else if (payload.eventType === 'INSERT') {
              setManualPayments(prev => [payload.new as ManualPayment, ...prev]);
            }
          }
        )
        .subscribe();

      const cryptoChannel = supabase
        .channel('crypto-payments-history')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'crypto_payments',
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            if (payload.eventType === 'UPDATE') {
              setCryptoPayments(prev =>
                prev.map(p => p.id === payload.new.id ? payload.new as CryptoPayment : p)
              );
            } else if (payload.eventType === 'INSERT') {
              setCryptoPayments(prev => [payload.new as CryptoPayment, ...prev]);
            }
          }
        )
        .subscribe();

      const stripeChannel = supabase
        .channel('stripe-payments-history')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'stripe_payments',
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            if (payload.eventType === 'UPDATE') {
              setStripePayments(prev =>
                prev.map(p => p.id === payload.new.id ? payload.new as StripePayment : p)
              );
            } else if (payload.eventType === 'INSERT') {
              setStripePayments(prev => [payload.new as StripePayment, ...prev]);
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(manualChannel);
        supabase.removeChannel(cryptoChannel);
        supabase.removeChannel(stripeChannel);
      };
    }
  }, [user]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
      case 'waiting':
        return (
          <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">
            <Clock className="h-3 w-3 mr-1" /> Pending
          </Badge>
        );
      case 'verified':
      case 'finished':
      case 'confirmed':
      case 'completed':
        return (
          <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20">
            <CheckCircle className="h-3 w-3 mr-1" /> Completed
          </Badge>
        );
      case 'rejected':
      case 'failed':
      case 'expired':
        return (
          <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/20">
            <XCircle className="h-3 w-3 mr-1" /> {status.charAt(0).toUpperCase() + status.slice(1)}
          </Badge>
        );
      case 'confirming':
        return (
          <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/20">
            <Loader2 className="h-3 w-3 mr-1 animate-spin" /> Confirming
          </Badge>
        );
      case 'refunded':
        return (
          <Badge variant="outline" className="bg-purple-500/10 text-purple-500 border-purple-500/20">
            <XCircle className="h-3 w-3 mr-1" /> Refunded
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const pendingManualCount = manualPayments.filter(p => p.status === 'pending').length;
  const verifiedManualCount = manualPayments.filter(p => p.status === 'verified').length;
  const completedStripeCount = stripePayments.filter(p => p.status === 'completed').length;
  
  const totalCreditsEarned = 
    manualPayments
      .filter(p => p.status === 'verified')
      .reduce((sum, p) => sum + p.credits, 0) +
    cryptoPayments
      .filter(p => p.status === 'finished' || p.status === 'confirmed')
      .reduce((sum, p) => sum + p.credits, 0) +
    stripePayments
      .filter(p => p.status === 'completed')
      .reduce((sum, p) => sum + p.credits, 0);

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
          <h1 className="text-3xl font-display font-bold">{t('payments.title')}</h1>
          <p className="text-muted-foreground mt-1">
            {t('payments.subtitle')}
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-lg bg-yellow-500/10 flex items-center justify-center">
                  <Clock className="h-6 w-6 text-yellow-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Pending</p>
                  <p className="text-2xl font-bold">{pendingManualCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-lg bg-green-500/10 flex items-center justify-center">
                  <CheckCircle className="h-6 w-6 text-green-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Completed</p>
                  <p className="text-2xl font-bold">{verifiedManualCount + completedStripeCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <CreditCard className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Credits Earned</p>
                  <p className="text-2xl font-bold">{totalCreditsEarned}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Payment Tabs */}
        <Card>
          <Tabs defaultValue="stripe" className="w-full">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>All Transactions</CardTitle>
                  <CardDescription>View your payment history by method</CardDescription>
                </div>
                <TabsList className="flex-wrap">
                  <TabsTrigger value="stripe" className="gap-2">
                    <CreditCard className="h-4 w-4" />
                    Stripe
                  </TabsTrigger>
                  <TabsTrigger value="binance" className="gap-2">
                    <Wallet className="h-4 w-4" />
                    Binance
                  </TabsTrigger>
                  <TabsTrigger value="crypto" className="gap-2">
                    <Bitcoin className="h-4 w-4" />
                    USDT
                  </TabsTrigger>
                </TabsList>
              </div>
            </CardHeader>
            <CardContent>
              {/* Stripe Payments Tab */}
              <TabsContent value="stripe" className="mt-0">
                {stripePayments.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <CreditCard className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No Stripe transactions yet</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Credits</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead>Session ID</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Receipt</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {stripePayments.map((payment) => (
                          <TableRow key={payment.id}>
                            <TableCell>
                              <div className="text-sm">
                                <div>{format(new Date(payment.created_at), 'MMM dd, yyyy')}</div>
                                <div className="text-muted-foreground">
                                  {format(new Date(payment.created_at), 'HH:mm')}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="font-semibold text-green-600">+{payment.credits}</TableCell>
                            <TableCell>${payment.amount_usd}</TableCell>
                            <TableCell>
                              <code className="text-xs bg-muted px-2 py-1 rounded">
                                {payment.session_id.substring(0, 20)}...
                              </code>
                            </TableCell>
                            <TableCell>{getStatusBadge(payment.status)}</TableCell>
                            <TableCell>
                              {payment.receipt_url ? (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => window.open(payment.receipt_url!, '_blank')}
                                  className="gap-1"
                                >
                                  <ExternalLink className="h-4 w-4" />
                                  View
                                </Button>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="binance" className="mt-0">
                {manualPayments.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Wallet className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No Binance Pay transactions yet</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Credits</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead>Order ID</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Verified At</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {manualPayments.map((payment) => (
                          <TableRow key={payment.id}>
                            <TableCell>
                              <div className="text-sm">
                                <div>{format(new Date(payment.created_at), 'MMM dd, yyyy')}</div>
                                <div className="text-muted-foreground">
                                  {format(new Date(payment.created_at), 'HH:mm')}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="font-semibold">{payment.credits}</TableCell>
                            <TableCell>${payment.amount_usd}</TableCell>
                            <TableCell>
                              {payment.transaction_id ? (
                                <code className="text-xs bg-muted px-2 py-1 rounded">
                                  {payment.transaction_id}
                                </code>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell>{getStatusBadge(payment.status)}</TableCell>
                            <TableCell>
                              {payment.verified_at ? (
                                <div className="text-sm">
                                  <div>{format(new Date(payment.verified_at), 'MMM dd, yyyy')}</div>
                                  <div className="text-muted-foreground">
                                    {format(new Date(payment.verified_at), 'HH:mm')}
                                  </div>
                                </div>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="crypto" className="mt-0">
                {cryptoPayments.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Bitcoin className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No USDT transactions yet</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Credits</TableHead>
                          <TableHead>Amount USD</TableHead>
                          <TableHead>Crypto Amount</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {cryptoPayments.map((payment) => (
                          <TableRow key={payment.id}>
                            <TableCell>
                              <div className="text-sm">
                                <div>{format(new Date(payment.created_at), 'MMM dd, yyyy')}</div>
                                <div className="text-muted-foreground">
                                  {format(new Date(payment.created_at), 'HH:mm')}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="font-semibold">{payment.credits}</TableCell>
                            <TableCell>${payment.amount_usd}</TableCell>
                            <TableCell>
                              {payment.pay_amount ? (
                                <span>{payment.pay_amount} {payment.pay_currency}</span>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell>{getStatusBadge(payment.status)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </TabsContent>
            </CardContent>
          </Tabs>
        </Card>
      </div>
    </DashboardLayout>
  );
}
