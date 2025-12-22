import React from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useThemeStore, type Theme } from '@/lib/stores/theme-store';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

interface ThemeSelectorProps {
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const themes: { value: Theme; label: string; icon: React.ReactNode; description: string }[] = [
  {
    value: 'light',
    label: 'Light',
    icon: <Sun className="h-5 w-5" />,
    description: 'Clean and bright',
  },
  {
    value: 'dark',
    label: 'Dark',
    icon: <Moon className="h-5 w-5" />,
    description: 'Easy on the eyes',
  },
  {
    value: 'system',
    label: 'System',
    icon: <Monitor className="h-5 w-5" />,
    description: 'Match your device',
  },
];

export function ThemeSelector({ showLabel = true, size = 'md', className }: ThemeSelectorProps) {
  const { theme, setTheme } = useThemeStore();

  const sizeClasses = {
    sm: 'p-2 gap-1',
    md: 'p-3 gap-2',
    lg: 'p-4 gap-3',
  };

  return (
    <div className={cn('space-y-3', className)}>
      {showLabel && (
        <Label className="text-sm font-medium">Theme</Label>
      )}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {themes.map((t) => (
          <button
            key={t.value}
            onClick={() => setTheme(t.value)}
            className={cn(
              'flex flex-col items-center justify-center rounded-lg border-2 transition-all',
              sizeClasses[size],
              theme === t.value
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border bg-card hover:border-primary/50 hover:bg-accent/50'
            )}
          >
            <div className={cn(
              'mb-1 rounded-full p-2',
              theme === t.value ? 'bg-primary/20' : 'bg-muted'
            )}>
              {t.icon}
            </div>
            <span className="text-xs sm:text-sm font-medium">{t.label}</span>
            <span className="text-[10px] sm:text-xs text-muted-foreground hidden sm:block">
              {t.description}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

// Compact toggle for header/quick access
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, resolvedTheme, setTheme } = useThemeStore();

  const cycleTheme = () => {
    const order: Theme[] = ['light', 'dark', 'system'];
    const currentIndex = order.indexOf(theme);
    const nextIndex = (currentIndex + 1) % order.length;
    setTheme(order[nextIndex]);
  };

  const getIcon = () => {
    if (theme === 'system') {
      return <Monitor className="h-4 w-4" />;
    }
    return resolvedTheme === 'dark' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />;
  };

  const getLabel = () => {
    if (theme === 'system') return 'System';
    return theme === 'dark' ? 'Dark' : 'Light';
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={cycleTheme}
      className={cn('gap-2', className)}
      title={`Theme: ${getLabel()}`}
    >
      {getIcon()}
      <span className="sr-only">{getLabel()}</span>
    </Button>
  );
}

export default ThemeSelector;
