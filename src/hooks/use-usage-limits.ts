// Usage limits tracking and enforcement
import { useState, useEffect, useCallback } from 'react';
import { doc, getDoc, setDoc, onSnapshot, increment } from 'firebase/firestore';
import { db } from '@/integrations/firebase/config';
import { useAuth } from '@/contexts/AuthContext.unified';
import { useSubscription } from './use-subscription';
import { SUBSCRIPTION_PLANS } from '@/lib/stripe';

export interface UsageData {
  eventsThisMonth: number;
  aiRequestsThisMonth: number;
  voiceMinutesThisMonth: number;
  activeModules: number;
  lastResetDate: string;
  totalEventsCreated: number;
  totalAiRequests: number;
  totalVoiceMinutes: number;
}

export interface UsageLimits {
  canCreateEvent: boolean;
  canUseAI: boolean;
  canUseVoice: boolean;
  canAddModule: boolean;
  canUseRecurring: boolean;
  canUseAdvancedAnalytics: boolean;
  eventsRemaining: number;
  aiRequestsRemaining: number;
  modulesRemaining: number;
  voiceMinutesRemaining: number;
  eventsUsed: number;
  aiRequestsUsed: number;
  modulesUsed: number;
  voiceMinutesUsed: number;
  eventsLimit: number;
  aiRequestsLimit: number;
  modulesLimit: number;
  voiceMinutesLimit: number;
}

const DEFAULT_USAGE: UsageData = {
  eventsThisMonth: 0,
  aiRequestsThisMonth: 0,
  voiceMinutesThisMonth: 0,
  activeModules: 0,
  lastResetDate: new Date().toISOString(),
  totalEventsCreated: 0,
  totalAiRequests: 0,
  totalVoiceMinutes: 0,
};

export function useUsageLimits() {
  const { user } = useAuth();
  const { subscription, loading: subLoading } = useSubscription();
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);
  const [upgradePromptFeature, setUpgradePromptFeature] = useState<
    'events' | 'ai' | 'modules' | 'analytics' | 'recurring' | null
  >(null);

  // Determine which plan limits to use
  const getPlanLimits = useCallback(() => {
    if (!subscription || subscription.isFree) {
      return SUBSCRIPTION_PLANS.FREE.limits;
    }
    if (subscription.isPro) {
      return SUBSCRIPTION_PLANS.PRO.limits;
    }
    if (subscription.isTeams) {
      return SUBSCRIPTION_PLANS.TEAMS.limits;
    }
    return SUBSCRIPTION_PLANS.FREE.limits;
  }, [subscription]);

  const planLimits = getPlanLimits();
  // Force unlimited for now as requested by user
  const isUnlimited = true;

  // Listen to usage document
  useEffect(() => {
    if (!user) {
      setUsage(null);
      setLoading(false);
      return;
    }

    const usageRef = doc(db, 'usage', user.uid);

    const unsubscribe = onSnapshot(usageRef, async (docSnap) => {
      try {
        if (docSnap.exists()) {
          const data = docSnap.data() as UsageData;

          // Check if we need to reset monthly counters
          const now = new Date();
          const lastReset = new Date(data.lastResetDate);

          if (now.getMonth() !== lastReset.getMonth() ||
            now.getFullYear() !== lastReset.getFullYear()) {
            // Reset monthly counters
            const resetData: UsageData = {
              ...data,
              eventsThisMonth: 0,
              aiRequestsThisMonth: 0,
              voiceMinutesThisMonth: 0,
              lastResetDate: now.toISOString(),
            };
            await setDoc(usageRef, resetData);
            setUsage(resetData);
          } else {
            setUsage(data);
          }
        } else {
          // Initialize usage document for new user
          await setDoc(usageRef, DEFAULT_USAGE);
          setUsage(DEFAULT_USAGE);
        }
      } catch (error) {
        console.error('Error loading usage data:', error);
        setUsage(DEFAULT_USAGE);
      }
      setLoading(false);
    }, (error) => {
      console.error('Usage snapshot error:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  // Calculate current limits
  const aiLimit = planLimits.aiRequestsPerMonth as number;
  const eventLimit = planLimits.eventsPerMonth as number;
  const moduleLimit = planLimits.modulesActive as number;
  const voiceLimit = (planLimits as any).voiceMinutesPerMonth as number | undefined;

  // Voice is a paid feature — only available on Pro or Teams
  const isPaidVoiceUser = !!(subscription?.isPro || subscription?.isTeams);
  const voiceMinutesUsed = usage?.voiceMinutesThisMonth || 0;
  const voiceMinutesLimit = voiceLimit ?? 0;
  const canUseVoice = isPaidVoiceUser && (voiceLimit === undefined || voiceMinutesUsed < voiceMinutesLimit);

  const limits: UsageLimits = {
    // Check if actions are allowed - forced to true
    canCreateEvent: true,
    canUseAI: true,
    canUseVoice,
    canAddModule: true,
    canUseRecurring: true,
    canUseAdvancedAnalytics: true,

    // Usage stats
    eventsUsed: usage?.eventsThisMonth || 0,
    aiRequestsUsed: usage?.aiRequestsThisMonth || 0,
    modulesUsed: usage?.activeModules || 0,
    voiceMinutesUsed,

    // Limits
    eventsLimit: eventLimit === -1 ? Infinity : eventLimit,
    aiRequestsLimit: aiLimit === -1 ? Infinity : aiLimit,
    modulesLimit: moduleLimit === -1 ? Infinity : moduleLimit,
    voiceMinutesLimit,

    // Remaining
    eventsRemaining: eventLimit === -1
      ? Infinity
      : Math.max(0, eventLimit - (usage?.eventsThisMonth || 0)),

    aiRequestsRemaining: aiLimit === -1
      ? Infinity
      : Math.max(0, aiLimit - (usage?.aiRequestsThisMonth || 0)),

    modulesRemaining: moduleLimit === -1
      ? Infinity
      : Math.max(0, moduleLimit - (usage?.activeModules || 0)),

    voiceMinutesRemaining: Math.max(0, voiceMinutesLimit - voiceMinutesUsed),
  };

  // Increment event count
  const incrementEventCount = useCallback(async (): Promise<boolean> => {
    if (!user) return false;

    if (!limits.canCreateEvent) {
      // Disabled for now
      return false;
    }

    try {
      const usageRef = doc(db, 'usage', user.uid);
      await setDoc(usageRef, {
        eventsThisMonth: increment(1),
        totalEventsCreated: increment(1),
      }, { merge: true });
      return true;
    } catch (error) {
      console.error('Error incrementing event count:', error);
      return false;
    }
  }, [user, limits.canCreateEvent]);

  // Decrement event count (for deletions)
  const decrementEventCount = useCallback(async (): Promise<boolean> => {
    if (!user) return false;

    try {
      const usageRef = doc(db, 'usage', user.uid);
      await setDoc(usageRef, {
        eventsThisMonth: increment(-1),
      }, { merge: true });
      return true;
    } catch (error) {
      console.error('Error decrementing event count:', error);
      return false;
    }
  }, [user]);

  // Increment AI request count
  const incrementAICount = useCallback(async (): Promise<boolean> => {
    if (!user) return false;

    if (!limits.canUseAI) {
      // Disabled for now
      return false;
    }

    try {
      const usageRef = doc(db, 'usage', user.uid);
      await setDoc(usageRef, {
        aiRequestsThisMonth: increment(1),
        totalAiRequests: increment(1),
      }, { merge: true });
      return true;
    } catch (error) {
      console.error('Error incrementing AI count:', error);
      return false;
    }
  }, [user, limits.canUseAI]);

  // Update active module count
  const updateModuleCount = useCallback(async (count: number): Promise<boolean> => {
    if (!user) return false;

    // Check if adding more modules than allowed
    if (count > (usage?.activeModules || 0) && !limits.canAddModule) {
      // Disabled for now
      return false;
    }

    try {
      const usageRef = doc(db, 'usage', user.uid);
      await setDoc(usageRef, {
        activeModules: count,
      }, { merge: true });
      return true;
    } catch (error) {
      console.error('Error updating module count:', error);
      return false;
    }
  }, [user, usage?.activeModules, limits.canAddModule]);

  // Record voice minutes used (called when a Vapi session ends)
  const incrementVoiceMinutes = useCallback(async (minutes: number): Promise<void> => {
    if (!user || minutes <= 0) return;
    try {
      const usageRef = doc(db, 'usage', user.uid);
      await setDoc(usageRef, {
        voiceMinutesThisMonth: increment(minutes),
        totalVoiceMinutes: increment(minutes),
      }, { merge: true });
    } catch (error) {
      console.error('Error incrementing voice minutes:', error);
    }
  }, [user]);

  // Check if a premium feature can be used
  const checkPremiumFeature = useCallback((
    feature: 'recurring' | 'analytics'
  ): boolean => {
    return true; // Always allowed
  }, []);

  // Hide upgrade prompt
  const hideUpgradePrompt = useCallback(() => {
    setShowUpgradePrompt(false);
    setUpgradePromptFeature(null);
  }, []);

  return {
    // Data
    usage,
    limits,
    loading: loading || subLoading,
    isUnlimited,

    // Actions
    incrementEventCount,
    decrementEventCount,
    incrementAICount,
    incrementVoiceMinutes,
    updateModuleCount,
    checkPremiumFeature,

    // Upgrade prompt state
    showUpgradePrompt,
    upgradePromptFeature,
    hideUpgradePrompt,
    triggerUpgradePrompt: (feature: typeof upgradePromptFeature) => {
      // Disabled
    },
  };
}
