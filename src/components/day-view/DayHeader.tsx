
import React from "react";
import dayjs from "dayjs";
import { cn } from "@/lib/utils";

interface DayHeaderProps {
  userSelectedDate: dayjs.Dayjs;
  isToday: boolean;
}

const DayHeader: React.FC<DayHeaderProps> = ({ userSelectedDate, isToday }) => {
  return (
    <div className="grid grid-cols-[auto_auto_1fr] px-4 py-3 bg-secondary/50 border-b border-gray-200 dark:border-white/10">
      <div className="w-16 text-muted-foreground text-sm font-medium">GMT</div>
      <div className="flex w-16 flex-col items-center">
        <div
          className={cn(
            "h-10 w-10 rounded-full flex items-center justify-center font-semibold text-xl",
            isToday ? "bg-primary text-white" : "text-muted-foreground"
          )}
        >
          {userSelectedDate.format("DD")}
        </div>
        <div className={cn("text-xs", isToday ? "text-primary" : "text-muted-foreground")}>
          {userSelectedDate.format("ddd")}
        </div>
      </div>
      <div></div>
    </div>
  );
};

export default DayHeader;
