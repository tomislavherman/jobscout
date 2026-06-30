package llm

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"strings"

	"github.com/anthropics/anthropic-sdk-go"
	"github.com/anthropics/anthropic-sdk-go/option"
)

type Config struct {
	APIKey  string
	BaseURL string
	Model   string
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

type Client struct {
	apiKey string
	model  string
	sdk    anthropic.Client
}

func NewClient(cfg Config) *Client {
	opts := []option.RequestOption{option.WithAPIKey(cfg.APIKey)}
	if cfg.BaseURL != "" {
		opts = append(opts, option.WithBaseURL(cfg.BaseURL))
	}
	return &Client{
		apiKey: cfg.APIKey,
		model:  cfg.Model,
		sdk:    anthropic.NewClient(opts...),
	}
}

var extractJobsTool = anthropic.ToolUnionParam{
	OfTool: &anthropic.ToolParam{
		Name:        "extract_jobs",
		Description: anthropic.String("Extract job postings from Hacker News comments. Call once with all jobs found across all provided comments."),
		InputSchema: anthropic.ToolInputSchemaParam{
			Properties: map[string]any{
				"jobs": map[string]any{
					"type":        "array",
					"description": "List of extracted job postings. Empty array if no jobs found.",
					"items": map[string]any{
						"type": "object",
						"properties": map[string]any{
							"external_id":     map[string]any{"type": "string", "description": "The HN comment ID"},
							"url":             map[string]any{"type": "string", "description": "Application or job URL if mentioned"},
							"role":            map[string]any{"type": "string", "description": "Job title"},
							"company":         map[string]any{"type": "string", "description": "Company name"},
							"location":        map[string]any{"type": "string", "description": "Office location"},
							"remote_type":     map[string]any{"type": "string", "enum": []string{"remote", "onsite", "hybrid"}, "description": "Work arrangement"},
							"residency":       map[string]any{"type": "string", "description": "Residency requirement, e.g. US-only, EU-only, global"},
							"employment_type": map[string]any{"type": "string", "enum": []string{"full-time", "part-time", "contract"}, "description": "Employment type"},
							"salary":          map[string]any{"type": "string", "description": "Salary range as free text"},
						},
						"required": []string{"external_id"},
					},
				},
			},
		},
	},
}

const systemPrompt = `You extract job postings from Hacker News "Who is Hiring?" thread comments.
Each comment may list multiple jobs — extract each as a separate entry.
If a comment doesn't contain a job posting, skip it.
Each comment is prefixed with its ID in the format [id:12345].`

func (c *Client) ExtractJobs(comments []string) ([]ExtractedJob, error) {
	if c.apiKey == "" {
		return nil, fmt.Errorf("Anthropic API key not set — set ANTHROPIC_API_KEY env var or use the Sources page config")
	}
	if c.model == "" {
		return nil, fmt.Errorf("LLM model not set — set ANTHROPIC_MODEL env var")
	}

	var jobs []ExtractedJob
	total := len(comments)

	for i := 0; i < total; i += 10 {
		end := min(i+10, total)
		batch := comments[i:end]
		batchNum := i/10 + 1
		totalBatches := (total + 9) / 10

		log.Printf("LLM extract: batch %d/%d (comments %d-%d of %d)", batchNum, totalBatches, i+1, end, total)

		msg, err := c.sdk.Messages.New(context.Background(), anthropic.MessageNewParams{
			Model:     anthropic.Model(c.model),
			MaxTokens: 16000,
			System:    []anthropic.TextBlockParam{{Text: systemPrompt}},
			Messages: []anthropic.MessageParam{
				anthropic.NewUserMessage(
					anthropic.NewTextBlock("Extract jobs from these HN comments:\n\n" + strings.Join(batch, "\n\n")),
				),
			},
			Tools:      []anthropic.ToolUnionParam{extractJobsTool},
			ToolChoice: anthropic.ToolChoiceUnionParam{OfAny: &anthropic.ToolChoiceAnyParam{}},
		})
		if err != nil {
			return nil, fmt.Errorf("batch %d: %w", batchNum, err)
		}

		for _, block := range msg.Content {
			tu, ok := block.AsAny().(anthropic.ToolUseBlock)
			if !ok || tu.Name != "extract_jobs" {
				continue
			}
			var input struct {
				Jobs []ExtractedJob `json:"jobs"`
			}
			if err := json.Unmarshal([]byte(tu.JSON.Input.Raw()), &input); err != nil {
				return nil, fmt.Errorf("batch %d: unmarshal tool input: %w", batchNum, err)
			}
			log.Printf("LLM extract: batch %d/%d done — %d jobs extracted", batchNum, totalBatches, len(input.Jobs))
			jobs = append(jobs, input.Jobs...)
		}
	}

	return jobs, nil
}
