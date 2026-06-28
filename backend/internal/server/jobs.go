package server

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"jobscout/internal/model"
)

func (s *Server) getUserID(username string) (int64, error) {
	var id int64
	err := s.db.QueryRow("SELECT id FROM users WHERE username = ?", username).Scan(&id)
	return id, err
}

func (s *Server) getPublicJob(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		jsonResponse(w, 400, map[string]string{"error": "invalid id"})
		return
	}

	var j model.Job
	err = s.db.QueryRow(`
		SELECT j.id, j.source_id, j.external_id, j.url, j.role, j.company, j.location,
		       j.remote_type, j.residency, j.employment_type, j.salary, j.raw_text,
		       'new' as status, j.published_at, j.created_at, j.updated_at
		FROM jobs j WHERE j.id = ?`, id,
	).Scan(&j.ID, &j.SourceID, &j.ExternalID, &j.URL, &j.Role, &j.Company, &j.Location, &j.RemoteType, &j.Residency, &j.EmploymentType, &j.Salary, &j.RawText, &j.Status, &j.PublishedAt, &j.CreatedAt, &j.UpdatedAt)

	if err == sql.ErrNoRows {
		jsonResponse(w, 404, map[string]string{"error": "not found"})
		return
	}
	if err != nil {
		jsonResponse(w, 500, map[string]string{"error": err.Error()})
		return
	}
	if src := sourceByID(j.SourceID); src != nil {
		j.SourceName = src.Name
	}
	jsonResponse(w, 200, j)
}

// listPublicJobs serves the unauthenticated public feed — no user context, status always 'new'.
func (s *Server) listPublicJobs(w http.ResponseWriter, r *http.Request) {
	rows, err := s.db.Query(`
		SELECT j.id, j.source_id, j.external_id, j.url, j.role, j.company, j.location,
		       j.remote_type, j.residency, j.employment_type, j.salary, j.raw_text,
		       'new' as status, j.published_at, j.created_at, j.updated_at
		FROM jobs j
		ORDER BY COALESCE(j.published_at, j.created_at) DESC`)
	if err != nil {
		jsonResponse(w, 500, map[string]string{"error": err.Error()})
		return
	}
	defer rows.Close()

	var jobs []model.Job
	for rows.Next() {
		var j model.Job
		if err := rows.Scan(&j.ID, &j.SourceID, &j.ExternalID, &j.URL, &j.Role, &j.Company, &j.Location, &j.RemoteType, &j.Residency, &j.EmploymentType, &j.Salary, &j.RawText, &j.Status, &j.PublishedAt, &j.CreatedAt, &j.UpdatedAt); err != nil {
			jsonResponse(w, 500, map[string]string{"error": err.Error()})
			return
		}
		if src := sourceByID(j.SourceID); src != nil {
			j.SourceName = src.Name
		}
		jobs = append(jobs, j)
	}
	if jobs == nil {
		jobs = []model.Job{}
	}
	jsonResponse(w, 200, jobs)
}

// listJobs returns all jobs with the current user's personal status (defaults to 'new').
func (s *Server) listJobs(w http.ResponseWriter, r *http.Request) {
	claims := claimsFromContext(r)
	userID, err := s.getUserID(claims.Sub)
	if err != nil {
		jsonResponse(w, 500, map[string]string{"error": "could not resolve user"})
		return
	}

	status := r.URL.Query().Get("status")
	sourceID := r.URL.Query().Get("source")

	query := `
		SELECT j.id, j.source_id, j.external_id, j.url, j.role, j.company, j.location,
		       j.remote_type, j.residency, j.employment_type, j.salary, j.raw_text,
		       COALESCE(uj.status, 'new') as status,
		       j.published_at, j.created_at, j.updated_at
		FROM jobs j
		LEFT JOIN user_jobs uj ON j.id = uj.job_id AND uj.user_id = ?
		LEFT JOIN user_source_settings uss ON j.source_id = uss.source_id AND uss.user_id = ?
		WHERE (
			uj.job_id IS NOT NULL
			OR (
				COALESCE(uss.enabled, 1) = 1
				AND (uss.max_age_days IS NULL OR COALESCE(j.published_at, j.created_at) >= DATE_SUB(NOW(), INTERVAL uss.max_age_days DAY))
			)
		)`
	args := []any{userID, userID}

	if status != "" {
		if status == "new" {
			// Uninteracted jobs (no user_jobs row) count as 'new'
			query += " AND (uj.status = 'new' OR uj.status IS NULL)"
		} else {
			query += " AND uj.status = ?"
			args = append(args, status)
		}
	}
	if sourceID != "" {
		if sid, err := strconv.ParseInt(sourceID, 10, 64); err == nil {
			query += " AND j.source_id = ?"
			args = append(args, sid)
		}
	}

	query += " ORDER BY COALESCE(j.published_at, j.created_at) DESC"

	rows, err := s.db.Query(query, args...)
	if err != nil {
		jsonResponse(w, 500, map[string]string{"error": err.Error()})
		return
	}
	defer rows.Close()

	var jobs []model.Job
	for rows.Next() {
		var j model.Job
		if err := rows.Scan(&j.ID, &j.SourceID, &j.ExternalID, &j.URL, &j.Role, &j.Company, &j.Location, &j.RemoteType, &j.Residency, &j.EmploymentType, &j.Salary, &j.RawText, &j.Status, &j.PublishedAt, &j.CreatedAt, &j.UpdatedAt); err != nil {
			jsonResponse(w, 500, map[string]string{"error": err.Error()})
			return
		}
		if src := sourceByID(j.SourceID); src != nil {
			j.SourceName = src.Name
		}
		jobs = append(jobs, j)
	}
	if jobs == nil {
		jobs = []model.Job{}
	}
	jsonResponse(w, 200, jobs)
}

func (s *Server) getJob(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		jsonResponse(w, 400, map[string]string{"error": "invalid id"})
		return
	}

	claims := claimsFromContext(r)
	userID, err := s.getUserID(claims.Sub)
	if err != nil {
		jsonResponse(w, 500, map[string]string{"error": "could not resolve user"})
		return
	}

	var j model.Job
	err = s.db.QueryRow(`
		SELECT j.id, j.source_id, j.external_id, j.url, j.role, j.company, j.location,
		       j.remote_type, j.residency, j.employment_type, j.salary, j.raw_text,
		       COALESCE(uj.status, 'new') as status,
		       j.published_at, j.created_at, j.updated_at
		FROM jobs j
		LEFT JOIN user_jobs uj ON j.id = uj.job_id AND uj.user_id = ?
		WHERE j.id = ?`,
		userID, id,
	).Scan(&j.ID, &j.SourceID, &j.ExternalID, &j.URL, &j.Role, &j.Company, &j.Location, &j.RemoteType, &j.Residency, &j.EmploymentType, &j.Salary, &j.RawText, &j.Status, &j.PublishedAt, &j.CreatedAt, &j.UpdatedAt)
	if err == nil {
		if src := sourceByID(j.SourceID); src != nil {
			j.SourceName = src.Name
		}
	}

	if err == sql.ErrNoRows {
		jsonResponse(w, 404, map[string]string{"error": "not found"})
		return
	}
	if err != nil {
		jsonResponse(w, 500, map[string]string{"error": err.Error()})
		return
	}

	// Only this user's timeline entries
	rows, err := s.db.Query(
		"SELECT id, job_id, entry_type, status_from, status_to, content, created_at FROM timeline_entries WHERE job_id = ? AND user_id = ? ORDER BY created_at DESC",
		id, userID,
	)
	if err != nil {
		jsonResponse(w, 500, map[string]string{"error": err.Error()})
		return
	}
	defer rows.Close()

	var timeline []model.TimelineEntry
	for rows.Next() {
		var te model.TimelineEntry
		if err := rows.Scan(&te.ID, &te.JobID, &te.EntryType, &te.StatusFrom, &te.StatusTo, &te.Content, &te.CreatedAt); err != nil {
			jsonResponse(w, 500, map[string]string{"error": err.Error()})
			return
		}
		timeline = append(timeline, te)
	}
	if timeline == nil {
		timeline = []model.TimelineEntry{}
	}

	jsonResponse(w, 200, map[string]any{"job": j, "timeline": timeline})
}

func (s *Server) changeStatus(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		jsonResponse(w, 400, map[string]string{"error": "invalid id"})
		return
	}

	var req model.StatusChangeRequest
	if err := decodeJSON(r, &req); err != nil {
		jsonResponse(w, 400, map[string]string{"error": "invalid body"})
		return
	}

	validStatuses := map[string]bool{
		"new": true, "saved": true, "applied": true, "interviewing": true, "offer": true,
		"rejected": true, "withdrawn": true, "ghosted": true, "not_interested": true,
	}
	if !validStatuses[req.Status] {
		jsonResponse(w, 400, map[string]string{"error": "invalid status"})
		return
	}

	claims := claimsFromContext(r)
	userID, err := s.getUserID(claims.Sub)
	if err != nil {
		jsonResponse(w, 500, map[string]string{"error": "could not resolve user"})
		return
	}

	// Verify job exists
	var exists bool
	if err := s.db.QueryRow("SELECT EXISTS(SELECT 1 FROM jobs WHERE id = ?)", id).Scan(&exists); err != nil || !exists {
		jsonResponse(w, 404, map[string]string{"error": "not found"})
		return
	}

	// Get current user-specific status (default 'new')
	var currentStatus string
	err = s.db.QueryRow("SELECT status FROM user_jobs WHERE job_id = ? AND user_id = ?", id, userID).Scan(&currentStatus)
	if err == sql.ErrNoRows {
		currentStatus = "new"
	} else if err != nil {
		jsonResponse(w, 500, map[string]string{"error": err.Error()})
		return
	}

	tx, err := s.db.Begin()
	if err != nil {
		jsonResponse(w, 500, map[string]string{"error": err.Error()})
		return
	}
	defer tx.Rollback()

	if _, err := tx.Exec(
		"INSERT INTO user_jobs (user_id, job_id, status) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE status = VALUES(status)",
		userID, id, req.Status,
	); err != nil {
		jsonResponse(w, 500, map[string]string{"error": err.Error()})
		return
	}

	if _, err := tx.Exec(
		"INSERT INTO timeline_entries (job_id, user_id, entry_type, status_from, status_to, content) VALUES (?, ?, 'status_change', ?, ?, ?)",
		id, userID, currentStatus, req.Status, req.Notes,
	); err != nil {
		jsonResponse(w, 500, map[string]string{"error": err.Error()})
		return
	}

	if err := tx.Commit(); err != nil {
		jsonResponse(w, 500, map[string]string{"error": err.Error()})
		return
	}

	jsonResponse(w, 200, map[string]string{"status": "ok"})
}

func (s *Server) addTimelineEntry(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		jsonResponse(w, 400, map[string]string{"error": "invalid id"})
		return
	}

	var req model.TimelineRequest
	if err := decodeJSON(r, &req); err != nil {
		jsonResponse(w, 400, map[string]string{"error": "invalid body"})
		return
	}

	validTypes := map[string]bool{"status_change": true, "interview": true, "prep": true, "feedback": true, "reminder": true}
	if !validTypes[req.EntryType] {
		jsonResponse(w, 400, map[string]string{"error": "invalid entry_type"})
		return
	}

	claims := claimsFromContext(r)
	userID, err := s.getUserID(claims.Sub)
	if err != nil {
		jsonResponse(w, 500, map[string]string{"error": "could not resolve user"})
		return
	}

	// Ensure a user_jobs row exists so the user "owns" this ticket
	if _, err := s.db.Exec(
		"INSERT IGNORE INTO user_jobs (user_id, job_id, status) VALUES (?, ?, 'new')",
		userID, id,
	); err != nil {
		jsonResponse(w, 500, map[string]string{"error": err.Error()})
		return
	}

	result, err := s.db.Exec(
		"INSERT INTO timeline_entries (job_id, user_id, entry_type, content) VALUES (?, ?, ?, ?)",
		id, userID, req.EntryType, req.Content,
	)
	if err != nil {
		jsonResponse(w, 500, map[string]string{"error": err.Error()})
		return
	}

	newID, _ := result.LastInsertId()
	jsonResponse(w, 201, map[string]int64{"id": newID})
}

func (s *Server) getStats(w http.ResponseWriter, r *http.Request) {
	claims := claimsFromContext(r)
	userID, err := s.getUserID(claims.Sub)
	if err != nil {
		jsonResponse(w, 500, map[string]string{"error": "could not resolve user"})
		return
	}

	// Count jobs visible to this user (respects source enabled/age settings)
	rows, err := s.db.Query(`
		SELECT COALESCE(uj.status, 'new') as status, COUNT(*) as count
		FROM jobs j
		LEFT JOIN user_jobs uj ON j.id = uj.job_id AND uj.user_id = ?
		LEFT JOIN user_source_settings uss ON j.source_id = uss.source_id AND uss.user_id = ?
		WHERE (
			uj.job_id IS NOT NULL
			OR (
				COALESCE(uss.enabled, 1) = 1
				AND (uss.max_age_days IS NULL OR COALESCE(j.published_at, j.created_at) >= DATE_SUB(NOW(), INTERVAL uss.max_age_days DAY))
			)
		)
		GROUP BY COALESCE(uj.status, 'new')`,
		userID, userID,
	)
	if err != nil {
		jsonResponse(w, 500, map[string]string{"error": err.Error()})
		return
	}
	defer rows.Close()

	counts := make(map[string]int)
	var total int
	for rows.Next() {
		var status string
		var count int
		if err := rows.Scan(&status, &count); err != nil {
			jsonResponse(w, 500, map[string]string{"error": err.Error()})
			return
		}
		counts[status] = count
		total += count
	}
	counts["total"] = total

	var lastSync model.SyncRun
	err = s.db.QueryRow(
		"SELECT id, source_id, started_at, completed_at, status, jobs_found, jobs_new FROM sync_runs ORDER BY started_at DESC LIMIT 1",
	).Scan(&lastSync.ID, &lastSync.SourceID, &lastSync.StartedAt, &lastSync.CompletedAt, &lastSync.Status, &lastSync.JobsFound, &lastSync.JobsNew)

	stats := model.Stats{StatusCounts: counts}
	if err == nil {
		stats.LastSync = &lastSync
	}

	jsonResponse(w, 200, stats)
}

func decodeJSON(r *http.Request, v any) error {
	if r.Body == nil {
		return fmt.Errorf("empty body")
	}
	defer r.Body.Close()
	return json.NewDecoder(r.Body).Decode(v)
}
