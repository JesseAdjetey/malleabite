
import { useRef, useState } from "react";
import { getDragData } from "@/components/calendar/event-utils/touch-handlers";
import { sounds } from "@/lib/sounds";

export function useEventDrag(event: any, isLocked: boolean = false, color: string = '') {
  const [isDragging, setIsDragging] = useState(false);
  const touchTimeout = useRef<number | null>(null);
  const touchStartPos = useRef<{ x: number, y: number } | null>(null);

  const handleDragStart = (e: React.DragEvent) => {
    // Don't allow dragging if event is locked
    if (isLocked) {
      e.preventDefault();
      return;
    }
    
    setIsDragging(true);
    sounds.play("calendarLift");
    e.dataTransfer.setData('application/json', JSON.stringify(getDragData(event, isLocked, color)));
    e.dataTransfer.effectAllowed = 'copyMove';
  };

  const handleDragEnd = () => {
    setIsDragging(false);
  };

  // Touch event handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    if (isLocked) return;
    
    // Save the initial touch position
    const touch = e.touches[0];
    touchStartPos.current = { x: touch.clientX, y: touch.clientY };
    
    // Use a timeout to differentiate between tap and drag
    touchTimeout.current = window.setTimeout(() => {
      setIsDragging(true);
    }, 200);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (isLocked || !touchStartPos.current) return;
    
    // Clear the timeout to prevent it from triggering if we're dragging
    if (touchTimeout.current) {
      clearTimeout(touchTimeout.current);
      touchTimeout.current = null;
    }
    
    // If we're not in drag mode yet, check if we've moved enough to start dragging
    if (!isDragging) {
      const touch = e.touches[0];
      const dx = touch.clientX - touchStartPos.current.x;
      const dy = touch.clientY - touchStartPos.current.y;
      
      // If we've moved more than 10 pixels, start dragging
      if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
        setIsDragging(true);
        
        // Create a custom event to notify parent components
        const eventElement = e.currentTarget;
        const dragData = getDragData(event, isLocked, color);
        
        // Store the data in the element for later use
        (eventElement as any).dragData = dragData;
        
        // Dispatch a custom event to notify that touch dragging has started
        const customEvent = new CustomEvent('touchdragstart', {
          bubbles: true,
          detail: { dragData, element: eventElement, touch: e.touches[0] }
        });
        eventElement.dispatchEvent(customEvent);
      }
    }
    
    // If we're dragging, prevent the default behavior (scrolling)
    if (isDragging) {
      e.preventDefault();
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    // Clear any pending timeout
    if (touchTimeout.current) {
      clearTimeout(touchTimeout.current);
      touchTimeout.current = null;
    }
    
    if (isDragging) {
      const eventElement = e.currentTarget;
      const dragData = (eventElement as any).dragData;
      
      // Dispatch a custom event for touch drag end
      if (dragData) {
        const customEvent = new CustomEvent('touchdragend', {
          bubbles: true,
          detail: { dragData, clientX: e.changedTouches[0].clientX, clientY: e.changedTouches[0].clientY }
        });
        eventElement.dispatchEvent(customEvent);
      }
      
      setIsDragging(false);
    }
    
    touchStartPos.current = null;
  };

  // Prevent click when dragging
  const handleClick = (e: React.MouseEvent, onClick?: () => void) => {
    if (isDragging) {
      e.stopPropagation();
      return;
    }
    
    if (onClick) onClick();
  };

  return {
    isDragging,
    handleDragStart,
    handleDragEnd,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    handleClick
  };
}
