package auth

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
)

type contextKey string

const claimsKey contextKey = "claims"

func ClaimsFromContext(r *http.Request) *Claims {
	c, _ := r.Context().Value(claimsKey).(*Claims)
	return c
}

func claimsFromRequest(r *http.Request, secret []byte) (*Claims, error) {
	header := r.Header.Get("Authorization")
	if !strings.HasPrefix(header, "Bearer ") {
		return nil, fmt.Errorf("missing token")
	}
	return verifyToken(strings.TrimPrefix(header, "Bearer "), "access", secret)
}

func AuthMiddleware(secret []byte) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			claims, err := claimsFromRequest(r, secret)
			if err != nil {
				jsonResponse(w, 401, map[string]string{"error": err.Error()})
				return
			}
			ctx := context.WithValue(r.Context(), claimsKey, claims)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func OptionalAuthMiddleware(secret []byte) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if claims, err := claimsFromRequest(r, secret); err == nil {
				r = r.WithContext(context.WithValue(r.Context(), claimsKey, claims))
			}
			next.ServeHTTP(w, r)
		})
	}
}

func AdminMiddleware(secret []byte) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			claims, err := claimsFromRequest(r, secret)
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
}

func jsonResponse(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}
