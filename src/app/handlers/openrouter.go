package handlers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"time"
)

// Message represents a chat message for the OpenRouter API.
type Message struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

// OpenRouterProvider is the provider routing object for OpenRouter.
type OpenRouterProvider struct {
	Only []string `json:"only"`
}

// OpenRouterRequest is the request body for OpenRouter's chat completions.
type OpenRouterRequest struct {
	Model       string           `json:"model"`
	Messages    []Message        `json:"messages"`
	Temperature float64          `json:"temperature"`
	Provider    OpenRouterProvider `json:"provider"`
}

// OpenRouterChoice represents a choice in the response.
type OpenRouterChoice struct {
	Message Message `json:"message"`
}

// OpenRouterResponse is the top-level response from OpenRouter.
type OpenRouterResponse struct {
	Choices []OpenRouterChoice `json:"choices"`
}

// OpenRouterClient wraps the OpenRouter API.
type OpenRouterClient struct {
	apiKey string
	client *http.Client
}

// NewOpenRouterClient creates a new client from the OPENROUTER_API_KEY env var.
func NewOpenRouterClient() *OpenRouterClient {
	return &OpenRouterClient{
		apiKey: os.Getenv("OPENROUTER_API_KEY"),
		client: &http.Client{Timeout: 600 * time.Second},
	}
}

// Chat sends a request to OpenRouter and returns the AI response text.
func (c *OpenRouterClient) Chat(model string, messages []Message, temperature float64) (string, error) {
	reqBody := OpenRouterRequest{
		Model:       model,
		Messages:    messages,
		Temperature: temperature,
		Provider:    OpenRouterProvider{Only: []string{"anthropic"}},
	}

	body, err := json.Marshal(reqBody)
	if err != nil {
		return "", fmt.Errorf("marshal request: %w", err)
	}

	req, err := http.NewRequest("POST", "https://openrouter.ai/api/v1/chat/completions", bytes.NewReader(body))
	if err != nil {
		return "", fmt.Errorf("create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+c.apiKey)

	resp, err := c.client.Do(req)
	if err != nil {
		return "", fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("openrouter error %d: %s", resp.StatusCode, string(respBody))
	}

	var result OpenRouterResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", fmt.Errorf("decode response: %w", err)
	}

	if len(result.Choices) == 0 {
		return "", fmt.Errorf("no choices in response")
	}

	content := result.Choices[0].Message.Content
	if content == "" {
		return "", fmt.Errorf("empty content from model %s", model)
	}

	return content, nil
}

// System prompts for different AI tasks.

const SystemPromptClarify = `You are an AI tutor helping a student design a custom learning course on any topic. The student has described what they want to learn.

Your job is to ask clarifying questions to narrow the scope. Rules:
- Ask AT MOST 3 questions total, ONE per message.
- Reject vague topics like "teach me history" — require a concrete focus (e.g., "the causes of the French Revolution" or "how to bake sourdough bread").
- Focus on: the student's prior knowledge level, the specific topic or skill, and the desired outcome.
- CRITICAL: Before asking any question, check the full conversation history. If the student has already answered a question, NEVER ask it again. Never make the student repeat themselves.
- When you have enough information, respond with exactly: GENERATE_OUTLINE 
- Do NOT generate the outline yourself. Just say GENERATE_OUTLINE.`

const SystemPromptGenerateChapter = `You are an AI course author. Generate a single chapter for a learning course on any topic.

Return ONLY a raw JSON object. No markdown, no code fences, no backticks, no prose before or after. The first character must be { and the last must be }.

Structure:
{
  "title": "Chapter Title",
  "sections": [
    {"type": "text", "heading": "Subheading", "content": "prose explanation"},
    {"type": "code-block", "language": "c", "content": "code here"},
    {"type": "step-list", "steps": [{"title": "Step title", "body": "Step body"}]},
    {"type": "callout", "variant": "info|warning|tip", "content": "callout text"},
    {"type": "concept-card", "term": "term", "definition": "definition", "example": "example"},
    {"type": "comparison-table", "columns": ["A", "B"], "rows": [["A1","B1"],["A2","B2"]]},
    {"type": "key-value-grid", "pairs": [["key","value"]]},
    {"type": "resource-links", "links": [{"title": "link title", "url": "https://...", "description": "one line"}]},
    {"type": "quiz", "question": "question?", "options": ["A","B","C","D"], "correct": 0}
  ],
  "test": {
    "questions": [
      {"type": "multiple_choice", "question": "...", "options": ["A","B","C","D"], "correct": 0},
      {"type": "written", "question": "...", "rubric": "grading criteria"},
      {"type": "code", "question": "...", "rubric": "grading criteria", "language": "c"}
    ]
  }
}

RULES:
- Use multiple section types for visual variety (text, callout, concept-card, step-list, comparison-table, etc.)
- Adapt section types to the course topic — use code-block and code questions for technical subjects, written questions and concept-cards for humanities, step-lists for practical skills
- Include at least one resource-links section at the end
- Include 1-2 inline quiz sections mid-chapter
- The test must have at least 3 questions mixing multiple types appropriate to the subject
- Content must be plain text (no HTML escaping needed — the renderer handles that)
- CRITICAL: Return ONLY the JSON object. Nothing else. No markdown formatting.`

const SystemPromptGrade = `You are an AI grader. Grade the student's answer against the rubric.

Return ONLY a raw JSON object. No markdown, no code fences, no backticks, no prose before or after.
First character must be { and last character must be }.

Format: {"score": 85, "feedback": "2-3 sentences explaining the score and what to improve."}

Score from 0-100. Be fair but rigorous. Feedback must be 2-3 sentences.`

const SystemPromptAsk = `You are an AI tutor helping a student with their course. The student can ask you questions about the course material, request clarification, or ask for additional examples.

Here is the full course context (all chapters). Use it to answer the student's question accurately and concisely.

Keep answers focused and helpful. If the question is outside the course scope, say so politely.`

const SystemPromptOutline = `You are an AI course designer. Generate a chapter outline for a learning course based on the conversation context.

Return ONLY a raw JSON array of chapter titles. No markdown, no code fences, no backticks, no prose. First character must be [, last must be ].

Example: ["Introduction to the Topic", "Core Concepts", "Practical Applications", "Advanced Techniques"]

Aim for 6-10 chapters. Start with fundamentals, progress to deeper topics, end with mastery and next steps.`

// Model names for OpenRouter (Anthropic via OpenRouter).
const (
	ModelPrimary = "anthropic/claude-sonnet-4.6" // Heavy lifting: chapter generation, outline
	ModelFast    = "anthropic/claude-haiku-4.5"  // Fast responses: chat, ask, grading, title gen
)
