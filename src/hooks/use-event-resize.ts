// Drag to Resize Hook - Allow resizing events by dragging edges
import { useState, useCallback, useRef, useEffect } from 'react';
import dayjs from 'dayjs';

export type ResizeDirection = 'top' | 'bottom' | 'left' | 'right';

interface ResizeState {
  isResizing: boolean;
  direction: ResizeDirection | null;
  eventId: string | null;
  originalStartY: number;
  originalEndY: number;
  startY: number;
  currentY: number;
  startTime: Date | null;
  endTime: Date | null;
}

interface UseEventResizeOptions {
  // How many minutes one pixel represents
  minutesPerPixel?: number;
  // Minimum event duration in minutes
  minDuration?: number;
  // Maximum event duration in minutes
  maxDuration?: number;
  // Snap to grid interval (in minutes)
  snapInterval?: number;
  // Callback when resize starts
  onResizeStart?: (eventId: string, direction: ResizeDirection) => void;
  // Callback during resize
  onResize?: (eventId: string, newStart: Date, newEnd: Date) => void;
  // Callback when resize ends
  onResizeEnd?: (eventId: string, newStart: Date, newEnd: Date) => boolean | Promise<boolean>;
  // Callback on resize cancel
  onResizeCancel?: (eventId: string) => void;
}

interface ResizeHandlers {
  handleResizeStart: (
    e: React.MouseEvent | React.TouchEvent,
    eventId: string,
    direction: ResizeDirection,
    currentStart: Date,
    currentEnd: Date
  ) => void;
  getResizeHandleProps: (eventId: string, direction: ResizeDirection) => {
    onMouseDown: (e: React.MouseEvent) => void;
    onTouchStart: (e: React.TouchEvent) => void;
    style: React.CSSProperties;
    className: string;
  };
}

export function useEventResize(options: UseEventResizeOptions = {}): [ResizeState, ResizeHandlers] {
  const {
    minutesPerPixel = 0.5,
    minDuration = 15,
    maxDuration = 24 * 60,
    snapInterval = 15,
    onResizeStart,
    onResize,
    onResizeEnd,
    onResizeCancel,
  } = options;

  const [state, setState] = useState<ResizeState>({
    isResizing: false,
    direction: null,
    eventId: null,
    originalStartY: 0,
    originalEndY: 0,
    startY: 0,
    currentY: 0,
    startTime: null,
    endTime: null,
  });

  const stateRef = useRef(state);
  stateRef.current = state;

  // Helper to snap time to interval
  const snapToGrid = useCallback((date: Date): Date => {
    const minutes = date.getMinutes();
    const snappedMinutes = Math.round(minutes / snapInterval) * snapInterval;
    return dayjs(date).minute(snappedMinutes).second(0).toDate();
  }, [snapInterval]);

  // Calculate new times based on mouse position
  const calculateNewTimes = useCallback((
    deltaY: number,
    direction: ResizeDirection,
    originalStart: Date,
    originalEnd: Date
  ): { newStart: Date; newEnd: Date } => {
    const deltaMinutes = deltaY * minutesPerPixel;
    let newStart = originalStart;
    let newEnd = originalEnd;

    if (direction === 'top') {
      // Resizing from top changes start time
      newStart = dayjs(originalStart).add(deltaMinutes, 'minute').toDate();
      newStart = snapToGrid(newStart);
      
      // Ensure minimum duration
      const duration = dayjs(newEnd).diff(dayjs(newStart), 'minute');
      if (duration < minDuration) {
        newStart = dayjs(newEnd).subtract(minDuration, 'minute').toDate();
      }
    } else if (direction === 'bottom') {
      // Resizing from bottom changes end time
      newEnd = dayjs(originalEnd).add(deltaMinutes, 'minute').toDate();
      newEnd = snapToGrid(newEnd);
      
      // Ensure minimum duration
      const duration = dayjs(newEnd).diff(dayjs(newStart), 'minute');
      if (duration < minDuration) {
        newEnd = dayjs(newStart).add(minDuration, 'minute').toDate();
      }
      
      // Ensure maximum duration
      if (duration > maxDuration) {
        newEnd = dayjs(newStart).add(maxDuration, 'minute').toDate();
      }
    }

    return { newStart, newEnd };
  }, [minutesPerPixel, snapToGrid, minDuration, maxDuration]);

  // Start resize operation
  const handleResizeStart = useCallback((
    e: React.MouseEvent | React.TouchEvent,
    eventId: string,
    direction: ResizeDirection,
    currentStart: Date,
    currentEnd: Date
  ) => {
    e.preventDefault();
    e.stopPropagation();

    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    setState({
      isResizing: true,
      direction,
      eventId,
      originalStartY: clientY,
      originalEndY: clientY,
      startY: clientY,
      currentY: clientY,
      startTime: currentStart,
      endTime: currentEnd,
    });

    onResizeStart?.(eventId, direction);
  }, [onResizeStart]);

  // Handle mouse/touch move
  const handleMove = useCallback((e: MouseEvent | TouchEvent) => {
    if (!stateRef.current.isResizing) return;

    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const deltaY = clientY - stateRef.current.startY;

    const { newStart, newEnd } = calculateNewTimes(
      deltaY,
      stateRef.current.direction!,
      stateRef.current.startTime!,
      stateRef.current.endTime!
    );

    setState(prev => ({
      ...prev,
      currentY: clientY,
    }));

    onResize?.(stateRef.current.eventId!, newStart, newEnd);
  }, [calculateNewTimes, onResize]);

  // Handle mouse/touch end
  const handleEnd = useCallback(async () => {
    if (!stateRef.current.isResizing) return;

    const deltaY = stateRef.current.currentY - stateRef.current.startY;
    const { newStart, newEnd } = calculateNewTimes(
      deltaY,
      stateRef.current.direction!,
      stateRef.current.startTime!,
      stateRef.current.endTime!
    );

    const success = await onResizeEnd?.(stateRef.current.eventId!, newStart, newEnd);

    if (success === false) {
      onResizeCancel?.(stateRef.current.eventId!);
    }

    setState({
      isResizing: false,
      direction: null,
      eventId: null,
      originalStartY: 0,
      originalEndY: 0,
      startY: 0,
      currentY: 0,
      startTime: null,
      endTime: null,
    });
  }, [calculateNewTimes, onResizeEnd, onResizeCancel]);

  // Handle escape key to cancel
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape' && stateRef.current.isResizing) {
      onResizeCancel?.(stateRef.current.eventId!);
      setState({
        isResizing: false,
        direction: null,
        eventId: null,
        originalStartY: 0,
        originalEndY: 0,
        startY: 0,
        currentY: 0,
        startTime: null,
        endTime: null,
      });
    }
  }, [onResizeCancel]);

  // Set up global event listeners
  useEffect(() => {
    if (state.isResizing) {
      window.addEventListener('mousemove', handleMove);
      window.addEventListener('mouseup', handleEnd);
      window.addEventListener('touchmove', handleMove);
      window.addEventListener('touchend', handleEnd);
      window.addEventListener('keydown', handleKeyDown);
      document.body.style.cursor = state.direction === 'top' || state.direction === 'bottom' 
        ? 'ns-resize' 
        : 'ew-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleEnd);
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [state.isResizing, state.direction, handleMove, handleEnd, handleKeyDown]);

  // Generate props for resize handles
  const getResizeHandleProps = useCallback((
    eventId: string,
    direction: ResizeDirection
  ) => {
    const isVertical = direction === 'top' || direction === 'bottom';
    const cursor = isVertical ? 'ns-resize' : 'ew-resize';

    return {
      onMouseDown: (e: React.MouseEvent) => {
        // Will be called with start/end times from the parent component
      },
      onTouchStart: (e: React.TouchEvent) => {
        // Will be called with start/end times from the parent component
      },
      style: {
        cursor,
      } as React.CSSProperties,
      className: `resize-handle resize-handle-${direction}`,
    };
  }, []);

  return [state, { handleResizeStart, getResizeHandleProps }];
}

// Helper component styles for resize handles
export const resizeHandleStyles = `
.resize-handle {
  position: absolute;
  z-index: 10;
  opacity: 0;
  transition: opacity 0.2s;
}

.resize-handle:hover,
.event-card:hover .resize-handle {
  opacity: 1;
}

.resize-handle-top {
  top: 0;
  left: 0;
  right: 0;
  height: 6px;
  cursor: ns-resize;
}

.resize-handle-bottom {
  bottom: 0;
  left: 0;
  right: 0;
  height: 6px;
  cursor: ns-resize;
}

.resize-handle-left {
  left: 0;
  top: 0;
  bottom: 0;
  width: 6px;
  cursor: ew-resize;
}

.resize-handle-right {
  right: 0;
  top: 0;
  bottom: 0;
  width: 6px;
  cursor: ew-resize;
}

.resize-handle::before {
  content: '';
  position: absolute;
  background: currentColor;
  border-radius: 2px;
  opacity: 0.6;
}

.resize-handle-top::before,
.resize-handle-bottom::before {
  left: 50%;
  transform: translateX(-50%);
  width: 32px;
  height: 4px;
  top: 50%;
  margin-top: -2px;
}

.resize-handle-left::before,
.resize-handle-right::before {
  top: 50%;
  transform: translateY(-50%);
  height: 32px;
  width: 4px;
  left: 50%;
  margin-left: -2px;
}
`;

export default useEventResize;
