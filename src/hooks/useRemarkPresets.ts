import { useState, useEffect } from 'react';
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
  const [presets, setPresets] = useState<RemarkPreset[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPresets = async () => {
    setLoading(true);
    let query = supabase
      .from('remark_presets')
      .select('*')
      .order('sort_order', { ascending: true });

    if (activeOnly) {
      query = query.eq('is_active', true);
    }

    const { data, error } = await query;
    if (!error && data) {
      setPresets(data as RemarkPreset[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchPresets();
  }, [activeOnly]);

  return { presets, loading, refetch: fetchPresets };
}
