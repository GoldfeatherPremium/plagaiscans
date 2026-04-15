import React from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { 
  Users, 
  Gift, 
  TrendingUp,
  Loader2,
  CheckCircle,
  Clock,
  ShieldAlert,
  ShieldX,
  ShieldCheck,
  AlertTriangle,
  Ban,
  Timer,
  XCircle,
  Activity
} from 'lucide-react';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';

export default function AdminReferrals() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['admin-referrals'],
    queryFn: async () => {
      const { data: referrals, error } = await supabase
        .from('referrals')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const referrerIds = [...new Set(referrals?.map(r => r.referrer_id) || [])];
      const { data: referrerProfiles } = await supabase
        .from('profiles')
        .select('id, email, full_name, signup_ip, shadow_banned')
        .in('id', referrerIds);

      const referredIds = referrals?.filter(r => r.referred_user_id).map(r => r.referred_user_id) || [];
      const { data: referredProfiles } = await supabase
        .from('profiles')
        .select('id, email, full_name, signup_ip, shadow_banned')
        .in('id', referredIds);

      const referrerMap = new Map(referrerProfiles?.map(p => [p.id, p]) || []);
      const referredMap = new Map(referredProfiles?.map(p => [p.id, p]) || []);

      const enrichedReferrals = referrals?.map(r => ({
        ...r,
        referrer: referrerMap.get(r.referrer_id),
        referred: r.referred_user_id ? referredMap.get(r.referred_user_id) : null
      })) || [];

      const totalReferrals = enrichedReferrals.length;
      const completedReferrals = enrichedReferrals.filter(r => r.status === 'completed').length;
      const totalCreditsGiven = enrichedReferrals.reduce((sum, r) => sum + (r.credits_earned || 0), 0);
      const fraudFlagged = enrichedReferrals.filter(r => (r as any).fraud_flagged).length;
      const delayedCount = enrichedReferrals.filter(r => (r as any).reward_status === 'delayed').length;
      const rejectedCount = enrichedReferrals.filter(r => (r as any).reward_status === 'rejected').length;
      const shadowBannedUsers = new Set([
        ...referrerProfiles?.filter(p => (p as any).shadow_banned).map(p => p.id) || [],
        ...referredProfiles?.filter(p => (p as any).shadow_banned).map(p => p.id) || [],
      ]).size;

      return {
        referrals: enrichedReferrals,
        stats: {
          total: totalReferrals,
          completed: completedReferrals,
          creditsGiven: totalCreditsGiven,
          conversionRate: totalReferrals > 0 ? Math.round((completedReferrals / totalReferrals) * 100) : 0,
          fraudFlagged,
          delayed: delayedCount,
          rejected: rejectedCount,
          shadowBanned: shadowBannedUsers,
        }
      };
    }
  });

  const toggleFraudFlag = useMutation({
    mutationFn: async ({ id, flagged, reason }: { id: string; flagged: boolean; reason?: string }) => {
      const { error } = await supabase
        .from('referrals')
        .update({ 
          fraud_flagged: flagged, 
          fraud_reason: flagged ? (reason || 'Manually flagged by admin') : null,
          reward_status: flagged ? 'rejected' : 'pending',
        } as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-referrals'] });
      toast.success('Referral flag updated');
    },
    onError: () => toast.error('Failed to update flag'),
  });

  const toggleShadowBan = useMutation({
    mutationFn: async ({ userId, banned }: { userId: string; banned: boolean }) => {
      const { error } = await supabase
        .from('profiles')
        .update({ shadow_banned: banned } as any)
        .eq('id', userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-referrals'] });
      toast.success('Shadow ban updated');
    },
    onError: () => toast.error('Failed to update shadow ban'),
  });

  const processDelayed = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('process-delayed-referrals');
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin-referrals'] });
      toast.success(`Processed: ${data.approved} approved, ${data.rejected} rejected`);
    },
    onError: () => toast.error('Failed to process delayed referrals'),
  });

  const hasIpMatch = (referral: any) => {
    if (!referral.referrer?.signup_ip || !referral.referred?.signup_ip) return false;
    return referral.referrer.signup_ip === referral.referred.signup_ip;
  };

  const getRewardStatusBadge = (referral: any) => {
    const status = referral.reward_status || 'pending';
    switch (status) {
      case 'approved':
        return <Badge className="bg-green-100 text-green-800 border-green-200"><CheckCircle className="h-3 w-3 mr-1" /> Approved</Badge>;
      case 'delayed':
        return <Badge className="bg-amber-100 text-amber-800 border-amber-200"><Timer className="h-3 w-3 mr-1" /> Delayed</Badge>;
      case 'rejected':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" /> Rejected</Badge>;
      default:
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" /> Pending</Badge>;
    }
  };

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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-display font-bold">Referral Management</h1>
            <p className="text-muted-foreground">Track referral performance, fraud detection & enforcement</p>
          </div>
          <Button 
            onClick={() => processDelayed.mutate()} 
            disabled={processDelayed.isPending}
            variant="outline"
          >
            {processDelayed.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Timer className="h-4 w-4 mr-2" />}
            Process Delayed
          </Button>
        </div>

        {/* Stats */}
        <div className="grid gap-3 grid-cols-2 md:grid-cols-4 lg:grid-cols-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium">Total</CardTitle>
              <Users className="h-3 w-3 text-muted-foreground" />
            </CardHeader>
            <CardContent><div className="text-xl font-bold">{data?.stats.total}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium">Completed</CardTitle>
              <CheckCircle className="h-3 w-3 text-green-500" />
            </CardHeader>
            <CardContent><div className="text-xl font-bold">{data?.stats.completed}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium">Credits</CardTitle>
              <Gift className="h-3 w-3 text-primary" />
            </CardHeader>
            <CardContent><div className="text-xl font-bold">{data?.stats.creditsGiven}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium">Conv. Rate</CardTitle>
              <TrendingUp className="h-3 w-3 text-muted-foreground" />
            </CardHeader>
            <CardContent><div className="text-xl font-bold">{data?.stats.conversionRate}%</div></CardContent>
          </Card>
          <Card className="border-amber-200">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium">Delayed</CardTitle>
              <Timer className="h-3 w-3 text-amber-500" />
            </CardHeader>
            <CardContent><div className="text-xl font-bold text-amber-600">{data?.stats.delayed}</div></CardContent>
          </Card>
          <Card className="border-destructive/30">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium">Flagged</CardTitle>
              <ShieldAlert className="h-3 w-3 text-destructive" />
            </CardHeader>
            <CardContent><div className="text-xl font-bold text-destructive">{data?.stats.fraudFlagged}</div></CardContent>
          </Card>
          <Card className="border-destructive/30">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium">Rejected</CardTitle>
              <XCircle className="h-3 w-3 text-destructive" />
            </CardHeader>
            <CardContent><div className="text-xl font-bold text-destructive">{data?.stats.rejected}</div></CardContent>
          </Card>
          <Card className="border-destructive/30">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium">Shadow Banned</CardTitle>
              <Ban className="h-3 w-3 text-destructive" />
            </CardHeader>
            <CardContent><div className="text-xl font-bold text-destructive">{data?.stats.shadowBanned}</div></CardContent>
          </Card>
        </div>

        {/* Referrals Table */}
        <Card>
          <CardHeader>
            <CardTitle>All Referrals</CardTitle>
            <CardDescription>Complete fraud detection audit with enforcement controls</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <TooltipProvider>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Referrer</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Referred User</TableHead>
                    <TableHead>Referrer IP</TableHead>
                    <TableHead>Referred IP</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Reward</TableHead>
                    <TableHead>Fraud</TableHead>
                    <TableHead>Activity</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.referrals.map((referral: any) => {
                    const ipMatch = hasIpMatch(referral);
                    const referrerBanned = referral.referrer?.shadow_banned;
                    const referredBanned = referral.referred?.shadow_banned;
                    return (
                      <TableRow key={referral.id} className={referral.fraud_flagged ? 'bg-destructive/5' : ''}>
                        <TableCell>
                          <div>
                            <p className="font-medium flex items-center gap-1">
                              {referral.referrer?.full_name || 'Unknown'}
                              {referrerBanned && (
                                <Tooltip>
                                  <TooltipTrigger><Ban className="h-3 w-3 text-destructive" /></TooltipTrigger>
                                  <TooltipContent>Shadow Banned</TooltipContent>
                                </Tooltip>
                              )}
                            </p>
                            <p className="text-xs text-muted-foreground">{referral.referrer?.email}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <code className="bg-muted px-1.5 py-0.5 rounded text-xs">{referral.referral_code}</code>
                        </TableCell>
                        <TableCell>
                          {referral.referred ? (
                            <div>
                              <p className="font-medium flex items-center gap-1">
                                {referral.referred.full_name || 'Unknown'}
                                {referredBanned && (
                                  <Tooltip>
                                    <TooltipTrigger><Ban className="h-3 w-3 text-destructive" /></TooltipTrigger>
                                    <TooltipContent>Shadow Banned</TooltipContent>
                                  </Tooltip>
                                )}
                              </p>
                              <p className="text-xs text-muted-foreground">{referral.referred.email}</p>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <code className="bg-muted px-1 py-0.5 rounded text-[10px]">
                            {referral.referrer?.signup_ip || '-'}
                          </code>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <code className="bg-muted px-1 py-0.5 rounded text-[10px]">
                              {referral.referred_ip || referral.referred?.signup_ip || '-'}
                            </code>
                            {ipMatch && (
                              <Tooltip>
                                <TooltipTrigger><AlertTriangle className="h-3 w-3 text-amber-500" /></TooltipTrigger>
                                <TooltipContent>⚠️ IP matches referrer</TooltipContent>
                              </Tooltip>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={referral.status === 'completed' ? 'default' : 'secondary'} className="text-xs">
                            {referral.status === 'completed' ? 'Completed' : 'Pending'}
                          </Badge>
                        </TableCell>
                        <TableCell>{getRewardStatusBadge(referral)}</TableCell>
                        <TableCell>
                          {referral.fraud_flagged ? (
                            <Tooltip>
                              <TooltipTrigger>
                                <Badge variant="destructive" className="gap-1 text-xs">
                                  <ShieldX className="h-3 w-3" /> Flagged
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent className="max-w-xs">
                                <p>{referral.fraud_reason || 'No reason'}</p>
                              </TooltipContent>
                            </Tooltip>
                          ) : (
                            <Badge variant="outline" className="gap-1 text-xs text-green-600 border-green-200">
                              <ShieldCheck className="h-3 w-3" /> Clean
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Activity className="h-3 w-3 text-muted-foreground" />
                            <span className="text-sm">{referral.activity_score || 0}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {referral.payment_amount_usd > 0 ? (
                            <span className="text-sm font-medium">${referral.payment_amount_usd}</span>
                          ) : (
                            <span className="text-muted-foreground text-xs">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs">
                          {format(new Date(referral.created_at), 'MMM dd, yyyy')}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <Button
                              variant={referral.fraud_flagged ? 'outline' : 'destructive'}
                              size="sm"
                              className="text-xs h-7"
                              onClick={() => toggleFraudFlag.mutate({
                                id: referral.id,
                                flagged: !referral.fraud_flagged,
                              })}
                            >
                              {referral.fraud_flagged ? 'Unflag' : 'Flag'}
                            </Button>
                            {referral.referrer && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-xs h-7"
                                onClick={() => toggleShadowBan.mutate({
                                  userId: referral.referrer_id,
                                  banned: !referral.referrer?.shadow_banned,
                                })}
                              >
                                {referral.referrer?.shadow_banned ? (
                                  <><ShieldCheck className="h-3 w-3 mr-1" /> Unban</>
                                ) : (
                                  <><Ban className="h-3 w-3 mr-1" /> Shadow Ban</>
                                )}
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {(!data?.referrals || data.referrals.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={11} className="text-center text-muted-foreground py-8">
                        No referrals yet
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TooltipProvider>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
