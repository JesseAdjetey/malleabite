// GroupManager - Dialog for creating/editing calendar groups.
// Provides name, icon, and color selection.

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  CalendarGroup,
  GroupIcon,
  GROUP_ICON_OPTIONS,
  DEFAULT_GROUP_COLORS,
} from '@/types/calendar';
import {
  Briefcase,
  User,
  Users,
  Heart,
  Star,
  Folder,
  Globe,
  Zap,
  Check,
} from 'lucide-react';
import { springs } from '@/lib/animations';

const GROUP_ICONS_MAP: Record<GroupIcon, React.ElementType> = {
  briefcase: Briefcase,
  user: User,
  users: Users,
  heart: Heart,
  star: Star,
  folder: Folder,
  globe: Globe,
  zap: Zap,
};

interface GroupManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group?: CalendarGroup | null;       // If editing an existing group
  onSave: (data: { name: string; icon: GroupIcon; color: string }) => void;
  onDelete?: (groupId: string) => void;
}

const GroupManager: React.FC<GroupManagerProps> = ({
  open,
  onOpenChange,
  group,
  onSave,
  onDelete,
}) => {
  const isEditing = !!group;
  const [name, setName] = useState('');
  const [icon, setIcon] = useState<GroupIcon>('folder');
  const [color, setColor] = useState(DEFAULT_GROUP_COLORS[0]);

  // Populate fields when editing
  useEffect(() => {
    if (group) {
      setName(group.name);
      setIcon(group.icon);
      setColor(group.color);
    } else {
      setName('');
      setIcon('folder');
      setColor(DEFAULT_GROUP_COLORS[Math.floor(Math.random() * DEFAULT_GROUP_COLORS.length)]);
    }
  }, [group, open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSave({ name: name.trim(), icon, color });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-title3">
            {isEditing ? 'Edit Group' : 'New Group'}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Update your calendar group settings.'
              : 'Create a new group to organize your calendars.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 py-2">
          {/* Group Name */}
          <div className="space-y-2">
            <Label htmlFor="group-name" className="text-footnote font-medium">
              Name
            </Label>
            <Input
              id="group-name"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g., Side Projects"
              className="h-10"
              autoFocus
              maxLength={30}
            />
          </div>

          {/* Icon Selection */}
          <div className="space-y-2">
            <Label className="text-footnote font-medium">Icon</Label>
            <div className="grid grid-cols-4 gap-2">
              {GROUP_ICON_OPTIONS.map(option => {
                const IconComp = GROUP_ICONS_MAP[option.value];
                const isSelected = icon === option.value;
                return (
                  <motion.button
                    key={option.value}
                    type="button"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setIcon(option.value)}
                    className={cn(
                      'flex flex-col items-center gap-1 p-2.5 rounded-xl border-2 transition-all duration-200',
                      isSelected
                        ? 'border-primary bg-primary/5'
                        : 'border-transparent bg-muted/50 hover:bg-muted'
                    )}
                    aria-label={option.label}
                  >
                    <IconComp
                      size={18}
                      className={cn(
                        'transition-colors duration-200',
                        isSelected ? 'text-primary' : 'text-muted-foreground'
                      )}
                    />
                    <span className={cn(
                      'text-[10px]',
                      isSelected ? 'text-primary font-medium' : 'text-muted-foreground'
                    )}>
                      {option.label}
                    </span>
                  </motion.button>
                );
              })}
            </div>
          </div>

          {/* Color Selection */}
          <div className="space-y-2">
            <Label className="text-footnote font-medium">Color</Label>
            <div className="flex gap-2 flex-wrap">
              {DEFAULT_GROUP_COLORS.map(c => {
                const isSelected = color === c;
                return (
                  <motion.button
                    key={c}
                    type="button"
                    whileHover={{ scale: 1.15 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setColor(c)}
                    className={cn(
                      'w-8 h-8 rounded-full relative transition-all duration-200',
                      isSelected ? 'ring-2 ring-offset-2 ring-offset-background' : ''
                    )}
                    style={{
                      backgroundColor: c,
                      ['--tw-ring-color' as any]: isSelected ? c : undefined,
                    }}
                    aria-label={`Select color ${c}`}
                  >
                    <AnimatePresence>
                      {isSelected && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          exit={{ scale: 0 }}
                          transition={{ type: 'spring', damping: 20, stiffness: 400 }}
                          className="absolute inset-0 flex items-center justify-center"
                        >
                          <Check size={14} className="text-white" strokeWidth={3} />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.button>
                );
              })}
            </div>
          </div>

          {/* Preview */}
          <div className="flex items-center gap-2 p-3 rounded-xl bg-muted/30 border border-border/50">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: `${color}20` }}
            >
              {React.createElement(GROUP_ICONS_MAP[icon] || Folder, {
                size: 16,
                style: { color },
              })}
            </div>
            <span className="text-sm font-semibold text-foreground">
              {name || 'Group Name'}
            </span>
          </div>
        </form>

        <DialogFooter className="gap-2">
          {isEditing && onDelete && !group?.isDefault && (
            <Button
              type="button"
              variant="ghost"
              className="text-destructive hover:text-destructive mr-auto"
              onClick={() => {
                onDelete(group.id);
                onOpenChange(false);
              }}
            >
              Delete
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!name.trim()}>
            {isEditing ? 'Save Changes' : 'Create Group'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default GroupManager;
