import { useState, useEffect } from 'react';
import { X, Download, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePWAInstall } from '@/hooks/usePWAInstall';
import { useNavigate } from 'react-router-dom';

export const InstallPromptBanner = () => {
  const { isInstallable, isInstalled, promptInstall, isIOS, isAndroid } = usePWAInstall();
  const [isDismissed, setIsDismissed] = useState(false);
  const [showBanner, setShowBanner] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Check if user has dismissed the banner before
    const dismissed = localStorage.getItem('pwa-banner-dismissed');
    if (dismissed) {
      const dismissedTime = parseInt(dismissed, 10);
      // Show again after 7 days
      if (Date.now() - dismissedTime < 7 * 24 * 60 * 60 * 1000) {
        setIsDismissed(true);
        return;
      }
    }

    // Show banner on mobile devices after a delay
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    if (isMobile && !isInstalled) {
      const timer = setTimeout(() => {
        setShowBanner(true);
      }, 3000); // Show after 3 seconds
      return () => clearTimeout(timer);
    }
  }, [isInstalled]);

  const handleDismiss = () => {
    setIsDismissed(true);
    setShowBanner(false);
    localStorage.setItem('pwa-banner-dismissed', Date.now().toString());
  };

  const handleInstall = async () => {
    if (isInstallable) {
      const success = await promptInstall();
      if (success) {
        setShowBanner(false);
      }
    } else {
      // Navigate to install page for iOS or other instructions
      navigate('/install');
      setShowBanner(false);
    }
  };

  if (isInstalled || isDismissed || !showBanner) {
    return null;
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 animate-in slide-in-from-bottom duration-500">
      <div className="max-w-lg mx-auto bg-card border border-border rounded-2xl shadow-2xl p-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <Smartphone className="w-6 h-6 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground">Install PlagaiScans</h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              {isIOS 
                ? 'Tap Share then "Add to Home Screen" for the best experience'
                : 'Add to your home screen for quick access'}
            </p>
          </div>
          <button 
            onClick={handleDismiss}
            className="flex-shrink-0 p-1 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Dismiss"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex gap-2 mt-3">
          <Button 
            variant="outline" 
            size="sm" 
            className="flex-1"
            onClick={handleDismiss}
          >
            Not Now
          </Button>
          <Button 
            size="sm" 
            className="flex-1 gap-2"
            onClick={handleInstall}
          >
            <Download className="w-4 h-4" />
            {isInstallable ? 'Install' : 'Learn How'}
          </Button>
        </div>
      </div>
    </div>
  );
};
