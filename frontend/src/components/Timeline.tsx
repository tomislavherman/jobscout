import type { TimelineEntry } from '../types'

export default function Timeline({ entries }: { entries: TimelineEntry[] }) {
  if (entries.length === 0) {
    return <p className="text-sm text-gray-400 italic">No timeline entries yet.</p>
  }

  return (
    <div className="relative pl-6 space-y-4">
      <div className="absolute left-2.5 top-1 bottom-1 w-px bg-gray-200" />
      {entries.map((entry) => (
        <div key={entry.id} className="relative">
          <div className="absolute -left-[18px] top-1 w-2.5 h-2.5 rounded-full bg-gray-300 ring-2 ring-white" />
          <div className="text-sm">
            <div className="flex items-center gap-2">
              <span className="font-medium text-gray-900">{entry.title || entry.entry_type}</span>
              <span className="text-xs text-gray-400">
                {new Date(entry.created_at).toLocaleDateString()}
              </span>
            </div>
            {entry.status_from && entry.status_to && (
              <p className="text-xs text-gray-500 mt-0.5">
                {entry.status_from} &rarr; {entry.status_to}
              </p>
            )}
            {entry.content && (
              <p className="text-gray-600 mt-1 whitespace-pre-wrap">{entry.content}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
