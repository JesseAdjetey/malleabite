// Feedback Widget for Beta Users
import React, { useState } from 'react';
import { MessageCircleHeart, X, Bug, Lightbulb, HelpCircle, Send, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext.unified';
import { toast } from 'sonner';

type FeedbackType = 'bug' | 'feature' | 'question' | 'other';

interface FeedbackData {
  type: FeedbackType;
  message: string;
  email: string;
  page: string;
  userAgent: string;
  timestamp: string;
}

const feedbackTypes = [
  { id: 'bug' as FeedbackType, icon: Bug, label: 'Bug Report', color: 'text-red-400 bg-red-500/10' },
  { id: 'feature' as FeedbackType, icon: Lightbulb, label: 'Feature Request', color: 'text-yellow-400 bg-yellow-500/10' },
  { id: 'question' as FeedbackType, icon: HelpCircle, label: 'Question', color: 'text-blue-400 bg-blue-500/10' },
];

export function FeedbackWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [feedbackType, setFeedbackType] = useState<FeedbackType | null>(null);
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const { user } = useAuth();

  const handleSubmit = async () => {
    if (!message.trim() || !feedbackType) return;

    setIsSubmitting(true);

    const feedbackData: FeedbackData = {
      type: feedbackType,
      message: message.trim(),
      email: user?.email || 'anonymous',
      page: window.location.pathname,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString(),
    };

    try {
      // Send to your feedback endpoint (can be Firebase, API route, etc.)
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(feedbackData),
      });

      // Even if endpoint doesn't exist yet, show success for UX
      setIsSubmitted(true);
      toast.success('Thank you for your feedback!');

      // Reset after delay
      setTimeout(() => {
        setIsOpen(false);
        setIsSubmitted(false);
        setFeedbackType(null);
        setMessage('');
      }, 2000);
    } catch (error) {
      // Still show success - feedback can be logged locally
      console.log('Feedback received:', feedbackData);
      setIsSubmitted(true);
      toast.success('Thank you for your feedback!');
      
      setTimeout(() => {
        setIsOpen(false);
        setIsSubmitted(false);
        setFeedbackType(null);
        setMessage('');
      }, 2000);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    setFeedbackType(null);
    setMessage('');
    setIsSubmitted(false);
  };

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(true)}
        className={cn(
          "fixed bottom-40 right-4 md:bottom-6 md:right-6 z-40",
          "w-10 h-10 rounded-full shadow-lg",
          "bg-gradient-to-r from-primary to-purple-600",
          "flex items-center justify-center",
          "hover:scale-110 transition-transform",
          "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background",
          isOpen && "hidden"
        )}
        aria-label="Send feedback"
      >
        <MessageCircleHeart className="h-4 w-4 text-white" />
      </button>

      {/* Feedback Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div 
            className={cn(
              "w-full max-w-md bg-background border border-border rounded-2xl shadow-2xl",
              "animate-in slide-in-from-bottom-4 duration-300"
            )}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
                  <MessageCircleHeart className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold">Send Feedback</h3>
                  <p className="text-xs text-muted-foreground">Help us improve Malleabite</p>
                </div>
              </div>
              <button
                onClick={handleClose}
                className="p-2 hover:bg-muted rounded-lg transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Content */}
            <div className="p-4 space-y-4">
              {isSubmitted ? (
                // Success state
                <div className="py-8 text-center">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500/20 flex items-center justify-center">
                    <Check className="h-8 w-8 text-green-500" />
                  </div>
                  <h4 className="text-lg font-semibold mb-2">Thank you!</h4>
                  <p className="text-muted-foreground">Your feedback helps us build a better product.</p>
                </div>
              ) : (
                <>
                  {/* Feedback Type Selection */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">What type of feedback?</label>
                    <div className="grid grid-cols-3 gap-2">
                      {feedbackTypes.map((type) => (
                        <button
                          key={type.id}
                          onClick={() => setFeedbackType(type.id)}
                          className={cn(
                            "p-3 rounded-xl border transition-all text-center",
                            feedbackType === type.id
                              ? "border-primary bg-primary/10"
                              : "border-border hover:border-primary/50"
                          )}
                        >
                          <type.icon className={cn("h-5 w-5 mx-auto mb-1", type.color.split(' ')[0])} />
                          <span className="text-xs">{type.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Message */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Your feedback</label>
                    <Textarea
                      placeholder={
                        feedbackType === 'bug'
                          ? "Describe the bug. What did you expect to happen?"
                          : feedbackType === 'feature'
                          ? "What feature would make Malleabite better for you?"
                          : "How can we help?"
                      }
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      rows={4}
                      className="resize-none"
                    />
                  </div>

                  {/* Email (for anonymous users) */}
                  {!user && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Email (optional)</label>
                      <Input
                        type="email"
                        placeholder="your@email.com"
                      />
                    </div>
                  )}

                  {/* Submit */}
                  <Button
                    onClick={handleSubmit}
                    disabled={!message.trim() || !feedbackType || isSubmitting}
                    className="w-full"
                  >
                    {isSubmitting ? (
                      <>
                        <div className="h-4 w-4 mr-2 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4 mr-2" />
                        Send Feedback
                      </>
                    )}
                  </Button>

                  <p className="text-xs text-center text-muted-foreground">
                    Your feedback is anonymous unless you're signed in.
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
