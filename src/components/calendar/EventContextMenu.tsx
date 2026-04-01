import React from "react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  Edit,
  Palette,
  Lock,
  Unlock,
  Trash2,
  CalendarClock,
  AlertTriangle,
} from "lucide-react";
import { CalendarEventType } from "@/lib/stores/types";

const EVENT_COLORS = [
  { name: "Purple",  value: "#8b5cf6" },
  { name: "Blue",    value: "#3b82f6" },
  { name: "Green",   value: "#22c55e" },
  { name: "Yellow",  value: "#eab308" },
  { name: "Orange",  value: "#f97316" },
  { name: "Red",     value: "#ef4444" },
  { name: "Pink",    value: "#ec4899" },
  { name: "Teal",    value: "#14b8a6" },
];

interface EventContextMenuProps {
  event: CalendarEventType;
  children: React.ReactNode;
  hasConflict?: boolean;
  onEdit?: (event: CalendarEventType) => void;
  onDelete?: (eventId: string) => void;
  onColorChange?: (eventId: string, color: string) => void;
  onLockToggle?: (eventId: string, locked: boolean) => void;
  /** Opens RescheduleOptionsSheet for this event */
  onReschedule?: () => void;
}

const EventContextMenu: React.FC<EventContextMenuProps> = ({
  event,
  children,
  hasConflict = false,
  onEdit,
  onDelete,
  onColorChange,
  onLockToggle,
  onReschedule,
}) => {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent className="w-52 bg-background/95 backdrop-blur-sm border-white/10">

        {/* Reschedule / Fix conflict — always shown */}
        {onReschedule && (
          <>
            <ContextMenuItem
              className="flex items-center gap-2 cursor-pointer"
              onClick={onReschedule}
            >
              {hasConflict ? (
                <AlertTriangle size={14} className="text-amber-500" />
              ) : (
                <CalendarClock size={14} />
              )}
              {hasConflict ? "Fix Conflict…" : "Reschedule…"}
            </ContextMenuItem>
            <ContextMenuSeparator />
          </>
        )}

        {/* Edit */}
        {onEdit && (
          <ContextMenuItem
            className="flex items-center gap-2 cursor-pointer"
            onClick={() => onEdit(event)}
          >
            <Edit size={14} />
            Edit
          </ContextMenuItem>
        )}

        {/* Lock / Unlock */}
        {onLockToggle && (
          <ContextMenuItem
            className="flex items-center gap-2 cursor-pointer"
            onClick={() => onLockToggle(event.id, !event.isLocked)}
          >
            {event.isLocked ? (
              <><Unlock size={14} /> Unlock</>
            ) : (
              <><Lock size={14} /> Lock</>
            )}
          </ContextMenuItem>
        )}

        {/* Color picker */}
        {onColorChange && (
          <ContextMenuSub>
            <ContextMenuSubTrigger className="flex items-center gap-2">
              <Palette size={14} />
              Color
            </ContextMenuSubTrigger>
            <ContextMenuSubContent className="w-36 bg-background/95 backdrop-blur-sm border-white/10">
              {EVENT_COLORS.map((c) => (
                <ContextMenuItem
                  key={c.value}
                  className="flex items-center gap-2 cursor-pointer"
                  onClick={() => onColorChange(event.id, c.value)}
                >
                  <div
                    className="w-3.5 h-3.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: c.value }}
                  />
                  {c.name}
                </ContextMenuItem>
              ))}
            </ContextMenuSubContent>
          </ContextMenuSub>
        )}

        <ContextMenuSeparator />

        {/* Delete */}
        {onDelete && (
          <ContextMenuItem
            className="flex items-center gap-2 cursor-pointer text-destructive focus:text-destructive"
            onClick={() => onDelete(event.id)}
          >
            <Trash2 size={14} />
            Delete
          </ContextMenuItem>
        )}

      </ContextMenuContent>
    </ContextMenu>
  );
};

export default EventContextMenu;
