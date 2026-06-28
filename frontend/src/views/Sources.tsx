import { useEffect, useRef, useState } from 'react'
import type { Source } from '../types'
import { listSources, updateUserSourceSettings } from '../api'

type FeedType = 'hiring' | 'freelancer'

const FEED_LINKS: Record<FeedType, string> = {
  hiring: 'https://news.ycombinator.com/submitted?id=whoishiring',
  freelancer: 'https://news.ycombinator.com/submitted?id=jon_north',
}

const MAX_AGE_OPTIONS: { label: string; days: number | null }[] = [
  { label: '1 day',     days: 1 },
  { label: '1 week',    days: 7 },
  { label: '2 weeks',   days: 14 },
  { label: '1 month',   days: 30 },
  { label: '2 months',  days: 60 },
  { label: '6 months',  days: 180 },
  { label: '1 year',    days: 365 },
  { label: 'Unlimited', days: null },
]

function nearestOption(days: number | null): { label: string; days: number | null } {
  if (days === null) return MAX_AGE_OPTIONS[MAX_AGE_OPTIONS.length - 1]
  let best = MAX_AGE_OPTIONS[0]
  let bestDiff = Infinity
  for (const opt of MAX_AGE_OPTIONS) {
    if (opt.days === null) continue
    const diff = Math.abs(opt.days - days)
    if (diff < bestDiff) { bestDiff = diff; best = opt }
  }
  return best
}

function MaxAgeDropdown({
  value,
  onChange,
}: {
  value: number | null
  onChange: (days: number | null) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const current = nearestOption(value)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700"
      >
        {current.label}
        <span className="opacity-50 text-[10px]">▾</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 py-1 min-w-[130px]">
          {MAX_AGE_OPTIONS.map((opt) => (
            <button
              key={String(opt.days)}
              onClick={() => { setOpen(false); onChange(opt.days) }}
              className="flex items-center justify-between w-full px-3 py-1.5 hover:bg-gray-50"
            >
              <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                {opt.label}
              </span>
              {opt.days === current.days && <span className="text-gray-400 text-xs ml-2">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function Sources() {
  const [sources, setSources] = useState<Source[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<Record<number, boolean>>({})

  const fetchSources = async () => {
    try {
      setLoading(true)
      setSources(await listSources())
    } catch (err) {
      console.error('Failed to load sources:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchSources() }, [])

  const saveSettings = async (source: Source, patch: Partial<Pick<Source, 'enabled' | 'max_age_days'>>) => {
    const updated = { ...source, ...patch }
    setSources(prev => prev.map(s => s.id === source.id ? { ...s, ...patch } : s))
    setSaving(prev => ({ ...prev, [source.id]: true }))
    try {
      await updateUserSourceSettings(source.id, {
        enabled: updated.enabled,
        max_age_days: updated.max_age_days,
      })
    } catch (err) {
      console.error('Failed to save settings:', err)
      fetchSources()
    } finally {
      setSaving(prev => ({ ...prev, [source.id]: false }))
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-semibold">Sources</h2>
      </div>

      {loading ? (
        <p className="text-gray-500">Loading sources...</p>
      ) : sources.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-400 text-lg mb-2">No sources available</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sources.map((source) => (
            <div key={source.id} className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{source.name}</span>
                    {saving[source.id] && <span className="text-xs text-gray-400">Saving...</span>}
                  </div>
                  {source.config?.feed_type != null && FEED_LINKS[source.config.feed_type as FeedType] && (
                    <a
                      href={FEED_LINKS[source.config.feed_type as FeedType]}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:underline mt-0.5 inline-block"
                    >
                      View on HN ↗
                    </a>
                  )}
                </div>

                <div className="flex items-center gap-6 shrink-0">
                  <MaxAgeDropdown
                    value={source.max_age_days}
                    onChange={(days) => saveSettings(source, { max_age_days: days })}
                  />

                  {/* Enabled toggle */}
                  <label className="flex items-center gap-2 cursor-pointer">
                    <span className="text-sm text-gray-600">{source.enabled ? 'Enabled' : 'Disabled'}</span>
                    <button
                      role="switch"
                      aria-checked={source.enabled}
                      onClick={() => saveSettings(source, { enabled: !source.enabled })}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                        source.enabled ? 'bg-gray-900' : 'bg-gray-300'
                      }`}
                    >
                      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                        source.enabled ? 'translate-x-4' : 'translate-x-1'
                      }`} />
                    </button>
                  </label>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
