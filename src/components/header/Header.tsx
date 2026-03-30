
import React, { useState } from 'react';
import { useDateStore, useViewStore } from "@/lib/store";
import { ChevronLeft, ChevronRight, Home, Sun, Moon, Monitor, MoreHorizontal, Settings, Undo2, Redo2, Keyboard, Volume2, VolumeX } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import UndoRedoToolbar from '@/components/calendar/UndoRedoToolbar';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

import dayjs from 'dayjs';
import SettingsNav from './SettingsNav';
import { TooltipProvider } from "@/components/ui/tooltip";
import AnalyticsNav from './AnalyticsNav';
import BulkModeToggle from '../calendar/BulkModeToggle';
import CalendarDropdown from '../calendar/CalendarDropdown';
import { useBulkSelection } from '@/hooks/use-bulk-selection';
import { useIsMobile } from "@/hooks/use-mobile";
import { useNavigate, useLocation } from 'react-router-dom';
import { useSubscription } from '@/hooks/use-subscription';
import { Crown } from 'lucide-react';
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
  const isMobile = useIsMobile();
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

  const { subscription } = useSubscription();
  const isPro = subscription?.isPro ?? false;

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
    sounds.play("viewSwipe");
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
    sounds.play("viewSwipe");
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
      <div className="flex items-center gap-2 bg-black/5 dark:bg-white/5 backdrop-blur-3xl border border-black/10 dark:border-white/10 rounded-xl px-2.5 py-1.5 shadow-sm overflow-x-auto hide-scrollbar pointer-events-auto">

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

            {/* Desktop: inline tools */}
            {!isMobile && <UndoRedoToolbar />}
            {!isMobile && (
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
            )}
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
            {!isMobile && (
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
            )}
            {!isMobile && <SettingsNav />}

            {/* Mobile: overflow menu */}
            {isMobile && <MobileOverflowMenu cycleTheme={cycleTheme} themeLabel={themeLabel} ThemeIcon={ThemeIcon} />}
          </TooltipProvider>
        </div>
      </div>
    </div>
  );
};

// ── Mobile Overflow Menu ──────────────────────────────────────────
const MobileOverflowMenu: React.FC<{
  cycleTheme: () => void;
  themeLabel: string;
  ThemeIcon: React.ElementType;
}> = ({ cycleTheme, themeLabel, ThemeIcon }) => {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen(!open)}
        className="h-8 w-8 p-0 rounded-lg hover:bg-black/10 dark:hover:bg-white/10"
      >
        <MoreHorizontal className="h-4 w-4 text-gray-600 dark:text-gray-300" />
      </Button>

      {open && <div className="fixed inset-0 z-[70]" onClick={() => setOpen(false)} />}
      <AnimatePresence>
      {open && (
          <motion.div
            key="overflow-menu"
            initial={{ opacity: 0, scale: 0.9, y: -10, transformOrigin: "top right" }}
            animate={{ opacity: 1, scale: 1, y: 0, transition: { type: "spring", damping: 24, stiffness: 340 } }}
            exit={{ opacity: 0, scale: 0.92, y: -8, transition: { duration: 0.14, ease: [0.4, 0, 1, 1] } }}
            style={{ transformOrigin: "top right" }}
            className="absolute right-0 top-full mt-1 z-[71] min-w-[180px] bg-popover/95 backdrop-blur-xl border border-border rounded-xl shadow-xl overflow-hidden">
            <button
              onClick={() => { cycleTheme(); setOpen(false); }}
              className="flex items-center gap-3 w-full px-4 py-3 text-sm text-foreground hover:bg-accent transition-colors border-t border-border/50"
            >
              <ThemeIcon className="h-4 w-4" />
              Theme: {themeLabel}
            </button>
            <button
              onClick={() => { navigate('/settings'); setOpen(false); }}
              className="flex items-center gap-3 w-full px-4 py-3 text-sm text-foreground hover:bg-accent transition-colors border-t border-border/50"
            >
              <Settings className="h-4 w-4" />
              Settings
            </button>
            <button
              onClick={() => { navigate('/analytics'); setOpen(false); }}
              className="flex items-center gap-3 w-full px-4 py-3 text-sm text-foreground hover:bg-accent transition-colors border-t border-border/50"
            >
              <MoreHorizontal className="h-4 w-4" />
              Analytics
            </button>
            <button
              onClick={() => { navigate('/quick-schedule'); setOpen(false); }}
              className="flex items-center gap-3 w-full px-4 py-3 text-sm text-foreground hover:bg-accent transition-colors border-t border-border/50"
            >
              <MoreHorizontal className="h-4 w-4" />
              Quick Schedule
            </button>
          </motion.div>
      )}
      </AnimatePresence>
    </>
  );
};

export default Header;
