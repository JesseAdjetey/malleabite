import React from 'react';
import { Button } from '@/components/ui/button';
import { CheckSquare, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface BulkModeToggleProps {
  isBulkMode: boolean;
  onToggle: () => void;
  selectedCount?: number;
}

const BulkModeToggle: React.FC<BulkModeToggleProps> = ({
  isBulkMode,
  onToggle,
  selectedCount = 0,
}) => {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant={isBulkMode ? "default" : "outline"}
          size="sm"
          onClick={onToggle}
          className={cn(
            "relative transition-all",
            isBulkMode && "bg-primary hover:bg-primary/90"
          )}
        >
          {isBulkMode ? (
            <>
              <X className="h-4 w-4 mr-1" />
              <span>Exit Bulk Mode</span>
              {selectedCount > 0 && (
                <span className="ml-2 px-2 py-0.5 bg-white/20 rounded-full text-xs">
                  {selectedCount}
                </span>
              )}
            </>
          ) : (
            <>
              <CheckSquare className="h-4 w-4 mr-1" />
              <span>Bulk Edit</span>
            </>
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <p>
          {isBulkMode
            ? "Exit bulk selection mode"
            : "Select multiple events for bulk operations"}
        </p>
      </TooltipContent>
    </Tooltip>
  );
};

export default BulkModeToggle;
