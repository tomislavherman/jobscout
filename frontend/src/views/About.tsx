import { useState } from 'react'
import { submitSourceRequest } from '../api'

function SourceRequestForm() {
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
        Thanks for the suggestion!
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm text-gray-600 mb-1">URL <span className="text-red-400">*</span></label>
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
        <label className="block text-sm text-gray-600 mb-1">Note <span className="text-gray-400 font-normal">(optional)</span></label>
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
        {loading ? 'Submitting...' : 'Submit suggestion'}
      </button>
    </form>
  )
}

export default function About() {
  return (
    <div className="max-w-2xl">
      <h2 className="text-xl font-semibold mb-8">About JobScout</h2>

      <div className="space-y-4">
        <section className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="font-medium mb-3">What it does</h3>
          <p className="text-sm text-gray-600 leading-relaxed">
            JobScout pulls job listings from various sources and presents them as structured
            listings — role, company, location, salary, remote policy, and more. It gives you
            a clean, searchable view of opportunities without having to browse each source
            manually.
          </p>
        </section>

        <section className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="font-medium mb-3">Sources</h3>
          <ul className="text-sm text-gray-600 space-y-2">
            <li className="flex gap-2">
              <span className="text-gray-400 shrink-0">—</span>
              <span>
                <span className="font-medium text-gray-800">Ask HN: Who is Hiring?</span>
                {' '}— monthly Hacker News thread for full-time and contract roles, posted by{' '}
                <a href="https://news.ycombinator.com/submitted?id=whoishiring" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">whoishiring</a>.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="text-gray-400 shrink-0">—</span>
              <span>
                <span className="font-medium text-gray-800">Ask HN: Seeking Freelancer?</span>
                {' '}— monthly Hacker News thread for freelance and consulting work, posted by{' '}
                <a href="https://news.ycombinator.com/submitted?id=jon_north" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">jon_north</a>.
              </span>
            </li>
          </ul>
          <p className="text-sm text-gray-500 mt-3">
            Each source has a configurable max age — listings older than the selected cutoff are hidden from your view. You can adjust this per source in Sources settings.
          </p>
          <p className="text-sm text-gray-500 mt-2">
            More sources are coming. Use the form below to suggest one.
          </p>
        </section>

        <section className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="font-medium mb-3">Tracking your applications</h3>
          <p className="text-sm text-gray-600 leading-relaxed">
            Once signed in, you can set a status on any listing — New, Applied, Interviewing,
            Offer, Rejected, and more. The New Listings tab shows only listings you haven't
            acted on yet. You can also filter by status in All Listings to see where each
            application stands.
          </p>
        </section>

        <section className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="font-medium mb-3">Suggest a source</h3>
          <p className="text-sm text-gray-600 mb-4">
            Know a job board or community that would be a good fit? Let us know.
          </p>
          <SourceRequestForm />
        </section>
      </div>
    </div>
  )
}
