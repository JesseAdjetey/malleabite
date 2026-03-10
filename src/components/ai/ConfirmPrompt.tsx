// Inline confirmation prompt for AI actions that need user approval
import React from "react";
import { motion } from "framer-motion";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PendingAction } from "./rich-message-types";

interface ConfirmPromptProps {
  actions: PendingAction[];
  onApprove: (actionId: string) => void;
  onReject: (actionId: string) => void;
  onApproveAll: () => void;
}

export const ConfirmPrompt: React.FC<ConfirmPromptProps> = ({
  actions,
  onApprove,
  onReject,
  onApproveAll,
}) => {
  const pending = actions.filter(a => a.status === 'pending');
  if (pending.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-2 space-y-1.5"
    >
      <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">
        Confirm actions
      </p>
      {pending.map((action) => (
        <div
          key={action.id}
          className={cn(
            "flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-xs",
            "bg-amber-500/10 border border-amber-500/20",
          )}
        >
          <span className="truncate flex-1">{action.label}</span>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => onApprove(action.id)}
              className="p-1 rounded-md bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-600 dark:text-emerald-400 transition-colors"
              title="Approve"
            >
              <Check size={12} />
            </button>
            <button
              onClick={() => onReject(action.id)}
              className="p-1 rounded-md bg-red-500/15 hover:bg-red-500/25 text-red-600 dark:text-red-400 transition-colors"
              title="Reject"
            >
              <X size={12} />
            </button>
          </div>
        </div>
      ))}
      {pending.length > 1 && (
        <button
          onClick={onApproveAll}
          className={cn(
            "w-full text-center text-[11px] py-1.5 rounded-lg font-medium",
            "bg-purple-500/10 hover:bg-purple-500/20 text-purple-700 dark:text-purple-300",
            "border border-purple-500/20 transition-colors",
          )}
        >
          Approve all ({pending.length})
        </button>
      )}
    </motion.div>
  );
};
