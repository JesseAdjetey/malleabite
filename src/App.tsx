
import React from 'react';
import { BrowserRouter as Router, Route, Routes, useLocation } from 'react-router-dom';
import { ToastProvider } from "@/hooks/toast-context";
import Index from '@/pages/Index';
import Settings from '@/pages/Settings';
import Analytics from '@/pages/Analytics';
import Templates from '@/pages/Templates';
import QuickSchedulePage from '@/pages/QuickSchedule';
import PatternsPage from '@/pages/Patterns';
import Auth from '@/pages/Auth';
import { Toaster } from "@/components/ui/toaster";
import ThemeProvider from '@/components/ThemeProvider';
import { AuthProvider } from '@/contexts/AuthContext.unified';
import ProtectedRoute from '@/components/ProtectedRoute';
import EventDataProvider from '@/contexts/EventDataProvider';

// A wrapper component to determine if the current page is the auth page
const AppRoutes = () => {
  const location = useLocation();
  const isAuthPage = location.pathname === '/auth';
  
  return (
    <ThemeProvider isAuthPage={isAuthPage}>
      <Routes>
        <Route path="/auth" element={<Auth />} />
        <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
        <Route path="/analytics" element={<ProtectedRoute><Analytics /></ProtectedRoute>} />
        <Route path="/templates" element={<ProtectedRoute><Templates /></ProtectedRoute>} />
        <Route path="/quick-schedule" element={<ProtectedRoute><QuickSchedulePage /></ProtectedRoute>} />
        <Route path="/patterns" element={<ProtectedRoute><PatternsPage /></ProtectedRoute>} />
      </Routes>
      <Toaster />
    </ThemeProvider>
  );
};

function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <Router>
          <EventDataProvider>
            <AppRoutes />
          </EventDataProvider>
        </Router>
      </ToastProvider>
    </AuthProvider>
  );
}

export default App;
