import { Crown, Zap, ArrowRight, Calendar, Brain, Layout, BarChart3, Repeat } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useUsageLimits } from '@/hooks/use-usage-limits';

export type UpgradeFeature = 'events' | 'ai' | 'modules' | 'analytics' | 'recurring';

interface UpgradePromptPropsControlled {
  open: boolean;
  onClose: () => void;
  feature: UpgradeFeature | null;
  currentUsage?: number;
  limit?: number;
}

// For use in places that manually control the prompt
export const UpgradePromptControlled: React.FC<UpgradePromptPropsControlled> = (props) => {
  return <UpgradePromptInner {...props} />;
};

// Self-managing version that uses the hook (for App.tsx)
export const UpgradePrompt: React.FC = () => {
  const { showUpgradePrompt, upgradePromptFeature, hideUpgradePrompt, limits } = useUsageLimits();
  
  return (
    <UpgradePromptInner
      open={showUpgradePrompt}
      onClose={hideUpgradePrompt}
      feature={upgradePromptFeature}
      currentUsage={
        upgradePromptFeature === 'events' ? limits.eventsUsed :
        upgradePromptFeature === 'ai' ? limits.aiRequestsUsed :
        upgradePromptFeature === 'modules' ? limits.modulesUsed :
        undefined
      }
      limit={
        upgradePromptFeature === 'events' ? limits.eventsLimit :
        upgradePromptFeature === 'ai' ? limits.aiRequestsLimit :
        upgradePromptFeature === 'modules' ? limits.modulesLimit :
        undefined
      }
    />
  );
};

interface UpgradePromptInnerProps {
  open: boolean;
  onClose: () => void;
  feature: UpgradeFeature | null;
  currentUsage?: number;
  limit?: number;
}

const featureConfig: Record<UpgradeFeature, {
  title: string;
  description: string;
  benefit: string;
  icon: React.ComponentType<{ className?: string }>;
}> = {
  events: {
    title: 'Event Limit Reached',
    description: "You've used all 50 events this month on the free plan.",
    benefit: 'Upgrade to Pro for unlimited events!',
    icon: Calendar,
  },
  ai: {
    title: 'AI Requests Exhausted',
    description: "You've used all 10 Mally AI requests this month.",
    benefit: 'Upgrade to Pro for unlimited AI assistance!',
    icon: Brain,
  },
  modules: {
    title: 'Module Limit Reached',
    description: 'Free users can only have 3 active sidebar modules.',
    benefit: 'Upgrade to Pro to unlock all productivity modules!',
    icon: Layout,
  },
  analytics: {
    title: 'Premium Feature',
    description: 'Advanced analytics is a Pro feature.',
    benefit: 'Upgrade to unlock detailed productivity insights!',
    icon: BarChart3,
  },
  recurring: {
    title: 'Premium Feature',
    description: 'Recurring events is a Pro feature.',
    benefit: 'Upgrade to create recurring schedules and save time!',
    icon: Repeat,
  },
};

function UpgradePromptInner({ 
  open, 
  onClose, 
  feature, 
  currentUsage, 
  limit 
}: UpgradePromptInnerProps) {
  const navigate = useNavigate();
  
  if (!feature) return null;
  
  const config = featureConfig[feature];
  const Icon = config.icon;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-4 w-14 h-14 rounded-full bg-gradient-to-br from-amber-400 via-orange-500 to-red-500 flex items-center justify-center shadow-lg">
            <Crown className="w-7 h-7 text-white" />
          </div>
          <DialogTitle className="text-center text-xl">{config.title}</DialogTitle>
          <DialogDescription className="text-center">
            {config.description}
            {currentUsage !== undefined && limit !== undefined && (
              <span className="block mt-2 font-medium text-foreground">
                Usage: {currentUsage} / {limit}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>
        
        {/* Benefit highlight */}
        <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent rounded-lg p-4 my-4 border border-primary/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
              <Icon className="w-5 h-5 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2 text-primary font-semibold">
                <Zap className="w-4 h-4" />
                {config.benefit}
              </div>
            </div>
          </div>
        </div>

        {/* Pro plan highlights */}
        <div className="space-y-2 text-sm text-muted-foreground mb-4">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
            Unlimited events
          </div>
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
            Unlimited AI assistance
          </div>
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
            All productivity modules
          </div>
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
            Advanced analytics
          </div>
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
            Recurring events
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Button 
            onClick={() => {
              onClose();
              navigate('/pricing');
            }}
            className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-lg"
            size="lg"
          >
            Upgrade to Pro - $9.99/mo
            <ArrowRight className="ml-2 w-4 h-4" />
          </Button>
          <Button variant="ghost" onClick={onClose} className="text-muted-foreground">
            Maybe Later
          </Button>
        </div>
        
        {/* Money back guarantee */}
        <p className="text-center text-xs text-muted-foreground">
          30-day money-back guarantee • Cancel anytime
        </p>
      </DialogContent>
    </Dialog>
  );
}

export default UpgradePrompt;
