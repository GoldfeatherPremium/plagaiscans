import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Mail, CheckCircle, XCircle, Loader2, Home } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const Unsubscribe = () => {
  const { t } = useTranslation('legal');
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'already'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const handleUnsubscribe = async () => {
      const token = searchParams.get('token');
      const uid = searchParams.get('uid');

      if (!uid) {
        setStatus('error');
        setMessage(t('unsubscribe.invalidLink'));
        return;
      }

      try {
        const { data, error } = await supabase.functions.invoke('handle-unsubscribe', {
          body: { userId: uid, token }
        });

        if (error) {
          console.error('Unsubscribe error:', error);
          setStatus('error');
          setMessage(t('unsubscribe.errorMessage'));
          return;
        }

        if (data?.message === 'Already unsubscribed') {
          setStatus('already');
          setMessage(t('unsubscribe.alreadyUnsubscribed'));
        } else if (data?.success) {
          setStatus('success');
          setMessage(t('unsubscribe.successMessage'));
        } else {
          setStatus('error');
          setMessage(data?.error || t('unsubscribe.unexpectedError'));
        }
      } catch (err) {
        console.error('Unsubscribe error:', err);
        setStatus('error');
        setMessage(t('unsubscribe.errorMessage'));
      }
    };

    handleUnsubscribe();
  }, [searchParams, t]);

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
            {status === 'loading' && t('unsubscribe.processing')}
            {status === 'success' && t('unsubscribe.unsubscribedTitle')}
            {status === 'already' && t('unsubscribe.alreadyTitle')}
            {status === 'error' && t('unsubscribe.errorTitle')}
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
                  ? t('unsubscribe.stillReceiveTransactional')
                  : t('unsubscribe.contactSupport')
                }
              </p>
              <div className="flex justify-center pt-4">
                <Button asChild variant="outline">
                  <Link to="/" className="flex items-center gap-2">
                    <Home className="h-4 w-4" />
                    {t('unsubscribe.returnHome')}
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
