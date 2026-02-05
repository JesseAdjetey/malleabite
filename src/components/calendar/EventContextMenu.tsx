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
  Copy,
  Trash2,
  Edit,
  Calendar,
  Clock,
  Palette,
  Lock,
  Unlock,
  Bell,
  CheckSquare,
  Repeat,
  Archive,
} from "lucide-react";
import { CalendarEventType } from "@/lib/stores/types";
import { toast } from "sonner";

// Available colors for events
const eventColors = [
  { name: "Purple", value: "#8b5cf6" },
  { name: "Blue", value: "#3b82f6" },
  { name: "Green", value: "#22c55e" },
  { name: "Yellow", value: "#eab308" },
  { name: "Orange", value: "#f97316" },
  { name: "Red", value: "#ef4444" },
  { name: "Pink", value: "#ec4899" },
  { name: "Teal", value: "#14b8a6" },
];

interface EventContextMenuProps {
  event: CalendarEventType;
  children: React.ReactNode;
  onEdit?: (event: CalendarEventType) => void;
  onDelete?: (eventId: string) => void;
  onDuplicate?: (event: CalendarEventType) => void;
  onColorChange?: (eventId: string, color: string) => void;
  onLockToggle?: (eventId: string, locked: boolean) => void;
  onAddAlarm?: (event: CalendarEventType) => void;
  onAddTodo?: (event: CalendarEventType) => void;
  onArchive?: (eventId: string) => void;
}

const EventContextMenu: React.FC<EventContextMenuProps> = ({
  event,
  children,
  onEdit,
  onDelete,
  onDuplicate,
  onColorChange,
  onLockToggle,
  onAddAlarm,
  onAddTodo,
  onArchive,
}) => {
  const handleCopyToClipboard = () => {
    const eventText = `${event.title}\n${event.date}${event.description ? `\n${event.description}` : ""}`;
    navigator.clipboard.writeText(eventText).then(() => {
      toast.success("Event details copied to clipboard");
    }).catch(() => {
      toast.error("Failed to copy to clipboard");
    });
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent className="w-56 bg-background/95 backdrop-blur-sm border-white/10">
        {/* Edit */}
        {onEdit && (
          <ContextMenuItem
            className="flex items-center gap-2 cursor-pointer"
            onClick={() => onEdit(event)}
          >
            <Edit size={14} />
            Edit Event
          </ContextMenuItem>
        )}

        {/* Duplicate */}
        {onDuplicate && (
          <ContextMenuItem
            className="flex items-center gap-2 cursor-pointer"
            onClick={() => onDuplicate(event)}
          >
            <Copy size={14} />
            Duplicate Event
          </ContextMenuItem>
        )}

        {/* Copy to Clipboard */}
        <ContextMenuItem
          className="flex items-center gap-2 cursor-pointer"
          onClick={handleCopyToClipboard}
        >
          <Calendar size={14} />
          Copy to Clipboard
        </ContextMenuItem>

        <ContextMenuSeparator />

        {/* Color submenu */}
        {onColorChange && (
          <ContextMenuSub>
            <ContextMenuSubTrigger className="flex items-center gap-2">
              <Palette size={14} />
              Change Color
            </ContextMenuSubTrigger>
            <ContextMenuSubContent className="w-40 bg-background/95 backdrop-blur-sm border-white/10">
              {eventColors.map((color) => (
                <ContextMenuItem
                  key={color.value}
                  className="flex items-center gap-2 cursor-pointer"
                  onClick={() => onColorChange(event.id, color.value)}
                >
                  <div
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: color.value }}
                  />
                  {color.name}
                </ContextMenuItem>
              ))}
            </ContextMenuSubContent>
          </ContextMenuSub>
        )}

        {/* Lock/Unlock */}
        {onLockToggle && (
          <ContextMenuItem
            className="flex items-center gap-2 cursor-pointer"
            onClick={() => onLockToggle(event.id, !event.isLocked)}
          >
            {event.isLocked ? (
              <>
                <Unlock size={14} />
                Unlock Event
              </>
            ) : (
              <>
                <Lock size={14} />
                Lock Event
              </>
            )}
          </ContextMenuItem>
        )}

        <ContextMenuSeparator />

        {/* Add Alarm */}
        {onAddAlarm && (
          <ContextMenuItem
            className="flex items-center gap-2 cursor-pointer"
            onClick={() => onAddAlarm(event)}
          >
            <Bell size={14} />
            Add Alarm
          </ContextMenuItem>
        )}

        {/* Create Todo from Event */}
        {onAddTodo && !event.isTodo && (
          <ContextMenuItem
            className="flex items-center gap-2 cursor-pointer"
            onClick={() => onAddTodo(event)}
          >
            <CheckSquare size={14} />
            Create Todo from Event
          </ContextMenuItem>
        )}

        {/* Archive */}
        {onArchive && (
          <ContextMenuItem
            className="flex items-center gap-2 cursor-pointer"
            onClick={() => onArchive(event.id)}
          >
            <Archive size={14} />
            Archive Event
          </ContextMenuItem>
        )}

        <ContextMenuSeparator />

        {/* Delete */}
        {onDelete && (
          <ContextMenuItem
            className="flex items-center gap-2 cursor-pointer text-red-500 focus:text-red-500"
            onClick={() => onDelete(event.id)}
          >
            <Trash2 size={14} />
            Delete Event
          </ContextMenuItem>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
};

export default EventContextMenu;
