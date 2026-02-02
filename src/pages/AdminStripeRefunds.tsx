import { useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { 
  RotateCcw, 
  RefreshCw, 
  DollarSign, 
  Coins,
  CheckCircle,
  Clock
} from 'lucide-react';

export default function AdminStripeRefunds() {
  const { data: refunds, isLoading, refetch } = useQuery({
    queryKey: ['stripe-refunds'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stripe_refunds')
        .select(`
          *,
          profiles:user_id (email, full_name),
          processed_by_profile:processed_by (email, full_name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const { data: stats } = useQuery({
    queryKey: ['refund-stats'],
    queryFn: async () => {
      const { data } = await supabase
        .from('stripe_refunds')
        .select('amount_cents, credits_deducted, status');

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      return {
        total: data?.length || 0,
        totalAmount: (data?.reduce((sum, r) => sum + r.amount_cents, 0) || 0) / 100,
        totalCreditsDeducted: data?.reduce((sum, r) => sum + (r.credits_deducted || 0), 0) || 0,
        pending: data?.filter(r => r.status === 'pending').length || 0,
      };
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-500/10 text-green-600 border-green-200"><CheckCircle className="h-3 w-3 mr-1" />Completed</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-200"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getReasonBadge = (reason: string | null) => {
    switch (reason) {
      case 'duplicate':
        return <Badge variant="outline" className="bg-blue-50 text-blue-700">Duplicate</Badge>;
      case 'fraudulent':
        return <Badge variant="outline" className="bg-red-50 text-red-700">Fraudulent</Badge>;
      case 'requested_by_customer':
        return <Badge variant="outline" className="bg-gray-50 text-gray-700">Customer Request</Badge>;
      default:
        return <Badge variant="outline">{reason || 'Unknown'}</Badge>;
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-display font-bold flex items-center gap-3">
              <RotateCcw className="h-8 w-8 text-primary" />
              Stripe Refunds
            </h1>
            <p className="text-muted-foreground mt-1">
              Track all processed refunds and credit adjustments
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
              <CardTitle className="text-sm font-medium">Total Refunds</CardTitle>
              <RotateCcw className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.total || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Refunded</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${stats?.totalAmount?.toFixed(2) || '0.00'}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Credits Deducted</CardTitle>
              <Coins className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">-{stats?.totalCreditsDeducted || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Pending</CardTitle>
              <Clock className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.pending || 0}</div>
            </CardContent>
          </Card>
        </div>

        {/* Refunds Table */}
        <Card>
          <CardHeader>
            <CardTitle>Refund History</CardTitle>
            <CardDescription>All Stripe refunds and credit adjustments</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : refunds?.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <RotateCcw className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No refunds processed yet</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Credits Deducted</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Processed By</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {refunds?.map((refund) => {
                    const profile = refund.profiles as any;
                    const processedByProfile = refund.processed_by_profile as any;
                    return (
                      <TableRow key={refund.id}>
                        <TableCell>
                          {format(new Date(refund.created_at), 'MMM dd, yyyy HH:mm')}
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{profile?.full_name || 'Unknown'}</p>
                            <p className="text-xs text-muted-foreground">{profile?.email}</p>
                          </div>
                        </TableCell>
                        <TableCell className="font-semibold">
                          ${(refund.amount_cents / 100).toFixed(2)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                            -{refund.credits_deducted || 0} credits
                          </Badge>
                        </TableCell>
                        <TableCell>{getReasonBadge(refund.reason)}</TableCell>
                        <TableCell>{getStatusBadge(refund.status)}</TableCell>
                        <TableCell>
                          {processedByProfile ? (
                            <span className="text-sm text-muted-foreground">
                              {processedByProfile.full_name || processedByProfile.email}
                            </span>
                          ) : refund.processed_at ? (
                            <span className="text-sm text-muted-foreground">System</span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
