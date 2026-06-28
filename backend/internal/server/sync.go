package server

import (
	"database/sql"
	"fmt"
	"log"
	"time"

	"jobscout/internal/llm"
)

func RunSync(db *sql.DB, llmClient *llm.Client, sourceID, runID int64) {
	log.Printf("Sync %d: starting for source %d", runID, sourceID)

	src := sourceByID(sourceID)
	if src == nil {
		log.Printf("Sync %d: unknown source %d", runID, sourceID)
		markSyncFailed(db, runID, fmt.Sprintf("unknown source: %d", sourceID))
		return
	}

	var rawBatch *int
	db.QueryRow("SELECT sync_batch_size FROM source_settings WHERE source_id = ?", sourceID).Scan(&rawBatch)

	// nil = not set → default 10; 0 = unlimited → pass nil; N = cap at N
	var batchSize *int
	if rawBatch == nil {
		n := 10
		batchSize = &n
	} else if *rawBatch > 0 {
		batchSize = rawBatch
	} // else *rawBatch == 0 → unlimited, batchSize stays nil

	jobs, err := syncHNComments(db, llmClient, sourceID, src.FeedType, batchSize)
	if err != nil {
		log.Printf("Sync %d: sync failed: %v", runID, err)
		markSyncFailed(db, runID, err.Error())
		return
	}

	newCount := 0
	for _, j := range jobs {
		_, err := db.Exec(
			`INSERT INTO jobs (source_id, external_id, url, role, company, location, remote_type, residency, employment_type, salary, raw_text, status, published_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', ?)`,
			j.SourceID, j.ExternalID, j.URL, j.Role, j.Company, j.Location, j.RemoteType,
			j.Residency, j.EmploymentType, j.Salary, j.RawText, j.PublishedAt,
		)
		if err != nil {
			continue
		}
		newCount++
	}

	_, err = db.Exec(
		"UPDATE sync_runs SET status = 'success', completed_at = NOW(), jobs_found = ?, jobs_new = ? WHERE id = ?",
		len(jobs), newCount, runID,
	)
	if err != nil {
		log.Printf("Sync %d: failed to update sync run: %v", runID, err)
	}

	log.Printf("Sync %d: completed — %d found, %d new", runID, len(jobs), newCount)
}

func markSyncFailed(db *sql.DB, runID int64, reason string) {
	db.Exec(
		"UPDATE sync_runs SET status = 'failed', completed_at = NOW() WHERE id = ?",
		runID,
	)
	log.Printf("Sync %d: failed — %s", runID, reason)
}

func syncHNComments(db *sql.DB, llmClient *llm.Client, sourceID int64, feedType string, batchSize *int) ([]jobInsert, error) {
	return hnFetchAndExtract(db, llmClient, sourceID, feedType, batchSize)
}

type jobInsert struct {
	SourceID       int64
	ExternalID     string
	URL            *string
	Role           *string
	Company        *string
	Location       *string
	RemoteType     *string
	Residency      *string
	EmploymentType *string
	Salary         *string
	RawText        *string
	PublishedAt    *time.Time
}
