
import React from 'react';
import { useDateStore, useViewStore } from "@/lib/store";
import { ChevronLeft, ChevronRight, Home, Crown } from 'lucide-react';
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

  const formatDate = () => {
    switch (selectedView) {
      case "Month":
        return dayjs(new Date(dayjs().year(), selectedMonthIndex)).format("MMMM YYYY");
      case "Week":
        const weekStart = userSelectedDate.startOf('week').format("MMM D");
        const weekEnd = userSelectedDate.endOf('week').format("MMM D, YYYY");
        return `${weekStart} - ${weekEnd}`;
      case "Day":
        return userSelectedDate.format("dddd, MMMM D, YYYY");
      default:
        return "";
    }
  };

  return (
    <div className="glass mx-2 mt-2 rounded-xl p-2 md:p-3 flex items-center justify-between border border-gray-300 dark:border-white/10 overflow-x-auto">
      {/* Left Side - Navigation */}
      <div className="flex items-center gap-1 md:gap-2 flex-1 min-w-0">
        {/* Home/Dashboard button - only show when not on dashboard */}
        {location.pathname !== '/' && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/')}
            className="h-8 md:h-9 text-xs md:text-sm bg-white/95 text-gray-800 border-gray-300 hover:bg-gray-100 dark:bg-white/10 dark:text-white dark:border-white/10 dark:hover:bg-white/20"
          >
            <Home className="h-4 w-4 mr-1" />
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={handleTodayClick}
          className="h-8 md:h-9 text-xs md:text-sm bg-white/95 text-gray-800 border-gray-300 hover:bg-gray-100 dark:bg-white/10 dark:text-white dark:border-white/10 dark:hover:bg-white/20"
        >
          <span className="hidden sm:inline">Today</span>
          <span className="sm:hidden">Now</span>
        </Button>

       
        <div className="flex items-center gap-0.5 md:gap-1">
          <button
            onClick={handlePrevClick}
            className="p-1 rounded-full text-gray-700 hover:bg-gray-200 dark:text-white dark:hover:bg-white/10 touch-manipulation min-h-[44px] min-w-[44px] md:min-h-0 md:min-w-0 flex items-center justify-center"
            aria-label="Previous"
          >
            <ChevronLeft size={isMobile ? 20 : 18} />
          </button>
          <button
            onClick={handleNextClick}
            className="p-1 rounded-full text-gray-700 hover:bg-gray-200 dark:text-white dark:hover:bg-white/10 touch-manipulation min-h-[44px] min-w-[44px] md:min-h-0 md:min-w-0 flex items-center justify-center"
            aria-label="Next"
          >
            <ChevronRight size={isMobile ? 20 : 18} />
          </button>
        </div>

        <h1 className="text-sm md:text-base font-semibold ml-1 md:ml-2 whitespace-nowrap truncate text-gray-800 dark:text-white">{formatDate()}</h1>
      </div>

      {/* Right Side - View Selector and Settings */}
      <div className="flex items-center gap-1 md:gap-2 flex-shrink-0">
        <div className="flex gap-1 md:gap-2">
          {["Day", "Week", "Month"].map((view) => (
            <Button
              key={view}
              variant={selectedView === view ? "default" : "outline"}
              size="sm"
              onClick={() => setView(view)}
              className={`h-8 text-xs md:text-sm px-2 md:px-3 touch-manipulation min-h-[44px] md:min-h-0 ${selectedView === view
                ? "bg-primary text-white"
                : "bg-white text-gray-800 border-gray-300 hover:bg-gray-100 dark:bg-white/10 dark:text-white dark:border-white/10 dark:hover:bg-white/20"
                }`}
            >
              <span className="hidden sm:inline">{view}</span>
              <span className="sm:hidden">{view.charAt(0)}</span>
            </Button>
          ))}
        </div>

        <TooltipProvider>
          {!isMobile && <BulkModeToggle
            isBulkMode={isBulkMode}
            onToggle={handleToggleBulkMode}
            selectedCount={selectedCount}
            onDelete={bulkDelete}
            onUpdateColor={bulkUpdateColor}
            onReschedule={bulkReschedule}
            onDuplicate={bulkDuplicate}
            onDeselectAll={deselectAll}
            iconOnly
          />}
          
          {/* Undo/Redo Toolbar */}
          {!isMobile && <UndoRedoToolbar />}
          
          {/* Upgrade Button or Pro Badge */}
          {!isMobile && (
            isPro ? (
              <Badge className="bg-purple-600 text-white text-xs">
                <Crown className="h-3 w-3 mr-1" />
                PRO
              </Badge>
            ) : (
              <Button
                size="sm"
                onClick={() => navigate('/pricing')}
                className="h-8 bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-700 hover:to-violet-700 text-white text-xs"
              >
                <Crown className="h-3 w-3 mr-1" />
                Upgrade
              </Button>
            )
          )}
          
          {!isMobile && <SettingsNav />}
        </TooltipProvider>
      </div>
    </div>
  );
};

export default Header;
