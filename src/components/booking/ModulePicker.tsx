import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, Plus, Calendar } from 'lucide-react';
import { useSidebarPages } from '@/hooks/use-sidebar-pages';
import { useGroupMeets } from '@/hooks/use-group-meets';
import { ModuleInstance, SidebarPage } from '@/lib/stores/types';
import { cn } from '@/lib/utils';

interface ModulePickerProps {
  open: boolean;
  sessionId: string;
  sessionTitle: string;
  organizerName: string;
  onDone: () => void;
}

const ModulePicker: React.FC<ModulePickerProps> = ({
  open,
  sessionId,
  sessionTitle,
  organizerName,
  onDone,
}) => {
  const { pages, addModule } = useSidebarPages();
  const { attachToModule } = useGroupMeets();
  const [selected, setSelected] = useState<{ pageId: string; instanceId: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Collect all existing Booking module instances across all pages
  const bookingModules: { pageId: string; pageTitle: string; module: ModuleInstance }[] = [];
  pages.forEach((page: SidebarPage) => {
    page.modules
      .filter(m => m.type === 'booking')
      .forEach(m => {
        bookingModules.push({ pageId: page.id, pageTitle: page.title, module: m });
      });
  });

  const defaultPage = pages[0];

  const handleConfirm = async () => {
    if (!selected && !defaultPage) return;
    setSubmitting(true);

    try {
      if (selected) {
        // Attach to existing module
        await attachToModule(sessionId, selected.instanceId);
      } else {
        // Create a new Booking module on the first page, then attach
        const result = await addModule(defaultPage.id, {
          type: 'booking',
          title: 'Booking',
        });
        if (result?.success && result?.instanceId) {
          await attachToModule(sessionId, result.instanceId);
        }
      }
      onDone();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-[380px] bg-background/95 backdrop-blur-xl border-border/60 p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-3">
          <DialogTitle className="text-base font-bold">Add meeting to a module</DialogTitle>
          <p className="text-sm text-muted-foreground mt-0.5">
            <span className="font-medium text-foreground">{organizerName}</span> invited you to{' '}
            <span className="font-medium text-foreground">"{sessionTitle}"</span>.
            Where should it live?
          </p>
        </DialogHeader>

        <div className="px-5 pb-5 space-y-3">
          {bookingModules.length > 0 ? (
            <>
              <div className="space-y-1.5">
                {bookingModules.map(({ pageId, pageTitle, module }) => {
                  const isSelected = selected?.instanceId === module.instanceId;
                  return (
                    <button
                      key={module.id}
                      onClick={() => setSelected({ pageId, instanceId: module.instanceId! })}
                      className={cn(
                        'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border-2 transition-all text-left',
                        isSelected
                          ? 'border-purple-500/60 bg-purple-500/10'
                          : 'border-border/40 hover:border-border/70'
                      )}
                    >
                      <div className={cn(
                        'w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
                        isSelected ? 'bg-purple-500/20' : 'bg-muted/60'
                      )}>
                        <Calendar size={15} className={isSelected ? 'text-purple-500' : 'text-muted-foreground'} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={cn('text-sm font-semibold', isSelected ? 'text-foreground' : 'text-muted-foreground')}>
                          {module.title}
                        </p>
                        <p className="text-[11px] text-muted-foreground">{pageTitle}</p>
                      </div>
                      {isSelected && (
                        <div className="w-4 h-4 rounded-full bg-purple-500 flex items-center justify-center shrink-0">
                          <div className="w-1.5 h-1.5 rounded-full bg-white" />
                        </div>
                      )}
                    </button>
                  );
                })}

                <button
                  onClick={() => setSelected(null)}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border-2 transition-all text-left',
                    selected === null
                      ? 'border-purple-500/60 bg-purple-500/10'
                      : 'border-border/40 hover:border-border/70'
                  )}
                >
                  <div className={cn(
                    'w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
                    selected === null ? 'bg-purple-500/20' : 'bg-muted/60'
                  )}>
                    <Plus size={15} className={selected === null ? 'text-purple-500' : 'text-muted-foreground'} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn('text-sm font-semibold', selected === null ? 'text-foreground' : 'text-muted-foreground')}>
                      New Booking module
                    </p>
                    <p className="text-[11px] text-muted-foreground">Create a fresh one</p>
                  </div>
                  {selected === null && (
                    <div className="w-4 h-4 rounded-full bg-purple-500 flex items-center justify-center shrink-0">
                      <div className="w-1.5 h-1.5 rounded-full bg-white" />
                    </div>
                  )}
                </button>
              </div>
            </>
          ) : (
            <div className="rounded-xl bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
              A new Booking module will be added to your sidebar.
            </div>
          )}

          <Button
            onClick={handleConfirm}
            disabled={submitting}
            className="w-full bg-purple-600 hover:bg-purple-700 text-white"
          >
            {submitting
              ? <><Loader2 size={15} className="mr-2 animate-spin" />Adding...</>
              : 'Add to my sidebar'
            }
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ModulePicker;
