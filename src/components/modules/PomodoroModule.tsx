
import React, { useState, useEffect } from 'react';
import ModuleContainer from './ModuleContainer';
import { Play, Pause, Settings, Clock, Target, RotateCcw } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

// Timer modes
type TimerMode = 'focus' | 'break';

interface PomodoroModuleProps {
  title?: string;
  onRemove?: () => void;
  onTitleChange?: (title: string) => void;
  onMinimize?: () => void;
  isMinimized?: boolean;
  isDragging?: boolean;
}

const PomodoroModule: React.FC<PomodoroModuleProps> = ({
  title = "Pomodoro",
  onRemove,
  onTitleChange,
  onMinimize,
  isMinimized = false,
  isDragging = false
}) => {
  // Load saved state from localStorage or use defaults
  const loadSavedState = () => {
    try {
      const saved = localStorage.getItem('pomodoroState');
      if (saved) {
        const state = JSON.parse(saved);
        // Check if saved state has a lastUpdate timestamp and if it's recent (within 24 hours)
        if (state.lastUpdate && Date.now() - state.lastUpdate < 24 * 60 * 60 * 1000) {
          return state;
        }
      }
    } catch (e) {
      console.error('Failed to load pomodoro state:', e);
    }
    return null;
  };

  const savedState = loadSavedState();

  // Timer settings
  const [focusTime, setFocusTime] = useState(savedState?.focusTime ?? 25); // in minutes
  const [breakTime, setBreakTime] = useState(savedState?.breakTime ?? 5); // in minutes
  const [focusTarget, setFocusTarget] = useState(savedState?.focusTarget ?? 180); // in minutes (3 hours default)

  // Timer state
  const [timeLeft, setTimeLeft] = useState(savedState?.timeLeft ?? 25 * 60); // in seconds
  const [isActive, setIsActive] = useState(savedState?.isActive ?? false);
  const [timerMode, setTimerMode] = useState<TimerMode>(savedState?.timerMode ?? 'focus');
  const [showSettings, setShowSettings] = useState(false);
  const [completedFocusTime, setCompletedFocusTime] = useState(savedState?.completedFocusTime ?? 0); // in minutes
  const [cycles, setCycles] = useState(savedState?.cycles ?? 0);
  const [lastTickTime, setLastTickTime] = useState(savedState?.lastTickTime ?? Date.now());

  // Calculate total time for current mode
  const totalTime = timerMode === 'focus' ? focusTime * 60 : breakTime * 60;
  const progress = (timeLeft / totalTime) * 100;

  // Target progress percentage
  const targetProgress = Math.min((completedFocusTime / focusTarget) * 100, 100);

  // Save state to localStorage whenever it changes
  useEffect(() => {
    const state = {
      focusTime,
      breakTime,
      focusTarget,
      timeLeft,
      isActive,
      timerMode,
      completedFocusTime,
      cycles,
      lastTickTime,
      lastUpdate: Date.now()
    };
    localStorage.setItem('pomodoroState', JSON.stringify(state));
  }, [focusTime, breakTime, focusTarget, timeLeft, isActive, timerMode, completedFocusTime, cycles, lastTickTime]);

  // Handle timer
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    if (isActive && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft(prevTime => prevTime - 1);
        setLastTickTime(Date.now());
      }, 1000);
    } else if (timeLeft === 0 && isActive) {
      // Timer finished

      // Play sound
      const playNotificationSound = () => {
        try {
          const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
          if (!AudioContext) return;

          const ctx = new AudioContext();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();

          osc.connect(gain);
          gain.connect(ctx.destination);

          osc.type = 'sine';
          osc.frequency.setValueAtTime(880, ctx.currentTime); // A5
          osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.5); // Drop to A4

          gain.gain.setValueAtTime(0.1, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);

          osc.start();
          osc.stop(ctx.currentTime + 0.5);
        } catch (e) {
          console.error('Audio play failed', e);
        }
      };

      playNotificationSound();

      if (timerMode === 'focus') {
        // Update completed focus time
        setCompletedFocusTime(prev => prev + focusTime);
        setCycles(prev => prev + 1);

        // Switch to break
        setTimerMode('break');
        setTimeLeft(breakTime * 60);

        // Notification
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('Focus session completed!', {
            body: 'Take a break now.',
          });
        }
      } else {
        // Switch back to focus
        setTimerMode('focus');
        setTimeLeft(focusTime * 60);

        // Notification
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('Break completed!', {
            body: 'Time to focus again.',
          });
        }
      }
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isActive, timeLeft, timerMode, focusTime, breakTime]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const toggleTimer = () => {
    setIsActive(!isActive);
  };

  const resetTimer = () => {
    setIsActive(false);
    setTimerMode('focus');
    setTimeLeft(focusTime * 60);
    setLastTickTime(Date.now());
  };

  const handleFocusTimeChange = (value: number[]) => {
    const newFocusTime = value[0];
    setFocusTime(newFocusTime);
    if (timerMode === 'focus' && !isActive) {
      setTimeLeft(newFocusTime * 60);
    }
  };

  const handleBreakTimeChange = (value: number[]) => {
    const newBreakTime = value[0];
    setBreakTime(newBreakTime);
    if (timerMode === 'break' && !isActive) {
      setTimeLeft(newBreakTime * 60);
    }
  };

  const handleTargetChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const target = parseInt(e.target.value) || 0;
    setFocusTarget(target);
  };

  const toggleSettings = () => {
    setShowSettings(!showSettings);
  };

  return (
    <ModuleContainer
      title={title}
      onRemove={onRemove}
      onTitleChange={onTitleChange}
      onMinimize={onMinimize}
      isMinimized={isMinimized}
      isDragging={isDragging}
    >
      <div className="flex flex-col items-center">
        {/* Timer display with mode indicator */}
        <div className="relative w-32 h-32 mb-4">
          {/* Circular progress background */}
          <svg className="w-full h-full" viewBox="0 0 100 100">
            <circle
              className="text-secondary"
              strokeWidth="4"
              stroke="currentColor"
              fill="transparent"
              r="42"
              cx="50"
              cy="50"
            />
            {/* Progress indicator */}
            <circle
              className={`${timerMode === 'focus' ? 'text-primary' : 'text-green-500'} transition-all duration-1000`}
              strokeWidth="4"
              strokeDasharray={264} // 2 * π * 42
              strokeDashoffset={264 - (264 * progress) / 100}
              strokeLinecap="round"
              stroke="currentColor"
              fill="transparent"
              r="42"
              cx="50"
              cy="50"
            />
          </svg>

          {/* Timer display */}
          <div className="absolute top-0 left-0 w-full h-full flex flex-col items-center justify-center">
            <span className="text-2xl font-bold text-gray-800 dark:text-white">{formatTime(timeLeft)}</span>
            <span className={`text-xs ${timerMode === 'focus' ? 'text-primary' : 'text-green-500'}`}>
              {timerMode === 'focus' ? 'Focus' : 'Break'}
            </span>
          </div>
        </div>

        {/* Control buttons */}
        <div className="flex gap-3 mb-4">
          <Button
            onClick={toggleTimer}
            className="bg-primary px-4 py-1 rounded-md hover:bg-primary/80 transition-colors flex items-center gap-2"
          >
            {isActive ? <Pause size={16} className="flex-shrink-0" /> : <Play size={16} className="flex-shrink-0" />}
            <span>{isActive ? 'Pause' : 'Start'}</span>
          </Button>
          <Button
            onClick={resetTimer}
            className="bg-secondary px-4 py-1 rounded-md hover:bg-secondary/80 transition-colors flex items-center gap-2 text-white"
          >
            <RotateCcw size={16} className="flex-shrink-0" />
            <span>Reset</span>
          </Button>
          <Button
            onClick={toggleSettings}
            variant="outline"
            className="px-3 py-1 flex items-center justify-center text-gray-700 dark:text-gray-300"
          >
            <Settings size={16} className="flex-shrink-0" />
          </Button>
        </div>

        {/* Sessions completed */}
        <div className="w-full text-center mb-3 text-sm text-gray-700 dark:text-gray-300">
          <span>Cycles: {cycles}</span>
        </div>

        {/* Focus target progress */}
        <div className="w-full mb-4">
          <div className="flex justify-between text-xs mb-1 text-gray-700 dark:text-gray-300">
            <span>Focus Target</span>
            <span>{completedFocusTime}/{focusTarget} min</span>
          </div>
          <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-500"
              style={{ width: `${targetProgress}%` }}
            ></div>
          </div>
        </div>

        {/* Settings panel */}
        {showSettings && (
          <div className="w-full p-3 bg-gray-100 dark:bg-white/10 rounded-md mb-2 border border-gray-200 dark:border-white/10">
            <h4 className="text-sm font-medium mb-3 text-gray-800 dark:text-white">Timer Settings</h4>

            {/* Focus time slider */}
            <div className="mb-4">
              <div className="flex justify-between items-center mb-2">
                <label className="text-xs flex items-center gap-1 text-gray-700 dark:text-gray-300">
                  <Clock size={14} />
                  Focus Time
                </label>
                <span className="text-xs text-gray-700 dark:text-gray-300">{focusTime} min</span>
              </div>
              <Slider
                min={1}
                max={60}
                step={1}
                value={[focusTime]}
                onValueChange={handleFocusTimeChange}
              />
            </div>

            {/* Break time slider */}
            <div className="mb-4">
              <div className="flex justify-between items-center mb-2">
                <label className="text-xs flex items-center gap-1 text-gray-700 dark:text-gray-300">
                  <Clock size={14} />
                  Break Time
                </label>
                <span className="text-xs text-gray-700 dark:text-gray-300">{breakTime} min</span>
              </div>
              <Slider
                min={1}
                max={30}
                step={1}
                value={[breakTime]}
                onValueChange={handleBreakTimeChange}
              />
            </div>

            {/* Focus target input */}
            <div className="mb-2">
              <div className="flex justify-between items-center mb-2">
                <label className="text-xs flex items-center gap-1 text-gray-700 dark:text-gray-300">
                  <Target size={14} />
                  Focus Target (minutes)
                </label>
              </div>
              <Input
                type="number"
                min="15"
                max="600"
                value={focusTarget}
                onChange={handleTargetChange}
                className="h-8 text-sm"
              />
            </div>
          </div>
        )}
      </div>
    </ModuleContainer>
  );
};

export default PomodoroModule;
