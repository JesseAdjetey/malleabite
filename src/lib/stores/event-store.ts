
import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";
import dayjs from "dayjs";
import { CalendarEventType } from "./types";

type EventStore = {
  events: CalendarEventType[];
  isPopoverOpen: boolean;
  isEventSummaryOpen: boolean;
  selectedEvent: CalendarEventType | null;
  setEvents: (events: CalendarEventType[]) => void;
  addEvent: (event: CalendarEventType) => void;
  updateEvent: (event: CalendarEventType) => void;
  deleteEvent: (id: string) => void;
  openPopover: () => void;
  closePopover: () => void;
  openEventSummary: (event: CalendarEventType) => void;
  closeEventSummary: () => void;
  toggleEventLock: (id: string, isLocked: boolean) => void;
  isInitialized: boolean;
  setIsInitialized: (value: boolean) => void;
};

export const useEventStore = create<EventStore>()(
  devtools(
    persist(
      (set, get) => ({
        events: [],
        isPopoverOpen: false,
        isEventSummaryOpen: false,
        selectedEvent: null,
        isInitialized: false,
        setIsInitialized: (value) => {
          set({ isInitialized: value });
        },
        setEvents: (events) => {
          // Format events with date field for backward compatibility
          const formattedEvents = events.map(event => {
            // Extract date if it doesn't exist
            if (!event.date && event.startsAt) {
              return {
                ...event,
                date: dayjs(event.startsAt).format('YYYY-MM-DD')
              };
            }
            return event;
          });

          set({ events: formattedEvents });
        },
        addEvent: (event) => {
          // Ensure date property exists for backward compatibility
          const eventWithDate = !event.date && event.startsAt
            ? { ...event, date: dayjs(event.startsAt).format('YYYY-MM-DD') }
            : event;

          set(state => ({
            events: [...state.events, eventWithDate]
          }));
        },
        updateEvent: (event) => {
          // Ensure date property exists for backward compatibility
          const eventWithDate = !event.date && event.startsAt
            ? { ...event, date: dayjs(event.startsAt).format('YYYY-MM-DD') }
            : event;

          set(state => ({
            events: state.events.map(e =>
              e.id === event.id ? { ...e, ...eventWithDate } : e
            ),
            // If the updated event is the selected event, update selectedEvent too
            selectedEvent: state.selectedEvent?.id === event.id
              ? { ...state.selectedEvent, ...eventWithDate }
              : state.selectedEvent
          }));
        },
        deleteEvent: (id) => {
          set(state => ({
            events: state.events.filter(e => e.id !== id),
            isEventSummaryOpen: state.selectedEvent?.id === id ? false : state.isEventSummaryOpen,
            selectedEvent: state.selectedEvent?.id === id ? null : state.selectedEvent
          }));
        },
        openPopover: () => {
          set({ isPopoverOpen: true });
        },
        closePopover: () => {
          set({ isPopoverOpen: false });
        },
        openEventSummary: (event) => {
          // Defensive check: validate event object before opening
          if (!event || typeof event !== 'object') {
            console.error('🔍 openEventSummary: Invalid event object', event);
            return;
          }
          
          // Ensure event has minimum required properties
          if (!event.id) {
            console.error('🔍 openEventSummary: Event missing id', event);
            return;
          }
          
          console.log('🔍 openEventSummary called with event:', event);
          console.log('🔍 Event fields:', {
            id: event.id,
            title: event.title,
            startsAt: event.startsAt,
            endsAt: event.endsAt,
            date: event.date,
            participants: event.participants,
            description: event.description
          });
          
          // Sanitize the event object to prevent crashes
          const safeEvent = {
            ...event,
            title: event.title || 'Untitled Event',
            description: event.description || '',
            date: event.date || (event.startsAt ? dayjs(event.startsAt).format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD')),
            participants: Array.isArray(event.participants) ? event.participants : [],
          };
          
          set({ isEventSummaryOpen: true, selectedEvent: safeEvent });
        },
        closeEventSummary: () => {
          set({ isEventSummaryOpen: false, selectedEvent: null });
        },
        toggleEventLock: (id, isLocked) => {
          set(state => ({
            events: state.events.map(event =>
              event.id === id ? { ...event, isLocked } : event
            ),
            // If the updated event is the selected event, update selectedEvent too
            selectedEvent: state.selectedEvent?.id === id
              ? { ...state.selectedEvent, isLocked }
              : state.selectedEvent
          }));
        }
      }),
      { name: "event_data", skipHydration: true }
    )
  )
);
