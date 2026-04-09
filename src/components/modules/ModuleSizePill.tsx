import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { SizeLevel } from '@/lib/stores/types';
import { useSidebarBounds } from '@/contexts/SidebarBoundsContext';

interface ModuleSizePillProps {
  currentLevel: SizeLevel;
  onChangeLevel: (level: SizeLevel) => void;
  buttonRef: React.RefObject<HTMLButtonElement | null>;
}

const LEVEL_LABELS: Record<SizeLevel, string> = {
  0: 'Collapse',
  1: 'Normal',
  2: 'Sidebar',
  3: 'Fullscreen',
};

const LevelIcon: React.FC<{ level: SizeLevel; isActive: boolean; isHovered: boolean }> = ({
  level,
  isActive,
  isHovered,
}) => {
  const color = isActive
    ? 'bg-purple-500'
    : isHovered
    ? 'bg-purple-400'
    : 'bg-white/30';

  switch (level) {
    case 0:
      return <div className={`w-3.5 h-0.5 rounded-sm transition-all duration-150 ${color}`} />;
    case 1:
      return <div className={`w-3 h-3 rounded-sm transition-all duration-150 ${color}`} />;
    case 2:
      return <div className={`w-3.5 h-4 rounded-sm transition-all duration-150 ${color}`} />;
    case 3:
      return (
        <div className={`w-4 h-4 rounded-sm transition-all duration-150 ${color} ring-1 ring-white/20`} />
      );
  }
};

// Rough rendered height of pill + arrow + gap above button
const PILL_TOTAL_HEIGHT = 60;

const ModuleSizePill: React.FC<ModuleSizePillProps> = ({
  currentLevel,
  onChangeLevel,
  buttonRef,
}) => {
  const [hoveredLevel, setHoveredLevel] = useState<SizeLevel | null>(null);
  // Lazy initializer — calculates position synchronously on first render (no null→value flash)
  const [pillPos] = useState<{ x: number; top: number } | null>(() => {
    const el = buttonRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    // Clamp so the pill never goes above 8px from top of viewport
    const idealTop = rect.top - PILL_TOTAL_HEIGHT;
    const safeTop = Math.max(8, idealTop);
    return { x: rect.left + rect.width / 2, top: safeTop };
  });
  const sidebarBounds = useSidebarBounds();

  const getGhostBounds = (level: SizeLevel) => {
    if (level <= 1) return null;
    if (level === 2) return sidebarBounds ?? null;
    return { top: 0, left: 0, width: window.innerWidth, height: window.innerHeight };
  };

  const ghostBounds = hoveredLevel !== null ? getGhostBounds(hoveredLevel) : null;
  const levels: SizeLevel[] = [0, 1, 2, 3];

  if (!pillPos) return null;

  return createPortal(
    <>
      {/* ── Pill ──────────────────────────────────────────── */}
      <motion.div
        className="fixed z-[99999] pointer-events-auto"
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          left: pillPos.x,
          top: pillPos.top,
          transform: 'translateX(-50%)',
        }}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.08, ease: 'easeIn' } }}
        transition={{ duration: 0.12, ease: 'easeOut' }}
      >
        {/* Tooltip label above the pill */}
        <AnimatePresence>
          {hoveredLevel !== null && (
            <motion.div
              key={hoveredLevel}
              className="absolute bottom-full left-1/2 mb-1.5 whitespace-nowrap text-[10px] text-white/80 bg-black/80 px-2 py-0.5 rounded-full pointer-events-none"
              style={{ transform: 'translateX(-50%)' }}
              initial={{ opacity: 0, y: 2 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.1 }}
            >
              {LEVEL_LABELS[hoveredLevel]}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Pill container */}
        <div className="flex items-center gap-1.5 px-3 py-2 bg-black/75 backdrop-blur-xl rounded-full border border-white/10 shadow-2xl">
          {levels.map((level) => (
            <button
              key={level}
              onMouseEnter={() => setHoveredLevel(level)}
              onMouseLeave={() => setHoveredLevel(null)}
              onClick={(e) => {
                e.stopPropagation();
                onChangeLevel(level);
              }}
              className={`
                flex items-center justify-center w-7 h-7 rounded-full transition-all duration-150
                ${level === currentLevel
                  ? 'bg-purple-500/30 ring-1 ring-purple-400/60'
                  : 'hover:bg-white/10'
                }
              `}
              aria-label={LEVEL_LABELS[level]}
            >
              <LevelIcon
                level={level}
                isActive={level === currentLevel}
                isHovered={hoveredLevel === level}
              />
            </button>
          ))}
        </div>

        {/* Arrow pointing down to the button */}
        <div className="flex justify-center mt-0.5">
          <div
            className="w-2 h-1.5 bg-black/75"
            style={{ clipPath: 'polygon(0 0, 100% 0, 50% 100%)' }}
          />
        </div>
      </motion.div>

      {/* ── Ghost preview ─────────────────────────────────── */}
      <AnimatePresence>
        {ghostBounds && (
          <motion.div
            key={`ghost-${hoveredLevel}`}
            className="fixed pointer-events-none z-[9997] rounded-2xl"
            style={{
              top: ghostBounds.top,
              left: ghostBounds.left,
              width: ghostBounds.width,
              height: ghostBounds.height,
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
          >
            <div className="absolute inset-0 rounded-2xl border-2 border-purple-400/80 shadow-[0_0_24px_4px_rgba(168,85,247,0.2)]" />
            <div className="absolute inset-0 rounded-2xl bg-purple-500/5" />
          </motion.div>
        )}
      </AnimatePresence>
    </>,
    document.body
  );
};

export default ModuleSizePill;
