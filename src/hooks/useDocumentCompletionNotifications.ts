import { useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { usePushNotifications } from './usePushNotifications';
import { useNotificationSound } from './useNotificationSound';
import { toast } from 'sonner';

export const useDocumentCompletionNotifications = () => {
  const { user } = useAuth();
  const { sendLocalNotification, requestPermission } = usePushNotifications();
  const { playSound, settings: soundSettings } = useNotificationSound();
  const hasRequestedPermission = useRef(false);

  // Request permission on first use
  useEffect(() => {
    if (user && !hasRequestedPermission.current) {
      hasRequestedPermission.current = true;
      requestPermission();
    }
  }, [user, requestPermission]);

  const handleDocumentCompleted = useCallback((fileName: string) => {
    // Play notification sound
    playSound();

    // Show toast notification
    toast.success('Document Completed', {
      description: `Your document "${fileName}" has been processed and is ready for download.`,
      duration: 8000,
    });

    // Send browser local notification
    sendLocalNotification('Document Completed! 📄', {
      body: `Your document "${fileName}" has been processed and is ready for download.`,
      tag: `doc-complete-${Date.now()}`,
      requireInteraction: true,
    });
  }, [sendLocalNotification, playSound]);

  useEffect(() => {
    if (!user) return;

    // Subscribe to document status changes for this user
    const channel = supabase
      .channel('document-completion-notifications')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'documents',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const oldStatus = payload.old?.status;
          const newStatus = payload.new?.status;
          const fileName = payload.new?.file_name;

          // Only notify when status changes TO 'completed'
          if (newStatus === 'completed' && oldStatus !== 'completed' && fileName) {
            handleDocumentCompleted(fileName);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, handleDocumentCompleted]);

  return {
    requestPermission,
    soundSettings,
  };
};
