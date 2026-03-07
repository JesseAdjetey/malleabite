
import React, { useRef, useCallback, useState, useEffect } from "react";
import { getWeekDays, isCurrentDay } from "@/lib/getTime";
import { cn } from "@/lib/utils";
import dayjs from "dayjs";
import { useViewStore } from "@/lib/store";
import { useWeekRangeStore } from "@/lib/stores/week-range-store";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, GripVertical } from "lucide-react";

interface WeekHeaderProps {
  userSelectedDate: dayjs.Dayjs;
}

const WeekHeader: React.FC<WeekHeaderProps> = ({ userSelectedDate }) => {
  const { selectedView, setView } = useViewStore();
  const { rangeStart, rangeEnd, setRangeStart, setRangeEnd, resetRange } =
    useWeekRangeStore();

  const allWeekDays = getWeekDays(userSelectedDate);
  const visibleDays = allWeekDays.slice(rangeStart, rangeEnd + 1);
  const dayCount = rangeEnd - rangeStart + 1;

  // Refs for drag hit-testing
  const headerRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<"left" | "right" | null>(null);

  // Label for the dropdown badge
  const rangeLabel =
    dayCount === 7
      ? "Week"
      : dayCount === 1
        ? "1 Day"
        : `${dayCount} Days`;

  const handleViewChange = (view: string) => {
    setView(view);
  };

  // ── Drag logic ─────────────────────────────────────────────────
  // During drag we calculate which day index (0–6) the pointer is over
  // by dividing the header into 7 equal zones (even hidden days).

  const getDayIndexFromPointer = useCallback(
    (clientX: number): number => {
      const header = headerRef.current;
      if (!header) return 0;
      const rect = header.getBoundingClientRect();
      // 64px (w-16) is the left label cell
      const gridLeft = rect.left + 64;
      const gridWidth = rect.width - 64;
      const relX = clientX - gridLeft;
      const frac = relX / gridWidth;
      // Map to 0–6 across the full 7-day space
      const idx = Math.round(frac * 6);
      return Math.max(0, Math.min(6, idx));
    },
    []
  );

  const handlePointerDown = useCallback(
    (side: "left" | "right") => (e: React.PointerEvent) => {
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      setDragging(side);
    },
    []
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging) return;
      const idx = getDayIndexFromPointer(e.clientX);
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

  // Dynamic grid columns: auto (label) + N × 1fr
  const gridCols = `auto repeat(${dayCount}, 1fr)`;

  return (
    <div
      ref={headerRef}
      className="relative place-items-center px-4 py-1.5 border-b border-purple-200 dark:border-white/10 bg-transparent select-none"
      style={{ display: "grid", gridTemplateColumns: gridCols }}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      {/* View selector cell */}
      <div className="w-16 flex justify-center">
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
                  if (viewStr === "Week") {
                    resetRange();
                  }
                  handleViewChange(viewStr);
                }}
                className={`rounded-lg cursor-pointer ${
                  selectedView === viewStr
                    ? "bg-accent text-accent-foreground"
                    : ""
                }`}
              >
                {viewStr}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Left drag handle */}
      <div
        className={cn(
          "absolute top-0 bottom-0 z-20 flex items-center cursor-col-resize",
          "hover:bg-purple-200/30 dark:hover:bg-white/10 transition-colors rounded-l-md",
          dragging === "left" && "bg-purple-300/40 dark:bg-white/20"
        )}
        style={{ left: "64px", width: "14px" }}
        onPointerDown={handlePointerDown("left")}
        onDoubleClick={resetRange}
        title="Drag to adjust start day • Double-click to reset"
      >
        <GripVertical size={12} className="text-purple-400 dark:text-purple-300 mx-auto" />
      </div>

      {/* Day cells — only the visible range */}
      {visibleDays.map(({ currentDate, today }, index) => (
        <div key={index} className="flex flex-col items-center transition-all duration-200">
          <div
            className={cn(
              "h-8 w-8 rounded-full flex items-center justify-center font-semibold text-lg md:text-xl",
              today
                ? "bg-primary text-white"
                : "text-purple-900/80 dark:text-muted-foreground"
            )}
          >
            {currentDate.format("DD")}
          </div>
          <div
            className={cn(
              "text-[10px] md:text-xs",
              today
                ? "text-primary font-medium"
                : "text-purple-900/60 dark:text-muted-foreground"
            )}
          >
            {currentDate.format("ddd")}
          </div>
        </div>
      ))}

      {/* Right drag handle */}
      <div
        className={cn(
          "absolute top-0 bottom-0 right-0 z-20 flex items-center cursor-col-resize",
          "hover:bg-purple-200/30 dark:hover:bg-white/10 transition-colors rounded-r-md",
          dragging === "right" && "bg-purple-300/40 dark:bg-white/20"
        )}
        style={{ width: "14px" }}
        onPointerDown={handlePointerDown("right")}
        onDoubleClick={resetRange}
        title="Drag to adjust end day • Double-click to reset"
      >
        <GripVertical size={12} className="text-purple-400 dark:text-purple-300 mx-auto" />
      </div>
    </div>
  );
};

export default WeekHeader;
