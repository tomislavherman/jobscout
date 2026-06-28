import { useState } from 'react'
import { submitSourceRequest } from '../api'
import { useT } from '../i18n'

function SourceRequestForm() {
  const t = useT()
  const [url, setUrl] = useState('')
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      await submitSourceRequest(url, note)
      setSuccess(true)
      setUrl(''); setNote('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="text-sm text-green-700 bg-green-50 border border-green-100 rounded-lg px-4 py-3">
        {t('thanks_for_suggestion')}
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm text-gray-600 mb-1">
          {t('url_label')} <span className="text-red-400">{t('url_required')}</span>
        </label>
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://"
          required
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
        />
      </div>
      <div>
        <label className="block text-sm text-gray-600 mb-1">
          {t('note_label')} <span className="text-gray-400 font-normal">{t('optional')}</span>
        </label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none"
        />
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}
      <button
        type="submit"
        disabled={loading || !url.trim()}
        className="px-4 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors"
      >
        {loading ? t('submitting') : t('submit_suggestion')}
      </button>
    </form>
  )
}

export default function About() {
  const t = useT()
  return (
    <div className="max-w-2xl">
      <h2 className="text-xl font-semibold mb-8">{t('about_title')}</h2>

      <div className="space-y-4">
        <section className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="font-medium mb-3">{t('about_what_it_does')}</h3>
          <p className="text-sm text-gray-600 leading-relaxed">
            {t('about_what_it_does_desc')}
          </p>
        </section>

        <section className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="font-medium mb-3">{t('about_sources_heading')}</h3>
          <ul className="text-sm text-gray-600 space-y-2">
            <li className="flex gap-2">
              <span className="text-gray-400 shrink-0">—</span>
              <span>
                <span className="font-medium text-gray-800">Ask HN: Who is Hiring?</span>
                {' '}— {t('about_sources_monthly_full_time')}{' '}
                <a href="https://news.ycombinator.com/submitted?id=whoishiring" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">whoishiring</a>.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-gray-400 shrink-0">—</span>
              <span>
                <span className="font-medium text-gray-800">Ask HN: Seeking Freelancer?</span>
                {' '}— {t('about_sources_monthly_freelance')}{' '}
                <a href="https://news.ycombinator.com/submitted?id=jon_north" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">jon_north</a>.
              </span>
            </li>
          </ul>
          <p className="text-sm text-gray-500 mt-3">
            {t('about_sources_max_age_note')}
          </p>
          <p className="text-sm text-gray-500 mt-2">
            {t('about_sources_coming_soon')}
          </p>
        </section>

        <section className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="font-medium mb-3">{t('about_tracking')}</h3>
          <p className="text-sm text-gray-600 leading-relaxed">
            {t('about_tracking_desc')}
          </p>
        </section>

        <section className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="font-medium mb-3">{t('about_suggest')}</h3>
          <p className="text-sm text-gray-600 mb-4">
            {t('about_suggest_desc')}
          </p>
          <SourceRequestForm />
        </section>
      </div>
    </div>
  )
}
