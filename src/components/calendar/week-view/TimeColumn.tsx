
import React from "react";
import { getHours } from "@/lib/getTime";

const TimeColumn: React.FC = () => {
  return (
    <div className="w-16 border-r border-gray-200 dark:border-white/10">
      {getHours.map((hour, index) => (
        <div key={index} className="relative h-20">
          <div className="absolute -top-2 text-xs text-muted-foreground">
            {hour.format("h A")}
          </div>
        </div>
      ))}
    </div>
  );
};

export default TimeColumn;
