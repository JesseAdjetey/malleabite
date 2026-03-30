import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Keyboard } from 'lucide-react';

const TIPS = [
  { keys: 'C', label: 'Create a new event' },
  { keys: 'T', label: 'Jump to today' },
  { keys: 'M / W / D', label: 'Switch calendar view' },
  { keys: 'J / K', label: 'Navigate forward / back' },
  { keys: 'B', label: 'Toggle bulk select mode' },
  { keys: 'Shift+click', label: 'Start bulk selection' },
  { keys: 'Alt+drag', label: 'Duplicate an event' },
  { keys: '?', label: 'See all keyboard shortcuts' },
];

const INTERVAL = 8000;

export function ShortcutsTipStrip() {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 3000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!visible) return;
    const t = setInterval(() => setIndex(i => (i + 1) % TIPS.length), INTERVAL);
    return () => clearInterval(t);
  }, [visible]);

  if (!visible) return <div className="h-[30px]" />;

  const tip = TIPS[index];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="flex items-center justify-center gap-1.5 px-4 py-[7px] border-t border-black/[0.05] dark:border-white/[0.05] text-[11px] text-muted-foreground/40 select-none shrink-0"
    >
      <Keyboard className="h-3 w-3 shrink-0 opacity-60" />
      <AnimatePresence mode="wait">
        <motion.span
          key={index}
          initial={{ opacity: 0, y: 3 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -3 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="flex items-center gap-1"
        >
          <span>Press</span>
          <span className="font-mono font-medium text-muted-foreground/60 bg-black/[0.06] dark:bg-white/[0.07] rounded px-1 py-px">
            {tip.keys}
          </span>
          <span>— {tip.label}</span>
        </motion.span>
      </AnimatePresence>
    </motion.div>
  );
}
