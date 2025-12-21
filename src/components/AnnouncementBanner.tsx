import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { X, Info, AlertTriangle, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Announcement {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'success' | 'error';
}

export const AnnouncementBanner: React.FC = () => {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const fetchAnnouncements = async () => {
    const now = new Date().toISOString();
    const { data } = await supabase
      .from('announcements')
      .select('id, title, message, type')
      .eq('is_active', true)
      .lte('show_from', now)
      .or(`show_until.is.null,show_until.gte.${now}`)
      .order('created_at', { ascending: false });

    if (data) {
      // Load dismissed from session storage
      const dismissedIds = sessionStorage.getItem('dismissed_announcements');
      if (dismissedIds) {
        setDismissed(new Set(JSON.parse(dismissedIds)));
      }
      setAnnouncements(data as Announcement[]);
    }
  };

  const dismiss = (id: string) => {
    const newDismissed = new Set(dismissed).add(id);
    setDismissed(newDismissed);
    sessionStorage.setItem('dismissed_announcements', JSON.stringify([...newDismissed]));
  };

  const getIcon = (type: Announcement['type']) => {
    switch (type) {
      case 'info': return <Info className="h-5 w-5" />;
      case 'warning': return <AlertTriangle className="h-5 w-5" />;
      case 'success': return <CheckCircle className="h-5 w-5" />;
      case 'error': return <AlertCircle className="h-5 w-5" />;
    }
  };

  const getStyles = (type: Announcement['type']) => {
    switch (type) {
      case 'info': return 'bg-primary/10 border-primary/30 text-primary';
      case 'warning': return 'bg-accent/10 border-accent/30 text-accent';
      case 'success': return 'bg-secondary/10 border-secondary/30 text-secondary';
      case 'error': return 'bg-destructive/10 border-destructive/30 text-destructive';
    }
  };

  const visibleAnnouncements = announcements.filter(a => !dismissed.has(a.id));

  if (visibleAnnouncements.length === 0) return null;

  return (
    <div className="space-y-2 mb-6">
      {visibleAnnouncements.map((announcement) => (
        <div
          key={announcement.id}
          className={`flex items-start gap-3 p-4 rounded-lg border ${getStyles(announcement.type)}`}
        >
          <div className="flex-shrink-0 mt-0.5">
            {getIcon(announcement.type)}
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold">{announcement.title}</h4>
            <p className="text-sm opacity-90 mt-0.5">{announcement.message}</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="flex-shrink-0 h-6 w-6 opacity-70 hover:opacity-100"
            onClick={() => dismiss(announcement.id)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ))}
    </div>
  );
};
