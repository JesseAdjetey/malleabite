import { describe, it, expect, vi } from 'vitest';
import { openOfflineDatabase, addOfflineEvent, getPendingEvents } from './offline-sync';

// Mock Firebase config
vi.mock('@/integrations/firebase/config', () => ({
  db: {},
  auth: {},
  functions: {},
}));

describe('Offline Sync', () => {
  // Skip IndexedDB tests in Node environment - these are integration tests
  // that should be run in a browser environment or with a proper IndexedDB polyfill
  it.skip('should create offline database', async () => {
    const db = await openOfflineDatabase();
    expect(db).toBeDefined();
    expect(db.name).toBe('MalleabiteOffline');
  });

  it.skip('should store events in offline queue', async () => {
    const testEvent = {
      title: 'Offline Event',
      startsAt: new Date().toISOString(),
      endsAt: new Date().toISOString(),
      category: 'work',
    };

    await addOfflineEvent(testEvent);
    
    const pending = await getPendingEvents();
    expect(pending.length).toBe(1);
    expect(pending[0].title).toBe('Offline Event');
    expect(pending[0].synced).toBe(false);
  });

  it.skip('should filter synced events correctly', async () => {
    // Add multiple events
    await addOfflineEvent({ title: 'Event 1', startsAt: new Date().toISOString() });
    await addOfflineEvent({ title: 'Event 2', startsAt: new Date().toISOString() });
    
    const pending = await getPendingEvents();
    expect(pending.length).toBe(2);
    
    // All should be unsynced initially
    pending.forEach((event) => {
      expect(event.synced).toBe(false);
    });
  });

  it.skip('should use getAll() instead of IDBKeyRange for boolean queries', async () => {
    // This test validates the fix for IndexedDB boolean queries
    // Skip in Node environment - requires browser or IndexedDB polyfill
    await addOfflineEvent({ title: 'Test Event', startsAt: new Date().toISOString() });
    
    // getPendingEvents should use getAll() with filter
    const pending = await getPendingEvents();
    expect(pending.length).toBeGreaterThan(0);
  });
});
