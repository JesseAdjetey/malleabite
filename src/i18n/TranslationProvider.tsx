/**
 * TranslationProvider — wraps the app and provides automatic DOM-level translation.
 *
 * Instead of wrapping every string in t(), this provider observes DOM mutations
 * and translates text nodes automatically when the language changes.
 * It also exposes a `useAutoTranslate` hook for manual translation needs.
 */

import React, {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { translateTexts, getCachedTranslation, resetTranslationFailures } from './translationService';
import { SUPPORTED_LANGUAGES, type LanguageCode } from './config';

interface TranslationContextType {
  currentLang: LanguageCode;
  setLanguage: (lang: LanguageCode) => void;
  translateText: (text: string) => Promise<string>;
  isTranslating: boolean;
}

const TranslationContext = createContext<TranslationContextType | null>(null);

export function useAutoTranslate() {
  const ctx = useContext(TranslationContext);
  if (!ctx) throw new Error('useAutoTranslate must be inside TranslationProvider');
  return ctx;
}

/** Safe version that returns defaults outside the provider. */
export function useAutoTranslateSafe() {
  const ctx = useContext(TranslationContext);
  return ctx ?? {
    currentLang: 'en' as LanguageCode,
    setLanguage: () => {},
    translateText: async (t: string) => t,
    isTranslating: false,
  };
}

// Attributes / elements we should NOT translate
const SKIP_TAGS = new Set([
  'SCRIPT', 'STYLE', 'NOSCRIPT', 'CODE', 'PRE', 'TEXTAREA', 'INPUT', 'SVG',
]);
const DATA_NO_TRANSLATE = 'data-no-translate';

// Patterns that should NOT be translated (numbers, times, dates, symbols, etc.)
const SKIP_TEXT_PATTERNS = /^[\d\s:.,/%\-+=$#@!?*()\[\]{}|<>°'";\\/]+$/;
const TIME_PATTERN = /^\d{1,2}:\d{2}(:\d{2})?(\s*(AM|PM))?$/i;
const DATE_LIKE = /^\w{3,4},?\s+\d{4}$/; // "Mar, 2026"
const NUMBER_WITH_UNIT = /^\d+[\s/]*\w{0,3}$/; // "180 min", "25:00"

function shouldTranslateNode(node: Node): boolean {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent?.trim();
    if (!text || text.length < 2) return false;
    // Skip purely numeric / symbolic content
    if (SKIP_TEXT_PATTERNS.test(text)) return false;
    if (TIME_PATTERN.test(text)) return false;
    if (DATE_LIKE.test(text)) return false;
    if (NUMBER_WITH_UNIT.test(text)) return false;
    // Skip if parent says no
    const el = node.parentElement;
    if (!el) return false;
    if (SKIP_TAGS.has(el.tagName)) return false;
    if (el.closest(`[${DATA_NO_TRANSLATE}]`)) return false;
    if (el.getAttribute('contenteditable') === 'true') return false;
    return true;
  }
  return false;
}

// Store original text so we can re-translate on language change
const ORIGINAL_TEXT = 'data-original-text';

export const TranslationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { i18n } = useTranslation();
  const [currentLang, setCurrentLang] = useState<LanguageCode>(
    (i18n.language?.slice(0, 2) as LanguageCode) || 'en'
  );
  const [isTranslating, setIsTranslating] = useState(false);
  const observerRef = useRef<MutationObserver | null>(null);
  const batchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingNodes = useRef<Set<Text>>(new Set());

  const setLanguage = useCallback(
    (lang: LanguageCode) => {
      resetTranslationFailures();
      i18n.changeLanguage(lang);
      localStorage.setItem('malleabite_lang', lang);
      // Clear geo cache so manual choice always takes priority
      localStorage.removeItem('malleabite_geo_lang');
      setCurrentLang(lang);
    },
    [i18n]
  );

  const translateText = useCallback(
    async (text: string): Promise<string> => {
      if (currentLang === 'en') return text;
      const cached = getCachedTranslation(currentLang, text);
      if (cached) return cached;
      const result = await translateTexts([text], currentLang);
      return result[text] || text;
    },
    [currentLang]
  );

  // Batch-translate collected text nodes
  const flushPendingTranslations = useCallback(async () => {
    if (currentLang === 'en' || pendingNodes.current.size === 0) return;

    const nodes = Array.from(pendingNodes.current);
    pendingNodes.current.clear();

    // Collect unique texts
    const textMap = new Map<string, Text[]>();
    for (const node of nodes) {
      const el = node.parentElement;
      const currentText = node.textContent?.trim() || '';
      if (!currentText || currentText.length < 2) continue;

      const storedOriginal = el?.getAttribute(ORIGINAL_TEXT);

      // If parent has a stored original but the current text differs from BOTH
      // the stored original and what the translation would be, React has updated
      // the text dynamically (e.g., "Start" → "Pause"). Treat as new source text.
      if (storedOriginal && currentText !== storedOriginal) {
        // Check if the current text is the translated version of the stored original
        const cachedTranslation = getCachedTranslation(currentLang, storedOriginal);
        if (cachedTranslation && currentText === cachedTranslation.trim()) {
          // Already showing the correct translation — skip
          continue;
        }
        // React changed the text — update the stored original to the new source text
        el?.setAttribute(ORIGINAL_TEXT, currentText);
      }

      const original = currentText;
      if (!textMap.has(original)) textMap.set(original, []);
      textMap.get(original)!.push(node);
      // Store original on parent
      if (el && !el.hasAttribute(ORIGINAL_TEXT)) {
        el.setAttribute(ORIGINAL_TEXT, original);
      }
    }

    if (textMap.size === 0) return;

    setIsTranslating(true);
    try {
      const translations = await translateTexts(Array.from(textMap.keys()), currentLang);
      // Pause observer while we apply translations to prevent feedback loop
      observerRef.current?.disconnect();
      for (const [original, translated] of Object.entries(translations)) {
        const targetNodes = textMap.get(original);
        if (!targetNodes) continue;
        for (const n of targetNodes) {
          // Preserve leading/trailing whitespace from original textContent
          const raw = n.textContent || '';
          const leadingWs = raw.match(/^\s*/)?.[0] || '';
          const trailingWs = raw.match(/\s*$/)?.[0] || '';
          n.textContent = leadingWs + translated + trailingWs;
        }
      }
      // Re-attach observer
      if (currentLang !== 'en') {
        observerRef.current?.observe(document.body, {
          childList: true,
          subtree: true,
          characterData: true,
        });
      }
    } finally {
      setIsTranslating(false);
    }
  }, [currentLang]);

  // Schedule a batched translation
  const scheduleBatch = useCallback(() => {
    if (batchTimerRef.current) clearTimeout(batchTimerRef.current);
    batchTimerRef.current = setTimeout(flushPendingTranslations, 150);
  }, [flushPendingTranslations]);

  // Observe DOM mutations for new text
  useEffect(() => {
    if (currentLang === 'en') {
      // Restore originals
      document.querySelectorAll(`[${ORIGINAL_TEXT}]`).forEach((el) => {
        const original = el.getAttribute(ORIGINAL_TEXT);
        if (original && el.firstChild?.nodeType === Node.TEXT_NODE) {
          el.firstChild.textContent = original;
        }
        el.removeAttribute(ORIGINAL_TEXT);
      });
      return;
    }

    // Translate existing text nodes
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) =>
        shouldTranslateNode(node) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT,
    });
    while (walker.nextNode()) {
      pendingNodes.current.add(walker.currentNode as Text);
    }
    scheduleBatch();

    // Watch for new text nodes
    observerRef.current = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.TEXT_NODE && shouldTranslateNode(node)) {
              pendingNodes.current.add(node as Text);
            } else if (node.nodeType === Node.ELEMENT_NODE) {
              const subWalker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT, {
                acceptNode: (n) =>
                  shouldTranslateNode(n) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT,
              });
              while (subWalker.nextNode()) {
                pendingNodes.current.add(subWalker.currentNode as Text);
              }
            }
          });
        } else if (mutation.type === 'characterData' && shouldTranslateNode(mutation.target)) {
          pendingNodes.current.add(mutation.target as Text);
        }
      }
      if (pendingNodes.current.size > 0) scheduleBatch();
    });

    observerRef.current.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    return () => {
      observerRef.current?.disconnect();
      if (batchTimerRef.current) clearTimeout(batchTimerRef.current);
    };
  }, [currentLang, scheduleBatch]);

  return (
    <TranslationContext.Provider value={{ currentLang, setLanguage, translateText, isTranslating }}>
      {children}
    </TranslationContext.Provider>
  );
};
