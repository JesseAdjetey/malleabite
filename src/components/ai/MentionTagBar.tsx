/**
 * MentionTagBar — Renders selected @mention references as removable chips above the chat input.
 */
import React from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { MentionReference } from './mention-types';
import { MentionIcon } from './MentionPopover';

interface MentionTagBarProps {
  /** Currently selected references */
  references: MentionReference[];
  /** Remove a reference by its mentionId */
  onRemove: (mentionId: string) => void;
}

export const MentionTagBar: React.FC<MentionTagBarProps> = ({ references, onRemove }) => {
  if (references.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5 px-3 pt-2 pb-1">
      {references.map(ref => (
        <span
          key={ref.mentionId}
          className={cn(
            'inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-full',
            'text-xs font-medium',
            'bg-purple-500/15 text-purple-700 dark:text-purple-300',
            'border border-purple-500/20',
            'animate-in fade-in-0 zoom-in-95 duration-150',
          )}
        >
          <MentionIcon name={ref.iconName} className="h-3 w-3" />
          <span className="max-w-[140px] truncate">{ref.shortLabel}</span>
          <button
            onClick={() => onRemove(ref.mentionId)}
            className={cn(
              'ml-0.5 p-0.5 rounded-full',
              'hover:bg-purple-500/20 transition-colors',
              'text-purple-500/70 hover:text-purple-700 dark:hover:text-purple-200',
            )}
            aria-label={`Remove ${ref.shortLabel}`}
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
    </div>
  );
};
