
// Re-export all stores from a central file for backward compatibility
export { useViewStore } from './stores/view-store';
export { useDateStore } from './stores/date-store';
export { useSidebarStore } from './stores/sidebar-store';
export { useEventStore } from './stores/event-store';
export { useWeekRangeStore } from './stores/week-range-store';
export type { ModuleType, ModuleInstance, SidebarPage, CalendarEventType } from './stores/types';
