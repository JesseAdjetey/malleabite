// Drag to Create Events Hook - Click and drag to select time range
import { useState, useCallback, useRef, useEffect } from 'react';
import dayjs, { Dayjs } from 'dayjs';

export interface DragSelection {
  startTime: Dayjs;
  endTime: Dayjs;
  startY: number;
  endY: number;
  isAllDay?: boolean;
}

export interface DragToCreateOptions {
  minDuration?: number; // minimum event duration in minutes
  snapToMinutes?: number; // snap to nearest N minutes (15, 30, etc.)
  dayStartHour?: number;
  dayEndHour?: number;
  hourHeight?: number; // pixel height of one hour slot
  onCreateEvent?: (start: string, end: string) => void; // callback when event should be created
}

const defaultOptions: DragToCreateOptions = {
  minDuration: 30,
  snapToMinutes: 15,
  dayStartHour: 0,
  dayEndHour: 24,
  hourHeight: 60,
};

export function useDragToCreate(options: DragToCreateOptions = {}) {
  const opts = { ...defaultOptions, ...options };
  
  const [isDragging, setIsDragging] = useState(false);
  const [selection, setSelection] = useState<DragSelection | null>(null);
  const [previewEvent, setPreviewEvent] = useState<{ start: Dayjs; end: Dayjs } | null>(null);
  
  const dragStartRef = useRef<{ y: number; date: Dayjs; time: Dayjs } | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Convert Y position to time
  const yToTime = useCallback((y: number, date: Dayjs): Dayjs => {
    const { hourHeight, dayStartHour, snapToMinutes } = opts;
    
    // Calculate minutes from top of container
    const totalMinutes = (y / hourHeight!) * 60 + dayStartHour! * 60;
    
    // Snap to nearest interval
    const snappedMinutes = Math.round(totalMinutes / snapToMinutes!) * snapToMinutes!;
    
    // Clamp to day bounds
    const clampedMinutes = Math.max(
      dayStartHour! * 60,
      Math.min(snappedMinutes, (opts.dayEndHour! * 60) - opts.minDuration!)
    );
    
    const hours = Math.floor(clampedMinutes / 60);
    const minutes = clampedMinutes % 60;
    
    return date.hour(hours).minute(minutes).second(0).millisecond(0);
  }, [opts]);

  // Convert time to Y position
  const timeToY = useCallback((time: Dayjs): number => {
    const { hourHeight, dayStartHour } = opts;
    const minutesFromStart = (time.hour() * 60 + time.minute()) - dayStartHour! * 60;
    return (minutesFromStart / 60) * hourHeight!;
  }, [opts]);

  // Handle mouse down - start drag
  const handleMouseDown = useCallback((e: React.MouseEvent, date: Dayjs) => {
    // Only left click
    if (e.button !== 0) return;
    
    // Ignore if clicking on existing event
    const target = e.target as HTMLElement;
    if (target.closest('[data-event-id]')) return;
    
    const container = e.currentTarget as HTMLElement;
    const rect = container.getBoundingClientRect();
    const y = e.clientY - rect.top;
    
    const startTime = yToTime(y, date);
    
    dragStartRef.current = { y, date, time: startTime };
    containerRef.current = container as HTMLDivElement;
    
    setIsDragging(true);
    setSelection({
      startTime,
      endTime: startTime.add(opts.minDuration!, 'minute'),
      startY: y,
      endY: y,
    });
    
    setPreviewEvent({
      start: startTime,
      end: startTime.add(opts.minDuration!, 'minute'),
    });
    
    // Prevent text selection
    e.preventDefault();
  }, [yToTime, opts.minDuration]);

  // Handle mouse move - update selection
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !dragStartRef.current || !containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const currentY = Math.max(0, Math.min(e.clientY - rect.top, rect.height));
    
    const { y: startY, date, time: startTime } = dragStartRef.current;
    const currentTime = yToTime(currentY, date);
    
    // Determine start and end based on drag direction
    const isForward = currentY >= startY;
    const selectionStart = isForward ? startTime : currentTime;
    const selectionEnd = isForward ? currentTime : startTime;
    
    // Ensure minimum duration
    const duration = selectionEnd.diff(selectionStart, 'minute');
    const finalEnd = duration < opts.minDuration!
      ? selectionStart.add(opts.minDuration!, 'minute')
      : selectionEnd;
    
    setSelection({
      startTime: selectionStart,
      endTime: finalEnd,
      startY: Math.min(startY, currentY),
      endY: Math.max(startY, currentY),
    });
    
    setPreviewEvent({
      start: selectionStart,
      end: finalEnd,
    });
  }, [isDragging, yToTime, opts.minDuration]);

  // Handle mouse up - finish drag
  const handleMouseUp = useCallback(() => {
    if (!isDragging || !selection) {
      setIsDragging(false);
      return;
    }
    
    setIsDragging(false);
    
    // Call the callback with the selected time range
    if (opts.onCreateEvent) {
      opts.onCreateEvent(
        selection.startTime.toISOString(),
        selection.endTime.toISOString()
      );
    }
    
    // Clear selection after a brief delay
    setTimeout(() => {
      setSelection(null);
      setPreviewEvent(null);
      dragStartRef.current = null;
    }, 100);
  }, [isDragging, selection, opts.onCreateEvent]);

  // Handle keyboard escape to cancel
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape' && isDragging) {
      setIsDragging(false);
      setSelection(null);
      setPreviewEvent(null);
      dragStartRef.current = null;
    }
  }, [isDragging]);

  // Add global event listeners
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.addEventListener('keydown', handleKeyDown);
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp, handleKeyDown]);

  // Calculate selection box style
  const getSelectionStyle = useCallback(() => {
    if (!selection) return {};
    
    const { hourHeight } = opts;
    const topY = timeToY(selection.startTime);
    const bottomY = timeToY(selection.endTime);
    const height = bottomY - topY;
    
    return {
      position: 'absolute' as const,
      top: `${topY}px`,
      left: 0,
      right: 0,
      height: `${Math.max(height, opts.minDuration! / 60 * hourHeight!)}px`,
      backgroundColor: 'rgba(99, 102, 241, 0.3)',
      border: '2px solid rgb(99, 102, 241)',
      borderRadius: '4px',
      pointerEvents: 'none' as const,
      zIndex: 10,
    };
  }, [selection, opts, timeToY]);

  // Get preview text
  const getPreviewText = useCallback(() => {
    if (!previewEvent) return '';
    
    const start = previewEvent.start.format('h:mm A');
    const end = previewEvent.end.format('h:mm A');
    const duration = previewEvent.end.diff(previewEvent.start, 'minute');
    
    if (duration < 60) {
      return `${start} - ${end} (${duration} min)`;
    } else {
      const hours = Math.floor(duration / 60);
      const mins = duration % 60;
      return `${start} - ${end} (${hours}h${mins > 0 ? ` ${mins}m` : ''})`;
    }
  }, [previewEvent]);

  return {
    isDragging,
    selection,
    previewEvent,
    handleMouseDown,
    getSelectionStyle,
    getPreviewText,
    // For all-day row
    handleAllDayClick: useCallback((date: Dayjs) => {
      const start = date.startOf('day');
      const end = date.endOf('day');
      
      if (opts.onCreateEvent) {
        opts.onCreateEvent(start.toISOString(), end.toISOString());
      }
    }, [opts.onCreateEvent]),
  };
}

// Quick event popup component props
export interface QuickEventPopupProps {
  isOpen: boolean;
  position: { x: number; y: number };
  startTime: Dayjs;
  endTime: Dayjs;
  onClose: () => void;
  onCreateEvent: (title: string) => void;
}

// Hook for quick event creation (simpler than full form)
export function useQuickEventCreate(addEventFn?: (event: { title: string; startsAt: string; endsAt: string }) => Promise<void>) {
  const [isQuickCreateOpen, setIsQuickCreateOpen] = useState(false);
  const [quickCreatePosition, setQuickCreatePosition] = useState({ x: 0, y: 0 });
  const [quickCreateTimes, setQuickCreateTimes] = useState<{ start: Dayjs; end: Dayjs } | null>(null);

  const openQuickCreate = useCallback((
    position: { x: number; y: number },
    startTime: Dayjs,
    endTime: Dayjs
  ) => {
    setQuickCreatePosition(position);
    setQuickCreateTimes({ start: startTime, end: endTime });
    setIsQuickCreateOpen(true);
  }, []);

  const closeQuickCreate = useCallback(() => {
    setIsQuickCreateOpen(false);
    setQuickCreateTimes(null);
  }, []);

  const handleQuickCreate = useCallback(async (title: string) => {
    if (!quickCreateTimes || !title.trim()) return;

    try {
      if (addEventFn) {
        await addEventFn({
          title: title.trim(),
          startsAt: quickCreateTimes.start.toISOString(),
          endsAt: quickCreateTimes.end.toISOString(),
        });
      }
      
      closeQuickCreate();
    } catch (error) {
      console.error('Failed to create event:', error);
    }
  }, [quickCreateTimes, addEventFn, closeQuickCreate]);

  return {
    isQuickCreateOpen,
    quickCreatePosition,
    quickCreateTimes,
    openQuickCreate,
    closeQuickCreate,
    handleQuickCreate,
  };
}

export default useDragToCreate;
