import { useLang } from '../i18n'

export default function LanguageToggle({ className = '' }: { className?: string }) {
  const { lang, setLang } = useLang()
  return (
    <div className={`flex items-center gap-0.5 text-xs ${className}`}>
      <button
        onClick={() => setLang('en')}
        className={`px-1.5 py-0.5 rounded transition-colors ${
          lang === 'en'
            ? 'text-white font-semibold'
            : 'text-gray-500 hover:text-gray-300'
        }`}
      >
        EN
      </button>
      <span className="text-gray-600">/</span>
      <button
        onClick={() => setLang('hr')}
        className={`px-1.5 py-0.5 rounded transition-colors ${
          lang === 'hr'
            ? 'text-white font-semibold'
            : 'text-gray-500 hover:text-gray-300'
        }`}
      >
        HR
      </button>
    </div>
  )
}
