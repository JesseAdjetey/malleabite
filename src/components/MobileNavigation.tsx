import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Calendar, BarChart3, Settings, Zap } from 'lucide-react';
import { useIsMobile } from "@/hooks/use-mobile";
import { haptics } from '@/lib/haptics';

const MobileNavigation = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();

  if (!isMobile || location.pathname === '/auth') {
    return null;
  }

  const navItems = [
    { icon: Calendar, label: 'Calendar', path: '/' },
    { icon: Zap, label: 'Quick', path: '/quick-schedule' },
    { icon: BarChart3, label: 'Analytics', path: '/analytics' },
    { icon: Settings, label: 'Settings', path: '/settings' },
  ];

  const handleNavTap = (path: string) => {
    haptics.selection();
    navigate(path);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      {/* iOS-style frosted glass background */}
      <div className="absolute inset-0 bg-background/80 backdrop-blur-xl border-t border-border/40" />

      <div className="relative flex items-end justify-around h-[49px] px-2">
        {navItems.map((item) => {
          const { icon: Icon, label, path } = item;
          const isActive = path === '/'
            ? location.pathname === '/' || location.pathname === '/calendar'
            : location.pathname.startsWith(path);

          return (
            <button
              key={path}
              onClick={() => handleNavTap(path)}
              className="flex flex-col items-center justify-center flex-1 h-full gap-0.5 touch-manipulation"
              aria-label={label}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon
                size={22}
                strokeWidth={isActive ? 2.2 : 1.5}
                className={`transition-colors duration-150 ${
                  isActive ? 'text-primary' : 'text-muted-foreground'
                }`}
              />
              <span className={`text-caption2 tracking-tight transition-colors duration-150 ${
                isActive ? 'text-primary font-medium' : 'text-muted-foreground'
              }`}>
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default MobileNavigation;
