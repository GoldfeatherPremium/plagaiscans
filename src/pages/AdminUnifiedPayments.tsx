import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import { Search, Download, RefreshCw, CreditCard, Wallet, DollarSign, TrendingUp } from 'lucide-react';

interface UnifiedPayment {
  id: string;
  type: 'stripe' | 'crypto' | 'manual' | 'dodo' | 'paddle';
  user_id: string;
  user_email?: string;
  user_name?: string;
  amount_usd: number;
  currency?: string;
  credits: number;
  status: string;
  created_at: string;
  completed_at?: string | null;
  reference?: string;
}

const AdminUnifiedPayments: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Fetch Stripe payments
  const { data: stripePayments } = useQuery({
    queryKey: ['stripe-payments-admin'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stripe_payments')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Fetch Crypto payments
  const { data: cryptoPayments } = useQuery({
    queryKey: ['crypto-payments-admin'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crypto_payments')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Fetch Manual payments
  const { data: manualPayments } = useQuery({
    queryKey: ['manual-payments-admin'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('manual_payments')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Fetch Dodo payments
  const { data: dodoPayments } = useQuery({
    queryKey: ['dodo-payments-admin'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dodo_payments')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Fetch Paddle payments
  const { data: paddlePayments } = useQuery({
    queryKey: ['paddle-payments-admin'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('paddle_payments')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Fetch user profiles for enrichment
  const { data: profiles } = useQuery({
    queryKey: ['profiles-admin'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, full_name');
      if (error) throw error;
      return data;
    },
  });

  const profileMap = useMemo(() => {
    const map: Record<string, { email: string; name: string }> = {};
    profiles?.forEach(p => {
      map[p.id] = { email: p.email, name: p.full_name || '' };
    });
    return map;
  }, [profiles]);

  // Combine all payments
  const unifiedPayments = useMemo((): UnifiedPayment[] => {
    const payments: UnifiedPayment[] = [];

    stripePayments?.forEach(p => {
      payments.push({
        id: p.id,
        type: 'stripe',
        user_id: p.user_id,
        user_email: p.customer_email || profileMap[p.user_id]?.email,
        user_name: profileMap[p.user_id]?.name,
        amount_usd: Number(p.amount_usd),
        currency: p.currency || 'USD',
        credits: p.credits,
        status: p.status,
        created_at: p.created_at,
        completed_at: p.completed_at,
        reference: p.session_id?.slice(-12),
      });
    });

    cryptoPayments?.forEach(p => {
      payments.push({
        id: p.id,
        type: 'crypto',
        user_id: p.user_id,
        user_email: profileMap[p.user_id]?.email,
        user_name: profileMap[p.user_id]?.name,
        amount_usd: Number(p.amount_usd),
        currency: 'USD',
        credits: p.credits,
        status: p.status,
        created_at: p.created_at,
        completed_at: p.status === 'finished' ? p.updated_at : null,
        reference: p.payment_id?.slice(-12),
      });
    });

    manualPayments?.forEach(p => {
      payments.push({
        id: p.id,
        type: 'manual',
        user_id: p.user_id,
        user_email: profileMap[p.user_id]?.email,
        user_name: profileMap[p.user_id]?.name,
        amount_usd: Number(p.amount_usd),
        currency: p.currency || 'USD',
        credits: p.credits,
        status: p.status,
        created_at: p.created_at,
        completed_at: p.verified_at,
      reference: p.transaction_id || p.id.slice(-8),
      });
    });

    dodoPayments?.forEach(p => {
      payments.push({
        id: p.id,
        type: 'dodo',
        user_id: p.user_id,
        user_email: p.customer_email || profileMap[p.user_id]?.email,
        user_name: profileMap[p.user_id]?.name,
        amount_usd: Number(p.amount_usd),
        currency: 'USD',
        credits: p.credits,
        status: p.status,
        created_at: p.created_at,
        completed_at: p.completed_at,
        reference: p.payment_id?.slice(-12),
      });
    });

    paddlePayments?.forEach(p => {
      payments.push({
        id: p.id,
        type: 'paddle',
        user_id: p.user_id,
        user_email: p.customer_email || profileMap[p.user_id]?.email,
        user_name: profileMap[p.user_id]?.name,
        amount_usd: Number(p.amount_usd),
        currency: p.currency || 'USD',
        credits: p.credits,
        status: p.status,
        created_at: p.created_at,
        completed_at: p.completed_at,
        reference: p.transaction_id?.slice(-12),
      });
    });

    return payments.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [stripePayments, cryptoPayments, manualPayments, dodoPayments, paddlePayments, profileMap]);

  const filteredPayments = unifiedPayments.filter(p => {
    const matchesSearch = 
      p.user_email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.user_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.reference?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = typeFilter === 'all' || p.type === typeFilter;
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
    return matchesSearch && matchesType && matchesStatus;
  });

  const stats = useMemo(() => {
    const completedPayments = unifiedPayments.filter(p => 
      p.status === 'completed' || p.status === 'verified' || p.status === 'finished'
    );
    return {
      totalPayments: unifiedPayments.length,
      totalRevenue: completedPayments.reduce((sum, p) => sum + p.amount_usd, 0),
      totalCredits: completedPayments.reduce((sum, p) => sum + p.credits, 0),
      stripeCount: unifiedPayments.filter(p => p.type === 'stripe').length,
      cryptoCount: unifiedPayments.filter(p => p.type === 'crypto').length,
      manualCount: unifiedPayments.filter(p => p.type === 'manual').length,
      paddleCount: unifiedPayments.filter(p => p.type === 'paddle').length,
    };
  }, [unifiedPayments]);

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'stripe':
        return <Badge className="bg-purple-500/10 text-purple-500 border-purple-500/20"><CreditCard className="h-3 w-3 mr-1" />Stripe</Badge>;
      case 'crypto':
        return <Badge className="bg-orange-500/10 text-orange-500 border-orange-500/20"><Wallet className="h-3 w-3 mr-1" />Crypto</Badge>;
      case 'manual':
        return <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20"><DollarSign className="h-3 w-3 mr-1" />Manual</Badge>;
      case 'dodo':
        return <Badge className="bg-indigo-500/10 text-indigo-500 border-indigo-500/20"><CreditCard className="h-3 w-3 mr-1" />Dodo</Badge>;
      case 'paddle':
        return <Badge className="bg-teal-500/10 text-teal-500 border-teal-500/20"><CreditCard className="h-3 w-3 mr-1" />Paddle</Badge>;
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
      case 'verified':
      case 'finished':
        return <Badge className="bg-green-500/10 text-green-500 border-green-500/20">Completed</Badge>;
      case 'pending':
      case 'waiting':
        return <Badge variant="secondary">Pending</Badge>;
      case 'failed':
      case 'expired':
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const exportToCSV = () => {
    const headers = ['Date', 'Type', 'User Email', 'Amount', 'Currency', 'Credits', 'Status', 'Reference'];
    const rows = filteredPayments.map(p => [
      format(new Date(p.created_at), 'yyyy-MM-dd HH:mm'),
      p.type,
      p.user_email || '',
      p.amount_usd.toFixed(2),
      p.currency || 'USD',
      p.credits,
      p.status,
      p.reference || '',
    ]);
    
    const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payments-export-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-display font-bold">Unified Payments</h1>
          <p className="text-muted-foreground mt-1">View all payments across Stripe, Paddle, Crypto, and Manual methods</p>
        </div>
      <div className="space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <TrendingUp className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Revenue</p>
                  <p className="text-2xl font-bold">${stats.totalRevenue.toFixed(2)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-500/10">
                  <CreditCard className="h-5 w-5 text-purple-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Stripe</p>
                  <p className="text-2xl font-bold">{stats.stripeCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-orange-500/10">
                  <Wallet className="h-5 w-5 text-orange-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Crypto</p>
                  <p className="text-2xl font-bold">{stats.cryptoCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <DollarSign className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Manual</p>
                  <p className="text-2xl font-bold">{stats.manualCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <div className="flex flex-col md:flex-row gap-4 justify-between">
              <CardTitle>All Payments</CardTitle>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={exportToCSV}>
                  <Download className="h-4 w-4 mr-2" />
                  Export CSV
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row gap-4 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by email, name, or reference..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-full md:w-[150px]">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="stripe">Stripe</SelectItem>
                  <SelectItem value="paddle">Paddle</SelectItem>
                  <SelectItem value="crypto">Crypto</SelectItem>
                  <SelectItem value="manual">Manual</SelectItem>
                  <SelectItem value="dodo">Dodo</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full md:w-[150px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">Credits</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Reference</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPayments.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        No payments found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredPayments.slice(0, 100).map((payment) => (
                      <TableRow key={`${payment.type}-${payment.id}`}>
                        <TableCell className="text-sm text-muted-foreground">
                          {format(new Date(payment.created_at), 'MMM d, HH:mm')}
                        </TableCell>
                        <TableCell>{getTypeBadge(payment.type)}</TableCell>
                        <TableCell>
                          <div>
                            <p className="text-sm font-medium">{payment.user_name || 'Unknown'}</p>
                            <p className="text-xs text-muted-foreground">{payment.user_email}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {payment.currency && payment.currency !== 'USD'
                            ? `${payment.amount_usd.toFixed(2)} ${payment.currency}`
                            : `$${payment.amount_usd.toFixed(2)}`}
                        </TableCell>
                        <TableCell className="text-right">{payment.credits}</TableCell>
                        <TableCell>{getStatusBadge(payment.status)}</TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {payment.reference}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
            {filteredPayments.length > 100 && (
              <p className="text-sm text-muted-foreground text-center mt-4">
                Showing 100 of {filteredPayments.length} payments
              </p>
            )}
          </CardContent>
        </Card>
      </div>
      </div>
    </DashboardLayout>
  );
};

export default AdminUnifiedPayments;