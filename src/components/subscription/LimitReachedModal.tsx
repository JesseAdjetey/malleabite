import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Crown, TrendingUp, Zap } from 'lucide-react';
import { getUpgradePrompt } from '@/lib/subscription-limits';

interface LimitReachedModalProps {
  isOpen: boolean;
  onClose: () => void;
  feature: 'events' | 'aiRequests' | 'modules' | 'templates' | 'analytics' | 'team';
}

export function LimitReachedModal({ 
  isOpen, 
  onClose, 
  feature 
}: LimitReachedModalProps) {
  const navigate = useNavigate();
  const [isNavigating, setIsNavigating] = useState(false);
  
  const prompt = getUpgradePrompt(feature);
  
  const handleUpgrade = () => {
    setIsNavigating(true);
    navigate('/pricing');
    onClose();
  };
  
  const getIcon = () => {
    switch (feature) {
      case 'team':
        return <Crown className="h-12 w-12 text-yellow-500" />;
      case 'analytics':
        return <TrendingUp className="h-12 w-12 text-blue-500" />;
      default:
        return <Zap className="h-12 w-12 text-primary" />;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex justify-center mb-4">
            {getIcon()}
          </div>
          <DialogTitle className="text-center text-2xl">
            {prompt.title}
          </DialogTitle>
          <DialogDescription className="text-center text-base pt-2">
            {prompt.message}
          </DialogDescription>
        </DialogHeader>

        <div className="bg-muted/50 rounded-lg p-4 my-4">
          <h4 className="font-semibold mb-2">With Pro, you get:</h4>
          <ul className="space-y-1.5 text-sm">
            <li className="flex items-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-primary" />
              <span>Unlimited events and todos</span>
            </li>
            <li className="flex items-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-primary" />
              <span>Unlimited AI assistance</span>
            </li>
            <li className="flex items-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-primary" />
              <span>All productivity modules</span>
            </li>
            <li className="flex items-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-primary" />
              <span>Advanced analytics & insights</span>
            </li>
            <li className="flex items-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-primary" />
              <span>Priority support</span>
            </li>
          </ul>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            className="w-full sm:w-auto"
          >
            Maybe Later
          </Button>
          <Button
            onClick={handleUpgrade}
            disabled={isNavigating}
            className="w-full sm:w-auto"
          >
            <Crown className="mr-2 h-4 w-4" />
            {prompt.ctaText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Hook to use the limit reached modal
export function useLimitReachedModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [feature, setFeature] = useState<LimitReachedModalProps['feature']>('events');

  const showLimitModal = (limitFeature: LimitReachedModalProps['feature']) => {
    setFeature(limitFeature);
    setIsOpen(true);
  };

  const Modal = () => (
    <LimitReachedModal
      isOpen={isOpen}
      onClose={() => setIsOpen(false)}
      feature={feature}
    />
  );

  return {
    showLimitModal,
    LimitReachedModal: Modal,
  };
}
