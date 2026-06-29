package server

import (
	"database/sql"
	"embed"
	"io/fs"
	"log"
	"net/http"
	"os"
	"strings"

	"github.com/go-chi/chi/v5"
	"jobscout/internal/admin"
	"jobscout/internal/auth"
	"jobscout/internal/jobs"
	"jobscout/internal/llm"
	"jobscout/internal/sources"
)

//go:embed static
var staticFiles embed.FS

type Server struct {
	auth    *auth.Handler
	jobs    *jobs.Handler
	sources *sources.Handler
	admin   *admin.Handler
	mux     http.Handler
}

func New(db *sql.DB, llmClient *llm.Client) *Server {
	secret := []byte(os.Getenv("JWT_SECRET"))
	if len(secret) == 0 {
		log.Fatal("JWT_SECRET must be set")
	}
	s := &Server{
		auth:    auth.NewHandler(db, secret),
		jobs:    jobs.NewHandler(db, llmClient),
		sources: sources.NewHandler(db),
		admin:   admin.NewHandler(db, llmClient),
	}
	s.mux = s.routes(secret)
	return s
}

func (s *Server) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	s.mux.ServeHTTP(w, r)
}

func (s *Server) routes(secret []byte) http.Handler {
	r := chi.NewRouter()

	r.Use(loggingMiddleware)
	r.Use(corsMiddleware)

	r.Route("/api", func(r chi.Router) {
		r.Post("/auth/login", s.auth.Login)
		r.Post("/auth/signup", s.auth.Signup)
		r.Post("/auth/refresh", s.auth.RefreshToken)
		r.Get("/public/jobs", s.jobs.ListPublicJobs)
		r.Get("/public/jobs/{id}", s.jobs.GetPublicJob)
		r.With(auth.OptionalAuthMiddleware(secret)).Post("/source-requests", s.sources.SubmitSourceRequest)

		r.Group(func(r chi.Router) {
			r.Use(auth.AuthMiddleware(secret))
			r.Put("/user/profile", s.auth.UpdateProfile)
			r.Put("/user/password", s.auth.UpdatePassword)
			r.Get("/sources", s.sources.ListSources)
			r.Put("/sources/{id}/settings", s.sources.UpdateUserSourceSettings)
			r.Get("/jobs", s.jobs.ListJobs)
			r.Get("/jobs/{id}", s.jobs.GetJob)
			r.Post("/jobs/{id}/status", s.jobs.ChangeStatus)
			r.Post("/jobs/{id}/timeline", s.jobs.AddTimelineEntry)
			r.Get("/stats", s.jobs.GetStats)
		})

		r.Group(func(r chi.Router) {
			r.Use(auth.AdminMiddleware(secret))
			r.Get("/admin/users", s.admin.ListUsers)
			r.Put("/admin/users/{id}/role", s.admin.UpdateUserRole)
			r.Get("/admin/sources", s.admin.AdminListSources)
			r.Get("/admin/syncs", s.admin.AdminLastSyncs)
			r.Post("/admin/sync/{sourceId}", s.admin.TriggerSync)
			r.Put("/admin/sources/{sourceId}/settings", s.admin.AdminUpdateSourceSettings)
			r.Get("/admin/source-requests", s.admin.AdminListSourceRequests)
			r.Post("/admin/jobs/{id}/hide", s.jobs.HideJob)
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
