
import React, { useState, useEffect } from "react";
import dayjs from "dayjs";

interface CurrentTimeIndicatorProps {
  isCurrentDay: boolean;
}

/**
 * Renders the "now" line on the current day's column.
 *
 * This component owns its own minute ticker. Previously the current time lived in
 * WeekView state and was threaded down to every DayColumn, so the once-a-minute
 * tick re-rendered the entire week (re-running event grouping and recurring
 * expansion). Localising the ticker here means the minute update only re-renders
 * this tiny indicator — and only on the day that actually shows it.
 */
const CurrentTimeIndicator: React.FC<CurrentTimeIndicatorProps> = ({ isCurrentDay }) => {
  const [now, setNow] = useState(() => dayjs());

  useEffect(() => {
    if (!isCurrentDay) return; // only the current day needs to tick
    const interval = setInterval(() => setNow(dayjs()), 60000);
    return () => clearInterval(interval);
  }, [isCurrentDay]);

  if (!isCurrentDay) return null;

  const HOUR_HEIGHT = 80; // must match DayColumn.tsx hourHeight
  const minutes = now.hour() * 60 + now.minute();
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

export default React.memo(CurrentTimeIndicator);
