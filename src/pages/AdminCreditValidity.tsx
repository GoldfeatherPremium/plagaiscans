import React, { useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Search, Loader2, Clock, User, CreditCard, Trash2, Calendar, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format, isPast, differenceInDays } from 'date-fns';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface CreditValidity {
  id: string;
  user_id: string;
  credits_amount: number;
  remaining_credits: number;
  expires_at: string;
  credit_type: string;
  expired: boolean;
  created_at: string;
  transaction_id: string | null;
  user_email?: string;
  user_name?: string;
}

export default function AdminCreditValidity() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'expired' | 'expiring_soon'>('all');
  const [creditTypeFilter, setCreditTypeFilter] = useState<'all' | 'full' | 'similarity_only'>('all');

  const { data: creditValidities = [], isLoading } = useQuery({
    queryKey: ['admin-credit-validity'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('credit_validity')
        .select('*')
        .order('expires_at', { ascending: true });

      if (error) throw error;

      // Fetch user info for each validity record
      const userIds = [...new Set(data.map(cv => cv.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, email, full_name')
        .in('id', userIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

      return data.map(cv => ({
        ...cv,
        user_email: profileMap.get(cv.user_id)?.email,
        user_name: profileMap.get(cv.user_id)?.full_name,
      })) as CreditValidity[];
    },
  });

  const filteredValidities = creditValidities.filter(cv => {
    // Search filter
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch = !searchQuery || 
      cv.user_email?.toLowerCase().includes(searchLower) ||
      cv.user_name?.toLowerCase().includes(searchLower);

    // Status filter
    const expiresAt = new Date(cv.expires_at);
    const isExpired = cv.expired || isPast(expiresAt);
    const daysUntilExpiry = differenceInDays(expiresAt, new Date());
    const isExpiringSoon = !isExpired && daysUntilExpiry <= 7;

    let matchesStatus = true;
    if (statusFilter === 'active') matchesStatus = !isExpired && cv.remaining_credits > 0;
    if (statusFilter === 'expired') matchesStatus = isExpired;
    if (statusFilter === 'expiring_soon') matchesStatus = isExpiringSoon;

    // Credit type filter
    let matchesCreditType = true;
    if (creditTypeFilter !== 'all') matchesCreditType = cv.credit_type === creditTypeFilter;

    return matchesSearch && matchesStatus && matchesCreditType;
  });

  const handleDelete = async (id: string) => {
    const { error } = await supabase
      .from('credit_validity')
      .delete()
      .eq('id', id);

    if (error) {
      toast({ title: 'Error', description: 'Failed to delete record', variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: 'Credit validity record deleted' });
      queryClient.invalidateQueries({ queryKey: ['admin-credit-validity'] });
    }
  };

  const handleMarkExpired = async (id: string) => {
    const { error } = await supabase
      .from('credit_validity')
      .update({ expired: true, remaining_credits: 0 })
      .eq('id', id);

    if (error) {
      toast({ title: 'Error', description: 'Failed to update record', variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: 'Credits marked as expired' });
      queryClient.invalidateQueries({ queryKey: ['admin-credit-validity'] });
    }
  };

  const getStatusBadge = (cv: CreditValidity) => {
    const expiresAt = new Date(cv.expires_at);
    const isExpired = cv.expired || isPast(expiresAt);
    const daysUntilExpiry = differenceInDays(expiresAt, new Date());

    if (isExpired || cv.remaining_credits === 0) {
      return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" /> Expired</Badge>;
    }
    if (daysUntilExpiry <= 7) {
      return <Badge variant="outline" className="gap-1 border-amber-500 text-amber-600"><AlertTriangle className="h-3 w-3" /> Expiring Soon</Badge>;
    }
    return <Badge variant="default" className="gap-1 bg-green-600"><CheckCircle className="h-3 w-3" /> Active</Badge>;
  };

  // Stats
  const activeCount = creditValidities.filter(cv => !cv.expired && !isPast(new Date(cv.expires_at)) && cv.remaining_credits > 0).length;
  const expiredCount = creditValidities.filter(cv => cv.expired || isPast(new Date(cv.expires_at))).length;
  const expiringSoonCount = creditValidities.filter(cv => {
    const expiresAt = new Date(cv.expires_at);
    return !cv.expired && !isPast(expiresAt) && differenceInDays(expiresAt, new Date()) <= 7;
  }).length;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-display font-bold">Credit Validity Management</h1>
          <p className="text-muted-foreground mt-1">View and manage credit expiration records</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Records</p>
                  <p className="text-2xl font-bold">{creditValidities.length}</p>
                </div>
                <CreditCard className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Active</p>
                  <p className="text-2xl font-bold text-green-600">{activeCount}</p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Expiring Soon</p>
                  <p className="text-2xl font-bold text-amber-600">{expiringSoonCount}</p>
                </div>
                <AlertTriangle className="h-8 w-8 text-amber-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Expired</p>
                  <p className="text-2xl font-bold text-destructive">{expiredCount}</p>
                </div>
                <XCircle className="h-8 w-8 text-destructive" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by email or name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="expiring_soon">Expiring Soon</SelectItem>
              <SelectItem value="expired">Expired</SelectItem>
            </SelectContent>
          </Select>
          <Select value={creditTypeFilter} onValueChange={(v) => setCreditTypeFilter(v as typeof creditTypeFilter)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Credit Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="full">Full Scan</SelectItem>
              <SelectItem value="similarity_only">Similarity Only</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filteredValidities.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Clock className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">No credit validity records found</p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-center">Credits</TableHead>
                      <TableHead className="text-center">Remaining</TableHead>
                      <TableHead>Expires At</TableHead>
                      <TableHead>Days Left</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="text-center">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredValidities.map((cv) => {
                      const expiresAt = new Date(cv.expires_at);
                      const isExpired = cv.expired || isPast(expiresAt);
                      const daysLeft = differenceInDays(expiresAt, new Date());

                      return (
                        <TableRow key={cv.id} className={isExpired ? 'opacity-60' : ''}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4 text-muted-foreground" />
                              <div>
                                <p className="font-medium">{cv.user_name || 'No name'}</p>
                                <p className="text-xs text-muted-foreground">{cv.user_email}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={cv.credit_type === 'full' ? 'default' : 'secondary'}>
                              {cv.credit_type === 'full' ? 'Full Scan' : 'Similarity'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center font-medium">{cv.credits_amount}</TableCell>
                          <TableCell className="text-center">
                            <span className={cv.remaining_credits === 0 ? 'text-muted-foreground' : 'font-bold text-primary'}>
                              {cv.remaining_credits}
                            </span>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4 text-muted-foreground" />
                              {format(expiresAt, 'PPP')}
                            </div>
                          </TableCell>
                          <TableCell>
                            {isExpired ? (
                              <span className="text-destructive font-medium">Expired</span>
                            ) : (
                              <span className={daysLeft <= 7 ? 'text-amber-600 font-medium' : ''}>
                                {daysLeft} days
                              </span>
                            )}
                          </TableCell>
                          <TableCell>{getStatusBadge(cv)}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {format(new Date(cv.created_at), 'PP')}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-center gap-2">
                              {!isExpired && cv.remaining_credits > 0 && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleMarkExpired(cv.id)}
                                >
                                  <XCircle className="h-4 w-4 mr-1" />
                                  Expire
                                </Button>
                              )}
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button size="sm" variant="destructive">
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete Credit Validity Record?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      This will permanently delete this credit validity record. This action cannot be undone.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleDelete(cv.id)}>
                                      Delete
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        <p className="text-xs text-muted-foreground">
          Showing {filteredValidities.length} of {creditValidities.length} records
        </p>
      </div>
    </DashboardLayout>
  );
}
