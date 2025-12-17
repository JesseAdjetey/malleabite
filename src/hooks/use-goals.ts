// Goals System Hook - Auto-schedule recurring goals and habits
import { useState, useCallback, useEffect } from 'react';
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where,
  orderBy,
  Timestamp 
} from 'firebase/firestore';
import { db } from '@/integrations/firebase/config';
import { useAuth } from '@/contexts/AuthContext.firebase';
import { useEventStore } from '@/lib/store';
import { toast } from 'sonner';
import dayjs, { Dayjs } from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';

dayjs.extend(isBetween);

export type GoalCategory = 
  | 'exercise' 
  | 'learning' 
  | 'family' 
  | 'meditation' 
  | 'reading' 
  | 'social' 
  | 'creative' 
  | 'health' 
  | 'career' 
  | 'custom';

export type GoalFrequency = 'daily' | 'weekly' | 'monthly';

export interface Goal {
  id: string;
  userId: string;
  title: string;
  category: GoalCategory;
  color: string;
  icon: string;
  
  // Target
  frequency: GoalFrequency;
  targetCount: number; // times per frequency period
  durationMinutes: number;
  
  // Preferred times
  preferredDays: number[]; // 0=Sun, 6=Sat
  preferredTimeStart: string; // HH:mm
  preferredTimeEnd: string; // HH:mm
  
  // Scheduling preferences
  autoSchedule: boolean;
  allowWeekends: boolean;
  allowMornings: boolean; // before 9am
  allowEvenings: boolean; // after 6pm
  bufferMinutes: number; // buffer around other events
  
  // Progress tracking
  currentStreak: number;
  longestStreak: number;
  totalCompleted: number;
  lastCompletedAt?: string;
  
  // Status
  isActive: boolean;
  isPaused: boolean;
  pausedUntil?: string;
  
  createdAt: string;
  updatedAt: string;
}

export interface GoalSession {
  id: string;
  goalId: string;
  userId: string;
  eventId?: string;
  scheduledFor: string;
  durationMinutes: number;
  status: 'scheduled' | 'completed' | 'skipped' | 'rescheduled';
  completedAt?: string;
  notes?: string;
  createdAt: string;
}

export interface GoalProgress {
  goalId: string;
  periodStart: string;
  periodEnd: string;
  completed: number;
  target: number;
  percentComplete: number;
  onTrack: boolean;
}

// Category presets
export const goalCategoryPresets: Record<GoalCategory, { icon: string; color: string; defaultDuration: number }> = {
  exercise: { icon: '🏃', color: '#ef4444', defaultDuration: 30 },
  learning: { icon: '📚', color: '#3b82f6', defaultDuration: 45 },
  family: { icon: '👨‍👩‍👧‍👦', color: '#ec4899', defaultDuration: 60 },
  meditation: { icon: '🧘', color: '#8b5cf6', defaultDuration: 15 },
  reading: { icon: '📖', color: '#f59e0b', defaultDuration: 30 },
  social: { icon: '👥', color: '#10b981', defaultDuration: 60 },
  creative: { icon: '🎨', color: '#06b6d4', defaultDuration: 60 },
  health: { icon: '❤️', color: '#f43f5e', defaultDuration: 30 },
  career: { icon: '💼', color: '#6366f1', defaultDuration: 45 },
  custom: { icon: '⭐', color: '#64748b', defaultDuration: 30 },
};

export function useGoals() {
  const { user } = useAuth();
  const { events } = useEventStore();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [sessions, setSessions] = useState<GoalSession[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch user's goals
  useEffect(() => {
    if (!user?.uid) {
      setLoading(false);
      return;
    }

    const fetchGoals = async () => {
      try {
        const goalsRef = collection(db, 'goals');
        const q = query(
          goalsRef,
          where('userId', '==', user.uid),
          orderBy('createdAt', 'desc')
        );
        const snapshot = await getDocs(q);
        
        const fetchedGoals = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        })) as Goal[];
        
        setGoals(fetchedGoals);
      } catch (error) {
        console.error('Failed to fetch goals:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchGoals();
  }, [user?.uid]);

  // Create a new goal
  const createGoal = useCallback(async (goalData: Omit<Goal, 'id' | 'userId' | 'createdAt' | 'updatedAt' | 'currentStreak' | 'longestStreak' | 'totalCompleted'>) => {
    if (!user?.uid) return { success: false };

    try {
      const preset = goalCategoryPresets[goalData.category];
      
      const goal: Omit<Goal, 'id'> = {
        ...goalData,
        userId: user.uid,
        icon: goalData.icon || preset.icon,
        color: goalData.color || preset.color,
        durationMinutes: goalData.durationMinutes || preset.defaultDuration,
        currentStreak: 0,
        longestStreak: 0,
        totalCompleted: 0,
        isActive: true,
        isPaused: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const docRef = await addDoc(collection(db, 'goals'), goal);
      const newGoal = { id: docRef.id, ...goal };
      
      setGoals(prev => [newGoal, ...prev]);
      toast.success(`Goal "${goalData.title}" created`);
      
      // Auto-schedule if enabled
      if (goalData.autoSchedule) {
        await scheduleGoalSessions(newGoal);
      }
      
      return { success: true, goal: newGoal };
    } catch (error) {
      console.error('Failed to create goal:', error);
      toast.error('Failed to create goal');
      return { success: false, error };
    }
  }, [user?.uid]);

  // Update a goal
  const updateGoal = useCallback(async (goalId: string, updates: Partial<Goal>) => {
    try {
      await updateDoc(doc(db, 'goals', goalId), {
        ...updates,
        updatedAt: new Date().toISOString(),
      });

      setGoals(prev =>
        prev.map(g => g.id === goalId ? { ...g, ...updates } : g)
      );
      
      toast.success('Goal updated');
      return { success: true };
    } catch (error) {
      console.error('Failed to update goal:', error);
      toast.error('Failed to update goal');
      return { success: false, error };
    }
  }, []);

  // Delete a goal
  const deleteGoal = useCallback(async (goalId: string) => {
    try {
      await deleteDoc(doc(db, 'goals', goalId));
      setGoals(prev => prev.filter(g => g.id !== goalId));
      toast.success('Goal deleted');
      return { success: true };
    } catch (error) {
      console.error('Failed to delete goal:', error);
      toast.error('Failed to delete goal');
      return { success: false, error };
    }
  }, []);

  // Find available time slots
  const findAvailableSlots = useCallback((
    goal: Goal,
    startDate: Dayjs,
    endDate: Dayjs
  ): Dayjs[] => {
    const slots: Dayjs[] = [];
    const duration = goal.durationMinutes;
    const buffer = goal.bufferMinutes || 15;
    
    let current = startDate.startOf('day');
    
    while (current.isBefore(endDate)) {
      const dayOfWeek = current.day();
      
      // Check if this day is preferred
      if (!goal.preferredDays.includes(dayOfWeek)) {
        current = current.add(1, 'day');
        continue;
      }
      
      // Check weekend preference
      if (!goal.allowWeekends && (dayOfWeek === 0 || dayOfWeek === 6)) {
        current = current.add(1, 'day');
        continue;
      }
      
      // Parse preferred time range
      const [startHour, startMin] = goal.preferredTimeStart.split(':').map(Number);
      const [endHour, endMin] = goal.preferredTimeEnd.split(':').map(Number);
      
      let slotTime = current.hour(startHour).minute(startMin);
      const dayEnd = current.hour(endHour).minute(endMin);
      
      while (slotTime.add(duration, 'minute').isBefore(dayEnd) || slotTime.add(duration, 'minute').isSame(dayEnd)) {
        // Check morning preference
        if (!goal.allowMornings && slotTime.hour() < 9) {
          slotTime = slotTime.add(30, 'minute');
          continue;
        }
        
        // Check evening preference
        if (!goal.allowEvenings && slotTime.hour() >= 18) {
          slotTime = slotTime.add(30, 'minute');
          continue;
        }
        
        // Check for conflicts with existing events
        const slotEnd = slotTime.add(duration + buffer, 'minute');
        const slotStartWithBuffer = slotTime.subtract(buffer, 'minute');
        
        const hasConflict = events.some(event => {
          const eventStart = dayjs(event.startsAt);
          const eventEnd = dayjs(event.endsAt);
          
          return (
            slotStartWithBuffer.isBefore(eventEnd) &&
            slotEnd.isAfter(eventStart)
          );
        });
        
        if (!hasConflict) {
          slots.push(slotTime);
        }
        
        slotTime = slotTime.add(30, 'minute');
      }
      
      current = current.add(1, 'day');
    }
    
    return slots;
  }, [events]);

  // Auto-schedule goal sessions
  const scheduleGoalSessions = useCallback(async (goal: Goal) => {
    if (!user?.uid) return { success: false };

    try {
      const startDate = dayjs();
      const endDate = startDate.add(2, 'week'); // Schedule 2 weeks ahead
      
      const availableSlots = findAvailableSlots(goal, startDate, endDate);
      
      // Determine how many sessions to schedule
      let sessionsNeeded = goal.targetCount;
      if (goal.frequency === 'weekly') {
        sessionsNeeded = goal.targetCount * 2; // For 2 weeks
      } else if (goal.frequency === 'monthly') {
        sessionsNeeded = Math.ceil(goal.targetCount / 2); // Half month
      }
      
      // Distribute sessions evenly
      const interval = Math.max(1, Math.floor(availableSlots.length / sessionsNeeded));
      const selectedSlots = availableSlots.filter((_, i) => i % interval === 0).slice(0, sessionsNeeded);
      
      // Create sessions and events
      for (const slot of selectedSlots) {
        const session: Omit<GoalSession, 'id'> = {
          goalId: goal.id,
          userId: user.uid,
          scheduledFor: slot.toISOString(),
          durationMinutes: goal.durationMinutes,
          status: 'scheduled',
          createdAt: new Date().toISOString(),
        };
        
        await addDoc(collection(db, 'goal_sessions'), session);
        
        // Create calendar event
        // Note: This would integrate with createEvent from eventStore
      }
      
      toast.success(`Scheduled ${selectedSlots.length} sessions for "${goal.title}"`);
      return { success: true, scheduledCount: selectedSlots.length };
    } catch (error) {
      console.error('Failed to schedule goal sessions:', error);
      toast.error('Failed to schedule sessions');
      return { success: false, error };
    }
  }, [user?.uid, findAvailableSlots]);

  // Mark session as complete
  const completeSession = useCallback(async (sessionId: string, notes?: string) => {
    try {
      const sessionRef = doc(db, 'goal_sessions', sessionId);
      const sessionSnap = await getDoc(sessionRef);
      
      if (!sessionSnap.exists()) {
        throw new Error('Session not found');
      }
      
      const session = sessionSnap.data() as GoalSession;
      
      await updateDoc(sessionRef, {
        status: 'completed',
        completedAt: new Date().toISOString(),
        notes,
      });
      
      // Update goal stats
      const goal = goals.find(g => g.id === session.goalId);
      if (goal) {
        const newStreak = goal.currentStreak + 1;
        await updateDoc(doc(db, 'goals', goal.id), {
          totalCompleted: goal.totalCompleted + 1,
          currentStreak: newStreak,
          longestStreak: Math.max(goal.longestStreak, newStreak),
          lastCompletedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        
        setGoals(prev =>
          prev.map(g =>
            g.id === goal.id
              ? {
                  ...g,
                  totalCompleted: g.totalCompleted + 1,
                  currentStreak: newStreak,
                  longestStreak: Math.max(g.longestStreak, newStreak),
                  lastCompletedAt: new Date().toISOString(),
                }
              : g
          )
        );
      }
      
      toast.success('Session completed! 🎉');
      return { success: true };
    } catch (error) {
      console.error('Failed to complete session:', error);
      toast.error('Failed to complete session');
      return { success: false, error };
    }
  }, [goals]);

  // Skip a session
  const skipSession = useCallback(async (sessionId: string, reschedule: boolean = false) => {
    try {
      await updateDoc(doc(db, 'goal_sessions', sessionId), {
        status: reschedule ? 'rescheduled' : 'skipped',
      });
      
      // Reset streak if skipped
      if (!reschedule) {
        const sessionSnap = await getDoc(doc(db, 'goal_sessions', sessionId));
        const session = sessionSnap.data() as GoalSession;
        
        await updateDoc(doc(db, 'goals', session.goalId), {
          currentStreak: 0,
          updatedAt: new Date().toISOString(),
        });
        
        setGoals(prev =>
          prev.map(g =>
            g.id === session.goalId ? { ...g, currentStreak: 0 } : g
          )
        );
      }
      
      toast.info(reschedule ? 'Session rescheduled' : 'Session skipped');
      return { success: true };
    } catch (error) {
      console.error('Failed to skip session:', error);
      toast.error('Failed to skip session');
      return { success: false, error };
    }
  }, []);

  // Get progress for a goal
  const getGoalProgress = useCallback((goal: Goal): GoalProgress => {
    const now = dayjs();
    let periodStart: Dayjs;
    let periodEnd: Dayjs;
    
    switch (goal.frequency) {
      case 'daily':
        periodStart = now.startOf('day');
        periodEnd = now.endOf('day');
        break;
      case 'weekly':
        periodStart = now.startOf('week');
        periodEnd = now.endOf('week');
        break;
      case 'monthly':
        periodStart = now.startOf('month');
        periodEnd = now.endOf('month');
        break;
    }
    
    // Count completed sessions in period
    const completedInPeriod = sessions.filter(s =>
      s.goalId === goal.id &&
      s.status === 'completed' &&
      dayjs(s.completedAt).isBetween(periodStart, periodEnd, null, '[]')
    ).length;
    
    const percentComplete = Math.min(100, (completedInPeriod / goal.targetCount) * 100);
    
    // Calculate if on track
    const periodProgress = now.diff(periodStart, 'hour') / periodEnd.diff(periodStart, 'hour');
    const expectedProgress = periodProgress * goal.targetCount;
    const onTrack = completedInPeriod >= expectedProgress;
    
    return {
      goalId: goal.id,
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
      completed: completedInPeriod,
      target: goal.targetCount,
      percentComplete,
      onTrack,
    };
  }, [sessions]);

  // Pause a goal
  const pauseGoal = useCallback(async (goalId: string, until?: Dayjs) => {
    try {
      await updateDoc(doc(db, 'goals', goalId), {
        isPaused: true,
        pausedUntil: until?.toISOString(),
        updatedAt: new Date().toISOString(),
      });

      setGoals(prev =>
        prev.map(g =>
          g.id === goalId
            ? { ...g, isPaused: true, pausedUntil: until?.toISOString() }
            : g
        )
      );
      
      toast.info('Goal paused');
      return { success: true };
    } catch (error) {
      console.error('Failed to pause goal:', error);
      return { success: false, error };
    }
  }, []);

  // Resume a goal
  const resumeGoal = useCallback(async (goalId: string) => {
    try {
      await updateDoc(doc(db, 'goals', goalId), {
        isPaused: false,
        pausedUntil: null,
        updatedAt: new Date().toISOString(),
      });

      setGoals(prev =>
        prev.map(g =>
          g.id === goalId
            ? { ...g, isPaused: false, pausedUntil: undefined }
            : g
        )
      );
      
      toast.success('Goal resumed');
      return { success: true };
    } catch (error) {
      console.error('Failed to resume goal:', error);
      return { success: false, error };
    }
  }, []);

  // Get all goals with their progress
  const goalsWithProgress = goals.map(goal => ({
    ...goal,
    progress: getGoalProgress(goal),
  }));

  return {
    goals,
    goalsWithProgress,
    sessions,
    loading,
    createGoal,
    updateGoal,
    deleteGoal,
    scheduleGoalSessions,
    completeSession,
    skipSession,
    getGoalProgress,
    pauseGoal,
    resumeGoal,
    findAvailableSlots,
    goalCategoryPresets,
  };
}

export default useGoals;
