/**
 * useRescheduler
 *
 * Provides:
 *  - getSuggestedSlots(event, allEvents) → up to 5 scored alternative time slots
 *  - applyReschedule(event, newStart, newEnd) → persists the change via useEventCRUD
 *  - undoLast() → reverts the most recent reschedule (30-second window)
 *
 * In 'auto' mode the hook automatically resolves conflicts when it detects
 * a new set of critical conflicts passed via resolveAutomatically().
 */
import { useCallback, useRef } from 'react';
import dayjs from 'dayjs';
import { toast } from 'sonner';
import { useSettingsStore } from '@/lib/stores/settings-store';
import {
  findAlternativeSlots,
  type AlternativeSlot,
} from '@/lib/algorithms/conflict-detection';
import type { CalendarEventType } from '@/lib/stores/types';
import { useEventCRUD } from '@/hooks/use-event-crud';

interface UndoEntry {
  event: CalendarEventType;
  previousStart: string;
  previousEnd: string;
  timeoutId: ReturnType<typeof setTimeout>;
}

export interface RescheduleResult {
  success: boolean;
  error?: string;
}

export function useRescheduler() {
  const { reschedulingPrefs } = useSettingsStore();
  const { updateEventWithSync } = useEventCRUD() as any;
  const undoRef = useRef<UndoEntry | null>(null);

  // ── Get suggested slots ────────────────────────────────────────────────────
  const getSuggestedSlots = useCallback(
    (
      event: CalendarEventType,
      allEvents: CalendarEventType[],
    ): AlternativeSlot[] => {
      return findAlternativeSlots(event, allEvents, reschedulingPrefs, 5);
    },
    [reschedulingPrefs],
  );

  // ── Apply a reschedule ─────────────────────────────────────────────────────
  const applyReschedule = useCallback(
    async (
      event: CalendarEventType,
      newStart: string,
      newEnd: string,
      silent = false,
    ): Promise<RescheduleResult> => {
      // Cancel any pending undo from a previous reschedule
      if (undoRef.current) {
        clearTimeout(undoRef.current.timeoutId);
        undoRef.current = null;
      }

      const updatedEvent: CalendarEventType = {
        ...event,
        startsAt: newStart,
        endsAt: newEnd,
        updatedAt: new Date().toISOString(),
      };

      try {
        await updateEventWithSync(updatedEvent);

        if (!silent) {
          const label = `${dayjs(newStart).format('ddd h:mm A')} – ${dayjs(newEnd).format('h:mm A')}`;
          toast.success(`"${event.title}" moved to ${label}`, {
            action: {
              label: 'Undo',
              onClick: () => undoLast(),
            },
            duration: 30_000,
          });
        }

        // Store undo state — 30-second window
        const timeoutId = setTimeout(() => {
          undoRef.current = null;
        }, 30_000);

        undoRef.current = {
          event,
          previousStart: event.startsAt,
          previousEnd: event.endsAt,
          timeoutId,
        };

        return { success: true };
      } catch (err: any) {
        toast.error(`Could not reschedule "${event.title}": ${err?.message ?? 'unknown error'}`);
        return { success: false, error: err?.message };
      }
    },
    [updateEventWithSync],
  );

  // ── Undo last reschedule ───────────────────────────────────────────────────
  const undoLast = useCallback(async (): Promise<void> => {
    const entry = undoRef.current;
    if (!entry) return;

    clearTimeout(entry.timeoutId);
    undoRef.current = null;

    const restored: CalendarEventType = {
      ...entry.event,
      startsAt: entry.previousStart,
      endsAt: entry.previousEnd,
      updatedAt: new Date().toISOString(),
    };

    try {
      await updateEventWithSync(restored);
      toast.success('Reschedule undone');
    } catch {
      toast.error('Could not undo the reschedule');
    }
  }, [updateEventWithSync]);

  // ── Auto-resolve conflicts ─────────────────────────────────────────────────
  /**
   * Call this from a view when mode === 'auto' and new critical conflicts are
   * detected.  Picks the event to move based on autoRescheduleTarget, finds
   * the best slot, and applies it silently (the toast still shows with undo).
   */
  const resolveAutomatically = useCallback(
    async (
      conflictingPair: [CalendarEventType, CalendarEventType],
      allEvents: CalendarEventType[],
    ): Promise<void> => {
      if (reschedulingPrefs.mode !== 'auto') return;

      const [a, b] = conflictingPair;

      // Determine which event to move
      let toMove: CalendarEventType;
      switch (reschedulingPrefs.autoRescheduleTarget) {
        case 'newer_event':
          toMove = dayjs(a.createdAt ?? a.startsAt).isAfter(dayjs(b.createdAt ?? b.startsAt)) ? a : b;
          break;
        case 'shorter_event': {
          const durA = dayjs(a.endsAt).diff(dayjs(a.startsAt), 'minute');
          const durB = dayjs(b.endsAt).diff(dayjs(b.startsAt), 'minute');
          toMove = durA <= durB ? a : b;
          break;
        }
        default:
          toMove = dayjs(a.createdAt ?? a.startsAt).isAfter(dayjs(b.createdAt ?? b.startsAt)) ? a : b;
      }

      if (toMove.isLocked) return; // respect locks even in auto mode

      const slots = findAlternativeSlots(toMove, allEvents, reschedulingPrefs, 1);
      if (slots.length === 0) {
        toast.warning(`Could not find an open slot for "${toMove.title}". Move it manually.`);
        return;
      }

      await applyReschedule(toMove, slots[0].start, slots[0].end);
    },
    [reschedulingPrefs, applyReschedule],
  );

  return { getSuggestedSlots, applyReschedule, undoLast, resolveAutomatically };
}
