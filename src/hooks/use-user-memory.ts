// Hook to read/write persistent AI memory from Firestore ai_memory/{userId}
import { useState, useEffect, useCallback } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '@/integrations/firebase/config';
import { useAuth } from '@/contexts/AuthContext.firebase';

export interface UserMemory {
    userId: string;
    updatedAt: string;
    preferences: {
        workHoursStart?: string;
        workHoursEnd?: string;
        deepWorkPreference?: string;
        preferredMeetingDuration?: number;
        breakInterval?: number;
        focusGoalMinutes?: number;
        [key: string]: any;
    };
    patterns: {
        typicalMeetingDays?: string[];
        lateRunningEvents?: string[];
        highMeetingDays?: string[];
        averageEventsPerDay?: number;
        [key: string]: any;
    };
    personality: {
        communicationStyle?: string;
        stressIndicators?: string[];
        motivators?: string[];
        [key: string]: any;
    };
    goals: {
        primaryGoal?: string;
        currentFocus?: string;
        weeklyPriorities?: string[];
        [key: string]: any;
    };
    observations: string[];
}

const DEFAULT_MEMORY: Omit<UserMemory, 'userId' | 'updatedAt'> = {
    preferences: {},
    patterns: {},
    personality: {},
    goals: {},
    observations: [],
};

export function useUserMemory() {
    const { user } = useAuth();
    const [memory, setMemory] = useState<UserMemory | null>(null);
    const [loading, setLoading] = useState(true);

    // Real-time listener on ai_memory/{userId}
    useEffect(() => {
        if (!user?.uid) {
            setMemory(null);
            setLoading(false);
            return;
        }

        const ref = doc(db, 'ai_memory', user.uid);
        const unsub = onSnapshot(
            ref,
            (snap) => {
                if (snap.exists()) {
                    setMemory(snap.data() as UserMemory);
                } else {
                    // No memory yet — user is new
                    setMemory({
                        userId: user.uid,
                        updatedAt: new Date().toISOString(),
                        ...DEFAULT_MEMORY,
                    });
                }
                setLoading(false);
            },
            (err) => {
                console.warn('[useUserMemory] Snapshot error:', err);
                setLoading(false);
            }
        );

        return unsub;
    }, [user?.uid]);

    // Manual update from client side (for direct preference setting)
    const updateMemory = useCallback(
        async (patch: Partial<Omit<UserMemory, 'userId' | 'updatedAt'>>) => {
            if (!user?.uid) return;

            const ref = doc(db, 'ai_memory', user.uid);
            const current = memory || { userId: user.uid, ...DEFAULT_MEMORY };
            const merged: any = {
                ...current,
                updatedAt: new Date().toISOString(),
            };

            for (const key of ['preferences', 'patterns', 'personality', 'goals'] as const) {
                if (patch[key] && typeof patch[key] === 'object') {
                    merged[key] = { ...(current as any)[key], ...patch[key] };
                }
            }

            if (patch.observations && Array.isArray(patch.observations)) {
                const obs = merged.observations || [];
                obs.push(...patch.observations);
                merged.observations = obs.slice(-20);
            }

            await setDoc(ref, merged, { merge: true });
        },
        [user?.uid, memory]
    );

    return { memory, loading, updateMemory };
}
