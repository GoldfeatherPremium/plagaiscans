import { useState, useEffect, useCallback } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
  }
}

export const usePWAInstall = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if already installed via display mode
    const checkInstalled = () => {
      // Check standalone mode
      if (window.matchMedia('(display-mode: standalone)').matches) {
        setIsInstalled(true);
        return true;
      }
      // Check fullscreen mode (some PWAs use this)
      if (window.matchMedia('(display-mode: fullscreen)').matches) {
        setIsInstalled(true);
        return true;
      }
      // iOS Safari standalone check
      if ((navigator as any).standalone === true) {
        setIsInstalled(true);
        return true;
      }
      // Check if launched from TWA (Trusted Web Activity)
      if (document.referrer.includes('android-app://')) {
        setIsInstalled(true);
        return true;
      }
      return false;
    };

    if (checkInstalled()) return;

    // Listen for display mode changes
    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    const handleDisplayModeChange = (e: MediaQueryListEvent) => {
      if (e.matches) {
        setIsInstalled(true);
        setIsInstallable(false);
        setDeferredPrompt(null);
      }
    };
    mediaQuery.addEventListener('change', handleDisplayModeChange);

    const handleBeforeInstallPrompt = (e: BeforeInstallPromptEvent) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Store the event for later use
      setDeferredPrompt(e);
      setIsInstallable(true);
      console.log('[PWA] Install prompt captured and ready');
    };

    const handleAppInstalled = () => {
      console.log('[PWA] App was installed');
      setIsInstalled(true);
      setIsInstallable(false);
      setDeferredPrompt(null);
      // Clear visit count on successful install
      localStorage.removeItem('pwa-visit-count');
      localStorage.setItem('pwa-smart-popup-dismissed', 'permanent');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      mediaQuery.removeEventListener('change', handleDisplayModeChange);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) {
      console.log('[PWA] No deferred prompt available');
      return false;
    }

    try {
      console.log('[PWA] Triggering install prompt');
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      
      console.log('[PWA] User choice:', outcome);
      
      if (outcome === 'accepted') {
        setIsInstalled(true);
        setIsInstallable(false);
      }
      
      // Clear the deferred prompt - it can only be used once
      setDeferredPrompt(null);
      return outcome === 'accepted';
    } catch (error) {
      console.error('[PWA] Error prompting install:', error);
      return false;
    }
  }, [deferredPrompt]);

  const isIOS = useCallback(() => {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
  }, []);

  const isAndroid = useCallback(() => {
    return /Android/.test(navigator.userAgent);
  }, []);

  const isMobile = useCallback(() => {
    return isIOS() || isAndroid();
  }, [isIOS, isAndroid]);

  return {
    isInstallable,
    isInstalled,
    promptInstall,
    isIOS: isIOS(),
    isAndroid: isAndroid(),
    isMobile: isMobile(),
    canPrompt: !!deferredPrompt,
  };
};
