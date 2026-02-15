
import React from 'react';
import { useDateStore, useViewStore } from "@/lib/store";
import { ChevronLeft, ChevronRight, Home } from 'lucide-react';
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

  const formatDate = () => {
    switch (selectedView) {
      case "Month":
        return dayjs(new Date(dayjs().year(), selectedMonthIndex)).format("MMMM YYYY");
      case "Week":
        const weekStart = userSelectedDate.startOf('week').format("MMM D");
        const weekEnd = userSelectedDate.endOf('week').format("MMM D, YYYY");
        return `${weekStart} - ${weekEnd}`;
      case "Day":
        return userSelectedDate.format("ddd, MMM D");
      default:
        return "";
    }
  };

  const handleViewChange = (view: string) => {
    haptics.light();
    setView(view);
  };

  return (
    <div className="bg-background/80 backdrop-blur-xl border-b border-border/40 px-4 py-2 flex items-center justify-between">
      {/* Left Side */}
      <div className="flex items-center gap-1 flex-1 min-w-0">
        {/* Home button — only when not on root */}
        {location.pathname !== '/' && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/')}
            className="h-9 w-9 p-0"
          >
            <Home className="h-5 w-5" />
          </Button>
        )}

        {/* Date navigation arrows */}
        <button
          onClick={handlePrevClick}
          className="p-1.5 rounded-full text-muted-foreground hover:bg-accent transition-colors touch-manipulation min-h-[44px] min-w-[44px] md:min-h-0 md:min-w-0 flex items-center justify-center active:scale-95"
          aria-label="Previous"
        >
          <ChevronLeft size={20} />
        </button>
        <button
          onClick={handleNextClick}
          className="p-1.5 rounded-full text-muted-foreground hover:bg-accent transition-colors touch-manipulation min-h-[44px] min-w-[44px] md:min-h-0 md:min-w-0 flex items-center justify-center active:scale-95"
          aria-label="Next"
        >
          <ChevronRight size={20} />
        </button>

        {/* Date display */}
        <h1 className="text-headline text-foreground ml-1 whitespace-nowrap truncate">{formatDate()}</h1>

        {/* Today — iOS style text button */}
        <button
          onClick={handleTodayClick}
          className="text-subheadline text-primary font-medium ml-2 hover:opacity-70 transition-opacity touch-manipulation active:opacity-50 whitespace-nowrap"
        >
          Today
        </button>
      </div>

      {/* Right Side */}
      <div className="flex items-center gap-1 md:gap-2 flex-shrink-0">
        {/* iOS Segmented Control for view switcher */}
        <div className="flex bg-muted/60 rounded-lg p-0.5 gap-0.5">
          {["Day", "Week", "Month"].map((view) => (
            <button
              key={view}
              onClick={() => handleViewChange(view)}
              className={`h-7 px-2.5 rounded-md text-xs font-medium transition-all duration-150 touch-manipulation ${
                selectedView === view
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <span className="hidden sm:inline">{view}</span>
              <span className="sm:hidden">{view.charAt(0)}</span>
            </button>
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

          {!isMobile && <UndoRedoToolbar />}

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
