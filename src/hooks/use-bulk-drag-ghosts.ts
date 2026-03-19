// Ghost animation for bulk drag: when dragging a selected event in bulk mode,
// create fixed-position ghost copies of all other selected events that follow
// the cursor by the same (dx, dy) delta as the dragged event.

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CalendarEventType } from '@/lib/stores/types';
import React from 'react';

interface GhostData {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color?: string;
  title: string;
}

interface BulkDragState {
  active: boolean;
  draggingEventId: string | null;
  ghosts: GhostData[];
  startX: number;
  startY: number;
  dx: number;
  dy: number;
}

const INITIAL_STATE: BulkDragState = {
  active: false,
  draggingEventId: null,
  ghosts: [],
  startX: 0,
  startY: 0,
  dx: 0,
  dy: 0,
};

export function useBulkDragGhosts({
  isBulkMode,
  selectedIds,
  events,
}: {
  isBulkMode: boolean;
  selectedIds: Set<string>;
  events: CalendarEventType[];
}): {
  ghostsPortal: React.ReactNode;
  draggingBulkEventId: string | null;
} {
  const [state, setState] = useState<BulkDragState>(INITIAL_STATE);

  // Stable refs so the effect's handlers always read the latest values
  const isBulkRef = useRef(isBulkMode);
  isBulkRef.current = isBulkMode;
  const idsRef = useRef(selectedIds);
  idsRef.current = selectedIds;
  const eventsRef = useRef(events);
  eventsRef.current = events;
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    const onDragStart = (e: DragEvent) => {
      if (!isBulkRef.current) return;

      // Find the event wrapper that has data-event-id
      const wrapper = (e.target as HTMLElement).closest('[data-event-id]');
      if (!wrapper) return;

      const eventId = wrapper.getAttribute('data-event-id');
      if (!eventId || !idsRef.current.has(eventId)) return;

      // Gather ghost data for all OTHER selected events visible on screen
      const ghosts: GhostData[] = [];
      for (const id of idsRef.current) {
        if (id === eventId) continue;
        const el = document.querySelector(`[data-event-id="${id}"]`);
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        const ev = eventsRef.current.find(ev => ev.id === id);
        if (ev) {
          ghosts.push({
            id,
            x: rect.left,
            y: rect.top,
            width: rect.width,
            height: rect.height,
            color: ev.color,
            title: ev.title,
          });
        }
      }

      if (ghosts.length === 0) return;

      setState({
        active: true,
        draggingEventId: eventId,
        ghosts,
        startX: e.clientX,
        startY: e.clientY,
        dx: 0,
        dy: 0,
      });
    };

    const onDrag = (e: DragEvent) => {
      if (!stateRef.current.active) return;
      // Skip the (0,0) values browsers emit at the very end of a drag
      if (e.clientX === 0 && e.clientY === 0) return;
      setState(prev =>
        prev.active
          ? { ...prev, dx: e.clientX - prev.startX, dy: e.clientY - prev.startY }
          : prev
      );
    };

    const onDragEnd = () => {
      setState(INITIAL_STATE);
    };

    document.addEventListener('dragstart', onDragStart);
    document.addEventListener('drag', onDrag);
    document.addEventListener('dragend', onDragEnd);

    return () => {
      document.removeEventListener('dragstart', onDragStart);
      document.removeEventListener('drag', onDrag);
      document.removeEventListener('dragend', onDragEnd);
    };
  }, []); // stable — all live values read via refs

  const portal =
    state.active && state.ghosts.length > 0
      ? createPortal(
          React.createElement(
            'div',
            { className: 'fixed inset-0 pointer-events-none z-[9999]' },
            state.ghosts.map(ghost => {
              const isHex =
                ghost.color?.startsWith('#') || ghost.color?.startsWith('rgb');
              return React.createElement(
                'div',
                {
                  key: ghost.id,
                  className: 'absolute rounded shadow-lg overflow-hidden opacity-80',
                  style: {
                    left: ghost.x + state.dx,
                    top: ghost.y + state.dy,
                    width: ghost.width,
                    height: ghost.height,
                    backgroundColor: isHex ? ghost.color : '#6366f1',
                    transform: 'scale(0.97)',
                    transition: 'none',
                  },
                },
                React.createElement(
                  'div',
                  {
                    className:
                      'px-1.5 py-1 text-white text-[10px] font-medium truncate',
                  },
                  ghost.title
                )
              );
            })
          ),
          document.body
        )
      : null;

  return { ghostsPortal: portal, draggingBulkEventId: state.draggingEventId };
}
