package server

import (
	"database/sql"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"jobscout/internal/model"
)

func (s *Server) triggerSync(w http.ResponseWriter, r *http.Request) {
	sourceID, err := strconv.ParseInt(chi.URLParam(r, "sourceId"), 10, 64)
	if err != nil {
		jsonResponse(w, 400, map[string]string{"error": "invalid sourceId"})
		return
	}

	result, err := s.db.Exec(
		"INSERT INTO sync_runs (source_id, status) VALUES (?, 'running')",
		sourceID,
	)
	if err != nil {
		jsonResponse(w, 500, map[string]string{"error": err.Error()})
		return
	}

	runID, _ := result.LastInsertId()
	go RunSync(s.db, s.llm, sourceID, runID)

	jsonResponse(w, 202, map[string]any{"sync_run_id": runID, "status": "started"})
}

func (s *Server) adminLastSyncs(w http.ResponseWriter, _ *http.Request) {
	type syncRun struct {
		ID          int64   `json:"id"`
		SourceID    int64   `json:"source_id"`
		StartedAt   string  `json:"started_at"`
		CompletedAt *string `json:"completed_at,omitempty"`
		Status      string  `json:"status"`
		JobsFound   int     `json:"jobs_found"`
		JobsNew     int     `json:"jobs_new"`
	}

	result := make([]map[string]any, 0, len(Sources))
	for _, src := range Sources {
		entry := map[string]any{"source_id": src.ID}
		var run syncRun
		err := s.db.QueryRow(`
			SELECT id, source_id, started_at, completed_at, status, jobs_found, jobs_new
			FROM sync_runs WHERE source_id = ? ORDER BY started_at DESC LIMIT 1`,
			src.ID,
		).Scan(&run.ID, &run.SourceID, &run.StartedAt, &run.CompletedAt, &run.Status, &run.JobsFound, &run.JobsNew)
		if err == nil {
			entry["last_run"] = run
		}
		result = append(result, entry)
	}
	jsonResponse(w, 200, result)
}

func (s *Server) adminListSources(w http.ResponseWriter, _ *http.Request) {
	result := make([]map[string]any, len(Sources))
	for i, src := range Sources {
		var batchSize *int
		s.db.QueryRow("SELECT sync_batch_size FROM source_settings WHERE source_id = ?", src.ID).Scan(&batchSize)
		result[i] = map[string]any{"id": src.ID, "name": src.Name, "sync_batch_size": batchSize}
	}
	jsonResponse(w, 200, result)
}

func (s *Server) adminUpdateSourceSettings(w http.ResponseWriter, r *http.Request) {
	sourceID, err := strconv.ParseInt(chi.URLParam(r, "sourceId"), 10, 64)
	if err != nil {
		jsonResponse(w, 400, map[string]string{"error": "invalid sourceId"})
		return
	}
	if sourceByID(sourceID) == nil {
		jsonResponse(w, 404, map[string]string{"error": "source not found"})
		return
	}
	var req struct {
		SyncBatchSize *int `json:"sync_batch_size"`
	}
	if err := decodeJSON(r, &req); err != nil {
		jsonResponse(w, 400, map[string]string{"error": "invalid body"})
		return
	}
	_, err = s.db.Exec(`
		INSERT INTO source_settings (source_id, sync_batch_size) VALUES (?, ?)
		ON DUPLICATE KEY UPDATE sync_batch_size = VALUES(sync_batch_size)`,
		sourceID, req.SyncBatchSize,
	)
	if err != nil {
		jsonResponse(w, 500, map[string]string{"error": err.Error()})
		return
	}
	jsonResponse(w, 200, map[string]string{"status": "ok"})
}

func (s *Server) adminListSourceRequests(w http.ResponseWriter, _ *http.Request) {
	rows, err := s.db.Query(`
		SELECT sr.id, sr.url, sr.note, sr.created_at, u.username
		FROM source_requests sr
		LEFT JOIN users u ON sr.user_id = u.id
		ORDER BY sr.created_at DESC`)
	if err != nil {
		jsonResponse(w, 500, map[string]string{"error": err.Error()})
		return
	}
	defer rows.Close()

	type row struct {
		ID        int64   `json:"id"`
		URL       string  `json:"url"`
		Note      *string `json:"note,omitempty"`
		CreatedAt string  `json:"created_at"`
		Username  *string `json:"username,omitempty"`
	}
	var result []row
	for rows.Next() {
		var r row
		var note, username *string
		if err := rows.Scan(&r.ID, &r.URL, &note, &r.CreatedAt, &username); err != nil {
			jsonResponse(w, 500, map[string]string{"error": err.Error()})
			return
		}
		if note != nil && *note != "" { r.Note = note }
		r.Username = username
		result = append(result, r)
	}
	if result == nil {
		result = []row{}
	}
	jsonResponse(w, 200, result)
}

func (s *Server) listUsers(w http.ResponseWriter, r *http.Request) {
	rows, err := s.db.Query("SELECT id, username, role, created_at FROM users ORDER BY created_at ASC")
	if err != nil {
		jsonResponse(w, 500, map[string]string{"error": err.Error()})
		return
	}
	defer rows.Close()

	var users []model.User
	for rows.Next() {
		var u model.User
		if err := rows.Scan(&u.ID, &u.Username, &u.Role, &u.CreatedAt); err != nil {
			jsonResponse(w, 500, map[string]string{"error": err.Error()})
			return
		}
		users = append(users, u)
	}
	if users == nil {
		users = []model.User{}
	}
	jsonResponse(w, 200, users)
}

func (s *Server) updateUserRole(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		jsonResponse(w, 400, map[string]string{"error": "invalid id"})
		return
	}

	var req struct {
		Role string `json:"role"`
	}
	if err := decodeJSON(r, &req); err != nil {
		jsonResponse(w, 400, map[string]string{"error": "invalid body"})
		return
	}
	if req.Role != "admin" && req.Role != "user" {
		jsonResponse(w, 400, map[string]string{"error": "role must be admin or user"})
		return
	}

	var targetUsername string
	err = s.db.QueryRow("SELECT username FROM users WHERE id = ?", id).Scan(&targetUsername)
	if err == sql.ErrNoRows {
		jsonResponse(w, 404, map[string]string{"error": "user not found"})
		return
	}
	if err != nil {
		jsonResponse(w, 500, map[string]string{"error": err.Error()})
		return
	}

	claims := claimsFromContext(r)
	if claims != nil && claims.Sub == targetUsername && req.Role != "admin" {
		jsonResponse(w, 400, map[string]string{"error": "cannot remove admin role from yourself"})
		return
	}

	if _, err := s.db.Exec("UPDATE users SET role = ? WHERE id = ?", req.Role, id); err != nil {
		jsonResponse(w, 500, map[string]string{"error": err.Error()})
		return
	}

	jsonResponse(w, 200, map[string]string{"status": "ok"})
}
