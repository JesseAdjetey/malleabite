// Keyboard Shortcuts Help Dialog - Display all available shortcuts
import React from 'react';
import { Keyboard } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  useKeyboardShortcuts, 
  SHORTCUT_CATEGORIES,
  DEFAULT_SHORTCUTS,
  type ShortcutAction,
  type Shortcut
} from '@/hooks/use-keyboard-shortcuts';
import { cn } from '@/lib/utils';

interface KeyboardShortcutsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function KeyboardShortcutsDialog({ open, onOpenChange }: KeyboardShortcutsDialogProps) {
  const { formatShortcut, getShortcutsByCategory } = useKeyboardShortcuts({ enabled: false });
  const groupedShortcuts = getShortcutsByCategory();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="h-5 w-5" />
            Keyboard Shortcuts
          </DialogTitle>
          <DialogDescription>
            Use these shortcuts to navigate and manage your calendar quickly
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-[60vh] pr-4">
          <div className="space-y-6">
            {Object.entries(SHORTCUT_CATEGORIES).map(([categoryKey, categoryLabel]) => {
              const shortcuts = groupedShortcuts[categoryKey];
              if (!shortcuts?.length) return null;

              return (
                <div key={categoryKey} className="space-y-3">
                  <h3 className="text-sm font-semibold text-primary border-b border-border pb-1">
                    {categoryLabel}
                  </h3>
                  <div className="grid grid-cols-2 gap-2">
                    {shortcuts.map(({ action, shortcut, formatted }) => (
                      <ShortcutRow
                        key={action}
                        description={shortcut.description}
                        shortcut={formatted}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>

        <div className="pt-4 border-t border-border text-xs text-muted-foreground">
          <p>
            Press <kbd className="kbd">?</kbd> to show/hide this dialog anytime
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Individual shortcut row
function ShortcutRow({ description, shortcut }: { description: string; shortcut: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-white/5">
      <span className="text-sm text-foreground/80">{description}</span>
      <KeyboardKey keys={shortcut} />
    </div>
  );
}

// Keyboard key display component
function KeyboardKey({ keys }: { keys: string }) {
  const parts = keys.split('+');
  
  return (
    <div className="flex items-center gap-1">
      {parts.map((key, i) => (
        <React.Fragment key={i}>
          {i > 0 && <span className="text-xs text-muted-foreground">+</span>}
          <kbd className="kbd min-w-[24px] text-center">
            {key}
          </kbd>
        </React.Fragment>
      ))}
    </div>
  );
}

// CSS for kbd element should be added to globals.css
// .kbd {
//   display: inline-flex;
//   align-items: center;
//   justify-content: center;
//   padding: 0.25rem 0.5rem;
//   font-size: 0.75rem;
//   font-family: ui-monospace, monospace;
//   font-weight: 500;
//   border-radius: 0.375rem;
//   background: hsl(var(--muted) / 0.5);
//   border: 1px solid hsl(var(--border));
//   color: hsl(var(--foreground));
//   box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
// }

export default KeyboardShortcutsDialog;
