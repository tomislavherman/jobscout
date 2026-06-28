import { useEffect, useState } from 'react'
import type { Job } from '../types'
import { getPublicJob } from '../api'
import { useT } from '../i18n'

export default function PublicJobDetail({
  jobId,
  onBack,
  onLogin,
}: {
  jobId: number
  onBack: () => void
  onLogin: () => void
}) {
  const t = useT()
  const [job, setJob] = useState<Job | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getPublicJob(jobId)
      .then(setJob)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load job'))
      .finally(() => setLoading(false))
  }, [jobId])

  if (loading) return <p className="text-gray-500 p-6">{t('loading_jobs')}</p>
  if (error) return <p className="text-red-500 p-6">{error}</p>
  if (!job) return <p className="text-gray-400 p-6">{t('no_jobs_yet')}</p>

  return (
    <div className="max-w-3xl">
      <button onClick={onBack} className="text-sm text-gray-500 hover:text-gray-700 mb-4">
        {t('back_to_jobs')}
      </button>

      {/* Auth nudge banner */}
      <div className="mb-4 bg-blue-50 border border-blue-100 rounded-lg px-4 py-3 flex items-center justify-between gap-4">
        <p className="text-sm text-blue-700">{t('sign_in_to_track_nudge')}</p>
        <button
          onClick={onLogin}
          className="text-xs px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors shrink-0"
        >
          {t('sign_in')}
        </button>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold">{job.role || t('unknown_role')}</h2>
            {job.company && <p className="text-lg text-gray-600">{job.company}</p>}
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {(job.published_at || job.created_at) && (
                <span className="text-xs text-gray-400">
                  {new Date(job.published_at ?? job.created_at).toLocaleDateString(t('date_locale'), { year: 'numeric', month: 'short', day: 'numeric' })}
                </span>
              )}
              {job.source_name && (
                <span className="text-xs bg-orange-50 text-orange-600 border border-orange-100 px-2 py-0.5 rounded-full">
                  {job.source_name}
                </span>
              )}
            </div>
          </div>

          {/* Status badge — clicking prompts auth */}
          <button
            onClick={onLogin}
            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 hover:bg-blue-200 transition-colors"
            title={t('sign_in_to_change_status')}
          >
            {t('status_new')}
            <span className="opacity-50 text-[10px]">▾</span>
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm mb-4">
          {job.location && (
            <div>
              <span className="text-gray-400">{t('location')}</span>
              <p>{job.location}</p>
            </div>
          )}
          {job.remote_type && (
            <div>
              <span className="text-gray-400">{t('remote')}</span>
              <p className="capitalize">{job.remote_type}</p>
            </div>
          )}
          {job.salary && (
            <div>
              <span className="text-gray-400">{t('salary')}</span>
              <p className="font-medium">{job.salary}</p>
            </div>
          )}
          {job.employment_type && (
            <div>
              <span className="text-gray-400">{t('employment_type')}</span>
              <p className="capitalize">{job.employment_type.replace('_', ' ')}</p>
            </div>
          )}
          {job.residency && (
            <div>
              <span className="text-gray-400">{t('residency')}</span>
              <p>{job.residency}</p>
            </div>
          )}
          <div>
            <span className="text-gray-400">{t('source')}</span>
            <p>
              <a
                href={`https://news.ycombinator.com/item?id=${job.external_id.replace(/-\d+$/, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                {t('view_source')}
              </a>
            </p>
          </div>
        </div>

        {job.raw_text && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-sm text-gray-400 mb-2">{t('original_posting')}</p>
            <pre className="text-sm text-gray-700 bg-gray-50 p-3 rounded whitespace-pre-wrap font-sans leading-relaxed">{job.raw_text}</pre>
          </div>
        )}
      </div>

      {/* Locked timeline */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">{t('timeline')}</h3>
          <button
            onClick={onLogin}
            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
          >
            {t('add_entry')}
          </button>
        </div>
        <p className="text-sm text-gray-400">{t('sign_in_to_track_timeline')}</p>
      </div>
    </div>
  )
}
