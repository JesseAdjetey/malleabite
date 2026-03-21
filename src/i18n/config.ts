import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

export const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English', flag: 'GB' },
  { code: 'fr', label: 'Français', flag: 'FR' },
  { code: 'es', label: 'Español', flag: 'ES' },
  { code: 'de', label: 'Deutsch', flag: 'DE' },
  { code: 'pt', label: 'Português', flag: 'BR' },
  { code: 'zh', label: '中文', flag: 'CN' },
  { code: 'ja', label: '日本語', flag: 'JP' },
  { code: 'ko', label: '한국어', flag: 'KR' },
  { code: 'ar', label: 'العربية', flag: 'SA' },
  { code: 'hi', label: 'हिन्दी', flag: 'IN' },
  { code: 'sw', label: 'Kiswahili', flag: 'KE' },
  { code: 'tw', label: 'Twi', flag: 'GH' },
] as const;

export type LanguageCode = (typeof SUPPORTED_LANGUAGES)[number]['code'];

const SUPPORTED_CODES = new Set(SUPPORTED_LANGUAGES.map((l) => l.code));

// Map country codes to our supported language codes
const COUNTRY_TO_LANG: Record<string, LanguageCode> = {
  US: 'en', GB: 'en', AU: 'en', CA: 'en', NZ: 'en', IE: 'en',
  FR: 'fr', BE: 'fr', CH: 'fr', SN: 'fr', CI: 'fr', CM: 'fr', CD: 'fr', ML: 'fr', BF: 'fr', NE: 'fr', TD: 'fr', GN: 'fr', RW: 'fr', BJ: 'fr', TG: 'fr', MG: 'fr',
  ES: 'es', MX: 'es', AR: 'es', CO: 'es', PE: 'es', VE: 'es', CL: 'es', EC: 'es', GT: 'es', CU: 'es', BO: 'es', DO: 'es', HN: 'es', PY: 'es', SV: 'es', NI: 'es', CR: 'es', PA: 'es', UY: 'es',
  DE: 'de', AT: 'de',
  BR: 'pt', PT: 'pt', AO: 'pt', MZ: 'pt',
  CN: 'zh', TW: 'zh', HK: 'zh', SG: 'zh',
  JP: 'ja',
  KR: 'ko',
  SA: 'ar', EG: 'ar', IQ: 'ar', MA: 'ar', DZ: 'ar', SD: 'ar', YE: 'ar', SY: 'ar', TN: 'ar', JO: 'ar', AE: 'ar', LB: 'ar', LY: 'ar', OM: 'ar', KW: 'ar', QA: 'ar', BH: 'ar',
  IN: 'hi',
  KE: 'sw', TZ: 'sw', UG: 'sw',
  GH: 'tw',
};

const GEO_CACHE_KEY = 'malleabite_geo_lang';

/**
 * Custom i18next detector: looks up language from IP geolocation.
 * The result is cached in localStorage so we only call the API once.
 */
const geoDetector = {
  name: 'geolocation',
  lookup(): string | undefined {
    // Return cached geo result if available
    const cached = localStorage.getItem(GEO_CACHE_KEY);
    if (cached && SUPPORTED_CODES.has(cached as LanguageCode)) return cached;
    return undefined;
  },
  cacheUserLanguage(): void {
    // caching is handled by the async init below
  },
};

// Fire-and-forget: detect language from IP and store it.
// On first visit this runs async — i18next will use browser language initially,
// then on next page load the geo result will be available.
function detectGeoLanguage() {
  // Skip if user already manually chose a language
  if (localStorage.getItem('malleabite_lang')) return;
  // Skip if we already have a geo detection cached
  if (localStorage.getItem(GEO_CACHE_KEY)) return;

  fetch('https://ipapi.co/json/', { signal: AbortSignal.timeout(3000) })
    .then((r) => r.json())
    .then((data: { country_code?: string }) => {
      const country = data.country_code?.toUpperCase();
      if (!country) return;
      const lang = COUNTRY_TO_LANG[country];
      if (lang) {
        localStorage.setItem(GEO_CACHE_KEY, lang);
        // If user still hasn't manually chosen, apply immediately
        if (!localStorage.getItem('malleabite_lang') && i18n.language !== lang) {
          i18n.changeLanguage(lang);
        }
      }
    })
    .catch(() => {
      // Geolocation failed — no problem, browser detection still works
    });
}

const languageDetector = new LanguageDetector();
languageDetector.addDetector(geoDetector);

i18n
  .use(languageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: 'en',
    debug: import.meta.env.DEV,
    interpolation: {
      escapeValue: false, // React already escapes
    },
    detection: {
      // Priority: 1) user's manual choice  2) geo IP  3) browser language
      order: ['localStorage', 'geolocation', 'navigator'],
      lookupLocalStorage: 'malleabite_lang',
      caches: ['localStorage'],
    },
    resources: {
      // English is the source language — no resource file needed.
      // Other languages are translated on-the-fly by the TranslationProvider.
      en: { translation: {} },
    },
  });

// Start async geo detection after i18next is initialized
detectGeoLanguage();

export default i18n;
