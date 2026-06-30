import { useEffect, useState } from 'react'
import type { Stats as StatsType, JobStatus } from '../types'
import { getStats } from '../api'
import { useT } from '../i18n'
import type { Translations } from '../i18n/en'

const statusOrder: JobStatus[] = ['new', 'saved', 'applied', 'interviewing', 'offer', 'rejected', 'withdrawn', 'ghosted', 'not_interested']

const statusColors: Record<string, string> = {
  new: 'bg-blue-500',
  saved: 'bg-cyan-500',
  applied: 'bg-yellow-500',
  interviewing: 'bg-purple-500',
  offer: 'bg-green-500',
  rejected: 'bg-red-400',
  withdrawn: 'bg-gray-400',
  ghosted: 'bg-red-500',
  not_interested: 'bg-black',
}

export default function Stats() {
  const t = useT()
  const [stats, setStats] = useState<StatsType | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const data = await getStats()
        setStats(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load stats')
      } finally {
        setLoading(false)
      }
    }
    fetchStats()
  }, [])

  if (loading) return <p className="text-gray-500">{t('loading_stats')}</p>
  if (error) return <p className="text-red-500">{error}</p>
  if (!stats) return <p className="text-gray-400">{t('no_stats_available')}</p>

  const total = stats.status_counts.total || 0

  return (
    <div>
      <h2 className="text-xl font-semibold mb-6">{t('dashboard')}</h2>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 mb-8">
        {statusOrder.map((status) => {
          const count = stats.status_counts[status] || 0
          return (
            <div key={status} className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center gap-2 mb-1">
                <div className={`w-3 h-3 rounded-full ${statusColors[status]}`} />
                <span className="text-sm text-gray-600">{t(`status_${status}` as keyof Translations)}</span>
              </div>
              <p className="text-2xl font-bold">{count}</p>
            </div>
          )
        })}
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="font-semibold mb-4">{t('distribution')}</h3>
        {total === 0 ? (
          <p className="text-sm text-gray-400">{t('no_jobs_stats')}</p>
        ) : (
          <div className="space-y-2">
            {statusOrder.map((status) => {
              const count = stats.status_counts[status] || 0
              const pct = total > 0 ? Math.round((count / total) * 100) : 0
              return (
                <div key={status} className="flex items-center gap-3">
                  <span className="text-sm text-gray-600 w-28 shrink-0">{t(`status_${status}` as keyof Translations)}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${statusColors[status]}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-sm text-gray-500 w-16 text-right">{count}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>

    </div>
  )
}
