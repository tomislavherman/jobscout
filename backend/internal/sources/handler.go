package sources

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"
	"jobscout/internal/auth"
)

type Handler struct {
	db *sql.DB
}

func NewHandler(db *sql.DB) *Handler {
	return &Handler{db: db}
}

func (h *Handler) ListSources(w http.ResponseWriter, r *http.Request) {
	claims := auth.ClaimsFromContext(r)
	userID, err := auth.GetUserID(h.db, claims.Sub)
	if err != nil {
		jsonResponse(w, 500, map[string]string{"error": "could not resolve user"})
		return
	}

	result := make([]map[string]any, 0, len(Sources))
	for _, src := range Sources {
		var enabledInt int8 = 1
		var maxAgeDays *int
		if err := h.db.QueryRow(
			"SELECT enabled, max_age_days FROM user_source_settings WHERE user_id = ? AND source_id = ?",
			userID, src.ID,
		).Scan(&enabledInt, &maxAgeDays); err != nil {
			n := 30
			maxAgeDays = &n
		}

		result = append(result, map[string]any{
			"id":           src.ID,
			"type":         src.Type,
			"name":         src.Name,
			"config":       map[string]any{"feed_type": src.FeedType},
			"enabled":      enabledInt != 0,
			"max_age_days": maxAgeDays,
		})
	}

	jsonResponse(w, 200, result)
}

func (h *Handler) SubmitSourceRequest(w http.ResponseWriter, r *http.Request) {
	var req struct {
		URL  string `json:"url"`
		Note string `json:"note"`
	}
	if err := decodeJSON(r, &req); err != nil {
		jsonResponse(w, 400, map[string]string{"error": "invalid body"})
		return
	}
	if strings.TrimSpace(req.URL) == "" {
		jsonResponse(w, 400, map[string]string{"error": "url is required"})
		return
	}

	var userID *int64
	if claims := auth.ClaimsFromContext(r); claims != nil && claims.Sub != "" {
		if id, err := auth.GetUserID(h.db, claims.Sub); err == nil {
			userID = &id
		}
	}

	_, err := h.db.Exec(
		"INSERT INTO source_requests (user_id, url, note) VALUES (?, ?, ?)",
		userID, strings.TrimSpace(req.URL), strings.TrimSpace(req.Note),
	)
	if err != nil {
		jsonResponse(w, 500, map[string]string{"error": err.Error()})
		return
	}

	jsonResponse(w, 201, map[string]string{"status": "submitted"})
}

func (h *Handler) UpdateUserSourceSettings(w http.ResponseWriter, r *http.Request) {
	sourceID, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		jsonResponse(w, 400, map[string]string{"error": "invalid id"})
		return
	}

	if SourceByID(sourceID) == nil {
		jsonResponse(w, 404, map[string]string{"error": "source not found"})
		return
	}

	var req struct {
		Enabled    bool `json:"enabled"`
		MaxAgeDays *int `json:"max_age_days"`
	}
	if err := decodeJSON(r, &req); err != nil {
		jsonResponse(w, 400, map[string]string{"error": "invalid body"})
		return
	}

	claims := auth.ClaimsFromContext(r)
	userID, err := auth.GetUserID(h.db, claims.Sub)
	if err != nil {
		jsonResponse(w, 500, map[string]string{"error": "could not resolve user"})
		return
	}

	if _, err := h.db.Exec(`
		INSERT INTO user_source_settings (user_id, source_id, enabled, max_age_days)
		VALUES (?, ?, ?, ?)
		ON DUPLICATE KEY UPDATE enabled = VALUES(enabled), max_age_days = VALUES(max_age_days)`,
		userID, sourceID, req.Enabled, req.MaxAgeDays,
	); err != nil {
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
