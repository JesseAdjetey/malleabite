// User Onboarding Flow
import React, { useState, useEffect } from 'react';
import { 
  Calendar, Bot, Bell, Users, Mic, CheckCircle2, 
  ArrowRight, ArrowLeft, Rocket, X, PartyPopper 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext.unified';
import confetti from 'canvas-confetti';

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  content: React.ReactNode;
}

const ONBOARDING_KEY = 'malleabite_onboarding_complete';

export function useOnboarding() {
  const { user } = useAuth();
  const [isComplete, setIsComplete] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    if (user) {
      const completed = localStorage.getItem(`${ONBOARDING_KEY}_${user.uid}`);
      setIsComplete(!!completed);
      setShowOnboarding(!completed);
    }
  }, [user]);

  const completeOnboarding = () => {
    if (user) {
      localStorage.setItem(`${ONBOARDING_KEY}_${user.uid}`, 'true');
      setIsComplete(true);
      setShowOnboarding(false);
    }
  };

  const resetOnboarding = () => {
    if (user) {
      localStorage.removeItem(`${ONBOARDING_KEY}_${user.uid}`);
      setIsComplete(false);
      setShowOnboarding(true);
    }
  };

  return {
    isComplete,
    showOnboarding,
    setShowOnboarding,
    completeOnboarding,
    resetOnboarding,
  };
}

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
}

export function OnboardingModal({ isOpen, onClose, onComplete }: OnboardingModalProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const { user } = useAuth();

  const steps: OnboardingStep[] = [
    {
      id: 'welcome',
      title: `Welcome, ${(user as any)?.displayName?.split(' ')[0] || 'there'}! 🎉`,
      description: "Let's get you set up with Malleabite in just a minute.",
      icon: <Rocket className="h-8 w-8" />,
      content: (
        <div className="text-center py-4">
          <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center animate-pulse">
            <PartyPopper className="h-12 w-12 text-white" />
          </div>
          <p className="text-muted-foreground">
            Malleabite is your AI-powered productivity companion. 
            We'll help you manage your time smarter, not harder.
          </p>
        </div>
      ),
    },
    {
      id: 'calendar',
      title: 'Your Smart Calendar',
      description: 'Schedule events with ease and AI assistance.',
      icon: <Calendar className="h-8 w-8" />,
      content: (
        <div className="space-y-4 py-4">
          <div className="flex items-start gap-4 p-4 bg-muted/50 rounded-xl">
            <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
              <Calendar className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-medium">Create events quickly</p>
              <p className="text-sm text-muted-foreground">
                Click any time slot or use the + button to add events
              </p>
            </div>
          </div>
          <div className="flex items-start gap-4 p-4 bg-muted/50 rounded-xl">
            <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
            </div>
            <div>
              <p className="font-medium">Drag to reschedule</p>
              <p className="text-sm text-muted-foreground">
                Simply drag events to move them to a new time
              </p>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'ai',
      title: 'Meet Mally, Your AI Assistant',
      description: 'Chat naturally to manage your schedule.',
      icon: <Bot className="h-8 w-8" />,
      content: (
        <div className="space-y-4 py-4">
          <div className="p-4 bg-gradient-to-r from-primary/20 to-purple-600/20 rounded-xl border border-primary/20">
            <p className="text-sm font-medium mb-2">Try saying:</p>
            <div className="space-y-2">
              {[
                '"Schedule a meeting tomorrow at 2pm"',
                '"What do I have this week?"',
                '"Move my 3pm to Friday"',
              ].map((phrase, i) => (
                <p key={i} className="text-sm text-muted-foreground italic">
                  {phrase}
                </p>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-xl">
            <Mic className="h-5 w-5 text-primary" />
            <p className="text-sm">
              Say <span className="font-semibold text-primary">"Hey Mally"</span> to activate voice control
            </p>
          </div>
        </div>
      ),
    },
    {
      id: 'notifications',
      title: 'Never Miss a Beat',
      description: 'Get reminders and stay on track.',
      icon: <Bell className="h-8 w-8" />,
      content: (
        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-3">
            {[
              { icon: '🔔', label: 'Event reminders' },
              { icon: '📧', label: 'Email digests' },
              { icon: '💬', label: 'Slack alerts' },
              { icon: '📅', label: 'Daily summaries' },
            ].map((item, i) => (
              <div
                key={i}
                className="flex items-center gap-3 p-3 bg-muted/50 rounded-xl"
              >
                <span className="text-xl">{item.icon}</span>
                <span className="text-sm">{item.label}</span>
              </div>
            ))}
          </div>
          <p className="text-sm text-muted-foreground text-center">
            Configure notifications in Settings → Integrations
          </p>
        </div>
      ),
    },
    {
      id: 'ready',
      title: "You're All Set! 🚀",
      description: 'Start organizing your time like a pro.',
      icon: <CheckCircle2 className="h-8 w-8" />,
      content: (
        <div className="text-center py-4">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-green-500/20 flex items-center justify-center">
            <CheckCircle2 className="h-10 w-10 text-green-500" />
          </div>
          <p className="text-muted-foreground mb-4">
            You're ready to boost your productivity!
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {['📊 Analytics', '⏱️ Pomodoro', '✅ Todos', '🎯 Focus Time'].map((feature) => (
              <span
                key={feature}
                className="px-3 py-1 bg-muted rounded-full text-sm"
              >
                {feature}
              </span>
            ))}
          </div>
        </div>
      ),
    },
  ];

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = () => {
    // Trigger confetti
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#8b5cf6', '#7c3aed', '#a855f7', '#c084fc'],
    });
    onComplete();
  };

  const handleSkip = () => {
    onComplete();
  };

  if (!isOpen) return null;

  const step = steps[currentStep];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-background border border-border rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
        {/* Header */}
        <div className="relative p-6 pb-0">
          <button
            onClick={handleSkip}
            className="absolute top-4 right-4 p-2 hover:bg-muted rounded-lg transition-colors"
          >
            <X className="h-4 w-4" />
          </button>

          {/* Progress */}
          <div className="flex gap-1 mb-6">
            {steps.map((_, i) => (
              <div
                key={i}
                className={cn(
                  "h-1 flex-1 rounded-full transition-colors",
                  i <= currentStep ? "bg-primary" : "bg-muted"
                )}
              />
            ))}
          </div>

          {/* Step Icon */}
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-primary/20 to-purple-600/20 flex items-center justify-center text-primary">
            {step.icon}
          </div>

          {/* Title */}
          <h2 className="text-2xl font-bold text-center mb-2">{step.title}</h2>
          <p className="text-muted-foreground text-center">{step.description}</p>
        </div>

        {/* Content */}
        <div className="p-6">{step.content}</div>

        {/* Footer */}
        <div className="p-6 pt-0 flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={handlePrev}
            disabled={currentStep === 0}
            className={cn(currentStep === 0 && "invisible")}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>

          <Button onClick={handleNext} className="min-w-[120px]">
            {currentStep === steps.length - 1 ? (
              <>
                Get Started
                <Rocket className="h-4 w-4 ml-2" />
              </>
            ) : (
              <>
                Next
                <ArrowRight className="h-4 w-4 ml-2" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

// Wrapper component that auto-shows for new users
export function OnboardingWrapper({ children }: { children: React.ReactNode }) {
  const { showOnboarding, setShowOnboarding, completeOnboarding } = useOnboarding();

  return (
    <>
      {children}
      <OnboardingModal
        isOpen={showOnboarding}
        onClose={() => setShowOnboarding(false)}
        onComplete={completeOnboarding}
      />
    </>
  );
}
