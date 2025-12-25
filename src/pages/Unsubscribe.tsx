import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Mail, CheckCircle, XCircle, Loader2, Home } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const Unsubscribe = () => {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'already'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const handleUnsubscribe = async () => {
      const token = searchParams.get('token');
      const uid = searchParams.get('uid');

      if (!uid) {
        setStatus('error');
        setMessage('Invalid unsubscribe link. Please contact support.');
        return;
      }

      try {
        const { data, error } = await supabase.functions.invoke('handle-unsubscribe', {
          body: { userId: uid, token }
        });

        if (error) {
          console.error('Unsubscribe error:', error);
          setStatus('error');
          setMessage('Failed to process your request. Please try again later.');
          return;
        }

        if (data?.message === 'Already unsubscribed') {
          setStatus('already');
          setMessage('You have already unsubscribed from promotional emails.');
        } else if (data?.success) {
          setStatus('success');
          setMessage('You have been successfully unsubscribed from promotional emails.');
        } else {
          setStatus('error');
          setMessage(data?.error || 'An unexpected error occurred.');
        }
      } catch (err) {
        console.error('Unsubscribe error:', err);
        setStatus('error');
        setMessage('Failed to process your request. Please try again later.');
      }
    };

    handleUnsubscribe();
  }, [searchParams]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            {status === 'loading' && <Loader2 className="h-8 w-8 text-primary animate-spin" />}
            {status === 'success' && <CheckCircle className="h-8 w-8 text-green-500" />}
            {status === 'already' && <Mail className="h-8 w-8 text-blue-500" />}
            {status === 'error' && <XCircle className="h-8 w-8 text-destructive" />}
          </div>
          <CardTitle className="text-2xl">
            {status === 'loading' && 'Processing...'}
            {status === 'success' && 'Unsubscribed'}
            {status === 'already' && 'Already Unsubscribed'}
            {status === 'error' && 'Error'}
          </CardTitle>
          <CardDescription className="text-base">
            {message}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {status !== 'loading' && (
            <>
              <p className="text-sm text-muted-foreground text-center">
                {status === 'success' || status === 'already' 
                  ? "You will no longer receive promotional emails from Plagaiscans. You will still receive important transactional emails about your account and documents."
                  : "If you continue to have issues, please contact us at support@plagaiscans.com"
                }
              </p>
              <div className="flex justify-center pt-4">
                <Button asChild variant="outline">
                  <Link to="/" className="flex items-center gap-2">
                    <Home className="h-4 w-4" />
                    Return to Home
                  </Link>
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Unsubscribe;
