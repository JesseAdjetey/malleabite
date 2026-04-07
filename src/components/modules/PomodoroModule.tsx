
import React, { useState, useEffect, useRef } from 'react';
import ModuleContainer from './ModuleContainer';
import { Play, Pause, Settings, Clock, Target, RotateCcw, Volume2, VolumeX } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { usePomodoroStore } from '@/lib/stores/pomodoro-store';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/integrations/firebase/config';
import { useAuth } from '@/contexts/AuthContext.firebase';
import { useModuleSize } from '@/contexts/ModuleSizeContext';
import { cn } from '@/lib/utils';

interface PomodoroModuleProps {
  title?: string;
  onRemove?: () => void;
  onTitleChange?: (title: string) => void;
  onMinimize?: () => void;
  isMinimized?: boolean;
  isDragging?: boolean;
  instanceId?: string;
  moveTargets?: { id: string; title: string }[];
  onMoveToPage?: (pageId: string) => void;
  onShare?: () => void;
  isReadOnly?: boolean;
  contentReadOnly?: boolean;
}

// Ambient sound generator using Web Audio API
function useAmbientSound() {
  const ctxRef = useRef<AudioContext | null>(null);
  const nodesRef = useRef<AudioNode[]>([]);
  const [active, setActive] = useState(false);

  const start = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      ctxRef.current = ctx;

      // Brown noise via filtered white noise
      const bufferSize = 4096;
      const node = ctx.createScriptProcessor(bufferSize, 1, 1);
      let lastOut = 0;
      node.onaudioprocess = (e) => {
        const output = e.outputBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          const white = Math.random() * 2 - 1;
          output[i] = (lastOut + 0.02 * white) / 1.02;
          lastOut = output[i];
          output[i] *= 3.5;
        }
      };
      const gain = ctx.createGain();
      gain.gain.value = 0.04;
      node.connect(gain);
      gain.connect(ctx.destination);
      nodesRef.current = [node, gain];
      setActive(true);
    } catch {}
  };

  const stop = () => {
    nodesRef.current.forEach(n => {
      try { (n as any).disconnect(); } catch {}
    });
    nodesRef.current = [];
    try { ctxRef.current?.close(); } catch {}
    ctxRef.current = null;
    setActive(false);
  };

  const toggle = () => active ? stop() : start();

  useEffect(() => () => stop(), []);

  return { active, toggle };
}

// Shared notification sound
function playNotificationSound() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.5);
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
    osc.start();
    osc.stop(ctx.currentTime + 0.5);
  } catch {}
}

// Circular progress ring SVG
const ProgressRing: React.FC<{
  progress: number;
  size: number;
  strokeWidth: number;
  isFocus: boolean;
}> = ({ progress, size, strokeWidth, isFocus }) => {
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (circ * progress) / 100;
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke="currentColor" strokeWidth={strokeWidth}
        className="text-secondary" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke="currentColor" strokeWidth={strokeWidth}
        strokeDasharray={circ}
        strokeDashoffset={offset}
        strokeLinecap="round"
        className={cn('transition-all duration-1000', isFocus ? 'text-primary' : 'text-green-500')}
      />
    </svg>
  );
};

// Cycle dots display
const CycleDots: React.FC<{ cycles: number; max?: number }> = ({ cycles, max = 8 }) => (
  <div className="flex items-center gap-1 flex-wrap justify-center">
    {Array.from({ length: Math.max(max, cycles) }).map((_, i) => (
      <div key={i}
        className={cn('rounded-full transition-all',
          i < cycles ? 'bg-primary w-2.5 h-2.5' : 'bg-secondary w-2 h-2'
        )}
      />
    ))}
  </div>
);

const PomodoroModule: React.FC<PomodoroModuleProps> = ({
  title = "Pomodoro",
  onRemove,
  onTitleChange,
  onMinimize,
  isMinimized = false,
  isDragging = false,
  instanceId,
  moveTargets,
  onMoveToPage,
  onShare,
  isReadOnly,
  contentReadOnly,
}) => {
  const { user } = useAuth();
  const { sizeLevel } = useModuleSize();
  const {
    getInstance, ensureInstance,
    setWorkDuration, setBreakTime, setFocusTarget,
    toggleTimer, resetTimer, tick, completeCycle
  } = usePomodoroStore();

  const ambient = useAmbientSound();

  useEffect(() => {
    ensureInstance(instanceId);
  }, [instanceId, ensureInstance]);

  const instance = getInstance(instanceId);
  const { workDuration, breakTime, focusTarget, timeLeft, isActive, timerMode, completedWorkDuration, cycles } = instance;

  const [showSettings, setShowSettings] = useState(false);

  const totalTime = timerMode === 'focus' ? workDuration * 60 : breakTime * 60;
  const progress = totalTime > 0 ? (timeLeft / totalTime) * 100 : 100;
  const targetProgress = focusTarget > 0 ? Math.min((completedWorkDuration / focusTarget) * 100, 100) : 0;

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Shared timer tick logic
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isActive && timeLeft > 0) {
      interval = setInterval(() => tick(instanceId), 1000);
    } else if (timeLeft === 0 && isActive) {
      if (timerMode === 'focus' && user?.uid) {
        addDoc(collection(db, 'users', user.uid, 'pomodoro_sessions'), {
          date: new Date().toISOString().substring(0, 10),
          durationMinutes: workDuration,
          completedAt: serverTimestamp(),
        }).catch(() => {});
      }
      playNotificationSound();
      completeCycle(instanceId);
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(timerMode === 'focus' ? 'Focus session done!' : 'Break over!', {
          body: timerMode === 'focus' ? 'Take a break.' : 'Time to focus.',
        });
      }
    }
    return () => { if (interval) clearInterval(interval); };
  }, [isActive, timeLeft, timerMode, tick, completeCycle, instanceId]);

  const isFocus = timerMode === 'focus';

  // ─── Settings panel (shared across L1/L2) ─────────────────────────────────
  const SettingsPanel = () => (
    <div className="w-full p-3 bg-gray-100 dark:bg-white/10 rounded-xl border border-gray-200 dark:border-white/10 space-y-4">
      <h4 className="text-sm font-medium text-gray-800 dark:text-white">Settings</h4>
      <div>
        <div className="flex justify-between text-xs mb-2 text-gray-600 dark:text-gray-400">
          <span className="flex items-center gap-1"><Clock size={12} /> Focus</span>
          <span>{workDuration} min</span>
        </div>
        <Slider min={1} max={60} step={1} value={[workDuration]}
          onValueChange={v => setWorkDuration(v[0], instanceId)} />
      </div>
      <div>
        <div className="flex justify-between text-xs mb-2 text-gray-600 dark:text-gray-400">
          <span className="flex items-center gap-1"><Clock size={12} /> Break</span>
          <span>{breakTime} min</span>
        </div>
        <Slider min={1} max={30} step={1} value={[breakTime]}
          onValueChange={v => setBreakTime(v[0], instanceId)} />
      </div>
      <div>
        <label className="text-xs flex items-center gap-1 mb-2 text-gray-600 dark:text-gray-400">
          <Target size={12} /> Focus Target (min)
        </label>
        <Input type="number" min="15" max="600" value={focusTarget}
          onChange={e => setFocusTarget(parseInt(e.target.value) || 0, instanceId)}
          className="h-8 text-sm" />
      </div>
    </div>
  );

  // ─── L3: Focus mode ────────────────────────────────────────────────────────
  if (sizeLevel >= 3) {
    return (
      <ModuleContainer title={title} onRemove={onRemove} onTitleChange={onTitleChange}
        onMinimize={onMinimize} isMinimized={isMinimized} isDragging={isDragging}
        moveTargets={moveTargets} onMoveToPage={onMoveToPage} onShare={onShare}
        isReadOnly={isReadOnly}>
        <div className="flex flex-col items-center justify-center h-full min-h-0 gap-8 py-8">
          {/* Mode label */}
          <div className={cn(
            'text-sm font-semibold tracking-widest uppercase px-4 py-1 rounded-full',
            isFocus
              ? 'bg-primary/10 text-primary'
              : 'bg-green-500/10 text-green-500'
          )}>
            {isFocus ? '● Focus' : '◉ Break'}
          </div>

          {/* Large timer ring */}
          <div className="relative" style={{ width: 240, height: 240 }}>
            <ProgressRing progress={progress} size={240} strokeWidth={6} isFocus={isFocus} />
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
              <span className={cn('text-6xl font-bold tabular-nums tracking-tight',
                isFocus ? 'text-foreground' : 'text-green-500')}>
                {formatTime(timeLeft)}
              </span>
              <span className="text-sm text-muted-foreground">
                {isFocus ? `${workDuration}m focus` : `${breakTime}m break`}
              </span>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => resetTimer(instanceId)}
              className="w-10 h-10 rounded-full bg-secondary/50 hover:bg-secondary flex items-center justify-center transition-colors text-muted-foreground"
            >
              <RotateCcw size={18} />
            </button>
            <button
              onClick={() => toggleTimer(instanceId)}
              className={cn(
                'w-16 h-16 rounded-full flex items-center justify-center transition-all shadow-lg active:scale-95',
                isFocus
                  ? 'bg-primary hover:bg-primary/90 shadow-primary/30 text-primary-foreground'
                  : 'bg-green-500 hover:bg-green-400 shadow-green-500/30 text-white'
              )}
            >
              {isActive
                ? <Pause size={28} />
                : <Play size={28} className="ml-1" />
              }
            </button>
            <button
              onClick={ambient.toggle}
              className={cn(
                'w-10 h-10 rounded-full flex items-center justify-center transition-colors',
                ambient.active
                  ? 'bg-primary/20 text-primary'
                  : 'bg-secondary/50 hover:bg-secondary text-muted-foreground'
              )}
              title={ambient.active ? 'Stop ambient sound' : 'Play ambient sound'}
            >
              {ambient.active ? <Volume2 size={18} /> : <VolumeX size={18} />}
            </button>
          </div>

          {/* Stats row */}
          <div className="flex items-center gap-8 text-center">
            <div>
              <div className="text-2xl font-bold text-foreground">{cycles}</div>
              <div className="text-xs text-muted-foreground">Cycles</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-foreground">{completedWorkDuration}</div>
              <div className="text-xs text-muted-foreground">Min focused</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-foreground">{focusTarget}</div>
              <div className="text-xs text-muted-foreground">Target min</div>
            </div>
          </div>

          {/* Focus target progress */}
          <div className="w-64 space-y-2">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Daily target</span>
              <span>{completedWorkDuration}/{focusTarget} min</span>
            </div>
            <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
              <div
                className={cn('h-full rounded-full transition-all duration-500',
                  targetProgress >= 100 ? 'bg-green-500' : 'bg-primary'
                )}
                style={{ width: `${targetProgress}%` }}
              />
            </div>
          </div>

          {/* Cycle dots */}
          <CycleDots cycles={cycles} />

          {/* Settings inline */}
          <div className="w-full max-w-xs">
            <SettingsPanel />
          </div>
        </div>
      </ModuleContainer>
    );
  }

  // ─── L2: Sidebar fill ─────────────────────────────────────────────────────
  if (sizeLevel === 2) {
    return (
      <ModuleContainer title={title} onRemove={onRemove} onTitleChange={onTitleChange}
        onMinimize={onMinimize} isMinimized={isMinimized} isDragging={isDragging}
        moveTargets={moveTargets} onMoveToPage={onMoveToPage} onShare={onShare}
        isReadOnly={isReadOnly}>
        <div className="flex flex-col items-center gap-5 py-4">
          {/* Mode badge */}
          <div className={cn(
            'text-xs font-semibold tracking-widest uppercase px-3 py-1 rounded-full',
            isFocus ? 'bg-primary/10 text-primary' : 'bg-green-500/10 text-green-500'
          )}>
            {isFocus ? 'Focus' : 'Break'}
          </div>

          {/* Medium timer ring */}
          <div className="relative" style={{ width: 160, height: 160 }}>
            <ProgressRing progress={progress} size={160} strokeWidth={5} isFocus={isFocus} />
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-4xl font-bold tabular-nums">{formatTime(timeLeft)}</span>
            </div>
          </div>

          {/* Controls */}
          <div className="flex gap-3">
            <Button onClick={() => toggleTimer(instanceId)}
              className="bg-primary px-5 py-1 rounded-full hover:bg-primary/80 flex items-center gap-2">
              {isActive ? <Pause size={16} /> : <Play size={16} />}
              {isActive ? 'Pause' : 'Start'}
            </Button>
            <Button onClick={() => resetTimer(instanceId)}
              variant="outline" className="px-3 rounded-full">
              <RotateCcw size={16} />
            </Button>
            <button onClick={ambient.toggle}
              className={cn('px-3 rounded-full border transition-colors',
                ambient.active
                  ? 'bg-primary/10 border-primary/30 text-primary'
                  : 'border-border text-muted-foreground hover:bg-accent'
              )}>
              {ambient.active ? <Volume2 size={15} /> : <VolumeX size={15} />}
            </button>
          </div>

          {/* Stats */}
          <div className="w-full flex justify-around text-center">
            <div>
              <div className="text-lg font-bold">{cycles}</div>
              <div className="text-xs text-muted-foreground">Cycles</div>
            </div>
            <div>
              <div className="text-lg font-bold">{completedWorkDuration}</div>
              <div className="text-xs text-muted-foreground">Min focused</div>
            </div>
          </div>

          {/* Target progress */}
          <div className="w-full space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Daily target</span>
              <span>{completedWorkDuration}/{focusTarget} min</span>
            </div>
            <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full transition-all duration-500"
                style={{ width: `${targetProgress}%` }} />
            </div>
          </div>

          {/* Cycle dots */}
          <CycleDots cycles={cycles} />

          {/* Settings toggle */}
          <button onClick={() => setShowSettings(s => !s)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
            <Settings size={13} />
            {showSettings ? 'Hide settings' : 'Settings'}
          </button>
          {showSettings && <SettingsPanel />}
        </div>
      </ModuleContainer>
    );
  }

  // ─── L1: Normal (original layout) ─────────────────────────────────────────
  return (
    <ModuleContainer title={title} onRemove={onRemove} onTitleChange={onTitleChange}
      onMinimize={onMinimize} isMinimized={isMinimized} isDragging={isDragging}
      moveTargets={moveTargets} onMoveToPage={onMoveToPage} onShare={onShare}
      isReadOnly={isReadOnly}>
      <div className="flex flex-col items-center">
        {/* Timer ring */}
        <div className="relative w-32 h-32 mb-4">
          <ProgressRing progress={progress} size={128} strokeWidth={4} isFocus={isFocus} />
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold text-gray-800 dark:text-white">{formatTime(timeLeft)}</span>
            <span className={cn('text-xs', isFocus ? 'text-primary' : 'text-green-500')}>
              {isFocus ? 'Focus' : 'Break'}
            </span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex gap-3 mb-4">
          <Button onClick={() => toggleTimer(instanceId)}
            className="bg-primary px-4 py-1 rounded-md hover:bg-primary/80 flex items-center gap-2">
            {isActive ? <Pause size={16} className="flex-shrink-0" /> : <Play size={16} className="flex-shrink-0" />}
            {isActive ? 'Pause' : 'Start'}
          </Button>
          <Button onClick={() => resetTimer(instanceId)}
            className="bg-secondary px-4 py-1 rounded-md hover:bg-secondary/80 flex items-center gap-2 text-white">
            <RotateCcw size={16} className="flex-shrink-0" />
            Reset
          </Button>
          <Button onClick={() => setShowSettings(s => !s)} variant="outline" className="px-3 py-1">
            <Settings size={16} className="flex-shrink-0" />
          </Button>
        </div>

        {/* Cycles */}
        <div className="w-full text-center mb-3 text-sm text-gray-700 dark:text-gray-300">
          Cycles: {cycles}
        </div>

        {/* Target progress */}
        <div className="w-full mb-4">
          <div className="flex justify-between text-xs mb-1 text-gray-700 dark:text-gray-300">
            <span>Focus Target</span>
            <span>{completedWorkDuration}/{focusTarget} min</span>
          </div>
          <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
            <div className="h-full bg-primary transition-all duration-500"
              style={{ width: `${targetProgress}%` }} />
          </div>
        </div>

        {showSettings && <SettingsPanel />}
      </div>
    </ModuleContainer>
  );
};

export default PomodoroModule;
