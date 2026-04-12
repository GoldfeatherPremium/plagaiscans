import React, { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { MessageCircle, Save, Loader2, Clock, CreditCard, Bitcoin, Wallet, Globe, Percent, AlertTriangle, Bell, Send, Wrench, Mail, FileText, Chrome, Eye, EyeOff, Zap, Bird, Sailboat, Landmark, Plus, X } from 'lucide-react';
import { BANK_TRANSFER_COUNTRY_CODES } from '@/data/bankTransferCountries';
import { countries } from '@/data/countries';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AdminRemarkPresets } from '@/components/AdminRemarkPresets';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function AdminSettings() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingTimeout, setSavingTimeout] = useState(false);
  const [savingPaymentMethods, setSavingPaymentMethods] = useState(false);
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [processingTimeout, setProcessingTimeout] = useState('30');
  const [whatsappEnabled, setWhatsappEnabled] = useState(true);
  const [usdtEnabled, setUsdtEnabled] = useState(true);
  const [binanceEnabled, setBinanceEnabled] = useState(false);
  const [vivaEnabled, setVivaEnabled] = useState(false);
  const [stripeEnabled, setStripeEnabled] = useState(false);
  const [dodoEnabled, setDodoEnabled] = useState(false);
  const [paypalEnabled, setPaypalEnabled] = useState(false);
  const [binancePayId, setBinancePayId] = useState('');
  const [binanceDiscount, setBinanceDiscount] = useState('0');
  const [savingBinance, setSavingBinance] = useState(false);
  
  const [vivaSourceCode, setVivaSourceCode] = useState('');
  const [savingViva, setSavingViva] = useState(false);
  
  const [whatsappFee, setWhatsappFee] = useState('0');
  const [usdtFee, setUsdtFee] = useState('0');
  const [binanceFee, setBinanceFee] = useState('0');
  const [vivaFee, setVivaFee] = useState('0');
  const [stripeFee, setStripeFee] = useState('0');
  const [dodoFee, setDodoFee] = useState('0');
  const [paypalFee, setPaypalFee] = useState('0');
  const [savingFees, setSavingFees] = useState(false);
  
  const [paypalClientId, setPaypalClientId] = useState('');
  const [paypalClientSecret, setPaypalClientSecret] = useState('');
  const [paypalEnvironment, setPaypalEnvironment] = useState('live');
  const [savingPaypal, setSavingPaypal] = useState(false);
  const [showPaypalSecret, setShowPaypalSecret] = useState(false);
  
  const [usdtManualEnabled, setUsdtManualEnabled] = useState(false);
  const [usdtManualWalletAddress, setUsdtManualWalletAddress] = useState('');
  const [savingUsdtManual, setSavingUsdtManual] = useState(false);

  const [bankTransferEnabled, setBankTransferEnabled] = useState(true);
  const [bankTransferCountries, setBankTransferCountries] = useState<string[]>([...BANK_TRANSFER_COUNTRY_CODES]);
  const [savingBankTransfer, setSavingBankTransfer] = useState(false);
  const [newBtCountry, setNewBtCountry] = useState('');

  const [paddleEnabled, setPaddleEnabled] = useState(false);
  const [paddleFee, setPaddleFee] = useState('0');
  const [paddleClientToken, setPaddleClientToken] = useState('');
  const [paddleEnvironment, setPaddleEnvironment] = useState('sandbox');
  const [savingPaddle, setSavingPaddle] = useState(false);

  // ★ Customer payment settings
  const [specialWhatsappEnabled, setSpecialWhatsappEnabled] = useState(false);
  const [specialUsdtEnabled, setSpecialUsdtEnabled] = useState(false);
  const [specialBinanceEnabled, setSpecialBinanceEnabled] = useState(false);
  const [specialVivaEnabled, setSpecialVivaEnabled] = useState(false);
  const [specialStripeEnabled, setSpecialStripeEnabled] = useState(false);
  const [specialDodoEnabled, setSpecialDodoEnabled] = useState(false);
  const [specialPaypalEnabled, setSpecialPaypalEnabled] = useState(false);
  const [specialPaddleEnabled, setSpecialPaddleEnabled] = useState(false);
  const [specialUsdtManualEnabled, setSpecialUsdtManualEnabled] = useState(false);
  const [specialBankTransferEnabled, setSpecialBankTransferEnabled] = useState(false);
  const [savingSpecialPayments, setSavingSpecialPayments] = useState(false);

  const [vapidPublicKey, setVapidPublicKey] = useState('');
  const [savingVapid, setSavingVapid] = useState(false);
  const [testingPush, setTestingPush] = useState(false);
  
  const [maintenanceEnabled, setMaintenanceEnabled] = useState(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState('We are currently under maintenance. Please check back later.');
  const [savingMaintenance, setSavingMaintenance] = useState(false);
  
  const [pendingNotificationEnabled, setPendingNotificationEnabled] = useState(true);
  const [pendingNotificationMinutes, setPendingNotificationMinutes] = useState('15');
  const [savingPendingNotification, setSavingPendingNotification] = useState(false);
  const [testingPendingNotification, setTestingPendingNotification] = useState(false);

  const [googleEnabled, setGoogleEnabled] = useState(false);
  const [googleClientId, setGoogleClientId] = useState('');
  const [googleClientSecret, setGoogleClientSecret] = useState('');
  const [savingGoogle, setSavingGoogle] = useState(false);
  const [showGoogleSecret, setShowGoogleSecret] = useState(false);

  const [adminPaymentEmailEnabled, setAdminPaymentEmailEnabled] = useState(false);
  const [adminPaymentNotifyEmails, setAdminPaymentNotifyEmails] = useState('');
  const [savingAdminPaymentEmail, setSavingAdminPaymentEmail] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    const { data } = await supabase.from('settings').select('*').in('key', [
      'whatsapp_number', 
      'processing_timeout_minutes',
      'payment_whatsapp_enabled',
      'payment_usdt_enabled',
      'payment_binance_enabled',
      'payment_viva_enabled',
      'payment_stripe_enabled',
      'payment_dodo_enabled',
      'payment_paypal_enabled',
      'binance_pay_id',
      'binance_discount_percent',
      'viva_source_code',
      'fee_whatsapp',
      'fee_usdt',
      'fee_binance',
      'fee_viva',
      'fee_stripe',
      'fee_dodo',
      'fee_paypal',
      'vapid_public_key',
      'maintenance_mode_enabled',
      'maintenance_message',
      'pending_notification_enabled',
      'pending_notification_minutes',
      'google_client_id',
      'google_client_secret',
      'google_oauth_enabled',
      'paypal_client_id',
      'paypal_client_secret',
      'paypal_environment',
      'payment_paddle_enabled',
      'fee_paddle',
      'paddle_client_token',
      'paddle_environment',
      'admin_payment_email_enabled',
      'admin_payment_notify_emails',
      'payment_usdt_manual_enabled',
      'usdt_manual_wallet_address',
      'payment_bank_transfer_enabled',
      'bank_transfer_countries',
      // ★ Customer payment settings
      'special_payment_whatsapp_enabled',
      'special_payment_usdt_enabled',
      'special_payment_binance_enabled',
      'special_payment_viva_enabled',
      'special_payment_stripe_enabled',
      'special_payment_dodo_enabled',
      'special_payment_paypal_enabled',
      'special_payment_paddle_enabled',
      'special_payment_usdt_manual_enabled',
      'special_payment_bank_transfer_enabled',
    ]);
    if (data) {
      const whatsapp = data.find(s => s.key === 'whatsapp_number');
      const timeout = data.find(s => s.key === 'processing_timeout_minutes');
      const whatsappPayment = data.find(s => s.key === 'payment_whatsapp_enabled');
      const usdtPayment = data.find(s => s.key === 'payment_usdt_enabled');
      const binancePayment = data.find(s => s.key === 'payment_binance_enabled');
      const vivaPayment = data.find(s => s.key === 'payment_viva_enabled');
      const stripePayment = data.find(s => s.key === 'payment_stripe_enabled');
      const dodoPayment = data.find(s => s.key === 'payment_dodo_enabled');
      const paypalPayment = data.find(s => s.key === 'payment_paypal_enabled');
      const binanceId = data.find(s => s.key === 'binance_pay_id');
      const vivaSource = data.find(s => s.key === 'viva_source_code');
      const feeWhatsapp = data.find(s => s.key === 'fee_whatsapp');
      const feeUsdt = data.find(s => s.key === 'fee_usdt');
      const feeBinance = data.find(s => s.key === 'fee_binance');
      const feeViva = data.find(s => s.key === 'fee_viva');
      const feeStripe = data.find(s => s.key === 'fee_stripe');
      const feeDodo = data.find(s => s.key === 'fee_dodo');
      const feePaypal = data.find(s => s.key === 'fee_paypal');
      
      if (whatsapp) setWhatsappNumber(whatsapp.value);
      if (timeout) setProcessingTimeout(timeout.value);
      setWhatsappEnabled(whatsappPayment?.value !== 'false');
      setUsdtEnabled(usdtPayment?.value !== 'false');
      setBinanceEnabled(binancePayment?.value === 'true');
      setVivaEnabled(vivaPayment?.value === 'true');
      setStripeEnabled(stripePayment?.value === 'true');
      setDodoEnabled(dodoPayment?.value === 'true');
      setPaypalEnabled(paypalPayment?.value === 'true');
      if (binanceId) setBinancePayId(binanceId.value);
      const binanceDiscountSetting = data.find(s => s.key === 'binance_discount_percent');
      if (binanceDiscountSetting) setBinanceDiscount(binanceDiscountSetting.value);
      if (vivaSource) setVivaSourceCode(vivaSource.value);
      if (feeWhatsapp) setWhatsappFee(feeWhatsapp.value);
      if (feeUsdt) setUsdtFee(feeUsdt.value);
      if (feeBinance) setBinanceFee(feeBinance.value);
      if (feeViva) setVivaFee(feeViva.value);
      if (feeStripe) setStripeFee(feeStripe.value);
      if (feeDodo) setDodoFee(feeDodo.value);
      if (feePaypal) setPaypalFee(feePaypal.value);
      
      const paypalClientIdSetting = data.find(s => s.key === 'paypal_client_id');
      const paypalClientSecretSetting = data.find(s => s.key === 'paypal_client_secret');
      const paypalEnvironmentSetting = data.find(s => s.key === 'paypal_environment');
      if (paypalClientIdSetting) setPaypalClientId(paypalClientIdSetting.value);
      if (paypalClientSecretSetting) setPaypalClientSecret(paypalClientSecretSetting.value);
      if (paypalEnvironmentSetting) setPaypalEnvironment(paypalEnvironmentSetting.value);
      
      const paddlePayment = data.find(s => s.key === 'payment_paddle_enabled');
      const feePaddle = data.find(s => s.key === 'fee_paddle');
      const paddleClientTokenSetting = data.find(s => s.key === 'paddle_client_token');
      const paddleEnvironmentSetting = data.find(s => s.key === 'paddle_environment');
      setPaddleEnabled(paddlePayment?.value === 'true');
      if (feePaddle) setPaddleFee(feePaddle.value);
      if (paddleClientTokenSetting) setPaddleClientToken(paddleClientTokenSetting.value);
      if (paddleEnvironmentSetting) setPaddleEnvironment(paddleEnvironmentSetting.value);
      
      const vapidKey = data.find(s => s.key === 'vapid_public_key');
      if (vapidKey) setVapidPublicKey(vapidKey.value);
      
      const maintenanceEnabledSetting = data.find(s => s.key === 'maintenance_mode_enabled');
      const maintenanceMessageSetting = data.find(s => s.key === 'maintenance_message');
      setMaintenanceEnabled(maintenanceEnabledSetting?.value === 'true');
      if (maintenanceMessageSetting) setMaintenanceMessage(maintenanceMessageSetting.value);
      
      const pendingNotificationEnabledSetting = data.find(s => s.key === 'pending_notification_enabled');
      const pendingNotificationMinutesSetting = data.find(s => s.key === 'pending_notification_minutes');
      setPendingNotificationEnabled(pendingNotificationEnabledSetting?.value !== 'false');
      if (pendingNotificationMinutesSetting) setPendingNotificationMinutes(pendingNotificationMinutesSetting.value);
      
      const googleClientIdSetting = data.find(s => s.key === 'google_client_id');
      const googleClientSecretSetting = data.find(s => s.key === 'google_client_secret');
      const googleEnabledSetting = data.find(s => s.key === 'google_oauth_enabled');
      if (googleClientIdSetting) setGoogleClientId(googleClientIdSetting.value);
      if (googleClientSecretSetting) setGoogleClientSecret(googleClientSecretSetting.value);
      setGoogleEnabled(googleEnabledSetting?.value === 'true');
      
      const adminPaymentEmailSetting = data.find(s => s.key === 'admin_payment_email_enabled');
      const adminPaymentEmailsSetting = data.find(s => s.key === 'admin_payment_notify_emails');
      setAdminPaymentEmailEnabled(adminPaymentEmailSetting?.value === 'true');
      if (adminPaymentEmailsSetting) setAdminPaymentNotifyEmails(adminPaymentEmailsSetting.value);

      const usdtManualSetting = data.find(s => s.key === 'payment_usdt_manual_enabled');
      const usdtManualWalletSetting = data.find(s => s.key === 'usdt_manual_wallet_address');
      setUsdtManualEnabled(usdtManualSetting?.value === 'true');
      if (usdtManualWalletSetting) setUsdtManualWalletAddress(usdtManualWalletSetting.value);

      const bankTransferSetting = data.find(s => s.key === 'payment_bank_transfer_enabled');
      setBankTransferEnabled(bankTransferSetting?.value !== 'false');
      const bankTransferCountriesSetting = data.find(s => s.key === 'bank_transfer_countries');
      if (bankTransferCountriesSetting) {
        try {
          const parsed = JSON.parse(bankTransferCountriesSetting.value);
          if (Array.isArray(parsed)) setBankTransferCountries(parsed);
        } catch {}
      }

      // ★ Customer payment settings
      setSpecialWhatsappEnabled(data.find(s => s.key === 'special_payment_whatsapp_enabled')?.value === 'true');
      setSpecialUsdtEnabled(data.find(s => s.key === 'special_payment_usdt_enabled')?.value === 'true');
      setSpecialBinanceEnabled(data.find(s => s.key === 'special_payment_binance_enabled')?.value === 'true');
      setSpecialVivaEnabled(data.find(s => s.key === 'special_payment_viva_enabled')?.value === 'true');
      setSpecialStripeEnabled(data.find(s => s.key === 'special_payment_stripe_enabled')?.value === 'true');
      setSpecialDodoEnabled(data.find(s => s.key === 'special_payment_dodo_enabled')?.value === 'true');
      setSpecialPaypalEnabled(data.find(s => s.key === 'special_payment_paypal_enabled')?.value === 'true');
      setSpecialPaddleEnabled(data.find(s => s.key === 'special_payment_paddle_enabled')?.value === 'true');
      setSpecialUsdtManualEnabled(data.find(s => s.key === 'special_payment_usdt_manual_enabled')?.value === 'true');
      setSpecialBankTransferEnabled(data.find(s => s.key === 'special_payment_bank_transfer_enabled')?.value === 'true');
    }
    setLoading(false);
  };

  const saveWhatsAppNumber = async () => {
    setSaving(true);
    const { error } = await supabase.from('settings').update({ value: whatsappNumber }).eq('key', 'whatsapp_number');
    setSaving(false);
    if (error) {
      toast({ title: 'Error', description: 'Failed to save settings', variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: 'WhatsApp number updated' });
    }
  };

  const saveProcessingTimeout = async () => {
    setSavingTimeout(true);
    const { error } = await supabase.from('settings').update({ value: processingTimeout }).eq('key', 'processing_timeout_minutes');
    setSavingTimeout(false);
    if (error) {
      toast({ title: 'Error', description: 'Failed to save timeout setting', variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: 'Global processing timeout updated' });
    }
  };

  const savePaymentMethods = async () => {
    setSavingPaymentMethods(true);
    
    const updates = [
      supabase.from('settings').upsert({ key: 'payment_whatsapp_enabled', value: whatsappEnabled.toString() }, { onConflict: 'key' }),
      supabase.from('settings').upsert({ key: 'payment_usdt_enabled', value: usdtEnabled.toString() }, { onConflict: 'key' }),
      supabase.from('settings').upsert({ key: 'payment_binance_enabled', value: binanceEnabled.toString() }, { onConflict: 'key' }),
      supabase.from('settings').upsert({ key: 'payment_viva_enabled', value: vivaEnabled.toString() }, { onConflict: 'key' }),
      supabase.from('settings').upsert({ key: 'payment_stripe_enabled', value: stripeEnabled.toString() }, { onConflict: 'key' }),
      supabase.from('settings').upsert({ key: 'payment_dodo_enabled', value: dodoEnabled.toString() }, { onConflict: 'key' }),
      supabase.from('settings').upsert({ key: 'payment_paypal_enabled', value: paypalEnabled.toString() }, { onConflict: 'key' }),
      supabase.from('settings').upsert({ key: 'payment_paddle_enabled', value: paddleEnabled.toString() }, { onConflict: 'key' }),
      supabase.from('settings').upsert({ key: 'payment_usdt_manual_enabled', value: usdtManualEnabled.toString() }, { onConflict: 'key' }),
      supabase.from('settings').upsert({ key: 'payment_bank_transfer_enabled', value: bankTransferEnabled.toString() }, { onConflict: 'key' }),
    ];
    
    const results = await Promise.all(updates);
    setSavingPaymentMethods(false);
    
    if (results.some(r => r.error)) {
      toast({ title: 'Error', description: 'Failed to save payment settings', variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: 'Payment methods updated' });
    }
  };

  const saveSpecialPaymentMethods = async () => {
    setSavingSpecialPayments(true);
    const updates = [
      supabase.from('settings').upsert({ key: 'special_payment_whatsapp_enabled', value: specialWhatsappEnabled.toString() }, { onConflict: 'key' }),
      supabase.from('settings').upsert({ key: 'special_payment_usdt_enabled', value: specialUsdtEnabled.toString() }, { onConflict: 'key' }),
      supabase.from('settings').upsert({ key: 'special_payment_binance_enabled', value: specialBinanceEnabled.toString() }, { onConflict: 'key' }),
      supabase.from('settings').upsert({ key: 'special_payment_viva_enabled', value: specialVivaEnabled.toString() }, { onConflict: 'key' }),
      supabase.from('settings').upsert({ key: 'special_payment_stripe_enabled', value: specialStripeEnabled.toString() }, { onConflict: 'key' }),
      supabase.from('settings').upsert({ key: 'special_payment_dodo_enabled', value: specialDodoEnabled.toString() }, { onConflict: 'key' }),
      supabase.from('settings').upsert({ key: 'special_payment_paypal_enabled', value: specialPaypalEnabled.toString() }, { onConflict: 'key' }),
      supabase.from('settings').upsert({ key: 'special_payment_paddle_enabled', value: specialPaddleEnabled.toString() }, { onConflict: 'key' }),
      supabase.from('settings').upsert({ key: 'special_payment_usdt_manual_enabled', value: specialUsdtManualEnabled.toString() }, { onConflict: 'key' }),
      supabase.from('settings').upsert({ key: 'special_payment_bank_transfer_enabled', value: specialBankTransferEnabled.toString() }, { onConflict: 'key' }),
    ];
    const results = await Promise.all(updates);
    setSavingSpecialPayments(false);
    if (results.some(r => r.error)) {
      toast({ title: 'Error', description: 'Failed to save ★ payment settings', variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: '★ Customer payment methods updated' });
    }
  };

  const saveBinanceSettings = async () => {
    setSavingBinance(true);
    const results = await Promise.all([
      supabase.from('settings').upsert({ key: 'binance_pay_id', value: binancePayId }, { onConflict: 'key' }),
      supabase.from('settings').upsert({ key: 'binance_discount_percent', value: binanceDiscount }, { onConflict: 'key' }),
    ]);
    setSavingBinance(false);
    if (results.some(r => r.error)) {
      toast({ title: 'Error', description: 'Failed to save Binance settings', variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: 'Binance Pay settings updated' });
    }
  };

  const saveVivaSettings = async () => {
    setSavingViva(true);
    const { error } = await supabase.from('settings').upsert({ key: 'viva_source_code', value: vivaSourceCode }, { onConflict: 'key' });
    setSavingViva(false);
    if (error) {
      toast({ title: 'Error', description: 'Failed to save Viva.com settings', variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: 'Viva.com settings updated' });
    }
  };

  const savePaymentFees = async () => {
    setSavingFees(true);
    const updates = [
      supabase.from('settings').upsert({ key: 'fee_whatsapp', value: whatsappFee }, { onConflict: 'key' }),
      supabase.from('settings').upsert({ key: 'fee_usdt', value: usdtFee }, { onConflict: 'key' }),
      supabase.from('settings').upsert({ key: 'fee_binance', value: binanceFee }, { onConflict: 'key' }),
      supabase.from('settings').upsert({ key: 'fee_viva', value: vivaFee }, { onConflict: 'key' }),
      supabase.from('settings').upsert({ key: 'fee_stripe', value: stripeFee }, { onConflict: 'key' }),
      supabase.from('settings').upsert({ key: 'fee_dodo', value: dodoFee }, { onConflict: 'key' }),
      supabase.from('settings').upsert({ key: 'fee_paypal', value: paypalFee }, { onConflict: 'key' }),
      supabase.from('settings').upsert({ key: 'fee_paddle', value: paddleFee }, { onConflict: 'key' }),
    ];
    const results = await Promise.all(updates);
    setSavingFees(false);
    if (results.some(r => r.error)) {
      toast({ title: 'Error', description: 'Failed to save payment fees', variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: 'Payment handling fees updated' });
    }
  };

  const saveVapidKey = async () => {
    setSavingVapid(true);
    const { error } = await supabase.from('settings').upsert({ key: 'vapid_public_key', value: vapidPublicKey }, { onConflict: 'key' });
    setSavingVapid(false);
    if (error) {
      toast({ title: 'Error', description: 'Failed to save VAPID public key', variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: 'VAPID public key updated' });
    }
  };

  const sendTestPush = async () => {
    setTestingPush(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({ title: 'Error', description: 'You must be logged in', variant: 'destructive' });
        return;
      }
      const { error } = await supabase.functions.invoke('send-push-notification', {
        body: { userId: user.id, title: 'Test Push Notification 🔔', body: 'Push notifications are working correctly!', data: { url: '/dashboard/settings' } }
      });
      if (error) throw error;
      toast({ title: 'Success', description: 'Test notification sent! Check your device.' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to send test notification', variant: 'destructive' });
    } finally {
      setTestingPush(false);
    }
  };

  const saveMaintenanceSettings = async () => {
    setSavingMaintenance(true);
    const results = await Promise.all([
      supabase.from('settings').upsert({ key: 'maintenance_mode_enabled', value: maintenanceEnabled.toString() }, { onConflict: 'key' }),
      supabase.from('settings').upsert({ key: 'maintenance_message', value: maintenanceMessage }, { onConflict: 'key' }),
    ]);
    setSavingMaintenance(false);
    if (results.some(r => r.error)) {
      toast({ title: 'Error', description: 'Failed to save maintenance settings', variant: 'destructive' });
    } else {
      toast({ title: maintenanceEnabled ? '⚠️ Maintenance Mode Enabled' : 'Maintenance Mode Disabled', description: maintenanceEnabled ? 'The site is now in maintenance mode.' : 'The site is now accessible to all users.' });
    }
  };

  const savePendingNotificationSettings = async () => {
    setSavingPendingNotification(true);
    const results = await Promise.all([
      supabase.from('settings').upsert({ key: 'pending_notification_enabled', value: pendingNotificationEnabled.toString() }, { onConflict: 'key' }),
      supabase.from('settings').upsert({ key: 'pending_notification_minutes', value: pendingNotificationMinutes }, { onConflict: 'key' }),
    ]);
    setSavingPendingNotification(false);
    if (results.some(r => r.error)) {
      toast({ title: 'Error', description: 'Failed to save notification settings', variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: `Pending document notifications ${pendingNotificationEnabled ? 'enabled' : 'disabled'}. Threshold: ${pendingNotificationMinutes} minutes.` });
    }
  };

  const testPendingNotification = async () => {
    setTestingPendingNotification(true);
    try {
      const { data, error } = await supabase.functions.invoke('notify-pending-documents');
      if (error) throw error;
      toast({ title: 'Test Complete', description: data?.message || 'Notification check completed' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to run notification check', variant: 'destructive' });
    } finally {
      setTestingPendingNotification(false);
    }
  };

  const saveGoogleSettings = async () => {
    setSavingGoogle(true);
    const results = await Promise.all([
      supabase.from('settings').upsert({ key: 'google_oauth_enabled', value: googleEnabled.toString() }, { onConflict: 'key' }),
      supabase.from('settings').upsert({ key: 'google_client_id', value: googleClientId }, { onConflict: 'key' }),
      supabase.from('settings').upsert({ key: 'google_client_secret', value: googleClientSecret }, { onConflict: 'key' }),
    ]);
    setSavingGoogle(false);
    if (results.some(r => r.error)) {
      toast({ title: 'Error', description: 'Failed to save Google OAuth settings', variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: 'Google OAuth settings updated' });
    }
  };

  const savePaddleSettings = async () => {
    setSavingPaddle(true);
    const results = await Promise.all([
      supabase.from('settings').upsert({ key: 'paddle_client_token', value: paddleClientToken }, { onConflict: 'key' }),
      supabase.from('settings').upsert({ key: 'paddle_environment', value: paddleEnvironment }, { onConflict: 'key' }),
    ]);
    setSavingPaddle(false);
    if (results.some(r => r.error)) {
      toast({ title: 'Error', description: 'Failed to save Paddle settings', variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: 'Paddle settings updated' });
    }
  };

  const savePaypalSettings = async () => {
    setSavingPaypal(true);
    const results = await Promise.all([
      supabase.from('settings').upsert({ key: 'paypal_client_id', value: paypalClientId }, { onConflict: 'key' }),
      supabase.from('settings').upsert({ key: 'paypal_client_secret', value: paypalClientSecret }, { onConflict: 'key' }),
      supabase.from('settings').upsert({ key: 'paypal_environment', value: paypalEnvironment }, { onConflict: 'key' }),
    ]);
    setSavingPaypal(false);
    if (results.some(r => r.error)) {
      toast({ title: 'Error', description: 'Failed to save PayPal settings', variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: 'PayPal settings updated' });
    }
  };

  const saveAdminPaymentEmailSettings = async () => {
    setSavingAdminPaymentEmail(true);
    const results = await Promise.all([
      supabase.from('settings').upsert({ key: 'admin_payment_email_enabled', value: adminPaymentEmailEnabled.toString() }, { onConflict: 'key' }),
      supabase.from('settings').upsert({ key: 'admin_payment_notify_emails', value: adminPaymentNotifyEmails }, { onConflict: 'key' }),
    ]);
    setSavingAdminPaymentEmail(false);
    if (results.some(r => r.error)) {
      toast({ title: 'Error', description: 'Failed to save admin payment email settings', variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: `Admin payment email notifications ${adminPaymentEmailEnabled ? 'enabled' : 'disabled'}` });
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
      <div className="max-w-4xl space-y-6">
        <div>
          <h1 className="text-3xl font-display font-bold">Settings</h1>
          <p className="text-muted-foreground mt-1">Manage platform settings</p>
        </div>

        <Tabs defaultValue="general" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="payments">Payments</TabsTrigger>
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
            <TabsTrigger value="auth">Authentication</TabsTrigger>
          </TabsList>

          {/* ==================== GENERAL TAB ==================== */}
          <TabsContent value="general" className="space-y-6 mt-6">
            {/* Maintenance Mode */}
            <Card className={maintenanceEnabled ? 'border-amber-500/50 bg-amber-500/5' : ''}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wrench className="h-5 w-5 text-amber-500" />
                  Maintenance Mode
                </CardTitle>
                <CardDescription>Temporarily close the site for maintenance</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className={`h-10 w-10 rounded-lg ${maintenanceEnabled ? 'bg-amber-500/20' : 'bg-muted'} flex items-center justify-center`}>
                      <Wrench className={`h-5 w-5 ${maintenanceEnabled ? 'text-amber-500' : 'text-muted-foreground'}`} />
                    </div>
                    <div>
                      <p className="font-medium">Enable Maintenance Mode</p>
                      <p className="text-sm text-muted-foreground">
                        {maintenanceEnabled ? 'Site is currently under maintenance' : 'Site is accessible to all users'}
                      </p>
                    </div>
                  </div>
                  <Switch checked={maintenanceEnabled} onCheckedChange={setMaintenanceEnabled} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="maintenanceMessage">Maintenance Message</Label>
                  <Textarea id="maintenanceMessage" placeholder="Enter a message to display to users during maintenance..." value={maintenanceMessage} onChange={(e) => setMaintenanceMessage(e.target.value)} rows={3} />
                </div>
                {maintenanceEnabled && (
                  <Alert className="border-amber-500/50 bg-amber-500/10">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    <AlertDescription className="text-amber-700 dark:text-amber-400">
                      <strong>Warning:</strong> Customers will not be able to access the site. Only administrators will have full access.
                    </AlertDescription>
                  </Alert>
                )}
                <Button onClick={saveMaintenanceSettings} disabled={savingMaintenance}>
                  {savingMaintenance ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                  Save Maintenance Settings
                </Button>
              </CardContent>
            </Card>

            {/* Global Processing Timeout */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-amber-500" />
                  Global Document Processing Timeout
                </CardTitle>
                <CardDescription>Default timeout for staff without individual settings</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="timeout">Default Timeout (minutes)</Label>
                  <Input id="timeout" type="number" min="5" max="1440" placeholder="30" value={processingTimeout} onChange={(e) => setProcessingTimeout(e.target.value)} />
                  <p className="text-xs text-muted-foreground">Used as fallback when staff has no individual timeout set (5-1440 minutes)</p>
                </div>
                <Button onClick={saveProcessingTimeout} disabled={savingTimeout}>
                  {savingTimeout ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                  Save Default Timeout
                </Button>
              </CardContent>
            </Card>

            {/* Remark Presets */}
            <AdminRemarkPresets />
          </TabsContent>

          {/* ==================== PAYMENTS TAB ==================== */}
          <TabsContent value="payments" className="space-y-6 mt-6">
            {/* Payment Method Toggles */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-primary" />
                  Payment Methods
                </CardTitle>
                <CardDescription>Enable or disable payment options for customers</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { label: 'WhatsApp Payment', desc: 'Manual payment via WhatsApp', checked: whatsappEnabled, onChange: setWhatsappEnabled, icon: MessageCircle, color: '#25D366' },
                  { label: 'USDT Payment (TRC20)', desc: 'Crypto payment via NOWPayments (min. $15)', checked: usdtEnabled, onChange: setUsdtEnabled, icon: Bitcoin, color: undefined },
                  { label: 'Binance Pay', desc: 'Manual payment with admin verification', checked: binanceEnabled, onChange: setBinanceEnabled, icon: Wallet, color: '#F0B90B' },
                  { label: 'Viva.com (Card Payment)', desc: 'Credit/debit card via Viva.com checkout', checked: vivaEnabled, onChange: setVivaEnabled, icon: Globe, color: '#1A1F71' },
                  { label: 'Stripe (Card Payment)', desc: 'Credit/debit card, Apple Pay, Google Pay via Stripe', checked: stripeEnabled, onChange: setStripeEnabled, icon: Zap, color: '#635BFF' },
                  { label: 'Dodo Payments', desc: 'Multiple payment methods via Dodo checkout', checked: dodoEnabled, onChange: setDodoEnabled, icon: Bird, color: undefined },
                  { label: 'PayPal', desc: 'PayPal, Venmo, Pay Later', checked: paypalEnabled, onChange: setPaypalEnabled, icon: Wallet, color: '#003087' },
                  { label: 'Paddle', desc: 'Merchant of Record — cards, PayPal, Apple Pay & more', checked: paddleEnabled, onChange: setPaddleEnabled, icon: Sailboat, color: '#FFC439' },
                  { label: 'USDT Transfer (TRC20)', desc: 'Semi-manual — customer sends USDT, admin verifies', checked: usdtManualEnabled, onChange: setUsdtManualEnabled, icon: Wallet, color: '#26A17B' },
                  { label: 'Bank Transfer', desc: 'Manual bank transfer for supported countries', checked: bankTransferEnabled, onChange: setBankTransferEnabled, icon: Landmark, color: undefined },
                ].map((pm) => (
                  <div key={pm.label} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${!pm.color ? 'bg-primary/10' : ''}`} style={{ backgroundColor: pm.color ? `${pm.color}15` : undefined }}>
                        <pm.icon className={`h-4 w-4 ${!pm.color ? 'text-primary' : ''}`} style={pm.color ? { color: pm.color } : undefined} />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{pm.label}</p>
                        <p className="text-xs text-muted-foreground">{pm.desc}</p>
                      </div>
                    </div>
                    <Switch checked={pm.checked} onCheckedChange={pm.onChange} />
                  </div>
                ))}
                <Button onClick={savePaymentMethods} disabled={savingPaymentMethods} className="mt-2">
                  {savingPaymentMethods ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                  Save Payment Settings
                </Button>
              </CardContent>
            </Card>

            {/* ★ Customer Payment Methods */}
            <Card className="ring-2 ring-amber-400/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Star className="h-5 w-5 text-amber-500 fill-amber-500" />
                  ★ Customer Payment Methods
                </CardTitle>
                <CardDescription>Payment options available exclusively for ★ customers</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { label: 'WhatsApp Payment', checked: specialWhatsappEnabled, onChange: setSpecialWhatsappEnabled, icon: MessageCircle, color: '#25D366' },
                  { label: 'USDT Payment (TRC20)', checked: specialUsdtEnabled, onChange: setSpecialUsdtEnabled, icon: Bitcoin, color: undefined },
                  { label: 'Binance Pay', checked: specialBinanceEnabled, onChange: setSpecialBinanceEnabled, icon: Wallet, color: '#F0B90B' },
                  { label: 'Viva.com', checked: specialVivaEnabled, onChange: setSpecialVivaEnabled, icon: Globe, color: '#1A1F71' },
                  { label: 'Stripe', checked: specialStripeEnabled, onChange: setSpecialStripeEnabled, icon: Zap, color: '#635BFF' },
                  { label: 'Dodo Payments', checked: specialDodoEnabled, onChange: setSpecialDodoEnabled, icon: Bird, color: undefined },
                  { label: 'PayPal', checked: specialPaypalEnabled, onChange: setSpecialPaypalEnabled, icon: Wallet, color: '#003087' },
                  { label: 'Paddle', checked: specialPaddleEnabled, onChange: setSpecialPaddleEnabled, icon: Sailboat, color: '#FFC439' },
                  { label: 'USDT Transfer (TRC20)', checked: specialUsdtManualEnabled, onChange: setSpecialUsdtManualEnabled, icon: Wallet, color: '#26A17B' },
                  { label: 'Bank Transfer', checked: specialBankTransferEnabled, onChange: setSpecialBankTransferEnabled, icon: Landmark, color: undefined },
                ].map((pm) => (
                  <div key={pm.label} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${!pm.color ? 'bg-primary/10' : ''}`} style={{ backgroundColor: pm.color ? `${pm.color}15` : undefined }}>
                        <pm.icon className={`h-4 w-4 ${!pm.color ? 'text-primary' : ''}`} style={pm.color ? { color: pm.color } : undefined} />
                      </div>
                      <p className="font-medium text-sm">{pm.label}</p>
                    </div>
                    <Switch checked={pm.checked} onCheckedChange={pm.onChange} />
                  </div>
                ))}
                <Button onClick={saveSpecialPaymentMethods} disabled={savingSpecialPayments} className="mt-2">
                  {savingSpecialPayments ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                  Save ★ Payment Settings
                </Button>
              </CardContent>
            </Card>

            {/* Payment Handling Fees */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Percent className="h-5 w-5 text-amber-500" />
                  Payment Handling Fees
                </CardTitle>
                <CardDescription>Additional fees added to customer's total at checkout (percentage)</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  {[
                    { label: 'WhatsApp', icon: MessageCircle, color: '#25D366', value: whatsappFee, onChange: setWhatsappFee },
                    { label: 'USDT', icon: Bitcoin, color: undefined, value: usdtFee, onChange: setUsdtFee },
                    { label: 'Binance Pay', icon: Wallet, color: '#F0B90B', value: binanceFee, onChange: setBinanceFee },
                    { label: 'Viva.com', icon: Globe, color: '#1A1F71', value: vivaFee, onChange: setVivaFee },
                    { label: 'Stripe', icon: Zap, color: '#635BFF', value: stripeFee, onChange: setStripeFee },
                    { label: 'Dodo', icon: Bird, color: undefined, value: dodoFee, onChange: setDodoFee },
                    { label: 'PayPal', icon: Wallet, color: '#003087', value: paypalFee, onChange: setPaypalFee },
                    { label: 'Paddle', icon: Sailboat, color: '#FFC439', value: paddleFee, onChange: setPaddleFee },
                  ].map((fee) => (
                    <div key={fee.label} className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <fee.icon className="h-4 w-4" style={fee.color ? { color: fee.color } : undefined} />
                        {fee.label} Fee (%)
                      </Label>
                      <Input type="number" min="0" max="50" step="0.1" placeholder="0" value={fee.value} onChange={(e) => fee.onChange(e.target.value)} />
                    </div>
                  ))}
                </div>
                <Button onClick={savePaymentFees} disabled={savingFees}>
                  {savingFees ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                  Save Payment Fees
                </Button>
              </CardContent>
            </Card>

            {/* Bank Transfer Countries */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Landmark className="h-5 w-5 text-blue-600" />
                  Bank Transfer Countries
                </CardTitle>
                <CardDescription>Manage which countries can use bank transfer</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Select value={newBtCountry} onValueChange={setNewBtCountry}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Select a country to add" />
                    </SelectTrigger>
                    <SelectContent>
                      {countries.filter(c => !bankTransferCountries.includes(c.code)).sort((a, b) => a.name.localeCompare(b.name)).map(c => (
                        <SelectItem key={c.code} value={c.code}>{c.name} ({c.code})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button variant="outline" disabled={!newBtCountry} onClick={() => { if (newBtCountry && !bankTransferCountries.includes(newBtCountry)) { setBankTransferCountries(prev => [...prev, newBtCountry].sort()); setNewBtCountry(''); } }}>
                    <Plus className="h-4 w-4 mr-1" /> Add
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {bankTransferCountries.map(code => {
                    const country = countries.find(c => c.code === code);
                    return (
                      <Badge key={code} variant="secondary" className="flex items-center gap-1 px-3 py-1.5">
                        {country?.name || code}
                        <button onClick={() => setBankTransferCountries(prev => prev.filter(c => c !== code))} className="ml-1 hover:text-destructive"><X className="h-3 w-3" /></button>
                      </Badge>
                    );
                  })}
                </div>
                {bankTransferCountries.length === 0 && <p className="text-sm text-muted-foreground">No countries selected.</p>}
                <Button onClick={async () => {
                  setSavingBankTransfer(true);
                  const { error } = await supabase.from('settings').upsert({ key: 'bank_transfer_countries', value: JSON.stringify(bankTransferCountries) }, { onConflict: 'key' });
                  setSavingBankTransfer(false);
                  if (error) { toast({ title: 'Error', description: 'Failed to save countries', variant: 'destructive' }); }
                  else { toast({ title: 'Success', description: 'Bank transfer countries updated' }); }
                }} disabled={savingBankTransfer}>
                  {savingBankTransfer ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                  Save Countries
                </Button>
              </CardContent>
            </Card>

            {/* Provider Configurations */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wrench className="h-5 w-5 text-muted-foreground" />
                  Provider Configurations
                </CardTitle>
                <CardDescription>Configure credentials and settings for each payment provider</CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="whatsapp" className="w-full">
                  <TabsList className="flex flex-wrap h-auto gap-1">
                    <TabsTrigger value="whatsapp" className="text-xs">WhatsApp</TabsTrigger>
                    <TabsTrigger value="binance" className="text-xs">Binance</TabsTrigger>
                    <TabsTrigger value="viva" className="text-xs">Viva.com</TabsTrigger>
                    <TabsTrigger value="paddle" className="text-xs">Paddle</TabsTrigger>
                    <TabsTrigger value="paypal" className="text-xs">PayPal</TabsTrigger>
                    <TabsTrigger value="usdt-manual" className="text-xs">USDT Transfer</TabsTrigger>
                  </TabsList>

                  <TabsContent value="whatsapp" className="space-y-4 mt-4">
                    <div className="space-y-2">
                      <Label htmlFor="whatsapp">WhatsApp Number</Label>
                      <Input id="whatsapp" placeholder="+1234567890" value={whatsappNumber} onChange={(e) => setWhatsappNumber(e.target.value)} />
                      <p className="text-xs text-muted-foreground">Include country code (e.g., +1 for US, +44 for UK)</p>
                    </div>
                    <Button onClick={saveWhatsAppNumber} disabled={saving}>
                      {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                      Save
                    </Button>
                  </TabsContent>

                  <TabsContent value="binance" className="space-y-4 mt-4">
                    <div className="space-y-2">
                      <Label htmlFor="binancePay">Binance Pay ID</Label>
                      <Input id="binancePay" placeholder="Enter your Binance Pay ID" value={binancePayId} onChange={(e) => setBinancePayId(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="binanceDiscount">Binance Pay Discount (%)</Label>
                      <Input id="binanceDiscount" type="number" min="0" max="100" placeholder="e.g. 10" value={binanceDiscount} onChange={(e) => setBinanceDiscount(e.target.value)} />
                      <p className="text-xs text-muted-foreground">Set to 0 for no discount.</p>
                    </div>
                    <Button onClick={saveBinanceSettings} disabled={savingBinance}>
                      {savingBinance ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                      Save
                    </Button>
                  </TabsContent>

                  <TabsContent value="viva" className="space-y-4 mt-4">
                    <div className="space-y-2">
                      <Label htmlFor="vivaSourceCode">Source Code</Label>
                      <Input id="vivaSourceCode" placeholder="Enter your Viva.com Source Code" value={vivaSourceCode} onChange={(e) => setVivaSourceCode(e.target.value)} />
                    </div>
                    <Alert>
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>API credentials are stored as environment secrets.</AlertDescription>
                    </Alert>
                    <Button onClick={saveVivaSettings} disabled={savingViva}>
                      {savingViva ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                      Save
                    </Button>
                  </TabsContent>

                  <TabsContent value="paddle" className="space-y-4 mt-4">
                    <div className="space-y-2">
                      <Label htmlFor="paddleClientToken">Client-Side Token</Label>
                      <Input id="paddleClientToken" placeholder="Enter your Paddle client-side token" value={paddleClientToken} onChange={(e) => setPaddleClientToken(e.target.value)} className="font-mono text-xs" />
                    </div>
                    <div className="space-y-2">
                      <Label>Environment</Label>
                      <div className="flex gap-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="radio" name="paddleEnv" value="sandbox" checked={paddleEnvironment === 'sandbox'} onChange={(e) => setPaddleEnvironment(e.target.value)} className="w-4 h-4" />
                          <span className="text-sm">Sandbox</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="radio" name="paddleEnv" value="production" checked={paddleEnvironment === 'production'} onChange={(e) => setPaddleEnvironment(e.target.value)} className="w-4 h-4" />
                          <span className="text-sm">Production</span>
                        </label>
                      </div>
                    </div>
                    <Alert>
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        <strong>Webhook URL:</strong>
                        <code className="block mt-1 text-xs bg-muted px-2 py-1 rounded break-all">{import.meta.env.VITE_SUPABASE_URL}/functions/v1/paddle-webhook</code>
                      </AlertDescription>
                    </Alert>
                    <Button onClick={savePaddleSettings} disabled={savingPaddle}>
                      {savingPaddle ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                      Save
                    </Button>
                  </TabsContent>

                  <TabsContent value="paypal" className="space-y-4 mt-4">
                    <div className="space-y-2">
                      <Label htmlFor="paypalClientId">Client ID</Label>
                      <Input id="paypalClientId" placeholder="Enter your PayPal Client ID" value={paypalClientId} onChange={(e) => setPaypalClientId(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="paypalClientSecret">Client Secret</Label>
                      <div className="relative">
                        <Input id="paypalClientSecret" type={showPaypalSecret ? "text" : "password"} placeholder="Enter your PayPal Client Secret" value={paypalClientSecret} onChange={(e) => setPaypalClientSecret(e.target.value)} />
                        <Button type="button" variant="ghost" size="icon" className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8" onClick={() => setShowPaypalSecret(!showPaypalSecret)}>
                          {showPaypalSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Environment</Label>
                      <div className="flex gap-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="radio" name="paypalEnv" value="sandbox" checked={paypalEnvironment === 'sandbox'} onChange={(e) => setPaypalEnvironment(e.target.value)} className="w-4 h-4" />
                          <span className="text-sm">Sandbox</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="radio" name="paypalEnv" value="live" checked={paypalEnvironment === 'live'} onChange={(e) => setPaypalEnvironment(e.target.value)} className="w-4 h-4" />
                          <span className="text-sm">Live</span>
                        </label>
                      </div>
                    </div>
                    <Alert>
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        <strong>Webhook URL:</strong>
                        <code className="block mt-1 text-xs bg-muted px-2 py-1 rounded break-all">https://fyssbzgmhnolazjfwafm.supabase.co/functions/v1/paypal-webhook</code>
                      </AlertDescription>
                    </Alert>
                    <Button onClick={savePaypalSettings} disabled={savingPaypal}>
                      {savingPaypal ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                      Save
                    </Button>
                  </TabsContent>

                  <TabsContent value="usdt-manual" className="space-y-4 mt-4">
                    <div className="space-y-2">
                      <Label htmlFor="usdtManualWallet">TRC20 Wallet Address</Label>
                      <Input id="usdtManualWallet" placeholder="Enter your USDT TRC20 wallet address (e.g. T...)" value={usdtManualWalletAddress} onChange={(e) => setUsdtManualWalletAddress(e.target.value)} className="font-mono text-xs" maxLength={100} />
                      <p className="text-xs text-muted-foreground">This address will be shown to customers on the checkout page</p>
                    </div>
                    <Button onClick={async () => {
                      setSavingUsdtManual(true);
                      const { error } = await supabase.from('settings').upsert({ key: 'usdt_manual_wallet_address', value: usdtManualWalletAddress }, { onConflict: 'key' });
                      setSavingUsdtManual(false);
                      if (error) { toast({ title: 'Error', description: 'Failed to save wallet address', variant: 'destructive' }); }
                      else { toast({ title: 'Success', description: 'USDT wallet address updated' }); }
                    }} disabled={savingUsdtManual}>
                      {savingUsdtManual ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                      Save
                    </Button>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ==================== NOTIFICATIONS TAB ==================== */}
          <TabsContent value="notifications" className="space-y-6 mt-6">
            {/* Admin Payment Email Alerts */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="h-5 w-5 text-primary" />
                  Admin Payment Email Alerts
                </CardTitle>
                <CardDescription>Receive an email when a customer completes a payment</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Bell className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">Enable Payment Email Alerts</p>
                      <p className="text-sm text-muted-foreground">
                        {adminPaymentEmailEnabled ? 'You will receive emails for all customer payments' : 'Payment email alerts are disabled'}
                      </p>
                    </div>
                  </div>
                  <Switch checked={adminPaymentEmailEnabled} onCheckedChange={setAdminPaymentEmailEnabled} />
                </div>
                {adminPaymentEmailEnabled && (
                  <div className="space-y-2">
                    <Label htmlFor="adminPaymentEmails">Admin Email Addresses</Label>
                    <Input id="adminPaymentEmails" placeholder="admin1@example.com, admin2@example.com" value={adminPaymentNotifyEmails} onChange={(e) => setAdminPaymentNotifyEmails(e.target.value)} />
                    <p className="text-xs text-muted-foreground">Comma-separated list of email addresses.</p>
                  </div>
                )}
                <Button onClick={saveAdminPaymentEmailSettings} disabled={savingAdminPaymentEmail}>
                  {savingAdminPaymentEmail ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                  Save Email Alert Settings
                </Button>
              </CardContent>
            </Card>

            {/* Pending Document Notifications */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="h-5 w-5 text-orange-500" />
                  Pending Document Notifications
                </CardTitle>
                <CardDescription>Email admins when documents are pending for too long</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className={`h-10 w-10 rounded-lg ${pendingNotificationEnabled ? 'bg-orange-500/20' : 'bg-muted'} flex items-center justify-center`}>
                      <FileText className={`h-5 w-5 ${pendingNotificationEnabled ? 'text-orange-500' : 'text-muted-foreground'}`} />
                    </div>
                    <div>
                      <p className="font-medium">Enable Pending Notifications</p>
                      <p className="text-sm text-muted-foreground">
                        {pendingNotificationEnabled ? 'Admins will be notified of stuck documents' : 'Notifications are disabled'}
                      </p>
                    </div>
                  </div>
                  <Switch checked={pendingNotificationEnabled} onCheckedChange={setPendingNotificationEnabled} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pendingMinutes">Notification Threshold (minutes)</Label>
                  <Input id="pendingMinutes" type="number" min="5" max="120" placeholder="15" value={pendingNotificationMinutes} onChange={(e) => setPendingNotificationMinutes(e.target.value)} />
                  <p className="text-xs text-muted-foreground">Send notification if a document hasn't been picked up within this time (5-120 minutes)</p>
                </div>
                <div className="flex gap-2">
                  <Button onClick={savePendingNotificationSettings} disabled={savingPendingNotification}>
                    {savingPendingNotification ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                    Save Settings
                  </Button>
                  <Button variant="outline" onClick={testPendingNotification} disabled={testingPendingNotification}>
                    {testingPendingNotification ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                    Run Check Now
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Push Notifications */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-5 w-5 text-primary" />
                  Push Notifications
                </CardTitle>
                <CardDescription>Configure Web Push notifications for users</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="vapidKey">VAPID Public Key</Label>
                  <Input id="vapidKey" placeholder="Enter your VAPID public key" value={vapidPublicKey} onChange={(e) => setVapidPublicKey(e.target.value)} className="font-mono text-xs" />
                  <p className="text-xs text-muted-foreground">
                    Generate at{' '}
                    <a href="https://web-push-codelab.glitch.me/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">web-push-codelab.glitch.me</a>
                  </p>
                </div>
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    The VAPID private key must be stored as a secret named <code className="bg-muted px-1 rounded">VAPID_PRIVATE_KEY</code>.
                  </AlertDescription>
                </Alert>
                <div className="flex gap-2">
                  <Button onClick={saveVapidKey} disabled={savingVapid}>
                    {savingVapid ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                    Save VAPID Key
                  </Button>
                  <Button variant="outline" onClick={sendTestPush} disabled={testingPush || !vapidPublicKey}>
                    {testingPush ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                    Send Test Push
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ==================== AUTHENTICATION TAB ==================== */}
          <TabsContent value="auth" className="space-y-6 mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Chrome className="h-5 w-5 text-[#4285F4]" />
                  Google OAuth Configuration
                </CardTitle>
                <CardDescription>Configure Google Sign-In for user authentication</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className={`h-10 w-10 rounded-lg ${googleEnabled ? 'bg-[#4285F4]/20' : 'bg-muted'} flex items-center justify-center`}>
                      <Chrome className={`h-5 w-5 ${googleEnabled ? 'text-[#4285F4]' : 'text-muted-foreground'}`} />
                    </div>
                    <div>
                      <p className="font-medium">Enable Google Sign-In</p>
                      <p className="text-sm text-muted-foreground">
                        {googleEnabled ? 'Users can sign in with Google' : 'Google sign-in is disabled'}
                      </p>
                    </div>
                  </div>
                  <Switch checked={googleEnabled} onCheckedChange={setGoogleEnabled} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="googleClientId">Client ID</Label>
                  <Input id="googleClientId" placeholder="Enter your Google OAuth Client ID" value={googleClientId} onChange={(e) => setGoogleClientId(e.target.value)} className="font-mono text-xs" disabled={!googleEnabled} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="googleClientSecret">Client Secret</Label>
                  <div className="relative">
                    <Input id="googleClientSecret" type={showGoogleSecret ? 'text' : 'password'} placeholder="Enter your Google OAuth Client Secret" value={googleClientSecret} onChange={(e) => setGoogleClientSecret(e.target.value)} className="font-mono text-xs pr-10" disabled={!googleEnabled} />
                    <Button type="button" variant="ghost" size="sm" className="absolute right-0 top-0 h-full px-3 hover:bg-transparent" onClick={() => setShowGoogleSecret(!showGoogleSecret)}>
                      {showGoogleSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                {googleEnabled && (
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Setup steps:</strong>
                      <ol className="list-decimal ml-4 mt-2 space-y-1">
                        <li>Go to <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Google Cloud Console</a></li>
                        <li>Create OAuth 2.0 Client ID (Web application)</li>
                        <li>Add authorized JavaScript origins: <code className="bg-muted px-1 rounded text-xs">{window.location.origin}</code></li>
                        <li>Add redirect URI: <code className="bg-muted px-1 rounded text-xs">{import.meta.env.VITE_SUPABASE_URL}/auth/v1/callback</code></li>
                      </ol>
                    </AlertDescription>
                  </Alert>
                )}
                <Button onClick={saveGoogleSettings} disabled={savingGoogle}>
                  {savingGoogle ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                  Save Google OAuth Settings
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
