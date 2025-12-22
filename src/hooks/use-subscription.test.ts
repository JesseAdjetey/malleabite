import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useSubscription } from './use-subscription';

// Mock Firebase config
vi.mock('@/integrations/firebase/config', () => ({
  db: {},
  auth: {},
  functions: {},
}));

// Mock Firebase auth
vi.mock('@/contexts/AuthContext.unified', () => ({
  useAuth: () => ({
    user: { uid: 'test-user-123' },
    loading: false,
  }),
}));

// Mock Firestore
vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn(),
  collection: vi.fn(),
  doc: vi.fn(),
  onSnapshot: vi.fn((docRef, callback) => {
    // Simulate subscription data
    callback({
      exists: () => true,
      data: () => ({
        userId: 'test-user-123',
        planId: 'PRO',
        status: 'active',
        currentPeriodEnd: new Date(),
      }),
    });
    return vi.fn(); // Unsubscribe function
  }),
  setDoc: vi.fn(),
}));

describe('useSubscription', () => {
  it('should load subscription data for authenticated user', async () => {
    const { result } = renderHook(() => useSubscription());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.subscription).toBeDefined();
    expect(result.current.subscription?.planId).toBe('PRO');
  });

  it('should identify PRO subscription correctly', async () => {
    const { result } = renderHook(() => useSubscription());

    await waitFor(() => {
      expect(result.current.subscription?.isPro).toBe(true);
    });

    expect(result.current.subscription?.isFree).toBe(false);
    expect(result.current.subscription?.isActive).toBe(true);
  });

  it('should provide subscription limits via plan', async () => {
    const { result } = renderHook(() => useSubscription());

    await waitFor(() => {
      expect(result.current.plan).toBeDefined();
    });

    expect(result.current.plan?.limits.eventsPerMonth).toBe(-1); // Unlimited for PRO
  });
});
