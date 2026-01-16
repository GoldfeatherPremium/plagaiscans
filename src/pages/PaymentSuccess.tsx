import { useEffect, useState, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from 'react-i18next';
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { 
  CheckCircle, 
  Loader2, 
  XCircle, 
  CreditCard, 
  Coins, 
  Download, 
  Printer,
  Calendar,
  Hash,
  User,
  Receipt
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { toast } from "sonner";

interface PaymentDetails {
  creditsAdded: number;
  newBalance: number;
  transactionId: string;
  paymentDate: string;
  customerEmail: string;
  customerName: string;
  amountPaid?: number;
}

const PaymentSuccess = () => {
  const { t } = useTranslation('pages');
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { refreshProfile, user, profile } = useAuth();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [paymentDetails, setPaymentDetails] = useState<PaymentDetails | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [paymentProvider, setPaymentProvider] = useState<string>("stripe");
  const receiptRef = useRef<HTMLDivElement>(null);

  const sessionId = searchParams.get("session_id");
  const provider = searchParams.get("provider");
  const paymentId = searchParams.get("payment_id");
  const paymentStatus = searchParams.get("status");

  useEffect(() => {
    const verifyStripePayment = async () => {
      if (!sessionId) {
        setStatus('error');
        setErrorMessage("No payment session found");
        return;
      }

      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          setStatus('error');
          setErrorMessage("Not authenticated");
          return;
        }

        const { data, error } = await supabase.functions.invoke('verify-stripe-payment', {
          body: { sessionId },
        });

        if (error) {
          console.error('Verification error:', error);
          setStatus('error');
          setErrorMessage(error.message || "Failed to verify payment");
          return;
        }

        if (data.success) {
          setPaymentDetails({
            creditsAdded: data.creditsAdded,
            newBalance: data.newBalance,
            transactionId: sessionId.slice(-12).toUpperCase(),
            paymentDate: new Date().toISOString(),
            customerEmail: user?.email || '',
            customerName: profile?.full_name || 'Customer',
            amountPaid: data.amountPaid,
          });
          setStatus('success');
          await refreshProfile();
        } else {
          setStatus('error');
          setErrorMessage(data.status === 'unpaid' ? "Payment was not completed" : "Payment verification failed");
        }
      } catch (err) {
        console.error('Error verifying payment:', err);
        setStatus('error');
        setErrorMessage("An unexpected error occurred");
      }
    };

    const verifyDodoPayment = async () => {
      // For Dodo, the webhook already processed the payment
      // We just need to verify the payment status from URL params and show success
      if (paymentStatus === 'succeeded') {
        try {
          // Refresh profile to get updated credit balance
          await refreshProfile();
          
          // Get the latest profile data
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) {
            setStatus('error');
            setErrorMessage("Not authenticated");
            return;
          }

          const { data: profileData } = await supabase
            .from('profiles')
            .select('credit_balance, full_name, email')
            .eq('id', session.user.id)
            .single();

          // Try to get payment details from dodo_payments table
          const { data: dodoPayment } = await supabase
            .from('dodo_payments')
            .select('credits, amount_usd, completed_at')
            .or(`payment_id.eq.${paymentId},checkout_session_id.eq.${paymentId}`)
            .eq('status', 'completed')
            .order('completed_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          setPaymentDetails({
            creditsAdded: dodoPayment?.credits || 0,
            newBalance: profileData?.credit_balance || 0,
            transactionId: (paymentId || '').slice(-12).toUpperCase(),
            paymentDate: dodoPayment?.completed_at || new Date().toISOString(),
            customerEmail: profileData?.email || user?.email || '',
            customerName: profileData?.full_name || profile?.full_name || 'Customer',
            amountPaid: dodoPayment?.amount_usd,
          });
          setStatus('success');
        } catch (err) {
          console.error('Error fetching Dodo payment details:', err);
          // Still show success since the URL indicates payment succeeded
          setPaymentDetails({
            creditsAdded: 0,
            newBalance: profile?.credit_balance || 0,
            transactionId: (paymentId || '').slice(-12).toUpperCase(),
            paymentDate: new Date().toISOString(),
            customerEmail: user?.email || '',
            customerName: profile?.full_name || 'Customer',
          });
          setStatus('success');
          await refreshProfile();
        }
      } else {
        setStatus('error');
        setErrorMessage("Payment was not completed");
      }
    };

    const verifyPaypalPayment = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          setStatus('error');
          setErrorMessage("Not authenticated");
          return;
        }

        // Get the PayPal token from URL (PayPal uses 'token' param for order ID)
        const paypalToken = searchParams.get('token');
        if (!paypalToken) {
          setStatus('error');
          setErrorMessage("No PayPal order found");
          return;
        }

        const { data, error } = await supabase.functions.invoke('verify-paypal-payment', {
          body: { orderId: paypalToken },
        });

        if (error) {
          console.error('PayPal verification error:', error);
          setStatus('error');
          setErrorMessage(error.message || "Failed to verify PayPal payment");
          return;
        }

        if (data.success) {
          setPaymentDetails({
            creditsAdded: data.creditsAdded,
            newBalance: data.newBalance,
            transactionId: paypalToken.slice(-12).toUpperCase(),
            paymentDate: new Date().toISOString(),
            customerEmail: user?.email || '',
            customerName: profile?.full_name || 'Customer',
            amountPaid: data.amountPaid,
          });
          setStatus('success');
          await refreshProfile();
        } else {
          setStatus('error');
          setErrorMessage(data.message || "Payment verification failed");
        }
      } catch (err) {
        console.error('Error verifying PayPal payment:', err);
        setStatus('error');
        setErrorMessage("An unexpected error occurred");
      }
    };

    if (provider === 'paypal' || searchParams.get('token')) {
      setPaymentProvider('paypal');
      verifyPaypalPayment();
    } else if (provider === 'dodo') {
      setPaymentProvider('dodo');
      verifyDodoPayment();
    } else if (sessionId) {
      setPaymentProvider('stripe');
      verifyStripePayment();
    } else {
      setStatus('error');
      setErrorMessage("No payment session found");
    }
  }, [sessionId, provider, paymentId, paymentStatus, refreshProfile, user, profile]);

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = () => {
    if (!paymentDetails) return;

    const receiptContent = `
PAYMENT RECEIPT
===============

Transaction ID: ${paymentDetails.transactionId}
Date: ${format(new Date(paymentDetails.paymentDate), 'MMMM dd, yyyy HH:mm:ss')}

Customer Details:
-----------------
Name: ${paymentDetails.customerName}
Email: ${paymentDetails.customerEmail}

Payment Details:
----------------
Credits Purchased: ${paymentDetails.creditsAdded}
New Credit Balance: ${paymentDetails.newBalance}

Payment Method: ${paymentProvider === 'dodo' ? 'Dodo Payments' : 'Stripe'}
Status: Completed

Thank you for your purchase!
Visit us at: ${window.location.origin}
    `.trim();

    const blob = new Blob([receiptContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `receipt-${paymentDetails.transactionId}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Receipt downloaded');
  };

  return (
    <DashboardLayout>
      <div className="flex items-center justify-center min-h-[70vh] p-4">
        <Card className="w-full max-w-lg print:shadow-none print:border-0" ref={receiptRef}>
          <CardHeader className="text-center pb-2">
            {status === 'loading' && (
              <>
                <div className="flex justify-center mb-4">
                  <div className="p-4 rounded-full bg-primary/10">
                    <Loader2 className="h-12 w-12 text-primary animate-spin" />
                  </div>
                </div>
                <CardTitle className="text-2xl">{t('paymentSuccess.verifying')}</CardTitle>
                <CardDescription>{t('paymentSuccess.verifyingDesc')}</CardDescription>
              </>
            )}
            
            {status === 'success' && (
              <>
                <div className="flex justify-center mb-4">
                  <div className="p-4 rounded-full bg-green-100 dark:bg-green-900/30">
                    <CheckCircle className="h-12 w-12 text-green-600" />
                  </div>
                </div>
                <CardTitle className="text-2xl text-green-600">{t('paymentSuccess.success')}</CardTitle>
                <CardDescription>{t('paymentSuccess.successDesc')}</CardDescription>
              </>
            )}
            
            {status === 'error' && (
              <>
                <div className="flex justify-center mb-4">
                  <div className="p-4 rounded-full bg-destructive/10">
                    <XCircle className="h-12 w-12 text-destructive" />
                  </div>
                </div>
                <CardTitle className="text-2xl text-destructive">{t('paymentSuccess.failed')}</CardTitle>
                <CardDescription>{errorMessage}</CardDescription>
              </>
            )}
          </CardHeader>
          
          <CardContent className="space-y-6">
            {status === 'success' && paymentDetails && (
              <>
                {/* Receipt Header */}
                <div className="text-center pb-4">
                  <div className="flex items-center justify-center gap-2 text-muted-foreground">
                    <Receipt className="h-4 w-4" />
                    <span className="text-sm font-medium">{t('paymentSuccess.receipt')}</span>
                  </div>
                </div>

                <Separator />

                {/* Transaction Details */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Hash className="h-4 w-4" />
                      <span>{t('paymentSuccess.transactionId')}</span>
                    </div>
                    <span className="font-mono font-medium">{paymentDetails.transactionId}</span>
                  </div>
                  
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      <span>{t('paymentSuccess.date')}</span>
                    </div>
                    <span className="font-medium">
                      {format(new Date(paymentDetails.paymentDate), 'MMM dd, yyyy HH:mm')}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <User className="h-4 w-4" />
                      <span>{t('paymentSuccess.customer')}</span>
                    </div>
                    <span className="font-medium">{paymentDetails.customerName}</span>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <CreditCard className="h-4 w-4" />
                      <span>{t('paymentSuccess.paymentMethod')}</span>
                    </div>
                    <span className="font-medium">{paymentProvider === 'dodo' ? 'Dodo Payments' : paymentProvider === 'paypal' ? 'PayPal' : 'Stripe'}</span>
                  </div>
                </div>

                <Separator />

                {/* Credits Info */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
                    <div className="flex items-center gap-3">
                      <Coins className="h-5 w-5 text-green-600" />
                      <span className="font-medium">{t('paymentSuccess.creditsAdded')}</span>
                    </div>
                    <span className="text-2xl font-bold text-green-600">+{paymentDetails.creditsAdded}</span>
                  </div>
                  
                  <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                    <div className="flex items-center gap-3">
                      <CreditCard className="h-5 w-5 text-muted-foreground" />
                      <span className="font-medium">{t('paymentSuccess.newBalance')}</span>
                    </div>
                    <span className="text-2xl font-bold">{paymentDetails.newBalance}</span>
                  </div>
                </div>

                <Separator className="print:hidden" />

                {/* Action Buttons */}
                <div className="flex gap-2 print:hidden">
                  <Button 
                    variant="outline" 
                    onClick={handleDownload}
                    className="flex-1 gap-2"
                  >
                    <Download className="h-4 w-4" />
                    {t('paymentSuccess.download')}
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={handlePrint}
                    className="flex-1 gap-2"
                  >
                    <Printer className="h-4 w-4" />
                    {t('paymentSuccess.print')}
                  </Button>
                </div>
              </>
            )}
            
            <div className="flex flex-col gap-2 print:hidden">
              <Button onClick={() => navigate('/dashboard')} className="w-full">
                {t('paymentSuccess.goToDashboard')}
              </Button>
              {status === 'success' && (
                <Button variant="outline" onClick={() => navigate('/dashboard/upload')} className="w-full">
                  {t('paymentSuccess.uploadDocument')}
                </Button>
              )}
              {status === 'error' && (
                <Button variant="outline" onClick={() => navigate('/dashboard/credits')} className="w-full">
                  {t('paymentSuccess.tryAgain')}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default PaymentSuccess;
