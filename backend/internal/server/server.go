package server

import (
	"database/sql"
	"embed"
	"encoding/json"
	"io/fs"
	"log"
	"net/http"
	"os"
	"strings"

	"github.com/go-chi/chi/v5"
	"jobscout/internal/llm"
)

//go:embed static
var staticFiles embed.FS

type Server struct {
	db       *sql.DB
	llm      *llm.Client
	mux      http.Handler
}

func New(db *sql.DB, llmClient *llm.Client) *Server {
	if os.Getenv("JWT_SECRET") == "" {
		log.Fatal("JWT_SECRET must be set")
	}
	s := &Server{db: db, llm: llmClient}
	s.mux = s.routes()
	return s
}

func (s *Server) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	s.mux.ServeHTTP(w, r)
}

func (s *Server) routes() http.Handler {
	r := chi.NewRouter()

	r.Use(loggingMiddleware)
	r.Use(corsMiddleware)

	r.Route("/api", func(r chi.Router) {
		r.Post("/auth/login", s.login)
		r.Post("/auth/signup", s.signup)
		r.Post("/auth/refresh", s.refreshToken)
		r.Get("/public/jobs", s.listPublicJobs)
		r.Get("/public/jobs/{id}", s.getPublicJob)
			r.With(optionalAuthMiddleware).Post("/source-requests", s.submitSourceRequest)

		r.Group(func(r chi.Router) {
			r.Use(authMiddleware)
			r.Put("/user/profile", s.updateProfile)
			r.Put("/user/password", s.updatePassword)
			r.Get("/sources", s.listSources)
			r.Put("/sources/{id}/settings", s.updateUserSourceSettings)
			r.Get("/jobs", s.listJobs)
			r.Get("/jobs/{id}", s.getJob)
			r.Post("/jobs/{id}/status", s.changeStatus)
			r.Post("/jobs/{id}/timeline", s.addTimelineEntry)
			r.Get("/stats", s.getStats)
		})

		r.Group(func(r chi.Router) {
			r.Use(adminMiddleware)
			r.Get("/admin/users", s.listUsers)
			r.Put("/admin/users/{id}/role", s.updateUserRole)
			r.Get("/admin/sources", s.adminListSources)
			r.Get("/admin/syncs", s.adminLastSyncs)
			r.Post("/admin/sync/{sourceId}", s.triggerSync)
			r.Put("/admin/sources/{sourceId}/settings", s.adminUpdateSourceSettings)
			r.Get("/admin/source-requests", s.adminListSourceRequests)
			r.Post("/admin/jobs/{id}/hide", s.hideJob)
		})
	})

	// Serve embedded frontend static files with SPA fallback
	static, _ := fs.Sub(staticFiles, "static")
	fileServer := http.FileServer(http.FS(static))
	r.Get("/*", func(w http.ResponseWriter, r *http.Request) {
		path := strings.TrimPrefix(r.URL.Path, "/")
		if path != "" {
			if _, err := fs.Stat(static, path); err == nil {
				fileServer.ServeHTTP(w, r)
				return
			}
		}
		// SPA fallback: serve index.html for any unmatched route
		index, err := staticFiles.ReadFile("static/index.html")
		if err != nil {
			http.Error(w, "Not found", http.StatusNotFound)
			return
		}
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.Write(index)
	})

	return r
}

func jsonResponse(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}
