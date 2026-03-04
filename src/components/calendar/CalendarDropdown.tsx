// CalendarDropdown - Main popover dropdown in the Header.
// Shows user profile, collapsible calendar groups, and action buttons.
// Orchestrates GroupSection, GroupManager, and AddCalendarFlow.

import React, { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Calendar,
  ChevronDown,
  Plus,
  FolderPlus,
  RefreshCw,
  User,
  FileText,
  FolderInput,
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

// dnd-kit for group reordering
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

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

  // Convert active templates into virtual ConnectedCalendar entries
  // so they appear alongside real calendars in the sidebar
  const templateAsCalendars = useMemo((): ConnectedCalendar[] => {
    return templates.map((tmpl) => {
      const calId = templateCalendarId(tmpl.id);
      // Put template in its target group, or first group if none assigned
      const groupId = tmpl.targetGroupId || groups[0]?.id || '';
      return {
        id: calId,
        source: 'google' as any, // placeholder type
        sourceCalendarId: `template:${tmpl.id}`,
        groupId,
        accountEmail: '',
        accountName: 'Template',
        name: `📋 ${tmpl.name}`,
        color: tmpl.events[0]?.color || '#8B5CF6',
        isActive: tmpl.isActive,
        order: 900 + templates.indexOf(tmpl), // sort after real calendars
        syncEnabled: false,
        syncInterval: 0,
        createdAt: tmpl.createdAt,
        updatedAt: tmpl.updatedAt,
      } satisfies ConnectedCalendar;
    });
  }, [templates, groups]);

  // Local UI state
  const [open, setOpen] = useState(false);
  const [groupManagerOpen, setGroupManagerOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<CalendarGroup | null>(null);
  const [addCalendarOpen, setAddCalendarOpen] = useState(false);
  const [addCalendarGroupId, setAddCalendarGroupId] = useState<string | undefined>();
  const [templateManagerOpen, setTemplateManagerOpen] = useState(false);
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false);

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
    }) => {
      const addedCalendars: ConnectedCalendar[] = [];
      for (const cal of result.selectedCalendars) {
        const data = createConnectedCalendar({
          source: result.source,
          groupId: result.targetGroupId,
          accountEmail: result.accountEmail || user?.email || '',
          name: cal.name,
          color: cal.color,
          sourceCalendarId: cal.id,
        });
        const saved = await addCalendar(data);
        if (saved) {
          addedCalendars.push(saved);
          // Auto-add to visible calendars so events show immediately
          const currentVisible = visibleCalendars ?? [];
          if (!currentVisible.includes(saved.id)) {
            await toggleCalendarVisibility(saved.id);
          }
        }
      }
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
    [user, addCalendar, syncCalendar, visibleCalendars, toggleCalendarVisibility]
  );

  const handleToggleCalendar = useCallback(
    async (calendarId: string, isActive: boolean) => {
      // Immediately & idempotently set the filter store for instant visual feedback.
      // Using setCalendarVisible (not toggleVisibility) prevents double-toggle if
      // the bridge effect re-runs before preferences are saved.
      useCalendarFilterStore.getState().setCalendarVisible(calendarId, isActive);

      // Explicitly SET visibility preference to match the desired state.
      // Using an explicit set (not toggle) prevents desync when the preference
      // list doesn't match ConnectedCalendar.isActive (which caused Personal
      // calendar to have inverse toggle behavior).
      let currentVisible = visibleCalendars.length > 0
        ? [...visibleCalendars]
        : useCalendarFilterStore.getState().accounts.map(a => a.id);
      
      const updated = isActive
        ? currentVisible.includes(calendarId)
          ? currentVisible
          : [...currentVisible, calendarId]
        : currentVisible.filter(id => id !== calendarId);
      
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
    },
    [toggleCalendar, visibleCalendars, setVisibleCalendars, user?.uid]
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

  // dnd-kit sensors (pointer with activation distance to avoid blocking clicks)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = sortedGroups.findIndex(g => g.id === active.id);
      const newIndex = sortedGroups.findIndex(g => g.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;

      const reordered = arrayMove(sortedGroups, oldIndex, newIndex);
      reorderGroups(reordered.map(g => g.id));
    },
    [sortedGroups, reorderGroups]
  );

  // User display
  const userEmail = user?.email || 'Unknown';
  const userInitial = userEmail.charAt(0).toUpperCase();

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
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
            'w-[320px] p-0 rounded-2xl border border-border/60',
            'bg-popover/95 backdrop-blur-xl shadow-xl',
            'dark:bg-popover/90'
          )}
        >
          <AnimatePresence>
            {open && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={springs.gentle}
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

                {/* Calendar Groups */}
                <ScrollArea className="max-h-[360px]">
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
                        collisionDetection={closestCenter}
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
                                  onDeleteCalendar={deleteCalendar}
                                  dragHandleProps={dragHandleProps}
                                  isDragging={isDragging}
                                />
                              )}
                            </SortableGroup>
                          ))}
                        </SortableContext>
                      </DndContext>
                    )}
                  </div>
                </ScrollArea>

                <Separator className="opacity-50" />

                {/* Footer Actions */}
                <div className="p-2 flex items-center gap-1 flex-wrap">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex-1 justify-start text-xs h-8 gap-1.5 text-muted-foreground hover:text-foreground"
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
                    className="flex-1 justify-start text-xs h-8 gap-1.5 text-muted-foreground hover:text-foreground"
                    onClick={handleCreateGroup}
                  >
                    <FolderPlus size={13} />
                    New Group
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex-1 justify-start text-xs h-8 gap-1.5 text-muted-foreground hover:text-foreground"
                    onClick={() => setTemplateManagerOpen(true)}
                  >
                    <FileText size={13} />
                    Templates
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex-1 justify-start text-xs h-8 gap-1.5 text-muted-foreground hover:text-foreground"
                    onClick={() => setMergeDialogOpen(true)}
                  >
                    <FolderInput size={13} />
                    Merge
                  </Button>

                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
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
        onComplete={handleAddCalendarComplete}
      />

      {/* Template Manager Dialog */}
      <TemplateManager
        open={templateManagerOpen}
        onOpenChange={setTemplateManagerOpen}
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
