<wizard-report>
# PostHog post-wizard report

The wizard has completed a server-side PostHog integration for Malleabite's Firebase Cloud Functions using `posthog-node`. A new PostHog client singleton (`firebase/functions/src/posthog.ts`) was created with `flushAt: 1` and `flushInterval: 0` — appropriate for short-lived Firebase Function processes. Seven events were instrumented across three Cloud Function handlers in `firebase/functions/src/stripe-webhooks.ts`, covering the full subscription lifecycle from checkout through payment and cancellation. `captureException` was added to all error handlers for exception tracking.

| Event | Description | File |
|-------|-------------|------|
| `subscription_created` | A new paid subscription was successfully created via Stripe webhook | `firebase/functions/src/stripe-webhooks.ts` |
| `subscription_updated` | An existing subscription was updated (plan change, renewal) via Stripe webhook | `firebase/functions/src/stripe-webhooks.ts` |
| `subscription_cancelled` | A subscription was cancelled and user was downgraded to the free plan | `firebase/functions/src/stripe-webhooks.ts` |
| `payment_succeeded` | An invoice payment succeeded for a subscription | `firebase/functions/src/stripe-webhooks.ts` |
| `payment_failed` | An invoice payment failed, subscription moved to past_due status | `firebase/functions/src/stripe-webhooks.ts` |
| `checkout_session_created` | A Stripe checkout session was created — user started the upgrade flow | `firebase/functions/src/stripe-webhooks.ts` |
| `billing_portal_accessed` | A user opened the Stripe billing portal to manage their subscription | `firebase/functions/src/stripe-webhooks.ts` |

## Next steps

We've built some insights and a dashboard for you to keep an eye on user behavior, based on the events we just instrumented:

- **Dashboard — Analytics basics**: https://us.posthog.com/project/368237/dashboard/1429063
- **Checkout to Subscription Conversion Funnel**: https://us.posthog.com/project/368237/insights/zN1pWvmS
- **Checkout vs Subscription Trend**: https://us.posthog.com/project/368237/insights/r7rwSFyY
- **New Subscriptions vs Cancellations**: https://us.posthog.com/project/368237/insights/QVhwHMci
- **Payment Success vs Failure Rate**: https://us.posthog.com/project/368237/insights/dvs6Hyqd
- **Subscription Cancellations Over Time**: https://us.posthog.com/project/368237/insights/TqLcHtRT

### Agent skill

We've left an agent skill folder in your project. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.

</wizard-report>
