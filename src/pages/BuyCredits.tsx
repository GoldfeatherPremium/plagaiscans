import React, { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useWhatsApp } from '@/hooks/useWhatsApp';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { MessageCircle, CreditCard, CheckCircle, Loader2, Bitcoin, Copy, ExternalLink, RefreshCw } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';

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
  const [packages, setPackages] = useState<PricingPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [creatingPayment, setCreatingPayment] = useState<string | null>(null);
  const [paymentDetails, setPaymentDetails] = useState<PaymentDetails | null>(null);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(false);

  useEffect(() => {
    const fetchPackages = async () => {
      const { data } = await supabase
        .from('pricing_packages')
        .select('*')
        .eq('is_active', true)
        .order('credits', { ascending: true });
      
      setPackages(data || []);
      setLoading(false);
    };
    fetchPackages();
  }, []);

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

        {/* Pricing Plans */}
        <div className="grid md:grid-cols-2 gap-4">
          {packages.map((plan) => (
            <Card key={plan.id} className="hover:border-primary/50 transition-colors">
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
                  <Button
                    className="w-full bg-[#25D366] hover:bg-[#128C7E]"
                    onClick={() => openWhatsApp(plan.credits)}
                  >
                    <MessageCircle className="h-4 w-4 mr-2" />
                    Buy via WhatsApp
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
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
    </DashboardLayout>
  );
}
