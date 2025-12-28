import { useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useQuery } from '@tanstack/react-query';
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
  Coins
} from 'lucide-react';
import { toast } from 'sonner';

export default function AdminStripePayments() {
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch credit transactions that are purchases (from Stripe)
  const { data: transactions, isLoading, refetch } = useQuery({
    queryKey: ['stripe-transactions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('credit_transactions')
        .select(`
          *,
          profiles:user_id (email, full_name)
        `)
        .eq('transaction_type', 'purchase')
        .ilike('description', '%Stripe%')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      return data;
    },
  });

  // Fetch stats
  const { data: stats } = useQuery({
    queryKey: ['stripe-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('credit_transactions')
        .select('amount, created_at')
        .eq('transaction_type', 'purchase')
        .ilike('description', '%Stripe%');

      if (error) throw error;

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1);

      const totalCredits = data?.reduce((sum, t) => sum + t.amount, 0) || 0;
      const todayCredits = data?.filter(t => new Date(t.created_at) >= today).reduce((sum, t) => sum + t.amount, 0) || 0;
      const monthCredits = data?.filter(t => new Date(t.created_at) >= thisMonth).reduce((sum, t) => sum + t.amount, 0) || 0;

      return {
        totalTransactions: data?.length || 0,
        totalCredits,
        todayCredits,
        monthCredits,
      };
    },
  });

  const filteredTransactions = transactions?.filter(t => {
    const profile = t.profiles as any;
    const searchLower = searchTerm.toLowerCase();
    return (
      profile?.email?.toLowerCase().includes(searchLower) ||
      profile?.full_name?.toLowerCase().includes(searchLower) ||
      t.description?.toLowerCase().includes(searchLower)
    );
  });

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
        <div className="grid gap-4 md:grid-cols-4">
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
              <CardTitle className="text-sm font-medium">Total Credits Sold</CardTitle>
              <Coins className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalCredits?.toLocaleString() || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Today's Credits</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">+{stats?.todayCredits || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">This Month</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.monthCredits?.toLocaleString() || 0}</div>
            </CardContent>
          </Card>
        </div>

        {/* Transactions Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Payment History</CardTitle>
                <CardDescription>All Stripe credit purchases</CardDescription>
              </div>
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
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Credits</TableHead>
                    <TableHead>Balance After</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTransactions?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        No Stripe transactions found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredTransactions?.map((t) => {
                      const profile = t.profiles as any;
                      return (
                        <TableRow key={t.id}>
                          <TableCell className="font-medium">
                            {format(new Date(t.created_at), 'MMM dd, yyyy HH:mm')}
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">{profile?.full_name || 'Unknown'}</p>
                              <p className="text-xs text-muted-foreground">{profile?.email}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                              +{t.amount} credits
                            </Badge>
                          </TableCell>
                          <TableCell>{t.balance_after} credits</TableCell>
                          <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                            {t.description}
                          </TableCell>
                          <TableCell>
                            <Badge className="bg-green-500/10 text-green-600 border-green-200">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Completed
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
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
                  For detailed payment analytics, refunds, and customer management, visit your Stripe Dashboard directly.
                  All payment processing is handled securely by Stripe.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
