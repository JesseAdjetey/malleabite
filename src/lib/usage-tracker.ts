// Usage tracking for subscription limits
import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  increment,
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '@/integrations/firebase/config';
import { COLLECTIONS, type UsageData } from './subscription-types';

/**
 * Get current period string (YYYY-MM)
 */
function getCurrentPeriod(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * Get or create usage document for current period
 */
async function getUsageDoc(userId: string): Promise<UsageData> {
  const period = getCurrentPeriod();
  const usageRef = doc(db, COLLECTIONS.USAGE, `${userId}_${period}`);
  
  const usageSnap = await getDoc(usageRef);
  
  if (usageSnap.exists()) {
    return usageSnap.data() as UsageData;
  }
  
  // Create new usage document for this period
  const newUsage: Omit<UsageData, 'createdAt' | 'lastUpdated'> & {
    createdAt: ReturnType<typeof serverTimestamp>;
    lastUpdated: ReturnType<typeof serverTimestamp>;
  } = {
    userId,
    period,
    eventsCreated: 0,
    aiRequestsMade: 0,
    activeModules: 0,
    customTemplates: 0,
    storageUsedMB: 0,
    createdAt: serverTimestamp(),
    lastUpdated: serverTimestamp(),
  };
  
  await setDoc(usageRef, newUsage);
  
  return {
    ...newUsage,
    createdAt: new Date(),
    lastUpdated: new Date(),
  };
}

/**
 * Track event creation
 */
export async function trackEventCreation(userId: string): Promise<void> {
  const period = getCurrentPeriod();
  const usageRef = doc(db, COLLECTIONS.USAGE, `${userId}_${period}`);
  
  try {
    const usageSnap = await getDoc(usageRef);
    
    if (usageSnap.exists()) {
      await updateDoc(usageRef, {
        eventsCreated: increment(1),
        lastUpdated: serverTimestamp(),
      });
    } else {
      // Create initial doc
      await getUsageDoc(userId);
      await updateDoc(usageRef, {
        eventsCreated: increment(1),
      });
    }
  } catch (error) {
    console.error('Error tracking event creation:', error);
    // Don't throw - tracking shouldn't block functionality
  }
}

/**
 * Track AI request
 */
export async function trackAIRequest(userId: string): Promise<void> {
  const period = getCurrentPeriod();
  const usageRef = doc(db, COLLECTIONS.USAGE, `${userId}_${period}`);
  
  try {
    const usageSnap = await getDoc(usageRef);
    
    if (usageSnap.exists()) {
      await updateDoc(usageRef, {
        aiRequestsMade: increment(1),
        lastUpdated: serverTimestamp(),
      });
    } else {
      await getUsageDoc(userId);
      await updateDoc(usageRef, {
        aiRequestsMade: increment(1),
      });
    }
  } catch (error) {
    console.error('Error tracking AI request:', error);
  }
}

/**
 * Track active module count
 */
export async function trackModuleUsage(
  userId: string, 
  moduleCount: number
): Promise<void> {
  const period = getCurrentPeriod();
  const usageRef = doc(db, COLLECTIONS.USAGE, `${userId}_${period}`);
  
  try {
    const usageSnap = await getDoc(usageRef);
    
    if (usageSnap.exists()) {
      await updateDoc(usageRef, {
        activeModules: moduleCount,
        lastUpdated: serverTimestamp(),
      });
    } else {
      await getUsageDoc(userId);
      await updateDoc(usageRef, {
        activeModules: moduleCount,
      });
    }
  } catch (error) {
    console.error('Error tracking module usage:', error);
  }
}

/**
 * Get current usage for a user
 */
export async function getCurrentUsage(userId: string): Promise<{
  eventsThisMonth: number;
  aiRequestsThisMonth: number;
  activeModules: number;
  customTemplates: number;
  storageUsedMB: number;
}> {
  try {
    const usage = await getUsageDoc(userId);
    
    return {
      eventsThisMonth: usage.eventsCreated,
      aiRequestsThisMonth: usage.aiRequestsMade,
      activeModules: usage.activeModules,
      customTemplates: usage.customTemplates,
      storageUsedMB: usage.storageUsedMB,
    };
  } catch (error) {
    console.error('Error getting current usage:', error);
    // Return zeros if error
    return {
      eventsThisMonth: 0,
      aiRequestsThisMonth: 0,
      activeModules: 0,
      customTemplates: 0,
      storageUsedMB: 0,
    };
  }
}

/**
 * Check if user can perform action based on usage limits
 */
export async function canPerformAction(
  userId: string,
  action: 'createEvent' | 'makeAIRequest' | 'useModule',
  limit: number
): Promise<boolean> {
  if (limit === -1) return true; // Unlimited
  
  const usage = await getCurrentUsage(userId);
  
  switch (action) {
    case 'createEvent':
      return usage.eventsThisMonth < limit;
    case 'makeAIRequest':
      return usage.aiRequestsThisMonth < limit;
    case 'useModule':
      return usage.activeModules < limit;
    default:
      return false;
  }
}
