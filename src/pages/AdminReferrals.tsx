import React from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { 
  Users, 
  Gift, 
  TrendingUp,
  Loader2,
  CheckCircle,
  Clock
} from 'lucide-react';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export default function AdminReferrals() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-referrals'],
    queryFn: async () => {
      // Get all referrals
      const { data: referrals, error } = await supabase
        .from('referrals')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Get referrer profiles
      const referrerIds = [...new Set(referrals?.map(r => r.referrer_id) || [])];
      const { data: referrerProfiles } = await supabase
        .from('profiles')
        .select('id, email, full_name')
        .in('id', referrerIds);

      // Get referred user profiles
      const referredIds = referrals?.filter(r => r.referred_user_id).map(r => r.referred_user_id) || [];
      const { data: referredProfiles } = await supabase
        .from('profiles')
        .select('id, email, full_name')
        .in('id', referredIds);

      const referrerMap = new Map(referrerProfiles?.map(p => [p.id, p]) || []);
      const referredMap = new Map(referredProfiles?.map(p => [p.id, p]) || []);

      const enrichedReferrals = referrals?.map(r => ({
        ...r,
        referrer: referrerMap.get(r.referrer_id),
        referred: r.referred_user_id ? referredMap.get(r.referred_user_id) : null
      })) || [];

      // Calculate stats
      const totalReferrals = enrichedReferrals.length;
      const completedReferrals = enrichedReferrals.filter(r => r.status === 'completed').length;
      const totalCreditsGiven = enrichedReferrals.reduce((sum, r) => sum + (r.credits_earned || 0), 0);

      return {
        referrals: enrichedReferrals,
        stats: {
          total: totalReferrals,
          completed: completedReferrals,
          creditsGiven: totalCreditsGiven,
          conversionRate: totalReferrals > 0 ? Math.round((completedReferrals / totalReferrals) * 100) : 0
        }
      };
    }
  });

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-display font-bold">Referral Management</h1>
          <p className="text-muted-foreground">Track referral program performance</p>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Referrals</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data?.stats.total}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Completed</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data?.stats.completed}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Credits Given</CardTitle>
              <Gift className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data?.stats.creditsGiven}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data?.stats.conversionRate}%</div>
            </CardContent>
          </Card>
        </div>

        {/* Referrals Table */}
        <Card>
          <CardHeader>
            <CardTitle>All Referrals</CardTitle>
            <CardDescription>Complete history of referral activity</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Referrer</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Referred User</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Credits Earned</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.referrals.map((referral) => (
                  <TableRow key={referral.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{referral.referrer?.full_name || 'Unknown'}</p>
                        <p className="text-sm text-muted-foreground">{referral.referrer?.email}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <code className="bg-muted px-2 py-1 rounded text-sm">{referral.referral_code}</code>
                    </TableCell>
                    <TableCell>
                      {referral.referred ? (
                        <div>
                          <p className="font-medium">{referral.referred.full_name || 'Unknown'}</p>
                          <p className="text-sm text-muted-foreground">{referral.referred.email}</p>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={referral.status === 'completed' ? 'default' : 'secondary'}>
                        {referral.status === 'completed' ? (
                          <><CheckCircle className="h-3 w-3 mr-1" /> Completed</>
                        ) : (
                          <><Clock className="h-3 w-3 mr-1" /> Pending</>
                        )}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {referral.credits_earned > 0 ? (
                        <span className="font-medium text-green-600">+{referral.credits_earned}</span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(referral.created_at), 'MMM dd, yyyy')}
                    </TableCell>
                  </TableRow>
                ))}
                {(!data?.referrals || data.referrals.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      No referrals yet
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
