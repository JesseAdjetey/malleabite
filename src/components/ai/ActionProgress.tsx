// Animated step-by-step progress for multi-action AI responses
import React from "react";
import { motion } from "framer-motion";
import { Check, Loader2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ActionProgressStep, ProgressStatus } from "./rich-message-types";

const statusIcon: Record<ProgressStatus, React.ReactNode> = {
  pending: <div className="w-3 h-3 rounded-full border border-muted-foreground/40" />,
  running: <Loader2 size={12} className="animate-spin text-purple-500" />,
  done: <Check size={12} className="text-emerald-500" />,
  error: <AlertCircle size={12} className="text-red-500" />,
};

interface ActionProgressProps {
  steps: ActionProgressStep[];
}

export const ActionProgress: React.FC<ActionProgressProps> = ({ steps }) => {
  if (steps.length === 0) return null;

  return (
    <div className="flex flex-col gap-1 mt-1.5">
      {steps.map((step, i) => (
        <motion.div
          key={step.id}
          initial={{ opacity: 0, x: -6 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.08 }}
          className={cn(
            "flex items-center gap-2 text-[11px]",
            step.status === 'done' && "text-muted-foreground",
            step.status === 'running' && "text-foreground font-medium",
            step.status === 'pending' && "text-muted-foreground/60",
            step.status === 'error' && "text-red-500",
          )}
        >
          {statusIcon[step.status]}
          <span>{step.label}</span>
        </motion.div>
      ))}
    </div>
  );
};
