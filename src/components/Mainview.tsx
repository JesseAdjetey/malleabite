
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

const Mainview = () => {
  const { selectedView } = useViewStore();
  const [sidebarWidth, setSidebarWidth] = useState(350);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const isTouchDevice = useRef(false);
  const isMobile = useIsMobile();

  const MIN_WIDTH = 280;
  const MAX_WIDTH = 500;

  useEffect(() => {
    if (sidebarWidth < MIN_WIDTH) setSidebarWidth(MIN_WIDTH);
    if (sidebarWidth > MAX_WIDTH) setSidebarWidth(MAX_WIDTH);
  }, []);

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
    document.body.style.cursor = 'ew-resize';
    document.addEventListener("mousemove", handleDrag);
    document.addEventListener("mouseup", stopDrag);
  };

  const handleDrag = (e: MouseEvent) => {
    if (!isDragging.current) return;
    let newWidth = e.clientX;
    newWidth = Math.max(MIN_WIDTH, Math.min(newWidth, MAX_WIDTH));
    setSidebarWidth(newWidth);
  };

  const stopDrag = () => {
    isDragging.current = false;
    document.body.style.cursor = 'default';
    document.removeEventListener("mousemove", handleDrag);
    document.removeEventListener("mouseup", stopDrag);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    isDragging.current = true;

    const handleTouchMove = (e: TouchEvent) => {
      if (!isDragging.current) return;
      const touch = e.touches[0];
      let newWidth = touch.clientX;
      newWidth = Math.max(MIN_WIDTH, Math.min(newWidth, MAX_WIDTH));
      setSidebarWidth(newWidth);
    };

    const handleTouchEnd = () => {
      isDragging.current = false;
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

  return (
    <div className="flex h-screen">
      {/* Mobile Sidebar — iOS Sheet style */}
      {isMobile && (
        <Sheet open={isSidebarOpen} onOpenChange={setIsSidebarOpen}>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="fixed top-2 left-3 z-50 md:hidden h-9 w-9"
            >
              <Menu size={20} />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[85vw] max-w-sm p-0">
            <SideBar />
          </SheetContent>
        </Sheet>
      )}

      {/* Desktop Sidebar */}
      {!isMobile && (
        <>
          <div
            ref={sidebarRef}
            style={{ width: `${sidebarWidth}px`, minWidth: `${MIN_WIDTH}px`, maxWidth: `${MAX_WIDTH}px` }}
            className="relative"
          >
            <SideBar />
          </div>

          {/* Resizer */}
          <div
            className="hidden md:flex items-center justify-center w-6 cursor-ew-resize z-10 hover:bg-primary/10 transition-colors"
            onMouseDown={startDrag}
            onTouchStart={handleTouchStart}
            draggable={false}
            onDragStart={(e) => e.preventDefault()}
          >
            <div className="h-16 w-4 rounded-md flex items-center justify-center">
              <GripVertical className="text-muted-foreground h-10" />
            </div>
          </div>
        </>
      )}

      {/* Main Content */}
      <div className="flex flex-col flex-1 h-screen w-full md:w-auto overflow-hidden">
        <Header onMenuClick={() => setIsSidebarOpen(!isSidebarOpen)} />
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
      </div>
    </div>
  );
};

export default Mainview;
