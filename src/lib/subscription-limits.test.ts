import { describe, it, expect, vi } from 'vitest';
import {
  getLimitsForPlan,
  hasReachedLimit,
  getFeatureAccess,
} from './subscription-limits';

// Mock Firebase config
vi.mock('@/integrations/firebase/config', () => ({
  db: {},
  auth: {},
  functions: {},
}));

describe('Subscription Limits', () => {
  describe('getLimitsForPlan', () => {
    it('should return FREE plan limits', () => {
      const limits = getLimitsForPlan('FREE');
      expect(limits.eventsPerMonth).toBe(50);
      expect(limits.aiRequestsPerMonth).toBe(10);
      expect(limits.customTemplates).toBe(0);
    });

    it('should return PRO plan limits', () => {
      const limits = getLimitsForPlan('PRO');
      expect(limits.eventsPerMonth).toBe(-1); // Unlimited
      expect(limits.aiRequestsPerMonth).toBe(1000); // Soft limit for rate limiting
      expect(limits.customTemplates).toBe(-1);
    });

    it('should return TEAMS plan limits', () => {
      const limits = getLimitsForPlan('TEAMS');
      expect(limits.eventsPerMonth).toBe(-1);
      expect(limits.teamMembers).toBe(-1);
    });
  });

  describe('hasReachedLimit', () => {
    it('should return false for unlimited limits', () => {
      expect(hasReachedLimit(100, -1)).toBe(false);
    });

    it('should return true when limit is reached', () => {
      expect(hasReachedLimit(50, 50)).toBe(true);
    });

    it('should return true when limit is exceeded', () => {
      expect(hasReachedLimit(51, 50)).toBe(true);
    });

    it('should return false when under limit', () => {
      expect(hasReachedLimit(25, 50)).toBe(false);
    });
  });

  describe('getFeatureAccess', () => {
    it('should allow FREE users basic features', () => {
      const access = getFeatureAccess(
        {
          planId: 'FREE',
          status: 'active',
          currentPeriodEnd: new Date(),
          cancelAtPeriodEnd: false,
          isActive: true,
          isFree: true,
          isPro: false,
          isTeams: false,
        },
        { eventsThisMonth: 25 }
      );

      expect(access.canCreateEvent).toBe(true);
      expect(access.canAccessAnalytics).toBe('basic');
      expect(access.canAccessPrioritySupport).toBe(false);
    });

    it('should block FREE users at event limit', () => {
      const access = getFeatureAccess(
        {
          planId: 'FREE',
          status: 'active',
          currentPeriodEnd: new Date(),
          cancelAtPeriodEnd: false,
          isActive: true,
          isFree: true,
          isPro: false,
          isTeams: false,
        },
        { eventsThisMonth: 50 }
      );

      expect(access.canCreateEvent).toBe(false);
    });

    it('should allow PRO users unlimited events', () => {
      const access = getFeatureAccess(
        {
          planId: 'PRO',
          status: 'active',
          currentPeriodEnd: new Date(),
          cancelAtPeriodEnd: false,
          isActive: true,
          isFree: false,
          isPro: true,
          isTeams: false,
        },
        { eventsThisMonth: 1000 }
      );

      expect(access.canCreateEvent).toBe(true);
      expect(access.canAccessAnalytics).toBe('advanced');
      expect(access.canAccessPrioritySupport).toBe(true);
    });

    it('should allow inactive PRO subscriptions until period ends', () => {
      // Note: Cancelled PRO subscriptions still have access until currentPeriodEnd
      // The implementation uses planId for limits, not isActive status
      const access = getFeatureAccess(
        {
          planId: 'PRO',
          status: 'canceled',
          currentPeriodEnd: new Date(),
          cancelAtPeriodEnd: true,
          isActive: false,
          isFree: false,
          isPro: true,
          isTeams: false,
        },
        { eventsThisMonth: 10 }
      );

      // PRO users have unlimited events even when cancelled (until period ends)
      expect(access.canCreateEvent).toBe(true);
    });

    it('should default to FREE for null subscription', () => {
      const access = getFeatureAccess(null);

      expect(access.canCreateEvent).toBe(true);
      expect(access.canAccessAnalytics).toBe('basic');
      expect(access.canCreateTemplate).toBe(false);
    });
  });
});
