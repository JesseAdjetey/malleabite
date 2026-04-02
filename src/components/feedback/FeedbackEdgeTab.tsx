import { useState, useEffect, useRef } from 'react';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '@/integrations/firebase/config';
import { useAuth } from '@/contexts/AuthContext.unified';
import { useToast } from '@/hooks/use-toast';
import { sounds } from '@/lib/sounds';

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

const PANEL_HEIGHT = 260;
const TAB_HEIGHT = 34;
const TAB_WIDTH = 200;
const PANEL_WIDTH = 580;
const INITIAL_X = 320;

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
  const typewriterRef = useRef<ReturnType<typeof setTimeout>>();

  // Panel animation: containerY = -PANEL_HEIGHT (closed) → 0 (open)
  // The container is fixed at top:0, so when y = -PANEL_HEIGHT only the tab peeks out
  const containerY = useMotionValue(-PANEL_HEIGHT);
  const tabX = useMotionValue(INITIAL_X);

  const backdropOpacity = useTransform(containerY, [-PANEL_HEIGHT, -PANEL_HEIGHT * 0.2, 0], [0, 0, 0.45]);

  const springOpen = () => {
    animate(containerY, 0, { type: 'spring', stiffness: 260, damping: 28 });
    setOpen(true);
  };

  const springClose = () => {
    animate(containerY, -PANEL_HEIGHT, { type: 'spring', stiffness: 300, damping: 32 });
    setOpen(false);
    setSubmitted(false);
  };

  // Manual drag state (avoids conflicting with Framer's drag system)
  const drag = useRef<{
    active: boolean;
    startX: number;
    startY: number;
    startTabX: number;
    startContainerY: number;
    mode: 'x' | 'y' | null;
    moved: boolean;
  }>({ active: false, startX: 0, startY: 0, startTabX: INITIAL_X, startContainerY: -PANEL_HEIGHT, mode: null, moved: false });

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = {
      active: true,
      startX: e.clientX,
      startY: e.clientY,
      startTabX: tabX.get(),
      startContainerY: containerY.get(),
      mode: null,
      moved: false,
    };
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!drag.current.active) return;
    const dx = e.clientX - drag.current.startX;
    const dy = e.clientY - drag.current.startY;

    if (drag.current.mode === null) {
      if (Math.abs(dx) > 6 || Math.abs(dy) > 6) {
        drag.current.moved = true;
        drag.current.mode = Math.abs(dx) >= Math.abs(dy) ? 'x' : 'y';
        sounds.play("feedbackOpen");
      }
      return;
    }

    if (drag.current.mode === 'x') {
      const newX = Math.max(0, Math.min(window.innerWidth - PANEL_WIDTH, drag.current.startTabX + dx));
      tabX.set(newX);
    } else if (drag.current.mode === 'y') {
      const newY = Math.max(-PANEL_HEIGHT, Math.min(0, drag.current.startContainerY + dy));
      containerY.set(newY);
    }
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!drag.current.active) return;
    drag.current.active = false;
    const dy = e.clientY - drag.current.startY;
    const { mode, moved } = drag.current;

    if (!moved) {
      // Pure click
      sounds.play("feedbackOpen");
      open ? springClose() : springOpen();
      return;
    }

    if (mode === 'y') {
      const currentY = containerY.get();
      if (!open) {
        (currentY > -PANEL_HEIGHT * 0.55 || dy > 60) ? springOpen() : springClose();
      } else {
        (currentY < -PANEL_HEIGHT * 0.45 || dy < -60) ? springClose() : springOpen();
      }
    }
  };

  // Typewriter — pauses when open
  useEffect(() => {
    if (open) return;
    const phrase = PHRASES[phraseIndex];
    if (isTyping) {
      if (displayText.length < phrase.length) {
        typewriterRef.current = setTimeout(() => setDisplayText(phrase.slice(0, displayText.length + 1)), 75);
      } else {
        typewriterRef.current = setTimeout(() => setIsTyping(false), 2800);
      }
    } else {
      if (displayText.length > 0) {
        typewriterRef.current = setTimeout(() => setDisplayText(displayText.slice(0, -1)), 35);
      } else {
        setPhraseIndex(prev => (prev + 1) % PHRASES.length);
        setIsTyping(true);
      }
    }
    return () => clearTimeout(typewriterRef.current);
  }, [displayText, isTyping, phraseIndex, open]);

  const handleSubmit = async () => {
    if (!message.trim() || submitting) return;
    setSubmitting(true);
    try {
      await Promise.race([
        addDoc(collection(db, 'feedback'), {
          message: message.trim(),
          userId: user?.uid ?? null,
          userEmail: user?.email ?? null,
          createdAt: serverTimestamp(),
          page: window.location.pathname,
        }),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 8000)),
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

  return (
    <>
      {/* Blurred backdrop — fades in as panel opens */}
      <motion.div
        className="fixed inset-0 backdrop-blur-sm"
        style={{
          opacity: backdropOpacity,
          background: 'hsl(var(--foreground) / 0.2)',
          pointerEvents: open ? 'auto' : 'none',
          zIndex: 39,
        }}
        onClick={springClose}
      />

      {/* Container: panel (top) + tab ear (bottom-left) — desktop only */}
      <motion.div
        className="hidden lg:block"
        style={{
          position: 'fixed',
          top: 0,
          x: tabX,
          y: containerY,
          width: PANEL_WIDTH,
          height: PANEL_HEIGHT + TAB_HEIGHT,
          zIndex: 40,
        }}
      >
        <div style={{ position: 'relative', width: '100%', height: '100%' }}>
        {/* Panel body — full width, hidden above viewport when closed */}
        <div
          className="flex overflow-hidden"
          style={{
            height: PANEL_HEIGHT,
            background: 'hsl(var(--background))',
            border: '1px solid hsl(var(--border))',
            borderTop: 'none',
            borderRadius: '0 0 16px 0',
            boxShadow: '0 8px 32px hsl(var(--foreground) / 0.1)',
          }}
        >
          {/* Left column — info */}
          <div
            className="flex flex-col justify-between p-7 flex-shrink-0"
            style={{
              width: 190,
              borderRight: '1px solid hsl(var(--border) / 0.6)',
            }}
          >
            <div>
              <p
                className="text-lg font-semibold leading-tight"
                style={{ letterSpacing: '-0.02em', color: 'hsl(var(--foreground))' }}
              >
                {submitted ? 'got it. 🫡' : 'vent to us.'}
              </p>
              <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                {submitted
                  ? 'we actually read these, promise.'
                  : "what's frustrating? what's missing? what broke?"}
              </p>
            </div>
            <p className="text-[10px] text-muted-foreground/40 truncate">
              {user ? user.email : 'anonymous'}
            </p>
          </div>

          {/* Right column — input */}
          <div className="flex-1 flex flex-col p-5 gap-3">
            {submitted ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-base"
                  style={{ background: 'hsl(var(--primary) / 0.1)', color: 'hsl(var(--primary))' }}
                >
                  ✓
                </div>
                <p className="text-sm text-muted-foreground">your frustration has been noted.</p>
                <Button variant="ghost" size="sm" className="text-xs mt-1" onClick={() => setSubmitted(false)}>
                  send another
                </Button>
              </div>
            ) : (
              <>
                <Textarea
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  placeholder="type here, don't hold back..."
                  className="flex-1 resize-none text-sm leading-relaxed"
                  style={{
                    background: 'hsl(var(--muted) / 0.5)',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    padding: '10px 14px',
                    fontFamily: 'inherit',
                    minHeight: 0,
                  }}
                  onKeyDown={e => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') handleSubmit(); }}
                />
                <div className="flex items-center justify-between flex-shrink-0">
                  <span className="text-[10px] text-muted-foreground/40">⌘ + Enter to send</span>
                  <Button
                    onClick={handleSubmit}
                    disabled={!message.trim() || submitting}
                    size="sm"
                    className="text-xs font-medium px-4 h-7"
                  >
                    {submitting ? 'sending...' : 'send it →'}
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Tab ear — narrow file-tab handle, absolute at bottom-left */}
        <div
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          className="absolute flex items-center gap-2 px-3 select-none"
          style={{
            bottom: 0,
            left: 0,
            width: TAB_WIDTH,
            height: TAB_HEIGHT,
            background: 'hsl(var(--muted))',
            borderLeft: '1px solid hsl(var(--border))',
            borderRight: '1px solid hsl(var(--border))',
            borderBottom: '1px solid hsl(var(--border))',
            borderRadius: '0 0 10px 10px',
            boxShadow: '0 4px 14px hsl(var(--foreground) / 0.07)',
            cursor: 'grab',
            touchAction: 'none',
          }}
        >
          <span className="text-[10px] opacity-40 flex-shrink-0" style={{ color: 'hsl(var(--muted-foreground))' }}>
            {open ? '↑' : '✦'}
          </span>
          <span
            className="text-[11px] font-mono flex-1 truncate"
            style={{ color: 'hsl(var(--muted-foreground))' }}
          >
            {open ? 'drag up to close' : (displayText || '\u00A0')}
            {!open && (
              <span
                className="inline-block w-[1px] h-[10px] ml-[0.5px] align-middle animate-pulse"
                style={{ background: 'hsl(var(--muted-foreground))', opacity: 0.55 }}
              />
            )}
          </span>
        </div>
        </div>{/* end relative inner wrapper */}
      </motion.div>
    </>
  );
}
