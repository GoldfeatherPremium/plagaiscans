import React, { useState, useEffect } from 'react';
import { Bell, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { toast } from 'sonner';

export const PushNotificationBanner: React.FC = () => {
  const [dismissed, setDismissed] = useState(false);
  const { 
    isSupported, 
    isSubscribed, 
    isLoading, 
    permission,
    subscribe, 
    sendLocalNotification,
  } = usePushNotifications();

  // Check if user dismissed the banner in this session
  useEffect(() => {
    const wasDismissed = sessionStorage.getItem('push-banner-dismissed');
    if (wasDismissed) {
      setDismissed(true);
    }
  }, []);

  // Check if on iOS Safari without PWA (requires installation first)
  const isIOSSafariBrowser = React.useMemo(() => {
    if (typeof window === 'undefined') return false;
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                         (window.navigator as any).standalone === true;
    return isIOS && isSafari && !isStandalone;
  }, []);

  const handleEnable = async () => {
    const success = await subscribe();
    if (success) {
      toast.success('Push notifications enabled!');
      setTimeout(() => {
        sendLocalNotification('Notifications Enabled! 🎉', {
          body: 'You will now be notified when your documents are ready.',
        });
      }, 1000);
      setDismissed(true);
    } else {
      if (permission === 'denied') {
        toast.error('Notifications are blocked. Please enable them in your browser settings.');
      } else {
        toast.error('Failed to enable push notifications');
      }
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    sessionStorage.setItem('push-banner-dismissed', 'true');
  };

  // Don't show if not supported, already subscribed, dismissed, or permission denied
  if (!isSupported || isSubscribed || dismissed || permission === 'denied') {
    return null;
  }

  // Show iOS installation instructions instead
  if (isIOSSafariBrowser) {
    return (
      <Card className="border-primary/30 bg-primary/5 mb-6">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Bell className="h-5 w-5 text-primary" />
              </div>
              <div className="space-y-1">
                <p className="font-medium">Get notified when your documents are ready</p>
                <p className="text-sm text-muted-foreground">
                  Install this app to enable push notifications on iPhone/iPad. Tap <strong>Share</strong> → <strong>Add to Home Screen</strong>.
                </p>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={handleDismiss} className="flex-shrink-0">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary/30 bg-primary/5 mb-6">
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Bell className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-medium">Get notified when your documents are ready</p>
              <p className="text-sm text-muted-foreground">
                Enable push notifications to receive instant updates.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={handleDismiss}>
              Not now
            </Button>
            <Button size="sm" onClick={handleEnable} disabled={isLoading}>
              {isLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Bell className="h-4 w-4 mr-2" />
              )}
              Enable Notifications
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
