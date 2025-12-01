
import React from "react";
import { getHours, isCurrentHour } from "@/lib/getTime";
import TimeSlot from "./TimeSlot";
import dayjs from "dayjs";
import { CalendarEventType } from "@/lib/stores/types";

interface TimeSlotsGridProps {
  userSelectedDate: dayjs.Dayjs;
  currentTime: dayjs.Dayjs;
  events: CalendarEventType[];
  onTimeSlotClick: (hour: dayjs.Dayjs) => void;
  addEvent: (event: CalendarEventType) => Promise<any>;
  openEventForm?: (todoData: any, hour: dayjs.Dayjs) => void;
  isBulkMode?: boolean;
  isSelected?: (eventId: string) => boolean;
  onToggleSelection?: (eventId: string) => void;
}

const TimeSlotsGrid: React.FC<TimeSlotsGridProps> = ({
  userSelectedDate,
  currentTime,
  events,
  onTimeSlotClick,
  addEvent,
  openEventForm,
  isBulkMode = false,
  isSelected = () => false,
  onToggleSelection = () => {},
}) => {
  return (
    <div className="grid grid-cols-[auto_1fr] px-4 py-2">
      {/* Time labels */}
      <div className="flex flex-col text-right pr-4 border-r border-white/10">
        {getHours.map((hour, index) => (
          <div key={index} className="h-20 flex items-center">
            <span
              className={`text-sm font-medium ${
                isCurrentHour(hour) ? "text-primary" : "text-secondary-foreground"
              }`}
            >
              {hour.format("h A")}
            </span>
          </div>
        ))}
      </div>

      {/* Time slots */}
      <div className="flex-1">
        {getHours.map((hour, index) => (
          <TimeSlot
            key={index}
            hour={hour}
            events={events}
            onTimeSlotClick={onTimeSlotClick}
            addEvent={addEvent}
            openEventForm={openEventForm}
            isBulkMode={isBulkMode}
            isSelected={isSelected}
            onToggleSelection={onToggleSelection}
          />
        ))}
      </div>
    </div>
  );
};

export default TimeSlotsGrid;
