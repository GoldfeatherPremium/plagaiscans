import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Bell, Volume2, VolumeX } from 'lucide-react';
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
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { toast } from 'sonner';

interface Notification {
  id: string;
  title: string;
  message: string;
  created_at: string;
  is_read?: boolean;
  type: 'broadcast' | 'personal';
}

// Better notification sound - a pleasant chime
const NOTIFICATION_SOUND_BASE64 = 'data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAABhgC7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7//////////////////////////////////////////////////////////////////8AAAAATGF2YzU4LjEzAAAAAAAAAAAAAAAAJAAAAAAAAAAAAYZNYXz2AAAAAAAAAAAAAAAAAAAAAAD/+9DEAAAGtAFptAAAJTITq/c0wAkAAAANIAAAAAEJGJEIhCEIf/LEIQhCEIT//+UIT/KE85znOc5znOc5znOc+c5znOc5znOc5znOc5znOc5znOc5z3EhYWFhYWFhYWFhYX//uxCEIQhCEIQh/5QhCEIQhD/ygAAADSAMYxjGMYxjGHVdV1XVQAAAAD/+9DEDYPQAAGkAAAAIAAANIAAAAT/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////';

export const NotificationBell: React.FC = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState(false);
  const [isRinging, setIsRinging] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('notificationSound') !== 'disabled';
    }
    return true;
  });
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { sendPushNotification, requestPermission } = usePushNotifications();

  // Initialize audio element
  useEffect(() => {
    audioRef.current = new Audio(NOTIFICATION_SOUND_BASE64);
    audioRef.current.volume = 0.5;
    
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  // Toggle sound
  const toggleSound = () => {
    const newState = !soundEnabled;
    setSoundEnabled(newState);
    localStorage.setItem('notificationSound', newState ? 'enabled' : 'disabled');
    
    if (newState) {
      requestPermission();
      toast.success('Notification sound enabled');
    } else {
      toast.info('Notification sound disabled');
    }
  };

  // Play notification sound
  const playNotificationSound = useCallback(() => {
    if (!soundEnabled) return;
    
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch((err) => {
        console.log('Could not play notification sound:', err);
      });
    }
  }, [soundEnabled]);

  // Trigger bell animation
  const triggerBellRing = useCallback(() => {
    setIsRinging(true);
    playNotificationSound();
    setTimeout(() => setIsRinging(false), 500);
  }, [playNotificationSound]);

  useEffect(() => {
    if (!user) return;

    const fetchNotifications = async () => {
      // First, get user's profile to find their signup date
      const { data: profile } = await supabase
        .from('profiles')
        .select('created_at')
        .eq('id', user.id)
        .single();

      const userCreatedAt = profile?.created_at || user.created_at || new Date().toISOString();

      // Fetch broadcast notifications created AFTER user signed up
      const { data: broadcasts } = await supabase
        .from('notifications')
        .select('*')
        .eq('is_active', true)
        .gte('created_at', userCreatedAt)
        .order('created_at', { ascending: false });

      // Fetch personal notifications for this user (these are already user-specific)
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
          const newNotif = payload.new as Notification;
          setNotifications(prev => [{ ...newNotif, type: 'broadcast' }, ...prev]);
          triggerBellRing();
          
          // Show toast notification
          toast.info(newNotif.title, {
            description: newNotif.message,
            duration: 5000,
          });
          
          // Send browser push notification
          sendPushNotification(newNotif.title, {
            body: newNotif.message,
            tag: newNotif.id,
          });
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
          const newNotif = payload.new as Notification;
          setNotifications(prev => [{ ...newNotif, type: 'personal' }, ...prev]);
          triggerBellRing();
          
          // Show toast notification
          toast.info(newNotif.title, {
            description: newNotif.message,
            duration: 5000,
          });
          
          // Send browser push notification
          sendPushNotification(newNotif.title, {
            body: newNotif.message,
            tag: newNotif.id,
          });
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
          className="relative rounded-full hover:bg-muted"
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
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={toggleSound}
              title={soundEnabled ? 'Disable sound' : 'Enable sound'}
            >
              {soundEnabled ? (
                <Volume2 className="h-4 w-4 text-primary" />
              ) : (
                <VolumeX className="h-4 w-4 text-muted-foreground" />
              )}
            </Button>
            {unreadCount > 0 && (
              <Button variant="ghost" size="sm" onClick={markAllAsRead}>
                Mark all read
              </Button>
            )}
          </div>
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
