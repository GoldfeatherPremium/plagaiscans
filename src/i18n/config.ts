import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import HttpBackend from 'i18next-http-backend';

// Bundle English inline so it's available on first paint (prevents flash of translation keys).
// Other languages are lazy-loaded from /public/locales/{lng}/{ns}.json on demand.
import enCommon from './locales/en/common.json';
import enAuth from './locales/en/auth.json';
import enDashboard from './locales/en/dashboard.json';
import enLanding from './locales/en/landing.json';
import enLegal from './locales/en/legal.json';
import enPages from './locales/en/pages.json';

export const languages = [
  { code: 'en', name: 'English', nativeName: 'English', flag: '🇬🇧', dir: 'ltr' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', flag: '🇸🇦', dir: 'rtl' },
  { code: 'zh', name: 'Chinese', nativeName: '中文', flag: '🇨🇳', dir: 'ltr' },
  { code: 'fr', name: 'French', nativeName: 'Français', flag: '🇫🇷', dir: 'ltr' },
  { code: 'es', name: 'Spanish', nativeName: 'Español', flag: '🇪🇸', dir: 'ltr' },
  { code: 'de', name: 'German', nativeName: 'Deutsch', flag: '🇩🇪', dir: 'ltr' },
  { code: 'ru', name: 'Russian', nativeName: 'Русский', flag: '🇷🇺', dir: 'ltr' },
] as const;

export type LanguageCode = typeof languages[number]['code'];

// Read explicit user choice from localStorage; default to English (no browser auto-detect).
const storedLng = typeof window !== 'undefined' ? window.localStorage.getItem('i18nextLng') : null;
const supported = ['en', 'ar', 'zh', 'fr', 'es', 'de', 'ru'];
const initialLng = storedLng && supported.includes(storedLng) ? storedLng : 'en';

i18n
  .use(HttpBackend)
  .use(initReactI18next)
  .init({
    lng: initialLng,
    fallbackLng: 'en',
    supportedLngs: supported,
    defaultNS: 'common',
    ns: ['common'],
    load: 'languageOnly',
    partialBundledLanguages: true,
    resources: {
      en: {
        common: enCommon,
        auth: enAuth,
        dashboard: enDashboard,
        landing: enLanding,
        legal: enLegal,
        pages: enPages,
      },
    },
    backend: {
      loadPath: '/locales/{{lng}}/{{ns}}.json',
    },
    interpolation: {
      escapeValue: false,
    },
    react: {
      useSuspense: false,
    },
  });

// Persist explicit language changes
i18n.on('languageChanged', (lng) => {
  try {
    window.localStorage.setItem('i18nextLng', lng);
  } catch {}
  const language = languages.find(l => l.code === lng);
  if (language) {
    document.documentElement.dir = language.dir;
    document.documentElement.lang = lng;
  }
});

// Set initial direction
const currentLang = languages.find(l => l.code === i18n.language);
if (currentLang) {
  document.documentElement.dir = currentLang.dir;
  document.documentElement.lang = i18n.language;
}

export default i18n;
