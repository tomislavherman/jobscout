import { useNavigate } from 'react-router-dom'
import type { Job } from '../types'
import StatusActions from './StatusActions'

export default function JobCard({ job, onStatusChange, authed = true, onCardClick }: { job: Job; onStatusChange: () => void; authed?: boolean; onCardClick?: () => void }) {
  const navigate = useNavigate()

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime()
    const hours = Math.floor(diff / 3600000)
    if (hours < 1) return 'just now'
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    return `${days}d ago`
  }

  const handleClick = onCardClick ?? (authed ? () => navigate(`/jobs/${job.id}`) : undefined)

  return (
    <div
      className={`bg-white rounded-lg border border-gray-200 p-4 transition-shadow ${handleClick ? 'hover:shadow-md cursor-pointer' : ''}`}
      onClick={handleClick}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-base truncate">{job.role || 'Unknown Role'}</h3>
          {job.company && <p className="text-sm text-gray-600">{job.company}</p>}
        </div>
        {authed && <StatusActions jobId={job.id} currentStatus={job.status} onStatusChange={onStatusChange} />}
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 mt-2">
        {job.location && <span>{job.location}</span>}
        {job.remote_type && (
          <span className="capitalize">{job.remote_type}</span>
        )}
        {job.salary && <span className="text-green-700 font-medium">{job.salary}</span>}
        {job.employment_type && (
          <span className="capitalize">{job.employment_type.replace('_', ' ')}</span>
        )}
      </div>

      <div className="flex items-center justify-between mt-3">
        <span className="text-xs text-gray-400">{timeAgo(job.published_at ?? job.created_at)}</span>
        {job.source_name && (
          <span className="text-xs bg-orange-50 text-orange-600 border border-orange-100 px-2 py-0.5 rounded-full shrink-0 ml-2">{job.source_name}</span>
        )}
      </div>

    </div>
  )
}
