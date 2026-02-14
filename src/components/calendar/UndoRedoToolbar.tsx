import React from "react";
import { Button } from "@/components/ui/button";
import { Undo2, Redo2 } from "lucide-react";
import { useUndoRedo } from "@/hooks/use-undo-redo";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface UndoRedoToolbarProps {
  className?: string;
}

const UndoRedoToolbar: React.FC<UndoRedoToolbarProps> = ({ className }) => {
  const { canUndo, canRedo, performUndo, performRedo, lastAction } = useUndoRedo();

  return (
    <TooltipProvider>
      <div className={`flex items-center gap-1 ${className || ''}`}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={performUndo}
              disabled={!canUndo}
              className="h-8 w-8 p-0 text-gray-700 dark:text-white"
            >
              <Undo2 size={16} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Undo (Ctrl+Z)</p>
            {lastAction && <p className="text-xs text-muted-foreground">{lastAction.description}</p>}
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={performRedo}
              disabled={!canRedo}
              className="h-8 w-8 p-0 text-gray-700 dark:text-white"
            >
              <Redo2 size={16} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Redo (Ctrl+Shift+Z)</p>
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
};

export default UndoRedoToolbar;
