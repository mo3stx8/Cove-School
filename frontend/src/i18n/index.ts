import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { en } from './en'
import { ar } from './ar'

export const LANG_KEY = 'cove_locale'

export const supportedLanguages = [
  { code: 'en', label: 'English', dir: 'ltr' },
  { code: 'ar', label: 'العربية', dir: 'rtl' },
]

const saved = localStorage.getItem(LANG_KEY) ?? 'en'

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    ar: { translation: ar },
  },
  lng: saved,
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
})

export const applyDirection = (lang: string) => {
  const dir = lang === 'ar' ? 'rtl' : 'ltr'
  document.documentElement.dir = dir
  document.documentElement.lang = lang
}

applyDirection(i18n.language)

export const setLanguage = (lang: string) => {
  localStorage.setItem(LANG_KEY, lang)
  i18n.changeLanguage(lang)
  applyDirection(lang)
}

export default i18n
