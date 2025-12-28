import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import { supabase } from '@/integrations/supabase/client';
import { 
  CreditCard, CheckCircle, Loader2, ShoppingCart, Plus, Minus, Trash2, 
  Sparkles, Zap, Star, RefreshCw, Clock, Calendar, Crown, ArrowRight
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

type PackageType = 'one_time' | 'subscription' | 'time_limited';

interface PricingPackage {
  id: string;
  credits: number;
  price: number;
  package_type: PackageType;
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
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { cart, addToCart, updateCartQuantity, removeFromCart, clearCart, getCartTotal, getCartCredits } = useCart();
  
  const [packages, setPackages] = useState<PricingPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<PackageType>('one_time');
  const [subscribing, setSubscribing] = useState<string | null>(null);
  
  // Cart dialog state
  const [showCartDialog, setShowCartDialog] = useState(false);

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

  const handleAddToCart = (plan: PricingPackage) => {
    addToCart({ id: plan.id, credits: plan.credits, price: plan.price });
    toast.success(`Added ${plan.credits} credits to cart`);
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
      // Use Stripe checkout
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
      // Add to cart like regular package
      handleAddToCart(plan);
    }
  };

  const handleCheckout = () => {
    if (cart.length === 0) {
      toast.error('Please add items to your cart first');
      return;
    }
    navigate('/dashboard/checkout');
  };

  const getPackagesByType = (type: PackageType) => 
    packages.filter(p => p.package_type === type);

  const getPackageCounts = () => ({
    one_time: getPackagesByType('one_time').length,
    subscription: getPackagesByType('subscription').length,
    time_limited: getPackagesByType('time_limited').length,
  });

  const counts = getPackageCounts();

  // Determine which tabs have packages
  const availableTabs = (Object.keys(PACKAGE_TYPE_CONFIG) as PackageType[]).filter(
    type => counts[type] > 0
  );

  // Set initial tab to first available
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
            Buy Credits
          </h1>
          <p className="text-muted-foreground mt-2 text-lg">
            Get credits to check your documents for similarity and AI content
          </p>
        </div>

        {/* Current Balance Card */}
        <Card className="overflow-hidden">
          <div className="gradient-primary p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4 text-primary-foreground">
                <div className="h-16 w-16 rounded-2xl bg-primary-foreground/20 backdrop-blur-sm flex items-center justify-center">
                  <CreditCard className="h-8 w-8" />
                </div>
                <div>
                  <p className="text-primary-foreground/80 text-sm font-medium">Current Balance</p>
                  <p className="text-4xl font-bold">{profile?.credit_balance || 0}</p>
                  <p className="text-primary-foreground/80 text-sm">Available Credits</p>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row items-center gap-3">
                {cart.length > 0 && (
                  <Badge variant="secondary" className="text-lg px-4 py-2 bg-primary-foreground/20 text-primary-foreground border-0">
                    <ShoppingCart className="h-4 w-4 mr-2" />
                    {getCartCredits()} credits in cart
                  </Badge>
                )}
                <Button 
                  variant="secondary" 
                  onClick={() => navigate('/dashboard/subscription')}
                  className="gap-2"
                >
                  <Crown className="h-4 w-4" />
                  Manage Subscription
                </Button>
              </div>
            </div>
          </div>
        </Card>

        {/* Cart Summary Bar */}
        {cart.length > 0 && (
          <Card className="border-2 border-primary/30 bg-primary/5">
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                    <ShoppingCart className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <p className="font-bold text-lg">{getCartCredits()} Credits</p>
                    <p className="text-muted-foreground">Total: ${getCartTotal()}</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setShowCartDialog(true)}>
                    View Cart ({cart.length})
                  </Button>
                  <Button 
                    onClick={handleCheckout}
                    className="bg-primary hover:bg-primary/90"
                  >
                    <CreditCard className="h-4 w-4 mr-2" />
                    Checkout
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

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
                const cartItem = cart.find(item => item.package.id === plan.id);
                const isPopular = index === getPackagesByType('one_time').length - 1;
                
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
                    
                    {cartItem && (
                      <Badge className="absolute -top-1 -left-1 bg-secondary text-secondary-foreground shadow-lg">
                        {cartItem.quantity} in cart
                      </Badge>
                    )}
                    
                    <CardHeader className="text-center pb-2">
                      <div className={`mx-auto h-12 w-12 rounded-xl flex items-center justify-center mb-2 ${isPopular ? 'bg-primary text-primary-foreground' : 'bg-muted text-primary'}`}>
                        {index === 0 ? <Zap className="h-5 w-5" /> : isPopular ? <Star className="h-5 w-5" /> : <Sparkles className="h-5 w-5" />}
                      </div>
                      <CardTitle className="text-lg">{plan.name || `${plan.credits} Credits`}</CardTitle>
                      <CardDescription>{plan.description || `${plan.credits} document checks`}</CardDescription>
                    </CardHeader>
                    
                    <CardContent className="space-y-4">
                      <div className="text-center">
                        <p className="text-4xl font-bold text-primary">${plan.price}</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          ${(plan.price / plan.credits).toFixed(2)} per credit
                        </p>
                      </div>

                      <ul className="space-y-2 text-sm">
                        {plan.features && plan.features.length > 0 ? (
                          plan.features.map((feature, i) => (
                            <li key={i} className="flex items-center gap-2">
                              <CheckCircle className="h-4 w-4 text-secondary flex-shrink-0" />
                              <span>{feature}</span>
                            </li>
                          ))
                        ) : (
                          <>
                            <li className="flex items-center gap-2">
                              <CheckCircle className="h-4 w-4 text-secondary flex-shrink-0" />
                              <span>Similarity Detection</span>
                            </li>
                            <li className="flex items-center gap-2">
                              <CheckCircle className="h-4 w-4 text-secondary flex-shrink-0" />
                              <span>AI Content Detection</span>
                            </li>
                            <li className="flex items-center gap-2">
                              <CheckCircle className="h-4 w-4 text-secondary flex-shrink-0" />
                              <span>Credits Never Expire</span>
                            </li>
                          </>
                        )}
                      </ul>

                      <Button
                        className="w-full"
                        variant={cartItem ? "secondary" : "default"}
                        onClick={() => handleAddToCart(plan)}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        {cartItem ? 'Add Another' : 'Add to Cart'}
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
                        <Crown className="h-5 w-5 text-green-600" />
                      </div>
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
              {getPackagesByType('time_limited').map((plan) => (
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
                      <Clock className="h-5 w-5 text-orange-600" />
                    </div>
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
                            <span>AI detection included</span>
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
              ))}
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

        {/* How it works */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">How to Purchase Credits</CardTitle>
            <CardDescription>
              Follow these simple steps to add credits to your account
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-8">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <span className="font-bold text-primary">1</span>
                  </div>
                  <h4 className="font-semibold">Choose a Plan</h4>
                </div>
                <p className="text-sm text-muted-foreground">
                  Select a one-time credit pack, subscription, or limited-time offer that suits your needs.
                </p>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <span className="font-bold text-primary">2</span>
                  </div>
                  <h4 className="font-semibold">Checkout</h4>
                </div>
                <p className="text-sm text-muted-foreground">
                  Complete your purchase using Card, Crypto, or other available payment methods.
                </p>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <span className="font-bold text-primary">3</span>
                  </div>
                  <h4 className="font-semibold">Get Credits</h4>
                </div>
                <p className="text-sm text-muted-foreground">
                  Your credits will be added to your account instantly after payment confirmation.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Cart Dialog */}
      <Dialog open={showCartDialog} onOpenChange={setShowCartDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              Your Cart
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {cart.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">Your cart is empty</p>
            ) : (
              <>
                {cart.map((item) => (
                  <div key={item.package.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div>
                      <p className="font-medium">{item.package.credits} Credits</p>
                      <p className="text-sm text-muted-foreground">${item.package.price} × {item.quantity}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => updateCartQuantity(item.package.id, item.quantity - 1)}
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="w-8 text-center">{item.quantity}</span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => updateCartQuantity(item.package.id, item.quantity + 1)}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => removeFromCart(item.package.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}

                <div className="border-t pt-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Total Credits</span>
                    <span className="font-medium">{getCartCredits()}</span>
                  </div>
                  <div className="flex justify-between text-lg font-bold">
                    <span>Total</span>
                    <span className="text-primary">${getCartTotal()}</span>
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button 
                    variant="outline" 
                    className="flex-1"
                    onClick={() => {
                      clearCart();
                      setShowCartDialog(false);
                    }}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Clear
                  </Button>
                  <Button 
                    className="flex-1"
                    onClick={() => {
                      setShowCartDialog(false);
                      handleCheckout();
                    }}
                  >
                    <CreditCard className="h-4 w-4 mr-2" />
                    Checkout
                  </Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
