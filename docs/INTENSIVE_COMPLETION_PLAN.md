# 🚨 INTENSIVE COMPLETION PLAN - Malleabite
**Created:** January 2, 2026  
**Target Launch:** 3 Weeks (January 23, 2026)  
**Working Hours:** Aggressive - 10-12 hours/day  

---

## ⚡ SPRINT OVERVIEW

| Week | Focus | Hours | Deliverable |
|------|-------|-------|-------------|
| Week 1 | Security + Subscription | 70h | Revenue-ready app |
| Week 2 | Mobile + Notifications + AI | 70h | Production-quality UX |
| Week 3 | Testing + Polish + Deploy | 60h | Launch-ready product |

**Total: 200 hours to complete 48% remaining work**

---

# 📅 WEEK 1: SECURITY & MONETIZATION (Days 1-7)

## Day 1: Environment & Security Setup (10h)

### Morning (4h) - Environment Variables
```bash
# Create .env.example and .env.local
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_GEMINI_API_KEY=
VITE_STRIPE_PUBLISHABLE_KEY=
VITE_STRIPE_PRO_MONTHLY_PRICE_ID=
VITE_STRIPE_PRO_ANNUAL_PRICE_ID=
VITE_STRIPE_TEAMS_PRICE_ID=
```

**Tasks:**
- [ ] Create `.env.example` with all required variables
- [ ] Create `.env.local` with actual values
- [ ] Update `src/integrations/firebase/config.ts` to use `import.meta.env`
- [ ] Update vite.config.ts to expose env variables
- [ ] Test app still works with environment variables

### Afternoon (4h) - Firebase Security
**Tasks:**
- [ ] Go to Firebase Console → Project Settings → Rotate API keys
- [ ] Update `.env.local` with new keys
- [ ] Deploy updated Firestore security rules:

```javascript
// firestore.rules - PRODUCTION VERSION
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can only access their own data
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    match /events/{eventId} {
      allow read, write: if request.auth != null && 
        resource.data.userId == request.auth.uid;
      allow create: if request.auth != null && 
        request.resource.data.userId == request.auth.uid;
    }
    
    match /todos/{todoId} {
      allow read, write: if request.auth != null && 
        resource.data.userId == request.auth.uid;
      allow create: if request.auth != null;
    }
    
    match /subscriptions/{userId} {
      allow read: if request.auth != null && request.auth.uid == userId;
      allow write: if false; // Only cloud functions can write
    }
    
    // Rate limiting via App Check
    match /{document=**} {
      allow read, write: if false; // Deny all by default
    }
  }
}
```

- [ ] Enable Firebase App Check in console
- [ ] Add App Check to frontend config

### Evening (2h) - Gemini API Setup
**Tasks:**
- [ ] Get Gemini API key from Google AI Studio
- [ ] Configure Firebase Functions:
```bash
firebase functions:config:set gemini.api_key="YOUR_KEY"
```
- [ ] Redeploy Firebase Functions
- [ ] Test Mally AI responds with real AI

---

## Day 2: Stripe Integration (12h)

### Morning (4h) - Stripe Account Setup
**Tasks:**
- [ ] Create Stripe account (if not exists)
- [ ] Create Products in Stripe Dashboard:
  - Free (no product needed)
  - Pro Monthly: $9.99/month
  - Pro Annual: $99.99/year (save 17%)
  - Teams: $7/user/month
- [ ] Get Price IDs and add to `.env.local`
- [ ] Get Publishable Key and Secret Key
- [ ] Configure webhook endpoint URL

### Afternoon (4h) - Stripe Checkout Implementation
**File: `firebase/functions/src/stripe.ts`**
```typescript
import Stripe from 'stripe';
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

const stripe = new Stripe(functions.config().stripe.secret_key, {
  apiVersion: '2023-10-16',
});

export const createCheckoutSession = functions.https.onRequest(async (req, res) => {
  // CORS
  res.set('Access-Control-Allow-Origin', '*');
  
  if (req.method === 'OPTIONS') {
    res.set('Access-Control-Allow-Methods', 'POST');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    res.status(204).send('');
    return;
  }

  const { priceId, userId, successUrl, cancelUrl } = req.body;

  try {
    // Get or create Stripe customer
    const userDoc = await admin.firestore().collection('users').doc(userId).get();
    let customerId = userDoc.data()?.stripeCustomerId;

    if (!customerId) {
      const customer = await stripe.customers.create({
        metadata: { firebaseUID: userId }
      });
      customerId = customer.id;
      await admin.firestore().collection('users').doc(userId).update({
        stripeCustomerId: customerId
      });
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'subscription',
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: { userId }
    });

    res.json({ sessionId: session.id, url: session.url });
  } catch (error) {
    console.error('Checkout error:', error);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

export const stripeWebhook = functions.https.onRequest(async (req, res) => {
  const sig = req.headers['stripe-signature'] as string;
  const webhookSecret = functions.config().stripe.webhook_secret;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(req.rawBody, sig, webhookSecret);
  } catch (err) {
    res.status(400).send(`Webhook Error: ${err}`);
    return;
  }

  switch (event.type) {
    case 'checkout.session.completed':
      await handleCheckoutComplete(event.data.object as Stripe.Checkout.Session);
      break;
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
      await handleSubscriptionChange(event.data.object as Stripe.Subscription);
      break;
    case 'invoice.payment_failed':
      await handlePaymentFailed(event.data.object as Stripe.Invoice);
      break;
  }

  res.json({ received: true });
});

async function handleCheckoutComplete(session: Stripe.Checkout.Session) {
  const userId = session.metadata?.userId;
  if (!userId) return;

  const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
  
  await admin.firestore().collection('subscriptions').doc(userId).set({
    planId: getPlanIdFromPrice(subscription.items.data[0].price.id),
    status: subscription.status,
    stripeSubscriptionId: subscription.id,
    stripeCustomerId: session.customer as string,
    currentPeriodEnd: new Date(subscription.current_period_end * 1000),
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}

async function handleSubscriptionChange(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string;
  const userSnapshot = await admin.firestore()
    .collection('users')
    .where('stripeCustomerId', '==', customerId)
    .limit(1)
    .get();

  if (userSnapshot.empty) return;

  const userId = userSnapshot.docs[0].id;
  
  await admin.firestore().collection('subscriptions').doc(userId).update({
    status: subscription.status,
    currentPeriodEnd: new Date(subscription.current_period_end * 1000),
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  // Send email notification about failed payment
  console.log('Payment failed for invoice:', invoice.id);
}

function getPlanIdFromPrice(priceId: string): string {
  const priceMap: Record<string, string> = {
    [process.env.STRIPE_PRO_MONTHLY_PRICE_ID!]: 'pro',
    [process.env.STRIPE_PRO_ANNUAL_PRICE_ID!]: 'pro-annual',
    [process.env.STRIPE_TEAMS_PRICE_ID!]: 'teams',
  };
  return priceMap[priceId] || 'free';
}
```

### Evening (4h) - Webhook & Customer Portal
**Tasks:**
- [ ] Configure Stripe webhook in dashboard pointing to Cloud Function
- [ ] Add webhook secret to Firebase config
- [ ] Implement customer portal redirect function
- [ ] Test full checkout flow end-to-end
- [ ] Verify subscription updates in Firestore

---

## Day 3: Usage Limits & Enforcement (10h)

### Morning (5h) - Usage Tracking System
**File: `src/hooks/use-usage-limits.ts`**
```typescript
import { useState, useEffect } from 'react';
import { doc, getDoc, setDoc, increment, onSnapshot } from 'firebase/firestore';
import { db } from '@/integrations/firebase/config';
import { useAuth } from '@/contexts/AuthContext.unified';
import { useSubscription } from './use-subscription';
import { SUBSCRIPTION_PLANS } from '@/lib/stripe';

export interface UsageData {
  eventsThisMonth: number;
  aiRequestsThisMonth: number;
  activeModules: number;
  lastResetDate: string;
}

export interface UsageLimits {
  canCreateEvent: boolean;
  canUseAI: boolean;
  canAddModule: boolean;
  eventsRemaining: number;
  aiRequestsRemaining: number;
  modulesRemaining: number;
}

export function useUsageLimits() {
  const { user } = useAuth();
  const { subscription } = useSubscription();
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);

  const plan = subscription?.isFree 
    ? SUBSCRIPTION_PLANS.FREE 
    : subscription?.isPro 
      ? SUBSCRIPTION_PLANS.PRO 
      : SUBSCRIPTION_PLANS.TEAMS;

  useEffect(() => {
    if (!user) return;

    const usageRef = doc(db, 'usage', user.uid);
    
    const unsubscribe = onSnapshot(usageRef, async (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as UsageData;
        
        // Check if we need to reset monthly counters
        const now = new Date();
        const lastReset = new Date(data.lastResetDate);
        if (now.getMonth() !== lastReset.getMonth() || now.getFullYear() !== lastReset.getFullYear()) {
          // Reset monthly counters
          await setDoc(usageRef, {
            eventsThisMonth: 0,
            aiRequestsThisMonth: 0,
            activeModules: data.activeModules,
            lastResetDate: now.toISOString(),
          });
        } else {
          setUsage(data);
        }
      } else {
        // Initialize usage document
        const initialUsage: UsageData = {
          eventsThisMonth: 0,
          aiRequestsThisMonth: 0,
          activeModules: 0,
          lastResetDate: new Date().toISOString(),
        };
        await setDoc(usageRef, initialUsage);
        setUsage(initialUsage);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const limits: UsageLimits = {
    canCreateEvent: !usage || usage.eventsThisMonth < (plan.limits?.eventsPerMonth || Infinity),
    canUseAI: !usage || usage.aiRequestsThisMonth < (plan.limits?.aiRequestsPerMonth || Infinity),
    canAddModule: !usage || usage.activeModules < (plan.limits?.modulesActive || Infinity),
    eventsRemaining: Math.max(0, (plan.limits?.eventsPerMonth || Infinity) - (usage?.eventsThisMonth || 0)),
    aiRequestsRemaining: Math.max(0, (plan.limits?.aiRequestsPerMonth || Infinity) - (usage?.aiRequestsThisMonth || 0)),
    modulesRemaining: Math.max(0, (plan.limits?.modulesActive || Infinity) - (usage?.activeModules || 0)),
  };

  const incrementEventCount = async () => {
    if (!user) return;
    await setDoc(doc(db, 'usage', user.uid), {
      eventsThisMonth: increment(1),
    }, { merge: true });
  };

  const incrementAICount = async () => {
    if (!user) return;
    await setDoc(doc(db, 'usage', user.uid), {
      aiRequestsThisMonth: increment(1),
    }, { merge: true });
  };

  const updateModuleCount = async (count: number) => {
    if (!user) return;
    await setDoc(doc(db, 'usage', user.uid), {
      activeModules: count,
    }, { merge: true });
  };

  return {
    usage,
    limits,
    loading,
    incrementEventCount,
    incrementAICount,
    updateModuleCount,
    isUnlimited: subscription?.isPro || subscription?.isTeams,
  };
}
```

### Afternoon (5h) - Upgrade Prompts
**File: `src/components/subscription/UpgradePrompt.tsx`**
```tsx
import { Crown, Zap, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface UpgradePromptProps {
  open: boolean;
  onClose: () => void;
  feature: 'events' | 'ai' | 'modules' | 'analytics' | 'recurring';
  currentUsage?: number;
  limit?: number;
}

const featureMessages = {
  events: {
    title: 'Event Limit Reached',
    description: 'You\'ve used all 50 events this month.',
    benefit: 'Upgrade to Pro for unlimited events!',
  },
  ai: {
    title: 'AI Requests Exhausted',
    description: 'You\'ve used all 10 AI requests this month.',
    benefit: 'Upgrade to Pro for unlimited AI assistance!',
  },
  modules: {
    title: 'Module Limit Reached',
    description: 'Free users can only have 3 active modules.',
    benefit: 'Upgrade to Pro to unlock all modules!',
  },
  analytics: {
    title: 'Premium Feature',
    description: 'Advanced analytics is a Pro feature.',
    benefit: 'Upgrade to unlock detailed productivity insights!',
  },
  recurring: {
    title: 'Premium Feature',
    description: 'Recurring events is a Pro feature.',
    benefit: 'Upgrade to create recurring schedules!',
  },
};

export function UpgradePrompt({ open, onClose, feature, currentUsage, limit }: UpgradePromptProps) {
  const navigate = useNavigate();
  const message = featureMessages[feature];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 flex items-center justify-center">
            <Crown className="w-6 h-6 text-white" />
          </div>
          <DialogTitle className="text-center">{message.title}</DialogTitle>
          <DialogDescription className="text-center">
            {message.description}
            {currentUsage !== undefined && limit !== undefined && (
              <span className="block mt-2 text-sm">
                Usage: {currentUsage}/{limit}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>
        
        <div className="bg-gradient-to-r from-primary/10 to-primary/5 rounded-lg p-4 my-4">
          <div className="flex items-center gap-2 text-primary font-medium">
            <Zap className="w-4 h-4" />
            {message.benefit}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Button 
            onClick={() => {
              onClose();
              navigate('/pricing');
            }}
            className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600"
          >
            Upgrade to Pro
            <ArrowRight className="ml-2 w-4 h-4" />
          </Button>
          <Button variant="ghost" onClick={onClose}>
            Maybe Later
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

**Integrate into key components:**
- [ ] Add to `use-calendar-events.ts` → check before `addEvent`
- [ ] Add to Mally AI → check before AI request
- [ ] Add to ModuleSelector → check before adding module
- [ ] Add to EventForm → show if limit reached

---

## Day 4: Integrate Limits Throughout App (8h)

### Tasks:
- [ ] Update `use-calendar-events.ts`:
```typescript
const addEvent = async (event) => {
  if (!limits.canCreateEvent && !isUnlimited) {
    showUpgradePrompt('events');
    return { success: false, error: 'limit_reached' };
  }
  // ... existing logic
  await incrementEventCount();
};
```

- [ ] Update Mally AI request handler
- [ ] Update ModuleSelector.tsx
- [ ] Block recurring events for free users
- [ ] Block advanced analytics for free users
- [ ] Add usage badge to sidebar showing remaining
- [ ] Test all limit enforcement

---

## Day 5: Billing Portal & Management (8h)

### Tasks:
- [ ] Implement Stripe Customer Portal redirect
- [ ] Add "Manage Subscription" button to Settings
- [ ] Show current plan in Settings
- [ ] Show usage statistics
- [ ] Handle subscription cancellation
- [ ] Handle payment method updates
- [ ] Test upgrade/downgrade flows

---

## Day 6-7: Testing & Bug Fixes (16h)

### Tasks:
- [ ] Test free → pro upgrade flow
- [ ] Test pro → free downgrade
- [ ] Test webhook handling
- [ ] Test usage limit enforcement
- [ ] Test subscription status in real-time
- [ ] Fix any security issues found
- [ ] Fix any payment issues
- [ ] Document all Stripe configuration

---

# 📅 WEEK 2: MOBILE, NOTIFICATIONS & AI (Days 8-14)

## Day 8: PWA Install & Offline (10h)

### Morning (5h) - PWA Install Prompt
**File: `src/components/pwa/InstallPrompt.tsx`**
```tsx
import { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      // Show prompt after 30 seconds
      setTimeout(() => setShowPrompt(true), 30000);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setIsInstalled(true);
    }
    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  if (isInstalled || !showPrompt) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 md:left-auto md:right-4 md:w-80 bg-background border rounded-lg shadow-lg p-4 z-50">
      <button 
        onClick={() => setShowPrompt(false)}
        className="absolute top-2 right-2 text-muted-foreground hover:text-foreground"
      >
        <X size={16} />
      </button>
      
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center shrink-0">
          <Download className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h3 className="font-semibold">Install Malleabite</h3>
          <p className="text-sm text-muted-foreground mb-3">
            Add to home screen for quick access & offline use
          </p>
          <Button size="sm" onClick={handleInstall}>
            Install App
          </Button>
        </div>
      </div>
    </div>
  );
}
```

### Afternoon (5h) - Integrate Offline Mode
**Tasks:**
- [ ] Connect `use-offline-mode.ts` to calendar events
- [ ] Add offline indicator to header
- [ ] Implement sync queue for pending changes
- [ ] Show "Saved locally" toast when offline
- [ ] Auto-sync when back online
- [ ] Test offline event creation

---

## Day 9: Push Notifications (10h)

### Morning (5h) - Browser Notifications Setup
**File: `src/hooks/use-push-notifications.ts`**
```typescript
import { useState, useEffect, useCallback } from 'react';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '@/integrations/firebase/config';
import { useAuth } from '@/contexts/AuthContext.unified';

export function usePushNotifications() {
  const { user } = useAuth();
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    setPermission(Notification.permission);
  }, []);

  const requestPermission = useCallback(async () => {
    try {
      const result = await Notification.requestPermission();
      setPermission(result);

      if (result === 'granted') {
        const messaging = getMessaging();
        const fcmToken = await getToken(messaging, {
          vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
        });

        setToken(fcmToken);

        // Save token to user's document
        if (user && fcmToken) {
          await setDoc(doc(db, 'users', user.uid), {
            fcmTokens: { [fcmToken]: true },
          }, { merge: true });
        }

        return fcmToken;
      }
    } catch (error) {
      console.error('Failed to get notification permission:', error);
    }
    return null;
  }, [user]);

  // Listen for foreground messages
  useEffect(() => {
    if (permission !== 'granted') return;

    const messaging = getMessaging();
    const unsubscribe = onMessage(messaging, (payload) => {
      // Show notification using Notification API
      if (payload.notification) {
        new Notification(payload.notification.title || 'Malleabite', {
          body: payload.notification.body,
          icon: '/icon-192.png',
        });
      }
    });

    return () => unsubscribe();
  }, [permission]);

  return {
    permission,
    token,
    requestPermission,
    isSupported: 'Notification' in window,
  };
}
```

### Afternoon (5h) - Notification Triggers
**Tasks:**
- [ ] Create Cloud Function for scheduled reminders
- [ ] Trigger notification 15min before events
- [ ] Trigger notification for alarms
- [ ] Add notification preferences to Settings
- [ ] Test notifications on mobile & desktop

---

## Day 10: Mobile Gestures & Touch (10h)

### Morning (5h) - Swipe Navigation
**File: `src/hooks/use-swipe-navigation.ts`**
```typescript
import { useState, useCallback, useRef } from 'react';
import { useDateStore } from '@/lib/store';
import dayjs from 'dayjs';

export function useSwipeNavigation() {
  const { userSelectedDate, setUserSelectedDate } = useDateStore();
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    touchEndX.current = e.touches[0].clientX;
  }, []);

  const handleTouchEnd = useCallback(() => {
    const diff = touchStartX.current - touchEndX.current;
    const threshold = 50; // Minimum swipe distance

    if (Math.abs(diff) > threshold) {
      if (diff > 0) {
        // Swipe left - go to next day/week
        setUserSelectedDate(userSelectedDate.add(1, 'day'));
      } else {
        // Swipe right - go to previous day/week
        setUserSelectedDate(userSelectedDate.subtract(1, 'day'));
      }
      
      // Haptic feedback if supported
      if ('vibrate' in navigator) {
        navigator.vibrate(10);
      }
    }
  }, [userSelectedDate, setUserSelectedDate]);

  return {
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
  };
}
```

### Afternoon (5h) - Pull to Refresh & Haptics
**Tasks:**
- [ ] Add pull-to-refresh to calendar views
- [ ] Add swipe-to-delete for events
- [ ] Add haptic feedback on interactions
- [ ] Improve touch targets (min 44px)
- [ ] Test on actual mobile devices

---

## Day 11: Mally AI Enhancement (10h)

### Morning (5h) - Ensure AI Actually Works
**Tasks:**
- [ ] Verify Gemini API key is configured
- [ ] Test all AI commands:
  - Event creation
  - Todo management
  - Alarm management
  - Recurring events
- [ ] Improve error handling
- [ ] Add typing indicator
- [ ] Cache common responses

### Afternoon (5h) - Smart Features
**Tasks:**
- [ ] Implement conflict detection
- [ ] Add smart time suggestions
- [ ] Implement "find time" feature
- [ ] Add productivity tips
- [ ] Test AI with complex queries

---

## Day 12: Recurring Events Edit (8h)

### Tasks:
**File: `src/components/calendar/RecurringEventEditDialog.tsx`**
```tsx
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Calendar, CalendarDays, Repeat } from 'lucide-react';

interface RecurringEventEditDialogProps {
  open: boolean;
  onClose: () => void;
  onEditThis: () => void;
  onEditAll: () => void;
  onEditFuture: () => void;
}

export function RecurringEventEditDialog({
  open,
  onClose,
  onEditThis,
  onEditAll,
  onEditFuture,
}: RecurringEventEditDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Recurring Event</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-2 mt-4">
          <Button
            variant="outline"
            className="justify-start h-auto py-3"
            onClick={() => { onEditThis(); onClose(); }}
          >
            <Calendar className="mr-3 h-5 w-5" />
            <div className="text-left">
              <div className="font-medium">This event only</div>
              <div className="text-sm text-muted-foreground">
                Changes won't affect other occurrences
              </div>
            </div>
          </Button>

          <Button
            variant="outline"
            className="justify-start h-auto py-3"
            onClick={() => { onEditFuture(); onClose(); }}
          >
            <CalendarDays className="mr-3 h-5 w-5" />
            <div className="text-left">
              <div className="font-medium">This and future events</div>
              <div className="text-sm text-muted-foreground">
                Changes apply to all future occurrences
              </div>
            </div>
          </Button>

          <Button
            variant="outline"
            className="justify-start h-auto py-3"
            onClick={() => { onEditAll(); onClose(); }}
          >
            <Repeat className="mr-3 h-5 w-5" />
            <div className="text-left">
              <div className="font-medium">All events</div>
              <div className="text-sm text-muted-foreground">
                Changes apply to all occurrences
              </div>
            </div>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] Integrate dialog into event editing flow
- [ ] Implement exception handling for single instance edits
- [ ] Test all three edit modes

---

## Day 13: Agenda View (8h)

**File: `src/components/agenda-view.tsx`**
```tsx
import { useMemo } from 'react';
import dayjs from 'dayjs';
import { useCalendarEvents } from '@/hooks/use-calendar-events';
import { useDateStore } from '@/lib/store';
import { CalendarEventType } from '@/lib/stores/types';
import { ScrollArea } from '@/components/ui/scroll-area';
import CalendarEvent from './calendar/CalendarEvent';

export default function AgendaView() {
  const { events } = useCalendarEvents();
  const { userSelectedDate } = useDateStore();

  // Group events by date for next 30 days
  const groupedEvents = useMemo(() => {
    const start = userSelectedDate.startOf('day');
    const end = start.add(30, 'day');
    
    const filtered = events.filter(event => {
      const eventDate = dayjs(event.date);
      return eventDate.isAfter(start) && eventDate.isBefore(end);
    });

    const grouped: Record<string, CalendarEventType[]> = {};
    
    filtered.forEach(event => {
      const dateKey = event.date;
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(event);
    });

    // Sort each day's events by time
    Object.keys(grouped).forEach(date => {
      grouped[date].sort((a, b) => {
        return (a.startsAt || '').localeCompare(b.startsAt || '');
      });
    });

    return grouped;
  }, [events, userSelectedDate]);

  const sortedDates = Object.keys(groupedEvents).sort();

  return (
    <div className="glass mx-2 my-2 rounded-xl overflow-hidden">
      <div className="p-4 border-b border-white/10">
        <h2 className="text-xl font-bold">Upcoming Events</h2>
        <p className="text-sm text-muted-foreground">Next 30 days</p>
      </div>

      <ScrollArea className="h-[calc(100vh-200px)]">
        <div className="p-4 space-y-6">
          {sortedDates.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No upcoming events
            </div>
          ) : (
            sortedDates.map(date => {
              const dateObj = dayjs(date);
              const isToday = dateObj.isSame(dayjs(), 'day');
              const isTomorrow = dateObj.isSame(dayjs().add(1, 'day'), 'day');

              return (
                <div key={date}>
                  <div className="sticky top-0 bg-background/80 backdrop-blur py-2 mb-2">
                    <h3 className="font-semibold">
                      {isToday ? 'Today' : isTomorrow ? 'Tomorrow' : dateObj.format('dddd, MMMM D')}
                    </h3>
                  </div>
                  <div className="space-y-2">
                    {groupedEvents[date].map(event => (
                      <div key={event.id} className="pl-4 border-l-2 border-primary/50">
                        <CalendarEvent event={event} variant="compact" />
                      </div>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
```

- [ ] Add Agenda view to view selector
- [ ] Style for mobile
- [ ] Add quick actions (edit, delete)

---

## Day 14: Testing & Polish Week 2 (8h)

### Tasks:
- [ ] Test PWA install on iOS Safari
- [ ] Test PWA install on Android Chrome
- [ ] Test offline mode
- [ ] Test push notifications
- [ ] Test swipe gestures
- [ ] Test Mally AI all commands
- [ ] Fix any UI issues on mobile
- [ ] Performance testing

---

# 📅 WEEK 3: TESTING, POLISH & LAUNCH (Days 15-21)

## Day 15-16: Unit Tests (16h)

### Focus Areas:
- [ ] Test `use-subscription.ts`
- [ ] Test `use-usage-limits.ts`
- [ ] Test `use-calendar-events.ts`
- [ ] Test `dragdropHandlers.ts`
- [ ] Test `recurring-events.ts`
- [ ] Target: 30% coverage minimum

**Example test file:**
```typescript
// src/hooks/use-subscription.test.ts
import { renderHook, waitFor } from '@testing-library/react';
import { useSubscription } from './use-subscription';

describe('useSubscription', () => {
  it('returns free plan for new users', async () => {
    const { result } = renderHook(() => useSubscription());
    
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    
    expect(result.current.subscription?.isFree).toBe(true);
  });

  it('identifies pro users correctly', async () => {
    // Mock Firestore with pro subscription
    const { result } = renderHook(() => useSubscription());
    
    await waitFor(() => {
      expect(result.current.subscription?.isPro).toBe(true);
    });
  });
});
```

---

## Day 17: E2E Tests (8h)

### Critical Flows to Test:
- [ ] User signup → onboarding → calendar
- [ ] Create event → edit → delete
- [ ] Drag todo to calendar
- [ ] Free user hits limit → upgrade prompt
- [ ] Checkout flow (test mode)
- [ ] Mobile navigation

**Playwright test example:**
```typescript
// tests/subscription.spec.ts
import { test, expect } from '@playwright/test';

test('free user sees upgrade prompt when limit reached', async ({ page }) => {
  await page.goto('/calendar');
  
  // Create 50 events
  for (let i = 0; i < 50; i++) {
    await page.click('[data-testid="add-event"]');
    await page.fill('[name="title"]', `Event ${i}`);
    await page.click('[data-testid="save-event"]');
  }
  
  // Try to create 51st event
  await page.click('[data-testid="add-event"]');
  
  // Should see upgrade prompt
  await expect(page.locator('text=Event Limit Reached')).toBeVisible();
});
```

---

## Day 18: Cross-Browser & Mobile Testing (8h)

### Browsers:
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)

### Devices:
- [ ] iPhone 12/13/14 (Safari)
- [ ] iPhone SE (small screen)
- [ ] Samsung Galaxy S21 (Chrome)
- [ ] iPad (tablet layout)
- [ ] Android tablet

### Test Matrix:
| Feature | Chrome | Firefox | Safari | Edge | Mobile |
|---------|--------|---------|--------|------|--------|
| Login | | | | | |
| Calendar views | | | | | |
| Drag & drop | | | | | |
| AI chat | | | | | |
| Checkout | | | | | |
| Notifications | | | | | |

---

## Day 19: Performance & Accessibility (8h)

### Performance:
- [ ] Run Lighthouse audit (target 90+)
- [ ] Bundle size analysis
- [ ] Lazy load heavy components
- [ ] Optimize images
- [ ] Add loading states

### Accessibility:
- [ ] Keyboard navigation
- [ ] Screen reader testing
- [ ] Color contrast
- [ ] Focus indicators
- [ ] ARIA labels

---

## Day 20: Monitoring Setup (8h)

### Tasks:
- [ ] Set up Sentry for error tracking
- [ ] Configure performance monitoring
- [ ] Set up uptime monitoring (UptimeRobot)
- [ ] Add analytics (Plausible/PostHog)
- [ ] Create alerts for critical errors
- [ ] Set up log aggregation

---

## Day 21: Final Deployment (8h)

### Pre-Deploy Checklist:
- [ ] All tests passing
- [ ] No console errors
- [ ] Environment variables set in Vercel
- [ ] Firebase rules deployed
- [ ] Cloud Functions deployed
- [ ] Stripe in live mode
- [ ] DNS configured
- [ ] SSL working

### Deploy Steps:
```bash
# 1. Final build
npm run build

# 2. Deploy Firebase
firebase deploy --only firestore:rules,functions

# 3. Deploy to Vercel
vercel --prod

# 4. Verify production
# - Test login
# - Test event creation
# - Test checkout
# - Test notifications
```

### Post-Deploy:
- [ ] Monitor error rates
- [ ] Check performance metrics
- [ ] Verify Stripe webhooks
- [ ] Test on production URL
- [ ] Announce launch! 🚀

---

# 📊 DAILY TRACKER

Copy this for each day:

```markdown
## Day X: [Date]

### Planned:
- [ ] Task 1
- [ ] Task 2
- [ ] Task 3

### Completed:
- [x] 

### Blockers:
- 

### Notes:
- 

### Tomorrow:
- 
```

---

# 🎯 SUCCESS CRITERIA

## Launch Readiness Checklist:

### Security ✅
- [ ] No exposed API keys
- [ ] Firestore rules hardened
- [ ] App Check enabled
- [ ] Rate limiting active

### Monetization ✅
- [ ] Stripe checkout works
- [ ] Webhooks processing
- [ ] Usage limits enforced
- [ ] Upgrade prompts showing

### Mobile ✅
- [ ] PWA installable
- [ ] Offline mode works
- [ ] Touch gestures work
- [ ] Notifications work

### Quality ✅
- [ ] No critical bugs
- [ ] Lighthouse 90+
- [ ] 30%+ test coverage
- [ ] Error tracking active

---

**START NOW. EVERY HOUR COUNTS.**
