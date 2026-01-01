
import React, { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Route, Routes, useLocation } from 'react-router-dom';
import { ToastProvider } from "@/hooks/toast-context";
import { Toaster } from "@/components/ui/toaster";
import ThemeProvider from '@/components/ThemeProvider';
import { AuthProvider } from '@/contexts/AuthContext.unified';
import { HeyMallyProvider } from '@/contexts/HeyMallyContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import EventDataProvider from '@/contexts/EventDataProvider';
import ErrorBoundary from '@/components/ErrorBoundary';
import { ConsentBanner } from '@/components/legal/ConsentBanner';
import { InstallPrompt } from '@/components/pwa/InstallPrompt';
import { Loader2 } from 'lucide-react';

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
  
  return (
    <ThemeProvider isAuthPage={isAuthPage}>
      <Suspense fallback={<PageLoader />}>
        <Routes>
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
          <Route path="/legal/privacy" element={<PrivacyPolicy />} />
          <Route path="/legal/terms" element={<TermsOfService />} />
        </Routes>
      </Suspense>
      {!isAuthPage && <ConsentBanner />}
      {!isAuthPage && <InstallPrompt />}
      <Toaster />
    </ThemeProvider>
  );
};

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <HeyMallyProvider>
          <ToastProvider>
            <Router>
              <EventDataProvider>
                <AppRoutes />
              </EventDataProvider>
            </Router>
          </ToastProvider>
        </HeyMallyProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
