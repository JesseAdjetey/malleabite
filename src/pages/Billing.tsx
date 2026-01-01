import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, CreditCard, Crown, Loader2, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useSubscription } from '@/hooks/use-subscription';
import { useAuth } from '@/contexts/AuthContext.unified';
import { getStripe, SUBSCRIPTION_PLANS } from '@/lib/stripe';
import { useToast } from '@/hooks/use-toast';

export default function Billing() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { subscription, loading: subLoading } = useSubscription();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);

  const selectedPlan = searchParams.get('plan') || 'pro';

  useEffect(() => {
    if (!user) {
      navigate('/auth');
    }
  }, [user, navigate]);

  const handleCheckout = async () => {
    if (!user) {
      navigate('/auth');
      return;
    }

    setLoading(true);

    try {
      const plan = SUBSCRIPTION_PLANS[selectedPlan.toUpperCase() as keyof typeof SUBSCRIPTION_PLANS];
      
      if (!plan?.stripePriceId) {
        toast({
          title: 'Configuration Error',
          description: 'Stripe is not configured. Please add your Stripe keys to .env',
          variant: 'destructive',
        });
        setLoading(false);
        return;
      }

      // Call Firebase Function to create checkout session
      const response = await fetch(
        `${import.meta.env.VITE_FIREBASE_FUNCTIONS_URL || 'https://us-central1-malleabite-97d35.cloudfunctions.net'}/createCheckoutSession`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            priceId: plan.stripePriceId,
            userId: user.uid,
            successUrl: `${window.location.origin}/billing?success=true`,
            cancelUrl: `${window.location.origin}/billing?canceled=true`,
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to create checkout session');
      }

      const { sessionId, url } = await response.json();

      // Redirect to Stripe Checkout
      const stripe = await getStripe();
      
      if (stripe && sessionId) {
        const { error } = await stripe.redirectToCheckout({ sessionId });
        if (error) {
          throw error;
        }
      } else if (url) {
        // Fallback: direct URL redirect
        window.location.href = url;
      }
    } catch (error: any) {
      console.error('Checkout error:', error);
      toast({
        title: 'Checkout Failed',
        description: error.message || 'Unable to start checkout. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleManageSubscription = async () => {
    if (!user) return;

    setPortalLoading(true);

    try {
      // Call Firebase Function to create portal session
      const response = await fetch(
        `${import.meta.env.VITE_FIREBASE_FUNCTIONS_URL || 'https://us-central1-malleabite-97d35.cloudfunctions.net'}/createPortalSession`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId: user.uid,
            returnUrl: `${window.location.origin}/billing`,
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to create portal session');
      }

      const { url } = await response.json();
      
      // Redirect to Stripe Customer Portal
      window.location.href = url;
    } catch (error: any) {
      console.error('Portal error:', error);
      toast({
        title: 'Error',
        description: 'Unable to open billing portal. Please try again.',
        variant: 'destructive',
      });
      setPortalLoading(false);
    }
  };

  // Handle success/cancel from checkout
  useEffect(() => {
    if (searchParams.get('success')) {
      toast({
        title: 'Subscription Activated!',
        description: 'Welcome to Malleabite Pro. Enjoy unlimited features.',
      });
      // Clear the success param
      navigate('/billing', { replace: true });
    }

    if (searchParams.get('canceled')) {
      toast({
        title: 'Checkout Canceled',
        description: 'Your subscription was not activated.',
        variant: 'destructive',
      });
      navigate('/billing', { replace: true });
    }
  }, [searchParams, navigate, toast]);

  if (subLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const currentPlan = subscription?.planId || 'free';
  const isActive = subscription?.isActive ?? false;

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b">
        <div className="container max-w-4xl mx-auto px-4 py-4">
          <Button variant="ghost" onClick={() => navigate(-1)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        </div>
      </div>

      <div className="container max-w-4xl mx-auto px-4 py-12">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Billing & Subscription</h1>
          <p className="text-muted-foreground">
            Manage your subscription and billing information
          </p>
        </div>

        {/* Current Subscription */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Current Plan
                </CardTitle>
                <CardDescription>
                  {subscription?.cancelAtPeriodEnd
                    ? 'Your subscription will be canceled at the end of the billing period'
                    : 'You are currently subscribed to'}
                </CardDescription>
              </div>
              <Badge
                variant={isActive ? 'default' : 'secondary'}
                className="text-sm"
              >
                {subscription?.status === 'active' ? 'Active' : subscription?.status || 'Free'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  {currentPlan === 'free' ? (
                    <span className="text-2xl font-bold">Free Plan</span>
                  ) : (
                    <>
                      <Crown className="h-6 w-6 text-yellow-500" />
                      <span className="text-2xl font-bold capitalize">
                        {currentPlan.replace('-', ' ')} Plan
                      </span>
                    </>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  {currentPlan === 'free'
                    ? 'Limited features with 50 events/month'
                    : 'Unlimited events, modules, and AI requests'}
                </p>
              </div>

              {subscription && subscription.currentPeriodEnd && currentPlan !== 'free' && (
                <div className="text-sm">
                  <span className="text-muted-foreground">
                    {subscription.cancelAtPeriodEnd ? 'Active until' : 'Renews on'}:{' '}
                  </span>
                  <span className="font-medium">
                    {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
                  </span>
                </div>
              )}
            </div>
          </CardContent>
          {currentPlan !== 'free' && (
            <CardFooter>
              <Button
                variant="outline"
                onClick={handleManageSubscription}
                disabled={portalLoading}
                className="w-full sm:w-auto"
              >
                {portalLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Loading...
                  </>
                ) : (
                  <>
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Manage Subscription
                  </>
                )}
              </Button>
            </CardFooter>
          )}
        </Card>

        {/* Upgrade Section */}
        {currentPlan === 'free' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Crown className="h-5 w-5 text-yellow-500" />
                Upgrade to Pro
              </CardTitle>
              <CardDescription>
                Unlock unlimited features and premium support
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="text-3xl font-bold mb-2">$9.99/month</div>
                  <p className="text-sm text-muted-foreground mb-4">
                    Or save 17% with annual billing ($99.99/year)
                  </p>
                </div>

                <ul className="space-y-2">
                  <li className="flex items-center gap-2 text-sm">
                    <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                    <span>Unlimited calendar events</span>
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                    <span>All productivity modules</span>
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                    <span>Unlimited AI assistance</span>
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                    <span>Advanced analytics & insights</span>
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                    <span>Custom templates</span>
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                    <span>Priority support</span>
                  </li>
                </ul>
              </div>
            </CardContent>
            <CardFooter>
              <Button
                onClick={handleCheckout}
                disabled={loading}
                className="w-full"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Crown className="mr-2 h-4 w-4" />
                    Upgrade Now
                  </>
                )}
              </Button>
            </CardFooter>
          </Card>
        )}

        {/* View All Plans */}
        <div className="mt-6 text-center">
          <Button
            variant="ghost"
            onClick={() => navigate('/pricing')}
          >
            View All Plans
          </Button>
        </div>
      </div>
    </div>
  );
}
