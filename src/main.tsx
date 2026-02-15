import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import "./index.css"
import { registerServiceWorker } from './lib/sw-registration';
import { initSentry } from './lib/sentry';
import { isNative } from './lib/platform';

// Register service worker for PWA functionality (skip on native — assets are bundled)
if (!isNative && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    registerServiceWorker().catch((error) => {
      console.error('Service worker registration failed:', error);
    });
  });
}

// Error boundary for initialization errors
try {
  const rootElement = document.getElementById("root");
  
  if (!rootElement) {
    throw new Error("Root element not found");
  }

  // Initialize Sentry after React is ready
  initSentry();

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
