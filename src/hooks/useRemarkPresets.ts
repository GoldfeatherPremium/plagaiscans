import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface RemarkPreset {
  id: string;
  remark_text: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export function useRemarkPresets(activeOnly = true) {
  const queryClient = useQueryClient();
  const queryKey = ['remark-presets', activeOnly] as const;

  const { data: presets = [], isLoading } = useQuery<RemarkPreset[]>({
    queryKey,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    queryFn: async () => {
      let query = supabase
        .from('remark_presets')
        .select('*')
        .order('sort_order', { ascending: true });

      if (activeOnly) {
        query = query.eq('is_active', true);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as RemarkPreset[];
    },
  });

  const refetch = () => queryClient.invalidateQueries({ queryKey: ['remark-presets'] });

  return { presets, loading: isLoading, refetch };
}
