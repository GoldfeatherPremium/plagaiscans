import { useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { usePushNotifications } from './usePushNotifications';
import { supabase } from '@/integrations/supabase/client';

/**
 * Hook to monitor and maintain push subscription health.
 * On each check, compares the browser's current push endpoint with what's
 * stored in the DB for this user. If they differ, cleans stale entries and
 * upserts the current one. Also re-subscribes if subscription is lost.
 */
export const usePushSubscriptionHealth = () => {
  const { user } = useAuth();
  const { isSubscribed, subscribe, isSupported } = usePushNotifications();
  const lastCheckRef = useRef<number>(0);
  const isCheckingRef = useRef(false);

  const checkSubscriptionHealth = useCallback(async () => {
    if (isCheckingRef.current) return;
    if (!isSupported || !user) return;

    // Rate limit checks to every 5 minutes
    const now = Date.now();
    if (now - lastCheckRef.current < 5 * 60 * 1000) return;

    isCheckingRef.current = true;
    lastCheckRef.current = now;

    try {
      const registration = await navigator.serviceWorker.ready;
      const currentSubscription = await registration.pushManager.getSubscription();

      if (!currentSubscription) {
        console.log('[PushHealth] No active subscription found');
        if (isSubscribed) {
          console.log('[PushHealth] Re-subscribing...');
          await subscribe();
        }
        return;
      }

      const currentEndpoint = currentSubscription.endpoint;

      // Check if DB has this exact endpoint for the user
      const { data: dbSubs } = await supabase
        .from('push_subscriptions')
        .select('id, endpoint')
        .eq('user_id', user.id);

      if (!dbSubs || dbSubs.length === 0) {
        // No DB record — re-subscribe to create one
        console.log('[PushHealth] No DB subscription, re-subscribing...');
        await subscribe();
        return;
      }

      const matching = dbSubs.find(s => s.endpoint === currentEndpoint);
      const stale = dbSubs.filter(s => s.endpoint !== currentEndpoint);

      // Remove stale entries
      if (stale.length > 0) {
        console.log(`[PushHealth] Removing ${stale.length} stale subscription(s)`);
        await supabase
          .from('push_subscriptions')
          .delete()
          .in('id', stale.map(s => s.id));
      }

      // If current endpoint isn't in DB, re-subscribe
      if (!matching) {
        console.log('[PushHealth] Current endpoint not in DB, re-subscribing...');
        await subscribe();
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

    const initialTimer = setTimeout(() => {
      checkSubscriptionHealth();
    }, 5000);

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
        setTimeout(() => checkSubscriptionHealth(), 2000);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [user, isSupported, checkSubscriptionHealth]);

  // Check when coming back online
  useEffect(() => {
    if (!user || !isSupported) return;

    const handleOnline = () => {
      console.log('[PushHealth] Back online, checking subscription...');
      setTimeout(() => checkSubscriptionHealth(), 3000);
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [user, isSupported, checkSubscriptionHealth]);

  return { checkSubscriptionHealth };
};
