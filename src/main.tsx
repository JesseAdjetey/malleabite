import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './i18n/config'; // Initialize i18next before app renders
import "./index.css"
import { registerServiceWorker, unregisterServiceWorker } from './lib/sw-registration';
import { initSentry } from './lib/sentry';
import { initPostHog } from './lib/posthog';
import { isNative } from './lib/platform';

// During local/dev debugging we do not want a stale PWA bundle masking UI changes.
// Keep SW only for production web builds.
if (!isNative && 'serviceWorker' in navigator) {
  if (import.meta.env.PROD) {
    window.addEventListener('load', () => {
      registerServiceWorker().catch((error) => {
        console.error('Service worker registration failed:', error);
      });
    });
  } else {
    unregisterServiceWorker().catch((error) => {
      console.error('Service worker unregistration failed:', error);
    });
  }
}

// ── Suppress Firebase SDK internal assertion errors ────────────────────────────
// The Firestore SDK (12.x) throws internal assertions when a watch-stream
// response arrives for a listener that was already unsubscribed (a network-
// level race condition that is non-fatal). In development, React 18 routes
// uncaught errors and unhandled rejections to the nearest ErrorBoundary,
// which would show the "Oops" page. We intercept them in the capture phase
// (before React's handler) and swallow them silently.
const isFirebaseInternalAssertion = (err: unknown): boolean => {
  const msg = (err as Error)?.message ?? String(err ?? '');
  return msg.includes('INTERNAL ASSERTION FAILED');
};

window.addEventListener('error', (e) => {
  if (isFirebaseInternalAssertion(e.error)) {
    e.preventDefault();
    e.stopImmediatePropagation();
  }
}, { capture: true });

window.addEventListener('unhandledrejection', (e) => {
  if (isFirebaseInternalAssertion(e.reason)) {
    e.preventDefault();
    e.stopImmediatePropagation();
  }
}, { capture: true });

// Error boundary for initialization errors
try {
  const rootElement = document.getElementById("root");
  
  if (!rootElement) {
    throw new Error("Root element not found");
  }

  // Initialize Sentry after React is ready
  initSentry();
  initPostHog();

  createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
} catch (error) {
  console.error("Failed to initialize app:", error);
  
  // Display error to user
  const rootElement = document.getElementById("root");
  if (rootElement) {
    rootElement.innerHTML = `
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; padding: 2rem; font-family: system-ui, -apple-system, sans-serif; background: #0a0a0a; color: #fff;">
        <div style="max-width: 600px; text-align: center;">
          <h1 style="color: #ef4444; margin-bottom: 1rem;">Failed to Load Application</h1>
          <p style="color: #9ca3af; margin-bottom: 1rem;">There was an error initializing the application.</p>
          <pre style="background: #1a1a1a; padding: 1rem; border-radius: 8px; text-align: left; overflow-x: auto; font-size: 0.875rem; color: #ef4444;">${error instanceof Error ? error.message : String(error)}</pre>
          <p style="color: #9ca3af; margin-top: 1rem; font-size: 0.875rem;">Please check the browser console for more details.</p>
        </div>
      </div>
    `;
  }
}
