// Template Events Loader Hook
// Subscribes to Firestore `calendarTemplates` collection and generates
// CalendarEventType[] for each active template so they appear in calendar views.
// Each template is treated as its own "calendar" with a toggleable ID.

import { useState, useEffect, useRef, useMemo } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '@/integrations/firebase/config';
import { useAuth } from '@/contexts/AuthContext.unified';
import { CalendarTemplate, CalendarTemplateEvent } from '@/types/calendar';
import { CalendarEventType } from '@/lib/stores/types';
import dayjs from 'dayjs';
import { logger } from '@/lib/logger';

/** Stable ID prefix for template-generated calendar IDs */
export const TEMPLATE_CALENDAR_PREFIX = 'template_';

/** Get the "calendar ID" for a given template (used for visibility toggling). */
export function templateCalendarId(templateId: string): string {
  return `${TEMPLATE_CALENDAR_PREFIX}${templateId}`;
}

/**
 * Convert a CalendarTemplate into CalendarEventType[] for the current week.
 * Events are generated for Sunday–Saturday relative to today.
 */
function templateToWeekEvents(template: CalendarTemplate): CalendarEventType[] {
  const today = dayjs();
  const startOfWeek = today.startOf('week');
  const calId = templateCalendarId(template.id);

  return template.events.map((tmplEvt, idx) => {
    const eventDay = startOfWeek.add(tmplEvt.dayOfWeek, 'day');
    const [sh, sm] = (tmplEvt.startTime || '09:00').split(':').map(Number);
    const [eh, em] = (tmplEvt.endTime || '10:00').split(':').map(Number);

    const startsAt = eventDay.hour(sh).minute(sm).second(0).toISOString();
    const endsAt = eventDay.hour(eh).minute(em).second(0).toISOString();

    return {
      id: `tmpl_${template.id}_${idx}`,
      title: tmplEvt.title,
      description: `Template: ${template.name}`,
      startsAt,
      endsAt,
      date: eventDay.format('YYYY-MM-DD'),
      timeStart: tmplEvt.startTime,
      timeEnd: tmplEvt.endTime,
      color: tmplEvt.color || '#8B5CF6',
      isAllDay: tmplEvt.isAllDay || false,
      location: tmplEvt.location || undefined,
      calendarId: calId,
      source: 'malleabite' as const,
      isLocked: true, // Template events are read-only in the calendar
      // Show recurrence indicator on preview events
      isRecurring: tmplEvt.isRecurring !== false,
      // Include recurrenceRule so generateRecurringInstances can expand
      // these preview events to future/past weeks, not just the current one.
      recurrenceRule: tmplEvt.isRecurring !== false
        ? (tmplEvt.recurrenceRule || {
            frequency: 'weekly' as const,
            interval: 1,
            daysOfWeek: [tmplEvt.dayOfWeek],
          })
        : undefined,
    };
  });
}

/**
 * Hook that subscribes to the user's calendarTemplates in Firestore.
 * Returns:
 *  - `templates`: raw CalendarTemplate[] (for sidebar display)
 *  - `templateEvents`: CalendarEventType[] from all **active** templates
 *  - `loading`
 */
export function useTemplateEventsLoader(): {
  templates: CalendarTemplate[];
  templateEvents: CalendarEventType[];
  loading: boolean;
} {
  const [templates, setTemplates] = useState<CalendarTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const unsubscribeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!user?.uid) {
      setTemplates([]);
      setLoading(false);
      return;
    }

    if (unsubscribeRef.current) {
      unsubscribeRef.current();
    }

    const templatesRef = collection(db, `users/${user.uid}/calendarTemplates`);

    const unsubscribe = onSnapshot(
      templatesRef,
      (snapshot) => {
        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        } as CalendarTemplate));
        setTemplates(data);
        setLoading(false);
        logger.info('TemplateEventsLoader', `Loaded ${data.length} templates`);
      },
      (error) => {
        logger.error('TemplateEventsLoader', 'Failed to load templates', { error });
        setLoading(false);
      }
    );

    unsubscribeRef.current = unsubscribe;

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [user?.uid]);

  // Generate events only for active templates
  const templateEvents = useMemo(() => {
    return templates
      .filter((t) => t.isActive)
      .flatMap(templateToWeekEvents);
  }, [templates]);

  return { templates, templateEvents, loading };
}
