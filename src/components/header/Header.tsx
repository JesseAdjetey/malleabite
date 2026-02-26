
import React from 'react';
import { useDateStore, useViewStore } from "@/lib/store";
import { ChevronLeft, ChevronRight, Home, User } from 'lucide-react';
import UndoRedoToolbar from '@/components/calendar/UndoRedoToolbar';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

import dayjs from 'dayjs';
import SettingsNav from './SettingsNav';
import { TooltipProvider } from "@/components/ui/tooltip";
import AnalyticsNav from './AnalyticsNav';
import BulkModeToggle from '../calendar/BulkModeToggle';
import { useBulkSelection } from '@/hooks/use-bulk-selection';
import { useIsMobile } from "@/hooks/use-mobile";
import { useNavigate, useLocation } from 'react-router-dom';
import { useSubscription } from '@/hooks/use-subscription';
import { Crown } from 'lucide-react';
import { haptics } from '@/lib/haptics';

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
    <div className="px-4 py-2 flex items-center justify-between w-full relative z-10 pointer-events-none">
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
      <div className="flex items-center gap-3 bg-black/5 dark:bg-white/5 backdrop-blur-3xl border border-black/10 dark:border-white/10 rounded-xl px-3 py-2 shadow-sm overflow-x-auto hide-scrollbar pointer-events-auto">

        {/* Today Button */}
        <button
          onClick={handleTodayClick}
          className="flex items-center gap-2 px-3 py-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors text-sm font-medium flex-shrink-0"
        >
          <span className="text-gray-700 dark:text-gray-300">Today</span>
          <span className="text-muted-foreground/30">|</span>
          <span className="font-semibold text-gray-900 dark:text-gray-100">{dayjs().format('D')}</span>
        </button>

        {/* Date Navigator Box */}
        <div className="flex items-center bg-black/5 dark:bg-white/10 rounded-full px-1.5 py-0.5 flex-shrink-0 min-h-[36px]">
          <button onClick={handlePrevClick} className="p-1 rounded-full hover:bg-black/10 dark:hover:bg-white/20 transition-colors text-muted-foreground">
            <ChevronLeft size={16} />
          </button>

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

          <button onClick={handleNextClick} className="p-1 rounded-full hover:bg-black/10 dark:hover:bg-white/20 transition-colors text-muted-foreground">
            <ChevronRight size={16} />
          </button>
        </div>

        {/* Calendar Account Dropdown (UI Mock) */}
        <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-purple-500/10 hover:bg-purple-500/20 text-purple-700 dark:text-purple-300 transition-colors text-sm font-medium border border-purple-500/20 flex-shrink-0">
          <div className="w-5 h-5 rounded-full bg-purple-500 flex items-center justify-center text-[10px] text-white">
            <User size={12} />
          </div>
          <span>jesseadjetey</span>
        </button>

        {/* Tools & Actions */}
        <div className="flex items-center gap-1 ml-1 flex-shrink-0">
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

            {!isMobile && <UndoRedoToolbar />}
            {!isMobile && <SettingsNav />}
          </TooltipProvider>
        </div>
      </div>
    </div>
  );
};

export default Header;
