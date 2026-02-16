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
import { formatAIEvent } from "@/lib/ai/format-ai-event";
import dayjs from "dayjs";

export function useMallyActions() {
  // Calendar
  const { addEvent, removeEvent, updateEvent, events, archiveAllEvents, restoreFolder } = useCalendarEvents();
  const { syncEnabled, pushEventToGoogle } = useGoogleCalendar();

  // Todos
  const {
    createList, lists, activeListId, setActiveListId, todos, addTodo, toggleTodo, deleteTodo
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
  } = useSidebarPages();

  // Eisenhower
  const { items: eisenhowerItems, addItem: addEisenhowerItem, updateQuadrant, removeItem: removeEisenhowerItem } = useEisenhower();

  // Alarms & Reminders
  const { addAlarm, updateAlarm, deleteAlarm, linkToEvent, linkToTodo } = useAlarms();
  const { addReminder, updateReminder, deleteReminder } = useReminders();

  // Pomodoro
  const {
    startTimer, pauseTimer, resetTimer,
    setFocusTime, setBreakTime, setFocusTarget,
    getInstance: getPomodoroInstance,
  } = usePomodoroStore();

  // Templates & Invites
  const { templates, applyTemplate, useTemplate } = useTemplates();
  const { sendInvite } = useInvites();

  // View & Date
  const { setView } = useViewStore();
  const { setDate } = useDateStore();

  // Calendar filter
  const calendarAccounts = useCalendarFilterStore(state => state.accounts);
  const toggleVisibility = useCalendarFilterStore(state => state.toggleVisibility);
  const setAllVisible = useCalendarFilterStore(state => state.setAllVisible);

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

  /** Find a module's index in a page by type and/or title. */
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

        // ── Templates ────────────────────────────────────────────────────────

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
            archives: 'Archives', templates: 'Templates', calendars: 'Calendars',
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
          const { pageId: pid, page: pg } = resolvePageRef(data);
          if (!pid || !pg) { toast.error('Page not found'); return false; }
          const idx = resolveModuleIndex(pg, data);
          if (idx === -1) {
            toast.error(`Module "${data.title || data.moduleType}" not found on this page`);
            return false;
          }
          const modTitle = pg.modules[idx].title;
          const result = await removeModule(pid, idx);
          if (result?.success) { toast.success(`Removed ${modTitle} module`); return true; }
          return false;
        }

        case 'minimize_module': {
          const { pageId: pid, page: pg } = resolvePageRef(data);
          if (!pid || !pg) { toast.error('Page not found'); return false; }
          const idx = resolveModuleIndex(pg, data);
          if (idx === -1) { toast.error(`Module "${data.title || data.moduleType}" not found`); return false; }
          const mod = pg.modules[idx];
          if (mod.minimized) { toast.info(`${mod.title} is already minimized`); return true; }
          const result = await toggleModuleMinimized(pid, idx);
          if (result?.success) { toast.success(`${mod.title} minimized`); return true; }
          return false;
        }

        case 'maximize_module': {
          const { pageId: pid, page: pg } = resolvePageRef(data);
          if (!pid || !pg) { toast.error('Page not found'); return false; }
          const idx = resolveModuleIndex(pg, data);
          if (idx === -1) { toast.error(`Module "${data.title || data.moduleType}" not found`); return false; }
          const mod = pg.modules[idx];
          if (!mod.minimized) { toast.info(`${mod.title} is already expanded`); return true; }
          const result = await toggleModuleMinimized(pid, idx);
          if (result?.success) { toast.success(`${mod.title} expanded`); return true; }
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
    addEvent, removeEvent, updateEvent, events, archiveAllEvents, restoreFolder,
    createList, lists, activeListId, setActiveListId, todos, addTodo, toggleTodo, deleteTodo,
    pages, activePage, activePageId, setActivePageId,
    addModule, removeModule, toggleModuleMinimized, createPage, deletePage,
    eisenhowerItems, addEisenhowerItem, updateQuadrant, removeEisenhowerItem,
    addAlarm, updateAlarm, deleteAlarm, linkToEvent, linkToTodo,
    addReminder, updateReminder, deleteReminder,
    startTimer, pauseTimer, resetTimer, setFocusTime, setBreakTime, setFocusTarget,
    templates, applyTemplate, useTemplate,
    sendInvite, setView, setDate,
    calendarAccounts, toggleVisibility, setAllVisible,
    resolvePageRef, resolveModuleIndex, ensureModuleVisible,
    syncEnabled, pushEventToGoogle,
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
        index: idx,
        type: m.type,
        title: m.title,
        minimized: m.minimized ?? false,
        listId: m.listId,
      })),
    })),
    todoLists: lists.map(l => ({ id: l.id, name: (l as any).name, isActive: l.id === activeListId })),
    pomodoro: (() => { const p = getPomodoroInstance(); return { isActive: p.isActive, mode: p.timerMode, timeLeft: p.timeLeft }; })(),
    eisenhowerItems,
    events: events.slice(0, 20),
    todos: todos.slice(0, 30),
  }), [
    calendarAccounts, pages, activePageId, lists, activeListId,
    getPomodoroInstance,
    eisenhowerItems, events, todos,
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
  };
}
