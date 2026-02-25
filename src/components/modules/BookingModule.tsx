import React, { useState } from 'react';
import ModuleContainer from './ModuleContainer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Copy, Plus, Clock, Loader2, Link2, Power, Trash2 } from 'lucide-react';
import { useAppointmentScheduling, BookingPageFormData } from '@/hooks/use-appointment-scheduling';
import { toast } from 'sonner';

interface BookingModuleProps {
  title?: string;
  onRemove?: () => void;
  onTitleChange?: (title: string) => void;
  onMinimize?: () => void;
  isMinimized?: boolean;
  isDragging?: boolean;
  instanceId?: string;
}

const BookingModule: React.FC<BookingModuleProps> = ({
  title = 'Booking Pages',
  onRemove,
  onTitleChange,
  onMinimize,
  isMinimized = false,
  isDragging = false,
}) => {
  const {
    bookingPages,
    loading,
    createBookingPage,
    deleteBookingPage,
    togglePageActive,
    copyBookingUrl,
  } = useAppointmentScheduling();

  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDuration, setNewDuration] = useState('30');
  const [newLocationType, setNewLocationType] = useState<'video' | 'in_person' | 'phone' | 'custom'>('video');

  const handleCreate = async () => {
    if (!newTitle.trim()) return;
    setCreating(true);
    try {
      const data: BookingPageFormData = {
        title: newTitle.trim(),
        duration: parseInt(newDuration),
        locationType: newLocationType,
      };
      await createBookingPage(data);
      setNewTitle('');
      setShowCreate(false);
      toast.success('Booking page created');
    } catch {
      toast.error('Failed to create booking page');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (pageId: string) => {
    try {
      await deleteBookingPage(pageId);
      toast.success('Booking page deleted');
    } catch {
      toast.error('Failed to delete booking page');
    }
  };

  return (
    <ModuleContainer
      title={title}
      onRemove={onRemove}
      onTitleChange={onTitleChange}
      onMinimize={onMinimize}
      isMinimized={isMinimized}
      isDragging={isDragging}
    >
      <div className="space-y-3">
        {loading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : bookingPages.length === 0 && !showCreate ? (
          <div className="text-center py-4">
            <Link2 className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground mb-3">No booking pages yet</p>
            <Button size="sm" onClick={() => setShowCreate(true)}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              Create One
            </Button>
          </div>
        ) : (
          <>
            {bookingPages.map((page) => (
              <div
                key={page.id}
                className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{page.title}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {page.duration}min
                    <Badge
                      variant={page.isActive ? 'default' : 'secondary'}
                      className="text-[10px] px-1.5 py-0"
                    >
                      {page.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => copyBookingUrl(page)}
                    title="Copy link"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => togglePageActive(page.id)}
                    title={page.isActive ? 'Deactivate' : 'Activate'}
                  >
                    <Power className={`h-3.5 w-3.5 ${page.isActive ? 'text-green-500' : 'text-muted-foreground'}`} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={() => handleDelete(page.id)}
                    title="Delete"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}

            {!showCreate && (
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => setShowCreate(true)}
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                New Booking Page
              </Button>
            )}
          </>
        )}

        {showCreate && (
          <div className="space-y-3 p-3 rounded-lg bg-muted/50 border border-border/50">
            <div>
              <Label className="text-xs">Title</Label>
              <Input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="e.g. 30-Min Meeting"
                className="h-8 mt-1 text-sm"
              />
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <Label className="text-xs">Duration</Label>
                <Select value={newDuration} onValueChange={setNewDuration}>
                  <SelectTrigger className="h-8 mt-1 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="15">15 min</SelectItem>
                    <SelectItem value="30">30 min</SelectItem>
                    <SelectItem value="45">45 min</SelectItem>
                    <SelectItem value="60">60 min</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1">
                <Label className="text-xs">Type</Label>
                <Select value={newLocationType} onValueChange={(v) => setNewLocationType(v as any)}>
                  <SelectTrigger className="h-8 mt-1 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="video">Video</SelectItem>
                    <SelectItem value="in_person">In Person</SelectItem>
                    <SelectItem value="phone">Phone</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="flex-1" onClick={() => setShowCreate(false)}>
                Cancel
              </Button>
              <Button size="sm" className="flex-1" onClick={handleCreate} disabled={!newTitle.trim() || creating}>
                {creating && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
                Create
              </Button>
            </div>
          </div>
        )}
      </div>
    </ModuleContainer>
  );
};

export default BookingModule;
