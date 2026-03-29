import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Timer, X, GripHorizontal } from 'lucide-react';
import { useCountdownEvents } from '@/hooks/use-countdown-events';
import { useAuth } from '@/contexts/AuthContext.unified';
import { cn } from '@/lib/utils';

/** Animated digit that slides up when the value changes */
const SlideDigit: React.FC<{ value: number; pad?: boolean }> = ({ value, pad = true }) => {
  const display = pad ? String(value).padStart(2, '0') : String(value);
  return (
    <span className="inline-flex overflow-hidden relative" style={{ minWidth: pad ? '1.4ch' : undefined }}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={display}
          initial={{ y: '100%', opacity: 0 }}
          animate={{ y: '0%', opacity: 1 }}
          exit={{ y: '-100%', opacity: 0 }}
          transition={{ type: 'spring', stiffness: 500, damping: 40, mass: 0.5 }}
          className="inline-block tabular-nums"
        >
          {display}
        </motion.span>
      </AnimatePresence>
    </span>
  );
};

export const CountdownPanel: React.FC = () => {
  const { user } = useAuth();
  const countdowns = useCountdownEvents();
  const [isOpen, setIsOpen] = useState(false);
  const constraintsRef = useRef<HTMLDivElement>(null);

  // Track drag distance to avoid treating a drag-release as a click
  const dragStartPos = useRef<{ x: number; y: number } | null>(null);
  const hasDragged = useRef(false);

  if (!user || countdowns.length === 0) return null;

  return (
    // Full-screen invisible drag constraint layer
    <div ref={constraintsRef} className="fixed inset-0 pointer-events-none z-40">
      <motion.div
        drag
        dragConstraints={constraintsRef}
        dragMomentum={false}
        dragElastic={0}
        initial={{ x: 16, y: 16 }}
        className="absolute pointer-events-auto"
        style={{ touchAction: 'none' }}
        onDragStart={() => { hasDragged.current = false; }}
        onDrag={() => { hasDragged.current = true; }}
      >
        <AnimatePresence mode="wait">
          {isOpen ? (
            <motion.div
              key="panel"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              className="w-60 rounded-2xl border border-white/20 bg-white/10 dark:bg-black/30 backdrop-blur-2xl shadow-xl overflow-hidden"
            >
              {/* Drag handle + header */}
              <div className="flex items-center justify-between px-3 py-2 border-b border-white/10 cursor-grab active:cursor-grabbing">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground/80">
                  <GripHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
                  <Timer className="h-3.5 w-3.5" />
                  <span>Countdowns</span>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Events list */}
              <div className="max-h-72 overflow-y-auto py-1">
                {countdowns.map(({ event, days, hours, minutes, seconds, progressPercent }) => (
                  <div key={event.id} className="px-3 py-2.5 border-b border-white/5 last:border-0">
                    <div className="text-xs font-medium text-foreground truncate mb-1">{event.title}</div>
                    {/* Time display */}
                    <div
                      className="flex items-baseline gap-0.5 text-base font-bold leading-none mb-1.5"
                      style={{ color: event.color || 'hsl(var(--primary))' }}
                    >
                      {days > 0 && (
                        <>
                          <SlideDigit value={days} pad={false} />
                          <span className="text-xs font-medium opacity-70 mr-1">d</span>
                        </>
                      )}
                      {(days > 0 || hours > 0) && (
                        <>
                          <SlideDigit value={hours} />
                          <span className="text-xs font-medium opacity-70 mr-1">h</span>
                        </>
                      )}
                      <SlideDigit value={minutes} />
                      <span className="text-xs font-medium opacity-70">m</span>
                      {/* Seconds — smaller, slightly muted */}
                      <span className="ml-1 opacity-60 text-sm font-semibold">
                        <SlideDigit value={seconds} />
                        <span className="text-[10px] font-medium opacity-70">s</span>
                      </span>
                    </div>
                    {/* Progress bar */}
                    <div className="h-1 w-full bg-white/10 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-1000"
                        style={{
                          width: `${progressPercent}%`,
                          backgroundColor: event.color || 'hsl(var(--primary))',
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          ) : (
            <motion.button
              key="icon"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              onClick={() => {
                if (!hasDragged.current) {
                  setIsOpen(true);
                }
                hasDragged.current = false;
              }}
              className={cn(
                'relative h-10 w-10 rounded-xl flex items-center justify-center',
                'backdrop-blur-2xl border border-white/20 bg-white/10 dark:bg-black/30',
                'shadow-lg hover:scale-105 active:scale-95 transition-transform touch-manipulation cursor-grab active:cursor-grabbing'
              )}
            >
              <Timer className="h-5 w-5 text-foreground/80" />
              <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
                {countdowns.length}
              </span>
            </motion.button>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};

export default CountdownPanel;
