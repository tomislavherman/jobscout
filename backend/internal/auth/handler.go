package auth

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"golang.org/x/crypto/bcrypt"
)

type Handler struct {
	db        *sql.DB
	jwtSecret []byte
}

func NewHandler(db *sql.DB, jwtSecret []byte) *Handler {
	return &Handler{db: db, jwtSecret: jwtSecret}
}

func GetUserID(db *sql.DB, username string) (int64, error) {
	var id int64
	err := db.QueryRow("SELECT id FROM users WHERE username = ?", username).Scan(&id)
	return id, err
}

func (h *Handler) Signup(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}
	if err := decodeJSON(r, &req); err != nil {
		jsonResponse(w, 400, map[string]string{"error": "invalid body"})
		return
	}
	if len(req.Username) < 3 {
		jsonResponse(w, 400, map[string]string{"error": "username must be at least 3 characters"})
		return
	}
	if len(req.Password) < 6 {
		jsonResponse(w, 400, map[string]string{"error": "password must be at least 6 characters"})
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		jsonResponse(w, 500, map[string]string{"error": "could not hash password"})
		return
	}

	var count int
	h.db.QueryRow("SELECT COUNT(*) FROM users").Scan(&count)
	role := "user"
	if count == 0 {
		role = "admin"
	}

	if _, err := h.db.Exec(
		"INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)",
		req.Username, string(hash), role,
	); err != nil {
		if strings.Contains(err.Error(), "Duplicate entry") {
			jsonResponse(w, 409, map[string]string{"error": "username already taken"})
			return
		}
		jsonResponse(w, 500, map[string]string{"error": "could not create user"})
		return
	}

	h.issueTokenPair(w, req.Username, role)
}

func (h *Handler) Login(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}
	if err := decodeJSON(r, &req); err != nil {
		jsonResponse(w, 400, map[string]string{"error": "invalid body"})
		return
	}

	var storedHash, role string
	err := h.db.QueryRow("SELECT password_hash, role FROM users WHERE username = ?", req.Username).Scan(&storedHash, &role)
	if err == sql.ErrNoRows {
		jsonResponse(w, 401, map[string]string{"error": "invalid credentials"})
		return
	}
	if err != nil {
		jsonResponse(w, 500, map[string]string{"error": "server error"})
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(storedHash), []byte(req.Password)); err != nil {
		jsonResponse(w, 401, map[string]string{"error": "invalid credentials"})
		return
	}

	h.issueTokenPair(w, req.Username, role)
}

func (h *Handler) RefreshToken(w http.ResponseWriter, r *http.Request) {
	var req struct {
		RefreshToken string `json:"refresh_token"`
	}
	if err := decodeJSON(r, &req); err != nil {
		jsonResponse(w, 400, map[string]string{"error": "invalid body"})
		return
	}

	claims, err := verifyToken(req.RefreshToken, "refresh", h.jwtSecret)
	if err != nil {
		jsonResponse(w, 401, map[string]string{"error": err.Error()})
		return
	}

	var role string
	err = h.db.QueryRow("SELECT role FROM users WHERE username = ?", claims.Sub).Scan(&role)
	if err == sql.ErrNoRows {
		jsonResponse(w, 401, map[string]string{"error": "user not found"})
		return
	}
	if err != nil {
		jsonResponse(w, 500, map[string]string{"error": "server error"})
		return
	}

	accessToken, err := issueToken(claims.Sub, role, "access", AccessTokenTTL, h.jwtSecret)
	if err != nil {
		jsonResponse(w, 500, map[string]string{"error": "could not issue token"})
		return
	}

	jsonResponse(w, 200, map[string]string{
		"access_token": accessToken,
		"username":     claims.Sub,
		"role":         role,
	})
}

func (h *Handler) UpdateProfile(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Username string `json:"username"`
	}
	if err := decodeJSON(r, &req); err != nil || len(req.Username) < 3 {
		jsonResponse(w, 400, map[string]string{"error": "username must be at least 3 characters"})
		return
	}

	claims := ClaimsFromContext(r)

	var role string
	if err := h.db.QueryRow("SELECT role FROM users WHERE username = ?", claims.Sub).Scan(&role); err != nil {
		jsonResponse(w, 500, map[string]string{"error": "server error"})
		return
	}

	if _, err := h.db.Exec("UPDATE users SET username = ? WHERE username = ?", req.Username, claims.Sub); err != nil {
		if strings.Contains(err.Error(), "Duplicate entry") {
			jsonResponse(w, 409, map[string]string{"error": "username already taken"})
			return
		}
		jsonResponse(w, 500, map[string]string{"error": "could not update username"})
		return
	}

	h.issueTokenPair(w, req.Username, role)
}

func (h *Handler) UpdatePassword(w http.ResponseWriter, r *http.Request) {
	var req struct {
		CurrentPassword string `json:"current_password"`
		NewPassword     string `json:"new_password"`
	}
	if err := decodeJSON(r, &req); err != nil {
		jsonResponse(w, 400, map[string]string{"error": "invalid body"})
		return
	}
	if len(req.NewPassword) < 6 {
		jsonResponse(w, 400, map[string]string{"error": "password must be at least 6 characters"})
		return
	}

	claims := ClaimsFromContext(r)

	var storedHash string
	if err := h.db.QueryRow("SELECT password_hash FROM users WHERE username = ?", claims.Sub).Scan(&storedHash); err != nil {
		jsonResponse(w, 500, map[string]string{"error": "server error"})
		return
	}
	if err := bcrypt.CompareHashAndPassword([]byte(storedHash), []byte(req.CurrentPassword)); err != nil {
		jsonResponse(w, 401, map[string]string{"error": "current password is incorrect"})
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		jsonResponse(w, 500, map[string]string{"error": "could not hash password"})
		return
	}

	if _, err := h.db.Exec("UPDATE users SET password_hash = ? WHERE username = ?", string(hash), claims.Sub); err != nil {
		jsonResponse(w, 500, map[string]string{"error": "could not update password"})
		return
	}

	jsonResponse(w, 200, map[string]string{"status": "ok"})
}

func (h *Handler) issueTokenPair(w http.ResponseWriter, username, role string) {
	accessToken, err := issueToken(username, role, "access", AccessTokenTTL, h.jwtSecret)
	if err != nil {
		jsonResponse(w, 500, map[string]string{"error": "could not issue token"})
		return
	}
	refreshToken, err := issueToken(username, role, "refresh", RefreshTokenTTL, h.jwtSecret)
	if err != nil {
		jsonResponse(w, 500, map[string]string{"error": "could not issue token"})
		return
	}

	jsonResponse(w, 200, map[string]string{
		"access_token":  accessToken,
		"refresh_token": refreshToken,
		"username":      username,
		"role":          role,
	})
}

func decodeJSON(r *http.Request, v any) error {
	if r.Body == nil {
		return fmt.Errorf("empty body")
	}
	defer r.Body.Close()
	return json.NewDecoder(r.Body).Decode(v)
}
