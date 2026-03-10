// Compact inline action card for AI-executed actions (events, todos, alarms, etc.)
import React from "react";
import { motion } from "framer-motion";
import { Calendar, CheckSquare, Bell, Clock, Timer, Sparkles, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ActionCardData } from "./rich-message-types";

const iconMap: Record<string, React.ReactNode> = {
  calendar: <Calendar size={13} />,
  'check-square': <CheckSquare size={13} />,
  bell: <Bell size={13} />,
  clock: <Clock size={13} />,
  timer: <Timer size={13} />,
};

const statusBadge: Record<string, { label: string; className: string }> = {
  created: { label: 'Created', className: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' },
  updated: { label: 'Updated', className: 'bg-blue-500/15 text-blue-600 dark:text-blue-400' },
  deleted: { label: 'Deleted', className: 'bg-red-500/15 text-red-600 dark:text-red-400' },
};

interface ActionCardProps {
  card: ActionCardData;
  onUndo?: (card: ActionCardData) => void;
}

export const ActionCard: React.FC<ActionCardProps> = ({ card, onUndo }) => {
  const badge = statusBadge[card.status] || statusBadge.created;
  const icon = iconMap[card.icon || ''] || <Sparkles size={13} />;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "spring", damping: 20, stiffness: 300 }}
      className={cn(
        "flex items-center gap-2 px-2.5 py-1.5 rounded-lg mt-1.5",
        "bg-black/[0.03] dark:bg-white/[0.06]",
        "border border-black/[0.06] dark:border-white/[0.08]",
      )}
    >
      {/* Color accent + icon */}
      <div
        className="flex items-center justify-center w-6 h-6 rounded-md shrink-0"
        style={{ backgroundColor: `${card.color || '#8b5cf6'}20`, color: card.color || '#8b5cf6' }}
      >
        {icon}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium truncate">{card.title}</span>
          <span className={cn("text-[9px] px-1.5 py-0.5 rounded-full font-medium shrink-0", badge.className)}>
            {badge.label}
          </span>
        </div>
        {card.subtitle && (
          <p className="text-[10px] text-muted-foreground truncate mt-0.5">{card.subtitle}</p>
        )}
      </div>

      {/* Undo button for created items */}
      {card.status === 'created' && onUndo && (
        <button
          onClick={() => onUndo(card)}
          className="text-muted-foreground hover:text-red-500 transition-colors shrink-0 p-0.5"
          title="Undo"
        >
          <Trash2 size={11} />
        </button>
      )}
    </motion.div>
  );
};
