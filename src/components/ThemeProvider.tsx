import React, { useEffect } from 'react';
import { useThemeStore, getSystemTheme } from '@/lib/stores/theme-store';
import { useSettingsStore } from '@/lib/stores/settings-store';

interface ThemeProviderProps {
  children: React.ReactNode;
  isAuthPage?: boolean;
}

const ThemeProvider: React.FC<ThemeProviderProps> = ({ children, isAuthPage = false }) => {
  const { theme, setResolvedTheme } = useThemeStore();
  const { backgroundColor } = useSettingsStore();
  
  useEffect(() => {
    // Determine the resolved theme
    let resolvedTheme: 'light' | 'dark';
    
    if (theme === 'system') {
      resolvedTheme = getSystemTheme();
    } else {
      resolvedTheme = theme;
    }
    
    // Update the store with resolved theme
    setResolvedTheme(resolvedTheme);
    
    // Apply the theme class to the document
    const root = document.documentElement;
    
    if (resolvedTheme === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
    } else {
      root.classList.remove('dark');
      root.classList.add('light');
    }
    
    // Apply background gradient based on theme
    if (resolvedTheme === 'dark') {
      // Dark mode: use custom background color if set, otherwise default dark gradient
      const baseColor = isAuthPage ? '#1E2746' : (backgroundColor || '#1a1625');
      const endColor = adjustColorBrightness(baseColor, -40);
      
      document.body.style.background = `linear-gradient(135deg, ${baseColor}, ${endColor})`;
      document.body.style.color = 'white';
    } else {
      // Light mode: clean light gradient
      document.body.style.background = `linear-gradient(135deg, #f8f7ff, #ede9fe)`;
      document.body.style.color = '#1a1a2e';
    }
    
    document.body.style.backgroundAttachment = 'fixed';
    document.body.style.backgroundSize = 'cover';
    document.body.style.minHeight = '100vh';
    document.body.style.margin = '0';
    document.body.style.padding = '0';
    
  }, [theme, backgroundColor, isAuthPage, setResolvedTheme]);

  // Listen for system theme changes
  useEffect(() => {
    if (theme !== 'system') return;
    
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleChange = (e: MediaQueryListEvent) => {
      const newTheme = e.matches ? 'dark' : 'light';
      setResolvedTheme(newTheme);
      
      const root = document.documentElement;
      if (newTheme === 'dark') {
        root.classList.add('dark');
        root.classList.remove('light');
        document.body.style.background = `linear-gradient(135deg, #1a1625, #0f0a1a)`;
        document.body.style.color = 'white';
      } else {
        root.classList.remove('dark');
        root.classList.add('light');
        document.body.style.background = `linear-gradient(135deg, #f8f7ff, #ede9fe)`;
        document.body.style.color = '#1a1a2e';
      }
    };
    
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme, setResolvedTheme]);

  return <>{children}</>;
};

// Helper function to adjust color brightness
function adjustColorBrightness(hex: string, percent: number): string {
  hex = hex.replace(/^#/, '');
  
  let r = parseInt(hex.substring(0, 2), 16);
  let g = parseInt(hex.substring(2, 4), 16);
  let b = parseInt(hex.substring(4, 6), 16);
  
  r = Math.min(255, Math.max(0, r + percent));
  g = Math.min(255, Math.max(0, g + percent));
  b = Math.min(255, Math.max(0, b + percent));
  
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

export default ThemeProvider;
