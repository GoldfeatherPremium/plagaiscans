import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface SiteContent {
  id: string;
  content_key: string;
  content_value: string;
  section: string;
  description: string | null;
  updated_at: string;
  updated_by: string | null;
}

const SITE_CONTENT_KEY = ['site-content'] as const;

export const useSiteContent = () => {
  const { data: content = {}, isLoading } = useQuery<Record<string, string>>({
    queryKey: SITE_CONTENT_KEY,
    staleTime: 10 * 60 * 1000, // 10m — site content rarely changes
    gcTime: 30 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('site_content')
        .select('content_key, content_value');
      if (error) throw error;

      const contentMap: Record<string, string> = {};
      data?.forEach((item: { content_key: string; content_value: string }) => {
        contentMap[item.content_key] = item.content_value;
      });
      return contentMap;
    },
  });

  const get = (key: string, fallback: string = ''): string => content[key] || fallback;

  return { content, get, loading: isLoading };
};

export const useAdminSiteContent = () => {
  const [allContent, setAllContent] = useState<SiteContent[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const fetchAllContent = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('site_content')
        .select('*')
        .order('section', { ascending: true })
        .order('content_key', { ascending: true });

      if (error) throw error;
      setAllContent(data || []);
    } catch (error) {
      console.error('Error fetching content:', error);
      toast({
        title: 'Error',
        description: 'Failed to load content',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllContent();
  }, []);

  const updateContent = async (id: string, newValue: string) => {
    try {
      setSaving(true);
      const { error } = await supabase
        .from('site_content')
        .update({ 
          content_value: newValue,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;

      // Update local state
      setAllContent(prev => 
        prev.map(item => 
          item.id === id ? { ...item, content_value: newValue } : item
        )
      );

      // Invalidate React Query cache so other consumers re-fetch
      queryClient.invalidateQueries({ queryKey: SITE_CONTENT_KEY });

      toast({
        title: 'Saved',
        description: 'Content updated successfully',
      });
    } catch (error) {
      console.error('Error updating content:', error);
      toast({
        title: 'Error',
        description: 'Failed to update content',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const groupedContent = allContent.reduce((acc, item) => {
    if (!acc[item.section]) {
      acc[item.section] = [];
    }
    acc[item.section].push(item);
    return acc;
  }, {} as Record<string, SiteContent[]>);

  return { allContent, groupedContent, loading, saving, updateContent, refetch: fetchAllContent };
};
