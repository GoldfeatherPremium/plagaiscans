import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { 
  CreditCard, CheckCircle, Loader2, 
  Sparkles, Zap, Star, RefreshCw, Clock, Calendar, Crown, ArrowRight, FileText,
  ScanSearch
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTranslation } from 'react-i18next';


type PackageType = 'one_time' | 'subscription' | 'time_limited';
type CreditType = 'full' | 'similarity_only';

interface PricingPackage {
  id: string;
  credits: number;
  price: number;
  package_type: PackageType;
  credit_type: CreditType;
  billing_interval: string | null;
  validity_days: number | null;
  stripe_price_id: string | null;
  stripe_product_id: string | null;
  name: string | null;
  description: string | null;
  features: string[];
}

const PACKAGE_TYPE_CONFIG = {
  one_time: {
    label: 'One-Time',
    icon: CreditCard,
    color: 'bg-blue-500',
    tabLabel: 'Credit Packs',
  },
  subscription: {
    label: 'Subscription',
    icon: RefreshCw,
    color: 'bg-green-500',
    tabLabel: 'Subscriptions',
  },
  time_limited: {
    label: 'Limited Offer',
    icon: Clock,
    color: 'bg-orange-500',
    tabLabel: 'Limited Time',
  },
};

export default function BuyCredits() {
  const { t } = useTranslation('dashboard');
  const navigate = useNavigate();
  const { profile } = useAuth();
  
  const [packages, setPackages] = useState<PricingPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<PackageType>('one_time');
  const [creditTypeTab, setCreditTypeTab] = useState<CreditType>('full');
  const [subscribing, setSubscribing] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      const { data: packagesData } = await supabase
        .from('pricing_packages')
        .select('*')
        .eq('is_active', true)
        .order('price', { ascending: true });
      
      setPackages((packagesData as PricingPackage[]) || []);
      setLoading(false);
    };
    fetchData();
  }, []);

  const handleBuyNow = (plan: PricingPackage) => {
    navigate(`/dashboard/checkout?packageId=${plan.id}`);
  };

  const handleSubscribe = async (plan: PricingPackage) => {
    if (!plan.stripe_price_id) {
      toast.error('Subscription not configured. Please contact support.');
      return;
    }

    setSubscribing(plan.id);
    try {
      const { data, error } = await supabase.functions.invoke('create-stripe-checkout', {
        body: { 
          priceId: plan.stripe_price_id, 
          credits: plan.credits,
          mode: 'subscription' 
        },
      });

      if (error) throw error;

      if (data?.url) {
        window.open(data.url, '_blank');
      }
    } catch (err) {
      console.error('Subscription error:', err);
      toast.error('Failed to start subscription. Please try again.');
    } finally {
      setSubscribing(null);
    }
  };

  const handleBuyTimeLimited = async (plan: PricingPackage) => {
    if (plan.stripe_price_id) {
      setSubscribing(plan.id);
      try {
        const { data, error } = await supabase.functions.invoke('create-stripe-checkout', {
          body: { 
            priceId: plan.stripe_price_id, 
            credits: plan.credits,
            mode: 'payment' 
          },
        });

        if (error) throw error;

        if (data?.url) {
          window.open(data.url, '_blank');
        }
      } catch (err) {
        console.error('Purchase error:', err);
        toast.error('Failed to process. Please try again.');
      } finally {
        setSubscribing(null);
      }
    } else {
      handleBuyNow(plan);
    }
  };

  const getPackagesByType = (type: PackageType) => 
    packages.filter(p => p.package_type === type && (p.credit_type || 'full') === creditTypeTab);

  const getPackageCounts = () => ({
    one_time: packages.filter(p => p.package_type === 'one_time' && (p.credit_type || 'full') === creditTypeTab).length,
    subscription: packages.filter(p => p.package_type === 'subscription' && (p.credit_type || 'full') === creditTypeTab).length,
    time_limited: packages.filter(p => p.package_type === 'time_limited' && (p.credit_type || 'full') === creditTypeTab).length,
  });

  const getCreditTypeConfig = (creditType: CreditType) => {
    if (creditType === 'similarity_only') {
      return {
        icon: ScanSearch,
        bgColor: 'bg-blue-500/10',
        textColor: 'text-blue-600',
        accentColor: 'text-blue-500',
        label: 'Similarity Only',
      };
    }
    return {
      icon: Sparkles,
      bgColor: 'bg-primary/10',
      textColor: 'text-primary',
      accentColor: 'text-secondary',
      label: 'AI Scan',
    };
  };

  const counts = getPackageCounts();

  const availableTabs = (Object.keys(PACKAGE_TYPE_CONFIG) as PackageType[]).filter(
    type => counts[type] > 0
  );

  useEffect(() => {
    if (availableTabs.length > 0 && !availableTabs.includes(activeTab)) {
      setActiveTab(availableTabs[0]);
    }
  }, [availableTabs]);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl font-display font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            {t('credits.title')}
          </h1>
          <p className="text-muted-foreground mt-2 text-lg">
            {t('credits.subtitle')}
          </p>
        </div>

        {/* Current Balance */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-6">
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">AI Scan</p>
                  <p className="text-2xl font-bold">{profile?.credit_balance || 0}</p>
                </div>
                <div className="h-8 w-px bg-border" />
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Similarity</p>
                  <p className="text-2xl font-bold">{profile?.similarity_credit_balance || 0}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Credit Type Selector */}
        <Tabs value={creditTypeTab} onValueChange={(v) => setCreditTypeTab(v as CreditType)} className="w-full">
          <TabsList className="grid w-full grid-cols-2 h-auto">
            <TabsTrigger value="full" className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 py-3 px-2 sm:px-4 text-xs sm:text-sm">
              <Sparkles className="h-4 w-4 flex-shrink-0" />
              <span className="whitespace-nowrap">AI Scan Credits</span>
            </TabsTrigger>
            <TabsTrigger value="similarity_only" className="flex flex-col sm:flex-row items-center gap-1 sm:gap-2 py-3 px-2 sm:px-4 text-xs sm:text-sm">
              <FileText className="h-4 w-4 flex-shrink-0" />
              <span className="whitespace-nowrap">Similarity Only</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Package Type Tabs */}
        {availableTabs.length > 1 && (
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as PackageType)}>
            <TabsList className="grid w-full" style={{ gridTemplateColumns: `repeat(${availableTabs.length}, 1fr)` }}>
              {availableTabs.map(type => {
                const config = PACKAGE_TYPE_CONFIG[type];
                const Icon = config.icon;
                return (
                  <TabsTrigger key={type} value={type} className="gap-2">
                    <Icon className="h-4 w-4" />
                    {config.tabLabel}
                    <Badge variant="secondary" className="ml-1">{counts[type]}</Badge>
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </Tabs>
        )}

        {/* One-Time Packages */}
        {activeTab === 'one_time' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CreditCard className="h-4 w-4" />
              <span>One-time purchase • Credits never expire</span>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {getPackagesByType('one_time').map((plan, index) => {
                const isPopular = index === getPackagesByType('one_time').length - 1;
                const creditConfig = getCreditTypeConfig((plan.credit_type || 'full') as CreditType);
                const CreditIcon = creditConfig.icon;
                
                return (
                  <Card 
                    key={plan.id} 
                    className={`relative overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-1 ${
                      isPopular 
                        ? 'border-2 border-primary bg-gradient-to-br from-primary/5 via-transparent to-secondary/5' 
                        : 'border border-border hover:border-primary/50'
                    }`}
                  >
                    {isPopular && (
                      <div className="absolute top-0 right-0">
                        <Badge className="rounded-none rounded-bl-lg bg-primary text-primary-foreground">
                          Best Value
                        </Badge>
                      </div>
                    )}
                    
                    <CardHeader className="text-center pb-2">
                      <div className={`mx-auto h-12 w-12 rounded-xl flex items-center justify-center mb-2 ${isPopular ? 'bg-primary text-primary-foreground' : creditConfig.bgColor + ' ' + creditConfig.textColor}`}>
                        {isPopular ? <Star className="h-5 w-5" /> : <CreditIcon className="h-5 w-5" />}
                      </div>
                      <Badge variant="outline" className={`mx-auto mb-2 text-xs ${creditConfig.textColor}`}>
                        {creditConfig.label}
                      </Badge>
                      <CardTitle className="text-lg">{plan.name || `${plan.credits} Credits`}</CardTitle>
                      <CardDescription>{plan.description || `${plan.credits} document checks`}</CardDescription>
                    </CardHeader>
                    
                    <CardContent className="space-y-4">
                      <div className="text-center">
                        <p className={`text-4xl font-bold ${creditConfig.textColor}`}>${plan.price}</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          ${(plan.price / plan.credits).toFixed(2)} per credit
                        </p>
                      </div>

                      <ul className="space-y-2 text-sm">
                        {plan.features && plan.features.length > 0 ? (
                          plan.features.map((feature, i) => (
                            <li key={i} className="flex items-center gap-2">
                              <CheckCircle className={`h-4 w-4 ${creditConfig.accentColor} flex-shrink-0`} />
                              <span>{feature}</span>
                            </li>
                          ))
                        ) : creditTypeTab === 'similarity_only' ? (
                          <>
                            <li className="flex items-center gap-2">
                              <CheckCircle className={`h-4 w-4 ${creditConfig.accentColor} flex-shrink-0`} />
                              <span>Similarity Detection</span>
                            </li>
                            <li className="flex items-center gap-2">
                              <CheckCircle className={`h-4 w-4 ${creditConfig.accentColor} flex-shrink-0`} />
                              <span>Fast Processing</span>
                            </li>
                            <li className="flex items-center gap-2">
                              <CheckCircle className={`h-4 w-4 ${creditConfig.accentColor} flex-shrink-0`} />
                              <span>Credits Never Expire</span>
                            </li>
                          </>
                        ) : (
                          <>
                            <li className="flex items-center gap-2">
                              <CheckCircle className={`h-4 w-4 ${creditConfig.accentColor} flex-shrink-0`} />
                              <span>Similarity Detection</span>
                            </li>
                            <li className="flex items-center gap-2">
                              <CheckCircle className={`h-4 w-4 ${creditConfig.accentColor} flex-shrink-0`} />
                              <span>AI Content Detection</span>
                            </li>
                            <li className="flex items-center gap-2">
                              <CheckCircle className={`h-4 w-4 ${creditConfig.accentColor} flex-shrink-0`} />
                              <span>Credits Never Expire</span>
                            </li>
                          </>
                        )}
                      </ul>

                      <Button
                        className="w-full"
                        onClick={() => handleBuyNow(plan)}
                      >
                        <CreditCard className="h-4 w-4 mr-2" />
                        Buy Now
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* Subscription Packages */}
        {activeTab === 'subscription' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <RefreshCw className="h-4 w-4" />
              <span>Recurring plans • Automatic credit renewal • Cancel anytime</span>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {getPackagesByType('subscription').map((plan, index) => {
                const isPopular = index === Math.floor(getPackagesByType('subscription').length / 2);
                const creditConfig = getCreditTypeConfig((plan.credit_type || 'full') as CreditType);
                const CreditIcon = creditConfig.icon;
                
                return (
                  <Card 
                    key={plan.id} 
                    className={`relative overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-1 ${
                      isPopular 
                        ? 'border-2 border-green-500 bg-gradient-to-br from-green-500/5 via-transparent to-emerald-500/5' 
                        : 'border border-border hover:border-green-500/50'
                    }`}
                  >
                    <div className="absolute top-0 left-0 right-0 h-1 bg-green-500" />
                    
                    {isPopular && (
                      <div className="absolute top-0 right-0">
                        <Badge className="rounded-none rounded-bl-lg bg-green-500 text-white">
                          Popular
                        </Badge>
                      </div>
                    )}
                    
                    <CardHeader className="text-center pb-2">
                      <div className="mx-auto h-12 w-12 rounded-xl bg-green-500/10 flex items-center justify-center mb-2">
                        <CreditIcon className="h-5 w-5 text-green-600" />
                      </div>
                      <Badge variant="outline" className={`mx-auto mb-2 text-xs ${creditConfig.textColor}`}>
                        {creditConfig.label}
                      </Badge>
                      <CardTitle className="text-lg">{plan.name || `${plan.credits} Credits/mo`}</CardTitle>
                      <CardDescription>{plan.description || 'Monthly subscription'}</CardDescription>
                    </CardHeader>
                    
                    <CardContent className="space-y-4">
                      <div className="text-center">
                        <p className="text-4xl font-bold text-green-600">
                          ${plan.price}
                          <span className="text-sm font-normal text-muted-foreground">
                            /{plan.billing_interval || 'month'}
                          </span>
                        </p>
                        <p className="text-sm text-muted-foreground mt-1">
                          {plan.credits} credits per {plan.billing_interval || 'month'}
                        </p>
                      </div>

                      <ul className="space-y-2 text-sm">
                        {plan.features && plan.features.length > 0 ? (
                          plan.features.map((feature, i) => (
                            <li key={i} className="flex items-center gap-2">
                              <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                              <span>{feature}</span>
                            </li>
                          ))
                        ) : (
                          <>
                            <li className="flex items-center gap-2">
                              <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                              <span>{plan.credits} credits every {plan.billing_interval}</span>
                            </li>
                            <li className="flex items-center gap-2">
                              <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                              <span>Automatic renewal</span>
                            </li>
                            <li className="flex items-center gap-2">
                              <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                              <span>Cancel anytime</span>
                            </li>
                          </>
                        )}
                      </ul>

                      <Button
                        className="w-full bg-green-600 hover:bg-green-700"
                        onClick={() => handleSubscribe(plan)}
                        disabled={subscribing === plan.id}
                      >
                        {subscribing === plan.id ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <ArrowRight className="h-4 w-4 mr-2" />
                        )}
                        Subscribe Now
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* Time-Limited Packages */}
        {activeTab === 'time_limited' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>Limited time offers • Credits expire after validity period</span>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {getPackagesByType('time_limited').map((plan) => {
                const creditConfig = getCreditTypeConfig((plan.credit_type || 'full') as CreditType);
                const CreditIcon = creditConfig.icon;
                
                return (
                  <Card 
                    key={plan.id} 
                    className="relative overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-1 border-2 border-orange-500/50 bg-gradient-to-br from-orange-500/5 via-transparent to-amber-500/5"
                  >
                    <div className="absolute top-0 left-0 right-0 h-1 bg-orange-500" />
                    
                    <div className="absolute top-0 right-0">
                      <Badge className="rounded-none rounded-bl-lg bg-orange-500 text-white gap-1">
                        <Clock className="h-3 w-3" />
                        {plan.validity_days} days
                      </Badge>
                    </div>
                    
                    <CardHeader className="text-center pb-2 pt-8">
                      <div className="mx-auto h-12 w-12 rounded-xl bg-orange-500/10 flex items-center justify-center mb-2">
                        <CreditIcon className="h-5 w-5 text-orange-600" />
                      </div>
                      <Badge variant="outline" className={`mx-auto mb-2 text-xs ${creditConfig.textColor}`}>
                        {creditConfig.label}
                      </Badge>
                      <CardTitle className="text-lg">{plan.name || `${plan.credits} Credits`}</CardTitle>
                      <CardDescription>{plan.description || 'Limited time offer'}</CardDescription>
                    </CardHeader>
                  
                  <CardContent className="space-y-4">
                    <div className="text-center">
                      <p className="text-4xl font-bold text-orange-600">${plan.price}</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Valid for {plan.validity_days} days
                      </p>
                    </div>

                    <div className="p-3 bg-orange-50 dark:bg-orange-950/20 rounded-lg border border-orange-200 dark:border-orange-800">
                      <div className="flex items-center gap-2 text-orange-700 dark:text-orange-400">
                        <Calendar className="h-4 w-4" />
                        <span className="text-sm font-medium">
                          Expires {plan.validity_days} days after purchase
                        </span>
                      </div>
                    </div>

                    <ul className="space-y-2 text-sm">
                      {plan.features && plan.features.length > 0 ? (
                        plan.features.map((feature, i) => (
                          <li key={i} className="flex items-center gap-2">
                            <CheckCircle className="h-4 w-4 text-orange-500 flex-shrink-0" />
                            <span>{feature}</span>
                          </li>
                        ))
                      ) : (
                        <>
                          <li className="flex items-center gap-2">
                            <CheckCircle className="h-4 w-4 text-orange-500 flex-shrink-0" />
                            <span>{plan.credits} document checks</span>
                          </li>
                          <li className="flex items-center gap-2">
                            <CheckCircle className="h-4 w-4 text-orange-500 flex-shrink-0" />
                            <span>Full similarity report</span>
                          </li>
                          <li className="flex items-center gap-2">
                            <CheckCircle className="h-4 w-4 text-orange-500 flex-shrink-0" />
                            <span>Content analysis included</span>
                          </li>
                        </>
                      )}
                    </ul>

                    <Button
                      className="w-full bg-orange-600 hover:bg-orange-700"
                      onClick={() => handleBuyTimeLimited(plan)}
                      disabled={subscribing === plan.id}
                    >
                      {subscribing === plan.id ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Zap className="h-4 w-4 mr-2" />
                      )}
                      Buy Now
                    </Button>
                  </CardContent>
                </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* Empty state */}
        {packages.length === 0 && (
          <Card className="border-dashed">
            <CardContent className="py-12 text-center">
              <CreditCard className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No packages available</h3>
              <p className="text-muted-foreground">Please check back later for available credit packages.</p>
            </CardContent>
          </Card>
        )}

      </div>
    </DashboardLayout>
  );
}
