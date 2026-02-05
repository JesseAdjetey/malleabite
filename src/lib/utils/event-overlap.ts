import { CalendarEventType } from "@/lib/stores/types";
import dayjs from "dayjs";

interface EventPosition {
  event: CalendarEventType;
  column: number;
  totalColumns: number;
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
  
  // Sort events by start time
  const sortedEvents = [...events].sort((a, b) => {
    const timesA = getEventTimes(a);
    const timesB = getEventTimes(b);
    return timesA.start.valueOf() - timesB.start.valueOf();
  });

  const groups: CalendarEventType[][] = [];
  let currentGroup: CalendarEventType[] = [sortedEvents[0]];
  let groupEndTime = getEventTimes(sortedEvents[0]).end;

  for (let i = 1; i < sortedEvents.length; i++) {
    const event = sortedEvents[i];
    const eventTimes = getEventTimes(event);

    // Check if this event overlaps with any event in the current group
    const overlapsWithGroup = eventTimes.start.isBefore(groupEndTime);

    if (overlapsWithGroup) {
      currentGroup.push(event);
      // Extend group end time if needed
      if (eventTimes.end.isAfter(groupEndTime)) {
        groupEndTime = eventTimes.end;
      }
    } else {
      // Start a new group
      groups.push(currentGroup);
      currentGroup = [event];
      groupEndTime = eventTimes.end;
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
      });
    } else {
      // Multiple overlapping events - assign columns
      const columnEndTimes: dayjs.Dayjs[] = [];

      for (const event of group) {
        const times = getEventTimes(event);
        
        // Find the first column where this event fits
        let assignedColumn = -1;
        for (let col = 0; col < columnEndTimes.length; col++) {
          if (!times.start.isBefore(columnEndTimes[col])) {
            assignedColumn = col;
            columnEndTimes[col] = times.end;
            break;
          }
        }

        // If no column found, create a new one
        if (assignedColumn === -1) {
          assignedColumn = columnEndTimes.length;
          columnEndTimes.push(times.end);
        }

        positions.set(event.id, {
          event,
          column: assignedColumn,
          totalColumns: 0, // Will be set later
        });
      }

      // Update totalColumns for all events in the group
      const totalColumns = columnEndTimes.length;
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
    return { left: '0', width: '100%' };
  }

  const columnWidth = 100 / position.totalColumns;
  const left = position.column * columnWidth;
  const width = columnWidth;

  return {
    left: `${left}%`,
    width: `${width}%`,
  };
}
