import React from 'react';
import { motion } from 'framer-motion';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPickTodoist: () => void;
  onPickMicrosoft: () => void;
  onPickGoogleTasks: () => void;
}

const OPTIONS = [
  {
    id: 'todoist' as const,
    label: 'Todoist',
    description: 'Sync with a Todoist project',
    color: '#db4035',
    icon: (
      <svg width="20" height="20" viewBox="0 0 32 32" fill="none">
        <path d="M4 8h24M4 16h16M4 24h20" stroke="white" strokeWidth="3.5" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    id: 'microsoft' as const,
    label: 'Microsoft Tasks',
    description: 'Sync with a Microsoft To Do list',
    color: '#0078d4',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <path d="M5 13l4 4L19 7" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    id: 'google_tasks' as const,
    label: 'Google Tasks',
    description: 'Sync with a Google Tasks list',
    color: '#1a73e8',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <path d="M9 11l3 3L22 4" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
];

export default function TaskSyncPickerDialog({ open, onOpenChange, onPickTodoist, onPickMicrosoft, onPickGoogleTasks }: Props) {
  const handlePick = (id: 'todoist' | 'microsoft' | 'google_tasks') => {
    onOpenChange(false);
    setTimeout(() => {
      if (id === 'todoist') onPickTodoist();
      else if (id === 'microsoft') onPickMicrosoft();
      else onPickGoogleTasks();
    }, 200);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Sync tasks</DialogTitle>
          <DialogDescription>Choose a service to sync this list with.</DialogDescription>
        </DialogHeader>

        <div className="py-2 space-y-2">
          {OPTIONS.map((opt) => (
            <motion.button
              key={opt.id}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => handlePick(opt.id as any)}
              className={cn(
                'w-full flex items-center gap-3 p-3.5 rounded-xl border border-border/60',
                'hover:border-primary/30 hover:bg-primary/[0.02]',
                'dark:hover:bg-primary/[0.04] transition-all duration-200 text-left'
              )}
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: `${opt.color}20` }}
              >
                <div style={{ color: opt.color }}>{opt.icon}</div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-foreground">{opt.label}</div>
                <div className="text-[11px] text-muted-foreground">{opt.description}</div>
              </div>
              <ArrowRight size={16} className="text-muted-foreground/40 flex-shrink-0" />
            </motion.button>
          ))}
        </div>

        <p className="text-[11px] text-muted-foreground text-center pb-1">
          Only one service can be linked per module at a time.
        </p>
      </DialogContent>
    </Dialog>
  );
}
