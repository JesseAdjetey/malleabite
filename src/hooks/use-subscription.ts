import { useState, useEffect } from 'react';
import {
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import { db } from '@/integrations/firebase/config';
import { useAuth } from '@/contexts/AuthContext.unified';
import { SUBSCRIPTION_PLANS, type SubscriptionPlanId } from '@/lib/stripe';
import { COLLECTIONS, type SubscriptionData } from '@/lib/subscription-types';

export interface Subscription {
  planId: SubscriptionPlanId;
  status: 'active' | 'canceled' | 'past_due' | 'trialing' | 'incomplete';
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  isActive: boolean;
  isFree: boolean;
  isPro: boolean;
  isTeams: boolean;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
}

export function useSubscription() {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!user) {
      // No user - set to null and stop loading
      setSubscription(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const subscriptionRef = doc(db, COLLECTIONS.SUBSCRIPTIONS, user.uid);

    // Real-time listener for subscription changes
    const unsubscribe = onSnapshot(
      subscriptionRef,
      async (docSnap) => {
        try {
          if (docSnap.exists()) {
            const data = docSnap.data() as SubscriptionData;

            // Convert Firestore Timestamps to Dates
            const currentPeriodEnd = data.currentPeriodEnd instanceof Timestamp
              ? data.currentPeriodEnd.toDate()
              : new Date(data.currentPeriodEnd);

            const sub: Subscription = {
              planId: data.planId as SubscriptionPlanId,
              status: data.status,
              currentPeriodEnd,
              cancelAtPeriodEnd: data.cancelAtPeriodEnd,
              isActive: data.status === 'active' || data.status === 'trialing',
              isFree: data.planId === 'free',
              isPro: data.planId === 'pro' || data.planId === 'pro-annual',
              isTeams: data.planId === 'teams',
              stripeCustomerId: data.stripeCustomerId,
              stripeSubscriptionId: data.stripeSubscriptionId,
            };

            setSubscription(sub);
          } else {
            // No subscription document - create free tier
            await createFreeSubscription(user.uid);

            // After creating, fetch it
            const newDocSnap = await getDoc(subscriptionRef);
            if (newDocSnap.exists()) {
              const data = newDocSnap.data() as SubscriptionData;
              const currentPeriodEnd = data.currentPeriodEnd instanceof Timestamp
                ? data.currentPeriodEnd.toDate()
                : new Date(data.currentPeriodEnd);

              setSubscription({
                planId: 'PRO',
                status: 'active',
                currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
                cancelAtPeriodEnd: false,
                isActive: true,
                isFree: false,
                isPro: true,
                isTeams: false,
              });
            }
          }

          setError(null);
        } catch (err) {
          console.error('Error loading subscription:', err);
          setError(err as Error);
        } finally {
          setLoading(false);
        }
      },
      (err) => {
        console.error('Subscription listener error:', err);
        setError(err as Error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  return {
    subscription,
    loading,
    error,
    hasActiveSubscription: subscription?.isActive ?? false,
    plan: subscription ? SUBSCRIPTION_PLANS[subscription.planId] : null,
  };
}

// Helper function to create a free subscription for new users
async function createFreeSubscription(userId: string): Promise<void> {
  const subscriptionRef = doc(db, COLLECTIONS.SUBSCRIPTIONS, userId);

  // Set period to 1 year from now (free tier doesn't expire)
  const now = new Date();
  const oneYearFromNow = new Date(now);
  oneYearFromNow.setFullYear(now.getFullYear() + 1);

  const subscriptionData: Omit<SubscriptionData, 'createdAt' | 'updatedAt'> & {
    createdAt: ReturnType<typeof serverTimestamp>;
    updatedAt: ReturnType<typeof serverTimestamp>;
  } = {
    userId,
    planId: 'free',
    status: 'active',
    currentPeriodStart: now,
    currentPeriodEnd: oneYearFromNow,
    cancelAtPeriodEnd: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  await setDoc(subscriptionRef, subscriptionData);
}
