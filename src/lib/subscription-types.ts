// Firestore subscription data types and schemas

export interface SubscriptionData {
  userId: string;
  planId: 'free' | 'pro' | 'pro-annual' | 'teams';
  status: 'active' | 'canceled' | 'past_due' | 'trialing' | 'incomplete';
  
  // Stripe metadata
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  stripePriceId?: string;
  
  // Billing
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  canceledAt?: Date;
  trialEnd?: Date;
  
  // Team-specific
  teamId?: string;
  seats?: number; // For teams plan
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

export interface UsageData {
  userId: string;
  period: string; // Format: 'YYYY-MM'
  
  // Counters
  eventsCreated: number;
  aiRequestsMade: number;
  activeModules: number;
  customTemplates: number;
  storageUsedMB: number;
  
  // Timestamps
  lastUpdated: Date;
  createdAt: Date;
}

export interface TeamData {
  id: string;
  name: string;
  ownerId: string;
  
  // Subscription
  subscriptionId: string;
  planId: 'teams';
  seats: number;
  
  // Members
  members: TeamMember[];
  invitations: TeamInvitation[];
  
  // Settings
  settings: {
    allowMemberInvites: boolean;
    defaultRole: 'member' | 'admin';
    sharedCalendars: boolean;
  };
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

export interface TeamMember {
  userId: string;
  email: string;
  displayName?: string;
  role: 'owner' | 'admin' | 'member';
  joinedAt: Date;
}

export interface TeamInvitation {
  id: string;
  email: string;
  role: 'admin' | 'member';
  invitedBy: string;
  invitedAt: Date;
  expiresAt: Date;
  status: 'pending' | 'accepted' | 'expired' | 'canceled';
}

// Firestore collection paths
export const COLLECTIONS = {
  SUBSCRIPTIONS: 'subscriptions',
  USAGE: 'usage',
  TEAMS: 'teams',
  CUSTOMERS: 'customers', // Maps userId to stripeCustomerId
} as const;
