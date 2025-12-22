# ⚡ Malleabite - Quick Reference Card
**Print this and keep it visible while coding**

---

## 📍 WHERE ARE WE?

```
Progress: ████████████░░░░░░░░░░░░ 52%
Status:   IN DEVELOPMENT - Production Track
Target:   Real SaaS Product (Not a prototype!)
```

---

## 🎯 TODAY'S PRIORITY (Check Daily)

Current Phase: **Phase 1 - Critical Blockers**  
Current Week: **Week 1 - Security & Environment**

**This Week's Goal:**  
🔐 Make app secure and deployable

---

## 🚨 CRITICAL BLOCKERS (Fix First!)

1. ❌ **API Keys Exposed** → `src/integrations/firebase/config.ts`
2. ❌ **Gemini API Missing** → `firebase/functions/index.js`
3. ❌ **No Payment System** → Blocks monetization
4. ❌ **No Usage Limits** → Free tier unlimited
5. ❌ **No Privacy Policy** → Blocks worldwide launch

---

## 📊 TRACKING DOCS (Update After Each Feature!)

```
📁 MASTER_ROADMAP.md               ← Start here
📁 FEATURE_IMPLEMENTATION_TRACKING.md  ← Daily updates
📁 SUBSCRIPTION_FEATURE_PARITY.md      ← Weeks 3-6
📁 MOBILE_FIRST_GUIDE.md               ← Weeks 6-8
📁 PRODUCTION_READINESS_REPORT.md      ← Pre-launch
```

---

## 🎨 DEVELOPMENT RULES

### ✅ ALWAYS
- Mobile-first design (60% of users!)
- Test on real mobile device
- Use environment variables
- Update tracking docs
- Write clear commit messages
- Check TypeScript errors
- Minimum 44px touch targets

### ❌ NEVER
- Hardcode API keys
- Skip mobile testing
- Ignore TypeScript errors
- Make up placeholder values
- Ship without testing
- Forget to update docs
- Use inline styles

---

## 🏗️ CODE PATTERNS

### New Feature Checklist
```
1. [ ] Create mobile version first
2. [ ] Add desktop enhancements
3. [ ] Write TypeScript interfaces
4. [ ] Add error boundaries
5. [ ] Test on iPhone/Android
6. [ ] Update tracking doc
7. [ ] Commit with clear message
```

### Component Structure
```tsx
// Mobile-first pattern
export function MyComponent() {
  const isMobile = useIsMobile();
  
  // Mobile version (default)
  if (isMobile) {
    return <MobileView />;
  }
  
  // Desktop enhancement
  return <DesktopView />;
}
```

### Subscription Check Pattern
```tsx
const { tier, hasFeatureAccess } = useSubscription();

if (!hasFeatureAccess('premium-feature')) {
  return <UpgradePrompt />;
}

return <PremiumFeature />;
```

---

## 🎯 CURRENT SPRINT (Week 1)

### Day-by-Day Plan
```
Mon: Create .env, move Firebase keys
Tue: Move remaining API keys, rotate credentials
Wed: Configure Gemini API key
Thu: Harden Firestore rules
Fri: Enable Firebase App Check
Sat: Test all security measures
Sun: Review & document
```

---

## 📱 MOBILE REQUIREMENTS

### Screen Sizes to Support
```
iPhone SE:     375 x 667px  (4.7")
iPhone 13:     390 x 844px  (6.1")
iPhone 14 Pro: 393 x 852px  (6.1")
Pixel 6:       412 x 915px  (6.4")
Galaxy S22:    360 x 800px  (6.1")
```

### Breakpoints
```css
Mobile:  < 768px  (default)
Tablet:  768px - 1023px
Desktop: ≥ 1024px
```

### Touch Targets
```
Minimum: 44x44px (iOS) / 48x48px (Android)
Ideal:   56x56px
Padding: 8-12px minimum
```

---

## 🔐 SECURITY CHECKLIST (Week 1)

```
[ ] All API keys in .env
[ ] .env in .gitignore
[ ] Firebase keys rotated
[ ] Firestore rules hardened
[ ] App Check enabled
[ ] No console.log with sensitive data
[ ] Input sanitization active
[ ] HTTPS only
```

---

## 💰 MONETIZATION TIERS (Weeks 3-5)

```
FREE ($0/mo):
  ✓ 50 events/month
  ✓ 3 modules max
  ✓ 10 AI requests/month
  ✗ No analytics
  ✗ No recurring events
  ✗ No Eisenhower Matrix

PRO ($9.99/mo):
  ✓ Unlimited everything
  ✓ All features
  ✓ Priority support

TEAMS ($7/user/mo):
  ✓ Everything in Pro
  ✓ Team workspaces
  ✓ Shared calendars
  ✓ Admin controls
```

---

## 🧪 TESTING REQUIREMENTS

### Before Commit
```
[ ] Runs without errors
[ ] Mobile responsive
[ ] TypeScript passes
[ ] No hardcoded secrets
```

### Before Merge
```
[ ] Works on mobile
[ ] Works on desktop
[ ] Tests written (if applicable)
[ ] Docs updated
```

### Before Deploy
```
[ ] All tests pass
[ ] Lighthouse 90+
[ ] Mobile device tested
[ ] Security scan passes
```

---

## 📈 SUCCESS METRICS

### Week 1 (Security)
```
Target: All API keys secured
Target: Firestore rules hardened
Target: Zero security vulnerabilities
```

### Week 5 (Monetization)
```
Target: Stripe integration working
Target: Free tier limits enforced
Target: First test subscription completed
```

### Week 10 (Launch)
```
Target: 50 beta users
Target: First paying customer
Target: 99.9% uptime
```

---

## 🆘 WHEN STUCK

1. Check `FEATURE_IMPLEMENTATION_TRACKING.md`
2. Review existing code patterns
3. Test on mobile device
4. Ask AI assistant
5. Take a 15-minute break
6. Come back fresh

---

## 🎯 DAILY ROUTINE

### Morning (30 min)
```
1. Review MASTER_ROADMAP.md
2. Check today's tasks
3. Review critical blockers
4. Set 3-5 goals for today
```

### During Day
```
- Code in 90-minute sprints
- Test on mobile every hour
- Commit after each feature
- Update tracking docs
```

### Evening (15 min)
```
1. Update completion percentages
2. Document blockers
3. Commit all changes
4. Plan tomorrow
```

---

## 🎨 DESIGN TOKENS

### Colors
```css
Primary:    #8b5cf6 (purple)
Secondary:  #3b82f6 (blue)
Success:    #10b981 (green)
Error:      #ef4444 (red)
Warning:    #f59e0b (yellow)
Background: #0a0a0a (dark)
```

### Spacing (Tailwind)
```
xs:  0.25rem (4px)
sm:  0.5rem  (8px)
md:  1rem    (16px)
lg:  1.5rem  (24px)
xl:  2rem    (32px)
```

### Typography
```
xs:   0.75rem  (12px)
sm:   0.875rem (14px)
base: 1rem     (16px)
lg:   1.125rem (18px)
xl:   1.25rem  (20px)
```

---

## 🚀 LAUNCH TIMELINE

```
Week 1-2:  Security & Legal      [CURRENT]
Week 3-5:  Subscription System
Week 6-7:  Mobile Polish
Week 8-9:  Production Ready
Week 10:   Beta Launch
Week 11-12: Advanced Features
Week 13:   PUBLIC LAUNCH 🎉
```

---

## 💪 MOTIVATION

```
"We're building a REAL product
 for REAL people
 who will pay REAL money."

Current:  52% Complete
Target:   March 13, 2026
Revenue:  $0 → $15K MRR (Month 6)

Every line of code matters.
Every user interaction matters.
Every security decision matters.

Let's ship it! 🚀
```

---

## 📞 QUICK CONTACTS

```
Firebase Console: https://console.firebase.google.com
Stripe Dashboard:  https://dashboard.stripe.com
GitHub Repo:       [Your repo URL]
Tracking Docs:     ./MASTER_ROADMAP.md
AI Assistant:      Always available!
```

---

**Last Updated:** December 20, 2025  
**Print Date:** _____________  
**Current Phase:** Phase 1 - Week 1

---

## ✨ REMEMBER

```
Mobile First  |  Security First  |  Users First
```

**You've got this! 💪**
