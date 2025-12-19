import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { formatDistanceToNow } from 'date-fns';

interface Notification {
  id: string;
  title: string;
  message: string;
  created_at: string;
  is_read?: boolean;
  type: 'broadcast' | 'personal';
}

export const NotificationBell: React.FC = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState(false);
  const [isRinging, setIsRinging] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Play notification sound
  const playNotificationSound = useCallback(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdH2JkI+Kf3R0fYiRlI+Eg3x6fYKGhYOAfXx9f4GBf3x5eHh6fH5/fn18fH1/gYKCgoB+fXx8fX5/f4B/fn5+f4CCg4ODgoF/fn19fX5/gIGBgYB/fn19fX5/gIGBgYB/fn19fX5/gIGBgYB/fn19fX5/gIGBgYB/fn18fH1+f4CAgH9+fXx8fX5/gIB/fn18fHx9fn+AgH9+fXx8fH1+f4B/fn18fHx9fn9/fn18fHx9fn9/fn18fHx8fX5/f359fHx8fH1+f399fXx8fHx9fn9/fXx8fHx8fX5/f318fHx8fH1+f399fHx8fHx9fn9/fXx8fHx8fX5+f318fHx8fH19fn99fXx8fHx8fX5+fXx8fHx8fH19fn58fHx8fHx8fX5+fXx8fHx8fHx9fn58fHx8fHx8fX1+fnx8fHx8fHx9fX5+fHx8fHx8fH19fn18fHx8fHx8fX1+fXx8fHx8fHx9fX59fHx8fHx8fH19fn18fHx8fHx8fH19fnx8fHx8fHx8fX1+fHx8fHx8fHx9fX58fHx8fHx8fHx9fXx8fHx8fHx8fH19fHx8fHx8fHx8fX18fHx8fHx8fHx9fXx8fHx8fHx8fHx9fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8');
    }
    audioRef.current.currentTime = 0;
    audioRef.current.volume = 0.3;
    audioRef.current.play().catch(() => {});
  }, []);

  // Trigger bell animation
  const triggerBellRing = useCallback(() => {
    setIsRinging(true);
    playNotificationSound();
    setTimeout(() => setIsRinging(false), 500);
  }, [playNotificationSound]);

  useEffect(() => {
    if (!user) return;

    const fetchNotifications = async () => {
      // Fetch broadcast notifications
      const { data: broadcasts } = await supabase
        .from('notifications')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      // Fetch personal notifications for this user
      const { data: personal } = await supabase
        .from('user_notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      // Fetch read status for broadcast notifications
      const { data: reads } = await supabase
        .from('notification_reads')
        .select('notification_id')
        .eq('user_id', user.id);

      // Combine and sort all notifications
      const allNotifications: Notification[] = [
        ...(broadcasts || []).map(n => ({ ...n, type: 'broadcast' as const })),
        ...(personal || []).map(n => ({ ...n, type: 'personal' as const, is_read: !!n.read_at })),
      ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      setNotifications(allNotifications);
      if (reads) setReadIds(new Set(reads.map(r => r.notification_id)));
    };

    fetchNotifications();

    // Subscribe to realtime notifications
    const broadcastChannel = supabase
      .channel('notifications-channel')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications' },
        (payload) => {
          setNotifications(prev => [{ ...payload.new as Notification, type: 'broadcast' }, ...prev]);
          triggerBellRing();
        }
      )
      .subscribe();

    // Subscribe to personal notifications
    const personalChannel = supabase
      .channel('user-notifications-channel')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'user_notifications', filter: `user_id=eq.${user.id}` },
        (payload) => {
          setNotifications(prev => [{ ...payload.new as Notification, type: 'personal' }, ...prev]);
          triggerBellRing();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(broadcastChannel);
      supabase.removeChannel(personalChannel);
    };
  }, [user, triggerBellRing]);

  const markAsRead = async (notif: Notification) => {
    if (!user) return;
    
    if (notif.type === 'personal') {
      // Mark personal notification as read
      await supabase
        .from('user_notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('id', notif.id);
      
      setNotifications(prev => 
        prev.map(n => n.id === notif.id ? { ...n, is_read: true } : n)
      );
    } else {
      // Mark broadcast notification as read
      if (readIds.has(notif.id)) return;
      
      await supabase
        .from('notification_reads')
        .insert({ notification_id: notif.id, user_id: user.id });

      setReadIds(prev => new Set([...prev, notif.id]));
    }
  };

  const markAllAsRead = async () => {
    if (!user) return;

    // Mark personal notifications
    const unreadPersonal = notifications.filter(n => n.type === 'personal' && !n.is_read);
    if (unreadPersonal.length > 0) {
      await supabase
        .from('user_notifications')
        .update({ read_at: new Date().toISOString() })
        .in('id', unreadPersonal.map(n => n.id));
    }

    // Mark broadcast notifications
    const unreadBroadcasts = notifications.filter(n => n.type === 'broadcast' && !readIds.has(n.id));
    if (unreadBroadcasts.length > 0) {
      const inserts = unreadBroadcasts.map(n => ({
        notification_id: n.id,
        user_id: user.id,
      }));
      await supabase.from('notification_reads').insert(inserts);
    }

    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    setReadIds(new Set(notifications.map(n => n.id)));
  };

  const isUnread = (notif: Notification) => {
    if (notif.type === 'personal') return !notif.is_read;
    return !readIds.has(notif.id);
  };

  const unreadCount = notifications.filter(n => isUnread(n)).length;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon" 
          className="fixed top-4 right-4 z-40 bg-card border border-border shadow-lg rounded-full"
        >
          <Bell className={`h-5 w-5 ${isRinging ? 'animate-bell-ring' : ''} ${unreadCount > 0 ? 'text-primary' : ''}`} />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground text-xs flex items-center justify-center animate-pulse">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h3 className="font-semibold">Notifications</h3>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" onClick={markAllAsRead}>
              Mark all read
            </Button>
          )}
        </div>
        <ScrollArea className="h-80">
          {notifications.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground">
              No notifications
            </div>
          ) : (
            <div className="divide-y divide-border">
              {notifications.map((notif) => (
                <div
                  key={notif.id}
                  className={`p-4 cursor-pointer hover:bg-muted/50 transition-colors ${
                    isUnread(notif) ? 'bg-primary/5' : ''
                  }`}
                  onClick={() => markAsRead(notif)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="font-medium text-sm">{notif.title}</h4>
                    {isUnread(notif) && (
                      <span className="h-2 w-2 rounded-full bg-primary flex-shrink-0 mt-1.5" />
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{notif.message}</p>
                  <p className="text-xs text-muted-foreground mt-2">
                    {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true })}
                  </p>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};
