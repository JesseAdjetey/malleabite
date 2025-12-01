import { useState, useRef } from 'react';
import { Upload, Download, FileText, CheckCircle2, AlertCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useCalendarEvents } from '@/hooks/use-calendar-events';
import { 
  parseICalendar, 
  exportToICalendar, 
  downloadICalendar, 
  readICalendarFile 
} from '@/lib/utils/calendar-import-export';
import { toast } from 'sonner';
import dayjs from 'dayjs';

export function CalendarImportExport() {
  const { events, addEvent } = useCalendarEvents();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [importPreview, setImportPreview] = useState<any[]>([]);
  const [showPreview, setShowPreview] = useState(false);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.ics')) {
      toast.error('Please select an .ics file');
      return;
    }

    setImporting(true);

    try {
      const content = await readICalendarFile(file);
      const importedEvents = parseICalendar(content);

      if (importedEvents.length === 0) {
        toast.error('No events found in the file');
        return;
      }

      setImportPreview(importedEvents);
      setShowPreview(true);
      toast.success(`Found ${importedEvents.length} events to import`);
    } catch (error) {
      console.error('Import error:', error);
      toast.error('Failed to import calendar file');
    } finally {
      setImporting(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const confirmImport = async () => {
    setImporting(true);

    try {
      let successCount = 0;
      for (const event of importPreview) {
        try {
          await addEvent(event as any);
          successCount++;
        } catch (error) {
          console.error('Failed to import event:', event.title, error);
        }
      }

      toast.success(`Successfully imported ${successCount} events!`);
      setShowPreview(false);
      setImportPreview([]);
    } catch (error) {
      console.error('Import error:', error);
      toast.error('Failed to import some events');
    } finally {
      setImporting(false);
    }
  };

  const handleExport = () => {
    try {
      const icsContent = exportToICalendar(events, 'Malleabite Calendar');
      const filename = `malleabite-calendar-${dayjs().format('YYYY-MM-DD')}.ics`;
      downloadICalendar(icsContent, filename);
      toast.success(`Exported ${events.length} events`);
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export calendar');
    }
  };

  return (
    <div className="space-y-6">
      {/* Import/Export Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Import Card */}
        <Card className="p-6">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-lg bg-blue-500/10">
              <Upload className="h-6 w-6 text-blue-500" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold mb-1">Import Calendar</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Import events from Google Calendar, Outlook, or any .ics file
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".ics"
                onChange={handleFileSelect}
                className="hidden"
              />
              <Button
                onClick={() => fileInputRef.current?.click()}
                disabled={importing}
                className="w-full"
              >
                <Upload className="h-4 w-4 mr-2" />
                {importing ? 'Processing...' : 'Select .ics File'}
              </Button>
            </div>
          </div>
        </Card>

        {/* Export Card */}
        <Card className="p-6">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-lg bg-purple-500/10">
              <Download className="h-6 w-6 text-purple-500" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold mb-1">Export Calendar</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Download your calendar as .ics file for use in other apps
              </p>
              <Button
                onClick={handleExport}
                disabled={events.length === 0}
                variant="outline"
                className="w-full"
              >
                <Download className="h-4 w-4 mr-2" />
                Export {events.length} Events
              </Button>
            </div>
          </div>
        </Card>
      </div>

      {/* Import Preview */}
      {showPreview && (
        <Card className="p-6 border-2 border-blue-500">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-500" />
              <h3 className="font-semibold">Import Preview</h3>
              <Badge variant="secondary">{importPreview.length} events</Badge>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setShowPreview(false);
                setImportPreview([]);
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="space-y-2 max-h-[400px] overflow-y-auto mb-4">
            {importPreview.map((event, idx) => (
              <div
                key={idx}
                className="p-3 rounded-lg border-2 border-transparent hover:border-purple-200 dark:hover:border-purple-800 hover:bg-accent/50 dark:hover:bg-accent/20 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full mt-1"
                      style={{ backgroundColor: event.color || '#3b82f6' }}
                    />
                    <div>
                      <p className="font-medium text-sm">{event.title}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                        <span>
                          {dayjs(event.startsAt).format('MMM D, h:mm A')}
                        </span>
                        <span>→</span>
                        <span>
                          {dayjs(event.endsAt).format('h:mm A')}
                        </span>
                        {event.category && (
                          <Badge variant="outline" className="text-xs">
                            {event.category}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-3">
            <Button
              onClick={confirmImport}
              disabled={importing}
              className="flex-1 bg-blue-500 hover:bg-blue-600"
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              {importing ? 'Importing...' : `Import ${importPreview.length} Events`}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setShowPreview(false);
                setImportPreview([]);
              }}
            >
              Cancel
            </Button>
          </div>
        </Card>
      )}

      {/* Instructions */}
      <Card className="p-4 bg-gradient-to-r dark:from-blue-950 dark:to-purple-950">
        <h4 className="font-semibold text-sm mb-2">📁 Supported Formats:</h4>
        <ul className="text-sm space-y-1 text-muted-foreground list-disc list-inside">
          <li><strong>Google Calendar:</strong> Settings → Import & Export → Export</li>
          <li><strong>Outlook:</strong> File → Save Calendar → iCalendar Format (.ics)</li>
          <li><strong>Apple Calendar:</strong> File → Export → Export</li>
          <li><strong>Other Apps:</strong> Any standard .ics (iCalendar) file</li>
        </ul>
      </Card>
    </div>
  );
}
