import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Crown, CreditCard, Calendar, ExternalLink, RefreshCw, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface SubscriptionData {
  subscribed: boolean;
  product_id: string | null;
  subscription_end: string | null;
}

interface PricingPackage {
  id: string;
  name: string | null;
  credits: number;
  price: number;
  description: string | null;
  features: string[] | null;
  package_type: string;
  billing_interval: string | null;
  stripe_price_id: string | null;
  stripe_product_id: string | null;
  is_active: boolean;
}

const SubscriptionManagement = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [subscribeLoading, setSubscribeLoading] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [packages, setPackages] = useState<PricingPackage[]>([]);

  const fetchPackages = async () => {
    try {
      const { data, error } = await supabase
        .from('pricing_packages')
        .select('*')
        .eq('is_active', true)
        .eq('package_type', 'subscription')
        .order('price', { ascending: true });

      if (error) throw error;
      setPackages(data || []);
    } catch (err) {
      console.error('Error fetching packages:', err);
    }
  };

  const checkSubscription = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase.functions.invoke('check-subscription');
      
      if (error) {
        console.error('Error checking subscription:', error);
        return;
      }

      setSubscription(data);
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    Promise.all([checkSubscription(), fetchPackages()]);
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await checkSubscription();
    toast({
      title: "Subscription status refreshed",
      description: "Your subscription information is up to date.",
    });
  };

  const handleManageSubscription = async () => {
    setPortalLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('customer-portal');
      
      if (error) {
        throw new Error(error.message);
      }

      if (data?.url) {
        window.open(data.url, '_blank');
      }
    } catch (err) {
      console.error('Error opening portal:', err);
      toast({
        title: "Error",
        description: "Failed to open subscription management. Please try again.",
        variant: "destructive",
      });
    } finally {
      setPortalLoading(false);
    }
  };

  const handleSubscribe = async (priceId: string, packageId: string) => {
    setSubscribeLoading(packageId);
    try {
      const { data, error } = await supabase.functions.invoke('create-stripe-checkout', {
        body: { priceId, mode: 'subscription' },
      });
      
      if (error) {
        throw new Error(error.message);
      }

      if (data?.url) {
        window.open(data.url, '_blank');
      }
    } catch (err) {
      console.error('Error creating checkout:', err);
      toast({
        title: "Error",
        description: "Failed to start subscription checkout. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSubscribeLoading(null);
    }
  };

  // Find current plan from packages
  const currentPlan = packages.find(pkg => pkg.stripe_product_id === subscription?.product_id);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
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
            <h1 className="text-2xl font-bold">Subscription Management</h1>
            <p className="text-muted-foreground">Manage your subscription plan and billing</p>
          </div>
          <Button variant="outline" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Current Subscription Status */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Crown className="h-6 w-6 text-primary" />
                <div>
                  <CardTitle>Current Plan</CardTitle>
                  <CardDescription>Your active subscription details</CardDescription>
                </div>
              </div>
              {subscription?.subscribed && (
                <Badge variant="default" className="bg-green-500">
                  Active
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {subscription?.subscribed && currentPlan ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 bg-muted rounded-lg">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                      <Sparkles className="h-4 w-4" />
                      Plan Name
                    </div>
                    <p className="text-lg font-semibold">{currentPlan.name}</p>
                  </div>
                  <div className="p-4 bg-muted rounded-lg">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                      <CreditCard className="h-4 w-4" />
                      Monthly Credits
                    </div>
                    <p className="text-lg font-semibold">{currentPlan.credits} credits</p>
                  </div>
                  <div className="p-4 bg-muted rounded-lg">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                      <Calendar className="h-4 w-4" />
                      Next Billing Date
                    </div>
                    <p className="text-lg font-semibold">
                      {subscription.subscription_end 
                        ? format(new Date(subscription.subscription_end), 'MMM d, yyyy')
                        : 'N/A'}
                    </p>
                  </div>
                </div>
                
                <Button onClick={handleManageSubscription} disabled={portalLoading} className="w-full md:w-auto">
                  {portalLoading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <ExternalLink className="h-4 w-4 mr-2" />
                  )}
                  Manage Subscription
                </Button>
              </div>
            ) : (
              <div className="text-center py-8">
                <Crown className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Active Subscription</h3>
                <p className="text-muted-foreground mb-4">
                  Subscribe to a plan to get monthly credits automatically
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Available Plans - Only show if there are packages from admin */}
        {packages.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Available Plans</CardTitle>
              <CardDescription>Choose a subscription plan that fits your needs</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {packages.map((pkg) => {
                  const isCurrentPlan = pkg.stripe_product_id === subscription?.product_id;
                  
                  return (
                    <Card 
                      key={pkg.id} 
                      className={`relative ${isCurrentPlan ? 'border-primary ring-2 ring-primary' : ''}`}
                    >
                      {isCurrentPlan && (
                        <Badge className="absolute -top-2 -right-2 bg-primary">Your Plan</Badge>
                      )}
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Crown className="h-5 w-5 text-primary" />
                          {pkg.name || `${pkg.credits} Credits Plan`}
                        </CardTitle>
                        {pkg.description && (
                          <CardDescription>{pkg.description}</CardDescription>
                        )}
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="text-3xl font-bold">
                          ${pkg.price}
                          <span className="text-sm font-normal text-muted-foreground">
                            /{pkg.billing_interval || 'month'}
                          </span>
                        </div>
                        <ul className="space-y-2 text-sm">
                          <li className="flex items-center gap-2">
                            <Sparkles className="h-4 w-4 text-primary" />
                            {pkg.credits} credits per {pkg.billing_interval || 'month'}
                          </li>
                          {pkg.features?.map((feature, index) => (
                            <li key={index} className="flex items-center gap-2">
                              <Sparkles className="h-4 w-4 text-primary" />
                              {feature}
                            </li>
                          ))}
                        </ul>
                        {isCurrentPlan ? (
                          <Button variant="outline" className="w-full" disabled>
                            Current Plan
                          </Button>
                        ) : (
                          <Button 
                            className="w-full" 
                            onClick={() => pkg.stripe_price_id && handleSubscribe(pkg.stripe_price_id, pkg.id)}
                            disabled={subscribeLoading === pkg.id || !pkg.stripe_price_id}
                          >
                            {subscribeLoading === pkg.id ? (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : null}
                            Subscribe Now
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}

                {/* One-time Purchase Card */}
                <Card className="border-dashed">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <CreditCard className="h-5 w-5 text-muted-foreground" />
                      One-Time Purchase
                    </CardTitle>
                    <CardDescription>Buy credits without a subscription</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      Prefer to buy credits as you need them? Check out our credit packages.
                    </p>
                    <Button variant="outline" className="w-full" onClick={() => window.location.href = '/dashboard/credits'}>
                      View Credit Packages
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Show only one-time purchase if no subscription packages */}
        {packages.length === 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-muted-foreground" />
                Buy Credits
              </CardTitle>
              <CardDescription>Purchase credits without a subscription</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Check out our available credit packages.
              </p>
              <Button variant="outline" onClick={() => window.location.href = '/dashboard/credits'}>
                View Credit Packages
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
};

export default SubscriptionManagement;
