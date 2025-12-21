import React, { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useWhatsApp } from '@/hooks/useWhatsApp';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import { supabase } from '@/integrations/supabase/client';
import { MessageCircle, CreditCard, CheckCircle, Loader2, Bitcoin, Copy, ExternalLink, RefreshCw, Wallet, ShoppingCart, Plus, Minus, Trash2, Sparkles, Zap, Star, Globe } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';

interface PricingPackage {
  id: string;
  credits: number;
  price: number;
}

interface PaymentDetails {
  paymentId: string;
  payAddress: string;
  payAmount: number;
  payCurrency: string;
  status: string;
}

export default function BuyCredits() {
  const { profile, user } = useAuth();
  const { openWhatsApp } = useWhatsApp();
  const { cart, addToCart, updateCartQuantity, removeFromCart, clearCart, getCartTotal, getCartCredits } = useCart();
  
  const [packages, setPackages] = useState<PricingPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [creatingPayment, setCreatingPayment] = useState<string | null>(null);
  const [paymentDetails, setPaymentDetails] = useState<PaymentDetails | null>(null);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [whatsappEnabled, setWhatsappEnabled] = useState(true);
  const [usdtEnabled, setUsdtEnabled] = useState(true);
  const [binanceEnabled, setBinanceEnabled] = useState(false);
  const [vivaEnabled, setVivaEnabled] = useState(false);
  const [binancePayId, setBinancePayId] = useState('');
  const [showBinanceDialog, setShowBinanceDialog] = useState(false);
  const [submittingBinance, setSubmittingBinance] = useState(false);
  
  // Cart dialog state
  const [showCartDialog, setShowCartDialog] = useState(false);
  
  // Binance order ID state
  const [binanceOrderId, setBinanceOrderId] = useState('');
  const [showOrderIdStep, setShowOrderIdStep] = useState(false);
  
  // Viva payment state
  const [creatingVivaPayment, setCreatingVivaPayment] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      const { data: packagesData } = await supabase
        .from('pricing_packages')
        .select('*')
        .eq('is_active', true)
        .order('credits', { ascending: true });
      
      setPackages(packagesData || []);

      const { data: settings } = await supabase
        .from('settings')
        .select('key, value')
        .in('key', ['payment_whatsapp_enabled', 'payment_usdt_enabled', 'payment_binance_enabled', 'payment_viva_enabled', 'binance_pay_id']);

      if (settings) {
        const whatsapp = settings.find(s => s.key === 'payment_whatsapp_enabled');
        const usdt = settings.find(s => s.key === 'payment_usdt_enabled');
        const binance = settings.find(s => s.key === 'payment_binance_enabled');
        const viva = settings.find(s => s.key === 'payment_viva_enabled');
        const binanceId = settings.find(s => s.key === 'binance_pay_id');
        setWhatsappEnabled(whatsapp?.value !== 'false');
        setUsdtEnabled(usdt?.value !== 'false');
        setBinanceEnabled(binance?.value === 'true');
        setVivaEnabled(viva?.value === 'true');
        if (binanceId) setBinancePayId(binanceId.value);
      }

      setLoading(false);
    };
    fetchData();
  }, []);

  const handleAddToCart = (plan: PricingPackage) => {
    addToCart(plan);
    toast.success(`Added ${plan.credits} credits to cart`);
  };

  const createCryptoPayment = async (plan: PricingPackage) => {
    if (!user) {
      toast.error('Please login to make a payment');
      return;
    }

    setCreatingPayment(plan.id);
    try {
      const orderId = `order_${Date.now()}_${user.id.slice(0, 8)}`;
      
      const response = await supabase.functions.invoke('nowpayments?action=create', {
        body: {
          userId: user.id,
          credits: plan.credits,
          amountUsd: plan.price,
          orderId,
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      const data = response.data;
      if (!data.success) {
        throw new Error(data.error || 'Failed to create payment');
      }

      setPaymentDetails(data.payment);
      setShowPaymentDialog(true);
      toast.success('Payment created! Send USDT to the address shown.');
    } catch (error: any) {
      console.error('Payment error:', error);
      toast.error(error.message || 'Failed to create payment');
    } finally {
      setCreatingPayment(null);
    }
  };

  const copyAddress = () => {
    if (paymentDetails?.payAddress) {
      navigator.clipboard.writeText(paymentDetails.payAddress);
      toast.success('Address copied to clipboard');
    }
  };

  const checkPaymentStatus = async () => {
    if (!paymentDetails?.paymentId) return;

    setCheckingStatus(true);
    try {
      const { data } = await supabase.functions.invoke(`nowpayments?action=status&payment_id=${paymentDetails.paymentId}`, {});

      if (data?.status) {
        setPaymentDetails(prev => prev ? { ...prev, status: data.status } : null);
        
        if (data.status === 'finished') {
          toast.success('Payment confirmed! Credits added to your account.');
          setShowPaymentDialog(false);
        } else if (data.status === 'confirming') {
          toast.info('Payment detected, waiting for confirmations...');
        } else if (data.status === 'expired' || data.status === 'failed') {
          toast.error('Payment expired or failed. Please try again.');
        }
      }
    } catch (error) {
      console.error('Status check error:', error);
    } finally {
      setCheckingStatus(false);
    }
  };

  const openBinancePayment = () => {
    if (!user) {
      toast.error('Please login to make a payment');
      return;
    }
    if (cart.length === 0) {
      toast.error('Please add items to your cart first');
      return;
    }
    setShowOrderIdStep(false);
    setBinanceOrderId('');
    setShowBinanceDialog(true);
  };

  const proceedToOrderId = () => {
    setShowOrderIdStep(true);
  };

  const validateBinanceOrderId = (orderId: string): { isValid: boolean; error: string } => {
    const trimmed = orderId.trim();
    
    if (!trimmed) {
      return { isValid: false, error: 'Order ID is required' };
    }
    
    if (!/^\d+$/.test(trimmed)) {
      return { isValid: false, error: 'Order ID should contain only numbers' };
    }
    
    if (trimmed.length < 15 || trimmed.length > 25) {
      return { isValid: false, error: 'Order ID should be 15-25 digits long' };
    }
    
    return { isValid: true, error: '' };
  };

  const submitBinancePayment = async () => {
    if (!user || cart.length === 0) return;
    
    const validation = validateBinanceOrderId(binanceOrderId);
    if (!validation.isValid) {
      toast.error(validation.error);
      return;
    }

    const totalAmount = getCartTotal();
    const totalCredits = getCartCredits();
    
    setSubmittingBinance(true);
    try {
      const { data: paymentData, error } = await supabase.from('manual_payments').insert({
        user_id: user.id,
        payment_method: 'binance_pay',
        amount_usd: totalAmount,
        credits: totalCredits,
        status: 'pending',
        transaction_id: binanceOrderId.trim(),
        notes: `Cart: ${cart.map(item => `${item.package.credits}x${item.quantity}`).join(', ')}`,
      }).select().single();

      if (error) throw error;

      const { data: adminRoles } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'admin');

      if (adminRoles && adminRoles.length > 0) {
        const notifications = adminRoles.map(admin => ({
          user_id: admin.user_id,
          title: '🔔 New Binance Pay Payment',
          message: `New payment of $${totalAmount} for ${totalCredits} credits.\nOrder ID: ${binanceOrderId.trim()}\nUser: ${profile?.email || user.email}\nPlease verify in Admin Panel.`,
          created_by: user.id,
        }));

        await supabase.from('user_notifications').insert(notifications);
      }

      toast.success('Payment submitted! Admin will verify and credit your account.');
      setShowBinanceDialog(false);
      setBinanceOrderId('');
      setShowOrderIdStep(false);
      clearCart();
    } catch (error: any) {
      console.error('Binance payment error:', error);
      toast.error('Failed to submit payment');
    } finally {
      setSubmittingBinance(false);
    }
  };

  const createVivaPayment = async () => {
    if (!user || cart.length === 0) {
      toast.error('Please login and add items to cart');
      return;
    }

    setCreatingVivaPayment(true);
    try {
      const totalCredits = getCartCredits();
      const totalAmount = getCartTotal();
      const orderId = `viva_${Date.now()}_${user.id.slice(0, 8)}`;

      const response = await supabase.functions.invoke('viva-payments?action=create', {
        body: {
          userId: user.id,
          credits: totalCredits,
          amountUsd: totalAmount,
          orderId,
          customerEmail: profile?.email || user.email,
          customerName: profile?.full_name || '',
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      const data = response.data;
      if (!data.success) {
        throw new Error(data.error || 'Failed to create payment');
      }

      // Redirect to Viva checkout
      toast.success('Redirecting to payment page...');
      clearCart();
      window.location.href = data.checkoutUrl;
    } catch (error: any) {
      console.error('Viva payment error:', error);
      toast.error(error.message || 'Failed to create payment');
    } finally {
      setCreatingVivaPayment(false);
    }
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
                  {binanceEnabled && (
                    <Button 
                      onClick={openBinancePayment}
                      className="bg-[#F0B90B] hover:bg-[#D4A50A] text-black font-semibold"
                    >
                      <Wallet className="h-4 w-4 mr-2" />
                      Checkout
                    </Button>
                  )}
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
                      className="w-full bg-[#F0B90B] hover:bg-[#D4A50A] text-black font-medium"
                      onClick={() => handleAddToCart(plan)}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add to Cart
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
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
              {/* Viva.com Card Payment */}
              {vivaEnabled && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-[#1A1F71]/10 flex items-center justify-center">
                      <Globe className="h-5 w-5 text-[#1A1F71]" />
                    </div>
                    <h4 className="font-semibold">Card Payment</h4>
                  </div>
                  <ol className="space-y-3 text-sm">
                    <li className="flex gap-3">
                      <span className="h-6 w-6 rounded-full bg-[#1A1F71] text-white flex items-center justify-center font-bold flex-shrink-0 text-xs">1</span>
                      <span>Add credits to your cart</span>
                    </li>
                    <li className="flex gap-3">
                      <span className="h-6 w-6 rounded-full bg-[#1A1F71] text-white flex items-center justify-center font-bold flex-shrink-0 text-xs">2</span>
                      <span>Click "Pay with Card" and checkout</span>
                    </li>
                    <li className="flex gap-3">
                      <span className="h-6 w-6 rounded-full bg-[#1A1F71] text-white flex items-center justify-center font-bold flex-shrink-0 text-xs">3</span>
                      <span>Credits added automatically</span>
                    </li>
                  </ol>
                </div>
              )}

              {/* Binance Pay */}
              {binanceEnabled && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-[#F0B90B]/10 flex items-center justify-center">
                      <Wallet className="h-5 w-5 text-[#F0B90B]" />
                    </div>
                    <h4 className="font-semibold">Binance Pay</h4>
                  </div>
                  <ol className="space-y-3 text-sm">
                    <li className="flex gap-3">
                      <span className="h-6 w-6 rounded-full bg-[#F0B90B] text-black flex items-center justify-center font-bold flex-shrink-0 text-xs">1</span>
                      <span>Add credits to your cart</span>
                    </li>
                    <li className="flex gap-3">
                      <span className="h-6 w-6 rounded-full bg-[#F0B90B] text-black flex items-center justify-center font-bold flex-shrink-0 text-xs">2</span>
                      <span>Send payment to our Binance Pay ID</span>
                    </li>
                    <li className="flex gap-3">
                      <span className="h-6 w-6 rounded-full bg-[#F0B90B] text-black flex items-center justify-center font-bold flex-shrink-0 text-xs">3</span>
                      <span>Enter Order ID and wait for verification</span>
                    </li>
                  </ol>
                </div>
              )}

              {/* USDT Payment */}
              {usdtEnabled && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Bitcoin className="h-5 w-5 text-primary" />
                    </div>
                    <h4 className="font-semibold">USDT (TRC20)</h4>
                  </div>
                  <ol className="space-y-3 text-sm">
                    <li className="flex gap-3">
                      <span className="h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold flex-shrink-0 text-xs">1</span>
                      <span>Click "Pay with USDT" on your chosen package</span>
                    </li>
                    <li className="flex gap-3">
                      <span className="h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold flex-shrink-0 text-xs">2</span>
                      <span>Send exact USDT amount to the provided address</span>
                    </li>
                    <li className="flex gap-3">
                      <span className="h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold flex-shrink-0 text-xs">3</span>
                      <span>Credits added automatically after confirmation</span>
                    </li>
                  </ol>
                </div>
              )}

              {/* WhatsApp Payment */}
              {whatsappEnabled && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-[#25D366]/10 flex items-center justify-center">
                      <MessageCircle className="h-5 w-5 text-[#25D366]" />
                    </div>
                    <h4 className="font-semibold">WhatsApp</h4>
                  </div>
                  <ol className="space-y-3 text-sm">
                    <li className="flex gap-3">
                      <span className="h-6 w-6 rounded-full bg-[#25D366] text-white flex items-center justify-center font-bold flex-shrink-0 text-xs">1</span>
                      <span>Click "Buy via WhatsApp" button</span>
                    </li>
                    <li className="flex gap-3">
                      <span className="h-6 w-6 rounded-full bg-[#25D366] text-white flex items-center justify-center font-bold flex-shrink-0 text-xs">2</span>
                      <span>Complete payment via our team</span>
                    </li>
                    <li className="flex gap-3">
                      <span className="h-6 w-6 rounded-full bg-[#25D366] text-white flex items-center justify-center font-bold flex-shrink-0 text-xs">3</span>
                      <span>Credits added after confirmation</span>
                    </li>
                  </ol>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Payment Dialog */}
      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bitcoin className="h-5 w-5 text-primary" />
              Complete Your Payment
            </DialogTitle>
            <DialogDescription>
              Send exactly {paymentDetails?.payAmount} USDT (TRC20) to complete your purchase
            </DialogDescription>
          </DialogHeader>

          {paymentDetails && (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-xl space-y-3">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Amount to send</p>
                  <p className="text-2xl font-bold text-primary">
                    {paymentDetails.payAmount} USDT
                  </p>
                  <p className="text-xs text-muted-foreground">TRC20 Network Only</p>
                </div>

                <div>
                  <p className="text-xs text-muted-foreground mb-1">Send to this address</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-xs bg-background p-2 rounded-lg border break-all">
                      {paymentDetails.payAddress}
                    </code>
                    <Button size="icon" variant="outline" onClick={copyAddress}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <div>
                    <p className="text-xs text-muted-foreground">Status</p>
                    <p className="font-medium capitalize">{paymentDetails.status}</p>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={checkPaymentStatus}
                    disabled={checkingStatus}
                  >
                    {checkingStatus ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4 mr-1" />
                    )}
                    Check Status
                  </Button>
                </div>
              </div>

              <div className="text-xs text-muted-foreground space-y-1 bg-destructive/5 p-3 rounded-lg">
                <p>⚠️ Send only USDT on <strong>TRC20</strong> network</p>
                <p>⚠️ Send the exact amount shown above</p>
                <p>⚠️ Payment will be confirmed after network confirmations</p>
              </div>

              <Button variant="outline" className="w-full" asChild>
                <a 
                  href={`https://nowpayments.io/payment/?iid=${paymentDetails.paymentId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  View on NOWPayments
                </a>
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Cart Dialog */}
      <Dialog open={showCartDialog} onOpenChange={setShowCartDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-primary" />
              Your Cart
            </DialogTitle>
            <DialogDescription>
              Review your items before checkout
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {cart.length === 0 ? (
              <div className="text-center py-8">
                <ShoppingCart className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
                <p className="text-muted-foreground">Your cart is empty</p>
              </div>
            ) : (
              <>
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {cart.map(item => (
                    <div key={item.package.id} className="flex items-center justify-between p-4 bg-muted rounded-xl">
                      <div>
                        <p className="font-semibold">{item.package.credits} Credits</p>
                        <p className="text-sm text-muted-foreground">${item.package.price} each</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button 
                          size="icon" 
                          variant="outline" 
                          className="h-8 w-8"
                          onClick={() => updateCartQuantity(item.package.id, -1)}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="w-8 text-center font-bold">{item.quantity}</span>
                        <Button 
                          size="icon" 
                          variant="outline" 
                          className="h-8 w-8"
                          onClick={() => updateCartQuantity(item.package.id, 1)}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => removeFromCart(item.package.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="border-t pt-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Total Credits</span>
                    <span className="font-semibold">{getCartCredits()}</span>
                  </div>
                  <div className="flex justify-between text-lg font-bold">
                    <span>Total</span>
                    <span className="text-primary">${getCartTotal()}</span>
                  </div>
                </div>

                <div className="border-t pt-4 space-y-3">
                  <p className="text-sm font-medium text-center text-muted-foreground">Choose Payment Method</p>
                  
                   <div className="space-y-2">
                    {vivaEnabled && (
                      <Button 
                        className="w-full bg-[#1A1F71] hover:bg-[#131654] text-white font-semibold"
                        onClick={() => {
                          setShowCartDialog(false);
                          createVivaPayment();
                        }}
                        disabled={creatingVivaPayment}
                      >
                        {creatingVivaPayment ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Globe className="h-4 w-4 mr-2" />
                        )}
                        Pay with Card (Viva)
                      </Button>
                    )}
                    
                    {binanceEnabled && (
                      <Button 
                        className="w-full bg-[#F0B90B] hover:bg-[#D4A50A] text-black font-semibold"
                        onClick={() => {
                          setShowCartDialog(false);
                          openBinancePayment();
                        }}
                      >
                        <Wallet className="h-4 w-4 mr-2" />
                        Pay with Binance
                      </Button>
                    )}
                    
                    {usdtEnabled && (
                      <Button
                        className="w-full"
                        variant="outline"
                        onClick={() => {
                          if (getCartTotal() < 15) {
                            toast.error('Minimum $15 for USDT payments. Add more to cart.');
                            return;
                          }
                          setShowCartDialog(false);
                          // Create USDT payment with cart total
                          const totalCredits = getCartCredits();
                          const totalPrice = getCartTotal();
                          createCryptoPayment({ id: 'cart', credits: totalCredits, price: totalPrice });
                        }}
                        disabled={creatingPayment !== null}
                      >
                        {creatingPayment !== null ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Bitcoin className="h-4 w-4 mr-2" />
                        )}
                        Pay with USDT {getCartTotal() < 15 && '(Min. $15)'}
                      </Button>
                    )}
                    
                    {whatsappEnabled && (
                      <Button
                        className="w-full bg-[#25D366] hover:bg-[#128C7E] text-white"
                        onClick={() => {
                          setShowCartDialog(false);
                          openWhatsApp(getCartCredits());
                        }}
                      >
                        <MessageCircle className="h-4 w-4 mr-2" />
                        Buy via WhatsApp
                      </Button>
                    )}
                  </div>
                  
                  <Button variant="ghost" className="w-full text-muted-foreground" onClick={clearCart}>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Clear Cart
                  </Button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Binance Pay Dialog */}
      <Dialog open={showBinanceDialog} onOpenChange={(open) => {
        if (!open) {
          setShowOrderIdStep(false);
          setBinanceOrderId('');
        }
        setShowBinanceDialog(open);
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-[#F0B90B]" />
              {showOrderIdStep ? 'Enter Order ID' : 'Pay with Binance'}
            </DialogTitle>
            <DialogDescription>
              {showOrderIdStep 
                ? 'Enter your Binance transaction order ID to complete verification'
                : `Send $${getCartTotal()} to complete your purchase of ${getCartCredits()} credits`
              }
            </DialogDescription>
          </DialogHeader>

          {!showOrderIdStep ? (
            <div className="space-y-4">
              <div className="p-3 bg-muted/50 rounded-xl space-y-2 max-h-32 overflow-y-auto">
                {cart.map(item => (
                  <div key={item.package.id} className="flex justify-between text-sm">
                    <span>{item.package.credits} Credits × {item.quantity}</span>
                    <span className="font-medium">${item.package.price * item.quantity}</span>
                  </div>
                ))}
              </div>

              <div className="p-4 bg-[#F0B90B]/10 rounded-xl space-y-3">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Total Amount to Send</p>
                  <p className="text-3xl font-bold text-[#F0B90B]">
                    ${getCartTotal()} USD
                  </p>
                  <p className="text-sm text-muted-foreground">
                    for {getCartCredits()} credits
                  </p>
                </div>

                <div>
                  <p className="text-xs text-muted-foreground mb-1">Send to Binance Pay ID</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-sm bg-background p-2 rounded-lg border font-mono">
                      {binancePayId || 'Contact admin for Pay ID'}
                    </code>
                    <Button 
                      size="icon" 
                      variant="outline" 
                      onClick={() => {
                        navigator.clipboard.writeText(binancePayId);
                        toast.success('Pay ID copied!');
                      }}
                      disabled={!binancePayId}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>

              <div className="text-xs text-muted-foreground space-y-1 bg-amber-500/10 p-3 rounded-lg">
                <p>⚠️ Send the exact amount shown above</p>
                <p>⚠️ After payment, click "I Have Paid" below</p>
                <p>⚠️ You'll need to provide the transaction Order ID</p>
              </div>

              <Button 
                className="w-full bg-[#F0B90B] hover:bg-[#D4A50A] text-black font-semibold"
                onClick={proceedToOrderId}
                disabled={!binancePayId}
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                I Have Paid
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-xl">
                <p className="text-sm mb-2">
                  Please enter the <strong>Order ID</strong> from your Binance transaction.
                </p>
                <p className="text-xs text-muted-foreground">
                  You can find this in your Binance Pay transaction history.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="binance-order-id">Transaction Order ID</Label>
                <Input
                  id="binance-order-id"
                  placeholder="e.g., 123456789012345678"
                  value={binanceOrderId}
                  onChange={(e) => setBinanceOrderId(e.target.value)}
                  className="font-mono"
                />
              </div>

              <div className="flex gap-3">
                <Button 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => setShowOrderIdStep(false)}
                >
                  Back
                </Button>
                <Button 
                  className="flex-1 bg-[#F0B90B] hover:bg-[#D4A50A] text-black font-semibold"
                  onClick={submitBinancePayment}
                  disabled={submittingBinance || !binanceOrderId.trim()}
                >
                  {submittingBinance ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <CheckCircle className="h-4 w-4 mr-2" />
                  )}
                  Submit
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
