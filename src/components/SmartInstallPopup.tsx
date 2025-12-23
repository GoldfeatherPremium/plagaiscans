import { useState, useEffect, useCallback } from 'react';
import { X, Download, Share, Plus, MoreVertical, Chrome, Globe, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePWAInstall } from '@/hooks/usePWAInstall';

interface BrowserInfo {
  name: string;
  isChrome: boolean;
  isEdge: boolean;
  isSafari: boolean;
  isFirefox: boolean;
  isSamsung: boolean;
  isOpera: boolean;
}

const detectBrowser = (): BrowserInfo => {
  const ua = navigator.userAgent;
  
  return {
    name: ua.includes('Edg') ? 'Edge' 
      : ua.includes('SamsungBrowser') ? 'Samsung Internet'
      : ua.includes('OPR') || ua.includes('Opera') ? 'Opera'
      : ua.includes('Firefox') ? 'Firefox'
      : ua.includes('Safari') && !ua.includes('Chrome') ? 'Safari'
      : ua.includes('Chrome') ? 'Chrome'
      : 'Browser',
    isChrome: ua.includes('Chrome') && !ua.includes('Edg') && !ua.includes('OPR'),
    isEdge: ua.includes('Edg'),
    isSafari: ua.includes('Safari') && !ua.includes('Chrome'),
    isFirefox: ua.includes('Firefox'),
    isSamsung: ua.includes('SamsungBrowser'),
    isOpera: ua.includes('OPR') || ua.includes('Opera'),
  };
};

export const SmartInstallPopup = () => {
  const { isInstallable, isInstalled, promptInstall, isIOS, isAndroid } = usePWAInstall();
  const [showPopup, setShowPopup] = useState(false);
  const [browser, setBrowser] = useState<BrowserInfo | null>(null);

  useEffect(() => {
    // Detect browser on mount
    setBrowser(detectBrowser());

    // Check if already installed or dismissed
    if (isInstalled) return;

    const dismissed = localStorage.getItem('pwa-smart-popup-dismissed');
    if (dismissed === 'permanent') return;

    // Check visit count
    const visitCount = parseInt(localStorage.getItem('pwa-visit-count') || '0', 10);
    const newCount = visitCount + 1;
    localStorage.setItem('pwa-visit-count', newCount.toString());

    // Show after 2 visits
    if (newCount >= 2) {
      // Add a small delay for better UX
      const timer = setTimeout(() => {
        setShowPopup(true);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [isInstalled]);

  const handleDismiss = useCallback(() => {
    setShowPopup(false);
    localStorage.setItem('pwa-smart-popup-dismissed', 'permanent');
  }, []);

  const handleInstall = useCallback(async () => {
    if (isInstallable) {
      const success = await promptInstall();
      if (success) {
        handleDismiss();
      }
    }
  }, [isInstallable, promptInstall, handleDismiss]);

  if (!showPopup || isInstalled || !browser) {
    return null;
  }

  const renderInstructions = () => {
    if (isInstallable) {
      return (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Install Plagaiscans for faster access and offline support.
          </p>
          <Button onClick={handleInstall} className="w-full gap-2">
            <Download className="w-4 h-4" />
            Install App
          </Button>
        </div>
      );
    }

    if (isIOS) {
      return (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground mb-3">
            For the best experience on iOS, add Plagaiscans to your Home Screen:
          </p>
          <ol className="text-sm space-y-2 text-muted-foreground">
            <li className="flex items-center gap-2">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-medium">1</span>
              <span className="flex items-center gap-1">
                Tap the <Share className="w-4 h-4 inline text-primary" /> Share button
              </span>
            </li>
            <li className="flex items-center gap-2">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-medium">2</span>
              <span className="flex items-center gap-1">
                Scroll and tap <Plus className="w-4 h-4 inline text-primary" /> "Add to Home Screen"
              </span>
            </li>
            <li className="flex items-center gap-2">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-medium">3</span>
              <span>Tap "Add" in the top right</span>
            </li>
          </ol>
        </div>
      );
    }

    if (isAndroid) {
      if (browser.isChrome) {
        return (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground mb-3">
              To install on Chrome Android:
            </p>
            <ol className="text-sm space-y-2 text-muted-foreground">
              <li className="flex items-center gap-2">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-medium">1</span>
                <span className="flex items-center gap-1">
                  Tap <MoreVertical className="w-4 h-4 inline text-primary" /> menu (3 dots)
                </span>
              </li>
              <li className="flex items-center gap-2">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-medium">2</span>
                <span>Tap "Install app" or "Add to Home screen"</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-medium">3</span>
                <span>Tap "Install" to confirm</span>
              </li>
            </ol>
          </div>
        );
      }

      if (browser.isSamsung) {
        return (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground mb-3">
              To install on Samsung Internet:
            </p>
            <ol className="text-sm space-y-2 text-muted-foreground">
              <li className="flex items-center gap-2">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-medium">1</span>
                <span>Tap the menu icon (3 lines)</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-medium">2</span>
                <span>Tap "Add page to" → "Home screen"</span>
              </li>
            </ol>
          </div>
        );
      }

      return (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground mb-3">
            To add to your Home Screen:
          </p>
          <ol className="text-sm space-y-2 text-muted-foreground">
            <li className="flex items-center gap-2">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-medium">1</span>
              <span>Open browser menu</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-medium">2</span>
              <span>Look for "Install app" or "Add to Home screen"</span>
            </li>
          </ol>
        </div>
      );
    }

    // Desktop browsers
    if (browser.isChrome || browser.isEdge) {
      return (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground mb-3">
            To install on {browser.name}:
          </p>
          <ol className="text-sm space-y-2 text-muted-foreground">
            <li className="flex items-center gap-2">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-medium">1</span>
              <span>Look for the install icon in the address bar</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-medium">2</span>
              <span>Click "Install" in the popup</span>
            </li>
          </ol>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          For the best experience, install this app using <strong>Chrome</strong> or <strong>Edge</strong>, 
          or use "Add to Home Screen" in your browser menu.
        </p>
      </div>
    );
  };

  const getBrowserIcon = () => {
    if (browser.isChrome) return <Chrome className="w-5 h-5 text-primary" />;
    if (isIOS || browser.isSafari) return <Globe className="w-5 h-5 text-primary" />;
    return <Smartphone className="w-5 h-5 text-primary" />;
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="relative w-full max-w-sm bg-card border border-border rounded-2xl shadow-2xl p-5 animate-in zoom-in-95 duration-300">
        <button
          onClick={handleDismiss}
          className="absolute top-3 right-3 p-1.5 text-muted-foreground hover:text-foreground transition-colors rounded-full hover:bg-muted"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
            {getBrowserIcon()}
          </div>
          <div>
            <h2 className="font-semibold text-foreground text-lg">Install Plagaiscans</h2>
            <p className="text-xs text-muted-foreground">
              {browser.name} {isAndroid ? 'on Android' : isIOS ? 'on iOS' : 'Desktop'}
            </p>
          </div>
        </div>

        {renderInstructions()}

        <div className="mt-4 pt-3 border-t border-border">
          <button
            onClick={handleDismiss}
            className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors text-center py-2"
          >
            Maybe later
          </button>
        </div>
      </div>
    </div>
  );
};