
import React, { useState, useEffect } from 'react';
import ModuleContainer from './ModuleContainer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, ArrowLeft, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEisenhower, EisenhowerItem } from '@/hooks/use-eisenhower';
import { useAuth } from '@/contexts/AuthContext.firebase';

interface QuadrantConfig {
  title: string;
  className: string;
  description: string;
}

type QuadrantType = EisenhowerItem['quadrant'] | null;

interface EisenhowerModuleProps {
  title?: string;
  onRemove?: () => void;
  onTitleChange?: (title: string) => void;
  onMinimize?: () => void;
  isMinimized?: boolean;
  isDragging?: boolean;
}

const EisenhowerModule: React.FC<EisenhowerModuleProps> = ({
  title = "Eisenhower Matrix",
  onRemove,
  onTitleChange,
  onMinimize,
  isMinimized,
  isDragging
}) => {
  const [focusedQuadrant, setFocusedQuadrant] = useState<QuadrantType>(null);
  const [newItemText, setNewItemText] = useState('');
  const [submitStatus, setSubmitStatus] = useState<{ success?: boolean; message?: string } | null>(null);
  const { items, loading, error, addItem, removeItem, updateQuadrant, lastResponse } = useEisenhower();
  const { user } = useAuth();

  const quadrantConfig: Record<EisenhowerItem['quadrant'], QuadrantConfig> = {
    'urgent_important': {
      title: 'Urgent & Important',
      className: 'bg-red-500/20',
      description: 'Do these tasks immediately'
    },
    'not_urgent_important': {
      title: 'Not Urgent & Important',
      className: 'bg-yellow-500/20',
      description: 'Schedule time to do these tasks'
    },
    'urgent_not_important': {
      title: 'Urgent & Not Important',
      className: 'bg-blue-500/20',
      description: 'Delegate these tasks if possible'
    },
    'not_urgent_not_important': {
      title: 'Not Urgent & Not Important',
      className: 'bg-green-500/20',
      description: 'Eliminate these tasks if possible'
    }
  };

  // Clear status message after 5 seconds
  useEffect(() => {
    if (submitStatus) {
      const timer = setTimeout(() => {
        setSubmitStatus(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [submitStatus]);

  // Update submitStatus when lastResponse changes
  useEffect(() => {
    if (lastResponse) {
      setSubmitStatus({
        success: lastResponse.success,
        message: lastResponse.message
      });
    }
  }, [lastResponse]);

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>, quadrant: EisenhowerItem['quadrant']) => {
    e.preventDefault();

    try {
      const data = e.dataTransfer.getData('application/json');
      const draggedItem = JSON.parse(data);

      const existingItem = items.find(item => item.id === draggedItem.id);

      if (existingItem) {
        // Update existing item's quadrant
        await updateQuadrant(existingItem.id, quadrant);
      } else if (draggedItem.source === 'todo-module') {
        // Add as new item from todo module
        await addItem(draggedItem.text, quadrant);
      } else {
        // Add as new item
        await addItem(draggedItem.text || draggedItem.title || 'Untitled Task', quadrant);
      }
    } catch (error) {
      console.error('Error processing dragged item:', error);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleRemoveItem = async (id: string) => {
    await removeItem(id);
  };

  const getQuadrantItems = (quadrant: EisenhowerItem['quadrant']) => {
    return items.filter(item => item.quadrant === quadrant);
  };

  const handleAddNewItem = async (quadrant: EisenhowerItem['quadrant']) => {
    if (newItemText.trim()) {
      await addItem(newItemText.trim(), quadrant);
      setNewItemText('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, quadrant: EisenhowerItem['quadrant']) => {
    if (e.key === 'Enter') {
      handleAddNewItem(quadrant);
    }
  };

  const renderFocusedQuadrant = () => {
    if (!focusedQuadrant) return null;

    const config = quadrantConfig[focusedQuadrant];
    const quadrantItems = getQuadrantItems(focusedQuadrant);
    const textColorClass = focusedQuadrant === 'urgent_important' ? 'text-red-400' :
      focusedQuadrant === 'not_urgent_important' ? 'text-yellow-400' :
        focusedQuadrant === 'urgent_not_important' ? 'text-blue-400' :
          'text-green-400';

    return (
      <div className={`rounded-lg p-3 h-64 ${config.className}`}>
        <div className="flex items-center mb-2">
          <Button
            variant="ghost"
            size="sm"
            className="p-0 h-6 w-6 mr-2"
            onClick={() => setFocusedQuadrant(null)}
          >
            <ArrowLeft size={16} />
          </Button>
          <h3 className={`text-sm font-medium ${textColorClass}`}>{config.title}</h3>
        </div>

        <p className="text-xs mb-3 opacity-70">{config.description}</p>

        {submitStatus && (
          <div className={cn(
            "text-sm p-2 mb-2 rounded-md flex items-center",
            submitStatus.success ? "bg-green-500/20 text-green-300" : "bg-red-500/20 text-red-300"
          )}>
            {submitStatus.success ? (
              <CheckCircle2 size={16} className="mr-1" />
            ) : (
              <AlertCircle size={16} className="mr-1" />
            )}
            {submitStatus.message}
          </div>
        )}

        <div className="flex gap-2 mb-3">
          <Input
            value={newItemText}
            onChange={(e) => setNewItemText(e.target.value)}
            onKeyDown={(e) => handleKeyDown(e, focusedQuadrant)}
            placeholder="Add new item..."
            className="h-8 text-xs bg-white dark:bg-white/10 border-gray-200 dark:border-white/10 text-gray-800 dark:text-white"
          />
          <Button
            size="sm"
            variant="outline"
            className="h-8 px-2 bg-white dark:bg-white/10 border-gray-200 dark:border-white/10 text-gray-700 dark:text-white"
            onClick={() => handleAddNewItem(focusedQuadrant)}
          >
            <Plus size={14} />
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span className="ml-2 text-xs">Loading items...</span>
          </div>
        ) : error ? (
          <div className="text-center text-xs text-red-400 p-2">Error: {error}</div>
        ) : (
          <div className="overflow-y-auto max-h-[150px]">
            {quadrantItems.length === 0 ? (
              <div className="text-xs opacity-50 text-center pt-2">No items in this quadrant</div>
            ) : (
              quadrantItems.map(item => (
                <div key={item.id} className="bg-white/50 dark:bg-white/10 text-xs p-2 rounded mb-1 flex justify-between text-gray-800 dark:text-white">
                  <span>{item.text}</span>
                  <button
                    onClick={() => handleRemoveItem(item.id)}
                    className="opacity-50 hover:opacity-100"
                  >×</button>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    );
  };

  const renderMatrix = () => {
    if (loading) {
      return (
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="ml-2">Loading matrix...</span>
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex justify-center items-center h-64 text-red-400">
          <AlertCircle className="h-6 w-6 mr-2" />
          <span>Error: {error}</span>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-2 grid-rows-2 gap-2 h-64">
        {Object.entries(quadrantConfig).map(([quadrant, config]) => {
          const quadrantType = quadrant as EisenhowerItem['quadrant'];
          const quadrantItems = getQuadrantItems(quadrantType);

          return (
            <div
              key={quadrant}
              className={`${config.className} rounded-lg p-2 overflow-y-auto relative`}
              onDrop={(e) => handleDrop(e, quadrantType)}
              onDragOver={handleDragOver}
              onClick={() => setFocusedQuadrant(quadrantType)}
            >
              <div className={`text-xs font-medium mb-1 ${quadrantType === 'urgent_important' ? 'text-red-400' :
                  quadrantType === 'not_urgent_important' ? 'text-yellow-400' :
                    quadrantType === 'urgent_not_important' ? 'text-blue-400' :
                      'text-green-400'
                }`}>
                {config.title}
              </div>

              {quadrantItems.length === 0 ? (
                <div className="text-xs opacity-50 text-center pt-2">Click to add items</div>
              ) : (
                quadrantItems.slice(0, 3).map(item => (
                  <div
                    key={item.id}
                    className="bg-white/50 dark:bg-white/10 text-xs p-1 rounded mb-1 flex justify-between cursor-grab active:cursor-grabbing text-gray-800 dark:text-white"
                    draggable={true}
                    onDragStart={(e) => {
                      e.dataTransfer.setData('application/json', JSON.stringify({
                        id: item.id,
                        text: item.text,
                        source: 'eisenhower'
                      }));
                      e.dataTransfer.effectAllowed = 'copy';
                    }}
                  >
                    <span>{item.text}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveItem(item.id);
                      }}
                      className="opacity-50 hover:opacity-100"
                    >
                      ×
                    </button>
                  </div>
                ))
              )}

              {quadrantItems.length > 3 && (
                <div className="text-xs opacity-70 text-center">+{quadrantItems.length - 3} more</div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  if (isMinimized) {
    return (
      <ModuleContainer
        title={title}
        onRemove={onRemove}
        onTitleChange={onTitleChange}
        isMinimized={isMinimized}
        onMinimize={onMinimize}
      >
        <div className="text-center text-sm text-muted-foreground py-2">
          {loading ? 'Loading...' : `${items.length} matrix items`}
        </div>
      </ModuleContainer>
    );
  }

  if (!user) {
    return (
      <ModuleContainer
        title={title}
        onRemove={onRemove}
        onTitleChange={onTitleChange}
        isMinimized={isMinimized}
        onMinimize={onMinimize}
      >
        <div className="flex items-center justify-center p-4 text-sm text-muted-foreground">
          Sign in to use Eisenhower Matrix
        </div>
      </ModuleContainer>
    );
  }

  return (
    <ModuleContainer
      title={title}
      onRemove={onRemove}
      onTitleChange={onTitleChange}
      isMinimized={isMinimized}
      onMinimize={onMinimize}
    >
      {focusedQuadrant ? renderFocusedQuadrant() : renderMatrix()}
    </ModuleContainer>
  );
};

export default EisenhowerModule;
