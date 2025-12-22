# Stripe Integration Setup Guide

## Overview

This guide will help you set up Stripe for subscription payments in Malleabite. Follow these steps carefully to enable the complete payment flow.

## Prerequisites

- A Stripe account (sign up at [stripe.com](https://stripe.com))
- Firebase project configured
- Node.js and npm installed

## Step 1: Create Stripe Account & Get API Keys

1. Go to [https://dashboard.stripe.com/register](https://dashboard.stripe.com/register)
2. Create your account
3. Navigate to **Developers** → **API keys**
4. Copy your **Publishable key** and **Secret key**
   - For development, use **Test mode** keys (they start with `pk_test_` and `sk_test_`)
   - For production, switch to **Live mode** and use those keys

## Step 2: Create Products and Prices

### Create Pro Product

1. Go to **Products** → **Add Product**
2. Configure:
   - **Name**: `Malleabite Pro`
   - **Description**: `Unlimited events, modules, and AI requests. Advanced analytics and priority support.`
   - **Pricing Model**: Recurring
   - **Price**: $9.99
   - **Billing Period**: Monthly
   - **Currency**: USD

3. Click **Save product**
4. Copy the **Product ID** (starts with `prod_`)
5. Copy the **Price ID** (starts with `price_`)

### Create Pro Annual

1. In the same product page, click **Add another price**
2. Configure:
   - **Price**: $99.99
   - **Billing Period**: Yearly
   - **Currency**: USD
3. Click **Add price**
4. Copy the **Annual Price ID**

### Create Teams Product

1. Create another product:
   - **Name**: `Malleabite Teams`
   - **Description**: `All Pro features plus team collaboration, shared workspaces, and admin controls.`
   - **Pricing Model**: Recurring
   - **Price**: $7.00
   - **Billing Period**: Monthly
   - **Currency**: USD
   - **Usage Type**: Per-unit pricing (for per-user billing)

2. Copy the **Teams Product ID** and **Teams Price ID**

## Step 3: Configure Environment Variables

### Frontend (.env)

Add these to your `.env` file:

```env
# Stripe Configuration
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_your_publishable_key_here

# Stripe Product & Price IDs
VITE_STRIPE_PRO_PRODUCT_ID=prod_your_pro_product_id
VITE_STRIPE_PRO_MONTHLY_PRICE_ID=price_your_pro_monthly_price_id
VITE_STRIPE_PRO_ANNUAL_PRICE_ID=price_your_pro_annual_price_id
VITE_STRIPE_TEAMS_PRODUCT_ID=prod_your_teams_product_id
VITE_STRIPE_TEAMS_MONTHLY_PRICE_ID=price_your_teams_monthly_price_id
```

### Firebase Functions

Configure secrets for Firebase Functions:

```bash
# Navigate to functions directory
cd firebase/functions

# Set Stripe secret key
firebase functions:secrets:set STRIPE_SECRET_KEY
# When prompted, paste: sk_test_your_secret_key

# Set webhook secret (we'll create this in Step 4)
firebase functions:secrets:set STRIPE_WEBHOOK_SECRET
# When prompted, paste your webhook secret

# Set price IDs for the webhook handler
firebase functions:config:set stripe.pro_monthly_price_id="price_your_pro_monthly_id"
firebase functions:config:set stripe.pro_annual_price_id="price_your_pro_annual_id"
firebase functions:config:set stripe.teams_monthly_price_id="price_your_teams_monthly_id"
```

## Step 4: Set Up Webhooks

Webhooks allow Stripe to notify your app when subscription events occur (payments, cancellations, etc.).

### Local Testing with Stripe CLI

1. Install Stripe CLI: [https://stripe.com/docs/stripe-cli](https://stripe.com/docs/stripe-cli)

2. Login to Stripe CLI:
   ```bash
   stripe login
   ```

3. Forward webhook events to your local Firebase emulator:
   ```bash
   stripe listen --forward-to http://localhost:5001/malleabite-97d35/us-central1/stripeWebhook
   ```

4. Copy the webhook signing secret (starts with `whsec_`)

5. Set it in Firebase Functions:
   ```bash
   firebase functions:secrets:set STRIPE_WEBHOOK_SECRET
   # Paste the whsec_... secret
   ```

### Production Webhooks

1. Deploy your Firebase Functions:
   ```bash
   cd firebase/functions
   npm run build
   npm run deploy
   ```

2. Copy your deployed webhook URL:
   ```
   https://us-central1-malleabite-97d35.cloudfunctions.net/stripeWebhook
   ```

3. Go to Stripe Dashboard → **Developers** → **Webhooks**

4. Click **Add endpoint**

5. Configure:
   - **Endpoint URL**: Your deployed function URL
   - **Description**: `Malleabite Subscription Webhooks`
   - **Events to send**: Select these events:
     - `customer.subscription.created`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `invoice.payment_succeeded`
     - `invoice.payment_failed`

6. Click **Add endpoint**

7. Copy the **Signing secret** (whsec_...)

8. Update Firebase Functions secret:
   ```bash
   firebase functions:secrets:set STRIPE_WEBHOOK_SECRET
   # Paste the new production secret
   ```

9. Redeploy functions:
   ```bash
   npm run deploy
   ```

## Step 5: Configure Firestore Security Rules

Update your `firestore.rules` to include subscription access:

```javascript
// Allow users to read their own subscription
match /subscriptions/{userId} {
  allow read: if request.auth != null && request.auth.uid == userId;
  allow write: if false; // Only Cloud Functions can write
}

// Allow users to read their own usage data
match /usage/{usageId} {
  allow read: if request.auth != null && usageId.matches('^' + request.auth.uid + '_.*');
  allow write: if false; // Only Cloud Functions can write
}

// Customer mapping (userId to Stripe customerId)
match /customers/{userId} {
  allow read: if request.auth != null && request.auth.uid == userId;
  allow write: if false; // Only Cloud Functions can write
}
```

Deploy rules:
```bash
firebase deploy --only firestore:rules
```

## Step 6: Test the Integration

### Test Checkout Flow

1. Start your dev server:
   ```bash
   npm run dev
   ```

2. Start Firebase emulators:
   ```bash
   cd firebase/functions
   npm run serve
   ```

3. Start Stripe webhook forwarding:
   ```bash
   stripe listen --forward-to http://localhost:5001/malleabite-97d35/us-central1/stripeWebhook
   ```

4. Navigate to `/pricing` in your app

5. Click "Upgrade to Pro"

6. Use Stripe test card numbers:
   - **Success**: `4242 4242 4242 4242`
   - **Declined**: `4000 0000 0000 0002`
   - **3D Secure**: `4000 0025 0000 3155`
   - Use any future expiration date, any CVC, any ZIP code

7. Complete the checkout

8. Verify:
   - You're redirected back to `/billing?success=true`
   - Your Firestore `subscriptions/{userId}` document is updated
   - Your plan shows as "Pro" in the app

### Test Subscription Management

1. Go to `/billing`

2. Click "Manage Subscription"

3. You should be redirected to Stripe Customer Portal

4. Test:
   - Update payment method
   - Cancel subscription
   - View invoices

## Step 7: Go Live

When ready for production:

1. Switch Stripe to **Live mode**

2. Update `.env` with **live** keys:
   ```env
   VITE_STRIPE_PUBLISHABLE_KEY=pk_live_your_live_key
   ```

3. Update Firebase Functions secrets with live keys:
   ```bash
   firebase functions:secrets:set STRIPE_SECRET_KEY
   # Paste sk_live_... key
   ```

4. Create production webhook endpoint (follow Step 4, Production section)

5. Deploy everything:
   ```bash
   # Build and deploy frontend
   npm run build
   firebase deploy --only hosting
   
   # Deploy functions
   cd firebase/functions
   npm run deploy
   ```

6. Test with real payment methods (use small amounts initially)

## Troubleshooting

### Checkout Not Working

- Check browser console for errors
- Verify `VITE_STRIPE_PUBLISHABLE_KEY` in `.env`
- Ensure Price IDs match what's in Stripe Dashboard
- Check Firebase Functions logs: `firebase functions:log`

### Webhook Events Not Received

- Verify webhook URL is correct
- Check Stripe Dashboard → Webhooks → Recent deliveries
- Ensure signing secret matches
- Check Firebase Functions logs

### Subscription Not Updating

- Verify webhook endpoint is receiving events
- Check Firestore security rules allow function writes
- Review Firebase Functions logs for errors

## Additional Resources

- [Stripe Testing Guide](https://stripe.com/docs/testing)
- [Stripe Webhook Events](https://stripe.com/docs/webhooks)
- [Firebase Functions Secrets](https://firebase.google.com/docs/functions/config-env)
- [Stripe Customer Portal](https://stripe.com/docs/billing/subscriptions/customer-portal)

## Security Checklist

- ✅ API keys stored in environment variables, not code
- ✅ `.env` file in `.gitignore`
- ✅ Webhook signature verification enabled
- ✅ Firestore rules prevent client writes to subscriptions
- ✅ HTTPS enforced on all endpoints
- ✅ Test mode used in development
- ✅ Live keys only in production environment

## Support

If you encounter issues:

1. Check Firebase Functions logs
2. Check Stripe Dashboard → Developers → Logs
3. Review Firestore security rules
4. Verify all environment variables are set
5. Test with Stripe CLI locally before deploying

---

**Status**: Ready for production after completing all steps above.
