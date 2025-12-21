import React, { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useWhatsApp } from '@/hooks/useWhatsApp';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { MessageCircle, CreditCard, CheckCircle, Loader2, Bitcoin, Copy, ExternalLink, RefreshCw, Wallet, ShoppingCart, Plus, Minus, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';

interface PricingPackage {
  id: string;
  credits: number;
  price: number;
}

interface CartItem {
  package: PricingPackage;
  quantity: number;
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
  const [packages, setPackages] = useState<PricingPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [creatingPayment, setCreatingPayment] = useState<string | null>(null);
  const [paymentDetails, setPaymentDetails] = useState<PaymentDetails | null>(null);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [whatsappEnabled, setWhatsappEnabled] = useState(true);
  const [usdtEnabled, setUsdtEnabled] = useState(true);
  const [binanceEnabled, setBinanceEnabled] = useState(false);
  const [binancePayId, setBinancePayId] = useState('');
  const [showBinanceDialog, setShowBinanceDialog] = useState(false);
  const [submittingBinance, setSubmittingBinance] = useState(false);
  
  // Cart state
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCartDialog, setShowCartDialog] = useState(false);
  
  // Binance order ID state
  const [binanceOrderId, setBinanceOrderId] = useState('');
  const [showOrderIdStep, setShowOrderIdStep] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      // Fetch packages
      const { data: packagesData } = await supabase
        .from('pricing_packages')
        .select('*')
        .eq('is_active', true)
        .order('credits', { ascending: true });
      
      setPackages(packagesData || []);

      // Fetch payment method settings
      const { data: settings } = await supabase
        .from('settings')
        .select('key, value')
        .in('key', ['payment_whatsapp_enabled', 'payment_usdt_enabled', 'payment_binance_enabled', 'binance_pay_id']);

      if (settings) {
        const whatsapp = settings.find(s => s.key === 'payment_whatsapp_enabled');
        const usdt = settings.find(s => s.key === 'payment_usdt_enabled');
        const binance = settings.find(s => s.key === 'payment_binance_enabled');
        const binanceId = settings.find(s => s.key === 'binance_pay_id');
        setWhatsappEnabled(whatsapp?.value !== 'false');
        setUsdtEnabled(usdt?.value !== 'false');
        setBinanceEnabled(binance?.value === 'true');
        if (binanceId) setBinancePayId(binanceId.value);
      }

      setLoading(false);
    };
    fetchData();
  }, []);

  // Cart functions
  const addToCart = (plan: PricingPackage) => {
    setCart(prev => {
      const existing = prev.find(item => item.package.id === plan.id);
      if (existing) {
        return prev.map(item => 
          item.package.id === plan.id 
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { package: plan, quantity: 1 }];
    });
    toast.success(`Added ${plan.credits} credits to cart`);
  };

  const updateCartQuantity = (packageId: string, delta: number) => {
    setCart(prev => {
      return prev.map(item => {
        if (item.package.id === packageId) {
          const newQuantity = item.quantity + delta;
          if (newQuantity <= 0) return null;
          return { ...item, quantity: newQuantity };
        }
        return item;
      }).filter(Boolean) as CartItem[];
    });
  };

  const removeFromCart = (packageId: string) => {
    setCart(prev => prev.filter(item => item.package.id !== packageId));
  };

  const getCartTotal = () => {
    return cart.reduce((sum, item) => sum + (item.package.price * item.quantity), 0);
  };

  const getCartCredits = () => {
    return cart.reduce((sum, item) => sum + (item.package.credits * item.quantity), 0);
  };

  const clearCart = () => {
    setCart([]);
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

  // Validate Binance Order ID format (typically 18-20 digits)
  const validateBinanceOrderId = (orderId: string): { isValid: boolean; error: string } => {
    const trimmed = orderId.trim();
    
    if (!trimmed) {
      return { isValid: false, error: 'Order ID is required' };
    }
    
    // Check if it's numeric only
    if (!/^\d+$/.test(trimmed)) {
      return { isValid: false, error: 'Order ID should contain only numbers' };
    }
    
    // Check length (Binance order IDs are typically 18-20 digits)
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

      // Notify all admins about the new payment with order ID
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
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-display font-bold">Buy Credits</h1>
          <p className="text-muted-foreground mt-1">
            Purchase credits to check your documents
          </p>
        </div>

        {/* Current Balance */}
        <Card className="gradient-primary text-primary-foreground">
          <CardContent className="p-6 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-xl bg-primary-foreground/20 flex items-center justify-center">
                <CreditCard className="h-7 w-7" />
              </div>
              <div>
                <p className="text-sm opacity-80">Current Balance</p>
                <p className="text-3xl font-bold">{profile?.credit_balance || 0} Credits</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Cart Summary (if items in cart) */}
        {cart.length > 0 && (
          <Card className="border-primary">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <ShoppingCart className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold">{getCartCredits()} Credits in Cart</p>
                    <p className="text-sm text-muted-foreground">Total: ${getCartTotal()}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setShowCartDialog(true)}>
                    View Cart
                  </Button>
                  {binanceEnabled && (
                    <Button 
                      size="sm" 
                      className="bg-[#F0B90B] hover:bg-[#D4A50A] text-black"
                      onClick={openBinancePayment}
                    >
                      <Wallet className="h-4 w-4 mr-2" />
                      Checkout with Binance
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Pricing Plans */}
        <div className="grid md:grid-cols-2 gap-4">
          {packages.map((plan) => {
            const cartItem = cart.find(item => item.package.id === plan.id);
            return (
              <Card key={plan.id} className="hover:border-primary/50 transition-colors relative">
                {cartItem && (
                  <Badge className="absolute -top-2 -right-2 bg-primary">
                    {cartItem.quantity} in cart
                  </Badge>
                )}
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-2xl font-bold">
                        {plan.credits} {plan.credits === 1 ? 'Credit' : 'Credits'}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        ${(plan.price / plan.credits).toFixed(2)} per document
                      </p>
                    </div>
                    <p className="text-3xl font-bold text-primary">${plan.price}</p>
                  </div>
                  <ul className="space-y-2 mb-4 text-sm">
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-secondary" />
                      Similarity Detection
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-secondary" />
                      AI Content Detection
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-secondary" />
                      Detailed PDF Reports
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-secondary" />
                      Credits Never Expire
                    </li>
                  </ul>
                  <div className="space-y-2">
                    {binanceEnabled && (
                      <Button
                        className="w-full bg-[#F0B90B] hover:bg-[#D4A50A] text-black"
                        onClick={() => addToCart(plan)}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add to Cart
                      </Button>
                    )}
                    {usdtEnabled && (
                      <>
                        <Button
                          className="w-full"
                          variant="default"
                          onClick={() => createCryptoPayment(plan)}
                          disabled={creatingPayment === plan.id || plan.price < 15}
                          title={plan.price < 15 ? 'Minimum $15 for USDT payments' : undefined}
                        >
                          {creatingPayment === plan.id ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <Bitcoin className="h-4 w-4 mr-2" />
                          )}
                          Pay with USDT
                        </Button>
                        {plan.price < 15 && (
                          <p className="text-xs text-muted-foreground text-center">
                            Min. $15 for USDT
                          </p>
                        )}
                      </>
                    )}
                    {whatsappEnabled && (
                      <Button
                        className="w-full bg-[#25D366] hover:bg-[#128C7E]"
                        onClick={() => openWhatsApp(plan.credits)}
                      >
                        <MessageCircle className="h-4 w-4 mr-2" />
                        Buy via WhatsApp
                      </Button>
                    )}
                    {!usdtEnabled && !whatsappEnabled && !binanceEnabled && (
                      <p className="text-sm text-muted-foreground text-center py-2">
                        No payment methods available
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* How it works */}
        <Card>
          <CardHeader>
            <CardTitle>How to Purchase Credits</CardTitle>
            <CardDescription>
              Follow these simple steps to add credits to your account
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-8">
              {/* USDT Payment */}
              <div>
                <h4 className="font-semibold mb-4 flex items-center gap-2">
                  <Bitcoin className="h-5 w-5 text-primary" />
                  Pay with USDT (TRC20)
                </h4>
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

              {/* WhatsApp Payment */}
              <div>
                <h4 className="font-semibold mb-4 flex items-center gap-2">
                  <MessageCircle className="h-5 w-5 text-[#25D366]" />
                  Buy via WhatsApp
                </h4>
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
              {/* Binance Pay */}
              <div>
                <h4 className="font-semibold mb-4 flex items-center gap-2">
                  <Wallet className="h-5 w-5 text-[#F0B90B]" />
                  Pay with Binance
                </h4>
                <ol className="space-y-3 text-sm">
                  <li className="flex gap-3">
                    <span className="h-6 w-6 rounded-full bg-[#F0B90B] text-black flex items-center justify-center font-bold flex-shrink-0 text-xs">1</span>
                    <span>Click "Pay with Binance" on your chosen package</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="h-6 w-6 rounded-full bg-[#F0B90B] text-black flex items-center justify-center font-bold flex-shrink-0 text-xs">2</span>
                    <span>Send exact amount to our Binance Pay ID</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="h-6 w-6 rounded-full bg-[#F0B90B] text-black flex items-center justify-center font-bold flex-shrink-0 text-xs">3</span>
                    <span>Click "I Paid" and wait for verification</span>
                  </li>
                </ol>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Payment Dialog */}
      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bitcoin className="h-5 w-5" />
              Complete Your Payment
            </DialogTitle>
            <DialogDescription>
              Send exactly {paymentDetails?.payAmount} USDT (TRC20) to complete your purchase
            </DialogDescription>
          </DialogHeader>

          {paymentDetails && (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg space-y-3">
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
                    <code className="flex-1 text-xs bg-background p-2 rounded border break-all">
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

              <div className="text-xs text-muted-foreground space-y-1">
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
              <ShoppingCart className="h-5 w-5" />
              Your Cart
            </DialogTitle>
            <DialogDescription>
              Review your items before checkout
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {cart.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">Your cart is empty</p>
            ) : (
              <>
                {cart.map(item => (
                  <div key={item.package.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
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
                      <span className="w-8 text-center font-semibold">{item.quantity}</span>
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
                        className="h-8 w-8 text-destructive"
                        onClick={() => removeFromCart(item.package.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}

                <div className="border-t pt-4">
                  <div className="flex justify-between text-lg font-bold">
                    <span>Total:</span>
                    <span>${getCartTotal()} ({getCartCredits()} Credits)</span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={clearCart}>
                    Clear Cart
                  </Button>
                  {binanceEnabled && (
                    <Button 
                      className="flex-1 bg-[#F0B90B] hover:bg-[#D4A50A] text-black"
                      onClick={() => {
                        setShowCartDialog(false);
                        openBinancePayment();
                      }}
                    >
                      <Wallet className="h-4 w-4 mr-2" />
                      Pay with Binance
                    </Button>
                  )}
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
              {/* Cart summary */}
              <div className="p-3 bg-muted/50 rounded-lg space-y-2 max-h-32 overflow-y-auto">
                {cart.map(item => (
                  <div key={item.package.id} className="flex justify-between text-sm">
                    <span>{item.package.credits} Credits × {item.quantity}</span>
                    <span className="font-medium">${item.package.price * item.quantity}</span>
                  </div>
                ))}
              </div>

              <div className="p-4 bg-muted rounded-lg space-y-3">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Total Amount to Send</p>
                  <p className="text-2xl font-bold text-[#F0B90B]">
                    ${getCartTotal()} USD
                  </p>
                  <p className="text-sm text-muted-foreground">
                    for {getCartCredits()} credits
                  </p>
                </div>

                <div>
                  <p className="text-xs text-muted-foreground mb-1">Send to Binance Pay ID</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-sm bg-background p-2 rounded border">
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

              <div className="text-xs text-muted-foreground space-y-1">
                <p>⚠️ Send the exact amount shown above</p>
                <p>⚠️ After payment, click "I Have Paid" below</p>
                <p>⚠️ You'll need to provide the transaction Order ID</p>
              </div>

              <Button 
                className="w-full bg-[#F0B90B] hover:bg-[#D4A50A] text-black"
                onClick={proceedToOrderId}
                disabled={!binancePayId}
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                I Have Paid
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg">
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

              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => setShowOrderIdStep(false)}
                >
                  Back
                </Button>
                <Button 
                  className="flex-1 bg-[#F0B90B] hover:bg-[#D4A50A] text-black"
                  onClick={submitBinancePayment}
                  disabled={submittingBinance || !binanceOrderId.trim()}
                >
                  {submittingBinance ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <CheckCircle className="h-4 w-4 mr-2" />
                  )}
                  Submit for Verification
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
