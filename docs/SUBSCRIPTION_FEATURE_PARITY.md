# 🎯 Subscription Feature Parity Tracker
**App:** Malleabite  
**Last Updated:** December 20, 2025  
**Purpose:** Track implementation of promised subscription features

---

## 📊 QUICK REFERENCE

| Feature | Free Tier | Pro Tier | Teams Tier | Status | Priority |
|---------|-----------|----------|------------|--------|----------|
| Calendar Events | 50/month | Unlimited | Unlimited | ⚠️ No limits | P0 |
| Productivity Modules | 3 max | Unlimited | Unlimited | ⚠️ No limits | P0 |
| Mally AI Requests | 10/month | Unlimited | Unlimited | ⚠️ No limits | P0 |
| Analytics Dashboard | ❌ | ✅ | ✅ | ✅ Exists | P1 |
| Recurring Events | ❌ | ✅ | ✅ | ✅ Exists | P1 |
| Eisenhower Matrix | ❌ | ✅ | ✅ | ✅ Exists | P1 |
| Bulk Operations | ❌ | ✅ | ✅ | ⚠️ Partial | P2 |
| Custom Pomodoro | ❌ | ✅ | ✅ | ✅ Exists | P2 |
| Event Templates | ❌ | ✅ | ✅ | ✅ Exists | P2 |
| Calendar Export | ❌ | ✅ | ✅ | ✅ Exists | P2 |
| Color Categories | 3 colors | 7+ colors | 7+ colors | ✅ Exists | P3 |
| Team Workspaces | ❌ | ❌ | ✅ | ❌ Missing | P2 |
| Shared Calendars | ❌ | ❌ | ✅ | ❌ Missing | P2 |
| Team Analytics | ❌ | ❌ | ✅ | ❌ Missing | P3 |
| Admin Controls | ❌ | ❌ | ✅ | ❌ Missing | P3 |

**Legend:**  
- ✅ Fully Implemented  
- ⚠️ Partially Implemented / No Enforcement  
- ❌ Not Implemented  
- P0 = Critical (blocks monetization)  
- P1 = High (promised feature)  
- P2 = Medium (nice to have)  
- P3 = Low (future enhancement)

---

## 🆓 FREE TIER - "Malleabite Basic"

### ✅ Features That SHOULD Work
1. **Core Calendar** (Month/Week/Day views) - ✅ WORKING
2. **Up to 3 Productivity Modules** - ⚠️ NO LIMIT ENFORCEMENT
3. **Basic Todo Lists** (1 list, 50 tasks max) - ⚠️ NO LIMIT ENFORCEMENT
4. **Pomodoro Timer** (standard 25/5 min) - ✅ WORKING
5. **Up to 50 Calendar Events/Month** - ⚠️ NO LIMIT ENFORCEMENT
6. **Limited AI** (10 Mally AI requests/month) - ⚠️ NO LIMIT ENFORCEMENT
7. **Mobile Responsive Web App** - ✅ WORKING

### ❌ Features That SHOULD NOT Work (Must Block)
1. **Analytics Dashboard** - ❌ CURRENTLY ACCESSIBLE (should be blocked)
2. **Recurring Events** - ❌ CURRENTLY ACCESSIBLE (should be blocked)
3. **Eisenhower Matrix** - ❌ CURRENTLY ACCESSIBLE (should be blocked)
4. **Bulk Operations** - ⚠️ PARTIALLY ACCESSIBLE (should be blocked)
5. **Multiple Todo Lists** - ❌ CURRENTLY ACCESSIBLE (should be limited to 1)
6. **Advanced Alarms** - ❌ CURRENTLY ACCESSIBLE (should be limited)
7. **Event Templates** - ❌ CURRENTLY ACCESSIBLE (should be blocked)
8. **Calendar Export** - ❌ CURRENTLY ACCESSIBLE (should be blocked)

### 🚧 IMPLEMENTATION REQUIRED

#### 1. Usage Tracking System
**File to Create:** `src/lib/usage-tracker.ts`
```typescript
interface UsageStats {
  userId: string;
  period: string; // YYYY-MM
  eventsCreated: number;
  aiRequestsMade: number;
  modulesUsed: string[];
  lastReset: Date;
}
```

**Database Collection:** `user_usage_stats`
- Track events created per month
- Track AI requests per month
- Track active modules
- Reset monthly

#### 2. Feature Flag System
**File to Create:** `src/lib/subscription/feature-flags.ts`
```typescript
enum SubscriptionTier {
  FREE = 'free',
  PRO = 'pro',
  TEAMS = 'teams'
}

interface FeatureAccess {
  analytics: boolean;
  recurringEvents: boolean;
  eisenhowerMatrix: boolean;
  bulkOperations: boolean;
  unlimitedEvents: boolean;
  unlimitedAI: boolean;
  unlimitedModules: boolean;
  // ... more features
}

function getFeatureAccess(tier: SubscriptionTier): FeatureAccess
```

**Database Collection:** `user_subscriptions`
```typescript
interface UserSubscription {
  userId: string;
  tier: 'free' | 'pro' | 'teams';
  status: 'active' | 'cancelled' | 'expired' | 'trial';
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  teamId?: string; // For teams tier
}
```

#### 3. UI Blockers for Free Tier
**Files to Create/Modify:**

`src/components/subscription/UpgradePrompt.tsx`
- Modal when feature is blocked
- Show what they're missing
- Upgrade CTA button

`src/components/subscription/UsageMeter.tsx`
- Show events: 45/50
- Show AI requests: 8/10
- Warn when approaching limits

**Modifications Needed:**
- `src/pages/Analytics.tsx` - Block if tier = free
- `src/components/modules/EisenhowerModule.tsx` - Block if tier = free
- `src/components/calendar/*` - Check event limit before creation
- `src/components/ai/*` - Check AI limit before request
- `src/components/modules/ModuleSelector.tsx` - Limit to 3 modules

#### 4. Limit Enforcement Hooks
**File to Create:** `src/hooks/use-subscription-limits.ts`
```typescript
export function useSubscriptionLimits() {
  const canCreateEvent = async (): Promise<boolean>
  const canMakeAIRequest = async (): Promise<boolean>
  const canAddModule = async (): Promise<boolean>
  const getRemainingEvents = async (): Promise<number>
  const getRemainingAIRequests = async (): Promise<number>
}
```

---

## 💎 PRO TIER - "Malleabite Pro" ($9.99/month)

### ✅ Features That SHOULD Work (All Free + These)
1. **Unlimited Calendar Events** - ✅ EXISTS, needs enforcement removal
2. **Unlimited Productivity Modules** - ✅ EXISTS, needs enforcement removal
3. **Unlimited Todo Lists** - ✅ EXISTS
4. **Full Mally AI Access** (unlimited) - ✅ EXISTS, needs enforcement removal
5. **Eisenhower Matrix** - ✅ EXISTS
6. **Analytics Dashboard** - ✅ EXISTS
7. **Recurring Events** - ✅ EXISTS
8. **Custom Pomodoro Intervals** - ✅ EXISTS
9. **Bulk Operations** - ⚠️ PARTIALLY EXISTS
10. **Event Templates & Patterns** - ✅ EXISTS
11. **Advanced Alarms & Reminders** - ✅ EXISTS
12. **Color-Coded Categories** (7+ colors) - ✅ EXISTS
13. **Export Calendar Data** - ✅ EXISTS
14. **Priority Support Badge** - ❌ MISSING

### 🚧 IMPLEMENTATION REQUIRED

#### 1. Unlock Mechanism
When user upgrades to Pro:
- Remove all usage limits
- Unlock all blocked features
- Add "Pro" badge to UI
- Enable priority support indicator

**File to Create:** `src/lib/subscription/unlock-features.ts`
```typescript
async function upgradeUserToPro(userId: string, stripeSubscriptionId: string)
```

#### 2. Pro Badge Component
**File to Create:** `src/components/subscription/ProBadge.tsx`
- Show in header
- Show in settings
- Show in support tickets

#### 3. Feature Access Check
**Modify:** All feature components to check tier
```typescript
const { tier, hasFeatureAccess } = useSubscription();

if (!hasFeatureAccess('analytics')) {
  return <UpgradePrompt feature="Analytics Dashboard" />;
}
```

---

## 👥 TEAMS TIER - "Malleabite Teams" ($7/user/month)

### ✅ Features That SHOULD Work (All Pro + These)
1. **Shared Team Calendars** - ❌ NOT IMPLEMENTED
2. **Collaborative Event Invites** - ⚠️ BASIC INVITES EXIST (needs team context)
3. **Team Analytics & Reports** - ❌ NOT IMPLEMENTED
4. **Admin Controls & Permissions** - ❌ NOT IMPLEMENTED
5. **Centralized Billing** - ❌ NOT IMPLEMENTED
6. **Team Templates & Workflows** - ⚠️ TEMPLATES EXIST (needs sharing)
7. **Priority + Dedicated Support** - ❌ NOT IMPLEMENTED

### 🚧 IMPLEMENTATION REQUIRED (Major Features)

#### 1. Team Workspace System
**Database Collections to Create:**

`teams`
```typescript
interface Team {
  id: string;
  name: string;
  ownerId: string;
  createdAt: Date;
  plan: 'teams';
  stripeCustomerId: string;
  maxSeats: number;
  usedSeats: number;
}
```

`team_members`
```typescript
interface TeamMember {
  id: string;
  teamId: string;
  userId: string;
  role: 'owner' | 'admin' | 'member';
  permissions: string[];
  joinedAt: Date;
  invitedBy: string;
}
```

`team_calendars`
```typescript
interface TeamCalendar {
  id: string;
  teamId: string;
  name: string;
  description: string;
  color: string;
  permissions: {
    userId: string;
    canView: boolean;
    canEdit: boolean;
    canDelete: boolean;
  }[];
}
```

#### 2. Team UI Components
**Files to Create:**

`src/pages/Teams.tsx` - Team management page
`src/components/teams/TeamWorkspace.tsx` - Team workspace view
`src/components/teams/TeamMemberList.tsx` - Member management
`src/components/teams/TeamInvite.tsx` - Invite members
`src/components/teams/TeamPermissions.tsx` - Permission management
`src/components/teams/TeamBilling.tsx` - Team billing page
`src/components/teams/TeamAnalytics.tsx` - Team analytics

#### 3. Permission System
**File to Create:** `src/lib/teams/permissions.ts`
```typescript
enum Permission {
  VIEW_CALENDAR = 'view_calendar',
  EDIT_CALENDAR = 'edit_calendar',
  DELETE_EVENTS = 'delete_events',
  MANAGE_MEMBERS = 'manage_members',
  VIEW_ANALYTICS = 'view_analytics',
  MANAGE_BILLING = 'manage_billing',
}

function hasPermission(userId: string, teamId: string, permission: Permission): boolean
```

#### 4. Team Context
**File to Create:** `src/contexts/TeamContext.tsx`
```typescript
interface TeamContextType {
  currentTeam: Team | null;
  teams: Team[];
  switchTeam: (teamId: string) => void;
  inviteMember: (email: string, role: string) => Promise<void>;
  removeMember: (userId: string) => Promise<void>;
  updatePermissions: (userId: string, permissions: string[]) => Promise<void>;
}
```

#### 5. Multi-Tenancy Support
**Modify:** All data queries to support team context
- Events can belong to user OR team
- Todos can be personal OR team
- Analytics show personal OR team data
- Modules can be personal OR team

---

## 💳 PAYMENT & SUBSCRIPTION INFRASTRUCTURE

### Phase 1: Stripe Setup (Week 3)
**Files to Create:**

1. `src/lib/stripe/config.ts` - Stripe configuration
2. `src/lib/stripe/checkout.ts` - Checkout session creation
3. `src/lib/stripe/webhooks.ts` - Webhook handlers
4. `src/lib/stripe/customer-portal.ts` - Billing portal link
5. `src/lib/stripe/prices.ts` - Product & price IDs

**Environment Variables:**
```
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_SECRET_KEY=sk_live_... (backend only)
STRIPE_WEBHOOK_SECRET=whsec_...
```

**Stripe Products to Create:**
1. **Malleabite Pro**
   - Monthly: $9.99/month (price_pro_monthly)
   - Yearly: $99/year (price_pro_yearly)

2. **Malleabite Teams**
   - Per User: $7/user/month (price_teams_per_seat)
   - Min 3 users
   - Metered billing

### Phase 2: Checkout Flow (Week 3-4)
**UI Components to Create:**

1. `src/pages/Pricing.tsx` - Pricing page with tiers
2. `src/components/subscription/PricingCard.tsx` - Individual tier card
3. `src/components/subscription/CheckoutButton.tsx` - Stripe checkout button
4. `src/components/subscription/UpgradeFlow.tsx` - Upgrade wizard

**Flow:**
1. User clicks "Upgrade to Pro"
2. Redirect to Stripe Checkout
3. User completes payment
4. Webhook updates user tier in database
5. Redirect back to app
6. Features unlocked immediately

### Phase 3: Webhook Handlers (Week 4)
**Firebase Function to Create:** `firebase/functions/src/stripe-webhooks.ts`

**Webhooks to Handle:**
1. `checkout.session.completed` - Activate subscription
2. `customer.subscription.updated` - Update subscription details
3. `customer.subscription.deleted` - Downgrade to free
4. `invoice.payment_succeeded` - Extend subscription period
5. `invoice.payment_failed` - Handle failed payment

**Database Updates:**
- Update `user_subscriptions` collection
- Update `usage_stats` on downgrade
- Send email notifications
- Log all webhook events

### Phase 4: Billing Portal (Week 4)
**Files to Create:**

1. `src/pages/Billing.tsx` - Billing management page
2. `src/components/subscription/SubscriptionStatus.tsx` - Current plan display
3. `src/components/subscription/PaymentMethod.tsx` - Payment method display
4. `src/components/subscription/InvoiceHistory.tsx` - Past invoices
5. `src/components/subscription/CancelSubscription.tsx` - Cancellation flow

**Features:**
- View current plan
- See next billing date
- Update payment method (Stripe portal)
- View invoice history
- Cancel subscription (with retention offer)
- Download invoices

### Phase 5: Usage Dashboard (Week 4-5)
**File to Create:** `src/components/subscription/UsageDashboard.tsx`

**Display:**
- Current tier
- Usage this month (events, AI requests)
- Limits for current tier
- Upgrade CTA if on free tier
- Usage charts over time

---

## 🎯 CRITICAL PATH IMPLEMENTATION ORDER

### Week 3: Foundation
1. ✅ Create database schema for subscriptions
2. ✅ Set up Stripe account and products
3. ✅ Build feature flag system
4. ✅ Create usage tracking system
5. ✅ Build subscription context/hooks

### Week 4: Enforcement
1. ✅ Implement limit checks for free tier
2. ✅ Add upgrade prompts throughout app
3. ✅ Block premium features for free users
4. ✅ Build pricing page
5. ✅ Create checkout flow

### Week 5: Integration
1. ✅ Stripe webhook handlers
2. ✅ Test subscription flows
3. ✅ Billing portal integration
4. ✅ Usage dashboard
5. ✅ Email notifications

### Week 6: Teams (if needed)
1. ✅ Team workspace infrastructure
2. ✅ Team member management
3. ✅ Shared calendar functionality
4. ✅ Team billing
5. ✅ Team analytics

---

## 📝 TESTING CHECKLIST

### Free Tier Testing
- [ ] Can create up to 50 events, then blocked
- [ ] Can make 10 AI requests, then blocked
- [ ] Can only add 3 modules
- [ ] Analytics page shows upgrade prompt
- [ ] Eisenhower Matrix shows upgrade prompt
- [ ] Recurring event creation blocked
- [ ] Bulk operations blocked
- [ ] Export calendar blocked
- [ ] Limits reset monthly

### Pro Tier Testing
- [ ] All limits removed after upgrade
- [ ] Analytics accessible
- [ ] Recurring events work
- [ ] Bulk operations work
- [ ] All modules available
- [ ] Export works
- [ ] Pro badge shows
- [ ] Downgrade flow works

### Teams Tier Testing
- [ ] Team creation works
- [ ] Member invitation works
- [ ] Shared calendars visible to team
- [ ] Permissions enforced
- [ ] Team billing works
- [ ] Per-seat pricing calculated
- [ ] Team analytics shows
- [ ] Member removal works

### Payment Testing
- [ ] Stripe test mode checkout works
- [ ] Webhook events process correctly
- [ ] Subscription activates immediately
- [ ] Failed payment handled
- [ ] Cancellation works
- [ ] Proration calculated correctly
- [ ] Invoice generation works

---

## 🚀 POST-LAUNCH MONITORING

### Metrics to Track
1. **Conversion Rates**
   - Free → Pro conversion rate (target: 5-10%)
   - Time to first upgrade
   - Upgrade trigger points

2. **Usage Patterns**
   - Free tier limit hits per user
   - Feature usage by tier
   - Most common upgrade triggers

3. **Retention**
   - Churn rate by tier
   - Cancellation reasons
   - Failed payment recovery rate

4. **Revenue**
   - MRR (Monthly Recurring Revenue)
   - ARPU (Average Revenue Per User)
   - Lifetime Value (LTV)
   - Customer Acquisition Cost (CAC)

### Optimization Opportunities
- A/B test pricing
- Test different free tier limits
- Optimize upgrade prompts
- Test annual plan discounts
- Refine feature positioning

---

**Last Updated:** December 20, 2025  
**Next Review:** After Week 3 Implementation  
**Owner:** Full-stack Development Team
