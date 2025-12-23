import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const useMaintenanceMode = () => {
  const [isMaintenanceMode, setIsMaintenanceMode] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Defer API call to not block initial render
    const timeoutId = setTimeout(() => {
      checkMaintenanceMode();
    }, 100);
    
    return () => clearTimeout(timeoutId);
  }, []);

  const checkMaintenanceMode = async () => {
    try {
      const { data } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'maintenance_mode_enabled')
        .maybeSingle();
      
      setIsMaintenanceMode(data?.value === 'true');
    } catch (error) {
      console.error('Error checking maintenance mode:', error);
    } finally {
      setLoading(false);
    }
  };

  return { isMaintenanceMode, loading };
};
