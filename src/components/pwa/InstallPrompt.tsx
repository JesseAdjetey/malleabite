// PWA Install Prompt Component
import { useState, useEffect } from 'react';
import { X, Download, Share, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { isAppInstalled } from '@/lib/sw-registration';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (isAppInstalled()) {
      return;
    }

    // Check if previously dismissed
    const wasDismissed = localStorage.getItem('malleabite-install-dismissed');
    if (wasDismissed) {
      return;
    }

    // Detect iOS
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(iOS);

    // Listen for beforeinstallprompt event (Chrome, Edge, etc.)
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      
      // Show prompt after a delay
      setTimeout(() => {
        setShowPrompt(true);
      }, 3000);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    // For iOS, show after delay
    if (iOS) {
      setTimeout(() => {
        setShowPrompt(true);
      }, 5000);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) {
      return;
    }

    // Show the install prompt
    await deferredPrompt.prompt();

    // Wait for the user's response
    const { outcome } = await deferredPrompt.userChoice;
    console.log('[Install] User choice:', outcome);

    if (outcome === 'accepted') {
      console.log('[Install] User accepted the install prompt');
    } else {
      console.log('[Install] User dismissed the install prompt');
    }

    // Clear the deferred prompt
    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    setDismissed(true);
    localStorage.setItem('malleabite-install-dismissed', 'true');
  };

  if (!showPrompt || dismissed) {
    return null;
  }

  // iOS-specific install instructions
  if (isIOS) {
    return (
      <Card className="fixed bottom-20 left-4 right-4 p-4 shadow-xl z-50 border-2 border-primary/20 bg-background/95 backdrop-blur-sm md:max-w-md md:left-auto md:right-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 p-2 rounded-full bg-primary/10">
            <Download className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold mb-1">Install Malleabite</h3>
            <p className="text-sm text-muted-foreground mb-3">
              Add to your home screen for a better experience
            </p>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <Share className="h-4 w-4 text-primary" />
                <span>Tap the Share button</span>
              </div>
              <div className="flex items-center gap-2">
                <Plus className="h-4 w-4 text-primary" />
                <span>Select "Add to Home Screen"</span>
              </div>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleDismiss}
            className="flex-shrink-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </Card>
    );
  }

  // Standard PWA install prompt
  return (
    <Card className="fixed bottom-20 left-4 right-4 p-4 shadow-xl z-50 border-2 border-primary/20 bg-background/95 backdrop-blur-sm md:max-w-md md:left-auto md:right-4">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 p-2 rounded-full bg-primary/10">
          <Download className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold mb-1">Install Malleabite</h3>
          <p className="text-sm text-muted-foreground mb-3">
            Install our app for offline access and a better experience
          </p>
          <div className="flex gap-2">
            <Button onClick={handleInstall} className="flex-1">
              Install
            </Button>
            <Button onClick={handleDismiss} variant="outline">
              Not now
            </Button>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleDismiss}
          className="flex-shrink-0"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </Card>
  );
}
