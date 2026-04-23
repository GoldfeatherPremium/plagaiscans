import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface StaffScanTypes {
  scanTypes: string[];
  canAccessAI: boolean;
  canAccessSimilarity: boolean;
  loading: boolean;
}

export function useStaffScanTypes(): StaffScanTypes {
  const { user, role } = useAuth();

  const { data: scanTypes = ['full', 'similarity_only'], isLoading } = useQuery<string[]>({
    queryKey: ['staff-scan-types', user?.id, role],
    enabled: !!role,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    queryFn: async () => {
      if (role === 'admin') return ['full', 'similarity_only'];

      if (role === 'staff' && user) {
        const { data, error } = await supabase
          .from('staff_settings')
          .select('assigned_scan_types')
          .eq('user_id', user.id)
          .single();

        if (!error && data?.assigned_scan_types) return data.assigned_scan_types;
      }
      return ['full', 'similarity_only'];
    },
  });

  return {
    scanTypes,
    canAccessAI: scanTypes.includes('full'),
    canAccessSimilarity: scanTypes.includes('similarity_only'),
    loading: isLoading,
  };
}
