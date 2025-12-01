
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
          set({ isEventSummaryOpen: true, selectedEvent: event });
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
