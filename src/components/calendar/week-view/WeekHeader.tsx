
import React from "react";
import { getWeekDays, isCurrentDay } from "@/lib/getTime";
import { cn } from "@/lib/utils";
import dayjs from "dayjs";
import { useViewStore } from "@/lib/store";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown } from "lucide-react";

interface WeekHeaderProps {
  userSelectedDate: dayjs.Dayjs;
}

const WeekHeader: React.FC<WeekHeaderProps> = ({ userSelectedDate }) => {
  const { selectedView, setView } = useViewStore();

  const handleViewChange = (view: string) => {
    setView(view);
  };

  return (
    <div className="grid grid-cols-[auto_1fr_1fr_1fr_1fr_1fr_1fr_1fr] place-items-center px-4 py-1.5 border-b border-purple-200 dark:border-white/10 bg-transparent">
      <div className="w-16 flex justify-center">
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/40 dark:bg-white/10 hover:bg-white/60 dark:hover:bg-white/20 transition-colors text-xs font-medium text-purple-900 dark:text-foreground outline-none border border-purple-200 dark:border-white/10 backdrop-blur-md">
            {selectedView}
            <ChevronDown size={14} className="text-purple-700 dark:text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-[120px] rounded-xl">
            {["Day", "Week", "Month"].map((viewStr) => (
              <DropdownMenuItem
                key={viewStr}
                onClick={() => handleViewChange(viewStr)}
                className={`rounded-lg cursor-pointer ${selectedView === viewStr ? "bg-accent text-accent-foreground" : ""
                  }`}
              >
                {viewStr}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {getWeekDays(userSelectedDate).map(({ currentDate, today }, index) => (
        <div key={index} className="flex flex-col items-center">
          <div
            className={cn(
              "h-8 w-8 rounded-full flex items-center justify-center font-semibold text-lg md:text-xl",
              today ? "bg-primary text-white" : "text-purple-900/80 dark:text-muted-foreground"
            )}
          >
            {currentDate.format("DD")}
          </div>
          <div className={cn("text-[10px] md:text-xs", today ? "text-primary font-medium" : "text-purple-900/60 dark:text-muted-foreground")}>
            {currentDate.format("ddd")}
          </div>
        </div>
      ))}
    </div>
  );
};

export default WeekHeader;
