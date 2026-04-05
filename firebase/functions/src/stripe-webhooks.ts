import { onRequest } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import * as admin from 'firebase-admin';
import Stripe from 'stripe';
import { posthog } from './posthog';

// Define Stripe secret key
const stripeSecretKey = defineSecret('STRIPE_SECRET_KEY');
const stripeWebhookSecret = defineSecret('STRIPE_WEBHOOK_SECRET');

/**
 * Stripe webhook endpoint to handle subscription events
 * Triggered by Stripe when subscription status changes
 */
export const stripeWebhook = onRequest(
  {
    secrets: [stripeSecretKey, stripeWebhookSecret],
    cors: false, // Stripe webhooks don't need CORS
  },
  async (request, response) => {
    const stripe = new Stripe(stripeSecretKey.value(), {
      apiVersion: '2025-12-15.clover' as any,
    });

    const sig = request.headers['stripe-signature'];

    if (!sig) {
      console.error('No stripe-signature header found');
      response.status(400).send('No signature');
      return;
    }

    let event: Stripe.Event;

    try {
      // Verify webhook signature
      event = stripe.webhooks.constructEvent(
        request.rawBody,
        sig,
        stripeWebhookSecret.value()
      );
    } catch (err: any) {
      console.error('Webhook signature verification failed:', err.message);
      response.status(400).send(`Webhook Error: ${err.message}`);
      return;
    }

    console.log(`Received Stripe event: ${event.type}`);

    try {
      // Handle different event types
      switch (event.type) {
        case 'customer.subscription.created':
        case 'customer.subscription.updated':
          await handleSubscriptionUpdate(
            event.data.object as Stripe.Subscription,
            event.type === 'customer.subscription.created' ? 'subscription_created' : 'subscription_updated'
          );
          break;

        case 'customer.subscription.deleted':
          await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
          break;

        case 'invoice.payment_succeeded':
          await handlePaymentSucceeded(event.data.object as Stripe.Invoice);
          break;

        case 'invoice.payment_failed':
          await handlePaymentFailed(event.data.object as Stripe.Invoice);
          break;

        default:
          console.log(`Unhandled event type: ${event.type}`);
      }

      response.json({ received: true });
    } catch (error: any) {
      console.error('Error processing webhook:', error);
      posthog.captureException(error, undefined, { function: 'stripeWebhook', event_type: event.type });
      response.status(500).send(`Webhook handler error: ${error.message}`);
    }
  }
);

/**
 * Handle subscription creation or update
 */
async function handleSubscriptionUpdate(subscription: Stripe.Subscription, eventName: 'subscription_created' | 'subscription_updated') {
  const customerId = subscription.customer as string;
  const subscriptionId = subscription.id;
  const priceId = subscription.items.data[0]?.price.id;
  const status = subscription.status;

  // Get user ID from customer metadata
  const userId = subscription.metadata.userId;

  if (!userId) {
    console.error('No userId in subscription metadata');
    return;
  }

  // Map Stripe price ID to plan ID
  const planId = getPlanIdFromPriceId(priceId);

  if (!planId) {
    console.error(`Unknown price ID: ${priceId}`);
    return;
  }

  const subscriptionData = {
    userId,
    planId,
    status,
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscriptionId,
    stripePriceId: priceId,
    currentPeriodStart: admin.firestore.Timestamp.fromDate(
      new Date((subscription as any).current_period_start * 1000)
    ),
    currentPeriodEnd: admin.firestore.Timestamp.fromDate(
      new Date((subscription as any).current_period_end * 1000)
    ),
    cancelAtPeriodEnd: (subscription as any).cancel_at_period_end,
    canceledAt: (subscription as any).canceled_at
      ? admin.firestore.Timestamp.fromDate(new Date((subscription as any).canceled_at * 1000))
      : null,
    trialEnd: (subscription as any).trial_end
      ? admin.firestore.Timestamp.fromDate(new Date((subscription as any).trial_end * 1000))
      : null,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  // Update subscription in Firestore
  await admin
    .firestore()
    .collection('subscriptions')
    .doc(userId)
    .set(subscriptionData, { merge: true });

  posthog.capture({
    distinctId: userId,
    event: eventName,
    properties: {
      plan_id: planId,
      status,
      stripe_customer_id: customerId,
      stripe_subscription_id: subscriptionId,
      stripe_price_id: priceId,
      cancel_at_period_end: (subscription as any).cancel_at_period_end,
    },
  });

  console.log(`Updated subscription for user ${userId} to plan ${planId}`);
}

/**
 * Handle subscription deletion (cancellation)
 */
async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const userId = subscription.metadata.userId;
  
  if (!userId) {
    console.error('No userId in subscription metadata');
    return;
  }

  // Downgrade to free plan
  await admin
    .firestore()
    .collection('subscriptions')
    .doc(userId)
    .set(
      {
        planId: 'free',
        status: 'active',
        stripeSubscriptionId: null,
        stripePriceId: null,
        cancelAtPeriodEnd: false,
        currentPeriodStart: admin.firestore.Timestamp.now(),
        currentPeriodEnd: admin.firestore.Timestamp.fromDate(
          new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 year
        ),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

  posthog.capture({
    distinctId: userId,
    event: 'subscription_cancelled',
    properties: {
      stripe_subscription_id: subscription.id,
      stripe_customer_id: subscription.customer as string,
      previous_plan_id: getPlanIdFromPriceId(subscription.items.data[0]?.price.id),
    },
  });

  console.log(`Downgraded user ${userId} to free plan`);
}

/**
 * Handle successful payment
 */
async function handlePaymentSucceeded(invoice: Stripe.Invoice) {
  const customerId = invoice.customer as string;
  const subscriptionId = (invoice as any).subscription as string;
  
  // Log successful payment
  console.log(`Payment succeeded for customer ${customerId}, subscription ${subscriptionId}`);

  posthog.capture({
    distinctId: customerId,
    event: 'payment_succeeded',
    properties: {
      stripe_customer_id: customerId,
      stripe_subscription_id: subscriptionId,
      amount_paid: invoice.amount_paid,
      currency: invoice.currency,
    },
  });

  // Could send email confirmation here
}

/**
 * Handle failed payment
 */
async function handlePaymentFailed(invoice: Stripe.Invoice) {
  const customerId = invoice.customer as string;
  const subscriptionId = (invoice as any).subscription as string;
  
  console.log(`Payment failed for customer ${customerId}, subscription ${subscriptionId}`);
  
  // Update subscription status to past_due
  const userSnapshot = await admin
    .firestore()
    .collection('subscriptions')
    .where('stripeSubscriptionId', '==', subscriptionId)
    .limit(1)
    .get();

  if (!userSnapshot.empty) {
    const doc = userSnapshot.docs[0];
    const docUserId = doc.data()?.userId;
    await doc.ref.update({
      status: 'past_due',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    posthog.capture({
      distinctId: docUserId ?? customerId,
      event: 'payment_failed',
      properties: {
        stripe_customer_id: customerId,
        stripe_subscription_id: subscriptionId,
        amount_due: invoice.amount_due,
        currency: invoice.currency,
      },
    });
  }

  // Could send payment failed notification email here
}

/**
 * Map Stripe price ID to internal plan ID
 * Note: These should match your .env variables
 */
function getPlanIdFromPriceId(priceId: string): string | null {
  // You'll need to configure these in Firebase Functions config
  const priceMap: Record<string, string> = {
    // Get from environment/config
    [process.env.STRIPE_PRO_MONTHLY_PRICE_ID || '']: 'pro',
    [process.env.STRIPE_PRO_ANNUAL_PRICE_ID || '']: 'pro-annual',
    [process.env.STRIPE_TEAMS_MONTHLY_PRICE_ID || '']: 'teams',
  };

  return priceMap[priceId] || null;
}

/**
 * Create Stripe checkout session
 * Called from client when user wants to subscribe
 */
export const createCheckoutSession = onRequest(
  {
    secrets: [stripeSecretKey],
    cors: true,
  },
  async (request, response) => {
    if (request.method !== 'POST') {
      response.status(405).send('Method not allowed');
      return;
    }

    const stripe = new Stripe(stripeSecretKey.value(), {
      apiVersion: '2024-11-20.acacia' as any,
    });

    try {
      const { priceId, userId, successUrl, cancelUrl } = request.body;

      if (!priceId || !userId || !successUrl || !cancelUrl) {
        response.status(400).json({
          error: 'Missing required parameters: priceId, userId, successUrl, cancelUrl',
        });
        return;
      }

      // Get or create Stripe customer
      let customerId: string;
      const customerDoc = await admin
        .firestore()
        .collection('customers')
        .doc(userId)
        .get();

      if (customerDoc.exists) {
        customerId = customerDoc.data()?.stripeCustomerId;
      } else {
        // Get user email from auth
        const user = await admin.auth().getUser(userId);
        const customer = await stripe.customers.create({
          email: user.email,
          metadata: {
            userId,
          },
        });
        customerId = customer.id;

        // Save customer ID
        await admin.firestore().collection('customers').doc(userId).set({
          stripeCustomerId: customerId,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }

      // Create checkout session
      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        payment_method_types: ['card'],
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        mode: 'subscription',
        success_url: successUrl,
        cancel_url: cancelUrl,
        subscription_data: {
          metadata: {
            userId,
          },
        },
      });

      posthog.capture({
        distinctId: userId,
        event: 'checkout_session_created',
        properties: {
          stripe_price_id: priceId,
          stripe_session_id: session.id,
        },
      });

      response.json({ sessionId: session.id, url: session.url });
    } catch (error: any) {
      console.error('Error creating checkout session:', error);
      posthog.captureException(error, request.body?.userId, { function: 'createCheckoutSession' });
      response.status(500).json({ error: error.message });
    }
  }
);

/**
 * Create billing portal session
 * Allows users to manage their subscription
 */
export const createPortalSession = onRequest(
  {
    secrets: [stripeSecretKey],
    cors: true,
  },
  async (request, response) => {
    if (request.method !== 'POST') {
      response.status(405).send('Method not allowed');
      return;
    }

    const stripe = new Stripe(stripeSecretKey.value(), {
      apiVersion: '2024-11-20.acacia' as any,
    });

    try {
      const { userId, returnUrl } = request.body;

      if (!userId || !returnUrl) {
        response.status(400).json({
          error: 'Missing required parameters: userId, returnUrl',
        });
        return;
      }

      // Get customer ID
      const customerDoc = await admin
        .firestore()
        .collection('customers')
        .doc(userId)
        .get();

      if (!customerDoc.exists) {
        response.status(404).json({ error: 'Customer not found' });
        return;
      }

      const customerId = customerDoc.data()?.stripeCustomerId;

      // Create portal session
      const session = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: returnUrl,
      });

      posthog.capture({
        distinctId: userId,
        event: 'billing_portal_accessed',
        properties: {
          stripe_customer_id: customerId,
        },
      });

      response.json({ url: session.url });
    } catch (error: any) {
      console.error('Error creating portal session:', error);
      posthog.captureException(error, request.body?.userId, { function: 'createPortalSession' });
      response.status(500).json({ error: error.message });
    }
  }
);
