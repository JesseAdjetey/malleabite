
import React, { useState, useEffect, useMemo } from 'react';
import ModuleContainer from './ModuleContainer';
import { Bell, Calendar, Clock, Volume2, Plus, Edit2, Trash2, Play, AlarmClock } from 'lucide-react';
import { useReminders, Reminder, ReminderFormData } from '@/hooks/use-reminders';
import { useAlarms, Alarm } from '@/hooks/use-alarms';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { useCalendarEvents } from '@/hooks/use-calendar-events';
import { Input } from '@/components/ui/input';
import { Form, FormField, FormItem, FormLabel, FormControl } from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import dayjs from 'dayjs';
import { Timestamp } from 'firebase/firestore';

// Helper to handle both Date/string and Firestore Timestamp
const resolveDate = (date: any) => {
  if (date?.toDate && typeof date.toDate === 'function') {
    return date.toDate();
  }
  return date;
};

const reminderFormSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  reminderTime: z.string().refine((val) => val !== '' && !isNaN(Date.parse(val)), {
    message: 'Valid time is required',
  }),
  soundId: z.string().optional(),
});

interface RemindersModuleProps {
  title?: string;
  onRemove?: () => void;
  onTitleChange?: (title: string) => void;
  onMinimize?: () => void;
  isMinimized?: boolean;
  isDragging?: boolean;
}

const RemindersModule: React.FC<RemindersModuleProps> = ({
  title = "Reminders",
  onRemove,
  onTitleChange,
  onMinimize,
  isMinimized = false,
  isDragging = false
}) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedReminder, setSelectedReminder] = useState<Reminder | null>(null);
  const { reminders, loading, addReminder, updateReminder, deleteReminder, toggleReminderActive, playSound, getSounds, REMINDER_SOUNDS } = useReminders();
  const { alarms, loading: alarmsLoading, toggleAlarm, deleteAlarm } = useAlarms();
  const { events } = useCalendarEvents();

  // Combine reminders and alarms into a single sorted list
  const allItems = useMemo(() => {
    const items = [
      ...reminders.map(r => ({
        ...r,
        type: 'reminder' as const,
        sortTime: dayjs(resolveDate(r.reminderTime)).valueOf()
      })),
      ...alarms.map(a => ({
        ...a,
        type: 'alarm' as const,
        sortTime: dayjs(a.time).valueOf()
      }))
    ];
    return items.sort((a, b) => a.sortTime - b.sortTime);
  }, [reminders, alarms]);

  const form = useForm<ReminderFormData>({
    resolver: zodResolver(reminderFormSchema),
    defaultValues: {
      title: '',
      description: '',
      reminderTime: dayjs().add(1, 'hour').format('YYYY-MM-DDTHH:mm'),
      soundId: 'default'
    }
  });

  // Reset form when opening dialog or changing editing state
  useEffect(() => {
    if (isDialogOpen) {
      if (isEditing && selectedReminder) {
        form.reset({
          title: selectedReminder.title,
          description: selectedReminder.description || '',
          reminderTime: dayjs(resolveDate(selectedReminder.reminderTime)).format('YYYY-MM-DDTHH:mm'),
          eventId: selectedReminder.eventId || undefined,
          timeBeforeMinutes: selectedReminder.timeBeforeMinutes || undefined,
          timeAfterMinutes: selectedReminder.timeAfterMinutes || undefined,
          soundId: selectedReminder.soundId || 'default'
        });
      } else {
        form.reset({
          title: '',
          description: '',
          reminderTime: dayjs().add(1, 'hour').format('YYYY-MM-DDTHH:mm'),
          soundId: 'default'
        });
      }
    }
  }, [isDialogOpen, isEditing, selectedReminder, form]);

  const handleSubmit = async (data: ReminderFormData) => {
    try {
      if (isEditing && selectedReminder) {
        await updateReminder(selectedReminder.id, data);
      } else {
        await addReminder(data);
      }
      setIsDialogOpen(false);
    } catch (error) {
      console.error('Error saving reminder:', error);
      toast.error('Failed to save reminder');
    }
  };

  const openEditDialog = (reminder: Reminder) => {
    setSelectedReminder(reminder);
    setIsEditing(true);
    setIsDialogOpen(true);
  };

  const handleDelete = async (reminder: Reminder) => {
    if (confirm(`Are you sure you want to delete the reminder "${reminder.title}"?`)) {
      await deleteReminder(reminder.id);
    }
  };

  const handleToggleActive = async (reminder: Reminder) => {
    await toggleReminderActive(reminder.id, !reminder.isActive);
  };

  const formatReminderTime = (time: string | Timestamp | Date) => {
    const now = dayjs();
    const reminderTime = dayjs(resolveDate(time));

    if (reminderTime.isSame(now, 'day')) {
      return `Today at ${reminderTime.format('h:mm A')}`;
    } else if (reminderTime.isSame(now.add(1, 'day'), 'day')) {
      return `Tomorrow at ${reminderTime.format('h:mm A')}`;
    } else {
      return reminderTime.format('MMM D [at] h:mm A');
    }
  };

  const handleTestSound = (soundId: string) => {
    playSound(soundId);
  };

  return (
    <ModuleContainer
      title={title}
      onRemove={onRemove}
      onTitleChange={onTitleChange}
      onMinimize={onMinimize}
      isMinimized={isMinimized}
      isDragging={isDragging}
    >
      <div className="space-y-3">
        {/* Combined Reminders and Alarms list */}
        <div className="max-h-60 overflow-y-auto space-y-2">
          {(loading || alarmsLoading) ? (
            <div className="text-center py-4 opacity-70">Loading...</div>
          ) : allItems.length === 0 ? (
            <div className="text-center py-6 opacity-70">
              <Bell className="mx-auto h-8 w-8 mb-2 opacity-50" />
              <p>No reminders set</p>
              <p className="text-xs">Create one to get started</p>
            </div>
          ) : (
            allItems.map((item) => (
              item.type === 'alarm' ? (
                // Alarm item
                <div
                  key={`alarm-${item.id}`}
                  className={`flex items-start gap-2 p-2 rounded-lg transition-colors ${item.enabled ? 'bg-blue-100/50 dark:bg-blue-900/30' : 'bg-gray-100/50 dark:bg-gray-800/30 opacity-60'}`}
                >
                  <div className="mt-1 flex-shrink-0">
                    <AlarmClock size={16} className={item.enabled ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400'} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start">
                      <h4 className={`font-medium text-sm truncate text-gray-800 dark:text-white ${!item.enabled && 'line-through opacity-70'}`}>
                        {item.title}
                      </h4>
                      <div className="flex gap-1 ml-1">
                        <button
                          onClick={() => toggleAlarm(item.id!, !item.enabled)}
                          className={`text-xs px-2 py-0.5 rounded ${item.enabled ? 'bg-blue-500/20 text-blue-700 dark:text-blue-300' : 'bg-gray-500/20 text-gray-600 dark:text-gray-400'}`}
                          title={item.enabled ? 'Disable alarm' : 'Enable alarm'}
                        >
                          {item.enabled ? 'ON' : 'OFF'}
                        </button>
                        <button
                          onClick={() => deleteAlarm(item.id!)}
                          className="text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 p-1 rounded hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors"
                          title="Delete alarm"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                    <div className="text-xs text-gray-700 dark:text-gray-300 mt-1">
                      <div className="flex items-center gap-1">
                        <Clock size={12} className="opacity-70" />
                        <span>{formatReminderTime(typeof item.time === 'string' ? item.time : item.time.toISOString())}</span>
                      </div>
                      {item.repeatDays && item.repeatDays.length > 0 && (
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          Repeats: {item.repeatDays.map(d => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d]).join(', ')}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                // Reminder item
                <div
                  key={`reminder-${item.id}`}
                  className={`flex items-start gap-2 p-2 rounded-lg transition-colors ${item.isActive ? 'bg-purple-100/50 dark:bg-purple-900/30' : 'bg-gray-100/50 dark:bg-gray-800/30 opacity-60'}`}
                >
                  <div
                    className={`mt-1 w-4 h-4 rounded-full flex-shrink-0 cursor-pointer ${item.isActive ? 'bg-primary' : 'bg-gray-400 dark:bg-secondary'}`}
                    onClick={() => handleToggleActive(item as Reminder)}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start">
                      <h4 className={`font-medium text-sm truncate text-gray-800 dark:text-white ${!item.isActive && 'line-through opacity-70'}`}>
                        {item.title}
                      </h4>
                      <div className="flex gap-1 ml-1">
                        <button
                          onClick={() => handleTestSound(item.soundId || 'default')}
                          className="text-purple-600 dark:text-purple-400 hover:text-purple-800 dark:hover:text-purple-300 p-1 rounded hover:bg-purple-100 dark:hover:bg-purple-500/20 transition-colors"
                          title="Test sound"
                        >
                          <Play size={14} />
                        </button>
                        <button
                          onClick={() => openEditDialog(item as Reminder)}
                          className="text-purple-600 dark:text-purple-400 hover:text-purple-800 dark:hover:text-purple-300 p-1 rounded hover:bg-purple-100 dark:hover:bg-purple-500/20 transition-colors"
                          title="Edit reminder"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => handleDelete(item as Reminder)}
                          className="text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 p-1 rounded hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors"
                          title="Delete reminder"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    <div className="text-xs text-gray-700 dark:text-gray-300 mt-1 space-y-1">
                      {item.description && (
                        <p className="truncate text-gray-600 dark:text-gray-400">{item.description}</p>
                      )}

                      <div className="flex items-center gap-1 text-gray-700 dark:text-gray-300">
                        <Clock size={12} />
                        <span>{formatReminderTime(item.reminderTime)}</span>
                      </div>

                      {item.event && (
                        <div className="flex items-center gap-1 text-gray-700 dark:text-gray-300">
                          <Calendar size={12} />
                          <span className="truncate">{item.event.title}</span>
                        </div>
                      )}

                      {(item.timeBeforeMinutes || item.timeAfterMinutes) && (
                        <div className="flex items-center gap-2 text-xs">
                          {item.timeBeforeMinutes && (
                            <span className="bg-gray-200 dark:bg-white/10 text-gray-700 dark:text-gray-300 px-1.5 py-0.5 rounded-sm">
                              {item.timeBeforeMinutes}m before
                            </span>
                          )}
                          {item.timeAfterMinutes && (
                            <span className="bg-gray-200 dark:bg-white/10 text-gray-700 dark:text-gray-300 px-1.5 py-0.5 rounded-sm">
                              {item.timeAfterMinutes}m after
                            </span>
                          )}
                        </div>
                      )}

                      <div className="flex items-center gap-1 text-gray-700 dark:text-gray-300">
                        <Volume2 size={12} />
                        <span>
                          {REMINDER_SOUNDS.find(s => s.id === item.soundId)?.name || 'Default'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )
            ))
          )}
        </div>

        {/* Add reminder button */}
        <button
          onClick={() => {
            setIsEditing(false);
            setSelectedReminder(null);
            setIsDialogOpen(true);
          }}
          className="bg-primary px-3 py-2 w-full rounded-md hover:bg-primary/80 transition-colors flex items-center justify-center gap-2 text-white font-medium"
        >
          <Plus size={16} className="flex-shrink-0" />
          <span>Add Reminder</span>
        </button>
      </div>

      {/* Add/Edit Reminder Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px] bg-background/95 border-white/10">
          <DialogHeader>
            <DialogTitle>{isEditing ? 'Edit Reminder' : 'New Reminder'}</DialogTitle>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Reminder title"
                        {...field}
                        className="glass-input"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description (optional)</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Add details..."
                        {...field}
                        className="glass-input"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="reminderTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reminder Time</FormLabel>
                    <FormControl>
                      <Input
                        type="datetime-local"
                        {...field}
                        className="glass-input"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="eventId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Link to Event (optional)</FormLabel>
                    <FormControl>
                      <select
                        {...field}
                        className="glass-input w-full h-10 px-3"
                        value={field.value || ''}
                      >
                        <option value="">No linked event</option>
                        {events.map(event => (
                          <option key={event.id} value={event.id}>
                            {event.title}
                          </option>
                        ))}
                      </select>
                    </FormControl>
                  </FormItem>
                )}
              />

              {form.watch('eventId') && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="timeBeforeMinutes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Minutes Before</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="0"
                              placeholder="0"
                              {...field}
                              value={field.value || ''}
                              onChange={e => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                              className="glass-input"
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="timeAfterMinutes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Minutes After</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min="0"
                              placeholder="0"
                              {...field}
                              value={field.value || ''}
                              onChange={e => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                              className="glass-input"
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                </>
              )}

              <FormField
                control={form.control}
                name="soundId"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex justify-between">
                      <FormLabel>Sound</FormLabel>
                      <button
                        type="button"
                        onClick={() => handleTestSound(field.value || 'default')}
                        className="text-xs text-primary hover:underline flex items-center gap-1"
                      >
                        <Play size={12} />
                        Test
                      </button>
                    </div>
                    <FormControl>
                      <select
                        {...field}
                        className="glass-input w-full h-10 px-3"
                      >
                        {getSounds().map(sound => (
                          <option key={sound.id} value={sound.id}>
                            {sound.name}
                          </option>
                        ))}
                      </select>
                    </FormControl>
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit">
                  {isEditing ? 'Update' : 'Create'} Reminder
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </ModuleContainer>
  );
};

export default RemindersModule;
