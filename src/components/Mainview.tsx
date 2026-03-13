
import React, { useState, useRef, useEffect } from "react";
import MonthView from "@/components/month-view";
import SideBar from "@/components/sidebar/sideBar";
import { useViewStore } from "@/lib/store";
import DayView from "@/components/day-view";
import WeekView from "@/components/week-view";
import Header from "@/components/header/Header";
import { GripVertical, Menu, X } from 'lucide-react';
import { useIsMobile } from "@/hooks/use-mobile";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { AnimatePresence, motion } from "framer-motion";
import { springs } from "@/lib/animations";
import { cn } from "@/lib/utils";
import { GridBackground } from "@/components/ui/grid-background";
import RippleBorder from "@/components/ui/RippleBorder";
import { useCalendarFilterBridge } from "@/hooks/use-calendar-filter-bridge";
import TemplateToolbar from "@/components/calendar/TemplateToolbar";
import MobileModuleSheet from "@/components/mobile/MobileModuleSheet";

const Mainview = () => {
  // Bridge calendar groups → legacy filter store so views auto-filter
  useCalendarFilterBridge();

  const { selectedView } = useViewStore();
  const [sidebarWidth, setSidebarWidth] = useState(350);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [maxWidth, setMaxWidth] = useState(500);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const isTouchDevice = useRef(false);
  const isMobile = useIsMobile();
  const [isCrossingBoundary, setIsCrossingBoundary] = useState(false);
  const crossingDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [calendarFraction, setCalendarFraction] = useState(0.965);

  const MIN_WIDTH = 280;

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
      return () => {
        document.head.removeChild(style);
      };
    }
  }, []);

  useEffect(() => {
    if (isMobile) {
      setIsSidebarOpen(false);
    }
  }, [isMobile]);

  const startDrag = (e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    setIsResizing(true);
    document.body.style.cursor = 'ew-resize';
    document.addEventListener("mousemove", handleDrag);
    document.addEventListener("mouseup", stopDrag);
  };

  const handleDrag = (e: MouseEvent) => {
    if (!isDragging.current) return;
    let newWidth = e.clientX;
    newWidth = Math.max(MIN_WIDTH, Math.min(newWidth, maxWidth));
    setSidebarWidth(newWidth);
  };

  const stopDrag = () => {
    isDragging.current = false;
    setIsResizing(false);
    document.body.style.cursor = 'default';
    document.removeEventListener("mousemove", handleDrag);
    document.removeEventListener("mouseup", stopDrag);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    isDragging.current = true;
    setIsResizing(true);

    const handleTouchMove = (e: TouchEvent) => {
      if (!isDragging.current) return;
      const touch = e.touches[0];
      let newWidth = touch.clientX;
      newWidth = Math.max(MIN_WIDTH, Math.min(newWidth, maxWidth));
      setSidebarWidth(newWidth);
    };

    const handleTouchEnd = () => {
      isDragging.current = false;
      setIsResizing(false);
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

  // Detect when a dragged item crosses the resizer boundary
  const handleBorderDragEnter = (e: React.DragEvent) => {
    // Only trigger for actual data transfers (not resizer drags)
    if (e.dataTransfer.types.includes('application/json') || e.dataTransfer.types.includes('text/plain')) {
      if (crossingDebounce.current) clearTimeout(crossingDebounce.current);
      setIsCrossingBoundary(true);
      // Reset after a short delay so it can re-trigger on next crossing
      crossingDebounce.current = setTimeout(() => setIsCrossingBoundary(false), 100);
    }
  };

  return (
    <GridBackground>
      {/* Template editing toolbar (floats on top when in template mode) */}
      <TemplateToolbar />

      <div className="flex h-screen overflow-hidden">
        {/* Desktop Sidebar — hidden on mobile */}
        {!isMobile && (
          <>
            <div
              ref={sidebarRef}
              style={{ width: `${sidebarWidth}px`, minWidth: `${MIN_WIDTH}px`, maxWidth: `${maxWidth}px` }}
              className="relative"
            >
              <SideBar />
            </div>

            {/* Resizer */}
            <div
              className="hidden md:flex items-center justify-center w-6 cursor-ew-resize z-50 transition-all duration-300 group relative"
              onMouseDown={startDrag}
              onTouchStart={handleTouchStart}
              onDragEnter={handleBorderDragEnter}
              onDragOver={(e) => e.preventDefault()}
              draggable={false}
              onDragStart={(e) => e.preventDefault()}
            >
              <div
                className={`w-2.5 rounded-full transition-all duration-500 ease-in-out relative overflow-hidden ${isResizing
                  ? "h-48 bg-white/30 dark:bg-white/20"
                  : "h-16 bg-white/20 dark:bg-white/10 group-hover:bg-white/30 dark:group-hover:bg-white/20 group-hover:h-24"
                  }`}
                style={{
                  backdropFilter: 'blur(12px)',
                  WebkitBackdropFilter: 'blur(12px)',
                  boxShadow: isResizing
                    ? '0 0 12px rgba(139, 92, 246, 0.5), inset 0 1px 1px rgba(255,255,255,0.3), inset 0 -1px 1px rgba(0,0,0,0.1)'
                    : '0 2px 8px rgba(139, 92, 246, 0.2), inset 0 1px 1px rgba(255,255,255,0.25), inset 0 -1px 1px rgba(0,0,0,0.08)',
                  background: isResizing
                    ? 'linear-gradient(180deg, rgba(168,85,247,0.5) 0%, rgba(139,92,246,0.4) 50%, rgba(168,85,247,0.3) 100%)'
                    : 'linear-gradient(180deg, rgba(168,85,247,0.35) 0%, rgba(139,92,246,0.2) 100%)',
                  border: '1px solid rgba(168,85,247,0.3)',
                }}
              />
              {/* Ripple effect overlay for cross-boundary drags */}
              <RippleBorder trigger={isCrossingBoundary} />
            </div>
          </>
        )}

        {/* Main Content */}
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

              <MobileModuleSheet
                calendarFraction={calendarFraction}
                onCalendarFractionChange={setCalendarFraction}
              />
            </div>
          ) : (
            /* ── Desktop: calendar fills remaining space ── */
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
          )}
        </div>
      </div>
    </GridBackground>
  );
};

export default Mainview;
