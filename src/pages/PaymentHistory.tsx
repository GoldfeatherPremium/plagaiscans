import React, { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Wallet, Clock, CheckCircle, XCircle, Loader2, CreditCard, ExternalLink } from 'lucide-react';
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

import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';
import { toast } from '@/hooks/use-toast';
import { Download } from 'lucide-react';

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
  currency?: string;
}

interface PaddlePayment {
  id: string;
  amount_usd: number;
  credits: number;
  status: string;
  transaction_id: string;
  receipt_url: string | null;
  created_at: string;
  completed_at: string | null;
  credit_type: string;
  currency?: string;
}

interface ReceiptData {
  id: string;
  receipt_number: string;
  transaction_id: string | null;
  payment_id: string | null;
}

export default function PaymentHistory() {
  const { t } = useTranslation('dashboard');
  const { user } = useAuth();
  const [manualPayments, setManualPayments] = useState<ManualPayment[]>([]);
  const [paddlePayments, setPaddlePayments] = useState<PaddlePayment[]>([]);
  const [receipts, setReceipts] = useState<ReceiptData[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    const fetchPayments = async () => {
      if (!user) return;

      const [manualRes, paddleRes, receiptsRes] = await Promise.all([
        supabase
          .from('manual_payments')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('paddle_payments')
          .select('id, amount_usd, credits, status, transaction_id, receipt_url, created_at, completed_at, credit_type, currency')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('receipts')
          .select('id, receipt_number, transaction_id, payment_id')
          .eq('user_id', user.id),
      ]);

      if (manualRes.data) setManualPayments(manualRes.data);
      if (paddleRes.data) setPaddlePayments(paddleRes.data as PaddlePayment[]);
      if (receiptsRes.data) setReceipts(receiptsRes.data as ReceiptData[]);
      setLoading(false);
    };

    fetchPayments();

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

      const paddleChannel = supabase
        .channel('paddle-payments-history')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'paddle_payments',
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            if (payload.eventType === 'UPDATE') {
              setPaddlePayments(prev =>
                prev.map(p => p.id === payload.new.id ? payload.new as PaddlePayment : p)
              );
            } else if (payload.eventType === 'INSERT') {
              setPaddlePayments(prev => [payload.new as PaddlePayment, ...prev]);
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(manualChannel);
        supabase.removeChannel(paddleChannel);
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
  const completedPaddleCount = paddlePayments.filter(p => p.status === 'completed').length;
  const verifiedManualCount = manualPayments.filter(p => p.status === 'verified').length;

  const findReceiptForPayment = (id: string, transactionId?: string | null) => {
    return receipts.find(r => r.payment_id === id || (transactionId && r.transaction_id === transactionId));
  };

  const handleDownloadReceipt = async (receiptId: string) => {
    setDownloadingId(receiptId);
    try {
      const { data, error } = await supabase.functions.invoke('generate-receipt-pdf', {
        body: { receiptId }
      });
      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Failed to generate receipt');
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(data.html);
        printWindow.document.close();
        printWindow.onload = () => printWindow.print();
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to download receipt';
      toast({ title: "Error", description: errorMessage, variant: "destructive" });
    } finally {
      setDownloadingId(null);
    }
  };

  const totalCreditsEarned =
    manualPayments
      .filter(p => p.status === 'verified')
      .reduce((sum, p) => sum + p.credits, 0) +
    paddlePayments
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
                  <p className="text-2xl font-bold">{verifiedManualCount + completedPaddleCount}</p>
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

        {/* All Transactions */}
        <Card>
          <CardHeader>
            <CardTitle>All Transactions</CardTitle>
            <CardDescription>Your complete payment history</CardDescription>
          </CardHeader>
          <CardContent>
            {manualPayments.length === 0 && paddlePayments.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Wallet className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No transactions yet</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead>Credits</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Receipt</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[
                      ...paddlePayments.map(p => ({
                        id: p.id,
                        source: 'Paddle' as const,
                        credits: p.credits,
                        amount_usd: p.amount_usd,
                        currency: p.currency,
                        status: p.status,
                        created_at: p.created_at,
                        transaction_id: p.transaction_id,
                        receipt_url: p.receipt_url,
                      })),
                      ...manualPayments.map(p => ({
                        id: p.id,
                        source: 'Binance' as const,
                        credits: p.credits,
                        amount_usd: p.amount_usd,
                        currency: p.currency,
                        status: p.status,
                        created_at: p.created_at,
                        transaction_id: p.transaction_id,
                        receipt_url: null as string | null,
                      })),
                    ]
                      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                      .map((payment) => (
                        <TableRow key={payment.id}>
                          <TableCell>
                            <div className="text-sm">
                              <div>{format(new Date(payment.created_at), 'MMM dd, yyyy')}</div>
                              <div className="text-muted-foreground">
                                {format(new Date(payment.created_at), 'HH:mm')}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={payment.source === 'Paddle' ? 'default' : 'secondary'}>
                              {payment.source === 'Paddle' ? (
                                <><CreditCard className="h-3 w-3 mr-1" /> Paddle</>
                              ) : (
                                <><Wallet className="h-3 w-3 mr-1" /> Binance</>
                              )}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-semibold text-green-600">+{payment.credits}</TableCell>
                          <TableCell>
                            {payment.currency && payment.currency !== 'USD' ? (
                              <div>{payment.amount_usd} {payment.currency}</div>
                            ) : (
                              `$${payment.amount_usd}`
                            )}
                          </TableCell>
                          <TableCell>{getStatusBadge(payment.status)}</TableCell>
                          <TableCell>
                            {(() => {
                              const receipt = findReceiptForPayment(payment.id, payment.transaction_id);
                              if (receipt) {
                                return (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDownloadReceipt(receipt.id)}
                                    disabled={downloadingId === receipt.id}
                                    className="gap-1"
                                  >
                                    {downloadingId === receipt.id ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <Download className="h-4 w-4" />
                                    )}
                                    Receipt
                                  </Button>
                                );
                              }
                              if (payment.receipt_url) {
                                return (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => window.open(payment.receipt_url!, '_blank')}
                                    className="gap-1"
                                  >
                                    <ExternalLink className="h-4 w-4" />
                                    View
                                  </Button>
                                );
                              }
                              return <span className="text-muted-foreground">-</span>;
                            })()}
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
