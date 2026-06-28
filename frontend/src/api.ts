import type { Job, TimelineEntry, Stats, JobStatus, Source, CurrentUser, User } from './types'

const BASE = `${import.meta.env.BASE_URL.replace(/\/$/, '')}/api`

// --- Token + user storage ---

let accessToken: string | null = null
let currentUser: CurrentUser | null = null

function getRefreshToken(): string | null {
  return localStorage.getItem('refresh_token')
}

export function setSession(access: string, user: CurrentUser, refresh?: string) {
  accessToken = access
  currentUser = user
  if (refresh) localStorage.setItem('refresh_token', refresh)
}

export function clearTokens() {
  accessToken = null
  currentUser = null
  localStorage.removeItem('refresh_token')
}

export function getCurrentUser(): CurrentUser | null {
  return currentUser
}

// --- Auth API ---

export async function login(username: string, password: string): Promise<CurrentUser> {
  const res = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Login failed')
  }
  const data = await res.json()
  const user: CurrentUser = { username: data.username, role: data.role }
  setSession(data.access_token, user, data.refresh_token)
  return user
}

export async function signup(username: string, password: string): Promise<CurrentUser> {
  const res = await fetch(`${BASE}/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Signup failed')
  }
  const data = await res.json()
  const user: CurrentUser = { username: data.username, role: data.role }
  setSession(data.access_token, user, data.refresh_token)
  return user
}

async function doRefresh(): Promise<CurrentUser | null> {
  const rt = getRefreshToken()
  if (!rt) return null
  const res = await fetch(`${BASE}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: rt }),
  })
  if (!res.ok) {
    clearTokens()
    return null
  }
  const data = await res.json()
  const user: CurrentUser = { username: data.username, role: data.role }
  setSession(data.access_token, user)
  return user
}

export async function restoreSession(): Promise<CurrentUser | null> {
  if (accessToken && currentUser) return currentUser
  return doRefresh()
}

// --- Generic fetch with auto-refresh ---

async function fetchJSON<T>(url: string, init?: RequestInit): Promise<T> {
  const doRequest = async () => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`
    return fetch(`${BASE}${url}`, { ...init, headers: { ...headers, ...(init?.headers ?? {}) } })
  }

  let res = await doRequest()

  if (res.status === 401) {
    const user = await doRefresh()
    if (!user) {
      window.dispatchEvent(new Event('auth:logout'))
      throw new Error('Session expired')
    }
    res = await doRequest()
  }

  if (!res.ok) {
    const err = await res.text()
    throw new Error(err || res.statusText)
  }
  return res.json()
}

// --- Jobs API ---

export function listJobs(params?: { status?: string; source?: string }): Promise<Job[]> {
  const qs = new URLSearchParams()
  if (params?.status) qs.set('status', params.status)
  if (params?.source) qs.set('source', params.source)
  return fetchJSON(`/jobs?${qs}`)
}

export async function listPublicJobs(): Promise<Job[]> {
  const res = await fetch(`${BASE}/public/jobs`)
  if (!res.ok) throw new Error('Failed to load jobs')
  return res.json()
}

export async function getPublicJob(id: number): Promise<Job> {
  const res = await fetch(`${BASE}/public/jobs/${id}`)
  if (!res.ok) throw new Error('Failed to load job')
  return res.json()
}

export function getJob(id: number): Promise<{ job: Job; timeline: TimelineEntry[] }> {
  return fetchJSON(`/jobs/${id}`)
}

export function changeStatus(id: number, status: string, notes?: string): Promise<void> {
  return fetchJSON(`/jobs/${id}/status`, {
    method: 'POST',
    body: JSON.stringify({ status, notes }),
  })
}

export function addTimelineEntry(id: number, entry: {
  entry_type: string
  title?: string
  content?: string
}): Promise<{ id: number }> {
  return fetchJSON(`/jobs/${id}/timeline`, {
    method: 'POST',
    body: JSON.stringify(entry),
  })
}

export function getStats(): Promise<Stats> {
  return fetchJSON('/stats')
}

export function listSources(): Promise<Source[]> {
  return fetchJSON('/sources')
}

export function updateUserSourceSettings(
  sourceId: number,
  settings: { enabled: boolean; max_age_days: number | null }
): Promise<void> {
  return fetchJSON(`/sources/${sourceId}/settings`, {
    method: 'PUT',
    body: JSON.stringify(settings),
  })
}

export function updateProfile(username: string): Promise<{ access_token: string; refresh_token: string; username: string; role: string }> {
  return fetchJSON('/user/profile', { method: 'PUT', body: JSON.stringify({ username }) })
}

export function updatePassword(currentPassword: string, newPassword: string): Promise<void> {
  return fetchJSON('/user/password', { method: 'PUT', body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }) })
}

// --- Admin API ---

export function listUsers(): Promise<User[]> {
  return fetchJSON('/admin/users')
}

export function updateUserRole(id: number, role: 'admin' | 'user'): Promise<void> {
  return fetchJSON(`/admin/users/${id}/role`, {
    method: 'PUT',
    body: JSON.stringify({ role }),
  })
}

export function adminListSources(): Promise<{ id: number; name: string; type: string }[]> {
  return fetchJSON('/admin/sources')
}

export function adminLastSyncs(): Promise<{
  source_id: number
  last_run?: {
    id: number
    source_id: number
    started_at: string
    completed_at?: string
    status: string
    jobs_found: number
    jobs_new: number
  }
}[]> {
  return fetchJSON('/admin/syncs')
}

export function adminUpdateSourceSettings(sourceId: number, syncBatchSize: number | null): Promise<void> {
  return fetchJSON(`/admin/sources/${sourceId}/settings`, {
    method: 'PUT',
    body: JSON.stringify({ sync_batch_size: syncBatchSize }),
  })
}

export function adminListSourceRequests(): Promise<{
  id: number; url: string; note?: string; created_at: string; username?: string
}[]> {
  return fetchJSON('/admin/source-requests')
}

export function submitSourceRequest(url: string, note: string): Promise<void> {
  return fetchJSON('/source-requests', { method: 'POST', body: JSON.stringify({ url, note }) })
}

export function triggerSync(sourceId: number): Promise<{ sync_run_id: number; status: string }> {
  return fetchJSON(`/admin/sync/${sourceId}`, { method: 'POST' })
}

// --- Constants ---

export const STATUS_LABELS: Record<JobStatus, string> = {
  new: 'New',
  saved: 'Saved',
  applied: 'Applied',
  interviewing: 'Interviewing',
  offer: 'Offer',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
  ghosted: 'Ghosted',
  not_interested: 'Not Interested',
}
