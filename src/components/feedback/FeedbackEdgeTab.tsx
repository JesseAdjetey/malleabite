import { useState, useEffect, useRef } from 'react';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '@/integrations/firebase/config';
import { useAuth } from '@/contexts/AuthContext.unified';
import { useToast } from '@/hooks/use-toast';

const PHRASES = [
  "what broke today?",
  "something bugging you?",
  "be brutally honest.",
  "what's annoying you?",
  "make us better.",
  "got a frustration?",
  "tell us everything.",
  "what's missing?",
];

export function FeedbackEdgeTab() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [displayText, setDisplayText] = useState('');
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [isTyping, setIsTyping] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  // Typewriter effect — pauses when sheet is open
  useEffect(() => {
    if (open) return;

    const phrase = PHRASES[phraseIndex];

    if (isTyping) {
      if (displayText.length < phrase.length) {
        timeoutRef.current = setTimeout(() => {
          setDisplayText(phrase.slice(0, displayText.length + 1));
        }, 75);
      } else {
        timeoutRef.current = setTimeout(() => setIsTyping(false), 2800);
      }
    } else {
      if (displayText.length > 0) {
        timeoutRef.current = setTimeout(() => {
          setDisplayText(displayText.slice(0, -1));
        }, 35);
      } else {
        setPhraseIndex((prev) => (prev + 1) % PHRASES.length);
        setIsTyping(true);
      }
    }

    return () => clearTimeout(timeoutRef.current);
  }, [displayText, isTyping, phraseIndex, open]);

  const handleSubmit = async () => {
    if (!message.trim() || submitting) return;
    setSubmitting(true);
    try {
      const writeTimeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), 8000)
      );
      await Promise.race([
        addDoc(collection(db, 'feedback'), {
          message: message.trim(),
          userId: user?.uid ?? null,
          userEmail: user?.email ?? null,
          createdAt: serverTimestamp(),
          page: window.location.pathname,
        }),
        writeTimeout,
      ]);
      setSubmitted(true);
      setMessage('');
    } catch (err) {
      const msg = err instanceof Error && err.message === 'timeout'
        ? 'Request timed out. Check your connection.'
        : 'Failed to send. Try again in a moment.';
      toast({ title: 'Could not send', description: msg, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpen = () => {
    setOpen(true);
    setSubmitted(false);
  };

  return (
    <>
      {/* Bottom-left pill */}
      <button
        onClick={handleOpen}
        aria-label="Open feedback"
        className="fixed top-2 left-80 z-40 hidden lg:flex items-center gap-2 px-3 py-1.5 cursor-pointer select-none"
        style={{
          background: 'hsl(var(--muted))',
          borderRadius: '999px',
          border: '1px solid hsl(var(--border))',
          boxShadow: '0 2px 10px hsl(var(--foreground) / 0.06)',
          transition: 'box-shadow 0.2s ease, background 0.2s ease, transform 0.15s ease',
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 18px hsl(var(--foreground) / 0.12)';
          (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 2px 10px hsl(var(--foreground) / 0.06)';
          (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)';
        }}
      >
        <span className="text-[10px] opacity-50" style={{ color: 'hsl(var(--muted-foreground))' }}>✦</span>
        <span
          className="text-[11px] font-mono"
          style={{
            color: 'hsl(var(--muted-foreground))',
            minWidth: '160px',
            textAlign: 'left',
          }}
        >
          {displayText || '\u00A0'}
          <span
            className="inline-block w-[1px] h-[10px] ml-[1px] align-middle animate-pulse"
            style={{ background: 'hsl(var(--muted-foreground))', opacity: 0.6 }}
          />
        </span>
      </button>

      {/* Feedback Sheet */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          className="w-[380px] sm:w-[420px] flex flex-col p-0 gap-0"
          style={{ borderLeft: '1px solid hsl(var(--border))' }}
        >
          {/* Header */}
          <div className="px-8 pt-10 pb-6 border-b border-border/50">
            <p
              className="text-2xl font-semibold tracking-tight"
              style={{ fontFamily: 'inherit', letterSpacing: '-0.02em' }}
            >
              {submitted ? 'got it. 🫡' : 'vent to us.'}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {submitted
                ? 'we actually read these, promise.'
                : "what's frustrating you? what's missing? what broke?"}
            </p>
          </div>

          {/* Body */}
          <div className="flex-1 px-8 py-6 flex flex-col gap-4">
            {submitted ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center text-xl"
                  style={{ background: 'hsl(var(--primary) / 0.1)' }}
                >
                  ✓
                </div>
                <p className="text-sm text-muted-foreground max-w-[220px]">
                  your frustration has been noted. we'll do something about it.
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-2 text-xs"
                  onClick={() => setSubmitted(false)}
                >
                  send another
                </Button>
              </div>
            ) : (
              <>
                <Textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="type here, don't hold back..."
                  className="flex-1 resize-none text-sm leading-relaxed min-h-[200px]"
                  style={{
                    background: 'hsl(var(--muted) / 0.4)',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    padding: '14px 16px',
                    fontFamily: 'inherit',
                  }}
                  onKeyDown={(e) => {
                    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') handleSubmit();
                  }}
                />
                <p className="text-xs text-muted-foreground/60 -mt-1">
                  ⌘ + Enter to send
                </p>
              </>
            )}
          </div>

          {/* Footer */}
          {!submitted && (
            <div className="px-8 pb-8 pt-2 border-t border-border/50 flex items-center justify-between">
              <p className="text-xs text-muted-foreground/50">
                {user ? `as ${user.email}` : 'anonymous'}
              </p>
              <Button
                onClick={handleSubmit}
                disabled={!message.trim() || submitting}
                size="sm"
                className="text-sm font-medium px-5"
              >
                {submitting ? 'sending...' : 'send it →'}
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
