package admin

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"jobscout/internal/auth"
	"jobscout/internal/jobs"
	"jobscout/internal/llm"
	"jobscout/internal/sources"
)

type Handler struct {
	db  *sql.DB
	llm *llm.Client
}

func NewHandler(db *sql.DB, llmClient *llm.Client) *Handler {
	return &Handler{db: db, llm: llmClient}
}

func (h *Handler) TriggerSync(w http.ResponseWriter, r *http.Request) {
	sourceID, err := strconv.ParseInt(chi.URLParam(r, "sourceId"), 10, 64)
	if err != nil {
		jsonResponse(w, 400, map[string]string{"error": "invalid sourceId"})
		return
	}

	result, err := h.db.Exec(
		"INSERT INTO sync_runs (source_id, status) VALUES (?, 'running')",
		sourceID,
	)
	if err != nil {
		jsonResponse(w, 500, map[string]string{"error": err.Error()})
		return
	}

	runID, _ := result.LastInsertId()
	go jobs.RunSync(h.db, h.llm, sourceID, runID)

	jsonResponse(w, 202, map[string]any{"sync_run_id": runID, "status": "started"})
}

func (h *Handler) AdminLastSyncs(w http.ResponseWriter, _ *http.Request) {
	type syncRun struct {
		ID          int64   `json:"id"`
		SourceID    int64   `json:"source_id"`
		StartedAt   string  `json:"started_at"`
		CompletedAt *string `json:"completed_at,omitempty"`
		Status      string  `json:"status"`
		JobsFound   int     `json:"jobs_found"`
		JobsNew     int     `json:"jobs_new"`
	}

	result := make([]map[string]any, 0, len(sources.Sources))
	for _, src := range sources.Sources {
		entry := map[string]any{"source_id": src.ID}
		var run syncRun
		err := h.db.QueryRow(`
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

func (h *Handler) AdminListSources(w http.ResponseWriter, _ *http.Request) {
	result := make([]map[string]any, len(sources.Sources))
	for i, src := range sources.Sources {
		var batchSize *int
		h.db.QueryRow("SELECT sync_batch_size FROM source_settings WHERE source_id = ?", src.ID).Scan(&batchSize)
		result[i] = map[string]any{"id": src.ID, "name": src.Name, "sync_batch_size": batchSize}
	}
	jsonResponse(w, 200, result)
}

func (h *Handler) AdminUpdateSourceSettings(w http.ResponseWriter, r *http.Request) {
	sourceID, err := strconv.ParseInt(chi.URLParam(r, "sourceId"), 10, 64)
	if err != nil {
		jsonResponse(w, 400, map[string]string{"error": "invalid sourceId"})
		return
	}
	if sources.SourceByID(sourceID) == nil {
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
	_, err = h.db.Exec(`
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

func (h *Handler) AdminListSourceRequests(w http.ResponseWriter, _ *http.Request) {
	rows, err := h.db.Query(`
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
		var rec row
		var note, username *string
		if err := rows.Scan(&rec.ID, &rec.URL, &note, &rec.CreatedAt, &username); err != nil {
			jsonResponse(w, 500, map[string]string{"error": err.Error()})
			return
		}
		if note != nil && *note != "" {
			rec.Note = note
		}
		rec.Username = username
		result = append(result, rec)
	}
	if result == nil {
		result = []row{}
	}
	jsonResponse(w, 200, result)
}

func (h *Handler) ListUsers(w http.ResponseWriter, _ *http.Request) {
	rows, err := h.db.Query("SELECT id, username, role, created_at FROM users ORDER BY created_at ASC")
	if err != nil {
		jsonResponse(w, 500, map[string]string{"error": err.Error()})
		return
	}
	defer rows.Close()

	var users []auth.User
	for rows.Next() {
		var u auth.User
		if err := rows.Scan(&u.ID, &u.Username, &u.Role, &u.CreatedAt); err != nil {
			jsonResponse(w, 500, map[string]string{"error": err.Error()})
			return
		}
		users = append(users, u)
	}
	if users == nil {
		users = []auth.User{}
	}
	jsonResponse(w, 200, users)
}

func (h *Handler) UpdateUserRole(w http.ResponseWriter, r *http.Request) {
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
	err = h.db.QueryRow("SELECT username FROM users WHERE id = ?", id).Scan(&targetUsername)
	if err == sql.ErrNoRows {
		jsonResponse(w, 404, map[string]string{"error": "user not found"})
		return
	}
	if err != nil {
		jsonResponse(w, 500, map[string]string{"error": err.Error()})
		return
	}

	claims := auth.ClaimsFromContext(r)
	if claims != nil && claims.Sub == targetUsername && req.Role != "admin" {
		jsonResponse(w, 400, map[string]string{"error": "cannot remove admin role from yourself"})
		return
	}

	if _, err := h.db.Exec("UPDATE users SET role = ? WHERE id = ?", req.Role, id); err != nil {
		jsonResponse(w, 500, map[string]string{"error": err.Error()})
		return
	}

	jsonResponse(w, 200, map[string]string{"status": "ok"})
}

func jsonResponse(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}

func decodeJSON(r *http.Request, v any) error {
	if r.Body == nil {
		return fmt.Errorf("empty body")
	}
	defer r.Body.Close()
	return json.NewDecoder(r.Body).Decode(v)
}
