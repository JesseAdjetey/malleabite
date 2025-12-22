# Malleabite Testing Quick Reference

Quick guide to running tests and understanding coverage.

---

## 🚀 Commands

### Unit Tests (Vitest)
```bash
npm test                # Watch mode
npm run test:ui         # Interactive UI
npm run test:coverage   # Coverage report
```

### E2E Tests (Playwright)
```bash
npm run playwright:install  # First time only
npm run test:e2e           # Headless (fast)
npm run test:e2e:ui        # Interactive UI
npm run test:e2e:headed    # See browser
```

---

## 📁 Test Structure

```
src/
├── lib/
│   ├── subscription-limits.test.ts   # Plan limits
│   ├── usage-tracker.test.ts         # Usage tracking
│   └── offline-sync.test.ts          # IndexedDB
├── hooks/
│   └── use-subscription.test.ts      # Subscription hook
├── components/calendar/mobile/
│   ├── MobileEventForm.test.tsx      # Event form
│   └── MobileMonthView.test.tsx      # Month view
└── test/
    └── setup.ts                       # Test configuration

tests/e2e/
├── mobile-gestures.spec.ts           # Swipe navigation
├── pwa.spec.ts                       # Offline/PWA
├── subscription.spec.ts              # Pricing flow
└── auth.spec.ts                      # Login/signup
```

---

## 🎯 Coverage Focus

**Subscription System:**
- ✅ Plan limits (FREE/PRO/TEAMS)
- ✅ Usage tracking (events, AI requests)
- ✅ Feature access control

**Mobile/PWA:**
- ✅ Touch targets (44px+)
- ✅ Swipe gestures
- ✅ Offline sync (IndexedDB)
- ✅ Service worker

**Auth & Pricing:**
- ✅ Login/signup flow
- ✅ Email validation
- ✅ Pricing tiers

---

## 🧪 Writing Tests

### Unit Test Template
```typescript
import { describe, it, expect } from 'vitest';

describe('Feature Name', () => {
  it('should do something', () => {
    expect(true).toBe(true);
  });
});
```

### Component Test Template
```typescript
import { render, screen } from '@testing-library/react';

it('should render button', () => {
  render(<MyComponent />);
  expect(screen.getByRole('button')).toBeInTheDocument();
});
```

### E2E Test Template
```typescript
import { test, expect } from '@playwright/test';

test('should navigate', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('h1')).toBeVisible();
});
```

---

## 📊 Coverage Reports

After running `npm run test:coverage`:
```
coverage/
├── index.html      # Open in browser
├── coverage.json   # Raw data
└── lcov.info       # CI integration
```

**View HTML Report:**
```bash
open coverage/index.html  # Mac
start coverage/index.html # Windows
```

---

## 🔧 Debugging Tests

### Vitest
```bash
npm test -- --reporter=verbose  # Detailed output
npm test -- --run              # Run once (no watch)
npm test -- src/lib/           # Run specific folder
```

### Playwright
```bash
npm run test:e2e -- --debug            # Debug mode
npm run test:e2e -- --project=chromium # Single browser
npm run test:e2e -- mobile-gestures    # Single test file
```

---

## 🎓 Best Practices

1. **Test Behavior, Not Implementation:** Focus on what users see/do
2. **Isolate Tests:** No shared state between tests
3. **Mock External Services:** Firebase, Stripe, APIs
4. **Accessibility:** Validate touch targets, ARIA labels
5. **Mobile Testing:** Test on real mobile viewports (Playwright)

---

## 🐛 Common Issues

**Issue:** Firebase errors in tests  
**Fix:** Mocks are in `src/test/setup.ts`

**Issue:** Playwright browsers not found  
**Fix:** Run `npm run playwright:install`

**Issue:** IndexedDB errors  
**Fix:** Tests auto-clear DB in beforeEach

**Issue:** Timeout errors in E2E  
**Fix:** Increase timeout: `test.setTimeout(60000)`

---

## 📈 Next Steps

1. Run tests: `npm test`
2. Check coverage: `npm run test:coverage`
3. Run E2E: `npm run test:e2e`
4. Fix failing tests
5. Add more tests (target 85%+ coverage)

**Goal:** 85% coverage before production launch
