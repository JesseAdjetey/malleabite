import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type TimerMode = 'focus' | 'break';

const DEFAULT_INSTANCE_ID = '__default__';

// State for a single Pomodoro instance
export interface PomodoroInstance {
    focusTime: number;       // in minutes
    breakTime: number;       // in minutes
    focusTarget: number;     // in minutes
    timeLeft: number;        // in seconds
    isActive: boolean;
    timerMode: TimerMode;
    completedFocusTime: number; // in minutes
    cycles: number;
    lastTickTime: number;
}

const createDefaultInstance = (focusTime = 25, breakTime = 5): PomodoroInstance => ({
    focusTime,
    breakTime,
    focusTarget: 180,
    timeLeft: focusTime * 60,
    isActive: false,
    timerMode: 'focus',
    completedFocusTime: 0,
    cycles: 0,
    lastTickTime: Date.now(),
});

interface PomodoroState {
    instances: Record<string, PomodoroInstance>;

    // Instance management
    getInstance: (id?: string) => PomodoroInstance;
    ensureInstance: (id?: string) => void;

    // Actions (all instance-scoped)
    setFocusTime: (minutes: number, id?: string) => void;
    setBreakTime: (minutes: number, id?: string) => void;
    setFocusTarget: (minutes: number, id?: string) => void;
    startTimer: (id?: string) => void;
    pauseTimer: (id?: string) => void;
    toggleTimer: (id?: string) => void;
    resetTimer: (id?: string) => void;
    tick: (id?: string) => void;
    completeCycle: (id?: string) => void;
    setTimeLeft: (seconds: number, id?: string) => void;
}

// Helper to resolve instance ID
const resolveId = (id?: string) => id || DEFAULT_INSTANCE_ID;

// Helper to update a specific instance within the store
const updateInstance = (
    instances: Record<string, PomodoroInstance>,
    id: string,
    updater: (instance: PomodoroInstance) => Partial<PomodoroInstance>
): Record<string, PomodoroInstance> => {
    const current = instances[id] || createDefaultInstance();
    return {
        ...instances,
        [id]: { ...current, ...updater(current) },
    };
};

export const usePomodoroStore = create<PomodoroState>()(
    persist(
        (set, get) => ({
            instances: {
                [DEFAULT_INSTANCE_ID]: createDefaultInstance(),
            },

            getInstance: (id?) => {
                const key = resolveId(id);
                return get().instances[key] || createDefaultInstance();
            },

            ensureInstance: (id?) => {
                const key = resolveId(id);
                if (!get().instances[key]) {
                    set((state) => ({
                        instances: {
                            ...state.instances,
                            [key]: createDefaultInstance(),
                        },
                    }));
                }
            },

            setFocusTime: (minutes, id?) => {
                const key = resolveId(id);
                set((state) => ({
                    instances: updateInstance(state.instances, key, (inst) => {
                        const updates: Partial<PomodoroInstance> = { focusTime: minutes };
                        if (inst.timerMode === 'focus' && !inst.isActive) {
                            updates.timeLeft = minutes * 60;
                        }
                        return updates;
                    }),
                }));
            },

            setBreakTime: (minutes, id?) => {
                const key = resolveId(id);
                set((state) => ({
                    instances: updateInstance(state.instances, key, (inst) => {
                        const updates: Partial<PomodoroInstance> = { breakTime: minutes };
                        if (inst.timerMode === 'break' && !inst.isActive) {
                            updates.timeLeft = minutes * 60;
                        }
                        return updates;
                    }),
                }));
            },

            setFocusTarget: (minutes, id?) => {
                const key = resolveId(id);
                set((state) => ({
                    instances: updateInstance(state.instances, key, () => ({ focusTarget: minutes })),
                }));
            },

            startTimer: (id?) => {
                const key = resolveId(id);
                set((state) => ({
                    instances: updateInstance(state.instances, key, () => ({
                        isActive: true,
                        lastTickTime: Date.now(),
                    })),
                }));
            },

            pauseTimer: (id?) => {
                const key = resolveId(id);
                set((state) => ({
                    instances: updateInstance(state.instances, key, () => ({ isActive: false })),
                }));
            },

            toggleTimer: (id?) => {
                const key = resolveId(id);
                set((state) => ({
                    instances: updateInstance(state.instances, key, (inst) => ({
                        isActive: !inst.isActive,
                        lastTickTime: Date.now(),
                    })),
                }));
            },

            resetTimer: (id?) => {
                const key = resolveId(id);
                set((state) => ({
                    instances: updateInstance(state.instances, key, (inst) => ({
                        isActive: false,
                        timerMode: 'focus',
                        timeLeft: inst.focusTime * 60,
                        lastTickTime: Date.now(),
                    })),
                }));
            },

            tick: (id?) => {
                const key = resolveId(id);
                set((state) => ({
                    instances: updateInstance(state.instances, key, (inst) => {
                        if (!inst.isActive || inst.timeLeft <= 0) return {};
                        return {
                            timeLeft: inst.timeLeft - 1,
                            lastTickTime: Date.now(),
                        };
                    }),
                }));
            },

            setTimeLeft: (seconds, id?) => {
                const key = resolveId(id);
                set((state) => ({
                    instances: updateInstance(state.instances, key, () => ({ timeLeft: seconds })),
                }));
            },

            completeCycle: (id?) => {
                const key = resolveId(id);
                set((state) => ({
                    instances: updateInstance(state.instances, key, (inst) => {
                        if (inst.timerMode === 'focus') {
                            return {
                                timerMode: 'break',
                                timeLeft: inst.breakTime * 60,
                                completedFocusTime: inst.completedFocusTime + inst.focusTime,
                                cycles: inst.cycles + 1,
                                isActive: false,
                            };
                        } else {
                            return {
                                timerMode: 'focus',
                                timeLeft: inst.focusTime * 60,
                                isActive: false,
                            };
                        }
                    }),
                }));
            },
        }),
        {
            name: 'pomodoro-storage',
        }
    )
);
