import { useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { 
  CreditCard, 
  Search, 
  RefreshCw, 
  DollarSign, 
  TrendingUp,
  CheckCircle,
  Clock,
  XCircle,
  ExternalLink,
  Coins,
  RotateCcw,
  AlertTriangle,
  Filter
} from 'lucide-react';
import { toast } from 'sonner';

interface RefundDialogProps {
  payment: any;
  onClose: () => void;
}

function RefundDialog({ payment, onClose }: RefundDialogProps) {
  const [amount, setAmount] = useState(payment.amount_usd.toString());
  const [reason, setReason] = useState('requested_by_customer');
  const [isProcessing, setIsProcessing] = useState(false);
  const queryClient = useQueryClient();

  const maxAmount = payment.amount_usd;
  const isPartial = parseFloat(amount) < maxAmount;
  const creditsToDeduct = Math.ceil(payment.credits * (parseFloat(amount) / maxAmount));

  const handleRefund = async () => {
    setIsProcessing(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) throw new Error('Not authenticated');

      const response = await supabase.functions.invoke('process-stripe-refund', {
        body: {
          paymentIntentId: payment.payment_intent_id,
          amount: Math.round(parseFloat(amount) * 100), // Convert to cents
          reason,
        },
        headers: {
          Authorization: `Bearer ${session.session.access_token}`,
        },
      });

      if (response.error) throw new Error(response.error.message);

      toast.success(`Refund of $${amount} processed successfully`);
      queryClient.invalidateQueries({ queryKey: ['stripe-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['stripe-stats'] });
      onClose();
    } catch (error: any) {
      toast.error(error.message || 'Failed to process refund');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Process Refund</DialogTitle>
        <DialogDescription>
          Refund payment for {payment.profiles?.full_name || payment.profiles?.email}
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4 py-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Original Amount:</span>
            <span className="ml-2 font-medium">${payment.amount_usd}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Credits Purchased:</span>
            <span className="ml-2 font-medium">{payment.credits}</span>
          </div>
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="amount">Refund Amount ($)</Label>
          <Input
            id="amount"
            type="number"
            min="0.01"
            max={maxAmount}
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          {isPartial && (
            <p className="text-xs text-muted-foreground">Partial refund</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="reason">Reason</Label>
          <Select value={reason} onValueChange={setReason}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="requested_by_customer">Customer Request</SelectItem>
              <SelectItem value="duplicate">Duplicate Payment</SelectItem>
              <SelectItem value="fraudulent">Fraudulent</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Card className="bg-yellow-50 border-yellow-200 dark:bg-yellow-950/20">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-yellow-800 dark:text-yellow-200">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-sm font-medium">
                {creditsToDeduct} credits will be deducted from user's account
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button 
          onClick={handleRefund} 
          disabled={isProcessing || parseFloat(amount) <= 0 || parseFloat(amount) > maxAmount}
          className="bg-red-600 hover:bg-red-700"
        >
          {isProcessing ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <RotateCcw className="h-4 w-4 mr-2" />
              Process Refund
            </>
          )}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

export default function AdminStripePayments() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedPayment, setSelectedPayment] = useState<any>(null);

  const { data: transactions, isLoading, refetch } = useQuery({
    queryKey: ['stripe-transactions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stripe_payments')
        .select(`
          *,
          profiles:user_id (email, full_name)
        `)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      return data;
    },
  });

  const { data: stats } = useQuery({
    queryKey: ['stripe-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stripe_payments')
        .select('amount_usd, credits, status, created_at');

      if (error) throw error;

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1);

      const completed = data?.filter(t => t.status === 'completed') || [];
      const refunded = data?.filter(t => t.status === 'refunded' || t.status === 'partially_refunded') || [];

      const totalRevenue = completed.reduce((sum, t) => sum + t.amount_usd, 0);
      const totalCredits = completed.reduce((sum, t) => sum + t.credits, 0);
      const todayRevenue = completed
        .filter(t => new Date(t.created_at) >= today)
        .reduce((sum, t) => sum + t.amount_usd, 0);
      const monthRevenue = completed
        .filter(t => new Date(t.created_at) >= thisMonth)
        .reduce((sum, t) => sum + t.amount_usd, 0);

      return {
        totalTransactions: data?.length || 0,
        totalRevenue,
        totalCredits,
        todayRevenue,
        monthRevenue,
        refundedCount: refunded.length,
      };
    },
  });

  const filteredTransactions = transactions?.filter(t => {
    const profile = t.profiles as any;
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = (
      profile?.email?.toLowerCase().includes(searchLower) ||
      profile?.full_name?.toLowerCase().includes(searchLower) ||
      t.session_id?.toLowerCase().includes(searchLower)
    );
    const matchesStatus = statusFilter === 'all' || t.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return (
          <Badge className="bg-green-500/10 text-green-600 border-green-200">
            <CheckCircle className="h-3 w-3 mr-1" />
            Completed
          </Badge>
        );
      case 'pending':
        return (
          <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-200">
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        );
      case 'refunded':
        return (
          <Badge className="bg-purple-500/10 text-purple-600 border-purple-200">
            <RotateCcw className="h-3 w-3 mr-1" />
            Refunded
          </Badge>
        );
      case 'partially_refunded':
        return (
          <Badge className="bg-orange-500/10 text-orange-600 border-orange-200">
            <RotateCcw className="h-3 w-3 mr-1" />
            Partial Refund
          </Badge>
        );
      case 'failed':
        return (
          <Badge className="bg-red-500/10 text-red-600 border-red-200">
            <XCircle className="h-3 w-3 mr-1" />
            Failed
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-display font-bold flex items-center gap-3">
              <CreditCard className="h-8 w-8 text-primary" />
              Stripe Payments
            </h1>
            <p className="text-muted-foreground mt-1">
              View and manage Stripe payment transactions
            </p>
          </div>
          <Button onClick={() => refetch()} variant="outline" className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-5">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Transactions</CardTitle>
              <CreditCard className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalTransactions || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${stats?.totalRevenue?.toFixed(2) || '0.00'}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Credits Sold</CardTitle>
              <Coins className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalCredits?.toLocaleString() || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Today</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">+${stats?.todayRevenue?.toFixed(2) || '0.00'}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Refunds</CardTitle>
              <RotateCcw className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.refundedCount || 0}</div>
            </CardContent>
          </Card>
        </div>

        {/* Transactions Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <CardTitle>Payment History</CardTitle>
                <CardDescription>All Stripe transactions with refund capability</CardDescription>
              </div>
              <div className="flex items-center gap-4">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[150px]">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Filter" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="refunded">Refunded</SelectItem>
                    <SelectItem value="partially_refunded">Partial Refund</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                  </SelectContent>
                </Select>
                <div className="relative w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by email or name..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Credits</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Receipt</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTransactions?.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                          No transactions found
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredTransactions?.map((t) => {
                        const profile = t.profiles as any;
                        return (
                          <TableRow key={t.id}>
                            <TableCell className="font-medium whitespace-nowrap">
                              {format(new Date(t.created_at), 'MMM dd, yyyy HH:mm')}
                            </TableCell>
                            <TableCell>
                              <div className="min-w-[120px]">
                                <p className="font-medium">{profile?.full_name || 'Unknown'}</p>
                                <p className="text-xs text-muted-foreground">{profile?.email}</p>
                              </div>
                            </TableCell>
                            <TableCell className="font-semibold whitespace-nowrap">${t.amount_usd?.toFixed(2)}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 whitespace-nowrap">
                                +{t.credits} credits
                              </Badge>
                            </TableCell>
                            <TableCell>{getStatusBadge(t.status)}</TableCell>
                            <TableCell>
                              {t.receipt_url ? (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => window.open(t.receipt_url, '_blank')}
                                  className="gap-1"
                                >
                                  <ExternalLink className="h-4 w-4" />
                                  View
                                </Button>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              {t.status === 'completed' && t.payment_intent_id && (
                                <Dialog>
                                  <DialogTrigger asChild>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => setSelectedPayment(t)}
                                      className="gap-1"
                                    >
                                      <RotateCcw className="h-4 w-4" />
                                      Refund
                                    </Button>
                                  </DialogTrigger>
                                  {selectedPayment?.id === t.id && (
                                    <RefundDialog 
                                      payment={selectedPayment} 
                                      onClose={() => setSelectedPayment(null)} 
                                    />
                                  )}
                                </Dialog>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Info Card */}
        <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/20">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-full bg-blue-100 dark:bg-blue-900/50">
                <ExternalLink className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold text-blue-900 dark:text-blue-100">Stripe Dashboard</h3>
                <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                  For detailed payment analytics, dispute management, and advanced customer operations, visit your Stripe Dashboard directly.
                  Refunds processed here are automatically synced with Stripe.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
