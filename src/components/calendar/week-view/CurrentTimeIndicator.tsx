
import React from "react";
import dayjs from "dayjs";

interface CurrentTimeIndicatorProps {
  currentTime: dayjs.Dayjs;
  isCurrentDay: boolean;
}

const CurrentTimeIndicator: React.FC<CurrentTimeIndicatorProps> = ({ 
  currentTime, 
  isCurrentDay 
}) => {
  if (!isCurrentDay) return null;
  
  const HOUR_HEIGHT = 80; // must match DayColumn.tsx hourHeight
  const minutes = currentTime.hour() * 60 + currentTime.minute();
  const position = (minutes / 60) * HOUR_HEIGHT;
  
  return (
    <div
      className="absolute h-0.5 w-full bg-primary z-20 flex items-center"
      style={{
        top: `${position}px`,
      }}
    >
      <div className="w-2 h-2 rounded-full bg-primary -ml-1" />
    </div>
  );
};

export default CurrentTimeIndicator;
