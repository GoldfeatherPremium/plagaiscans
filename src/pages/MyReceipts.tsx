import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Receipt, Download, Loader2, Calendar, DollarSign, CreditCard, CheckCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { toast } from '@/hooks/use-toast';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface ReceiptData {
  id: string;
  receipt_number: string;
  amount_paid: number;
  credits: number;
  currency: string;
  payment_method: string;
  description: string | null;
  customer_name: string | null;
  receipt_date: string;
  created_at: string;
}

export default function MyReceipts() {
  const { t } = useTranslation('dashboard');
  const { user } = useAuth();
  const [receipts, setReceipts] = useState<ReceiptData[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    const fetchReceipts = async () => {
      if (!user) return;

      const { data, error } = await supabase
        .from('receipts')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching receipts:', error);
        toast({
          title: "Error",
          description: "Failed to load receipts",
          variant: "destructive"
        });
      } else {
        setReceipts(data || []);
      }
      setLoading(false);
    };

    fetchReceipts();
  }, [user]);

  const handleDownloadReceipt = async (receipt: ReceiptData) => {
    setDownloadingId(receipt.id);
    try {
      const { data, error } = await supabase.functions.invoke('generate-receipt-pdf', {
        body: { receiptId: receipt.id }
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Failed to generate receipt');

      // Create a new window with the HTML content and trigger print
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(data.html);
        printWindow.document.close();
        
        // Wait for content to load then trigger print
        printWindow.onload = () => {
          printWindow.print();
        };
      }

      toast({
        title: "Success",
        description: "Receipt opened for printing/download"
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to download receipt';
      console.error('Error downloading receipt:', error);
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setDownloadingId(null);
    }
  };

  const getPaymentMethodIcon = (method: string) => {
    switch (method.toLowerCase()) {
      case 'stripe':
      case 'card':
        return <CreditCard className="h-4 w-4" />;
      case 'crypto':
      case 'usdt':
        return <DollarSign className="h-4 w-4" />;
      default:
        return <Receipt className="h-4 w-4" />;
    }
  };

  const getCurrencySymbol = (currency: string) => {
    const symbols: Record<string, string> = {
      USD: '$', GBP: '£', EUR: '€', AED: 'د.إ', INR: '₹',
      CAD: 'C$', AUD: 'A$', SGD: 'S$', CHF: 'Fr', JPY: '¥', CNY: '¥'
    };
    return symbols[currency?.toUpperCase()] || '$';
  };

  const totalAmount = receipts.reduce((sum, r) => sum + Number(r.amount_paid), 0);
  const totalCredits = receipts.reduce((sum, r) => sum + r.credits, 0);

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
          <h1 className="text-3xl font-display font-bold">{t('receipts.title')}</h1>
          <p className="text-muted-foreground mt-1">
            {t('receipts.subtitle')}
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Receipt className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t('receipts.totalReceipts')}</p>
                  <p className="text-2xl font-bold">{receipts.length}</p>
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
                  <p className="text-sm text-muted-foreground">{t('receipts.totalPaid')}</p>
                  <p className="text-2xl font-bold">${totalAmount.toFixed(2)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <CreditCard className="h-6 w-6 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t('receipts.totalCredits')}</p>
                  <p className="text-2xl font-bold">{totalCredits}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Receipts Table */}
        <Card>
          <CardHeader>
            <CardTitle>{t('receipts.allReceipts')}</CardTitle>
            <CardDescription>{t('receipts.completeHistory')}</CardDescription>
          </CardHeader>
          <CardContent>
            {receipts.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Receipt className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>{t('receipts.noReceipts')}</p>
                <p className="text-sm">{t('receipts.noReceiptsDesc')}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('receipts.receiptNumber')}</TableHead>
                      <TableHead>{t('receipts.date')}</TableHead>
                      <TableHead>{t('receipts.description')}</TableHead>
                      <TableHead>{t('receipts.paymentMethod')}</TableHead>
                      <TableHead>{t('receipts.credits')}</TableHead>
                      <TableHead>{t('receipts.amount')}</TableHead>
                      <TableHead>{t('receipts.actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {receipts.map((receipt) => (
                      <TableRow key={receipt.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getPaymentMethodIcon(receipt.payment_method)}
                            <code className="text-sm font-medium">{receipt.receipt_number}</code>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 text-sm">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            {format(new Date(receipt.receipt_date), 'MMM dd, yyyy')}
                          </div>
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate">
                          {receipt.description || `${receipt.credits} Credits`}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {receipt.payment_method}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-semibold text-green-600">
                          +{receipt.credits}
                        </TableCell>
                        <TableCell className="font-medium">
                          {getCurrencySymbol(receipt.currency)}{Number(receipt.amount_paid).toFixed(2)} {receipt.currency}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDownloadReceipt(receipt)}
                            disabled={downloadingId === receipt.id}
                            className="gap-1"
                          >
                            {downloadingId === receipt.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Download className="h-4 w-4" />
                            )}
                            PDF
                          </Button>
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
