import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import translations
import enCommon from './locales/en/common.json';
import enLanding from './locales/en/landing.json';
import enAuth from './locales/en/auth.json';
import enDashboard from './locales/en/dashboard.json';

import arCommon from './locales/ar/common.json';
import arLanding from './locales/ar/landing.json';
import arAuth from './locales/ar/auth.json';
import arDashboard from './locales/ar/dashboard.json';

import zhCommon from './locales/zh/common.json';
import zhLanding from './locales/zh/landing.json';
import zhAuth from './locales/zh/auth.json';
import zhDashboard from './locales/zh/dashboard.json';

import frCommon from './locales/fr/common.json';
import frLanding from './locales/fr/landing.json';
import frAuth from './locales/fr/auth.json';
import frDashboard from './locales/fr/dashboard.json';

import esCommon from './locales/es/common.json';
import esLanding from './locales/es/landing.json';
import esAuth from './locales/es/auth.json';
import esDashboard from './locales/es/dashboard.json';

import deCommon from './locales/de/common.json';
import deLanding from './locales/de/landing.json';
import deAuth from './locales/de/auth.json';
import deDashboard from './locales/de/dashboard.json';

import ruCommon from './locales/ru/common.json';
import ruLanding from './locales/ru/landing.json';
import ruAuth from './locales/ru/auth.json';
import ruDashboard from './locales/ru/dashboard.json';

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

const resources = {
  en: {
    common: enCommon,
    landing: enLanding,
    auth: enAuth,
    dashboard: enDashboard,
  },
  ar: {
    common: arCommon,
    landing: arLanding,
    auth: arAuth,
    dashboard: arDashboard,
  },
  zh: {
    common: zhCommon,
    landing: zhLanding,
    auth: zhAuth,
    dashboard: zhDashboard,
  },
  fr: {
    common: frCommon,
    landing: frLanding,
    auth: frAuth,
    dashboard: frDashboard,
  },
  es: {
    common: esCommon,
    landing: esLanding,
    auth: esAuth,
    dashboard: esDashboard,
  },
  de: {
    common: deCommon,
    landing: deLanding,
    auth: deAuth,
    dashboard: deDashboard,
  },
  ru: {
    common: ruCommon,
    landing: ruLanding,
    auth: ruAuth,
    dashboard: ruDashboard,
  },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    supportedLngs: ['en', 'ar', 'zh', 'fr', 'es', 'de', 'ru'],
    defaultNS: 'common',
    ns: ['common', 'landing', 'auth', 'dashboard'],
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'i18nextLng',
    },
  });

// Update document direction based on language
i18n.on('languageChanged', (lng) => {
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
