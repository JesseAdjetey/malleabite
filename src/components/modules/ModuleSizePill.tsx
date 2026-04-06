import React, { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { SizeLevel } from '@/lib/stores/types';
import { useSidebarBounds } from '@/contexts/SidebarBoundsContext';

interface ModuleSizePillProps {
  currentLevel: SizeLevel;
  onChangeLevel: (level: SizeLevel) => void;
  moduleRef: React.RefObject<HTMLDivElement | null>;
}

const LEVEL_LABELS: Record<SizeLevel, string> = {
  0: 'Collapse',
  1: 'Normal',
  2: 'Sidebar',
  3: 'Fullscreen',
};

// Visual indicator shape for each level in the pill
const LevelIcon: React.FC<{ level: SizeLevel; isActive: boolean; isHovered: boolean }> = ({
  level,
  isActive,
  isHovered,
}) => {
  const base = 'rounded-sm transition-all duration-150';
  const activeColor = 'bg-purple-500';
  const inactiveColor = 'bg-white/30';
  const hoveredColor = 'bg-purple-400';

  const color = isActive ? activeColor : isHovered ? hoveredColor : inactiveColor;

  switch (level) {
    case 0:
      // Tiny dash = collapsed
      return <div className={`w-3.5 h-0.5 ${base} ${color}`} />;
    case 1:
      // Small square = normal
      return <div className={`w-3 h-3 ${base} ${color}`} />;
    case 2:
      // Taller rectangle = sidebar fill
      return <div className={`w-3.5 h-4 ${base} ${color}`} />;
    case 3:
      // Large square = fullscreen
      return <div className={`w-4 h-4 ${base} ${color} ring-1 ring-white/20`} />;
  }
};

const ModuleSizePill: React.FC<ModuleSizePillProps> = ({
  currentLevel,
  onChangeLevel,
  moduleRef,
}) => {
  const [hoveredLevel, setHoveredLevel] = useState<SizeLevel | null>(null);
  const sidebarBounds = useSidebarBounds();

  const getGhostBounds = (level: SizeLevel) => {
    if (level === 0 || level === 1) {
      // No ghost for collapsed or normal — these are clear
      return null;
    }
    if (level === 2) {
      // Ghost = sidebar bounds
      return sidebarBounds ?? null;
    }
    if (level === 3) {
      // Ghost = full viewport
      return {
        top: 0,
        left: 0,
        width: window.innerWidth,
        height: window.innerHeight,
      };
    }
    return null;
  };

  const ghostBounds = hoveredLevel !== null ? getGhostBounds(hoveredLevel) : null;

  const levels: SizeLevel[] = [0, 1, 2, 3];

  return (
    <>
      {/* The pill */}
      <motion.div
        className="absolute bottom-full left-1/2 mb-2 z-50"
        style={{ transform: 'translateX(-50%)' }}
        initial={{ opacity: 0, y: 4, scale: 0.92 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 4, scale: 0.92 }}
        transition={{ type: 'spring', damping: 20, stiffness: 300 }}
      >
        {/* Tooltip label */}
        <AnimatePresence>
          {hoveredLevel !== null && (
            <motion.div
              key={hoveredLevel}
              className="absolute bottom-full left-1/2 mb-1 whitespace-nowrap text-[10px] text-white/80 bg-black/70 px-2 py-0.5 rounded-full pointer-events-none"
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
        <div className="flex items-center gap-2 px-3 py-2 bg-black/70 backdrop-blur-xl rounded-full border border-white/10 shadow-xl">
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
                relative flex items-center justify-center w-7 h-7 rounded-full transition-all duration-150
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

        {/* Small arrow pointing down to the button */}
        <div className="flex justify-center">
          <div className="w-2 h-1 bg-black/70 clip-arrow" style={{
            clipPath: 'polygon(0 0, 100% 0, 50% 100%)',
          }} />
        </div>
      </motion.div>

      {/* Ghost preview portal */}
      {ghostBounds && createPortal(
        <AnimatePresence>
          <motion.div
            key={`ghost-${hoveredLevel}`}
            className="fixed pointer-events-none z-[9999] rounded-2xl"
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
            {/* Purple border glow */}
            <div className="absolute inset-0 rounded-2xl border-2 border-purple-400/80 shadow-[0_0_20px_4px_rgba(168,85,247,0.25)]" />
            {/* Subtle fill */}
            <div className="absolute inset-0 rounded-2xl bg-purple-500/8" />
          </motion.div>
        </AnimatePresence>,
        document.body
      )}
    </>
  );
};

export default ModuleSizePill;
