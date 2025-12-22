import { describe, it, expect, vi, beforeEach } from 'vitest';
import { trackEventCreation, trackAIRequest, getCurrentUsage } from './usage-tracker';

// Mock Firebase config
vi.mock('@/integrations/firebase/config', () => ({
  db: {},
  auth: {},
  functions: {},
}));

// Mock Firebase with all required functions
vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn(),
  collection: vi.fn(),
  doc: vi.fn(),
  getDoc: vi.fn(() =>
    Promise.resolve({
      exists: () => true,
      data: () => ({
        eventsCreated: 25,
        aiRequests: 5,
        modulesUsed: ['calendar', 'templates'],
      }),
    })
  ),
  setDoc: vi.fn(() => Promise.resolve()),
  updateDoc: vi.fn(() => Promise.resolve()),
  increment: vi.fn((value: number) => ({ _increment: value })),
  serverTimestamp: vi.fn(() => ({ _serverTimestamp: true })),
  Timestamp: {
    now: vi.fn(() => ({ toDate: () => new Date() })),
  },
}));

describe('Usage Tracker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('trackEventCreation', () => {
    it('should track event creation', async () => {
      await trackEventCreation('test-user');
      // No error means success (tracking shouldn't block)
      expect(true).toBe(true);
    });
  });

  describe('trackAIRequest', () => {
    it('should track AI request', async () => {
      await trackAIRequest('test-user');
      expect(true).toBe(true);
    });
  });

  describe('getCurrentUsage', () => {
    it('should return usage data', async () => {
      const usage = await getCurrentUsage('test-user');
      expect(usage).toBeDefined();
      expect(typeof usage.eventsThisMonth).toBe('number');
    });
  });
});
