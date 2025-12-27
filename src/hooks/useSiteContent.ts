import { useState, useEffect } from 'react';
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

// Cache for content
let contentCache: Record<string, string> = {};
let cacheLoaded = false;

export const useSiteContent = () => {
  const [content, setContent] = useState<Record<string, string>>(contentCache);
  const [loading, setLoading] = useState(!cacheLoaded);
  const { toast } = useToast();

  useEffect(() => {
    if (cacheLoaded) {
      setContent(contentCache);
      setLoading(false);
      return;
    }

    const fetchContent = async () => {
      try {
        const { data, error } = await supabase
          .from('site_content')
          .select('content_key, content_value');

        if (error) throw error;

        const contentMap: Record<string, string> = {};
        data?.forEach((item: { content_key: string; content_value: string }) => {
          contentMap[item.content_key] = item.content_value;
        });

        contentCache = contentMap;
        cacheLoaded = true;
        setContent(contentMap);
      } catch (error) {
        console.error('Error fetching site content:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchContent();
  }, []);

  const get = (key: string, fallback: string = ''): string => {
    return content[key] || fallback;
  };

  return { content, get, loading };
};

export const useAdminSiteContent = () => {
  const [allContent, setAllContent] = useState<SiteContent[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

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

      // Invalidate cache
      cacheLoaded = false;
      contentCache = {};

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
