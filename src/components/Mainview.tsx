
import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import MonthView from "@/components/month-view";
import SideBar from "@/components/sidebar/sideBar";
import { useViewStore } from "@/lib/store";
import DayView from "@/components/day-view";
import WeekView from "@/components/week-view";
import Header from "@/components/header/Header";
import { useIsMobile } from "@/hooks/use-mobile";
import { AnimatePresence, motion } from "framer-motion";
import { GridBackground } from "@/components/ui/grid-background";
import RippleBorder from "@/components/ui/RippleBorder";
import { useCalendarFilterBridge } from "@/hooks/use-calendar-filter-bridge";
import TemplateToolbar from "@/components/calendar/TemplateToolbar";
import MobileModuleSheet from "@/components/mobile/MobileModuleSheet";
import { ShortcutsTipStrip } from "@/components/calendar/ShortcutsTipStrip";
import { sounds } from "@/lib/sounds";

type SidebarLayoutMode = 'normal' | 'hidden' | 'fullscreen';

const TRIGGER_PX = 80;
const MIN_WIDTH = 280;

// ── Circular progress indicator ──────────────────────────────────────────────
const RoundIndicator = ({
  text,
  progress,
  side,
}: {
  text: string;
  progress: number;
  side: 'left' | 'right';
}) => {
  const radius = 14;
  const circ = 2 * Math.PI * radius;
  const offset = circ * (1 - progress);
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.82 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.82 }}
      transition={{ duration: 0.14 }}
      className="absolute pointer-events-none z-[60]"
      style={{
        top: '50%',
        transform: 'translateY(-50%)',
        ...(side === 'right' ? { left: 'calc(100% + 12px)' } : { right: 'calc(100% + 12px)' }),
      }}
    >
      <div className="bg-gray-950/95 text-white rounded-2xl px-3 py-2.5 shadow-2xl border border-white/10 backdrop-blur-xl flex flex-col items-center gap-1.5 min-w-[74px]">
        <div className="relative">
          <svg width="40" height="40" viewBox="0 0 40 40" style={{ transform: 'rotate(-90deg)' }}>
            <circle
              cx="20" cy="20" r={radius}
              fill="none"
              stroke="rgba(255,255,255,0.12)"
              strokeWidth="3"
            />
            <circle
              cx="20" cy="20" r={radius}
              fill="none"
              stroke="#a855f7"
              strokeWidth="3"
              strokeDasharray={circ}
              strokeDashoffset={offset}
              strokeLinecap="round"
              style={{ transition: 'stroke-dashoffset 55ms linear' }}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-[9px] font-bold text-purple-300 select-none">
              {Math.round(progress * 100)}
            </span>
          </div>
        </div>
        <p className="text-[10px] font-semibold opacity-80 text-center leading-tight whitespace-nowrap">{text}</p>
      </div>
    </motion.div>
  );
};

const Mainview = () => {
  useCalendarFilterBridge();

  const { selectedView } = useViewStore();
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem('sidebar-width');
    return saved ? parseInt(saved, 10) : 350;
  });
  const [sidebarLayoutMode, setSidebarLayoutMode] = useState<SidebarLayoutMode>(() => {
    return (localStorage.getItem('sidebar-layout-mode') as SidebarLayoutMode) ?? 'normal';
  });
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [maxWidth, setMaxWidth] = useState(() => window.innerWidth / 2);
  const isDragging = useRef(false);
  const isTouchDevice = useRef(false);
  const lastTickX = useRef(0);
  const rawDragXRef = useRef(0);
  const startDragXRef = useRef(0);
  const layoutModeRef = useRef<SidebarLayoutMode>(sidebarLayoutMode);
  const prevModeRef = useRef<SidebarLayoutMode>(sidebarLayoutMode);
  const [rawDragX, setRawDragX] = useState(0);
  const isMobile = useIsMobile();
  const [isCrossingBoundary, setIsCrossingBoundary] = useState(false);
  const crossingDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep layoutModeRef in sync (avoids stale closures in drag handlers)
  useEffect(() => { layoutModeRef.current = sidebarLayoutMode; }, [sidebarLayoutMode]);

  // Play a sound when layout mode commits
  useEffect(() => {
    if (prevModeRef.current !== sidebarLayoutMode) {
      sounds.play('dragStop');
      prevModeRef.current = sidebarLayoutMode;
    }
  }, [sidebarLayoutMode]);

  // ── Computed progress values ──────────────────────────────────────────────

  const enteringFullscreenProgress = isResizing && layoutModeRef.current === 'normal'
    ? Math.min(1, Math.max(0, (rawDragX - maxWidth) / TRIGGER_PX)) : 0;

  const enteringCalendarProgress = isResizing && layoutModeRef.current === 'normal'
    ? Math.min(1, Math.max(0, (MIN_WIDTH - rawDragX) / TRIGGER_PX)) : 0;

  const exitingFullscreenProgress = isResizing && layoutModeRef.current === 'fullscreen'
    ? Math.min(1, Math.max(0, (startDragXRef.current - rawDragX) / TRIGGER_PX)) : 0;

  const exitingHiddenProgress = isResizing && layoutModeRef.current === 'hidden'
    ? Math.min(1, Math.max(0, (rawDragX - startDragXRef.current) / TRIGGER_PX)) : 0;

  useEffect(() => {
    const updateMaxWidth = () => setMaxWidth(window.innerWidth / 2);
    updateMaxWidth();
    window.addEventListener('resize', updateMaxWidth);
    return () => window.removeEventListener('resize', updateMaxWidth);
  }, []);

  useEffect(() => {
    if (sidebarWidth < MIN_WIDTH) setSidebarWidth(MIN_WIDTH);
    if (sidebarWidth > maxWidth) setSidebarWidth(maxWidth);
  }, [maxWidth]);

  useEffect(() => {
    localStorage.setItem('sidebar-width', String(sidebarWidth));
  }, [sidebarWidth]);

  useEffect(() => {
    localStorage.setItem('sidebar-layout-mode', sidebarLayoutMode);
  }, [sidebarLayoutMode]);

  // Esc exits fullscreen sidebar mode
  useEffect(() => {
    if (sidebarLayoutMode !== 'fullscreen') return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSidebarLayoutMode('normal');
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [sidebarLayoutMode]);

  useEffect(() => {
    isTouchDevice.current = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    if (isTouchDevice.current) {
      const style = document.createElement('style');
      style.textContent = `
        .calendar-event {
          -webkit-touch-callout: none;
          -webkit-user-select: none;
          user-select: none;
          touch-action: none;
        }
      `;
      document.head.appendChild(style);
      return () => { document.head.removeChild(style); };
    }
  }, []);

  useEffect(() => {
    if (isMobile) setIsSidebarOpen(false);
  }, [isMobile]);

  const startDrag = (e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    setIsResizing(true);
    startDragXRef.current = e.clientX;
    rawDragXRef.current = e.clientX;
    lastTickX.current = e.clientX;
    setRawDragX(e.clientX);
    document.body.style.cursor = 'ew-resize';
    document.addEventListener("mousemove", handleDrag);
    document.addEventListener("mouseup", stopDrag);
  };

  const handleDrag = (e: MouseEvent) => {
    if (!isDragging.current) return;
    rawDragXRef.current = e.clientX;
    setRawDragX(e.clientX);

    // Tactile tick in ALL modes based on raw travel
    if (Math.abs(e.clientX - lastTickX.current) >= 20) {
      sounds.play("dragTick");
      lastTickX.current = e.clientX;
    }

    // Only update visual width in normal mode
    if (layoutModeRef.current === 'normal') {
      const newWidth = Math.max(MIN_WIDTH, Math.min(e.clientX, maxWidth));
      setSidebarWidth(newWidth);
    }
  };

  const stopDrag = () => {
    isDragging.current = false;
    setIsResizing(false);
    document.body.style.cursor = 'default';
    document.removeEventListener("mousemove", handleDrag);
    document.removeEventListener("mouseup", stopDrag);

    const currentMode = layoutModeRef.current;
    const startX = startDragXRef.current;
    const raw = rawDragXRef.current;

    if (currentMode === 'normal') {
      const mx = window.innerWidth / 2;
      const overflowProg = Math.min(1, Math.max(0, (raw - mx) / TRIGGER_PX));
      const underflowProg = Math.min(1, Math.max(0, (MIN_WIDTH - raw) / TRIGGER_PX));
      if (overflowProg >= 0.6) setSidebarLayoutMode('fullscreen');
      else if (underflowProg >= 0.6) setSidebarLayoutMode('hidden');
    } else if (currentMode === 'fullscreen') {
      const exitProg = Math.min(1, Math.max(0, (startX - raw) / TRIGGER_PX));
      if (exitProg >= 0.6) setSidebarLayoutMode('normal');
    } else if (currentMode === 'hidden') {
      const exitProg = Math.min(1, Math.max(0, (raw - startX) / TRIGGER_PX));
      if (exitProg >= 0.6) setSidebarLayoutMode('normal');
    }

    startDragXRef.current = 0;
    rawDragXRef.current = 0;
    setRawDragX(0);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    isDragging.current = true;
    setIsResizing(true);
    const initialX = e.touches[0].clientX;
    startDragXRef.current = initialX;
    rawDragXRef.current = initialX;
    lastTickX.current = initialX;
    setRawDragX(initialX);

    const handleTouchMove = (ev: TouchEvent) => {
      if (!isDragging.current) return;
      const touch = ev.touches[0];
      rawDragXRef.current = touch.clientX;
      setRawDragX(touch.clientX);
      if (Math.abs(touch.clientX - lastTickX.current) >= 20) {
        sounds.play("dragTick");
        lastTickX.current = touch.clientX;
      }
      if (layoutModeRef.current === 'normal') {
        const newWidth = Math.max(MIN_WIDTH, Math.min(touch.clientX, maxWidth));
        setSidebarWidth(newWidth);
      }
    };

    const handleTouchEnd = () => {
      isDragging.current = false;
      setIsResizing(false);

      const currentMode = layoutModeRef.current;
      const startX = startDragXRef.current;
      const raw = rawDragXRef.current;

      if (currentMode === 'normal') {
        const mx = window.innerWidth / 2;
        const overflowProg = Math.min(1, Math.max(0, (raw - mx) / TRIGGER_PX));
        const underflowProg = Math.min(1, Math.max(0, (MIN_WIDTH - raw) / TRIGGER_PX));
        if (overflowProg >= 0.6) setSidebarLayoutMode('fullscreen');
        else if (underflowProg >= 0.6) setSidebarLayoutMode('hidden');
      } else if (currentMode === 'fullscreen') {
        const exitProg = Math.min(1, Math.max(0, (startX - raw) / TRIGGER_PX));
        if (exitProg >= 0.6) setSidebarLayoutMode('normal');
      } else if (currentMode === 'hidden') {
        const exitProg = Math.min(1, Math.max(0, (raw - startX) / TRIGGER_PX));
        if (exitProg >= 0.6) setSidebarLayoutMode('normal');
      }

      startDragXRef.current = 0;
      rawDragXRef.current = 0;
      setRawDragX(0);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };

    document.addEventListener('touchmove', handleTouchMove);
    document.addEventListener('touchend', handleTouchEnd);
  };

  useEffect(() => {
    return () => {
      document.removeEventListener("mousemove", handleDrag);
      document.removeEventListener("mouseup", stopDrag);
      document.body.style.cursor = 'default';
    };
  }, []);

  const handleBorderDragEnter = (e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('application/json') || e.dataTransfer.types.includes('text/plain')) {
      if (crossingDebounce.current) clearTimeout(crossingDebounce.current);
      setIsCrossingBoundary(true);
      crossingDebounce.current = setTimeout(() => setIsCrossingBoundary(false), 100);
    }
  };

  // ── Resizer pill visual ───────────────────────────────────────────────────
  const resizerPill = (
    <div
      className={`w-2.5 rounded-full transition-[height,box-shadow,background] duration-300 ease-in-out ${
        isResizing ? "h-48" : "h-16 group-hover:h-24"
      }`}
      style={{
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        boxShadow: isResizing
          ? '0 0 16px rgba(139,92,246,0.6), inset 0 1px 1px rgba(255,255,255,0.3)'
          : '0 2px 8px rgba(139,92,246,0.2), inset 0 1px 1px rgba(255,255,255,0.25)',
        background: isResizing
          ? 'linear-gradient(180deg,rgba(168,85,247,0.6) 0%,rgba(139,92,246,0.5) 50%,rgba(168,85,247,0.4) 100%)'
          : 'linear-gradient(180deg,rgba(168,85,247,0.35) 0%,rgba(139,92,246,0.2) 100%)',
        border: '1px solid rgba(168,85,247,0.35)',
      }}
    />
  );

  // ── Resizer x position for smooth animated positioning ───────────────────
  // Fixed div has left:0; x-transform places its center at the right boundary.
  // The 24px div's left edge = x, center = x + 12.
  const resizerX =
    sidebarLayoutMode === 'fullscreen' ? window.innerWidth - 24   // right edge
    : sidebarLayoutMode === 'hidden' ? 0                          // left edge
    : sidebarWidth - 12;                                           // sidebar boundary

  return (
    <GridBackground>
      <TemplateToolbar />

      <div className="flex h-screen overflow-hidden">

        {/* ── Desktop Sidebar — always in DOM, animated width for smooth transitions ── */}
        {!isMobile && (
          <motion.div
            style={{ overflow: 'hidden', flexShrink: 0 }}
            animate={{
              width:
                sidebarLayoutMode === 'hidden' ? 0
                : sidebarLayoutMode === 'fullscreen' ? window.innerWidth
                : sidebarWidth,
            }}
            initial={false}
            transition={{ duration: isResizing ? 0 : 0.4, ease: [0.32, 0.72, 0, 1] }}
          >
            {/* Inner wrapper keeps its true width so content isn't compressed */}
            <div style={{
              width: sidebarLayoutMode === 'fullscreen' ? window.innerWidth : Math.max(sidebarWidth, MIN_WIDTH),
              height: '100vh',
            }}>
              <SideBar layoutMode={sidebarLayoutMode} onSetLayoutMode={setSidebarLayoutMode} />
            </div>
          </motion.div>
        )}

        {/* ── Animated Resizer — portaled to body so parent transforms/overflow don't clip it ── */}
        {!isMobile && createPortal(
          <motion.div
            className="fixed top-0 bottom-0 flex items-center justify-center w-6 cursor-ew-resize z-[60] group"
            style={{ left: 0 }}
            initial={false}
            animate={{ x: resizerX }}
            transition={{ duration: isResizing ? 0 : 0.4, ease: [0.32, 0.72, 0, 1] }}
            onMouseDown={startDrag}
            onTouchStart={handleTouchStart}
            onDragEnter={handleBorderDragEnter}
            onDragOver={(e) => e.preventDefault()}
            draggable={false}
            onDragStart={(e) => e.preventDefault()}
          >
            {resizerPill}

            <AnimatePresence>
              {isResizing && sidebarLayoutMode === 'normal' && enteringFullscreenProgress > 0 && (
                <RoundIndicator key="efs" text="Sidebar Full →" progress={enteringFullscreenProgress} side="right" />
              )}
              {isResizing && sidebarLayoutMode === 'normal' && enteringCalendarProgress > 0 && (
                <RoundIndicator key="ecal" text="← Full Calendar" progress={enteringCalendarProgress} side="left" />
              )}
              {isResizing && sidebarLayoutMode === 'fullscreen' && exitingFullscreenProgress > 0 && (
                <RoundIndicator key="xfs" text="← Normal" progress={exitingFullscreenProgress} side="left" />
              )}
              {isResizing && sidebarLayoutMode === 'hidden' && exitingHiddenProgress > 0 && (
                <RoundIndicator key="xhid" text="Normal →" progress={exitingHiddenProgress} side="right" />
              )}
            </AnimatePresence>

            <RippleBorder trigger={isCrossingBoundary} />
          </motion.div>,
          document.body
        )}

        {/* ── Main Content (calendar) — hidden when sidebar fullscreen ── */}
        {(isMobile || sidebarLayoutMode !== 'fullscreen') && (
          <div className="flex flex-col flex-1 h-screen w-full md:w-auto overflow-hidden">
            <Header onMenuClick={() => setIsSidebarOpen(!isSidebarOpen)} />

            {isMobile ? (
              <div className="relative flex-1 min-h-0 overflow-hidden">
                <div className="h-full overflow-y-auto touch-pan-y">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={selectedView}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      className="h-full"
                    >
                      {selectedView === "Month" && <MonthView />}
                      {selectedView === "Day" && <DayView />}
                      {selectedView === "Week" && <WeekView />}
                    </motion.div>
                  </AnimatePresence>
                </div>
                <MobileModuleSheet />
              </div>
            ) : (
              <>
                <div className="overflow-y-auto flex-1 touch-pan-y">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={selectedView}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      className="h-full"
                    >
                      {selectedView === "Month" && <MonthView />}
                      {selectedView === "Day" && <DayView />}
                      {selectedView === "Week" && <WeekView />}
                    </motion.div>
                  </AnimatePresence>
                </div>
                <ShortcutsTipStrip />
              </>
            )}
          </div>
        )}
      </div>
    </GridBackground>
  );
};

export default Mainview;
