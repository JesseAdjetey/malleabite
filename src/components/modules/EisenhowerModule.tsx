
import React, { useState, useEffect, useCallback } from 'react';
import ModuleContainer from './ModuleContainer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, ArrowLeft, AlertCircle, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEisenhower, EisenhowerItem } from '@/hooks/use-eisenhower';
import { useAuth } from '@/contexts/AuthContext.firebase';
import { Loader2 } from 'lucide-react';
import { useEventHighlightStore } from '@/lib/stores/event-highlight-store';
import { useModuleSize } from '@/contexts/ModuleSizeContext';

interface QuadrantConfig {
  title: string;
  shortTitle: string;
  className: string;
  textClass: string;
  description: string;
  ringClass: string;
}

type QuadrantType = EisenhowerItem['quadrant'] | null;

interface EisenhowerModuleProps {
  title?: string;
  onRemove?: () => void;
  onTitleChange?: (title: string) => void;
  onMinimize?: () => void;
  isMinimized?: boolean;
  isDragging?: boolean;
  instanceId?: string;
  moveTargets?: { id: string; title: string }[];
  onMoveToPage?: (pageId: string) => void;
  onShare?: () => void;
  isReadOnly?: boolean;
  contentReadOnly?: boolean;
}

const QUADRANT_CONFIG: Record<EisenhowerItem['quadrant'], QuadrantConfig> = {
  urgent_important: {
    title: 'Urgent & Important',
    shortTitle: 'Do',
    className: 'bg-red-500/20',
    textClass: 'text-red-600 dark:text-red-400',
    ringClass: 'ring-red-400/50',
    description: 'Do these tasks immediately',
  },
  not_urgent_important: {
    title: 'Not Urgent & Important',
    shortTitle: 'Schedule',
    className: 'bg-yellow-500/20',
    textClass: 'text-yellow-600 dark:text-yellow-400',
    ringClass: 'ring-yellow-400/50',
    description: 'Schedule time to do these',
  },
  urgent_not_important: {
    title: 'Urgent & Not Important',
    shortTitle: 'Delegate',
    className: 'bg-blue-500/20',
    textClass: 'text-blue-600 dark:text-blue-400',
    ringClass: 'ring-blue-400/50',
    description: 'Delegate these if possible',
  },
  not_urgent_not_important: {
    title: 'Not Urgent & Not Important',
    shortTitle: 'Eliminate',
    className: 'bg-green-500/20',
    textClass: 'text-green-600 dark:text-green-400',
    ringClass: 'ring-green-400/50',
    description: 'Eliminate these if possible',
  },
};

const EisenhowerModule: React.FC<EisenhowerModuleProps> = ({
  title = "Eisenhower Matrix",
  onRemove,
  onTitleChange,
  onMinimize,
  isMinimized,
  isDragging,
  instanceId,
  moveTargets,
  onMoveToPage,
  onShare,
  isReadOnly,
  contentReadOnly,
}) => {
  const { sizeLevel } = useModuleSize();
  const [focusedQuadrant, setFocusedQuadrant] = useState<QuadrantType>(null);
  const [newItemText, setNewItemText] = useState('');
  const [submitStatus, setSubmitStatus] = useState<{ success?: boolean; message?: string } | null>(null);
  const [dragOverQuadrant, setDragOverQuadrant] = useState<QuadrantType>(null);
  const [addingToQuadrant, setAddingToQuadrant] = useState<QuadrantType>(null);
  const [inlineText, setInlineText] = useState('');

  const { items, loading, error, addItem, removeItem, updateQuadrant, lastResponse } = useEisenhower(instanceId);
  const { user } = useAuth();

  const highlightedItemId = useEventHighlightStore(s => s.highlightedItemId);
  const highlightedItemType = useEventHighlightStore(s => s.highlightedItemType);
  const spotlightRef = useCallback((node: HTMLDivElement | null) => {
    if (node) node.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, []);

  useEffect(() => {
    if (submitStatus) {
      const t = setTimeout(() => setSubmitStatus(null), 5000);
      return () => clearTimeout(t);
    }
  }, [submitStatus]);

  useEffect(() => {
    if (lastResponse) setSubmitStatus({ success: lastResponse.success, message: lastResponse.message });
  }, [lastResponse]);

  const getQuadrantItems = (q: EisenhowerItem['quadrant']) => items.filter(i => i.quadrant === q);

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>, quadrant: EisenhowerItem['quadrant']) => {
    e.preventDefault();
    setDragOverQuadrant(null);
    try {
      const data = JSON.parse(e.dataTransfer.getData('application/json'));
      const existing = items.find(i => i.id === data.id);
      if (existing) {
        await updateQuadrant(existing.id, quadrant);
      } else if (data.source === 'todo-module') {
        await addItem(data.text, quadrant);
      } else {
        await addItem(data.text || data.title || 'Untitled Task', quadrant);
      }
    } catch {}
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>, quadrant: EisenhowerItem['quadrant']) => {
    e.preventDefault();
    setDragOverQuadrant(quadrant);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    const rt = e.relatedTarget as HTMLElement;
    if (!rt || !e.currentTarget.contains(rt)) setDragOverQuadrant(null);
  };

  const dragStartProps = (item: EisenhowerItem) => ({
    draggable: true,
    onDragStart: (e: React.DragEvent<HTMLDivElement>) => {
      e.stopPropagation();
      const data = { id: item.id, text: item.text, source: 'eisenhower' };
      const json = JSON.stringify(data);
      e.dataTransfer.setData('application/json', json);
      e.dataTransfer.setData('text/plain', json);
      e.dataTransfer.effectAllowed = 'move';
      (window as any).__dragData = data;
    },
  });

  const handleAddNewItem = async (quadrant: EisenhowerItem['quadrant'], text = newItemText) => {
    if (text.trim()) {
      await addItem(text.trim(), quadrant);
      setNewItemText('');
    }
  };

  const handleInlineAdd = async (quadrant: EisenhowerItem['quadrant']) => {
    if (inlineText.trim()) {
      await addItem(inlineText.trim(), quadrant);
      setInlineText('');
      setAddingToQuadrant(null);
    }
  };

  const commonProps = {
    title, onRemove, onTitleChange, onMinimize, isMinimized: isMinimized ?? false,
    isDragging: isDragging ?? false, moveTargets, onMoveToPage, onShare, isReadOnly,
  };

  if (!user) {
    return (
      <ModuleContainer {...commonProps}>
        <div className="flex items-center justify-center p-4 text-sm text-muted-foreground">
          Sign in to use Eisenhower Matrix
        </div>
      </ModuleContainer>
    );
  }

  if (loading) {
    return (
      <ModuleContainer {...commonProps}>
        <div className="flex items-center justify-center h-32">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      </ModuleContainer>
    );
  }

  // ─── Shared item renderer ─────────────────────────────────────────────────
  const renderItem = (item: EisenhowerItem, compact = false) => (
    <div
      key={item.id}
      ref={highlightedItemId === item.id && highlightedItemType === 'eisenhower' ? spotlightRef : undefined}
      data-eisenhower-id={item.id}
      className={cn(
        'bg-white/50 dark:bg-white/10 rounded flex justify-between items-start gap-1 cursor-grab active:cursor-grabbing select-none text-gray-800 dark:text-white',
        compact ? 'text-xs p-1 mb-0.5' : 'text-xs p-2 mb-1',
        highlightedItemId === item.id && highlightedItemType === 'eisenhower' && 'event-spotlight'
      )}
      {...dragStartProps(item)}
    >
      <span className="flex-1 min-w-0 break-words">{item.text}</span>
      {!contentReadOnly && (
        <button
          onClick={(e) => { e.stopPropagation(); removeItem(item.id); }}
          className="text-gray-400 hover:text-red-500 font-bold flex-shrink-0 leading-none"
        >×</button>
      )}
    </div>
  );

  // ─── L3: Full-screen enhanced matrix ──────────────────────────────────────
  if (sizeLevel >= 3) {
    const quadrants: EisenhowerItem['quadrant'][] = [
      'urgent_important', 'not_urgent_important',
      'urgent_not_important', 'not_urgent_not_important',
    ];

    return (
      <ModuleContainer {...commonProps}>
        <div className="flex flex-col h-full min-h-0 gap-2">
          {/* Axis labels */}
          <div className="flex items-center gap-2 px-2">
            <div className="text-xs text-muted-foreground flex-1 text-center">← Less Urgent | More Urgent →</div>
          </div>
          <div className="flex gap-2 flex-1 min-h-0">
            {/* Importance label on left */}
            <div className="flex flex-col justify-center items-center w-5 shrink-0">
              <span className="text-xs text-muted-foreground"
                style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>
                ↑ Important
              </span>
            </div>

            {/* 2x2 grid */}
            <div className="grid grid-cols-2 gap-2 flex-1 min-h-0" style={{ gridTemplateRows: '1fr 1fr' }}>
              {quadrants.map((q) => {
                const cfg = QUADRANT_CONFIG[q];
                const qItems = getQuadrantItems(q);
                const isDragOver = dragOverQuadrant === q;
                const isAdding = addingToQuadrant === q;

                return (
                  <div
                    key={q}
                    className={cn(
                      'rounded-xl p-3 flex flex-col gap-2 overflow-hidden transition-all duration-150',
                      cfg.className,
                      isDragOver && `ring-2 ${cfg.ringClass} shadow-[inset_0_0_20px_rgba(255,255,255,0.2)]`
                    )}
                    onDrop={(e) => handleDrop(e, q)}
                    onDragOver={(e) => handleDragOver(e, q)}
                    onDragLeave={handleDragLeave}
                  >
                    {/* Header */}
                    <div className="flex items-center justify-between shrink-0">
                      <div>
                        <div className={cn('text-xs font-bold', cfg.textClass)}>{cfg.shortTitle}</div>
                        <div className="text-xs text-muted-foreground hidden sm:block">{cfg.title}</div>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className={cn('text-xs font-medium', cfg.textClass)}>{qItems.length}</span>
                        {!contentReadOnly && (
                          <button
                            onClick={() => { setAddingToQuadrant(isAdding ? null : q); setInlineText(''); }}
                            className={cn('w-5 h-5 rounded flex items-center justify-center transition-colors',
                              cfg.textClass, 'hover:bg-white/20')}
                          >
                            <Plus size={12} />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Add form */}
                    {isAdding && !contentReadOnly && (
                      <div className="flex gap-1 shrink-0">
                        <Input
                          value={inlineText}
                          onChange={e => setInlineText(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') handleInlineAdd(q);
                            if (e.key === 'Escape') setAddingToQuadrant(null);
                          }}
                          placeholder="New item..."
                          className="h-7 text-xs bg-white/70 dark:bg-black/30"
                          autoFocus
                        />
                        <button onClick={() => handleInlineAdd(q)}
                          className="w-7 h-7 rounded bg-white/70 dark:bg-black/30 flex items-center justify-center hover:bg-white/90 dark:hover:bg-black/50 flex-shrink-0">
                          <Plus size={12} />
                        </button>
                      </div>
                    )}

                    {/* Items (scrollable) */}
                    <div className="flex-1 overflow-y-auto min-h-0">
                      {qItems.length === 0 ? (
                        <div className="text-xs text-muted-foreground text-center pt-2 opacity-60">
                          Drop or add items
                        </div>
                      ) : (
                        qItems.map(item => renderItem(item))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Status message */}
          {submitStatus && (
            <div className={cn('text-xs p-2 rounded flex items-center gap-1 shrink-0',
              submitStatus.success ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400')}>
              {submitStatus.success ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
              {submitStatus.message}
            </div>
          )}
        </div>
      </ModuleContainer>
    );
  }

  // ─── L2: Sidebar fill ─────────────────────────────────────────────────────
  if (sizeLevel === 2) {
    if (focusedQuadrant) {
      const cfg = QUADRANT_CONFIG[focusedQuadrant];
      const qItems = getQuadrantItems(focusedQuadrant);
      return (
        <ModuleContainer {...commonProps}>
          <div className={cn('rounded-xl p-3 flex flex-col gap-2 h-full', cfg.className)}
            onDrop={(e) => handleDrop(e, focusedQuadrant)}
            onDragOver={(e) => handleDragOver(e, focusedQuadrant)}
            onDragLeave={handleDragLeave}
          >
            <div className="flex items-center gap-2 shrink-0">
              <button onClick={() => setFocusedQuadrant(null)}
                className="w-6 h-6 rounded hover:bg-white/20 flex items-center justify-center">
                <ArrowLeft size={14} />
              </button>
              <div>
                <div className={cn('text-sm font-semibold', cfg.textClass)}>{cfg.title}</div>
                <div className="text-xs text-muted-foreground">{cfg.description}</div>
              </div>
            </div>
            {!contentReadOnly && (
              <div className="flex gap-2 shrink-0">
                <Input value={newItemText} onChange={e => setNewItemText(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddNewItem(focusedQuadrant)}
                  placeholder="Add item..." className="h-8 text-xs" />
                <Button size="sm" variant="outline" className="h-8 px-2"
                  onClick={() => handleAddNewItem(focusedQuadrant)}>
                  <Plus size={14} />
                </Button>
              </div>
            )}
            <div className="flex-1 overflow-y-auto min-h-0">
              {qItems.length === 0
                ? <div className="text-xs text-muted-foreground text-center pt-4">No items yet</div>
                : qItems.map(item => renderItem(item))
              }
            </div>
          </div>
        </ModuleContainer>
      );
    }

    // 2x2 grid (taller)
    const quadrants: EisenhowerItem['quadrant'][] = [
      'urgent_important', 'not_urgent_important',
      'urgent_not_important', 'not_urgent_not_important',
    ];
    return (
      <ModuleContainer {...commonProps}>
        <div className="grid grid-cols-2 gap-2 h-full" style={{ gridTemplateRows: '1fr 1fr' }}>
          {quadrants.map(q => {
            const cfg = QUADRANT_CONFIG[q];
            const qItems = getQuadrantItems(q);
            const isDragOver = dragOverQuadrant === q;
            return (
              <div key={q}
                className={cn(
                  'rounded-xl p-2 overflow-y-auto relative transition-all duration-150 cursor-pointer',
                  cfg.className,
                  isDragOver && `ring-2 ${cfg.ringClass} scale-[1.02]`
                )}
                onDrop={(e) => handleDrop(e, q)}
                onDragOver={(e) => handleDragOver(e, q)}
                onDragLeave={handleDragLeave}
                onClick={() => setFocusedQuadrant(q)}
              >
                <div className={cn('text-xs font-bold mb-1 flex justify-between', cfg.textClass)}>
                  <span>{cfg.shortTitle}</span>
                  <span>{qItems.length}</span>
                </div>
                {qItems.slice(0, 4).map(item => renderItem(item, true))}
                {qItems.length > 4 && (
                  <div className="text-xs text-muted-foreground text-center">+{qItems.length - 4}</div>
                )}
              </div>
            );
          })}
        </div>
      </ModuleContainer>
    );
  }

  // ─── L1: Normal (original layout, refactored) ─────────────────────────────
  const quadrantList: EisenhowerItem['quadrant'][] = [
    'urgent_important', 'not_urgent_important',
    'urgent_not_important', 'not_urgent_not_important',
  ];

  if (focusedQuadrant) {
    const cfg = QUADRANT_CONFIG[focusedQuadrant];
    const qItems = getQuadrantItems(focusedQuadrant);
    return (
      <ModuleContainer {...commonProps}>
        <div
          className={cn(
            'rounded-lg p-3 h-64 transition-all duration-150',
            cfg.className,
            dragOverQuadrant === focusedQuadrant && 'ring-2 ring-white/70 shadow-[inset_0_0_20px_rgba(255,255,255,0.4)]'
          )}
          onDrop={(e) => handleDrop(e, focusedQuadrant)}
          onDragOver={(e) => handleDragOver(e, focusedQuadrant)}
          onDragLeave={handleDragLeave}
        >
          <div className="flex items-center mb-2">
            <Button variant="ghost" size="sm" className="p-0 h-6 w-6 mr-2"
              onClick={() => setFocusedQuadrant(null)}>
              <ArrowLeft size={16} />
            </Button>
            <h3 className={cn('text-sm font-medium', cfg.textClass)}>{cfg.title}</h3>
          </div>
          <p className="text-xs mb-3 text-gray-600 dark:text-gray-300">{cfg.description}</p>
          {submitStatus && (
            <div className={cn('text-sm p-2 mb-2 rounded-md flex items-center',
              submitStatus.success ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300')}>
              {submitStatus.success ? <CheckCircle2 size={16} className="mr-1" /> : <AlertCircle size={16} className="mr-1" />}
              {submitStatus.message}
            </div>
          )}
          {!contentReadOnly && (
            <div className="flex gap-2 mb-3">
              <Input value={newItemText} onChange={e => setNewItemText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddNewItem(focusedQuadrant)}
                placeholder="Add new item..."
                className="h-8 text-xs bg-white dark:bg-white/10" />
              <Button size="sm" variant="outline" className="h-8 px-2"
                onClick={() => handleAddNewItem(focusedQuadrant)}>
                <Plus size={14} />
              </Button>
            </div>
          )}
          <div className="overflow-y-auto max-h-[150px]">
            {qItems.length === 0
              ? <div className="text-xs text-gray-500 text-center pt-2">No items in this quadrant</div>
              : qItems.map(item => renderItem(item))
            }
          </div>
        </div>
      </ModuleContainer>
    );
  }

  return (
    <ModuleContainer {...commonProps}>
      {error ? (
        <div className="flex justify-center items-center h-32 text-red-400 text-sm gap-2">
          <AlertCircle size={16} /> {error}
        </div>
      ) : (
        <div className="grid grid-cols-2 grid-rows-2 gap-2 h-64">
          {quadrantList.map(q => {
            const cfg = QUADRANT_CONFIG[q];
            const qItems = getQuadrantItems(q);
            const isDragOver = dragOverQuadrant === q;
            return (
              <div key={q}
                className={cn(
                  'rounded-lg p-2 overflow-y-auto relative transition-all duration-150 cursor-pointer',
                  cfg.className,
                  isDragOver && `ring-2 ${cfg.ringClass} shadow-[inset_0_0_20px_rgba(255,255,255,0.4)] scale-[1.02]`
                )}
                onDrop={(e) => handleDrop(e, q)}
                onDragOver={(e) => handleDragOver(e, q)}
                onDragLeave={handleDragLeave}
                onClick={() => setFocusedQuadrant(q)}
              >
                <div className={cn('text-xs font-semibold mb-1', cfg.textClass)}>{cfg.title}</div>
                {qItems.length === 0 ? (
                  <div className="text-xs text-gray-500 text-center pt-2">Click to add items</div>
                ) : (
                  qItems.slice(0, 3).map(item => renderItem(item, true))
                )}
                {qItems.length > 3 && (
                  <div className="text-xs text-gray-600 dark:text-gray-300 text-center">
                    +{qItems.length - 3} more
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </ModuleContainer>
  );
};

export default EisenhowerModule;
