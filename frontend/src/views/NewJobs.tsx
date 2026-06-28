import { useEffect, useState } from 'react'
import type { Job } from '../types'
import { listJobs } from '../api'
import JobCard from '../components/JobCard'
import PullToRefresh from '../components/PullToRefresh'
import { useInfiniteScroll } from '../hooks/useInfiniteScroll'
import { useT } from '../i18n'

export default function NewJobs() {
  const t = useT()
  const [jobs, setJobs] = useState<Job[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchJobs = async () => {
    try {
      setError(null)
      setLoading(true)
      const page = await listJobs({ status: 'new' })
      setJobs(page.jobs)
      setCursor(page.next_cursor)
      setHasMore(page.next_cursor !== null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load jobs')
    } finally {
      setLoading(false)
    }
  }

  const loadMore = async () => {
    if (!cursor || loadingMore) return
    setLoadingMore(true)
    try {
      const page = await listJobs({ status: 'new', cursor })
      setJobs(prev => [...prev, ...page.jobs])
      setCursor(page.next_cursor)
      setHasMore(page.next_cursor !== null)
    } finally {
      setLoadingMore(false)
    }
  }

  useEffect(() => { fetchJobs() }, [])

  const sentinelRef = useInfiniteScroll(loadMore, hasMore && !loadingMore)

  if (loading && jobs.length === 0) return <p className="text-gray-500">{t('loading_new_jobs')}</p>
  if (error) return <p className="text-red-500">{error}</p>

  return (
    <PullToRefresh onRefresh={fetchJobs}>
      <div>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold">{t('new_listings')}</h2>
          {jobs.length > 0 && (
            <span className="hidden lg:inline text-sm text-gray-400">
              {t('showing_count', { count: jobs.length })}
            </span>
          )}
        </div>

        {jobs.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-400 text-lg mb-2">{t('no_new_jobs_yet')}</p>
            <p className="text-gray-400 text-sm">{t('jobs_appear_after_hn_sync')}</p>
          </div>
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
    </PullToRefresh>
  )
}
