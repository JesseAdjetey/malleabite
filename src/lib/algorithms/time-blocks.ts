// Phase 1.3: Time Block Analysis Algorithm
// Identifies free time blocks in calendar and suggests optimal task placement

import { CalendarEventType } from '@/lib/stores/types';
import dayjs, { Dayjs } from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';

dayjs.extend(isBetween);

export interface TimeBlock {
  start: string; // ISO string
  end: string; // ISO string
  duration: number; // minutes
  timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';
  category: 'short' | 'medium' | 'long'; // < 30min, 30-120min, >120min
  quality: 'high' | 'medium' | 'low'; // Based on typical productivity patterns
}

export interface TimeBlockAnalysis {
  date: string; // YYYY-MM-DD
  totalFreeTime: number; // minutes
  freeBlocks: TimeBlock[];
  recommendedBlocks: TimeBlock[]; // Best blocks for focused work
  shortBreaks: TimeBlock[]; // 15-30 min blocks
  meetingSlots: TimeBlock[]; // 30-60 min blocks
  deepWorkSlots: TimeBlock[]; // 2+ hour blocks
}

/**
 * Determine time of day category
 */
function getTimeOfDay(time: Dayjs): 'morning' | 'afternoon' | 'evening' | 'night' {
  const hour = time.hour();
  if (hour >= 6 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 21) return 'evening';
  return 'night';
}

/**
 * Determine block quality based on time and duration
 * Morning and early afternoon are typically better for focused work
 */
function getBlockQuality(
  timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night',
  duration: number
): 'high' | 'medium' | 'low' {
  // Longer blocks in morning/afternoon are high quality
  if (duration >= 120 && (timeOfDay === 'morning' || timeOfDay === 'afternoon')) {
    return 'high';
  }
  
  // Medium blocks in good times
  if (duration >= 60 && timeOfDay !== 'night') {
    return 'medium';
  }
  
  // Everything else
  return 'low';
}

/**
 * Categorize block by duration
 */
function getBlockCategory(duration: number): 'short' | 'medium' | 'long' {
  if (duration < 30) return 'short';
  if (duration < 120) return 'medium';
  return 'long';
}

/**
 * Find free time blocks for a given date
 */
export function findFreeTimeBlocks(
  date: Date | string,
  events: CalendarEventType[],
  workdayStart: number = 8, // 8 AM
  workdayEnd: number = 18, // 6 PM
  minBlockDuration: number = 15 // minimum 15 minutes
): TimeBlockAnalysis {
  const targetDate = dayjs(date);
  const dateString = targetDate.format('YYYY-MM-DD');
  
  // Filter events for this specific date
  const dayEvents = events
    .filter((e) => {
      const eventDate = dayjs(e.startsAt);
      return eventDate.isSame(targetDate, 'day');
    })
    .sort((a, b) => dayjs(a.startsAt).diff(dayjs(b.startsAt)));

  // Define workday boundaries
  const workStart = targetDate.hour(workdayStart).minute(0).second(0);
  const workEnd = targetDate.hour(workdayEnd).minute(0).second(0);

  // Find gaps between events
  const freeBlocks: TimeBlock[] = [];
  let currentTime = workStart;

  dayEvents.forEach((event) => {
    const eventStart = dayjs(event.startsAt);
    const eventEnd = dayjs(event.endsAt);

    // Check if there's a gap before this event
    if (currentTime.isBefore(eventStart)) {
      const duration = eventStart.diff(currentTime, 'minute');
      
      if (duration >= minBlockDuration) {
        const timeOfDay = getTimeOfDay(currentTime);
        const category = getBlockCategory(duration);
        const quality = getBlockQuality(timeOfDay, duration);
        
        freeBlocks.push({
          start: currentTime.toISOString(),
          end: eventStart.toISOString(),
          duration,
          timeOfDay,
          category,
          quality,
        });
      }
    }

    // Move current time to after this event
    currentTime = eventEnd.isAfter(currentTime) ? eventEnd : currentTime;
  });

  // Check if there's time after the last event
  if (currentTime.isBefore(workEnd)) {
    const duration = workEnd.diff(currentTime, 'minute');
    
    if (duration >= minBlockDuration) {
      const timeOfDay = getTimeOfDay(currentTime);
      const category = getBlockCategory(duration);
      const quality = getBlockQuality(timeOfDay, duration);
      
      freeBlocks.push({
        start: currentTime.toISOString(),
        end: workEnd.toISOString(),
        duration,
        timeOfDay,
        category,
        quality,
      });
    }
  }

  // Calculate total free time
  const totalFreeTime = freeBlocks.reduce((sum, block) => sum + block.duration, 0);

  // Categorize blocks
  const recommendedBlocks = freeBlocks
    .filter((b) => b.quality === 'high' || (b.quality === 'medium' && b.duration >= 90))
    .sort((a, b) => b.duration - a.duration);

  const shortBreaks = freeBlocks.filter((b) => b.category === 'short');
  
  const meetingSlots = freeBlocks.filter(
    (b) => b.duration >= 30 && b.duration <= 60
  );
  
  const deepWorkSlots = freeBlocks.filter((b) => b.duration >= 120);

  return {
    date: dateString,
    totalFreeTime,
    freeBlocks,
    recommendedBlocks,
    shortBreaks,
    meetingSlots,
    deepWorkSlots,
  };
}

/**
 * Analyze multiple days for optimal time blocks
 */
export function analyzeWeekTimeBlocks(
  startDate: Date,
  events: CalendarEventType[],
  workdayStart: number = 8,
  workdayEnd: number = 18
): TimeBlockAnalysis[] {
  const analyses: TimeBlockAnalysis[] = [];
  const start = dayjs(startDate);

  for (let i = 0; i < 7; i++) {
    const date = start.add(i, 'day');
    const analysis = findFreeTimeBlocks(
      date.toDate(),
      events,
      workdayStart,
      workdayEnd
    );
    analyses.push(analysis);
  }

  return analyses;
}

/**
 * Suggest optimal time for a task based on duration and priority
 */
export function suggestOptimalTime(
  taskDuration: number, // minutes
  priority: 'high' | 'medium' | 'low',
  events: CalendarEventType[],
  daysToSearch: number = 7
): { date: string; block: TimeBlock } | null {
  const today = dayjs();
  
  for (let i = 0; i < daysToSearch; i++) {
    const date = today.add(i, 'day');
    const analysis = findFreeTimeBlocks(date.toDate(), events);
    
    // For high priority, find high quality blocks
    if (priority === 'high') {
      const block = analysis.recommendedBlocks.find((b) => b.duration >= taskDuration);
      if (block) {
        return { date: analysis.date, block };
      }
    }
    
    // For medium/low priority, any suitable block works
    const block = analysis.freeBlocks.find((b) => b.duration >= taskDuration);
    if (block) {
      return { date: analysis.date, block };
    }
  }
  
  return null;
}

/**
 * Get statistics about free time patterns
 */
export function getFreeTimeStats(analyses: TimeBlockAnalysis[]) {
  const totalDays = analyses.length;
  const totalFreeTime = analyses.reduce((sum, a) => sum + a.totalFreeTime, 0);
  const averageFreeTime = totalFreeTime / totalDays;
  
  const totalDeepWorkSlots = analyses.reduce((sum, a) => sum + a.deepWorkSlots.length, 0);
  const averageDeepWorkSlots = totalDeepWorkSlots / totalDays;
  
  const mostProductiveDay = analyses.reduce(
    (max, a) => (a.totalFreeTime > max.totalFreeTime ? a : max),
    analyses[0]
  );
  
  const leastProductiveDay = analyses.reduce(
    (min, a) => (a.totalFreeTime < min.totalFreeTime ? a : min),
    analyses[0]
  );

  return {
    totalDays,
    totalFreeTime,
    averageFreeTime: Math.round(averageFreeTime),
    totalDeepWorkSlots,
    averageDeepWorkSlots: Math.round(averageDeepWorkSlots * 10) / 10,
    mostProductiveDay: {
      date: mostProductiveDay.date,
      freeTime: mostProductiveDay.totalFreeTime,
    },
    leastProductiveDay: {
      date: leastProductiveDay.date,
      freeTime: leastProductiveDay.totalFreeTime,
    },
  };
}
