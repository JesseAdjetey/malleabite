// Multi-step guided flow for complex AI interactions (recurring events, weekly routines, etc.)
import React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export interface GuidedFlowStep {
  id: string;
  /** Human-readable question / instruction */
  prompt: string;
  /** Selectable options the user can pick */
  options: GuidedFlowOption[];
  /** Allow multiple selections? */
  multi?: boolean;
}

export interface GuidedFlowOption {
  id: string;
  label: string;
  /** If set, selecting this option sends this prompt directly */
  promptOverride?: string;
}

export interface GuidedFlowData {
  id: string;
  /** Title shown above the flow */
  title?: string;
  /** Current step index (0-based) */
  currentStep: number;
  /** Total steps */
  totalSteps: number;
  /** The active step to render */
  step: GuidedFlowStep;
}

interface GuidedFlowProps {
  flow: GuidedFlowData;
  onSelectOption: (optionId: string, prompt: string) => void;
  selectedOptions?: string[];
  onSubmitMulti?: (optionIds: string[]) => void;
}

export const GuidedFlow: React.FC<GuidedFlowProps> = ({
  flow,
  onSelectOption,
  selectedOptions = [],
  onSubmitMulti,
}) => {
  const [localSelected, setLocalSelected] = React.useState<string[]>(selectedOptions);
  const isMulti = flow.step.multi ?? false;

  const handleClick = (option: GuidedFlowOption) => {
    if (isMulti) {
      setLocalSelected(prev =>
        prev.includes(option.id)
          ? prev.filter(id => id !== option.id)
          : [...prev, option.id]
      );
    } else {
      const prompt = option.promptOverride || option.label;
      onSelectOption(option.id, prompt);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-2 space-y-2"
    >
      {/* Step indicator */}
      <div className="flex items-center gap-2">
        <div className="flex gap-0.5">
          {Array.from({ length: flow.totalSteps }).map((_, i) => (
            <div
              key={i}
              className={cn(
                "h-1 rounded-full transition-all",
                i < flow.currentStep ? "w-4 bg-purple-500" :
                i === flow.currentStep ? "w-6 bg-purple-500" :
                "w-4 bg-black/10 dark:bg-white/10",
              )}
            />
          ))}
        </div>
        <span className="text-[10px] text-muted-foreground">
          Step {flow.currentStep + 1} of {flow.totalSteps}
        </span>
      </div>

      {/* Question */}
      <p className="text-xs font-medium">{flow.step.prompt}</p>

      {/* Options */}
      <div className="flex flex-wrap gap-1.5">
        {flow.step.options.map((option, i) => {
          const isSelected = localSelected.includes(option.id);
          return (
            <motion.button
              key={option.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.03 }}
              onClick={() => handleClick(option)}
              className={cn(
                "px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-all",
                isSelected
                  ? "bg-purple-500/20 border-purple-500/40 text-purple-700 dark:text-purple-300"
                  : "bg-black/[0.03] dark:bg-white/[0.06] border-black/[0.06] dark:border-white/[0.08] text-foreground hover:bg-black/[0.06] dark:hover:bg-white/[0.1]",
              )}
            >
              {option.label}
            </motion.button>
          );
        })}
      </div>

      {/* Multi-select submit button */}
      {isMulti && localSelected.length > 0 && onSubmitMulti && (
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          onClick={() => onSubmitMulti(localSelected)}
          className={cn(
            "w-full py-1.5 rounded-lg text-[11px] font-medium",
            "bg-purple-500/15 hover:bg-purple-500/25 text-purple-700 dark:text-purple-300",
            "border border-purple-500/20 transition-colors",
          )}
        >
          Continue with {localSelected.length} selected →
        </motion.button>
      )}
    </motion.div>
  );
};
