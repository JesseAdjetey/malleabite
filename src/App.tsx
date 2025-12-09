
import React, { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Route, Routes, useLocation } from 'react-router-dom';
import { ToastProvider } from "@/hooks/toast-context";
import { Toaster } from "@/components/ui/toaster";
import ThemeProvider from '@/components/ThemeProvider';
import { AuthProvider } from '@/contexts/AuthContext.unified';
import ProtectedRoute from '@/components/ProtectedRoute';
import EventDataProvider from '@/contexts/EventDataProvider';
import ErrorBoundary from '@/components/ErrorBoundary';

// Lazy load pages for better performance
const Dashboard = lazy(() => import('@/pages/Dashboard'));
const Calendar = lazy(() => import('@/pages/Calendar'));
const Settings = lazy(() => import('@/pages/Settings'));
const Analytics = lazy(() => import('@/pages/Analytics'));
const Templates = lazy(() => import('@/pages/Templates'));
const QuickSchedulePage = lazy(() => import('@/pages/QuickSchedule'));
const PatternsPage = lazy(() => import('@/pages/Patterns'));
const Auth = lazy(() => import('@/pages/Auth'));

// Loading fallback component
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="text-center space-y-4">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
      <p className="text-sm text-muted-foreground">Loading...</p>
    </div>
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
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
          <Route path="/analytics" element={<ProtectedRoute><Analytics /></ProtectedRoute>} />
          <Route path="/templates" element={<ProtectedRoute><Templates /></ProtectedRoute>} />
          <Route path="/quick-schedule" element={<ProtectedRoute><QuickSchedulePage /></ProtectedRoute>} />
          <Route path="/patterns" element={<ProtectedRoute><PatternsPage /></ProtectedRoute>} />
        </Routes>
      </Suspense>
      <Toaster />
    </ThemeProvider>
  );
};

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <ToastProvider>
          <Router>
            <EventDataProvider>
              <AppRoutes />
            </EventDataProvider>
          </Router>
        </ToastProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
