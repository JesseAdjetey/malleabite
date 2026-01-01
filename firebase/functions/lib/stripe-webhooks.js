"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPortalSession = exports.createCheckoutSession = exports.stripeWebhook = void 0;
const https_1 = require("firebase-functions/v2/https");
const params_1 = require("firebase-functions/params");
const admin = __importStar(require("firebase-admin"));
const stripe_1 = __importDefault(require("stripe"));
// Define Stripe secret key
const stripeSecretKey = (0, params_1.defineSecret)('STRIPE_SECRET_KEY');
const stripeWebhookSecret = (0, params_1.defineSecret)('STRIPE_WEBHOOK_SECRET');
/**
 * Stripe webhook endpoint to handle subscription events
 * Triggered by Stripe when subscription status changes
 */
exports.stripeWebhook = (0, https_1.onRequest)({
    secrets: [stripeSecretKey, stripeWebhookSecret],
    cors: false, // Stripe webhooks don't need CORS
}, async (request, response) => {
    const stripe = new stripe_1.default(stripeSecretKey.value(), {
        apiVersion: '2025-12-15.clover',
    });
    const sig = request.headers['stripe-signature'];
    if (!sig) {
        console.error('No stripe-signature header found');
        response.status(400).send('No signature');
        return;
    }
    let event;
    try {
        // Verify webhook signature
        event = stripe.webhooks.constructEvent(request.rawBody, sig, stripeWebhookSecret.value());
    }
    catch (err) {
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
                await handleSubscriptionUpdate(event.data.object);
                break;
            case 'customer.subscription.deleted':
                await handleSubscriptionDeleted(event.data.object);
                break;
            case 'invoice.payment_succeeded':
                await handlePaymentSucceeded(event.data.object);
                break;
            case 'invoice.payment_failed':
                await handlePaymentFailed(event.data.object);
                break;
            default:
                console.log(`Unhandled event type: ${event.type}`);
        }
        response.json({ received: true });
    }
    catch (error) {
        console.error('Error processing webhook:', error);
        response.status(500).send(`Webhook handler error: ${error.message}`);
    }
});
/**
 * Handle subscription creation or update
 */
async function handleSubscriptionUpdate(subscription) {
    const customerId = subscription.customer;
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
        currentPeriodStart: admin.firestore.Timestamp.fromDate(new Date(subscription.current_period_start * 1000)),
        currentPeriodEnd: admin.firestore.Timestamp.fromDate(new Date(subscription.current_period_end * 1000)),
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        canceledAt: subscription.canceled_at
            ? admin.firestore.Timestamp.fromDate(new Date(subscription.canceled_at * 1000))
            : null,
        trialEnd: subscription.trial_end
            ? admin.firestore.Timestamp.fromDate(new Date(subscription.trial_end * 1000))
            : null,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    // Update subscription in Firestore
    await admin
        .firestore()
        .collection('subscriptions')
        .doc(userId)
        .set(subscriptionData, { merge: true });
    console.log(`Updated subscription for user ${userId} to plan ${planId}`);
}
/**
 * Handle subscription deletion (cancellation)
 */
async function handleSubscriptionDeleted(subscription) {
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
        .set({
        planId: 'free',
        status: 'active',
        stripeSubscriptionId: null,
        stripePriceId: null,
        cancelAtPeriodEnd: false,
        currentPeriodStart: admin.firestore.Timestamp.now(),
        currentPeriodEnd: admin.firestore.Timestamp.fromDate(new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 year
        ),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    console.log(`Downgraded user ${userId} to free plan`);
}
/**
 * Handle successful payment
 */
async function handlePaymentSucceeded(invoice) {
    const customerId = invoice.customer;
    const subscriptionId = invoice.subscription;
    // Log successful payment
    console.log(`Payment succeeded for customer ${customerId}, subscription ${subscriptionId}`);
    // Could send email confirmation here
}
/**
 * Handle failed payment
 */
async function handlePaymentFailed(invoice) {
    const customerId = invoice.customer;
    const subscriptionId = invoice.subscription;
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
        await doc.ref.update({
            status: 'past_due',
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    }
    // Could send payment failed notification email here
}
/**
 * Map Stripe price ID to internal plan ID
 * Note: These should match your .env variables
 */
function getPlanIdFromPriceId(priceId) {
    // You'll need to configure these in Firebase Functions config
    const priceMap = {
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
exports.createCheckoutSession = (0, https_1.onRequest)({
    secrets: [stripeSecretKey],
    cors: true,
}, async (request, response) => {
    if (request.method !== 'POST') {
        response.status(405).send('Method not allowed');
        return;
    }
    const stripe = new stripe_1.default(stripeSecretKey.value(), {
        apiVersion: '2024-11-20.acacia',
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
        let customerId;
        const customerDoc = await admin
            .firestore()
            .collection('customers')
            .doc(userId)
            .get();
        if (customerDoc.exists) {
            customerId = customerDoc.data()?.stripeCustomerId;
        }
        else {
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
        response.json({ sessionId: session.id, url: session.url });
    }
    catch (error) {
        console.error('Error creating checkout session:', error);
        response.status(500).json({ error: error.message });
    }
});
/**
 * Create billing portal session
 * Allows users to manage their subscription
 */
exports.createPortalSession = (0, https_1.onRequest)({
    secrets: [stripeSecretKey],
    cors: true,
}, async (request, response) => {
    if (request.method !== 'POST') {
        response.status(405).send('Method not allowed');
        return;
    }
    const stripe = new stripe_1.default(stripeSecretKey.value(), {
        apiVersion: '2024-11-20.acacia',
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
        response.json({ url: session.url });
    }
    catch (error) {
        console.error('Error creating portal session:', error);
        response.status(500).json({ error: error.message });
    }
});
//# sourceMappingURL=stripe-webhooks.js.map