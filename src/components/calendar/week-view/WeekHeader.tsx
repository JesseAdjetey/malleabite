
import React, { useRef, useCallback, useState } from "react";
import { getWeekDays } from "@/lib/getTime";
import { cn } from "@/lib/utils";
import dayjs from "dayjs";
import { useViewStore, useDateStore } from "@/lib/store";
import { useWeekRangeStore } from "@/lib/stores/week-range-store";
import { useIsMobile } from "@/hooks/use-mobile";
import { haptics } from "@/lib/haptics";
import { sounds } from "@/lib/sounds";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigationDirection } from "@/hooks/use-navigation-direction";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";

/* ─── Grip-dot handle sub-component ──────────────────────────────── */
const DragHandle: React.FC<{
  side: "left" | "right";
  active: boolean;
  onPointerDown: (e: React.PointerEvent) => void;
  onDoubleClick: () => void;
}> = ({ side, active, onPointerDown, onDoubleClick }) => (
  <div
    className={cn(
      "absolute top-1/2 -translate-y-1/2 z-20 flex flex-col items-center justify-center",
      "w-[14px] h-9 rounded-full cursor-col-resize",
      "bg-purple-400/90 dark:bg-purple-400/70",
      "hover:bg-purple-500 dark:hover:bg-purple-300/90 hover:scale-[1.15]",
      "shadow-md hover:shadow-lg transition-all duration-150",
      active && "bg-purple-600 dark:bg-purple-300 scale-[1.15] shadow-lg",
      side === "left" ? "-left-[14px]" : "-right-[14px]"
    )}
    onPointerDown={onPointerDown}
    onDoubleClick={onDoubleClick}
    title={`Drag to adjust ${side === "left" ? "start" : "end"} · Double-click to reset`}
  >
    {/* Three grip dots */}
    <div className="w-[3px] h-[3px] rounded-full bg-white/90 mb-[2px]" />
    <div className="w-[3px] h-[3px] rounded-full bg-white/90 mb-[2px]" />
    <div className="w-[3px] h-[3px] rounded-full bg-white/90" />
  </div>
);

interface WeekHeaderProps {
  userSelectedDate: dayjs.Dayjs;
}

const WeekHeader: React.FC<WeekHeaderProps> = ({ userSelectedDate }) => {
  const { selectedView, setView } = useViewStore();
  const { rangeStart, rangeEnd, setRangeStart, setRangeEnd, setRange, resetRange } =
    useWeekRangeStore();
  const isMobile = useIsMobile();

  const allWeekDays = getWeekDays(userSelectedDate);
  const dayCount = rangeEnd - rangeStart + 1;
  const weekKey = userSelectedDate.startOf('week').format('YYYY-MM-DD');
  const directionRef = useNavigationDirection(weekKey);

  // Refs for measuring day cell positions
  const dayCellRefs = useRef<(HTMLDivElement | null)[]>([]);
  const headerRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<"left" | "right" | null>(null);
  const lastRibbonTickIdx = useRef<number>(-1);

  // Label for the dropdown badge
  const rangeLabel =
    dayCount === 7
      ? "Week"
      : dayCount === 1
        ? "1 Day"
        : `${dayCount} Days`;

  const handleViewChange = (view: string) => {
    sounds.play("viewSwipe");
    setView(view);
  };

  // ── Desktop drag logic ──────────────────────────────────────────
  const getDayIndexFromPointer = useCallback(
    (clientX: number): number => {
      let closestIdx = 0;
      let closestDist = Infinity;
      dayCellRefs.current.forEach((el, i) => {
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const center = rect.left + rect.width / 2;
        const dist = Math.abs(clientX - center);
        if (dist < closestDist) {
          closestDist = dist;
          closestIdx = i;
        }
      });
      return closestIdx;
    },
    []
  );

  const handlePointerDown = useCallback(
    (side: "left" | "right") => (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      lastRibbonTickIdx.current = -1;
      setDragging(side);
    },
    []
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging) return;
      const idx = getDayIndexFromPointer(e.clientX);
      if (idx !== lastRibbonTickIdx.current) {
        sounds.play("dragTick");
        lastRibbonTickIdx.current = idx;
      }
      if (dragging === "left") {
        setRangeStart(Math.min(idx, rangeEnd));
      } else {
        setRangeEnd(Math.max(idx, rangeStart));
      }
    },
    [dragging, rangeStart, rangeEnd, getDayIndexFromPointer, setRangeStart, setRangeEnd]
  );

  const handlePointerUp = useCallback(() => {
    setDragging(null);
  }, []);

  // ── Mobile: rolling 3-day view that crosses week boundaries ────
  const { setDate } = useDateStore();

  const shiftMobile = (direction: 'left' | 'right') => {
    haptics.selection();
    const days = direction === 'right' ? 3 : -3;
    const newDate = userSelectedDate.add(days, 'day');
    setDate(newDate);
    // Recompute range for the new week
    const newDayIdx = newDate.day(); // 0=Sun … 6=Sat
    const start = Math.max(0, Math.min(newDayIdx - 1, 4));
    setRange(start, start + 2);
  };

  // ── Mobile 3-day view ──────────────────────────────────────────
  if (isMobile) {
    const mobileDays = allWeekDays.slice(rangeStart, rangeEnd + 1);
    return (
      <div className="flex items-center px-2 py-1.5 border-b border-purple-200 dark:border-white/10 bg-transparent">
        {/* View selector */}
        <div className="flex-shrink-0 mr-1">
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/40 dark:bg-white/10 hover:bg-white/60 dark:hover:bg-white/20 transition-colors text-xs font-medium text-purple-900 dark:text-foreground outline-none border border-purple-200 dark:border-white/10 backdrop-blur-md">
              {rangeLabel}
              <ChevronDown size={12} className="text-purple-700 dark:text-muted-foreground" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-[120px] rounded-xl">
              {["Day", "Week", "Month"].map((viewStr) => (
                <DropdownMenuItem
                  key={viewStr}
                  onClick={() => {
                    if (viewStr === "Week") resetRange();
                    handleViewChange(viewStr);
                  }}
                  className={`rounded-lg cursor-pointer ${selectedView === viewStr ? "bg-accent text-accent-foreground" : ""
                    }`}
                >
                  {viewStr}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Left arrow — rolls across weeks */}
        <button
          onClick={() => shiftMobile('left')}
          className="p-1 rounded-full hover:bg-purple-100 dark:hover:bg-white/10 transition-colors"
        >
          <ChevronLeft size={16} className="text-purple-600 dark:text-purple-300" />
        </button>

        {/* Visible 3 day cells */}
        <div className="flex-1 flex justify-around overflow-hidden">
          <AnimatePresence mode="popLayout" initial={false}>
            {mobileDays.map(({ currentDate, today }, i) => (
              <motion.div
                key={`${weekKey}-${i}`}
                initial={{ opacity: 0, x: directionRef.current * 32 }}
                animate={{ opacity: 1, x: 0, transition: { type: "spring", damping: 28, stiffness: 320, delay: i * 0.025 } }}
                exit={{ opacity: 0, x: directionRef.current * -32, transition: { duration: 0.12 } }}
                className="flex flex-col items-center"
              >
                <div
                  className={cn(
                    "h-7 w-7 rounded-full flex items-center justify-center font-semibold text-base",
                    today ? "bg-primary text-white" : "text-purple-900/80 dark:text-muted-foreground"
                  )}
                >
                  {currentDate.format("DD")}
                </div>
                <div
                  className={cn(
                    "text-[9px]",
                    today ? "text-primary font-medium" : "text-purple-900/60 dark:text-muted-foreground"
                  )}
                >
                  {currentDate.format("ddd")}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Right arrow — rolls across weeks */}
        <button
          onClick={() => shiftMobile('right')}
          className="p-1 rounded-full hover:bg-purple-100 dark:hover:bg-white/10 transition-colors"
        >
          <ChevronRight size={16} className="text-purple-600 dark:text-purple-300" />
        </button>
      </div>
    );
  }

  // ── Desktop: full 7-day header with ribbon ──────────────────────

  return (
    <div
      ref={headerRef}
      className="relative px-4 py-1.5 border-b border-purple-200 dark:border-white/10 bg-transparent select-none"
      style={{
        display: "grid",
        gridTemplateColumns: "auto repeat(7, 1fr)",
        gridTemplateRows: "1fr",
        placeItems: "center",
      }}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      {/* ── Smooth ribbon overlay ─────────────────────────────────
           A single continuous band behind the in-range day cells.
           Uses CSS Grid column placement so it stretches seamlessly. */}
      <div
        className="rounded-xl bg-purple-100/50 dark:bg-white/[0.07] transition-all duration-200 pointer-events-none"
        style={{
          gridColumn: `${rangeStart + 2} / ${rangeEnd + 3}`,
          gridRow: 1,
          alignSelf: "stretch",
          justifySelf: "stretch",
          marginLeft: 26,
          marginRight: 26,
          zIndex: 0,
        }}
      />

      {/* View selector cell — col 1 */}
      <div
        className="w-16 flex justify-center"
        style={{ gridColumn: 1, gridRow: 1, zIndex: 2 }}
      >
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/40 dark:bg-white/10 hover:bg-white/60 dark:hover:bg-white/20 transition-colors text-xs font-medium text-purple-900 dark:text-foreground outline-none border border-purple-200 dark:border-white/10 backdrop-blur-md">
            {rangeLabel}
            <ChevronDown size={14} className="text-purple-700 dark:text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-[120px] rounded-xl">
            {["Day", "Week", "Month"].map((viewStr) => (
              <DropdownMenuItem
                key={viewStr}
                onClick={() => {
                  if (viewStr === "Week") resetRange();
                  handleViewChange(viewStr);
                }}
                className={`rounded-lg cursor-pointer ${selectedView === viewStr ? "bg-accent text-accent-foreground" : ""
                  }`}
              >
                {viewStr}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* All 7 day cells — always rendered, explicitly placed */}
      {allWeekDays.map(({ currentDate, today }, index) => {
        const inRange = index >= rangeStart && index <= rangeEnd;
        const isRangeStart = index === rangeStart;
        const isRangeEnd = index === rangeEnd;

        return (
          <motion.div
            key={`${weekKey}-${index}`}
            ref={(el) => { dayCellRefs.current[index] = el; }}
            initial={{ opacity: 0, x: directionRef.current * 28 }}
            animate={{ opacity: inRange ? 1 : 0.35, x: 0, transition: { type: "spring", damping: 28, stiffness: 320, delay: index * 0.022 } }}
            className="relative flex flex-col items-center py-1 px-2"
            style={{ gridColumn: index + 2, gridRow: 1, zIndex: 1 }}
          >
            {/* Left drag handle */}
            {isRangeStart && (
              <DragHandle
                side="left"
                active={dragging === "left"}
                onPointerDown={handlePointerDown("left")}
                onDoubleClick={resetRange}
              />
            )}

            <div
              className={cn(
                "h-8 w-8 rounded-full flex items-center justify-center font-semibold text-lg md:text-xl transition-all",
                today
                  ? "bg-primary text-white"
                  : inRange
                    ? "text-purple-900/80 dark:text-muted-foreground"
                    : "text-purple-900/40 dark:text-muted-foreground/40"
              )}
            >
              {currentDate.format("DD")}
            </div>
            <div
              className={cn(
                "text-[10px] md:text-xs transition-all",
                today
                  ? "text-primary font-medium"
                  : inRange
                    ? "text-purple-900/60 dark:text-muted-foreground"
                    : "text-purple-900/30 dark:text-muted-foreground/30"
              )}
            >
              {currentDate.format("ddd")}
            </div>

            {/* Right drag handle */}
            {isRangeEnd && (
              <DragHandle
                side="right"
                active={dragging === "right"}
                onPointerDown={handlePointerDown("right")}
                onDoubleClick={resetRange}
              />
            )}
          </motion.div>
        );
      })}
    </div>
  );
};

export default WeekHeader;
