import React, { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { MessageCircle, Save, Loader2, Clock, CreditCard, Bitcoin, Wallet, Globe, Percent, AlertTriangle, Bell, Send, Wrench, Mail, FileText, Chrome, Eye, EyeOff, Zap, Bird } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';

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
  const [binancePayId, setBinancePayId] = useState('');
  const [savingBinance, setSavingBinance] = useState(false);
  
  // Viva.com settings
  const [vivaSourceCode, setVivaSourceCode] = useState('');
  const [savingViva, setSavingViva] = useState(false);
  
  // Payment handling fees
  const [whatsappFee, setWhatsappFee] = useState('0');
  const [usdtFee, setUsdtFee] = useState('0');
  const [binanceFee, setBinanceFee] = useState('0');
  const [vivaFee, setVivaFee] = useState('0');
  const [stripeFee, setStripeFee] = useState('0');
  const [dodoFee, setDodoFee] = useState('0');
  const [savingFees, setSavingFees] = useState(false);
  
  // Push notification settings
  const [vapidPublicKey, setVapidPublicKey] = useState('');
  const [savingVapid, setSavingVapid] = useState(false);
  const [testingPush, setTestingPush] = useState(false);
  
  // Maintenance mode settings
  const [maintenanceEnabled, setMaintenanceEnabled] = useState(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState('We are currently under maintenance. Please check back later.');
  const [savingMaintenance, setSavingMaintenance] = useState(false);
  
  // Pending document notification settings
  const [pendingNotificationEnabled, setPendingNotificationEnabled] = useState(true);
  const [pendingNotificationMinutes, setPendingNotificationMinutes] = useState('15');
  const [savingPendingNotification, setSavingPendingNotification] = useState(false);
  const [testingPendingNotification, setTestingPendingNotification] = useState(false);

  // Google OAuth settings
  const [googleEnabled, setGoogleEnabled] = useState(false);
  const [googleClientId, setGoogleClientId] = useState('');
  const [googleClientSecret, setGoogleClientSecret] = useState('');
  const [savingGoogle, setSavingGoogle] = useState(false);
  const [showGoogleSecret, setShowGoogleSecret] = useState(false);

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
      'binance_pay_id',
      'viva_source_code',
      'fee_whatsapp',
      'fee_usdt',
      'fee_binance',
      'fee_viva',
      'fee_stripe',
      'fee_dodo',
      'vapid_public_key',
      'maintenance_mode_enabled',
      'maintenance_message',
      'pending_notification_enabled',
      'pending_notification_minutes',
      'google_client_id',
      'google_client_secret',
      'google_oauth_enabled'
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
      const binanceId = data.find(s => s.key === 'binance_pay_id');
      const vivaSource = data.find(s => s.key === 'viva_source_code');
      const feeWhatsapp = data.find(s => s.key === 'fee_whatsapp');
      const feeUsdt = data.find(s => s.key === 'fee_usdt');
      const feeBinance = data.find(s => s.key === 'fee_binance');
      const feeViva = data.find(s => s.key === 'fee_viva');
      const feeStripe = data.find(s => s.key === 'fee_stripe');
      const feeDodo = data.find(s => s.key === 'fee_dodo');
      
      if (whatsapp) setWhatsappNumber(whatsapp.value);
      if (timeout) setProcessingTimeout(timeout.value);
      setWhatsappEnabled(whatsappPayment?.value !== 'false');
      setUsdtEnabled(usdtPayment?.value !== 'false');
      setBinanceEnabled(binancePayment?.value === 'true');
      setVivaEnabled(vivaPayment?.value === 'true');
      setStripeEnabled(stripePayment?.value === 'true');
      setDodoEnabled(dodoPayment?.value === 'true');
      if (binanceId) setBinancePayId(binanceId.value);
      if (vivaSource) setVivaSourceCode(vivaSource.value);
      if (feeWhatsapp) setWhatsappFee(feeWhatsapp.value);
      if (feeUsdt) setUsdtFee(feeUsdt.value);
      if (feeBinance) setBinanceFee(feeBinance.value);
      if (feeViva) setVivaFee(feeViva.value);
      if (feeStripe) setStripeFee(feeStripe.value);
      if (feeDodo) setDodoFee(feeDodo.value);
      
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
    
    const { error: error1 } = await supabase
      .from('settings')
      .upsert({ key: 'payment_whatsapp_enabled', value: whatsappEnabled.toString() }, { onConflict: 'key' });
    
    const { error: error2 } = await supabase
      .from('settings')
      .upsert({ key: 'payment_usdt_enabled', value: usdtEnabled.toString() }, { onConflict: 'key' });
    
    const { error: error3 } = await supabase
      .from('settings')
      .upsert({ key: 'payment_binance_enabled', value: binanceEnabled.toString() }, { onConflict: 'key' });
    
    const { error: error4 } = await supabase
      .from('settings')
      .upsert({ key: 'payment_viva_enabled', value: vivaEnabled.toString() }, { onConflict: 'key' });
    
    const { error: error5 } = await supabase
      .from('settings')
      .upsert({ key: 'payment_stripe_enabled', value: stripeEnabled.toString() }, { onConflict: 'key' });
    
    const { error: error6 } = await supabase
      .from('settings')
      .upsert({ key: 'payment_dodo_enabled', value: dodoEnabled.toString() }, { onConflict: 'key' });
    
    setSavingPaymentMethods(false);
    
    if (error1 || error2 || error3 || error4 || error5 || error6) {
      toast({ title: 'Error', description: 'Failed to save payment settings', variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: 'Payment methods updated' });
    }
  };

  const saveBinanceSettings = async () => {
    setSavingBinance(true);
    
    const { error } = await supabase
      .from('settings')
      .upsert({ key: 'binance_pay_id', value: binancePayId }, { onConflict: 'key' });
    
    setSavingBinance(false);
    
    if (error) {
      toast({ title: 'Error', description: 'Failed to save Binance Pay ID', variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: 'Binance Pay ID updated' });
    }
  };

  const saveVivaSettings = async () => {
    setSavingViva(true);
    
    const { error } = await supabase
      .from('settings')
      .upsert({ key: 'viva_source_code', value: vivaSourceCode }, { onConflict: 'key' });
    
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
    ];
    
    const results = await Promise.all(updates);
    const hasError = results.some(r => r.error);
    
    setSavingFees(false);
    
    if (hasError) {
      toast({ title: 'Error', description: 'Failed to save payment fees', variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: 'Payment handling fees updated' });
    }
  };

  const saveVapidKey = async () => {
    setSavingVapid(true);
    
    const { error } = await supabase
      .from('settings')
      .upsert({ key: 'vapid_public_key', value: vapidPublicKey }, { onConflict: 'key' });
    
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
        body: {
          userId: user.id,
          title: 'Test Push Notification 🔔',
          body: 'Push notifications are working correctly!',
          data: { url: '/dashboard/settings' }
        }
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
    
    const updates = [
      supabase.from('settings').upsert({ key: 'maintenance_mode_enabled', value: maintenanceEnabled.toString() }, { onConflict: 'key' }),
      supabase.from('settings').upsert({ key: 'maintenance_message', value: maintenanceMessage }, { onConflict: 'key' }),
    ];
    
    const results = await Promise.all(updates);
    const hasError = results.some(r => r.error);
    
    setSavingMaintenance(false);
    
    if (hasError) {
      toast({ title: 'Error', description: 'Failed to save maintenance settings', variant: 'destructive' });
    } else {
      toast({ 
        title: maintenanceEnabled ? '⚠️ Maintenance Mode Enabled' : 'Maintenance Mode Disabled', 
        description: maintenanceEnabled 
          ? 'The site is now in maintenance mode. Customers will see a maintenance page.' 
          : 'The site is now accessible to all users.'
      });
    }
  };

  const savePendingNotificationSettings = async () => {
    setSavingPendingNotification(true);
    
    const updates = [
      supabase.from('settings').upsert({ key: 'pending_notification_enabled', value: pendingNotificationEnabled.toString() }, { onConflict: 'key' }),
      supabase.from('settings').upsert({ key: 'pending_notification_minutes', value: pendingNotificationMinutes }, { onConflict: 'key' }),
    ];
    
    const results = await Promise.all(updates);
    const hasError = results.some(r => r.error);
    
    setSavingPendingNotification(false);
    
    if (hasError) {
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
      
      toast({ 
        title: 'Test Complete', 
        description: data?.message || 'Notification check completed' 
      });
    } catch (error: any) {
      toast({ 
        title: 'Error', 
        description: error.message || 'Failed to run notification check', 
        variant: 'destructive' 
      });
    } finally {
      setTestingPendingNotification(false);
    }
  };

  const saveGoogleSettings = async () => {
    setSavingGoogle(true);
    
    const updates = [
      supabase.from('settings').upsert({ key: 'google_oauth_enabled', value: googleEnabled.toString() }, { onConflict: 'key' }),
      supabase.from('settings').upsert({ key: 'google_client_id', value: googleClientId }, { onConflict: 'key' }),
      supabase.from('settings').upsert({ key: 'google_client_secret', value: googleClientSecret }, { onConflict: 'key' }),
    ];
    
    const results = await Promise.all(updates);
    const hasError = results.some(r => r.error);
    
    setSavingGoogle(false);
    
    if (hasError) {
      toast({ title: 'Error', description: 'Failed to save Google OAuth settings', variant: 'destructive' });
    } else {
      toast({ title: 'Success', description: 'Google OAuth settings updated' });
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
              <Switch
                checked={maintenanceEnabled}
                onCheckedChange={setMaintenanceEnabled}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="maintenanceMessage">Maintenance Message</Label>
              <Textarea
                id="maintenanceMessage"
                placeholder="Enter a message to display to users during maintenance..."
                value={maintenanceMessage}
                onChange={(e) => setMaintenanceMessage(e.target.value)}
                rows={3}
              />
              <p className="text-xs text-muted-foreground">
                This message will be shown to customers when they try to access the site during maintenance.
              </p>
            </div>
            
            {maintenanceEnabled && (
              <Alert className="border-amber-500/50 bg-amber-500/10">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <AlertDescription className="text-amber-700 dark:text-amber-400">
                  <strong>Warning:</strong> When enabled, customers will not be able to access the site. 
                  Only administrators will have full access. Make sure to disable this when maintenance is complete.
                </AlertDescription>
              </Alert>
            )}
            
            <Button onClick={saveMaintenanceSettings} disabled={savingMaintenance}>
              {savingMaintenance ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Save Maintenance Settings
            </Button>
          </CardContent>
        </Card>

        {/* Payment Methods */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary" />
              Payment Methods
            </CardTitle>
            <CardDescription>Enable or disable payment options for customers</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-[#25D366]/10 flex items-center justify-center">
                  <MessageCircle className="h-5 w-5 text-[#25D366]" />
                </div>
                <div>
                  <p className="font-medium">WhatsApp Payment</p>
                  <p className="text-sm text-muted-foreground">Manual payment via WhatsApp</p>
                </div>
              </div>
              <Switch
                checked={whatsappEnabled}
                onCheckedChange={setWhatsappEnabled}
              />
            </div>
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Bitcoin className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium">USDT Payment (TRC20)</p>
                  <p className="text-sm text-muted-foreground">Crypto payment via NOWPayments (min. $15)</p>
                </div>
              </div>
              <Switch
                checked={usdtEnabled}
                onCheckedChange={setUsdtEnabled}
              />
            </div>
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-[#F0B90B]/10 flex items-center justify-center">
                  <Wallet className="h-5 w-5 text-[#F0B90B]" />
                </div>
                <div>
                  <p className="font-medium">Binance Pay</p>
                  <p className="text-sm text-muted-foreground">Manual payment with admin verification</p>
                </div>
              </div>
              <Switch
                checked={binanceEnabled}
                onCheckedChange={setBinanceEnabled}
              />
            </div>
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-[#1A1F71]/10 flex items-center justify-center">
                  <Globe className="h-5 w-5 text-[#1A1F71]" />
                </div>
                <div>
                  <p className="font-medium">Viva.com (Card Payment)</p>
                  <p className="text-sm text-muted-foreground">Credit/debit card via Viva.com checkout</p>
                </div>
              </div>
              <Switch
                checked={vivaEnabled}
                onCheckedChange={setVivaEnabled}
              />
            </div>
            <div className="flex items-center justify-between p-4 border rounded-lg border-[#635BFF]/30 bg-[#635BFF]/5">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-[#635BFF]/10 flex items-center justify-center">
                  <Zap className="h-5 w-5 text-[#635BFF]" />
                </div>
                <div>
                  <p className="font-medium">Stripe (Card Payment)</p>
                  <p className="text-sm text-muted-foreground">Credit/debit card, Apple Pay, Google Pay via Stripe</p>
                </div>
              </div>
              <Switch
                checked={stripeEnabled}
                onCheckedChange={setStripeEnabled}
              />
            </div>
            <div className="flex items-center justify-between p-4 border rounded-lg border-emerald-500/30 bg-emerald-500/5">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <Bird className="h-5 w-5 text-emerald-500" />
                </div>
                <div>
                  <p className="font-medium">Dodo Payments</p>
                  <p className="text-sm text-muted-foreground">Multiple payment methods via Dodo checkout</p>
                </div>
              </div>
              <Switch
                checked={dodoEnabled}
                onCheckedChange={setDodoEnabled}
              />
            </div>
            <Button onClick={savePaymentMethods} disabled={savingPaymentMethods}>
              {savingPaymentMethods ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Save Payment Settings
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
            <CardDescription>Set additional fees for each payment method (percentage added to total)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                These fees will be added to the customer's total at checkout. For example, a 2.5% fee on a $10 order would charge $10.25.
              </AlertDescription>
            </Alert>
            
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <MessageCircle className="h-4 w-4 text-[#25D366]" />
                  WhatsApp Fee (%)
                </Label>
                <Input
                  type="number"
                  min="0"
                  max="50"
                  step="0.1"
                  placeholder="0"
                  value={whatsappFee}
                  onChange={(e) => setWhatsappFee(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Bitcoin className="h-4 w-4 text-green-500" />
                  USDT Fee (%)
                </Label>
                <Input
                  type="number"
                  min="0"
                  max="50"
                  step="0.1"
                  placeholder="0"
                  value={usdtFee}
                  onChange={(e) => setUsdtFee(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Wallet className="h-4 w-4 text-[#F0B90B]" />
                  Binance Pay Fee (%)
                </Label>
                <Input
                  type="number"
                  min="0"
                  max="50"
                  step="0.1"
                  placeholder="0"
                  value={binanceFee}
                  onChange={(e) => setBinanceFee(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-[#1A1F71]" />
                  Viva.com Card Fee (%)
                </Label>
                <Input
                  type="number"
                  min="0"
                  max="50"
                  step="0.1"
                  placeholder="0"
                  value={vivaFee}
                  onChange={(e) => setVivaFee(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-[#635BFF]" />
                  Stripe Fee (%)
                </Label>
                <Input
                  type="number"
                  min="0"
                  max="50"
                  step="0.1"
                  placeholder="0"
                  value={stripeFee}
                  onChange={(e) => setStripeFee(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Bird className="h-4 w-4 text-emerald-500" />
                  Dodo Fee (%)
                </Label>
                <Input
                  type="number"
                  min="0"
                  max="50"
                  step="0.1"
                  placeholder="0"
                  value={dodoFee}
                  onChange={(e) => setDodoFee(e.target.value)}
                />
              </div>
            </div>
            
            <Button onClick={savePaymentFees} disabled={savingFees}>
              {savingFees ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Save Payment Fees
            </Button>
          </CardContent>
        </Card>

        {/* Viva.com Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-[#1A1F71]" />
              Viva.com Configuration
            </CardTitle>
            <CardDescription>Configure your Viva.com payment gateway settings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="vivaSourceCode">Source Code</Label>
              <Input
                id="vivaSourceCode"
                placeholder="Enter your Viva.com Source Code (e.g., 2984)"
                value={vivaSourceCode}
                onChange={(e) => setVivaSourceCode(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                The source code from your Viva.com payment source configuration
              </p>
            </div>
            
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>API Credentials:</strong> The Viva.com Client ID and Secret are stored securely as environment secrets. 
                To update them, please use the Secrets management in the admin area or contact support.
              </AlertDescription>
            </Alert>
            
            <Button onClick={saveVivaSettings} disabled={savingViva}>
              {savingViva ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Save Viva.com Settings
            </Button>
          </CardContent>
        </Card>

        {/* Binance Pay Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-[#F0B90B]" />
              Binance Pay Configuration
            </CardTitle>
            <CardDescription>Configure your Binance Pay ID for manual payments</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="binancePay">Binance Pay ID</Label>
              <Input
                id="binancePay"
                placeholder="Enter your Binance Pay ID"
                value={binancePayId}
                onChange={(e) => setBinancePayId(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Customers will send payments to this Binance Pay ID
              </p>
            </div>
            <Button onClick={saveBinanceSettings} disabled={savingBinance}>
              {savingBinance ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Save Binance Settings
            </Button>
          </CardContent>
        </Card>

        {/* WhatsApp Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-[#25D366]" />
              WhatsApp Configuration
            </CardTitle>
            <CardDescription>Configure the WhatsApp number for credit purchases</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="whatsapp">WhatsApp Number</Label>
              <Input
                id="whatsapp"
                placeholder="+1234567890"
                value={whatsappNumber}
                onChange={(e) => setWhatsappNumber(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Include country code (e.g., +1 for US, +44 for UK)
              </p>
            </div>
            <Button onClick={saveWhatsAppNumber} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Save Changes
            </Button>
          </CardContent>
        </Card>

        {/* Global Processing Timeout Settings */}
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
              <Input
                id="timeout"
                type="number"
                min="5"
                max="1440"
                placeholder="30"
                value={processingTimeout}
                onChange={(e) => setProcessingTimeout(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Used as fallback when staff has no individual timeout set (5-1440 minutes)
              </p>
            </div>
            <Button onClick={saveProcessingTimeout} disabled={savingTimeout}>
              {savingTimeout ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Save Default Timeout
            </Button>
          </CardContent>
        </Card>

        {/* Pending Document Notification Settings */}
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
              <Switch
                checked={pendingNotificationEnabled}
                onCheckedChange={setPendingNotificationEnabled}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="pendingMinutes">Notification Threshold (minutes)</Label>
              <Input
                id="pendingMinutes"
                type="number"
                min="5"
                max="120"
                placeholder="15"
                value={pendingNotificationMinutes}
                onChange={(e) => setPendingNotificationMinutes(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Send notification if a document hasn't been picked up within this time (5-120 minutes)
              </p>
            </div>
            
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Each document only triggers one notification. Once sent, it won't notify again for the same document.
                Set up a cron job to call the <code className="bg-muted px-1 rounded text-xs">notify-pending-documents</code> function periodically.
              </AlertDescription>
            </Alert>
            
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

        {/* Google OAuth Settings */}
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
              <Switch
                checked={googleEnabled}
                onCheckedChange={setGoogleEnabled}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="googleClientId">Client ID</Label>
              <Input
                id="googleClientId"
                placeholder="Enter your Google OAuth Client ID"
                value={googleClientId}
                onChange={(e) => setGoogleClientId(e.target.value)}
                className="font-mono text-xs"
                disabled={!googleEnabled}
              />
              <p className="text-xs text-muted-foreground">
                From Google Cloud Console → APIs & Services → Credentials
              </p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="googleClientSecret">Client Secret</Label>
              <div className="relative">
                <Input
                  id="googleClientSecret"
                  type={showGoogleSecret ? 'text' : 'password'}
                  placeholder="Enter your Google OAuth Client Secret"
                  value={googleClientSecret}
                  onChange={(e) => setGoogleClientSecret(e.target.value)}
                  className="font-mono text-xs pr-10"
                  disabled={!googleEnabled}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                  onClick={() => setShowGoogleSecret(!showGoogleSecret)}
                >
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
                    <li>Add authorized redirect URIs: <code className="bg-muted px-1 rounded text-xs">{import.meta.env.VITE_SUPABASE_URL}/auth/v1/callback</code></li>
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

        {/* Push Notifications Settings */}
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
              <Input
                id="vapidKey"
                placeholder="Enter your VAPID public key"
                value={vapidPublicKey}
                onChange={(e) => setVapidPublicKey(e.target.value)}
                className="font-mono text-xs"
              />
              <p className="text-xs text-muted-foreground">
                Generate VAPID keys at{' '}
                <a href="https://web-push-codelab.glitch.me/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                  web-push-codelab.glitch.me
                </a>
                {' '}or via <code className="bg-muted px-1 rounded">npx web-push generate-vapid-keys</code>
              </p>
            </div>
            
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>Private Key:</strong> The VAPID private key must be stored as a secret named <code className="bg-muted px-1 rounded">VAPID_PRIVATE_KEY</code>.
                Make sure both keys are from the same pair!
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
      </div>
    </DashboardLayout>
  );
}
