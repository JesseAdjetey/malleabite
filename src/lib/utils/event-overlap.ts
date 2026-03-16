import { CalendarEventType } from "@/lib/stores/types";
import dayjs from "dayjs";
import isSameOrAfter from "dayjs/plugin/isSameOrAfter";

dayjs.extend(isSameOrAfter);

interface EventPosition {
  event: CalendarEventType;
  column: number;
  totalColumns: number;
  isOverlapping: boolean;
}

/**
 * Parses event time from description or ISO timestamps
 */
function getEventTimes(event: CalendarEventType): { start: dayjs.Dayjs; end: dayjs.Dayjs } {
  let start: dayjs.Dayjs;
  let end: dayjs.Dayjs;

  if (event.startsAt && event.endsAt) {
    start = dayjs(event.startsAt);
    end = dayjs(event.endsAt);
  } else if (event.description) {
    // Try to parse from description (format: "HH:MM - HH:MM | ...")
    const timeMatch = event.description.match(/(\d{1,2}):(\d{2})\s*[-–]\s*(\d{1,2}):(\d{2})/);
    if (timeMatch) {
      const date = dayjs(event.date);
      start = date.hour(parseInt(timeMatch[1])).minute(parseInt(timeMatch[2]));
      end = date.hour(parseInt(timeMatch[3])).minute(parseInt(timeMatch[4]));
    } else {
      // Default to 9am-10am
      start = dayjs(event.date).hour(9).minute(0);
      end = dayjs(event.date).hour(10).minute(0);
    }
  } else {
    start = dayjs(event.date).hour(9).minute(0);
    end = dayjs(event.date).hour(10).minute(0);
  }

  return { start, end };
}

/**
 * Checks if two events overlap in time
 */
function eventsOverlap(event1: CalendarEventType, event2: CalendarEventType): boolean {
  const times1 = getEventTimes(event1);
  const times2 = getEventTimes(event2);

  // Events overlap if one starts before the other ends and ends after the other starts
  return times1.start.isBefore(times2.end) && times1.end.isAfter(times2.start);
}

/**
 * Finds all overlapping event groups
 */
function findOverlapGroups(events: CalendarEventType[]): CalendarEventType[][] {
  if (events.length === 0) return [];

  // Sort events by start time, then by end time descending (longest first)
  const sortedEvents = [...events].sort((a, b) => {
    const timesA = getEventTimes(a);
    const timesB = getEventTimes(b);
    const startDiff = timesA.start.valueOf() - timesB.start.valueOf();
    if (startDiff !== 0) return startDiff;
    return timesB.end.valueOf() - timesA.end.valueOf();
  });

  const groups: CalendarEventType[][] = [];
  let currentGroup: CalendarEventType[] = [sortedEvents[0]];

  // The group bounds are the min start and max end of all events in the group
  let groupStart = getEventTimes(sortedEvents[0]).start;
  let groupEnd = getEventTimes(sortedEvents[0]).end;

  for (let i = 1; i < sortedEvents.length; i++) {
    const event = sortedEvents[i];
    const eventTimes = getEventTimes(event);

    // An event belongs to the current group if its start time is before the group's max end time
    // (since events are sorted by start time, we know its start time is >= the group's start time)
    const overlapsWithGroup = eventTimes.start.isBefore(groupEnd);

    if (overlapsWithGroup) {
      currentGroup.push(event);
      // Extend group bounds if needed
      if (eventTimes.end.isAfter(groupEnd)) {
        groupEnd = eventTimes.end;
      }
    } else {
      // Start a new group
      groups.push(currentGroup);
      currentGroup = [event];
      groupStart = eventTimes.start;
      groupEnd = eventTimes.end;
    }
  }

  // Don't forget the last group
  groups.push(currentGroup);

  return groups;
}

/**
 * Calculates the position for each event, handling overlaps
 * Uses a greedy column assignment algorithm
 */
export function calculateEventPositions(events: CalendarEventType[]): Map<string, EventPosition> {
  const positions = new Map<string, EventPosition>();

  if (events.length === 0) return positions;

  const groups = findOverlapGroups(events);

  for (const group of groups) {
    if (group.length === 1) {
      // Single event, full width
      positions.set(group[0].id, {
        event: group[0],
        column: 0,
        totalColumns: 1,
        isOverlapping: false,
      });
    } else {
      // Multiple overlapping events - assign columns greedy-style
      // Sort group by start time
      const sortedGroup = [...group].sort((a, b) => {
        const ta = getEventTimes(a);
        const tb = getEventTimes(b);
        const dStart = ta.start.valueOf() - tb.start.valueOf();
        if (dStart !== 0) return dStart;
        return tb.end.valueOf() - ta.end.valueOf();
      });

      // Maintain a list of columns, where each column is a list of events assigned to it
      const columnsLayout: CalendarEventType[][] = [];

      for (const event of sortedGroup) {
        let assignedColumn = -1;
        const eTimes = getEventTimes(event);

        // Find the first column where this event fits
        // It fits if it doesn't overlap with ANY event already in that column
        for (let col = 0; col < columnsLayout.length; col++) {
          const columnEvents = columnsLayout[col];
          let hasOverlap = false;

          for (const colEvent of columnEvents) {
            const cTimes = getEventTimes(colEvent);
            // Overlap condition:
            // For standard overlapping, exclusive of edges is correct (t1.start < t2.end && cTimes.start < eTimes.end)
            // BUT within a single overlap group, we want visually distinct columns even if they just touch.
            // If they are in the same group, they share a common overlapped element. Putting them in the same column
            // creates a visual "snake" that is hard to read.
            // Therefore we use inclusive overlap (isSameOrBefore / isSameOrAfter isn't needed if we just do <= and >= with valueOf)
            const eStart = eTimes.start.valueOf();
            const eEnd = eTimes.end.valueOf();
            const cStart = cTimes.start.valueOf();
            const cEnd = cTimes.end.valueOf();

            if (eStart <= cEnd && cStart <= eEnd) {
              // Wait, eStart === cEnd is touching.
              // If they touch, they overlap for layout purposes. 
              // Exception: if one of them is zero duration, handle normally.
              if (eStart < cEnd && cStart < eEnd) {
                hasOverlap = true; break;
              } else if (eStart === cEnd || cStart === eEnd) {
                hasOverlap = true; break;
              }
            }
          }

          if (!hasOverlap) {
            assignedColumn = col;
            break;
          }
        }

        // If it didn't fit in any existing column, create a new one
        if (assignedColumn === -1) {
          assignedColumn = columnsLayout.length;
          columnsLayout.push([]);
        }

        columnsLayout[assignedColumn].push(event);

        // Temporarily store just the column index in positions
        positions.set(event.id, {
          event,
          column: assignedColumn,
          totalColumns: 0, // Will be set next
          isOverlapping: true,
        });
      }

      // The group's total columns is simply the number of columns we had to create
      const totalColumns = columnsLayout.length;

      for (const event of group) {
        const pos = positions.get(event.id)!;
        positions.set(event.id, { ...pos, totalColumns });
      }
    }
  }

  return positions;
}

/**
 * Gets the CSS left position and width for an event based on its overlap position
 */
export function getEventStyle(position: EventPosition | undefined): { left: string; width: string } {
  if (!position || position.totalColumns <= 1) {
    return { left: '0%', width: '100%' };
  }

  const columnWidth = 100 / position.totalColumns;
  const left = position.column * columnWidth;
  const width = columnWidth;

  return {
    left: `${left}%`,
    width: `${width}%`,
  };
}
