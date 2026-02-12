import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { 
  ArrowLeft, CreditCard, Loader2, Bitcoin, Copy, ExternalLink, 
  RefreshCw, Wallet, Globe, 
  CheckCircle, MessageCircle, AlertCircle, Tag, X, Shield, Store
} from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useWhatsApp } from '@/hooks/useWhatsApp';
import { usePromoCode } from '@/hooks/usePromoCode';
import { StripeEmbeddedCheckout } from '@/components/StripeEmbeddedCheckout';

interface PaymentDetails {
  paymentId: string;
  payAddress: string;
  payAmount: number;
  payCurrency: string;
  status: string;
}

interface SelectedPackage {
  id: string;
  credits: number;
  price: number;
  credit_type: string;
  name: string | null;
}

export default function Checkout() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { profile, user } = useAuth();
  const { openWhatsAppCustom } = useWhatsApp();
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
  const [selectedPackage, setSelectedPackage] = useState<SelectedPackage | null>(null);
  const [promoInput, setPromoInput] = useState('');
  const [whatsappEnabled, setWhatsappEnabled] = useState(true);
  const [usdtEnabled, setUsdtEnabled] = useState(true);
  const [binanceEnabled, setBinanceEnabled] = useState(false);
  const [vivaEnabled, setVivaEnabled] = useState(false);
  const [stripeEnabled, setStripeEnabled] = useState(false);
  const [dodoEnabled, setDodoEnabled] = useState(false);
  const [paypalEnabled, setPaypalEnabled] = useState(false);
  const [paddleEnabled, setPaddleEnabled] = useState(false);
  const [binancePayId, setBinancePayId] = useState('');
  
  const [fees, setFees] = useState<{ whatsapp: number; usdt: number; binance: number; viva: number; stripe: number; dodo: number; paypal: number; paddle: number }>({
    whatsapp: 0, usdt: 0, binance: 0, viva: 0, stripe: 0, dodo: 0, paypal: 0, paddle: 0,
  });
  
  const [creatingPayment, setCreatingPayment] = useState<string | null>(null);
  const [paymentDetails, setPaymentDetails] = useState<PaymentDetails | null>(null);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(false);
  
  const [showBinanceDialog, setShowBinanceDialog] = useState(false);
  const [showOrderIdStep, setShowOrderIdStep] = useState(false);
  const [binanceOrderId, setBinanceOrderId] = useState('');
  const [submittingBinance, setSubmittingBinance] = useState(false);
  
  const [creatingVivaPayment, setCreatingVivaPayment] = useState(false);
  const [creatingStripePayment, setCreatingStripePayment] = useState(false);
  const [showStripeEmbeddedCheckout, setShowStripeEmbeddedCheckout] = useState(false);
  const [creatingDodoPayment, setCreatingDodoPayment] = useState(false);
  const [creatingPaypalPayment, setCreatingPaypalPayment] = useState(false);
  const [creatingPaddlePayment, setCreatingPaddlePayment] = useState(false);
  const [paddleClientToken, setPaddleClientToken] = useState('');
  const [paddleEnvironment, setPaddleEnvironment] = useState('sandbox');

  const packagePrice = selectedPackage?.price || 0;
  const packageCredits = selectedPackage?.credits || 0;
  const packageCreditType = (selectedPackage?.credit_type || 'full') as 'full' | 'similarity_only';

  const calculateTotalWithFee = (method: 'whatsapp' | 'usdt' | 'binance' | 'viva' | 'stripe' | 'dodo' | 'paypal' | 'paddle') => {
    const discountedTotal = calculateDiscountedTotal(packagePrice);
    const feePercent = fees[method] || 0;
    const feeAmount = discountedTotal * (feePercent / 100);
    return Math.round((discountedTotal + feeAmount) * 100) / 100;
  };

  const handleApplyPromo = async () => {
    await validatePromoCode(promoInput);
  };

  // Load package from URL param
  useEffect(() => {
    const loadPackage = async () => {
      const packageId = searchParams.get('packageId');
      if (!packageId) {
        navigate('/dashboard/credits');
        return;
      }

      const { data: pkg } = await supabase
        .from('pricing_packages')
        .select('id, credits, price, credit_type, name')
        .eq('id', packageId)
        .eq('is_active', true)
        .single();

      if (!pkg) {
        toast.error('Package not found');
        navigate('/dashboard/credits');
        return;
      }

      setSelectedPackage(pkg);
    };
    loadPackage();
  }, [searchParams, navigate]);

  useEffect(() => {
    const fetchSettings = async () => {
      const { data: settings } = await supabase
        .from('settings')
        .select('key, value')
        .in('key', [
          'payment_whatsapp_enabled', 'payment_usdt_enabled', 'payment_binance_enabled', 'payment_viva_enabled', 'payment_stripe_enabled', 'payment_dodo_enabled', 'payment_paypal_enabled', 'payment_paddle_enabled',
          'binance_pay_id',
          'fee_whatsapp', 'fee_usdt', 'fee_binance', 'fee_viva', 'fee_stripe', 'fee_dodo', 'fee_paypal', 'fee_paddle',
          'paddle_client_token', 'paddle_environment'
        ]);

      if (settings) {
        const whatsapp = settings.find(s => s.key === 'payment_whatsapp_enabled');
        const usdt = settings.find(s => s.key === 'payment_usdt_enabled');
        const binance = settings.find(s => s.key === 'payment_binance_enabled');
        const viva = settings.find(s => s.key === 'payment_viva_enabled');
        const stripe = settings.find(s => s.key === 'payment_stripe_enabled');
        const dodo = settings.find(s => s.key === 'payment_dodo_enabled');
        const paypal = settings.find(s => s.key === 'payment_paypal_enabled');
        const binanceId = settings.find(s => s.key === 'binance_pay_id');
        
        const feeWhatsapp = settings.find(s => s.key === 'fee_whatsapp');
        const feeUsdt = settings.find(s => s.key === 'fee_usdt');
        const feeBinance = settings.find(s => s.key === 'fee_binance');
        const feeViva = settings.find(s => s.key === 'fee_viva');
        const feeStripe = settings.find(s => s.key === 'fee_stripe');
        const feeDodo = settings.find(s => s.key === 'fee_dodo');
        const feePaypal = settings.find(s => s.key === 'fee_paypal');
        
        setWhatsappEnabled(whatsapp?.value !== 'false');
        setUsdtEnabled(usdt?.value !== 'false');
        setBinanceEnabled(binance?.value === 'true');
        setVivaEnabled(viva?.value === 'true');
        setStripeEnabled(stripe?.value === 'true');
        setDodoEnabled(dodo?.value === 'true');
        setPaypalEnabled(paypal?.value === 'true');
        if (binanceId) setBinancePayId(binanceId.value);

        const paddlePayment = settings.find(s => s.key === 'payment_paddle_enabled');
        const feePaddleSetting = settings.find(s => s.key === 'fee_paddle');
        const paddleTokenSetting = settings.find(s => s.key === 'paddle_client_token');
        const paddleEnvSetting = settings.find(s => s.key === 'paddle_environment');
        
        setPaddleEnabled(paddlePayment?.value === 'true');
        setPaddleClientToken(paddleTokenSetting?.value || '');
        setPaddleEnvironment(paddleEnvSetting?.value || 'sandbox');
        
        setFees({
          whatsapp: parseFloat(feeWhatsapp?.value || '0') || 0,
          usdt: parseFloat(feeUsdt?.value || '0') || 0,
          binance: parseFloat(feeBinance?.value || '0') || 0,
          viva: parseFloat(feeViva?.value || '0') || 0,
          stripe: parseFloat(feeStripe?.value || '0') || 0,
          dodo: parseFloat(feeDodo?.value || '0') || 0,
          paypal: parseFloat(feePaypal?.value || '0') || 0,
          paddle: parseFloat(feePaddleSetting?.value || '0') || 0,
        });
      }
      setLoading(false);
    };
    fetchSettings();
  }, []);

  const createCryptoPayment = async () => {
    if (!user || !selectedPackage) return;

    setCreatingPayment('usdt');
    try {
      const orderId = `order_${Date.now()}_${user.id.slice(0, 8)}`;
      const totalWithFee = calculateTotalWithFee('usdt');
      
      const response = await supabase.functions.invoke('nowpayments?action=create', {
        body: {
          userId: user.id,
          credits: packageCredits,
          amountUsd: totalWithFee,
          orderId,
        },
      });

      if (response.error) throw new Error(response.error.message);

      const data = response.data;
      if (!data.success) throw new Error(data.error || 'Failed to create payment');

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
    setShowOrderIdStep(false);
    setBinanceOrderId('');
    setShowBinanceDialog(true);
  };

  const proceedToOrderId = () => {
    setShowOrderIdStep(true);
  };

  const validateBinanceOrderId = (orderId: string): { isValid: boolean; error: string } => {
    const trimmed = orderId.trim();
    if (!trimmed) return { isValid: false, error: 'Order ID is required' };
    if (!/^\d+$/.test(trimmed)) return { isValid: false, error: 'Order ID should contain only numbers' };
    if (trimmed.length < 15 || trimmed.length > 25) return { isValid: false, error: 'Order ID should be 15-25 digits long' };
    return { isValid: true, error: '' };
  };

  const submitBinancePayment = async () => {
    if (!user || !selectedPackage) return;
    
    const validation = validateBinanceOrderId(binanceOrderId);
    if (!validation.isValid) {
      toast.error(validation.error);
      return;
    }

    const totalWithFee = calculateTotalWithFee('binance');
    
    setSubmittingBinance(true);
    try {
      const { error } = await supabase.from('manual_payments').insert({
        user_id: user.id,
        payment_method: 'binance_pay',
        amount_usd: totalWithFee,
        credits: packageCredits,
        status: 'pending',
        transaction_id: binanceOrderId.trim(),
        notes: `Package: ${selectedPackage.name || selectedPackage.credits + ' credits'}`,
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
          message: `New payment of $${totalWithFee} for ${packageCredits} credits.\nOrder ID: ${binanceOrderId.trim()}\nUser: ${profile?.email || user.email}\nPlease verify in Admin Panel.`,
          created_by: user.id,
        }));

        await supabase.from('user_notifications').insert(notifications);
      }

      toast.success('Payment submitted! Admin will verify and credit your account.');
      setShowBinanceDialog(false);
      setBinanceOrderId('');
      setShowOrderIdStep(false);
      navigate('/dashboard/payments');
    } catch (error: any) {
      console.error('Binance payment error:', error);
      toast.error('Failed to submit payment');
    } finally {
      setSubmittingBinance(false);
    }
  };

  const createVivaPayment = async () => {
    if (!user || !selectedPackage) return;

    setCreatingVivaPayment(true);
    try {
      const totalWithFee = calculateTotalWithFee('viva');
      const orderId = `viva_${Date.now()}_${user.id.slice(0, 8)}`;

      const response = await supabase.functions.invoke('viva-payments?action=create', {
        body: {
          userId: user.id,
          credits: packageCredits,
          amountUsd: totalWithFee,
          orderId,
          customerEmail: profile?.email || user.email,
          customerName: profile?.full_name || '',
        },
      });

      if (response.error) throw new Error(response.error.message);

      const data = response.data;
      if (!data.success) throw new Error(data.error || 'Failed to create payment');

      toast.success('Redirecting to payment page...');
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
    const message = `Hi, I want to buy ${packageCredits} credits for $${totalWithFee}. Please help me with the payment.`;
    openWhatsAppCustom(message);
  };

  const createStripePayment = async () => {
    if (!user || !selectedPackage) return;
    setShowStripeEmbeddedCheckout(true);
  };

  const createDodoPayment = async () => {
    if (!user || !selectedPackage) return;

    setCreatingDodoPayment(true);
    try {
      const totalAmount = Math.round(calculateTotalWithFee('dodo') * 100);

      const response = await supabase.functions.invoke('create-dodo-checkout', {
        body: {
          credits: packageCredits,
          amount: totalAmount,
          creditType: packageCreditType,
          cartItems: [{
            packageId: selectedPackage.id,
            credits: selectedPackage.credits,
            quantity: 1,
            creditType: packageCreditType,
          }],
        },
      });

      if (response.error) throw new Error(response.error.message);

      const data = response.data;
      if (!data.url) throw new Error(data.error || 'Failed to create Dodo checkout');

      toast.success('Redirecting to checkout...');
      window.location.href = data.url;
    } catch (error: any) {
      console.error('Dodo payment error:', error);
      toast.error(error.message || 'Failed to create payment');
    } finally {
      setCreatingDodoPayment(false);
    }
  };

  const createPaypalPayment = async () => {
    if (!user || !selectedPackage) return;

    setCreatingPaypalPayment(true);
    try {
      const totalAmount = Math.round(calculateTotalWithFee('paypal') * 100);

      const response = await supabase.functions.invoke('create-paypal-checkout', {
        body: {
          credits: packageCredits,
          amount: totalAmount,
          creditType: packageCreditType,
        },
      });

      if (response.error) throw new Error(response.error.message);

      const data = response.data;
      if (!data.approvalUrl) throw new Error(data.error || 'Failed to create PayPal checkout');

      toast.success('Redirecting to PayPal...');
      window.location.href = data.approvalUrl;
    } catch (error: any) {
      console.error('PayPal payment error:', error);
      toast.error(error.message || 'Failed to create PayPal payment');
    } finally {
      setCreatingPaypalPayment(false);
    }
  };

  // Load Paddle.js script
  useEffect(() => {
    if (!paddleEnabled || !paddleClientToken) return;
    if ((window as any).Paddle) return;

    const script = document.createElement('script');
    script.src = 'https://cdn.paddle.com/paddle/v2/paddle.js';
    script.async = true;
    script.onload = () => {
      const Paddle = (window as any).Paddle;
      if (Paddle) {
        if (paddleEnvironment === 'sandbox') {
          Paddle.Environment.set('sandbox');
        }
        Paddle.Initialize({ token: paddleClientToken });
      }
    };
    document.head.appendChild(script);
  }, [paddleEnabled, paddleClientToken, paddleEnvironment]);

  const createPaddlePayment = async () => {
    if (!user || !selectedPackage) return;

    const Paddle = (window as any).Paddle;
    if (!Paddle) {
      toast.error('Paddle checkout is loading, please try again in a moment');
      return;
    }

    setCreatingPaddlePayment(true);
    try {
      const { data: pkg } = await supabase
        .from('pricing_packages')
        .select('paddle_price_id')
        .eq('id', selectedPackage.id)
        .single();

      if (!pkg?.paddle_price_id) {
        toast.error('This package is not configured for Paddle checkout');
        return;
      }

      const response = await supabase.functions.invoke('create-paddle-checkout', {
        body: {
          priceId: pkg.paddle_price_id,
          credits: packageCredits,
          amount: Math.round(calculateTotalWithFee('paddle') * 100),
          creditType: packageCreditType,
        },
      });

      if (response.error) throw new Error(response.error.message);

      const data = response.data;
      if (!data.transactionId) throw new Error(data.error || 'Failed to create Paddle checkout');

      Paddle.Checkout.open({
        transactionId: data.transactionId,
        settings: {
          successUrl: `${window.location.origin}/dashboard/payment-success?provider=paddle`,
        },
      });
    } catch (error: any) {
      console.error('Paddle payment error:', error);
      toast.error(error.message || 'Failed to create Paddle payment');
    } finally {
      setCreatingPaddlePayment(false);
    }
  };

  if (loading || !selectedPackage) {
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
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-background border border-primary/20 p-6 md:p-8">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          <div className="relative flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard/credits')} className="shrink-0">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-1">
                <div className="h-10 w-10 rounded-xl bg-primary/20 flex items-center justify-center">
                  <CreditCard className="h-5 w-5 text-primary" />
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
                  <CreditCard className="h-5 w-5" />
                  Order Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="font-medium">{selectedPackage.name || `${packageCredits} Credits`}</p>
                  <p className="text-sm text-muted-foreground">{packageCredits} credits • ${packagePrice}</p>
                  <Badge variant="outline" className="mt-1 text-xs">
                    {packageCreditType === 'similarity_only' ? 'Similarity Only' : 'AI Scan'}
                  </Badge>
                </div>

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
                    <span className="text-muted-foreground">Credits</span>
                    <span className="font-medium">
                      {packageCredits}
                      {getTotalBonusCredits() > 0 && (
                        <span className="text-green-600 ml-1">+{getTotalBonusCredits()}</span>
                      )}
                    </span>
                  </div>
                  {appliedPromo?.discountPercentage && appliedPromo.discountPercentage > 0 && (
                    <>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Subtotal</span>
                        <span className="line-through text-muted-foreground">${packagePrice}</span>
                      </div>
                      <div className="flex justify-between text-sm text-green-600">
                        <span>Discount ({appliedPromo.discountPercentage}%)</span>
                        <span>-${(packagePrice - calculateDiscountedTotal(packagePrice)).toFixed(2)}</span>
                      </div>
                    </>
                  )}
                  <div className="flex justify-between text-lg font-bold">
                    <span>Total</span>
                    <span className="text-primary">${calculateDiscountedTotal(packagePrice)}</span>
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
                {stripeEnabled && (
                  <div className="border rounded-lg p-4 hover:border-primary/50 transition-colors">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-[#635BFF]/10 flex items-center justify-center flex-shrink-0">
                          <CreditCard className="h-5 w-5 text-[#635BFF]" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-sm">Credit / Debit Card</h3>
                          <p className="text-xs text-muted-foreground">
                            Visa, Mastercard, Apple Pay
                            {fees.stripe > 0 && <span className="text-amber-600"> (+{fees.stripe}%)</span>}
                          </p>
                        </div>
                      </div>
                      <Button onClick={createStripePayment} disabled={creatingStripePayment} size="sm">
                        {creatingStripePayment ? <Loader2 className="h-4 w-4 animate-spin" /> : `Pay $${calculateTotalWithFee('stripe')}`}
                      </Button>
                    </div>
                  </div>
                )}

                {dodoEnabled && (
                  <div className="border rounded-lg p-4 hover:border-primary/50 transition-colors">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-[#4F46E5]/10 flex items-center justify-center flex-shrink-0">
                          <CreditCard className="h-5 w-5 text-[#4F46E5]" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-sm">Card / Google Pay / Apple Pay</h3>
                          <p className="text-xs text-muted-foreground">
                            {fees.dodo > 0 && <span className="text-amber-600">(+{fees.dodo}%)</span>}
                          </p>
                        </div>
                      </div>
                      <Button onClick={createDodoPayment} disabled={creatingDodoPayment} size="sm">
                        {creatingDodoPayment ? <Loader2 className="h-4 w-4 animate-spin" /> : `Pay $${calculateTotalWithFee('dodo').toFixed(2)}`}
                      </Button>
                    </div>
                  </div>
                )}

                {paypalEnabled && (
                  <div className="border rounded-lg p-4 hover:border-primary/50 transition-colors">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-[#003087]/10 flex items-center justify-center flex-shrink-0">
                          <Wallet className="h-5 w-5 text-[#003087]" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-sm">PayPal</h3>
                          <p className="text-xs text-muted-foreground">
                            {fees.paypal > 0 && <span className="text-amber-600">(+{fees.paypal}%)</span>}
                          </p>
                        </div>
                      </div>
                      <Button onClick={createPaypalPayment} disabled={creatingPaypalPayment} size="sm">
                        {creatingPaypalPayment ? <Loader2 className="h-4 w-4 animate-spin" /> : `Pay $${calculateTotalWithFee('paypal').toFixed(2)}`}
                      </Button>
                    </div>
                  </div>
                )}

                {paddleEnabled && (
                  <div className="border rounded-lg p-4 hover:border-primary/50 transition-colors">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-[#0E1F3F]/10 flex items-center justify-center flex-shrink-0">
                          <Store className="h-5 w-5 text-[#0E1F3F]" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-sm">Paddle</h3>
                          <p className="text-xs text-muted-foreground">
                            Cards, PayPal, Apple Pay
                            {fees.paddle > 0 && <span className="text-amber-600"> (+{fees.paddle}%)</span>}
                          </p>
                        </div>
                      </div>
                      <Button onClick={createPaddlePayment} disabled={creatingPaddlePayment} size="sm">
                        {creatingPaddlePayment ? <Loader2 className="h-4 w-4 animate-spin" /> : `Pay $${calculateTotalWithFee('paddle').toFixed(2)}`}
                      </Button>
                    </div>
                  </div>
                )}

                {vivaEnabled && (
                  <div className="border rounded-lg p-4 hover:border-primary/50 transition-colors">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-[#1A1F71]/10 flex items-center justify-center flex-shrink-0">
                          <Globe className="h-5 w-5 text-[#1A1F71]" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-sm">Card (Viva.com)</h3>
                          <p className="text-xs text-muted-foreground">
                            {fees.viva > 0 && <span className="text-amber-600">(+{fees.viva}%)</span>}
                          </p>
                        </div>
                      </div>
                      <Button onClick={createVivaPayment} disabled={creatingVivaPayment} size="sm">
                        {creatingVivaPayment ? <Loader2 className="h-4 w-4 animate-spin" /> : `Pay $${calculateTotalWithFee('viva')}`}
                      </Button>
                    </div>
                  </div>
                )}

                {binanceEnabled && (
                  <div className="border rounded-lg p-4 hover:border-primary/50 transition-colors">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-[#F0B90B]/10 flex items-center justify-center flex-shrink-0">
                          <Wallet className="h-5 w-5 text-[#F0B90B]" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-sm">Binance Pay</h3>
                        </div>
                      </div>
                      <Button onClick={openBinancePayment} size="sm" variant="outline">Pay with Binance</Button>
                    </div>
                  </div>
                )}

                {usdtEnabled && (
                  <div className="border rounded-lg p-4 hover:border-primary/50 transition-colors">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center flex-shrink-0">
                          <Bitcoin className="h-5 w-5 text-green-500" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-sm">USDT (TRC20)</h3>
                        </div>
                      </div>
                      <Button onClick={createCryptoPayment} disabled={creatingPayment === 'usdt'} size="sm" variant="outline">
                        {creatingPayment === 'usdt' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Pay with USDT'}
                      </Button>
                    </div>
                  </div>
                )}

                {whatsappEnabled && (
                  <div className="border rounded-lg p-4 hover:border-primary/50 transition-colors">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-[#25D366]/10 flex items-center justify-center flex-shrink-0">
                          <MessageCircle className="h-5 w-5 text-[#25D366]" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-sm">WhatsApp</h3>
                          <p className="text-xs text-muted-foreground">Manual payment</p>
                        </div>
                      </div>
                      <Button onClick={handleWhatsAppPayment} size="sm" variant="outline">Contact Us</Button>
                    </div>
                  </div>
                )}

                {!stripeEnabled && !vivaEnabled && !binanceEnabled && !usdtEnabled && !whatsappEnabled && !paddleEnabled && (
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
                  <Input value={paymentDetails.payAmount.toFixed(6)} readOnly className="font-mono text-lg" />
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
                  <Input value={paymentDetails.payAddress} readOnly className="font-mono text-xs" />
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
                <Button variant="outline" className="flex-1" onClick={checkPaymentStatus} disabled={checkingStatus}>
                  {checkingStatus ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
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
              {!showOrderIdStep ? 'Follow these steps to complete your payment' : 'Enter your Binance Pay Order ID'}
            </DialogDescription>
          </DialogHeader>
          
          {!showOrderIdStep ? (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg space-y-3">
                <p className="font-medium">Total: ${packagePrice}</p>
                <p className="text-sm text-muted-foreground">For {packageCredits} credits</p>
              </div>

              <ol className="space-y-3 text-sm">
                <li className="flex gap-3">
                  <span className="h-6 w-6 rounded-full bg-[#F0B90B] text-black flex items-center justify-center font-bold flex-shrink-0 text-xs">1</span>
                  <span>Open Binance app and go to Pay section</span>
                </li>
                <li className="flex gap-3">
                  <span className="h-6 w-6 rounded-full bg-[#F0B90B] text-black flex items-center justify-center font-bold flex-shrink-0 text-xs">2</span>
                  <div>
                    <span>Send ${packagePrice} to Pay ID: </span>
                    <Button variant="link" className="p-0 h-auto text-primary" onClick={() => {
                      navigator.clipboard.writeText(binancePayId);
                      toast.success('Pay ID copied');
                    }}>
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

              <Button className="w-full bg-[#F0B90B] hover:bg-[#D4A50A] text-black" onClick={proceedToOrderId}>
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
                <p className="text-xs text-muted-foreground">Find this in your Binance Pay transaction history</p>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setShowOrderIdStep(false)}>Back</Button>
                <Button 
                  className="flex-1 bg-[#F0B90B] hover:bg-[#D4A50A] text-black"
                  onClick={submitBinancePayment}
                  disabled={submittingBinance || !binanceOrderId.trim()}
                >
                  {submittingBinance ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                  Submit
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Stripe Embedded Checkout Dialog */}
      <StripeEmbeddedCheckout
        open={showStripeEmbeddedCheckout}
        onClose={() => setShowStripeEmbeddedCheckout(false)}
        credits={packageCredits}
        amount={Math.round(calculateTotalWithFee('stripe') * 100)}
        creditType={packageCreditType}
        onSuccess={() => {
          navigate('/dashboard/payment-success');
        }}
      />
    </DashboardLayout>
  );
}
