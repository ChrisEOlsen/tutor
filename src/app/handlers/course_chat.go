package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"
	"gova/app/cache"
	"gova/app/models"
)

type chatReq struct {
	Message string `json:"message"`
}

func CourseChatPOST(readDB, writeDB *sql.DB, appCache *cache.Cache) http.HandlerFunc {
	cm := models.NewCourseModel(readDB, writeDB, appCache)
	client := NewOpenRouterClient()
	return func(w http.ResponseWriter, r *http.Request) {
		idStr := chi.URLParam(r, "id")
		id, err := strconv.ParseInt(idStr, 10, 64)
		if err != nil {
			jsonError(w, "invalid course id", 400)
			return
		}

		course, err := cm.Find(id)
		if err != nil {
			jsonError(w, "course not found", 404)
			return
		}

		var req chatReq
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			jsonError(w, "invalid request body", 400)
			return
		}
		if req.Message == "" {
			jsonError(w, "message is required", 400)
			return
		}

		// Parse existing chat history
		var messages []Message
		if err := json.Unmarshal([]byte(course.ChatHistory), &messages); err != nil {
			messages = []Message{}
		}

		// Add user message
		messages = append(messages, Message{Role: "user", Content: req.Message})

		// Only send last 6 messages to keep context small
		if len(messages) > 6 {
			messages = messages[len(messages)-6:]
		}

		// Build API messages with system prompt
		apiMessages := []Message{{Role: "system", Content: SystemPromptClarify}}
		apiMessages = append(apiMessages, messages...)

		response, err := client.Chat(ModelDefault, apiMessages, 0.7)
		if err != nil {
			jsonError(w, "AI error: "+err.Error(), 500)
			return
		}

		// Add AI response
		messages = append(messages, Message{Role: "assistant", Content: response})
		messagesJSON, _ := json.Marshal(messages)

		// Update course
		if err := cm.Update(id, course.Title, course.Status, string(messagesJSON), course.Outline, course.Chapters, course.CurrentChapter, course.TestResults, course.FinalGrade); err != nil {
			jsonError(w, "failed to save chat", 500)
			return
		}

		jsonOK(w, map[string]string{"response": response})
	}
}

func CourseGenerateOutlinePOST(readDB, writeDB *sql.DB, appCache *cache.Cache) http.HandlerFunc {
	cm := models.NewCourseModel(readDB, writeDB, appCache)
	client := NewOpenRouterClient()
	return func(w http.ResponseWriter, r *http.Request) {
		idStr := chi.URLParam(r, "id")
		id, err := strconv.ParseInt(idStr, 10, 64)
		if err != nil {
			jsonError(w, "invalid course id", 400)
			return
		}

		course, err := cm.Find(id)
		if err != nil {
			jsonError(w, "course not found", 404)
			return
		}

		var messages []Message
		if err := json.Unmarshal([]byte(course.ChatHistory), &messages); err != nil {
			messages = []Message{}
		}

		apiMessages := []Message{{Role: "system", Content: SystemPromptOutline}}
		apiMessages = append(apiMessages, messages...)

		response, err := client.Chat(ModelDefault, apiMessages, 0.7)
		if err != nil {
			jsonError(w, "AI error: "+err.Error(), 500)
			return
		}

		// Parse JSON array from response
		response = strings.TrimSpace(response)
		if strings.HasPrefix(response, "```") {
			// Strip markdown code blocks
			lines := strings.Split(response, "\n")
			var cleaned []string
			inBlock := false
			for _, line := range lines {
				if strings.Contains(line, "```") {
					inBlock = !inBlock
					continue
				}
				if inBlock {
					cleaned = append(cleaned, line)
				}
			}
			response = strings.Join(cleaned, "\n")
		}

		var outline []string
		if err := json.Unmarshal([]byte(response), &outline); err != nil {
			jsonError(w, "failed to parse outline: "+err.Error(), 500)
			return
		}

		outlineJSON, _ := json.Marshal(outline)
		if err := cm.Update(id, course.Title, "outline_ready", course.ChatHistory, string(outlineJSON), course.Chapters, course.CurrentChapter, course.TestResults, course.FinalGrade); err != nil {
			jsonError(w, "failed to save outline", 500)
			return
		}

		jsonOK(w, map[string]any{"outline": outline})
	}
}

func CourseDetailGET(readDB, writeDB *sql.DB, appCache *cache.Cache) http.HandlerFunc {
	cm := models.NewCourseModel(readDB, writeDB, appCache)
	return func(w http.ResponseWriter, r *http.Request) {
		idStr := chi.URLParam(r, "id")
		id, err := strconv.ParseInt(idStr, 10, 64)
		if err != nil {
			jsonError(w, "invalid course id", 400)
			return
		}

		course, err := cm.Find(id)
		if err != nil {
			jsonError(w, "course not found", 404)
			return
		}

		jsonOK(w, course)
	}
}
