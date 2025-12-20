
/**
 * Utility functions for handling touch events in calendar events
 */

import dayjs from 'dayjs';

// Extract time info from event - checks startsAt/endsAt first, then falls back to description
export const getTimeInfo = (description?: string, startsAt?: string | Date, endsAt?: string | Date) => {
  // First, try to use startsAt and endsAt if available
  if (startsAt && endsAt) {
    const start = dayjs(startsAt);
    const end = dayjs(endsAt);
    
    if (start.isValid() && end.isValid()) {
      return {
        start: start.format('HH:mm'),
        end: end.format('HH:mm')
      };
    }
  }
  
  // Fall back to parsing from description
  if (!description) return { start: '09:00', end: '10:00' };
  
  const parts = description.split('|');
  if (parts.length >= 1) {
    const timesPart = parts[0].trim();
    const times = timesPart.split('-').map(t => t.trim());
    return {
      start: times[0] || '09:00',
      end: times[1] || '10:00'
    };
  }
  
  return { start: '09:00', end: '10:00' };
};

// Get time in minutes from HH:MM format
export const getTimeInMinutes = (timeString: string): number => {
  const [hours, minutes] = timeString.split(':').map(Number);
  return (hours * 60) + (minutes || 0);
};

// Format minutes as HH:MM
export const formatMinutesAsTime = (minutes: number): string => {
  const hours = Math.floor(minutes / 60) % 24;
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
};

// Calculate event positioning in pixels
export const calculateEventPosition = (startTimeStr: string, hourHeight: number = 80): number => {
  const startMinutes = getTimeInMinutes(startTimeStr);
  return (startMinutes / 60) * hourHeight;
};

// Calculate event height in pixels based on duration
export const calculateEventHeight = (startTimeStr: string, endTimeStr: string, hourHeight: number = 80): number => {
  const startMinutes = getTimeInMinutes(startTimeStr);
  let endMinutes = getTimeInMinutes(endTimeStr);
  
  // Handle case where end time is earlier than start time (event spans midnight)
  if (endMinutes < startMinutes) {
    endMinutes += 24 * 60; // Add 24 hours worth of minutes
  }
  
  const durationInHours = (endMinutes - startMinutes) / 60;
  // Ensure minimum height
  return Math.max(durationInHours * hourHeight, 20);
};

// Get drag data for an event
export const getDragData = (event: any, isLocked: boolean = false, color: string = '') => {
  const timeInfo = getTimeInfo(event.description, event.startsAt, event.endsAt);
  return {
    id: event.id,
    title: event.title,
    description: event.description,
    date: event.date,
    timeStart: timeInfo.start,
    timeEnd: timeInfo.end,
    isLocked,
    isTodo: event.isTodo,
    hasAlarm: event.hasAlarm,
    hasReminder: event.hasReminder,
    color,
    participants: event.participants
  };
};
