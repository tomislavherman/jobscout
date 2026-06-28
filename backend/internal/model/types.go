package model

import "time"

type Job struct {
	ID             int64      `json:"id"`
	SourceID       int64      `json:"source_id"`
	ExternalID     string     `json:"external_id"`
	URL            *string    `json:"url,omitempty"`
	Role           *string    `json:"role,omitempty"`
	Company        *string    `json:"company,omitempty"`
	Location       *string    `json:"location,omitempty"`
	RemoteType     *string    `json:"remote_type,omitempty"`
	Residency      *string    `json:"residency,omitempty"`
	EmploymentType *string    `json:"employment_type,omitempty"`
	Salary         *string    `json:"salary,omitempty"`
	RawText        *string    `json:"raw_text,omitempty"`
	Status         string     `json:"status"`
	SourceName     string     `json:"source_name"`
	PublishedAt    *time.Time `json:"published_at,omitempty"`
	CreatedAt      time.Time  `json:"created_at"`
	UpdatedAt      time.Time  `json:"updated_at"`
}

type TimelineEntry struct {
	ID         int64     `json:"id"`
	JobID      int64     `json:"job_id"`
	EntryType  string    `json:"entry_type"`
	StatusFrom *string   `json:"status_from,omitempty"`
	StatusTo   *string   `json:"status_to,omitempty"`
	Title      *string   `json:"title,omitempty"`
	Content    *string   `json:"content,omitempty"`
	CreatedAt  time.Time `json:"created_at"`
}

type SyncRun struct {
	ID          int64      `json:"id"`
	SourceID    int64      `json:"source_id"`
	StartedAt   time.Time  `json:"started_at"`
	CompletedAt *time.Time `json:"completed_at,omitempty"`
	Status      string     `json:"status"`
	JobsFound   int        `json:"jobs_found"`
	JobsNew     int        `json:"jobs_new"`
}

type Stats struct {
	StatusCounts map[string]int `json:"status_counts"`
	LastSync     *SyncRun       `json:"last_sync,omitempty"`
}

type User struct {
	ID        int64     `json:"id"`
	Username  string    `json:"username"`
	Role      string    `json:"role"`
	CreatedAt time.Time `json:"created_at"`
}

type StatusChangeRequest struct {
	Status string  `json:"status"`
	Notes  *string `json:"notes,omitempty"`
}

type TimelineRequest struct {
	EntryType string  `json:"entry_type"`
	Title     *string `json:"title,omitempty"`
	Content   *string `json:"content,omitempty"`
}
