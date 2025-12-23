import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export const usePushNotifications = () => {
  const { user } = useAuth();
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [vapidPublicKey, setVapidPublicKey] = useState<string | null>(null);

  const isSupported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  const permission = typeof window !== 'undefined' && 'Notification' in window 
    ? Notification.permission 
    : 'denied';

  // Fetch VAPID public key from settings - deferred to not block initial render
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      const fetchVapidKey = async () => {
        const { data } = await supabase
          .from('settings')
          .select('value')
          .eq('key', 'vapid_public_key')
          .maybeSingle();
        
        if (data?.value) {
          setVapidPublicKey(data.value.trim());
          console.log('VAPID public key loaded');
        }
      };
      fetchVapidKey();
    }, 200);
    
    return () => clearTimeout(timeoutId);
  }, []);

  // Register service worker
  useEffect(() => {
    if (!isSupported) {
      console.log('Push notifications not supported');
      return;
    }

    const registerServiceWorker = async () => {
      try {
        // Prefer an existing registration (VitePWA auto-registers). This avoids double-registering.
        let reg = await navigator.serviceWorker.getRegistration('/');

        if (!reg) {
          reg = await navigator.serviceWorker.register('/sw.js', {
            scope: '/',
            // Ensure the browser doesn't serve a cached SW script (critical on Android)
            updateViaCache: 'none',
          });
        }

        // Force an update check ASAP (replaces old buggy SW)
        try {
          await reg.update();
        } catch (e) {
          console.log('Service worker update check failed (non-fatal):', e);
        }

        console.log('Service worker ready:', reg);
        setRegistration(reg);

        // Check if already subscribed
        const existingSub = await reg.pushManager.getSubscription();
        if (existingSub) {
          console.log('Existing subscription found:', existingSub);
          setSubscription(existingSub);
          setIsSubscribed(true);
        }
      } catch (error) {
        console.error('Service worker registration failed:', error);
      }
    };

    registerServiceWorker();
  }, [isSupported]);

  // Request notification permission
  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!isSupported) {
      console.log('This browser does not support push notifications');
      return false;
    }

    if (Notification.permission === 'granted') {
      return true;
    }

    if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }

    return false;
  }, [isSupported]);

  // Subscribe to push notifications
  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!isSupported || !registration || !user) {
      console.log('Cannot subscribe: missing requirements', { isSupported, registration: !!registration, user: !!user });
      return false;
    }

    if (!vapidPublicKey) {
      console.error('VAPID_PUBLIC_KEY not configured - please add it to settings table with key "vapid_public_key"');
      return false;
    }

    setIsLoading(true);
    try {
      // Request permission first
      const permissionGranted = await requestPermission();
      if (!permissionGranted) {
        console.log('Permission not granted');
        return false;
      }

      // Wait for service worker to be ready
      const reg = await navigator.serviceWorker.ready;
      console.log('Service worker ready');

      // Subscribe to push manager
      const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);
      const pushSubscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey as BufferSource,
      });

      console.log('Push subscription created:', pushSubscription);

      // Extract subscription data
      const subscriptionJson = pushSubscription.toJSON();
      const endpoint = pushSubscription.endpoint;
      const p256dh = subscriptionJson.keys?.p256dh || '';
      const auth = subscriptionJson.keys?.auth || '';

      // Check if subscription already exists for this user
      const { data: existing } = await supabase
        .from('push_subscriptions')
        .select('id')
        .eq('user_id', user.id)
        .eq('endpoint', endpoint)
        .maybeSingle();

      if (existing) {
        // Update existing subscription
        const { error: updateError } = await supabase
          .from('push_subscriptions')
          .update({
            p256dh,
            auth,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id);

        if (updateError) throw updateError;
        console.log('Subscription updated in database');
      } else {
        // Insert new subscription
        const { error: insertError } = await supabase
          .from('push_subscriptions')
          .insert({
            user_id: user.id,
            endpoint,
            p256dh,
            auth,
          });

        if (insertError) throw insertError;
        console.log('Subscription saved to database');
      }

      setSubscription(pushSubscription);
      setIsSubscribed(true);
      return true;
    } catch (error) {
      console.error('Failed to subscribe to push notifications:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [isSupported, registration, user, requestPermission, vapidPublicKey]);

  // Unsubscribe from push notifications
  const unsubscribe = useCallback(async (): Promise<boolean> => {
    if (!subscription || !user) return false;

    setIsLoading(true);
    try {
      // Unsubscribe from push manager
      await subscription.unsubscribe();
      console.log('Unsubscribed from push manager');

      // Remove from database
      const { error } = await supabase
        .from('push_subscriptions')
        .delete()
        .eq('user_id', user.id)
        .eq('endpoint', subscription.endpoint);

      if (error) throw error;
      console.log('Subscription removed from database');

      setSubscription(null);
      setIsSubscribed(false);
      return true;
    } catch (error) {
      console.error('Failed to unsubscribe:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [subscription, user]);

  // Send a local notification (for testing or when app is open)
  const sendLocalNotification = useCallback((title: string, options?: NotificationOptions) => {
    if (!isSupported || Notification.permission !== 'granted') {
      console.log('Cannot send local notification');
      return;
    }

    const notification = new Notification(title, {
      icon: '/pwa-icon-192.png',
      badge: '/pwa-icon-192.png',
      requireInteraction: false,
      ...options,
    });

    notification.onclick = () => {
      window.focus();
      notification.close();
    };

    setTimeout(() => notification.close(), 5000);
  }, [isSupported]);

  return {
    isSupported,
    isSubscribed,
    isLoading,
    permission,
    subscription,
    requestPermission,
    subscribe,
    unsubscribe,
    sendLocalNotification,
  };
};
