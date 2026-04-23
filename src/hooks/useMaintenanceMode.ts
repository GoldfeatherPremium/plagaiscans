import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const useMaintenanceMode = () => {
  const { data, isLoading } = useQuery<boolean>({
    queryKey: ['maintenance-mode'],
    staleTime: 60 * 1000, // 1 minute
    gcTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'maintenance_mode_enabled')
        .maybeSingle();
      return data?.value === 'true';
    },
  });

  return { isMaintenanceMode: !!data, loading: isLoading };
};
