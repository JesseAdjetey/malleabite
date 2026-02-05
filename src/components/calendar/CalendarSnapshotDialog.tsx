import React, { useState } from 'react';
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
import { FolderPlus, FolderOpen, Trash2, Download, Calendar, RotateCcw, Sparkles } from 'lucide-react';
import { useCalendarEvents } from '@/hooks/use-calendar-events';
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
    archiveAllEvents,
    restoreFolder,
    deleteArchivedFolder,
    archivedFolders,
    loading
  } = useCalendarEvents();

  const [activeTab, setActiveTab] = useState<'save' | 'restore'>('save');

  // Save form state
  const [snapshotName, setSnapshotName] = useState('');

  // Delete confirmation
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [snapshotToDelete, setSnapshotToDelete] = useState<string | null>(null);

  const handleSave = async () => {
    if (!snapshotName.trim()) return;

    const result = await archiveAllEvents(snapshotName.trim());
    if (result.success) {
      setSnapshotName('');
      onOpenChange(false);
    }
  };

  const handleRestore = async (name: string) => {
    const response = await restoreFolder(name);
    if (response.success) {
      onOpenChange(false);
    }
  };

  const handleDeleteClick = (name: string) => {
    setSnapshotToDelete(name);
    setDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (snapshotToDelete) {
      await deleteArchivedFolder(snapshotToDelete);
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
              Calendar Archives
            </DialogTitle>
            <DialogDescription>
              Archive your current calendar to start fresh, or restore a previous archive.
            </DialogDescription>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'save' | 'restore')}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="save" className="flex items-center gap-2">
                <FolderPlus className="h-4 w-4" />
                Archive Current
              </TabsTrigger>
              <TabsTrigger value="restore" className="flex items-center gap-2">
                <FolderOpen className="h-4 w-4" />
                Restore ({archivedFolders.length})
              </TabsTrigger>
            </TabsList>

            {/* Save Tab */}
            <TabsContent value="save" className="space-y-4 mt-4">
              <div className="space-y-4">
                {/* Quick Start Fresh Button */}
                <div className="p-4 rounded-lg border-2 border-dashed border-primary/30 bg-primary/5">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-primary/10">
                      <Sparkles className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium">Quick Start Fresh</h4>
                      <p className="text-sm text-muted-foreground">
                        Archive all events and start with a clean calendar
                      </p>
                    </div>
                    <Button
                      onClick={async () => {
                        const autoName = `Archive ${dayjs().format('MMM D, YYYY')}`;
                        const result = await archiveAllEvents(autoName);
                        if (result.success) {
                          onOpenChange(false);
                        }
                      }}
                      disabled={loading}
                      className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                    >
                      <Sparkles className="h-4 w-4 mr-2" />
                      Start Fresh
                    </Button>
                  </div>
                </div>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">or customize</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="snapshot-name">Archive Name</Label>
                  <Input
                    id="snapshot-name"
                    placeholder="e.g., Spring 2024 Schedule"
                    value={snapshotName}
                    onChange={(e) => setSnapshotName(e.target.value)}
                  />
                  <p className="text-sm text-yellow-500/80 mt-2">
                    Note: Archiving will hide all current events from your calendar view.
                  </p>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={!snapshotName.trim() || loading}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Archive & Clear
                </Button>
              </DialogFooter>
            </TabsContent>

            {/* Restore Tab */}
            <TabsContent value="restore" className="mt-4">
              {loading && archivedFolders.length === 0 ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                </div>
              ) : archivedFolders.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <FolderOpen className="h-12 w-12 text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground">No archives found</p>
                </div>
              ) : (
                <ScrollArea className="h-[400px] pr-4">
                  <div className="space-y-3">
                    {archivedFolders.map((folder) => (
                      <div
                        key={folder.name}
                        className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Calendar className="h-4 w-4 text-primary flex-shrink-0" />
                            <h4 className="font-medium truncate">{folder.name}</h4>
                            <Badge variant="secondary" className="ml-auto">
                              {folder.count} events
                            </Badge>
                          </div>
                          {folder.lastUpdatedAt && (
                            <p className="text-xs text-muted-foreground">
                              Last updated {dayjs(folder.lastUpdatedAt).format('MMM D, YYYY h:mm A')}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-2 ml-4">
                          <Button
                            size="sm"
                            onClick={() => handleRestore(folder.name)}
                          >
                            <RotateCcw className="h-4 w-4 mr-2" />
                            Restore
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-red-500 hover:text-red-600 hover:bg-red-500/10"
                            onClick={() => handleDeleteClick(folder.name)}
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
            <AlertDialogTitle>Delete Archive?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{snapshotToDelete}" and all its {archivedFolders.find(f => f.name === snapshotToDelete)?.count} events. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive">
              Delete Forever
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
