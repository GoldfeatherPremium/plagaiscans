import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, CreditCard, X } from 'lucide-react';
import { toast } from 'sonner';

export function FailedPaymentBanner() {
  const { user } = useAuth();
  const [hasFailedPayment, setHasFailedPayment] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return;

    // Check for failed payments in stripe_payments
    const checkFailedPayments = async () => {
      const { data } = await supabase
        .from('stripe_payments')
        .select('id')
        .eq('user_id', user.id)
        .eq('status', 'failed')
        .limit(1);

      setHasFailedPayment((data?.length || 0) > 0);
    };

    checkFailedPayments();

    // Subscribe to changes
    const channel = supabase
      .channel('failed-payments-banner')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'stripe_payments',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          checkFailedPayments();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const handleManagePayment = async () => {
    setLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        toast.error('Please log in to manage your payment method');
        return;
      }

      const response = await supabase.functions.invoke('customer-portal', {
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
      });

      if (response.error) throw new Error(response.error.message);
      if (response.data?.url) {
        window.open(response.data.url, '_blank');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to open payment portal');
    } finally {
      setLoading(false);
    }
  };

  if (!hasFailedPayment || dismissed) return null;

  return (
    <Card className="border-red-200 bg-red-50/50 dark:bg-red-950/20 mb-6">
      <CardContent className="py-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-red-100 dark:bg-red-900/50">
              <AlertTriangle className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <h3 className="font-semibold text-red-900 dark:text-red-100">Payment Failed</h3>
              <p className="text-sm text-red-700 dark:text-red-300">
                Your recent payment could not be processed. Please update your payment method.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleManagePayment}
              disabled={loading}
              className="gap-2 border-red-200 text-red-700 hover:bg-red-100"
            >
              <CreditCard className="h-4 w-4" />
              {loading ? 'Loading...' : 'Update Payment'}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setDismissed(true)}
              className="text-red-600 hover:bg-red-100"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
