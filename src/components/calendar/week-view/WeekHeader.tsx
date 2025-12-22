
import React from "react";
import { getWeekDays, isCurrentDay } from "@/lib/getTime";
import { cn } from "@/lib/utils";
import dayjs from "dayjs";

interface WeekHeaderProps {
  userSelectedDate: dayjs.Dayjs;
}

const WeekHeader: React.FC<WeekHeaderProps> = ({ userSelectedDate }) => {
  return (
    <div className="grid grid-cols-[auto_1fr_1fr_1fr_1fr_1fr_1fr_1fr] place-items-center px-4 py-2 bg-secondary/50 border-b border-gray-200 dark:border-white/10">
      <div className="w-16 text-muted-foreground text-sm font-medium">GMT</div>

      {getWeekDays(userSelectedDate).map(({ currentDate, today }, index) => (
        <div key={index} className="flex flex-col items-center">
          <div
            className={cn(
              "h-10 w-10 rounded-full flex items-center justify-center font-semibold text-xl",
              today ? "bg-primary text-white" : "text-muted-foreground"
            )}
          >
            {currentDate.format("DD")}
          </div>
          <div className={cn("text-xs", today ? "text-primary" : "text-muted-foreground")}>
            {currentDate.format("ddd")}
          </div>
        </div>
      ))}
    </div>
  );
};

export default WeekHeader;
