// Offline event synchronization utilities
import { nanoid } from '@/lib/utils';

export interface OfflineEvent {
  id: string;
  title: string;
  startsAt: string;
  endsAt?: string;
  description?: string;
  category?: string;
  createdAt: string;
  synced: boolean;
}

const DB_NAME = 'MalleabiteOffline';
const DB_VERSION = 1;
const STORE_NAME = 'pendingEvents';

// Open IndexedDB database
export function openOfflineDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('[Offline] Failed to open database:', request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      // Create object store for pending events
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('synced', 'synced', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
        console.log('[Offline] Created pendingEvents store');
      }
    };
  });
}

// Add event to offline queue
export async function addOfflineEvent(event: Partial<OfflineEvent>): Promise<string> {
  const db = await openOfflineDatabase();
  
  const offlineEvent: OfflineEvent = {
    id: event.id || nanoid(),
    title: event.title || 'Untitled Event',
    startsAt: event.startsAt || new Date().toISOString(),
    endsAt: event.endsAt,
    description: event.description,
    category: event.category,
    createdAt: new Date().toISOString(),
    synced: false,
  };

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.add(offlineEvent);

    request.onerror = () => {
      console.error('[Offline] Failed to add event:', request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      console.log('[Offline] Event queued:', offlineEvent.id);
      resolve(offlineEvent.id);
      
      // Trigger background sync if available
      if ('serviceWorker' in navigator && 'sync' in ServiceWorkerRegistration.prototype) {
        navigator.serviceWorker.ready.then((registration) => {
          return (registration as any).sync.register('sync-events');
        }).catch((error) => {
          console.error('[Offline] Background sync failed:', error);
        });
      }
    };

    transaction.oncomplete = () => {
      db.close();
    };
  });
}

// Get all pending (unsynced) events
export async function getPendingEvents(): Promise<OfflineEvent[]> {
  const db = await openOfflineDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onerror = () => {
      console.error('[Offline] Failed to get pending events:', request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      const allEvents = request.result || [];
      const events = allEvents.filter((e: OfflineEvent) => !e.synced);
      console.log('[Offline] Found', events.length, 'pending events');
      resolve(events);
    };

    transaction.oncomplete = () => {
      db.close();
    };
  });
}

// Mark event as synced
export async function markEventSynced(eventId: string): Promise<void> {
  const db = await openOfflineDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const getRequest = store.get(eventId);

    getRequest.onsuccess = () => {
      const event = getRequest.result;
      if (event) {
        event.synced = true;
        const updateRequest = store.put(event);

        updateRequest.onsuccess = () => {
          console.log('[Offline] Event marked as synced:', eventId);
          resolve();
        };

        updateRequest.onerror = () => {
          console.error('[Offline] Failed to mark event as synced:', updateRequest.error);
          reject(updateRequest.error);
        };
      } else {
        reject(new Error('Event not found'));
      }
    };

    getRequest.onerror = () => {
      console.error('[Offline] Failed to get event:', getRequest.error);
      reject(getRequest.error);
    };

    transaction.oncomplete = () => {
      db.close();
    };
  });
}

// Delete event from offline queue
export async function deleteOfflineEvent(eventId: string): Promise<void> {
  const db = await openOfflineDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(eventId);

    request.onerror = () => {
      console.error('[Offline] Failed to delete event:', request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      console.log('[Offline] Event deleted:', eventId);
      resolve();
    };

    transaction.oncomplete = () => {
      db.close();
    };
  });
}

// Clear all synced events (cleanup)
export async function clearSyncedEvents(): Promise<number> {
  const db = await openOfflineDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const getAllRequest = store.getAll();

    getAllRequest.onsuccess = () => {
      const allEvents = getAllRequest.result || [];
      const syncedEvents = allEvents.filter((e: OfflineEvent) => e.synced);
      let deletedCount = 0;

      syncedEvents.forEach((event: OfflineEvent) => {
        store.delete(event.id);
        deletedCount++;
      });

      console.log('[Offline] Cleared', deletedCount, 'synced events');
      resolve(deletedCount);
    };

    getAllRequest.onerror = () => {
      console.error('[Offline] Failed to clear synced events:', getAllRequest.error);
      reject(getAllRequest.error);
    };

    transaction.oncomplete = () => {
      db.close();
    };
  });
}

// Check if online
export function isOnline(): boolean {
  return navigator.onLine;
}

// Listen for online/offline events
export function setupOfflineListeners(
  onOnline: () => void,
  onOffline: () => void
): () => void {
  window.addEventListener('online', onOnline);
  window.addEventListener('offline', onOffline);

  return () => {
    window.removeEventListener('online', onOnline);
    window.removeEventListener('offline', onOffline);
  };
}
