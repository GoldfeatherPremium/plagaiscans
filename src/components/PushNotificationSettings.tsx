import React, { useEffect, useState } from 'react';
import { Bell, BellOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';

export const PushNotificationSettings: React.FC = () => {
  const { 
    isSupported, 
    isSubscribed, 
    isLoading, 
    permission,
    isSafariPWA,
    subscribe, 
    unsubscribe,
    sendLocalNotification,
  } = usePushNotifications();

  // Check if user is on iOS Safari but not in PWA mode
  const isIOSSafariBrowser = React.useMemo(() => {
    if (typeof window === 'undefined') return false;
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                         (window.navigator as any).standalone === true;
    return isIOS && isSafari && !isStandalone;
  }, []);

  const handleToggle = async () => {
    if (isSubscribed) {
      const success = await unsubscribe();
      if (success) {
        toast.success('Push notifications disabled');
      } else {
        toast.error('Failed to disable push notifications');
      }
    } else {
      const success = await subscribe();
      if (success) {
        toast.success('Push notifications enabled!');
        // Send a test notification
        setTimeout(() => {
          sendLocalNotification('Notifications Enabled! 🎉', {
            body: 'You will now receive push notifications for important updates.',
          });
        }, 1000);
      } else {
        if (permission === 'denied') {
          toast.error('Notifications are blocked. Please enable them in your browser settings.');
        } else {
          toast.error('Failed to enable push notifications');
        }
      }
    }
  };

  const handleTestNotification = () => {
    sendLocalNotification('Test Notification 🔔', {
      body: 'This is a test notification from PlagaiScans!',
    });
  };

  // iOS Safari requires PWA installation
  if (isIOSSafariBrowser) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Push Notifications
          </CardTitle>
          <CardDescription>
            Install this app to enable push notifications on iOS.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              To receive push notifications on iPhone/iPad:
            </p>
            <ol className="text-sm text-muted-foreground list-decimal list-inside space-y-1">
              <li>Tap the <strong>Share</strong> button in Safari</li>
              <li>Scroll down and tap <strong>"Add to Home Screen"</strong></li>
              <li>Open the app from your home screen</li>
              <li>Enable notifications in the app settings</li>
            </ol>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!isSupported) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BellOff className="h-5 w-5" />
            Push Notifications
          </CardTitle>
          <CardDescription>
            Push notifications are not supported in this browser.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Push Notifications
        </CardTitle>
        <CardDescription>
          Receive notifications even when the app is closed.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="push-toggle">Enable Push Notifications</Label>
            <p className="text-sm text-muted-foreground">
              Get notified when your documents are ready
            </p>
          </div>
          <div className="flex items-center gap-2">
            {permission === 'denied' && (
              <Badge variant="destructive">Blocked</Badge>
            )}
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Switch
                id="push-toggle"
                checked={isSubscribed}
                onCheckedChange={handleToggle}
                disabled={permission === 'denied'}
              />
            )}
          </div>
        </div>

        {isSubscribed && (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleTestNotification}
            className="w-full"
          >
            Send Test Notification
          </Button>
        )}

        {permission === 'denied' && (
          <p className="text-sm text-destructive">
            Notifications are blocked. Please enable them in your browser settings and refresh the page.
          </p>
        )}
      </CardContent>
    </Card>
  );
};
