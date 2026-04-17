import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

type Status = 'online' | 'offline';

export const ServiceStatusPill: React.FC = () => {
  const [status, setStatus] = useState<Status | null>(null);

  const fetchStatus = async () => {
    const { data } = await supabase
      .from('settings')
      .select('key, value')
      .eq('key', 'service_status')
      .maybeSingle();
    setStatus(data?.value === 'offline' ? 'offline' : 'online');
  };

  useEffect(() => {
    fetchStatus();

    const channel = supabase
      .channel('service-status-pill')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'settings' },
        (payload: any) => {
          const key = (payload.new as any)?.key ?? (payload.old as any)?.key;
          if (key === 'service_status') fetchStatus();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  if (!status) return null;

  const isOnline = status === 'online';

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={
              isOnline
                ? 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-500/10 border border-green-500/30 cursor-default'
                : 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 cursor-default'
            }
            aria-label={isOnline ? 'Service online' : 'Service offline'}
          >
            <span className="relative flex h-2 w-2">
              {isOnline && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75" />
              )}
              <span
                className={
                  isOnline
                    ? 'relative inline-flex rounded-full h-2 w-2 bg-green-500'
                    : 'relative inline-flex rounded-full h-2 w-2 bg-amber-500'
                }
              />
            </span>
            <span
              className={
                isOnline
                  ? 'text-xs font-semibold text-green-700 dark:text-green-400 hidden sm:inline'
                  : 'text-xs font-semibold text-amber-700 dark:text-amber-400 hidden sm:inline'
              }
            >
              {isOnline ? 'Online' : 'Offline'}
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          {isOnline
            ? 'System is online — uploads will be processed promptly'
            : 'System is offline — uploads will be queued'}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
