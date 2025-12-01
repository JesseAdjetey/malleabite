// Phase 1.3: Schedule Optimizer Algorithm
// Smart scheduling that considers priorities, preferences, and constraints

import { CalendarEventType } from '@/lib/stores/types';
import { findFreeTimeBlocks, TimeBlock, suggestOptimalTime } from './time-blocks';
import dayjs from 'dayjs';

export interface SchedulingPreferences {
  workdayStart: number; // hour (0-23)
  workdayEnd: number; // hour (0-23)
  preferredFocusHours: number[]; // array of hours, e.g., [9, 10, 11]
  avoidMeetingHours: number[]; // hours to avoid scheduling meetings
  minBreakBetweenEvents: number; // minutes
  maxConsecutiveMeetings: number; // max meetings in a row before break
  preferMorningMeetings: boolean;
}

export interface TaskToSchedule {
  id: string;
  title: string;
  duration: number; // minutes
  priority: 'high' | 'medium' | 'low';
  type: 'meeting' | 'focus' | 'break' | 'routine';
  deadline?: Date;
  preferredTimeOfDay?: 'morning' | 'afternoon' | 'evening';
  canSplit?: boolean; // can be split into multiple sessions
}

export interface ScheduleSuggestion {
  task: TaskToSchedule;
  suggestedSlot: {
    start: string; // ISO string
    end: string; // ISO string
    date: string; // YYYY-MM-DD
    score: number; // 0-100, how good this slot is
    reasoning: string[];
  };
  alternativeSlots: Array<{
    start: string;
    end: string;
    date: string;
    score: number;
  }>;
}

export interface OptimizedSchedule {
  suggestions: ScheduleSuggestion[];
  conflicts: string[]; // tasks that couldn't be scheduled
  summary: {
    tasksScheduled: number;
    tasksUnscheduled: number;
    averageScore: number;
    focusTimeProtected: boolean;
  };
}

const DEFAULT_PREFERENCES: SchedulingPreferences = {
  workdayStart: 8,
  workdayEnd: 18,
  preferredFocusHours: [9, 10, 14, 15],
  avoidMeetingHours: [12, 13], // lunch time
  minBreakBetweenEvents: 15,
  maxConsecutiveMeetings: 3,
  preferMorningMeetings: true,
};

/**
 * Score a time slot for a task (0-100)
 */
function scoreTimeSlot(
  task: TaskToSchedule,
  block: TimeBlock,
  preferences: SchedulingPreferences
): { score: number; reasoning: string[] } {
  let score = 50; // base score
  const reasoning: string[] = [];
  const hour = dayjs(block.start).hour();

  // Priority-based scoring
  if (task.priority === 'high') {
    if (block.quality === 'high') {
      score += 20;
      reasoning.push('High-quality time block for high-priority task');
    }
    if (preferences.preferredFocusHours.includes(hour)) {
      score += 15;
      reasoning.push('Scheduled during preferred focus hours');
    }
  }

  // Task type considerations
  if (task.type === 'focus') {
    if (block.duration >= task.duration + 30) {
      score += 10;
      reasoning.push('Extra buffer time for deep work');
    }
    if (block.timeOfDay === 'morning' || block.timeOfDay === 'afternoon') {
      score += 10;
      reasoning.push('Optimal time for focused work');
    }
  }

  if (task.type === 'meeting') {
    if (preferences.preferMorningMeetings && block.timeOfDay === 'morning') {
      score += 10;
      reasoning.push('Morning slot for meeting');
    }
    if (!preferences.avoidMeetingHours.includes(hour)) {
      score += 5;
      reasoning.push('Not during avoid-meeting hours');
    }
  }

  // Time of day preference
  if (task.preferredTimeOfDay && task.preferredTimeOfDay === block.timeOfDay) {
    score += 15;
    reasoning.push(`Matches preferred time: ${task.preferredTimeOfDay}`);
  }

  // Duration fit
  const durationMatch = block.duration - task.duration;
  if (durationMatch >= 0 && durationMatch <= 30) {
    score += 10;
    reasoning.push('Perfect duration fit');
  } else if (durationMatch > 30 && durationMatch <= 60) {
    score += 5;
    reasoning.push('Good duration fit with buffer');
  }

  // Deadline urgency
  if (task.deadline) {
    const daysUntilDeadline = dayjs(task.deadline).diff(dayjs(block.start), 'day');
    if (daysUntilDeadline <= 1) {
      score += 20;
      reasoning.push('Urgent - deadline approaching');
    } else if (daysUntilDeadline <= 3) {
      score += 10;
      reasoning.push('High urgency - deadline soon');
    }
  }

  // Penalize evening/night for focus work
  if (task.type === 'focus' && (block.timeOfDay === 'evening' || block.timeOfDay === 'night')) {
    score -= 15;
    reasoning.push('Suboptimal time for focus work');
  }

  // Ensure score is within 0-100
  score = Math.max(0, Math.min(100, score));

  return { score, reasoning };
}

/**
 * Find best slot for a single task
 */
function findBestSlot(
  task: TaskToSchedule,
  events: CalendarEventType[],
  preferences: SchedulingPreferences,
  daysToSearch: number = 7
): ScheduleSuggestion | null {
  const allSlots: Array<{
    block: TimeBlock;
    date: string;
    score: number;
    reasoning: string[];
  }> = [];

  // Search through the next N days
  for (let i = 0; i < daysToSearch; i++) {
    const date = dayjs().add(i, 'day');
    const analysis = findFreeTimeBlocks(
      date.toDate(),
      events,
      preferences.workdayStart,
      preferences.workdayEnd
    );

    // Score each free block
    analysis.freeBlocks.forEach((block) => {
      if (block.duration >= task.duration) {
        const { score, reasoning } = scoreTimeSlot(task, block, preferences);
        allSlots.push({
          block,
          date: analysis.date,
          score,
          reasoning,
        });
      }
    });
  }

  if (allSlots.length === 0) {
    return null;
  }

  // Sort by score
  allSlots.sort((a, b) => b.score - a.score);

  // Best slot
  const best = allSlots[0];
  const taskStart = dayjs(best.block.start);
  const taskEnd = taskStart.add(task.duration, 'minute');

  // Alternative slots (top 3)
  const alternatives = allSlots.slice(1, 4).map((slot) => {
    const start = dayjs(slot.block.start);
    const end = start.add(task.duration, 'minute');
    return {
      start: start.toISOString(),
      end: end.toISOString(),
      date: slot.date,
      score: slot.score,
    };
  });

  return {
    task,
    suggestedSlot: {
      start: taskStart.toISOString(),
      end: taskEnd.toISOString(),
      date: best.date,
      score: best.score,
      reasoning: best.reasoning,
    },
    alternativeSlots: alternatives,
  };
}

/**
 * Optimize schedule for multiple tasks
 */
export function optimizeSchedule(
  tasks: TaskToSchedule[],
  existingEvents: CalendarEventType[],
  preferences: Partial<SchedulingPreferences> = {}
): OptimizedSchedule {
  const prefs = { ...DEFAULT_PREFERENCES, ...preferences };
  const suggestions: ScheduleSuggestion[] = [];
  const conflicts: string[] = [];
  let workingEvents = [...existingEvents];

  // Sort tasks by priority and deadline
  const sortedTasks = [...tasks].sort((a, b) => {
    // Priority order
    const priorityOrder = { high: 3, medium: 2, low: 1 };
    const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
    if (priorityDiff !== 0) return priorityDiff;

    // Then by deadline
    if (a.deadline && b.deadline) {
      return dayjs(a.deadline).diff(dayjs(b.deadline));
    }
    if (a.deadline) return -1;
    if (b.deadline) return 1;
    return 0;
  });

  // Schedule each task
  sortedTasks.forEach((task) => {
    const suggestion = findBestSlot(task, workingEvents, prefs);

    if (suggestion) {
      suggestions.push(suggestion);

      // Add this task to working events so it's considered for next task
      workingEvents.push({
        id: task.id,
        title: task.title,
        description: '',
        startsAt: suggestion.suggestedSlot.start,
        endsAt: suggestion.suggestedSlot.end,
        date: suggestion.suggestedSlot.date,
      });
    } else {
      conflicts.push(`${task.title} (${task.duration} min) - No suitable time slot found`);
    }
  });

  // Calculate summary
  const averageScore =
    suggestions.length > 0
      ? suggestions.reduce((sum, s) => sum + s.suggestedSlot.score, 0) / suggestions.length
      : 0;

  const focusTimeProtected = suggestions
    .filter((s) => s.task.type === 'focus')
    .every((s) => s.suggestedSlot.score >= 60);

  return {
    suggestions,
    conflicts,
    summary: {
      tasksScheduled: suggestions.length,
      tasksUnscheduled: conflicts.length,
      averageScore: Math.round(averageScore),
      focusTimeProtected,
    },
  };
}

/**
 * Rebalance existing schedule to optimize
 */
export function rebalanceSchedule(
  events: CalendarEventType[],
  preferences: Partial<SchedulingPreferences> = {}
): {
  recommendations: Array<{
    eventId: string;
    currentSlot: { start: string; end: string };
    betterSlot: { start: string; end: string; score: number; improvement: string[] };
  }>;
  summary: {
    totalEvents: number;
    eventsToMove: number;
    averageImprovement: number;
  };
} {
  const prefs = { ...DEFAULT_PREFERENCES, ...preferences };
  const recommendations: Array<any> = [];

  // Analyze each event
  events.forEach((event) => {
    const duration = dayjs(event.endsAt).diff(dayjs(event.startsAt), 'minute');
    const task: TaskToSchedule = {
      id: event.id,
      title: event.title,
      duration,
      priority: 'medium',
      type: 'focus',
    };

    // Find better slot
    const otherEvents = events.filter((e) => e.id !== event.id);
    const suggestion = findBestSlot(task, otherEvents, prefs);

    if (suggestion && suggestion.suggestedSlot.score > 70) {
      const currentTime = dayjs(event.startsAt);
      const suggestedTime = dayjs(suggestion.suggestedSlot.start);

      // Only recommend if it's a significant improvement
      if (!currentTime.isSame(suggestedTime, 'hour')) {
        recommendations.push({
          eventId: event.id,
          currentSlot: {
            start: event.startsAt,
            end: event.endsAt,
          },
          betterSlot: {
            start: suggestion.suggestedSlot.start,
            end: suggestion.suggestedSlot.end,
            score: suggestion.suggestedSlot.score,
            improvement: suggestion.suggestedSlot.reasoning,
          },
        });
      }
    }
  });

  const averageImprovement =
    recommendations.length > 0
      ? recommendations.reduce((sum, r) => sum + r.betterSlot.score, 0) / recommendations.length
      : 0;

  return {
    recommendations,
    summary: {
      totalEvents: events.length,
      eventsToMove: recommendations.length,
      averageImprovement: Math.round(averageImprovement),
    },
  };
}
