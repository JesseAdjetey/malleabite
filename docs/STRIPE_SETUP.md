# Stripe Setup Guide for Malleabite

## Quick Start (No Stripe Account Needed)

**For Testing/Development:** The app is now configured to run in **mock mode** by default.

```bash
# Already set in .env
VITE_STRIPE_MODE=mock
```

In mock mode:
- ✅ All subscription features work
- ✅ No payment processing (simulated only)
- ✅ No Stripe account required
- ✅ Free to test and develop

---

## Getting Real Stripe Test Credentials (Optional)

If you want to test real Stripe integration:

### Step 1: Create Stripe Account
1. Go to [https://dashboard.stripe.com/register](https://dashboard.stripe.com/register)
2. Sign up for a free account
3. No credit card required for test mode

### Step 2: Get API Keys
1. Navigate to **Developers > API Keys** in Stripe Dashboard
2. You'll see two test keys:
   - **Publishable key** (starts with `pk_test_`)
   - **Secret key** (starts with `sk_test_`)

### Step 3: Configure Frontend
Add to `.env`:
```bash
# Remove or comment out mock mode
# VITE_STRIPE_MODE=mock

# Add your test publishable key
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_51QYj5GEOqHewKlAJ4YourActualTestKey
```

### Step 4: Configure Backend (Firebase Functions)
```bash
# Set secret key in Firebase Functions config
firebase functions:config:set stripe.secret_key="sk_test_YourActualSecretKey"

# Set webhook secret (after creating webhook endpoint)
firebase functions:config:set stripe.webhook_secret="whsec_YourWebhookSecret"

# Deploy functions
firebase deploy --only functions
```

---

## Creating Stripe Products & Prices

### Step 5: Create Products in Stripe Dashboard

1. Go to **Products** in Stripe Dashboard
2. Create three products:

#### Product 1: Pro Monthly
- **Name:** Malleabite Pro
- **Price:** $9.99/month
- **Copy Price ID** (starts with `price_`) → Update `src/lib/stripe.ts`

#### Product 2: Pro Annual
- **Name:** Malleabite Pro Annual
- **Price:** $99/year
- **Copy Price ID** → Update `src/lib/stripe.ts`

#### Product 3: Teams
- **Name:** Malleabite Teams
- **Price:** $29/month
- **Copy Price ID** → Update `src/lib/stripe.ts`

### Step 6: Update Price IDs in Code

Edit `src/lib/stripe.ts`:
```typescript
export const SUBSCRIPTION_PLANS = {
  PRO: {
    // ...
    stripePriceId: 'price_YOUR_PRO_MONTHLY_ID',
  },
  'PRO-ANNUAL': {
    // ...
    stripePriceId: 'price_YOUR_PRO_ANNUAL_ID',
  },
  TEAMS: {
    // ...
    stripePriceId: 'price_YOUR_TEAMS_ID',
  },
};
```

---

## Setting Up Webhooks (for Production)

### Step 7: Create Webhook Endpoint

1. Go to **Developers > Webhooks** in Stripe Dashboard
2. Click **Add endpoint**
3. Set URL: `https://your-firebase-region-your-project.cloudfunctions.net/stripeWebhook`
4. Select events to listen to:
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
5. Copy **Signing secret** (starts with `whsec_`)
6. Configure in Firebase:
   ```bash
   firebase functions:config:set stripe.webhook_secret="whsec_YourSigningSecret"
   ```

---

## Test Cards

Use these test card numbers in Stripe test mode:

| Card Number | Scenario |
|-------------|----------|
| 4242 4242 4242 4242 | Success |
| 4000 0000 0000 0341 | Requires authentication (3D Secure) |
| 4000 0000 0000 9995 | Declined |
| 4000 0025 0000 3155 | Requires authentication + succeeds |

**CVC:** Any 3 digits  
**Expiry:** Any future date  
**ZIP:** Any 5 digits

---

## Current Configuration Status

✅ **Mock Mode Enabled** - No Stripe account needed  
⏳ **Real Stripe Integration** - Follow steps above when ready  

To check your current mode:
```bash
# Open browser console after starting app
# You'll see: "[Stripe] Running in MOCK mode"
```

---

## Troubleshooting

### Error: "Stripe publishable key is not configured"
**Solution:** Set `VITE_STRIPE_MODE=mock` in `.env` OR add real Stripe key

### Error: "Missing stripe secret key in functions config"
**Solution:** Run `firebase functions:config:set stripe.secret_key="sk_test_YOUR_KEY"`

### Payments not working in test mode
**Solution:** 
1. Verify API keys are test keys (not live)
2. Check browser console for errors
3. Ensure Firebase Functions are deployed

### Webhook errors
**Solution:**
1. Verify webhook URL is correct
2. Check signing secret matches
3. Review Firebase Functions logs

---

## Next Steps

1. ✅ App runs in mock mode (no setup needed)
2. When ready for real Stripe testing:
   - Create Stripe account (free)
   - Get test API keys
   - Update `.env` and Firebase config
   - Create products/prices
3. For production:
   - Switch to live API keys
   - Set up production webhooks
   - Test with real payment methods

---

## Resources

- [Stripe Dashboard](https://dashboard.stripe.com/)
- [Stripe Test Cards](https://stripe.com/docs/testing)
- [Stripe API Docs](https://stripe.com/docs/api)
- [Firebase Functions Config](https://firebase.google.com/docs/functions/config-env)
