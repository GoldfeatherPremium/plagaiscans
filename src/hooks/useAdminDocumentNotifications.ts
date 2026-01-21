import { useEffect, useCallback, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { usePushNotifications } from './usePushNotifications';
import { useNotificationSound } from './useNotificationSound';
import { toast } from 'sonner';
import { RealtimeChannel } from '@supabase/supabase-js';

export const useAdminDocumentNotifications = () => {
  const { user, role } = useAuth();
  const { sendLocalNotification, requestPermission } = usePushNotifications();
  const { playSound } = useNotificationSound();
  const hasRequestedPermission = useRef(false);
  const isAdminOrStaff = role === 'admin' || role === 'staff';
  const insertChannelRef = useRef<RealtimeChannel | null>(null);
  const updateChannelRef = useRef<RealtimeChannel | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Track staff's assigned scan types for filtering notifications
  const [assignedScanTypes, setAssignedScanTypes] = useState<string[]>(['full', 'similarity_only']);
  
  // Fetch staff scan type assignments
  useEffect(() => {
    const fetchScanTypes = async () => {
      // Admins get all notifications
      if (role === 'admin') {
        setAssignedScanTypes(['full', 'similarity_only']);
        return;
      }
      
      // Staff get filtered notifications based on assigned scan types
      if (role === 'staff' && user) {
        const { data, error } = await supabase
          .from('staff_settings')
          .select('assigned_scan_types')
          .eq('user_id', user.id)
          .single();

        if (!error && data?.assigned_scan_types) {
          setAssignedScanTypes(data.assigned_scan_types);
        } else {
          // Default to both if no settings exist
          setAssignedScanTypes(['full', 'similarity_only']);
        }
      }
    };

    if (role) {
      fetchScanTypes();
    }
  }, [user, role]);

  // Request permission on first use for admin/staff
  useEffect(() => {
    if (user && isAdminOrStaff && !hasRequestedPermission.current) {
      hasRequestedPermission.current = true;
      requestPermission();
    }
  }, [user, isAdminOrStaff, requestPermission]);

  const handleNewDocument = useCallback((fileName: string, customerName: string, scanType: string = 'full') => {
    console.log('[AdminNotify] New document notification:', fileName, customerName, scanType);
    
    // Determine correct queue URL and title based on scan type
    const isSimilarityOnly = scanType === 'similarity_only';
    const queueUrl = isSimilarityOnly 
      ? '/dashboard/queue-similarity' 
      : '/dashboard/queue';
    
    // Queue-specific notification title
    const notificationTitle = isSimilarityOnly 
      ? '📊 New Doc in Similarity Queue' 
      : '📄 New Doc in Full Scan Queue';
    
    // Play notification sound
    playSound();

    // Show toast notification
    toast.info(notificationTitle, {
      description: `${customerName} uploaded "${fileName}"`,
      duration: 8000,
      action: {
        label: 'View Queue',
        onClick: () => {
          window.location.href = queueUrl;
        },
      },
    });

    // Send browser local notification
    sendLocalNotification(notificationTitle, {
      body: `${customerName} uploaded "${fileName}"`,
      tag: `doc-upload-${Date.now()}`,
      requireInteraction: true,
    });
  }, [sendLocalNotification, playSound]);

  const handleDocumentPending = useCallback((fileName: string) => {
    console.log('[AdminNotify] Document pending notification:', fileName);
    
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

    const setupChannels = () => {
      // Clean up existing channels first
      if (insertChannelRef.current) {
        supabase.removeChannel(insertChannelRef.current);
      }
      if (updateChannelRef.current) {
        supabase.removeChannel(updateChannelRef.current);
      }

      console.log('[AdminNotify] Setting up realtime channels...');

      // Subscribe to new document uploads (INSERT events)
      const insertChannel = supabase
        .channel('admin-document-inserts', {
          config: {
            broadcast: { self: true },
            presence: { key: user.id },
          },
        })
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'documents',
          },
          async (payload) => {
            console.log('[AdminNotify] INSERT event received:', payload);
            const newDoc = payload.new;
            const fileName = newDoc?.file_name;
            const userId = newDoc?.user_id;
            const scanType = newDoc?.scan_type || 'full';
            
            // Filter notifications based on assigned scan types for staff
            // 'full' scan type should be included if staff has 'full' access
            // 'similarity_only' scan type should be included if staff has 'similarity_only' access
            const shouldNotify = role === 'admin' || 
              (scanType === 'similarity_only' && assignedScanTypes.includes('similarity_only')) ||
              (scanType !== 'similarity_only' && assignedScanTypes.includes('full'));
            
            if (!shouldNotify) {
              console.log('[AdminNotify] Skipping notification - scan type not in assigned types:', { scanType, assignedScanTypes });
              return;
            }
            
            if (fileName && userId) {
              // Get customer name from profiles
              const { data: profile } = await supabase
                .from('profiles')
                .select('full_name, email')
                .eq('id', userId)
                .maybeSingle();
              
              const customerName = profile?.full_name || profile?.email || 'Customer';
              handleNewDocument(fileName, customerName, scanType);
            } else if (fileName) {
              // Magic link upload (no user_id)
              handleNewDocument(fileName, 'Guest', scanType);
            }
          }
        )
        .subscribe((status, err) => {
          console.log('[AdminNotify] Insert channel status:', status, err || '');
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            console.error('[AdminNotify] Insert channel error, will retry...');
            // Schedule reconnection
            if (reconnectTimeoutRef.current) {
              clearTimeout(reconnectTimeoutRef.current);
            }
            reconnectTimeoutRef.current = setTimeout(() => {
              console.log('[AdminNotify] Attempting to reconnect...');
              setupChannels();
            }, 5000);
          }
        });

      insertChannelRef.current = insertChannel;

      // Subscribe to document status changes to pending
      const updateChannel = supabase
        .channel('admin-document-updates', {
          config: {
            broadcast: { self: true },
            presence: { key: user.id },
          },
        })
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'documents',
          },
          (payload) => {
            console.log('[AdminNotify] UPDATE event received:', payload);
            const oldStatus = payload.old?.status;
            const newStatus = payload.new?.status;
            const fileName = payload.new?.file_name;

            // Notify when document becomes pending (e.g., after being released)
            if (newStatus === 'pending' && oldStatus !== 'pending' && fileName) {
              handleDocumentPending(fileName);
            }
          }
        )
        .subscribe((status, err) => {
          console.log('[AdminNotify] Update channel status:', status, err || '');
        });

      updateChannelRef.current = updateChannel;
    };

    setupChannels();

    // Handle visibility change - reconnect when tab becomes visible
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('[AdminNotify] Tab became visible, checking channels...');
        // Give it a moment then check if we need to reconnect
        setTimeout(() => {
          const insertState = insertChannelRef.current?.state;
          const updateState = updateChannelRef.current?.state;
          console.log('[AdminNotify] Channel states:', { insertState, updateState });
          
          if (insertState !== 'joined' || updateState !== 'joined') {
            console.log('[AdminNotify] Channels not joined, reconnecting...');
            setupChannels();
          }
        }, 1000);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (insertChannelRef.current) {
        supabase.removeChannel(insertChannelRef.current);
      }
      if (updateChannelRef.current) {
        supabase.removeChannel(updateChannelRef.current);
      }
    };
  }, [user, isAdminOrStaff, handleNewDocument, handleDocumentPending, role, assignedScanTypes]);

  return {
    isAdminOrStaff,
    requestPermission,
  };
};