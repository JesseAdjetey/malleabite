import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SUPPORTED_LANGUAGES, type LanguageCode } from '@/i18n/config';
import { useAutoTranslateSafe } from '@/i18n/TranslationProvider';

const LanguageSwitcher: React.FC<{ iconOnly?: boolean }> = ({ iconOnly = true }) => {
  const [open, setOpen] = useState(false);
  const { currentLang, setLanguage, isTranslating } = useAutoTranslateSafe();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuPos, setMenuPos] = useState({ top: 0, right: 0 });

  const currentLabel = SUPPORTED_LANGUAGES.find((l) => l.code === currentLang)?.label || 'English';

  const updatePosition = useCallback(() => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    setMenuPos({
      top: rect.bottom + 4,
      right: window.innerWidth - rect.right,
    });
  }, []);

  // Position the menu when opening
  useEffect(() => {
    if (!open) return;
    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [open, updatePosition]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        buttonRef.current && !buttonRef.current.contains(target) &&
        menuRef.current && !menuRef.current.contains(target)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div data-no-translate>
      <Button
        ref={buttonRef}
        variant="ghost"
        size="sm"
        onClick={() => setOpen(!open)}
        className={`h-8 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 ${iconOnly ? 'w-8 p-0' : 'px-2 gap-1.5'}`}
        title={`Language: ${currentLabel}`}
      >
        <Globe className={`h-4 w-4 text-gray-600 dark:text-gray-300 ${isTranslating ? 'animate-pulse' : ''}`} />
        {!iconOnly && <span className="text-xs font-medium">{currentLang.toUpperCase()}</span>}
      </Button>

      {open && createPortal(
        <div
          ref={menuRef}
          data-no-translate
          className="fixed z-[9999] min-w-[180px] max-h-[320px] overflow-y-auto bg-popover/95 backdrop-blur-xl border border-border rounded-xl shadow-xl"
          style={{ top: menuPos.top, right: menuPos.right }}
        >
          {SUPPORTED_LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              onClick={() => {
                setLanguage(lang.code as LanguageCode);
                setOpen(false);
              }}
              className={`flex items-center gap-3 w-full px-4 py-2.5 text-sm transition-colors hover:bg-accent ${
                currentLang === lang.code
                  ? 'text-primary font-semibold bg-accent/50'
                  : 'text-foreground'
              } ${lang.code !== SUPPORTED_LANGUAGES[0].code ? 'border-t border-border/30' : ''}`}
            >
              <span className="text-base">{getFlagEmoji(lang.flag)}</span>
              <span>{lang.label}</span>
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
};

/** Convert country code to flag emoji (e.g., "US" → 🇺🇸) */
function getFlagEmoji(countryCode: string): string {
  return [...countryCode.toUpperCase()]
    .map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65))
    .join('');
}

export default LanguageSwitcher;
