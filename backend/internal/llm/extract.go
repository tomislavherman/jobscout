package llm

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"
	"time"
)

type Config struct {
	APIKey  string
	BaseURL string
}

type ExtractedJob struct {
	ExternalID     string  `json:"external_id"`
	URL            *string `json:"url,omitempty"`
	Role           *string `json:"role,omitempty"`
	Company        *string `json:"company,omitempty"`
	Location       *string `json:"location,omitempty"`
	RemoteType     *string `json:"remote_type,omitempty"`
	Residency      *string `json:"residency,omitempty"`
	EmploymentType *string `json:"employment_type,omitempty"`
	Salary         *string `json:"salary,omitempty"`
}

type claudeRequest struct {
	Model     string      `json:"model"`
	MaxTokens int         `json:"max_tokens"`
	System    string      `json:"system"`
	Messages  []claudeMsg `json:"messages"`
}

type claudeMsg struct {
	Role    string       `json:"role"`
	Content []claudePart `json:"content"`
}

type claudePart struct {
	Type string `json:"type"`
	Text string `json:"text,omitempty"`
}

type claudeResponse struct {
	Content []struct {
		Type string `json:"type"`
		Text string `json:"text"`
	} `json:"content"`
}

type Client struct {
	cfg   Config
	http  *http.Client
}

func NewClient(cfg Config) *Client {
	return &Client{
		cfg:  cfg,
		http: &http.Client{Timeout: 60 * time.Second},
	}
}

func (c *Client) ExtractJobs(comments []string) ([]ExtractedJob, error) {
	if c.cfg.APIKey == "" {
		return nil, fmt.Errorf("Anthropic API key not set — set ANTHROPIC_API_KEY env var or use the Sources page config")
	}

	systemPrompt := `You extract job postings from Hacker News "Who is Hiring?" thread comments.
Each comment may list multiple jobs. Extract each as a separate JSON object.
Return a JSON array of objects with these fields:
- external_id: the comment ID string (you'll be given this per comment)
- url: application URL if mentioned
- role: job title
- company: company name
- location: location
- remote_type: "remote", "onsite", "hybrid", or null
- residency: residency requirement (e.g. "global", "US-only", "EU-only"), or null
- employment_type: "full-time", "part-time", "contract", or null
- salary: salary range as free text

If a comment doesn't contain a job posting, return an empty array.
Output ONLY valid JSON, no markdown fences, no commentary.`

	var jobs []ExtractedJob

	total := len(comments)
	for i := 0; i < total; i += 10 {
		end := i + 10
		if end > total {
			end = total
		}
		batch := comments[i:end]
		batchNum := i/10 + 1
		totalBatches := (total + 9) / 10

		log.Printf("LLM extract: batch %d/%d (comments %d-%d of %d)", batchNum, totalBatches, i+1, end, total)

		parts := batch

		body := claudeRequest{
			Model:     "claude-sonnet-4-20250514",
			MaxTokens: 16000,
			System:    systemPrompt,
			Messages: []claudeMsg{
				{
					Role: "user",
					Content: []claudePart{
						{Type: "text", Text: "Extract jobs from these HN comments:\n\n" + strings.Join(parts, "\n\n")},
					},
				},
			},
		}

		payload, err := json.Marshal(body)
		if err != nil {
			return nil, fmt.Errorf("marshal request: %w", err)
		}

		log.Printf("LLM request:\n%s", string(payload))

		req, err := http.NewRequest("POST", c.cfg.BaseURL, bytes.NewReader(payload))
		if err != nil {
			return nil, fmt.Errorf("create request: %w", err)
		}
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("x-api-key", c.cfg.APIKey)
		req.Header.Set("anthropic-version", "2023-06-01")

		resp, err := c.http.Do(req)
		if err != nil {
			return nil, fmt.Errorf("claude API call: %w", err)
		}

		respBody, err := io.ReadAll(resp.Body)
		resp.Body.Close()
		if err != nil {
			return nil, fmt.Errorf("read response: %w", err)
		}

		log.Printf("LLM response (status %d):\n%s", resp.StatusCode, string(respBody))

		if resp.StatusCode != 200 {
			return nil, fmt.Errorf("claude API error %d: %s", resp.StatusCode, string(respBody))
		}

		var claudeResp claudeResponse
		if err := json.Unmarshal(respBody, &claudeResp); err != nil {
			return nil, fmt.Errorf("unmarshal claude response: %w", err)
		}

		var textBlock string
		for _, block := range claudeResp.Content {
			if block.Type == "text" {
				textBlock = block.Text
				break
			}
		}
		if textBlock == "" {
			continue
		}

		var batchJobs []ExtractedJob
		text := textBlock
		text = strings.TrimSpace(text)
		text = strings.TrimPrefix(text, "```json")
		text = strings.TrimPrefix(text, "```")
		text = strings.TrimSuffix(text, "```")
		text = strings.TrimSpace(text)

		if err := json.Unmarshal([]byte(text), &batchJobs); err != nil {
			var single ExtractedJob
			if json.Unmarshal([]byte(text), &single) == nil {
				batchJobs = []ExtractedJob{single}
			} else {
				continue
			}
		}

		log.Printf("LLM extract: batch %d/%d done — %d jobs extracted", batchNum, totalBatches, len(batchJobs))
		jobs = append(jobs, batchJobs...)
	}

	return jobs, nil
}
