import React, { useState } from 'react';
import ModuleContainer from './ModuleContainer';
import { Filter, Eye, EyeOff, Plus, Check, ChevronDown, Calendar } from 'lucide-react';
import { useCalendarFilterStore, CalendarAccount } from '@/lib/stores/calendar-filter-store';
import { useGoogleCalendar } from '@/hooks/use-google-calendar';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface CalendarFilterModuleProps {
  title?: string;
  onRemove?: () => void;
  onTitleChange?: (title: string) => void;
  onMinimize?: () => void;
  isMinimized?: boolean;
  isDragging?: boolean;
}

const CALENDAR_COLORS = [
  '#8B5CF6', '#F87171', '#34D399', '#60A5FA', '#FBBF24', 
  '#F472B6', '#A78BFA', '#2DD4BF', '#FB923C', '#818CF8'
];

const CalendarFilterModule: React.FC<CalendarFilterModuleProps> = ({
  title = "Calendars",
  onRemove,
  onTitleChange,
  onMinimize,
  isMinimized = false,
  isDragging = false
}) => {
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newCalendarName, setNewCalendarName] = useState('');
  const [selectedColor, setSelectedColor] = useState(CALENDAR_COLORS[0]);
  
  const { 
    accounts, 
    toggleVisibility, 
    addAccount, 
    removeAccount,
    setAllVisible 
  } = useCalendarFilterStore();
  
  const { calendars: googleCalendars, isConnected: isGoogleConnected } = useGoogleCalendar();

  // Sync Google calendars to accounts
  React.useEffect(() => {
    if (isGoogleConnected && googleCalendars.length > 0) {
      googleCalendars.forEach(gc => {
        const exists = accounts.find(a => a.id === gc.id);
        if (!exists) {
          addAccount({
            id: gc.id,
            name: gc.summary,
            color: CALENDAR_COLORS[accounts.length % CALENDAR_COLORS.length],
            visible: true,
            isGoogle: true,
          });
        }
      });
    }
  }, [isGoogleConnected, googleCalendars, accounts, addAccount]);

  const handleAddCalendar = () => {
    if (!newCalendarName.trim()) return;
    
    addAccount({
      id: `custom-${Date.now()}`,
      name: newCalendarName.trim(),
      color: selectedColor,
      visible: true,
    });
    
    setNewCalendarName('');
    setSelectedColor(CALENDAR_COLORS[0]);
    setAddDialogOpen(false);
  };

  const allVisible = accounts.every(a => a.visible);
  const someVisible = accounts.some(a => a.visible) && !allVisible;

  return (
    <ModuleContainer
      title={title}
      onRemove={onRemove}
      onTitleChange={onTitleChange}
      onMinimize={onMinimize}
      isMinimized={isMinimized}
      isDragging={isDragging}
    >
      <div className="p-3 space-y-3">
        {/* Toggle All */}
        <div className="flex items-center justify-between pb-2 border-b">
          <div className="flex items-center gap-2">
            <Checkbox 
              checked={allVisible}
              onCheckedChange={() => setAllVisible(!allVisible)}
              className="h-4 w-4"
            />
            <span className="text-sm font-medium">All Calendars</span>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setAddDialogOpen(true)}
            className="h-7 w-7 p-0"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {/* Calendar List */}
        <ScrollArea className="max-h-[200px]">
          <div className="space-y-2">
            {accounts.map((account) => (
              <div 
                key={account.id}
                className="flex items-center gap-2 group hover:bg-accent/50 rounded-md p-1.5 -mx-1.5 transition-colors"
              >
                <Checkbox 
                  checked={account.visible}
                  onCheckedChange={() => toggleVisibility(account.id)}
                  className="h-4 w-4"
                />
                <div 
                  className="w-3 h-3 rounded-full flex-shrink-0" 
                  style={{ backgroundColor: account.color }}
                />
                <span className="text-sm flex-1 truncate">{account.name}</span>
                {account.isGoogle && (
                  <Calendar className="h-3 w-3 text-muted-foreground" />
                )}
                {!account.isDefault && !account.isGoogle && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeAccount(account.id)}
                    className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
                  >
                    <span className="text-destructive text-xs">×</span>
                  </Button>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>

        {/* Info */}
        <p className="text-xs text-muted-foreground border-t pt-2">
          Toggle calendars to show/hide their events
        </p>
      </div>

      {/* Add Calendar Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="sm:max-w-[350px]">
          <DialogHeader>
            <DialogTitle>Add Calendar</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Name</label>
              <Input
                placeholder="Work, Personal, etc."
                value={newCalendarName}
                onChange={(e) => setNewCalendarName(e.target.value)}
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Color</label>
              <div className="flex flex-wrap gap-2">
                {CALENDAR_COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() => setSelectedColor(color)}
                    className={cn(
                      "w-8 h-8 rounded-full transition-all",
                      selectedColor === color && "ring-2 ring-offset-2 ring-primary"
                    )}
                    style={{ backgroundColor: color }}
                  >
                    {selectedColor === color && (
                      <Check className="h-4 w-4 text-white mx-auto" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddCalendar} disabled={!newCalendarName.trim()}>
              Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ModuleContainer>
  );
};

export default CalendarFilterModule;
