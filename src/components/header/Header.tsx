
import React, { useState } from 'react';
import { useDateStore, useViewStore } from "@/lib/store";
import { ChevronLeft, ChevronRight, Home, Sun, Moon, Monitor, Keyboard, Volume2, VolumeX } from 'lucide-react';
import { motion } from 'framer-motion';
import UndoRedoToolbar from '@/components/calendar/UndoRedoToolbar';
import { Button } from "@/components/ui/button";

import dayjs from 'dayjs';
import SettingsNav from './SettingsNav';
import { TooltipProvider } from "@/components/ui/tooltip";
import BulkModeToggle from '../calendar/BulkModeToggle';
import CalendarDropdown from '../calendar/CalendarDropdown';
import { useBulkSelection } from '@/hooks/use-bulk-selection';
import { useNavigate, useLocation } from 'react-router-dom';
import { haptics } from '@/lib/haptics';
import { sounds } from '@/lib/sounds';
import { useThemeStore, type Theme } from '@/lib/stores/theme-store';
import NotificationBell from './NotificationBell';

interface HeaderProps {
  onMenuClick?: () => void;
}

const Header: React.FC<HeaderProps> = ({ onMenuClick }) => {
  const todaysDate = dayjs();
  const { userSelectedDate, setDate, setMonth, selectedMonthIndex } = useDateStore();
  const { selectedView, setView } = useViewStore();
  const navigate = useNavigate();
  const location = useLocation();
  const {
    isBulkMode,
    selectedCount,
    enableBulkMode,
    disableBulkMode,
    bulkDelete,
    bulkUpdateColor,
    bulkReschedule,
    bulkDuplicate,
    deselectAll
  } = useBulkSelection();

  const { theme, setTheme } = useThemeStore();
  const [soundsOn, setSoundsOn] = useState(sounds.enabled);

  const toggleSounds = () => {
    const next = sounds.toggle();
    setSoundsOn(next);
  };

  const cycleTheme = () => {
    haptics.light();
    const next: Record<Theme, Theme> = { light: 'dark', dark: 'system', system: 'light' };
    const nextTheme = next[theme];
    if (nextTheme === 'dark') sounds.play("themeNight");
    else if (nextTheme === 'light') sounds.play("themeDay");
    else sounds.play("themeSystem");
    setTheme(nextTheme);
  };

  const ThemeIcon = theme === 'light' ? Sun : theme === 'dark' ? Moon : Monitor;
  const themeLabel = theme === 'light' ? 'Light' : theme === 'dark' ? 'Dark' : 'System';

  const handleToggleBulkMode = () => {
    if (isBulkMode) {
      disableBulkMode();
    } else {
      enableBulkMode();
    }
  };

  const handleTodayClick = () => {
    haptics.light();
    sounds.play("todayClick");
    switch (selectedView) {
      case "Month":
        setMonth(dayjs().month());
        break;
      case "Week":
        setDate(todaysDate);
        break;
      case "Day":
        setDate(todaysDate);
        setMonth(dayjs().month());
        break;
      default:
        break;
    }
  };

  const handlePrevClick = () => {
    haptics.selection();
    sounds.play("pageSwitch");
    switch (selectedView) {
      case "Month":
        setMonth(selectedMonthIndex - 1);
        break;
      case "Week":
        setDate(userSelectedDate.subtract(1, "week"));
        break;
      case "Day":
        setDate(userSelectedDate.subtract(1, "day"));
        break;
      default:
        break;
    }
  };

  const handleNextClick = () => {
    haptics.selection();
    sounds.play("pageSwitch");
    switch (selectedView) {
      case "Month":
        setMonth(selectedMonthIndex + 1);
        break;
      case "Week":
        setDate(userSelectedDate.add(1, "week"));
        break;
      case "Day":
        setDate(userSelectedDate.add(1, "day"));
        break;
      default:
        break;
    }
  };

  const formatWeekRange = () => {
    const weekStart = userSelectedDate.startOf('week').format("D");
    const weekEnd = userSelectedDate.endOf('week').format("D");
    return `${weekStart}-${weekEnd}`;
  };

  const handleViewChange = (view: string) => {
    haptics.light();
    setView(view);
  };

  return (
    <div className="px-4 py-2 pt-[max(0.5rem,env(safe-area-inset-top))] flex items-center justify-between w-full relative z-10 pointer-events-none">
      {/* Left Side (Home Button) */}
      <div className="flex items-center gap-1 flex-1 min-w-0 pointer-events-auto">
        {location.pathname !== '/' && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/')}
            className="h-9 w-9 p-0"
          >
            <Home className="h-5 w-5 text-gray-700 dark:text-gray-300" />
          </Button>
        )}
      </div>

      {/* Right Side Container */}
      <div className="flex items-center gap-2 pointer-events-auto overflow-x-auto hide-scrollbar max-w-[calc(100vw-5rem)]">
        <span className="text-xs font-semibold tracking-widest uppercase px-2.5 py-1 rounded-full bg-purple-500/20 text-purple-400 border border-purple-500/30 select-none flex-shrink-0">Beta</span>

        <div className="flex items-center gap-2 bg-black/5 dark:bg-white/5 backdrop-blur-3xl border border-black/10 dark:border-white/10 rounded-xl px-2.5 py-1.5 shadow-sm flex-shrink-0">

        {/* Today Button */}
        <motion.button
          onClick={handleTodayClick}
          whileTap={{ scale: 0.92 }}
          transition={{ type: "spring", damping: 20, stiffness: 400 }}
          className="flex items-center gap-2 px-3 py-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors text-sm font-medium flex-shrink-0"
        >
          <span className="text-gray-700 dark:text-gray-300">Today</span>
          <span className="text-muted-foreground/30">|</span>
          <span className="font-semibold text-gray-900 dark:text-gray-100">{dayjs().format('D')}</span>
        </motion.button>

        {/* Date Navigator Box */}
        <div className="flex items-center bg-black/5 dark:bg-white/10 rounded-full px-1.5 py-0.5 flex-shrink-0 min-h-[36px]">
          <motion.button
            onClick={handlePrevClick}
            whileTap={{ scale: 0.82, x: -2 }}
            transition={{ type: "spring", damping: 20, stiffness: 500 }}
            className="p-1 rounded-full hover:bg-black/10 dark:hover:bg-white/20 transition-colors text-muted-foreground"
          >
            <ChevronLeft size={16} />
          </motion.button>

          <div className="px-2 text-xs font-semibold text-center leading-tight min-w-[70px] text-black dark:text-gray-100">
            {selectedView === 'Week' ? (
              <>
                <div>{dayjs(userSelectedDate).format('MMM, YYYY')}</div>
                <div className="text-[10px] text-muted-foreground font-normal">{formatWeekRange()}</div>
              </>
            ) : selectedView === 'Month' ? (
              <div>{dayjs(new Date(dayjs().year(), selectedMonthIndex)).format('MMM, YYYY')}</div>
            ) : (
              <>
                <div>{userSelectedDate.format('MMM, YYYY')}</div>
                <div className="text-[10px] text-muted-foreground font-normal">{userSelectedDate.format('dddd')}</div>
              </>
            )}
          </div>

          <motion.button
            onClick={handleNextClick}
            whileTap={{ scale: 0.82, x: 2 }}
            transition={{ type: "spring", damping: 20, stiffness: 500 }}
            className="p-1 rounded-full hover:bg-black/10 dark:hover:bg-white/20 transition-colors text-muted-foreground"
          >
            <ChevronRight size={16} />
          </motion.button>
        </div>

        {/* Calendar Account Dropdown */}
        <CalendarDropdown />

        {/* Tools & Actions */}
          <div className="flex items-center gap-1 ml-0.5 flex-shrink-0">
          <TooltipProvider>
            <BulkModeToggle
              isBulkMode={isBulkMode}
              onToggle={handleToggleBulkMode}
              selectedCount={selectedCount}
              onDelete={bulkDelete}
              onUpdateColor={bulkUpdateColor}
              onReschedule={bulkReschedule}
              onDuplicate={bulkDuplicate}
              onDeselectAll={deselectAll}
              iconOnly
            />

            <UndoRedoToolbar />
            <motion.button
              onClick={cycleTheme}
              whileTap={{ scale: 0.85, rotate: 15 }}
              whileHover={{ scale: 1.1 }}
              transition={{ type: "spring", damping: 18, stiffness: 380 }}
              className="h-8 w-8 p-0 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 flex items-center justify-center"
              title={`Theme: ${themeLabel}`}
            >
              <ThemeIcon className="h-4 w-4 text-gray-600 dark:text-gray-300" />
            </motion.button>
            <motion.button
              onClick={toggleSounds}
              whileTap={{ scale: 0.85 }}
              whileHover={{ scale: 1.1 }}
              transition={{ type: "spring", damping: 18, stiffness: 380 }}
              className="h-8 w-8 p-0 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 flex items-center justify-center"
              title={soundsOn ? "Sounds: On" : "Sounds: Off"}
            >
              {soundsOn
                ? <Volume2 className="h-4 w-4 text-gray-600 dark:text-gray-300" />
                : <VolumeX className="h-4 w-4 text-gray-400 dark:text-gray-500" />}
            </motion.button>
            <NotificationBell />
            <motion.button
              onClick={() => window.dispatchEvent(new CustomEvent('open-shortcuts'))}
              whileTap={{ scale: 0.85 }}
              whileHover={{ scale: 1.1 }}
              transition={{ type: "spring", damping: 18, stiffness: 380 }}
              className="h-8 w-8 p-0 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 flex items-center justify-center"
              title="Keyboard shortcuts (?)"
            >
              <Keyboard className="h-4 w-4 text-gray-600 dark:text-gray-300" />
            </motion.button>
            <SettingsNav />
          </TooltipProvider>
        </div>
        </div>
      </div>
    </div>
  );
};

export default Header;
