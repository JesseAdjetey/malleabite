/**
 * Translation service that auto-translates text using the Firebase/Gemini backend.
 * Caches translations in localStorage to avoid redundant API calls.
 */

import { getAuth } from 'firebase/auth';

const CACHE_KEY = 'malleabite_translations';
const CACHE_VERSION = 1;

// Track failed texts to avoid retrying repeatedly
const failedTexts = new Set<string>();
let consecutiveFailures = 0;
const MAX_CONSECUTIVE_FAILURES = 3;

interface TranslationCache {
  version: number;
  // { [lang]: { [sourceText]: translatedText } }
  translations: Record<string, Record<string, string>>;
}

function getCache(): TranslationCache {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.version === CACHE_VERSION) return parsed;
    }
  } catch { /* ignore */ }
  return { version: CACHE_VERSION, translations: {} };
}

function setCache(cache: TranslationCache) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch { /* storage full — ignore */ }
}

/** Look up a cached translation. Returns undefined on miss. */
export function getCachedTranslation(lang: string, text: string): string | undefined {
  return getCache().translations[lang]?.[text];
}

/** Save a batch of translations to cache. */
export function cacheTranslations(lang: string, pairs: Record<string, string>) {
  const cache = getCache();
  if (!cache.translations[lang]) cache.translations[lang] = {};
  Object.assign(cache.translations[lang], pairs);
  setCache(cache);
}

/**
 * Translate an array of English texts to the target language.
 * Uses Firebase Cloud Function backed by Gemini.
 * Returns a map of { sourceText: translatedText }.
 */
export async function translateTexts(
  texts: string[],
  targetLang: string,
): Promise<Record<string, string>> {
  if (targetLang === 'en') {
    return Object.fromEntries(texts.map((t) => [t, t]));
  }

  // Stop retrying after too many consecutive failures (API likely unavailable)
  if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
    return Object.fromEntries(texts.map((t) => [t, t]));
  }

  // Check cache first, only request uncached texts
  const result: Record<string, string> = {};
  const uncached: string[] = [];

  for (const text of texts) {
    const cached = getCachedTranslation(targetLang, text);
    if (cached !== undefined) {
      result[text] = cached;
    } else if (!failedTexts.has(`${targetLang}:${text}`)) {
      uncached.push(text);
    } else {
      result[text] = text;
    }
  }

  if (uncached.length === 0) return result;

  try {
    // Get Firebase auth token
    const auth = getAuth();
    const user = auth.currentUser;
    const token = user ? await user.getIdToken() : null;

    const baseUrl = import.meta.env.VITE_FIREBASE_FUNCTIONS_URL
      || `https://us-central1-${import.meta.env.VITE_FIREBASE_PROJECT_ID}.cloudfunctions.net`;

    const response = await fetch(`${baseUrl}/translateText`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ texts: uncached, targetLang }),
    });

    if (!response.ok) {
      consecutiveFailures++;
      if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
        console.warn('[i18n] Translation API returned', response.status, '— stopping retries.');
      } else {
        console.warn('[i18n] Translation API error:', response.status);
      }
      for (const t of uncached) result[t] = t;
      return result;
    }

    const data = await response.json();
    const translated: Record<string, string> = data.translations || {};

    // Merge & cache
    Object.assign(result, translated);
    cacheTranslations(targetLang, translated);
    consecutiveFailures = 0;

    // Any texts not in response get their original
    for (const t of uncached) {
      if (!result[t]) result[t] = t;
    }
  } catch (err) {
    consecutiveFailures++;
    if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
      console.warn('[i18n] Translation API unavailable after 3 failures, stopping retries. Deploy the translateText Cloud Function.');
    } else {
      console.warn('[i18n] Translation failed, using originals:', err);
    }
    for (const t of uncached) {
      result[t] = t;
      failedTexts.add(`${targetLang}:${t}`);
    }
  }

  return result;
}

/** Reset failure tracking (call on language change or retry). */
export function resetTranslationFailures() {
  consecutiveFailures = 0;
  failedTexts.clear();
}

/** Clear the translation cache (e.g., on logout). */
export function clearTranslationCache() {
  resetTranslationFailures();
  localStorage.removeItem(CACHE_KEY);
}
