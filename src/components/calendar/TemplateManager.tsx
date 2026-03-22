// TemplateManager - Create and manage calendar templates.
// V2: Uses visual calendar-based template creation (template mode on the main view).
// The old form-based editor is replaced by entering template editing mode
// directly on the week/day view where users can create events visually.

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Plus,
  Trash2,
  Pencil,
  Calendar,
  Layers,
  FolderOpen,
  ArrowLeft,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext.unified';
import {
  CalendarTemplate,
  CalendarGroup,
  ConnectedCalendar,
} from '@/types/calendar';
import * as calendarService from '@/lib/services/calendarService';
import { useTemplateModeStore } from '@/lib/stores/template-mode-store';
import { useCalendarEvents } from '@/hooks/use-calendar-events.unified';
import { springs } from '@/lib/animations';
import { toast } from 'sonner';
import dayjs from 'dayjs';
import { nanoid } from 'nanoid';
import { CalendarEventType } from '@/lib/stores/types';

const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// ─── Template Manager ───────────────────────────────────────────────────

interface TemplateManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultGroupId?: string;
}

type View = 'list' | 'group-picker';

const TemplateManager: React.FC<TemplateManagerProps> = ({ open, onOpenChange, defaultGroupId }) => {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<CalendarTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  // Inline delete confirmation — stores the template ID pending confirmation
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  // Single-dialog view switching (list → group-picker) to avoid stacked dialog focus traps
  const [view, setView] = useState<View>('list');
  const [applyingTemplate, setApplyingTemplate] = useState<CalendarTemplate | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

  // Group selection state for applying templates
  const [groups, setGroups] = useState<CalendarGroup[]>([]);
  const [calendars, setCalendars] = useState<ConnectedCalendar[]>([]);

  const enterTemplateMode = useTemplateModeStore(s => s.enterTemplateMode);
  const { addEvent: persistEvent } = useCalendarEvents();

  // Avoid showing the loading spinner on re-opens once data is cached
  const hasLoadedRef = useRef(false);

  // Load templates + groups + calendars
  const loadTemplates = useCallback(async () => {
    if (!user?.uid) return;
    if (!hasLoadedRef.current) setLoading(true);
    const [data, grps, cals] = await Promise.all([
      calendarService.getCalendarTemplates(user.uid),
      calendarService.getCalendarGroups(user.uid),
      calendarService.getConnectedCalendars(user.uid),
    ]);
    setTemplates(data);
    setGroups(grps);
    setCalendars(cals);
    setLoading(false);
    hasLoadedRef.current = true;
  }, [user?.uid]);

  useEffect(() => {
    if (open) {
      loadTemplates();
    }
  }, [open, loadTemplates]);

  // Reset view when the dialog closes
  const handleOpenChange = (v: boolean) => {
    if (!v) {
      setView('list');
      setApplyingTemplate(null);
      setSelectedGroupId(null);
      setPendingDeleteId(null);
    }
    onOpenChange(v);
  };

  // ─── Create Template ──────────────────────────────────────────────────

  const handleCreate = () => {
    handleOpenChange(false);
    enterTemplateMode({ name: '' });
    toast.info('Template mode active — add events to your calendar, then save');
  };

  // ─── Edit Template ────────────────────────────────────────────────────

  const handleEdit = (template: CalendarTemplate) => {
    handleOpenChange(false);

    const today = dayjs();
    const startOfWeek = today.startOf('week');

    const draftEvents: CalendarEventType[] = template.events.map((tmplEvt) => {
      const eventDay = startOfWeek.add(tmplEvt.dayOfWeek, 'day');
      const [sh, sm] = (tmplEvt.startTime || '09:00').split(':').map(Number);
      const [eh, em] = (tmplEvt.endTime || '10:00').split(':').map(Number);

      const recurrenceRule = tmplEvt.recurrenceRule || {
        frequency: 'weekly' as const,
        interval: 1,
        daysOfWeek: [tmplEvt.dayOfWeek],
      };

      return {
        id: nanoid(),
        title: tmplEvt.title,
        description: tmplEvt.description || '',
        startsAt: eventDay.hour(sh).minute(sm).second(0).toISOString(),
        endsAt: eventDay.hour(eh).minute(em).second(0).toISOString(),
        color: tmplEvt.color || '#8B5CF6',
        date: eventDay.format('YYYY-MM-DD'),
        timeStart: tmplEvt.startTime,
        timeEnd: tmplEvt.endTime,
        isAllDay: tmplEvt.isAllDay || false,
        isRecurring: tmplEvt.isRecurring !== false,
        recurrenceRule,
      };
    });

    enterTemplateMode({
      templateId: template.id,
      name: template.name,
      description: template.description || '',
      events: draftEvents,
    });

    toast.info(`Editing template "${template.name}" — modify events, then save`);
  };

  // ─── Helper: next upcoming occurrence of a weekday ────────────────────
  // If the weekday slot has already passed this week, roll to next week so
  // events are never silently skipped (e.g. applying on a Saturday when all
  // template events are Mon–Fri).

  const nextOccurrence = (startOfWeek: dayjs.Dayjs, dayOfWeek: number): dayjs.Dayjs => {
    const candidate = startOfWeek.add(dayOfWeek, 'day');
    const today = dayjs();
    return candidate.isBefore(today, 'day') ? candidate.add(7, 'day') : candidate;
  };

  // ─── Apply a template to a specific group ────────────────────────────

  const applyToGroup = async (template: CalendarTemplate, groupId: string) => {
    if (!user?.uid) return;

    const calendar = calendars.find(c => c.groupId === groupId && c.isActive);
    const calendarId = calendar?.id || undefined;

    const today = dayjs();
    const startOfWeek = today.startOf('week');
    let created = 0;

    for (const tmplEvent of template.events) {
      const eventDay = nextOccurrence(startOfWeek, tmplEvent.dayOfWeek);
      const [sh, sm] = (tmplEvent.startTime || '09:00').split(':').map(Number);
      const [eh, em] = (tmplEvent.endTime || '10:00').split(':').map(Number);

      const recurrenceRule = tmplEvent.recurrenceRule || {
        frequency: 'weekly' as const,
        interval: 1,
        daysOfWeek: [tmplEvent.dayOfWeek],
      };

      const startDayjs = eventDay.hour(sh).minute(sm).second(0).millisecond(0);
      const endDayjs = eventDay.hour(eh).minute(em).second(0).millisecond(0);

      const event: CalendarEventType = {
        id: nanoid(),
        title: tmplEvent.title,
        description: tmplEvent.description || '',
        startsAt: startDayjs.toISOString(),
        endsAt: endDayjs.toISOString(),
        color: tmplEvent.color || '#8B5CF6',
        date: startDayjs.toDate(),
        timeStart: tmplEvent.startTime,
        timeEnd: tmplEvent.endTime,
        calendarId,
        isRecurring: tmplEvent.isRecurring !== false,
        recurrenceRule,
      };

      await persistEvent(event);
      created++;
    }

    const groupName = groups.find(g => g.id === groupId)?.name || 'the group';
    if (created > 0) {
      toast.success(`Applied ${created} event${created !== 1 ? 's' : ''} from "${template.name}" to ${groupName}`);
    } else {
      toast.info('No events to apply from this template');
    }
  };

  // ─── Apply Template — direct or via group picker ──────────────────────

  const handleApplyClick = async (template: CalendarTemplate) => {
    if (defaultGroupId) {
      // Group already known — apply and close so the user sees clear feedback
      // (staying on the list with no visible change feels like nothing happened)
      await applyToGroup(template, defaultGroupId);
      handleOpenChange(false);
      return;
    }
    // No group pre-selected — switch to the group-picker view within the same dialog
    const preSelectedGroupId =
      template.targetGroupId ||
      groups.find(g => g.name.toLowerCase() === 'personal')?.id ||
      groups[0]?.id ||
      null;
    setSelectedGroupId(preSelectedGroupId);
    setApplyingTemplate(template);
    setView('group-picker');
  };

  const handleApplyConfirm = async () => {
    if (!applyingTemplate || !selectedGroupId || !user?.uid) return;

    await applyToGroup(applyingTemplate, selectedGroupId);

    // Remember the selected group on the template for next time
    if (applyingTemplate.targetGroupId !== selectedGroupId) {
      try {
        await calendarService.updateCalendarTemplate(user.uid, applyingTemplate.id, {
          targetGroupId: selectedGroupId,
        });
        setTemplates(prev => prev.map(t =>
          t.id === applyingTemplate.id ? { ...t, targetGroupId: selectedGroupId } : t
        ));
      } catch {
        // Non-critical
      }
    }

    setApplyingTemplate(null);
    setSelectedGroupId(null);
    setView('list');
  };

  // ─── Delete Template ──────────────────────────────────────────────────

  const handleDelete = async (templateId: string) => {
    if (!user?.uid) return;
    await calendarService.deleteCalendarTemplate(user.uid, templateId);
    toast.success('Template deleted');
    setTemplates(prev => prev.filter(t => t.id !== templateId));
    setPendingDeleteId(null);
  };

  // ─── Render ───────────────────────────────────────────────────────────

  const isGroupPickerView = view === 'group-picker';

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-sm max-h-[80vh] overflow-hidden flex flex-col gap-0">
        <DialogHeader>
          <DialogTitle className="text-title3">
            {isGroupPickerView ? 'Add to Calendar' : 'Calendar Templates'}
          </DialogTitle>
          <DialogDescription>
            {isGroupPickerView
              ? `Choose which group to add "${applyingTemplate?.name}" to.`
              : 'Create templates visually on your calendar, then apply them anytime.'}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 min-h-0 overflow-y-auto">
          <div className="space-y-2 py-2">
            {/* ── Group Picker View ── */}
            {isGroupPickerView && (
              <>
                {groups.map((group) => {
                  const isSelected = selectedGroupId === group.id;
                  const calCount = calendars.filter(c => c.groupId === group.id).length;
                  return (
                    <button
                      key={group.id}
                      onClick={() => setSelectedGroupId(group.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all
                        ${isSelected
                          ? 'bg-primary/10 border border-primary/30 ring-1 ring-primary/20'
                          : 'border border-border/50 hover:border-border/80 hover:bg-muted/30'
                        }`}
                    >
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: group.color + '20' }}
                      >
                        <FolderOpen size={14} style={{ color: group.color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{group.name}</div>
                        <div className="text-[10px] text-muted-foreground/60">
                          {calCount} calendar{calCount !== 1 ? 's' : ''}
                        </div>
                      </div>
                      {isSelected && (
                        <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
                      )}
                    </button>
                  );
                })}
                {groups.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">No groups found.</p>
                )}
              </>
            )}

            {/* ── Template List View ── */}
            {!isGroupPickerView && (
              <>
                {loading ? (
                  <div className="py-8 text-center text-sm text-muted-foreground">
                    Loading templates...
                  </div>
                ) : templates.length === 0 ? (
                  <div className="py-8 text-center">
                    <Layers size={28} className="mx-auto text-muted-foreground/30 mb-2" />
                    <p className="text-sm text-muted-foreground mb-1">No templates yet.</p>
                    <p className="text-[11px] text-muted-foreground/60 mb-4 max-w-[200px] mx-auto">
                      Create a template by adding events visually on your calendar.
                    </p>
                    <Button size="sm" onClick={handleCreate} className="gap-1.5">
                      <Plus size={14} />
                      Create Template
                    </Button>
                  </div>
                ) : (
                  <AnimatePresence>
                    {templates.map(tmpl => {
                      const isPendingDelete = pendingDeleteId === tmpl.id;
                      return (
                        <motion.div
                          key={tmpl.id}
                          layout
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -4 }}
                          transition={springs.gentle}
                          className={`border rounded-xl p-3 transition-colors ${
                            isPendingDelete
                              ? 'border-destructive/40 bg-destructive/5'
                              : 'border-border/50 hover:border-border/80'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            {/* Clickable content area */}
                            <button
                              type="button"
                              className="flex items-start gap-3 flex-1 min-w-0 text-left"
                              onClick={() => !isPendingDelete && handleApplyClick(tmpl)}
                              title={defaultGroupId ? 'Click to add to calendar' : 'Click to choose group'}
                            >
                              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                                <Calendar size={14} className="text-primary" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-semibold truncate">{tmpl.name}</div>
                                {tmpl.description && (
                                  <div className="text-[11px] text-muted-foreground truncate mt-0.5">
                                    {tmpl.description}
                                  </div>
                                )}
                                <div className="text-[10px] text-muted-foreground/60 mt-1 flex items-center gap-2 flex-wrap">
                                  <span>{tmpl.events.length} event{tmpl.events.length !== 1 ? 's' : ''}</span>
                                  {tmpl.events.slice(0, 3).map((evt, i) => (
                                    <span key={i} className="inline-flex items-center gap-0.5">
                                      <span
                                        className="w-1.5 h-1.5 rounded-full inline-block"
                                        style={{ backgroundColor: evt.color || '#8B5CF6' }}
                                      />
                                      {DAY_SHORT[evt.dayOfWeek]}
                                    </span>
                                  ))}
                                  {tmpl.events.length > 3 && (
                                    <span className="text-muted-foreground/40">+{tmpl.events.length - 3}</span>
                                  )}
                                </div>
                              </div>
                            </button>

                            {/* Action buttons — or inline delete confirmation */}
                            {isPendingDelete ? (
                              <div className="flex items-center gap-1.5 flex-shrink-0">
                                <span className="text-[11px] text-destructive/80 font-medium">Delete?</span>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 px-2 text-xs"
                                  onClick={() => setPendingDeleteId(null)}
                                >
                                  No
                                </Button>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  className="h-6 px-2 text-xs"
                                  onClick={() => handleDelete(tmpl.id)}
                                >
                                  Yes
                                </Button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1 flex-shrink-0">
                                {/* Add to calendar */}
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-primary/60 hover:text-primary"
                                  onClick={() => handleApplyClick(tmpl)}
                                  title="Add to calendar"
                                >
                                  <Plus size={13} />
                                </Button>
                                {/* Edit */}
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => handleEdit(tmpl)}
                                  title="Edit on calendar"
                                >
                                  <Pencil size={13} />
                                </Button>
                                {/* Delete */}
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-destructive/60 hover:text-destructive"
                                  onClick={() => setPendingDeleteId(tmpl.id)}
                                  title="Delete template"
                                >
                                  <Trash2 size={13} />
                                </Button>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                )}
              </>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="mt-0 pt-3 border-t border-border/50">
          {isGroupPickerView ? (
            <>
              <Button
                variant="outline"
                onClick={() => {
                  setView('list');
                  setApplyingTemplate(null);
                  setSelectedGroupId(null);
                }}
              >
                <ArrowLeft size={14} className="mr-1" />
                Back
              </Button>
              <Button
                disabled={!selectedGroupId}
                onClick={handleApplyConfirm}
                className="gap-1.5"
              >
                <Plus size={14} />
                Add to Calendar
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => handleOpenChange(false)}>
                Close
              </Button>
              <Button onClick={handleCreate} className="gap-1.5">
                <Plus size={14} />
                New Template
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default TemplateManager;
