import React, { useCallback, useState, useEffect } from 'react';
import { loadStripe, Stripe } from '@stripe/stripe-js';
import {
  EmbeddedCheckoutProvider,
  EmbeddedCheckout
} from '@stripe/react-stripe-js';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2 } from 'lucide-react';

interface StripeEmbeddedCheckoutProps {
  open: boolean;
  onClose: () => void;
  credits: number;
  amount: number; // in cents
  creditType: 'full' | 'similarity_only';
  onSuccess?: () => void;
}

export function StripeEmbeddedCheckout({
  open,
  onClose,
  credits,
  amount,
  creditType,
  onSuccess,
}: StripeEmbeddedCheckoutProps) {
  const [error, setError] = useState<string | null>(null);
  const [stripePromise, setStripePromise] = useState<Promise<Stripe | null> | null>(null);
  const [loadingKey, setLoadingKey] = useState(true);

  // Load Stripe publishable key from settings
  useEffect(() => {
    const loadStripeKey = async () => {
      setLoadingKey(true);
      try {
        const { data } = await supabase
          .from('settings')
          .select('value')
          .eq('key', 'stripe_publishable_key')
          .single();
        
        if (data?.value) {
          setStripePromise(loadStripe(data.value));
        } else {
          setError('Stripe is not configured. Please contact support.');
        }
      } catch (err) {
        console.error('Failed to load Stripe key:', err);
        setError('Failed to load payment configuration.');
      } finally {
        setLoadingKey(false);
      }
    };

    if (open) {
      loadStripeKey();
    }
  }, [open]);

  const fetchClientSecret = useCallback(async () => {
    setError(null);
    
    const response = await supabase.functions.invoke('create-stripe-embedded-checkout', {
      body: {
        credits,
        amount,
        creditType,
      },
    });

    if (response.error) {
      setError(response.error.message);
      throw new Error(response.error.message);
    }

    if (!response.data?.clientSecret) {
      const errorMsg = response.data?.error || 'Failed to create checkout session';
      setError(errorMsg);
      throw new Error(errorMsg);
    }

    return response.data.clientSecret;
  }, [credits, amount, creditType]);

  const onComplete = useCallback(() => {
    onSuccess?.();
    onClose();
  }, [onSuccess, onClose]);

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle>Complete Your Purchase</DialogTitle>
        </DialogHeader>
        <div className="p-6 pt-4">
          {loadingKey ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <p className="text-destructive mb-4">{error}</p>
              <button 
                onClick={() => setError(null)} 
                className="text-primary underline"
              >
                Try again
              </button>
            </div>
          ) : stripePromise ? (
            <div id="checkout" className="min-h-[400px]">
              <EmbeddedCheckoutProvider
                stripe={stripePromise}
                options={{
                  fetchClientSecret,
                  onComplete,
                }}
              >
                <EmbeddedCheckout />
              </EmbeddedCheckoutProvider>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-muted-foreground">Payment system is not available.</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
