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

const RESET_STATE: ResizeState = {
  isResizing: false,
  direction: null,
  eventId: null,
  originalStartY: 0,
  originalEndY: 0,
  startY: 0,
  currentY: 0,
  startTime: null,
  endTime: null,
};

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

  const [state, setState] = useState<ResizeState>(RESET_STATE);
  const stateRef = useRef(state);
  stateRef.current = state;

  // Keep latest callbacks in refs so event listeners never go stale.
  // This means the effect only needs to depend on `isResizing`, not the callbacks.
  const onResizeRef = useRef(onResize);
  const onResizeEndRef = useRef(onResizeEnd);
  const onResizeCancelRef = useRef(onResizeCancel);
  onResizeRef.current = onResize;
  onResizeEndRef.current = onResizeEnd;
  onResizeCancelRef.current = onResizeCancel;

  // Helper to snap time to interval
  const snapToGrid = useCallback((date: Date): Date => {
    const minutes = date.getMinutes();
    const snappedMinutes = Math.round(minutes / snapInterval) * snapInterval;
    return dayjs(date).minute(snappedMinutes).second(0).toDate();
  }, [snapInterval]);

  // Calculate new times based on pixel delta
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
      newStart = snapToGrid(dayjs(originalStart).add(deltaMinutes, 'minute').toDate());
      const duration = dayjs(newEnd).diff(dayjs(newStart), 'minute');
      if (duration < minDuration) {
        newStart = dayjs(newEnd).subtract(minDuration, 'minute').toDate();
      }
    } else if (direction === 'bottom') {
      newEnd = snapToGrid(dayjs(originalEnd).add(deltaMinutes, 'minute').toDate());
      const duration = dayjs(newEnd).diff(dayjs(newStart), 'minute');
      if (duration < minDuration) {
        newEnd = dayjs(newStart).add(minDuration, 'minute').toDate();
      }
      if (duration > maxDuration) {
        newEnd = dayjs(newStart).add(maxDuration, 'minute').toDate();
      }
    }

    return { newStart, newEnd };
  }, [minutesPerPixel, snapToGrid, minDuration, maxDuration]);

  // Keep calculateNewTimes in a ref so it can be called from stable handlers
  const calculateNewTimesRef = useRef(calculateNewTimes);
  calculateNewTimesRef.current = calculateNewTimes;

  // Stable handler refs — these never change identity, so the effect only needs
  // [state.isResizing] as a dependency. No risk of missing a mouseup.
  const stableMoveHandler = useRef((e: MouseEvent | TouchEvent) => {
    if (!stateRef.current.isResizing) return;

    const clientY = 'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY;
    const deltaY = clientY - stateRef.current.startY;

    const { newStart, newEnd } = calculateNewTimesRef.current(
      deltaY,
      stateRef.current.direction!,
      stateRef.current.startTime!,
      stateRef.current.endTime!
    );

    setState(prev => ({ ...prev, currentY: clientY }));
    onResizeRef.current?.(stateRef.current.eventId!, newStart, newEnd);
  });

  const stableEndHandler = useRef(async () => {
    if (!stateRef.current.isResizing) return;

    const { currentY, startY, direction, startTime, endTime, eventId } = stateRef.current;
    const deltaY = currentY - startY;
    const { newStart, newEnd } = calculateNewTimesRef.current(
      deltaY,
      direction!,
      startTime!,
      endTime!
    );

    // Reset state SYNCHRONOUSLY before the async callback so listeners are
    // removed immediately and can't fire again while awaiting.
    setState(RESET_STATE);

    const success = await onResizeEndRef.current?.(eventId!, newStart, newEnd);
    if (success === false) {
      onResizeCancelRef.current?.(eventId!);
    }
  });

  const stableKeyHandler = useRef((e: KeyboardEvent) => {
    if (e.key === 'Escape' && stateRef.current.isResizing) {
      const eventId = stateRef.current.eventId!;
      setState(RESET_STATE);
      onResizeCancelRef.current?.(eventId);
    }
  });

  // Register / deregister global listeners only when isResizing changes.
  // Because we use stable refs above, no other deps are needed.
  useEffect(() => {
    if (!state.isResizing) return;

    const onMove = stableMoveHandler.current;
    const onEnd = stableEndHandler.current;
    const onKey = stableKeyHandler.current;

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onEnd);
    window.addEventListener('touchmove', onMove);
    window.addEventListener('touchend', onEnd);
    window.addEventListener('keydown', onKey);
    document.body.style.cursor = 'ns-resize';
    document.body.style.userSelect = 'none';

    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onEnd);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onEnd);
      window.removeEventListener('keydown', onKey);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [state.isResizing]); // ← only this; stable refs handle everything else

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

  // Generate props for resize handles (convenience helper, not used in current impl)
  const getResizeHandleProps = useCallback((
    eventId: string,
    direction: ResizeDirection
  ) => {
    const cursor = direction === 'top' || direction === 'bottom' ? 'ns-resize' : 'ew-resize';
    return {
      onMouseDown: (_e: React.MouseEvent) => {},
      onTouchStart: (_e: React.TouchEvent) => {},
      style: { cursor } as React.CSSProperties,
      className: `resize-handle resize-handle-${direction}`,
    };
  }, []);

  return [state, { handleResizeStart, getResizeHandleProps }];
}

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
  top: 0; left: 0; right: 0;
  height: 6px;
  cursor: ns-resize;
}

.resize-handle-bottom {
  bottom: 0; left: 0; right: 0;
  height: 6px;
  cursor: ns-resize;
}

.resize-handle-left {
  left: 0; top: 0; bottom: 0;
  width: 6px;
  cursor: ew-resize;
}

.resize-handle-right {
  right: 0; top: 0; bottom: 0;
  width: 6px;
  cursor: ew-resize;
}
`;

export default useEventResize;
