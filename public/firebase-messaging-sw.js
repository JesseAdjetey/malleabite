// Firebase Messaging Service Worker
// This file handles background push notifications from FCM.
// ⚠️ Config values are injected by Vite at build time via the 'firebase-messaging-sw' plugin.
// Do NOT import or use import.meta.env here — service workers don't support it.

// Take control immediately so push events are handled even when VitePWA's SW
// is already registered for the same scope.
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (event) {
  event.waitUntil(self.clients.claim());
});

importScripts('https://www.gstatic.com/firebasejs/10.14.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: '%%VITE_FIREBASE_API_KEY%%',
  authDomain: '%%VITE_FIREBASE_AUTH_DOMAIN%%',
  projectId: '%%VITE_FIREBASE_PROJECT_ID%%',
  storageBucket: '%%VITE_FIREBASE_STORAGE_BUCKET%%',
  messagingSenderId: '%%VITE_FIREBASE_MESSAGING_SENDER_ID%%',
  appId: '%%VITE_FIREBASE_APP_ID%%',
});

const messaging = firebase.messaging();

// Background message handler — fires when app is not focused
messaging.onBackgroundMessage(function (payload) {
  var eventTitle = payload.data && payload.data.eventTitle ? payload.data.eventTitle : '';
  var title = eventTitle ? '\u26A1 ' + eventTitle : 'Malleabite';
  var body =
    payload.data && payload.data.body ? payload.data.body : 'Your scheduled actions are ready to run.';
  var eventId = payload.data && payload.data.eventId ? payload.data.eventId : '';

  return self.registration.showNotification(title, {
    body: body,
    icon: '/assets/logo.png',
    badge: '/assets/logo.png',
    vibrate: [200, 100, 200],
    tag: 'mally-action-' + eventId,
    requireInteraction: true,
    data: { url: '/?pendingActionEvent=' + eventId },
  });
});

// Notification click — focus existing window or open new one
self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  var url = event.notification.data && event.notification.data.url ? event.notification.data.url : '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
      for (var i = 0; i < clientList.length; i++) {
        var client = clientList[i];
        if ('focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
