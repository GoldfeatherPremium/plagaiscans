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

// Check if browser supports push notifications (Safari requires specific checks)
const checkPushSupport = (): boolean => {
  if (typeof window === 'undefined') return false;
  
  // Basic checks
  if (!('serviceWorker' in navigator)) return false;
  if (!('PushManager' in window)) return false;
  if (!('Notification' in window)) return false;
  
  // Safari on iOS 16.4+ supports web push, but needs to be installed as PWA
  const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  
  if (isIOS && isSafari) {
    // Check if running as standalone PWA (required for iOS push)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                         (window.navigator as any).standalone === true;
    if (!isStandalone) {
      console.log('iOS Safari requires PWA installation for push notifications');
      return false;
    }
  }
  
  return true;
};

export const usePushNotifications = () => {
  const { user } = useAuth();
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [vapidPublicKey, setVapidPublicKey] = useState<string | null>(null);
  const [isSafariPWA, setIsSafariPWA] = useState(false);

  const isSupported = checkPushSupport();
  const permission = typeof window !== 'undefined' && 'Notification' in window 
    ? Notification.permission 
    : 'denied';

  // Detect Safari PWA mode
  useEffect(() => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                         (window.navigator as any).standalone === true;
    setIsSafariPWA(isIOS && isSafari && isStandalone);
  }, []);

  // Fetch VAPID public key - prefer settings, fallback to backend (fixes empty settings on Android/Chrome)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      const fetchVapidKey = async () => {
        try {
          const { data } = await supabase
            .from('settings')
            .select('value')
            .eq('key', 'vapid_public_key')
            .maybeSingle();

          const fromSettings = data?.value?.trim();
          if (fromSettings) {
            setVapidPublicKey(fromSettings);
            console.log('VAPID public key loaded (settings)');
            return;
          }

          console.log('VAPID key missing in settings; fetching from backend...');
          const { data: fnData, error: fnError } = await supabase.functions.invoke('get-vapid-public-key');
          if (fnError) throw fnError;

          const fromBackend = (fnData?.vapidPublicKey as string | undefined)?.trim();
          if (fromBackend) {
            setVapidPublicKey(fromBackend);
            console.log('VAPID public key loaded (backend)');
          }
        } catch (e) {
          console.log('Failed to load VAPID public key:', e);
        }
      };

      void fetchVapidKey();
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

      // Wait for service worker to be ready (important for Safari)
      const reg = await navigator.serviceWorker.ready;
      console.log('Service worker ready for subscription');
      
      // Ensure SW is active (Safari requirement)
      if (reg.active?.state !== 'activated') {
        await new Promise<void>((resolve) => {
          if (reg.active?.state === 'activated') {
            resolve();
            return;
          }
          const sw = reg.installing || reg.waiting || reg.active;
          if (sw) {
            sw.addEventListener('statechange', function handler() {
              if (sw.state === 'activated') {
                sw.removeEventListener('statechange', handler);
                resolve();
              }
            });
          } else {
            resolve();
          }
        });
      }

      // Subscribe to push manager with Safari-compatible options
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
  // Chrome Android requires ServiceWorker.showNotification; new Notification() is blocked.
  const sendLocalNotification = useCallback(async (title: string, options?: NotificationOptions) => {
    if (!isSupported || Notification.permission !== 'granted') {
      console.log('Cannot send local notification: not supported or permission not granted');
      return;
    }

    try {
      // Try ServiceWorker first (required for Chrome Android)
      const reg = await navigator.serviceWorker.ready;
      await reg.showNotification(title, {
        icon: '/pwa-icon-192.png',
        badge: '/pwa-icon-192.png',
        requireInteraction: false,
        ...options,
      } as NotificationOptions);
      console.log('Local notification sent via ServiceWorker');
    } catch (swError) {
      console.log('ServiceWorker notification failed, falling back to Notification API:', swError);
      // Fallback to Notification API (works on desktop)
      try {
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
      } catch (notifError) {
        console.error('Both notification methods failed:', notifError);
      }
    }
  }, [isSupported]);

  return {
    isSupported,
    isSubscribed,
    isLoading,
    permission,
    subscription,
    isSafariPWA,
    requestPermission,
    subscribe,
    unsubscribe,
    sendLocalNotification,
  };
};
