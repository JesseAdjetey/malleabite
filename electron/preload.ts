/**
 * Electron preload — exposes window.electronAPI to the renderer.
 * Mirrors the Capacitor AppleDataPlugin interface so native-apple.ts
 * can route through this on macOS without any renderer code changes.
 */

import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,

  // Open a URL in the system default browser
  openExternal: (url: string) => ipcRenderer.invoke('open-external', url),

  // Port the local auth callback server is listening on
  authCallbackPort: 34567,


  // ── Reminders ──────────────────────────────────────────────────────────────
  requestRemindersPermission: () =>
    ipcRenderer.invoke('apple:requestRemindersPermission'),

  getReminderLists: () =>
    ipcRenderer.invoke('apple:getReminderLists'),

  getReminders: (listId?: string) =>
    ipcRenderer.invoke('apple:getReminders', listId),

  createReminder: (params: { title: string; notes?: string; dueDate?: string; listId?: string; flagged?: boolean }) =>
    ipcRenderer.invoke('apple:createReminder', params),

  updateReminder: (params: { reminderId: string; title?: string; notes?: string; dueDate?: string }) =>
    ipcRenderer.invoke('apple:updateReminder', params),

  deleteReminder: (reminderId: string) =>
    ipcRenderer.invoke('apple:deleteReminder', reminderId),

  completeReminder: (reminderId: string) =>
    ipcRenderer.invoke('apple:completeReminder', reminderId),

  // ── Calendar ───────────────────────────────────────────────────────────────
  requestCalendarPermission: () =>
    ipcRenderer.invoke('apple:requestCalendarPermission'),

  getCalendars: () =>
    ipcRenderer.invoke('apple:getCalendars'),

  getEvents: (startDate: string, endDate: string) =>
    ipcRenderer.invoke('apple:getEvents', startDate, endDate),

  createEvent: (params: {
    title: string; startDate: string; endDate: string;
    notes?: string; allDay?: boolean; calendarId?: string;
  }) => ipcRenderer.invoke('apple:createEvent', params),

  deleteEvent: (eventId: string) =>
    ipcRenderer.invoke('apple:deleteEvent', eventId),
});
