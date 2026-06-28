package server

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"
)

func (s *Server) listSources(w http.ResponseWriter, r *http.Request) {
	claims := claimsFromContext(r)
	userID, err := s.getUserID(claims.Sub)
	if err != nil {
		jsonResponse(w, 500, map[string]string{"error": "could not resolve user"})
		return
	}

	result := make([]map[string]any, 0, len(Sources))
	for _, src := range Sources {
		var enabledInt int8 = 1
		var maxAgeDays *int
		if err := s.db.QueryRow(
			"SELECT enabled, max_age_days FROM user_source_settings WHERE user_id = ? AND source_id = ?",
			userID, src.ID,
		).Scan(&enabledInt, &maxAgeDays); err != nil {
			// No row — default to 30 days
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

func (s *Server) submitSourceRequest(w http.ResponseWriter, r *http.Request) {
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

	// user_id is optional — endpoint is public
	var userID *int64
	if claims := claimsFromContext(r); claims != nil && claims.Sub != "" {
		if id, err := s.getUserID(claims.Sub); err == nil {
			userID = &id
		}
	}

	_, err := s.db.Exec(
		"INSERT INTO source_requests (user_id, url, note) VALUES (?, ?, ?)",
		userID, strings.TrimSpace(req.URL), strings.TrimSpace(req.Note),
	)
	if err != nil {
		jsonResponse(w, 500, map[string]string{"error": err.Error()})
		return
	}

	jsonResponse(w, 201, map[string]string{"status": "submitted"})
}

func (s *Server) updateUserSourceSettings(w http.ResponseWriter, r *http.Request) {
	sourceID, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
	if err != nil {
		jsonResponse(w, 400, map[string]string{"error": "invalid id"})
		return
	}

	if sourceByID(sourceID) == nil {
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

	claims := claimsFromContext(r)
	userID, err := s.getUserID(claims.Sub)
	if err != nil {
		jsonResponse(w, 500, map[string]string{"error": "could not resolve user"})
		return
	}

	if _, err := s.db.Exec(`
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
