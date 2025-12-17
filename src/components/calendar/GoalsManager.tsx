// Goals Management Component - View and manage personal goals
import React, { useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Target,
  Plus,
  Play,
  Pause,
  Trash2,
  Calendar,
  Flame,
  Trophy,
  Settings2,
  CheckCircle2,
} from 'lucide-react';
import {
  useGoals,
  Goal,
  GoalCategory,
  GoalFrequency,
  goalCategoryPresets,
} from '@/hooks/use-goals';
import dayjs from 'dayjs';
import { cn } from '@/lib/utils';

export function GoalsManager() {
  const {
    goalsWithProgress,
    loading,
    createGoal,
    updateGoal,
    deleteGoal,
    pauseGoal,
    resumeGoal,
    scheduleGoalSessions,
  } = useGoals();

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newGoal, setNewGoal] = useState({
    title: '',
    category: 'custom' as GoalCategory,
    frequency: 'weekly' as GoalFrequency,
    targetCount: 3,
    durationMinutes: 30,
    preferredTimeStart: '09:00',
    preferredTimeEnd: '17:00',
    preferredDays: [1, 2, 3, 4, 5],
    autoSchedule: true,
    allowWeekends: false,
    allowMornings: true,
    allowEvenings: true,
    bufferMinutes: 15,
  });

  const handleCreateGoal = async () => {
    await createGoal({
      ...newGoal,
      color: goalCategoryPresets[newGoal.category].color,
      icon: goalCategoryPresets[newGoal.category].icon,
      isActive: true,
      isPaused: false,
    });
    setIsCreateDialogOpen(false);
    setNewGoal({
      title: '',
      category: 'custom',
      frequency: 'weekly',
      targetCount: 3,
      durationMinutes: 30,
      preferredTimeStart: '09:00',
      preferredTimeEnd: '17:00',
      preferredDays: [1, 2, 3, 4, 5],
      autoSchedule: true,
      allowWeekends: false,
      allowMornings: true,
      allowEvenings: true,
      bufferMinutes: 15,
    });
  };

  const toggleDay = (day: number) => {
    if (newGoal.preferredDays.includes(day)) {
      setNewGoal({
        ...newGoal,
        preferredDays: newGoal.preferredDays.filter(d => d !== day),
      });
    } else {
      setNewGoal({
        ...newGoal,
        preferredDays: [...newGoal.preferredDays, day].sort(),
      });
    }
  };

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Target className="h-6 w-6" />
            Goals
          </h2>
          <p className="text-muted-foreground">
            Set goals and let AI automatically schedule time for them
          </p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Goal
        </Button>
      </div>

      {/* Goals Grid */}
      {goalsWithProgress.length === 0 ? (
        <Card className="p-8 text-center">
          <div className="text-4xl mb-4">🎯</div>
          <h3 className="text-lg font-medium mb-2">No goals yet</h3>
          <p className="text-muted-foreground mb-4">
            Create your first goal to start building healthy habits
          </p>
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Goal
          </Button>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {goalsWithProgress.map((goal) => (
            <GoalCard
              key={goal.id}
              goal={goal}
              onPause={() => pauseGoal(goal.id)}
              onResume={() => resumeGoal(goal.id)}
              onDelete={() => deleteGoal(goal.id)}
              onReschedule={() => scheduleGoalSessions(goal)}
            />
          ))}
        </div>
      )}

      {/* Create Goal Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Goal</DialogTitle>
            <DialogDescription>
              Define a goal and let AI find the best times to work on it
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Title */}
            <div className="space-y-2">
              <Label>Goal Title</Label>
              <Input
                placeholder="e.g., Exercise, Read, Learn Spanish"
                value={newGoal.title}
                onChange={(e) => setNewGoal({ ...newGoal, title: e.target.value })}
              />
            </div>

            {/* Category */}
            <div className="space-y-2">
              <Label>Category</Label>
              <div className="grid grid-cols-5 gap-2">
                {(Object.keys(goalCategoryPresets) as GoalCategory[]).map((cat) => {
                  const preset = goalCategoryPresets[cat];
                  const isSelected = newGoal.category === cat;
                  return (
                    <button
                      key={cat}
                      onClick={() => setNewGoal({
                        ...newGoal,
                        category: cat,
                        durationMinutes: preset.defaultDuration,
                      })}
                      className={cn(
                        'p-2 rounded-lg border text-center transition-colors',
                        isSelected
                          ? 'border-primary bg-primary/10'
                          : 'hover:bg-accent'
                      )}
                    >
                      <div className="text-2xl mb-1">{preset.icon}</div>
                      <div className="text-xs capitalize">{cat}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Frequency & Target */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Frequency</Label>
                <Select
                  value={newGoal.frequency}
                  onValueChange={(v) => setNewGoal({ ...newGoal, frequency: v as GoalFrequency })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Target: {newGoal.targetCount}x per {newGoal.frequency.replace('ly', '')}</Label>
                <Slider
                  value={[newGoal.targetCount]}
                  onValueChange={([v]) => setNewGoal({ ...newGoal, targetCount: v })}
                  min={1}
                  max={newGoal.frequency === 'daily' ? 3 : newGoal.frequency === 'weekly' ? 7 : 20}
                  step={1}
                />
              </div>
            </div>

            {/* Duration */}
            <div className="space-y-2">
              <Label>Session Duration: {newGoal.durationMinutes} minutes</Label>
              <Slider
                value={[newGoal.durationMinutes]}
                onValueChange={([v]) => setNewGoal({ ...newGoal, durationMinutes: v })}
                min={15}
                max={120}
                step={15}
              />
            </div>

            {/* Preferred Days */}
            <div className="space-y-2">
              <Label>Preferred Days</Label>
              <div className="flex gap-1">
                {dayNames.map((name, idx) => (
                  <button
                    key={idx}
                    onClick={() => toggleDay(idx)}
                    className={cn(
                      'flex-1 py-2 text-xs rounded border transition-colors',
                      newGoal.preferredDays.includes(idx)
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'hover:bg-accent'
                    )}
                  >
                    {name}
                  </button>
                ))}
              </div>
            </div>

            {/* Preferred Time Range */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Earliest Time</Label>
                <Input
                  type="time"
                  value={newGoal.preferredTimeStart}
                  onChange={(e) => setNewGoal({ ...newGoal, preferredTimeStart: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Latest Time</Label>
                <Input
                  type="time"
                  value={newGoal.preferredTimeEnd}
                  onChange={(e) => setNewGoal({ ...newGoal, preferredTimeEnd: e.target.value })}
                />
              </div>
            </div>

            {/* Auto-schedule Toggle */}
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <div>
                <div className="font-medium">Auto-schedule</div>
                <div className="text-sm text-muted-foreground">
                  Automatically find and book time for this goal
                </div>
              </div>
              <Switch
                checked={newGoal.autoSchedule}
                onCheckedChange={(checked) => setNewGoal({ ...newGoal, autoSchedule: checked })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateGoal} disabled={!newGoal.title.trim()}>
              Create Goal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Goal Card Component
interface GoalCardProps {
  goal: Goal & { progress: { completed: number; target: number; percentComplete: number; onTrack: boolean } };
  onPause: () => void;
  onResume: () => void;
  onDelete: () => void;
  onReschedule: () => void;
}

function GoalCard({ goal, onPause, onResume, onDelete, onReschedule }: GoalCardProps) {
  const preset = goalCategoryPresets[goal.category];
  const { progress } = goal;

  return (
    <Card className={cn(goal.isPaused && 'opacity-60')}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{goal.icon || preset.icon}</span>
            <div>
              <CardTitle className="text-base">{goal.title}</CardTitle>
              <CardDescription className="capitalize">{goal.category}</CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {goal.isPaused ? (
              <Badge variant="outline">Paused</Badge>
            ) : progress.onTrack ? (
              <Badge className="bg-green-500">On Track</Badge>
            ) : (
              <Badge variant="destructive">Behind</Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Progress */}
        <div className="space-y-1">
          <div className="flex justify-between text-sm">
            <span>{progress.completed} / {progress.target} this {goal.frequency.replace('ly', '')}</span>
            <span className="text-muted-foreground">{Math.round(progress.percentComplete)}%</span>
          </div>
          <Progress value={progress.percentComplete} className="h-2" />
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-1">
            <Flame className="h-4 w-4 text-orange-500" />
            <span>{goal.currentStreak} day streak</span>
          </div>
          <div className="flex items-center gap-1">
            <Trophy className="h-4 w-4 text-yellow-500" />
            <span>Best: {goal.longestStreak}</span>
          </div>
        </div>

        {/* Duration & Schedule */}
        <div className="text-xs text-muted-foreground">
          <Calendar className="inline h-3 w-3 mr-1" />
          {goal.durationMinutes} min sessions • {goal.preferredTimeStart} - {goal.preferredTimeEnd}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-2 border-t">
          {goal.isPaused ? (
            <Button size="sm" variant="outline" onClick={onResume}>
              <Play className="h-3 w-3 mr-1" />
              Resume
            </Button>
          ) : (
            <Button size="sm" variant="outline" onClick={onPause}>
              <Pause className="h-3 w-3 mr-1" />
              Pause
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={onReschedule}>
            <Settings2 className="h-3 w-3 mr-1" />
            Reschedule
          </Button>
          <Button size="sm" variant="ghost" className="text-destructive ml-auto" onClick={onDelete}>
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default GoalsManager;
