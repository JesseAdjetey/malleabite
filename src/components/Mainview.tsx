
import React, { useState, useRef, useEffect } from "react";
import MonthView from "@/components/month-view";
import SideBar from "@/components/sidebar/sideBar";
import { useViewStore } from "@/lib/store";
import DayView from "@/components/day-view";
import WeekView from "@/components/week-view";
import Header from "@/components/header/Header";
import { GripVertical, Menu, X } from 'lucide-react';
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";

const Mainview = () => {
  const { selectedView } = useViewStore();
  const [sidebarWidth, setSidebarWidth] = useState(350);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const isTouchDevice = useRef(false);
  const isMobile = useIsMobile();

  // Set limits for sidebar width
  const MIN_WIDTH = 280;
  const MAX_WIDTH = 500;

  // Ensure initial width is within bounds
  useEffect(() => {
    if (sidebarWidth < MIN_WIDTH) setSidebarWidth(MIN_WIDTH);
    if (sidebarWidth > MAX_WIDTH) setSidebarWidth(MAX_WIDTH);
  }, []);

  // Detect touch device on mount
  useEffect(() => {
    isTouchDevice.current = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

    // Add touch-specific styles
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

  // Close sidebar when switching to mobile
  useEffect(() => {
    if (isMobile) {
      setIsSidebarOpen(false);
    }
  }, [isMobile]);

  const startDrag = (e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    document.body.style.cursor = 'ew-resize';

    // Attach mousemove and mouseup listeners to the document
    document.addEventListener("mousemove", handleDrag);
    document.addEventListener("mouseup", stopDrag);
  };

  const handleDrag = (e: MouseEvent) => {
    if (!isDragging.current) return;
    let newWidth = e.clientX;

    // Constrain sidebar width between min and max
    newWidth = Math.max(MIN_WIDTH, Math.min(newWidth, MAX_WIDTH));

    setSidebarWidth(newWidth);
  };

  const stopDrag = () => {
    isDragging.current = false;
    document.body.style.cursor = 'default';
    document.removeEventListener("mousemove", handleDrag);
    document.removeEventListener("mouseup", stopDrag);
  };

  // Touch handling for the resizer
  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    isDragging.current = true;

    const handleTouchMove = (e: TouchEvent) => {
      if (!isDragging.current) return;

      const touch = e.touches[0];
      let newWidth = touch.clientX;

      // Constrain sidebar width
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
      // Cleanup event listeners when component unmounts
      document.removeEventListener("mousemove", handleDrag);
      document.removeEventListener("mouseup", stopDrag);
      document.body.style.cursor = 'default';
    };
  }, []);

  return (
    <div className="flex h-screen">
      {/* Mobile Menu Button */}
      {isMobile && (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="fixed top-4 left-4 z-50 md:hidden bg-background/80 backdrop-blur-sm border border-border"
        >
          {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
        </Button>
      )}

      {/* Overlay for mobile sidebar */}
      {isMobile && isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar - Mobile: Slide-in overlay, Desktop: Fixed side panel */}
      <div
        ref={sidebarRef}
        style={!isMobile ? { width: `${sidebarWidth}px`, minWidth: `${MIN_WIDTH}px`, maxWidth: `${MAX_WIDTH}px` } : {}}
        className={`
          transition-all duration-300 z-50
          ${isMobile 
            ? `fixed top-0 left-0 h-full w-[85vw] max-w-sm transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}` 
            : 'relative'
          }
        `}
      >
        <SideBar />
      </div>

      {/* Resizer - Only show on desktop */}
      {!isMobile && (
        <div
          className="hidden md:flex items-center justify-center w-6 cursor-ew-resize z-10 hover:bg-purple-400/30 transition-colors"
          onMouseDown={startDrag}
          onTouchStart={handleTouchStart}
          draggable={false}
          onDragStart={(e) => e.preventDefault()}
        >
          <div 
            className="h-16 w-4 rounded-md flex items-center justify-center light-mode:bg-purple-200 light-mode:hover:bg-purple-300 dark-mode:bg-purple-600/30 dark-mode:hover:bg-purple-500/60"
            draggable={false}
          >
            <GripVertical className="text-purple-500 h-10" />
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex flex-col flex-1 h-screen w-full md:w-auto overflow-hidden">
        <Header onMenuClick={() => setIsSidebarOpen(!isSidebarOpen)} />
        <div className="overflow-y-auto flex-1 touch-pan-y">
          {selectedView === "Month" && <MonthView />}
          {selectedView === "Day" && <DayView />}
          {selectedView === "Week" && <WeekView />}
        </div>
      </div>
    </div>
  );
};

export default Mainview;
