import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { CheckCircle2, Moon } from 'lucide-react';

interface ServiceStatus {
  status: 'online' | 'offline';
  offlineMessage: string;
}

export const ServiceStatusBanner: React.FC = () => {
  const [state, setState] = useState<ServiceStatus | null>(null);

  const fetchStatus = async () => {
    const { data } = await supabase
      .from('settings')
      .select('key, value')
      .in('key', ['service_status', 'service_offline_message']);

    if (data) {
      const status = data.find(s => s.key === 'service_status')?.value === 'offline' ? 'offline' : 'online';
      const offlineMessage =
        data.find(s => s.key === 'service_offline_message')?.value ||
        'We are currently offline. Your uploads will be queued and processed when we are back online.';
      setState({ status, offlineMessage });
    }
  };

  useEffect(() => {
    fetchStatus();

    const channel = supabase
      .channel('service-status-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'settings' },
        (payload: any) => {
          const key = (payload.new as any)?.key ?? (payload.old as any)?.key;
          if (key === 'service_status' || key === 'service_offline_message') {
            fetchStatus();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  if (!state) return null;

  if (state.status === 'online') {
    return (
      <div className="rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3 flex items-start gap-3">
        <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-green-700 dark:text-green-400">
            Service Online
          </p>
          <p className="text-xs text-green-700/80 dark:text-green-400/80">
            Our team is online — your uploads will be processed promptly.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 flex items-start gap-3">
      <Moon className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
      <div className="flex-1">
        <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">
          Service Offline
        </p>
        <p className="text-xs text-amber-700/90 dark:text-amber-400/90 whitespace-pre-line">
          {state.offlineMessage}
        </p>
      </div>
    </div>
  );
};
