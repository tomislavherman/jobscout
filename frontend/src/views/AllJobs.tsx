import { useEffect, useState } from 'react'
import type { Job, JobStatus } from '../types'
import { listJobs, STATUS_LABELS } from '../api'
import JobCard from '../components/JobCard'
import PullToRefresh from '../components/PullToRefresh'
import { useInfiniteScroll } from '../hooks/useInfiniteScroll'

const STATUSES: (JobStatus | 'all')[] = ['all', 'new', 'saved', 'applied', 'interviewing', 'offer', 'rejected', 'withdrawn', 'ghosted', 'not_interested']
const PAGE_SIZE = 18

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
  const [jobs, setJobs] = useState<Job[]>([])
  const [filter, setFilter] = useState<string>('all')
  const [loading, setLoading] = useState(true)
  const [shown, setShown] = useState(PAGE_SIZE)

  const fetchJobs = async () => {
    try {
      setLoading(true)
      const params = filter !== 'all' ? { status: filter } : undefined
      const data = await listJobs(params)
      setJobs(data)
      setShown(PAGE_SIZE)
    } catch (err) {
      console.error('Failed to load jobs:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchJobs() }, [filter])

  const loadMore = () => setShown((s) => s + PAGE_SIZE)
  const sentinelRef = useInfiniteScroll(loadMore, shown < jobs.length)

  const visible = jobs.slice(0, shown)

  return (
    <PullToRefresh onRefresh={fetchJobs}>
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">All Listings</h2>
          {!loading && jobs.length > 0 && (
            <span className="hidden lg:inline text-sm text-gray-400">
              Showing {visible.length} of {jobs.length}
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
                {s === 'all' ? 'All' : STATUS_LABELS[s as JobStatus]}
              </button>
            )
          })}
        </div>

        {loading && jobs.length === 0 ? (
          <p className="text-gray-500">Loading...</p>
        ) : jobs.length === 0 ? (
          <p className="text-gray-400 text-center py-12">No jobs match this filter.</p>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {visible.map((job) => (
                <JobCard key={job.id} job={job} onStatusChange={fetchJobs} />
              ))}
            </div>
            {shown < jobs.length && (
              <div className="mt-8">
                <div ref={sentinelRef} />
                <div className="hidden lg:flex justify-center">
                  <button
                    onClick={loadMore}
                    className="px-6 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Load more
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
