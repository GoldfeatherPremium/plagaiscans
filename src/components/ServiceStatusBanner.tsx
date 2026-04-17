import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { CheckCircle2, Moon, Clock } from 'lucide-react';

interface ServiceStatus {
  status: 'online' | 'offline';
  offlineMessage: string;
  backOnlineAt: string | null;
}

const formatCountdown = (target: Date): string => {
  const diffMs = target.getTime() - Date.now();
  if (diffMs <= 0) return '';

  const totalMinutes = Math.floor(diffMs / 60000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m`;
  return 'less than a minute';
};

const formatAbsoluteTime = (target: Date): string => {
  const now = new Date();
  const sameDay =
    target.getFullYear() === now.getFullYear() &&
    target.getMonth() === now.getMonth() &&
    target.getDate() === now.getDate();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const isTomorrow =
    target.getFullYear() === tomorrow.getFullYear() &&
    target.getMonth() === tomorrow.getMonth() &&
    target.getDate() === tomorrow.getDate();

  const time = target.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });

  if (sameDay) return `${time} today`;
  if (isTomorrow) return `${time} tomorrow`;
  return target.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

export const ServiceStatusBanner: React.FC = () => {
  const [state, setState] = useState<ServiceStatus | null>(null);
  const [, setTick] = useState(0); // forces re-render for countdown

  const fetchStatus = async () => {
    const { data } = await supabase
      .from('settings')
      .select('key, value')
      .in('key', ['service_status', 'service_offline_message', 'service_back_online_at']);

    if (data) {
      const status = data.find(s => s.key === 'service_status')?.value === 'offline' ? 'offline' : 'online';
      const offlineMessage =
        data.find(s => s.key === 'service_offline_message')?.value ||
        'We are currently offline. Your uploads will be queued and processed when we are back online.';
      const backOnlineAt = data.find(s => s.key === 'service_back_online_at')?.value || null;
      setState({ status, offlineMessage, backOnlineAt: backOnlineAt || null });
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
          if (
            key === 'service_status' ||
            key === 'service_offline_message' ||
            key === 'service_back_online_at'
          ) {
            fetchStatus();
          }
        }
      )
      .subscribe();

    // Tick once a minute to refresh countdown
    const interval = setInterval(() => setTick(t => t + 1), 60_000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, []);

  if (!state) return null;

  // Online state is shown via the compact ServiceStatusPill in the header.
  if (state.status === 'online') return null;

  // Offline — compute optional countdown
  let countdown: { rel: string; abs: string } | null = null;
  if (state.backOnlineAt) {
    const target = new Date(state.backOnlineAt);
    if (!isNaN(target.getTime()) && target.getTime() > Date.now()) {
      countdown = {
        rel: formatCountdown(target),
        abs: formatAbsoluteTime(target),
      };
    }
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
        {countdown && (
          <div className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-amber-500/15 px-2 py-1 text-xs font-medium text-amber-800 dark:text-amber-300">
            <Clock className="h-3.5 w-3.5" />
            <span>
              Back online in {countdown.rel}
              <span className="font-normal opacity-80"> (approx. {countdown.abs})</span>
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
