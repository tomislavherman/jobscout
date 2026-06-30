import type { JobStatus } from '../types'
import { STATUS_LABELS } from '../api'

const statusColors: Record<string, string> = {
  new: 'bg-blue-100 text-blue-800',
  applied: 'bg-yellow-100 text-yellow-800',
  interviewing: 'bg-purple-100 text-purple-800',
  offer: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  withdrawn: 'bg-gray-100 text-gray-600',
  ghosted: 'bg-orange-100 text-orange-800',
  not_interested: 'bg-black text-white',
}

export default function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
        statusColors[status] || 'bg-gray-100 text-gray-700'
      }`}
    >
      {STATUS_LABELS[status as JobStatus] || status}
    </span>
  )
}
