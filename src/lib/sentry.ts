// Sentry Error Tracking Configuration
import * as Sentry from '@sentry/react';

let isInitialized = false;

export function initSentry() {
  // Only initialize once and only in production
  if (isInitialized || !import.meta.env.PROD || !import.meta.env.VITE_SENTRY_DSN) {
    return;
  }

  try {
    Sentry.init({
      dsn: import.meta.env.VITE_SENTRY_DSN,
      
      // Performance Monitoring - minimal integrations to avoid hook issues
      integrations: [],
      
      // Set tracesSampleRate to 1.0 to capture 100% of transactions for performance monitoring.
      // Reduce in production to 0.1 or lower for cost savings
      tracesSampleRate: 0.1,
      
      // Environment
      environment: import.meta.env.MODE,
      
      // Release tracking (set this in your build process)
      release: import.meta.env.VITE_APP_VERSION || '1.0.0',
      
      // Don't send errors in development
      enabled: import.meta.env.PROD,
      
      // Filter out specific errors
      beforeSend(event, hint) {
        // Don't send network errors for common issues
        const error = hint.originalException;
        if (error instanceof Error) {
          // Ignore cancelled requests
          if (error.message.includes('cancelled') || error.message.includes('aborted')) {
            return null;
          }
          // Ignore ResizeObserver errors (common browser quirk)
          if (error.message.includes('ResizeObserver')) {
            return null;
          }
          // Ignore chunk loading errors
          if (error.message.includes('Loading chunk')) {
            return null;
          }
        }
        return event;
      },
    });
    
    isInitialized = true;
  } catch (e) {
    console.warn('Failed to initialize Sentry:', e);
  }
}

// Export Sentry for manual error reporting
export { Sentry };

// Helper to capture user context
export function setSentryUser(user: { id: string; email?: string }) {
  Sentry.setUser({
    id: user.id,
    email: user.email,
  });
}

// Helper to clear user on logout
export function clearSentryUser() {
  Sentry.setUser(null);
}

// Helper to capture custom events
export function captureEvent(message: string, data?: Record<string, any>) {
  Sentry.captureMessage(message, {
    level: 'info',
    extra: data,
  });
}
