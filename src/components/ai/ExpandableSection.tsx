// Collapsible expandable section for list-heavy AI responses (schedules, multi-day views)
import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ExpandableSectionData {
  id: string;
  title: string;
  /** Optional badge text (e.g. "3 events") */
  badge?: string;
  /** Content lines inside the section */
  items: string[];
  /** Start expanded? */
  defaultOpen?: boolean;
}

interface ExpandableSectionProps {
  section: ExpandableSectionData;
}

export const ExpandableSection: React.FC<ExpandableSectionProps> = ({ section }) => {
  const [open, setOpen] = useState(section.defaultOpen ?? false);

  return (
    <div className="rounded-lg border border-black/[0.06] dark:border-white/[0.08] overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className={cn(
          "flex items-center gap-2 w-full px-2.5 py-1.5 text-left text-xs",
          "hover:bg-black/[0.03] dark:hover:bg-white/[0.04] transition-colors",
        )}
      >
        <motion.div
          animate={{ rotate: open ? 90 : 0 }}
          transition={{ duration: 0.15 }}
          className="text-muted-foreground"
        >
          <ChevronRight size={12} />
        </motion.div>
        <span className="font-medium flex-1 truncate">{section.title}</span>
        {section.badge && (
          <span className="text-[10px] text-muted-foreground bg-black/[0.05] dark:bg-white/[0.08] px-1.5 py-0.5 rounded-full">
            {section.badge}
          </span>
        )}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="px-2.5 pb-2 pt-0.5 space-y-0.5">
              {section.items.map((item, i) => (
                <div
                  key={i}
                  className="text-[11px] text-muted-foreground py-0.5 pl-4 border-l-2 border-purple-500/20"
                >
                  {item}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

interface ExpandableSectionListProps {
  sections: ExpandableSectionData[];
}

export const ExpandableSectionList: React.FC<ExpandableSectionListProps> = ({ sections }) => {
  if (sections.length === 0) return null;
  return (
    <div className="space-y-1 mt-2">
      {sections.map(section => (
        <ExpandableSection key={section.id} section={section} />
      ))}
    </div>
  );
};
