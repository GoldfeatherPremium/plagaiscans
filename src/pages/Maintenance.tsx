import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function Maintenance() {
  const { t } = useTranslation('pages');
  const [message, setMessage] = useState(t('maintenance.defaultMessage'));
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchMessage();
  }, []);

  const fetchMessage = async () => {
    const { data } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'maintenance_message')
      .maybeSingle();
    
    if (data?.value) {
      setMessage(data.value);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    // Check if maintenance is still enabled
    const { data } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'maintenance_mode_enabled')
      .maybeSingle();
    
    if (data?.value !== 'true') {
      window.location.reload();
    } else {
      setRefreshing(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="flex justify-center">
          <div className="h-20 w-20 rounded-full bg-amber-500/10 flex items-center justify-center">
            <AlertTriangle className="h-10 w-10 text-amber-500" />
          </div>
        </div>
        
        <div className="space-y-2">
          <h1 className="text-3xl font-display font-bold">{t('maintenance.title')}</h1>
          <p className="text-muted-foreground">{message}</p>
        </div>

        <div className="pt-4">
          <Button 
            variant="outline" 
            onClick={handleRefresh} 
            disabled={refreshing}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            {t('maintenance.checkStatus')}
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          {t('maintenance.apology')}
        </p>
      </div>
    </div>
  );
}
