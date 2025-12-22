import React, { useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { 
  Gift, 
  Copy, 
  Users, 
  CheckCircle,
  Share2,
  Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';

const REFERRAL_BONUS = 5; // Credits given for successful referral

export default function ReferralProgram() {
  const { user, profile } = useAuth();
  const [referralCode, setReferralCode] = useState('');

  // Fetch user's referral code and stats
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['my-referrals', user?.id],
    queryFn: async () => {
      if (!user) return null;

      // Get user's profile with referral code
      const { data: profileData } = await supabase
        .from('profiles')
        .select('referral_code')
        .eq('id', user.id)
        .single();

      // Get referrals made by this user
      const { data: referrals } = await supabase
        .from('referrals')
        .select('*')
        .eq('referrer_id', user.id)
        .order('created_at', { ascending: false });

      // Get referred user profiles
      const referredIds = referrals?.filter(r => r.referred_user_id).map(r => r.referred_user_id) || [];
      const { data: referredProfiles } = await supabase
        .from('profiles')
        .select('id, email, full_name')
        .in('id', referredIds);

      const referredMap = new Map(referredProfiles?.map(p => [p.id, p]) || []);

      const enrichedReferrals = referrals?.map(r => ({
        ...r,
        referred: r.referred_user_id ? referredMap.get(r.referred_user_id) : null
      })) || [];

      const completedCount = enrichedReferrals.filter(r => r.status === 'completed').length;
      const totalEarned = enrichedReferrals.reduce((sum, r) => sum + (r.credits_earned || 0), 0);

      return {
        myCode: profileData?.referral_code || '',
        referrals: enrichedReferrals,
        stats: {
          total: enrichedReferrals.length,
          completed: completedCount,
          totalEarned
        }
      };
    },
    enabled: !!user
  });

  const copyReferralLink = () => {
    const link = `${window.location.origin}/auth?ref=${data?.myCode}`;
    navigator.clipboard.writeText(link);
    toast.success('Referral link copied to clipboard!');
  };

  const shareReferral = async () => {
    const link = `${window.location.origin}/auth?ref=${data?.myCode}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join PlagaiScans!',
          text: `Use my referral code ${data?.myCode} to get bonus credits!`,
          url: link
        });
      } catch (err) {
        copyReferralLink();
      }
    } else {
      copyReferralLink();
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
        <div>
          <h1 className="text-3xl font-display font-bold">Referral Program</h1>
          <p className="text-muted-foreground">
            Earn {REFERRAL_BONUS} credits for every friend who signs up and makes their first purchase!
          </p>
        </div>

        {/* Referral Code Card */}
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Gift className="h-5 w-5 text-primary" />
              Your Referral Code
            </CardTitle>
            <CardDescription>
              Share this code with friends to earn bonus credits
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input 
                value={data?.myCode || ''} 
                readOnly 
                className="font-mono text-lg font-bold text-center"
              />
              <Button onClick={copyReferralLink} variant="outline">
                <Copy className="h-4 w-4" />
              </Button>
              <Button onClick={shareReferral}>
                <Share2 className="h-4 w-4 mr-2" />
                Share
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Your referral link: <code className="bg-muted px-2 py-1 rounded text-xs">
                {window.location.origin}/auth?ref={data?.myCode}
              </code>
            </p>
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Referrals</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data?.stats.total || 0}</div>
              <p className="text-xs text-muted-foreground">Friends invited</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Completed</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data?.stats.completed || 0}</div>
              <p className="text-xs text-muted-foreground">Successful referrals</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Credits Earned</CardTitle>
              <Gift className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">+{data?.stats.totalEarned || 0}</div>
              <p className="text-xs text-muted-foreground">From referrals</p>
            </CardContent>
          </Card>
        </div>

        {/* How it works */}
        <Card>
          <CardHeader>
            <CardTitle>How It Works</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="text-center space-y-2">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                  <span className="text-xl font-bold text-primary">1</span>
                </div>
                <h3 className="font-medium">Share Your Code</h3>
                <p className="text-sm text-muted-foreground">
                  Send your unique referral code to friends
                </p>
              </div>
              <div className="text-center space-y-2">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                  <span className="text-xl font-bold text-primary">2</span>
                </div>
                <h3 className="font-medium">Friend Signs Up</h3>
                <p className="text-sm text-muted-foreground">
                  They create an account using your code
                </p>
              </div>
              <div className="text-center space-y-2">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                  <span className="text-xl font-bold text-primary">3</span>
                </div>
                <h3 className="font-medium">Earn Credits</h3>
                <p className="text-sm text-muted-foreground">
                  Get {REFERRAL_BONUS} credits when they make their first purchase
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Referral History */}
        <Card>
          <CardHeader>
            <CardTitle>Your Referrals</CardTitle>
          </CardHeader>
          <CardContent>
            {data?.referrals && data.referrals.length > 0 ? (
              <div className="space-y-3">
                {data.referrals.map((referral) => (
                  <div key={referral.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div>
                      <p className="font-medium">
                        {referral.referred?.full_name || referral.referred?.email || 'Pending signup'}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(referral.created_at), 'MMM dd, yyyy')}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant={referral.status === 'completed' ? 'default' : 'secondary'}>
                        {referral.status === 'completed' ? 'Completed' : 'Pending'}
                      </Badge>
                      {referral.credits_earned > 0 && (
                        <span className="font-medium text-green-600">+{referral.credits_earned}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">
                No referrals yet. Share your code to start earning!
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
