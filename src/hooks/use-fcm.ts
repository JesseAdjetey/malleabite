import { useEffect, useRef } from 'react';
import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { app, db } from '@/integrations/firebase/config';
import { useAuth } from '@/contexts/AuthContext.unified';
import { useActionRunnerStore } from '@/lib/stores/action-runner-store';
import { useCalendarEvents } from '@/hooks/use-calendar-events';
import { isNative } from '@/lib/platform';

const VAPID_KEY = (import.meta.env.VITE_FIREBASE_VAPID_KEY as string | undefined)?.trim();
const FCM_SW_PATH = '/firebase-messaging-sw.js';

/**
 * Waits for a specific service worker registration to become active.
 * Needed because skipWaiting() is async — the SW is briefly "installing"
 * before it activates, and PushManager.subscribe() requires an active SW.
 */
function waitForSWActive(registration: ServiceWorkerRegistration): Promise<void> {
  if (registration.active) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const sw = registration.installing || registration.waiting;
    if (!sw) {
      reject(new Error('[FCM] No service worker found in registration'));
      return;
    }

    const timer = setTimeout(() => reject(new Error('[FCM] SW activation timed out')), 15_000);

    sw.addEventListener('statechange', function handler() {
      if (registration.active) {
        clearTimeout(timer);
        sw.removeEventListener('statechange', handler);
        resolve();
      }
      if ((sw as ServiceWorker).state === 'redundant') {
        clearTimeout(timer);
        sw.removeEventListener('statechange', handler);
        reject(new Error('[FCM] Service worker became redundant'));
      }
    });
  });
}

/**
 * Initializes Firebase Cloud Messaging for web push notifications.
 * - Requests notification permission
 * - Registers the FCM service worker and gets a push token
 * - Saves the token to Firestore so Cloud Functions can send notifications
 * - Handles foreground messages by triggering the ActionRunnerModal
 *
 * No-op on native (Capacitor handles push via @capacitor/push-notifications).
 */
export function useFCM() {
  const { user } = useAuth();
  const { events } = useCalendarEvents();
  const { setPending } = useActionRunnerStore();

  // Keep a stable ref to events so the onMessage closure doesn't go stale
  const eventsRef = useRef(events);
  useEffect(() => {
    eventsRef.current = events;
  }, [events]);

  useEffect(() => {
    // FCM web push is web-only; Capacitor uses native push
    if (isNative || !user) return;
    if (!VAPID_KEY) {
      console.warn('[FCM] VITE_FIREBASE_VAPID_KEY is not set — web push notifications disabled.');
      return;
    }

    let unsubscribeMessage: (() => void) | null = null;

    (async () => {
      try {
        const supported = await isSupported();
        if (!supported) {
          console.warn('[FCM] Not supported in this browser');
          return;
        }

        const permission = await Notification.requestPermission();
        console.log('[FCM] Notification permission:', permission);
        if (permission !== 'granted') return;

        // Register the dedicated FCM service worker (skipWaiting inside ensures it activates
        // even when VitePWA's SW already controls the same scope)
        const swRegistration = await navigator.serviceWorker.register(FCM_SW_PATH, {
          scope: '/',
          updateViaCache: 'none',
        });
        console.log('[FCM] Service worker registered:', swRegistration.scope);

        // Wait for THIS specific registration to become active before subscribing.
        // skipWaiting() is async — the SW is still "installing" for a brief moment.
        await waitForSWActive(swRegistration);
        console.log('[FCM] Service worker active');

        const messaging = getMessaging(app);

        const token = await getToken(messaging, {
          vapidKey: VAPID_KEY,
          serviceWorkerRegistration: swRegistration,
        });

        if (!token) {
          console.warn('[FCM] No token returned — check VAPID key and Firebase project setup');
          return;
        }

        console.log('[FCM] Token registered successfully');

        // Persist the token so the Cloud Function can look it up
        await setDoc(doc(db, 'fcm_tokens', user.uid), {
          token,
          platform: 'web',
          updatedAt: serverTimestamp(),
        });

        // Handle messages while the app is in the foreground
        // (background messages are handled by the service worker)
        unsubscribeMessage = onMessage(messaging, (payload) => {
          if (payload.data?.type !== 'mally_action') return;

          const eventId = payload.data?.eventId;
          if (!eventId) return;

          const event = eventsRef.current.find((e) => e.id === eventId);
          if (event) setPending(event);
        });
      } catch (err) {
        console.error('[FCM] Setup failed:', err);
      }
    })();

    return () => {
      unsubscribeMessage?.();
    };
  }, [user?.uid, setPending]); // eslint-disable-line react-hooks/exhaustive-deps
}
