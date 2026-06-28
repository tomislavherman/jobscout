import { useEffect, useState } from 'react'
import type { Job, JobStatus } from '../types'
import { listJobs } from '../api'
import JobCard from '../components/JobCard'
import { useInfiniteScroll } from '../hooks/useInfiniteScroll'
import { useT } from '../i18n'

const STATUSES: (JobStatus | 'all')[] = ['all', 'new', 'saved', 'applied', 'interviewing', 'offer', 'rejected', 'withdrawn', 'ghosted', 'not_interested']

const TAB_COLORS: Record<string, { inactive: string; active: string }> = {
  all:          { inactive: 'bg-gray-100 text-gray-500',    active: 'bg-gray-900 text-white' },
  new:          { inactive: 'bg-blue-50 text-blue-500',     active: 'bg-blue-200 text-blue-900' },
  saved:        { inactive: 'bg-teal-50 text-teal-500',     active: 'bg-teal-200 text-teal-900' },
  applied:      { inactive: 'bg-yellow-50 text-yellow-600', active: 'bg-yellow-200 text-yellow-900' },
  interviewing: { inactive: 'bg-purple-50 text-purple-500', active: 'bg-purple-200 text-purple-900' },
  offer:        { inactive: 'bg-green-50 text-green-600',   active: 'bg-green-200 text-green-900' },
  rejected:     { inactive: 'bg-red-50 text-red-500',       active: 'bg-red-200 text-red-900' },
  withdrawn:    { inactive: 'bg-gray-100 text-gray-400',    active: 'bg-gray-300 text-gray-800' },
  ghosted:      { inactive: 'bg-orange-50 text-orange-500', active: 'bg-orange-200 text-orange-900' },
  not_interested: { inactive: 'bg-gray-50 text-gray-400',  active: 'bg-gray-200 text-gray-700' },
}

export default function AllJobs() {
  const t = useT()
  const [jobs, setJobs] = useState<Job[]>([])
  const [filter, setFilter] = useState<string>('all')
  const [cursor, setCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)

  const fetchJobs = async () => {
    try {
      setLoading(true)
      const params = filter !== 'all' ? { status: filter } : undefined
      const page = await listJobs(params)
      setJobs(page.jobs)
      setCursor(page.next_cursor)
      setHasMore(page.next_cursor !== null)
    } catch (err) {
      console.error('Failed to load jobs:', err)
    } finally {
      setLoading(false)
    }
  }

  const loadMore = async () => {
    if (!cursor || loadingMore) return
    setLoadingMore(true)
    try {
      const params = filter !== 'all' ? { status: filter, cursor } : { cursor }
      const page = await listJobs(params)
      setJobs(prev => [...prev, ...page.jobs])
      setCursor(page.next_cursor)
      setHasMore(page.next_cursor !== null)
    } finally {
      setLoadingMore(false)
    }
  }

  useEffect(() => { fetchJobs() }, [filter])

  const sentinelRef = useInfiniteScroll(loadMore, hasMore && !loadingMore)

  return (
    <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">{t('all_listings')}</h2>
          {!loading && jobs.length > 0 && (
            <span className="hidden lg:inline text-sm text-gray-400">
              {t('showing_count', { count: jobs.length })}
            </span>
          )}
        </div>

        <div className="flex flex-wrap gap-2 mb-6">
          {STATUSES.map((s) => {
            const colors = TAB_COLORS[s] ?? TAB_COLORS.all
            return (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={`px-3 py-1.5 text-sm rounded-full transition-colors ${
                  filter === s ? colors.active : colors.inactive
                }`}
              >
                {s === 'all' ? t('filter_all') : t(`status_${s}` as Parameters<typeof t>[0])}
              </button>
            )
          })}
        </div>

        {loading && jobs.length === 0 ? (
          <p className="text-gray-500">{t('loading')}</p>
        ) : jobs.length === 0 ? (
          <p className="text-gray-400 text-center py-12">{t('no_jobs_match_filter')}</p>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {jobs.map((job) => (
                <JobCard key={job.id} job={job} onStatusChange={fetchJobs} />
              ))}
            </div>
            {hasMore && (
              <div className="mt-8">
                <div ref={sentinelRef} />
                <div className="hidden lg:flex justify-center">
                  <button
                    onClick={loadMore}
                    disabled={loadingMore}
                    className="px-6 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
                  >
                    {loadingMore ? t('loading') : t('load_more')}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
    </div>
  )
}
