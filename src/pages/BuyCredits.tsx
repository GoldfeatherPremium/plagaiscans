import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import { supabase } from '@/integrations/supabase/client';
import { CreditCard, CheckCircle, Loader2, ShoppingCart, Plus, Minus, Trash2, Sparkles, Zap, Star } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';

interface PricingPackage {
  id: string;
  credits: number;
  price: number;
}

export default function BuyCredits() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { cart, addToCart, updateCartQuantity, removeFromCart, clearCart, getCartTotal, getCartCredits } = useCart();
  
  const [packages, setPackages] = useState<PricingPackage[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Cart dialog state
  const [showCartDialog, setShowCartDialog] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      const { data: packagesData } = await supabase
        .from('pricing_packages')
        .select('*')
        .eq('is_active', true)
        .order('credits', { ascending: true });
      
      setPackages(packagesData || []);
      setLoading(false);
    };
    fetchData();
  }, []);

  const handleAddToCart = (plan: PricingPackage) => {
    addToCart(plan);
    toast.success(`Added ${plan.credits} credits to cart`);
  };

  const handleCheckout = () => {
    if (cart.length === 0) {
      toast.error('Please add items to your cart first');
      return;
    }
    navigate('/dashboard/checkout');
  };

  const getPackageIcon = (index: number) => {
    if (index === 0) return <Zap className="h-5 w-5" />;
    if (index === packages.length - 1) return <Star className="h-5 w-5" />;
    return <Sparkles className="h-5 w-5" />;
  };

  const getPackageStyle = (index: number) => {
    if (index === packages.length - 1) {
      return 'border-2 border-primary bg-gradient-to-br from-primary/5 via-transparent to-secondary/5';
    }
    return 'border border-border hover:border-primary/50';
  };

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
              {cart.length > 0 && (
                <div className="flex flex-col items-center sm:items-end gap-2">
                  <Badge variant="secondary" className="text-lg px-4 py-2 bg-primary-foreground/20 text-primary-foreground border-0">
                    <ShoppingCart className="h-4 w-4 mr-2" />
                    {getCartCredits()} credits in cart
                  </Badge>
                  <p className="text-primary-foreground/80 text-sm">Total: ${getCartTotal()}</p>
                </div>
              )}
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

        {/* Pricing Packages Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {packages.map((plan, index) => {
            const cartItem = cart.find(item => item.package.id === plan.id);
            const isPopular = index === packages.length - 1;
            
            return (
              <Card 
                key={plan.id} 
                className={`relative overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-1 ${getPackageStyle(index)}`}
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
                    {getPackageIcon(index)}
                  </div>
                  <CardTitle className="text-3xl font-bold">
                    {plan.credits}
                  </CardTitle>
                  <CardDescription className="text-lg">
                    {plan.credits === 1 ? 'Credit' : 'Credits'}
                  </CardDescription>
                </CardHeader>
                
                <CardContent className="space-y-4">
                  <div className="text-center">
                    <p className="text-4xl font-bold text-primary">${plan.price}</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      ${(plan.price / plan.credits).toFixed(2)} per credit
                    </p>
                  </div>

                  <ul className="space-y-2 text-sm">
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
                      <span>Detailed PDF Reports</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-secondary flex-shrink-0" />
                      <span>Credits Never Expire</span>
                    </li>
                  </ul>

                  <div className="pt-2">
                    <Button
                      className="w-full"
                      variant={cartItem ? "secondary" : "default"}
                      onClick={() => handleAddToCart(plan)}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      {cartItem ? 'Add Another' : 'Add to Cart'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

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
                  <h4 className="font-semibold">Choose Credits</h4>
                </div>
                <p className="text-sm text-muted-foreground">
                  Select the credit package that suits your needs and add it to your cart.
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
                  Go to checkout and choose your preferred payment method (Card, Binance, USDT, etc.)
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
                  Your credits will be added to your account after payment verification.
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