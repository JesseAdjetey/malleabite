import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LayoutTemplate, Calendar, BarChart3, Settings, Zap, Crown } from 'lucide-react';
import { useIsMobile } from "@/hooks/use-mobile";
import { useSubscription } from '@/hooks/use-subscription';

const MobileNavigation = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();
  const { subscription } = useSubscription();
  const isPro = subscription?.isPro ?? false;

  // Don't show on desktop or auth page
  if (!isMobile || location.pathname === '/auth') {
    return null;
  }

  const navItems = [
    { icon: Calendar, label: 'Calendar', path: '/' },
    { icon: Zap, label: 'Quick', path: '/quick-schedule' },
    { icon: isPro ? Crown : Crown, label: isPro ? 'PRO' : 'Upgrade', path: '/pricing', highlight: !isPro },
    { icon: BarChart3, label: 'Analytics', path: '/analytics' },
    { icon: Settings, label: 'Settings', path: '/settings' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-md border-t border-border md:hidden safe-area-bottom">
      <div className="flex items-center justify-around h-16 px-2">
        {navItems.map((item) => {
          const { icon: Icon, label, path } = item;
          const isActive = location.pathname === path;
          return (
            <button
              key={path}
              onClick={() => navigate(path)}
              className={`flex flex-col items-center justify-center flex-1 h-full space-y-1 transition-colors touch-manipulation ${
                isActive 
                  ? 'text-primary' 
                  : (item as any).highlight 
                    ? 'text-purple-500'
                    : 'text-muted-foreground hover:text-foreground'
              }`}
              aria-label={label}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon size={20} strokeWidth={isActive ? 2.5 : 2} className={(item as any).highlight ? 'text-purple-500' : ''} />
              <span className={`text-[10px] font-medium ${isActive ? 'font-semibold' : ''} ${(item as any).highlight ? 'text-purple-500' : ''}`}>
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
