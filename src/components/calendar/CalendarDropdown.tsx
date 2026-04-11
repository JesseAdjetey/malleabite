// CalendarDropdown - Main popover dropdown in the Header.
// Shows user profile, collapsible calendar groups, and action buttons.
// Orchestrates GroupSection, GroupManager, and AddCalendarFlow.

import React, { useState, useCallback, useMemo } from 'react';
import { sounds } from '@/lib/sounds';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

import {
  Calendar,
  ChevronDown,
  Plus,
  FolderPlus,
  RefreshCw,
  User,
  FileText,
  FolderInput,
  AlertTriangle,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext.unified';
import { useCalendarGroups } from '@/hooks/use-calendar-groups';
import { useCalendarPreferences } from '@/hooks/use-calendar-preferences';
import { useCalendarSync } from '@/hooks/use-calendar-sync';
import {
  CalendarGroup,
  CalendarSource,
  ConnectedCalendar,
  CALENDAR_SOURCES,
  createConnectedCalendar,
} from '@/types/calendar';
import GroupSection from './GroupSection';
import GroupManager from './GroupManager';
import AddCalendarFlow from './AddCalendarFlow';
import TemplateManager from './TemplateManager';
import MergeCalendarsDialog from './MergeCalendarsDialog';
import { useTemplateEventsLoader, templateCalendarId, TEMPLATE_CALENDAR_PREFIX } from '@/hooks/use-template-events-loader';
import { useCalendarFilterStore } from '@/lib/stores/calendar-filter-store';
import { springs } from '@/lib/animations';
import { toast } from 'sonner';
import { useSyncStatusStore } from '@/lib/stores/sync-status-store';
import { useGoogleSyncBridgeContext } from '@/contexts/GoogleSyncBridgeContext';

// dnd-kit for group reordering
import {
  DndContext,
  closestCenter,
  pointerWithin,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverEvent,
  DragOverlay,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// Custom collision: pointerWithin for calendar→group drags, closestCenter for group reordering
const calendarAwareCollision = (args: any) => {
  if (args.active?.data?.current?.type === 'calendar') {
    return pointerWithin(args);
  }
  return closestCenter(args);
};

// ─── Sortable Group Wrapper ────────────────────────────────────────────────

interface SortableGroupProps {
  group: CalendarGroup;
  children: (handleProps: Record<string, any>, isDragging: boolean) => React.ReactNode;
}

const SortableGroup: React.FC<SortableGroupProps> = ({ group, children }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: group.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    position: 'relative' as const,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      {children({ ...listeners }, isDragging)}
    </div>
  );
};

const CalendarDropdown: React.FC = () => {
  const { user } = useAuth();
  const {
    groups,
    calendars,
    loading: groupsLoading,
    getGroupCalendars,
    createGroup,
    updateGroup,
    deleteGroup,
    addCalendar,
    toggleCalendar,
    deleteCalendar,
    moveCalendar,
    reorderGroups,
  } = useCalendarGroups();

  const {
    expandedGroups,
    toggleGroupExpanded,
    visibleCalendars,
    toggleCalendarVisibility,
    setVisibleCalendars,
  } = useCalendarPreferences();

  const {
    syncState,
    syncAllActive,
    syncCalendar,
  } = useCalendarSync();

  // Load templates (for showing as toggleable calendars in groups)
  const { templates } = useTemplateEventsLoader();

  // Convert templates into virtual ConnectedCalendar entries so they appear
  // alongside real calendars in the sidebar. A template can belong to multiple
  // groups — one entry is created per linked group (same id, different groupId).
  const templateAsCalendars = useMemo((): ConnectedCalendar[] => {
    const result: ConnectedCalendar[] = [];
    templates.forEach((tmpl, idx) => {
      // Resolve linked groups: prefer groupIds[], fall back to targetGroupId for
      // backward compat with existing data.
      const linkedGroupIds: string[] =
        tmpl.groupIds?.length
          ? tmpl.groupIds
          : tmpl.targetGroupId
            ? [tmpl.targetGroupId]
            : [];
      const uniqueGroupIds = [...new Set(linkedGroupIds)];
      uniqueGroupIds.forEach(gid => {
        result.push({
          id: templateCalendarId(tmpl.id), // same ID across groups for event-visibility compat
          source: 'google' as any,
          sourceCalendarId: `template:${tmpl.id}`,
          groupId: gid,
          accountEmail: '',
          accountName: 'Template',
          name: `📋 ${tmpl.name}`,
          color: tmpl.events[0]?.color || '#8B5CF6',
          isActive: tmpl.isActive,
          order: 900 + idx,
          syncEnabled: false,
          syncInterval: 0,
          createdAt: tmpl.createdAt,
          updatedAt: tmpl.updatedAt,
        } satisfies ConnectedCalendar);
      });
    });
    return result;
  }, [templates, groups]);

  // Local UI state
  const [open, setOpen] = useState(false);
  const [groupManagerOpen, setGroupManagerOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<CalendarGroup | null>(null);
  const [addCalendarOpen, setAddCalendarOpen] = useState(false);
  const [addCalendarGroupId, setAddCalendarGroupId] = useState<string | undefined>();
  const [templateManagerOpen, setTemplateManagerOpen] = useState(false);
  const [templateDefaultGroupId, setTemplateDefaultGroupId] = useState<string | undefined>();
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false);
  const [activeCalendar, setActiveCalendar] = useState<ConnectedCalendar | null>(null);
  const [overGroupId, setOverGroupId] = useState<string | null>(null);
  const [reconnecting, setReconnecting] = useState(false);

  // Sync status
  const expiredAccounts = useSyncStatusStore((s) => s.expiredAccounts);
  const bridge = useGoogleSyncBridgeContext();

  // Unique expired Google account emails that have calendars in our groups
  const expiredEmails = useMemo(() => {
    const googleEmails = new Set(
      calendars
        .filter(c => c.source === 'google' && c.accountEmail)
        .map(c => c.accountEmail)
    );
    return [...expiredAccounts].filter(e => googleEmails.has(e));
  }, [expiredAccounts, calendars]);

  // Handlers
  const handleEditGroup = useCallback((group: CalendarGroup) => {
    setEditingGroup(group);
    setGroupManagerOpen(true);
  }, []);

  const handleCreateGroup = useCallback(() => {
    setEditingGroup(null);
    setGroupManagerOpen(true);
  }, []);

  const handleSaveGroup = useCallback(
    async (data: { name: string; icon: CalendarGroup['icon']; color: string }) => {
      if (editingGroup) {
        await updateGroup(editingGroup.id, data);
      } else {
        await createGroup(data.name, data.icon, data.color);
      }
    },
    [editingGroup, updateGroup, createGroup]
  );

  const handleDeleteGroup = useCallback(
    async (groupId: string) => {
      // Move calendars to first available group, or delete if only one
      const otherGroup = groups.find(g => g.id !== groupId);
      await deleteGroup(groupId, otherGroup?.id);
    },
    [groups, deleteGroup]
  );

  const handleAddCalendar = useCallback((groupId: string) => {
    setAddCalendarGroupId(groupId);
    setAddCalendarOpen(true);
  }, []);

  const handleAddCalendarComplete = useCallback(
    async (result: {
      source: CalendarSource;
      selectedCalendars: { id: string; name: string; color: string; primary: boolean }[];
      targetGroupId: string;
      accountEmail?: string;
      googleAccountId?: string;
      msAccountId?: string;
    }) => {
      const addedCalendars: ConnectedCalendar[] = [];
      const nextVisible = new Set(
        visibleCalendars.length > 0
          ? visibleCalendars
          : useCalendarFilterStore.getState().accounts.map((a) => a.id)
      );

      for (const cal of result.selectedCalendars) {
        const data = createConnectedCalendar({
          source: result.source,
          groupId: result.targetGroupId,
          googleAccountId: result.googleAccountId,
          msAccountId: result.msAccountId,
          accountEmail: result.accountEmail || user?.email || '',
          name: cal.name,
          color: cal.color,
          sourceCalendarId: cal.id,
        });
        const saved = await addCalendar(data);
        if (saved) {
          addedCalendars.push(saved);
          // Auto-add to visible calendars so events show immediately
          nextVisible.add(saved.id);
          useCalendarFilterStore.getState().setCalendarVisible(saved.id, true);
        }
      }

      // Persist explicit visibility set once to avoid toggle races
      await setVisibleCalendars(Array.from(nextVisible));

      toast.success(
        `Added ${result.selectedCalendars.length} calendar${result.selectedCalendars.length > 1 ? 's' : ''}`
      );

      // Trigger initial sync for newly added calendars
      for (const cal of addedCalendars) {
        try {
          await syncCalendar(cal);
        } catch (err) {
          // Non-blocking — sync can be retried later
          console.warn('Initial sync failed for', cal.name, err);
        }
      }
    },
    [user, addCalendar, syncCalendar, visibleCalendars, setVisibleCalendars]
  );

  const handleToggleCalendar = useCallback(
    async (calendarId: string, isActive: boolean) => {
      // Read current visible list BEFORE mutating the store.
      // If we read after setCalendarVisible, turning off the last visible calendar
      // produces an empty list which triggers the "show all" fallback — causing
      // every other calendar to switch on unexpectedly.
      const storeState = useCalendarFilterStore.getState();
      let currentVisible = storeState.getVisibleCalendarIds();

      if (currentVisible.length === 0) {
        // No explicit preference set yet — treat all known accounts as visible.
        currentVisible = storeState.accounts.map((a) => a.id);
      }

      const updated = isActive
        ? currentVisible.includes(calendarId)
          ? currentVisible
          : [...currentVisible, calendarId]
        : currentVisible.filter(id => id !== calendarId);

      // Apply immediate visual feedback AFTER computing the correct new list.
      // setCalendarVisible is idempotent so it's safe if the bridge re-runs.
      useCalendarFilterStore.getState().setCalendarVisible(calendarId, isActive);

      await setVisibleCalendars(updated);

      // Check if this is a template calendar
      if (calendarId.startsWith(TEMPLATE_CALENDAR_PREFIX)) {
        const templateId = calendarId.replace(TEMPLATE_CALENDAR_PREFIX, '');
        if (user?.uid) {
          try {
            await import('@/lib/services/calendarService').then(svc =>
              svc.updateCalendarTemplate(user.uid, templateId, { isActive })
            );
          } catch (err) {
            console.error('Failed to toggle template', err);
          }
        }
        return;
      }
      // Fire-and-forget Firestore update (the listener may trigger the bridge,
      // but setCalendarVisible in the bridge is idempotent so it's safe).
      toggleCalendar(calendarId, isActive);

      // If turning ON and we already have this calendar connected, trigger a
      // background sync so events show without requiring manual refresh.
      if (isActive) {
        const selected = calendars.find((c) => c.id === calendarId);
        if (selected) {
          syncCalendar(selected).catch((err) => {
            console.warn('Calendar auto-sync on toggle failed:', selected.name, err);
          });
        }
      }
    },
    [toggleCalendar, setVisibleCalendars, user?.uid, calendars, syncCalendar]
  );

  const handleSync = useCallback(async () => {
    await syncAllActive(calendars);
  }, [syncAllActive, calendars]);

  // Computed
  const activeCount = calendars.filter(c => c.isActive).length;
  const totalCount = calendars.length;

  // Sort groups by order
  const sortedGroups = useMemo(
    () => [...groups].sort((a, b) => a.order - b.order),
    [groups]
  );

  // Enhanced getGroupCalendars that includes templates
  const getGroupCalendarsWithTemplates = useCallback((groupId: string): ConnectedCalendar[] => {
    const realCalendars = getGroupCalendars(groupId);
    const templateCals = templateAsCalendars.filter(tc => tc.groupId === groupId);
    return [...realCalendars, ...templateCals];
  }, [getGroupCalendars, templateAsCalendars]);
  const sortedGroupIds = useMemo(() => sortedGroups.map(g => g.id), [sortedGroups]);

  const handleToggleGroup = useCallback(
    async (groupId: string, makeVisible: boolean) => {
      const groupCalendars = getGroupCalendarsWithTemplates(groupId);

      // Update all calendars in Zustand atomically before touching async paths.
      groupCalendars.forEach(cal => {
        useCalendarFilterStore.getState().setCalendarVisible(cal.id, makeVisible);
      });

      // Compute the new visibility list once (Zustand already reflects all changes above).
      const storeState = useCalendarFilterStore.getState();
      let currentVisible = storeState.getVisibleCalendarIds();
      if (currentVisible.length === 0 && !makeVisible) {
        // Hiding everything — seed from all accounts so the list is explicit.
        currentVisible = [];
      }

      // Single atomic write to preferences (avoids concurrent debouncedSave races).
      await setVisibleCalendars(currentVisible);

      // Fire-and-forget Firestore isActive + sync per calendar.
      for (const cal of groupCalendars) {
        if (cal.id.startsWith(TEMPLATE_CALENDAR_PREFIX)) {
          const templateId = cal.id.replace(TEMPLATE_CALENDAR_PREFIX, '');
          if (user?.uid) {
            import('@/lib/services/calendarService').then(svc =>
              svc.updateCalendarTemplate(user.uid, templateId, { isActive: makeVisible })
            ).catch(err => console.error('Failed to toggle template', err));
          }
          continue;
        }
        toggleCalendar(cal.id, makeVisible);
        if (makeVisible) {
          const connected = calendars.find(c => c.id === cal.id);
          if (connected) {
            syncCalendar(connected).catch(err =>
              console.warn('Calendar auto-sync on group toggle failed:', connected.name, err)
            );
          }
        }
      }
    },
    [getGroupCalendarsWithTemplates, setVisibleCalendars, toggleCalendar, syncCalendar, calendars, user?.uid]
  );

  // dnd-kit sensors (pointer with activation distance to avoid blocking clicks)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  );

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      if (event.active.data.current?.type === 'calendar') {
        setActiveCalendar(event.active.data.current.calendar as ConnectedCalendar);
      }
    },
    []
  );

  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      const { active, over } = event;
      if (active.data.current?.type === 'calendar' && over) {
        setOverGroupId(over.id.toString());
      } else if (!over) {
        setOverGroupId(null);
      }
    },
    []
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveCalendar(null);
      setOverGroupId(null);

      if (!over || active.id === over.id) return;

      // Calendar item drag → move to target group
      if (active.data.current?.type === 'calendar') {
        const calendar = active.data.current.calendar as ConnectedCalendar;
        const targetGroupId = over.id.toString();

        if (!sortedGroups.some(g => g.id === targetGroupId)) return;
        if (calendar.groupId === targetGroupId) return;

        if (calendar.id.startsWith(TEMPLATE_CALENDAR_PREFIX)) {
          const templateId = calendar.id.replace(TEMPLATE_CALENDAR_PREFIX, '');
          if (user?.uid) {
            // Move: remove from source group, add to target group
            const tmpl = templates.find(t => t.id === templateId);
            const currentGroupIds: string[] = tmpl?.groupIds?.length
              ? tmpl.groupIds
              : tmpl?.targetGroupId ? [tmpl.targetGroupId] : [];
            const movedGroupIds = [
              ...currentGroupIds.filter(id => id !== calendar.groupId),
              targetGroupId,
            ];
            import('@/lib/services/calendarService').then(svc =>
              svc.updateCalendarTemplate(user.uid, templateId, {
                groupIds: movedGroupIds,
                targetGroupId,
              })
            );
          }
        } else {
          moveCalendar(calendar.id, targetGroupId);
        }
        const targetGroup = sortedGroups.find(g => g.id === targetGroupId);
        toast.success(`Moved to ${targetGroup?.name || 'group'}`);
        return;
      }

      // Group drag → reorder groups
      const oldIndex = sortedGroups.findIndex(g => g.id === active.id);
      const newIndex = sortedGroups.findIndex(g => g.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;

      const reordered = arrayMove(sortedGroups, oldIndex, newIndex);
      reorderGroups(reordered.map(g => g.id));
    },
    [sortedGroups, reorderGroups, moveCalendar, user?.uid, templates]
  );

  // User display
  const userEmail = user?.email || 'Unknown';
  const userInitial = userEmail.charAt(0).toUpperCase();

  return (
    <>
      <Popover open={open} onOpenChange={(v) => { if (v) sounds.play("drawerOpen"); setOpen(v); }}>
        <PopoverTrigger asChild>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-full',
              'bg-purple-500/10 hover:bg-purple-500/20',
              'text-purple-700 dark:text-purple-300',
              'transition-colors text-sm font-medium',
              'border border-purple-500/20 flex-shrink-0'
            )}
          >
            <div className="w-5 h-5 rounded-full bg-purple-500 flex items-center justify-center text-[10px] text-white font-semibold">
              {userInitial}
            </div>
            <span className="max-w-[100px] truncate hidden sm:inline">
              {userEmail.split('@')[0]}
            </span>
            <Calendar size={14} className="opacity-60" />
            <motion.div
              animate={{ rotate: open ? 180 : 0 }}
              transition={springs.snappy}
            >
              <ChevronDown size={12} className="opacity-50" />
            </motion.div>
          </motion.button>
        </PopoverTrigger>

        <PopoverContent
          align="end"
          sideOffset={8}
          className={cn(
            'w-[320px] max-w-[calc(100vw-12px)] p-0 rounded-2xl border border-border/60',
            'bg-popover/95 backdrop-blur-xl shadow-xl',
            'dark:bg-popover/90',
            'flex flex-col overflow-hidden',
            '[max-height:min(calc(100svh-80px),600px)]'
          )}
        >
          <AnimatePresence>
            {open && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={springs.gentle}
                className="flex flex-col min-h-0 flex-1 overflow-hidden"
              >
                {/* Header / User Info */}
                <div className="px-4 pt-4 pb-2">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center text-sm text-white font-semibold shadow-sm">
                      {userInitial}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-foreground truncate">
                        {userEmail.split('@')[0]}
                      </div>
                      <div className="text-[11px] text-muted-foreground truncate">
                        {userEmail}
                      </div>
                    </div>
                    <div className="text-[10px] text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full">
                      {activeCount}/{totalCount}
                    </div>
                  </div>
                </div>

                <Separator className="opacity-50" />

                {/* Reconnect Banner */}
                {expiredEmails.length > 0 && (
                  <div className="mx-3 mt-2 mb-1 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
                    <div className="flex items-start gap-2">
                      <AlertTriangle size={14} className="text-amber-600 mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
                          Google sync disconnected
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {expiredEmails.length === 1
                            ? `Token expired for ${expiredEmails[0]}`
                            : `Tokens expired for ${expiredEmails.length} accounts`}
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-1.5 h-7 text-[11px] text-amber-700 border-amber-500/30 hover:bg-amber-500/10"
                          disabled={reconnecting}
                          onClick={async () => {
                            if (!bridge) return;
                            setReconnecting(true);
                            for (const email of expiredEmails) {
                              await bridge.reconnectAccount(email);
                            }
                            setReconnecting(false);
                          }}
                        >
                          <RefreshCw size={12} className={cn('mr-1', reconnecting && 'animate-spin')} />
                          {reconnecting ? 'Reconnecting...' : 'Reconnect'}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Calendar Groups */}
                <div className="flex-1 min-h-0 overflow-y-auto">
                  <div className="py-1.5">
                    {groupsLoading ? (
                      <div className="px-4 py-8 text-center">
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                          className="inline-block"
                        >
                          <RefreshCw size={18} className="text-muted-foreground/40" />
                        </motion.div>
                        <p className="text-xs text-muted-foreground mt-2">Loading calendars...</p>
                      </div>
                    ) : sortedGroups.length === 0 ? (
                      <div className="px-4 py-8 text-center">
                        <Calendar size={24} className="mx-auto text-muted-foreground/30 mb-2" />
                        <p className="text-xs text-muted-foreground">No calendar groups yet.</p>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="mt-2 text-xs"
                          onClick={handleCreateGroup}
                        >
                          <Plus size={12} className="mr-1" />
                          Create Group
                        </Button>
                      </div>
                    ) : (
                      <DndContext
                        sensors={sensors}
                        collisionDetection={calendarAwareCollision}
                        onDragStart={handleDragStart}
                        onDragOver={handleDragOver}
                        onDragEnd={handleDragEnd}
                      >
                        <SortableContext
                          items={sortedGroupIds}
                          strategy={verticalListSortingStrategy}
                        >
                          {sortedGroups.map(group => (
                            <SortableGroup key={group.id} group={group}>
                              {(dragHandleProps, isDragging) => (
                                <GroupSection
                                  group={group}
                                  calendars={getGroupCalendarsWithTemplates(group.id)}
                                  isExpanded={expandedGroups.includes(group.id)}
                                  onToggleExpand={toggleGroupExpanded}
                                  onEditGroup={handleEditGroup}
                                  onDeleteGroup={handleDeleteGroup}
                                  onAddCalendar={handleAddCalendar}
                                  onToggleCalendar={handleToggleCalendar}
                                  onDeleteCalendar={async (calendarId) => {
                                    if (calendarId.startsWith(TEMPLATE_CALENDAR_PREFIX)) {
                                      // "Remove" only unlinks the template from this group —
                                      // it stays in the Templates list and any other groups.
                                      const templateId = calendarId.replace(TEMPLATE_CALENDAR_PREFIX, '');
                                      if (user?.uid && templateId) {
                                        try {
                                          const tmpl = templates.find(t => t.id === templateId);
                                          if (tmpl) {
                                            const currentGroupIds: string[] = tmpl.groupIds?.length
                                              ? tmpl.groupIds
                                              : tmpl.targetGroupId ? [tmpl.targetGroupId] : [];
                                            const newGroupIds = currentGroupIds.filter(id => id !== group.id);
                                            await import('@/lib/services/calendarService').then(svc =>
                                              svc.updateCalendarTemplate(user.uid, templateId, {
                                                groupIds: newGroupIds,
                                                targetGroupId: newGroupIds[0],
                                              })
                                            );
                                          }
                                        } catch (err) {
                                          console.error('Failed to unlink template from group', err);
                                        }
                                      }
                                      return;
                                    }
                                    deleteCalendar(calendarId);
                                  }}
                                  onToggleGroup={(makeVisible) => handleToggleGroup(group.id, makeVisible)}
                                  dragHandleProps={dragHandleProps}
                                  isDragging={isDragging}
                                  isDropTarget={overGroupId === group.id && activeCalendar?.groupId !== group.id}
                                />
                              )}
                            </SortableGroup>
                          ))}
                        </SortableContext>
                        <DragOverlay dropAnimation={null}>
                          {activeCalendar && (
                            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-card border border-border shadow-xl max-w-[240px]">
                              <div
                                className="w-3 h-3 rounded-full flex-shrink-0"
                                style={{ backgroundColor: activeCalendar.color }}
                              />
                              <span className="text-sm font-medium truncate">
                                {activeCalendar.name}
                              </span>
                            </div>
                          )}
                        </DragOverlay>
                      </DndContext>
                    )}
                  </div>
                </div>

                <Separator className="opacity-50" />

                {/* Footer Actions */}
                <div className="p-2">
                  <div className="grid grid-cols-2 gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="justify-start text-xs h-8 gap-1.5 text-muted-foreground hover:text-foreground"
                      onClick={() => {
                        setAddCalendarGroupId(undefined);
                        setAddCalendarOpen(true);
                      }}
                    >
                      <Plus size={13} />
                      Add Calendar
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      className="justify-start text-xs h-8 gap-1.5 text-muted-foreground hover:text-foreground"
                      onClick={handleCreateGroup}
                    >
                      <FolderPlus size={13} />
                      New Group
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      className="justify-start text-xs h-8 gap-1.5 text-muted-foreground hover:text-foreground"
                      onClick={() => {
                        setOpen(false);
                        setTemplateManagerOpen(true);
                      }}
                    >
                      <FileText size={13} />
                      Templates
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      className="justify-start text-xs h-8 gap-1.5 text-muted-foreground hover:text-foreground"
                      onClick={() => setMergeDialogOpen(true)}
                    >
                      <FolderInput size={13} />
                      Merge
                    </Button>
                  </div>

                  <div className="flex justify-end mt-0.5">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-foreground"
                      onClick={handleSync}
                      disabled={syncState.status === 'syncing'}
                    >
                      <motion.div
                        animate={syncState.status === 'syncing' ? { rotate: 360 } : {}}
                        transition={
                          syncState.status === 'syncing'
                            ? { repeat: Infinity, duration: 1, ease: 'linear' }
                            : {}
                        }
                      >
                        <RefreshCw size={13} />
                      </motion.div>
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </PopoverContent>
      </Popover>

      {/* Group Manager Dialog */}
      <GroupManager
        open={groupManagerOpen}
        onOpenChange={setGroupManagerOpen}
        group={editingGroup}
        onSave={handleSaveGroup}
        onDelete={editingGroup ? () => handleDeleteGroup(editingGroup.id) : undefined}
      />

      {/* Add Calendar Flow Dialog */}
      <AddCalendarFlow
        open={addCalendarOpen}
        onOpenChange={setAddCalendarOpen}
        groups={groups}
        defaultGroupId={addCalendarGroupId}
        onOpenTemplates={(groupId) => {
          setOpen(false);
          setTemplateDefaultGroupId(groupId);
          setTemplateManagerOpen(true);
        }}
        onComplete={handleAddCalendarComplete}
      />

      {/* Template Manager Dialog */}
      <TemplateManager
        open={templateManagerOpen}
        onOpenChange={(v) => {
          setTemplateManagerOpen(v);
          if (!v) setTemplateDefaultGroupId(undefined);
        }}
        defaultGroupId={templateDefaultGroupId}
      />

      {/* Merge Calendars Dialog */}
      <MergeCalendarsDialog
        open={mergeDialogOpen}
        onOpenChange={setMergeDialogOpen}
      />
    </>
  );
};

export default CalendarDropdown;
