package jobs

import (
	"database/sql"
	"fmt"
	"html"
	"log"
	"regexp"
	"strconv"
	"strings"
	"time"

	"jobscout/internal/hn"
	"jobscout/internal/llm"
	"jobscout/internal/sources"
)

var (
	htmlBlockTagRegex = regexp.MustCompile(`(?i)<(br|p|div|li)[^>]*>`)
	htmlTagRegex      = regexp.MustCompile(`<[^>]*>`)
)

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

func RunSync(db *sql.DB, llmClient *llm.Client, sourceID, runID int64) {
	log.Printf("Sync %d: starting for source %d", runID, sourceID)

	src := sources.SourceByID(sourceID)
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

	extractedJobs, err := hnFetchAndExtract(db, llmClient, sourceID, src.FeedType, batchSize)
	if err != nil {
		log.Printf("Sync %d: sync failed: %v", runID, err)
		markSyncFailed(db, runID, err.Error())
		return
	}

	newCount := 0
	for _, j := range extractedJobs {
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
		len(extractedJobs), newCount, runID,
	)
	if err != nil {
		log.Printf("Sync %d: failed to update sync run: %v", runID, err)
	}

	log.Printf("Sync %d: completed — %d found, %d new", runID, len(extractedJobs), newCount)
}

func markSyncFailed(db *sql.DB, runID int64, reason string) {
	db.Exec(
		"UPDATE sync_runs SET status = 'failed', completed_at = NOW() WHERE id = ?",
		runID,
	)
	log.Printf("Sync %d: failed — %s", runID, reason)
}

func stripHTML(s string) string {
	s = htmlBlockTagRegex.ReplaceAllString(s, "\n")
	s = htmlTagRegex.ReplaceAllString(s, "")
	s = html.UnescapeString(s)
	return strings.TrimSpace(s)
}

func hnFetchAndExtract(db *sql.DB, llmClient *llm.Client, sourceID int64, feedType string, batchSize *int) ([]jobInsert, error) {
	if feedType == "" {
		feedType = "hiring"
	}

	thread, err := hn.ResolveCurrentThread(feedType)
	if err != nil {
		return nil, fmt.Errorf("resolve thread: %w", err)
	}
	log.Printf("HN sync: resolved thread %d — %s", thread.ID, thread.Title)

	// Load already-processed comment IDs for this source.
	// Strip numeric suffixes (e.g. "42381234-1" → "42381234") so multi-job
	// comments are recognised as already imported.
	processedComments := make(map[string]bool)
	if rows, err := db.Query("SELECT external_id FROM jobs WHERE source_id = ?", sourceID); err == nil {
		defer rows.Close()
		for rows.Next() {
			var eid string
			if rows.Scan(&eid) == nil {
				base := eid
				if i := strings.LastIndexByte(eid, '-'); i >= 0 {
					if _, err := strconv.Atoi(eid[i+1:]); err == nil {
						base = eid[:i]
					}
				}
				processedComments[base] = true
			}
		}
	}

	// Filter and cap kids
	var newKids []int
	for _, kid := range thread.Kids {
		if !processedComments[strconv.Itoa(kid)] {
			newKids = append(newKids, kid)
		}
		if batchSize != nil && len(newKids) == *batchSize {
			break
		}
	}
	if len(newKids) == 0 {
		log.Printf("HN sync: all comments already imported")
		return nil, nil
	}
	log.Printf("HN sync: fetching %d new comments (thread has %d total)", len(newKids), len(thread.Kids))

	comments, err := hn.FetchAllComments(newKids)
	if err != nil {
		return nil, fmt.Errorf("fetch comments: %w", err)
	}

	if len(comments) == 0 {
		return nil, nil
	}

	// Build comment texts and maps of id -> published_at / raw text for later.
	// For freelancer feeds, only include SEEKING FREELANCER comments.
	publishedAt := make(map[string]time.Time)
	rawTexts := make(map[string]string)
	var commentTexts []string
	for _, c := range comments {
		text := stripHTML(c.Text)
		if text == "" {
			continue
		}
		if feedType == "freelancer" && !hn.IsSeekingFreelancer(text) {
			continue
		}
		id := strconv.Itoa(c.ID)
		commentTexts = append(commentTexts, fmt.Sprintf("--- Comment %s ---\n%s", id, text))
		publishedAt[id] = time.Unix(c.Time, 0)
		rawTexts[id] = text
	}

	if len(commentTexts) == 0 {
		return nil, nil
	}

	// Extract via LLM
	extracted, err := llmClient.ExtractJobs(commentTexts)
	if err != nil {
		return nil, fmt.Errorf("llm extract: %w", err)
	}

	// Count how many jobs came from each comment so we can suffix duplicates.
	commentJobCount := make(map[string]int)
	for _, ej := range extracted {
		commentJobCount[ej.ExternalID]++
	}
	commentJobSeen := make(map[string]int)

	// Map to job inserts
	var result []jobInsert
	for _, ej := range extracted {
		raw := rawTexts[ej.ExternalID]
		var pub *time.Time
		if t, ok := publishedAt[ej.ExternalID]; ok {
			pub = &t
		}
		externalID := ej.ExternalID
		if commentJobCount[ej.ExternalID] > 1 {
			externalID = fmt.Sprintf("%s-%d", ej.ExternalID, commentJobSeen[ej.ExternalID])
			commentJobSeen[ej.ExternalID]++
		}
		result = append(result, jobInsert{
			SourceID:       sourceID,
			ExternalID:     externalID,
			URL:            ej.URL,
			Role:           ej.Role,
			Company:        ej.Company,
			Location:       ej.Location,
			RemoteType:     ej.RemoteType,
			Residency:      ej.Residency,
			EmploymentType: ej.EmploymentType,
			Salary:         ej.Salary,
			RawText:        &raw,
			PublishedAt:    pub,
		})
	}

	return result, nil
}
