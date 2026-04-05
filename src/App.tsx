
import React, { lazy, Suspense, useEffect, useState } from 'react';
import { logger } from '@/lib/logger';
import { BrowserRouter as Router, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { wrapTransition } from '@/lib/animations';
import { ToastProvider } from "@/hooks/toast-context";
import { Toaster } from "@/components/ui/toaster";
import ThemeProvider from '@/components/ThemeProvider';
import { AuthProvider } from '@/contexts/AuthContext.unified';
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
import { useActionScheduler } from '@/hooks/use-action-scheduler';
import { ActionRunnerModal } from '@/components/actions/ActionRunnerModal';
import { useFCM } from '@/hooks/use-fcm';
import { useCalendarEvents } from '@/hooks/use-calendar-events';
import { useActionRunnerStore } from '@/lib/stores/action-runner-store';
import { isNative, isAndroid, isIOS } from '@/lib/platform';
import { useThemeStore } from '@/lib/stores/theme-store';
import { BottomMallyAI } from '@/components/ai/BottomMallyAI';
import { CountdownPanel } from '@/components/countdown/CountdownPanel';
import MobileNavigation from '@/components/MobileNavigation';
import PendingMeetHandler from '@/components/booking/PendingMeetHandler';
import { KeyboardShortcutsDialog } from '@/components/keyboard/KeyboardShortcutsDialog';
import { FeedbackEdgeTab } from '@/components/feedback/FeedbackEdgeTab';
import { useViewStore, useDateStore, useEventStore } from '@/lib/store';
import { useBulkSelectionStore } from '@/lib/stores/bulk-selection-store';
import { useEventCRUD } from '@/hooks/use-event-crud';
import dayjs from 'dayjs';
import { TranslationProvider } from '@/i18n/TranslationProvider';
import '@/styles/ai-animations.css';
import { sounds } from '@/lib/sounds';
import { PostHogProvider } from 'posthog-js/react';
import { posthog } from '@/lib/posthog';

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
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  const navigate = useNavigate();
  const { selectedView, setView } = useViewStore();
  const { userSelectedDate, setDate, selectedMonthIndex, setMonth } = useDateStore();
  const { isBulkMode, enableBulkMode, disableBulkMode } = useBulkSelectionStore();
  const { selectedEvent, isEventSummaryOpen, closeEventSummary } = useEventStore();
  const { removeEvent } = useEventCRUD();

  // Track pageviews on route change
  useEffect(() => {
    posthog.capture('$pageview')
  }, [location.pathname])

  // Global notification manager for alarms and reminders
  // Must be inside AuthProvider to access useAuth
  useNotificationManager();

  // Mally Actions — detects upcoming events with action sequences
  useActionScheduler();

  // FCM web push notifications for out-of-app action alerts
  useFCM();

  // Handle deep link from FCM notification tap: /?pendingActionEvent=<eventId>
  const { events: calendarEvents, fetchEvents } = useCalendarEvents();
  const { setPending } = useActionRunnerStore();
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const pendingEventId = params.get('pendingActionEvent');
    if (!pendingEventId || calendarEvents.length === 0) return;

    const event = calendarEvents.find((e) => e.id === pendingEventId);
    if (!event) return;

    // Remove the param so it doesn't re-trigger on re-renders
    params.delete('pendingActionEvent');
    const cleanUrl =
      window.location.pathname + (params.toString() ? '?' + params.toString() : '');
    window.history.replaceState(null, '', cleanUrl);

    setPending(event);
  }, [calendarEvents, setPending]);

  // Handle native notification tap (Capacitor) — dispatched by use-notification-manager
  useEffect(() => {
    const onMallyActionTap = (e: Event) => {
      const { eventId } = (e as CustomEvent<{ eventId: string }>).detail;
      const event = calendarEvents.find((ev) => ev.id === eventId);
      if (event) setPending(event);
    };
    window.addEventListener('mally-action-tap', onMallyActionTap);
    return () => window.removeEventListener('mally-action-tap', onMallyActionTap);
  }, [calendarEvents, setPending]);

  // Open shortcuts dialog via custom event (from header button) or ? key
  useEffect(() => {
    const onEvent = () => setShortcutsOpen(true);
    window.addEventListener('open-shortcuts', onEvent);
    return () => window.removeEventListener('open-shortcuts', onEvent);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
      if (!isInput && e.key === '/') setShortcutsOpen(prev => !prev);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Mechanical typing sound — plays on printable keystrokes inside text inputs
  useEffect(() => {
    const onTypingKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
      if (!isInput) return;
      // Only fire on printable characters (single char keys) + Backspace
      if (e.key === 'Backspace' || (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey)) {
        sounds.play("typingKey");
      }
    };
    window.addEventListener('keydown', onTypingKey);
    return () => window.removeEventListener('keydown', onTypingKey);
  }, []);

  // Calendar keyboard shortcuts: views (M/W/D), navigation (J/K), today (T), bulk (B)
  useEffect(() => {
    if (isAuthPage) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
      if (isInput || e.ctrlKey || e.metaKey || e.altKey) return;
      switch (e.key.toLowerCase()) {
        case 'm': setView('Month'); break;
        case 'w': setView('Week'); break;
        case 'd': setView('Day'); break;
        case 't': setDate(dayjs()); setMonth(dayjs().month()); break;
        case 'k':
          if (selectedView === 'Month') setMonth(selectedMonthIndex + 1);
          else if (selectedView === 'Week') setDate(userSelectedDate.add(1, 'week'));
          else if (selectedView === 'Day') setDate(userSelectedDate.add(1, 'day'));
          break;
        case 'j':
          if (selectedView === 'Month') setMonth(selectedMonthIndex - 1);
          else if (selectedView === 'Week') setDate(userSelectedDate.subtract(1, 'week'));
          else if (selectedView === 'Day') setDate(userSelectedDate.subtract(1, 'day'));
          break;
        case 'b':
          if (isBulkMode) disableBulkMode(); else enableBulkMode();
          break;
        case 'c':
          window.dispatchEvent(new Event('open-add-event'));
          break;
        case 'r':
          fetchEvents();
          break;
        case 's':
          navigate('/settings');
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isAuthPage, selectedView, userSelectedDate, selectedMonthIndex, isBulkMode, setView, setDate, setMonth, enableBulkMode, disableBulkMode, navigate, fetchEvents]);

  // Delete key — removes the currently open event
  useEffect(() => {
    if (isAuthPage) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
      if (isInput || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'Delete' && selectedEvent && isEventSummaryOpen) {
        removeEvent(selectedEvent.id);
        closeEventSummary();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isAuthPage, selectedEvent, isEventSummaryOpen, removeEvent, closeEventSummary]);

  // Ctrl+S — signal the open event form to save
  useEffect(() => {
    if (isAuthPage) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('keyboard-save-event'));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isAuthPage]);

  return (
    <ThemeProvider isAuthPage={isAuthPage}>
      <Suspense fallback={<PageLoader />}>
        <ErrorBoundary>
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
        </ErrorBoundary>
      </Suspense>
      {!isAuthPage && <PendingMeetHandler />}
      {!isAuthPage && <ErrorBoundary fallback={<></>}><BottomMallyAI /></ErrorBoundary>}
      {!isAuthPage && <CountdownPanel />}
      {!isAuthPage && <ActionRunnerModal />}
      {!isAuthPage && <ConsentBanner />}
      {!isAuthPage && <InstallPrompt />}
      {!isAuthPage && <UpgradePrompt />}
      {!isAuthPage && <KeyboardShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />}
      {!isAuthPage && <FeedbackEdgeTab />}
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
        logger.warn('App', 'Keyboard.setResizeMode not supported');
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
          logger.debug('App', 'Resumed from background');
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
          logger.debug('App', 'Firestore network disabled (tab hidden)');
        }).catch(() => {});
      } else if (firestoreDisabled) {
        // Tab visible again — reconnect Firestore
        enableNetwork(db).then(() => {
          firestoreDisabled = false;
          logger.debug('App', 'Firestore network re-enabled (tab visible)');
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
    <PostHogProvider client={posthog}>
      <ErrorBoundary>
        <AuthProvider>
          <TranslationProvider>
            <ToastProvider>
              <Router>
                <EventDataProvider>
                  <AppRoutes />
                </EventDataProvider>
              </Router>
            </ToastProvider>
          </TranslationProvider>
        </AuthProvider>
      </ErrorBoundary>
    </PostHogProvider>
  );
}

export default App;
