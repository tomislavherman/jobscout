package server

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
)

var (
	htmlBlockTagRegex = regexp.MustCompile(`(?i)<(br|p|div|li)[^>]*>`)
	htmlTagRegex      = regexp.MustCompile(`<[^>]*>`)
)

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
	var jobs []jobInsert
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
		jobs = append(jobs, jobInsert{
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

	return jobs, nil
}
