/**
 * ═══════════════════════════════════════════════════════════════════════════
 * LinkEntityDialog — Modal for linking an entity to other entities
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Opens from context menus or "Link to..." buttons. Lets users:
 *   1. Pick an entity type to link to (event, todo, alarm, reminder)
 *   2. Search/select from existing entities of that type
 *   3. Or create a new entity and link it in one step
 *   4. Choose the relationship type and sync rules
 *
 * Usage:
 *   <LinkEntityDialog
 *     open={open}
 *     onOpenChange={setOpen}
 *     sourceType="todo"
 *     sourceId={todoId}
 *     sourceTitle={todoText}
 *   />
 * ═══════════════════════════════════════════════════════════════════════════
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Calendar,
  CheckSquare,
  BellRing,
  Clock,
  Grid2X2,
  Link2,
  Search,
  Plus,
  ArrowRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEntityLinks } from '@/hooks/use-entity-links';
import type { EntityType, LinkRelation } from '@/lib/entity-links/types';
import { ENTITY_TYPE_LABELS } from '@/lib/entity-links/types';
import { toast } from 'sonner';

// Icon map
const ENTITY_ICONS: Record<EntityType, React.ElementType> = {
  event: Calendar,
  todo: CheckSquare,
  alarm: BellRing,
  reminder: Clock,
  eisenhower: Grid2X2,
};

// Which entity types can link to which
const LINKABLE_TYPES: Record<EntityType, EntityType[]> = {
  todo: ['event', 'alarm', 'reminder'],
  event: ['todo', 'alarm', 'reminder', 'eisenhower'],
  alarm: ['event', 'todo'],
  reminder: ['event', 'todo'],
  eisenhower: ['event', 'alarm', 'reminder'],
};

// Default relationship for each pair (source→target)
const DEFAULT_RELATION: Record<string, LinkRelation> = {
  'todo→event': 'mirror',
  'event→todo': 'mirror',
  'todo→alarm': 'triggers',
  'alarm→todo': 'triggers',
  'todo→reminder': 'reminds',
  'reminder→todo': 'reminds',
  'event→alarm': 'triggers',
  'alarm→event': 'triggers',
  'event→reminder': 'reminds',
  'reminder→event': 'reminds',
  'eisenhower→event': 'mirror',
  'event→eisenhower': 'mirror',
  'eisenhower→alarm': 'triggers',
  'alarm→eisenhower': 'triggers',
  'eisenhower→reminder': 'reminds',
  'reminder→eisenhower': 'reminds',
};

// Colors for entity type selection buttons
const TYPE_COLORS: Record<EntityType, string> = {
  event: 'hover:bg-blue-500/20 hover:border-blue-500/40 data-[selected=true]:bg-blue-500/20 data-[selected=true]:border-blue-500/40',
  todo: 'hover:bg-purple-500/20 hover:border-purple-500/40 data-[selected=true]:bg-purple-500/20 data-[selected=true]:border-purple-500/40',
  alarm: 'hover:bg-orange-500/20 hover:border-orange-500/40 data-[selected=true]:bg-orange-500/20 data-[selected=true]:border-orange-500/40',
  reminder: 'hover:bg-green-500/20 hover:border-green-500/40 data-[selected=true]:bg-green-500/20 data-[selected=true]:border-green-500/40',
  eisenhower: 'hover:bg-red-500/20 hover:border-red-500/40 data-[selected=true]:bg-red-500/20 data-[selected=true]:border-red-500/40',
};

interface LinkEntityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceType: EntityType;
  sourceId: string;
  sourceTitle: string;
  /** Optional: pre-select target type */
  defaultTargetType?: EntityType;
  /** Available entities to link to — injected by parent */
  availableEntities?: Array<{
    type: EntityType;
    id: string;
    title: string;
    subtitle?: string;
  }>;
  /** Callback to create + link a new entity */
  onCreateAndLink?: (targetType: EntityType, title: string) => Promise<void>;
}

export function LinkEntityDialog({
  open,
  onOpenChange,
  sourceType,
  sourceId,
  sourceTitle,
  defaultTargetType,
  availableEntities = [],
  onCreateAndLink,
}: LinkEntityDialogProps) {
  const [selectedType, setSelectedType] = useState<EntityType | null>(
    defaultTargetType || null
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [isLinking, setIsLinking] = useState(false);

  const { link, areLinked } = useEntityLinks();

  const linkableTypes = LINKABLE_TYPES[sourceType] || [];

  // Filter available entities by selected type and search query
  const filteredEntities = useMemo(() => {
    if (!selectedType) return [];
    return availableEntities
      .filter((e) => e.type === selectedType)
      .filter(
        (e) =>
          !searchQuery ||
          e.title.toLowerCase().includes(searchQuery.toLowerCase())
      )
      .filter((e) => !areLinked(sourceType, sourceId, e.type, e.id));
  }, [selectedType, availableEntities, searchQuery, areLinked, sourceType, sourceId]);

  const handleLink = useCallback(
    async (targetType: EntityType, targetId: string, targetTitle: string) => {
      setIsLinking(true);
      try {
        const relationKey = `${sourceType}→${targetType}`;
        const relation = DEFAULT_RELATION[relationKey] || 'related';

        await link({
          sourceType,
          sourceId,
          sourceTitle,
          targetType,
          targetId,
          targetTitle,
          relation,
          metadata: { createdVia: 'link-dialog' },
        });

        onOpenChange(false);
      } catch (err) {
        toast.error('Failed to create link');
      } finally {
        setIsLinking(false);
      }
    },
    [link, sourceType, sourceId, sourceTitle, onOpenChange]
  );

  const handleCreateAndLink = useCallback(async () => {
    if (!selectedType || !searchQuery.trim() || !onCreateAndLink) return;
    setIsLinking(true);
    try {
      await onCreateAndLink(selectedType, searchQuery.trim());
      onOpenChange(false);
    } catch (err) {
      toast.error('Failed to create and link');
    } finally {
      setIsLinking(false);
    }
  }, [selectedType, searchQuery, onCreateAndLink, onOpenChange]);

  const SourceIcon = ENTITY_ICONS[sourceType];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            Link {ENTITY_TYPE_LABELS[sourceType]}
          </DialogTitle>
          <DialogDescription className="flex items-center gap-2 text-sm">
            <SourceIcon className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{sourceTitle}</span>
            <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="text-muted-foreground">Choose what to link to</span>
          </DialogDescription>
        </DialogHeader>

        {/* ─── Step 1: Pick entity type ─────────────────────────── */}
        <div className="space-y-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Link to a...
          </p>
          <div className="grid grid-cols-3 gap-2">
            {linkableTypes.map((type) => {
              const Icon = ENTITY_ICONS[type];
              const isSelected = selectedType === type;
              return (
                <button
                  key={type}
                  data-selected={isSelected}
                  className={cn(
                    'flex flex-col items-center gap-1.5 p-3 rounded-lg border border-border/50 transition-all text-xs',
                    TYPE_COLORS[type],
                    isSelected && 'ring-1 ring-ring'
                  )}
                  onClick={() => {
                    setSelectedType(type);
                    setSearchQuery('');
                  }}
                >
                  <Icon className="h-5 w-5" />
                  {ENTITY_TYPE_LABELS[type]}
                </button>
              );
            })}
          </div>
        </div>

        {/* ─── Step 2: Search / select entity ───────────────────── */}
        {selectedType && (
          <div className="space-y-3 mt-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={`Search ${ENTITY_TYPE_LABELS[selectedType]}s...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
                autoFocus
              />
            </div>

            <ScrollArea className="max-h-[200px]">
              <div className="space-y-1">
                {filteredEntities.map((entity) => {
                  const Icon = ENTITY_ICONS[entity.type];
                  return (
                    <button
                      key={entity.id}
                      className="flex items-center gap-2 w-full p-2 rounded-md hover:bg-accent text-left text-sm transition-colors"
                      onClick={() =>
                        handleLink(entity.type, entity.id, entity.title)
                      }
                      disabled={isLinking}
                    >
                      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate">{entity.title}</p>
                        {entity.subtitle && (
                          <p className="text-xs text-muted-foreground truncate">
                            {entity.subtitle}
                          </p>
                        )}
                      </div>
                      <Link2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    </button>
                  );
                })}

                {filteredEntities.length === 0 && searchQuery && (
                  <div className="text-center py-4 text-sm text-muted-foreground">
                    <p>No matching {ENTITY_TYPE_LABELS[selectedType]}s found</p>
                    {onCreateAndLink && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="mt-2 gap-1.5"
                        onClick={handleCreateAndLink}
                        disabled={isLinking}
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Create "{searchQuery}" and link
                      </Button>
                    )}
                  </div>
                )}

                {filteredEntities.length === 0 && !searchQuery && (
                  <p className="text-center py-4 text-sm text-muted-foreground">
                    Type to search or create a new {ENTITY_TYPE_LABELS[selectedType]}
                  </p>
                )}
              </div>
            </ScrollArea>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
