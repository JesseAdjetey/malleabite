import { CalendarEventType } from '@/lib/stores/types';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';

dayjs.extend(utc);

interface ImportedEvent extends Partial<CalendarEventType> {
  location?: string;
  category?: string;
  completed?: boolean;
}

/**
 * Parse iCal/ICS file content and extract events
 */
export function parseICalendar(icsContent: string): ImportedEvent[] {
  const events: ImportedEvent[] = [];
  const lines = icsContent.split(/\r\n|\n|\r/);
  
  let currentEvent: ImportedEvent | null = null;
  let currentField = '';
  
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim();
    
    // Handle line continuation
    if (line.startsWith(' ') || line.startsWith('\t')) {
      if (currentField) {
        line = currentField + line.trim();
      }
    }
    
    currentField = line;
    
    // Start of event
    if (line === 'BEGIN:VEVENT') {
      currentEvent = {
        id: `imported-${Date.now()}-${Math.random()}`,
        color: '#3b82f6',
        category: 'other',
        isLocked: false,
      } as ImportedEvent;
      continue;
    }
    
    // End of event
    if (line === 'END:VEVENT' && currentEvent) {
      if (currentEvent.title && currentEvent.startsAt && currentEvent.endsAt) {
        events.push(currentEvent);
      }
      currentEvent = null;
      continue;
    }
    
    if (!currentEvent) continue;
    
    // Parse event fields
    if (line.startsWith('SUMMARY:')) {
      currentEvent.title = line.substring(8).trim();
    }
    else if (line.startsWith('DESCRIPTION:')) {
      currentEvent.description = unescapeICalText(line.substring(12).trim());
    }
    else if (line.startsWith('LOCATION:')) {
      currentEvent.location = line.substring(9).trim();
    }
    else if (line.startsWith('DTSTART')) {
      const dateValue = extractDateValue(line);
      if (dateValue) {
        currentEvent.startsAt = dateValue;
      }
    }
    else if (line.startsWith('DTEND')) {
      const dateValue = extractDateValue(line);
      if (dateValue) {
        currentEvent.endsAt = dateValue;
      }
    }
    else if (line.startsWith('CATEGORIES:')) {
      const category = line.substring(11).trim().toLowerCase();
      if (['work', 'personal', 'health', 'learning', 'social', 'entertainment'].includes(category)) {
        currentEvent.category = category;
      }
    }
    else if (line.startsWith('STATUS:COMPLETED') || line.startsWith('STATUS:CANCELLED')) {
      currentEvent.completed = true;
    }
  }
  
  return events;
}

/**
 * Extract date value from iCal date line
 */
function extractDateValue(line: string): string | null {
  // Extract the date part after the colon
  const colonIndex = line.indexOf(':');
  if (colonIndex === -1) return null;
  
  let dateString = line.substring(colonIndex + 1).trim();
  
  // Remove VALUE=DATE if present
  dateString = dateString.replace('VALUE=DATE:', '');
  
  // Parse different date formats
  // Format: 20251024T140000Z (UTC)
  // Format: 20251024T140000 (Local)
  // Format: 20251024 (All-day)
  
  if (dateString.length === 8) {
    // All-day event: YYYYMMDD
    const year = dateString.substring(0, 4);
    const month = dateString.substring(4, 6);
    const day = dateString.substring(6, 8);
    return `${year}-${month}-${day}T00:00:00`;
  }
  
  if (dateString.length >= 15) {
    // Date with time: YYYYMMDDTHHmmss or YYYYMMDDTHHmmssZ
    const year = dateString.substring(0, 4);
    const month = dateString.substring(4, 6);
    const day = dateString.substring(6, 8);
    const hour = dateString.substring(9, 11);
    const minute = dateString.substring(11, 13);
    const second = dateString.substring(13, 15);
    
    const isoDate = `${year}-${month}-${day}T${hour}:${minute}:${second}`;
    
    // If ends with Z, it's UTC
    if (dateString.endsWith('Z')) {
      return dayjs.utc(isoDate).local().toISOString();
    }
    
    return dayjs(isoDate).toISOString();
  }
  
  return null;
}

/**
 * Unescape iCal text (handle \\n, \\,, etc.)
 */
function unescapeICalText(text: string): string {
  return text
    .replace(/\\n/g, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\');
}

/**
 * Export events to iCal/ICS format
 */
export function exportToICalendar(
  events: (CalendarEventType | ImportedEvent)[],
  calendarName: string = 'Malleabite Calendar'
): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Malleabite//Calendar//EN',
    `X-WR-CALNAME:${calendarName}`,
    'X-WR-TIMEZONE:UTC',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ];
  
  events.forEach(event => {
    const importedEvent = event as ImportedEvent;
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${event.id}@malleabite.com`);
    lines.push(`DTSTAMP:${formatICalDate(new Date())}`);
    lines.push(`DTSTART:${formatICalDate(event.startsAt)}`);
    lines.push(`DTEND:${formatICalDate(event.endsAt)}`);
    lines.push(`SUMMARY:${escapeICalText(event.title)}`);
    
    if (event.description) {
      lines.push(`DESCRIPTION:${escapeICalText(event.description)}`);
    }
    
    if (importedEvent.location) {
      lines.push(`LOCATION:${escapeICalText(importedEvent.location)}`);
    }
    
    if (importedEvent.category) {
      lines.push(`CATEGORIES:${importedEvent.category.toUpperCase()}`);
    }
    
    if (importedEvent.completed) {
      lines.push('STATUS:COMPLETED');
    }
    
    lines.push('END:VEVENT');
  });
  
  lines.push('END:VCALENDAR');
  
  return lines.join('\r\n');
}

/**
 * Format date for iCal format
 */
function formatICalDate(date: string | Date): string {
  const d = dayjs(date).utc();
  return d.format('YYYYMMDDTHHmmss') + 'Z';
}

/**
 * Escape special characters for iCal
 */
function escapeICalText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

/**
 * Download ICS file
 */
export function downloadICalendar(icsContent: string, filename: string = 'calendar.ics') {
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Read ICS file from File input
 */
export async function readICalendarFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        resolve(e.target.result as string);
      } else {
        reject(new Error('Failed to read file'));
      }
    };
    reader.onerror = () => reject(new Error('Error reading file'));
    reader.readAsText(file);
  });
}
