// Mock Stripe service for testing without real credentials
export const mockStripeService = {
  /**
   * Mock checkout session creation
   * Simulates Stripe checkout flow without real payment processing
   */
  createCheckoutSession: async (priceId: string, customerId?: string) => {
    console.log('[Mock Stripe] Creating checkout session for:', priceId);
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Return mock session with test URL
    return {
      id: `cs_test_mock_${Date.now()}`,
      url: `/pricing?mock_checkout=success&price=${priceId}`,
      customer: customerId || `cus_mock_${Date.now()}`,
      payment_status: 'unpaid',
      mode: 'subscription',
    };
  },

  /**
   * Mock customer portal session
   * Simulates Stripe customer portal for subscription management
   */
  createPortalSession: async (customerId: string) => {
    console.log('[Mock Stripe] Creating portal session for:', customerId);
    
    await new Promise(resolve => setTimeout(resolve, 500));
    
    return {
      id: `portal_mock_${Date.now()}`,
      url: `/billing?mock_portal=true`,
      customer: customerId,
    };
  },

  /**
   * Mock subscription update
   * Simulates updating a subscription plan
   */
  updateSubscription: async (subscriptionId: string, newPriceId: string) => {
    console.log('[Mock Stripe] Updating subscription:', subscriptionId, 'to', newPriceId);
    
    await new Promise(resolve => setTimeout(resolve, 500));
    
    return {
      id: subscriptionId,
      status: 'active',
      current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
      items: {
        data: [{ price: { id: newPriceId } }],
      },
    };
  },

  /**
   * Mock subscription cancellation
   */
  cancelSubscription: async (subscriptionId: string, immediately = false) => {
    console.log('[Mock Stripe] Canceling subscription:', subscriptionId, 'immediately:', immediately);
    
    await new Promise(resolve => setTimeout(resolve, 500));
    
    return {
      id: subscriptionId,
      status: immediately ? 'canceled' : 'active',
      cancel_at_period_end: !immediately,
      canceled_at: immediately ? Math.floor(Date.now() / 1000) : null,
    };
  },
};

/**
 * Check if app is running in mock mode
 */
export const isMockMode = () => {
  return import.meta.env.VITE_STRIPE_MODE === 'mock';
};

/**
 * Display mock mode notification to user
 */
export const showMockModeNotification = () => {
  if (isMockMode()) {
    console.log(
      '%c[Mock Mode] Stripe is running in mock mode - no real payments will be processed',
      'background: #fef3c7; color: #92400e; padding: 8px; border-radius: 4px; font-weight: bold;'
    );
  }
};
