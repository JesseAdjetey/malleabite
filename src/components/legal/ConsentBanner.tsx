import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { X, Cookie } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export function ConsentBanner() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Check if user has already consented
    const hasConsented = localStorage.getItem('malleabite-cookie-consent');
    if (!hasConsented) {
      // Show banner after 1 second to avoid jarring initial load
      const timer = setTimeout(() => setIsVisible(true), 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem('malleabite-cookie-consent', 'accepted');
    localStorage.setItem('malleabite-consent-date', new Date().toISOString());
    setIsVisible(false);
    
    // Initialize analytics if enabled
    if (import.meta.env.VITE_ENABLE_ANALYTICS === 'true') {
      // Google Analytics consent update
      if (typeof window !== 'undefined' && (window as any).gtag) {
        (window as any).gtag('consent', 'update', {
          analytics_storage: 'granted',
        });
      }
    }
  };

  const handleDecline = () => {
    localStorage.setItem('malleabite-cookie-consent', 'declined');
    localStorage.setItem('malleabite-consent-date', new Date().toISOString());
    setIsVisible(false);

    // Disable analytics
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('consent', 'update', {
        analytics_storage: 'denied',
      });
    }
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 md:p-6 animate-in slide-in-from-bottom-5">
      <Card className="max-w-3xl mx-auto shadow-lg border-2">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-2">
              <Cookie className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Cookie Consent</CardTitle>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleDecline}
              className="h-6 w-6 -mt-1 -mr-1"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <CardDescription className="text-sm">
            We value your privacy
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            We use cookies and similar technologies to provide essential functionality, improve your experience, and analyze usage patterns. By clicking "Accept All," you consent to our use of cookies.
          </p>

          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              onClick={handleAccept}
              className="flex-1 sm:flex-none"
            >
              Accept All
            </Button>
            <Button
              onClick={handleDecline}
              variant="outline"
              className="flex-1 sm:flex-none"
            >
              Decline Optional
            </Button>
            <Button
              variant="ghost"
              asChild
              className="flex-1 sm:flex-none"
            >
              <Link to="/legal/privacy">
                Learn More
              </Link>
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            Read our{' '}
            <Link to="/legal/privacy" className="text-primary hover:underline">
              Privacy Policy
            </Link>{' '}
            and{' '}
            <Link to="/legal/terms" className="text-primary hover:underline">
              Terms of Service
            </Link>{' '}
            for more information.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
