import { useState, useRef, useEffect } from 'react'
import { changeStatus } from '../api'
import type { JobStatus } from '../types'
import { useT } from '../i18n'
import type { Translations } from '../i18n/en'

const ALL_STATUSES: JobStatus[] = [
  'new', 'saved', 'applied', 'interviewing', 'offer', 'rejected', 'withdrawn', 'ghosted', 'not_interested',
]

const STATUS_COLORS: Record<string, string> = {
  new: 'bg-blue-100 text-blue-800',
  saved: 'bg-cyan-100 text-cyan-800',
  applied: 'bg-yellow-100 text-yellow-800',
  interviewing: 'bg-purple-100 text-purple-800',
  offer: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  withdrawn: 'bg-gray-100 text-gray-600',
  ghosted: 'bg-orange-100 text-orange-800',
  not_interested: 'bg-black text-white',
}

export default function StatusActions({
  jobId,
  currentStatus,
  onStatusChange,
}: {
  jobId: number
  currentStatus: string
  onStatusChange: () => void
}) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const handleSelect = async (status: string) => {
    setOpen(false)
    if (status === currentStatus) return
    try {
      await changeStatus(jobId, status)
      onStatusChange()
    } catch (err) {
      console.error('Failed to change status:', err)
    }
  }

  const statusLabel = (s: string) => t(`status_${s}` as keyof Translations)

  const colorClass = STATUS_COLORS[currentStatus] || 'bg-gray-100 text-gray-700'

  return (
    <>
      <div className="relative" ref={ref}>
        <button
          onClick={(e) => { e.stopPropagation(); setOpen(!open) }}
          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${colorClass}`}
        >
          {statusLabel(currentStatus)}
          <span className="opacity-50 text-[10px]">▾</span>
        </button>

        {open && (
          <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 py-1 min-w-[170px]">
            {ALL_STATUSES.map((s) => (
              <button
                key={s}
                onClick={(e) => { e.stopPropagation(); handleSelect(s) }}
                className="flex items-center justify-between w-full px-3 py-1.5 hover:bg-gray-50"
              >
                <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[s]}`}>
                  {statusLabel(s)}
                </span>
                {s === currentStatus && <span className="text-gray-400 text-xs ml-2">✓</span>}
              </button>
            ))}
          </div>
        )}
      </div>

    </>
  )
}
