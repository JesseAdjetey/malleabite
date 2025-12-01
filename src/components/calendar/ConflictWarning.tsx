// Phase 1.1: Visual Conflict Warning Component
// Displays warning indicators and suggestions for scheduling conflicts

import React from 'react';
import { AlertTriangle, Clock, Calendar, XCircle } from 'lucide-react';
import { CalendarEventType } from '@/lib/stores/types';
import { EventConflict } from '@/hooks/use-conflict-detection';
import dayjs from 'dayjs';

interface ConflictWarningProps {
  conflicts: EventConflict[];
  events: CalendarEventType[];
  variant?: 'inline' | 'banner' | 'badge';
  onResolve?: (eventId: string, suggestion: string) => void;
}

/**
 * ConflictWarning - Visual component for displaying scheduling conflicts
 */
export default function ConflictWarning({
  conflicts,
  events,
  variant = 'inline',
  onResolve,
}: ConflictWarningProps) {
  if (conflicts.length === 0) return null;

  // Get severity color
  const getSeverityColor = (severity: 'high' | 'medium' | 'low') => {
    switch (severity) {
      case 'high':
        return {
          bg: 'bg-red-50',
          border: 'border-red-200',
          text: 'text-red-800',
          icon: 'text-red-600',
          badge: 'bg-red-500',
        };
      case 'medium':
        return {
          bg: 'bg-orange-50',
          border: 'border-orange-200',
          text: 'text-orange-800',
          icon: 'text-orange-600',
          badge: 'bg-orange-500',
        };
      case 'low':
        return {
          bg: 'bg-yellow-50',
          border: 'border-yellow-200',
          text: 'text-yellow-800',
          icon: 'text-yellow-600',
          badge: 'bg-yellow-500',
        };
    }
  };

  // Badge variant - small warning indicator
  if (variant === 'badge') {
    const highestSeverity = conflicts.reduce(
      (max, c) => (c.severity === 'high' ? 'high' : c.severity === 'medium' && max !== 'high' ? 'medium' : max),
      'low' as 'high' | 'medium' | 'low'
    );
    const colors = getSeverityColor(highestSeverity);

    return (
      <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full ${colors.badge} text-white text-xs font-semibold`}>
        <AlertTriangle className="w-3 h-3" />
        {conflicts.length}
      </div>
    );
  }

  // Banner variant - full-width alert at top
  if (variant === 'banner') {
    const totalConflicts = conflicts.length;
    const colors = getSeverityColor(conflicts[0].severity);

    return (
      <div className={`${colors.bg} ${colors.border} border-l-4 p-4 mb-4 rounded-r-lg`}>
        <div className="flex items-start gap-3">
          <AlertTriangle className={`w-5 h-5 mt-0.5 ${colors.icon}`} />
          <div className="flex-1">
            <h3 className={`font-semibold ${colors.text} mb-1`}>
              {totalConflicts} Scheduling {totalConflicts === 1 ? 'Conflict' : 'Conflicts'} Detected
            </h3>
            <p className={`text-sm ${colors.text} opacity-90`}>
              You have overlapping events in your calendar. Review and resolve conflicts below.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Inline variant - detailed conflict list with suggestions
  return (
    <div className="space-y-3">
      {conflicts.map((conflict) => {
        const event = events.find((e) => e.id === conflict.eventId);
        const conflictingEvents = events.filter((e) =>
          conflict.conflictingEventIds.includes(e.id)
        );
        const colors = getSeverityColor(conflict.severity);

        if (!event) return null;

        return (
          <div
            key={conflict.eventId}
            className={`${colors.bg} ${colors.border} border rounded-lg p-4`}
          >
            {/* Header */}
            <div className="flex items-start gap-3 mb-3">
              <AlertTriangle className={`w-5 h-5 mt-0.5 ${colors.icon}`} />
              <div className="flex-1">
                <h4 className={`font-semibold ${colors.text} mb-1`}>
                  {conflict.severity === 'high' && 'Critical Conflict'}
                  {conflict.severity === 'medium' && 'Scheduling Conflict'}
                  {conflict.severity === 'low' && 'Potential Overlap'}
                </h4>
                <div className="text-sm space-y-1">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    <span className={colors.text}>{event.title}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    <span className={colors.text}>
                      {dayjs(event.startsAt).format('h:mm A')} - {dayjs(event.endsAt).format('h:mm A')}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Conflicting Events */}
            <div className={`${colors.text} text-sm mb-3 pl-8`}>
              <p className="font-medium mb-1">Conflicts with:</p>
              <ul className="space-y-1">
                {conflictingEvents.map((ce) => (
                  <li key={ce.id} className="flex items-center gap-2">
                    <XCircle className="w-3 h-3" />
                    <span>
                      {ce.title} ({dayjs(ce.startsAt).format('h:mm A')} - {dayjs(ce.endsAt).format('h:mm A')})
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Suggestions */}
            {conflict.suggestions.length > 0 && (
              <div className="pl-8">
                <p className={`text-sm font-medium ${colors.text} mb-2`}>Suggested alternatives:</p>
                <div className="space-y-2">
                  {conflict.suggestions.map((suggestion, index) => (
                    <button
                      key={index}
                      onClick={() => onResolve?.(conflict.eventId, suggestion)}
                      className={`w-full text-left text-sm px-3 py-2 rounded-md border ${colors.border} hover:bg-white hover:shadow-sm transition-all duration-200`}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/**
 * ConflictBadge - Compact badge for showing on event cards
 */
export function ConflictBadge({ severity }: { severity: 'high' | 'medium' | 'low' }) {
  const colors = {
    high: 'bg-red-500',
    medium: 'bg-orange-500',
    low: 'bg-yellow-500',
  };

  return (
    <div className={`absolute top-1 right-1 ${colors[severity]} text-white rounded-full p-1 shadow-md`}>
      <AlertTriangle className="w-3 h-3" />
    </div>
  );
}

/**
 * ConflictSummary - Summary card showing total conflicts
 */
export function ConflictSummary({ totalConflicts }: { totalConflicts: number }) {
  if (totalConflicts === 0) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-2">
        <div className="bg-green-500 rounded-full p-1">
          <Calendar className="w-4 h-4 text-white" />
        </div>
        <span className="text-sm text-green-800 font-medium">No scheduling conflicts</span>
      </div>
    );
  }

  return (
    <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2">
      <div className="bg-red-500 rounded-full p-1">
        <AlertTriangle className="w-4 h-4 text-white" />
      </div>
      <span className="text-sm text-red-800 font-medium">
        {totalConflicts} {totalConflicts === 1 ? 'conflict' : 'conflicts'} detected
      </span>
    </div>
  );
}
