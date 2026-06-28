package hn

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"
)

const baseURL = "https://hacker-news.firebaseio.com/v0"

var httpClient = &http.Client{Timeout: 30 * time.Second}

type Thread struct {
	ID    int    `json:"id"`
	Kids  []int  `json:"kids"`
	Text  string `json:"text"`
	Title string `json:"title"`
}

type Comment struct {
	ID     int    `json:"id"`
	Parent int    `json:"parent"`
	Text   string `json:"text"`
	Time   int64  `json:"time"`
	Kids   []int  `json:"kids,omitempty"`
	Dead   bool   `json:"dead,omitempty"`
}

func FetchThread(threadID int) (*Thread, error) {
	url := fmt.Sprintf("%s/item/%d.json", baseURL, threadID)
	resp, err := httpClient.Get(url)
	if err != nil {
		return nil, fmt.Errorf("fetch thread %d: %w", threadID, err)
	}
	defer resp.Body.Close()

	var thread Thread
	if err := json.NewDecoder(resp.Body).Decode(&thread); err != nil {
		return nil, fmt.Errorf("decode thread %d: %w", threadID, err)
	}

	return &thread, nil
}

func FetchComment(commentID int) (*Comment, error) {
	url := fmt.Sprintf("%s/item/%d.json", baseURL, commentID)
	resp, err := httpClient.Get(url)
	if err != nil {
		return nil, fmt.Errorf("fetch comment %d: %w", commentID, err)
	}
	defer resp.Body.Close()

	var comment Comment
	if err := json.NewDecoder(resp.Body).Decode(&comment); err != nil {
		return nil, fmt.Errorf("decode comment %d: %w", commentID, err)
	}

	return &comment, nil
}

// ResolveCurrentThread finds the most recent thread for the given feed type.
// feedType must be "hiring" or "freelancer".
func ResolveCurrentThread(feedType string) (*Thread, error) {
	var hnUser, keyword string
	switch feedType {
	case "hiring":
		hnUser = "whoishiring"
		keyword = "Who is hiring"
	case "freelancer":
		hnUser = "jon_north"
		keyword = "Freelancer"
	default:
		return nil, fmt.Errorf("unknown feed type: %s", feedType)
	}

	resp, err := httpClient.Get(baseURL + "/user/" + hnUser + ".json")
	if err != nil {
		return nil, fmt.Errorf("fetch %s user: %w", hnUser, err)
	}
	defer resp.Body.Close()

	var user struct {
		Submitted []int `json:"submitted"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&user); err != nil {
		return nil, fmt.Errorf("decode %s user: %w", hnUser, err)
	}

	limit := min(len(user.Submitted), 20)
	for _, id := range user.Submitted[:limit] {
		thread, err := FetchThread(id)
		if err != nil {
			continue
		}
		if strings.Contains(thread.Title, keyword) {
			return thread, nil
		}
	}

	return nil, fmt.Errorf("no current %s thread found", feedType)
}

// IsSeekingFreelancer reports whether a comment is a "SEEKING FREELANCER" post.
// It checks for the phrase within the first 300 characters of the text.
func IsSeekingFreelancer(text string) bool {
	check := text
	if len(check) > 300 {
		check = check[:300]
	}
	return strings.Contains(strings.ToUpper(check), "SEEKING FREELANCER")
}

func FetchAllComments(kids []int) ([]Comment, error) {
	var comments []Comment
	for _, kid := range kids {
		comment, err := FetchComment(kid)
		if err != nil {
			continue // skip individual failures
		}
		if comment.Dead || comment.Text == "" {
			continue
		}
		comments = append(comments, *comment)
	}
	return comments, nil
}
