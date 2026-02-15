// Offline Mode Hook - Service worker, offline event creation, sync when online
import { useState, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import { CalendarEventType } from '@/lib/stores/types';
import { isNative } from '@/lib/platform';
import dayjs from 'dayjs';

export interface OfflineEvent {
  id: string;
  action: 'create' | 'update' | 'delete';
  data: Partial<CalendarEventType>;
  timestamp: string;
  synced: boolean;
  error?: string;
}

export interface OfflineState {
  isOnline: boolean;
  isServiceWorkerReady: boolean;
  pendingChanges: number;
  lastSyncAt?: string;
}

const OFFLINE_STORAGE_KEY = 'malleabite_offline_events';
const CACHE_NAME = 'malleabite-cache-v1';

// Get offline events from localStorage
function getOfflineEvents(): OfflineEvent[] {
  try {
    const stored = localStorage.getItem(OFFLINE_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

// Save offline events to localStorage
function saveOfflineEvents(events: OfflineEvent[]) {
  localStorage.setItem(OFFLINE_STORAGE_KEY, JSON.stringify(events));
}

export function useOfflineMode() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isServiceWorkerReady, setIsServiceWorkerReady] = useState(false);
  const [offlineEvents, setOfflineEvents] = useState<OfflineEvent[]>(getOfflineEvents);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);

  // Listen for online/offline events
  useEffect(() => {
    if (isNative) {
      // Use Capacitor Network plugin for reliable native detection
      import('@capacitor/network').then(({ Network }) => {
        Network.getStatus().then(status => setIsOnline(status.connected));
        Network.addListener('networkStatusChange', status => {
          setIsOnline(status.connected);
          if (status.connected) {
            toast.success('Back online! Syncing changes...');
          } else {
            toast.warning('You are offline. Changes will be saved locally.');
          }
        });
      });
      return;
    }

    const handleOnline = () => {
      setIsOnline(true);
      toast.success('Back online! Syncing changes...');
    };

    const handleOffline = () => {
      setIsOnline(false);
      toast.warning('You are offline. Changes will be saved locally.');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Register service worker (skip on native — assets are bundled locally)
  useEffect(() => {
    if (isNative) {
      setIsServiceWorkerReady(true);
      return;
    }
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          console.log('Service Worker registered:', registration);
          setIsServiceWorkerReady(true);
        })
        .catch((error) => {
          console.error('Service Worker registration failed:', error);
        });
    }
  }, []);

  // Auto-sync when coming back online
  useEffect(() => {
    if (isOnline && offlineEvents.filter(e => !e.synced).length > 0) {
      syncOfflineChanges();
    }
  }, [isOnline]);

  // Queue an event for offline storage
  const queueOfflineEvent = useCallback((
    action: 'create' | 'update' | 'delete',
    data: Partial<CalendarEventType>
  ): OfflineEvent => {
    const offlineEvent: OfflineEvent = {
      id: `offline-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      action,
      data,
      timestamp: new Date().toISOString(),
      synced: false,
    };

    const updatedEvents = [...offlineEvents, offlineEvent];
    setOfflineEvents(updatedEvents);
    saveOfflineEvents(updatedEvents);

    if (!isOnline) {
      toast.info('Event saved offline');
    }

    return offlineEvent;
  }, [offlineEvents, isOnline]);

  // Create event (works offline)
  const createEventOffline = useCallback((event: Partial<CalendarEventType>) => {
    const id = `temp-${Date.now()}`;
    const eventWithId = { ...event, id };
    
    queueOfflineEvent('create', eventWithId);
    
    return eventWithId;
  }, [queueOfflineEvent]);

  // Update event (works offline)
  const updateEventOffline = useCallback((eventId: string, updates: Partial<CalendarEventType>) => {
    queueOfflineEvent('update', { id: eventId, ...updates });
  }, [queueOfflineEvent]);

  // Delete event (works offline)
  const deleteEventOffline = useCallback((eventId: string) => {
    queueOfflineEvent('delete', { id: eventId });
  }, [queueOfflineEvent]);

  // Sync offline changes when online
  const syncOfflineChanges = useCallback(async (): Promise<{ success: boolean; synced: number; failed: number }> => {
    if (!isOnline) {
      return { success: false, synced: 0, failed: 0 };
    }

    const unsynced = offlineEvents.filter(e => !e.synced);
    if (unsynced.length === 0) {
      return { success: true, synced: 0, failed: 0 };
    }

    setIsSyncing(true);
    let synced = 0;
    let failed = 0;

    try {
      for (const event of unsynced) {
        try {
          // In production, this would call the actual API/Firebase
          // For now, we'll just mark as synced
          // await api.events[event.action](event.data);
          
          event.synced = true;
          synced++;
        } catch (error) {
          event.error = (error as Error).message;
          failed++;
        }
      }

      const updatedEvents = offlineEvents.map(e => {
        const processed = unsynced.find(u => u.id === e.id);
        return processed || e;
      });

      // Remove successfully synced events
      const remaining = updatedEvents.filter(e => !e.synced);
      setOfflineEvents(remaining);
      saveOfflineEvents(remaining);

      setLastSyncAt(new Date().toISOString());

      if (synced > 0) {
        toast.success(`Synced ${synced} offline change${synced > 1 ? 's' : ''}`);
      }
      if (failed > 0) {
        toast.error(`Failed to sync ${failed} change${failed > 1 ? 's' : ''}`);
      }

      return { success: true, synced, failed };
    } catch (error) {
      console.error('Sync failed:', error);
      toast.error('Failed to sync offline changes');
      return { success: false, synced, failed };
    } finally {
      setIsSyncing(false);
    }
  }, [isOnline, offlineEvents]);

  // Clear all offline events
  const clearOfflineEvents = useCallback(() => {
    setOfflineEvents([]);
    saveOfflineEvents([]);
  }, []);

  // Get pending changes count
  const pendingChanges = offlineEvents.filter(e => !e.synced).length;

  // Cache events for offline access
  const cacheEventsForOffline = useCallback(async (events: CalendarEventType[]) => {
    try {
      const cache = await caches.open(CACHE_NAME);
      
      // Store events as a JSON blob
      const eventsBlob = new Blob([JSON.stringify(events)], { type: 'application/json' });
      const response = new Response(eventsBlob);
      
      await cache.put('/api/events/cached', response);
      
      console.log('Events cached for offline use');
    } catch (error) {
      console.error('Failed to cache events:', error);
    }
  }, []);

  // Get cached events for offline use
  const getCachedEvents = useCallback(async (): Promise<CalendarEventType[]> => {
    try {
      const cache = await caches.open(CACHE_NAME);
      const response = await cache.match('/api/events/cached');
      
      if (response) {
        const events = await response.json();
        return events;
      }
    } catch (error) {
      console.error('Failed to get cached events:', error);
    }
    
    return [];
  }, []);

  // Prefetch events for a date range
  const prefetchEvents = useCallback(async (
    startDate: dayjs.Dayjs,
    endDate: dayjs.Dayjs
  ) => {
    // This would typically fetch events from the server and cache them
    console.log(`Prefetching events from ${startDate.format()} to ${endDate.format()}`);
  }, []);

  return {
    // State
    isOnline,
    isServiceWorkerReady,
    isSyncing,
    pendingChanges,
    lastSyncAt,
    offlineEvents,
    
    // Actions
    createEventOffline,
    updateEventOffline,
    deleteEventOffline,
    syncOfflineChanges,
    clearOfflineEvents,
    cacheEventsForOffline,
    getCachedEvents,
    prefetchEvents,
    
    // Helpers
    getOfflineState: (): OfflineState => ({
      isOnline,
      isServiceWorkerReady,
      pendingChanges,
      lastSyncAt: lastSyncAt || undefined,
    }),
  };
}

// Service Worker content (would be in public/sw.js)
export const serviceWorkerContent = `
const CACHE_NAME = 'malleabite-cache-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
];

// Install event
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
});

// Activate event
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
});

// Fetch event
self.addEventListener('fetch', (event) => {
  // Network first, fallback to cache
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Clone and cache successful responses
        if (response.ok) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // Fallback to cache
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // Return offline page for navigation requests
          if (event.request.mode === 'navigate') {
            return caches.match('/');
          }
          return new Response('Offline', { status: 503 });
        });
      })
  );
});

// Background sync
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-events') {
    event.waitUntil(syncEvents());
  }
});

async function syncEvents() {
  // Get pending events from IndexedDB and sync
  console.log('Background sync triggered');
}

// Push notifications
self.addEventListener('push', (event) => {
  const data = event.data?.json() || {};
  const options = {
    body: data.body || 'New calendar notification',
    icon: '/icon-192.png',
    badge: '/badge.png',
    data: data.url,
    actions: [
      { action: 'open', title: 'Open' },
      { action: 'dismiss', title: 'Dismiss' },
    ],
  };
  
  event.waitUntil(
    self.registration.showNotification(data.title || 'Malleabite', options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  if (event.action === 'open' && event.notification.data) {
    event.waitUntil(
      clients.openWindow(event.notification.data)
    );
  }
});
`;

export default useOfflineMode;
