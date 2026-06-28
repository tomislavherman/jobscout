import { createContext, useContext, useState, type ReactNode } from 'react'
import { en, type Translations } from './en'
import { hr } from './hr'

export type Lang = 'en' | 'hr'

const STORAGE_KEY = 'jobscout_lang'

const dictionaries: Record<Lang, Translations> = { en, hr }

function getSavedLang(): Lang {
  const saved = localStorage.getItem(STORAGE_KEY)
  return saved === 'hr' ? 'hr' : 'en'
}

type LangContextValue = {
  lang: Lang
  setLang: (l: Lang) => void
  t: (key: keyof Translations, vars?: Record<string, string | number>) => string
}

const LangContext = createContext<LangContextValue | null>(null)

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(getSavedLang)

  const setLang = (l: Lang) => {
    setLangState(l)
    localStorage.setItem(STORAGE_KEY, l)
  }

  const t = (key: keyof Translations, vars?: Record<string, string | number>): string => {
    let str = dictionaries[lang][key] as string
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        str = str.replace(`{${k}}`, String(v))
      }
    }
    return str
  }

  return <LangContext.Provider value={{ lang, setLang, t }}>{children}</LangContext.Provider>
}

export function useLang() {
  const ctx = useContext(LangContext)
  if (!ctx) throw new Error('useLang must be used inside LanguageProvider')
  return ctx
}

export function useT() {
  return useLang().t
}
