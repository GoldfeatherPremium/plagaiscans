import { useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { usePushNotifications } from './usePushNotifications';

/**
 * Hook to monitor and maintain push subscription health
 * Automatically re-subscribes if subscription is lost
 */
export const usePushSubscriptionHealth = () => {
  const { user } = useAuth();
  const { isSubscribed, subscribe, isSupported } = usePushNotifications();
  const lastCheckRef = useRef<number>(0);
  const isCheckingRef = useRef(false);

  const checkSubscriptionHealth = useCallback(async () => {
    // Prevent concurrent checks
    if (isCheckingRef.current) return;
    
    // Skip if not supported or no user
    if (!isSupported || !user) return;

    // Rate limit checks to every 5 minutes minimum
    const now = Date.now();
    if (now - lastCheckRef.current < 5 * 60 * 1000) return;

    isCheckingRef.current = true;
    lastCheckRef.current = now;

    try {
      // Check if service worker is ready
      const registration = await navigator.serviceWorker.ready;
      
      // Get current subscription from browser
      const currentSubscription = await registration.pushManager.getSubscription();
      
      if (!currentSubscription) {
        console.log('[PushHealth] No active subscription found, attempting to re-subscribe...');
        
        // Only re-subscribe if user was previously subscribed
        if (isSubscribed) {
          await subscribe();
          console.log('[PushHealth] Re-subscription successful');
        }
      } else {
        console.log('[PushHealth] Subscription is healthy');
      }
    } catch (error) {
      console.error('[PushHealth] Health check failed:', error);
    } finally {
      isCheckingRef.current = false;
    }
  }, [user, isSupported, isSubscribed, subscribe]);

  // Check on mount and periodically
  useEffect(() => {
    if (!user || !isSupported) return;

    // Initial check after a short delay
    const initialTimer = setTimeout(() => {
      checkSubscriptionHealth();
    }, 5000);

    // Periodic check every 30 minutes
    const intervalTimer = setInterval(() => {
      checkSubscriptionHealth();
    }, 30 * 60 * 1000);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(intervalTimer);
    };
  }, [user, isSupported, checkSubscriptionHealth]);

  // Check when tab becomes visible
  useEffect(() => {
    if (!user || !isSupported) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Delay check to let other operations settle
        setTimeout(() => {
          checkSubscriptionHealth();
        }, 2000);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user, isSupported, checkSubscriptionHealth]);

  // Check when coming back online
  useEffect(() => {
    if (!user || !isSupported) return;

    const handleOnline = () => {
      console.log('[PushHealth] Back online, checking subscription...');
      setTimeout(() => {
        checkSubscriptionHealth();
      }, 3000);
    };

    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('online', handleOnline);
    };
  }, [user, isSupported, checkSubscriptionHealth]);

  return {
    checkSubscriptionHealth,
  };
};
