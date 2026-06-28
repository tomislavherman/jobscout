import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import type { Job, TimelineEntry } from '../types'
import { getJob, addTimelineEntry } from '../api'
import StatusActions from '../components/StatusActions'
import Timeline from '../components/Timeline'

export default function JobDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [job, setJob] = useState<Job | null>(null)
  const [timeline, setTimeline] = useState<TimelineEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [showAddEntry, setShowAddEntry] = useState(false)
  const [entryType, setEntryType] = useState<string>('interview')
  const [entryTitle, setEntryTitle] = useState('')
  const [entryContent, setEntryContent] = useState('')
  const [adding, setAdding] = useState(false)

  const fetchJob = async () => {
    if (!id) return
    try {
      setError(null)
      const data = await getJob(parseInt(id))
      setJob(data.job)
      setTimeline(data.timeline)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load job')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchJob()
  }, [id])

  const handleAddEntry = async () => {
    if (!id || (!entryTitle.trim() && !entryContent.trim())) return
    setAdding(true)
    try {
      await addTimelineEntry(parseInt(id), {
        entry_type: entryType,
        title: entryTitle || undefined,
        content: entryContent || undefined,
      })
      setEntryTitle('')
      setEntryContent('')
      setShowAddEntry(false)
      fetchJob()
    } catch (err) {
      console.error('Failed to add entry:', err)
    } finally {
      setAdding(false)
    }
  }

  if (loading) return <p className="text-gray-500">Loading job...</p>
  if (error) return <p className="text-red-500">{error}</p>
  if (!job) return <p className="text-gray-400">Job not found.</p>

  return (
    <div className="max-w-3xl">
      <button
        onClick={() => navigate(-1)}
        className="text-sm text-gray-500 hover:text-gray-700 mb-4"
      >
        ← Back
      </button>

      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold">{job.role || 'Unknown Role'}</h2>
            {job.company && <p className="text-lg text-gray-600">{job.company}</p>}
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {(job.published_at || job.created_at) && (
                <span className="text-xs text-gray-400">
                  {new Date(job.published_at ?? job.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                </span>
              )}
              {job.source_name && (
                <span className="text-xs bg-orange-50 text-orange-600 border border-orange-100 px-2 py-0.5 rounded-full">
                  {job.source_name}
                </span>
              )}
            </div>
          </div>
          <StatusActions jobId={job.id} currentStatus={job.status} onStatusChange={fetchJob} />
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm mb-4">
          {job.location && (
            <div>
              <span className="text-gray-400">Location</span>
              <p>{job.location}</p>
            </div>
          )}
          {job.remote_type && (
            <div>
              <span className="text-gray-400">Remote</span>
              <p className="capitalize">{job.remote_type}</p>
            </div>
          )}
          {job.salary && (
            <div>
              <span className="text-gray-400">Salary</span>
              <p className="font-medium">{job.salary}</p>
            </div>
          )}
          {job.employment_type && (
            <div>
              <span className="text-gray-400">Type</span>
              <p className="capitalize">{job.employment_type.replace('_', ' ')}</p>
            </div>
          )}
          {job.residency && (
            <div>
              <span className="text-gray-400">Residency</span>
              <p>{job.residency}</p>
            </div>
          )}
          <div>
            <span className="text-gray-400">Source</span>
            <p>
              <a
                href={`https://news.ycombinator.com/item?id=${job.external_id.replace(/-\d+$/, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                View source ↗
              </a>
            </p>
          </div>
        </div>

        {job.raw_text && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-sm text-gray-400 mb-2">Original posting</p>
            <pre className="text-sm text-gray-700 bg-gray-50 p-3 rounded whitespace-pre-wrap font-sans leading-relaxed">{job.raw_text}</pre>
          </div>
        )}

      </div>

      {showAddEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setShowAddEntry(false)}>
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold text-lg mb-4">Add Entry</h3>
            <div className="space-y-3">
              <div className="flex gap-2 flex-wrap">
                {(['interview', 'prep', 'feedback', 'reminder'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setEntryType(t)}
                    className={`px-3 py-1 text-sm rounded-full border transition-colors capitalize ${
                      entryType === t
                        ? 'bg-gray-900 text-white border-gray-900'
                        : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <input
                type="text"
                autoFocus
                value={entryTitle}
                onChange={(e) => setEntryTitle(e.target.value)}
                placeholder="Title (optional)"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
              <textarea
                value={entryContent}
                onChange={(e) => setEntryContent(e.target.value)}
                placeholder="Notes"
                rows={4}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none"
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowAddEntry(false)}
                  className="px-4 py-2 text-sm rounded bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddEntry}
                  disabled={adding || (!entryTitle.trim() && !entryContent.trim())}
                  className="px-4 py-2 text-sm rounded bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-50 transition-colors"
                >
                  {adding ? 'Adding...' : 'Add'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Timeline */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">Timeline</h3>
          <button
            onClick={() => setShowAddEntry(true)}
            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
            title="Add entry"
          >
            Add entry
          </button>
        </div>
        <Timeline entries={timeline} />
      </div>
    </div>
  )
}
