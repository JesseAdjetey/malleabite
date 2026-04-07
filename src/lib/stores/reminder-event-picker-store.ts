import { create } from 'zustand';
import { CalendarEventType } from './types';

interface ReminderFormSnapshot {
  title?: string;
  description?: string;
  reminderTime?: string;
  soundId?: string;
  recurrence?: string;
  customDays?: number[];
  soundEnabled?: boolean;
  whenMode?: 'specific' | 'event';
}

interface PendingEventForReminder {
  event: CalendarEventType;
  targetModuleId?: string; // which RemindersModule instance to open (module.id)
}

interface ReminderEventPickerStore {
  // Browse-calendar pick mode
  isPickingEvent: boolean;
  pendingFormData: ReminderFormSnapshot | null;
  pickedEvent: CalendarEventType | null;
  initiatorInstanceId: string | null;
  startPicking: (formData: ReminderFormSnapshot, instanceId?: string) => void;
  completePicking: (event: CalendarEventType) => void;
  cancelPicking: () => void;
  clearPickedEvent: () => void;

  // "Add Reminder" triggered from the event form
  pendingEventForReminder: PendingEventForReminder | null;
  setPendingEventForReminder: (data: PendingEventForReminder | null) => void;
}

export const useReminderEventPickerStore = create<ReminderEventPickerStore>((set) => ({
  isPickingEvent: false,
  pendingFormData: null,
  pickedEvent: null,
  initiatorInstanceId: null,
  pendingEventForReminder: null,

  startPicking: (formData, instanceId) => set({ isPickingEvent: true, pendingFormData: formData, pickedEvent: null, initiatorInstanceId: instanceId ?? null }),
  completePicking: (event) => set({ isPickingEvent: false, pickedEvent: event }),
  cancelPicking: () => set({ isPickingEvent: false, pendingFormData: null, pickedEvent: null, initiatorInstanceId: null }),
  clearPickedEvent: () => set({ pickedEvent: null, pendingFormData: null, initiatorInstanceId: null }),

  setPendingEventForReminder: (data) => set({ pendingEventForReminder: data }),
}));
