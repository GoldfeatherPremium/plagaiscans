import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { subDays } from 'date-fns';
import { useState } from 'react';

export type ExpiredPeriod = '7d' | '30d' | '90d' | 'all';

export interface ExpiredCreditsStats {
  totalBatches: number;
  totalExpiredCredits: number;
  aiScanExpired: number;
  similarityExpired: number;
}

export function useExpiredCreditsStats() {
  const [period, setPeriod] = useState<ExpiredPeriod>('all');

  const { data: stats, isLoading } = useQuery({
    queryKey: ['expired-credits-stats', period],
    queryFn: async () => {
      let query = supabase
        .from('credit_validity')
        .select('credits_amount, credit_type, expires_at, credits_expired_unused')
        .eq('expired', true);

      if (period !== 'all') {
        const daysMap = { '7d': 7, '30d': 30, '90d': 90 };
        const since = subDays(new Date(), daysMap[period]).toISOString();
        query = query.gte('expires_at', since);
      }

      const { data, error } = await query;
      if (error) throw error;

      const result: ExpiredCreditsStats = {
        totalBatches: data?.length || 0,
        totalExpiredCredits: 0,
        aiScanExpired: 0,
        similarityExpired: 0,
      };

      for (const row of data || []) {
        // Use credits_expired_unused if available, fallback to credits_amount
        const unused = (row as any).credits_expired_unused ?? row.credits_amount;
        result.totalExpiredCredits += unused;
        if (row.credit_type === 'full') {
          result.aiScanExpired += unused;
        } else {
          result.similarityExpired += unused;
        }
      }

      return result;
    },
  });

  return { stats, isLoading, period, setPeriod };
}
