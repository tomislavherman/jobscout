package server

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strings"
	"time"

	"golang.org/x/crypto/bcrypt"
)

const (
	accessTokenTTL  = 15 * time.Minute
	refreshTokenTTL = 7 * 24 * time.Hour
)

type contextKey string

const claimsKey contextKey = "claims"

type tokenClaims struct {
	Sub  string `json:"sub"`
	Role string `json:"role"`
	Type string `json:"type"` // "access" | "refresh"
	Exp  int64  `json:"exp"`
}

func jwtSecret() []byte {
	return []byte(os.Getenv("JWT_SECRET"))
}

func issueToken(username, role, tokenType string, ttl time.Duration) (string, error) {
	claims := tokenClaims{
		Sub:  username,
		Role: role,
		Type: tokenType,
		Exp:  time.Now().Add(ttl).Unix(),
	}
	payload, err := json.Marshal(claims)
	if err != nil {
		return "", err
	}
	b64 := base64.RawURLEncoding.EncodeToString(payload)
	mac := hmac.New(sha256.New, jwtSecret())
	mac.Write([]byte(b64))
	sig := base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
	return b64 + "." + sig, nil
}

func verifyToken(token, expectedType string) (*tokenClaims, error) {
	parts := strings.SplitN(token, ".", 2)
	if len(parts) != 2 {
		return nil, fmt.Errorf("malformed token")
	}
	mac := hmac.New(sha256.New, jwtSecret())
	mac.Write([]byte(parts[0]))
	expectedSig := base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
	if !hmac.Equal([]byte(parts[1]), []byte(expectedSig)) {
		return nil, fmt.Errorf("invalid signature")
	}
	payload, err := base64.RawURLEncoding.DecodeString(parts[0])
	if err != nil {
		return nil, fmt.Errorf("malformed token payload")
	}
	var claims tokenClaims
	if err := json.Unmarshal(payload, &claims); err != nil {
		return nil, fmt.Errorf("malformed token claims")
	}
	if time.Now().Unix() > claims.Exp {
		return nil, fmt.Errorf("token expired")
	}
	if claims.Type != expectedType {
		return nil, fmt.Errorf("wrong token type")
	}
	return &claims, nil
}

func claimsFromRequest(r *http.Request) (*tokenClaims, error) {
	header := r.Header.Get("Authorization")
	if !strings.HasPrefix(header, "Bearer ") {
		return nil, fmt.Errorf("missing token")
	}
	return verifyToken(strings.TrimPrefix(header, "Bearer "), "access")
}

func claimsFromContext(r *http.Request) *tokenClaims {
	c, _ := r.Context().Value(claimsKey).(*tokenClaims)
	return c
}

func (s *Server) signup(w http.ResponseWriter, r *http.Request) {
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
	s.db.QueryRow("SELECT COUNT(*) FROM users").Scan(&count)
	role := "user"
	if count == 0 {
		role = "admin"
	}

	if _, err := s.db.Exec(
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

	s.issueTokenPair(w, req.Username, role)
}

func (s *Server) login(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}
	if err := decodeJSON(r, &req); err != nil {
		jsonResponse(w, 400, map[string]string{"error": "invalid body"})
		return
	}

	var storedHash, role string
	err := s.db.QueryRow("SELECT password_hash, role FROM users WHERE username = ?", req.Username).Scan(&storedHash, &role)
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

	s.issueTokenPair(w, req.Username, role)
}

func (s *Server) refreshToken(w http.ResponseWriter, r *http.Request) {
	var req struct {
		RefreshToken string `json:"refresh_token"`
	}
	if err := decodeJSON(r, &req); err != nil {
		jsonResponse(w, 400, map[string]string{"error": "invalid body"})
		return
	}

	claims, err := verifyToken(req.RefreshToken, "refresh")
	if err != nil {
		jsonResponse(w, 401, map[string]string{"error": err.Error()})
		return
	}

	// Re-fetch role from DB so role changes take effect on next refresh
	var role string
	err = s.db.QueryRow("SELECT role FROM users WHERE username = ?", claims.Sub).Scan(&role)
	if err == sql.ErrNoRows {
		jsonResponse(w, 401, map[string]string{"error": "user not found"})
		return
	}
	if err != nil {
		jsonResponse(w, 500, map[string]string{"error": "server error"})
		return
	}

	accessToken, err := issueToken(claims.Sub, role, "access", accessTokenTTL)
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

func (s *Server) issueTokenPair(w http.ResponseWriter, username, role string) {
	accessToken, err := issueToken(username, role, "access", accessTokenTTL)
	if err != nil {
		jsonResponse(w, 500, map[string]string{"error": "could not issue token"})
		return
	}
	refreshToken, err := issueToken(username, role, "refresh", refreshTokenTTL)
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

func (s *Server) updateProfile(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Username string `json:"username"`
	}
	if err := decodeJSON(r, &req); err != nil || len(req.Username) < 3 {
		jsonResponse(w, 400, map[string]string{"error": "username must be at least 3 characters"})
		return
	}

	claims := claimsFromContext(r)

	var role string
	if err := s.db.QueryRow("SELECT role FROM users WHERE username = ?", claims.Sub).Scan(&role); err != nil {
		jsonResponse(w, 500, map[string]string{"error": "server error"})
		return
	}

	if _, err := s.db.Exec("UPDATE users SET username = ? WHERE username = ?", req.Username, claims.Sub); err != nil {
		if strings.Contains(err.Error(), "Duplicate entry") {
			jsonResponse(w, 409, map[string]string{"error": "username already taken"})
			return
		}
		jsonResponse(w, 500, map[string]string{"error": "could not update username"})
		return
	}

	s.issueTokenPair(w, req.Username, role)
}

func (s *Server) updatePassword(w http.ResponseWriter, r *http.Request) {
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

	claims := claimsFromContext(r)

	var storedHash string
	if err := s.db.QueryRow("SELECT password_hash FROM users WHERE username = ?", claims.Sub).Scan(&storedHash); err != nil {
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

	if _, err := s.db.Exec("UPDATE users SET password_hash = ? WHERE username = ?", string(hash), claims.Sub); err != nil {
		jsonResponse(w, 500, map[string]string{"error": "could not update password"})
		return
	}

	jsonResponse(w, 200, map[string]string{"status": "ok"})
}

func authMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		claims, err := claimsFromRequest(r)
		if err != nil {
			jsonResponse(w, 401, map[string]string{"error": err.Error()})
			return
		}
		ctx := context.WithValue(r.Context(), claimsKey, claims)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func optionalAuthMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if claims, err := claimsFromRequest(r); err == nil {
			r = r.WithContext(context.WithValue(r.Context(), claimsKey, claims))
		}
		next.ServeHTTP(w, r)
	})
}

func adminMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		claims, err := claimsFromRequest(r)
		if err != nil {
			jsonResponse(w, 401, map[string]string{"error": err.Error()})
			return
		}
		if claims.Role != "admin" {
			jsonResponse(w, 403, map[string]string{"error": "forbidden"})
			return
		}
		ctx := context.WithValue(r.Context(), claimsKey, claims)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}
