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
  AlertTriangle
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
        .select('id, email, full_name, signup_ip')
        .in('id', referrerIds);

      const referredIds = referrals?.filter(r => r.referred_user_id).map(r => r.referred_user_id) || [];
      const { data: referredProfiles } = await supabase
        .from('profiles')
        .select('id, email, full_name, signup_ip')
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

      return {
        referrals: enrichedReferrals,
        stats: {
          total: totalReferrals,
          completed: completedReferrals,
          creditsGiven: totalCreditsGiven,
          conversionRate: totalReferrals > 0 ? Math.round((completedReferrals / totalReferrals) * 100) : 0,
          fraudFlagged
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
          fraud_reason: flagged ? (reason || 'Manually flagged by admin') : null 
        } as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-referrals'] });
      toast.success('Referral flag updated');
    },
    onError: () => {
      toast.error('Failed to update flag');
    }
  });

  const hasIpMatch = (referral: any) => {
    if (!referral.referrer?.signup_ip || !referral.referred?.signup_ip) return false;
    return referral.referrer.signup_ip === referral.referred.signup_ip;
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
        <div>
          <h1 className="text-3xl font-display font-bold">Referral Management</h1>
          <p className="text-muted-foreground">Track referral program performance and fraud</p>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-5">
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

          <Card className="border-destructive/30">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Fraud Flagged</CardTitle>
              <ShieldAlert className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">{data?.stats.fraudFlagged}</div>
            </CardContent>
          </Card>
        </div>

        {/* Referrals Table */}
        <Card>
          <CardHeader>
            <CardTitle>All Referrals</CardTitle>
            <CardDescription>Complete history of referral activity with fraud detection</CardDescription>
          </CardHeader>
          <CardContent>
            <TooltipProvider>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Referrer</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Referred User</TableHead>
                    <TableHead>IP Address</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Fraud</TableHead>
                    <TableHead>Referrer Reward</TableHead>
                    <TableHead>Referred Reward</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.referrals.map((referral: any) => {
                    const ipMatch = hasIpMatch(referral);
                    return (
                      <TableRow key={referral.id} className={referral.fraud_flagged ? 'bg-destructive/5' : ''}>
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
                          <div className="flex items-center gap-1">
                            <code className="bg-muted px-2 py-1 rounded text-xs">
                              {referral.referred_ip || referral.referred?.signup_ip || '-'}
                            </code>
                            {ipMatch && (
                              <Tooltip>
                                <TooltipTrigger>
                                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>⚠️ IP matches referrer's signup IP</p>
                                </TooltipContent>
                              </Tooltip>
                            )}
                          </div>
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
                          {referral.fraud_flagged ? (
                            <Tooltip>
                              <TooltipTrigger>
                                <Badge variant="destructive" className="gap-1">
                                  <ShieldX className="h-3 w-3" /> Flagged
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{referral.fraud_reason || 'No reason provided'}</p>
                              </TooltipContent>
                            </Tooltip>
                          ) : (
                            <Badge variant="outline" className="gap-1 text-green-600 border-green-200">
                              <ShieldCheck className="h-3 w-3" /> Clean
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {referral.credits_earned > 0 ? (
                            <span className="font-medium text-green-600">+{referral.credits_earned}</span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {referral.reward_given_to_referred ? (
                            <Badge variant="default"><CheckCircle className="h-3 w-3 mr-1" /> Yes</Badge>
                          ) : (
                            <span className="text-muted-foreground">No</span>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {format(new Date(referral.created_at), 'MMM dd, yyyy')}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant={referral.fraud_flagged ? 'outline' : 'destructive'}
                            size="sm"
                            onClick={() => toggleFraudFlag.mutate({
                              id: referral.id,
                              flagged: !referral.fraud_flagged,
                            })}
                          >
                            {referral.fraud_flagged ? (
                              <><ShieldCheck className="h-3 w-3 mr-1" /> Unflag</>
                            ) : (
                              <><ShieldX className="h-3 w-3 mr-1" /> Flag</>
                            )}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {(!data?.referrals || data.referrals.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
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
