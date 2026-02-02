import { useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, formatDistanceToNow } from 'date-fns';
import { 
  AlertTriangle, 
  RefreshCw, 
  DollarSign, 
  Clock,
  CheckCircle,
  XCircle,
  ExternalLink
} from 'lucide-react';

export default function AdminStripeDisputes() {
  const { data: disputes, isLoading, refetch } = useQuery({
    queryKey: ['stripe-disputes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stripe_disputes')
        .select(`
          *,
          profiles:user_id (email, full_name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const { data: stats } = useQuery({
    queryKey: ['dispute-stats'],
    queryFn: async () => {
      const { data } = await supabase
        .from('stripe_disputes')
        .select('status, amount_cents');

      const openDisputes = data?.filter(d => d.status === 'needs_response' || d.status === 'under_review' || d.status === 'open') || [];
      const wonDisputes = data?.filter(d => d.status === 'won') || [];
      const lostDisputes = data?.filter(d => d.status === 'lost') || [];
      
      return {
        total: data?.length || 0,
        open: openDisputes.length,
        won: wonDisputes.length,
        lost: lostDisputes.length,
        atRisk: openDisputes.reduce((sum, d) => sum + d.amount_cents, 0) / 100,
      };
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'needs_response':
        return <Badge className="bg-red-500/10 text-red-600 border-red-200"><Clock className="h-3 w-3 mr-1" />Needs Response</Badge>;
      case 'under_review':
        return <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-200"><Clock className="h-3 w-3 mr-1" />Under Review</Badge>;
      case 'won':
        return <Badge className="bg-green-500/10 text-green-600 border-green-200"><CheckCircle className="h-3 w-3 mr-1" />Won</Badge>;
      case 'lost':
        return <Badge className="bg-red-500/10 text-red-600 border-red-200"><XCircle className="h-3 w-3 mr-1" />Lost</Badge>;
      case 'open':
        return <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-200"><AlertTriangle className="h-3 w-3 mr-1" />Open</Badge>;
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
              <AlertTriangle className="h-8 w-8 text-destructive" />
              Stripe Disputes
            </h1>
            <p className="text-muted-foreground mt-1">
              Monitor and respond to chargebacks
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
              <CardTitle className="text-sm font-medium">Total Disputes</CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.total || 0}</div>
            </CardContent>
          </Card>
          <Card className="border-red-200 bg-red-50/50 dark:bg-red-950/20">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Open Disputes</CardTitle>
              <Clock className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{stats?.open || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Amount at Risk</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${stats?.atRisk?.toFixed(2) || '0.00'}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Win Rate</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats && (stats.won + stats.lost) > 0 
                  ? `${Math.round((stats.won / (stats.won + stats.lost)) * 100)}%`
                  : 'N/A'}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Disputes Table */}
        <Card>
          <CardHeader>
            <CardTitle>All Disputes</CardTitle>
            <CardDescription>Chargebacks and payment disputes from Stripe</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : disputes?.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <AlertTriangle className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No disputes found</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Evidence Due</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {disputes?.map((dispute) => {
                    const profile = dispute.profiles as any;
                    return (
                      <TableRow key={dispute.id}>
                        <TableCell>
                          {format(new Date(dispute.created_at), 'MMM dd, yyyy HH:mm')}
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{profile?.full_name || 'Unknown'}</p>
                            <p className="text-xs text-muted-foreground">{profile?.email}</p>
                          </div>
                        </TableCell>
                        <TableCell className="font-semibold text-red-600">
                          ${(dispute.amount_cents / 100).toFixed(2)}
                        </TableCell>
                        <TableCell className="capitalize">
                          {dispute.reason?.replace(/_/g, ' ') || 'Unknown'}
                        </TableCell>
                        <TableCell>{getStatusBadge(dispute.status)}</TableCell>
                        <TableCell>
                          {dispute.evidence_due_by ? (
                            <div className="text-sm">
                              <div>{format(new Date(dispute.evidence_due_by), 'MMM dd, yyyy')}</div>
                              <div className="text-xs text-muted-foreground">
                                {formatDistanceToNow(new Date(dispute.evidence_due_by), { addSuffix: true })}
                              </div>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => window.open(`https://dashboard.stripe.com/disputes/${dispute.dispute_id}`, '_blank')}
                            className="gap-1"
                          >
                            <ExternalLink className="h-4 w-4" />
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Info Card */}
        <Card className="border-yellow-200 bg-yellow-50/50 dark:bg-yellow-950/20">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-full bg-yellow-100 dark:bg-yellow-900/50">
                <AlertTriangle className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <h3 className="font-semibold text-yellow-900 dark:text-yellow-100">Dispute Management</h3>
                <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                  Respond to disputes promptly in your Stripe Dashboard. Submit evidence before the deadline to maximize your chances of winning.
                  Disputes affect your account health and processing fees.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
