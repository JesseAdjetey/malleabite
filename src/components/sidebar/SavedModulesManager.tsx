
import React, { useState } from 'react';
import { Eye, EyeOff, Minus } from 'lucide-react';
import { 
  Dialog, 
  DialogTrigger, 
  DialogContent, 
  DialogTitle, 
  DialogHeader 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useSidebarStore } from '@/lib/store';
import { ModuleInstance } from '@/lib/stores/types';

interface SavedModulesManagerProps {
  pageIndex: number;
}

const SavedModulesManager: React.FC<SavedModulesManagerProps> = ({ pageIndex }) => {
  const [open, setOpen] = useState(false);
  const { pages, toggleModuleMinimized, removeModule } = useSidebarStore();
  
  const currentPage = pages[pageIndex];
  const modules = currentPage?.modules || [];

  const handleToggleMinimize = (moduleIndex: number) => {
    toggleModuleMinimized(pageIndex, moduleIndex);
  };

  const handleRemoveModule = (moduleIndex: number) => {
    removeModule(pageIndex, moduleIndex);
  };

  const getModuleTypeIcon = (type: string) => {
    switch (type) {
      case 'todo': return '📝';
      case 'pomodoro': return '⏱️';
      case 'alarms': return '⏰';
      case 'eisenhower': return '🔲';
      case 'invites': return '📅';
      default: return '📦';
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button 
          className="w-full mb-4 bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-white border border-gray-200 dark:border-white/10 hover:bg-gray-200 dark:hover:bg-white/20" 
          variant="outline"
        >
          Manage Modules
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-background border border-border">
        <DialogHeader>
          <DialogTitle>Manage Modules</DialogTitle>
        </DialogHeader>
        <div className="mt-4 space-y-2 max-h-80 overflow-y-auto">
          {modules.length > 0 ? (
            modules.map((module, index) => (
              <div 
                key={index} 
                className="flex justify-between items-center p-3 rounded-md bg-card hover:bg-card/80 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span>{getModuleTypeIcon(module.type)}</span>
                  <span className="font-medium truncate max-w-[180px]">{module.title}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleToggleMinimize(index)}
                    className="p-1 rounded-full hover:bg-accent"
                    aria-label={module.minimized ? "Show module" : "Hide module"}
                  >
                    {module.minimized ? (
                      <Eye size={16} className="text-primary" />
                    ) : (
                      <EyeOff size={16} className="text-muted-foreground" />
                    )}
                  </button>
                  <button
                    onClick={() => handleRemoveModule(index)}
                    className="p-1 rounded-full hover:bg-destructive/20"
                    aria-label="Remove module"
                  >
                    <Minus size={16} />
                  </button>
                </div>
              </div>
            ))
          ) : (
            <p className="text-center text-muted-foreground py-4">
              No modules available on this page
            </p>
          )}
        </div>
        <div className="flex justify-end mt-4">
          <Button 
            variant="outline" 
            onClick={() => setOpen(false)}
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SavedModulesManager;
