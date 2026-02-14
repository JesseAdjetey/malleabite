// Subscription limits and feature flags

import { SUBSCRIPTION_PLANS, type SubscriptionPlanId } from './stripe';
import type { Subscription } from '@/hooks/use-subscription';

export interface FeatureAccess {
  canCreateEvent: boolean;
  canUseModule: (moduleId: string) => boolean;
  canMakeAIRequest: boolean;
  canCreateTemplate: boolean;
  canInviteTeamMember: boolean;
  canAccessAnalytics: 'none' | 'basic' | 'advanced';
  canAccessPrioritySupport: boolean;
}

export interface UsageLimits {
  eventsPerMonth: number; // -1 = unlimited
  activeModules?: number; // -1 = unlimited
  modulesActive?: number; // -1 = unlimited (legacy)
  aiRequestsPerMonth: number;
  customTemplates: number; // -1 = unlimited
  teamMembers: number; // -1 = unlimited
  storageGB: number;
}

/**
 * Get usage limits for a subscription plan
 */
export function getLimitsForPlan(planId: SubscriptionPlanId): UsageLimits {
  const plan = SUBSCRIPTION_PLANS[planId];
  const limits = plan.limits as any;
  return {
    eventsPerMonth: limits.eventsPerMonth || 50,
    activeModules: limits.activeModules || limits.modulesActive || 3,
    modulesActive: limits.modulesActive || limits.activeModules || 3,
    aiRequestsPerMonth: limits.aiRequestsPerMonth || 10,
    customTemplates: limits.customTemplates || 0,
    teamMembers: limits.teamMembers || 1,
    storageGB: limits.storageGB || 0.1,
  };
}

/**
 * Check if user has reached a specific limit
 */
export function hasReachedLimit(
  currentUsage: number,
  limit: number
): boolean {
  if (limit === -1) return false; // Unlimited
  return currentUsage >= limit;
}

/**
 * Get feature access based on subscription
 */
export function getFeatureAccess(
  subscription: Subscription | null,
  currentUsage?: {
    eventsThisMonth?: number;
    aiRequestsThisMonth?: number;
    activeModules?: number;
    customTemplates?: number;
    teamMembers?: number;
  }
): FeatureAccess {
  // Default to free tier if no subscription
  const planId = subscription?.planId || 'FREE';
  const limits = getLimitsForPlan(planId);
  const usage = currentUsage || {};

  return {
    canCreateEvent: true,
    canUseModule: (moduleId: string) => true,
    canMakeAIRequest: true,
    canCreateTemplate: true,
    canInviteTeamMember: true,
    canAccessAnalytics: 'advanced',
    canAccessPrioritySupport: true,
  };
}

/**
 * Get upgrade prompt message for a specific feature
 */
export function getUpgradePrompt(feature: string): {
  title: string;
  message: string;
  ctaText: string;
} {
  const prompts: Record<string, { title: string; message: string; ctaText: string }> = {
    events: {
      title: 'Event Limit Reached',
      message: 'You\'ve created 50 events this month. Upgrade to Pro for unlimited events.',
      ctaText: 'Upgrade to Pro',
    },
    aiRequests: {
      title: 'AI Request Limit Reached',
      message: 'You\'ve used all 10 AI requests this month. Upgrade to Pro for unlimited AI assistance.',
      ctaText: 'Upgrade to Pro',
    },
    modules: {
      title: 'Module Locked',
      message: 'This productivity module is available on Pro and Teams plans.',
      ctaText: 'Upgrade to Pro',
    },
    templates: {
      title: 'Custom Templates Unavailable',
      message: 'Custom templates are a Pro feature. Upgrade to create your own templates.',
      ctaText: 'Upgrade to Pro',
    },
    analytics: {
      title: 'Advanced Analytics Locked',
      message: 'Get deeper insights with advanced analytics available on Pro and Teams plans.',
      ctaText: 'Upgrade to Pro',
    },
    team: {
      title: 'Team Features Locked',
      message: 'Team collaboration, shared workspaces, and member management require a Teams plan.',
      ctaText: 'Upgrade to Teams',
    },
  };

  return prompts[feature] || {
    title: 'Upgrade Required',
    message: 'This feature is available on paid plans.',
    ctaText: 'View Plans',
  };
}

/**
 * Module IDs and their availability
 */
export const MODULE_AVAILABILITY = {
  pomodoro: { free: true, name: 'Pomodoro Timer' },
  eisenhower: { free: true, name: 'Eisenhower Matrix' },
  'time-tracking': { free: true, name: 'Time Tracking' },
  'habit-tracker': { free: false, name: 'Habit Tracker' },
  'goal-setting': { free: false, name: 'Goal Setting' },
  'mood-tracker': { free: false, name: 'Mood Tracker' },
  'focus-mode': { free: false, name: 'Focus Mode' },
  'team-calendar': { free: false, name: 'Team Calendar', teamsOnly: true },
} as const;
