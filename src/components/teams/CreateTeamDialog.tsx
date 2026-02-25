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
import { Loader2 } from 'lucide-react';

const TEAM_COLORS = [
  '#6366f1', '#ec4899', '#f59e0b', '#10b981',
  '#3b82f6', '#8b5cf6', '#ef4444', '#06b6d4',
];

interface CreateTeamDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateTeam: (data: { name: string; description: string; color: string }) => Promise<any>;
}

export function CreateTeamDialog({ open, onOpenChange, onCreateTeam }: CreateTeamDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState(TEAM_COLORS[0]);
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setIsCreating(true);
    try {
      await onCreateTeam({ name: name.trim(), description: description.trim(), color });
      setName('');
      setDescription('');
      setColor(TEAM_COLORS[0]);
      onOpenChange(false);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Team</DialogTitle>
          <DialogDescription>
            Create a new team workspace to collaborate with others.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <Label htmlFor="team-name">Team Name</Label>
            <Input
              id="team-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Marketing, Engineering"
              className="mt-1.5"
            />
          </div>

          <div>
            <Label htmlFor="team-desc">Description (optional)</Label>
            <Textarea
              id="team-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does this team do?"
              className="mt-1.5 resize-none"
              rows={2}
            />
          </div>

          <div>
            <Label>Color</Label>
            <div className="flex gap-2 mt-1.5">
              {TEAM_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`w-8 h-8 rounded-full transition-all ${
                    color === c ? 'ring-2 ring-offset-2 ring-offset-background ring-primary scale-110' : 'hover:scale-105'
                  }`}
                  style={{ backgroundColor: c }}
                  onClick={() => setColor(c)}
                />
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={!name.trim() || isCreating}>
            {isCreating && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
            Create Team
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
