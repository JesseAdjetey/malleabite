// Calendar List Sidebar Component - Manage and toggle calendars
import React, { useState } from 'react';
import { Plus, ChevronDown, ChevronRight, MoreHorizontal, Eye, EyeOff, Share2, Trash2, Edit, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useCalendars, UserCalendar, CalendarFormData, CALENDAR_COLORS } from '@/hooks/use-calendars';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface CalendarListProps {
  className?: string;
}

export function CalendarList({ className }: CalendarListProps) {
  const { 
    calendars, 
    loading, 
    createCalendar, 
    updateCalendar, 
    deleteCalendar,
    toggleVisibility 
  } = useCalendars();

  const [myCalendarsOpen, setMyCalendarsOpen] = useState(true);
  const [otherCalendarsOpen, setOtherCalendarsOpen] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedCalendar, setSelectedCalendar] = useState<UserCalendar | null>(null);
  
  // Form state
  const [formData, setFormData] = useState<CalendarFormData>({
    name: '',
    description: '',
    color: CALENDAR_COLORS[0].value,
  });

  // Reset form
  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      color: CALENDAR_COLORS[0].value,
    });
    setSelectedCalendar(null);
  };

  // Handle create calendar
  const handleCreate = async () => {
    if (!formData.name.trim()) {
      toast.error('Calendar name is required');
      return;
    }

    const result = await createCalendar(formData);
    if (result.success) {
      setIsCreateDialogOpen(false);
      resetForm();
    }
  };

  // Handle edit calendar
  const handleEdit = async () => {
    if (!selectedCalendar || !formData.name.trim()) return;

    const result = await updateCalendar(selectedCalendar.id, formData);
    if (result.success) {
      setIsEditDialogOpen(false);
      resetForm();
    }
  };

  // Handle delete calendar
  const handleDelete = async () => {
    if (!selectedCalendar) return;

    const result = await deleteCalendar(selectedCalendar.id);
    if (result.success) {
      setIsDeleteDialogOpen(false);
      resetForm();
    }
  };

  // Open edit dialog with calendar data
  const openEditDialog = (calendar: UserCalendar) => {
    setSelectedCalendar(calendar);
    setFormData({
      name: calendar.name,
      description: calendar.description || '',
      color: calendar.color,
    });
    setIsEditDialogOpen(true);
  };

  // Open delete dialog
  const openDeleteDialog = (calendar: UserCalendar) => {
    setSelectedCalendar(calendar);
    setIsDeleteDialogOpen(true);
  };

  // Separate my calendars from shared calendars
  const myCalendars = calendars.filter(c => !c.shareSettings.sharedWith.length || c.isPrimary);
  const sharedCalendars = calendars.filter(c => c.shareSettings.sharedWith.length > 0 && !c.isPrimary);

  if (loading) {
    return (
      <div className={cn("p-4 space-y-2", className)}>
        <div className="h-4 bg-white/10 rounded animate-pulse" />
        <div className="h-4 bg-white/10 rounded animate-pulse w-3/4" />
        <div className="h-4 bg-white/10 rounded animate-pulse w-1/2" />
      </div>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      {/* My Calendars */}
      <Collapsible open={myCalendarsOpen} onOpenChange={setMyCalendarsOpen}>
        <div className="flex items-center justify-between px-2 py-1">
          <CollapsibleTrigger className="flex items-center gap-1 text-sm font-medium hover:text-primary transition-colors">
            {myCalendarsOpen ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
            My calendars
          </CollapsibleTrigger>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => setIsCreateDialogOpen(true)}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        
        <CollapsibleContent className="space-y-0.5">
          {myCalendars.map((calendar) => (
            <CalendarItem
              key={calendar.id}
              calendar={calendar}
              onToggle={() => toggleVisibility(calendar.id)}
              onEdit={() => openEditDialog(calendar)}
              onDelete={() => openDeleteDialog(calendar)}
            />
          ))}
        </CollapsibleContent>
      </Collapsible>

      {/* Other Calendars (shared with me) */}
      {sharedCalendars.length > 0 && (
        <Collapsible open={otherCalendarsOpen} onOpenChange={setOtherCalendarsOpen}>
          <div className="flex items-center justify-between px-2 py-1">
            <CollapsibleTrigger className="flex items-center gap-1 text-sm font-medium hover:text-primary transition-colors">
              {otherCalendarsOpen ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
              Other calendars
            </CollapsibleTrigger>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          
          <CollapsibleContent className="space-y-0.5">
            {sharedCalendars.map((calendar) => (
              <CalendarItem
                key={calendar.id}
                calendar={calendar}
                onToggle={() => toggleVisibility(calendar.id)}
                onEdit={() => openEditDialog(calendar)}
                onDelete={() => openDeleteDialog(calendar)}
              />
            ))}
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Create Calendar Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create new calendar</DialogTitle>
            <DialogDescription>
              Add a new calendar to organize your events
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Calendar name"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Optional description"
                rows={2}
              />
            </div>
            
            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex flex-wrap gap-2">
                {CALENDAR_COLORS.map((color) => (
                  <button
                    key={color.value}
                    type="button"
                    className={cn(
                      "w-6 h-6 rounded-full transition-transform hover:scale-110",
                      formData.color === color.value && "ring-2 ring-white ring-offset-2 ring-offset-background"
                    )}
                    style={{ backgroundColor: color.value }}
                    onClick={() => setFormData({ ...formData, color: color.value })}
                    title={color.label}
                  />
                ))}
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate}>
              Create calendar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Calendar Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit calendar</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Name</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Calendar name"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Optional description"
                rows={2}
              />
            </div>
            
            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex flex-wrap gap-2">
                {CALENDAR_COLORS.map((color) => (
                  <button
                    key={color.value}
                    type="button"
                    className={cn(
                      "w-6 h-6 rounded-full transition-transform hover:scale-110",
                      formData.color === color.value && "ring-2 ring-white ring-offset-2 ring-offset-background"
                    )}
                    style={{ backgroundColor: color.value }}
                    onClick={() => setFormData({ ...formData, color: color.value })}
                    title={color.label}
                  />
                ))}
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEdit}>
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete calendar?</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{selectedCalendar?.name}"? 
              This will permanently delete all events in this calendar.
            </DialogDescription>
          </DialogHeader>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Delete calendar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Individual calendar item component
interface CalendarItemProps {
  calendar: UserCalendar;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

function CalendarItem({ calendar, onToggle, onEdit, onDelete }: CalendarItemProps) {
  return (
    <div className="group flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-white/5 transition-colors">
      <button
        className="flex items-center justify-center"
        onClick={onToggle}
      >
        <div
          className={cn(
            "w-4 h-4 rounded border-2 flex items-center justify-center transition-colors",
            calendar.isVisible 
              ? "border-transparent" 
              : "border-white/30"
          )}
          style={{ 
            backgroundColor: calendar.isVisible ? calendar.color : 'transparent' 
          }}
        >
          {calendar.isVisible && (
            <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none">
              <path d="M2.5 6L5 8.5L9.5 3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        </div>
      </button>
      
      <span className={cn(
        "flex-1 text-sm truncate",
        !calendar.isVisible && "text-muted-foreground"
      )}>
        {calendar.name}
      </span>
      
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={onToggle}>
            {calendar.isVisible ? (
              <>
                <EyeOff className="h-4 w-4 mr-2" />
                Hide from list
              </>
            ) : (
              <>
                <Eye className="h-4 w-4 mr-2" />
                Show in list
              </>
            )}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onEdit}>
            <Edit className="h-4 w-4 mr-2" />
            Edit calendar
          </DropdownMenuItem>
          <DropdownMenuItem>
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem>
            <Share2 className="h-4 w-4 mr-2" />
            Share calendar
          </DropdownMenuItem>
          {!calendar.isPrimary && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={onDelete}
                className="text-red-500 focus:text-red-500"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete calendar
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export default CalendarList;
