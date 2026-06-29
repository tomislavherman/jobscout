package sync

import (
	"database/sql"
	"log"
	"time"

	"jobscout/internal/jobs"
	"jobscout/internal/llm"
	"jobscout/internal/sources"
)

type Scheduler struct {
	db  *sql.DB
	llm *llm.Client
}

func New(db *sql.DB, llmClient *llm.Client) *Scheduler {
	return &Scheduler{db: db, llm: llmClient}
}

func (s *Scheduler) Start(interval time.Duration) {
	ticker := time.NewTicker(interval)
	go func() {
		for range ticker.C {
			s.runSyncForSources()
		}
	}()
}

func (s *Scheduler) runSyncForSources() {
	for _, src := range sources.Sources {
		result, err := s.db.Exec(
			"INSERT INTO sync_runs (source_id, status) VALUES (?, 'running')",
			src.ID,
		)
		if err != nil {
			log.Printf("Scheduler: failed to create sync run for source %d: %v", src.ID, err)
			continue
		}

		runID, _ := result.LastInsertId()
		go func(sid, rid int64) {
			jobs.RunSync(s.db, s.llm, sid, rid)
		}(src.ID, runID)
	}
}
