import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import { supabase } from '@/integrations/supabase/client';
import { 
  ArrowLeft, CreditCard, Loader2, Bitcoin, Copy, ExternalLink, 
  RefreshCw, Wallet, ShoppingCart, Plus, Minus, Trash2, Globe, 
  CheckCircle, MessageCircle, AlertCircle, Zap, Tag, X, Shield
} from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useWhatsApp } from '@/hooks/useWhatsApp';
import { usePromoCode } from '@/hooks/usePromoCode';

interface PaymentDetails {
  paymentId: string;
  payAddress: string;
  payAmount: number;
  payCurrency: string;
  status: string;
}

export default function Checkout() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { profile, user } = useAuth();
  const { openWhatsAppCustom } = useWhatsApp();
  const { cart, updateCartQuantity, removeFromCart, clearCart, getCartTotal, getCartCredits } = useCart();
  const { 
    validatingPromo, 
    appliedPromo, 
    validatePromoCode, 
    recordPromoUse, 
    clearPromo, 
    calculateDiscountedTotal, 
    getTotalBonusCredits 
  } = usePromoCode();
  
  const [loading, setLoading] = useState(true);
  const [promoInput, setPromoInput] = useState('');
  const [whatsappEnabled, setWhatsappEnabled] = useState(true);
  const [usdtEnabled, setUsdtEnabled] = useState(true);
  const [binanceEnabled, setBinanceEnabled] = useState(false);
  const [vivaEnabled, setVivaEnabled] = useState(false);
  const [stripeEnabled, setStripeEnabled] = useState(false);
  const [binancePayId, setBinancePayId] = useState('');
  
  // Payment fees
  const [fees, setFees] = useState<{ whatsapp: number; usdt: number; binance: number; viva: number; stripe: number }>({
    whatsapp: 0,
    usdt: 0,
    binance: 0,
    viva: 0,
    stripe: 0,
  });
  
  // Payment processing states
  const [creatingPayment, setCreatingPayment] = useState<string | null>(null);
  const [paymentDetails, setPaymentDetails] = useState<PaymentDetails | null>(null);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(false);
  
  // Binance payment states
  const [showBinanceDialog, setShowBinanceDialog] = useState(false);
  const [showOrderIdStep, setShowOrderIdStep] = useState(false);
  const [binanceOrderId, setBinanceOrderId] = useState('');
  const [submittingBinance, setSubmittingBinance] = useState(false);
  
  // Viva payment state
  const [creatingVivaPayment, setCreatingVivaPayment] = useState(false);
  
  // Stripe payment state
  const [creatingStripePayment, setCreatingStripePayment] = useState(false);

  // Calculate total with fee and promo discount
  const calculateTotalWithFee = (method: 'whatsapp' | 'usdt' | 'binance' | 'viva' | 'stripe') => {
    const baseTotal = getCartTotal();
    const discountedTotal = calculateDiscountedTotal(baseTotal);
    const feePercent = fees[method] || 0;
    const feeAmount = discountedTotal * (feePercent / 100);
    return Math.round((discountedTotal + feeAmount) * 100) / 100;
  };

  const handleApplyPromo = async () => {
    await validatePromoCode(promoInput);
  };

  useEffect(() => {
    const fetchSettings = async () => {
      const { data: settings } = await supabase
        .from('settings')
        .select('key, value')
        .in('key', [
          'payment_whatsapp_enabled', 'payment_usdt_enabled', 'payment_binance_enabled', 'payment_viva_enabled', 'payment_stripe_enabled',
          'binance_pay_id',
          'fee_whatsapp', 'fee_usdt', 'fee_binance', 'fee_viva', 'fee_stripe'
        ]);

      if (settings) {
        const whatsapp = settings.find(s => s.key === 'payment_whatsapp_enabled');
        const usdt = settings.find(s => s.key === 'payment_usdt_enabled');
        const binance = settings.find(s => s.key === 'payment_binance_enabled');
        const viva = settings.find(s => s.key === 'payment_viva_enabled');
        const stripe = settings.find(s => s.key === 'payment_stripe_enabled');
        const binanceId = settings.find(s => s.key === 'binance_pay_id');
        
        // Get fees
        const feeWhatsapp = settings.find(s => s.key === 'fee_whatsapp');
        const feeUsdt = settings.find(s => s.key === 'fee_usdt');
        const feeBinance = settings.find(s => s.key === 'fee_binance');
        const feeViva = settings.find(s => s.key === 'fee_viva');
        const feeStripe = settings.find(s => s.key === 'fee_stripe');
        
        setWhatsappEnabled(whatsapp?.value !== 'false');
        setUsdtEnabled(usdt?.value !== 'false');
        setBinanceEnabled(binance?.value === 'true');
        setVivaEnabled(viva?.value === 'true');
        setStripeEnabled(stripe?.value === 'true');
        if (binanceId) setBinancePayId(binanceId.value);
        
        setFees({
          whatsapp: parseFloat(feeWhatsapp?.value || '0') || 0,
          usdt: parseFloat(feeUsdt?.value || '0') || 0,
          binance: parseFloat(feeBinance?.value || '0') || 0,
          viva: parseFloat(feeViva?.value || '0') || 0,
          stripe: parseFloat(feeStripe?.value || '0') || 0,
        });
      }
      setLoading(false);
    };
    fetchSettings();
  }, []);

  // Redirect if cart is empty
  useEffect(() => {
    if (!loading && cart.length === 0) {
      navigate('/dashboard/credits');
    }
  }, [cart.length, loading, navigate]);

  const createCryptoPayment = async () => {
    if (!user) {
      toast.error('Please login to make a payment');
      return;
    }

    setCreatingPayment('usdt');
    try {
      const orderId = `order_${Date.now()}_${user.id.slice(0, 8)}`;
      const totalWithFee = calculateTotalWithFee('usdt');
      
      const response = await supabase.functions.invoke('nowpayments?action=create', {
        body: {
          userId: user.id,
          credits: getCartCredits(),
          amountUsd: totalWithFee,
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
      clearCart();
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

    const totalWithFee = calculateTotalWithFee('binance');
    const totalCredits = getCartCredits();
    
    setSubmittingBinance(true);
    try {
      const { error } = await supabase.from('manual_payments').insert({
        user_id: user.id,
        payment_method: 'binance_pay',
        amount_usd: totalWithFee,
        credits: totalCredits,
        status: 'pending',
        transaction_id: binanceOrderId.trim(),
        notes: `Cart: ${cart.map(item => `${item.package.credits}x${item.quantity}`).join(', ')}`,
      });

      if (error) throw error;

      const { data: adminRoles } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'admin');

      if (adminRoles && adminRoles.length > 0) {
        const notifications = adminRoles.map(admin => ({
          user_id: admin.user_id,
          title: '🔔 New Binance Pay Payment',
          message: `New payment of $${totalWithFee} for ${totalCredits} credits.\nOrder ID: ${binanceOrderId.trim()}\nUser: ${profile?.email || user.email}\nPlease verify in Admin Panel.`,
          created_by: user.id,
        }));

        await supabase.from('user_notifications').insert(notifications);
      }

      toast.success('Payment submitted! Admin will verify and credit your account.');
      setShowBinanceDialog(false);
      setBinanceOrderId('');
      setShowOrderIdStep(false);
      clearCart();
      navigate('/dashboard/payments');
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
      const totalWithFee = calculateTotalWithFee('viva');
      const orderId = `viva_${Date.now()}_${user.id.slice(0, 8)}`;

      const response = await supabase.functions.invoke('viva-payments?action=create', {
        body: {
          userId: user.id,
          credits: totalCredits,
          amountUsd: totalWithFee,
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

  const handleWhatsAppPayment = () => {
    const totalWithFee = calculateTotalWithFee('whatsapp');
    const message = `Hi, I want to buy ${getCartCredits()} credits for $${totalWithFee}. Please help me with the payment.`;
    openWhatsAppCustom(message);
  };

  const createStripePayment = async () => {
    if (!user || cart.length === 0) {
      toast.error('Please login and add items to cart');
      return;
    }

    setCreatingStripePayment(true);
    try {
      const totalCredits = getCartCredits();
      const totalAmount = Math.round(calculateTotalWithFee('stripe') * 100); // Convert to cents
      
      // Get the session token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await supabase.functions.invoke('create-stripe-checkout', {
        body: {
          priceId: null, // We'll use dynamic pricing
          credits: totalCredits,
          amount: totalAmount,
          mode: 'payment',
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      const data = response.data;
      if (!data.url) {
        throw new Error(data.error || 'Failed to create checkout session');
      }

      toast.success('Redirecting to Stripe checkout...');
      clearCart();
      window.open(data.url, '_blank');
    } catch (error: any) {
      console.error('Stripe payment error:', error);
      toast.error(error.message || 'Failed to create Stripe payment');
    } finally {
      setCreatingStripePayment(false);
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

  if (cart.length === 0) {
    return null;
  }

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Premium Header */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-background border border-primary/20 p-6 md:p-8">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          <div className="relative flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard/credits')} className="shrink-0">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-1">
                <div className="h-10 w-10 rounded-xl bg-primary/20 flex items-center justify-center">
                  <ShoppingCart className="h-5 w-5 text-primary" />
                </div>
                <h1 className="text-2xl md:text-3xl font-display font-bold">Secure Checkout</h1>
              </div>
              <p className="text-muted-foreground">Complete your purchase securely</p>
            </div>
            <div className="hidden md:flex items-center gap-2 text-sm text-muted-foreground">
              <Shield className="h-4 w-4 text-green-500" />
              <span>SSL Encrypted</span>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Order Summary */}
          <div className="lg:col-span-1 lg:order-2">
            <Card className="sticky top-4">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShoppingCart className="h-5 w-5" />
                  Order Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {cart.map((item) => (
                  <div key={item.package.id} className="flex items-center justify-between gap-3 p-3 rounded-lg bg-muted/50">
                    <div className="flex-1">
                      <p className="font-medium">{item.package.credits} Credits</p>
                      <p className="text-sm text-muted-foreground">${item.package.price} each</p>
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
                      <span className="w-8 text-center font-medium">{item.quantity}</span>
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
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => removeFromCart(item.package.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}

                <Separator />

                {/* Promo Code Input */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <Tag className="h-4 w-4" />
                    Promo Code
                  </Label>
                  {appliedPromo ? (
                    <div className="flex items-center justify-between p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        <span className="font-medium text-green-700 dark:text-green-400">{appliedPromo.code}</span>
                        {appliedPromo.discountPercentage > 0 && (
                          <Badge variant="secondary" className="text-xs">-{appliedPromo.discountPercentage}%</Badge>
                        )}
                        {appliedPromo.creditsBonus > 0 && (
                          <Badge variant="secondary" className="text-xs">+{appliedPromo.creditsBonus} credits</Badge>
                        )}
                      </div>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={clearPromo}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <Input
                        placeholder="Enter code"
                        value={promoInput}
                        onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
                        className="flex-1"
                      />
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={handleApplyPromo}
                        disabled={validatingPromo || !promoInput.trim()}
                      >
                        {validatingPromo ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Apply'}
                      </Button>
                    </div>
                  )}
                </div>

                <Separator />

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Total Credits</span>
                    <span className="font-medium">
                      {getCartCredits()}
                      {getTotalBonusCredits() > 0 && (
                        <span className="text-green-600 ml-1">+{getTotalBonusCredits()}</span>
                      )}
                    </span>
                  </div>
                  {appliedPromo?.discountPercentage && appliedPromo.discountPercentage > 0 && (
                    <>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Subtotal</span>
                        <span className="line-through text-muted-foreground">${getCartTotal()}</span>
                      </div>
                      <div className="flex justify-between text-sm text-green-600">
                        <span>Discount ({appliedPromo.discountPercentage}%)</span>
                        <span>-${(getCartTotal() - calculateDiscountedTotal(getCartTotal())).toFixed(2)}</span>
                      </div>
                    </>
                  )}
                  <div className="flex justify-between text-lg font-bold">
                    <span>Total</span>
                    <span className="text-primary">${calculateDiscountedTotal(getCartTotal())}</span>
                  </div>
                </div>

                <div className="pt-2">
                  <Badge variant="secondary" className="w-full justify-center py-2">
                    <CreditCard className="h-4 w-4 mr-2" />
                    Current Balance: {profile?.credit_balance || 0} credits
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Payment Methods */}
          <div className="lg:col-span-2 lg:order-1 space-y-6">
            <Card className="overflow-hidden">
              <CardHeader className="bg-muted/30 border-b">
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-primary" />
                  Payment Method
                </CardTitle>
                <CardDescription>All transactions are secure and encrypted</CardDescription>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                {/* Stripe Card Payment - Premium Style */}
                {stripeEnabled && (
                  <div className="relative group">
                    <div className="absolute -inset-0.5 bg-gradient-to-r from-[#635BFF] to-[#8B5CF6] rounded-xl blur opacity-25 group-hover:opacity-50 transition duration-300" />
                    <div className="relative border-2 border-[#635BFF]/30 rounded-xl p-5 bg-gradient-to-br from-[#635BFF]/5 to-transparent hover:border-[#635BFF]/50 transition-all duration-300">
                      <div className="flex items-start gap-4">
                        <div className="h-14 w-14 rounded-xl bg-[#635BFF] flex items-center justify-center flex-shrink-0 shadow-lg shadow-[#635BFF]/30">
                          <CreditCard className="h-7 w-7 text-white" />
                        </div>
                        <div className="flex-1 space-y-4">
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-bold text-lg">Credit / Debit Card</h3>
                              <Badge className="bg-[#635BFF] text-white border-0">Recommended</Badge>
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">
                              Visa, Mastercard, American Express, Apple Pay, Google Pay
                              {fees.stripe > 0 && <span className="text-amber-600 ml-1">(+{fees.stripe}% fee)</span>}
                            </p>
                            <div className="flex items-center gap-2 mt-2">
                              <img src="https://upload.wikimedia.org/wikipedia/commons/0/04/Visa.svg" alt="Visa" className="h-6" />
                              <img src="https://upload.wikimedia.org/wikipedia/commons/2/2a/Mastercard-logo.svg" alt="Mastercard" className="h-6" />
                              <span className="text-xs text-muted-foreground">& more</span>
                            </div>
                          </div>
                          <Button 
                            className="w-full h-12 text-base bg-[#635BFF] hover:bg-[#5851DB] shadow-lg shadow-[#635BFF]/20"
                            onClick={createStripePayment}
                            disabled={creatingStripePayment}
                          >
                            {creatingStripePayment ? (
                              <>
                                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                                Processing...
                              </>
                            ) : (
                              <>
                                <Zap className="h-5 w-5 mr-2" />
                                Pay ${calculateTotalWithFee('stripe')} Now
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Viva.com Card Payment */}
                {vivaEnabled && (
                  <div className="border rounded-lg p-4 hover:border-primary transition-colors">
                    <div className="flex items-start gap-4">
                      <div className="h-12 w-12 rounded-xl bg-[#1A1F71]/10 flex items-center justify-center flex-shrink-0">
                        <Globe className="h-6 w-6 text-[#1A1F71]" />
                      </div>
                      <div className="flex-1 space-y-3">
                        <div>
                          <h3 className="font-semibold flex items-center gap-2">
                            Card Payment (Viva.com)
                            <Badge variant="secondary" className="text-xs">Recommended</Badge>
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            Pay securely with Visa, Mastercard, or other debit/credit cards
                            {fees.viva > 0 && <span className="text-amber-600"> (+{fees.viva}% fee)</span>}
                          </p>
                        </div>
                        <Button 
                          className="w-full bg-[#1A1F71] hover:bg-[#1A1F71]/90"
                          onClick={createVivaPayment}
                          disabled={creatingVivaPayment}
                        >
                          {creatingVivaPayment ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Processing...
                            </>
                          ) : (
                            <>
                              <CreditCard className="h-4 w-4 mr-2" />
                              Pay ${calculateTotalWithFee('viva')} with Card
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Binance Pay */}
                {binanceEnabled && (
                  <div className="border rounded-lg p-4 hover:border-primary transition-colors">
                    <div className="flex items-start gap-4">
                      <div className="h-12 w-12 rounded-xl bg-[#F0B90B]/10 flex items-center justify-center flex-shrink-0">
                        <Wallet className="h-6 w-6 text-[#F0B90B]" />
                      </div>
                      <div className="flex-1 space-y-3">
                        <div>
                          <h3 className="font-semibold">Binance Pay</h3>
                          <p className="text-sm text-muted-foreground">
                            Pay instantly using your Binance wallet
                          </p>
                        </div>
                        <Button 
                          className="w-full bg-[#F0B90B] hover:bg-[#D4A50A] text-black"
                          onClick={openBinancePayment}
                        >
                          <Wallet className="h-4 w-4 mr-2" />
                          Pay with Binance Pay
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* USDT Payment */}
                {usdtEnabled && (
                  <div className="border rounded-lg p-4 hover:border-primary transition-colors">
                    <div className="flex items-start gap-4">
                      <div className="h-12 w-12 rounded-xl bg-green-500/10 flex items-center justify-center flex-shrink-0">
                        <Bitcoin className="h-6 w-6 text-green-500" />
                      </div>
                      <div className="flex-1 space-y-3">
                        <div>
                          <h3 className="font-semibold">USDT (TRC20)</h3>
                          <p className="text-sm text-muted-foreground">
                            Pay with USDT cryptocurrency on TRC20 network
                          </p>
                        </div>
                        <Button 
                          className="w-full bg-green-600 hover:bg-green-700"
                          onClick={createCryptoPayment}
                          disabled={creatingPayment === 'usdt'}
                        >
                          {creatingPayment === 'usdt' ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Creating Payment...
                            </>
                          ) : (
                            <>
                              <Bitcoin className="h-4 w-4 mr-2" />
                              Pay with USDT
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* WhatsApp Payment */}
                {whatsappEnabled && (
                  <div className="border rounded-lg p-4 hover:border-primary transition-colors">
                    <div className="flex items-start gap-4">
                      <div className="h-12 w-12 rounded-xl bg-[#25D366]/10 flex items-center justify-center flex-shrink-0">
                        <MessageCircle className="h-6 w-6 text-[#25D366]" />
                      </div>
                      <div className="flex-1 space-y-3">
                        <div>
                          <h3 className="font-semibold">WhatsApp Support</h3>
                          <p className="text-sm text-muted-foreground">
                            Contact us on WhatsApp for manual payment assistance
                          </p>
                        </div>
                        <Button 
                          className="w-full bg-[#25D366] hover:bg-[#1DA851]"
                          onClick={handleWhatsAppPayment}
                        >
                          <MessageCircle className="h-4 w-4 mr-2" />
                          Pay via WhatsApp
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {!stripeEnabled && !vivaEnabled && !binanceEnabled && !usdtEnabled && !whatsappEnabled && (
                  <div className="text-center py-8">
                    <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">No payment methods are currently available. Please contact support.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* USDT Payment Dialog */}
      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bitcoin className="h-5 w-5 text-green-500" />
              USDT Payment
            </DialogTitle>
            <DialogDescription>
              Send exactly {paymentDetails?.payAmount} USDT to complete your payment
            </DialogDescription>
          </DialogHeader>
          
          {paymentDetails && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Amount to Send (USDT TRC20)</Label>
                <div className="flex items-center gap-2">
                  <Input 
                    value={paymentDetails.payAmount.toFixed(6)} 
                    readOnly 
                    className="font-mono text-lg"
                  />
                      <Button variant="outline" size="icon" onClick={() => {
                        navigator.clipboard.writeText(paymentDetails.payAmount.toString());
                        toast.success('Amount copied');
                      }}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Wallet Address</Label>
                <div className="flex items-center gap-2">
                  <Input 
                    value={paymentDetails.payAddress} 
                    readOnly 
                    className="font-mono text-xs"
                  />
                  <Button variant="outline" size="icon" onClick={copyAddress}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                <span className="text-sm">Status:</span>
                <Badge variant={paymentDetails.status === 'finished' ? 'default' : 'secondary'}>
                  {paymentDetails.status}
                </Badge>
              </div>

              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  className="flex-1"
                  onClick={checkPaymentStatus}
                  disabled={checkingStatus}
                >
                  {checkingStatus ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  Check Status
                </Button>
              </div>

              <p className="text-xs text-muted-foreground text-center">
                Send only USDT on TRC20 network. Other networks may result in lost funds.
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Binance Pay Dialog */}
      <Dialog open={showBinanceDialog} onOpenChange={setShowBinanceDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-[#F0B90B]" />
              Binance Pay
            </DialogTitle>
            <DialogDescription>
              {!showOrderIdStep 
                ? 'Follow these steps to complete your payment'
                : 'Enter your Binance Pay Order ID'
              }
            </DialogDescription>
          </DialogHeader>
          
          {!showOrderIdStep ? (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg space-y-3">
                <p className="font-medium">Total: ${getCartTotal()}</p>
                <p className="text-sm text-muted-foreground">For {getCartCredits()} credits</p>
              </div>

              <ol className="space-y-3 text-sm">
                <li className="flex gap-3">
                  <span className="h-6 w-6 rounded-full bg-[#F0B90B] text-black flex items-center justify-center font-bold flex-shrink-0 text-xs">1</span>
                  <span>Open Binance app and go to Pay section</span>
                </li>
                <li className="flex gap-3">
                  <span className="h-6 w-6 rounded-full bg-[#F0B90B] text-black flex items-center justify-center font-bold flex-shrink-0 text-xs">2</span>
                  <div>
                    <span>Send ${getCartTotal()} to Pay ID: </span>
                    <Button 
                      variant="link" 
                      className="p-0 h-auto text-primary"
                      onClick={() => {
                        navigator.clipboard.writeText(binancePayId);
                        toast.success('Pay ID copied');
                      }}
                    >
                      {binancePayId}
                      <Copy className="h-3 w-3 ml-1" />
                    </Button>
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="h-6 w-6 rounded-full bg-[#F0B90B] text-black flex items-center justify-center font-bold flex-shrink-0 text-xs">3</span>
                  <span>Complete the payment and save the Order ID</span>
                </li>
              </ol>

              <Button 
                className="w-full bg-[#F0B90B] hover:bg-[#D4A50A] text-black"
                onClick={proceedToOrderId}
              >
                I've Made the Payment
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="orderId">Binance Pay Order ID</Label>
                <Input
                  id="orderId"
                  placeholder="Enter your 15-25 digit Order ID"
                  value={binanceOrderId}
                  onChange={(e) => setBinanceOrderId(e.target.value)}
                  className="font-mono"
                />
                <p className="text-xs text-muted-foreground">
                  Find this in your Binance Pay transaction history
                </p>
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