// Working Hours Settings Hook - Manage work schedule and location
import { useState, useEffect, useCallback } from 'react';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/integrations/firebase/config';
import { useAuth } from '@/contexts/AuthContext.firebase';
import { toast } from 'sonner';

// Time slot for working hours
export interface TimeSlot {
  start: string; // HH:mm format
  end: string; // HH:mm format
}

// Day of week working hours
export interface DayWorkingHours {
  enabled: boolean;
  slots: TimeSlot[];
}

// Work location type
export interface WorkLocation {
  id: string;
  type: 'office' | 'home' | 'custom';
  name: string;
  address?: string;
  isDefault?: boolean;
}

// Working hours settings
export interface WorkingHoursSettings {
  enabled: boolean;
  timeZone: string;
  // Monday = 0, Sunday = 6
  schedule: {
    [key: number]: DayWorkingHours;
  };
  locations: WorkLocation[];
  defaultLocation?: string;
  // Show working hours on calendar
  showOnCalendar: boolean;
  // Auto-decline meetings outside working hours
  autoDeclineOutOfHours: boolean;
  declineMessage?: string;
}

// Out of office settings
export interface OutOfOfficeSettings {
  enabled: boolean;
  startDate: string; // ISO date
  endDate: string; // ISO date
  message: string;
  autoDecline: boolean;
  declineMessage: string;
  showOnCalendar: boolean;
}

// Default working hours (9 AM - 5 PM, Monday - Friday)
export const DEFAULT_WORKING_HOURS: WorkingHoursSettings = {
  enabled: false,
  timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  schedule: {
    0: { enabled: true, slots: [{ start: '09:00', end: '17:00' }] }, // Monday
    1: { enabled: true, slots: [{ start: '09:00', end: '17:00' }] }, // Tuesday
    2: { enabled: true, slots: [{ start: '09:00', end: '17:00' }] }, // Wednesday
    3: { enabled: true, slots: [{ start: '09:00', end: '17:00' }] }, // Thursday
    4: { enabled: true, slots: [{ start: '09:00', end: '17:00' }] }, // Friday
    5: { enabled: false, slots: [] }, // Saturday
    6: { enabled: false, slots: [] }, // Sunday
  },
  locations: [
    { id: 'office', type: 'office', name: 'Office', isDefault: true },
    { id: 'home', type: 'home', name: 'Home' },
  ],
  defaultLocation: 'office',
  showOnCalendar: true,
  autoDeclineOutOfHours: false,
  declineMessage: "I'm currently outside my working hours. I'll respond when I'm back.",
};

export const DEFAULT_OUT_OF_OFFICE: OutOfOfficeSettings = {
  enabled: false,
  startDate: '',
  endDate: '',
  message: "I'm currently out of office and will return on [end date].",
  autoDecline: true,
  declineMessage: "I'm currently out of office. I'll respond when I return.",
  showOnCalendar: true,
};

// Day names for display
export const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
export const DAY_NAMES_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function useWorkingHours() {
  const { user } = useAuth();
  const [workingHours, setWorkingHours] = useState<WorkingHoursSettings>(DEFAULT_WORKING_HOURS);
  const [outOfOffice, setOutOfOffice] = useState<OutOfOfficeSettings>(DEFAULT_OUT_OF_OFFICE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Fetch settings from Firestore
  useEffect(() => {
    if (!user?.uid) {
      setLoading(false);
      return;
    }

    const fetchSettings = async () => {
      try {
        const docRef = doc(db, 'user_settings', user.uid);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.workingHours) {
            setWorkingHours({ ...DEFAULT_WORKING_HOURS, ...data.workingHours });
          }
          if (data.outOfOffice) {
            setOutOfOffice({ ...DEFAULT_OUT_OF_OFFICE, ...data.outOfOffice });
          }
        }
      } catch (error) {
        console.error('Failed to fetch working hours settings:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, [user?.uid]);

  // Save working hours
  const saveWorkingHours = useCallback(async (settings: Partial<WorkingHoursSettings>) => {
    if (!user?.uid) return { success: false, error: 'Not authenticated' };

    setSaving(true);
    try {
      const newSettings = { ...workingHours, ...settings };
      const docRef = doc(db, 'user_settings', user.uid);
      
      await setDoc(docRef, { workingHours: newSettings }, { merge: true });
      setWorkingHours(newSettings);
      
      toast.success('Working hours saved');
      return { success: true };
    } catch (error) {
      console.error('Failed to save working hours:', error);
      toast.error('Failed to save working hours');
      return { success: false, error };
    } finally {
      setSaving(false);
    }
  }, [user?.uid, workingHours]);

  // Save out of office settings
  const saveOutOfOffice = useCallback(async (settings: Partial<OutOfOfficeSettings>) => {
    if (!user?.uid) return { success: false, error: 'Not authenticated' };

    setSaving(true);
    try {
      const newSettings = { ...outOfOffice, ...settings };
      const docRef = doc(db, 'user_settings', user.uid);
      
      await setDoc(docRef, { outOfOffice: newSettings }, { merge: true });
      setOutOfOffice(newSettings);
      
      toast.success('Out of office settings saved');
      return { success: true };
    } catch (error) {
      console.error('Failed to save out of office settings:', error);
      toast.error('Failed to save settings');
      return { success: false, error };
    } finally {
      setSaving(false);
    }
  }, [user?.uid, outOfOffice]);

  // Toggle a specific day
  const toggleDay = useCallback((dayIndex: number) => {
    const currentDay = workingHours.schedule[dayIndex];
    const newSchedule = {
      ...workingHours.schedule,
      [dayIndex]: {
        ...currentDay,
        enabled: !currentDay.enabled,
        slots: !currentDay.enabled 
          ? [{ start: '09:00', end: '17:00' }] 
          : currentDay.slots,
      },
    };
    saveWorkingHours({ schedule: newSchedule });
  }, [workingHours, saveWorkingHours]);

  // Update time slot for a day
  const updateTimeSlot = useCallback((dayIndex: number, slotIndex: number, slot: TimeSlot) => {
    const currentDay = workingHours.schedule[dayIndex];
    const newSlots = [...currentDay.slots];
    newSlots[slotIndex] = slot;
    
    const newSchedule = {
      ...workingHours.schedule,
      [dayIndex]: {
        ...currentDay,
        slots: newSlots,
      },
    };
    saveWorkingHours({ schedule: newSchedule });
  }, [workingHours, saveWorkingHours]);

  // Add time slot to a day
  const addTimeSlot = useCallback((dayIndex: number) => {
    const currentDay = workingHours.schedule[dayIndex];
    const lastSlot = currentDay.slots[currentDay.slots.length - 1];
    
    // Default to slot after the last one
    const newSlot: TimeSlot = lastSlot
      ? { start: lastSlot.end, end: '18:00' }
      : { start: '09:00', end: '17:00' };
    
    const newSchedule = {
      ...workingHours.schedule,
      [dayIndex]: {
        ...currentDay,
        slots: [...currentDay.slots, newSlot],
      },
    };
    saveWorkingHours({ schedule: newSchedule });
  }, [workingHours, saveWorkingHours]);

  // Remove time slot from a day
  const removeTimeSlot = useCallback((dayIndex: number, slotIndex: number) => {
    const currentDay = workingHours.schedule[dayIndex];
    const newSlots = currentDay.slots.filter((_, i) => i !== slotIndex);
    
    const newSchedule = {
      ...workingHours.schedule,
      [dayIndex]: {
        ...currentDay,
        slots: newSlots,
        enabled: newSlots.length > 0,
      },
    };
    saveWorkingHours({ schedule: newSchedule });
  }, [workingHours, saveWorkingHours]);

  // Add location
  const addLocation = useCallback((location: Omit<WorkLocation, 'id'>) => {
    const newLocation: WorkLocation = {
      ...location,
      id: `location-${Date.now()}`,
    };
    saveWorkingHours({
      locations: [...workingHours.locations, newLocation],
    });
  }, [workingHours, saveWorkingHours]);

  // Remove location
  const removeLocation = useCallback((locationId: string) => {
    const newLocations = workingHours.locations.filter(l => l.id !== locationId);
    saveWorkingHours({
      locations: newLocations,
      defaultLocation: workingHours.defaultLocation === locationId 
        ? newLocations[0]?.id 
        : workingHours.defaultLocation,
    });
  }, [workingHours, saveWorkingHours]);

  // Check if a time is within working hours
  const isWithinWorkingHours = useCallback((date: Date): boolean => {
    if (!workingHours.enabled) return true;

    // Get day of week (0 = Monday in our system)
    const jsDay = date.getDay(); // 0 = Sunday, 6 = Saturday
    const dayIndex = jsDay === 0 ? 6 : jsDay - 1; // Convert to 0 = Monday

    const daySchedule = workingHours.schedule[dayIndex];
    if (!daySchedule?.enabled) return false;

    const timeStr = date.toTimeString().slice(0, 5); // HH:mm format

    return daySchedule.slots.some(slot => 
      timeStr >= slot.start && timeStr <= slot.end
    );
  }, [workingHours]);

  // Check if out of office is currently active
  const isOutOfOffice = useCallback((): boolean => {
    if (!outOfOffice.enabled) return false;

    const now = new Date();
    const start = new Date(outOfOffice.startDate);
    const end = new Date(outOfOffice.endDate);

    return now >= start && now <= end;
  }, [outOfOffice]);

  return {
    workingHours,
    outOfOffice,
    loading,
    saving,
    saveWorkingHours,
    saveOutOfOffice,
    toggleDay,
    updateTimeSlot,
    addTimeSlot,
    removeTimeSlot,
    addLocation,
    removeLocation,
    isWithinWorkingHours,
    isOutOfOffice,
  };
}

export default useWorkingHours;
