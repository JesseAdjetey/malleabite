
import React from "react";
import dayjs from "dayjs";
import { cn } from "@/lib/utils";
import { useViewStore } from "@/lib/store";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown } from "lucide-react";

interface DayHeaderProps {
  userSelectedDate: dayjs.Dayjs;
  isToday: boolean;
}

const DayHeader: React.FC<DayHeaderProps> = ({ userSelectedDate, isToday }) => {
  const { selectedView, setView } = useViewStore();

  const handleViewChange = (view: string) => {
    setView(view);
  };

  return (
    <div className="grid grid-cols-[auto_auto_1fr] px-4 py-1.5 border-b border-purple-200 dark:border-white/10 bg-transparent">
      <div className="w-16 flex justify-center items-center">
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
      <div className="flex w-16 flex-col items-center">
        <div
          className={cn(
            "h-8 w-8 rounded-full flex items-center justify-center font-semibold text-lg md:text-xl",
            isToday ? "bg-primary text-white" : "text-purple-900/80 dark:text-muted-foreground"
          )}
        >
          {userSelectedDate.format("DD")}
        </div>
        <div className={cn("text-[10px] md:text-xs", isToday ? "text-primary font-medium" : "text-purple-900/60 dark:text-muted-foreground")}>
          {userSelectedDate.format("ddd")}
        </div>
      </div>
      <div></div>
    </div>
  );
};

export default DayHeader;
