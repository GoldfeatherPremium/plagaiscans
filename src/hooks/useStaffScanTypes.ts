import { useState, useEffect } from 'react';
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
  const [scanTypes, setScanTypes] = useState<string[]>(['full', 'similarity_only']);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchScanTypes = async () => {
      // Admins have access to all queues
      if (role === 'admin') {
        setScanTypes(['full', 'similarity_only']);
        setLoading(false);
        return;
      }

      // Staff gets scan types from staff_settings
      if (role === 'staff' && user) {
        const { data, error } = await supabase
          .from('staff_settings')
          .select('assigned_scan_types')
          .eq('user_id', user.id)
          .single();

        if (!error && data?.assigned_scan_types) {
          setScanTypes(data.assigned_scan_types);
        } else {
          // Default to both if no settings exist
          setScanTypes(['full', 'similarity_only']);
        }
      }

      setLoading(false);
    };

    if (role) {
      fetchScanTypes();
    }
  }, [user, role]);

  return {
    scanTypes,
    canAccessAI: scanTypes.includes('full'),
    canAccessSimilarity: scanTypes.includes('similarity_only'),
    loading,
  };
}
