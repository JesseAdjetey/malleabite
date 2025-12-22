// Stripe client configuration for client-side payments
import { loadStripe, Stripe } from '@stripe/stripe-js';

// Check if we're in mock mode
const isMockMode = import.meta.env.VITE_STRIPE_MODE === 'mock';

// Validate Stripe publishable key (unless in mock mode)
if (!isMockMode && !import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY) {
  console.warn(
    'Missing VITE_STRIPE_PUBLISHABLE_KEY environment variable. ' +
    'Stripe payment features will be disabled. ' +
    'Set VITE_STRIPE_MODE=mock in .env to enable mock mode for testing.'
  );
}

// Initialize Stripe
let stripePromise: Promise<Stripe | null> | null = null;

export const getStripe = () => {
  // Return null in mock mode - components will handle gracefully
  if (isMockMode) {
    console.log('[Stripe] Running in MOCK mode - no real payments will be processed');
    return Promise.resolve(null);
  }
  
  if (!stripePromise) {
    const publishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
    
    if (!publishableKey) {
      console.error('Stripe publishable key is not configured');
      return Promise.resolve(null);
    }
    
    stripePromise = loadStripe(publishableKey);
  }
  
  return stripePromise;
};

// Helper to check if Stripe is available
export const isStripeEnabled = () => {
  return !isMockMode && !!import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
};

// Subscription plan configurations matching Stripe products
export const SUBSCRIPTION_PLANS = {
  FREE: {
    id: 'free',
    name: 'Free',
    price: 0,
    interval: 'month' as const,
    stripePriceId: null, // Free plan doesn't need Stripe
    features: {
      events: 50,
      modules: 3,
      aiRequests: 10,
      analytics: 'basic',
      support: 'community',
      customTemplates: 0,
      teamMembers: 1,
    },
    limits: {
      eventsPerMonth: 50,
      modulesActive: 3,
      aiRequestsPerMonth: 10,
      customTemplates: 0,
      teamMembers: 1,
      storageGB: 0.1,
    }
  },
  
  PRO: {
    id: 'pro',
    name: 'Pro',
    price: 9.99,
    interval: 'month' as const,
    stripePriceId: import.meta.env.VITE_STRIPE_PRO_MONTHLY_PRICE_ID,
    stripeProductId: import.meta.env.VITE_STRIPE_PRO_PRODUCT_ID,
    features: {
      events: 'unlimited',
      modules: 'unlimited',
      aiRequests: 'unlimited',
      analytics: 'advanced',
      support: 'priority',
      customTemplates: 'unlimited',
      teamMembers: 1,
    },
    limits: {
      eventsPerMonth: -1, // -1 = unlimited
      modulesActive: -1,
      aiRequestsPerMonth: 1000, // Soft limit for rate limiting
      customTemplates: -1,
      teamMembers: 1,
      storageGB: 5,
    }
  },
  
  PRO_ANNUAL: {
    id: 'pro-annual',
    name: 'Pro Annual',
    price: 99.99,
    interval: 'year' as const,
    stripePriceId: import.meta.env.VITE_STRIPE_PRO_ANNUAL_PRICE_ID,
    stripeProductId: import.meta.env.VITE_STRIPE_PRO_PRODUCT_ID,
    savings: 17, // percentage saved vs monthly
    features: {
      events: 'unlimited',
      modules: 'unlimited',
      aiRequests: 'unlimited',
      analytics: 'advanced',
      support: 'priority',
      customTemplates: 'unlimited',
      teamMembers: 1,
    },
    limits: {
      eventsPerMonth: -1,
      modulesActive: -1,
      aiRequestsPerMonth: 1000,
      customTemplates: -1,
      teamMembers: 1,
      storageGB: 5,
    }
  },
  
  TEAMS: {
    id: 'teams',
    name: 'Teams',
    price: 7,
    pricePerUser: true,
    interval: 'month' as const,
    stripePriceId: import.meta.env.VITE_STRIPE_TEAMS_MONTHLY_PRICE_ID,
    stripeProductId: import.meta.env.VITE_STRIPE_TEAMS_PRODUCT_ID,
    minimumSeats: 2,
    features: {
      events: 'unlimited',
      modules: 'unlimited',
      aiRequests: 'unlimited',
      analytics: 'advanced',
      support: 'priority',
      customTemplates: 'unlimited',
      teamMembers: 'unlimited',
      sharedWorkspaces: true,
      teamAnalytics: true,
      adminControls: true,
    },
    limits: {
      eventsPerMonth: -1,
      modulesActive: -1,
      aiRequestsPerMonth: 1000,
      customTemplates: -1,
      teamMembers: -1,
      storageGB: 20,
    }
  },
} as const;

export type SubscriptionPlanId = keyof typeof SUBSCRIPTION_PLANS;
export type SubscriptionPlan = typeof SUBSCRIPTION_PLANS[SubscriptionPlanId];

// Helper to get plan by ID
export const getPlanById = (planId: string): SubscriptionPlan | null => {
  return SUBSCRIPTION_PLANS[planId as SubscriptionPlanId] || null;
};

// Helper to get plan by Stripe price ID
export const getPlanByPriceId = (priceId: string): SubscriptionPlan | null => {
  return Object.values(SUBSCRIPTION_PLANS).find(
    plan => plan.stripePriceId === priceId
  ) || null;
};
