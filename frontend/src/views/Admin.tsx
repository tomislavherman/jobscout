import { useEffect, useRef, useState } from 'react'
import type { User, CurrentUser } from '../types'
import { listUsers, updateUserRole, adminListSources, triggerSync, adminLastSyncs, adminListSourceRequests, adminUpdateSourceSettings } from '../api'

const BATCH_OPTIONS = [
  { label: '10', value: 10 },
  { label: '25', value: 25 },
  { label: '50', value: 50 },
  { label: '100', value: 100 },
  { label: '200', value: 200 },
  { label: 'Unlimited', value: 0 },
]

function BatchSizeDropdown({ value, onChange }: { value: number | null | undefined; onChange: (v: number) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  // null/undefined = not set = default 10
  const current = BATCH_OPTIONS.find(o => o.value === (value ?? 10)) ?? BATCH_OPTIONS[0]

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700"
      >
        {current.label}
        <span className="opacity-50 text-[10px]">▾</span>
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 py-1 min-w-[120px]">
          {BATCH_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => { setOpen(false); onChange(opt.value) }}
              className="flex items-center justify-between w-full px-3 py-1.5 hover:bg-gray-50"
            >
              <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                {opt.label}
              </span>
              {opt.value === current.value && <span className="text-gray-400 text-xs ml-2">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

type LastRun = {
  id: number
  source_id: number
  started_at: string
  completed_at?: string
  status: string
  jobs_found: number
  jobs_new: number
}

export default function Admin({ currentUser }: { currentUser: CurrentUser }) {
  const [users, setUsers] = useState<User[]>([])
  const [usersLoading, setUsersLoading] = useState(true)
  const [usersError, setUsersError] = useState<string | null>(null)

  const [sources, setSources] = useState<{ id: number; name: string; sync_batch_size?: number | null }[]>([])
  const [syncing, setSyncing] = useState<number | null>(null)
  const [lastRuns, setLastRuns] = useState<Record<number, LastRun>>({})

  type SourceRequest = { id: number; url: string; note?: string; created_at: string; username?: string }
  const [sourceRequests, setSourceRequests] = useState<SourceRequest[]>([])

  const fetchUsers = async () => {
    try {
      setUsersError(null)
      setUsers(await listUsers())
    } catch (err) {
      setUsersError(err instanceof Error ? err.message : 'Failed to load users')
    } finally {
      setUsersLoading(false)
    }
  }

  const fetchSources = async () => {
    try {
      setSources(await adminListSources())
    } catch (err) {
      console.error('Failed to load sources:', err)
    }
  }

  const fetchLastSyncs = async () => {
    try {
      const data = await adminLastSyncs()
      const map: Record<number, LastRun> = {}
      for (const entry of data) {
        if (entry.last_run) map[entry.source_id] = entry.last_run
      }
      setLastRuns(map)
    } catch (err) {
      console.error('Failed to load sync info:', err)
    }
  }

  useEffect(() => {
    fetchUsers()
    fetchSources()
    fetchLastSyncs()
    adminListSourceRequests().then(setSourceRequests).catch(console.error)
  }, [])

  const handleRoleChange = async (user: User, newRole: 'admin' | 'user') => {
    try {
      await updateUserRole(user.id, newRole)
      await fetchUsers()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update role')
    }
  }

  const handleSync = async (sourceId: number) => {
    setSyncing(sourceId)
    try {
      await triggerSync(sourceId)
      // Poll until the run is no longer in 'running' state
      while (true) {
        const data = await adminLastSyncs()
        const map: Record<number, LastRun> = {}
        for (const e of data) {
          if (e.last_run) map[e.source_id] = e.last_run
        }
        setLastRuns(map)
        const entry = data.find(e => e.source_id === sourceId)
        if (!entry?.last_run || entry.last_run.status !== 'running') break
        await new Promise(r => setTimeout(r, 2000))
      }
    } catch (err) {
      console.error('Sync failed:', err)
    } finally {
      setSyncing(null)
    }
  }

  return (
    <div className="space-y-10">

      {/* Users */}
      <section>
        <h2 className="text-xl font-semibold mb-4">User Management</h2>
        {usersLoading ? (
          <p className="text-gray-500">Loading users...</p>
        ) : usersError ? (
          <p className="text-red-500">{usersError}</p>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Username</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Role</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Joined</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {users.map((u) => {
                  const isSelf = u.username === currentUser.username
                  return (
                    <tr key={u.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">
                        {u.username}
                        {isSelf && <span className="ml-2 text-xs text-gray-400">(you)</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                          u.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'
                        }`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {new Date(u.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {u.role === 'user' ? (
                          <button
                            onClick={() => handleRoleChange(u, 'admin')}
                            className="text-xs px-3 py-1 rounded border border-gray-200 hover:bg-gray-50 text-gray-600"
                          >
                            Make admin
                          </button>
                        ) : (
                          <button
                            onClick={() => handleRoleChange(u, 'user')}
                            disabled={isSelf}
                            className="text-xs px-3 py-1 rounded border border-gray-200 hover:bg-gray-50 text-gray-600 disabled:opacity-40 disabled:cursor-not-allowed"
                            title={isSelf ? 'Cannot remove your own admin role' : undefined}
                          >
                            Remove admin
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Sync */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Source Sync</h2>
        {sources.length === 0 ? (
          <p className="text-gray-400 text-sm">No sources configured.</p>
        ) : (
          <div className="space-y-3">
            {sources.map((src) => {
              const run = lastRuns[src.id]
              return (
                <div key={src.id} className="bg-white rounded-lg border border-gray-200 p-4">
                  <div className="flex items-center justify-between gap-4">
                    <span className="font-medium text-sm">{src.name}</span>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500 whitespace-nowrap">Batch size</span>
                        <BatchSizeDropdown
                          value={src.sync_batch_size}
                          onChange={async (val) => {
                            await adminUpdateSourceSettings(src.id, val)
                            setSources(prev => prev.map(s => s.id === src.id ? { ...s, sync_batch_size: val } : s))
                          }}
                        />
                      </div>
                      <button
                        onClick={() => handleSync(src.id)}
                        disabled={syncing === src.id}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-60 transition-colors"
                      >
                        <svg
                          className={`w-3.5 h-3.5 ${syncing === src.id ? 'animate-spin' : ''}`}
                          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                        >
                          <path d="M21 12a9 9 0 1 1-6.219-8.56" strokeLinecap="round"/>
                        </svg>
                        Sync
                      </button>
                    </div>
                  </div>

                  {run ? (
                    <div className="mt-3 pt-3 border-t border-gray-100 flex flex-wrap gap-x-6 gap-y-1 text-xs text-gray-500">
                      <span>Started: {new Date(run.started_at).toLocaleString()}</span>
                      {run.completed_at && (
                        <span>Completed: {new Date(run.completed_at).toLocaleString()}</span>
                      )}
                      <span>
                        Status:{' '}
                        <span className={`font-medium capitalize ${
                          run.status === 'success' ? 'text-green-600' :
                          run.status === 'failed' ? 'text-red-600' : 'text-yellow-600'
                        }`}>{run.status}</span>
                      </span>
                      <span>{run.jobs_found} found, {run.jobs_new} new</span>
                    </div>
                  ) : (
                    <p className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-400">Never synced</p>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* Source Requests */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Source Suggestions</h2>
        {sourceRequests.length === 0 ? (
          <p className="text-gray-400 text-sm">No suggestions yet.</p>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">URL</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Note</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Submitted by</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sourceRequests.map((req) => (
                  <tr key={req.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <a href={req.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline truncate max-w-[180px] block">
                        {req.url}
                      </a>
                    </td>
                    <td className="px-4 py-3 text-gray-600 max-w-xs">
                      {req.note ?? <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {req.username ?? <span className="text-gray-400">anonymous</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                      {new Date(req.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

    </div>
  )
}
