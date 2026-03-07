/**
 * ═══════════════════════════════════════════════════════════════════════════
 * LinkedEntityBadges — Shows linked entities as interactive chips
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Drop this component into any entity card/row to display its linked
 * entities as small, clickable badges. Each badge shows the entity type
 * icon + title, and clicking it opens the linked entity. Long-press or
 * right-click shows an unlink option.
 *
 * Usage:
 *   <LinkedEntityBadges entityType="todo" entityId={todo.id} />
 *   <LinkedEntityBadges entityType="event" entityId={event.id} compact />
 * ═══════════════════════════════════════════════════════════════════════════
 */

import React from 'react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Calendar,
  CheckSquare,
  BellRing,
  Clock,
  Grid2X2,
  Link2,
  Unlink,
  MoreHorizontal,
} from 'lucide-react';
import { useEntityLinks } from '@/hooks/use-entity-links';
import type { EntityType, EntityRef } from '@/lib/entity-links/types';
import {
  ENTITY_TYPE_LABELS,
  ENTITY_TYPE_COLORS,
} from '@/lib/entity-links/types';

// Map entity types to their Lucide icon components
const ENTITY_ICONS: Record<EntityType, React.ElementType> = {
  event: Calendar,
  todo: CheckSquare,
  alarm: BellRing,
  reminder: Clock,
  eisenhower: Grid2X2,
};

// Badge color classes per entity type
const BADGE_COLORS: Record<EntityType, string> = {
  event: 'bg-blue-500/20 text-blue-300 border-blue-500/30 hover:bg-blue-500/30',
  todo: 'bg-purple-500/20 text-purple-300 border-purple-500/30 hover:bg-purple-500/30',
  alarm: 'bg-orange-500/20 text-orange-300 border-orange-500/30 hover:bg-orange-500/30',
  reminder: 'bg-green-500/20 text-green-300 border-green-500/30 hover:bg-green-500/30',
  eisenhower: 'bg-red-500/20 text-red-300 border-red-500/30 hover:bg-red-500/30',
};

interface LinkedEntityBadgesProps {
  entityType: EntityType;
  entityId: string;
  /** Show only icon + count instead of full badges */
  compact?: boolean;
  /** Max badges to show before collapsing into "+N more" */
  maxVisible?: number;
  /** Additional CSS classes */
  className?: string;
  /** Callback when a linked entity badge is clicked */
  onEntityClick?: (ref: EntityRef) => void;
}

export function LinkedEntityBadges({
  entityType,
  entityId,
  compact = false,
  maxVisible = 3,
  className,
  onEntityClick,
}: LinkedEntityBadgesProps) {
  const { getLinksForFast, unlink } = useEntityLinks();
  const refs = getLinksForFast(entityType, entityId);

  if (refs.length === 0) return null;

  const handleUnlink = async (e: React.MouseEvent, ref: EntityRef) => {
    e.stopPropagation();
    await unlink(ref.linkId);
  };

  // ─── Compact mode: just show a link icon + count ────────────────
  if (compact) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              className={cn(
                'inline-flex items-center gap-1 text-xs text-muted-foreground cursor-default',
                className
              )}
            >
              <Link2 className="h-3 w-3" />
              <span>{refs.length}</span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs">
            <div className="text-xs space-y-1">
              <p className="font-medium">Linked to:</p>
              {refs.map((ref) => (
                <div key={ref.linkId} className="flex items-center gap-1.5">
                  {React.createElement(ENTITY_ICONS[ref.type], {
                    className: 'h-3 w-3 shrink-0',
                  })}
                  <span className="truncate">{ref.title || ENTITY_TYPE_LABELS[ref.type]}</span>
                </div>
              ))}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // ─── Full badge mode ────────────────────────────────────────────
  const visible = refs.slice(0, maxVisible);
  const overflow = refs.length - maxVisible;

  return (
    <div className={cn('flex flex-wrap items-center gap-1', className)}>
      {visible.map((ref) => {
        const Icon = ENTITY_ICONS[ref.type];

        return (
          <DropdownMenu key={ref.linkId}>
            <DropdownMenuTrigger asChild>
              <Badge
                variant="outline"
                className={cn(
                  'cursor-pointer text-[10px] py-0 px-1.5 h-5 gap-1 transition-colors',
                  BADGE_COLORS[ref.type]
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  onEntityClick?.(ref);
                }}
              >
                <Icon className="h-2.5 w-2.5 shrink-0" />
                <span className="truncate max-w-[80px]">
                  {ref.title || ENTITY_TYPE_LABELS[ref.type]}
                </span>
              </Badge>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className="min-w-[140px]"
              onClick={(e) => e.stopPropagation()}
            >
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  onEntityClick?.(ref);
                }}
              >
                <Icon className="h-4 w-4 mr-2" />
                Open {ENTITY_TYPE_LABELS[ref.type]}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={(e) => handleUnlink(e, ref)}
                className="text-destructive focus:text-destructive"
              >
                <Unlink className="h-4 w-4 mr-2" />
                Unlink
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        );
      })}

      {overflow > 0 && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge
                variant="outline"
                className="text-[10px] py-0 px-1.5 h-5 text-muted-foreground border-muted-foreground/30 cursor-default"
              >
                +{overflow} more
              </Badge>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs">
              <div className="text-xs space-y-1">
                {refs.slice(maxVisible).map((ref) => (
                  <div key={ref.linkId} className="flex items-center gap-1.5">
                    {React.createElement(ENTITY_ICONS[ref.type], {
                      className: 'h-3 w-3 shrink-0',
                    })}
                    <span className="truncate">{ref.title || ENTITY_TYPE_LABELS[ref.type]}</span>
                  </div>
                ))}
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );
}
