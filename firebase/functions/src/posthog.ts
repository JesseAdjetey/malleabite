import { PostHog } from 'posthog-node';

// Only initialize if an API key is configured — avoids crash during cold-start
const apiKey = process.env.POSTHOG_API_KEY ?? 'placeholder';
const posthog = new PostHog(apiKey, {
  host: process.env.POSTHOG_HOST,
  flushAt: 1,
  flushInterval: 0,
  // Disable if no real key provided
  ...(process.env.POSTHOG_API_KEY ? {} : { disabled: true }),
});

export { posthog };
