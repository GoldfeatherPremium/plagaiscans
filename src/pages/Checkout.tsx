import React, { useEffect, useState, useMemo } from 'react';
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
  RefreshCw, Wallet, Globe, Plus, Minus,
  CheckCircle, MessageCircle, AlertCircle, Tag, X, Shield, Store, Landmark
} from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useWhatsApp } from '@/hooks/useWhatsApp';
import { usePromoCode } from '@/hooks/usePromoCode';
import { StripeEmbeddedCheckout } from '@/components/StripeEmbeddedCheckout';
import { BANK_TRANSFER_COUNTRY_CODES } from '@/data/bankTransferCountries';
import { countries, Country, validatePhoneNumber } from '@/data/countries';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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
  const isSpecial = profile?.is_special ?? false;
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
  const [binanceDiscount, setBinanceDiscount] = useState(0);
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
  
  const [bankTransferEnabled, setBankTransferEnabled] = useState(true);
  const [showBankTransferDialog, setShowBankTransferDialog] = useState(false);
  
  // USDT Manual Transfer
  const [usdtManualEnabled, setUsdtManualEnabled] = useState(false);
  const [usdtManualWalletAddress, setUsdtManualWalletAddress] = useState('');
  const [showUsdtManualDialog, setShowUsdtManualDialog] = useState(false);
  const [usdtManualHash, setUsdtManualHash] = useState('');
  const [submittingUsdtManual, setSubmittingUsdtManual] = useState(false);
  const [usdtManualStep, setUsdtManualStep] = useState<'info' | 'hash'>('info');
  const [btCountry, setBtCountry] = useState('');
  const [btFullName, setBtFullName] = useState('');
  const [btWhatsApp, setBtWhatsApp] = useState('');
  const [btEmail, setBtEmail] = useState('');
  const [btPhoneValid, setBtPhoneValid] = useState(false);

  const [bankTransferCountryCodes, setBankTransferCountryCodes] = useState<string[]>([...BANK_TRANSFER_COUNTRY_CODES]);

  const bankTransferCountries = useMemo(() => 
    countries
      .filter(c => bankTransferCountryCodes.includes(c.code))
      .sort((a, b) => a.name.localeCompare(b.name)),
    [bankTransferCountryCodes]
  );

  const selectedBtCountry = useMemo(() => 
    countries.find(c => c.code === btCountry),
    [btCountry]
  );

  const [quantity, setQuantity] = useState(1);

  const packagePrice = selectedPackage?.price || 0;
  const packageCredits = selectedPackage?.credits || 0;
  const packageCreditType = (selectedPackage?.credit_type || 'full') as 'full' | 'similarity_only';

  const totalCredits = packageCredits * quantity;
  const totalPrice = packagePrice * quantity;

  const updateQuantity = (delta: number) => {
    setQuantity(prev => Math.max(1, Math.min(99, prev + delta)));
  };

  const handleQuantityInput = (value: string) => {
    const num = parseInt(value, 10);
    if (isNaN(num)) {
      setQuantity(1);
    } else {
      setQuantity(Math.max(1, Math.min(99, num)));
    }
  };

  const calculateTotalWithFee = (method: 'whatsapp' | 'usdt' | 'binance' | 'viva' | 'stripe' | 'dodo' | 'paypal' | 'paddle') => {
    const discountedTotal = calculateDiscountedTotal(totalPrice);
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
      const settingKeys = [
        'payment_whatsapp_enabled', 'payment_usdt_enabled', 'payment_binance_enabled', 'payment_viva_enabled', 'payment_stripe_enabled', 'payment_dodo_enabled', 'payment_paypal_enabled', 'payment_paddle_enabled', 'payment_bank_transfer_enabled', 'payment_usdt_manual_enabled', 'usdt_manual_wallet_address', 'bank_transfer_countries',
        'binance_pay_id', 'binance_discount_percent',
        'fee_whatsapp', 'fee_usdt', 'fee_binance', 'fee_viva', 'fee_stripe', 'fee_dodo', 'fee_paypal', 'fee_paddle',
        'paddle_client_token', 'paddle_environment',
      ];

      // If user is ★, also fetch special payment settings
      if (isSpecial) {
        settingKeys.push(
          'special_payment_whatsapp_enabled', 'special_payment_usdt_enabled', 'special_payment_binance_enabled',
          'special_payment_viva_enabled', 'special_payment_stripe_enabled', 'special_payment_dodo_enabled',
          'special_payment_paypal_enabled', 'special_payment_paddle_enabled',
          'special_payment_usdt_manual_enabled', 'special_payment_bank_transfer_enabled',
        );
      }

      const { data: settings } = await supabase
        .from('settings')
        .select('key, value')
        .in('key', settingKeys);

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
        const binanceDiscountSetting = settings.find(s => s.key === 'binance_discount_percent');
        if (binanceDiscountSetting) setBinanceDiscount(parseFloat(binanceDiscountSetting.value) || 0);

        const bankTransferSetting = settings.find(s => s.key === 'payment_bank_transfer_enabled');
        setBankTransferEnabled(bankTransferSetting?.value !== 'false');

        const bankTransferCountriesSetting = settings.find(s => s.key === 'bank_transfer_countries');
        if (bankTransferCountriesSetting) {
          try {
            const parsed = JSON.parse(bankTransferCountriesSetting.value);
            if (Array.isArray(parsed)) setBankTransferCountryCodes(parsed);
          } catch {}
        }
        const usdtManualSetting = settings.find(s => s.key === 'payment_usdt_manual_enabled');
        const usdtManualWalletSetting = settings.find(s => s.key === 'usdt_manual_wallet_address');
        setUsdtManualEnabled(usdtManualSetting?.value === 'true');
        setUsdtManualWalletAddress(usdtManualWalletSetting?.value || '');

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

        // Override with ★ customer payment settings if applicable
        if (isSpecial) {
          const sp = (key: string) => settings.find(s => s.key === key)?.value === 'true';
          setWhatsappEnabled(sp('special_payment_whatsapp_enabled'));
          setUsdtEnabled(sp('special_payment_usdt_enabled'));
          setBinanceEnabled(sp('special_payment_binance_enabled'));
          setVivaEnabled(sp('special_payment_viva_enabled'));
          setStripeEnabled(sp('special_payment_stripe_enabled'));
          setDodoEnabled(sp('special_payment_dodo_enabled'));
          setPaypalEnabled(sp('special_payment_paypal_enabled'));
          setPaddleEnabled(sp('special_payment_paddle_enabled'));
          setUsdtManualEnabled(sp('special_payment_usdt_manual_enabled'));
          setBankTransferEnabled(sp('special_payment_bank_transfer_enabled'));
        }
      }
      setLoading(false);
    };
    fetchSettings();
  }, [isSpecial]);

  const createCryptoPayment = async () => {
    if (!user || !selectedPackage) return;

    setCreatingPayment('usdt');
    try {
      const orderId = `order_${Date.now()}_${user.id.slice(0, 8)}`;
      const totalWithFee = calculateTotalWithFee('usdt');
      
      const response = await supabase.functions.invoke('nowpayments?action=create', {
        body: {
          userId: user.id,
          credits: totalCredits,
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

    const baseTotal = calculateTotalWithFee('binance');
    const totalWithDiscount = binanceDiscount > 0 
      ? Math.round(calculateDiscountedTotal(totalPrice) * (1 - binanceDiscount / 100) * 100) / 100
      : baseTotal;
    
    setSubmittingBinance(true);
    try {
      const { error } = await supabase.from('manual_payments').insert({
        user_id: user.id,
        payment_method: 'binance_pay',
        amount_usd: totalWithDiscount,
        credits: totalCredits,
        status: 'pending',
        transaction_id: binanceOrderId.trim(),
        notes: `Package: ${selectedPackage.name || selectedPackage.credits + ' credits'} × ${quantity}`,
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
          message: `New payment of $${totalWithDiscount} for ${totalCredits} credits (qty ${quantity}).\nOrder ID: ${binanceOrderId.trim()}\nUser: ${profile?.email || user.email}\nPlease verify in Admin Panel.`,
          created_by: user.id,
        }));

        await supabase.from('user_notifications').insert(notifications);
      }

      // Send push notification to admins
      await supabase.functions.invoke('send-push-notification', {
        body: {
          title: '🔔 New Binance Pay Payment',
          body: `$${totalWithDiscount} for ${totalCredits} credits from ${profile?.email || user.email}. Please verify.`,
          targetAudience: 'admins',
          eventType: 'admin_manual_payment',
          url: '/admin/manual-payments',
        },
      });

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
          credits: totalCredits,
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
    const message = `Hi, I want to buy ${totalCredits} credits (qty ${quantity} × ${packageCredits}) for $${totalWithFee}. Please help me with the payment.`;
    openWhatsAppCustom(message);
  };

  const openUsdtManualDialog = () => {
    setUsdtManualHash('');
    setUsdtManualStep('info');
    setShowUsdtManualDialog(true);
  };

  const submitUsdtManualPayment = async () => {
    if (!user || !selectedPackage) return;
    const hash = usdtManualHash.trim();
    if (!hash || hash.length < 10) {
      toast.error('Please enter a valid transaction hash');
      return;
    }

    setSubmittingUsdtManual(true);
    try {
      const totalAmount = calculateDiscountedTotal(totalPrice);
      
      const { error } = await supabase.from('manual_payments').insert({
        user_id: user.id,
        payment_method: 'usdt_manual',
        amount_usd: totalAmount,
        credits: totalCredits,
        status: 'pending',
        transaction_id: hash,
        notes: `USDT TRC20 Transfer — Package: ${selectedPackage.name || selectedPackage.credits + ' credits'} × ${quantity}`,
      });

      if (error) throw error;

      // Notify admins
      const { data: adminRoles } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'admin');

      if (adminRoles && adminRoles.length > 0) {
        const notifications = adminRoles.map(admin => ({
          user_id: admin.user_id,
          title: '💰 New USDT Transfer Payment',
          message: `New USDT payment of $${totalAmount} for ${totalCredits} credits (qty ${quantity}).\nTx Hash: ${hash}\nUser: ${profile?.email || user.email}\nPlease verify in Admin Panel.`,
          created_by: user.id,
        }));
        await supabase.from('user_notifications').insert(notifications);
      }

      // Send push notification to admins
      await supabase.functions.invoke('send-push-notification', {
        body: {
          title: '💰 New USDT Transfer Payment',
          body: `$${totalAmount} for ${totalCredits} credits from ${profile?.email || user.email}. Please verify.`,
          targetAudience: 'admins',
          eventType: 'admin_manual_payment',
          url: '/admin/manual-payments',
        },
      });

      toast.success('Payment submitted! Admin will verify and credit your account.');
      setShowUsdtManualDialog(false);
      navigate('/dashboard/payments');
    } catch (error: any) {
      console.error('USDT manual payment error:', error);
      toast.error('Failed to submit payment');
    } finally {
      setSubmittingUsdtManual(false);
    }
  };

  const openBankTransferDialog = () => {
    setBtEmail(profile?.email || user?.email || '');
    setBtFullName('');
    setBtWhatsApp('');
    setBtCountry('');
    setBtPhoneValid(false);
    setShowBankTransferDialog(true);
  };

  const handleBankTransferSubmit = () => {
    if (!btCountry) { toast.error('Please select your country'); return; }
    if (!btFullName.trim() || btFullName.trim().length < 2) { toast.error('Please enter your full name'); return; }
    if (!btWhatsApp || !btPhoneValid) { toast.error('Please enter a valid WhatsApp number'); return; }
    if (!btEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(btEmail.trim())) { toast.error('Please enter a valid email'); return; }

    const countryName = selectedBtCountry?.name || btCountry;
    const message = `Hello, I'd like to pay via Bank Transfer.\n\nCountry: ${countryName}\nFull Name: ${btFullName.trim()}\nWhatsApp: ${btWhatsApp}\nEmail: ${btEmail.trim()}\nCredits: ${totalCredits} (qty ${quantity} × ${packageCredits})\nAmount: $${calculateDiscountedTotal(totalPrice)}\n\nPlease share your bank account details.`;
    openWhatsAppCustom(message);
    setShowBankTransferDialog(false);
    toast.success('Redirecting to WhatsApp...');
  };

  const handleBtPhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value.replace(/\D/g, '');
    const maxLen = selectedBtCountry?.maxLength || 15;
    const limitedValue = inputValue.slice(0, maxLen);
    setBtWhatsApp(limitedValue ? `${selectedBtCountry?.dialCode || ''}${limitedValue}` : '');
    if (limitedValue && selectedBtCountry) {
      const validation = validatePhoneNumber(limitedValue, selectedBtCountry);
      setBtPhoneValid(validation.valid);
    } else {
      setBtPhoneValid(false);
    }
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
          credits: totalCredits,
          amount: totalAmount,
          creditType: packageCreditType,
          cartItems: [{
            packageId: selectedPackage.id,
            credits: selectedPackage.credits,
            quantity: quantity,
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
          credits: totalCredits,
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

  // Inline Paddle state
  const [paddleReady, setPaddleReady] = useState(false);
  const [paddleLoadFailed, setPaddleLoadFailed] = useState(false);
  const [paddlePriceId, setPaddlePriceId] = useState<string | null>(null);
  const [paddleMountError, setPaddleMountError] = useState<string | null>(null);
  const [showUsdtSection, setShowUsdtSection] = useState(false);
  const [paddleTotals, setPaddleTotals] = useState<{ subtotal: number; tax: number; total: number; currency: string } | null>(null);

  // Load Paddle.js script
  useEffect(() => {
    if (!paddleEnabled || !paddleClientToken) return;
    if ((window as any).Paddle) {
      setPaddleReady(true);
      return;
    }

    const existing = document.querySelector('script[src="https://cdn.paddle.com/paddle/v2/paddle.js"]');
    if (existing) return;

    const script = document.createElement('script');
    script.src = 'https://cdn.paddle.com/paddle/v2/paddle.js';
    script.async = true;
    const timer = setTimeout(() => {
      if (!(window as any).Paddle) setPaddleLoadFailed(true);
    }, 5000);
    script.onload = () => {
      clearTimeout(timer);
      const Paddle = (window as any).Paddle;
      if (Paddle) {
        if (paddleEnvironment === 'sandbox') {
          Paddle.Environment.set('sandbox');
        }
        Paddle.Initialize({ token: paddleClientToken });
        setPaddleReady(true);
      }
    };
    script.onerror = () => {
      clearTimeout(timer);
      setPaddleLoadFailed(true);
    };
    document.head.appendChild(script);
  }, [paddleEnabled, paddleClientToken, paddleEnvironment]);

  // Fetch the paddle price id for the selected package
  useEffect(() => {
    if (!selectedPackage) return;
    let cancelled = false;
    (async () => {
      const { data: pkg } = await supabase
        .from('pricing_packages')
        .select('paddle_price_id')
        .eq('id', selectedPackage.id)
        .single();
      if (!cancelled) {
        setPaddlePriceId(pkg?.paddle_price_id || null);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedPackage]);

  // Mount inline Paddle checkout (re-mounts when quantity/promo/package changes)
  const paddleMountKey = `${selectedPackage?.id || ''}-${quantity}-${appliedPromo?.code || ''}`;
  useEffect(() => {
    if (!paddleEnabled || !paddleReady || !paddlePriceId || !user || !selectedPackage) return;

    const Paddle = (window as any).Paddle;
    if (!Paddle) return;

    let cancelled = false;
    setPaddleMountError(null);
    setPaddleTotals(null);

    (async () => {
      try {
        const response = await supabase.functions.invoke('create-paddle-checkout', {
          body: {
            priceId: paddlePriceId,
            credits: packageCredits,
            quantity: quantity,
            amount: Math.round(calculateTotalWithFee('paddle') * 100),
            creditType: packageCreditType,
          },
        });

        if (cancelled) return;
        if (response.error) throw new Error(response.error.message);
        const data = response.data;
        if (!data.transactionId) throw new Error(data.error || 'Failed to create Paddle checkout');

        try { Paddle.Checkout.close(); } catch {}

        Paddle.Checkout.open({
          transactionId: data.transactionId,
          settings: {
            displayMode: 'inline',
            theme: 'light',
            frameTarget: 'paddle-inline-frame',
            frameInitialHeight: 450,
            frameStyle: 'width:100%; min-width:312px; background-color: transparent; border: none;',
            successUrl: `${window.location.origin}/dashboard/payment-success?provider=paddle`,
            allowLogout: false,
          },
          eventCallback: (event: any) => {
            // Debug: log all paddle events to trace totals shape
            if (event?.name) {
              console.log('[Paddle event]', event.name, event.data);
            }

            // Paddle v2 emits totals in multiple shapes depending on the event.
            // Capture explicit values first, then infer tax from total - subtotal when needed.
            const d = event?.data || {};
            const rootTotals = d.totals || {};
            const recurring = d.recurring_totals || {};
            const items: any[] = Array.isArray(d.items) ? d.items : [];

            const toAmount = (value: unknown) => {
              const amount = Number(value);
              return Number.isFinite(amount) ? amount : 0;
            };

            const sumItems = (keys: string[]) =>
              items.reduce((acc, item) => {
                const totals = item?.totals || {};
                const matched = keys.find((key) => totals[key] != null);
                return acc + toAmount(matched ? totals[matched] : 0);
              }, 0);

            const explicitSubtotal = toAmount(
              rootTotals.subtotal ??
                rootTotals.sub_total ??
                rootTotals.subTotal ??
                recurring.subtotal ??
                recurring.sub_total ??
                recurring.subTotal ??
                (items.length ? sumItems(['subtotal', 'sub_total', 'subTotal']) : 0) ??
                rootTotals.balance ??
                0
            );

            const explicitTax = toAmount(
              rootTotals.tax ??
                rootTotals.tax_total ??
                rootTotals.taxTotal ??
                recurring.tax ??
                recurring.tax_total ??
                recurring.taxTotal ??
                (items.length ? sumItems(['tax', 'tax_total', 'taxTotal']) : 0) ??
                0
            );

            const explicitTotal = toAmount(
              rootTotals.total ??
                rootTotals.grand_total ??
                rootTotals.grandTotal ??
                d.total ??
                d.grand_total ??
                recurring.total ??
                recurring.grand_total ??
                recurring.grandTotal ??
                (items.length ? sumItems(['total', 'grand_total', 'grandTotal']) : 0) ??
                0
            );

            const inferredTax = explicitTax > 0
              ? explicitTax
              : explicitTotal > explicitSubtotal
                ? Number((explicitTotal - explicitSubtotal).toFixed(2))
                : 0;

            const currency =
              d.currency_code ||
              d.currencyCode ||
              items[0]?.price?.currency_code ||
              items[0]?.price?.currencyCode ||
              'USD';

            if (explicitSubtotal > 0 || inferredTax > 0 || explicitTotal > 0) {
              setPaddleTotals((prev) => {
                const nextSubtotal = explicitSubtotal > 0
                  ? explicitSubtotal
                  : explicitTotal > 0 && inferredTax >= 0
                    ? Number((explicitTotal - inferredTax).toFixed(2))
                    : (prev?.subtotal ?? 0);
                const nextTax = inferredTax > 0 ? inferredTax : (prev?.tax ?? 0);
                const nextTotal = explicitTotal > 0 ? explicitTotal : Number((nextSubtotal + nextTax).toFixed(2));

                return {
                  subtotal: nextSubtotal,
                  tax: nextTax,
                  total: nextTotal,
                  currency: currency || prev?.currency || 'USD',
                };
              });
            }

            if (event?.name === 'checkout.completed') {
              navigate('/dashboard/payment-success?provider=paddle');
            }
          },
        });
      } catch (error: any) {
        if (!cancelled) {
          console.error('Paddle inline mount error:', error);
          setPaddleMountError(error.message || 'Failed to load card checkout');
        }
      }
    })();

    return () => {
      cancelled = true;
      try { (window as any).Paddle?.Checkout?.close(); } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paddleMountKey, paddleEnabled, paddleReady, paddlePriceId, user?.id]);

  const createPaddlePayment = async () => {
    // Legacy handler kept for compatibility — not used in inline flow.
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
      <div className="max-w-7xl mx-auto space-y-8">
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

        <div className="grid md:grid-cols-2 md:gap-8 items-start xl:grid-cols-[minmax(0,1.15fr)_minmax(340px,0.85fr)]">
          {/* Order Summary */}
          <div className="min-w-0 md:order-2">
            <Card className="sticky top-4">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Order Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-3 rounded-lg bg-muted/50 space-y-3">
                  <div>
                    <p className="font-medium">{selectedPackage.name || `${packageCredits} Credits`}</p>
                    <p className="text-sm text-muted-foreground">{packageCredits} credits • ${packagePrice} each</p>
                    <Badge variant="outline" className="mt-1 text-xs">
                      {packageCreditType === 'similarity_only' ? 'Similarity Only' : 'AI Scan'}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between gap-2 pt-2 border-t">
                    <Label className="text-sm font-medium">Quantity</Label>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => updateQuantity(-1)}
                        disabled={quantity <= 1}
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <Input
                        type="number"
                        min={1}
                        max={99}
                        value={quantity}
                        onChange={(e) => handleQuantityInput(e.target.value)}
                        className="h-8 w-14 text-center font-semibold"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => updateQuantity(1)}
                        disabled={quantity >= 99}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
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
                      {totalCredits}
                      {quantity > 1 && (
                        <span className="text-muted-foreground text-xs ml-1">({packageCredits} × {quantity})</span>
                      )}
                      {getTotalBonusCredits() > 0 && (
                        <span className="text-green-600 ml-1">+{getTotalBonusCredits()}</span>
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className={appliedPromo?.discountPercentage && appliedPromo.discountPercentage > 0 ? 'line-through text-muted-foreground' : ''}>
                      ${totalPrice.toFixed(2)}
                    </span>
                  </div>
                  {appliedPromo?.discountPercentage && appliedPromo.discountPercentage > 0 && (
                    <div className="flex justify-between text-sm text-green-600">
                      <span>Discount ({appliedPromo.discountPercentage}%)</span>
                      <span>-${(totalPrice - calculateDiscountedTotal(totalPrice)).toFixed(2)}</span>
                    </div>
                  )}
                  {paddleTotals && paddleTotals.tax > 0 && (
                    <>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Net amount</span>
                        <span>${paddleTotals.subtotal.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">VAT / Tax</span>
                        <span>${paddleTotals.tax.toFixed(2)}</span>
                      </div>
                    </>
                  )}
                  <div className="flex justify-between text-lg font-bold">
                    <span>Total{paddleTotals && paddleTotals.tax > 0 ? ' (incl. VAT)' : ''}</span>
                    <span className="text-primary">
                      ${(paddleTotals?.total ?? calculateDiscountedTotal(totalPrice)).toFixed(2)}
                    </span>
                  </div>
                  {paddleTotals && paddleTotals.tax > 0 && (
                    <p className="text-xs text-muted-foreground text-right">
                      VAT calculated by Paddle based on your billing location
                    </p>
                  )}
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
          <div className="min-w-0 md:order-1 space-y-6">
            <Card className="overflow-hidden">
              <CardHeader className="bg-muted/30 border-b">
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-primary" />
                  Payment Method
                </CardTitle>
                <CardDescription>All transactions are secure and encrypted</CardDescription>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                {/* Inline Paddle card checkout — primary */}
                {paddleEnabled && paddleClientToken && paddlePriceId && !paddleLoadFailed && !paddleMountError ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Shield className="h-4 w-4 text-green-500" />
                      <span>Pay securely with card, Google Pay, or Apple Pay</span>
                    </div>
                    <div className="border rounded-lg overflow-hidden bg-background min-h-[450px] relative">
                      {!paddleReady && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Loader2 className="h-6 w-6 animate-spin text-primary" />
                        </div>
                      )}
                      <div className="paddle-inline-frame" />
                    </div>
                  </div>
                ) : paddleEnabled ? (
                  <div className="border rounded-lg p-6 text-center space-y-2 bg-muted/30">
                    <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto" />
                    <p className="text-sm font-medium">
                      {!paddlePriceId
                        ? 'Card payments unavailable for this package'
                        : paddleLoadFailed
                          ? 'Card payments are temporarily unavailable'
                          : paddleMountError || 'Card payments are temporarily unavailable'}
                    </p>
                    <p className="text-xs text-muted-foreground">You can still pay with USDT below.</p>
                  </div>
                ) : null}

                {/* Unified "Pay via USDT" highlighted button — routes to NowPayments auto if available, else manual */}
                {(usdtEnabled || usdtManualEnabled) && (
                  <div className="pt-4 flex flex-col items-center gap-3">
                    {!showUsdtSection ? (
                      <button
                        type="button"
                        onClick={() => {
                          if (usdtEnabled) {
                            setShowUsdtSection(true);
                          } else {
                            openUsdtManualDialog();
                          }
                        }}
                        className="bg-green-600 hover:bg-green-700 text-white font-medium rounded-full px-5 py-2.5 inline-flex items-center gap-2 shadow-sm transition-colors"
                      >
                        <span className="h-2 w-2 rounded-full bg-white" aria-hidden="true" />
                        Pay via USDT
                      </button>
                    ) : (
                      <div className="w-full border rounded-lg p-4 bg-muted/30">
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center flex-shrink-0">
                              <Bitcoin className="h-5 w-5 text-green-500" />
                            </div>
                            <div>
                              <h3 className="font-semibold text-sm">USDT (TRC20)</h3>
                              <p className="text-xs text-muted-foreground">
                                Pay ${calculateTotalWithFee('usdt').toFixed(2)}
                              </p>
                            </div>
                          </div>
                          <Button
                            onClick={createCryptoPayment}
                            disabled={creatingPayment === 'usdt'}
                            size="sm"
                          >
                            {creatingPayment === 'usdt' ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              'Continue'
                            )}
                          </Button>
                        </div>
                        {usdtManualEnabled && (
                          <div className="mt-3 pt-3 border-t text-center">
                            <button
                              type="button"
                              onClick={openUsdtManualDialog}
                              className="text-xs text-muted-foreground hover:text-primary hover:underline"
                            >
                              Or use manual USDT transfer (admin verifies)
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}


                {/* Fallback when no payment methods are available */}
                {!paddleEnabled && !usdtEnabled && !usdtManualEnabled && (
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
                {binanceDiscount > 0 ? (
                  <>
                    <p className="font-medium">
                      Total: <span className="line-through text-muted-foreground">${calculateDiscountedTotal(totalPrice).toFixed(2)}</span>{' '}
                      <span className="text-green-600">${(calculateDiscountedTotal(totalPrice) * (1 - binanceDiscount / 100)).toFixed(2)}</span>
                    </p>
                    <Badge className="bg-green-600 text-white">{binanceDiscount}% Binance Discount</Badge>
                  </>
                ) : (
                  <p className="font-medium">Total: ${calculateTotalWithFee('binance').toFixed(2)}</p>
                )}
                <p className="text-sm text-muted-foreground">For {totalCredits} credits {quantity > 1 ? `(qty ${quantity})` : ''}</p>
              </div>

              <ol className="space-y-3 text-sm">
                <li className="flex gap-3">
                  <span className="h-6 w-6 rounded-full bg-[#F0B90B] text-black flex items-center justify-center font-bold flex-shrink-0 text-xs">1</span>
                  <span>Open Binance app and go to Pay section</span>
                </li>
                <li className="flex gap-3">
                  <span className="h-6 w-6 rounded-full bg-[#F0B90B] text-black flex items-center justify-center font-bold flex-shrink-0 text-xs">2</span>
                  <div>
                    <span>Send ${binanceDiscount > 0 
                      ? (calculateDiscountedTotal(totalPrice) * (1 - binanceDiscount / 100)).toFixed(2)
                      : calculateTotalWithFee('binance').toFixed(2)
                    } to Pay ID: </span>
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
        credits={totalCredits}
        amount={Math.round(calculateTotalWithFee('stripe') * 100)}
        creditType={packageCreditType}
        onSuccess={() => {
          navigate('/dashboard/payment-success');
        }}
      />

      {/* USDT Manual Transfer Dialog */}
      <Dialog open={showUsdtManualDialog} onOpenChange={setShowUsdtManualDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-[#26A17B]" />
              USDT Transfer (TRC20)
            </DialogTitle>
            <DialogDescription>
              {usdtManualStep === 'info' ? 'Send USDT to the address below' : 'Enter your transaction hash'}
            </DialogDescription>
          </DialogHeader>
          
          {usdtManualStep === 'info' ? (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg space-y-3">
                <p className="font-medium">Amount: ${calculateDiscountedTotal(totalPrice).toFixed(2)}</p>
                <p className="text-sm text-muted-foreground">For {totalCredits} credits {quantity > 1 ? `(qty ${quantity})` : ''}</p>
              </div>

              <div className="space-y-2">
                <Label>Wallet Address (TRC20)</Label>
                <div className="flex items-center gap-2">
                  <Input value={usdtManualWalletAddress} readOnly className="font-mono text-xs" />
                  <Button variant="outline" size="icon" onClick={() => {
                    navigator.clipboard.writeText(usdtManualWalletAddress);
                    toast.success('Address copied');
                  }}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <ol className="space-y-3 text-sm">
                <li className="flex gap-3">
                  <span className="h-6 w-6 rounded-full bg-[#26A17B] text-white flex items-center justify-center font-bold flex-shrink-0 text-xs">1</span>
                  <span>Copy the wallet address above</span>
                </li>
                <li className="flex gap-3">
                  <span className="h-6 w-6 rounded-full bg-[#26A17B] text-white flex items-center justify-center font-bold flex-shrink-0 text-xs">2</span>
                  <span>Send exactly ${calculateDiscountedTotal(totalPrice).toFixed(2)} USDT via TRC20 network</span>
                </li>
                <li className="flex gap-3">
                  <span className="h-6 w-6 rounded-full bg-[#26A17B] text-white flex items-center justify-center font-bold flex-shrink-0 text-xs">3</span>
                  <span>Copy the transaction hash from your wallet</span>
                </li>
              </ol>

              <p className="text-xs text-muted-foreground text-center">
                ⚠️ Send only USDT on TRC20 network. Other networks may result in lost funds.
              </p>

              <Button className="w-full bg-[#26A17B] hover:bg-[#1f8a66] text-white" onClick={() => setUsdtManualStep('hash')}>
                I've Sent the Payment
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="usdtTxHash">Transaction Hash</Label>
                <Input
                  id="usdtTxHash"
                  placeholder="Paste your transaction hash here"
                  value={usdtManualHash}
                  onChange={(e) => setUsdtManualHash(e.target.value.trim())}
                  className="font-mono text-xs"
                  maxLength={128}
                />
                <p className="text-xs text-muted-foreground">Find this in your wallet's transaction history</p>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setUsdtManualStep('info')}>Back</Button>
                <Button
                  className="flex-1 bg-[#26A17B] hover:bg-[#1f8a66] text-white"
                  onClick={submitUsdtManualPayment}
                  disabled={submittingUsdtManual || !usdtManualHash.trim()}
                >
                  {submittingUsdtManual ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                  Submit
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Bank Transfer Dialog */}
      <Dialog open={showBankTransferDialog} onOpenChange={setShowBankTransferDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Landmark className="h-5 w-5 text-primary" />
              Bank Transfer
            </DialogTitle>
            <DialogDescription>
              Fill in your details to request bank account information
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Country</Label>
              <Select value={btCountry} onValueChange={(val) => {
                setBtCountry(val);
                setBtWhatsApp('');
                setBtPhoneValid(false);
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select your country" />
                </SelectTrigger>
                <SelectContent>
                  {bankTransferCountries.map((c) => (
                    <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Full Name (as on bank account)</Label>
              <Input
                placeholder="Enter your full name"
                value={btFullName}
                onChange={(e) => setBtFullName(e.target.value.slice(0, 100))}
                maxLength={100}
              />
            </div>

            <div className="space-y-2">
              <Label>WhatsApp Number</Label>
              <div className="flex gap-2">
                <div className="w-[100px] flex items-center justify-center border rounded-lg bg-muted px-3 text-sm font-medium">
                  {selectedBtCountry?.dialCode || '—'}
                </div>
                <Input
                  type="tel"
                  placeholder="Phone number"
                  value={btWhatsApp ? btWhatsApp.replace(selectedBtCountry?.dialCode || '', '') : ''}
                  onChange={handleBtPhoneChange}
                  disabled={!btCountry}
                  className="flex-1"
                  maxLength={selectedBtCountry?.maxLength || 15}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                placeholder="your@email.com"
                value={btEmail}
                onChange={(e) => setBtEmail(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Credits</Label>
              <Input value={`${totalCredits} credits — $${calculateDiscountedTotal(totalPrice).toFixed(2)}`} readOnly className="bg-muted" />
            </div>

            <Button className="w-full" onClick={handleBankTransferSubmit}>
              <MessageCircle className="h-4 w-4 mr-2" />
              Request Bank Details via WhatsApp
            </Button>

            <p className="text-xs text-muted-foreground text-center">
              No processing fee is applied for bank transfers.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
