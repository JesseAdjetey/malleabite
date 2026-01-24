import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type TimerMode = 'focus' | 'break';

interface PomodoroState {
    // Settings
    focusTime: number; // in minutes
    breakTime: number; // in minutes
    focusTarget: number; // in minutes

    // Active State
    timeLeft: number; // in seconds
    isActive: boolean;
    timerMode: TimerMode;
    completedFocusTime: number; // in minutes
    cycles: number;
    lastTickTime: number;

    // Actions
    setFocusTime: (minutes: number) => void;
    setBreakTime: (minutes: number) => void;
    setFocusTarget: (minutes: number) => void;
    startTimer: () => void;
    pauseTimer: () => void;
    toggleTimer: () => void;
    resetTimer: () => void;
    tick: () => void;
    completeCycle: () => void;
    setTimeLeft: (seconds: number) => void;
}

export const usePomodoroStore = create<PomodoroState>()(
    persist(
        (set, get) => ({
            focusTime: 25,
            breakTime: 5,
            focusTarget: 180,
            timeLeft: 25 * 60,
            isActive: false,
            timerMode: 'focus',
            completedFocusTime: 0,
            cycles: 0,
            lastTickTime: Date.now(),

            setFocusTime: (minutes) => {
                set({ focusTime: minutes });
                if (get().timerMode === 'focus' && !get().isActive) {
                    set({ timeLeft: minutes * 60 });
                }
            },

            setBreakTime: (minutes) => {
                set({ breakTime: minutes });
                if (get().timerMode === 'break' && !get().isActive) {
                    set({ timeLeft: minutes * 60 });
                }
            },

            setFocusTarget: (minutes) => set({ focusTarget: minutes }),

            startTimer: () => set({ isActive: true, lastTickTime: Date.now() }),

            pauseTimer: () => set({ isActive: false }),

            toggleTimer: () => set((state) => ({ isActive: !state.isActive, lastTickTime: Date.now() })),

            resetTimer: () => set((state) => ({
                isActive: false,
                timerMode: 'focus',
                timeLeft: state.focusTime * 60,
                lastTickTime: Date.now()
            })),

            tick: () => set((state) => {
                if (!state.isActive || state.timeLeft <= 0) return state;
                return {
                    timeLeft: state.timeLeft - 1,
                    lastTickTime: Date.now()
                };
            }),

            setTimeLeft: (seconds) => set({ timeLeft: seconds }),

            completeCycle: () => set((state) => {
                const isFocus = state.timerMode === 'focus';
                if (isFocus) {
                    return {
                        timerMode: 'break',
                        timeLeft: state.breakTime * 60,
                        completedFocusTime: state.completedFocusTime + state.focusTime,
                        cycles: state.cycles + 1,
                        isActive: false // Pause on completion
                    };
                } else {
                    return {
                        timerMode: 'focus',
                        timeLeft: state.focusTime * 60,
                        isActive: false // Pause on completion
                    };
                }
            }),
        }),
        {
            name: 'pomodoro-storage',
        }
    )
);
