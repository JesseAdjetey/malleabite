/**
 * MentionPopover v2 — Per-module-type tabs with breadcrumb drill-down.
 *
 * Tabs: To Do Lists | Pomodoro | Alarms | Eisenhower | Invites | Events | Pages
 * Each tab shows top-level items. Items with children (e.g. a todo list) show a
 * chevron that drills into the children list with a breadcrumb trail.
 *
 * Icons use Lucide React — no emojis.
 */
import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import {
  MentionOption,
  MentionTabId,
  IconName,
} from './mention-types';
import type { SidebarPage } from '@/lib/stores/types';
import type { CalendarEventType } from '@/lib/stores/types';
import type { EisenhowerItem } from '@/hooks/use-eisenhower';
import type { Alarm } from '@/hooks/use-alarms';
import type { Reminder } from '@/hooks/use-reminders';
import type { Invite } from '@/hooks/use-invites';
import type { CalendarAccount } from '@/lib/stores/calendar-filter-store';
import type { ConnectedCalendar } from '@/types/calendar';
import type { CalendarTemplate } from '@/types/calendar';
import {
  ListTodo,
  CheckSquare,
  Timer,
  Bell,
  BellRing,
  Grid2x2,
  Mail,
  Calendar,
  FileText,
  Layers,
  CircleDot,
  Send,
  Inbox,
  ChevronRight,
  ChevronLeft,
  Bookmark,
  Palette,
} from 'lucide-react';

/* ─── Icon Mapping ───────────────────────────────────────────────────── */

const ICON_MAP: Record<IconName, React.FC<{ className?: string }>> = {
  'list-todo': ListTodo,
  'check-square': CheckSquare,
  'timer': Timer,
  'bell': Bell,
  'bell-ring': BellRing,
  'grid-2x2': Grid2x2,
  'mail': Mail,
  'calendar': Calendar,
  'file-text': FileText,
  'layers': Layers,
  'circle-dot': CircleDot,
  'send': Send,
  'inbox': Inbox,
  'bookmark': Bookmark,
  'palette': Palette,
};

/** Render a Lucide icon by name string. Exported for use in MentionTagBar. */
export const MentionIcon: React.FC<{ name: IconName; className?: string }> = ({ name, className }) => {
  const Comp = ICON_MAP[name];
  return Comp ? <Comp className={className} /> : null;
};

/* ─── Tab Metadata ───────────────────────────────────────────────────── */

interface TabMeta {
  id: MentionTabId;
  label: string;
  iconName: IconName;
}

const TABS: TabMeta[] = [
  { id: 'pages',      label: 'Pages',       iconName: 'file-text' },
  { id: 'calendars',  label: 'Calendars',   iconName: 'palette' },
  { id: 'events',     label: 'Events',      iconName: 'calendar' },
  { id: 'todo-lists', label: 'To Do Lists', iconName: 'list-todo' },
  { id: 'alarms',     label: 'Alarms',      iconName: 'bell' },
  { id: 'invites',    label: 'Invites',     iconName: 'mail' },
  { id: 'eisenhower', label: 'Eisenhower',  iconName: 'grid-2x2' },
  { id: 'pomodoro',   label: 'Pomodoro',    iconName: 'timer' },
];

/* ─── Local Interfaces ───────────────────────────────────────────────── */

interface TodoItem {
  id: string;
  text: string;
  completed: boolean;
  listId: string;
}

interface TodoList {
  id: string;
  name: string;
  color: string;
  icon?: string;
}

/* ─── Component Props ────────────────────────────────────────────────── */

interface MentionPopoverProps {
  open: boolean;
  onClose: () => void;
  onSelect: (option: MentionOption, tabId: MentionTabId) => void;
  position: 'above' | 'below';
  pages: SidebarPage[];
  events: CalendarEventType[];
  todos: TodoItem[];
  lists: TodoList[];
  eisenhowerItems: EisenhowerItem[];
  alarms: Alarm[];
  reminders: Reminder[];
  sentInvites: Invite[];
  receivedInvites: Invite[];
  calendarAccounts: CalendarAccount[];
  connectedCalendars: ConnectedCalendar[];
  calendarTemplates: CalendarTemplate[];
  filterText: string;
}

/* ─── Drill-down state ───────────────────────────────────────────────── */

interface DrillLevel {
  label: string;
  options: MentionOption[];
}

/* ─── Helpers ────────────────────────────────────────────────────────── */

function formatEventDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) return `Today ${d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (d.toDateString() === tomorrow.toDateString()) return `Tomorrow ${d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

const QUADRANT_LABELS: Record<string, string> = {
  urgent_important: 'Do First',
  not_urgent_important: 'Schedule',
  urgent_not_important: 'Delegate',
  not_urgent_not_important: 'Eliminate',
};

/* ─── MentionPopover ─────────────────────────────────────────────────── */

export const MentionPopover: React.FC<MentionPopoverProps> = ({
  open,
  onClose,
  onSelect,
  position,
  pages,
  events,
  todos,
  lists,
  eisenhowerItems,
  alarms,
  reminders,
  sentInvites,
  receivedInvites,
  calendarAccounts,
  connectedCalendars,
  calendarTemplates,
  filterText,
}) => {
  const [activeTab, setActiveTab] = useState<MentionTabId>('pages');
  const [drillStack, setDrillStack] = useState<DrillLevel[]>([]);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  /* ── Build root options per tab ─────────────────────────────────────── */

  const tabOptions = useMemo<Record<MentionTabId, MentionOption[]>>(() => {
    const filter = filterText.toLowerCase();

    const applyFilter = (opts: MentionOption[]) =>
      filter
        ? opts.filter(o =>
            o.label.toLowerCase().includes(filter) ||
            o.description?.toLowerCase().includes(filter)
          )
        : opts;

    // ── To Do Lists (drillable → children are todo items) ──
    // Filter out ghost/orphan lists that have zero total todos
    const activeLists = lists.filter(l => todos.some(t => t.listId === l.id && t.text?.trim()));
    const todoListOpts: MentionOption[] = activeLists.map(l => {
      const items = todos.filter(t => t.listId === l.id && !t.completed && t.text?.trim());
      return {
        entityId: l.id,
        entityType: 'todo-list' as const,
        label: l.name,
        iconName: 'list-todo' as IconName,
        color: l.color,
        description: `${items.length} task${items.length !== 1 ? 's' : ''}`,
        drillable: items.length > 0,
        children: items.map(t => ({
          entityId: t.id,
          entityType: 'todo-item' as const,
          label: t.text,
          iconName: 'check-square' as IconName,
          color: l.color,
          description: l.name,
        })),
      };
    });

    // ── Pomodoro (modules of type pomodoro across all pages) ──
    const pomodoroOpts: MentionOption[] = [];
    for (const page of pages) {
      for (const mod of page.modules) {
        if (mod.type === 'pomodoro') {
          pomodoroOpts.push({
            entityId: mod.id,
            entityType: 'pomodoro' as const,
            label: mod.title || 'Pomodoro',
            iconName: 'timer' as IconName,
            description: page.title,
          });
        }
      }
    }

    // ── Alarms ──
    const alarmOpts: MentionOption[] = alarms.map(a => ({
      entityId: a.id || '',
      entityType: 'alarm' as const,
      label: a.title,
      iconName: 'bell' as IconName,
      description: a.enabled ? 'Enabled' : 'Disabled',
    }));

    // Reminders are shown under the alarms tab
    const reminderOpts: MentionOption[] = reminders.map(r => ({
      entityId: r.id,
      entityType: 'reminder' as const,
      label: r.title,
      iconName: 'bell-ring' as IconName,
      description: r.isActive ? 'Active' : 'Inactive',
    }));

    const allAlarmOpts = [...alarmOpts, ...reminderOpts];

    // ── Eisenhower ──
    const eisenhowerOpts: MentionOption[] = eisenhowerItems.map(ei => ({
      entityId: ei.id,
      entityType: 'eisenhower-item' as const,
      label: ei.text,
      iconName: 'grid-2x2' as IconName,
      description: QUADRANT_LABELS[ei.quadrant] || ei.quadrant,
    }));

    // ── Invites (sent + received) ──
    const inviteOpts: MentionOption[] = [
      ...sentInvites.map(i => ({
        entityId: i.id,
        entityType: 'invite' as const,
        label: i.eventTitle,
        iconName: 'send' as IconName,
        description: `Sent to ${i.recipientEmail} · ${i.status}`,
      })),
      ...receivedInvites.map(i => ({
        entityId: i.id,
        entityType: 'invite' as const,
        label: i.eventTitle,
        iconName: 'inbox' as IconName,
        description: `From ${i.senderEmail} · ${i.status}`,
      })),
    ];

    // ── Events (all events, sorted newest first, capped at 100) ──
    const sortedEvents = [...events]
      .sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime())
      .slice(0, 100);

    const eventOpts: MentionOption[] = sortedEvents.map(e => ({
      entityId: e.id,
      entityType: 'event' as const,
      label: e.title,
      iconName: 'calendar' as IconName,
      color: e.color,
      description: formatEventDate(e.startsAt),
    }));

    // ── Helper: enrich a module with its drillable children by type ──
    const enrichModule = (m: { id: string; type: string; title: string }, pageName?: string): MentionOption => {
      const iconName: IconName = m.type === 'pomodoro' ? 'timer'
        : m.type === 'alarms' ? 'bell'
        : m.type === 'reminders' ? 'bell-ring'
        : m.type === 'eisenhower' ? 'grid-2x2'
        : m.type === 'invites' ? 'mail'
        : m.type === 'todo' ? 'list-todo'
        : 'layers';

      // Determine children based on module type
      let children: MentionOption[] | undefined;

      if (m.type === 'todo') {
        // Find the todo list that matches this module (by title or first list)
        const matchedList = lists.find(l => l.name === m.title) || lists[0];
        if (matchedList) {
          const items = todos.filter(t => t.listId === matchedList.id && !t.completed && t.text?.trim());
          if (items.length > 0) {
            children = items.map(t => ({
              entityId: t.id,
              entityType: 'todo-item' as const,
              label: t.text,
              iconName: 'check-square' as IconName,
              color: matchedList.color,
              description: matchedList.name,
            }));
          }
        }
      } else if (m.type === 'eisenhower') {
        if (eisenhowerItems.length > 0) {
          children = eisenhowerItems.map(ei => ({
            entityId: ei.id,
            entityType: 'eisenhower-item' as const,
            label: ei.text,
            iconName: 'grid-2x2' as IconName,
            description: QUADRANT_LABELS[ei.quadrant] || ei.quadrant,
          }));
        }
      } else if (m.type === 'alarms' || m.type === 'reminders') {
        const kids: MentionOption[] = [];
        for (const a of alarms) {
          kids.push({
            entityId: a.id || '',
            entityType: 'alarm' as const,
            label: a.title,
            iconName: 'bell' as IconName,
            description: a.enabled ? 'Enabled' : 'Disabled',
          });
        }
        for (const r of reminders) {
          kids.push({
            entityId: r.id,
            entityType: 'reminder' as const,
            label: r.title,
            iconName: 'bell-ring' as IconName,
            description: r.isActive ? 'Active' : 'Inactive',
          });
        }
        if (kids.length > 0) children = kids;
      } else if (m.type === 'invites') {
        const kids: MentionOption[] = [
          ...sentInvites.map(i => ({
            entityId: i.id,
            entityType: 'invite' as const,
            label: i.eventTitle,
            iconName: 'send' as IconName,
            description: `Sent to ${i.recipientEmail} · ${i.status}`,
          })),
          ...receivedInvites.map(i => ({
            entityId: i.id,
            entityType: 'invite' as const,
            label: i.eventTitle,
            iconName: 'inbox' as IconName,
            description: `From ${i.senderEmail} · ${i.status}`,
          })),
        ];
        if (kids.length > 0) children = kids;
      }

      return {
        entityId: m.id,
        entityType: 'module' as const,
        label: m.title || m.type,
        iconName,
        description: pageName ? `${pageName} · ${m.type}` : m.type,
        drillable: !!children && children.length > 0,
        children,
      };
    };

    // ── Pages (drillable → children are modules, each also drillable) ──
    const pageOpts: MentionOption[] = pages.map(p => ({
      entityId: p.id,
      entityType: 'page' as const,
      label: p.title,
      iconName: 'file-text' as IconName,
      description: `${p.modules.length} module${p.modules.length !== 1 ? 's' : ''}`,
      drillable: p.modules.length > 0,
      children: p.modules.map(m => enrichModule(m, p.title)),
    }));

    // ── Calendars (derived from actual events + metadata from ConnectedCalendar) ──

    // Build a lookup for calendar metadata from ConnectedCalendar (most reliable source)
    // Map by both id (Firestore docId) AND sourceCalendarId (e.g. Google email)
    const calMeta = new Map<string, { name: string; color: string }>();
    for (const acc of calendarAccounts) {
      calMeta.set(acc.id, { name: acc.name, color: acc.color });
    }
    for (const cc of connectedCalendars) {
      if (!calMeta.has(cc.id)) {
        calMeta.set(cc.id, { name: cc.name, color: cc.color });
      }
      // Also map sourceCalendarId (e.g. email like "user@gmail.com") so events
      // using the Google calendar ID as calendarId still get a name
      if (cc.sourceCalendarId && !calMeta.has(cc.sourceCalendarId)) {
        calMeta.set(cc.sourceCalendarId, { name: cc.name, color: cc.color });
      }
    }

    // Group events by calendarId
    const eventsByCalendar = new Map<string, CalendarEventType[]>();
    for (const e of events) {
      const cid = e.calendarId || 'personal';
      if (!eventsByCalendar.has(cid)) eventsByCalendar.set(cid, []);
      eventsByCalendar.get(cid)!.push(e);
    }

    // Build templates as a separate drillable entry with template event children
    const templateOpts: MentionOption[] = calendarTemplates.map(t => {
      // Find events created from this template (calendarId = "template_{id}")
      const templateCalId = `template_${t.id}`;
      const tEvents = eventsByCalendar.get(templateCalId) || [];
      const templateColor = t.events[0]?.color || '#8B5CF6';
      const children: MentionOption[] = tEvents
        .sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime())
        .map(e => ({
          entityId: e.id,
          entityType: 'event' as const,
          label: e.title,
          iconName: 'calendar' as IconName,
          color: e.color || templateColor,
          description: formatEventDate(e.startsAt),
        }));
      return {
        entityId: t.id,
        entityType: 'template' as const,
        label: t.name,
        iconName: 'bookmark' as IconName,
        color: templateColor,
        description: `${t.events.length} slots${t.isActive ? ' · Active' : ''}${children.length > 0 ? ` · ${children.length} events` : ''}`,
        drillable: children.length > 0,
        children: children.length > 0 ? children : undefined,
      };
    });

    // Collect all unique calendarIds (excluding template_* ones which go in Templates group)
    // Only show calendars that have actual events — no phantom entries
    const allCalendarIds = new Set<string>();
    for (const cid of eventsByCalendar.keys()) {
      if (!cid.startsWith('template_')) allCalendarIds.add(cid);
    }

    const calendarOpts: MentionOption[] = Array.from(allCalendarIds).map(calId => {
      const meta = calMeta.get(calId);
      const calName = meta?.name || (calId === 'personal' ? 'Personal' : calId);
      const calColor = meta?.color || '#8B5CF6';
      const calEvents = (eventsByCalendar.get(calId) || [])
        .sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime())
        .slice(0, 50);

      const children: MentionOption[] = calEvents.map(e => ({
        entityId: e.id,
        entityType: 'event' as const,
        label: e.title,
        iconName: 'calendar' as IconName,
        color: e.color || calColor,
        description: formatEventDate(e.startsAt),
      }));

      return {
        entityId: calId,
        entityType: 'calendar' as const,
        label: calName,
        iconName: 'palette' as IconName,
        color: calColor,
        description: `${calEvents.length} event${calEvents.length !== 1 ? 's' : ''}`,
        drillable: children.length > 0,
        children: children.length > 0 ? children : undefined,
      };
    });

    // Add templates as a top-level drillable group in the Calendars tab
    if (templateOpts.length > 0) {
      calendarOpts.push({
        entityId: 'templates-group',
        entityType: 'template' as const,
        label: 'Templates',
        iconName: 'bookmark' as IconName,
        description: `${templateOpts.length} template${templateOpts.length !== 1 ? 's' : ''}`,
        drillable: true,
        children: templateOpts,
      });
    }

    return {
      'todo-lists': applyFilter(todoListOpts),
      'pomodoro': applyFilter(pomodoroOpts),
      'alarms': applyFilter(allAlarmOpts),
      'eisenhower': applyFilter(eisenhowerOpts),
      'invites': applyFilter(inviteOpts),
      'events': applyFilter(eventOpts),
      'calendars': applyFilter(calendarOpts),
      'pages': applyFilter(pageOpts),
    };
  }, [pages, events, todos, lists, eisenhowerItems, alarms, reminders, sentInvites, receivedInvites, calendarAccounts, connectedCalendars, calendarTemplates, filterText]);

  /* ── Current display list (root or drilled-into children) ──────────── */

  const currentOptions = useMemo(() => {
    if (drillStack.length > 0) {
      return drillStack[drillStack.length - 1].options;
    }
    return tabOptions[activeTab] || [];
  }, [activeTab, tabOptions, drillStack]);

  /* ── Reset state on tab/filter changes ─────────────────────────────── */

  useEffect(() => {
    setFocusedIndex(0);
    setDrillStack([]);
  }, [activeTab, filterText]);

  /* ── Drill navigation ──────────────────────────────────────────────── */

  const drillInto = useCallback((option: MentionOption) => {
    if (option.drillable && option.children && option.children.length > 0) {
      setDrillStack(prev => [...prev, { label: option.label, options: option.children! }]);
      setFocusedIndex(0);
    }
  }, []);

  const drillBack = useCallback(() => {
    setDrillStack(prev => prev.slice(0, -1));
    setFocusedIndex(0);
  }, []);

  /* ── Keyboard navigation ───────────────────────────────────────────── */

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setFocusedIndex(i => Math.min(i + 1, currentOptions.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setFocusedIndex(i => Math.max(i - 1, 0));
          break;
        case 'ArrowRight': {
          e.preventDefault();
          const item = currentOptions[focusedIndex];
          if (item?.drillable) drillInto(item);
          break;
        }
        case 'ArrowLeft':
          e.preventDefault();
          if (drillStack.length > 0) drillBack();
          break;
        case 'Tab': {
          e.preventDefault();
          const tabIds = TABS.map(t => t.id);
          const idx = tabIds.indexOf(activeTab);
          const next = e.shiftKey
            ? (idx - 1 + tabIds.length) % tabIds.length
            : (idx + 1) % tabIds.length;
          setActiveTab(tabIds[next]);
          break;
        }
        case 'Enter':
          e.preventDefault();
          if (currentOptions[focusedIndex]) {
            onSelect(currentOptions[focusedIndex], activeTab);
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, activeTab, currentOptions, focusedIndex, onSelect, onClose, drillStack, drillInto, drillBack]);

  /* ── Scroll focused item into view ─────────────────────────────────── */

  useEffect(() => {
    if (!open) return;
    const el = containerRef.current?.querySelector(`[data-mention-index="${focusedIndex}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [focusedIndex, open]);

  if (!open) return null;

  /* ── Breadcrumb trail ──────────────────────────────────────────────── */

  const breadcrumb = drillStack.length > 0 ? (
    <div className="flex items-center gap-1 px-3 py-1.5 border-b border-border/50 text-xs text-muted-foreground">
      <button
        onClick={() => setDrillStack([])}
        className="hover:text-foreground transition-colors"
      >
        {TABS.find(t => t.id === activeTab)?.label || 'Root'}
      </button>
      {drillStack.map((level, i) => (
        <React.Fragment key={i}>
          <ChevronRight className="h-3 w-3 flex-shrink-0" />
          <button
            onClick={() => setDrillStack(prev => prev.slice(0, i + 1))}
            className={cn(
              'truncate max-w-[120px]',
              i === drillStack.length - 1 ? 'text-foreground font-medium' : 'hover:text-foreground transition-colors',
            )}
          >
            {level.label}
          </button>
        </React.Fragment>
      ))}
    </div>
  ) : null;

  return (
    <div
      ref={containerRef}
      className={cn(
        'absolute left-0 right-0 z-50 mx-2',
        'bg-popover/95 backdrop-blur-xl border border-border rounded-xl shadow-2xl',
        'overflow-hidden',
        position === 'above' ? 'bottom-full mb-2' : 'top-full mt-2',
      )}
      style={{ maxHeight: '340px' }}
    >
      {/* ── Tab header ──────────────────────────────────────────────── */}
      <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v as MentionTabId); }}>
        <div className="border-b border-border/50 px-1 pt-1 overflow-x-auto scrollbar-none">
          <TabsList className="inline-flex w-max h-9 bg-transparent gap-0.5 px-1">
            {TABS.map(tab => {
              const count = (tabOptions[tab.id] || []).length;
              const TabIcon = ICON_MAP[tab.iconName];
              return (
                <TabsTrigger
                  key={tab.id}
                  value={tab.id}
                  className={cn(
                    'h-7 text-xs gap-1 px-2.5 rounded-md whitespace-nowrap data-[state=active]:bg-accent',
                    'data-[state=active]:shadow-none flex-shrink-0',
                    count === 0 && 'opacity-40',
                  )}
                >
                  <TabIcon className="h-3.5 w-3.5 flex-shrink-0" />
                  <span className="truncate">{tab.label}</span>
                  {count > 0 && (
                    <span className="ml-0.5 text-[10px] text-muted-foreground">{count}</span>
                  )}
                </TabsTrigger>
              );
            })}
          </TabsList>
        </div>

        {/* ── Breadcrumb (visible when drilled in) ────────────────── */}
        {breadcrumb}

        {/* ── Tab content ─────────────────────────────────────────── */}
        {TABS.map(tab => (
          <TabsContent key={tab.id} value={tab.id} className="mt-0">
            <ScrollArea className="max-h-[248px]">
              {currentOptions.length === 0 ? (
                <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                  {filterText
                    ? `No ${tab.label.toLowerCase()} matching "${filterText}"`
                    : `No ${tab.label.toLowerCase()} available`}
                </div>
              ) : (
                <div className="p-1">
                  {currentOptions.map((option, idx) => {
                    const ItemIcon = ICON_MAP[option.iconName];
                    return (
                      <div
                        key={`${option.entityId}-${idx}`}
                        data-mention-index={idx}
                        className={cn(
                          'flex items-center rounded-lg transition-colors text-sm',
                          'hover:bg-accent/70',
                          focusedIndex === idx && tab.id === activeTab
                            ? 'bg-accent text-accent-foreground'
                            : 'text-foreground',
                        )}
                      >
                        {/* Main click area — selects the item */}
                        <button
                          className="flex-1 flex items-center gap-2.5 px-3 py-2 text-left min-w-0"
                          onClick={() => onSelect(option, activeTab)}
                        >
                          {/* Icon or color dot */}
                          <span className="flex-shrink-0">
                            {option.color ? (
                              <span
                                className="inline-flex items-center justify-center w-5 h-5 rounded-full"
                                style={{ backgroundColor: option.color }}
                              >
                                {ItemIcon && <ItemIcon className="h-3 w-3 text-white" />}
                              </span>
                            ) : (
                              ItemIcon && <ItemIcon className="h-4 w-4 text-muted-foreground" />
                            )}
                          </span>

                          {/* Label + description */}
                          <div className="flex-1 min-w-0">
                            <div className="truncate font-medium">{option.label}</div>
                            {option.description && (
                              <div className="truncate text-xs text-muted-foreground">{option.description}</div>
                            )}
                          </div>
                        </button>

                        {/* Drill-in chevron — navigates into children */}
                        {option.drillable && (
                          <button
                            className="flex-shrink-0 px-2 py-2 hover:bg-accent rounded-r-lg"
                            onClick={() => drillInto(option)}
                            title={`View ${option.label} items`}
                          >
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        ))}
      </Tabs>

      {/* ── Footer ────────────────────────────────────────────────── */}
      <div className="border-t border-border/50 px-3 py-1.5 flex items-center justify-between text-[10px] text-muted-foreground">
        <span>
          <kbd className="px-1 py-0.5 rounded bg-muted text-[9px]">↑↓</kbd> navigate
          {drillStack.length > 0 ? (
            <>
              {' · '}
              <kbd className="px-1 py-0.5 rounded bg-muted text-[9px]">←</kbd> back
            </>
          ) : (
            <>
              {' · '}
              <kbd className="px-1 py-0.5 rounded bg-muted text-[9px]">→</kbd> drill in
            </>
          )}
          {' · '}
          <kbd className="px-1 py-0.5 rounded bg-muted text-[9px]">Tab</kbd> switch
          {' · '}
          <kbd className="px-1 py-0.5 rounded bg-muted text-[9px]">Enter</kbd> select
        </span>
        <span>
          <kbd className="px-1 py-0.5 rounded bg-muted text-[9px]">Esc</kbd> close
        </span>
      </div>
    </div>
  );
};
