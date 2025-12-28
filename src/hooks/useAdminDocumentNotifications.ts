import { useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { usePushNotifications } from './usePushNotifications';
import { useNotificationSound } from './useNotificationSound';
import { toast } from 'sonner';

export const useAdminDocumentNotifications = () => {
  const { user, role } = useAuth();
  const { sendLocalNotification, requestPermission } = usePushNotifications();
  const { playSound } = useNotificationSound();
  const hasRequestedPermission = useRef(false);
  const isAdminOrStaff = role === 'admin' || role === 'staff';

  // Request permission on first use for admin/staff
  useEffect(() => {
    if (user && isAdminOrStaff && !hasRequestedPermission.current) {
      hasRequestedPermission.current = true;
      requestPermission();
    }
  }, [user, isAdminOrStaff, requestPermission]);

  const handleNewDocument = useCallback((fileName: string, customerName: string) => {
    // Play notification sound
    playSound();

    // Show toast notification
    toast.info('📄 New Document Uploaded', {
      description: `${customerName} uploaded "${fileName}"`,
      duration: 8000,
      action: {
        label: 'View Queue',
        onClick: () => {
          window.location.href = '/document-queue';
        },
      },
    });

    // Send browser local notification
    sendLocalNotification('📄 New Document Uploaded', {
      body: `${customerName} uploaded "${fileName}"`,
      tag: `doc-upload-${Date.now()}`,
      requireInteraction: false,
    });
  }, [sendLocalNotification, playSound]);

  const handleDocumentPending = useCallback((fileName: string) => {
    // Play notification sound
    playSound();

    // Show toast notification
    toast.warning('⏳ Document Pending', {
      description: `"${fileName}" is waiting to be processed`,
      duration: 5000,
    });
  }, [playSound]);

  useEffect(() => {
    if (!user || !isAdminOrStaff) return;

    // Subscribe to new document uploads (INSERT events)
    const insertChannel = supabase
      .channel('admin-document-inserts')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'documents',
        },
        async (payload) => {
          const newDoc = payload.new;
          const fileName = newDoc?.file_name;
          const userId = newDoc?.user_id;
          
          if (fileName && userId) {
            // Get customer name from profiles
            const { data: profile } = await supabase
              .from('profiles')
              .select('full_name, email')
              .eq('id', userId)
              .maybeSingle();
            
            const customerName = profile?.full_name || profile?.email || 'Customer';
            handleNewDocument(fileName, customerName);
          } else if (fileName) {
            // Magic link upload (no user_id)
            handleNewDocument(fileName, 'Guest');
          }
        }
      )
      .subscribe();

    // Subscribe to document status changes to pending
    const updateChannel = supabase
      .channel('admin-document-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'documents',
        },
        (payload) => {
          const oldStatus = payload.old?.status;
          const newStatus = payload.new?.status;
          const fileName = payload.new?.file_name;

          // Notify when document becomes pending (e.g., after being released)
          if (newStatus === 'pending' && oldStatus !== 'pending' && fileName) {
            handleDocumentPending(fileName);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(insertChannel);
      supabase.removeChannel(updateChannel);
    };
  }, [user, isAdminOrStaff, handleNewDocument, handleDocumentPending]);

  return {
    isAdminOrStaff,
    requestPermission,
  };
};