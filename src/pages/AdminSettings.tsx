import React, { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { MessageCircle, Save, Loader2, Clock, CreditCard, Bitcoin, Wallet } from 'lucide-react';

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
  const [binancePayId, setBinancePayId] = useState('');
  const [savingBinance, setSavingBinance] = useState(false);

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
      'binance_pay_id'
    ]);
    if (data) {
      const whatsapp = data.find(s => s.key === 'whatsapp_number');
      const timeout = data.find(s => s.key === 'processing_timeout_minutes');
      const whatsappPayment = data.find(s => s.key === 'payment_whatsapp_enabled');
      const usdtPayment = data.find(s => s.key === 'payment_usdt_enabled');
      const binancePayment = data.find(s => s.key === 'payment_binance_enabled');
      const binanceId = data.find(s => s.key === 'binance_pay_id');
      if (whatsapp) setWhatsappNumber(whatsapp.value);
      if (timeout) setProcessingTimeout(timeout.value);
      setWhatsappEnabled(whatsappPayment?.value !== 'false');
      setUsdtEnabled(usdtPayment?.value !== 'false');
      setBinanceEnabled(binancePayment?.value === 'true');
      if (binanceId) setBinancePayId(binanceId.value);
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
    
    setSavingPaymentMethods(false);
    
    if (error1 || error2 || error3) {
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
            <Button onClick={savePaymentMethods} disabled={savingPaymentMethods}>
              {savingPaymentMethods ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Save Payment Settings
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
      </div>
    </DashboardLayout>
  );
}
