// Mobile-optimized event creation/edit form with touch-friendly inputs
import { useState } from 'react';
import { X, Calendar, Clock, Tag, FileText, Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface MobileEventFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (event: any) => void;
  initialEvent?: any;
  defaultDate?: Date;
}

export function MobileEventForm({
  isOpen,
  onClose,
  onSave,
  initialEvent,
  defaultDate,
}: MobileEventFormProps) {
  const [title, setTitle] = useState(initialEvent?.title || '');
  const [description, setDescription] = useState(initialEvent?.description || '');
  const [startDate, setStartDate] = useState(
    initialEvent?.startsAt
      ? new Date(initialEvent.startsAt).toISOString().slice(0, 16)
      : defaultDate
      ? defaultDate.toISOString().slice(0, 16)
      : new Date().toISOString().slice(0, 16)
  );
  const [endDate, setEndDate] = useState(
    initialEvent?.endsAt
      ? new Date(initialEvent.endsAt).toISOString().slice(0, 16)
      : ''
  );
  const [category, setCategory] = useState(initialEvent?.category || 'work');
  const [allDay, setAllDay] = useState(initialEvent?.allDay || false);
  const [reminder, setReminder] = useState(initialEvent?.reminder || false);

  const handleSave = () => {
    const eventData = {
      ...initialEvent,
      title,
      description,
      startsAt: new Date(startDate),
      endsAt: endDate ? new Date(endDate) : null,
      category,
      allDay,
      reminder,
    };

    onSave(eventData);
    onClose();
  };

  const categories = [
    { value: 'work', label: 'Work', color: 'bg-blue-500' },
    { value: 'personal', label: 'Personal', color: 'bg-green-500' },
    { value: 'health', label: 'Health', color: 'bg-red-500' },
    { value: 'social', label: 'Social', color: 'bg-purple-500' },
    { value: 'learning', label: 'Learning', color: 'bg-yellow-500' },
  ];

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="bottom" className="h-[90vh] rounded-t-xl">
        <SheetHeader className="pb-4">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-xl">
              {initialEvent ? 'Edit Event' : 'New Event'}
            </SheetTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-10 w-10"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
          <SheetDescription>
            {initialEvent ? 'Update your event details' : 'Create a new calendar event'}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto pb-20">
          <div className="space-y-6 pt-4">
            {/* Title - Large touch target */}
            <div className="space-y-2">
              <Label htmlFor="title" className="text-base font-semibold">
                Event Title *
              </Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="What's the event?"
                className="h-12 text-base"
                autoFocus
              />
            </div>

            {/* Date & Time */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="h-5 w-5 text-muted-foreground" />
                <Label className="text-base font-semibold">Date & Time</Label>
              </div>

              <div className="space-y-2">
                <Label htmlFor="start-date" className="text-sm">
                  Start
                </Label>
                <Input
                  id="start-date"
                  type="datetime-local"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="h-12 text-base"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="end-date" className="text-sm">
                  End
                </Label>
                <Input
                  id="end-date"
                  type="datetime-local"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="h-12 text-base"
                />
              </div>

              <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/50">
                <Label htmlFor="all-day" className="text-base cursor-pointer">
                  All-day event
                </Label>
                <Switch
                  id="all-day"
                  checked={allDay}
                  onCheckedChange={setAllDay}
                  className="data-[state=checked]:bg-primary"
                />
              </div>
            </div>

            {/* Category */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 mb-2">
                <Tag className="h-5 w-5 text-muted-foreground" />
                <Label className="text-base font-semibold">Category</Label>
              </div>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="h-12 text-base">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem
                      key={cat.value}
                      value={cat.value}
                      className="h-12 text-base"
                    >
                      <div className="flex items-center gap-2">
                        <div className={`h-3 w-3 rounded-full ${cat.color}`} />
                        <span>{cat.label}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="h-5 w-5 text-muted-foreground" />
                <Label htmlFor="description" className="text-base font-semibold">
                  Description
                </Label>
              </div>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add details..."
                className="min-h-[120px] text-base resize-none"
              />
            </div>

            {/* Reminder */}
            <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/50">
              <div className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-muted-foreground" />
                <Label htmlFor="reminder" className="text-base cursor-pointer">
                  Set reminder
                </Label>
              </div>
              <Switch
                id="reminder"
                checked={reminder}
                onCheckedChange={setReminder}
                className="data-[state=checked]:bg-primary"
              />
            </div>
          </div>
        </div>

        {/* Fixed bottom actions */}
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-background border-t">
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1 h-12 text-base"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={!title.trim()}
              className="flex-1 h-12 text-base"
            >
              {initialEvent ? 'Update' : 'Create'}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
