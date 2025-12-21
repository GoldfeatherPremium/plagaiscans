import React, { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Wallet, Clock, CheckCircle, XCircle, Loader2, CreditCard, Bitcoin, Globe } from 'lucide-react';
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

interface VivaPayment {
  id: string;
  order_code: string;
  amount_usd: number;
  credits: number;
  status: string;
  completed_at: string | null;
  created_at: string;
}

export default function PaymentHistory() {
  const { user } = useAuth();
  const [manualPayments, setManualPayments] = useState<ManualPayment[]>([]);
  const [cryptoPayments, setCryptoPayments] = useState<CryptoPayment[]>([]);
  const [vivaPayments, setVivaPayments] = useState<VivaPayment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPayments = async () => {
      if (!user) return;

      const [manualRes, cryptoRes, vivaRes] = await Promise.all([
        supabase
          .from('manual_payments')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('crypto_payments')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('viva_payments')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false }),
      ]);

      if (manualRes.data) setManualPayments(manualRes.data);
      if (cryptoRes.data) setCryptoPayments(cryptoRes.data);
      if (vivaRes.data) setVivaPayments(vivaRes.data);
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

      const vivaChannel = supabase
        .channel('viva-payments-history')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'viva_payments',
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            if (payload.eventType === 'UPDATE') {
              setVivaPayments(prev =>
                prev.map(p => p.id === payload.new.id ? payload.new as VivaPayment : p)
              );
            } else if (payload.eventType === 'INSERT') {
              setVivaPayments(prev => [payload.new as VivaPayment, ...prev]);
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(manualChannel);
        supabase.removeChannel(cryptoChannel);
        supabase.removeChannel(vivaChannel);
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
  const totalCreditsEarned = manualPayments
    .filter(p => p.status === 'verified')
    .reduce((sum, p) => sum + p.credits, 0) +
    cryptoPayments
      .filter(p => p.status === 'finished' || p.status === 'confirmed')
      .reduce((sum, p) => sum + p.credits, 0) +
    vivaPayments
      .filter(p => p.status === 'completed')
      .reduce((sum, p) => sum + p.credits, 0);

  const pendingVivaCount = vivaPayments.filter(p => p.status === 'pending').length;
  const totalPending = pendingManualCount + pendingVivaCount;

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
          <h1 className="text-3xl font-display font-bold">Payment History</h1>
          <p className="text-muted-foreground mt-1">
            Track all your payment transactions and their status
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
                  <p className="text-2xl font-bold">{totalPending}</p>
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
                  <p className="text-sm text-muted-foreground">Verified</p>
                  <p className="text-2xl font-bold">{verifiedManualCount}</p>
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
          <Tabs defaultValue="viva" className="w-full">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>All Transactions</CardTitle>
                  <CardDescription>View your payment history by method</CardDescription>
                </div>
                <TabsList>
                  <TabsTrigger value="viva" className="gap-2">
                    <Globe className="h-4 w-4" />
                    Card
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
                              {payment.pay_amount && payment.pay_currency
                                ? `${payment.pay_amount} ${payment.pay_currency}`
                                : '-'}
                            </TableCell>
                            <TableCell>{getStatusBadge(payment.status)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="viva" className="mt-0">
                {vivaPayments.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Globe className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No card transactions yet</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Credits</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead>Order Code</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Completed At</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {vivaPayments.map((payment) => (
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
                              <code className="text-xs bg-muted px-2 py-1 rounded">
                                {payment.order_code}
                              </code>
                            </TableCell>
                            <TableCell>{getStatusBadge(payment.status)}</TableCell>
                            <TableCell>
                              {payment.completed_at ? (
                                <div className="text-sm">
                                  <div>{format(new Date(payment.completed_at), 'MMM dd, yyyy')}</div>
                                  <div className="text-muted-foreground">
                                    {format(new Date(payment.completed_at), 'HH:mm')}
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
            </CardContent>
          </Tabs>
        </Card>
      </div>
    </DashboardLayout>
  );
}
