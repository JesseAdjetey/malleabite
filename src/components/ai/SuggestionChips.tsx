// Contextual follow-up suggestion chips displayed after AI responses
import React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { SuggestionChip } from "./rich-message-types";

interface SuggestionChipsProps {
  chips: SuggestionChip[];
  onSelect: (chip: SuggestionChip) => void;
}

export const SuggestionChips: React.FC<SuggestionChipsProps> = ({ chips, onSelect }) => {
  if (chips.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15, duration: 0.2 }}
      className="flex flex-wrap gap-1.5 mt-2"
    >
      {chips.map((chip, i) => (
        <motion.button
          key={chip.id}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 + i * 0.05 }}
          onClick={() => onSelect(chip)}
          className={cn(
            "inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium",
            "bg-purple-500/10 hover:bg-purple-500/20",
            "text-purple-700 dark:text-purple-300",
            "border border-purple-500/20 hover:border-purple-500/30",
            "transition-all cursor-pointer",
          )}
        >
          {chip.label}
        </motion.button>
      ))}
    </motion.div>
  );
};
