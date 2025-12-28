import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, Loader2, XCircle, CreditCard, Coins } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const PaymentSuccess = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { refreshProfile } = useAuth();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [creditsAdded, setCreditsAdded] = useState<number>(0);
  const [newBalance, setNewBalance] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string>("");

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
          setCreditsAdded(data.creditsAdded);
          setNewBalance(data.newBalance);
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
  }, [sessionId, refreshProfile]);

  return (
    <DashboardLayout>
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            {status === 'loading' && (
              <>
                <div className="flex justify-center mb-4">
                  <Loader2 className="h-16 w-16 text-primary animate-spin" />
                </div>
                <CardTitle>Verifying Payment</CardTitle>
                <CardDescription>Please wait while we confirm your payment...</CardDescription>
              </>
            )}
            
            {status === 'success' && (
              <>
                <div className="flex justify-center mb-4">
                  <CheckCircle className="h-16 w-16 text-green-500" />
                </div>
                <CardTitle className="text-green-600">Payment Successful!</CardTitle>
                <CardDescription>Your credits have been added to your account</CardDescription>
              </>
            )}
            
            {status === 'error' && (
              <>
                <div className="flex justify-center mb-4">
                  <XCircle className="h-16 w-16 text-destructive" />
                </div>
                <CardTitle className="text-destructive">Payment Failed</CardTitle>
                <CardDescription>{errorMessage}</CardDescription>
              </>
            )}
          </CardHeader>
          
          <CardContent className="space-y-6">
            {status === 'success' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
                  <div className="flex items-center gap-3">
                    <Coins className="h-5 w-5 text-green-600" />
                    <span className="text-sm font-medium">Credits Added</span>
                  </div>
                  <span className="text-xl font-bold text-green-600">+{creditsAdded}</span>
                </div>
                
                <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                  <div className="flex items-center gap-3">
                    <CreditCard className="h-5 w-5 text-muted-foreground" />
                    <span className="text-sm font-medium">New Balance</span>
                  </div>
                  <span className="text-xl font-bold">{newBalance} credits</span>
                </div>
              </div>
            )}
            
            <div className="flex flex-col gap-2">
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
