 // Calendar Snapshot Dialog - Save/restore calendar states
import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { FolderPlus, FolderOpen, Trash2, Download, Calendar, AlertTriangle } from 'lucide-react';
import { useCalendarSnapshots } from '@/hooks/use-calendar-snapshots';
import dayjs from 'dayjs';

interface CalendarSnapshotDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CalendarSnapshotDialog({
  open,
  onOpenChange,
}: CalendarSnapshotDialogProps) {
  const {
    snapshots,
    loading,
    createSnapshot,
    restoreSnapshot,
    saveAndStartFresh,
    deleteSnapshot,
  } = useCalendarSnapshots();

  const [activeTab, setActiveTab] = useState<'save' | 'restore'>('save');
  
  // Save form state
  const [snapshotName, setSnapshotName] = useState('');
  const [snapshotDescription, setSnapshotDescription] = useState('');
  const [saveAndClear, setSaveAndClear] = useState(false);
  
  // Delete confirmation
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [snapshotToDelete, setSnapshotToDelete] = useState<string | null>(null);

  const handleSave = async () => {
    if (!snapshotName.trim()) return;

    let success = false;
    
    if (saveAndClear) {
      success = await saveAndStartFresh(snapshotName, snapshotDescription);
    } else {
      const result = await createSnapshot(snapshotName, snapshotDescription);
      success = result.success;
    }

    if (success) {
      setSnapshotName('');
      setSnapshotDescription('');
      setSaveAndClear(false);
      if (saveAndClear) {
        onOpenChange(false);
      }
    }
  };

  const handleRestore = async (snapshotId: string) => {
    const success = await restoreSnapshot(snapshotId);
    if (success) {
      onOpenChange(false);
    }
  };

  const handleDeleteClick = (snapshotId: string) => {
    setSnapshotToDelete(snapshotId);
    setDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (snapshotToDelete) {
      await deleteSnapshot(snapshotToDelete);
      setSnapshotToDelete(null);
    }
    setDeleteConfirmOpen(false);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderPlus className="h-5 w-5" />
              Calendar Snapshots
            </DialogTitle>
            <DialogDescription>
              Save your calendar to a folder and start fresh, or restore a previous snapshot
            </DialogDescription>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'save' | 'restore')}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="save" className="flex items-center gap-2">
                <FolderPlus className="h-4 w-4" />
                Save Calendar
              </TabsTrigger>
              <TabsTrigger value="restore" className="flex items-center gap-2">
                <FolderOpen className="h-4 w-4" />
                Restore ({snapshots.length})
              </TabsTrigger>
            </TabsList>

            {/* Save Tab */}
            <TabsContent value="save" className="space-y-4 mt-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="snapshot-name">Snapshot Name *</Label>
                  <Input
                    id="snapshot-name"
                    placeholder="e.g., Q1 2024 Work Schedule"
                    value={snapshotName}
                    onChange={(e) => setSnapshotName(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="snapshot-description">Description (optional)</Label>
                  <Textarea
                    id="snapshot-description"
                    placeholder="Add notes about this calendar snapshot..."
                    rows={3}
                    value={snapshotDescription}
                    onChange={(e) => setSnapshotDescription(e.target.value)}
                  />
                </div>

                <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/10 p-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="save-and-clear"
                          checked={saveAndClear}
                          onChange={(e) => setSaveAndClear(e.target.checked)}
                          className="cursor-pointer"
                        />
                        <Label htmlFor="save-and-clear" className="cursor-pointer font-semibold">
                          Save and Start Fresh
                        </Label>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {saveAndClear 
                          ? "This will save your current calendar and delete all events, giving you a clean slate."
                          : "This will only save a copy. Your current calendar will remain unchanged."}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={!snapshotName.trim()}
                >
                  <Download className="h-4 w-4 mr-2" />
                  {saveAndClear ? 'Save & Clear Calendar' : 'Save Snapshot'}
                </Button>
              </DialogFooter>
            </TabsContent>

            {/* Restore Tab */}
            <TabsContent value="restore" className="mt-4">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                </div>
              ) : snapshots.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <FolderOpen className="h-12 w-12 text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground">No saved snapshots yet</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Save your first calendar snapshot to get started
                  </p>
                </div>
              ) : (
                <ScrollArea className="h-[400px] pr-4">
                  <div className="space-y-3">
                    {snapshots.map((snapshot) => (
                      <div
                        key={snapshot.id}
                        className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Calendar className="h-4 w-4 text-primary flex-shrink-0" />
                            <h4 className="font-medium truncate">{snapshot.name}</h4>
                            <Badge variant="secondary" className="ml-auto">
                              {snapshot.eventCount} events
                            </Badge>
                          </div>
                          {snapshot.description && (
                            <p className="text-sm text-muted-foreground line-clamp-1 mb-2">
                              {snapshot.description}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground">
                            Saved {dayjs(snapshot.createdAt).format('MMM D, YYYY h:mm A')}
                          </p>
                        </div>

                        <div className="flex items-center gap-2 ml-4">
                          <Button
                            size="sm"
                            onClick={() => handleRestore(snapshot.id)}
                          >
                            <Download className="h-4 w-4 mr-2" />
                            Restore
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeleteClick(snapshot.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Calendar Snapshot?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this snapshot and all its saved events. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive">
              Delete Snapshot
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
