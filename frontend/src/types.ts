export interface Job {
  id: number
  source_id: number
  external_id: string
  url: string | null
  role: string | null
  company: string | null
  location: string | null
  remote_type: string | null
  residency: string | null
  employment_type: string | null
  salary: string | null
  raw_text: string | null
  status: string
  source_name: string
  published_at: string | null
  created_at: string
  updated_at: string
}

export interface TimelineEntry {
  id: number
  job_id: number
  entry_type: 'status_change' | 'note' | 'interview' | 'prep' | 'feedback' | 'reminder'
  status_from: string | null
  status_to: string | null
  content: string | null
  created_at: string
}

export interface SyncRun {
  id: number
  source_id: number
  started_at: string
  completed_at: string | null
  status: string
  jobs_found: number
  jobs_new: number
}

export interface Stats {
  status_counts: Record<string, number>
  last_sync: SyncRun | null
}

export type JobStatus = 'new' | 'saved' | 'applied' | 'interviewing' | 'offer' | 'rejected' | 'withdrawn' | 'ghosted' | 'not_interested'

export interface CurrentUser {
  username: string
  role: 'admin' | 'user'
}

export interface User {
  id: number
  username: string
  role: 'admin' | 'user'
  created_at: string
}

export interface Source {
  id: number
  type: string
  name: string
  config: Record<string, unknown>
  enabled: boolean
  max_age_days: number | null
}
