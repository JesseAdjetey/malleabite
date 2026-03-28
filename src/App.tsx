
import React, { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter as Router, Route, Routes, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { wrapTransition } from '@/lib/animations';
import { ToastProvider } from "@/hooks/toast-context";
import { Toaster } from "@/components/ui/toaster";
import ThemeProvider from '@/components/ThemeProvider';
import { AuthProvider } from '@/contexts/AuthContext.unified';
import { HeyMallyProvider } from '@/contexts/HeyMallyContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import EventDataProvider from '@/contexts/EventDataProvider';
import { db } from '@/integrations/firebase/config';
import { enableNetwork, disableNetwork } from 'firebase/firestore';
import ErrorBoundary from '@/components/ErrorBoundary';
import { ConsentBanner } from '@/components/legal/ConsentBanner';
import { InstallPrompt } from '@/components/pwa/InstallPrompt';
import { UpgradePrompt } from '@/components/subscription/UpgradePrompt';
import { Loader2 } from 'lucide-react';
import { useNotificationManager } from '@/hooks/use-notification-manager';
import { isNative, isAndroid, isIOS } from '@/lib/platform';
import { useThemeStore } from '@/lib/stores/theme-store';
import { BottomMallyAI } from '@/components/ai/BottomMallyAI';
import { CountdownPanel } from '@/components/countdown/CountdownPanel';
import MobileNavigation from '@/components/MobileNavigation';
import PendingMeetHandler from '@/components/booking/PendingMeetHandler';
import { TranslationProvider } from '@/i18n/TranslationProvider';
import '@/styles/ai-animations.css';

// Lazy load pages for better performance
const Calendar = lazy(() => import('@/pages/Calendar'));
const Settings = lazy(() => import('@/pages/Settings'));
const Analytics = lazy(() => import('@/pages/Analytics'));
const Templates = lazy(() => import('@/pages/Templates'));
const QuickSchedulePage = lazy(() => import('@/pages/QuickSchedule'));
const PatternsPage = lazy(() => import('@/pages/Patterns'));
const Auth = lazy(() => import('@/pages/Auth'));
const PrivacyPolicy = lazy(() => import('@/pages/legal/PrivacyPolicy'));
const TermsOfService = lazy(() => import('@/pages/legal/TermsOfService'));
const Pricing = lazy(() => import('@/pages/Pricing'));
const Billing = lazy(() => import('@/pages/Billing'));
const BookingPage = lazy(() => import('@/pages/BookingPage'));
const MeetPage = lazy(() => import('@/pages/MeetPage'));
const AdvancedAnalytics = lazy(() => import('@/pages/AdvancedAnalytics'));
const JoinPage = lazy(() => import('@/pages/JoinPage'));

// Loading fallback component
const PageLoader = () => (
  <div className="flex h-screen items-center justify-center bg-background">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
  </div>
);

// A wrapper component to determine if the current page is the auth page
const AppRoutes = () => {
  const location = useLocation();
  const isAuthPage = location.pathname === '/auth';

  // Global notification manager for alarms and reminders
  // Must be inside AuthProvider to access useAuth
  useNotificationManager();

  return (
    <ThemeProvider isAuthPage={isAuthPage}>
      <Suspense fallback={<PageLoader />}>
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div
            key={location.pathname}
            {...wrapTransition}
            style={{
              width: '100%',
              minHeight: '100%',
              background: 'hsl(var(--background))',
              willChange: 'opacity, filter',
            }}
          >
            <Routes location={location}>
              <Route path="/auth" element={<Auth />} />
              <Route path="/" element={<ProtectedRoute><Calendar /></ProtectedRoute>} />
              <Route path="/calendar" element={<ProtectedRoute><Calendar /></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
              <Route path="/analytics" element={<ProtectedRoute><Analytics /></ProtectedRoute>} />
              <Route path="/templates" element={<ProtectedRoute><Templates /></ProtectedRoute>} />
              <Route path="/quick-schedule" element={<ProtectedRoute><QuickSchedulePage /></ProtectedRoute>} />
              <Route path="/patterns" element={<ProtectedRoute><PatternsPage /></ProtectedRoute>} />
              <Route path="/pricing" element={<Pricing />} />
              <Route path="/billing" element={<ProtectedRoute><Billing /></ProtectedRoute>} />
              <Route path="/analytics/advanced" element={<ProtectedRoute><AdvancedAnalytics /></ProtectedRoute>} />
              <Route path="/book/:bookingPageId" element={<BookingPage />} />
              <Route path="/meet/:sessionId" element={<MeetPage />} />
              <Route path="/join/:token" element={<JoinPage />} />
              <Route path="/legal/privacy" element={<PrivacyPolicy />} />
              <Route path="/legal/terms" element={<TermsOfService />} />
            </Routes>
          </motion.div>
        </AnimatePresence>
      </Suspense>
      {!isAuthPage && <PendingMeetHandler />}
      {!isAuthPage && <BottomMallyAI />}
      {!isAuthPage && <CountdownPanel />}
      {!isAuthPage && <ConsentBanner />}
      {!isAuthPage && <InstallPrompt />}
      {!isAuthPage && <UpgradePrompt />}
      <Toaster />
    </ThemeProvider>
  );
};

function App() {
  const resolvedTheme = useThemeStore((s) => s.resolvedTheme);

  // ── Native platform init (one-time) ─────────────────────────────────────────
  useEffect(() => {
    if (!isNative) return;

    // Hide splash screen once React has mounted (replaces 2s timer)
    import('@capacitor/splash-screen').then(({ SplashScreen }) => {
      SplashScreen.hide({ fadeOutDuration: 300 });
    }).catch(() => {});

    // Keyboard resize mode
    import('@capacitor/keyboard').then(({ Keyboard, KeyboardResize }) => {
      return Keyboard.setResizeMode({ mode: KeyboardResize.Body }).catch(() => {
        console.log('[App] Keyboard.setResizeMode not supported');
      });
    }).catch(() => {});

    // Android back button handler
    if (isAndroid) {
      import('@capacitor/app').then(({ App: CapacitorApp }) => {
        CapacitorApp.addListener('backButton', ({ canGoBack }) => {
          if (canGoBack) {
            window.history.back();
          } else {
            CapacitorApp.exitApp();
          }
        });
      }).catch(() => {});
    }

    // Deep link handler — navigate to path when app is opened via URL
    import('@capacitor/app').then(({ App: CapacitorApp }) => {
      CapacitorApp.addListener('appUrlOpen', ({ url }) => {
        try {
          const u = new URL(url);
          const path = u.pathname + u.search;
          if (path && path !== '/') {
            // Push to browser history — React Router picks this up
            window.history.replaceState(null, '', path);
            window.dispatchEvent(new PopStateEvent('popstate'));
          }
        } catch { /* ignore malformed URLs */ }
      });

      // App state change — refresh stale data on resume
      CapacitorApp.addListener('appStateChange', ({ isActive }) => {
        if (isActive) {
          // Trigger a refetch by dispatching a custom event
          window.dispatchEvent(new Event('app-resumed'));
          console.log('[App] Resumed from background');
        }
      });
    }).catch(() => {});
  }, []);

  // ── Firestore network management on visibility change ─────────────────────
  // Prevents native WebView background reconnection storms.
  // On regular web tabs this can interrupt pending writes and cause flaky
  // write-stream errors when the browser backgrounds/restores the page.
  useEffect(() => {
    if (!isNative) return;

    let firestoreDisabled = false;

    const handleVisibility = () => {
      if (document.hidden) {
        // Tab hidden — disconnect Firestore to prevent ERR_NETWORK_IO_SUSPENDED flood
        disableNetwork(db).then(() => {
          firestoreDisabled = true;
          console.log('[App] Firestore network disabled (tab hidden)');
        }).catch(() => {});
      } else if (firestoreDisabled) {
        // Tab visible again — reconnect Firestore
        enableNetwork(db).then(() => {
          firestoreDisabled = false;
          console.log('[App] Firestore network re-enabled (tab visible)');
        }).catch(() => {});
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  // ── StatusBar — follows theme ───────────────────────────────────────────────
  useEffect(() => {
    if (!isNative) return;
    import('@capacitor/status-bar').then(({ StatusBar, Style }) => {
      const isDark = resolvedTheme === 'dark';
      StatusBar.setStyle({ style: isDark ? Style.Dark : Style.Light });
      StatusBar.setBackgroundColor({ color: isDark ? '#0a0a0a' : '#f8f7ff' });
    }).catch(() => {});
  }, [resolvedTheme]);

  return (
    <ErrorBoundary>
      <AuthProvider>
        <TranslationProvider>
          <HeyMallyProvider>
            <ToastProvider>
              <Router>
                <EventDataProvider>
                  <AppRoutes />
                </EventDataProvider>
              </Router>
            </ToastProvider>
          </HeyMallyProvider>
        </TranslationProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
