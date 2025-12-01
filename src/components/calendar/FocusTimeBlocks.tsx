// Phase 1.3: Focus Time Protection Component
// Allows users to define and protect focus hours with DND mode

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Clock, Zap, Shield, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useCalendarEvents } from '@/hooks/use-calendar-events';
import { useConflictDetection } from '@/hooks/use-conflict-detection';
import dayjs from 'dayjs';
import { toast } from 'sonner';

export interface FocusTimeBlock {
  id: string;
  dayOfWeek: number; // 0-6 (Sunday-Saturday)
  startHour: number; // 0-23
  endHour: number; // 0-23
  isActive: boolean;
  label?: string;
}

const DEFAULT_FOCUS_BLOCKS: FocusTimeBlock[] = [
  {
    id: 'morning-focus',
    dayOfWeek: 1, // Monday
    startHour: 9,
    endHour: 12,
    isActive: true,
    label: 'Morning Deep Work',
  },
  {
    id: 'afternoon-focus',
    dayOfWeek: 1,
    startHour: 14,
    endHour: 16,
    isActive: true,
    label: 'Afternoon Focus',
  },
];

const DAYS_OF_WEEK = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

const HOURS = Array.from({ length: 24 }, (_, i) => ({
  value: i,
  label: `${i.toString().padStart(2, '0')}:00`,
}));

export default function FocusTimeBlocks() {
  const [focusBlocks, setFocusBlocks] = useState<FocusTimeBlock[]>(() => {
    // Load from localStorage
    const saved = localStorage.getItem('focusTimeBlocks');
    return saved ? JSON.parse(saved) : DEFAULT_FOCUS_BLOCKS;
  });
  const [dndMode, setDndMode] = useState(false);
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  
  const { events } = useCalendarEvents();
  
  // Save to localStorage whenever focus blocks change
  useEffect(() => {
    localStorage.setItem('focusTimeBlocks', JSON.stringify(focusBlocks));
  }, [focusBlocks]);

  // Check if any events conflict with focus time
  const checkFocusConflicts = () => {
    const conflicts: Array<{ event: any; focusBlock: FocusTimeBlock }> = [];
    
    events.forEach((event) => {
      const eventStart = dayjs(event.startsAt);
      const eventDay = eventStart.day();
      const eventHour = eventStart.hour();
      
      focusBlocks.forEach((block) => {
        if (
          block.isActive &&
          block.dayOfWeek === eventDay &&
          eventHour >= block.startHour &&
          eventHour < block.endHour
        ) {
          conflicts.push({ event, focusBlock: block });
        }
      });
    });
    
    return conflicts;
  };

  const conflicts = checkFocusConflicts();

  const addFocusBlock = () => {
    const newBlock: FocusTimeBlock = {
      id: `focus-${Date.now()}`,
      dayOfWeek: 1,
      startHour: 9,
      endHour: 11,
      isActive: true,
      label: 'New Focus Time',
    };
    setFocusBlocks([...focusBlocks, newBlock]);
    setEditingBlockId(newBlock.id);
  };

  const updateFocusBlock = (id: string, updates: Partial<FocusTimeBlock>) => {
    setFocusBlocks(
      focusBlocks.map((block) =>
        block.id === id ? { ...block, ...updates } : block
      )
    );
  };

  const deleteFocusBlock = (id: string) => {
    setFocusBlocks(focusBlocks.filter((block) => block.id !== id));
    toast.success('Focus block removed');
  };

  const toggleDndMode = () => {
    setDndMode(!dndMode);
    toast.success(dndMode ? 'Do Not Disturb mode disabled' : 'Do Not Disturb mode enabled');
  };

  return (
    <div className="space-y-4">
      {/* Header Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 rounded-full p-2">
                <Shield className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle>Focus Time Protection</CardTitle>
                <CardDescription>
                  Define and protect your most productive hours
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Label htmlFor="dnd-mode">Do Not Disturb</Label>
                <Switch
                  id="dnd-mode"
                  checked={dndMode}
                  onCheckedChange={toggleDndMode}
                />
              </div>
              <Button onClick={addFocusBlock} size="sm">
                <Zap className="h-4 w-4 mr-2" />
                Add Focus Block
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Conflicts Alert */}
      {conflicts.length > 0 && (
        <Card className="border-orange-200 bg-orange-50 dark:bg-orange-950/20">
          <CardHeader>
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-orange-600 mt-0.5" />
              <div>
                <CardTitle className="text-orange-800 dark:text-orange-200">
                  {conflicts.length} Event{conflicts.length !== 1 ? 's' : ''} During Focus Time
                </CardTitle>
                <CardDescription className="text-orange-700 dark:text-orange-300">
                  The following events are scheduled during your protected focus hours
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {conflicts.map(({ event, focusBlock }) => (
                <div
                  key={event.id}
                  className="flex items-center justify-between p-3 bg-white dark:bg-gray-900 rounded-lg"
                >
                  <div>
                    <p className="font-medium">{event.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {dayjs(event.startsAt).format('ddd, MMM D, h:mm A')} - Conflicts with{' '}
                      {focusBlock.label}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-orange-600">
                    Focus Time
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Focus Blocks List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {focusBlocks.map((block) => (
          <Card
            key={block.id}
            className={block.isActive ? 'border-primary' : 'opacity-60'}
          >
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  <input
                    type="text"
                    value={block.label}
                    onChange={(e) =>
                      updateFocusBlock(block.id, { label: e.target.value })
                    }
                    className="font-semibold bg-transparent border-none focus:outline-none focus:ring-2 focus:ring-primary rounded px-1"
                    placeholder="Focus Block Name"
                  />
                </div>
                <Switch
                  checked={block.isActive}
                  onCheckedChange={(checked) =>
                    updateFocusBlock(block.id, { isActive: checked })
                  }
                />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-sm mb-2 block">Day of Week</Label>
                <Select
                  value={block.dayOfWeek.toString()}
                  onValueChange={(value) =>
                    updateFocusBlock(block.id, { dayOfWeek: parseInt(value) })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DAYS_OF_WEEK.map((day, index) => (
                      <SelectItem key={index} value={index.toString()}>
                        {day}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm mb-2 block">Start Time</Label>
                  <Select
                    value={block.startHour.toString()}
                    onValueChange={(value) =>
                      updateFocusBlock(block.id, { startHour: parseInt(value) })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {HOURS.map((hour) => (
                        <SelectItem key={hour.value} value={hour.value.toString()}>
                          {hour.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-sm mb-2 block">End Time</Label>
                  <Select
                    value={block.endHour.toString()}
                    onValueChange={(value) =>
                      updateFocusBlock(block.id, { endHour: parseInt(value) })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {HOURS.map((hour) => (
                        <SelectItem key={hour.value} value={hour.value.toString()}>
                          {hour.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => deleteFocusBlock(block.id)}
                className="w-full text-destructive hover:bg-destructive/10"
              >
                Remove Block
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Info Card */}
      {focusBlocks.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-8 text-center">
            <Shield className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="font-semibold mb-2">No Focus Blocks Defined</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Create focus blocks to protect your most productive hours
            </p>
            <Button onClick={addFocusBlock}>
              <Zap className="h-4 w-4 mr-2" />
              Create First Focus Block
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/**
 * Hook to check if a time falls within focus hours
 */
export function useFocusTimeCheck() {
  const [focusBlocks] = useState<FocusTimeBlock[]>(() => {
    const saved = localStorage.getItem('focusTimeBlocks');
    return saved ? JSON.parse(saved) : DEFAULT_FOCUS_BLOCKS;
  });

  const isInFocusTime = (date: Date | string): boolean => {
    const checkDate = dayjs(date);
    const day = checkDate.day();
    const hour = checkDate.hour();

    return focusBlocks.some(
      (block) =>
        block.isActive &&
        block.dayOfWeek === day &&
        hour >= block.startHour &&
        hour < block.endHour
    );
  };

  const getFocusBlockAtTime = (date: Date | string): FocusTimeBlock | null => {
    const checkDate = dayjs(date);
    const day = checkDate.day();
    const hour = checkDate.hour();

    return (
      focusBlocks.find(
        (block) =>
          block.isActive &&
          block.dayOfWeek === day &&
          hour >= block.startHour &&
          hour < block.endHour
      ) || null
    );
  };

  return { isInFocusTime, getFocusBlockAtTime, focusBlocks };
}
