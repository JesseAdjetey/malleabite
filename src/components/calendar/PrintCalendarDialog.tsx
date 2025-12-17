// Print Calendar Dialog - Options for printing calendar
import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Printer, Download, FileText, CalendarIcon } from 'lucide-react';
import { usePrintCalendar, PrintLayout, PrintOrientation, PrintSize, PrintOptions } from '@/hooks/use-print-calendar';
import { useEventStore } from '@/lib/store';
import dayjs from 'dayjs';
import { cn } from '@/lib/utils';

interface PrintCalendarDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PrintCalendarDialog({ open, onOpenChange }: PrintCalendarDialogProps) {
  const { printCalendar, exportHTML } = usePrintCalendar();
  const { events } = useEventStore();

  const [options, setOptions] = useState<PrintOptions>({
    layout: 'week',
    orientation: 'landscape',
    size: 'letter',
    showWeekends: true,
    showDeclinedEvents: false,
    showEventDetails: true,
    showAllDayEvents: true,
    fontSize: 'medium',
    startDate: dayjs().startOf('week'),
    title: 'My Calendar',
  });

  const [datePickerOpen, setDatePickerOpen] = useState(false);

  const handlePrint = () => {
    printCalendar(events, options);
    onOpenChange(false);
  };

  const handleExport = () => {
    exportHTML(events, options, `calendar-${dayjs().format('YYYY-MM-DD')}.html`);
    onOpenChange(false);
  };

  const updateOption = <K extends keyof PrintOptions>(key: K, value: PrintOptions[K]) => {
    setOptions(prev => ({ ...prev, [key]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Printer className="h-5 w-5" />
            Print Calendar
          </DialogTitle>
          <DialogDescription>
            Customize your calendar printout
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Layout Selection */}
          <div className="space-y-2">
            <Label>View</Label>
            <RadioGroup
              value={options.layout}
              onValueChange={(v) => updateOption('layout', v as PrintLayout)}
              className="grid grid-cols-4 gap-2"
            >
              {(['day', 'week', 'month', 'agenda'] as PrintLayout[]).map((layout) => (
                <div key={layout}>
                  <RadioGroupItem
                    value={layout}
                    id={`layout-${layout}`}
                    className="peer sr-only"
                  />
                  <Label
                    htmlFor={`layout-${layout}`}
                    className={cn(
                      'flex flex-col items-center justify-center p-3 border rounded-lg cursor-pointer',
                      'peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5',
                      'hover:bg-accent transition-colors'
                    )}
                  >
                    <span className="text-2xl mb-1">
                      {layout === 'day' ? '1️⃣' : layout === 'week' ? '7️⃣' : layout === 'month' ? '📅' : '📋'}
                    </span>
                    <span className="text-xs capitalize">{layout}</span>
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          {/* Date Selection */}
          <div className="space-y-2">
            <Label>Starting Date</Label>
            <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start">
                  <CalendarIcon className="h-4 w-4 mr-2" />
                  {options.startDate.format('MMMM D, YYYY')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={options.startDate.toDate()}
                  onSelect={(date) => {
                    if (date) {
                      updateOption('startDate', dayjs(date));
                      setDatePickerOpen(false);
                    }
                  }}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Page Setup */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Orientation</Label>
              <Select
                value={options.orientation}
                onValueChange={(v) => updateOption('orientation', v as PrintOrientation)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="portrait">Portrait</SelectItem>
                  <SelectItem value="landscape">Landscape</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Paper Size</Label>
              <Select
                value={options.size}
                onValueChange={(v) => updateOption('size', v as PrintSize)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="letter">Letter</SelectItem>
                  <SelectItem value="a4">A4</SelectItem>
                  <SelectItem value="legal">Legal</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Font Size */}
          <div className="space-y-2">
            <Label>Font Size</Label>
            <RadioGroup
              value={options.fontSize}
              onValueChange={(v) => updateOption('fontSize', v as 'small' | 'medium' | 'large')}
              className="flex gap-4"
            >
              {(['small', 'medium', 'large'] as const).map((size) => (
                <div key={size} className="flex items-center gap-2">
                  <RadioGroupItem value={size} id={`size-${size}`} />
                  <Label htmlFor={`size-${size}`} className="capitalize cursor-pointer">
                    {size}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          {/* Options */}
          <div className="space-y-3">
            <Label>Options</Label>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="font-normal">Show Weekends</Label>
                <Switch
                  checked={options.showWeekends}
                  onCheckedChange={(v) => updateOption('showWeekends', v)}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label className="font-normal">Show All-Day Events</Label>
                <Switch
                  checked={options.showAllDayEvents}
                  onCheckedChange={(v) => updateOption('showAllDayEvents', v)}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label className="font-normal">Show Event Details</Label>
                <Switch
                  checked={options.showEventDetails}
                  onCheckedChange={(v) => updateOption('showEventDetails', v)}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label className="font-normal">Include Declined Events</Label>
                <Switch
                  checked={options.showDeclinedEvents}
                  onCheckedChange={(v) => updateOption('showDeclinedEvents', v)}
                />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Export HTML
          </Button>
          <Button onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-2" />
            Print
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default PrintCalendarDialog;
