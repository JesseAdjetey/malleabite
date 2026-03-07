// Shared AI action handler hook for Mally AI components
import { useCallback } from "react";
import { toast } from "sonner";
import { useCalendarEvents } from "@/hooks/use-calendar-events";
import { useTodoLists } from "@/hooks/use-todo-lists";
import { useEisenhower } from "@/hooks/use-eisenhower";
import { useAlarms } from "@/hooks/use-alarms";
import { useReminders } from "@/hooks/use-reminders";
import { useTemplates } from "@/hooks/use-templates";
import { useInvites } from "@/hooks/use-invites";
import { useSidebarPages } from "@/hooks/use-sidebar-pages";
import { useCalendarFilterStore } from "@/lib/stores/calendar-filter-store";
import { usePomodoroStore } from "@/lib/stores/pomodoro-store";
import { useViewStore } from "@/lib/stores/view-store";
import { useDateStore } from "@/lib/stores/date-store";
import { logger } from "@/lib/logger";
import { SidebarPage } from "@/lib/stores/types";
import { useGoogleCalendar } from "@/hooks/use-google-calendar";
import { useUserMemory } from "@/hooks/use-user-memory";
import { formatAIEvent } from "@/lib/ai/format-ai-event";
import dayjs from "dayjs";

// ── New imports for expanded AI capabilities ─────────────────────────────────
import { useBulkSelection } from "@/hooks/use-bulk-selection";
import { useUndoRedo } from "@/hooks/use-undo-redo";
import { useThemeStore } from "@/lib/stores/theme-store";
import { useSettingsStore } from "@/lib/stores/settings-store";
import { useCalendarGroups } from "@/hooks/use-calendar-groups";
import { useGoals } from "@/hooks/use-goals";
import { useAppointmentScheduling } from "@/hooks/use-appointment-scheduling";
import { useFindTime } from "@/hooks/use-find-time";
import { useCalendarSnapshots } from "@/hooks/use-calendar-snapshots";
import { useEventSearch } from "@/hooks/use-event-search";
import { useWorkingHours } from "@/hooks/use-working-hours";
import { useRecurringEvents } from "@/hooks/use-recurring-events";
import { useAnalyticsData } from "@/hooks/use-analytics-data";
import { exportToICalendar, downloadICalendar } from "@/lib/utils/calendar-import-export";
import { usePrintCalendar } from "@/hooks/use-print-calendar";
import { useVideoConferencing } from "@/hooks/use-video-conferencing";
import { useEmailNotifications } from "@/hooks/use-email-notifications";
import { useAuth } from "@/contexts/AuthContext.unified";
import { useTemplateEventsLoader } from "@/hooks/use-template-events-loader";
import * as calendarService from "@/lib/services/calendarService";
import { CalendarTemplate, CalendarTemplateEvent } from "@/types/calendar";

export function useMallyActions() {
  // Calendar
  const { addEvent, removeEvent, updateEvent, events, archiveAllEvents, restoreFolder } = useCalendarEvents();
  const { syncEnabled, pushEventToGoogle } = useGoogleCalendar();

  // AI Memory
  const { memory: userMemory } = useUserMemory();

  // Todos
  const {
    createList, deleteList, lists, activeListId, setActiveListId, todos, addTodo, toggleTodo, deleteTodo, moveTodo
  } = useTodoLists();

  // Sidebar pages & modules
  const {
    pages,
    activePage,
    activePageId,
    setActivePageId,
    addModule,
    removeModule,
    toggleModuleMinimized,
    createPage,
    deletePage,
    findModuleById,
    removeModuleById,
    updateModuleById,
    toggleModuleMinimizedById,
  } = useSidebarPages();

  // Eisenhower
  const { items: eisenhowerItems, addItem: addEisenhowerItem, updateQuadrant, removeItem: removeEisenhowerItem } = useEisenhower();

  // Alarms & Reminders
  const { alarms, addAlarm, updateAlarm, deleteAlarm, toggleAlarm, linkToEvent, linkToTodo } = useAlarms();
  const { reminders, addReminder, updateReminder, deleteReminder, toggleReminderActive } = useReminders();

  // Pomodoro
  const {
    startTimer, pauseTimer, resetTimer,
    setFocusTime, setBreakTime, setFocusTarget,
    getInstance: getPomodoroInstance,
  } = usePomodoroStore();

  // Templates & Invites
  const { templates, applyTemplate, useTemplate, createTemplate, deleteTemplate } = useTemplates();
  const { sentInvites, receivedInvites, sendInvite, respondToInvite, deleteInvite } = useInvites();

  // View & Date
  const { setView } = useViewStore();
  const { setDate } = useDateStore();

  // Calendar filter
  const calendarAccounts = useCalendarFilterStore(state => state.accounts);
  const toggleVisibility = useCalendarFilterStore(state => state.toggleVisibility);
  const setAllVisible = useCalendarFilterStore(state => state.setAllVisible);

  // ── New capabilities ───────────────────────────────────────────────────────

  // Bulk operations
  const {
    bulkDelete, bulkUpdateColor, bulkReschedule, bulkDuplicate,
    enableBulkMode, disableBulkMode, toggleSelection, selectAll, deselectAll,
    getSelectedEvents, selectedCount, isBulkMode,
  } = useBulkSelection();

  // Undo / Redo
  const { performUndo, performRedo, canUndo, canRedo } = useUndoRedo();

  // Theme & Settings
  const { setTheme } = useThemeStore();
  const { setBackgroundColor } = useSettingsStore();

  // Calendar groups & calendars
  const {
    groups: calendarGroups,
    createGroup: createCalendarGroup,
    updateGroup: updateCalendarGroup,
    deleteGroup: deleteCalendarGroup,
    addCalendar, updateCalendar, deleteCalendar, moveCalendar,
    getActiveCalendars,
  } = useCalendarGroups();

  // Goals
  const {
    goals, goalsWithProgress,
    createGoal, updateGoal, deleteGoal,
    scheduleGoalSessions, completeSession, skipSession,
    pauseGoal, resumeGoal,
  } = useGoals();

  // Appointment scheduling / Booking
  const {
    bookingPages, bookings,
    createBookingPage, updateBookingPage, deleteBookingPage, togglePageActive,
    getAvailableSlots, createBooking, cancelBooking, getBookingUrl, copyBookingUrl,
  } = useAppointmentScheduling();

  // Find time
  const { findAvailableTimes, suggestNextAvailable } = useFindTime([]);

  // Snapshots
  const {
    snapshots,
    createSnapshot, restoreSnapshot, deleteSnapshot: deleteCalendarSnapshot,
    clearCalendar, saveAndStartFresh,
  } = useCalendarSnapshots();

  // Event search
  const { search: searchEvents, searchResults } = useEventSearch(events);

  // Working hours
  const { workingHours, saveWorkingHours, isWithinWorkingHours } = useWorkingHours();

  // Recurring events
  const { editRecurringEvent, deleteRecurringEvent } = useRecurringEvents();

  // Analytics
  const { metrics: analyticsMetrics, timeDistribution } = useAnalyticsData();

  // Print / export
  const { printCalendar, downloadPDF } = usePrintCalendar();

  // Video conferencing
  const { createMeeting, addMeetingToEvent } = useVideoConferencing();

  // Email notifications
  const { updatePreferences: updateNotificationPrefs, scheduleEventReminders } = useEmailNotifications();

  // Auth (needed for CalendarTemplate Firestore paths)
  const { user } = useAuth();

  // Calendar Templates (weekly patterns) — from Firestore subscription
  const { templates: calendarTemplates, loading: calendarTemplatesLoading } = useTemplateEventsLoader();

  // ─── Private helpers ───────────────────────────────────────────────────────

  /**
   * Parse a time value from the AI, which may be:
   *   - A full ISO string: "2026-02-14T09:00:00Z"
   *   - A date+time without Z: "2026-02-14T09:00:00"
   *   - Just HH:MM: "09:00"
   *   - HH:MM AM/PM: "9:00 AM"
   * Returns a Date set to today (or tomorrow if already past) for bare times.
   */
  const parseTimeString = (raw: string): Date | null => {
    if (!raw) return null;
    // Full ISO or parseable datetime → try directly first
    const direct = new Date(raw);
    if (!isNaN(direct.getTime())) return direct;

    // Try HH:MM or H:MM (24h or 12h with AM/PM)
    const match = raw.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i);
    if (!match) return null;
    let hours = parseInt(match[1]);
    const minutes = parseInt(match[2]);
    const ampm = match[4]?.toUpperCase();
    if (ampm === 'PM' && hours < 12) hours += 12;
    if (ampm === 'AM' && hours === 12) hours = 0;

    const d = new Date();
    d.setHours(hours, minutes, 0, 0);
    // If the time has already passed today, schedule for tomorrow
    if (d < new Date()) d.setDate(d.getDate() + 1);
    return d;
  };

  /** Resolve a page reference by name or ID, falling back to the active page. */
  const resolvePageRef = useCallback((data: { pageName?: string; pageId?: string }) => {
    if (data.pageId) {
      const page = pages.find(p => p.id === data.pageId) ?? null;
      return { pageId: data.pageId, page };
    }
    if (data.pageName) {
      const page = pages.find(p =>
        p.title.toLowerCase().trim() === (data.pageName as string).toLowerCase().trim()
      ) ?? null;
      return { pageId: page?.id ?? null, page };
    }
    return { pageId: activePageId, page: activePage ?? null };
  }, [pages, activePage, activePageId]);

  /** Find a module's index in a page by ID, type, and/or title. Prefers moduleId. */
  const resolveModuleRef = useCallback((page: SidebarPage, data: { moduleId?: string; moduleType?: string; title?: string }) => {
    // Prefer direct ID lookup (stable across reorders)
    if (data.moduleId) {
      const idx = page.modules.findIndex(m => m.id === data.moduleId);
      if (idx !== -1) return { index: idx, module: page.modules[idx] };
    }
    // Fallback: match by type + title
    const idx = page.modules.findIndex(m => {
      const typeMatch = !data.moduleType || m.type === data.moduleType;
      const titleMatch = !data.title || m.title.toLowerCase().trim() === (data.title as string).toLowerCase().trim();
      return typeMatch && titleMatch;
    });
    return idx !== -1 ? { index: idx, module: page.modules[idx] } : null;
  }, []);

  /** @deprecated Use resolveModuleRef instead — kept for backward compat */
  const resolveModuleIndex = useCallback((page: SidebarPage, data: { moduleType?: string; title?: string }) => {
    return page.modules.findIndex(m => {
      const typeMatch = !data.moduleType || m.type === data.moduleType;
      const titleMatch = !data.title || m.title.toLowerCase().trim() === (data.title as string).toLowerCase().trim();
      return typeMatch && titleMatch;
    });
  }, []);

  /** Auto-add a module to the active page if it isn't already there. */
  const ensureModuleVisible = useCallback(async (moduleType: string, moduleTitle: string, listId?: string) => {
    if (!activePageId || !activePage) return;
    const alreadyExists = activePage.modules.some(m =>
      m.type === moduleType && (moduleType === 'todo' ? m.listId === listId : true)
    );
    if (!alreadyExists) {
      await addModule(activePageId, { type: moduleType as any, title: moduleTitle, minimized: false, listId });
    }
  }, [activePageId, activePage, addModule]);

  // ─── Action executor ───────────────────────────────────────────────────────

  const executeAction = useCallback(async (action: { type: string; data: any }): Promise<boolean> => {
    try {
      console.log('[MallyActions] Executing:', action.type, action.data);
      const { type, data } = action;

      switch (type) {

        // ── Events ──────────────────────────────────────────────────────────

        case 'create_event': {
          const titleLower = (data.title ?? '').toLowerCase();
          // Intercept pomodoro-like events scheduled for ~now → start timer instead
          if (
            titleLower.includes('pomodoro') ||
            titleLower.includes('focus session') ||
            titleLower.includes('work session')
          ) {
            const startTime = data.start ? new Date(data.start) : new Date();
            if (Math.abs(startTime.getTime() - Date.now()) < 5 * 60 * 1000 && !data.isRecurring) {
              toast.info("Starting Focus Timer instead of scheduling event...");
              await ensureModuleVisible('pomodoro', 'Focus Timer');
              startTimer();
              return true;
            }
          }

          const rawEventData = {
            title: data.title,
            startsAt: data.start || data.startsAt,
            endsAt: data.end || data.endsAt,
            description: data.description || 'Created by Mally AI',
            color: data.color || '#8b5cf6',
            isRecurring: data.isRecurring || false,
            recurrenceRule: data.recurrenceRule,
            calendarId: data.calendarId,
          };

          const formattedEvent = formatAIEvent(rawEventData);
          const result = await addEvent(formattedEvent as any);
          if (!result?.success) return false;

          // Auto-sync to Google Calendar if enabled
          if (syncEnabled && (formattedEvent as any).source !== 'google') {
            try {
              const googleId = await pushEventToGoogle({ ...formattedEvent, id: result.data?.id || formattedEvent.id });
              if (googleId && result.data?.id) {
                await updateEvent({ ...formattedEvent, id: result.data.id, googleEventId: googleId } as any);
              }
            } catch (err) {
              logger.warn('MallyActions', 'Google Calendar sync failed', { error: err });
            }
          }

          toast.success(`Event "${data.title}" created`);
          if (rawEventData.startsAt) setDate(dayjs(rawEventData.startsAt));
          return true;
        }

        case 'update_event': {
          if (!data.eventId) { toast.error('No event ID provided'); return false; }
          const existing = events.find(e => e.id === data.eventId);
          if (!existing) { toast.error('Event not found'); return false; }
          const updated = {
            ...existing,
            title: data.title || existing.title,
            startsAt: data.start ? new Date(data.start).toISOString() : existing.startsAt,
            endsAt: data.end ? new Date(data.end).toISOString() : existing.endsAt,
            description: data.description || existing.description,
          };
          const result = await updateEvent(updated);
          if (result?.success) { toast.success('Event updated'); return true; }
          return false;
        }

        case 'delete_event': {
          if (!data.eventId) { toast.error('No event ID provided'); return false; }
          const result = await removeEvent(data.eventId);
          if (result?.success) { toast.success('Event deleted'); return true; }
          return false;
        }

        case 'archive_calendar':
        case 'archive_folder': {
          const folder = data.folderName || 'Archive';
          const result = await archiveAllEvents(folder);
          if (result?.success) { toast.success(`Calendar archived to "${folder}"`); return true; }
          return false;
        }

        case 'restore_folder': {
          if (data.folderName) { await restoreFolder(data.folderName); return true; }
          return false;
        }

        // ── Todos ────────────────────────────────────────────────────────────

        case 'create_todo': {
          let targetListId = data.listId;
          if (!targetListId && data.listName) {
            const found = lists.find(l =>
              l.name.toLowerCase().trim() === (data.listName as string).toLowerCase().trim()
            );
            if (found) targetListId = found.id;
          }
          if (!targetListId && activeListId) targetListId = activeListId;
          if (!targetListId) targetListId = lists.find(l => l.isDefault)?.id;
          if (!targetListId && lists.length > 0) targetListId = lists[0].id;
          if (!targetListId) {
            const r = await createList("My Tasks");
            if (r.success) targetListId = r.listId;
          }
          if (!targetListId) { toast.error('Could not find or create a todo list'); return false; }

          await ensureModuleVisible('todo', lists.find(l => l.id === targetListId)?.name || 'Tasks', targetListId);
          const result = await addTodo(data.text || data.title, targetListId);
          if (result?.success) { toast.success(`Todo "${data.text || data.title}" added`); return true; }
          return false;
        }

        case 'create_list':
        case 'create_todo_list': {
          const result = await createList(data.name, data.color);
          if (result.success && result.listId && activePageId) {
            await addModule(activePageId, {
              type: 'todo', title: data.name, listId: result.listId, minimized: false
            });
          }
          toast.success(`Todo list "${data.name}" created`);
          return result.success;
        }

        case 'complete_todo': {
          if (!data.todoId) { toast.error('No todo ID provided'); return false; }
          await toggleTodo(data.todoId);
          toast.success('Todo completed');
          return true;
        }

        case 'delete_todo': {
          if (!data.todoId) { toast.error('No todo ID provided'); return false; }
          await deleteTodo(data.todoId);
          toast.success('Todo deleted');
          return true;
        }

        case 'move_todo': {
          if (!data.todoId) { toast.error('No todo ID provided'); return false; }
          let targetListId = data.listId;
          if (!targetListId && data.listName) {
            const found = lists.find(l =>
              l.name.toLowerCase().trim() === (data.listName as string).toLowerCase().trim()
            );
            targetListId = found?.id;
          }
          if (!targetListId) { toast.error(`List "${data.listName}" not found`); return false; }
          await moveTodo(data.todoId, targetListId);
          toast.success('Todo moved');
          return true;
        }

        case 'delete_todo_list': {
          let targetListId = data.listId;
          if (!targetListId && data.listName) {
            const found = lists.find(l =>
              l.name.toLowerCase().trim() === (data.listName as string).toLowerCase().trim()
            );
            targetListId = found?.id;
          }
          if (!targetListId) { toast.error(`List "${data.listName}" not found`); return false; }
          const result = await deleteList(targetListId);
          if (result?.success) { toast.success('Todo list deleted'); return true; }
          return false;
        }

        // ── Eisenhower ───────────────────────────────────────────────────────

        case 'create_eisenhower': {
          if (!data.text || !data.quadrant) { toast.error('Missing text or quadrant'); return false; }
          await ensureModuleVisible('eisenhower', 'Priorities');
          const result = await addEisenhowerItem(data.text, data.quadrant);
          if (result?.success) { toast.success('Priority item added'); return true; }
          return false;
        }

        case 'update_eisenhower': {
          if (!data.itemId || !data.quadrant) return false;
          await updateQuadrant(data.itemId, data.quadrant);
          toast.success('Priority item moved');
          return true;
        }

        case 'delete_eisenhower': {
          if (!data.itemId) return false;
          await removeEisenhowerItem(data.itemId);
          toast.success('Priority item deleted');
          return true;
        }

        // ── Alarms ───────────────────────────────────────────────────────────

        case 'create_alarm': {
          if (!data.title || !data.time) { toast.error('Missing alarm title or time'); return false; }
          await ensureModuleVisible('alarms', 'Alarms');
          // Parse the time — AI may return "09:00", "9:00 AM", or a full ISO string
          const alarmDate = parseTimeString(data.time);
          if (!alarmDate || isNaN(alarmDate.getTime())) {
            toast.error('Could not parse alarm time');
            return false;
          }
          const result = await addAlarm(data.title, alarmDate, {
            linkedEventId: data.linkedEventId,
            linkedTodoId: data.linkedTodoId,
            repeatDays: data.repeatDays || [],
          });
          if (result?.success) { toast.success(`Alarm "${data.title}" set`); return true; }
          return false;
        }

        case 'update_alarm': {
          if (!data.alarmId) return false;
          const updates: any = {};
          if (data.title) updates.title = data.title;
          if (data.time) updates.time = data.time;
          const result = await updateAlarm(data.alarmId, updates);
          if (result?.success) { toast.success('Alarm updated'); return true; }
          return false;
        }

        case 'delete_alarm': {
          if (!data.alarmId) return false;
          const result = await deleteAlarm(data.alarmId);
          if (result?.success) { toast.success('Alarm deleted'); return true; }
          return false;
        }

        case 'link_alarm': {
          if (!data.alarmId) return false;
          if (data.linkedEventId) {
            const result = await linkToEvent(data.alarmId, data.linkedEventId);
            if (result?.success) { toast.success('Alarm linked to event'); return true; }
          } else if (data.linkedTodoId) {
            const result = await linkToTodo(data.alarmId, data.linkedTodoId);
            if (result?.success) { toast.success('Alarm linked to todo'); return true; }
          }
          return false;
        }

        case 'toggle_alarm': {
          if (!data.alarmId) return false;
          const result = await toggleAlarm(data.alarmId, data.enabled ?? true);
          if (result?.success) { toast.success(`Alarm ${data.enabled ? 'enabled' : 'disabled'}`); return true; }
          return false;
        }

        // ── Reminders ────────────────────────────────────────────────────────

        case 'create_reminder': {
          if (!data.title || !data.reminderTime) { toast.error('Missing reminder title or time'); return false; }
          await ensureModuleVisible('alarms', 'Reminders');
          // Parse the reminder time — AI may return "10:00", "10:00 AM", or a full ISO string
          const reminderDate = parseTimeString(data.reminderTime);
          if (!reminderDate || isNaN(reminderDate.getTime())) {
            toast.error('Could not parse reminder time');
            return false;
          }
          const result = await addReminder({
            title: data.title,
            description: data.description,
            reminderTime: reminderDate.toISOString(),
            eventId: data.eventId,
            soundId: data.soundId || 'default',
          });
          if (result?.success) { toast.success(`Reminder "${data.title}" set`); return true; }
          return false;
        }

        case 'update_reminder': {
          if (!data.reminderId) return false;
          const updates: any = {};
          if (data.title) updates.title = data.title;
          if (data.description) updates.description = data.description;
          if (data.reminderTime) updates.reminderTime = data.reminderTime;
          const result = await updateReminder(data.reminderId, updates);
          if (result?.success) { toast.success('Reminder updated'); return true; }
          return false;
        }

        case 'delete_reminder': {
          if (!data.reminderId) return false;
          const result = await deleteReminder(data.reminderId);
          if (result?.success) { toast.success('Reminder deleted'); return true; }
          return false;
        }

        case 'toggle_reminder': {
          if (!data.reminderId) return false;
          const result = await toggleReminderActive(data.reminderId, data.isActive ?? true);
          if (result?.success) { toast.success(`Reminder ${data.isActive ? 'enabled' : 'disabled'}`); return true; }
          return false;
        }

        // ── Pomodoro ─────────────────────────────────────────────────────────

        case 'start_pomodoro':
        case 'resume_pomodoro': {
          await ensureModuleVisible('pomodoro', 'Focus Timer');
          startTimer();
          toast.success(type === 'resume_pomodoro' ? 'Timer resumed' : 'Focus timer started');
          return true;
        }

        case 'pause_pomodoro':
        case 'stop_pomodoro': {
          pauseTimer();
          toast.success('Timer paused');
          return true;
        }

        case 'reset_pomodoro': {
          resetTimer();
          toast.success('Timer reset');
          return true;
        }

        case 'set_pomodoro_timer': {
          await ensureModuleVisible('pomodoro', 'Focus Timer');
          if (data.focusTime) setFocusTime(data.focusTime);
          if (data.breakTime) setBreakTime(data.breakTime);
          toast.success('Timer settings updated');
          return true;
        }

        // ── View / navigation ────────────────────────────────────────────────

        case 'change_view': {
          const viewName = data.view.charAt(0).toUpperCase() + data.view.slice(1).toLowerCase();
          setView(viewName);
          toast.success(`Switched to ${viewName} view`);
          return true;
        }

        // ── Templates (legacy simple EventTemplate) ─────────────────────────

        case 'create_from_template': {
          if (!data.templateName) return false;
          const template = templates.find(t =>
            t.title.toLowerCase().includes((data.templateName as string).toLowerCase())
          );
          if (!template) { toast.error(`Template "${data.templateName}" not found`); return false; }
          const start = data.start ? new Date(data.start) : new Date();
          const eventData = applyTemplate(template, start);
          await addEvent(eventData as any);
          if (eventData.start) setDate(dayjs(eventData.start));
          await useTemplate(template.id);
          toast.success(`Created event from "${template.title}" template`);
          return true;
        }

        case 'create_template': {
          if (!data.title) { toast.error('Template title is required'); return false; }
          // If user has auth, redirect to CalendarTemplate system instead of legacy EventTemplate
          if (user?.uid && data.events) {
            return executeAction({ type: 'create_calendar_template', data: { name: data.title, ...data } });
          }
          await ensureModuleVisible('templates', 'Templates');
          const result = await createTemplate({
            title: data.title,
            duration: data.duration || 60,
            category: data.category,
            color: data.color,
            location: data.location,
            notes: data.notes,
            isAllDay: data.isAllDay || false,
          });
          if (result) { toast.success(`Template "${data.title}" created`); return true; }
          return false;
        }

        case 'delete_template': {
          if (!data.templateName && !data.templateId) { toast.error('Template name is required'); return false; }
          let templateId = data.templateId;
          if (!templateId && data.templateName) {
            const found = templates.find(t =>
              t.title.toLowerCase().includes((data.templateName as string).toLowerCase())
            );
            templateId = found?.id;
          }
          if (!templateId) { toast.error(`Template "${data.templateName}" not found`); return false; }
          const result = await deleteTemplate(templateId);
          if (result?.success) { toast.success('Template deleted'); return true; }
          return false;
        }

        // ── Calendar Templates (weekly patterns) ─────────────────────────────

        case 'create_calendar_template': {
          if (!user?.uid) { toast.error('Not authenticated'); return false; }
          if (!data.name) { toast.error('Template name is required'); return false; }

          // Resolve target group by name
          let targetGroupId: string | undefined;
          if (data.groupName) {
            const group = calendarGroups.find(g =>
              (g as any).name?.toLowerCase() === (data.groupName as string).toLowerCase()
            );
            targetGroupId = group?.id;
          }

          // Build events array
          const templateEvents: CalendarTemplateEvent[] = (data.events || []).map((e: any) => ({
            title: e.title || 'Untitled',
            description: e.description || undefined,
            dayOfWeek: e.dayOfWeek ?? 1,
            startTime: e.startTime || '09:00',
            endTime: e.endTime || '10:00',
            color: e.color || '#8B5CF6',
            isAllDay: e.isAllDay || false,
            location: e.location || undefined,
            isRecurring: true,
            recurrenceRule: {
              frequency: 'weekly' as const,
              interval: 1,
              daysOfWeek: [e.dayOfWeek ?? 1],
            },
          }));

          try {
            await calendarService.createCalendarTemplate(user.uid, {
              name: data.name,
              description: data.description || undefined,
              events: templateEvents,
              targetGroupId,
              isActive: false,
            });
            toast.success(`Template "${data.name}" created with ${templateEvents.length} event${templateEvents.length !== 1 ? 's' : ''}`);
            return true;
          } catch (err) {
            console.error('Failed to create calendar template:', err);
            toast.error('Failed to create template');
            return false;
          }
        }

        case 'add_template_event': {
          if (!user?.uid) { toast.error('Not authenticated'); return false; }
          if (!data.templateName) { toast.error('Template name is required'); return false; }

          const tmpl = calendarTemplates.find(t =>
            t.name.toLowerCase().includes((data.templateName as string).toLowerCase())
          );
          if (!tmpl) { toast.error(`Template "${data.templateName}" not found`); return false; }

          const newEvent: CalendarTemplateEvent = {
            title: data.title || 'Untitled',
            description: data.description || undefined,
            dayOfWeek: data.dayOfWeek ?? 1,
            startTime: data.startTime || '09:00',
            endTime: data.endTime || '10:00',
            color: data.color || '#8B5CF6',
            isAllDay: data.isAllDay || false,
            location: data.location || undefined,
            isRecurring: true,
            recurrenceRule: {
              frequency: 'weekly' as const,
              interval: 1,
              daysOfWeek: [data.dayOfWeek ?? 1],
            },
          };

          try {
            const updatedEvents = [...tmpl.events, newEvent];
            await calendarService.updateCalendarTemplate(user.uid, tmpl.id, { events: updatedEvents });
            toast.success(`Added "${newEvent.title}" to template "${tmpl.name}"`);
            return true;
          } catch (err) {
            console.error('Failed to add template event:', err);
            toast.error('Failed to add event to template');
            return false;
          }
        }

        case 'remove_template_event': {
          if (!user?.uid) { toast.error('Not authenticated'); return false; }
          if (!data.templateName || !data.eventTitle) { toast.error('Template name and event title required'); return false; }

          const rmTmpl = calendarTemplates.find(t =>
            t.name.toLowerCase().includes((data.templateName as string).toLowerCase())
          );
          if (!rmTmpl) { toast.error(`Template "${data.templateName}" not found`); return false; }

          const filteredEvents = rmTmpl.events.filter(e =>
            !e.title.toLowerCase().includes((data.eventTitle as string).toLowerCase())
          );
          if (filteredEvents.length === rmTmpl.events.length) {
            toast.error(`Event "${data.eventTitle}" not found in template`);
            return false;
          }

          try {
            await calendarService.updateCalendarTemplate(user.uid, rmTmpl.id, { events: filteredEvents });
            toast.success(`Removed event from template "${rmTmpl.name}"`);
            return true;
          } catch (err) {
            console.error('Failed to remove template event:', err);
            toast.error('Failed to remove event from template');
            return false;
          }
        }

        case 'apply_calendar_template': {
          if (!user?.uid) { toast.error('Not authenticated'); return false; }
          if (!data.templateName) { toast.error('Template name is required'); return false; }

          const applyTmpl = calendarTemplates.find(t =>
            t.name.toLowerCase().includes((data.templateName as string).toLowerCase())
          );
          if (!applyTmpl) { toast.error(`Template "${data.templateName}" not found`); return false; }
          if (applyTmpl.events.length === 0) { toast.error('Template has no events to apply'); return false; }

          // Resolve group — use override, then template's saved group, then first available
          let groupId = applyTmpl.targetGroupId;
          if (data.groupName) {
            const g = calendarGroups.find(grp =>
              (grp as any).name?.toLowerCase() === (data.groupName as string).toLowerCase()
            );
            if (g) groupId = g.id;
          }

          // Find a calendar in the group
          const cals = getActiveCalendars();
          const targetCal = cals.find(c => (c as any).groupId === groupId) || cals[0];
          const calendarId = targetCal?.id;

          const today = dayjs();
          const startOfWeek = today.startOf('week');
          let created = 0;

          for (const tmplEvent of applyTmpl.events) {
            const eventDay = startOfWeek.add(tmplEvent.dayOfWeek, 'day');
            if (eventDay.isBefore(today, 'day')) continue;

            const [sh, sm] = (tmplEvent.startTime || '09:00').split(':').map(Number);
            const [eh, em] = (tmplEvent.endTime || '10:00').split(':').map(Number);

            const startsAt = eventDay.hour(sh).minute(sm).second(0).toISOString();
            const endsAt = eventDay.hour(eh).minute(em).second(0).toISOString();

            const recurrenceRule = tmplEvent.recurrenceRule || {
              frequency: 'weekly' as const,
              interval: 1,
              daysOfWeek: [tmplEvent.dayOfWeek],
            };

            await addEvent({
              title: tmplEvent.title,
              description: tmplEvent.description || `From template: ${applyTmpl.name}`,
              startsAt,
              endsAt,
              color: tmplEvent.color || '#8B5CF6',
              date: eventDay.format('YYYY-MM-DD'),
              calendarId,
              isRecurring: true,
              recurrenceRule,
            } as any);
            created++;
          }

          if (created > 0) {
            toast.success(`Applied ${created} recurring event${created !== 1 ? 's' : ''} from "${applyTmpl.name}"`);
          } else {
            toast.info('No upcoming events to apply from this template');
          }
          return true;
        }

        case 'update_calendar_template': {
          if (!user?.uid) { toast.error('Not authenticated'); return false; }
          if (!data.templateName) { toast.error('Template name is required'); return false; }

          const updTmpl = calendarTemplates.find(t =>
            t.name.toLowerCase().includes((data.templateName as string).toLowerCase())
          );
          if (!updTmpl) { toast.error(`Template "${data.templateName}" not found`); return false; }

          const updates: Partial<CalendarTemplate> = {};
          if (data.name) updates.name = data.name;
          if (data.description !== undefined) updates.description = data.description;
          if (data.isActive !== undefined) updates.isActive = data.isActive;
          if (data.groupName) {
            const g = calendarGroups.find(grp =>
              (grp as any).name?.toLowerCase() === (data.groupName as string).toLowerCase()
            );
            if (g) updates.targetGroupId = g.id;
          }

          try {
            await calendarService.updateCalendarTemplate(user.uid, updTmpl.id, updates);
            toast.success(`Updated template "${updTmpl.name}"`);
            return true;
          } catch (err) {
            console.error('Failed to update calendar template:', err);
            toast.error('Failed to update template');
            return false;
          }
        }

        case 'delete_calendar_template': {
          if (!user?.uid) { toast.error('Not authenticated'); return false; }
          if (!data.templateName) { toast.error('Template name is required'); return false; }

          const delTmpl = calendarTemplates.find(t =>
            t.name.toLowerCase().includes((data.templateName as string).toLowerCase())
          );
          if (!delTmpl) { toast.error(`Template "${data.templateName}" not found`); return false; }

          try {
            await calendarService.deleteCalendarTemplate(user.uid, delTmpl.id);
            toast.success(`Deleted template "${delTmpl.name}"`);
            return true;
          } catch (err) {
            console.error('Failed to delete calendar template:', err);
            toast.error('Failed to delete template');
            return false;
          }
        }

        // ── Invites ──────────────────────────────────────────────────────────

        case 'send_invite': {
          if (!data.email || !data.eventId) {
            toast.error('Please specify which event to invite to');
            return false;
          }
          const event = events.find(e => e.id === data.eventId);
          if (!event) { toast.error('Event not found for invitation'); return false; }
          await sendInvite(data.email, event, data.message);
          return true;
        }

        case 'respond_invite': {
          if (!data.inviteId || !data.status) { toast.error('Invite ID and status required'); return false; }
          const result = await respondToInvite(data.inviteId, data.status);
          if (result?.success) { toast.success(`Invite ${data.status}`); return true; }
          return false;
        }

        case 'delete_invite': {
          if (!data.inviteId) { toast.error('Invite ID required'); return false; }
          const result = await deleteInvite(data.inviteId);
          if (result?.success) { toast.success('Invite deleted'); return true; }
          return false;
        }

        // ── Module control ───────────────────────────────────────────────────

        case 'add_module': {
          const { pageId: pid, page: pg } = resolvePageRef(data);
          if (!pid || !pg) {
            toast.error(data.pageName ? `Page "${data.pageName}" not found` : 'No active page');
            return false;
          }
          if (!data.moduleType) { toast.error('Module type is required'); return false; }

          const defaultTitles: Record<string, string> = {
            todo: 'Tasks', pomodoro: 'Focus Timer', alarms: 'Alarms',
            reminders: 'Reminders', eisenhower: 'Priorities', invites: 'Invites',
          };
          const result = await addModule(pid, {
            type: data.moduleType,
            title: data.title || defaultTitles[data.moduleType] || data.moduleType,
            minimized: false,
            listId: data.listId,
          });
          if (result?.success) {
            toast.success(`Added ${data.title || defaultTitles[data.moduleType] || data.moduleType} module`);
            return true;
          }
          return false;
        }

        case 'remove_module': {
          // Prefer direct moduleId lookup (works across pages, stable across reorders)
          if (data.moduleId) {
            const found = findModuleById(data.moduleId);
            if (!found) { toast.error('Module not found'); return false; }
            const result = await removeModuleById(data.moduleId);
            if (result?.success) { toast.success(`Removed ${found.module.title} module`); return true; }
            return false;
          }
          // Fallback: page + type/title search
          const { pageId: pid, page: pg } = resolvePageRef(data);
          if (!pid || !pg) { toast.error('Page not found'); return false; }
          const ref = resolveModuleRef(pg, data);
          if (!ref) {
            toast.error(`Module "${data.title || data.moduleType}" not found on this page`);
            return false;
          }
          const result = await removeModule(pid, ref.index);
          if (result?.success) { toast.success(`Removed ${ref.module.title} module`); return true; }
          return false;
        }

        case 'minimize_module': {
          // Prefer moduleId
          if (data.moduleId) {
            const found = findModuleById(data.moduleId);
            if (!found) { toast.error('Module not found'); return false; }
            if (found.module.minimized) { toast.info(`${found.module.title} is already minimized`); return true; }
            const result = await toggleModuleMinimizedById(data.moduleId);
            if (result?.success) { toast.success(`${found.module.title} minimized`); return true; }
            return false;
          }
          const { pageId: pid, page: pg } = resolvePageRef(data);
          if (!pid || !pg) { toast.error('Page not found'); return false; }
          const minRef = resolveModuleRef(pg, data);
          if (!minRef) { toast.error(`Module "${data.title || data.moduleType}" not found`); return false; }
          if (minRef.module.minimized) { toast.info(`${minRef.module.title} is already minimized`); return true; }
          const minResult = await toggleModuleMinimized(pid, minRef.index);
          if (minResult?.success) { toast.success(`${minRef.module.title} minimized`); return true; }
          return false;
        }

        case 'maximize_module': {
          // Prefer moduleId
          if (data.moduleId) {
            const found = findModuleById(data.moduleId);
            if (!found) { toast.error('Module not found'); return false; }
            if (!found.module.minimized) { toast.info(`${found.module.title} is already expanded`); return true; }
            const result = await toggleModuleMinimizedById(data.moduleId);
            if (result?.success) { toast.success(`${found.module.title} expanded`); return true; }
            return false;
          }
          const { pageId: pid2, page: pg2 } = resolvePageRef(data);
          if (!pid2 || !pg2) { toast.error('Page not found'); return false; }
          const maxRef = resolveModuleRef(pg2, data);
          if (!maxRef) { toast.error(`Module "${data.title || data.moduleType}" not found`); return false; }
          if (!maxRef.module.minimized) { toast.info(`${maxRef.module.title} is already expanded`); return true; }
          const maxResult = await toggleModuleMinimized(pid2, maxRef.index);
          if (maxResult?.success) { toast.success(`${maxRef.module.title} expanded`); return true; }
          return false;
        }

        // ── Page control ─────────────────────────────────────────────────────

        case 'create_page': {
          if (!data.title) { toast.error('Page title is required'); return false; }
          const result = await createPage(data.title, data.icon);
          if (result.success && result.pageId) {
            setActivePageId(result.pageId);
            return true;
          }
          return false;
        }

        case 'delete_page': {
          const { pageId: pid, page: pg } = resolvePageRef(data);
          if (!pid || !pg) {
            toast.error(data.title ? `Page "${data.title}" not found` : 'No page specified');
            return false;
          }
          if (pages.length <= 1) { toast.error('Cannot delete the last page'); return false; }
          const result = await deletePage(pid);
          return result.success;
        }

        case 'switch_page': {
          const { pageId: pid, page: pg } = resolvePageRef(data);
          if (!pid || !pg) {
            toast.error(data.title ? `Page "${data.title}" not found` : 'No page specified');
            return false;
          }
          setActivePageId(pid);
          toast.success(`Switched to "${pg.title}"`);
          return true;
        }

        // ── Todo list switching ──────────────────────────────────────────────

        case 'set_active_todo_list': {
          let resolvedListId = data.listId;
          if (!resolvedListId && data.listName) {
            const found = lists.find(l =>
              l.name.toLowerCase().trim() === (data.listName as string).toLowerCase().trim()
            );
            resolvedListId = found?.id;
          }
          if (!resolvedListId) {
            toast.error(`List "${data.listName || data.listId}" not found`);
            return false;
          }
          const list = lists.find(l => l.id === resolvedListId);
          setActiveListId(resolvedListId);
          toast.success(`Switched to "${list?.name || resolvedListId}" list`);
          return true;
        }

        // ── Pomodoro settings ────────────────────────────────────────────────

        case 'set_pomodoro_settings': {
          await ensureModuleVisible('pomodoro', 'Focus Timer');
          if (data.focusTime) setFocusTime(data.focusTime);
          if (data.breakTime) setBreakTime(data.breakTime);
          if (data.focusTarget) setFocusTarget(data.focusTarget);
          toast.success('Pomodoro settings updated');
          return true;
        }

        // ── Calendar filter ──────────────────────────────────────────────────

        case 'set_calendar_filter': {
          if (data.showAll) { setAllVisible(true); toast.success('All calendars shown'); return true; }
          if (data.hideAll) { setAllVisible(false); toast.success('All calendars hidden'); return true; }

          let resolvedId = data.calendarId;
          if (!resolvedId && data.calendarName) {
            const found = calendarAccounts.find(a =>
              a.name.toLowerCase().trim() === (data.calendarName as string).toLowerCase().trim()
            );
            resolvedId = found?.id;
          }
          if (!resolvedId) { toast.error(`Calendar "${data.calendarName || data.calendarId}" not found`); return false; }

          const account = calendarAccounts.find(a => a.id === resolvedId);
          if (account && data.visible !== undefined && account.visible !== data.visible) {
            toggleVisibility(resolvedId);
            toast.success(`${account.name} ${data.visible ? 'shown' : 'hidden'}`);
          }
          return true;
        }

        // ══════════════════════════════════════════════════════════════════════
        //  NEW EXPANDED AI CAPABILITIES
        // ══════════════════════════════════════════════════════════════════════

        // ── Bulk Operations ──────────────────────────────────────────────────

        case 'bulk_select_events': {
          if (!data.eventIds || !Array.isArray(data.eventIds)) { toast.error('No event IDs provided'); return false; }
          enableBulkMode();
          for (const id of data.eventIds) { toggleSelection(id); }
          toast.success(`Selected ${data.eventIds.length} events`);
          return true;
        }

        case 'bulk_select_all': {
          enableBulkMode();
          selectAll();
          toast.success('All events selected');
          return true;
        }

        case 'bulk_deselect_all': {
          deselectAll();
          disableBulkMode();
          toast.success('Selection cleared');
          return true;
        }

        case 'bulk_delete': {
          if (selectedCount === 0) { toast.error('No events selected for bulk delete'); return false; }
          await bulkDelete(data.recurringScope);
          disableBulkMode();
          toast.success('Bulk delete complete');
          return true;
        }

        case 'bulk_update_color': {
          if (selectedCount === 0) { toast.error('No events selected'); return false; }
          if (!data.color) { toast.error('No color specified'); return false; }
          await bulkUpdateColor(data.color);
          disableBulkMode();
          toast.success(`Updated color for ${selectedCount} events`);
          return true;
        }

        case 'bulk_reschedule': {
          if (selectedCount === 0) { toast.error('No events selected'); return false; }
          if (data.daysOffset === undefined) { toast.error('No days offset provided'); return false; }
          await bulkReschedule(data.daysOffset);
          disableBulkMode();
          toast.success(`Rescheduled ${selectedCount} events by ${data.daysOffset} days`);
          return true;
        }

        case 'bulk_duplicate': {
          if (selectedCount === 0) { toast.error('No events selected'); return false; }
          await bulkDuplicate();
          disableBulkMode();
          toast.success(`Duplicated ${selectedCount} events`);
          return true;
        }

        // ── Duplicate single event ───────────────────────────────────────────

        case 'duplicate_event': {
          if (!data.eventId) { toast.error('No event ID provided'); return false; }
          const srcEvent = events.find(e => e.id === data.eventId);
          if (!srcEvent) { toast.error('Event not found'); return false; }
          const dupEvent = {
            ...srcEvent,
            id: undefined,
            title: data.title || `${srcEvent.title} (copy)`,
            startsAt: data.start ? new Date(data.start).toISOString() : srcEvent.startsAt,
            endsAt: data.end ? new Date(data.end).toISOString() : srcEvent.endsAt,
          };
          delete (dupEvent as any).id;
          const dupResult = await addEvent(dupEvent as any);
          if (dupResult?.success) { toast.success(`Event duplicated`); return true; }
          return false;
        }

        // ── Undo / Redo ──────────────────────────────────────────────────────

        case 'undo': {
          if (!canUndo) { toast.info('Nothing to undo'); return false; }
          await performUndo();
          toast.success('Undone');
          return true;
        }

        case 'redo': {
          if (!canRedo) { toast.info('Nothing to redo'); return false; }
          await performRedo();
          toast.success('Redone');
          return true;
        }

        // ── Theme & Settings ─────────────────────────────────────────────────

        case 'set_theme': {
          const theme = data.theme?.toLowerCase();
          if (!['light', 'dark', 'system'].includes(theme)) { toast.error('Invalid theme. Use light, dark, or system'); return false; }
          setTheme(theme as 'light' | 'dark' | 'system');
          toast.success(`Theme set to ${theme}`);
          return true;
        }

        case 'set_background_color': {
          if (!data.color) { toast.error('No color specified'); return false; }
          setBackgroundColor(data.color);
          toast.success('Background color updated');
          return true;
        }

        case 'set_working_hours': {
          const whResult = await saveWorkingHours(data);
          if (whResult?.success) { toast.success('Working hours updated'); return true; }
          return false;
        }

        // ── Calendar & Group Management ──────────────────────────────────────

        case 'create_calendar_group': {
          if (!data.name) { toast.error('Group name required'); return false; }
          const grpResult = await createCalendarGroup(data.name, data.icon, data.color);
          if (grpResult) { toast.success(`Calendar group "${data.name}" created`); return true; }
          return false;
        }

        case 'update_calendar_group': {
          if (!data.groupId) { toast.error('Group ID required'); return false; }
          await updateCalendarGroup(data.groupId, { name: data.name, color: data.color });
          toast.success('Calendar group updated');
          return true;
        }

        case 'delete_calendar_group': {
          if (!data.groupId && !data.groupName) { toast.error('Group ID or name required'); return false; }
          let grpId = data.groupId;
          if (!grpId && data.groupName) {
            const found = calendarGroups.find(g =>
              (g as any).name?.toLowerCase().trim() === (data.groupName as string).toLowerCase().trim()
            );
            grpId = found?.id;
          }
          if (!grpId) { toast.error(`Group "${data.groupName}" not found`); return false; }
          await deleteCalendarGroup(grpId, data.moveToGroupId);
          toast.success('Calendar group deleted');
          return true;
        }

        case 'create_calendar': {
          if (!data.name) { toast.error('Calendar name required'); return false; }
          const calResult = await addCalendar(data);
          if (calResult) { toast.success(`Calendar "${data.name}" created`); return true; }
          return false;
        }

        case 'update_calendar': {
          if (!data.calendarId) { toast.error('Calendar ID required'); return false; }
          await updateCalendar(data.calendarId, { name: data.name, color: data.color });
          toast.success('Calendar updated');
          return true;
        }

        case 'delete_calendar': {
          if (!data.calendarId) { toast.error('Calendar ID required'); return false; }
          await deleteCalendar(data.calendarId);
          toast.success('Calendar deleted');
          return true;
        }

        case 'move_calendar': {
          if (!data.calendarId || !data.groupId) { toast.error('Calendar ID and target group required'); return false; }
          await moveCalendar(data.calendarId, data.groupId);
          toast.success('Calendar moved');
          return true;
        }

        // ── Recurring Event Scoped Operations ────────────────────────────────

        case 'update_recurring_event': {
          if (!data.eventId || !data.scope) { toast.error('Event ID and scope required'); return false; }
          const recEvent = events.find(e => e.id === data.eventId);
          if (!recEvent) { toast.error('Event not found'); return false; }
          const updates: any = {};
          if (data.title) updates.title = data.title;
          if (data.start) updates.startsAt = new Date(data.start).toISOString();
          if (data.end) updates.endsAt = new Date(data.end).toISOString();
          if (data.description) updates.description = data.description;
          const occDate = data.occurrenceDate ? new Date(data.occurrenceDate) : new Date();
          const recResult = await editRecurringEvent(
            recEvent, updates, data.scope,
            occDate,
            (e: any) => updateEvent(e),
            (e: any) => addEvent(e),
            (id: string) => removeEvent(id),
          );
          if (recResult?.success) { toast.success(`Recurring event updated (${data.scope})`); return true; }
          return false;
        }

        case 'delete_recurring_event': {
          if (!data.eventId || !data.scope) { toast.error('Event ID and scope required'); return false; }
          const recDelEvent = events.find(e => e.id === data.eventId);
          if (!recDelEvent) { toast.error('Event not found'); return false; }
          const occDate2 = data.occurrenceDate ? new Date(data.occurrenceDate) : new Date();
          const recDelResult = await deleteRecurringEvent(
            recDelEvent, data.scope,
            occDate2,
            (e: any) => updateEvent(e),
            (id: string) => removeEvent(id),
          );
          if (recDelResult?.success) { toast.success(`Recurring event deleted (${data.scope})`); return true; }
          return false;
        }

        // ── Change Event Color (post-creation) ──────────────────────────────

        case 'change_event_color': {
          if (!data.eventId || !data.color) { toast.error('Event ID and color required'); return false; }
          const colorEvent = events.find(e => e.id === data.eventId);
          if (!colorEvent) { toast.error('Event not found'); return false; }
          const colorResult = await updateEvent({ ...colorEvent, color: data.color });
          if (colorResult?.success) { toast.success('Event color updated'); return true; }
          return false;
        }

        // ── Goals ────────────────────────────────────────────────────────────

        case 'create_goal': {
          if (!data.title) { toast.error('Goal title required'); return false; }
          const goalResult = await createGoal({
            title: data.title,
            description: data.description,
            category: data.category || 'personal',
            frequency: data.frequency || 'weekly',
            targetCount: data.targetCount || 1,
            duration: data.duration || 60,
            color: data.color || '#8b5cf6',
            isActive: true,
            preferredTimes: data.preferredTimes,
            preferredDays: data.preferredDays,
          });
          if (goalResult?.success) { toast.success(`Goal "${data.title}" created`); return true; }
          return false;
        }

        case 'update_goal': {
          if (!data.goalId) { toast.error('Goal ID required'); return false; }
          const goalUpdates: any = {};
          if (data.title) goalUpdates.title = data.title;
          if (data.description) goalUpdates.description = data.description;
          if (data.category) goalUpdates.category = data.category;
          if (data.frequency) goalUpdates.frequency = data.frequency;
          if (data.targetCount) goalUpdates.targetCount = data.targetCount;
          if (data.duration) goalUpdates.duration = data.duration;
          const gResult = await updateGoal(data.goalId, goalUpdates);
          if (gResult?.success) { toast.success('Goal updated'); return true; }
          return false;
        }

        case 'delete_goal': {
          if (!data.goalId && !data.goalTitle) { toast.error('Goal ID or title required'); return false; }
          let gId = data.goalId;
          if (!gId && data.goalTitle) {
            const found = goals.find(g =>
              g.title.toLowerCase().trim() === (data.goalTitle as string).toLowerCase().trim()
            );
            gId = found?.id;
          }
          if (!gId) { toast.error(`Goal "${data.goalTitle}" not found`); return false; }
          const gDelResult = await deleteGoal(gId);
          if (gDelResult?.success) { toast.success('Goal deleted'); return true; }
          return false;
        }

        case 'pause_goal': {
          if (!data.goalId) { toast.error('Goal ID required'); return false; }
          const pgResult = await pauseGoal(data.goalId, data.until ? dayjs(data.until) : undefined);
          if (pgResult?.success) { toast.success('Goal paused'); return true; }
          return false;
        }

        case 'resume_goal': {
          if (!data.goalId) { toast.error('Goal ID required'); return false; }
          const rgResult = await resumeGoal(data.goalId);
          if (rgResult?.success) { toast.success('Goal resumed'); return true; }
          return false;
        }

        case 'schedule_goal': {
          if (!data.goalId) { toast.error('Goal ID required'); return false; }
          const goalToSchedule = goals.find(g => g.id === data.goalId);
          if (!goalToSchedule) { toast.error('Goal not found'); return false; }
          const sgResult = await scheduleGoalSessions(goalToSchedule);
          if (sgResult?.success) { toast.success(`Scheduled ${sgResult.scheduledCount || 0} goal sessions`); return true; }
          return false;
        }

        case 'complete_goal_session': {
          if (!data.sessionId) { toast.error('Session ID required'); return false; }
          const csResult = await completeSession(data.sessionId, data.notes);
          if (csResult?.success) { toast.success('Goal session completed'); return true; }
          return false;
        }

        // ── Appointment Scheduling / Booking ─────────────────────────────────

        case 'create_booking_page': {
          if (!data.title) { toast.error('Booking page title required'); return false; }
          const bpResult = await createBookingPage({
            title: data.title,
            description: data.description,
            duration: data.duration || 30,
            bufferBefore: data.bufferBefore || 0,
            bufferAfter: data.bufferAfter || 0,
            availability: data.availability,
            customFields: data.customFields,
            color: data.color,
          } as any);
          if (bpResult?.success) { toast.success(`Booking page "${data.title}" created`); return true; }
          return false;
        }

        case 'update_booking_page': {
          if (!data.pageId) { toast.error('Booking page ID required'); return false; }
          const bpuResult = await updateBookingPage(data.pageId, data);
          if (bpuResult?.success) { toast.success('Booking page updated'); return true; }
          return false;
        }

        case 'delete_booking_page': {
          if (!data.pageId) { toast.error('Booking page ID required'); return false; }
          const bpdResult = await deleteBookingPage(data.pageId);
          if (bpdResult?.success) { toast.success('Booking page deleted'); return true; }
          return false;
        }

        case 'toggle_booking_page': {
          if (!data.pageId) { toast.error('Booking page ID required'); return false; }
          await togglePageActive(data.pageId);
          toast.success('Booking page toggled');
          return true;
        }

        case 'get_booking_url': {
          if (!data.pageId) { toast.error('Booking page ID required'); return false; }
          const bkPage = bookingPages.find(p => p.id === data.pageId);
          if (!bkPage) { toast.error('Booking page not found'); return false; }
          copyBookingUrl(bkPage);
          return true;
        }

        case 'cancel_booking': {
          if (!data.bookingId) { toast.error('Booking ID required'); return false; }
          const cbResult = await cancelBooking(data.bookingId, data.cancelledBy || 'host', data.reason);
          if (cbResult?.success) { toast.success('Booking cancelled'); return true; }
          return false;
        }

        // ── Find Time ────────────────────────────────────────────────────────

        case 'find_available_time': {
          const ftResult = await findAvailableTimes({
            duration: data.duration || 60,
            startDate: data.startDate ? new Date(data.startDate) : new Date(),
            endDate: data.endDate ? new Date(data.endDate) : dayjs().add(7, 'day').toDate(),
            startHour: data.startHour,
            endHour: data.endHour,
            excludeWeekends: data.excludeWeekends,
          });
          // The results are returned to the AI via the response — the AI can reference them in conversation
          toast.success(`Found ${ftResult.length} available time slots`);
          return true;
        }

        case 'suggest_next_slot': {
          const slot = await suggestNextAvailable(data.duration || 60, data.startFrom ? new Date(data.startFrom) : undefined);
          if (slot) {
            toast.success(`Next available: ${dayjs(slot.start).format('ddd MMM D, h:mm A')}`);
          } else {
            toast.info('No available slots found in the next week');
          }
          return true;
        }

        // ── Calendar Snapshots ───────────────────────────────────────────────

        case 'save_snapshot': {
          if (!data.name) { toast.error('Snapshot name required'); return false; }
          const ssResult = await createSnapshot(data.name, data.description);
          if (ssResult?.success) { toast.success(`Snapshot "${data.name}" saved`); return true; }
          return false;
        }

        case 'restore_snapshot': {
          if (!data.snapshotId && !data.snapshotName) { toast.error('Snapshot ID or name required'); return false; }
          let ssId = data.snapshotId;
          if (!ssId && data.snapshotName) {
            const found = snapshots.find(s =>
              (s as any).name?.toLowerCase().trim() === (data.snapshotName as string).toLowerCase().trim()
            );
            ssId = found?.id;
          }
          if (!ssId) { toast.error(`Snapshot "${data.snapshotName}" not found`); return false; }
          const rsResult = await restoreSnapshot(ssId);
          if (rsResult) { toast.success('Snapshot restored'); return true; }
          return false;
        }

        case 'delete_snapshot': {
          if (!data.snapshotId) { toast.error('Snapshot ID required'); return false; }
          const dsResult = await deleteCalendarSnapshot(data.snapshotId);
          if (dsResult) { toast.success('Snapshot deleted'); return true; }
          return false;
        }

        case 'clear_calendar': {
          const ccResult = await clearCalendar();
          if (ccResult) { toast.success('Calendar cleared'); return true; }
          return false;
        }

        case 'save_and_start_fresh': {
          if (!data.name) { toast.error('Snapshot name required'); return false; }
          const sfResult = await saveAndStartFresh(data.name, data.description);
          if (sfResult) { toast.success('Calendar saved and cleared'); return true; }
          return false;
        }

        // ── Search Events ────────────────────────────────────────────────────

        case 'search_events': {
          if (!data.query) { toast.error('Search query required'); return false; }
          const results = searchEvents(data.query, data.filters);
          toast.success(`Found ${results.length} matching events`);
          return true;
        }

        // ── Export / Print ───────────────────────────────────────────────────

        case 'export_calendar': {
          const icsContent = exportToICalendar(events, data.calendarName || 'Malleabite Calendar');
          downloadICalendar(icsContent, data.filename || 'malleabite-calendar.ics');
          toast.success('Calendar exported as ICS');
          return true;
        }

        case 'print_calendar': {
          printCalendar(events, {
            layout: data.layout || 'week',
            title: data.title || 'Calendar',
          });
          toast.success('Print dialog opened');
          return true;
        }

        case 'download_pdf': {
          downloadPDF(events, {
            layout: data.layout || 'week',
            title: data.title || 'Calendar',
          });
          toast.success('PDF downloaded');
          return true;
        }

        // ── Analytics ────────────────────────────────────────────────────────

        case 'get_analytics': {
          // The analytics data is available in context — this action just ensures AI reports it
          toast.success('Analytics data loaded');
          return true;
        }

        // ── Video Conferencing / Meeting Links ───────────────────────────────

        case 'create_meeting_link': {
          if (!data.eventTitle) { toast.error('Event title required for meeting link'); return false; }
          const meetResult = await createMeeting(
            data.eventTitle,
            data.startTime ? new Date(data.startTime) : new Date(),
            data.duration || 60,
            data.provider,
          );
          if (meetResult) { toast.success(`Meeting link created: ${meetResult.url}`); return true; }
          toast.error('Failed to create meeting link');
          return false;
        }

        case 'add_meeting_to_event': {
          if (!data.eventId) { toast.error('Event ID required'); return false; }
          const meetAddResult = await addMeetingToEvent(data.eventId, data.provider);
          if (meetAddResult) { toast.success('Meeting link added to event'); return true; }
          toast.error('Failed to add meeting link');
          return false;
        }

        // ── Email Notification Preferences ───────────────────────────────────

        case 'update_notification_preferences': {
          await updateNotificationPrefs(data);
          toast.success('Notification preferences updated');
          return true;
        }

        case 'schedule_event_reminders': {
          if (!data.eventId) { toast.error('Event ID required'); return false; }
          const remEvent = events.find(e => e.id === data.eventId);
          if (!remEvent) { toast.error('Event not found'); return false; }
          const serResult = await scheduleEventReminders(remEvent, data.reminders);
          if (serResult?.success) { toast.success('Event reminders scheduled'); return true; }
          return false;
        }

        default:
          console.log('[MallyActions] Unknown action type:', type);
          return false;
      }
    } catch (error) {
      console.error('[MallyActions] Action execution error:', error);
      logger.error('MallyActions', 'Action execution failed', error as Error);
      toast.error('Failed to execute action');
      return false;
    }
  }, [
    // Original deps
    addEvent, removeEvent, updateEvent, events, archiveAllEvents, restoreFolder,
    createList, deleteList, lists, activeListId, setActiveListId, todos, addTodo, toggleTodo, deleteTodo, moveTodo,
    pages, activePage, activePageId, setActivePageId,
    addModule, removeModule, toggleModuleMinimized, createPage, deletePage,
    findModuleById, removeModuleById, updateModuleById, toggleModuleMinimizedById,
    eisenhowerItems, addEisenhowerItem, updateQuadrant, removeEisenhowerItem,
    addAlarm, updateAlarm, deleteAlarm, toggleAlarm, linkToEvent, linkToTodo,
    addReminder, updateReminder, deleteReminder, toggleReminderActive,
    startTimer, pauseTimer, resetTimer, setFocusTime, setBreakTime, setFocusTarget,
    templates, applyTemplate, useTemplate, createTemplate, deleteTemplate,
    sendInvite, respondToInvite, deleteInvite, setView, setDate,
    calendarAccounts, toggleVisibility, setAllVisible,
    resolvePageRef, resolveModuleIndex, ensureModuleVisible,
    syncEnabled, pushEventToGoogle,
    // New deps
    bulkDelete, bulkUpdateColor, bulkReschedule, bulkDuplicate,
    enableBulkMode, disableBulkMode, toggleSelection, selectAll, deselectAll,
    getSelectedEvents, selectedCount, isBulkMode,
    performUndo, performRedo, canUndo, canRedo,
    setTheme, setBackgroundColor,
    calendarGroups, createCalendarGroup, updateCalendarGroup, deleteCalendarGroup,
    addCalendar, updateCalendar, deleteCalendar, moveCalendar,
    goals, goalsWithProgress, createGoal, updateGoal, deleteGoal,
    scheduleGoalSessions, completeSession, skipSession, pauseGoal, resumeGoal,
    bookingPages, bookings, createBookingPage, updateBookingPage, deleteBookingPage,
    togglePageActive, getAvailableSlots, createBooking, cancelBooking, copyBookingUrl,
    findAvailableTimes, suggestNextAvailable,
    snapshots, createSnapshot, restoreSnapshot, deleteCalendarSnapshot,
    clearCalendar, saveAndStartFresh,
    searchEvents, searchResults,
    saveWorkingHours,
    editRecurringEvent, deleteRecurringEvent,
    printCalendar, downloadPDF,
    createMeeting, addMeetingToEvent,
    updateNotificationPrefs, scheduleEventReminders,
    // Calendar templates (weekly patterns)
    user, calendarTemplates, getActiveCalendars,
  ]);

  // ─── Context builder ───────────────────────────────────────────────────────

  const buildContext = useCallback(() => ({
    currentTime: new Date().toISOString(),
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    availableCalendars: calendarAccounts.map(a => ({
      id: a.id, name: a.name, isDefault: a.isDefault || false, isGoogle: a.isGoogle || false,
    })),
    // Sidebar pages & modules (capped to avoid oversized payloads)
    sidebarPages: pages.slice(0, 10).map(p => ({
      id: p.id,
      title: p.title,
      isActive: p.id === activePageId,
      modules: p.modules.slice(0, 20).map((m, idx) => ({
        id: m.id,  // Unique module instance ID — use this for targeted operations
        index: idx,
        type: m.type,
        title: m.title,
        minimized: m.minimized ?? false,
        listId: m.listId,
        instanceId: m.instanceId,
      })),
    })),
    todoLists: lists.map(l => ({ id: l.id, name: (l as any).name, isActive: l.id === activeListId })),
    pomodoro: (() => { const p = getPomodoroInstance(); return { isActive: p.isActive, mode: p.timerMode, timeLeft: p.timeLeft }; })(),
    eisenhowerItems,
    events: events.slice(0, 20),
    todos: todos.slice(0, 30),
    // Persistent AI memory (preferences, patterns, goals, observations)
    userMemory: userMemory ? {
      preferences: userMemory.preferences,
      patterns: userMemory.patterns,
      goals: userMemory.goals,
      observations: (userMemory.observations || []).slice(-5),
    } : undefined,

    // ── Extended context for new capabilities ────────────────────────────

    // Calendar groups
    calendarGroups: calendarGroups.slice(0, 10).map(g => ({
      id: g.id, name: (g as any).name, color: (g as any).color,
    })),

    // Goals
    goals: goalsWithProgress.slice(0, 15).map(g => ({
      id: g.id, title: g.title, category: g.category,
      frequency: g.frequency, isActive: g.isActive,
      progress: g.progress ? {
        completed: g.progress.completedCount,
        target: g.progress.targetCount,
        streak: g.progress.currentStreak,
      } : undefined,
    })),

    // Booking pages
    bookingPages: bookingPages.slice(0, 5).map(p => ({
      id: p.id, title: p.title, duration: p.duration, isActive: (p as any).isActive,
    })),

    // Snapshots
    snapshots: snapshots.slice(0, 5).map(s => ({
      id: s.id, name: (s as any).name, createdAt: (s as any).createdAt,
    })),

    // Working hours
    workingHours: workingHours ? {
      enabled: (workingHours as any).enabled,
      days: (workingHours as any).days,
    } : undefined,

    // Analytics summary (lightweight)
    analytics: analyticsMetrics ? {
      thisWeek: (analyticsMetrics as any).thisWeek,
      trends: (analyticsMetrics as any).trends,
    } : undefined,

    // Bulk selection state
    bulkSelection: { isBulkMode, selectedCount },

    // Undo/Redo availability
    undoRedo: { canUndo, canRedo },

    // Theme
    theme: useThemeStore.getState().theme,

    // Calendar templates (weekly patterns)
    calendarTemplates: calendarTemplates.slice(0, 10).map(t => ({
      id: t.id,
      name: t.name,
      description: t.description,
      isActive: t.isActive,
      targetGroupId: t.targetGroupId,
      eventCount: t.events.length,
      events: t.events.slice(0, 20).map(e => ({
        title: e.title,
        dayOfWeek: e.dayOfWeek,
        startTime: e.startTime,
        endTime: e.endTime,
      })),
    })),
  }), [
    calendarAccounts, pages, activePageId, lists, activeListId,
    getPomodoroInstance,
    eisenhowerItems, events, todos, userMemory,
    // New deps
    calendarGroups, goalsWithProgress, bookingPages, snapshots,
    workingHours, analyticsMetrics,
    isBulkMode, selectedCount, canUndo, canRedo,
    calendarTemplates,
  ]);

  return {
    executeAction,
    buildContext,
    events,
    todos,
    lists,
    activeListId,
    pages,
    activePage,
    activePageId,
    eisenhowerItems,
    alarms: alarms || [],
    reminders: reminders || [],
    sentInvites: sentInvites || [],
    receivedInvites: receivedInvites || [],
  };
}
