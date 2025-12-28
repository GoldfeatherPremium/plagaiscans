import { useEffect, useState, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
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
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { refreshProfile, user, profile } = useAuth();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [paymentDetails, setPaymentDetails] = useState<PaymentDetails | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const receiptRef = useRef<HTMLDivElement>(null);

  const sessionId = searchParams.get("session_id");

  useEffect(() => {
    const verifyPayment = async () => {
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

    verifyPayment();
  }, [sessionId, refreshProfile, user, profile]);

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

Payment Method: Stripe
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
                <CardTitle className="text-2xl">Verifying Payment</CardTitle>
                <CardDescription>Please wait while we confirm your payment...</CardDescription>
              </>
            )}
            
            {status === 'success' && (
              <>
                <div className="flex justify-center mb-4">
                  <div className="p-4 rounded-full bg-green-100 dark:bg-green-900/30">
                    <CheckCircle className="h-12 w-12 text-green-600" />
                  </div>
                </div>
                <CardTitle className="text-2xl text-green-600">Payment Successful!</CardTitle>
                <CardDescription>Your credits have been added to your account</CardDescription>
              </>
            )}
            
            {status === 'error' && (
              <>
                <div className="flex justify-center mb-4">
                  <div className="p-4 rounded-full bg-destructive/10">
                    <XCircle className="h-12 w-12 text-destructive" />
                  </div>
                </div>
                <CardTitle className="text-2xl text-destructive">Payment Failed</CardTitle>
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
                    <span className="text-sm font-medium">Payment Receipt</span>
                  </div>
                </div>

                <Separator />

                {/* Transaction Details */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Hash className="h-4 w-4" />
                      <span>Transaction ID</span>
                    </div>
                    <span className="font-mono font-medium">{paymentDetails.transactionId}</span>
                  </div>
                  
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      <span>Date</span>
                    </div>
                    <span className="font-medium">
                      {format(new Date(paymentDetails.paymentDate), 'MMM dd, yyyy HH:mm')}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <User className="h-4 w-4" />
                      <span>Customer</span>
                    </div>
                    <span className="font-medium">{paymentDetails.customerName}</span>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <CreditCard className="h-4 w-4" />
                      <span>Payment Method</span>
                    </div>
                    <span className="font-medium">Stripe</span>
                  </div>
                </div>

                <Separator />

                {/* Credits Info */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
                    <div className="flex items-center gap-3">
                      <Coins className="h-5 w-5 text-green-600" />
                      <span className="font-medium">Credits Added</span>
                    </div>
                    <span className="text-2xl font-bold text-green-600">+{paymentDetails.creditsAdded}</span>
                  </div>
                  
                  <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                    <div className="flex items-center gap-3">
                      <CreditCard className="h-5 w-5 text-muted-foreground" />
                      <span className="font-medium">New Balance</span>
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
                    Download
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={handlePrint}
                    className="flex-1 gap-2"
                  >
                    <Printer className="h-4 w-4" />
                    Print
                  </Button>
                </div>
              </>
            )}
            
            <div className="flex flex-col gap-2 print:hidden">
              <Button onClick={() => navigate('/dashboard')} className="w-full">
                Go to Dashboard
              </Button>
              {status === 'success' && (
                <Button variant="outline" onClick={() => navigate('/dashboard/upload')} className="w-full">
                  Upload Document
                </Button>
              )}
              {status === 'error' && (
                <Button variant="outline" onClick={() => navigate('/dashboard/credits')} className="w-full">
                  Try Again
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
