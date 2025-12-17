// Quick Event Popup - Minimal UI for fast event creation after drag-to-create
import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Clock, MoreHorizontal, X } from 'lucide-react';
import dayjs, { Dayjs } from 'dayjs';
import { cn } from '@/lib/utils';

interface QuickEventPopupProps {
  isOpen: boolean;
  position: { x: number; y: number };
  startTime: Dayjs;
  endTime: Dayjs;
  onClose: () => void;
  onCreateEvent: (title: string) => void;
  onOpenFullForm: () => void;
}

export function QuickEventPopup({
  isOpen,
  position,
  startTime,
  endTime,
  onClose,
  onCreateEvent,
  onOpenFullForm,
}: QuickEventPopupProps) {
  const [title, setTitle] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTitle('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim()) {
      onCreateEvent(title.trim());
    }
  };

  const duration = endTime.diff(startTime, 'minute');
  const durationText = duration < 60
    ? `${duration} min`
    : `${Math.floor(duration / 60)}h ${duration % 60 > 0 ? `${duration % 60}m` : ''}`;

  if (!isOpen) return null;

  // Calculate position to keep popup in viewport
  const adjustedPosition = {
    x: Math.min(position.x, window.innerWidth - 320),
    y: Math.min(position.y, window.innerHeight - 200),
  };

  return (
    <Card
      ref={cardRef}
      className={cn(
        'fixed z-50 w-80 shadow-lg animate-in fade-in-0 zoom-in-95',
        'border-2 border-primary'
      )}
      style={{
        left: adjustedPosition.x,
        top: adjustedPosition.y,
      }}
    >
      <CardContent className="p-3">
        <form onSubmit={handleSubmit}>
          <div className="flex items-center justify-between mb-3">
            <Badge variant="secondary" className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {startTime.format('h:mm A')} - {endTime.format('h:mm A')}
              <span className="text-xs opacity-70">({durationText})</span>
            </Badge>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <Input
            ref={inputRef}
            placeholder="Add title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mb-3"
            autoComplete="off"
          />

          <div className="flex items-center justify-between">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onOpenFullForm}
              className="text-muted-foreground"
            >
              <MoreHorizontal className="h-4 w-4 mr-1" />
              More options
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={!title.trim()}>
                Save
              </Button>
            </div>
          </div>
        </form>

        <div className="mt-3 pt-3 border-t text-xs text-muted-foreground">
          {startTime.format('dddd, MMMM D, YYYY')}
        </div>
      </CardContent>
    </Card>
  );
}

export default QuickEventPopup;
